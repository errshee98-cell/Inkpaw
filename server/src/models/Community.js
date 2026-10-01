import mongoose from 'mongoose';

export const REACTIONS = ['hug', 'heart', 'same', 'strength'];
export const MOODS = ['vent', 'sad', 'anxious', 'angry', 'tired', 'hopeful', 'grateful', 'happy'];

/**
 * Community posts are public, so they are plaintext — but anonymous.
 * `authorKey` = HMAC(ANON_SECRET, userId). It lets a user edit/delete their own posts and lets
 * moderators act on abuse, but it is never sent to clients and cannot be reversed to a user id
 * without the server secret. `alias` is a random friendly name like "Quiet Otter".
 */
const reactionFields = Object.fromEntries(REACTIONS.map((r) => [r, { type: Number, default: 0 }]));

const postSchema = new mongoose.Schema(
  {
    authorKey: { type: String, required: true, index: true, select: false },
    alias: { type: String, required: true },
    aliasColor: { type: String, default: '#c08457' },
    body: { type: String, required: true, maxlength: 2000 },
    mood: { type: String, enum: MOODS, default: 'vent' },
    tags: [{ type: String, maxlength: 24 }],
    reactions: reactionFields,
    reactedBy: { type: [String], default: [], select: false }, // `${authorKey}:${reaction}`
    commentCount: { type: Number, default: 0 },
    reports: { type: Number, default: 0, select: false },
    hidden: { type: Boolean, default: false },
    needsSupport: { type: Boolean, default: false },
  },
  { timestamps: true }
);

postSchema.index({ hidden: 1, createdAt: -1 });

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    authorKey: { type: String, required: true, select: false },
    alias: { type: String, required: true },
    aliasColor: { type: String, default: '#c08457' },
    body: { type: String, required: true, maxlength: 800 },
    reports: { type: Number, default: 0, select: false },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Post = mongoose.model('Post', postSchema);
export const Comment = mongoose.model('Comment', commentSchema);
