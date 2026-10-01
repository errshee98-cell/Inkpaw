export const CATEGORIES = ['Personal', 'Gratitude', 'Dreams', 'Work', 'Study', 'Travel', 'Health', 'Ideas'];

export const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'excited', emoji: '🤩', label: 'Excited' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'grateful', emoji: '🥰', label: 'Grateful' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😤', label: 'Angry' },
];
export const moodEmoji = (id) => MOODS.find((m) => m.id === id)?.emoji || '';

const h = (level, text) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const p = (text) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const tasks = (items) => ({
  type: 'taskList',
  content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(t)] })),
});
const quote = (text) => ({ type: 'blockquote', content: [p(text)] });

export const TEMPLATES = [
  { id: 'blank', name: 'Blank page', icon: '📄', category: 'Personal', content: null },
  {
    id: 'daily',
    name: 'Daily reflection',
    icon: '🌤️',
    category: 'Personal',
    content: { type: 'doc', content: [h(2, 'Today I felt…'), p(''), h(2, 'Highlight of the day'), p(''), h(2, 'Something I learned'), p(''), h(2, 'Tomorrow I want to…'), p('')] },
  },
  {
    id: 'gratitude',
    name: 'Gratitude list',
    icon: '🙏',
    category: 'Gratitude',
    content: { type: 'doc', content: [quote('Gratitude turns what we have into enough.'), h(2, 'Three things I’m grateful for'), tasks(['', '', ''])] },
  },
  {
    id: 'dream',
    name: 'Dream log',
    icon: '🌙',
    category: 'Dreams',
    content: { type: 'doc', content: [h(2, 'What happened'), p(''), h(2, 'People & places'), p(''), h(2, 'How it felt'), p('')] },
  },
  {
    id: 'plan',
    name: 'Plan my day',
    icon: '✅',
    category: 'Work',
    content: { type: 'doc', content: [h(2, 'Top 3'), tasks(['', '', '']), h(2, 'Notes'), p('')] },
  },
  {
    id: 'vent',
    name: 'Private vent',
    icon: '🌋',
    category: 'Personal',
    content: { type: 'doc', content: [quote('This page is just for me. No one else can read it.'), p('')] },
  },
];
