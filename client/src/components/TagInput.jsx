import { useState } from 'react';

export default function TagInput({ tags, onChange, max = 12 }) {
  const [value, setValue] = useState('');

  const add = (raw) => {
    const t = raw.trim().toLowerCase().replace(/^#/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);
    if (t && !tags.includes(t) && tags.length < max) onChange([...tags, t]);
    setValue('');
  };

  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className="tag">
          #{t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>×</button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (['Enter', ',', ' '].includes(e.key)) {
            e.preventDefault();
            add(value);
          } else if (e.key === 'Backspace' && !value && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => value && add(value)}
        placeholder={tags.length ? 'add tag' : '#add tags'}
        aria-label="Add tag"
      />
    </div>
  );
}
