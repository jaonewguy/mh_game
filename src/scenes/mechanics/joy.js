/*
 * Joy mechanic (Chapter 3).
 *
 * Joy is movement. The figure runs faster here and leaves a trail of
 * light. Two modes, set per level:
 *
 *   mode "paint" — the room is bigger than it was, and empty. Running
 *                  leaves permanent strokes of light on the floor;
 *                  cover enough of it and the level completes. Motion
 *                  with a mark to show for it.
 *   mode "chase" — a quick bright spark wants to play. It teases,
 *                  flees when you rush it, wanders when you don't.
 *                  Catch it the required number of times.
 *
 * Level params: { mode, coverage?, catches?, sparkSpeed? }
 */
import { text, haloText } from '../../render/draw.js';
import { Palette } from '../../palette.js';
import { Sfx } from '../../audio/sfx.js';
import { Music } from '../../audio/music.js';

export class JoyMechanic {
  constructor(scene, def) {
    this.scene = scene;
    this.p = def.params;
    this.complete = false;
    this.t = 0;
    this.moveSpeed = 285; // the runner reads this — joy is quick
    this.trail = [];
    this.catches = 0;
    scene.tremorLevel = 0;

    if (this.p.mode === 'chase') this.spark = this.spawnSpark();

    if (this.p.mode === 'paint') {
      // a coverage grid over the floor; running brushes cells
      this.cell = 48;
      this.gridHalf = scene.room.floorHalf;
      this.gridN = Math.ceil((this.gridHalf * 2) / this.cell);
      this.visited = new Set();
      this.strokes = []; // permanent marks, unlike the fading tail
    }
  }

