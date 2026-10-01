/**
 * Inkpaw zero-knowledge crypto (WebCrypto only, no dependencies).
 *
 *   password ──PBKDF2(salt|"auth")──▶ authKey  ──▶ sent to server, which stores bcrypt(authKey)
 *            └─PBKDF2(salt|"enc")───▶ KEK      ──▶ never leaves the browser
 *
 *   DEK (random AES-256-GCM) encrypts every entry and attachment.
 *   DEK is wrapped with the KEK and the wrapped blob is stored on the server.
 *
 * The server therefore never holds anything that can decrypt a journal without the password.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
export const PBKDF2_ITERATIONS = 310000; // OWASP 2023 guidance for PBKDF2-SHA256

export const toB64 = (buf) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

async function pbkdf2Bits(password, salt, purpose, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const fullSalt = new Uint8Array([...salt, ...enc.encode(`|inkpaw|${purpose}`)]);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fullSalt, iterations }, base, 256);
}

/** Derive both the server auth key (hex) and the local key-encryption key from a password. */
export async function deriveKeys(password, saltB64, iterations = PBKDF2_ITERATIONS) {
  const salt = fromB64(saltB64);
  const [authBits, kekBits] = await Promise.all([
    pbkdf2Bits(password, salt, 'auth', iterations),
    pbkdf2Bits(password, salt, 'enc', iterations),
  ]);
  const kek = await crypto.subtle.importKey('raw', kekBits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { authKey: toHex(authBits), kek };
}

/** Create everything a new account needs. */
export async function createAccountKeys(password) {
  const salt = toB64(randomBytes(16));
  const { authKey, kek } = await deriveKeys(password, salt);
  const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const wrapped = await wrapDek(dek, kek);
  return { salt, iterations: PBKDF2_ITERATIONS, authKey, dek: await reimportNonExtractable(dek), ...wrapped };
}

export async function wrapDek(dek, kek) {
  const raw = await crypto.subtle.exportKey('raw', dek);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { wrappedKey: toB64(ct), wrapIv: toB64(iv) };
}

/** Unwrap the DEK. Kept extractable only when we need to re-wrap it (password change). */
export async function unwrapDek(wrappedKey, wrapIv, kek, extractable = false) {
  try {
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(wrapIv) }, kek, fromB64(wrappedKey));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', extractable, ['encrypt', 'decrypt']);
  } catch {
    throw new Error('Wrong password');
  }
}

async function reimportNonExtractable(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// ── Entries ─────────────────────────────────────────────────────────────────────

export async function encryptJSON(dek, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, enc.encode(JSON.stringify(obj)));
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}

export async function decryptJSON(dek, ciphertext, iv) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, dek, fromB64(ciphertext));
  return JSON.parse(dec.decode(pt));
}

// ── Attachments ─────────────────────────────────────────────────────────────────

export async function encryptFile(dek, file) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, await file.arrayBuffer());
  const meta = await encryptJSON(dek, { name: file.name, type: file.type || 'application/octet-stream' });
  return { blob: new Blob([ct]), iv: toB64(iv), encMeta: meta.ciphertext, metaIv: meta.iv };
}

export async function decryptFile(dek, buffer, iv, encMeta, metaIv) {
  const [pt, meta] = await Promise.all([
    crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, dek, buffer),
    decryptJSON(dek, encMeta, metaIv),
  ]);
  return { blob: new Blob([pt], { type: meta.type }), name: meta.name, type: meta.type };
}

export const uuid = () => crypto.randomUUID();
