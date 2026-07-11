/*
 * Epilogue — "draw the morning"
 *
 * The Okami moment. After the last color returns, a blank canvas
 * appears, and the game asks for one thing back: draw the morning
 * you're waiting for, with the six colors you earned. Click and drag
 * to paint; 1–6 pick colors; C clears; Enter when it's finished.
 *
 * Then the finale: the drawing lifts into the sky over the healed,
 * wall-less world — the player's own art, risen as the sun. The
 * drawing persists, so the morning belongs to this player alone.
 *
 * Phases: intro -> draw -> rise
 */
import { Input } from '../core/input.js';
import { Flow } from '../core/flow.js';
import { projector } from '../render/iso.js';
import { floorSlab, floorWash, flora, text, haloText } from '../render/draw.js';
import * as Stick from '../render/stickman.js';
import { Palette } from '../palette.js';
import { Music } from '../audio/music.js';
import { Sfx } from '../audio/sfx.js';

const DRAW_KEY = 'mh_game.drawing';

export class EpilogueScene {
  constructor(game) {
    this.game = game;
    this.hideHUD = true;
    this.phase = 'intro';
    this.t = 0;
    this.colorIdx = 0;
    this.drawing = false;

    this.strokes = [];
    try {
      const saved = JSON.parse(localStorage.getItem(DRAW_KEY) || '[]');
      if (Array.isArray(saved)) this.strokes = saved;
    } catch (e) { /* fresh canvas */ }

    Music.setMood({ tension: 0.05 });
    Music.setBreath(0);

    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = () => { this.drawing = false; this.persist(); };
    this._key = (e) => this.onKey(e);
    window.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('keydown', this._key);
  }

  destroy() {
    window.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('keydown', this._key);
  }

  // the canvas-on-the-wall, in screen coordinates
  rect() {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    const rw = Math.min(w * 0.64, 760), rh = Math.min(h * 0.5, 420);
    return { x: (w - rw) / 2, y: h * 0.14, w: rw, h: rh };
  }

  chipPositions() {
    const w = this.game.canvas.width;
    const r = this.rect();
    const slots = Palette.slots;
    const x0 = w / 2 - ((slots.length - 1) * 40) / 2;
    return slots.map((s, i) => ({ x: x0 + i * 40, y: r.y + r.h + 46, slot: s }));
  }

