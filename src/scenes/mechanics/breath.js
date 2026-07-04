/*
 * Breath mechanic (Chapter 1 — calm).
 *
 * A ring pulses on the floor around the figure. The player holds
 * SPACE while it grows (inhale) and releases while it shrinks
 * (exhale). Well-breathed cycles calm the room: steadying its tremor
 * and/or pushing closed-in walls back open, per the level's `effect`.
 *
 * First-time tutorial (level JSON `tutorial: true`) walks through it:
 *   watch    — the figure demonstrates a full breath on its own
 *   hold     — the ring literally waits until the player holds SPACE
 *   release  — ...and waits again until they let go
 *   together — one guided cycle with live captions
 *   alone    — the real cycles begin counting
 */
import { Input } from '../../core/input.js';
import * as Stick from '../../render/stickman.js';
import { text } from '../../render/draw.js';
import { Palette } from '../../palette.js';
import { Sfx } from '../../audio/sfx.js';
import { Music } from '../../audio/music.js';

export class BreathMechanic {
  constructor(scene, def) {
    this.scene = scene;
    this.p = def.params;
    this.needed = this.p.cyclesNeeded;
    this.cycles = 0;
    this.cycleT = 0;
    this.align = 0;
    this.engaged = false;
    this.complete = false;
    this.verdict = null; // { msg, t }
    this.state = def.tutorial ? 'watch' : 'alone';
    this.stateT = 0;
    this.prevK = 0;

    scene.tremorLevel = this.p.effect !== 'walls' ? (this.p.tremor || 0.8) : 0;
    this.baseTremor = scene.tremorLevel;
  }

  breathK() {
    return Math.sin((this.cycleT / this.p.cycleSec) * Math.PI * 2);
  }

  progress() {
    return { done: this.cycles, total: this.needed };
  }

  update(dt) {
    this.stateT += dt;
    if (this.verdict) {
      this.verdict.t += dt;
      if (this.verdict.t > 1.6) this.verdict = null;
    }

    const half = this.p.cycleSec / 2;
    const holding = Input.down('breath');

    switch (this.state) {
      case 'watch': {
        this.cycleT += dt;
        Music.setBreath(this.breathK());
        if (this.cycleT >= this.p.cycleSec) {
          // start just past the boundary so the phase reads clearly
          // as "inhale" while the ring waits
          this.cycleT = 0.06;
          this.state = 'hold';
          this.stateT = 0;
          Sfx.ui();
        }
        break;
      }

      case 'hold': {
        // The ring waits for the player's breath.
        if (holding) this.cycleT = Math.min(this.cycleT + dt, half);
        Music.setBreath(holding ? this.breathK() : 0);
        if (this.cycleT >= half) {
          this.cycleT = half + 0.06; // clearly into the exhale
          this.state = 'release';
          this.stateT = 0;
          Sfx.ui();
        }
        break;
      }

      case 'release': {
        if (!holding) this.cycleT += dt;
        Music.setBreath(this.breathK());
        if (this.cycleT >= this.p.cycleSec) {
          this.cycleT = 0;
          this.state = 'together';
          this.stateT = 0;
          Sfx.good();
        }
        break;
      }

      case 'together': {
        this.cycleT += dt;
        Music.setBreath(this.breathK());
        if (this.cycleT >= this.p.cycleSec) {
          this.cycleT = 0;
          this.state = 'alone';
          this.stateT = 0;
        }
        break;
      }

      case 'alone': {
        this.cycleT += dt;
        const k = this.breathK();
        if (holding) this.engaged = true;
        const want = k > 0;
        if (this.engaged) this.align += (holding === want ? dt : -dt * 1.5);
        Music.setBreath(this.engaged ? k : 0);

        if (this.cycleT >= this.p.cycleSec) {
          this.cycleT -= this.p.cycleSec;
          if (this.engaged) {
            const quality = this.align / this.p.cycleSec;
            if (quality >= 0.5) this.goodCycle();
            else {
              Sfx.miss();
              this.verdict = { msg: 'stay with the ring — the whole breath', t: 0 };
            }
          }
          this.align = 0;
          this.engaged = false;
        }
        break;
      }
    }

    // A soft tone marks every turn of the breath — a rising note when
    // it's time to hold, a falling one when it's time to let go.
    const k = this.breathK();
    if (this.prevK <= 0 && k > 0) Sfx.cueIn();
    if (this.prevK >= 0 && k < 0) Sfx.cueOut();
    this.prevK = k;
  }

