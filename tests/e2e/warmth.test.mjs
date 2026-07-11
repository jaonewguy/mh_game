import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, walkTo } from './helpers.mjs';

test('warmth-1: the companion follows at your pace and warms at the hearth', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await page.evaluate(() => {
      for (const c of ['calm', 'hope', 'joy', 'courage']) window.__palette.unlock(c);
    });
    await enterNode(page, { type: 'level', chapter: 'warmth', index: 0 });
    await waitForPlay(page);

    // go meet them
    const met = await walkTo(page, () => {
      const sc = window.__game.scene;
      const c = sc.mech.companions[0];
      return { x: sc.stick.x, z: sc.stick.z, tx: c.x, tz: c.z };
    }, { arrive: 60, timeoutMs: 20000 });
    await page.waitForFunction(() => window.__game.scene.mech.companions[0].following, null, { timeout: 5000 })
      .catch(() => assert.fail(`companion never followed (reached: ${met})`));

    // lead them home in short legs so they keep up
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const st = await page.evaluate(() => {
        const sc = window.__game.scene;
        const c = sc.mech.companions[0];
        return {
          warmed: c.warmed,
          following: c.following,
          gap: Math.hypot(sc.stick.x - c.x, sc.stick.z - c.z),
        };
      });
      if (st.warmed) break;
      if (!st.following) {
        // went too fast — go back for them
        await walkTo(page, () => {
          const sc = window.__game.scene;
          const c = sc.mech.companions[0];
          return { x: sc.stick.x, z: sc.stick.z, tx: c.x, tz: c.z };
        }, { arrive: 60, timeoutMs: 10000 });
        continue;
      }
      if (st.gap > 130) { await page.waitForTimeout(350); continue; } // let them catch up
      await walkTo(page, () => {
        const sc = window.__game.scene;
        return { x: sc.stick.x, z: sc.stick.z, tx: sc.mech.hearth.x, tz: sc.mech.hearth.z };
      }, { arrive: 24, timeoutMs: 900 });
    }

    const done = await page.evaluate(() => ({
      warmed: window.__game.scene.mech.warmed,
      complete: window.__game.scene.mech.complete,
    }));
    assert.equal(done.complete, true, `companion should reach the hearth (warmed ${done.warmed})`);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
