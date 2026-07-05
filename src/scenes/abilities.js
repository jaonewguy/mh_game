/*
 * Abilities — reclaimed emotions become things you carry.
 *
 * calm — once unlocked, hold SPACE in any non-breathing level to
 *        breathe: the ring returns in calm's color, the score swells
 *        with you, and calm-sensitive things respond (the joy spark
 *        grows curious instead of fleeing; future hazards steady).
 *
 * hope — once unlocked, its light stays with you: a soft glow under
 *        the figure and a few fireflies that never left.
 *
 * joy  — once unlocked, double-tap a direction to dash: a quick burst
 *        of motion with a flash of yellow trail. Some things can't be
 *        outwalked.
 *
 * More abilities join as their chapters are built (courage push,
 * warmth radius, clarity reveal).
 */
import { Input } from '../core/input.js';
import { Palette } from '../palette.js';
import { Music } from '../audio/music.js';
import { Sfx } from '../audio/sfx.js';
import * as Stick from '../render/stickman.js';

const BREATH_CYCLE = 4;   // seconds, matches calm-3's learned tempo
const DASH_TAP_MS = 260;  // double-tap window
const DASH_TIME = 0.16;   // seconds of burst
const DASH_SPEED = 950;   // px/s during the burst
const DASH_COOLDOWN = 0.7;

// screen-relative direction vectors on the iso ground plane
const DIRS = {
  right: { x:  1 / Math.SQRT2, z: -1 / Math.SQRT2 },
  left:  { x: -1 / Math.SQRT2, z:  1 / Math.SQRT2 },
  up:    { x: -1 / Math.SQRT2, z: -1 / Math.SQRT2 },
  down:  { x:  1 / Math.SQRT2, z:  1 / Math.SQRT2 },
};

export class Abilities {
  constructor(scene) {
    this.scene = scene;
    this.breathing = false;
    this.breathT = 0;
    this.fireflies = Palette.isUnlocked('hope')
      ? [0, 2.1, 4.2].map(phase => ({ phase }))
      : [];
    this.t = 0;

    this.lastTap = {};      // action -> time of last press
    this.dash = null;       // { dx, dz, remaining }
    this.dashCooldown = 0;
    this.dashTrail = [];    // fading streak points
  }

  // calm is a *carried* skill everywhere except the chapter teaching it
  calmAvailable() {
    return Palette.isUnlocked('calm') && this.scene.def.mechanic !== 'breath';
  }

  breathK() {
    return Math.sin((this.breathT / BREATH_CYCLE) * Math.PI * 2);
  }

  update(dt) {
    this.t += dt;
    const wants = this.calmAvailable() && Input.down('breath');
    if (wants) {
      this.breathT += dt;
      Music.setBreath(this.breathK());
    } else if (this.breathing) {
      Music.setBreath(0);
      this.breathT = 0;
    }
    this.breathing = wants;

    // ---- joy: the dash ----
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (Palette.isUnlocked('joy') && !this.dash && this.dashCooldown === 0) {
      const now = performance.now();
      for (const action of ['left', 'right', 'up', 'down']) {
        if (Input.pressed(action)) {
          if (now - (this.lastTap[action] || -1e9) < DASH_TAP_MS) {
            const d = DIRS[action];
            this.dash = { dx: d.x, dz: d.z, remaining: DASH_TIME };
            this.dashCooldown = DASH_COOLDOWN;
            Sfx.spark();
          }
          this.lastTap[action] = now;
        }
      }
    }
    if (this.dash) {
      const s = this.scene.stick;
      const step = DASH_SPEED * dt;
      s.x += this.dash.dx * step;
      s.z += this.dash.dz * step;
      this.dashTrail.push({ x: s.x, z: s.z, life: 0.35 });
      this.dash.remaining -= dt;
      if (this.dash.remaining <= 0) this.dash = null;
    }
    for (const q of this.dashTrail) q.life -= dt;
    this.dashTrail = this.dashTrail.filter(q => q.life > 0);
  }

  // pose override: breathing takes the body over
  figurePose() {
    if (!this.breathing || this.scene.stick.moving) return null;
    return Stick.poseBreathe(Math.max(0, this.breathK()));
  }

  // beneath the figure: the calm ring, hope's standing glow, dash fire
  drawUnder(ctx, pr) {
    const s = this.scene.stick;

    if (this.dashTrail.length > 1) {
      ctx.lineCap = 'round';
      for (const [color, lw] of [['rgba(0,0,0,0.3)', 10], [Palette.roleRGBA('joyTrail', 0.7), 5]]) {
        ctx.beginPath();
        for (let i = 0; i < this.dashTrail.length; i++) {
          const p = pr({ x: this.dashTrail[i].x, y: this.scene.floorY - 2, z: this.dashTrail[i].z });
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }

    if (Palette.isUnlocked('hope')) {
      const c = pr({ x: s.x, y: s.y - 10, z: s.z });
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 64);
      grad.addColorStop(0, Palette.colorRGBA('hope', 0.10));
      grad.addColorStop(1, Palette.colorRGBA('hope', 0));
      ctx.fillStyle = grad;
      ctx.fillRect(c.x - 64, c.y - 64, 128, 128);
    }

    if (this.breathing) {
      const k = this.breathK();
      const r = 44 + k * 22;
      const c = pr({ x: s.x, y: this.scene.floorY, z: s.z });
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = Palette.roleRGBA('breathRing', 0.08);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = Palette.roleRGBA('breathRing', 0.8);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // above the figure: the fireflies that stayed
  drawOver(ctx, pr) {
    const s = this.scene.stick;
    for (const f of this.fireflies) {
      const a = this.t * 1.1 + f.phase;
      const p = pr({
        x: s.x + Math.cos(a) * 30,
        y: s.y - 34 + Math.sin(this.t * 1.7 + f.phase) * 10,
        z: s.z + Math.sin(a) * 30,
      });
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = Palette.roleRGBA('hopeLight', 0.75);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
