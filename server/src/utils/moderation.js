// Lightweight, transparent moderation for the anonymous community.
// It does not block people who are struggling — it flags posts so the UI can surface support resources.

const SUPPORT_PATTERNS = [
  /\b(kill|hurt|harm)\s+my\s*self\b/i,
  /\bsuicid/i,
  /\bend\s+(it|my\s+life)\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bself[-\s]?harm/i,
  /\bcutting\s+myself\b/i,
];

const SLURS = [/\bf+a+g+o*t*s?\b/i, /\bn+i+g+g+(a|e)+r*s?\b/i, /\br+e+t+a+r+d+s?\b/i];

export function needsSupport(text) {
  return SUPPORT_PATTERNS.some((p) => p.test(text));
}

export function containsAbuse(text) {
  return SLURS.some((p) => p.test(text));
}

// Protect anonymity: strip things that commonly identify people before a post is stored.
export function scrubPII(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/(\+?\d[\d\s-]{8,}\d)/g, '[number removed]')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/@\w{2,}/g, '[handle removed]');
}
