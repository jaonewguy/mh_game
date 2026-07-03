/*
 * Input — keyboard state behind a small action map, so scenes talk
 * about intentions ("left", "breath", "confirm") rather than key codes.
 * Touch input can be added here later without touching any scene.
 */
const ACTIONS = {
  left:    ['ArrowLeft', 'a', 'A'],
  right:   ['ArrowRight', 'd', 'D'],
  up:      ['ArrowUp', 'w', 'W'],
  down:    ['ArrowDown', 's', 'S'],
  confirm: ['Enter'],
  breath:  [' '],
  restart: ['r', 'R'],
  back:    ['Escape'],
};

const KEY_TO_ACTIONS = {};
for (const [action, keyList] of Object.entries(ACTIONS)) {
  for (const k of keyList) (KEY_TO_ACTIONS[k] = KEY_TO_ACTIONS[k] || []).push(action);
}

const held = new Set();
const edges = new Set();

export const Input = {
  init(onFirstGesture) {
    let gestured = false;
    const gesture = () => {
      if (!gestured) { gestured = true; onFirstGesture && onFirstGesture(); }
    };
    window.addEventListener('keydown', (e) => {
      gesture();
      const actions = KEY_TO_ACTIONS[e.key];
      if (!actions) return;
      for (const a of actions) {
        if (!held.has(a)) edges.add(a);
        held.add(a);
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const actions = KEY_TO_ACTIONS[e.key];
      if (actions) for (const a of actions) held.delete(a);
    });
    window.addEventListener('pointerdown', gesture);
    // Dropped keyup (e.g. tab switch mid-hold) shouldn't wedge an action on.
    window.addEventListener('blur', () => held.clear());
  },

  down(action)    { return held.has(action); },
  pressed(action) { return edges.has(action); },

  // Screen-relative movement intent: R is +1 right, U is +1 up.
  dirs() {
    return {
      R: (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0),
      U: (this.down('up') ? 1 : 0) - (this.down('down') ? 1 : 0),
    };
  },

  endFrame() { edges.clear(); },
};
