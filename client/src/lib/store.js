import { get, set, createStore } from 'idb-keyval';
import { api, ApiError } from './api.js';
import { encryptJSON, decryptJSON, uuid } from './crypto.js';

/**
 * Offline-first encrypted sync engine.
 *
 * - IndexedDB holds ONLY ciphertext (same as the server), so a stolen laptop reveals nothing.
 * - Decrypted entries live in memory while the journal is unlocked.
 * - Local edits are marked dirty and pushed with optimistic concurrency (baseVersion).
 * - Conflicts never lose words: the server copy wins the original id and the local edit is
 *   saved as a "conflict copy".
 */
export class JournalStore {
  constructor(userId, dek) {
    this.userId = userId;
    this.dek = dek;
    this.db = createStore(`inkpaw-${userId}`, 'kv');
    this.records = new Map(); // clientId -> encrypted record (+dirty flag)
    this.entries = new Map(); // clientId -> decrypted entry
    this.listeners = new Set();
    this.status = { state: 'idle', lastSyncedAt: null, pending: 0, error: null };
    this.pushTimer = null;
    this.syncing = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.status.pending = [...this.records.values()].filter((r) => r.dirty).length;
    const snapshot = { entries: this.list(), status: { ...this.status } };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  list() {
    return [...this.entries.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async init() {
    const cached = (await get('records', this.db)) || {};
    this.lastSync = (await get('lastSync', this.db)) || null;
    for (const rec of Object.values(cached)) {
      this.records.set(rec.clientId, rec);
      await this.decryptInto(rec);
    }
    this.emit();
    this.onOnline = () => this.sync();
    window.addEventListener('online', this.onOnline);
    this.interval = setInterval(() => this.sync(), 30_000);
    await this.sync();
  }

  destroy() {
    window.removeEventListener('online', this.onOnline);
    clearInterval(this.interval);
    clearTimeout(this.pushTimer);
    this.entries.clear();
    this.listeners.clear();
    this.dek = null;
  }

  async decryptInto(rec) {
    if (rec.deleted) {
      this.entries.delete(rec.clientId);
      return;
    }
    try {
      const entry = await decryptJSON(this.dek, rec.ciphertext, rec.iv);
      this.entries.set(rec.clientId, { ...entry, id: rec.clientId });
    } catch {
      console.warn('Could not decrypt entry', rec.clientId);
    }
  }

  async persist() {
    await set('records', Object.fromEntries(this.records), this.db);
    await set('lastSync', this.lastSync, this.db);
  }

  // ── Local mutations ───────────────────────────────────────────────────────────

  newEntry(partial = {}) {
    const now = new Date().toISOString();
    return {
      id: uuid(),
      title: '',
      content: null,
      text: '',
      tags: [],
      category: 'Personal',
      mood: null,
      favorite: false,
      attachments: [],
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
  }

  async save(entry) {
    const updated = { ...entry, updatedAt: new Date().toISOString() };
    const { ciphertext, iv } = await encryptJSON(this.dek, updated);
    const prev = this.records.get(entry.id);
    this.records.set(entry.id, {
      clientId: entry.id,
      ciphertext,
      iv,
      version: prev?.version || 0,
      deleted: false,
      dirty: true,
      updatedAt: updated.updatedAt,
    });
    this.entries.set(entry.id, updated);
    await this.persist();
    this.emit();
    this.schedulePush();
    return updated;
  }

  async remove(id) {
    const prev = this.records.get(id);
    if (!prev) return;
    this.records.set(id, { ...prev, deleted: true, dirty: true, ciphertext: '', iv: '' });
    this.entries.delete(id);
    await this.persist();
    this.emit();
    this.schedulePush();
  }

  schedulePush() {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.sync(), 1200);
  }

  // ── Network ───────────────────────────────────────────────────────────────────

  sync() {
    if (this.syncing) return this.syncing;
    this.syncing = this.runSync().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  async runSync() {
    if (!navigator.onLine) {
      this.status = { ...this.status, state: 'offline' };
      return this.emit();
    }
    this.status = { ...this.status, state: 'syncing', error: null };
    this.emit();
    try {
      await this.push();
      await this.pull();
      this.status = { ...this.status, state: 'synced', lastSyncedAt: new Date().toISOString() };
    } catch (err) {
      this.status = { ...this.status, state: err.status === 0 ? 'offline' : 'error', error: err.message };
    }
    await this.persist();
    this.emit();
  }

  async push() {
    const dirty = [...this.records.values()].filter((r) => r.dirty);
    for (const rec of dirty) {
      try {
        let res;
        if (rec.deleted) {
          if (rec.version === 0) {
            this.records.delete(rec.clientId); // never reached the server
            continue;
          }
          res = await api.del(`/entries/${rec.clientId}`);
        } else {
          res = await api.put(`/entries/${rec.clientId}`, { ciphertext: rec.ciphertext, iv: rec.iv, baseVersion: rec.version });
        }
        this.records.set(rec.clientId, { ...res.entry, dirty: false });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) await this.resolveConflict(rec, err.data.entry);
        else if (err instanceof ApiError && err.status === 404 && rec.deleted) this.records.delete(rec.clientId);
        else throw err;
      }
    }
  }

  async resolveConflict(localRec, serverRec) {
    // Keep the server version under the original id...
    this.records.set(serverRec.clientId, { ...serverRec, dirty: false });
    await this.decryptInto(serverRec);
    if (localRec.deleted) return; // a delete loses to a newer edit elsewhere
    // ...and save the local edit as a separate conflict copy so nothing is lost.
    const local = await decryptJSON(this.dek, localRec.ciphertext, localRec.iv);
    const copy = { ...local, id: uuid(), title: `${local.title || 'Untitled'} (conflict copy)` };
    await this.save(copy);
  }

  async pull() {
    const since = this.lastSync ? `?since=${encodeURIComponent(this.lastSync)}` : '';
    const { serverTime, entries } = await api.get(`/entries/sync${since}`);
    for (const rec of entries) {
      const local = this.records.get(rec.clientId);
      if (local?.dirty) continue; // our pending edit will be pushed (and conflict-checked) next round
      if (local && local.version >= rec.version) continue;
      this.records.set(rec.clientId, { ...rec, dirty: false });
      await this.decryptInto(rec);
    }
    this.lastSync = serverTime;
  }
}
