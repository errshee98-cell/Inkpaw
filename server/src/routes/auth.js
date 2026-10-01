import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Entry from '../models/Entry.js';
import Attachment from '../models/Attachment.js';
import { getBucket } from '../config/db.js';
import { issueSession, clearSession, requireAuth } from '../middleware/auth.js';
import { validate, asyncHandler, HttpError } from '../middleware/errors.js';
import { decoySalt } from '../utils/anon.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const b64 = z.string().min(8).max(4096).regex(/^[A-Za-z0-9+/=]+$/, 'must be base64');
const hex64 = z.string().regex(/^[a-f0-9]{64}$/, 'must be a 256-bit hex key');
const email = z.string().email().max(254).transform((s) => s.toLowerCase().trim());

const registerSchema = z.object({
  email,
  displayName: z.string().trim().max(40).optional(),
  authKey: hex64,
  salt: b64,
  iterations: z.number().int().min(100000).max(2000000),
  wrappedKey: b64,
  wrapIv: b64,
});

const loginSchema = z.object({ email, authKey: hex64 });

const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_HASH = bcrypt.hashSync('inkpaw-timing-decoy', 12);

// Step 1 of login: the browser needs the salt to derive keys from the password.
router.get(
  '/salt',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = email.safeParse(req.query.email);
    if (!parsed.success) throw new HttpError(400, 'Valid email required');
    const user = await User.findOne({ email: parsed.data }).select('kdf');
    res.json(user ? { salt: user.kdf.salt, iterations: user.kdf.iterations } : { salt: decoySalt(parsed.data), iterations: 310000 });
  })
);

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email: mail, displayName, authKey, salt, iterations, wrappedKey, wrapIv } = req.body;
    if (await User.exists({ email: mail })) throw new HttpError(409, 'An account with this email already exists');
    const user = await User.create({
      email: mail,
      displayName: displayName || mail.split('@')[0],
      authHash: await bcrypt.hash(authKey, 12),
      kdf: { salt, iterations },
      wrappedKey,
      wrapIv,
    });
    issueSession(res, user._id);
    res.status(201).json({ user: user.toPublic(), keys: { wrappedKey, wrapIv } });
  })
);

// Step 2 of login: the browser proves it knows the password by sending the derived authKey.
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+authHash +failedLogins +lockedUntil');
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
    }
    // Compare against a dummy hash for unknown emails so response timing doesn't reveal which accounts exist.
    const ok = await bcrypt.compare(req.body.authKey, user ? user.authHash : DUMMY_HASH);
    if (!user || !ok) {
      if (user) {
        user.failedLogins += 1;
        if (user.failedLogins >= MAX_FAILS) {
          user.lockedUntil = new Date(Date.now() + LOCK_MS);
          user.failedLogins = 0;
        }
        await user.save();
      }
      throw new HttpError(401, 'Email or password is incorrect');
    }
    user.failedLogins = 0;
    user.lockedUntil = undefined;
    await user.save();
    issueSession(res, user._id);
    res.json({ user: user.toPublic(), keys: { wrappedKey: user.wrappedKey, wrapIv: user.wrapIv } });
  })
);

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// Used on page reload: session cookie is still valid, but the data key is gone from memory,
// so the client shows an "unlock" screen and re-derives the KEK from the password.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, 'Account not found');
    res.json({ user: user.toPublic(), keys: { wrappedKey: user.wrappedKey, wrapIv: user.wrapIv }, kdf: user.kdf });
  })
);

// Password change: client re-wraps the SAME data key with a new password, so no entries need re-encrypting.
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate(z.object({ currentAuthKey: hex64, newAuthKey: hex64, salt: b64, iterations: z.number().int().min(100000).max(2000000), wrappedKey: b64, wrapIv: b64 })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId).select('+authHash');
    if (!(await bcrypt.compare(req.body.currentAuthKey, user.authHash))) throw new HttpError(401, 'Current password is incorrect');
    user.authHash = await bcrypt.hash(req.body.newAuthKey, 12);
    user.kdf = { salt: req.body.salt, iterations: req.body.iterations };
    user.wrappedKey = req.body.wrappedKey;
    user.wrapIv = req.body.wrapIv;
    await user.save();
    res.json({ ok: true });
  })
);

// Right to be forgotten: removes entries, attachments and the account. Community posts stay anonymous.
router.delete(
  '/account',
  requireAuth,
  validate(z.object({ authKey: hex64 })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId).select('+authHash');
    if (!(await bcrypt.compare(req.body.authKey, user.authHash))) throw new HttpError(401, 'Password is incorrect');
    const files = await Attachment.find({ user: user._id }).select('fileId');
    await Promise.all(files.map((f) => getBucket().delete(f.fileId).catch(() => {})));
    await Promise.all([Attachment.deleteMany({ user: user._id }), Entry.deleteMany({ user: user._id }), user.deleteOne()]);
    clearSession(res);
    res.json({ ok: true });
  })
);

export default router;
