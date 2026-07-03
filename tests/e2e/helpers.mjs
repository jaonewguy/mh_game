/*
 * Shared e2e plumbing: a tiny static file server (no python needed)
 * and a headless Chromium page wired to collect console/page errors.
 *
 * Playwright is expected from the environment (globally installed or
 * NODE_PATH); it is deliberately not a package dependency.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  throw new Error('e2e tests need playwright (npm i -g playwright, or set NODE_PATH)');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

export function serveStatic() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

export async function boot() {
  const { server, port } = await serveStatic();
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.__game && window.__game.sceneName === 'menu');

  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      server.close();
    },
  };
}

export const sceneIs = (page, name, timeout = 40000) =>
  page.waitForFunction((n) => window.__game.sceneName === n, name, { timeout });

export const enterNode = (page, node) =>
  page.evaluate((n) => window.__flow.enter(window.__game, n), node);

// Wait through the level's fade-in + intro card into the 'play' state.
export async function waitForPlay(page, timeout = 10000) {
  await page.waitForFunction(
    () => window.__game.sceneName === 'level' && window.__game.scene.state !== 'intro',
    null, { timeout }
  );
}

// Drive the breathing mechanic like a player: hold space during the
// inhale, release on the exhale. Works through the tutorial's waiting
// states too, since they gate on exactly this behavior.
export async function breathe(page, { until, timeoutMs = 100000 }) {
  let down = false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => {
      const sc = window.__game.scene;
      if (!sc || !sc.mech) return null;
      return { k: sc.breathK(), complete: sc.mech.complete, cycles: sc.mech.cycles ?? 0, state: sc.state };
    });
    if (!st) break;
    if (until(st)) break;
    const want = st.k > 0;
    if (want && !down) { await page.keyboard.down(' '); down = true; }
    if (!want && down) { await page.keyboard.up(' '); down = false; }
    await page.waitForTimeout(70);
  }
  if (down) await page.keyboard.up(' ');
}

// Steer the figure toward a world-space target by translating the
// desired world direction into screen-relative arrow keys.
export async function walkTo(page, targetFn, { arrive = 20, timeoutMs = 30000 } = {}) {
  const pressed = new Set();
  const setKey = async (key, on) => {
    if (on && !pressed.has(key)) { await page.keyboard.down(key); pressed.add(key); }
    if (!on && pressed.has(key)) { await page.keyboard.up(key); pressed.delete(key); }
  };
  const deadline = Date.now() + timeoutMs;
  let arrived = false;
  while (Date.now() < deadline) {
    const st = await page.evaluate(targetFn);
    if (!st) break; // scene changed under us — caller asserts what happened
    const dx = st.tx - st.x, dz = st.tz - st.z;
    if (Math.hypot(dx, dz) < arrive) { arrived = true; break; }
    const sx = dx - dz, sy = (dx + dz) / 2;
    await setKey('ArrowRight', sx > 12);
    await setKey('ArrowLeft',  sx < -12);
    await setKey('ArrowUp',    sy < -6);
    await setKey('ArrowDown',  sy > 6);
    await page.waitForTimeout(60);
  }
  for (const k of [...pressed]) await page.keyboard.up(k);
  return arrived;
}
