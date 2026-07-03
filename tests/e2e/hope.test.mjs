import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay, walkTo } from './helpers.mjs';

test('hope-1: collecting every light grows the glow and opens the exit', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'level', chapter: 'hope', index: 0 });
    await waitForPlay(page);

    const glowBefore = await page.evaluate(() => window.__game.scene.mech.glow);

    // walk to each unfound mote in turn
    for (let i = 0; i < 3; i++) {
      const arrived = await walkTo(page, () => {
        const sc = window.__game.scene;
        const m = sc.mech.motes.find(m => !m.found);
        if (!m) return null;
        return { x: sc.stick.x, z: sc.stick.z, tx: m.x, tz: m.z };
      }, { arrive: 18, timeoutMs: 25000 });
      const found = await page.evaluate(() => window.__game.scene.mech.collected);
      if (found >= 3) break;
      assert.ok(arrived || found > i, `should reach mote ${i + 1}`);
    }

    const st = await page.evaluate(() => ({
      collected: window.__game.scene.mech.collected,
      complete: window.__game.scene.mech.complete,
      glow: window.__game.scene.mech.glow,
      fireflies: window.__game.scene.mech.fireflies.length,
    }));
    assert.equal(st.collected, 3);
    assert.equal(st.complete, true);
    assert.ok(st.glow > glowBefore, 'light pool should grow');
    assert.equal(st.fireflies, 3);

    // the exit appears — walking to it advances to hope-2
    const reached = await walkTo(page, () => {
      const sc = window.__game.scene;
      if (!sc.exit) return null;
      return { x: sc.stick.x, z: sc.stick.z, tx: sc.exit.x, tz: sc.exit.z };
    }, { arrive: 14, timeoutMs: 25000 });
    await page.waitForFunction(
      () => window.__save.data.node.index === 1 && window.__save.data.node.chapter === 'hope',
      null, { timeout: 10000 }
    ).catch(() => assert.fail(`never advanced to hope-2 (reached exit: ${reached})`));

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
