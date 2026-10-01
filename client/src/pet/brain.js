// Mochi's brain: a small, private, rule-based companion. Runs entirely in the browser —
// nothing you say to your pet is sent anywhere.

const LEXICON = {
  sad: ['sad', 'cry', 'crying', 'lonely', 'alone', 'miss', 'hurt', 'down', 'empty', 'heartbroken', 'lost', 'depressed', 'upset', 'grief', 'unhappy'],
  anxious: ['anxious', 'anxiety', 'worried', 'worry', 'nervous', 'scared', 'panic', 'overthinking', 'stress', 'stressed', 'afraid', 'exam', 'deadline', 'overwhelmed'],
  angry: ['angry', 'mad', 'furious', 'annoyed', 'hate', 'irritated', 'frustrated', 'unfair', 'rage'],
  tired: ['tired', 'exhausted', 'sleepy', 'drained', 'burnt', 'burned', 'burnout', 'fatigue', 'no energy'],
  happy: ['happy', 'great', 'excited', 'amazing', 'joy', 'fun', 'proud', 'love', 'awesome', 'good day', 'yay', 'wonderful', 'won'],
  grateful: ['grateful', 'thankful', 'thank', 'appreciate', 'blessed', 'lucky'],
};

const CRISIS = [/\b(kill|hurt|harm)\s+my\s*self\b/i, /\bsuicid/i, /\bend\s+(it all|my life)\b/i, /\bdon'?t\s+want\s+to\s+(live|be alive|wake up)\b/i, /\bself[-\s]?harm/i];

export function detectMood(text = '') {
  const t = ` ${text.toLowerCase()} `;
  let best = 'neutral';
  let bestScore = 0;
  for (const [mood, words] of Object.entries(LEXICON)) {
    const score = words.reduce((s, w) => s + (t.includes(` ${w}`) ? 1 : 0), 0);
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }
  return best;
}

export const isCrisis = (text = '') => CRISIS.some((p) => p.test(text));

export const SUPPORT_MESSAGE =
  "I'm really glad you told me. You deserve support from a real person right now. If you're in India you can call Tele-MANAS on 14416 (free, 24/7); elsewhere, findahelpline.com lists free lines in your country. If you're in immediate danger, please contact local emergency services. I'll be right here too. 🤍";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const PROMPTS = [
  'What made you smile today, even a little?',
  'Describe this exact moment using all five senses.',
  "What's something you're carrying that you could set down?",
  'Write a short letter to yourself one year from now.',
  'What are three tiny wins from this week?',
  "Who made your day better recently? What did they do?",
  'What would you do tomorrow if nothing could go wrong?',
  'Name a feeling you had today and where you felt it in your body.',
  "What's a worry that turned out smaller than you expected?",
  'What does a perfect lazy Sunday look like for you?',
];

export function greeting({ name, petName, streak, daysSinceLast, hunger }) {
  const h = new Date().getHours();
  const time = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Hey night owl';
  if (daysSinceLast === null) return { text: `${time}, ${name}! I'm ${petName}, your journal buddy. Write your first entry and I'll keep it safe — only you can read it. 🐾`, face: 'excited' };
  if (daysSinceLast >= 3) return { text: `${name}! I missed you — it's been ${daysSinceLast} days. No pressure, even one sentence counts. 💛`, face: 'sad' };
  if (hunger < 30) return { text: `${time}, ${name}… my tummy's rumbling. Writing an entry feeds me! 🍙`, face: 'hungry' };
  if (streak >= 3) return { text: `${time}, ${name}! ${streak}-day streak — I'm so proud of you! ✨`, face: 'excited' };
  return { text: `${time}, ${name}! How's your heart today?`, face: 'happy' };
}

const REPLIES = {
  sad: ["That sounds really heavy. Do you want to write about it? I'll sit with you. 🫂", "I'm sorry you're hurting. Feelings like this pass, even when it doesn't feel like it.", "Sending you the softest paw-hug. Want a gentle prompt to help untangle it?"],
  anxious: ["Let's breathe together: in for 4… hold for 4… out for 6. Again? 🌬️", "Worries get smaller on paper. Try listing them — then circle the ones you can control.", "You don't have to solve everything tonight. What's one tiny next step?"],
  angry: ["That sounds frustrating! It's okay to be angry. Want to vent it out in a private entry? I won't tell anyone.", "Write the unsendable letter — say everything, keep it private. It helps! ✍️"],
  tired: ["You've been working so hard. Rest is productive too. 😴", "Maybe a tiny entry tonight and an early sleep? I'll curl up next to you."],
  happy: ["Yay!! Tell me everything! Let's save this moment in your journal ✨", "That makes my whiskers wiggle! Happy memories are the best to reread later."],
  grateful: ["Gratitude looks good on you 💛 Want to start a gratitude list entry?", "Aww. Writing down what you're thankful for is like collecting sunshine."],
  neutral: ["Tell me more! 🐾", "Mm-hmm, I'm listening.", "Interesting! Want to turn that into an entry?", "I love hearing about your day."],
};

const INTENTS = [
  { re: /\b(hi|hello|hey|hii+|yo)\b/i, reply: (c) => ({ text: pick([`Hi ${c.name}! 🐾`, `Hello hello! *happy tail wiggle*`, `Hey you! I was just napping on your journal.`]), face: 'happy' }) },
  { re: /\b(prompt|idea|what (should|can) i write|inspire)\b/i, reply: () => ({ text: `Here's one: “${pick(PROMPTS)}”`, face: 'thinking', action: 'prompt' }) },
  { re: /\b(pet|pat|cuddle|hug)\b/i, reply: () => ({ text: pick(['*purrrr* 💕', '*leans into your hand*', 'Best. Human. Ever.']), face: 'love', action: 'play' }) },
  { re: /\b(feed|food|hungry|snack)\b/i, reply: (c) => ({ text: c.hunger < 60 ? "Every entry you write is a snack for me! 🍙 Feed me words?" : "I'm full and happy, thank you! 😋", face: 'hungry' }) },
  { re: /\b(breath|breathe|calm|panic)\b/i, reply: () => ({ text: 'Breathe with me: in 4… hold 4… out 6. Watch me grow and shrink! 🌬️', face: 'calm', action: 'breathe' }) },
  { re: /\b(streak|stats|how many)\b/i, reply: (c) => ({ text: `You've written ${c.total} entries and your streak is ${c.streak} day${c.streak === 1 ? '' : 's'}. ✨`, face: 'excited' }) },
  { re: /\b(private|secure|safe|encrypt)/i, reply: () => ({ text: "Your entries are locked in your browser before they leave it. Not even the server can read them — only your password can. 🔐", face: 'proud' }) },
  { re: /\b(who are you|your name|what are you)\b/i, reply: (c) => ({ text: `I'm ${c.petName}! I live in your journal, keep you company, and get happier when you write. 🐾`, face: 'happy' }) },
  { re: /\b(thank|thanks|ty)\b/i, reply: () => ({ text: 'Anytime! 💛', face: 'love' }) },
  { re: /\b(bye|good ?night|gn|see you)\b/i, reply: (c) => ({ text: `Sweet dreams, ${c.name}. I'll guard your pages. 🌙`, face: 'sleepy' }) },
  { re: /\b(community|vent|share)\b/i, reply: () => ({ text: 'The Community tab lets you post anonymously — a fresh nickname every time. Be kind there, and it\'ll be kind back. 🌷', face: 'happy' }) },
];

export function reply(message, ctx) {
  if (isCrisis(message)) return { text: SUPPORT_MESSAGE, face: 'calm', crisis: true };
  for (const intent of INTENTS) if (intent.re.test(message)) return intent.reply(ctx);
  const mood = detectMood(message);
  const faces = { sad: 'sad', anxious: 'calm', angry: 'calm', tired: 'sleepy', happy: 'excited', grateful: 'love', neutral: 'thinking' };
  return { text: pick(REPLIES[mood]), face: faces[mood] };
}

// React to what the user just wrote (on save). Only reads the local, decrypted text.
export function reactToEntry(text) {
  if (isCrisis(text)) return { text: SUPPORT_MESSAGE, face: 'calm', crisis: true };
  const mood = detectMood(text);
  const map = {
    sad: { text: 'Thank you for writing that down. That took courage. 🫂', face: 'sad' },
    anxious: { text: "Saved. Your worries are on paper now, not just in your head. Want to breathe with me?", face: 'calm' },
    angry: { text: 'Vented and saved. Feel a little lighter? 🌬️', face: 'calm' },
    tired: { text: 'Saved! Now go rest, okay? 😴', face: 'sleepy' },
    happy: { text: "Saved! This one's going in my happy-memory pile ✨", face: 'excited' },
    grateful: { text: 'A gratitude entry! My favorite snack 🍙💛', face: 'love' },
    neutral: { text: 'Yum, words! Entry saved and locked 🔐', face: 'happy' },
  };
  return map[mood];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA');

export function journalStats(entries) {
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); // today not written yet doesn't break streak
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const latest = entries[0] ? new Date(entries[0].createdAt) : null;
  const daysSinceLast = latest ? Math.floor((Date.now() - latest) / 86_400_000) : null;
  return { total: entries.length, streak, daysSinceLast };
}

// Hunger slowly drops over time (1 point every 2 hours) and is refilled by writing.
export function currentHunger(pet) {
  if (!pet) return 70;
  const hours = (Date.now() - new Date(pet.lastFedAt)) / 3_600_000;
  return Math.max(0, Math.round(pet.hunger - hours / 2));
}

export const level = (xp = 0) => Math.floor(Math.sqrt(xp / 10)) + 1;
