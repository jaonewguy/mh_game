/*
 * FX — small 3D particle systems: impact dust and the wind specks
 * that sell the speed of a long fall.
 */
import { Palette } from '../palette.js';

export class DustField {
  constructor() {
    this.parts = [];
  }

  burst(x, y, z, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({
        x, y, z,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: -speed * (0.2 + Math.random() * 0.4),
        life: 0.4 + Math.random() * 0.4,
      });
    }
  }

  update(dt) {
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += 60 * dt; // settle back toward the floor (y is down)
      p.life -= dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
  }

  draw(ctx, pr) {
    for (const p of this.parts) {
      const a = pr(p);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(a.x - 2.5, a.y - 2.5, 5, 5);
      ctx.fillStyle = Palette.get('dust');
      ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}

// Ambient motes filling the fall column, drawn with motion blur.
export class SpeckColumn {
  constructor(count, spread, depth) {
    this.alpha = 1;
    this.specks = [];
    for (let i = 0; i < count; i++) {
      this.specks.push({
        x: (Math.random() - 0.5) * spread,
        z: (Math.random() - 0.5) * spread,
        y: Math.random() * depth,
      });
    }
  }

  fade(dt, rate = 1.2) {
    this.alpha = Math.max(0, this.alpha - dt * rate);
  }

  draw(ctx, pr, vy) {
    if (this.alpha <= 0.01) return;
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = Palette.get('wind');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const sp of this.specks) {
      const blur = Math.max(2, vy * 0.035);
      const a = pr(sp);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, a.y - blur);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
