/*
 * Boot — canvas, input, data, scenes, go.
 */
import { Game } from './core/game.js';
import { Input } from './core/input.js';
import { Data } from './core/data.js';
import { Flow } from './core/flow.js';
import { Save } from './core/save.js';
import { ensureAudio, setMasterVolume } from './audio/context.js';
import { Music } from './audio/music.js';
import { Palette } from './palette.js';

import { MenuScene } from './scenes/menu.js';
import { PrologueScene } from './scenes/prologue.js';
import { StoryScene } from './scenes/storybeat.js';
import { LevelScene } from './scenes/level.js';
import { UnlockScene } from './scenes/unlock.js';
import { EndScene } from './scenes/end.js';

const canvas = document.getElementById('game');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Audio can only start on a user gesture; the music engine boots then.
Input.init(() => {
  ensureAudio();
  setMasterVolume(Save.data.settings.volume);
  Music.start();
});

const game = new Game(canvas);
game.register('menu', MenuScene);
game.register('prologue', PrologueScene);
game.register('story', StoryScene);
game.register('level', LevelScene);
game.register('unlock', UnlockScene);
game.register('end', EndScene);

Data.loadAll().then(() => {
  Flow.build();
  game.start('menu');
});

// Debug/test hooks (used by tools/shoot.js; harmless in production).
window.__game = game;
window.__flow = Flow;
window.__music = Music;
window.__palette = Palette;
window.__save = Save;
