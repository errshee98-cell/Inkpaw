import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Post, Comment, REACTIONS, MOODS } from '../models/Community.js';
import { validate, asyncHandler, HttpError } from '../middleware/errors.js';
import { authorKeyFor, randomAlias } from '../utils/anon.js';
import { needsSupport, containsAbuse, scrubPII } from '../utils/moderation.js';

const router = Router();
const REPORT_HIDE_THRESHOLD = 3;

const postLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, keyGenerator: (req) => req.userId, standardHeaders: true, legacyHeaders: false });

const idParam = validate(z.object({ id: z.string().refine(mongoose.isValidObjectId, 'bad id') }), 'params');

function postDTO(p, me) {
  return {
    id: p._id,
    alias: p.alias,
    aliasColor: p.aliasColor,
    body: p.body,
    mood: p.mood,
    tags: p.tags,
    reactions: p.reactions,
    myReactions: (p.reactedBy || []).filter((r) => r.startsWith(`${me}:`)).map((r) => r.split(':')[1]),
    commentCount: p.commentCount,
    needsSupport: p.needsSupport,
    mine: p.authorKey === me,
    createdAt: p.createdAt,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = authorKeyFor(req.userId);
    const filter = { hidden: false };
    if (MOODS.includes(req.query.mood)) filter.mood = req.query.mood;
    if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase().slice(0, 24);
    if (req.query.mine === 'true') filter.authorKey = me;
    if (req.query.before) {
      const d = new Date(String(req.query.before));
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }
    const posts = await Post.find(filter).select('+authorKey +reactedBy').sort({ createdAt: -1 }).limit(20).lean();
    res.json({ posts: posts.map((p) => postDTO(p, me)), hasMore: posts.length === 20 });
  })
);

router.post(
  '/',
  postLimiter,
  validate(
    z.object({
      body: z.string().trim().min(3).max(2000),
      mood: z.enum(MOODS).default('vent'),
      tags: z.array(z.string().trim().toLowerCase().max(24)).max(5).default([]),
    })
  ),
  asyncHandler(async (req, res) => {
    const body = scrubPII(req.body.body);
    if (containsAbuse(body)) throw new HttpError(422, 'Please keep the community kind — that post contains language we don’t allow.');
    const me = authorKeyFor(req.userId);
    const post = await Post.create({
      authorKey: me,
      ...randomAlias(),
      body,
      mood: req.body.mood,
      tags: [...new Set(req.body.tags.filter(Boolean))],
      needsSupport: needsSupport(body),
    });
    res.status(201).json({ post: postDTO(post.toObject(), me) });
  })
);

router.delete(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    const post = await Post.findOneAndDelete({ _id: req.params.id, authorKey: authorKeyFor(req.userId) });
    if (!post) throw new HttpError(404, 'Post not found');
    await Comment.deleteMany({ post: post._id });
    res.json({ ok: true });
  })
);

// Toggle a supportive reaction. Atomic so counts stay correct under concurrent clicks.
router.post(
  '/:id/react',
  idParam,
  validate(z.object({ reaction: z.enum(REACTIONS) })),
  asyncHandler(async (req, res) => {
    const me = authorKeyFor(req.userId);
    const marker = `${me}:${req.body.reaction}`;
    const field = `reactions.${req.body.reaction}`;
    let post = await Post.findOneAndUpdate(
      { _id: req.params.id, reactedBy: { $ne: marker } },
      { $addToSet: { reactedBy: marker }, $inc: { [field]: 1 } },
      { new: true }
    ).select('+authorKey +reactedBy').lean();
    if (!post) {
      post = await Post.findOneAndUpdate(
        { _id: req.params.id, reactedBy: marker },
        { $pull: { reactedBy: marker }, $inc: { [field]: -1 } },
        { new: true }
      ).select('+authorKey +reactedBy').lean();
    }
    if (!post) throw new HttpError(404, 'Post not found');
    res.json({ post: postDTO(post, me) });
  })
);

router.post(
  '/:id/report',
  idParam,
  asyncHandler(async (req, res) => {
    const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { reports: 1 } }, { new: true }).select('+reports');
    if (!post) throw new HttpError(404, 'Post not found');
    if (post.reports >= REPORT_HIDE_THRESHOLD && !post.hidden) {
      post.hidden = true;
      await post.save();
    }
    res.json({ ok: true });
  })
);

router.get(
  '/:id/comments',
  idParam,
  asyncHandler(async (req, res) => {
    const me = authorKeyFor(req.userId);
    const comments = await Comment.find({ post: req.params.id, hidden: false }).select('+authorKey').sort({ createdAt: 1 }).limit(200).lean();
    res.json({
      comments: comments.map((c) => ({ id: c._id, alias: c.alias, aliasColor: c.aliasColor, body: c.body, mine: c.authorKey === me, createdAt: c.createdAt })),
    });
  })
);

router.post(
  '/:id/comments',
  idParam,
  postLimiter,
  validate(z.object({ body: z.string().trim().min(1).max(800) })),
  asyncHandler(async (req, res) => {
    const post = await Post.findOne({ _id: req.params.id, hidden: false }).select('+authorKey');
    if (!post) throw new HttpError(404, 'Post not found');
    const body = scrubPII(req.body.body);
    if (containsAbuse(body)) throw new HttpError(422, 'Please keep replies kind.');
    const me = authorKeyFor(req.userId);
    // The original poster keeps one alias inside their own thread, so replies read naturally.
    const identity = post.authorKey === me ? { alias: `${post.alias} (OP)`, aliasColor: post.aliasColor } : randomAlias();
    const comment = await Comment.create({ post: post._id, authorKey: me, ...identity, body });
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
    res.status(201).json({ comment: { id: comment._id, alias: comment.alias, aliasColor: comment.aliasColor, body: comment.body, mine: true, createdAt: comment.createdAt } });
  })
);

router.post(
  '/comments/:id/report',
  idParam,
  asyncHandler(async (req, res) => {
    const c = await Comment.findByIdAndUpdate(req.params.id, { $inc: { reports: 1 } }, { new: true }).select('+reports');
    if (!c) throw new HttpError(404, 'Comment not found');
    if (c.reports >= REPORT_HIDE_THRESHOLD) await Comment.updateOne({ _id: c._id }, { hidden: true });
    res.json({ ok: true });
  })
);

export default router;
