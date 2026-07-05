/*
 * Courage mechanic (Chapter 4).
 *
 * Dark shapes share the room now. They feed on your back: look away
 * or run, and they grow and come for you. Walk *toward* one and it
 * falters — it backs off, and under sustained confrontation it
 * shrinks until it dissolves. Rooms here have missing walls; a shadow
 * can also be driven clean off the edge of your world.
 *
 * Getting caught isn't death — the shadow shoves you back, the world
 * flinches, and you square up again. There are no fail states in this
 * game; there is only continuing.
 *
 * Level params: { shadows, advance, retreat, engageRange, shrinkTime,
 *                 needDash }
 * courage-2's shadow advances faster than walking — the joy dash is
 * how you close the distance (soft fallback if joy is somehow locked).
 */
import { Palette } from '../../palette.js';
import { haloText } from '../../render/draw.js';
import { Sfx } from '../../audio/sfx.js';
import { Music } from '../../audio/music.js';

export class CourageMechanic {
  constructor(scene, def) {
    this.scene = scene;
    this.p = { engageRange: 260, shrinkTime: 6, ...def.params };
    if (this.p.needDash && !Palette.isUnlocked('joy')) {
      this.p.advance = Math.min(this.p.advance, 215); // beatable without the dash
    }
    this.complete = false;
    this.t = 0;
    this.dissolved = 0;
    this.moodT = 0;
    this.prevX = scene.stick.x;
    this.prevZ = scene.stick.z;
    scene.tremorLevel = 0;

    this.shadows = [];
    for (let i = 0; i < this.p.shadows; i++) this.shadows.push(this.spawnShadow());
  }

  spawnShadow() {
    const s = this.scene.stick;
    const R = this.scene.room.floorHalf * 0.8;
    let x = 0, z = 0, guard = 0;
    do {
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * R;
      z = Math.sin(a) * R;
    } while (Math.hypot(x - s.x, z - s.z) < 260 && guard++ < 50);
    return { x, z, size: 1, dead: false, sway: Math.random() * 10 };
  }

  progress() {
    return { done: this.dissolved, total: this.p.shadows };
  }

  update(dt) {
    this.t += dt;
    const s = this.scene.stick;

    // player's direction of travel this frame (dash included)
    const pvx = s.x - this.prevX, pvz = s.z - this.prevZ;
    const pv = Math.hypot(pvx, pvz);
    this.prevX = s.x;
    this.prevZ = s.z;

    let anyAdvancing = false;
    for (const sh of this.shadows) {
      if (sh.dead) continue;
      const tox = sh.x - s.x, toz = sh.z - s.z;
      const d = Math.hypot(tox, toz) || 1;

      const confronting = pv > 1 &&
        ((pvx / pv) * (tox / d) + (pvz / pv) * (toz / d)) > 0.55;

      if (confronting) {
        // every step toward it is a step it loses
        sh.x += (tox / d) * this.p.retreat * dt;
        sh.z += (toz / d) * this.p.retreat * dt;
        if (d < this.p.engageRange) {
          sh.size -= dt / this.p.shrinkTime;
        }
      } else {
        anyAdvancing = true;
        sh.x -= (tox / d) * this.p.advance * (0.55 + 0.45 * sh.size) * dt;
        sh.z -= (toz / d) * this.p.advance * (0.55 + 0.45 * sh.size) * dt;
        sh.size = Math.min(1, sh.size + dt / (this.p.shrinkTime * 3));
      }

      // caught: a shove, not an ending
      if (d < 28) {
        const push = 95;
        s.x -= (tox / d) * push; // shoved away from the shadow
        s.z -= (toz / d) * push;
        this.scene.room.clamp(s);
        this.scene.shake = 0.8;
        Sfx.miss();
        sh.x += (tox / d) * 140;
        sh.z += (toz / d) * 140;
      }

      // closed walls stop it; open edges are how it leaves your world
      const lim = this.scene.room.floorHalf - 18;
      const open = this.scene.room.open;
      if (sh.x >  lim && !open.has('xpos')) sh.x = lim;
      if (sh.x < -lim && !open.has('xneg')) sh.x = -lim;
      if (sh.z >  lim && !open.has('zpos')) sh.z = lim;
      if (sh.z < -lim && !open.has('zneg')) sh.z = -lim;
      const off = this.scene.room.floorHalf + 26;
      const offEdge = Math.abs(sh.x) > off || Math.abs(sh.z) > off;

      if (sh.size <= 0 || offEdge) this.dissolve(sh);
    }

    // the score tightens while anything stalks you
    this.moodT += dt;
    if (this.moodT > 0.3) {
      this.moodT = 0;
      const alive = this.shadows.filter(sh => !sh.dead);
      const avg = alive.length
        ? alive.reduce((a, sh) => a + sh.size, 0) / alive.length : 0;
      Music.setMood({
        tension: this.scene.def.mood.tension * avg + (anyAdvancing ? 0.12 : 0),
      });
    }
  }

