/*
 * Menu — the title screen. Quiet, black, the six waiting rings.
 */
import { Input } from '../core/input.js';
import { Flow } from '../core/flow.js';
import { Save } from '../core/save.js';
import { text } from '../render/draw.js';
import { Palette } from '../palette.js';
import { Sfx } from '../audio/sfx.js';
import { Music } from '../audio/music.js';

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.hideHUD = true; // the menu draws its own, larger rings
    this.options = Save.data.node
      ? [{ label: 'continue', act: () => Flow.enter(game, Save.data.node) },
         { label: 'begin again', act: () => this.freshStart() }]
      : [{ label: 'begin', act: () => this.freshStart() }];
    this.sel = 0;
    Music.setMood({ tension: 0.1 });
  }

  freshStart() {
    Save.reset();
    Palette.resetAll();
    Flow.enter(this.game, { type: 'prologue' });
  }

  update(dt) {
    this.t += dt;
    if (Input.pressed('up'))   { this.sel = (this.sel + this.options.length - 1) % this.options.length; Sfx.ui(); }
    if (Input.pressed('down')) { this.sel = (this.sel + 1) % this.options.length; Sfx.ui(); }
    if (Input.pressed('confirm') || Input.pressed('breath')) {
      Sfx.ui();
      this.options[this.sel].act();
    }
  }

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const breathe = 0.85 + Math.sin(this.t * 1.2) * 0.15;
    text(ctx, 'c h r o m a', w / 2, h * 0.3, 44, `rgba(255,255,255,${breathe})`);
    text(ctx, 'a game about finding color', w / 2, h * 0.3 + 34, 14, Palette.get('textFaint'));

    // the six rings, center stage
    const slots = Palette.slots;
    const gap = 34, r = 8;
    const x0 = w / 2 - ((slots.length - 1) * gap) / 2;
    for (let i = 0; i < slots.length; i++) {
      ctx.beginPath();
      ctx.arc(x0 + i * gap, h * 0.44, r, 0, Math.PI * 2);
      if (Palette.isUnlocked(slots[i].name)) {
        ctx.fillStyle = slots[i].color;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    text(ctx, `${Palette.unlockedCount()} / ${slots.length}`, w / 2, h * 0.44 + 30, 12, 'rgba(255,255,255,0.3)');

    // options
    for (let i = 0; i < this.options.length; i++) {
      const selected = i === this.sel;
      const y = h * 0.6 + i * 34;
      text(ctx, (selected ? '· ' : '') + this.options[i].label + (selected ? ' ·' : ''),
        w / 2, y, 18, selected ? Palette.get('text') : Palette.get('textFaint'));
    }

    text(ctx, 'arrows move · space breathes · enter chooses', w / 2, h * 0.9, 12, 'rgba(255,255,255,0.25)');
  }
}
