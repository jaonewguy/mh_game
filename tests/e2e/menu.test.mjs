import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs } from './helpers.mjs';

test('menu: help overlay opens/closes, begin starts the prologue', async () => {
  const { page, errors, close } = await boot();
  try {
    // navigate down to "how to play" (last option) and open it
    await page.keyboard.press('ArrowUp'); // wraps to the last option
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.scene.showHelp === true);

    await page.keyboard.press(' ');
    await page.waitForFunction(() => window.__game.scene.showHelp === false);

    // back to the first option and begin
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
