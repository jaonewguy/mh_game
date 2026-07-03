/*
 * Unlock — the ceremony. The player has earned an emotion back:
 * its color washes into the world for the first time, its voice
 * joins the score, and one of the six rings fills.
 *
 * Reused for every chapter — the color and name come from the node.
 */
import { Flow } from '../core/flow.js';
import { Data } from '../core/data.js';
import { projector } from '../render/iso.js';
import * as Stick from '../render/stickman.js';
import { floorSlab, contactShadow, text } from '../render/draw.js';
import { Palette } from '../palette.js';
import { Music } from '../audio/music.js';
import { Sfx } from '../audio/sfx.js';

export class UnlockScene {
  constructor(game, { node }) {
    this.game = game;
    this.node = node;
    this.emotion = Data.chapters.chapters[node.chapter].emotion;
    this.color = Palette.colorOf(this.emotion);
    this.t = 0;
    this.unlocked = false;
    this.hideHUD = false;
    Music.setMood({ tension: 0 });
  }

  update(dt) {
    this.t += dt;
    if (!this.unlocked && this.t > 1.6) {
      this.unlocked = true;
      Palette.unlock(this.emotion);
      Music.unlockVoice(this.emotion, 5);
      Sfx.good();
    }
    if (this.t > 9) Flow.advance(this.game, this.node);
  }

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const floorY = 0;
    const cam = floorY - h * 0.62;
    const pr = projector(this.game.canvas, cam);

    // the color arrives as light: a radial wash blooming from the figure
    if (this.unlocked) {
      const k = Math.min(1, (this.t - 1.6) / 4);
      const center = pr({ x: 0, y: -40, z: 0 });
      const grad = ctx.createRadialGradient(center.x, center.y, 10, center.x, center.y, 90 + k * w * 0.45);
      grad.addColorStop(0, this.hexA(this.color, 0.5 * k));
      grad.addColorStop(1, this.hexA(this.color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    floorSlab(ctx, pr, Math.min(w * 0.16, 155), floorY);
    contactShadow(ctx, pr, 0, 0, floorY, 1);

    // the figure breathes it in, arms lifting
    const breathe = this.unlocked ? Math.min(1, (this.t - 1.6) / 2.5) : 0;
    const pose = Stick.poseBreathe(breathe * (0.6 + Math.sin(this.t * 1.2) * 0.2));
    pose.x = 0; pose.z = 0;
    pose.y = floorY - Stick.hipHeight(0.06, 1.15);
    pose.yaw = -Math.PI / 2;
    pose.scale = 1.15;
    Stick.draw(ctx, pr, pose, this.unlocked ? this.color : Palette.get('figure'), 3);

    if (this.unlocked) {
      const a = Math.min(1, (this.t - 2.2) / 1.2);
      if (a > 0) {
        text(ctx, this.emotion, w / 2, h * 0.24, 34, this.color, a, true);
        text(ctx, 'a color returns.', w / 2, h * 0.24 + 32, 14, Palette.get('textFaint'), a);
      }
    }
  }

  hexA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
