/*
 * Draw — shared 2D/isometric drawing primitives.
 *
 * Everything here takes a projector `pr` (from iso.js) where relevant,
 * so scenes never do projection math themselves. This file is the thin
 * layer that would be replaced wholesale in a future Three.js port.
 */
import { Palette } from '../palette.js';

export function quadPath(ctx, pr, corners) {
  const pts = corners.map(pr);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// A translucent glass pane standing on the floor between ground points
// a and b. Dual glaze so it reads over both black void and white floor.
export function glassWall(ctx, pr, a, b, top) {
  quadPath(ctx, pr, [a, b, { x: b.x, y: top, z: b.z }, { x: a.x, y: top, z: a.z }]);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fill();
  ctx.fillStyle = Palette.get('wall');
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = Palette.get('wallEdge');
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Solid floor slab centered on origin: white top, shaded side faces.
export function floorSlab(ctx, pr, half, fy, color) {
  quadPath(ctx, pr, [
    { x: -half, y: fy, z: -half }, { x: half, y: fy, z: -half },
    { x:  half, y: fy, z:  half }, { x: -half, y: fy, z: half },
  ]);
  ctx.fillStyle = color || Palette.get('floor');
  ctx.fill();
  quadPath(ctx, pr, [
    { x: -half, y: fy, z: half }, { x: half, y: fy, z: half },
    { x:  half, y: fy + 10, z: half }, { x: -half, y: fy + 10, z: half },
  ]);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  quadPath(ctx, pr, [
    { x: half, y: fy, z: half }, { x: half, y: fy, z: -half },
    { x: half, y: fy + 10, z: -half }, { x: half, y: fy + 10, z: half },
  ]);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
}

// Contact shadow on the floor plane; nearness in (0,1], 1 = touching.
export function contactShadow(ctx, pr, x, z, floorY, nearness) {
  const p = pr({ x, y: floorY, z });
  const r = 26 * nearness + 6;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${0.38 * nearness})`;
  ctx.fill();
}

// The six emotion rings, top right. Filled once unlocked.
export function drawPaletteHUD(ctx, canvas) {
  const slots = Palette.slots;
  const r = 5, gap = 18, y = 24;
  const x0 = canvas.width - 24 - (slots.length - 1) * gap;
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < slots.length; i++) {
    const x = x0 + i * gap;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (Palette.isUnlocked(slots[i].name)) {
      ctx.fillStyle = slots[i].color;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Centered monospace text, the game's single typographic voice.
export function text(ctx, str, x, y, size, color, alpha = 1, spacing = false) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `300 ${size}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(spacing ? [...str].join(' ') : str, x, y);
  ctx.globalAlpha = 1;
}
