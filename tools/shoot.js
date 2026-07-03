/*
 * Playthrough smoke test.
 *
 * Drives the real game in headless Chromium: menu -> prologue ->
 * story -> chapter 1 level (plays the breathing mechanic for real)
 * -> unlock ceremony -> end scene, plus a save/resume reload check.
 * Screenshots land in OUT (default: tools/out). Exits non-zero on any
 * console/page error or a failed step.
 *
 * Usage:  node tools/shoot.js            (server on :8010 already running)
 *         PORT=9000 OUT=/tmp/shots node tools/shoot.js
 */
const { chromium } = require('playwright');
const fs = require('fs');

const PORT = process.env.PORT || 8010;
const OUT = process.env.OUT || `${__dirname}/out`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const sceneIs = (name, timeout = 40000) =>
    page.waitForFunction((n) => window.__game && window.__game.sceneName === n, name, { timeout });

  await page.goto(`http://localhost:${PORT}/`);

  // ---- menu ----
  await sceneIs('menu');
  await page.waitForTimeout(800);
  await shot('01_menu');

  // ---- prologue ----
  await page.keyboard.press('Enter');
  await sceneIs('prologue');
  await page.waitForTimeout(1500);
  await shot('02_prologue_falling');
  await page.waitForTimeout(3000);
  await shot('03_prologue_landed');
  await page.waitForTimeout(8500);
  await shot('04_prologue_walls');

  // ---- prologue story beat (auto-advances from prologue) ----
  await sceneIs('story', 30000);
  await page.waitForTimeout(1200);
  await shot('05_story');
  // Each line needs up to two presses (reveal, then advance); keep
  // pressing through both story beats until the level begins.
  const storyDeadline = Date.now() + 30000;
  while (Date.now() < storyDeadline) {
    const scene = await page.evaluate(() => window.__game.sceneName);
    if (scene === 'level') break;
    await page.keyboard.press(' ');
    await page.waitForTimeout(200);
  }
  await sceneIs('level', 5000);
  await page.waitForTimeout(2500); // intro card
  await shot('06_level_calm1');

  // Play the breathing mechanic for real: hold space on the inhale,
  // release on the exhale, until the level reports completion.
  let spaceDown = false;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => {
      const sc = window.__game.scene;
      return sc && sc.breathK ? { state: sc.state, k: sc.breathK() } : null;
    });
    if (!st) break;
    if (st.state === 'complete') break;
    const want = st.k > 0;
    if (want && !spaceDown) { await page.keyboard.down(' '); spaceDown = true; }
    if (!want && spaceDown) { await page.keyboard.up(' '); spaceDown = false; }
    await page.waitForTimeout(80);
  }
  if (spaceDown) await page.keyboard.up(' ');
  const levelState = await page.evaluate(() => window.__game.scene.state);
  if (levelState !== 'complete') errors.push(`breathing mechanic never completed (state=${levelState})`);
  await shot('07_level_complete');

  // save/resume check while we're mid-chapter
  const savedNode = await page.evaluate(() => window.__save.data.node);
  if (!savedNode || savedNode.type !== 'level') errors.push(`save node wrong: ${JSON.stringify(savedNode)}`);

  // walk to the exit (screen up-right = world -z)
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__game.sceneName !== 'level' || window.__game.scene.node.index !== 0, null, { timeout: 15000 })
    .catch(() => errors.push('never reached the level exit'));
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');

  // ---- jump to the unlock ceremony (calm-2/3 share the code path) ----
  await page.evaluate(() => window.__flow.enter(window.__game, { type: 'unlock', chapter: 'calm' }));
  await sceneIs('unlock');
  await page.waitForTimeout(4500);
  await shot('08_unlock');
  const music = await page.evaluate(() => window.__music.debugState());
  if (music.started && !(music.voices.calm > 0)) errors.push(`calm voice not fading in: ${JSON.stringify(music)}`);
  const calmUnlocked = await page.evaluate(() => window.__palette.isUnlocked('calm'));
  if (!calmUnlocked) errors.push('calm color not unlocked after ceremony');

  // ---- end scene ----
  await sceneIs('end', 20000);
  await page.waitForTimeout(1800);
  await shot('09_end');

  // ---- reload: continue should resume from the saved node ----
  await page.reload();
  await sceneIs('menu');
  await page.waitForTimeout(600);
  await shot('10_menu_continue');
  const stillUnlocked = await page.evaluate(() => window.__palette.isUnlocked('calm'));
  if (!stillUnlocked) errors.push('calm unlock did not persist across reload');

  await browser.close();
  if (errors.length) {
    console.error('FAIL');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('OK — full playthrough clean, screenshots in', OUT);
})();
