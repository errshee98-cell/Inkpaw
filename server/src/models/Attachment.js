import mongoose from 'mongoose';

// Bytes live in GridFS (already encrypted by the browser). Filename + MIME type are encrypted too.
const attachmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    iv: { type: String, required: true },
    encMeta: { type: String, required: true }, // encrypted JSON { name, type }
    metaIv: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Attachment', attachmentSchema);
