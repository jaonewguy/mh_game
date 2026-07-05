/*
 * Room — the recurring stage of the game: a solid floor slab with four
 * glass walls forming a square footprint that can slam inward (the
 * prologue) or breathe back open (chapter levels).
 *
 * The wall gap animates toward `targetHalf` with a fast ease, which is
 * what makes each step feel like a slam. `tremor` adds a per-frame
 * jitter to the wall positions for the "anxious room" levels.
 *
 * Painter's ordering is split into drawBack (floor + far walls) and
 * drawFront (near walls) so the figure renders in between and shows
 * through the near glass.
 */
import { floorSlab, glassWall, floorWash, flora } from './draw.js';

export class Room {
  // open: wall sides that simply aren't there anymore — the world
  // beginning to open up. Sides: 'xpos', 'xneg', 'zpos', 'zneg'.
  constructor({ floorHalf, wallH, floorY, open = [] }) {
    this.floorHalf = floorHalf;
    this.wallH = wallH;
    this.floorY = floorY;
    this.targetHalf = floorHalf;
    this.half = floorHalf;
    this.tremor = 0;
    this.open = new Set(open);
  }

  // Scenes call this each frame with fresh canvas-derived sizes so the
  // room survives window resizes; gap progress is kept proportional.
  resize(floorHalf, wallH) {
    if (floorHalf !== this.floorHalf) {
      const k = this.half / this.floorHalf;
      const kt = this.targetHalf / this.floorHalf;
      this.floorHalf = floorHalf;
      this.half = floorHalf * k;
      this.targetHalf = floorHalf * kt;
    }
    this.wallH = wallH;
  }

  setTarget(half) {
    this.targetHalf = Math.max(0, Math.min(this.floorHalf, half));
  }

  update(dt) {
    this.half += (this.targetHalf - this.half) * Math.min(1, dt * 16);
  }

  // Clamp a ground-plane position inside the walls.
  clamp(pos, margin = 14) {
    const limit = Math.max(0, this.half - margin);
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));
  }

  _walls() {
    const hg = this.half;
    const fy = this.floorY;
    const j = () => (this.tremor > 0 ? (Math.random() - 0.5) * 6 * this.tremor : 0);
    return [
      { side: 'xneg', d: -1, a: { x: -hg + j(), y: fy, z: -hg }, b: { x: -hg + j(), y: fy, z: hg } },
      { side: 'zneg', d: -1, a: { x: -hg, y: fy, z: -hg + j() }, b: { x: hg, y: fy, z: -hg + j() } },
      { side: 'xpos', d:  1, a: { x:  hg + j(), y: fy, z: -hg }, b: { x: hg + j(), y: fy, z: hg } },
      { side: 'zpos', d:  1, a: { x: -hg, y: fy, z:  hg + j() }, b: { x: hg, y: fy, z: hg + j() } },
    ].filter(w => !this.open.has(w.side));
  }

  // opts.wash: { t, focus } — reclaimed colors drift across the floor
  drawBack(ctx, pr, opts = {}) {
    floorSlab(ctx, pr, this.floorHalf, this.floorY, opts.floorColor);
    if (opts.wash) {
      floorWash(ctx, pr, this.floorHalf, this.floorY, opts.wash.t, opts.wash.focus);
    }
    for (const w of this._walls()) {
      if (w.d < 0) glassWall(ctx, pr, w.a, w.b, this.floorY - this.wallH);
    }
    // vegetation lives inside the glass, in front of the far walls
    if (opts.wash) flora(ctx, pr, this.floorHalf, this.floorY, opts.wash.t);
  }

  drawFront(ctx, pr) {
    for (const w of this._walls()) {
      if (w.d > 0) glassWall(ctx, pr, w.a, w.b, this.floorY - this.wallH);
    }
  }
}
