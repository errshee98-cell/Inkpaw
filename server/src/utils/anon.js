import crypto from 'node:crypto';

const ADJ = ['Quiet', 'Gentle', 'Sleepy', 'Brave', 'Cozy', 'Soft', 'Wandering', 'Hopeful', 'Dreamy', 'Kind', 'Misty', 'Golden', 'Shy', 'Calm', 'Velvet', 'Starry'];
const ANIMAL = ['Otter', 'Fox', 'Owl', 'Panda', 'Koala', 'Sparrow', 'Hedgehog', 'Bunny', 'Seal', 'Moth', 'Deer', 'Duckling', 'Lynx', 'Turtle', 'Robin', 'Badger'];
const COLORS = ['#c08457', '#7c9a6d', '#6d8fb3', '#b3778f', '#9b7cc2', '#c2a14f', '#5e9e9a', '#c46a5a'];

export function authorKeyFor(userId) {
  return crypto.createHmac('sha256', process.env.ANON_SECRET).update(String(userId)).digest('hex');
}

// A fresh alias per post, so separate posts from the same person can't be linked by readers.
export function randomAlias() {
  const pick = (arr) => arr[crypto.randomInt(arr.length)];
  return { alias: `${pick(ADJ)} ${pick(ANIMAL)}`, aliasColor: pick(COLORS) };
}

// Stable decoy salt for emails that don't exist, so /auth/salt can't be used to enumerate accounts.
export function decoySalt(email) {
  return crypto.createHmac('sha256', process.env.SALT_PEPPER).update(email.toLowerCase()).digest().subarray(0, 16).toString('base64');
}
