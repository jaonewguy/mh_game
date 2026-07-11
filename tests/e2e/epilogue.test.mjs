import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode } from './helpers.mjs';

test('epilogue: draw the morning, watch it rise, and it persists', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');
    await page.evaluate(() => {
      for (const s of window.__palette.slots) window.__palette.unlock(s.name);
    });
    await enterNode(page, { type: 'epilogue' });
    await sceneIs(page, 'epilogue');

    // intro -> canvas
    await page.waitForTimeout(1300);
    await page.keyboard.press(' ');
    await page.waitForFunction(() => window.__game.scene.phase === 'draw');

    // pick color 3 and paint two strokes across the canvas
    await page.keyboard.press('3');
    const r = await page.evaluate(() => window.__game.scene.rect());
    for (const [fy0, fy1] of [[0.3, 0.5], [0.7, 0.6]]) {
      await page.mouse.move(r.x + r.w * 0.2, r.y + r.h * fy0);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(r.x + r.w * (0.2 + 0.6 * (i / 8)), r.y + r.h * (fy0 + (fy1 - fy0) * (i / 8)));
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
    }
    const drawn = await page.evaluate(() => ({
      strokes: window.__game.scene.strokes.length,
      color: window.__game.scene.strokes[0] && window.__game.scene.strokes[0].c,
    }));
    assert.ok(drawn.strokes >= 2, `should have painted strokes: ${drawn.strokes}`);
    assert.equal(drawn.color, await page.evaluate(() => window.__palette.slots[2].color));

    // finish -> the rise -> the end card
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.scene.phase === 'rise');
    await page.waitForTimeout(8500);
    await page.keyboard.press(' ');
    await sceneIs(page, 'end', 20000);

    // the drawing survives a reload
    await page.reload();
    await sceneIs(page, 'menu');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_game.drawing') || '[]').length);
    assert.ok(saved >= 2, `drawing should persist: ${saved} strokes`);

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
