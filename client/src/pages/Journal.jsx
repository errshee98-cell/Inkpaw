import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePet } from '../context/PetContext.jsx';
import Editor from '../components/Editor.jsx';
import Attachments from '../components/Attachments.jsx';
import TagInput from '../components/TagInput.jsx';
import { CATEGORIES, MOODS, TEMPLATES, moodEmoji } from '../lib/constants.js';
import { reactToEntry, detectMood } from '../pet/brain.js';

const monthLabel = (d) => new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function Journal() {
  const { entries, store } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState({ category: null, tag: null, mood: null, favorites: false });
  const [showTemplates, setShowTemplates] = useState(false);

  const allTags = useMemo(() => {
    const counts = {};
    entries.forEach((e) => e.tags?.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const categories = useMemo(() => [...new Set([...CATEGORIES, ...entries.map((e) => e.category).filter(Boolean)])], [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter.category && e.category !== filter.category) return false;
      if (filter.tag && !e.tags?.includes(filter.tag)) return false;
      if (filter.mood && e.mood !== filter.mood) return false;
      if (filter.favorites && !e.favorite) return false;
      if (q && !`${e.title} ${e.text} ${e.tags?.join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, query]);

  const grouped = useMemo(() => {
    const g = new Map();
    visible.forEach((e) => {
      const k = monthLabel(e.createdAt);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(e);
    });
    return [...g.entries()];
  }, [visible]);

  const current = entries.find((e) => e.id === id) || null;

  const create = async (tpl) => {
    setShowTemplates(false);
    const entry = store.newEntry({ category: filter.category || tpl.category, tags: filter.tag ? [filter.tag] : [], content: tpl.content });
    await store.save(entry);
    navigate(`/journal/${entry.id}`);
  };

  const toggle = (key, value) => setFilter((f) => ({ ...f, [key]: f[key] === value ? null : value }));
  const activeFilters = filter.category || filter.tag || filter.mood || filter.favorites || query;

  return (
    <div className={`journal ${current ? 'has-entry' : ''}`}>
      <aside className="sidebar">
        <div className="new-wrap">
          <button className="btn primary block" onClick={() => setShowTemplates((s) => !s)}>✎ New entry</button>
          {showTemplates && (
            <div className="template-menu">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => create(t)}>
                  <span>{t.icon}</span> {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <input className="search" type="search" placeholder="Search your journal…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search entries" />
        <p className="muted tiny">Search runs on your device — your words never leave it unencrypted.</p>

        <nav className="filters">
          <button className={`filter ${filter.favorites ? 'on' : ''}`} onClick={() => setFilter((f) => ({ ...f, favorites: !f.favorites }))}>★ Favorites</button>

          <h5>Categories</h5>
          {categories.map((c) => (
            <button key={c} className={`filter ${filter.category === c ? 'on' : ''}`} onClick={() => toggle('category', c)}>
              {c}
              <span className="count">{entries.filter((e) => e.category === c).length || ''}</span>
            </button>
          ))}

          <h5>Moods</h5>
          <div className="mood-row">
            {MOODS.map((m) => (
              <button key={m.id} className={`mood-chip ${filter.mood === m.id ? 'on' : ''}`} onClick={() => toggle('mood', m.id)} title={m.label} aria-label={m.label}>
                {m.emoji}
              </button>
            ))}
          </div>

          {allTags.length > 0 && <h5>Tags</h5>}
          <div className="tag-cloud">
            {allTags.map(([t, n]) => (
              <button key={t} className={`tag ${filter.tag === t ? 'on' : ''}`} onClick={() => toggle('tag', t)}>
                #{t} <small>{n}</small>
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <section className="entry-list" aria-label="Entries">
        <header className="list-head">
          <h2>{filter.category || (filter.tag && `#${filter.tag}`) || (filter.favorites ? 'Favorites' : 'All entries')}</h2>
          <span className="muted small">{visible.length}</span>
          {activeFilters && (
            <button
              className="link-btn"
              onClick={() => {
                setFilter({ category: null, tag: null, mood: null, favorites: false });
                setQuery('');
              }}
            >
              clear
            </button>
          )}
        </header>
        {visible.length === 0 && (
          <div className="empty">
            <p>{entries.length ? 'Nothing matches those filters.' : 'Your journal is waiting for its first page.'}</p>
            {!entries.length && <button className="btn primary" onClick={() => create(TEMPLATES[1])}>Start with a daily reflection</button>}
          </div>
        )}
        {grouped.map(([month, list]) => (
          <div key={month}>
            <h6 className="month">{month}</h6>
            {list.map((e) => (
              <button key={e.id} className={`entry-card ${e.id === id ? 'active' : ''}`} onClick={() => navigate(`/journal/${e.id}`)}>
                <div className="date-badge">
                  <strong>{new Date(e.createdAt).getDate()}</strong>
                  <span>{new Date(e.createdAt).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                </div>
                <div className="entry-card-body">
                  <h3>
                    {e.favorite && <span className="star">★</span>}
                    {e.title || 'Untitled'} {moodEmoji(e.mood)}
                  </h3>
                  <p>{(e.text || '').slice(0, 110) || <em className="muted">Empty page</em>}</p>
                  <div className="card-meta">
                    <span className="cat">{e.category}</span>
                    {e.tags?.slice(0, 3).map((t) => (
                      <span key={t} className="tag mini">#{t}</span>
                    ))}
                    {e.attachments?.length > 0 && <span className="muted tiny">📎 {e.attachments.length}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </section>

      <section className="entry-pane">
        {current ? (
          <EntryEditor key={current.id} entry={current} categories={categories} onBack={() => navigate('/journal')} />
        ) : (
          <div className="pane-empty">
            <div className="ink-illustration" aria-hidden="true">✒️</div>
            <h2>Pick a page or start a new one</h2>
            <p className="muted">Everything here is encrypted on this device with a key only your password can unlock.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function EntryEditor({ entry, categories, onBack }) {
  const { store } = useAuth();
  const { say } = usePet();
  const [draft, setDraft] = useState(entry);
  const [saved, setSaved] = useState(true);
  const timer = useRef(null);
  const draftRef = useRef(draft);
  const reacted = useRef(false);

  const update = (patch) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      draftRef.current = next;
      return next;
    });
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const flush = async () => {
    clearTimeout(timer.current);
    timer.current = null;
    const d = draftRef.current;
    const autoMood = d.mood || (!d.moodManual && d.text?.length > 40 ? suggestMood(d.text) : null);
    if (autoMood && !d.mood) {
      draftRef.current = { ...d, mood: autoMood };
      setDraft((x) => ({ ...x, mood: autoMood }));
    }
    await store.save({ ...d, mood: autoMood });
    setSaved(true);
    if (!reacted.current && (d.text?.length || 0) > 60) {
      reacted.current = true;
      say(reactToEntry(d.text));
    }
  };

  // Save on unmount / switching entries so nothing is ever lost.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        store.save(draftRef.current);
      }
    },
    [store]
  );

  const remove = async () => {
    if (!window.confirm('Delete this entry? This removes it from all your devices.')) return;
    clearTimeout(timer.current);
    timer.current = null;
    await store.remove(entry.id);
    onBack();
  };

  const created = new Date(draft.createdAt);

  return (
    <article className="page">
      <div className="page-top">
        <button className="link-btn back" onClick={onBack}>← Entries</button>
        <time dateTime={draft.createdAt}>{created.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
        <span className={`save-state ${saved ? 'ok' : ''}`}>{saved ? '🔐 Saved & encrypted' : 'Saving…'}</span>
        <button className={`icon-btn star-btn ${draft.favorite ? 'on' : ''}`} onClick={() => update({ favorite: !draft.favorite })} aria-label="Favorite" aria-pressed={draft.favorite}>★</button>
        <button className="icon-btn danger" onClick={remove} aria-label="Delete entry">🗑</button>
      </div>

      <input className="title-input" value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="Give today a title…" maxLength={140} aria-label="Title" />

      <div className="meta-row">
        <label className="select-wrap">
          <span>Category</span>
          <select
            value={draft.category}
            onChange={(e) => {
              if (e.target.value === '__new') {
                const name = window.prompt('New category name')?.trim();
                if (name) update({ category: name.slice(0, 30) });
              } else update({ category: e.target.value });
            }}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option value="__new">+ New category…</option>
          </select>
        </label>
        <div className="mood-picker" role="radiogroup" aria-label="Mood">
          {MOODS.map((m) => (
            <button key={m.id} role="radio" aria-checked={draft.mood === m.id} className={`mood-chip ${draft.mood === m.id ? 'on' : ''}`} onClick={() => update({ mood: draft.mood === m.id ? null : m.id, moodManual: true })} title={m.label}>
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      <TagInput tags={draft.tags || []} onChange={(tags) => update({ tags })} />

      <Editor entryId={entry.id} content={entry.content} onChange={update} />

      <Attachments items={draft.attachments || []} onChange={(attachments) => update({ attachments })} />
    </article>
  );
}

function suggestMood(text) {
  const m = detectMood(text);
  return { sad: 'sad', anxious: 'anxious', angry: 'angry', tired: 'tired', happy: 'happy', grateful: 'grateful' }[m] || null;
}
