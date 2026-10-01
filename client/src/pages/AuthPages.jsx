import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PetAvatar from '../pet/PetAvatar.jsx';

function strength(pw) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^\w\s]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = ['Too weak', 'Weak', 'Okay', 'Strong', 'Very strong'];

function Shell({ children, face, speech }) {
  return (
    <div className="auth-shell">
      <div className="auth-art">
        <div className="auth-pet">
          <PetAvatar face={face} size={150} />
          <p className="auth-speech">{speech}</p>
        </div>
        <ul className="auth-points">
          <li>🔐 End-to-end encrypted — only your password unlocks your pages</li>
          <li>☁️ Syncs across devices, works offline</li>
          <li>🌷 An anonymous room to vent, kindly</li>
        </ul>
      </div>
      <div className="auth-card">
        <div className="brand-lg">🐾 Inkpaw</div>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Shell face={error ? 'sad' : 'happy'} speech={error ? 'Hmm, that didn’t work. Try again?' : 'Welcome back! I kept your pages safe. 🐾'}>
      <form onSubmit={submit} className="stack">
        <h1>Welcome back</h1>
        <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Deriving keys & unlocking…' : 'Unlock my journal'}</button>
        <p className="small center">New here? <Link to="/register">Create a journal</Link></p>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '', understood: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = strength(form.password);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords don’t match');
    if (form.password.length < 10) return setError('Use at least 10 characters — this password is your encryption key');
    setBusy(true);
    setError('');
    try {
      await register(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Shell face="excited" speech="Hi! I'm Mochi. Let's make you a journal only you can read! ✨">
      <form onSubmit={submit} className="stack">
        <h1>Create your journal</h1>
        <label>What should I call you?<input required maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
        <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>
          Password
          <input type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {form.password && (
            <span className={`strength s${s}`}>
              <span className="bar" /> {STRENGTH[s]}
            </span>
          )}
        </label>
        <label>Confirm password<input type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>
        <label className="check">
          <input type="checkbox" required checked={form.understood} onChange={(e) => setForm({ ...form, understood: e.target.checked })} />
          <span>I understand my password encrypts my journal. If I forget it, no one — not even Inkpaw — can recover my entries.</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Generating your keys…' : 'Create my journal'}</button>
        <p className="small center">Already have one? <Link to="/login">Sign in</Link></p>
      </form>
    </Shell>
  );
}

export function Unlock() {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await unlock(password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Shell face="sleepy" speech={`Zzz… oh! Hi ${user?.displayName || ''}. Your journal locked itself to stay safe.`}>
      <form onSubmit={submit} className="stack">
        <h1>Journal locked 🔒</h1>
        <p className="muted small">Signed in as {user?.email}. Your key was cleared from memory; enter your password to decrypt.</p>
        <label>Password<input type="password" autoFocus autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        <button type="button" className="link-btn center" onClick={logout}>Sign out instead</button>
      </form>
    </Shell>
  );
}
