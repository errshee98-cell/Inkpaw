import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import PetAvatar from '../pet/PetAvatar.jsx';

export const THEMES = [
  { id: 'parchment', name: 'Parchment', desc: 'Warm paper & ink', swatch: ['#f6efe1', '#c0714f', '#3b2f2a'] },
  { id: 'sakura', name: 'Sakura', desc: 'Cherry-blossom pink', swatch: ['#fff3f5', '#e07a9a', '#4a2c36'] },
  { id: 'forest', name: 'Forest', desc: 'Moss, fern & bark', swatch: ['#eef2e6', '#5f8a55', '#26331f'] },
  { id: 'ocean', name: 'Ocean', desc: 'Sea glass & tide', swatch: ['#eaf4f6', '#3d8ca3', '#16323b'] },
  { id: 'lavender', name: 'Lavender', desc: 'Dreamy dusk', swatch: ['#f3effa', '#8a6cc4', '#2e2440'] },
  { id: 'midnight', name: 'Midnight', desc: 'Starlit dark mode', swatch: ['#161a26', '#e4b363', '#e8e6f0'] },
];
const FONTS = [
  { id: 'serif', name: 'Book', sample: 'Lora' },
  { id: 'hand', name: 'Handwritten', sample: 'Caveat' },
  { id: 'sans', name: 'Clean', sample: 'Inter' },
  { id: 'mono', name: 'Typewriter', sample: 'JetBrains Mono' },
];

export default function Settings() {
  const { user, setUser, entries, syncStatus, store, lock, logout, changePassword, deleteAccount } = useAuth();
  const [msg, setMsg] = useState('');
  const s = user.settings;

  const patch = async (body) => {
    setUser((u) => ({ ...u, displayName: body.displayName ?? u.displayName, settings: { ...u.settings, ...body } })); // optimistic
    try {
      const { user: u } = await api.patch('/settings', body);
      setUser(u);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const exportJSON = () => {
    if (!window.confirm('The export will be UNENCRYPTED. Keep the file somewhere safe. Continue?')) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inkpaw-journal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="settings">
      <h1>Settings</h1>
      {msg && <p className="notice">{msg}</p>}

      <section className="card">
        <h3>Diary theme</h3>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} className={`theme-card ${s.theme === t.id ? 'on' : ''}`} onClick={() => patch({ theme: t.id })}>
              <div className="theme-preview" style={{ background: t.swatch[0], color: t.swatch[2] }}>
                <span className="tp-line" style={{ background: t.swatch[1] }} />
                <span className="tp-text">Dear diary,</span>
              </div>
              <strong>{t.name}</strong>
              <small>{t.desc}</small>
            </button>
          ))}
        </div>
        <h4>Writing font</h4>
        <div className="font-row">
          {FONTS.map((f) => (
            <button key={f.id} className={`chip ${s.font === f.id ? 'on' : ''}`} style={{ fontFamily: f.sample }} onClick={() => patch({ font: f.id })}>
              {f.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card pet-settings">
        <h3>Your pet</h3>
        <div className="pet-pick">
          {['cat', 'bunny', 'bear'].map((sp) => (
            <button key={sp} className={`pet-option ${s.petSpecies === sp ? 'on' : ''}`} onClick={() => patch({ petSpecies: sp })} aria-label={sp}>
              <PetAvatar species={sp} face="happy" size={72} />
              <span>{sp}</span>
            </button>
          ))}
        </div>
        <InlineField label="Pet name" value={s.petName} max={20} onSave={(v) => patch({ petName: v })} />
        <InlineField label="Your name" value={user.displayName} max={40} onSave={(v) => patch({ displayName: v })} />
      </section>

      <section className="card">
        <h3>Sync</h3>
        <p className="small">
          Status: <strong>{syncStatus.state}</strong>
          {syncStatus.pending > 0 && ` · ${syncStatus.pending} change(s) waiting`}
          {syncStatus.lastSyncedAt && ` · last synced ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}`}
        </p>
        {syncStatus.error && <p className="error small">{syncStatus.error}</p>}
        <div className="row">
          <button className="btn ghost" onClick={() => store?.sync()}>Sync now</button>
          <button className="btn ghost" onClick={exportJSON}>Export my journal (.json)</button>
        </div>
      </section>

      <section className="card">
        <h3>Security</h3>
        <ul className="security-list">
          <li>✅ Entries, titles, tags, moods and attachments are encrypted with AES-256-GCM on this device.</li>
          <li>✅ Your password never leaves the browser — the server only receives a derived proof.</li>
          <li>✅ The journal auto-locks after 15 minutes idle and wipes the key from memory.</li>
        </ul>
        <ChangePassword onDone={() => setMsg('Password changed. Your other devices will ask for the new one.')} change={changePassword} />
        <div className="row">
          <button className="btn ghost" onClick={lock}>🔒 Lock now</button>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </section>

      <section className="card danger-zone">
        <h3>Delete account</h3>
        <p className="small">Permanently erases your entries and attachments from the server. Anonymous community posts are not linked to you and remain.</p>
        <DeleteAccount onDelete={deleteAccount} />
      </section>
    </div>
  );
}

function InlineField({ label, value, max, onSave }) {
  const [v, setV] = useState(value);
  return (
    <form
      className="inline-field"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSave(v.trim());
      }}
    >
      <label>
        {label}
        <input value={v} maxLength={max} onChange={(e) => setV(e.target.value)} />
      </label>
      <button className="btn ghost sm" disabled={v.trim() === value}>Save</button>
    </form>
  );
}

function ChangePassword({ change, onDone }) {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) return setErr('New passwords don’t match');
    if (f.next.length < 10) return setErr('Use at least 10 characters');
    setBusy(true);
    setErr('');
    try {
      await change(f.current, f.next);
      setF({ current: '', next: '', confirm: '' });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="stack narrow">
      <h4>Change password</h4>
      <p className="muted tiny">Your data key is re-wrapped with the new password — no entries need re-encrypting.</p>
      <input type="password" placeholder="Current password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
      <input type="password" placeholder="New password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
      <input type="password" placeholder="Confirm new password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
      {err && <p className="error small">{err}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Re-wrapping key…' : 'Change password'}</button>
    </form>
  );
}

function DeleteAccount({ onDelete }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm('This cannot be undone. Delete everything?')) return;
        try {
          await onDelete(pw);
        } catch (e2) {
          setErr(e2.message);
        }
      }}
    >
      <input type="password" placeholder="Confirm with password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      <button className="btn danger">Delete forever</button>
      {err && <p className="error small">{err}</p>}
    </form>
  );
}
