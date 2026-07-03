/*
 * Prologue — "The Fall"
 *
 * A stickman falls through black nothing, lands on the solid white
 * floor of a glass cube, and every second the four walls slam inward
 * until there is nowhere left to stand. Fade to black.
 *
 * Phases: falling -> landing -> settle -> walls -> end
 */
import { Input } from '../core/input.js';
import { Flow } from '../core/flow.js';
import { projector } from '../render/iso.js';
import * as Stick from '../render/stickman.js';
import { Room } from '../render/room.js';
import { DustField, SpeckColumn } from '../render/fx.js';
import { contactShadow, text } from '../render/draw.js';
import { Palette } from '../palette.js';
import { Sfx } from '../audio/sfx.js';
import { Music } from '../audio/music.js';

const TOTAL_SLAMS = 8;
const END_HALF = 30;

export class PrologueScene {
  constructor(game) {
    this.game = game;
    const h = game.canvas.height;

    this.phase = 'falling';
    this.t = 0;
    this.elapsed = 0;
    this.fallDist = Math.max(h * 2.2, 1200);

    this.stick = {
      x: 0, z: 0, y: 0, vy: 0,
      yaw: -Math.PI / 2, moving: false, scale: 1.15,
    };

    this.cam = -h * 0.42;
    this.shake = 0;
    this.slams = 0;
    this.slamTimer = 0;
    this.crouchK = 0;
    this.endFade = 0;
    this.endHold = 0;

    this.room = new Room({
      floorHalf: this.cubeHalf(), wallH: this.wallHeight(), floorY: this.fallDist,
    });
    this.dust = new DustField();
    this.specks = new SpeckColumn(48, 700, this.fallDist * 1.1);

    Music.setMood({ tension: 0.15 });
  }

  cubeHalf()   { return Math.min(this.game.canvas.width * 0.16, 155); }
  wallHeight() { return Math.min(this.game.canvas.height * 0.34, 260); }
  camMax()     { return this.fallDist - this.game.canvas.height * 0.62; }

  update(dt) {
    const h = this.game.canvas.height;
    this.t += dt;
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.room.resize(this.cubeHalf(), this.wallHeight());

    const s = this.stick;
    const { R, U } = Input.dirs();
    const k = 1 / Math.SQRT2;
    let mx = (R - U) * k, mz = (-R - U) * k;

    if (Input.pressed('restart') && this.phase !== 'end') {
      this.game.goto('prologue');
      return;
    }

    switch (this.phase) {
      case 'falling': {
        s.vy = Math.min(s.vy + 1500 * dt, 950);
        s.y += s.vy * dt;
        s.x += mx * 120 * dt;
        s.z += mz * 120 * dt;
        s.yaw = -Math.PI / 2 + Math.sin(this.elapsed * 0.9) * 0.6;
        const standH = Stick.hipHeight(0.1, s.scale);
        if (s.y >= this.fallDist - standH) {
          s.y = this.fallDist - standH;
          s.vy = 0;
          s.yaw = -Math.PI / 2;
          this.phase = 'landing';
          this.t = 0;
          this.shake = 1;
          Sfx.land();
          Music.setMood({ tension: 0.25 });
          this.dust.burst(s.x, this.fallDist, s.z, 22, 170);
        }
        break;
      }

      case 'landing': {
        this.crouchK = this.t < 0.12
          ? this.t / 0.12
          : Math.max(0, 1 - (this.t - 0.12) / 0.5);
        s.y = this.fallDist - Stick.hipHeight(this.crouchK, s.scale);
        if (this.t > 0.62) { this.phase = 'settle'; this.t = 0; }
        break;
      }

      case 'settle': {
        this.walk(dt, mx, mz);
        if (this.t > 1.1) { this.phase = 'walls'; this.t = 0; this.slamTimer = 0; }
        break;
      }

      case 'walls': {
        this.walk(dt, mx, mz);
        this.slamTimer += dt;
        if (this.slamTimer >= 1.0) {
          this.slamTimer -= 1.0;
          this.slams++;
          this.shake = 0.6;
          Sfx.slam();
          Music.setMood({ tension: 0.25 + 0.65 * (this.slams / TOTAL_SLAMS) });
          const frac = this.slams / TOTAL_SLAMS;
          const hg = this.room.floorHalf * (1 - frac) + END_HALF * frac;
          this.room.setTarget(hg);
          const fy = this.fallDist;
          this.dust.burst( hg, fy, 0, 4, 60);
          this.dust.burst(-hg, fy, 0, 4, 60);
          this.dust.burst(0, fy,  hg, 4, 60);
          this.dust.burst(0, fy, -hg, 4, 60);
          if (this.slams >= TOTAL_SLAMS) { this.phase = 'end'; this.t = 0; }
        }
        break;
      }

      case 'end': {
        this.endFade = Math.min(1, Math.max(0, (this.t - 0.9) / 1.6));
        if (this.endFade >= 1) {
          this.endHold += dt;
          Music.setMood({ tension: 0.1 });
          if (this.endHold > 2.6) {
            Flow.advance(this.game, { type: 'prologue' });
          }
        }
        break;
      }
    }

    this.cam = Math.min(s.y - h * 0.42, this.camMax());
    this.room.update(dt);
    if (this.phase !== 'falling') {
      this.room.clamp(s);
      this.specks.fade(dt);
    }
    this.dust.update(dt);
  }

