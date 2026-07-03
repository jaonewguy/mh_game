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
import { floorSlab, glassWall } from './draw.js';

export class Room {
  constructor({ floorHalf, wallH, floorY }) {
    this.floorHalf = floorHalf;
    this.wallH = wallH;
    this.floorY = floorY;
    this.targetHalf = floorHalf;
    this.half = floorHalf;
    this.tremor = 0;
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
      { d: -1, a: { x: -hg + j(), y: fy, z: -hg }, b: { x: -hg + j(), y: fy, z: hg } },
      { d: -1, a: { x: -hg, y: fy, z: -hg + j() }, b: { x: hg, y: fy, z: -hg + j() } },
      { d:  1, a: { x:  hg + j(), y: fy, z: -hg }, b: { x: hg + j(), y: fy, z: hg } },
      { d:  1, a: { x: -hg, y: fy, z:  hg + j() }, b: { x: hg, y: fy, z: hg + j() } },
    ];
  }

  drawBack(ctx, pr, floorColor) {
    floorSlab(ctx, pr, this.floorHalf, this.floorY, floorColor);
    for (const w of this._walls()) {
      if (w.d < 0) glassWall(ctx, pr, w.a, w.b, this.floorY - this.wallH);
    }
  }

  drawFront(ctx, pr) {
    for (const w of this._walls()) {
      if (w.d > 0) glassWall(ctx, pr, w.a, w.b, this.floorY - this.wallH);
    }
  }
}