  dissolve(sh) {
    sh.dead = true;
    this.dissolved++;
    this.scene.dust.burst(sh.x, this.scene.floorY, sh.z, 16, 150);
    Sfx.good();
    if (this.dissolved >= this.p.shadows) {
      this.complete = true;
      Music.setMood({ tension: 0.08 });
    }
  }

  figurePose() { return null; }

  // beyond the missing walls, something warm is on the horizon
  drawBackdrop(ctx, pr) {
    const room = this.scene.room;
    const fy = this.scene.floorY;
    for (const side of room.open) {
      const dir = {
        xpos: { x: 1, z: 0 }, xneg: { x: -1, z: 0 },
        zpos: { x: 0, z: 1 }, zneg: { x: 0, z: -1 },
      }[side];
      const c = pr({
        x: dir.x * room.floorHalf * 2.1,
        y: fy - 30,
        z: dir.z * room.floorHalf * 2.1,
      });
      const r = room.floorHalf * 2.2;
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      grad.addColorStop(0, Palette.roleRGBA('joyTrail', 0.13));
      grad.addColorStop(1, Palette.roleRGBA('joyTrail', 0));
      ctx.fillStyle = grad;
      ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    }
  }

  drawWorld(ctx, pr) {
    const fy = this.scene.floorY;
    for (const sh of this.shadows) {
      if (sh.dead) continue;
      const sway = Math.sin(this.t * 1.8 + sh.sway) * 4 * sh.size;
      const base = pr({ x: sh.x, y: fy, z: sh.z });

      // marker ring so its footing is unambiguous (courage-red once earned)
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 20 * sh.size + 8, (20 * sh.size + 8) * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = Palette.isUnlocked('courage')
        ? Palette.colorRGBA('courage', 0.6)
        : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // the pooled dark it stands in
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 18 * sh.size + 6, (18 * sh.size + 6) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.35 + 0.3 * sh.size})`;
      ctx.fill();

      // the shape itself: stacked smoke, leaning as it moves
      const h = 26 + 62 * sh.size;
      for (let i = 0; i < 3; i++) {
        const frac = (i + 1) / 3;
        const p = pr({ x: sh.x, y: fy - h * frac, z: sh.z });
        const rx = (16 - i * 4) * sh.size + 4;
        ctx.beginPath();
        ctx.ellipse(p.x + sway * frac, p.y, rx, rx * 0.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10,10,10,${(0.75 - i * 0.16) * (0.4 + 0.6 * sh.size)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.10 + 0.08 * sh.size})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  drawUI(ctx, w, h) {
    if (this.complete) return;
    if (this.t > 2.5 && this.t < 12 && this.dissolved === 0) {
      const msg = this.p.needDash
        ? 'it is faster than your walk. double-tap a direction — joy remembers how to run.'
        : 'it grows when you look away. walk toward it.';
      haloText(ctx, msg, w / 2, h * 0.8, 14, 'rgba(255,255,255,0.75)');
    }
  }
}
