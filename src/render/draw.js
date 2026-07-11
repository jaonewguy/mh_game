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

// Color washing back into the world: every unlocked emotion drifts a
// soft tinted bloom across the floor, clipped to the slab — ink in
// water, spreading from wherever the figure is.
export function floorWash(ctx, pr, half, fy, t, focus) {
  const unlocked = Palette.slots.filter(s => Palette.isUnlocked(s.name));
  if (!unlocked.length) return;

  quadPath(ctx, pr, [
    { x: -half, y: fy, z: -half }, { x: half, y: fy, z: -half },
    { x:  half, y: fy, z:  half }, { x: -half, y: fy, z: half },
  ]);
  ctx.save();
  ctx.clip();

  const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0;
  unlocked.forEach((slot, i) => {
    const a = t * 0.12 + i * 2.3;
    const cx = fx + Math.cos(a) * half * 0.45;
    const cz = fz + Math.sin(a * 0.77 + i) * half * 0.45;
    const p = pr({ x: cx, y: fy, z: cz });
    const r = half * 1.1;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, Palette.colorRGBA(slot.name, 0.12));
    grad.addColorStop(1, Palette.colorRGBA(slot.name, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  });
  ctx.restore();
}

// Life coming back: once calm is reclaimed, plants sprout around the
// floor and grow taller with every color found — by the last chapter
// the rooms are gardens. Deterministic positions (seeded), swaying
// stems with leaf strokes, in calm's plant green.
export function flora(ctx, pr, half, fy, t) {
  if (!Palette.isUnlocked('calm')) return;
  const growth = 0.3 + 0.7 * (Palette.unlockedCount() / Palette.slots.length);

  let seed = 970;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const ang = rand() * Math.PI * 2;
    const rr = half * (0.5 + rand() * 0.42);
    const px = Math.cos(ang) * rr, pz = Math.sin(ang) * rr;
    const h = (10 + rand() * 34) * growth;
    const lean = (rand() - 0.5) * 14;
    const sway = Math.sin(t * 1.1 + i * 1.7) * (1.5 + h * 0.05);

    const base = pr({ x: px, y: fy, z: pz });
    const top = pr({ x: px, y: fy - h, z: pz });
    const leafY = fy - h * 0.55;
    const leafP = pr({ x: px, y: leafY, z: pz });

    for (const [color, lw] of [['rgba(0,0,0,0.45)', 3.5], [Palette.colorRGBA('calm', 0.85), 1.8]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      // stem, bowing with its lean and the breeze
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(
        base.x + lean * 0.4, (base.y + top.y) / 2,
        top.x + lean + sway, top.y
      );
      ctx.stroke();
      // two leaves partway up
      ctx.beginPath();
      ctx.moveTo(leafP.x + lean * 0.25, leafP.y);
      ctx.lineTo(leafP.x + lean * 0.25 - 6 - h * 0.1, leafP.y - 4 - h * 0.06);
      ctx.moveTo(leafP.x + lean * 0.25, leafP.y - 3);
      ctx.lineTo(leafP.x + lean * 0.25 + 6 + h * 0.1, leafP.y - 6 - h * 0.06);
      ctx.stroke();
    }
  }
}

// Warm light on the horizon beyond every missing wall — joy's sun,
// rising a little more with each chapter. strength scales the glow.
export function horizonGlow(ctx, pr, room, floorY, strength) {
  const DIRS = {
    xpos: { x: 1, z: 0 }, xneg: { x: -1, z: 0 },
    zpos: { x: 0, z: 1 }, zneg: { x: 0, z: -1 },
  };
  for (const side of room.open) {
    const dir = DIRS[side];
    const c = pr({
      x: dir.x * room.floorHalf * 2.1,
      y: floorY - 30,
      z: dir.z * room.floorHalf * 2.1,
    });
    const r = room.floorHalf * 2.2;
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    grad.addColorStop(0, Palette.roleRGBA('joyTrail', strength));
    grad.addColorStop(1, Palette.roleRGBA('joyTrail', 0));
    ctx.fillStyle = grad;
    ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
  }
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

// Same, with a dark halo — for captions that can land on the white
// floor (big rooms scroll it under the UI).
export function haloText(ctx, str, x, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `300 ${size}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}
