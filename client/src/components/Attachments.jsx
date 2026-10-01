import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadAttachment, loadAttachment, deleteAttachment } from '../lib/attachments.js';

export default function Attachments({ items, onChange }) {
  const { dek } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const addFiles = async (files) => {
    setError('');
    setBusy(true);
    const added = [];
    for (const file of files) {
      try {
        added.push(await uploadAttachment(dek, file));
      } catch (err) {
        setError(err.message);
      }
    }
    if (added.length) onChange([...items, ...added]);
    setBusy(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this attachment?')) return;
    try {
      await deleteAttachment(id);
    } catch {
      /* already gone server-side */
    }
    onChange(items.filter((a) => a.id !== id));
  };

  return (
    <section
      className={`attachments ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        addFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="att-head">
        <h4>Attachments</h4>
        <button className="btn ghost sm" onClick={() => inputRef.current.click()} disabled={busy}>
          {busy ? 'Encrypting…' : '+ Add photo, audio or file'}
        </button>
        <input ref={inputRef} type="file" multiple hidden accept="image/*,audio/*,video/*,application/pdf,text/*" onChange={(e) => addFiles([...e.target.files])} />
      </div>
      {error && <p className="error">{error}</p>}
      {items.length === 0 ? (
        <p className="muted small">Drop files here. They're encrypted on your device before upload (max 10 MB each).</p>
      ) : (
        <div className="att-grid">
          {items.map((a) => (
            <AttachmentTile key={a.id} att={a} dek={dek} onRemove={() => remove(a.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function AttachmentTile({ att, dek, onRemove }) {
  const [file, setFile] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAttachment(dek, att.id)
      .then((f) => alive && setFile(f))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [att.id, dek]);

  const kind = att.type?.split('/')[0];
  return (
    <figure className="att-tile">
      {!file && !failed && <div className="att-loading">🔓 decrypting…</div>}
      {failed && <div className="att-loading">Couldn’t load</div>}
      {file && kind === 'image' && <img src={file.url} alt={att.name} loading="lazy" />}
      {file && kind === 'audio' && <audio src={file.url} controls />}
      {file && kind === 'video' && <video src={file.url} controls />}
      {file && !['image', 'audio', 'video'].includes(kind) && (
        <a className="att-file" href={file.url} download={att.name}>📄</a>
      )}
      <figcaption>
        <span title={att.name}>{att.name}</span>
        <button className="icon-btn" onClick={onRemove} aria-label={`Remove ${att.name}`}>×</button>
      </figcaption>
    </figure>
  );
}
