/*
 * Clarity mechanic (Chapter 6).
 *
 * The fog was never the world — it was the lens. Grey drifts across
 * everything; only the ground near you is certain. Ringed vantage
 * points wait out in the haze: stand on one, hold still a moment, and
 * a portion of the fog lifts for good. See from every vantage and the
 * whole of it comes back.
 *
 * Level params: { vantages, holdSec }
 */
import { Palette } from '../../palette.js';
import { haloText } from '../../render/draw.js';
import { Sfx } from '../../audio/sfx.js';
import { Music } from '../../audio/music.js';

export class ClarityMechanic {
  constructor(scene, def) {
    this.scene = scene;
    this.p = { holdSec: 1.2, ...def.params };
    this.complete = false;
    this.t = 0;
    this.cleared = 0;
    this.holdT = 0;
    this.activeVantage = null;
    scene.tremorLevel = 0;

    this.vantages = this.place(this.p.vantages);
    // drifting fog banks, in screen-space fractions so resize is safe
    this.banks = [];
    let seed = 41;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9; i++) {
      this.banks.push({
        fx: rand(), fy: rand() * 0.9,
        r: 0.16 + rand() * 0.2,
        vx: (rand() - 0.5) * 0.014,
        vy: (rand() - 0.5) * 0.008,
        a: 0.5 + rand() * 0.5,
      });
    }
  }

  place(n) {
    const R = this.scene.room.floorHalf * 0.78;
    const pts = [];
    let guard = 0;
    while (pts.length < n && guard++ < 400) {
      const a = Math.random() * Math.PI * 2;
      const r = 70 + Math.random() * (R - 70);
      const v = { x: Math.cos(a) * r, z: Math.sin(a) * r, cleared: false };
      if (pts.every(o => Math.hypot(o.x - v.x, o.z - v.z) > 110)) pts.push(v);
    }
    return pts;
  }

  fogLevel() {
    return this.complete ? 0 : 1 - (this.cleared / this.p.vantages) * 0.82;
  }

  progress() {
    return { done: this.cleared, total: this.p.vantages };
  }

  update(dt) {
    this.t += dt;
    const s = this.scene.stick;

    for (const b of this.banks) {
      b.fx = (b.fx + b.vx * dt + 1) % 1;
      b.fy = (b.fy + b.vy * dt + 1) % 1;
    }

    // standing still on a vantage clears it
    const v = this.vantages.find(v => !v.cleared &&
      Math.hypot(s.x - v.x, s.z - v.z) < 30);
    if (v && !s.moving) {
      this.activeVantage = v;
      this.holdT += dt;
      if (this.holdT >= this.p.holdSec) {
        v.cleared = true;
        this.cleared++;
        this.holdT = 0;
        this.activeVantage = null;
        Sfx.spark();
        this.scene.dust.burst(v.x, this.scene.floorY, v.z, 10, 90);
        Music.setMood({
          tension: this.scene.def.mood.tension * (1 - this.cleared / this.p.vantages),
        });
        if (this.cleared >= this.p.vantages) {
          this.complete = true;
          Music.setMood({ tension: 0.05 });
        }
      }
    } else {
      this.holdT = 0;
      this.activeVantage = null;
    }
  }

  figurePose() { return null; }

  drawWorld(ctx, pr) {
    const fy = this.scene.floorY;
    for (const v of this.vantages) {
      const p = pr({ x: v.x, y: fy, z: v.z });
      const pulse = v.cleared ? 0 : 0.5 + Math.sin(this.t * 2.4) * 0.25;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 16, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = v.cleared
        ? Palette.roleRGBA('clarityMark', 0.9)
        : `rgba(255,255,255,${0.35 + pulse * 0.4})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // hold progress: an arc sweeping closed while you stand and look
      if (this.activeVantage === v && this.holdT > 0.05) {
        const frac = this.holdT / this.p.holdSec;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 22, 11, 0, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = Palette.roleRGBA('clarityMark', 0.9);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  // The fog itself: grey banks over everything, with clear pools
  // around the figure and every cleared vantage. Runner calls this
  // after the world is drawn.
  drawOverlay(ctx, pr) {
    const level = this.fogLevel();
    if (level <= 0.02) return;
    const w = this.scene.game.canvas.width, h = this.scene.game.canvas.height;

    if (!this._fog || this._fog.width !== w || this._fog.height !== h) {
      this._fog = document.createElement('canvas');
      this._fog.width = w;
      this._fog.height = h;
    }
    const f = this._fog.getContext('2d');
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, w, h);
    for (const b of this.banks) {
      const bx = b.fx * w, by = b.fy * h, br = b.r * Math.max(w, h);
      const g = f.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, `rgba(158,158,164,${0.5 * b.a * level})`);
      g.addColorStop(1, 'rgba(158,158,164,0)');
      f.fillStyle = g;
      f.fillRect(bx - br, by - br, br * 2, br * 2);
    }

    // clear pools: you, and everywhere you've already seen from
    f.globalCompositeOperation = 'destination-out';
    const s = this.scene.stick;
    const holes = [{ x: s.x, z: s.z, r: 170 }]
      .concat(this.vantages.filter(v => v.cleared).map(v => ({ x: v.x, z: v.z, r: 130 })));
    for (const hole of holes) {
      const p = pr({ x: hole.x, y: this.scene.floorY - 20, z: hole.z });
      const g = f.createRadialGradient(p.x, p.y, 0, p.x, p.y, hole.r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g;
      f.fillRect(p.x - hole.r, p.y - hole.r, hole.r * 2, hole.r * 2);
    }

    ctx.drawImage(this._fog, 0, 0);
  }

  drawUI(ctx, w, h) {
    if (this.complete) return;
    if (this.t > 2.5 && this.t < 12 && this.cleared === 0) {
      haloText(ctx, 'find the rings in the fog. stand on one, be still, and look.',
        w / 2, h * 0.8, 14, 'rgba(255,255,255,0.75)');
    }
  }
}
