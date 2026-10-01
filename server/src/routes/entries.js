import { Router } from 'express';
import { z } from 'zod';
import Entry from '../models/Entry.js';
import User from '../models/User.js';
import { validate, asyncHandler } from '../middleware/errors.js';

const router = Router();

const MAX_CIPHERTEXT = 2_000_000; // ~1.5 MB of encrypted JSON per entry
const clientIdSchema = z.string().uuid();

const toDTO = (e) => ({
  clientId: e.clientId,
  ciphertext: e.deleted ? '' : e.ciphertext,
  iv: e.deleted ? '' : e.iv,
  version: e.version,
  deleted: e.deleted,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});

/**
 * Delta sync. Clients store the server's `serverTime` from the last sync and ask for
 * everything changed since then (including tombstones for deletions on other devices).
 */
router.get(
  '/sync',
  asyncHandler(async (req, res) => {
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
    if (Number.isNaN(since.getTime())) return res.status(400).json({ error: 'Invalid since' });
    const serverTime = new Date();
    const changed = await Entry.find({ user: req.userId, updatedAt: { $gt: since, $lte: serverTime } }).sort({ updatedAt: 1 }).lean();
    res.json({ serverTime: serverTime.toISOString(), entries: changed.map(toDTO) });
  })
);

/**
 * Create or update with optimistic concurrency.
 * baseVersion = the version the client last saw. If someone else wrote in the meantime,
 * respond 409 with the server copy so the client can merge (it keeps both as a conflict copy).
 */
router.put(
  '/:clientId',
  validate(z.object({ clientId: clientIdSchema }), 'params'),
  validate(
    z.object({
      ciphertext: z.string().min(1).max(MAX_CIPHERTEXT),
      iv: z.string().min(12).max(64),
      baseVersion: z.number().int().min(0),
    })
  ),
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { ciphertext, iv, baseVersion } = req.body;

    if (baseVersion === 0) {
      try {
        const created = await Entry.create({ user: req.userId, clientId, ciphertext, iv, version: 1 });
        await feedPet(req.userId);
        return res.status(201).json({ entry: toDTO(created) });
      } catch (err) {
        if (err.code !== 11000) throw err;
        const existing = await Entry.findOne({ user: req.userId, clientId }).lean();
        return res.status(409).json({ error: 'Conflict', entry: toDTO(existing) });
      }
    }

    const updated = await Entry.findOneAndUpdate(
      { user: req.userId, clientId, version: baseVersion },
      { $set: { ciphertext, iv, deleted: false }, $inc: { version: 1 } },
      { new: true }
    ).lean();

    if (!updated) {
      const current = await Entry.findOne({ user: req.userId, clientId }).lean();
      if (!current) return res.status(404).json({ error: 'Entry not found' });
      return res.status(409).json({ error: 'Conflict', entry: toDTO(current) });
    }
    res.json({ entry: toDTO(updated) });
  })
);

router.delete(
  '/:clientId',
  validate(z.object({ clientId: clientIdSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const entry = await Entry.findOneAndUpdate(
      { user: req.userId, clientId: req.params.clientId },
      { $set: { deleted: true, ciphertext: '', iv: '' }, $inc: { version: 1 } },
      { new: true }
    ).lean();
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ entry: toDTO(entry) });
  })
);

// Writing a new entry "feeds" the virtual pet. Only counts, never content.
async function feedPet(userId) {
  const user = await User.findById(userId).select('pet');
  if (!user) return;
  user.pet.xp += 10;
  user.pet.hunger = Math.min(100, user.pet.hunger + 25);
  user.pet.lastFedAt = new Date();
  await user.save();
}

export default router;
