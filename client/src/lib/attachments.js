import { api } from './api.js';
import { encryptFile, decryptFile } from './crypto.js';

const urlCache = new Map(); // attachment id -> { url, name, type } (in-memory only)
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadAttachment(dek, file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 10 MB`);
  const { blob, iv, encMeta, metaIv } = await encryptFile(dek, file);
  const form = new FormData();
  form.append('iv', iv);
  form.append('encMeta', encMeta);
  form.append('metaIv', metaIv);
  form.append('blob', blob, 'encrypted.bin');
  const { attachment } = await api.post('/attachments', form);
  urlCache.set(attachment.id, { url: URL.createObjectURL(file), name: file.name, type: file.type });
  return { id: attachment.id, name: file.name, type: file.type || 'application/octet-stream', size: file.size };
}

export async function loadAttachment(dek, id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const res = await api.get(`/attachments/${id}`, { raw: true });
  const buffer = await res.arrayBuffer();
  const { blob, name, type } = await decryptFile(
    dek,
    buffer,
    res.headers.get('X-Attachment-Iv'),
    res.headers.get('X-Attachment-Meta'),
    res.headers.get('X-Attachment-Meta-Iv')
  );
  const item = { url: URL.createObjectURL(blob), name, type };
  urlCache.set(id, item);
  return item;
}

export async function deleteAttachment(id) {
  await api.del(`/attachments/${id}`);
  const cached = urlCache.get(id);
  if (cached) URL.revokeObjectURL(cached.url);
  urlCache.delete(id);
}

export function clearAttachmentCache() {
  urlCache.forEach((v) => URL.revokeObjectURL(v.url));
  urlCache.clear();
}