  spawnSpark() {
    const s = this.scene.stick;
    const R = this.scene.room.floorHalf * 0.8;
    let x = 0, z = 0, guard = 0;
    do {
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.5 + Math.random() * 0.5);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } while (Math.hypot(x - s.x, z - s.z) < 160 && guard++ < 50);
    return { x, z, vx: 0, vz: 0, wanderT: 0, wx: 0, wz: 0 };
  }

  coverageFrac() {
    return this.visited.size / (this.gridN * this.gridN);
  }

  progress() {
    if (this.p.mode === 'paint') {
      const frac = Math.min(1, this.coverageFrac() / this.p.coverage);
      return { done: Math.floor(frac * 8), total: 8 };
    }
    return { done: this.catches, total: this.p.catches };
  }

  update(dt) {
    this.t += dt;
    const s = this.scene.stick;

    // the trail: light remembers where you ran
    if (s.moving) {
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(s.x - last.x, s.z - last.z) > 9) {
        this.trail.push({ x: s.x, z: s.z, life: 0.7 });
      }
    }
    for (const q of this.trail) q.life -= dt;
    this.trail = this.trail.filter(q => q.life > 0);

    if (this.complete) return;

    if (this.p.mode === 'paint') {
      if (s.moving) {
        // permanent strokes: light stays where you ran
        const last = this.strokes[this.strokes.length - 1];
        if (!last || Math.hypot(s.x - last.x, s.z - last.z) > 12) {
          this.strokes.push({ x: s.x, z: s.z });
          if (this.strokes.length > 900) this.strokes.shift();
        }
        // brush the cell underfoot — coverage is earned stride by stride
        const ci = Math.floor((s.x + this.gridHalf) / this.cell);
        const cj = Math.floor((s.z + this.gridHalf) / this.cell);
        if (ci >= 0 && cj >= 0 && ci < this.gridN && cj < this.gridN) {
          this.visited.add(ci + ',' + cj);
        }
      }
      Music.setMood({
        tension: this.scene.def.mood.tension * (1 - Math.min(1, this.coverageFrac() / this.p.coverage)),
      });
      if (this.coverageFrac() >= this.p.coverage) this.finish();
      return;
    }

    // ---- chase ----
    const sp = this.spark;
    const dx = sp.x - s.x, dz = sp.z - s.z;
    const d = Math.hypot(dx, dz);
    const speed = 250 * (this.p.sparkSpeed || 1);

    // calm changes the rules: breathe (once calm is reclaimed) and the
    // spark grows curious about your stillness — it comes to you.
    this.calmed = !!(this.scene.abilities && this.scene.abilities.breathing && !s.moving);
    if (this.calmed) {
      sp.vx += ((s.x - sp.x) / Math.max(1, d)) * 260 * dt;
      sp.vz += ((s.z - sp.z) / Math.max(1, d)) * 260 * dt;
      const v = Math.hypot(sp.vx, sp.vz);
      const curious = 95;
      if (v > curious) { sp.vx = (sp.vx / v) * curious; sp.vz = (sp.vz / v) * curious; }
      sp.x += sp.vx * dt;
      sp.z += sp.vz * dt;
      if (d < 30) this.catchSpark();
      return;
    }

    if (d < 150) {
      // flee, but playfully — never in a dead-straight line
      const away = Math.atan2(-dz, -dx) + Math.sin(this.t * 3) * 0.7;
      sp.vx += Math.cos(away) * 900 * dt;
      sp.vz += Math.sin(away) * 900 * dt;
    } else {
      // wander toward a whim, re-chosen every couple of seconds
      sp.wanderT -= dt;
      if (sp.wanderT <= 0) {
        sp.wanderT = 1.5 + Math.random() * 1.5;
        const R = this.scene.room.floorHalf * 0.75;
        sp.wx = (Math.random() - 0.5) * 2 * R;
        sp.wz = (Math.random() - 0.5) * 2 * R;
      }
      sp.vx += (sp.wx - sp.x) * 0.8 * dt;
      sp.vz += (sp.wz - sp.z) * 0.8 * dt;
    }

    const v = Math.hypot(sp.vx, sp.vz);
    if (v > speed) { sp.vx = (sp.vx / v) * speed; sp.vz = (sp.vz / v) * speed; }
    sp.x += sp.vx * dt;
    sp.z += sp.vz * dt;

    // stay inside the glass — bounce softly off the walls
    const lim = this.scene.room.half - 20;
    if (Math.abs(sp.x) > lim) { sp.x = Math.sign(sp.x) * lim; sp.vx *= -0.6; }
    if (Math.abs(sp.z) > lim) { sp.z = Math.sign(sp.z) * lim; sp.vz *= -0.6; }

    if (d < 30) this.catchSpark();
  }

  catchSpark() {
    const sp = this.spark;
    this.catches++;
    Sfx.spark();
    this.scene.dust.burst(sp.x, this.scene.floorY, sp.z, 10, 120);
    Music.setMood({
      tension: this.scene.def.mood.tension * (1 - this.catches / this.p.catches),
    });
    if (this.catches >= this.p.catches) this.finish();
    else this.spark = this.spawnSpark();
  }

  finish() {
    this.complete = true;
    Sfx.good();
  }

  figurePose() { return null; } // run/idle — the running IS the pose

  drawWorld(ctx, pr) {
    // painted floor: the permanent record of everywhere you've run.
    // One continuous path per pass (split at gaps between runs) so the
    // strokes read as smooth ink, not beads.
    if (this.strokes && this.strokes.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [color, lw] of [['rgba(0,0,0,0.12)', 15], [Palette.roleRGBA('joyTrail', 0.30), 8]]) {
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < this.strokes.length; i++) {
          const q = this.strokes[i];
          const p = pr({ x: q.x, y: this.scene.floorY - 1, z: q.z });
          const prev = this.strokes[i - 1];
          const gap = !prev || Math.hypot(q.x - prev.x, q.z - prev.z) > 60;
          if (gap || !pen) { ctx.moveTo(p.x, p.y); pen = true; }
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }

    // the trail, drawn on the floor as fading light
    if (this.trail.length > 1) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const pa = pr({ x: a.x, y: this.scene.floorY - 1, z: a.z });
        const pb = pr({ x: b.x, y: this.scene.floorY - 1, z: b.z });
        const alpha = Math.min(1, b.life / 0.7);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(0,0,0,${0.35 * alpha})`;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = Palette.roleRGBA('joyTrail', 0.55 * alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (this.spark && !this.complete) {
      const sp = this.spark;
      // ground ring so its position on the floor is readable
      const g = pr({ x: sp.x, y: this.scene.floorY, z: sp.z });
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, 10, 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // the spark itself, hovering and shimmering
      const p = pr({ x: sp.x, y: this.scene.floorY - 22 + Math.sin(this.t * 6) * 4, z: sp.z });
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
      grad.addColorStop(0, Palette.roleRGBA('joyTrail', 0.9));
      grad.addColorStop(1, Palette.roleRGBA('joyTrail', 0));
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 16, p.y - 16, 32, 32);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  drawUI(ctx, w, h) {
    if (this.complete) return;
    if (this.p.mode === 'paint' && this.t > 2 && this.coverageFrac() < 0.06) {
      haloText(ctx, 'the floor remembers where you run. cover it.', w / 2, h * 0.8, 14, 'rgba(255,255,255,0.75)');
    }
    if (this.p.mode === 'chase' && this.catches === 0 && this.t > 2 && this.t < 10) {
      haloText(ctx, 'catch it', w / 2, h * 0.8, 14, 'rgba(255,255,255,0.75)');
    }
  }
}
