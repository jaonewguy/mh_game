import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, walkTo } from './helpers.mjs';

test('joy-1: continuous movement fills the meter and completes the level', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'level', chapter: 'joy', index: 0 });
    await waitForPlay(page);

    // run laps: alternate direction keys so the figure keeps moving
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    const deadline = Date.now() + 30000;
    let i = 0;
    while (Date.now() < deadline) {
      const done = await page.evaluate(() => window.__game.scene.mech.complete);
      if (done) break;
      const key = keys[i % 4];
      await page.keyboard.down(key);
      await page.waitForTimeout(650);
      await page.keyboard.up(key);
      i++;
    }

    const st = await page.evaluate(() => ({
      complete: window.__game.scene.mech.complete,
      trail: window.__game.scene.mech.trail.length,
    }));
    assert.equal(st.complete, true, 'meter should fill from continuous movement');
    assert.ok(st.trail > 0, 'running should leave a trail');
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test('joy-2: the spark exists, flees, and can be caught', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'level', chapter: 'joy', index: 1 });
    await waitForPlay(page);

    const spark = await page.evaluate(() => window.__game.scene.mech.spark);
    assert.ok(spark, 'chase mode should spawn a spark');

    // pursue the spark until one catch lands (it flees, so allow time)
    const deadline = Date.now() + 45000;
    let catches = 0;
    while (Date.now() < deadline) {
      catches = await page.evaluate(() => window.__game.scene.mech.catches);
      if (catches >= 1) break;
      await walkTo(page, () => {
        const sc = window.__game.scene;
        if (!sc.mech || !sc.mech.spark) return null;
        return { x: sc.stick.x, z: sc.stick.z, tx: sc.mech.spark.x, tz: sc.mech.spark.z };
      }, { arrive: 24, timeoutMs: 6000 });
    }
    assert.ok(catches >= 1, 'should catch the spark at least once');
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
