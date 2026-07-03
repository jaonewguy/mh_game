/*
 * Level — the generic level runner. Reads a definition from
 * data/levels/*.json and stages it in the glass room.
 *
 * Mechanic: "breath" (Chapter 1 — calm)
 * ------------------------------------
 * A breathing ring pulses on the floor around the figure with the
 * music's swell. The player holds SPACE while the ring grows (inhale)
 * and releases while it shrinks (exhale). Each well-breathed cycle
 * calms the room — steadying its tremor, or pushing the closed-in
 * walls back open — depending on the level's `effect`. When enough
 * cycles are complete, an exit of light appears.
 *
 * States: intro -> play -> complete (walk to the exit)
 */
import { Input } from '../core/input.js';
import { Flow } from '../core/flow.js';
import { Data } from '../core/data.js';
import { projector } from '../render/iso.js';
import * as Stick from '../render/stickman.js';
import { Room } from '../render/room.js';
import { DustField } from '../render/fx.js';
import { contactShadow, text, quadPath } from '../render/draw.js';
import { Palette } from '../palette.js';
import { Sfx } from '../audio/sfx.js';
import { Music } from '../audio/music.js';

export class LevelScene {
  constructor(game, { node }) {
    this.game = game;
    this.node = node;
    const chapter = Data.chapters.chapters[node.chapter];
    this.def = Data.levels[chapter.levels[node.index]];
    this.chapterTitle = chapter.title;
    this.numeral = ['i', 'ii', 'iii', 'iv', 'v'][node.index] || `${node.index + 1}`;

    this.state = 'intro';
    this.t = 0;
    this.elapsed = 0;

    this.stick = { x: 0, z: 0, y: 0, yaw: -Math.PI / 2, moving: false, scale: 1.15 };
    this.floorY = 0;
    this.shake = 0;

    const p = this.def.params;
    this.cycleT = 0;
    this.align = 0;
    this.engaged = false;      // has the player breathed at all this cycle
    this.cycles = 0;
    this.needed = p.cyclesNeeded;
    this.tremorLevel = p.effect !== 'walls' ? (p.tremor || 0.8) : 0;
    this.hintUntilFirstGood = true;
    this.exit = null;

    this.room = new Room({
      floorHalf: this.roomHalf(), wallH: this.wallHeight(), floorY: this.floorY,
    });
    const start = (this.def.room && this.def.room.startScale) || 1;
    this.startHalf = this.room.floorHalf * start;
    this.room.half = this.startHalf;
    this.room.setTarget(this.startHalf);

    this.dust = new DustField();
    Music.setMood({ tension: this.def.mood.tension });
  }

  roomHalf()   { return Math.min(this.game.canvas.width * 0.16, 155); }
  wallHeight() { return Math.min(this.game.canvas.height * 0.34, 260); }

  // breath phase in [-1, 1]; positive = inhale (ring growing)
  breathK() {
    return Math.sin((this.cycleT / this.def.params.cycleSec) * Math.PI * 2);
  }

  update(dt) {
    this.t += dt;
    this.elapsed += dt;
    this.room.resize(this.roomHalf(), this.wallHeight());
    this.room.tremor = this.tremorLevel;
    this.shake = this.tremorLevel * 0.12;

    if (Input.pressed('restart')) { this.game.goto('level', { node: this.node }); return; }
    if (Input.pressed('back'))    { this.game.goto('menu'); return; }

    if (this.state === 'intro') {
      if (this.t > 2.2 || Input.pressed('confirm')) { this.state = 'play'; this.t = 0; }
      return;
    }

    // ---- movement (always available once playing) ----
    const { R, U } = Input.dirs();
    const k = 1 / Math.SQRT2;
    const mx = (R - U) * k, mz = (-R - U) * k;
    const s = this.stick;
    s.moving = mx !== 0 || mz !== 0;
    if (s.moving) {
      s.yaw = Math.atan2(mz, mx);
      s.x += mx * 240 * dt;
      s.z += mz * 240 * dt;
    }
    this.room.clamp(s);
    s.y = this.floorY - Stick.hipHeight(s.moving ? 0.12 : 0.06, s.scale);

    if (this.state === 'play') this.updateBreath(dt);

    if (this.state === 'complete' && this.exit) {
      const d = Math.hypot(s.x - this.exit.x, s.z - this.exit.z);
      if (d < 26) {
        Sfx.good();
        Flow.advance(this.game, this.node);
      }
    }

    this.room.update(dt);
    this.dust.update(dt);
  }

  updateBreath(dt) {
    const p = this.def.params;
    this.cycleT += dt;
    const bk = this.breathK();
    const holding = Input.down('breath');
    if (holding) this.engaged = true;

    const want = bk > 0;
    if (this.engaged) this.align += (holding === want ? dt : -dt * 1.5);
    Music.setBreath(this.engaged ? bk : 0);

    if (this.cycleT >= p.cycleSec) {
      this.cycleT -= p.cycleSec;
      if (this.engaged) {
        const quality = this.align / p.cycleSec;
        if (quality >= 0.5) this.goodCycle();
        else Sfx.miss();
      }
      this.align = 0;
      this.engaged = false;
    }
  }

