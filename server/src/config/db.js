import mongoose from 'mongoose';

let bucket;

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'attachments' });
  console.log('✓ MongoDB connected');
}

export function getBucket() {
  if (!bucket) throw new Error('GridFS bucket not ready');
  return bucket;
}
