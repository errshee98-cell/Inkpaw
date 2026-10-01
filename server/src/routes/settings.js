import { Router } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import { validate, asyncHandler } from '../middleware/errors.js';

const router = Router();

export const THEMES = ['parchment', 'midnight', 'sakura', 'forest', 'ocean', 'lavender'];

// Settings are non-sensitive presentation preferences, so they are stored in plaintext.
router.patch(
  '/',
  validate(
    z.object({
      displayName: z.string().trim().min(1).max(40).optional(),
      theme: z.enum(THEMES).optional(),
      font: z.enum(['serif', 'sans', 'hand', 'mono']).optional(),
      petName: z.string().trim().min(1).max(20).optional(),
      petSpecies: z.enum(['cat', 'bunny', 'bear']).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { displayName, ...settings } = req.body;
    const $set = Object.fromEntries(Object.entries(settings).map(([k, v]) => [`settings.${k}`, v]));
    if (displayName) $set.displayName = displayName;
    const user = await User.findByIdAndUpdate(req.userId, { $set }, { new: true });
    res.json({ user: user.toPublic() });
  })
);

// Petting / playing gives a little XP so the pet "levels up" with daily use.
router.post(
  '/pet/play',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    user.pet.xp += 1;
    await user.save();
    res.json({ pet: user.pet });
  })
);

export default router;