  goodCycle() {
    const scene = this.scene, p = this.p;
    this.cycles++;
    Sfx.good();
    this.verdict = { msg: 'good', t: 0 };
    const progress = this.cycles / this.needed;

    if (p.effect === 'shake' || p.effect === 'both') {
      scene.tremorLevel = this.baseTremor * (1 - progress);
    }
    if (p.effect === 'walls' || p.effect === 'both') {
      // each breath pushes the walls back open — the prologue in reverse
      const target = scene.startHalf + (scene.room.floorHalf - scene.startHalf) * progress;
      scene.room.setTarget(target);
      Sfx.slam();
      const fy = scene.floorY;
      scene.dust.burst( target, fy, 0, 4, 60);
      scene.dust.burst(-target, fy, 0, 4, 60);
      scene.dust.burst(0, fy,  target, 4, 60);
      scene.dust.burst(0, fy, -target, 4, 60);
    }
    Music.setMood({ tension: scene.def.mood.tension * (1 - progress) });

    if (this.cycles >= this.needed) {
      this.complete = true;
      scene.tremorLevel = 0;
      Music.setBreath(0);
    }
  }

  // The figure breathes with the ring — visibly when participating,
  // subtly otherwise. Returning null lets the runner use idle/run.
  figurePose() {
    if (this.scene.stick.moving) return null;
    const k = this.breathK();
    if (this.state === 'watch') return Stick.poseBreathe(k);
    const holding = Input.down('breath');
    if (holding || this.state === 'hold') return Stick.poseBreathe(Math.max(0, k));
    return Stick.poseBreathe(k * 0.3);
  }

  drawWorld(ctx, pr) {
    const s = this.scene.stick;
    const k = this.breathK();
    const holding = Input.down('breath');
    const matching = this.state === 'alone'
      ? (this.engaged && holding === (k > 0))
      : (this.state === 'watch' || holding === (k > 0));

    const r = 44 + k * 22;
    const c = pr({ x: s.x, y: this.scene.floorY, z: s.z });

    // waiting states pulse to draw the eye
    const waiting = (this.state === 'hold' && !holding) || (this.state === 'release' && holding);
    const pulse = waiting ? 0.25 + Math.abs(Math.sin(this.stateT * 4)) * 0.5 : 0;

    // soft fill makes the ring read as a breathing body of air
    // (white while calm is still locked; calm's green ever after)
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = Palette.roleRGBA('breathRing', 0.05 + (matching ? 0.08 : 0) + pulse * 0.06);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = Palette.roleRGBA('breathRing', matching ? 0.9 : 0.4 + pulse * 0.5);
    ctx.lineWidth = matching ? 3 : 2;
    ctx.stroke();
    // an outer echo while matching — breathing "resonates"
    if (matching && this.state !== 'watch') {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r + 10, (r + 10) * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = Palette.roleRGBA('breathRing', 0.18);
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // The word itself, floating by the figure: "hold" on the inhale,
    // "let go" on the exhale. Shown until breathing is clearly learned
    // (two good cycles this level), and again whenever out of sync.
    const learning = this.cycles < 2;
    const offSync = this.engaged && holding !== (k > 0);
    if (this.state !== 'watch' && (learning || offSync)) {
      const head = pr({ x: s.x, y: s.y - 62, z: s.z });
      const word = k > 0 ? 'hold' : 'let go';
      ctx.font = '300 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(word, head.x, head.y);
      ctx.fillStyle = `rgba(255,255,255,${matching ? 0.95 : 0.6})`;
      ctx.fillText(word, head.x, head.y);
    }
  }

  drawUI(ctx, w, h) {
    const k = this.breathK();
    const pulse = 0.6 + Math.abs(Math.sin(this.stateT * 3)) * 0.4;

    switch (this.state) {
      case 'watch':
        text(ctx, 'this is a breath.', w / 2, h * 0.84, 20, Palette.get('text'));
        text(ctx, 'the ring is your guide — in as it grows, out as it shrinks', w / 2, h * 0.84 + 26, 13, Palette.get('textFaint'));
        break;
      case 'hold':
        text(ctx, 'HOLD SPACE', w / 2, h * 0.84, 24, `rgba(255,255,255,${pulse})`, 1, true);
        text(ctx, 'breathe in while the ring grows — it waits for you', w / 2, h * 0.84 + 26, 13, Palette.get('textFaint'));
        break;
      case 'release':
        text(ctx, 'NOW LET GO', w / 2, h * 0.84, 24, `rgba(255,255,255,${pulse})`, 1, true);
        text(ctx, 'breathe out while the ring shrinks', w / 2, h * 0.84 + 26, 13, Palette.get('textFaint'));
        break;
      case 'together': {
        const msg = k > 0 ? 'hold…' : 'let go…';
        const holding = Input.down('breath');
        const a = holding === (k > 0) ? 0.9 : 0.4;
        text(ctx, msg, w / 2, h * 0.84, 20, `rgba(255,255,255,${a})`);
        break;
      }
      case 'alone':
        if (this.scene.def.tutorial && this.stateT < 3 && this.cycles === 0) {
          text(ctx, 'again — on your own.', w / 2, h * 0.84, 18, Palette.get('textFaint'));
        }
        break;
    }

    if (this.verdict) {
      const a = Math.min(1, 4 * (1.6 - this.verdict.t));
      text(ctx, this.verdict.msg, w / 2, 58, 15,
        this.verdict.msg === 'good' ? Palette.get('text') : Palette.get('textFaint'), Math.max(0, a));
    }
  }
}
