/*
 * Main loop — canvas setup, input, scene management, and the
 * always-visible palette HUD showing which emotions/colors the
 * player has reclaimed so far.
 */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const keys = {};
  window.addEventListener('keydown', (e) => {
    MH.Audio.ensure();
    keys[e.key] = true;
    if (e.key === 'r' || e.key === 'R') scene.reset();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  window.addEventListener('pointerdown', () => MH.Audio.ensure());

  const scene = new MH.Scene1(canvas);

  // Small locked-color HUD, top right: six empty rings waiting to be filled.
  function drawPaletteHUD() {
    const slots = MH.Palette.slots;
    const r = 5, gap = 18;
    const y = 24;
    const x0 = canvas.width - 24 - (slots.length - 1) * gap;
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < slots.length; i++) {
      const x = x0 + i * gap;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (MH.Palette.isUnlocked(slots[i].name)) {
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

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    scene.update(dt, keys);
    scene.draw(ctx);
    drawPaletteHUD();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
