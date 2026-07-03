/*
 * Isometric projection — classic 2:1 pixel isometric.
 *
 * World space: x and z lie on the ground plane, y points DOWN
 * (matching the fall: y grows as the figure drops). One world unit
 * is roughly one pixel.
 *
 *   screen.x = (x - z)
 *   screen.y = (x + z) / 2 + y
 *
 * The whole game still renders as strokes on a 2D canvas — the "3D"
 * is just this transform, which keeps the engine dependency-free and
 * the line-art aesthetic intact.
 */
window.MH = window.MH || {};

MH.Iso = {
  // cam = { ox, oy: screen origin, y: vertical camera scroll }
  project(p, cam) {
    return {
      x: cam.ox + (p.x - p.z),
      y: cam.oy + (p.x + p.z) * 0.5 + p.y - cam.y,
    };
  },
};
