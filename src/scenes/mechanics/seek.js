/*
 * Seek mechanic (Chapter 2 — hope).
 *
 * The room goes dark: the world is only visible inside a pool of
 * light around the figure. Faint motes flicker out in the black —
 * walking to one collects it: the light pool grows and a firefly
 * begins to orbit the figure. Collect them all and the way out
 * appears. Hope, literalized: each small light you find lets you
 * see a little farther.
 *
 * Level params: { motes, glow, glowPerMote, drift, decay, minGlow }
 * (glow radii in screen pixels)
 */
import { text } from '../../render/draw.js';
import { Palette } from '../../palette.js';
import { Sfx } from '../../audio/sfx.js';
import { Music } from '../../audio/music.js';

export class SeekMechanic {
  constructor(scene, def) {
    this.scene = scene;
    this.p = def.params;
    this.complete = false;
    this.t = 0;
    this.glow = this.p.glow;
    this.collected = 0;
    this.fireflies = [];
    this.darkness = true; // level runner applies the mask when set

    scene.tremorLevel = 0;
    this.motes = this.placeMotes(this.p.motes);
  }

  placeMotes(n) {
    const R = this.scene.room.floorHalf * 0.82;
    const motes = [];
    let guard = 0;
    while (motes.length < n && guard++ < 400) {
      const a = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * (R - 60);
      const m = {
        x: Math.cos(a) * r, z: Math.sin(a) * r,
        seed: Math.random() * 10, found: false,
      };
      const clear = motes.every(o => Math.hypot(o.x - m.x, o.z - m.z) > 70);
      if (clear) motes.push(m);
    }
    return motes;
  }

  progress() {
    return { done: this.collected, total: this.p.motes };
  }

  update(dt) {
    this.t += dt;
    const s = this.scene.stick;

    if (this.p.decay && !this.complete) {
      this.glow = Math.max(this.p.minGlow || 60, this.glow - this.p.decay * dt);
    }

    for (const m of this.motes) {
      if (m.found) continue;
      if (this.p.drift) {
        m.x += Math.sin(this.t * 0.4 + m.seed) * 6 * dt;
        m.z += Math.cos(this.t * 0.33 + m.seed * 1.7) * 6 * dt;
      }
      // lights lean toward whoever comes looking — generous pickup
      const d = Math.hypot(s.x - m.x, s.z - m.z);
      if (d < 85 && d > 1) {
        const pull = 95 * dt;
        m.x += ((s.x - m.x) / d) * pull;
        m.z += ((s.z - m.z) / d) * pull;
      }
      if (d < 34) {
        m.found = true;
        this.collected++;
        this.glow += this.p.glowPerMote;
        Sfx.spark();
        this.fireflies.push({ phase: Math.random() * Math.PI * 2, dist: 26 + this.fireflies.length * 7 });
        Music.setMood({
          tension: this.scene.def.mood.tension * (1 - this.collected / this.p.motes),
        });
        if (this.collected >= this.p.motes) {
          this.complete = true;
          this.darkness = 'lifting'; // runner fades the mask out
        }
      }
    }
  }

  figurePose() { return null; } // default idle/run

  drawWorld() { /* motes glow above the darkness — see drawLights */ }

  // Called by the runner AFTER the darkness mask, so lights shine.
  drawLights(ctx, pr) {
    const s = this.scene.stick;

    for (const m of this.motes) {
      if (m.found) continue;
      const flicker = 0.45 + Math.sin(this.t * 2.3 + m.seed * 7) * 0.25;

      // a ring on the floor marks exactly where to stand
      const g = pr({ x: m.x, y: this.scene.floorY, z: m.z });
      const rr = 16 + Math.sin(this.t * 2 + m.seed) * 2;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, rr, rr * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + flicker * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // the light itself hovers just above its spot
      const p = pr({ x: m.x, y: this.scene.floorY - 14, z: m.z });
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
      grad.addColorStop(0, `rgba(255,255,255,${flicker})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.6 + flicker * 0.4})`;
      ctx.fill();
    }

    // collected lights stay with you
    for (const f of this.fireflies) {
      const a = this.t * 1.4 + f.phase;
      const p = pr({
        x: s.x + Math.cos(a) * f.dist,
        y: s.y - 30 + Math.sin(this.t * 2 + f.phase) * 8,
        z: s.z + Math.sin(a) * f.dist,
      });
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  }

  drawUI(ctx, w, h) {
    if (this.complete || this.collected > 0) return;
    if (this.t > 2 && this.t < 10) {
      text(ctx, 'small lights wait in the dark — walk onto their rings', w / 2, h * 0.8, 14, Palette.get('textFaint'));
    }
  }
}
