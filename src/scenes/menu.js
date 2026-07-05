/*
 * Menu — the title screen. Quiet, black, the six waiting rings.
 *
 * Views: main (title + options), help (how to play), scenes (dev
 * mode — a chronological list of every node in the game's flow, jump
 * anywhere). The scenes list is built straight from Flow.nodes, so it
 * always matches the real game order as chapters are added.
 */
import { Input } from '../core/input.js';
import { Flow } from '../core/flow.js';
import { Save } from '../core/save.js';
import { Data } from '../core/data.js';
import { text } from '../render/draw.js';
import { Palette } from '../palette.js';
import { Sfx } from '../audio/sfx.js';
import { Music } from '../audio/music.js';

const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v'];

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.hideHUD = true; // the menu draws its own, larger rings
    this.view = 'main';
    this.sel = 0;
    this.sceneSel = 0;
    this.options = Save.data.node
      ? [{ label: 'continue', act: () => Flow.enter(game, Save.data.node) },
         { label: 'begin again', act: () => this.freshStart() }]
      : [{ label: 'begin', act: () => this.freshStart() }];
    this.options.push(
      { label: 'how to play', act: () => { this.view = 'help'; } },
      { label: 'scenes — dev', act: () => { this.view = 'scenes'; } },
    );
    Music.setMood({ tension: 0.1 });
  }

  freshStart() {
    Save.reset();
    Palette.resetAll();
    Flow.enter(this.game, { type: 'prologue' });
  }

  update(dt) {
    this.t += dt;

    if (this.view === 'help') {
      if (Input.pressed('confirm') || Input.pressed('breath') || Input.pressed('back')) {
        this.view = 'main';
        Sfx.ui();
      }
      return;
    }

    if (this.view === 'scenes') {
      const n = Flow.nodes.length;
      if (Input.pressed('up'))   { this.sceneSel = (this.sceneSel + n - 1) % n; Sfx.ui(); }
      if (Input.pressed('down')) { this.sceneSel = (this.sceneSel + 1) % n; Sfx.ui(); }
      if (Input.pressed('back')) { this.view = 'main'; Sfx.ui(); }
      if (Input.pressed('confirm') || Input.pressed('breath')) {
        Sfx.ui();
        // enterRaw: dev jumps go exactly where asked, no rerouting
        Flow.enterRaw(this.game, Flow.nodes[this.sceneSel]);
      }
      return;
    }

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

    if (this.view === 'help')   { this.drawHelp(ctx, w, h); return; }
    if (this.view === 'scenes') { this.drawScenes(ctx, w, h); return; }

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
      const y = h * 0.58 + i * 32;
      text(ctx, (selected ? '· ' : '') + this.options[i].label + (selected ? ' ·' : ''),
        w / 2, y, 17, selected ? Palette.get('text') : Palette.get('textFaint'));
    }

    text(ctx, 'arrows move · space breathes · enter chooses', w / 2, h * 0.92, 12, 'rgba(255,255,255,0.25)');
  }

  drawHelp(ctx, w, h) {
    text(ctx, 'how to play', w / 2, h * 0.16, 22, Palette.get('text'), 1, true);

    // two aligned columns: right-aligned keys | left-aligned descriptions
    const lines = [
      ['move', 'arrow keys or WASD'],
      ['breathe', 'hold SPACE as the ring grows · let go as it shrinks'],
      ['', 'good breaths calm the world'],
      ['in the dark', 'walk onto the ringed lights to gather them'],
      ['with the spark', 'chase it — keep moving'],
      ['dash', 'double-tap a direction (after joy returns)'],
      ['dark shapes', 'walk toward them. they hate that'],
      ['advance text', 'SPACE'],
      ['restart level', 'R'],
      ['menu', 'ESC'],
      ['', 'progress and colors are saved automatically'],
    ];
    const colX = Math.max(w * 0.28, 130);
    ctx.font = '300 14px "Courier New", monospace';
    let y = h * 0.28;
    for (const [key, desc] of lines) {
      if (key) {
        ctx.textAlign = 'right';
        ctx.fillStyle = Palette.get('text');
        ctx.fillText(key, colX, y);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = Palette.get('textFaint');
      ctx.fillText(desc, colX + 24, y);
      y += 32;
    }
    ctx.textAlign = 'center';
    const pulse = 0.3 + Math.abs(Math.sin(this.t * 2)) * 0.25;
    text(ctx, 'space — back', w / 2, y + 40, 12, `rgba(255,255,255,${pulse})`);
  }

  // A human-readable name for each flow node, in story order.
  nodeLabel(node) {
    switch (node.type) {
      case 'prologue': return 'prologue — the fall';
      case 'story':    return `story — ${node.id}`;
      case 'level': {
        const ch = Data.chapters.chapters[node.chapter];
        const def = Data.levels[ch.levels[node.index]];
        return `${node.chapter} ${NUMERALS[node.index] || node.index + 1} — ${def ? def.title : '?'}`;
      }
      case 'unlock': {
        const ch = Data.chapters.chapters[node.chapter];
        return `unlock — ${ch.emotion}`;
      }
      case 'end': return 'end card';
      default: return node.type;
    }
  }

  drawScenes(ctx, w, h) {
    text(ctx, 'scenes', w / 2, h * 0.12, 22, Palette.get('text'), 1, true);
    text(ctx, 'dev mode — jump anywhere, in story order', w / 2, h * 0.12 + 26, 12, Palette.get('textFaint'));

    // a scrolling window keeps long flows on screen
    const rows = Flow.nodes.length;
    const rowH = 26;
    const maxVisible = Math.max(6, Math.floor((h * 0.62) / rowH));
    const start = Math.max(0, Math.min(this.sceneSel - Math.floor(maxVisible / 2), rows - maxVisible));
    const yTop = h * 0.22;

    for (let i = start; i < Math.min(rows, start + maxVisible); i++) {
      const selected = i === this.sceneSel;
      const y = yTop + (i - start) * rowH;
      const label = this.nodeLabel(Flow.nodes[i]);
      text(ctx, (selected ? '· ' : '') + label + (selected ? ' ·' : ''),
        w / 2, y, selected ? 16 : 14,
        selected ? Palette.get('text') : Palette.get('textFaint'));
    }
    if (start > 0) text(ctx, '↑', w / 2, yTop - rowH, 12, Palette.get('textFaint'));
    if (start + maxVisible < rows) text(ctx, '↓', w / 2, yTop + maxVisible * rowH, 12, Palette.get('textFaint'));

    const pulse = 0.3 + Math.abs(Math.sin(this.t * 2)) * 0.25;
    text(ctx, 'enter — play scene · esc — back', w / 2, h * 0.92, 12, `rgba(255,255,255,${pulse})`);
  }
}
