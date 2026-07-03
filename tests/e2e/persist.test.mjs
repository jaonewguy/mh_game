import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, sceneIs, enterNode } from './helpers.mjs';

test('unlock ceremony: color + music voice arrive, and both survive a reload', async () => {
  const { page, errors, close } = await boot();
  try {
    await page.keyboard.press('Enter'); // gesture boots the audio engine
    await sceneIs(page, 'prologue');
    await enterNode(page, { type: 'unlock', chapter: 'hope' });
    await sceneIs(page, 'unlock');

    await page.waitForFunction(() => window.__palette.isUnlocked('hope'), null, { timeout: 10000 });

    const music = await page.evaluate(() => window.__music.debugState());
    if (music.started) {
      assert.ok(music.voices.hope > 0, `hope voice should fade in: ${JSON.stringify(music.voices)}`);
    }

    // ceremony flows onward on its own — into the next chapter's story
    // beat (generous timeout: ~9s of game time can stretch under load
    // since dt is clamped per frame)
    await sceneIs(page, 'story', 40000);

    await page.reload();
    await sceneIs(page, 'menu');
    const persisted = await page.evaluate(() => ({
      hope: window.__palette.isUnlocked('hope'),
      node: window.__save.data.node,
      canContinue: window.__game.scene.options.some(o => o.label === 'continue'),
    }));
    assert.equal(persisted.hope, true);
    assert.equal(persisted.node.type, 'story');
    assert.equal(persisted.canContinue, true);

    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