  onDown(e) {
    if (this.phase !== 'draw') return;
    // palette chips
    for (let i = 0; i < this.chipPositions().length; i++) {
      const c = this.chipPositions()[i];
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 16) {
        this.colorIdx = i;
        Sfx.ui();
        return;
      }
    }
    const r = this.rect();
    if (e.clientX < r.x || e.clientX > r.x + r.w || e.clientY < r.y || e.clientY > r.y + r.h) return;
    this.drawing = true;
    this.strokes.push({
      c: Palette.slots[this.colorIdx].color,
      pts: [[(e.clientX - r.x) / r.w, (e.clientY - r.y) / r.h]],
    });
  }

  onMove(e) {
    if (!this.drawing || this.phase !== 'draw') return;
    const r = this.rect();
    const nx = Math.max(0, Math.min(1, (e.clientX - r.x) / r.w));
    const ny = Math.max(0, Math.min(1, (e.clientY - r.y) / r.h));
    const stroke = this.strokes[this.strokes.length - 1];
    const last = stroke.pts[stroke.pts.length - 1];
    if (Math.hypot((nx - last[0]) * r.w, (ny - last[1]) * r.h) > 4) {
      stroke.pts.push([nx, ny]);
    }
  }

  onKey(e) {
    if (this.phase !== 'draw') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= Palette.slots.length) { this.colorIdx = n - 1; Sfx.ui(); }
    if (e.key === 'c' || e.key === 'C') { this.strokes = []; this.persist(); Sfx.ui(); }
  }

  persist() {
    try {
      // cap stored points so the save stays small
      const trimmed = this.strokes.slice(-120).map(s => ({ c: s.c, pts: s.pts.slice(0, 400) }));
      localStorage.setItem(DRAW_KEY, JSON.stringify(trimmed));
    } catch (e) { /* the morning just won't persist */ }
  }

  update(dt) {
    this.t += dt;

    if (this.phase === 'intro') {
      if (this.t > 1 && (Input.pressed('confirm') || Input.pressed('breath'))) {
        this.phase = 'draw';
        this.t = 0;
        Sfx.ui();
      }
      return;
    }

    if (this.phase === 'draw') {
      if (Input.pressed('confirm') && this.strokes.length > 0) {
        this.persist();
        this.phase = 'rise';
        this.t = 0;
        this.drawing = false;
        Sfx.good();
      }
      return;
    }

    // rise
    Music.setBreath(Math.sin(this.t * 0.8) * 0.4); // the world breathes easy
    if (this.t > 8 && (Input.pressed('confirm') || Input.pressed('breath'))) {
      Music.setBreath(0);
      Flow.advance(this.game, { type: 'epilogue' });
    }
  }

  // ---- draw -----------------------------------------------------------

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    if (this.phase === 'intro') {
      const a = Math.min(1, this.t / 1.2);
      text(ctx, 'you kept every color.', w / 2, h * 0.42, 22, Palette.get('text'), a);
      text(ctx, 'there is one thing left to make.', w / 2, h * 0.42 + 34, 15, Palette.get('textFaint'), a);
      if (this.t > 1) {
        const pulse = 0.3 + Math.abs(Math.sin(this.t * 2)) * 0.25;
        text(ctx, 'space', w / 2, h * 0.8, 12, `rgba(255,255,255,${pulse})`);
      }
      return;
    }

    if (this.phase === 'draw') {
      this.drawCanvasPhase(ctx, w, h);
      return;
    }

    this.drawRise(ctx, w, h);
  }

  strokesInto(ctx, rx, ry, rw, rh, lw) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of this.strokes) {
      if (s.pts.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(rx + s.pts[0][0] * rw, ry + s.pts[0][1] * rh);
      for (let i = 1; i < s.pts.length; i++) {
        ctx.lineTo(rx + s.pts[i][0] * rw, ry + s.pts[i][1] * rh);
      }
      if (s.pts.length === 1) ctx.lineTo(rx + s.pts[0][0] * rw + 0.1, ry + s.pts[0][1] * rh);
      ctx.strokeStyle = s.c;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  drawCanvasPhase(ctx, w, h) {
    const r = this.rect();
    text(ctx, 'draw the morning you are waiting for', w / 2, r.y - 26, 18, Palette.get('text'));

    // the blank wall
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    this.strokesInto(ctx, r.x, r.y, r.w, r.h, 5);

    // palette chips
    for (let i = 0; i < this.chipPositions().length; i++) {
      const c = this.chipPositions()[i];
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = c.slot.color;
      ctx.fill();
      if (i === this.colorIdx) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    text(ctx, 'click and drag to paint · 1–6 pick colors · c starts over', w / 2, h * 0.92, 13, Palette.get('textFaint'));
    if (this.strokes.length > 0) {
      const pulse = 0.4 + Math.abs(Math.sin(this.t * 2)) * 0.3;
      text(ctx, 'enter — it is finished', w / 2, h * 0.92 + 24, 13, `rgba(255,255,255,${pulse})`);
    }
  }

  drawRise(ctx, w, h) {
    const k = Math.min(1, this.t / 6); // the slow lift

    // stars over the healed world
    let seed = 33;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const sx = rand() * w, sy = rand() * h * 0.5;
      const tw = 0.25 + Math.sin(this.t * 1.5 + i) * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${tw * (0.4 + k * 0.6)})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // the world, whole: open floor, no walls anywhere
    const cam = projector(this.game.canvas, -h * 0.76);
    const half = Math.min(w * 0.24, 300);
    // dawn light across the whole horizon
    const hg = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.2);
    hg.addColorStop(0, Palette.colorRGBA('joy', 0.10 + k * 0.08));
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, h * 0.2, w, h * 0.4);

    floorSlab(ctx, cam, half, 0);
    floorWash(ctx, cam, half, 0, this.t, { x: 0, z: 0 });
    flora(ctx, cam, half, 0, this.t);

    const pose = Stick.poseBreathe(0.3 + Math.max(0, Math.sin(this.t * 0.8)) * 0.4);
    pose.x = 0; pose.z = 0;
    pose.y = -Stick.hipHeight(0.06, 1.15);
    pose.yaw = -Math.PI / 2;
    pose.scale = 1.15;
    Stick.draw(ctx, cam, pose, Palette.get('figure'), 3);

    // the morning they drew, rising
    const r = this.rect();
    const dw = Math.min(w * 0.42, 500);
    const dh = dw * (r.h / r.w);
    const dx = (w - dw) / 2;
    const dy = (h * 0.46) - (h * 0.34) * this.easeOut(k) + Math.sin(this.t * 0.7) * 4;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.6);
    // a soft halo behind it, like sunrise
    const halo = ctx.createRadialGradient(dx + dw / 2, dy + dh / 2, 10, dx + dw / 2, dy + dh / 2, dw * 0.75);
    halo.addColorStop(0, Palette.colorRGBA('joy', 0.16));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(dx - dw * 0.4, dy - dw * 0.4, dw * 1.8, dw * 1.8);
    this.strokesInto(ctx, dx, dy, dw, dh, 4);
    ctx.restore();

    if (this.t > 7) {
      const a = Math.min(1, (this.t - 7) / 1.5);
      haloText(ctx, 'the morning you drew.', w / 2, h * 0.86, 18, Palette.get('text'), a);
    }
    if (this.t > 9.5) {
      const pulse = 0.3 + Math.abs(Math.sin(this.t * 2)) * 0.25;
      text(ctx, 'space', w / 2, h * 0.93, 12, `rgba(255,255,255,${pulse})`);
    }
  }

  easeOut(k) {
    return 1 - Math.pow(1 - k, 3);
  }
}
