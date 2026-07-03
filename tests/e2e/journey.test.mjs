import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs } from './helpers.mjs';

test('journey: prologue plays out and story text leads into chapter one', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');

    // the fall, the landing, eight wall slams, the fade — all automatic
    await sceneIs(page, 'story', 40000);

    // space through both story beats into the first level
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const scene = await page.evaluate(() => window.__game.sceneName);
      if (scene === 'level') break;
      await page.keyboard.press(' ');
      await page.waitForTimeout(200);
    }
    await sceneIs(page, 'level', 5000);

    const node = await page.evaluate(() => window.__save.data.node);
    assert.deepEqual(node, { type: 'level', chapter: 'calm', index: 0 });
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
