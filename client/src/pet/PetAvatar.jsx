// Original hand-drawn SVG companion. One body, three species variants, nine expressions.

const EARS = {
  cat: (
    <>
      <path d="M30 38 L36 12 L54 30 Z" className="pet-body" />
      <path d="M90 38 L84 12 L66 30 Z" className="pet-body" />
      <path d="M36 32 L39 19 L48 29 Z" className="pet-inner" />
      <path d="M84 32 L81 19 L72 29 Z" className="pet-inner" />
    </>
  ),
  bunny: (
    <>
      <ellipse cx="44" cy="16" rx="9" ry="24" className="pet-body" transform="rotate(-10 44 16)" />
      <ellipse cx="76" cy="16" rx="9" ry="24" className="pet-body" transform="rotate(10 76 16)" />
      <ellipse cx="44" cy="18" rx="4" ry="16" className="pet-inner" transform="rotate(-10 44 18)" />
      <ellipse cx="76" cy="18" rx="4" ry="16" className="pet-inner" transform="rotate(10 76 18)" />
    </>
  ),
  bear: (
    <>
      <circle cx="34" cy="32" r="13" className="pet-body" />
      <circle cx="86" cy="32" r="13" className="pet-body" />
      <circle cx="34" cy="32" r="6" className="pet-inner" />
      <circle cx="86" cy="32" r="6" className="pet-inner" />
    </>
  ),
};

function Eyes({ face }) {
  switch (face) {
    case 'sleepy':
      return (
        <g className="pet-ink" fill="none" strokeWidth="3" strokeLinecap="round">
          <path d="M42 62 q6 4 12 0" />
          <path d="M66 62 q6 4 12 0" />
        </g>
      );
    case 'excited':
    case 'happy':
    case 'proud':
      return (
        <g className="pet-ink" fill="none" strokeWidth="3.5" strokeLinecap="round">
          <path d="M42 64 q6 -8 12 0" />
          <path d="M66 64 q6 -8 12 0" />
        </g>
      );
    case 'love':
      return (
        <g fill="#e25c7a">
          <path d="M48 66 l-6 -6 a3.5 3.5 0 0 1 6 -4 a3.5 3.5 0 0 1 6 4 z" />
          <path d="M72 66 l-6 -6 a3.5 3.5 0 0 1 6 -4 a3.5 3.5 0 0 1 6 4 z" />
        </g>
      );
    case 'sad':
      return (
        <g>
          <g className="pet-eyes">
            <ellipse cx="48" cy="62" rx="5" ry="6" className="pet-ink-fill" />
            <ellipse cx="72" cy="62" rx="5" ry="6" className="pet-ink-fill" />
          </g>
          <path d="M40 54 l10 -3 M80 54 l-10 -3" className="pet-ink" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="44" cy="72" rx="2.5" ry="4" fill="#8ec5ff" className="pet-tear" />
        </g>
      );
    case 'thinking':
      return (
        <g className="pet-eyes">
          <ellipse cx="50" cy="60" rx="5" ry="6" className="pet-ink-fill" />
          <ellipse cx="74" cy="60" rx="5" ry="6" className="pet-ink-fill" />
          <circle cx="52" cy="58" r="1.8" fill="#fff" />
          <circle cx="76" cy="58" r="1.8" fill="#fff" />
        </g>
      );
    default:
      return (
        <g className="pet-eyes">
          <ellipse cx="48" cy="62" rx="5.5" ry="7" className="pet-ink-fill" />
          <ellipse cx="72" cy="62" rx="5.5" ry="7" className="pet-ink-fill" />
          <circle cx="50" cy="59" r="2" fill="#fff" />
          <circle cx="74" cy="59" r="2" fill="#fff" />
        </g>
      );
  }
}

function Mouth({ face, species }) {
  const nose = species === 'bear' ? <ellipse cx="60" cy="72" rx="5" ry="3.5" className="pet-ink-fill" /> : <path d="M57 70 h6 l-3 3 z" className="pet-nose" />;
  let mouth;
  if (face === 'sad') mouth = <path d="M54 82 q6 -5 12 0" className="pet-ink" fill="none" strokeWidth="2.5" strokeLinecap="round" />;
  else if (face === 'excited' || face === 'love') mouth = <path d="M52 76 q8 12 16 0 z" className="pet-mouth" />;
  else if (face === 'hungry') mouth = <ellipse cx="60" cy="80" rx="5" ry="6" className="pet-mouth" />;
  else if (face === 'sleepy') mouth = <ellipse cx="60" cy="79" rx="3" ry="2.5" className="pet-mouth" />;
  else mouth = <path d="M52 76 q4 4 8 0 q4 4 8 0" className="pet-ink" fill="none" strokeWidth="2.5" strokeLinecap="round" />;
  return (
    <>
      {nose}
      {mouth}
    </>
  );
}

export default function PetAvatar({ species = 'cat', face = 'happy', size = 96, breathing = false }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`pet-svg face-${face} ${breathing ? 'breathing' : ''}`} aria-hidden="true">
      <ellipse cx="60" cy="112" rx="34" ry="5" className="pet-shadow" />
      <g className="pet-bob">
        {EARS[species] || EARS.cat}
        <path d="M60 28 C92 28 104 52 104 74 C104 98 86 108 60 108 C34 108 16 98 16 74 C16 52 28 28 60 28 Z" className="pet-body" />
        <ellipse cx="60" cy="88" rx="22" ry="16" className="pet-belly" />
        <ellipse cx="36" cy="76" rx="7" ry="4.5" className="pet-blush" />
        <ellipse cx="84" cy="76" rx="7" ry="4.5" className="pet-blush" />
        <Eyes face={face} />
        <Mouth face={face} species={species} />
        {species === 'cat' && (
          <g className="pet-ink" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
            <path d="M28 72 h-12 M28 77 l-11 3 M92 72 h12 M92 77 l11 3" />
          </g>
        )}
        {face === 'sleepy' && (
          <text x="92" y="30" className="pet-zzz">
            z<tspan dy="-6" fontSize="10">z</tspan>
          </text>
        )}
        {face === 'thinking' && <circle cx="98" cy="30" r="5" className="pet-thought" />}
      </g>
    </svg>
  );
}
