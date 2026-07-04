import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode, waitForPlay } from './helpers.mjs';

test('carried abilities: calm breathing works anywhere and tames the joy spark', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');

    // simulate a player who has reclaimed calm and hope
    await page.evaluate(() => {
      window.__palette.unlock('calm');
      window.__palette.unlock('hope');
    });
    await enterNode(page, { type: 'level', chapter: 'joy', index: 1 }); // chase
    await waitForPlay(page);

    // hope's light stayed: fireflies accompany the figure
    const fireflies = await page.evaluate(() => window.__game.scene.abilities.fireflies.length);
    assert.ok(fireflies > 0, 'hope should leave fireflies with the player');

    // hold space: the carried breath engages even outside calm levels
    await page.keyboard.down(' ');
    await page.waitForFunction(() => window.__game.scene.abilities.breathing === true, null, { timeout: 5000 });

    // ...and the spark stops fleeing — it approaches the stillness
    const before = await page.evaluate(() => {
      const sc = window.__game.scene;
      return Math.hypot(sc.mech.spark.x - sc.stick.x, sc.mech.spark.z - sc.stick.z);
    });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const sc = window.__game.scene;
      return {
        d: Math.hypot(sc.mech.spark.x - sc.stick.x, sc.mech.spark.z - sc.stick.z),
        calmed: sc.mech.calmed,
        caught: sc.mech.catches,
      };
    });
    await page.keyboard.up(' ');
    assert.ok(after.calmed || after.caught > 0, 'spark should register the calm');
    assert.ok(after.d < before || after.caught > 0,
      `spark should drift closer while breathing: ${before.toFixed(0)} -> ${after.d.toFixed(0)}`);

    // breathing in a breath level stays with the mechanic (no double ring)
    await page.waitForTimeout(600);
    await enterNode(page, { type: 'level', chapter: 'calm', index: 1 });
    await waitForPlay(page);
    await page.keyboard.down(' ');
    await page.waitForTimeout(400);
    const calmLevel = await page.evaluate(() => window.__game.scene.abilities.breathing);
    await page.keyboard.up(' ');
    assert.equal(calmLevel, false, 'carried breath must defer to the breath mechanic');

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
