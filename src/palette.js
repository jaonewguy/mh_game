/*
 * Palette — the heart of the game's theme.
 *
 * The world starts in pure black and white. As the player works through
 * the challenges of each scene, they unlock "emotions" — named colors
 * that begin to bleed back into the world. Until a color is unlocked,
 * every role that would use it renders in monochrome.
 *
 * Unlocks persist in localStorage so progress carries across sessions.
 */
const STORAGE_KEY = 'mh_game.unlocked_colors';

// The six emotions the player can eventually reclaim.
const SLOTS = [
  { name: 'calm',    color: '#7FE0B2' },
  { name: 'hope',    color: '#5EC8FF' },
  { name: 'joy',     color: '#FFD166' },
  { name: 'courage', color: '#FF6B6B' },
  { name: 'warmth',  color: '#FFA94D' },
  { name: 'clarity', color: '#C6A4FF' },
];

// Which visual role maps to which emotion, once that emotion exists.
// While locked, roles fall back to monochrome values.
const ROLES = {
  figure:    { locked: '#FFFFFF', emotion: null },
  floor:     { locked: '#FFFFFF', emotion: null },
  wall:      { locked: 'rgba(255,255,255,0.10)', emotion: null },
  wallEdge:  { locked: 'rgba(255,255,255,0.35)', emotion: null },
  dust:      { locked: 'rgba(255,255,255,0.7)',  emotion: null },
  wind:      { locked: 'rgba(255,255,255,0.28)', emotion: null },
  text:      { locked: 'rgba(255,255,255,0.85)', emotion: null },
  textFaint: { locked: 'rgba(255,255,255,0.4)',  emotion: null },
};

let unlocked = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(saved)) unlocked = new Set(saved);
} catch (e) { /* corrupted save — start colorless */ }

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
  } catch (e) { /* storage unavailable — progress just won't persist */ }
}

export const Palette = {
  slots: SLOTS,

  isUnlocked(name) {
    return unlocked.has(name);
  },

  unlock(name) {
    if (SLOTS.some(s => s.name === name)) {
      unlocked.add(name);
      persist();
    }
  },

  relock(name) { // for save reset
    unlocked.delete(name);
    persist();
  },

  resetAll() {
    unlocked.clear();
    persist();
  },

  unlockedCount() {
    return unlocked.size;
  },

  colorOf(name) {
    const slot = SLOTS.find(s => s.name === name);
    return slot ? slot.color : '#FFFFFF';
  },

  // Get the drawing color for a visual role, respecting unlocks.
  get(role) {
    const r = ROLES[role];
    if (!r) return '#FFFFFF';
    if (r.emotion && unlocked.has(r.emotion)) return this.colorOf(r.emotion);
    return r.locked;
  },
};
