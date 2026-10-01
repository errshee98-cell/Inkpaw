import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { z } from 'zod';
import Attachment from '../models/Attachment.js';
import { getBucket } from '../config/db.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';

const router = Router();
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // per-user storage quota

// The browser uploads already-encrypted bytes; the server stores them as an opaque blob.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES + 64, files: 1 } });

const metaSchema = z.object({
  iv: z.string().min(12).max(64),
  encMeta: z.string().min(8).max(4096),
  metaIv: z.string().min(12).max(64),
});

router.post(
  '/',
  upload.single('blob'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file');
    const meta = metaSchema.parse(req.body);

    const [{ total = 0 } = {}] = await Attachment.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: null, total: { $sum: '$size' } } },
    ]);
    if (total + req.file.size > MAX_TOTAL_BYTES) throw new HttpError(413, 'Storage quota reached (500 MB)');

    const fileId = await new Promise((resolve, reject) => {
      const stream = getBucket().openUploadStream('encrypted.bin', { contentType: 'application/octet-stream' });
      Readable.from(req.file.buffer).pipe(stream).on('error', reject).on('finish', () => resolve(stream.id));
    });

    const att = await Attachment.create({ user: req.userId, fileId, size: req.file.size, ...meta });
    res.status(201).json({ attachment: { id: att._id, iv: att.iv, encMeta: att.encMeta, metaIv: att.metaIv, size: att.size } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Bad id');
    const att = await Attachment.findOne({ _id: req.params.id, user: req.userId });
    if (!att) throw new HttpError(404, 'Attachment not found');
    res.set({
      'Content-Type': 'application/octet-stream',
      'X-Attachment-Iv': att.iv,
      'X-Attachment-Meta': att.encMeta,
      'X-Attachment-Meta-Iv': att.metaIv,
      'Cache-Control': 'private, max-age=86400',
    });
    getBucket().openDownloadStream(att.fileId).on('error', () => res.status(404).end()).pipe(res);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Bad id');
    const att = await Attachment.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!att) throw new HttpError(404, 'Attachment not found');
    await getBucket().delete(att.fileId).catch(() => {});
    res.json({ ok: true });
  })
);

export default router;