  goodCycle() {
    const p = this.def.params;
    this.cycles++;
    Sfx.good();
    const progress = this.cycles / this.needed;

    if (p.effect === 'shake' || p.effect === 'both') {
      this.tremorLevel = (p.tremor || 0.8) * (1 - progress);
    }
    if (p.effect === 'walls' || p.effect === 'both') {
      // each breath pushes the walls back open — the prologue in reverse
      const target = this.startHalf + (this.room.floorHalf - this.startHalf) * progress;
      this.room.setTarget(target);
      Sfx.slam();
      const hg = target, fy = this.floorY;
      this.dust.burst( hg, fy, 0, 4, 60);
      this.dust.burst(-hg, fy, 0, 4, 60);
      this.dust.burst(0, fy,  hg, 4, 60);
      this.dust.burst(0, fy, -hg, 4, 60);
    }
    Music.setMood({ tension: this.def.mood.tension * (1 - progress) });
    this.hintUntilFirstGood = false;

    if (this.cycles >= this.needed) {
      this.state = 'complete';
      this.t = 0;
      this.tremorLevel = 0;
      Music.setBreath(0);
      this.exit = { x: 0, z: -this.room.floorHalf + 44 };
    }
  }

  // ---- draw -----------------------------------------------------------

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * 14 * this.shake,
      (Math.random() - 0.5) * 10 * this.shake
    );
    const cam = this.floorY - h * 0.62;
    const pr = projector(this.game.canvas, cam);
    const s = this.stick;

    this.room.drawBack(ctx, pr);
    if (this.exit) this.drawExit(ctx, pr);
    contactShadow(ctx, pr, s.x, s.z, this.floorY, 1);
    if (this.state === 'play') this.drawBreathRing(ctx, pr);
    this.drawStick(ctx, pr);
    this.dust.draw(ctx, pr);
    this.room.drawFront(ctx, pr);
    ctx.restore();

    this.drawUI(ctx, w, h);
  }

  drawBreathRing(ctx, pr) {
    const bk = this.breathK();
    const s = this.stick;
    const holding = Input.down('breath');
    const matching = holding === (bk > 0);
    const r = 40 + bk * 18;
    const c = pr({ x: s.x, y: this.floorY, z: s.z });
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = this.engaged && matching
      ? 'rgba(255,255,255,0.85)'
      : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = this.engaged && matching ? 2.5 : 1.5;
    ctx.stroke();
  }

  drawExit(ctx, pr) {
    const pulse = 0.5 + Math.sin(this.elapsed * 3) * 0.25;
    const e = this.exit, size = 16 + pulse * 4;
    quadPath(ctx, pr, [
      { x: e.x - size, y: this.floorY - 1, z: e.z - size },
      { x: e.x + size, y: this.floorY - 1, z: e.z - size },
      { x: e.x + size, y: this.floorY - 1, z: e.z + size },
      { x: e.x - size, y: this.floorY - 1, z: e.z + size },
    ]);
    ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // a soft pillar of light
    const top = pr({ x: e.x, y: this.floorY - 130, z: e.z });
    const base = pr({ x: e.x, y: this.floorY, z: e.z });
    const grad = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
    grad.addColorStop(0, 'rgba(255,255,255,0.30)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(base.x - 12, top.y, 24, base.y - top.y);
  }

  drawStick(ctx, pr) {
    const s = this.stick;
    let pose;
    const holding = Input.down('breath');
    if (this.state !== 'intro' && holding) {
      pose = Stick.poseBreathe(Math.max(0, this.breathK()));
    } else if (s.moving) {
      pose = Stick.poseRun(this.elapsed);
    } else {
      pose = Stick.poseIdle(this.elapsed);
    }
    pose.x = s.x; pose.y = s.y; pose.z = s.z;
    pose.yaw = s.yaw; pose.scale = s.scale;
    Stick.draw(ctx, pr, pose, Palette.get('figure'), 3);
  }

  drawUI(ctx, w, h) {
    if (this.state === 'intro') {
      const a = Math.min(this.t / 0.6, 1);
      text(ctx, this.chapterTitle, w / 2, h * 0.18, 15, Palette.get('textFaint'), a, true);
      text(ctx, `${this.numeral}. ${this.def.title}`, w / 2, h * 0.18 + 34, 26, Palette.get('text'), a, true);
      return;
    }

    // cycle progress dots
    for (let i = 0; i < this.needed; i++) {
      ctx.beginPath();
      ctx.arc(w / 2 + (i - (this.needed - 1) / 2) * 18, 30, 4, 0, Math.PI * 2);
      if (i < this.cycles) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (this.state === 'play' && this.hintUntilFirstGood && this.def.hint) {
      text(ctx, this.def.hint, w / 2, h * 0.88, 14, Palette.get('textFaint'));
    }
    if (this.state === 'complete') {
      const a = Math.min(this.t / 0.8, 1);
      text(ctx, 'still.', w / 2, h * 0.16, 20, Palette.get('text'), a);
      text(ctx, 'walk to the light', w / 2, h * 0.88, 13, Palette.get('textFaint'), a);
    }
  }
}