  walk(dt, mx, mz) {
    const s = this.stick;
    s.moving = mx !== 0 || mz !== 0;
    if (s.moving) {
      this.hasMoved = true;
      s.yaw = Math.atan2(mz, mx);
      s.x += mx * 240 * dt;
      s.z += mz * 240 * dt;
    }
    s.y = this.fallDist - Stick.hipHeight(s.moving ? 0.12 : 0.06, s.scale);
  }

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * 14 * this.shake,
      (Math.random() - 0.5) * 10 * this.shake
    );
    const pr = projector(this.game.canvas, this.cam);
    const s = this.stick;

    this.specks.draw(ctx, pr, s.vy);
    this.room.drawBack(ctx, pr);
    const nearness = Math.max(0.12, 1 - Math.max(0, this.fallDist - s.y) / 1100);
    contactShadow(ctx, pr, s.x, s.z, this.fallDist, nearness);
    this.drawStick(ctx, pr);
    this.dust.draw(ctx, pr);
    this.room.drawFront(ctx, pr);
    ctx.restore();

    this.drawTitle(ctx, w, h);
    // a nudge for players who don't realize they can move
    if (!this.hasMoved && (this.phase === 'settle' || this.phase === 'walls') && this.elapsed > 4.5) {
      const a = 0.2 + Math.abs(Math.sin(this.elapsed * 2)) * 0.25;
      text(ctx, 'arrows — move', w / 2, h * 0.88, 13, `rgba(255,255,255,${a})`);
    }
    this.drawEnd(ctx, w, h);
  }

  drawStick(ctx, pr) {
    const s = this.stick;
    let pose;
    switch (this.phase) {
      case 'falling': pose = Stick.poseFall(this.elapsed); break;
      case 'landing': pose = Stick.poseCrouch(this.crouchK); break;
      case 'end':     pose = Stick.poseBrace(0.35); break;
      default:
        if (this.room.half < 70) pose = Stick.poseBrace(0.25);
        else if (s.moving) pose = Stick.poseRun(this.elapsed);
        else pose = Stick.poseIdle(this.elapsed);
    }
    pose.x = s.x; pose.y = s.y; pose.z = s.z;
    pose.yaw = s.yaw; pose.scale = s.scale;
    Stick.draw(ctx, pr, pose, Palette.get('figure'), 3);
  }

  drawTitle(ctx, w, h) {
    if (this.phase !== 'falling') return;
    const a = Math.min(this.t / 0.8, 1) * Math.max(0, Math.min(1, (3.0 - this.t) / 0.8));
    if (a <= 0) return;
    text(ctx, 'PROLOGUE', w / 2, h * 0.2, 28, Palette.get('text'), a, true);
    text(ctx, 'the fall', w / 2, h * 0.2 + 30, 16, Palette.get('textFaint'), a, true);
  }

  drawEnd(ctx, w, h) {
    if (this.endFade <= 0) return;
    ctx.fillStyle = `rgba(0,0,0,${this.endFade})`;
    ctx.fillRect(0, 0, w, h);
    const a = Math.min(1, this.endHold / 0.8);
    if (a <= 0) return;
    text(ctx, 'the walls closed in.', w / 2, h * 0.46, 24, Palette.get('text'), a);
  }
}
