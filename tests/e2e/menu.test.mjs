import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs } from './helpers.mjs';

test('menu: help overlay opens/closes, begin starts the prologue', async () => {
  const { page, errors, close } = await boot();
  try {
    // fresh-save options: begin / how to play / scenes — dev
    await page.keyboard.press('ArrowDown'); // to "how to play"
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.scene.view === 'help');

    await page.keyboard.press(' ');
    await page.waitForFunction(() => window.__game.scene.view === 'main');

    // back to the first option and begin
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await sceneIs(page, 'prologue');

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test('menu: dev scene picker lists the flow chronologically and jumps anywhere', async () => {
  const { page, errors, close } = await boot();
  try {
    // options (fresh save): begin / how to play / scenes — dev
    await page.keyboard.press('ArrowUp'); // wrap to the last option
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.scene.view === 'scenes');

    // the list mirrors the flow spine exactly
    const check = await page.evaluate(() => {
      const flow = window.__flow.nodes;
      const menu = window.__game.scene;
      return {
        count: flow.length,
        firstLabel: menu.nodeLabel(flow[0]),
        levelLabel: menu.nodeLabel(flow.find(n => n.type === 'level')),
      };
    });
    assert.ok(check.count >= 17, `flow should list all nodes, got ${check.count}`);
    assert.equal(check.firstLabel, 'prologue — the fall');
    assert.match(check.levelLabel, /calm i — /);

    // jump to the first calm level (prologue, story, story, level...)
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120); }
    await page.keyboard.press('Enter');
    await sceneIs(page, 'level');
    const node = await page.evaluate(() => window.__game.scene.node);
    assert.deepEqual(node, { type: 'level', chapter: 'calm', index: 0 });

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
