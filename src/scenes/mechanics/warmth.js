/*
 * Warmth mechanic (Chapter 5).
 *
 * You are not the only one out here. Small grey figures shiver alone
 * in the big open rooms. Walk close and they'll follow you — but they
 * are slower than you, and if you pull too far ahead they stop, sit
 * down in themselves, and wait. Bring each one to the hearth and it
 * warms through: color returns to it, and it stays by the fire.
 *
 * The first chapter that isn't about you.
 *
 * Level params: { companions, speed, followDist, loseDist }
 */
import { Palette } from '../../palette.js';
import { haloText } from '../../render/draw.js';
import * as Stick from '../../render/stickman.js';
import { Sfx } from '../../audio/sfx.js';
import { Music } from '../../audio/music.js';

export class WarmthMechanic {
  constructor(scene, def) {
    this.scene = scene;
    this.p = def.params;
    this.complete = false;
    this.t = 0;
    this.warmed = 0;
    scene.tremorLevel = 0;

    const half = scene.room.floorHalf;
    // the hearth sits in the sheltered corner
    this.hearth = { x: -half * 0.5, z: half * 0.5 };

    this.companions = [];
    for (let i = 0; i < this.p.companions; i++) {
      const a = -Math.PI / 4 + (i - (this.p.companions - 1) / 2) * 0.9;
      this.companions.push({
        x: Math.cos(a) * half * 0.7,
        z: Math.sin(a) * half * 0.7,
        yaw: Math.PI,
        following: false,
        warmed: false,
        moving: false,
        phase: Math.random() * 10,
      });
    }
  }

  progress() {
    return { done: this.warmed, total: this.p.companions };
  }

  update(dt) {
    this.t += dt;
    const s = this.scene.stick;

    for (const c of this.companions) {
      if (c.warmed) continue;
      const d = Math.hypot(s.x - c.x, s.z - c.z);

      if (!c.following && d < this.p.followDist) {
        c.following = true;
        Sfx.ui();
      }
      if (c.following && d > this.p.loseDist) {
        c.following = false; // you got too far ahead
        Sfx.miss();
      }

      // once they can see the fire, they walk to it themselves
      const hd = Math.hypot(c.x - this.hearth.x, c.z - this.hearth.z);
      const target = (c.following && hd < 190) ? this.hearth : s;
      const td = Math.hypot(target.x - c.x, target.z - c.z) || 1;

      c.moving = false;
      if (c.following && td > (target === this.hearth ? 8 : 46)) {
        const dx = (target.x - c.x) / td, dz = (target.z - c.z) / td;
        c.x += dx * this.p.speed * dt;
        c.z += dz * this.p.speed * dt;
        c.yaw = Math.atan2(dz, dx);
        c.moving = true;
      }

      // home
      if (c.following && hd < 55) {
        c.warmed = true;
        c.following = false;
        c.x = this.hearth.x + (Math.random() - 0.5) * 50;
        c.z = this.hearth.z + (Math.random() - 0.5) * 50;
        c.yaw = Math.atan2(this.hearth.z - c.z, this.hearth.x - c.x);
        this.warmed++;
        Sfx.good();
        this.scene.dust.burst(this.hearth.x, this.scene.floorY, this.hearth.z, 12, 110);
        Music.setMood({
          tension: this.scene.def.mood.tension * (1 - this.warmed / this.p.companions),
        });
        if (this.warmed >= this.p.companions) this.complete = true;
      }
    }
  }

  figurePose() { return null; }

  drawWorld(ctx, pr) {
    const fy = this.scene.floorY;

    // the hearth: a warm ring, and light that rises from it
    const hp = pr({ x: this.hearth.x, y: fy, z: this.hearth.z });
    const flick = 0.75 + Math.sin(this.t * 7) * 0.1 + Math.sin(this.t * 13) * 0.06;
    const grad = ctx.createRadialGradient(hp.x, hp.y - 18, 0, hp.x, hp.y - 18, 58);
    grad.addColorStop(0, Palette.roleRGBA('warmthGlow', 0.4 * flick));
    grad.addColorStop(1, Palette.roleRGBA('warmthGlow', 0));
    ctx.fillStyle = grad;
    ctx.fillRect(hp.x - 58, hp.y - 76, 116, 116);
    ctx.beginPath();
    ctx.ellipse(hp.x, hp.y, 26, 13, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = Palette.roleRGBA('warmthGlow', 0.85);
    ctx.lineWidth = 2;
    ctx.stroke();

    // the others
    for (const c of this.companions) {
      const shiver = (!c.following && !c.warmed) ? (Math.random() - 0.5) * 2.2 : 0;
      const pose = c.moving
        ? Stick.poseRun(this.t + c.phase)
        : Stick.poseIdle(this.t + c.phase);
      pose.x = c.x + shiver;
      pose.z = c.z + shiver;
      pose.y = fy - Stick.hipHeight(c.moving ? 0.12 : 0.06, 0.9);
      pose.yaw = c.yaw;
      pose.scale = 0.9;
      const color = c.warmed
        ? Palette.roleRGBA('warmthGlow', 0.95)
        : `rgba(255,255,255,${c.following ? 0.85 : 0.45})`;
      Stick.draw(ctx, pr, pose, color, 2.5);
    }
  }

  drawUI(ctx, w, h) {
    if (this.complete) return;
    if (this.t > 2.5 && this.t < 12 && this.warmed === 0) {
      haloText(ctx, 'someone else is out here. walk to them — then bring them to the fire.',
        w / 2, h * 0.8, 14, 'rgba(255,255,255,0.75)');
    }
    const anyLost = this.companions.some(c => !c.following && !c.warmed);
    const anyFollowing = this.companions.some(c => c.following);
    if (anyFollowing && !anyLost && this.t > 12) return;
    if (anyLost && this.warmed > 0) {
      haloText(ctx, 'they can’t keep your pace. go back for them.', w / 2, h * 0.8, 13, 'rgba(255,255,255,0.6)');
    }
  }
}
