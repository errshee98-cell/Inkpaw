import mongoose from 'mongoose';

/**
 * An entry is an opaque encrypted blob. Title, body, tags, category, mood and attachment
 * references all live inside `ciphertext` — the server only knows ownership, size and timestamps.
 * `version` enables optimistic concurrency for multi-device sync.
 */
const entrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, required: true }, // UUID generated on the device
    ciphertext: { type: String, default: '' },
    iv: { type: String, default: '' },
    version: { type: Number, default: 1 },
    deleted: { type: Boolean, default: false }, // tombstone so other devices learn about deletions
  },
  { timestamps: true }
);

entrySchema.index({ user: 1, clientId: 1 }, { unique: true });
entrySchema.index({ user: 1, updatedAt: 1 });

export default mongoose.model('Entry', entrySchema);
