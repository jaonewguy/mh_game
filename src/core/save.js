/*
 * Save — versioned progress in localStorage.
 *
 * `node` is where the player is in the game's flow, e.g.
 *   { type: 'prologue' }
 *   { type: 'story', id: 'prologue' }
 *   { type: 'level', chapter: 'calm', index: 1 }
 * Unlocked colors live in palette.js (its own key) — this file tracks
 * position and settings.
 */
const KEY = 'mh_game.save';
const DEFAULTS = { version: 1, node: null, settings: { volume: 0.8 } };

function loadRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.version === DEFAULTS.version) {
      return { ...DEFAULTS, ...raw, settings: { ...DEFAULTS.settings, ...raw.settings } };
    }
  } catch (e) { /* corrupted — start fresh */ }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

export const Save = {
  data: loadRaw(),

  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
    catch (e) { /* storage unavailable — progress just won't persist */ }
  },

  setNode(node) {
    this.data.node = node;
    this.write();
  },

  setVolume(v) {
    this.data.settings.volume = Math.max(0, Math.min(1, v));
    this.write();
  },

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.write();
  },
};
