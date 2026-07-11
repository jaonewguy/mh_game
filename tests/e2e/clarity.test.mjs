import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, walkTo } from './helpers.mjs';

test('clarity-1: standing still on each vantage lifts the fog', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await page.evaluate(() => {
      for (const c of ['calm', 'hope', 'joy', 'courage', 'warmth']) window.__palette.unlock(c);
    });
    await enterNode(page, { type: 'level', chapter: 'clarity', index: 0 });
    await waitForPlay(page);

    const fogBefore = await page.evaluate(() => window.__game.scene.mech.fogLevel());
    assert.ok(fogBefore > 0.9, `fog should start thick: ${fogBefore}`);

    const deadline = Date.now() + 70000;
    while (Date.now() < deadline) {
      const st = await page.evaluate(() => ({
        complete: window.__game.scene.mech.complete,
        cleared: window.__game.scene.mech.cleared,
      }));
      if (st.complete) break;
      await walkTo(page, () => {
        const sc = window.__game.scene;
        const v = sc.mech.vantages.find(v => !v.cleared);
        if (!v) return null;
        return { x: sc.stick.x, z: sc.stick.z, tx: v.x, tz: v.z };
      }, { arrive: 14, timeoutMs: 15000 });
      await page.waitForTimeout(1800); // stand still and look
    }

    const done = await page.evaluate(() => ({
      complete: window.__game.scene.mech.complete,
      cleared: window.__game.scene.mech.cleared,
      fog: window.__game.scene.mech.fogLevel(),
    }));
    assert.equal(done.complete, true, `all vantages should clear (${done.cleared} cleared)`);
    assert.ok(done.fog < 0.1, `fog should be lifted: ${done.fog}`);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
