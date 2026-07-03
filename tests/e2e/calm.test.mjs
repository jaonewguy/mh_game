import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, breathe } from './helpers.mjs';

test('calm-1: the tutorial walks through and real breathing completes the level', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter'); // gesture so audio/scenes go live
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'level', chapter: 'calm', index: 0 });
    await waitForPlay(page);

    // tutorial starts in 'watch'
    const mechState = await page.evaluate(() => window.__game.scene.mech.state);
    assert.equal(mechState, 'watch');

    await breathe(page, { until: (st) => st.complete, timeoutMs: 100000 });
    const done = await page.evaluate(() => window.__game.scene.mech.complete);
    assert.equal(done, true);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test('calm-2: a good breath pushes the walls back open', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'level', chapter: 'calm', index: 1 });
    await waitForPlay(page);

    const before = await page.evaluate(() => ({
      target: window.__game.scene.room.targetHalf,
      start: window.__game.scene.startHalf,
    }));
    assert.equal(before.target, before.start); // starts closed in

    await breathe(page, { until: (st) => st.cycles >= 1, timeoutMs: 30000 });

    const after = await page.evaluate(() => window.__game.scene.room.targetHalf);
    assert.ok(after > before.target, `walls should widen: ${before.target} -> ${after}`);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
