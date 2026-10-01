import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { createAccountKeys, deriveKeys, unwrapDek, wrapDek, toB64, PBKDF2_ITERATIONS } from '../lib/crypto.js';
import { JournalStore } from '../lib/store.js';
import { clearAttachmentCache } from '../lib/attachments.js';

const AuthContext = createContext(null);
const AUTO_LOCK_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  // phase: loading → anon | locked | unlocked
  const [phase, setPhase] = useState('loading');
  const [user, setUser] = useState(null);
  const [journal, setJournal] = useState({ entries: [], status: { state: 'idle' } });
  const sessionRef = useRef(null); // { keys, kdf } from /auth/me
  const dekRef = useRef(null);
  const storeRef = useRef(null);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((data) => {
        sessionRef.current = data;
        setUser(data.user);
        setPhase('locked');
      })
      .catch(() => setPhase('anon'));
  }, []);

  const openJournal = useCallback(async (u, dek) => {
    dekRef.current = dek;
    storeRef.current?.destroy();
    const store = new JournalStore(u.id, dek);
    storeRef.current = store;
    store.subscribe(setJournal);
    setUser(u);
    setPhase('unlocked');
    await store.init();
  }, []);

  const register = useCallback(
    async ({ email, password, displayName }) => {
      const k = await createAccountKeys(password);
      const { user: u } = await api.post('/auth/register', {
        email,
        displayName,
        authKey: k.authKey,
        salt: k.salt,
        iterations: k.iterations,
        wrappedKey: k.wrappedKey,
        wrapIv: k.wrapIv,
      });
      sessionRef.current = { kdf: { salt: k.salt, iterations: k.iterations }, keys: { wrappedKey: k.wrappedKey, wrapIv: k.wrapIv } };
      await openJournal(u, k.dek);
    },
    [openJournal]
  );

  const login = useCallback(
    async ({ email, password }) => {
      const { salt, iterations } = await api.get(`/auth/salt?email=${encodeURIComponent(email)}`);
      const { authKey, kek } = await deriveKeys(password, salt, iterations);
      const { user: u, keys } = await api.post('/auth/login', { email, authKey });
      sessionRef.current = { kdf: { salt, iterations }, keys };
      await openJournal(u, await unwrapDek(keys.wrappedKey, keys.wrapIv, kek));
    },
    [openJournal]
  );

  const unlock = useCallback(
    async (password) => {
      const { kdf, keys } = sessionRef.current;
      const { kek } = await deriveKeys(password, kdf.salt, kdf.iterations);
      await openJournal(user, await unwrapDek(keys.wrappedKey, keys.wrapIv, kek));
    },
    [openJournal, user]
  );

  // Locking wipes decrypted data and the key from memory; the session cookie stays.
  const lock = useCallback(() => {
    storeRef.current?.destroy();
    storeRef.current = null;
    dekRef.current = null;
    clearAttachmentCache();
    setJournal({ entries: [], status: { state: 'idle' } });
    setPhase((p) => (p === 'unlocked' ? 'locked' : p));
  }, []);

  const logout = useCallback(async () => {
    lock();
    await api.post('/auth/logout').catch(() => {});
    sessionRef.current = null;
    setUser(null);
    setPhase('anon');
  }, [lock]);

  const changePassword = useCallback(async (current, next) => {
    const { kdf, keys } = sessionRef.current;
    const old = await deriveKeys(current, kdf.salt, kdf.iterations);
    const dek = await unwrapDek(keys.wrappedKey, keys.wrapIv, old.kek, true);
    const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
    const fresh = await deriveKeys(next, salt);
    const wrapped = await wrapDek(dek, fresh.kek);
    await api.post('/auth/change-password', { currentAuthKey: old.authKey, newAuthKey: fresh.authKey, salt, iterations: PBKDF2_ITERATIONS, ...wrapped });
    sessionRef.current = { kdf: { salt, iterations: PBKDF2_ITERATIONS }, keys: wrapped };
  }, []);

  const deleteAccount = useCallback(
    async (password) => {
      const { kdf } = sessionRef.current;
      const { authKey } = await deriveKeys(password, kdf.salt, kdf.iterations);
      await api.del('/auth/account', { authKey });
      lock();
      setUser(null);
      setPhase('anon');
    },
    [lock]
  );

  // Auto-lock after inactivity — zero trust applies to an unattended screen, too.
  useEffect(() => {
    if (phase !== 'unlocked') return undefined;
    let timer = setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, AUTO_LOCK_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [phase, lock]);

  const value = {
    phase,
    user,
    setUser,
    entries: journal.entries,
    syncStatus: journal.status,
    store: storeRef.current,
    dek: dekRef.current,
    register,
    login,
    unlock,
    lock,
    logout,
    changePassword,
    deleteAccount,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
