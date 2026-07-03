import test from 'node:test';
import assert from 'node:assert/strict';

function shim() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

test('save: defaults, setNode persists, reset clears', async () => {
  const store = shim();
  const { Save } = await import('../../src/core/save.js?case=fresh');

  assert.equal(Save.data.node, null);
  assert.equal(Save.data.settings.volume, 0.8);

  Save.setNode({ type: 'level', chapter: 'calm', index: 1 });
  const written = JSON.parse(store.get('mh_game.save'));
  assert.deepEqual(written.node, { type: 'level', chapter: 'calm', index: 1 });

  Save.setVolume(2); // clamped
  assert.equal(Save.data.settings.volume, 1);

  Save.reset();
  assert.equal(Save.data.node, null);
});

test('save: restores a valid save from storage', async () => {
  shim();
  localStorage.setItem('mh_game.save', JSON.stringify({
    version: 1, node: { type: 'level', chapter: 'hope', index: 0 }, settings: { volume: 0.5 },
  }));
  const { Save } = await import('../../src/core/save.js?case=restore');
  assert.deepEqual(Save.data.node, { type: 'level', chapter: 'hope', index: 0 });
  assert.equal(Save.data.settings.volume, 0.5);
});

test('save: version mismatch and corrupt data fall back to defaults', async () => {
  shim();
  localStorage.setItem('mh_game.save', JSON.stringify({ version: 99, node: { type: 'end' } }));
  const { Save: s1 } = await import('../../src/core/save.js?case=version');
  assert.equal(s1.data.node, null);

  localStorage.setItem('mh_game.save', '][broken');
  const { Save: s2 } = await import('../../src/core/save.js?case=corrupt');
  assert.equal(s2.data.node, null);
});
