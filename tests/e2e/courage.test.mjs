import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, walkTo } from './helpers.mjs';

test('courage-1: walking toward the shadow shrinks it until it dissolves', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await page.evaluate(() => {
      for (const c of ['calm', 'hope', 'joy']) window.__palette.unlock(c);
    });
    await enterNode(page, { type: 'level', chapter: 'courage', index: 0 });
    await waitForPlay(page);

    const room = await page.evaluate(() => ({
      open: [...window.__game.scene.room.open],
      shadows: window.__game.scene.mech.shadows.length,
    }));
    assert.deepEqual(room.open, ['zneg'], 'courage-1 should be missing a wall');
    assert.equal(room.shadows, 1);

    // relentlessly walk at the shadow: it retreats slower than we walk,
    // so pressure builds until it dissolves (or gets pushed off the edge)
    const deadline = Date.now() + 130000;
    while (Date.now() < deadline) {
      const done = await page.evaluate(() => window.__game.scene.mech.complete);
      if (done) break;
      await walkTo(page, () => {
        const sc = window.__game.scene;
        const sh = sc.mech.shadows.find(s => !s.dead);
        if (!sh) return null;
        return { x: sc.stick.x, z: sc.stick.z, tx: sh.x, tz: sh.z };
      }, { arrive: 20, timeoutMs: 8000 });
    }

    const st = await page.evaluate(() => ({
      complete: window.__game.scene.mech.complete,
      dissolved: window.__game.scene.mech.dissolved,
    }));
    assert.equal(st.complete, true, `shadow should dissolve under confrontation (${st.dissolved} down)`);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test('joy dash: double-tap bursts the figure forward with a trail', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await page.evaluate(() => window.__palette.unlock('joy'));
    // a quiet arena — no shadows to shove the figure mid-measurement
    await enterNode(page, { type: 'level', chapter: 'joy', index: 0 });
    await waitForPlay(page);

    const before = await page.evaluate(() => window.__game.scene.stick.x);
    // double-tap right — retried, since the 260ms window can be missed
    // when synthetic key events stretch under load
    let fired = false;
    for (let i = 0; i < 5 && !fired; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(70);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(350);
      fired = await page.evaluate(() => window.__game.scene.abilities.dashCooldown > 0
        || window.__game.scene.abilities.dash !== null);
    }
    const st = await page.evaluate(() => ({ x: window.__game.scene.stick.x }));
    assert.ok(fired, 'double-tap should trigger a dash');
    assert.ok(st.x - before > 90, `dash should cover real distance: ${before.toFixed(0)} -> ${st.x.toFixed(0)}`);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
