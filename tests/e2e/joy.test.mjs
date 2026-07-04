import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, walkTo } from './helpers.mjs';

test('joy-1: running paints the big room until coverage completes the level', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'level', chapter: 'joy', index: 0 });
    await waitForPlay(page);

    // the room outgrows the base size and the camera follows
    const geom = await page.evaluate(() => ({
      half: window.__game.scene.room.floorHalf,
      base: Math.min(window.innerWidth * 0.16, 155),
    }));
    assert.ok(geom.half > geom.base * 1.5, `room should be bigger: ${geom.half} vs base ${geom.base}`);

    // run a dense serpentine over the floor until enough is painted
    // (single-cell brush: rows must be about one cell apart)
    const H = geom.half * 0.85;
    const lattice = [];
    for (let row = 0, z = -H; z <= H + 1; z += H / 5.5, row++) {
      const xs = [-H, H];
      for (const x of (row % 2 ? xs.slice().reverse() : xs)) lattice.push({ x, z });
    }
    const deadline = Date.now() + 150000;
    for (const target of lattice) {
      if (Date.now() > deadline) break;
      const done = await page.evaluate(() => window.__game.scene.mech.complete);
      if (done) break;
      await page.evaluate((t) => { window.__walkTarget = t; }, target);
      await walkTo(page, () => {
        const sc = window.__game.scene;
        if (!sc.mech || !window.__walkTarget) return null;
        return { x: sc.stick.x, z: sc.stick.z, tx: window.__walkTarget.x, tz: window.__walkTarget.z };
      }, { arrive: 30, timeoutMs: 12000 });
    }

    const st = await page.evaluate(() => ({
      complete: window.__game.scene.mech.complete,
      coverage: window.__game.scene.mech.coverageFrac(),
      strokes: window.__game.scene.mech.strokes.length,
    }));
    assert.equal(st.complete, true, `coverage should complete the level (got ${(st.coverage * 100).toFixed(0)}%)`);
    assert.ok(st.strokes > 20, 'running should leave permanent strokes');
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
