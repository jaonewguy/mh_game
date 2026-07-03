/*
 * End — the end of the current build. Thanks the player, shows what
 * they've found, and offers the menu.
 */
import { Input } from '../core/input.js';
import { text } from '../render/draw.js';
import { Palette } from '../palette.js';

export class EndScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.hideHUD = true;
  }

  update(dt) {
    this.t += dt;
    if (this.t > 1 && (Input.pressed('confirm') || Input.pressed('breath'))) {
      this.game.goto('menu');
    }
  }

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const a = Math.min(1, this.t / 1.5);
    text(ctx, 'this is where the path ends, for now.', w / 2, h * 0.4, 22, Palette.get('text'), a);

    const slots = Palette.slots;
    const gap = 34, r = 8;
    const x0 = w / 2 - ((slots.length - 1) * gap) / 2;
    for (let i = 0; i < slots.length; i++) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x0 + i * gap, h * 0.52, r, 0, Math.PI * 2);
      if (Palette.isUnlocked(slots[i].name)) {
        ctx.fillStyle = slots[i].color;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    text(ctx, `${Palette.unlockedCount()} of ${slots.length} colors found`, w / 2, h * 0.52 + 34, 13, Palette.get('textFaint'), a);
    text(ctx, 'more chapters are coming.', w / 2, h * 0.66, 14, Palette.get('textFaint'), a);
    if (this.t > 1) {
      const pulse = 0.25 + Math.abs(Math.sin(this.t * 2)) * 0.2;
      text(ctx, 'space — menu', w / 2, h * 0.8, 12, `rgba(255,255,255,${pulse})`);
    }
  }
}
