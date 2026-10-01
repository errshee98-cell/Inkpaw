import { useEffect, useMemo, useRef, useState } from 'react';
import PetAvatar from './PetAvatar.jsx';
import { usePet } from '../context/PetContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { greeting, reply, journalStats, currentHunger, level } from './brain.js';

export default function Pet() {
  const { user, setUser, entries } = useAuth();
  const { bubble, face, setFace, action, say, dismiss } = usePet();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const greeted = useRef(false);
  const logRef = useRef(null);

  const name = user?.displayName || 'friend';
  const petName = user?.settings?.petName || 'Mochi';
  const species = user?.settings?.petSpecies || 'cat';
  const stats = useMemo(() => journalStats(entries), [entries]);
  const hunger = currentHunger(user?.pet);
  const ctx = { name, petName, hunger, ...stats };

  // Welcome the user once per unlock, after entries have loaded from cache.
  useEffect(() => {
    if (greeted.current || !user) return;
    const t = setTimeout(() => {
      greeted.current = true;
      say(greeting(ctx), 9000);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entries.length]);

  // Idle life: occasionally get sleepy late at night or hungry.
  useEffect(() => {
    const t = setInterval(() => {
      if (bubble) return;
      const h = new Date().getHours();
      setFace(h >= 23 || h < 5 ? 'sleepy' : hunger < 30 ? 'hungry' : 'happy');
    }, 20000);
    return () => clearInterval(t);
  }, [bubble, hunger, setFace]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [chat, open]);

  const play = async () => {
    try {
      const { pet } = await api.post('/settings/pet/play');
      setUser((u) => ({ ...u, pet }));
    } catch {
      /* offline petting still counts in our hearts */
    }
  };

  const send = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const r = reply(text, ctx);
    setChat((c) => [...c, { from: 'me', text }, { from: 'pet', text: r.text, crisis: r.crisis }].slice(-40));
    setFace(r.face);
    if (r.action === 'play') play();
    setInput('');
  };

  const onPetClick = () => {
    if (bubble) dismiss();
    setOpen((o) => !o);
  };

  return (
    <div className="pet-dock">
      {bubble && !open && (
        <div className={`pet-bubble ${bubble.crisis ? 'crisis' : ''}`} role="status">
          <p>{bubble.text}</p>
          <button className="bubble-close" onClick={dismiss} aria-label="Dismiss">×</button>
        </div>
      )}

      {open && (
        <div className="pet-panel" role="dialog" aria-label={`Chat with ${petName}`}>
          <header>
            <div>
              <strong>{petName}</strong>
              <span className="pet-level">Lv {level(user?.pet?.xp)}</span>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </header>
          <div className="pet-meters">
            <Meter label="Tummy" value={hunger} />
            <Meter label="Streak" value={Math.min(100, stats.streak * 14)} hint={`${stats.streak}d`} />
          </div>
          <div className="pet-log" ref={logRef}>
            {chat.length === 0 && <p className="pet-msg pet">Hi {name}! Talk to me, ask for a writing prompt, or say “breathe”. Our chat stays on this device. 🐾</p>}
            {chat.map((m, i) => (
              <p key={i} className={`pet-msg ${m.from} ${m.crisis ? 'crisis' : ''}`}>{m.text}</p>
            ))}
          </div>
          <div className="pet-quick">
            {['Give me a prompt', 'Pet you', 'Breathe', 'My streak'].map((q) => (
              <button key={q} onClick={() => setInput(q)}>{q}</button>
            ))}
          </div>
          <form onSubmit={send} className="pet-input">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Say something to ${petName}…`} maxLength={300} />
            <button className="btn primary sm">Send</button>
          </form>
        </div>
      )}

      <button className="pet-button" onClick={onPetClick} onDoubleClick={play} aria-label={`${petName}, your journal pet. Click to chat.`}>
        <PetAvatar species={species} face={face} size={92} breathing={action === 'breathe'} />
      </button>
    </div>
  );
}

function Meter({ label, value, hint }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${value}%` }} />
      </div>
      <small>{hint ?? `${value}%`}</small>
    </div>
  );
}
