import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { usePet } from '../context/PetContext.jsx';
import { SUPPORT_MESSAGE, isCrisis } from '../pet/brain.js';

const MOODS = [
  { id: 'vent', label: 'Just venting', emoji: '🌋' },
  { id: 'sad', label: 'Sad', emoji: '🌧️' },
  { id: 'anxious', label: 'Anxious', emoji: '🌀' },
  { id: 'angry', label: 'Angry', emoji: '🔥' },
  { id: 'tired', label: 'Tired', emoji: '🌙' },
  { id: 'hopeful', label: 'Hopeful', emoji: '🌱' },
  { id: 'grateful', label: 'Grateful', emoji: '🌻' },
  { id: 'happy', label: 'Happy', emoji: '☀️' },
];
const REACTIONS = [
  { id: 'hug', emoji: '🫂', label: 'Sending a hug' },
  { id: 'heart', emoji: '💛', label: 'Love' },
  { id: 'same', emoji: '🤝', label: 'Same here' },
  { id: 'strength', emoji: '💪', label: 'You’ve got this' },
];
const moodOf = (id) => MOODS.find((m) => m.id === id) || MOODS[0];

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
}

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [mood, setMood] = useState(null);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (before) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (mood) params.set('mood', mood);
      if (mine) params.set('mine', 'true');
      if (before) params.set('before', before);
      try {
        const data = await api.get(`/community?${params}`);
        setPosts((p) => (before ? [...p, ...data.posts] : data.posts));
        setHasMore(data.hasMore);
        setError('');
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    },
    [mood, mine]
  );

  useEffect(() => {
    load();
  }, [load]);

  const replace = (post) => setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, ...post } : p)));

  return (
    <div className="community">
      <header className="community-head">
        <div>
          <h1>The Quiet Room</h1>
          <p className="muted">Share or vent anonymously. Every post gets a fresh nickname, links & contact details are stripped, and nothing ties it back to your journal.</p>
        </div>
      </header>

      <Composer onPosted={(p) => setPosts((ps) => [p, ...ps])} />

      <div className="community-filters">
        <button className={`chip ${!mood && !mine ? 'on' : ''}`} onClick={() => { setMood(null); setMine(false); }}>All</button>
        {MOODS.map((m) => (
          <button key={m.id} className={`chip ${mood === m.id ? 'on' : ''}`} onClick={() => setMood(mood === m.id ? null : m.id)}>
            {m.emoji} {m.label}
          </button>
        ))}
        <button className={`chip ${mine ? 'on' : ''}`} onClick={() => setMine(!mine)}>My posts</button>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="feed">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onChange={replace} onDelete={() => setPosts((ps) => ps.filter((x) => x.id !== p.id))} />
        ))}
        {!loading && posts.length === 0 && <p className="empty">It’s quiet here. Be the first to share something. 🌷</p>}
        {hasMore && (
          <button className="btn ghost block" onClick={() => load(posts[posts.length - 1].createdAt)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      <aside className="guidelines">
        <h4>Room rules</h4>
        <ul>
          <li>Be kind. Everyone here is carrying something.</li>
          <li>Support, don’t fix — unless someone asks for advice.</li>
          <li>No names, contact details, or identifying info.</li>
          <li>Three reports hide a post for review.</li>
        </ul>
        <p className="small">In crisis? India: Tele-MANAS <strong>14416</strong>. Elsewhere: <span className="nowrap">findahelpline.com</span></p>
      </aside>
    </div>
  );
}

function Composer({ onPosted }) {
  const { say } = usePet();
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('vent');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { post } = await api.post('/community', {
        body,
        mood,
        tags: tags.split(/[,\s]+/).map((t) => t.replace(/^#/, '')).filter(Boolean).slice(0, 5),
      });
      onPosted(post);
      if (isCrisis(body)) say({ text: SUPPORT_MESSAGE, face: 'calm', crisis: true });
      else say({ text: 'Posted anonymously. Proud of you for sharing 💛', face: 'love' });
      setBody('');
      setTags('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <form className="composer card" onSubmit={submit}>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s on your mind? You’re anonymous here." maxLength={2000} rows={4} required minLength={3} />
      <div className="composer-row">
        <select value={mood} onChange={(e) => setMood(e.target.value)} aria-label="Mood">
          {MOODS.map((m) => (
            <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>
          ))}
        </select>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#tags (optional)" aria-label="Tags" />
        <span className="muted tiny">{body.length}/2000</span>
        <button className="btn primary" disabled={busy || body.trim().length < 3}>{busy ? 'Posting…' : 'Post anonymously'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function PostCard({ post, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null);
  const [reply, setReply] = useState('');
  const [reported, setReported] = useState(false);
  const m = moodOf(post.mood);

  const react = async (reaction) => {
    try {
      const { post: p } = await api.post(`/community/${post.id}/react`, { reaction });
      onChange(p);
    } catch {
      /* ignore */
    }
  };

  const toggleComments = async () => {
    setOpen(!open);
    if (!comments) {
      const data = await api.get(`/community/${post.id}/comments`).catch(() => ({ comments: [] }));
      setComments(data.comments);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    try {
      const { comment } = await api.post(`/community/${post.id}/comments`, { body: reply });
      setComments((c) => [...(c || []), comment]);
      onChange({ id: post.id, commentCount: post.commentCount + 1 });
      setReply('');
    } catch (err) {
      alert(err.message);
    }
  };

  const report = async () => {
    if (!window.confirm('Report this post as harmful or abusive?')) return;
    await api.post(`/community/${post.id}/report`).catch(() => {});
    setReported(true);
  };

  const remove = async () => {
    if (!window.confirm('Delete your post?')) return;
    await api.del(`/community/${post.id}`);
    onDelete();
  };

  return (
    <article className={`post card mood-${post.mood}`}>
      <header>
        <span className="avatar" style={{ background: post.aliasColor }}>{post.alias[0]}</span>
        <div>
          <strong>{post.alias}</strong> {post.mine && <span className="you">you</span>}
          <div className="muted tiny">{m.emoji} {m.label} · {timeAgo(post.createdAt)}</div>
        </div>
        <span className="grow" />
        {post.mine ? (
          <button className="link-btn" onClick={remove}>Delete</button>
        ) : (
          <button className="link-btn" onClick={report} disabled={reported}>{reported ? 'Reported' : 'Report'}</button>
        )}
      </header>
      <p className="post-body">{post.body}</p>
      {post.needsSupport && (
        <div className="support-note">
          💛 If this is you right now: you matter. Tele-MANAS (India) <strong>14416</strong>, or findahelpline.com elsewhere. If you’re replying, gently encourage reaching out.
        </div>
      )}
      {post.tags?.length > 0 && (
        <div className="post-tags">
          {post.tags.map((t) => (
            <span key={t} className="tag mini">#{t}</span>
          ))}
        </div>
      )}
      <footer>
        {REACTIONS.map((r) => (
          <button key={r.id} className={`react ${post.myReactions?.includes(r.id) ? 'on' : ''}`} onClick={() => react(r.id)} title={r.label} aria-label={r.label}>
            {r.emoji} <span>{post.reactions?.[r.id] || ''}</span>
          </button>
        ))}
        <span className="grow" />
        <button className="link-btn" onClick={toggleComments}>💬 {post.commentCount || ''} {open ? 'Hide' : 'Reply'}</button>
      </footer>
      {open && (
        <div className="comments">
          {comments === null && <p className="muted tiny">Loading…</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <span className="dot" style={{ background: c.aliasColor }} />
              <strong>{c.alias}</strong> <span className="muted tiny">{timeAgo(c.createdAt)}</span>
              <p>{c.body}</p>
            </div>
          ))}
          <form onSubmit={sendReply} className="reply-form">
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply kindly…" maxLength={800} />
            <button className="btn primary sm">Send</button>
          </form>
        </div>
      )}
    </article>
  );
}
