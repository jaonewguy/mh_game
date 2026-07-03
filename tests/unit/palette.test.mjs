import test from 'node:test';
import assert from 'node:assert/strict';

// localStorage shim so persistence is observable in Node
function shim() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

test('palette: starts colorless, unlocks persist, roles fall back', async () => {
  const store = shim();
  const { Palette } = await import('../../src/palette.js?case=fresh');

  assert.equal(Palette.unlockedCount(), 0);
  assert.equal(Palette.isUnlocked('calm'), false);
  // locked roles render monochrome
  assert.equal(Palette.get('figure'), '#FFFFFF');
  assert.equal(Palette.get('nonsense-role'), '#FFFFFF');

  Palette.unlock('calm');
  assert.equal(Palette.isUnlocked('calm'), true);
  assert.equal(Palette.unlockedCount(), 1);
  assert.match(store.get('mh_game.unlocked_colors'), /calm/);

  // unknown emotions are rejected
  Palette.unlock('rage');
  assert.equal(Palette.unlockedCount(), 1);

  Palette.resetAll();
  assert.equal(Palette.unlockedCount(), 0);
});

test('palette: restores unlocks from storage', async () => {
  shim();
  localStorage.setItem('mh_game.unlocked_colors', JSON.stringify(['hope', 'joy']));
  const { Palette } = await import('../../src/palette.js?case=restore');
  assert.equal(Palette.isUnlocked('hope'), true);
  assert.equal(Palette.isUnlocked('joy'), true);
  assert.equal(Palette.unlockedCount(), 2);
});

test('palette: corrupted storage starts colorless instead of crashing', async () => {
  shim();
  localStorage.setItem('mh_game.unlocked_colors', '{not json');
  const { Palette } = await import('../../src/palette.js?case=corrupt');
  assert.equal(Palette.unlockedCount(), 0);
});
