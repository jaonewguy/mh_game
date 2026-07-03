/*
 * Game — the loop and the scene manager.
 *
 * Scenes are classes registered by name; `goto(name, params)` fades the
 * screen to black, constructs a fresh instance, and fades back in. The
 * palette HUD (the six color rings) is drawn on top of every scene
 * unless the scene sets `hideHUD = true`.
 */
import { Input } from './input.js';
import { drawPaletteHUD } from '../render/draw.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scenes = new Map();
    this.scene = null;
    this.sceneName = null;
    // fade: dir -1 = fading out (toward black), +1 = fading in
    this.fade = { alpha: 0, dir: 0, next: null, nextParams: null };
    this.last = performance.now();
  }

  register(name, SceneClass) {
    this.scenes.set(name, SceneClass);
  }

  // Switch scenes through a short black fade. Instant on first start.
  goto(name, params = {}) {
    if (!this.scene) {
      this.scene = new (this.scenes.get(name))(this, params);
      this.sceneName = name;
      this.fade.alpha = 1;
      this.fade.dir = 1;
      return;
    }
    if (this.fade.next) return; // already transitioning
    this.fade.next = name;
    this.fade.nextParams = params;
    this.fade.dir = -1;
  }

  start(name, params) {
    this.goto(name, params);
    requestAnimationFrame((t) => this._frame(t));
  }

  _frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    // fade bookkeeping
    if (this.fade.dir !== 0) {
      this.fade.alpha += (this.fade.dir === -1 ? dt : -dt) * 2.2;
      if (this.fade.dir === -1 && this.fade.alpha >= 1) {
        this.fade.alpha = 1;
        const SceneClass = this.scenes.get(this.fade.next);
        this.scene = new SceneClass(this, this.fade.nextParams || {});
        this.sceneName = this.fade.next;
        this.fade.next = null;
        this.fade.dir = 1;
      } else if (this.fade.dir === 1 && this.fade.alpha <= 0) {
        this.fade.alpha = 0;
        this.fade.dir = 0;
      }
    }

    // Freeze the world during the fade-out so scenes don't keep
    // playing while invisible.
    if (this.fade.dir !== -1) this.scene.update(dt);
    this.scene.draw(this.ctx);
    if (!this.scene.hideHUD) drawPaletteHUD(this.ctx, this.canvas);

    if (this.fade.alpha > 0) {
      this.ctx.fillStyle = `rgba(0,0,0,${this.fade.alpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    Input.endFrame();
    requestAnimationFrame((t) => this._frame(t));
  }
}
