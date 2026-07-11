/*
 * Flow — the game's spine: an ordered list of nodes built from
 * data/chapters.json. Each node is a place the player can be (and
 * resume from):
 *
 *   { type: 'prologue' }
 *   { type: 'story',  id: 'prologue' }
 *   { type: 'level',  chapter: 'calm', index: 0 }
 *   { type: 'unlock', chapter: 'calm' }
 *   { type: 'end' }
 */
import { Save } from './save.js';
import { Data } from './data.js';
import { Palette } from '../palette.js';

export const Flow = {
  nodes: [],

  build() {
    const nodes = [];
    for (const step of Data.chapters.flow) {
      if (step === 'prologue') {
        nodes.push({ type: 'prologue' });
      } else if (step.startsWith('story:')) {
        nodes.push({ type: 'story', id: step.slice(6) });
      } else if (step.startsWith('chapter:')) {
        const id = step.slice(8);
        const ch = Data.chapters.chapters[id];
        if (ch.story) nodes.push({ type: 'story', id: ch.story });
        ch.levels.forEach((_, i) => nodes.push({ type: 'level', chapter: id, index: i }));
        nodes.push({ type: 'unlock', chapter: id });
      } else if (step === 'epilogue') {
        nodes.push({ type: 'epilogue' });
      } else if (step === 'end') {
        nodes.push({ type: 'end' });
      }
    }
    this.nodes = nodes;
  },

  _key(node) { return JSON.stringify(node); },

  indexOf(node) {
    const k = this._key(node);
    return this.nodes.findIndex(n => this._key(n) === k);
  },

  // Enter a node: persist it as the resume point and switch scenes.
  enter(game, node) {
    // The game grows chapter by chapter. If a save (or an advance)
    // lands on "end" while chapters with still-locked colors exist —
    // e.g. a save from an older build — route into the first
    // unfinished chapter instead of the end card.
    if (node.type === 'end') {
      const pending = Object.values(Data.chapters.chapters)
        .find(ch => !Palette.isUnlocked(ch.emotion));
      if (pending) node = { type: 'story', id: pending.story };
    }
    this.enterRaw(game, node);
  },

  // Enter exactly this node, no rerouting — used by the dev scene
  // picker so every node (including the end card) is reachable.
  enterRaw(game, node) {
    Save.setNode(node);
    switch (node.type) {
      case 'prologue': game.goto('prologue'); break;
      case 'story':    game.goto('story', { node }); break;
      case 'level':    game.goto('level', { node }); break;
      case 'unlock':   game.goto('unlock', { node }); break;
      case 'epilogue': game.goto('epilogue'); break;
      case 'end':      game.goto('end'); break;
    }
  },

  advance(game, node) {
    const i = this.indexOf(node);
    const next = this.nodes[Math.min(i + 1, this.nodes.length - 1)];
    this.enter(game, next);
  },
};
