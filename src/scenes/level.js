/*
 * Level — the generic level runner. Reads a definition from
 * data/levels/*.json, stages it in the glass room, and delegates the
 * challenge itself to a mechanic module (mechanics/*.js):
 *
 *   breath — Chapter 1, calm  (breathe with the ring)
 *   seek   — Chapter 2, hope  (find the lights in the dark)
 *
 * The runner owns: intro card, movement, the room, the darkness mask
 * (for mechanics that set `darkness`), exit spawning and the walk to
 * it, progress dots, restart/back.
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
import { BreathMechanic } from './mechanics/breath.js';
import { SeekMechanic } from './mechanics/seek.js';

const MECHANICS = { breath: BreathMechanic, seek: SeekMechanic };

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
    this.tremorLevel = 0;
    this.exit = null;
    this.darkFade = 1; // darkness strength while a dark mechanic runs

    this.room = new Room({
      floorHalf: this.roomHalf(), wallH: this.wallHeight(), floorY: this.floorY,
    });
    const start = (this.def.room && this.def.room.startScale) || 1;
    this.startHalf = this.room.floorHalf * start;
    this.room.half = this.startHalf;
    this.room.setTarget(this.startHalf);

    this.dust = new DustField();
    Music.setMood({ tension: this.def.mood.tension });

    this.mech = new MECHANICS[this.def.mechanic](this, this.def);
  }

  roomHalf()   { return Math.min(this.game.canvas.width * 0.16, 155); }
  wallHeight() { return Math.min(this.game.canvas.height * 0.34, 260); }

  // kept for tests/tools: the breath phase if this level breathes
  breathK() { return this.mech.breathK ? this.mech.breathK() : 0; }

  update(dt) {
    this.t += dt;
    this.elapsed += dt;
    this.room.resize(this.roomHalf(), this.wallHeight());
    this.room.tremor = this.tremorLevel;
    this.shake = this.tremorLevel * 0.12;

    if (Input.pressed('restart')) { this.game.goto('level', { node: this.node }); return; }
    if (Input.pressed('back'))    { this.game.goto('menu'); return; }

    if (this.state === 'intro') {
      if (this.t > 2.4 || Input.pressed('confirm')) { this.state = 'play'; this.t = 0; }
      return;
    }

    // ---- movement ----
    const { R, U } = Input.dirs();
    const k = 1 / Math.SQRT2;
    let mx = (R - U) * k, mz = (-R - U) * k;
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1) { mx /= mLen; mz /= mLen; }
    const s = this.stick;
    s.moving = mx !== 0 || mz !== 0;
    if (s.moving) {
      s.yaw = Math.atan2(mz, mx);
      s.x += mx * 240 * dt;
      s.z += mz * 240 * dt;
    }
    this.room.clamp(s);
    s.y = this.floorY - Stick.hipHeight(s.moving ? 0.12 : 0.06, s.scale);

    if (this.state === 'play') {
      this.mech.update(dt);
      if (this.mech.complete) {
        this.state = 'complete';
        this.t = 0;
        this.exit = { x: 0, z: -this.room.floorHalf + 44 };
      }
    }

    if (this.state === 'complete') {
      this.mech.update(dt); // fireflies etc. keep living
      if (this.mech.darkness === 'lifting') {
        this.darkFade = Math.max(0, this.darkFade - dt / 1.5);
      }
      const d = Math.hypot(s.x - this.exit.x, s.z - this.exit.z);
      if (d < 26) {
        Sfx.good();
        Flow.advance(this.game, this.node);
      }
    }

    this.room.update(dt);
    this.dust.update(dt);
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
    contactShadow(ctx, pr, s.x, s.z, this.floorY, 1);
    if (this.state !== 'intro' && this.mech.drawWorld) this.mech.drawWorld(ctx, pr);
    this.drawStick(ctx, pr);
    this.dust.draw(ctx, pr);
    this.room.drawFront(ctx, pr);

    // darkness, and the lights that live above it
    if (this.mech.darkness && this.darkFade > 0.01) this.applyDarkness(ctx, pr);
    if (this.mech.drawLights && this.state !== 'intro') this.mech.drawLights(ctx, pr);
    if (this.exit) this.drawExit(ctx, pr);
    ctx.restore();

    this.drawUI(ctx, w, h);
  }

  // Black veil over the world with a soft pool of light around the
  // figure (screen-space radial hole, punched via destination-out).
  applyDarkness(ctx, pr) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    if (!this._dark || this._dark.width !== w || this._dark.height !== h) {
      this._dark = document.createElement('canvas');
      this._dark.width = w;
      this._dark.height = h;
    }
    const d = this._dark.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, w, h);
    d.fillStyle = `rgba(0,0,0,${0.93 * this.darkFade})`;
    d.fillRect(0, 0, w, h);

    const s = this.stick;
    const c = pr({ x: s.x, y: s.y - 20, z: s.z });
    const r = this.mech.glow || 140;
    const grad = d.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    d.globalCompositeOperation = 'destination-out';
    d.fillStyle = grad;
    d.fillRect(c.x - r, c.y - r, r * 2, r * 2);

    ctx.drawImage(this._dark, 0, 0);
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
    let pose = null;
    if (this.state !== 'intro' && this.mech.figurePose) pose = this.mech.figurePose();
    if (!pose) pose = s.moving ? Stick.poseRun(this.elapsed) : Stick.poseIdle(this.elapsed);
    pose.x = s.x; pose.y = s.y; pose.z = s.z;
    pose.yaw = s.yaw; pose.scale = s.scale;
    Stick.draw(ctx, pr, pose, Palette.get('figure'), 3);
  }

  drawUI(ctx, w, h) {
    if (this.state === 'intro') {
      const a = Math.min(this.t / 0.6, 1);
      text(ctx, this.chapterTitle, w / 2, h * 0.18, 15, Palette.get('textFaint'), a, true);
      text(ctx, `${this.numeral}. ${this.def.title}`, w / 2, h * 0.18 + 34, 26, Palette.get('text'), a, true);
      if (this.def.intro) {
        text(ctx, this.def.intro, w / 2, h * 0.18 + 66, 14, Palette.get('textFaint'), a);
      }
      return;
    }

    // progress dots
    const { done, total } = this.mech.progress();
    for (let i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(w / 2 + (i - (total - 1) / 2) * 18, 30, 4, 0, Math.PI * 2);
      if (i < done) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (this.state === 'play' && this.mech.drawUI) this.mech.drawUI(ctx, w, h);
    if (this.state === 'complete') {
      const a = Math.min(this.t / 0.8, 1);
      text(ctx, this.def.mechanic === 'seek' ? 'lighter.' : 'still.', w / 2, h * 0.16, 20, Palette.get('text'), a);
      text(ctx, 'walk to the light', w / 2, h * 0.88, 13, Palette.get('textFaint'), a);
    }
  }
}
