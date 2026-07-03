/*
 * Storybeat — the narrative voice between scenes: monologue lines
 * typed out one at a time on black. Space/Enter advances; each line
 * comes from data/story/<id>.json.
 */
import { Input } from '../core/input.js';
import { Flow } from '../core/flow.js';
import { Data } from '../core/data.js';
import { text } from '../render/draw.js';
import { Palette } from '../palette.js';
import { Sfx } from '../audio/sfx.js';

const CHARS_PER_SEC = 28;

export class StoryScene {
  constructor(game, { node }) {
    this.game = game;
    this.node = node;
    this.lines = (Data.story[node.id] || { lines: ['...'] }).lines;
    this.lineIndex = 0;
    this.charT = 0;
    this.hideHUD = false;
  }

  update(dt) {
    const line = this.lines[this.lineIndex];
    const done = this.charT * CHARS_PER_SEC >= line.length;
    this.charT += dt;

    if (Input.pressed('confirm') || Input.pressed('breath')) {
      if (!done) {
        this.charT = line.length / CHARS_PER_SEC; // reveal the full line
      } else if (this.lineIndex < this.lines.length - 1) {
        this.lineIndex++;
        this.charT = 0;
        Sfx.ui();
      } else {
        Flow.advance(this.game, this.node);
      }
    }
  }

  draw(ctx) {
    const w = this.game.canvas.width, h = this.game.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const line = this.lines[this.lineIndex];
    const shown = line.slice(0, Math.floor(this.charT * CHARS_PER_SEC));
    text(ctx, shown, w / 2, h * 0.46, 20, Palette.get('text'));

    const done = shown.length >= line.length;
    if (done) {
      const pulse = 0.25 + Math.abs(Math.sin(this.charT * 2)) * 0.2;
      text(ctx, 'space', w / 2, h * 0.8, 12, `rgba(255,255,255,${pulse})`);
    }
    // progress dots
    for (let i = 0; i < this.lines.length; i++) {
      ctx.beginPath();
      ctx.arc(w / 2 + (i - (this.lines.length - 1) / 2) * 14, h * 0.86, 2, 0, Math.PI * 2);
      ctx.fillStyle = i <= this.lineIndex ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)';
      ctx.fill();
    }
  }
}
