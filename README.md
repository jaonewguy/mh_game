# Chroma (working title)

A game about mental health, told through color — or the absence of it.

The world begins in pure black and white. Each chapter is a visual
metaphor for a mental-health challenge; working through it lets the
player reclaim an **emotion**, which unlocks a **color** that begins to
bleed back into the world — and adds that emotion's **voice** to the
music. Six colors, six emotions: calm, hope, joy, courage, warmth,
clarity.

## Current build

- **Prologue — The Fall**: a stickman falls through black space into a
  glass cube; every second the walls slam inward. The world closes in.
- **Chapter One — Calm**: the breathing mechanic. A ring pulses around
  the figure with the music's swell; breathe with it (hold SPACE as it
  grows, release as it shrinks) to steady a trembling room, push
  closed-in walls back open, and finally reclaim the first color.
- Adaptive procedural score: an ambient bed that darkens with tension,
  a heartbeat pulse, and one generative voice per unlocked color.
- Progress (colors + position) persists; continue from the menu.

## Running the game

No build step, no dependencies — but ES modules need a server:

```sh
python3 -m http.server 8010
# open http://localhost:8010
```

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move (screen-relative on the isometric floor) |
| Space | Breathe (and advance text) |
| Enter | Confirm |
| R | Restart level / prologue |
| Esc | Back to menu |

## Structure

```
index.html            entry point
src/
  core/               game loop + scene manager, input action map,
                      save (localStorage), data loader, flow (chapters spine)
  render/             iso projection, draw primitives, Room (glass cube),
                      particles, stick figure (procedural poses)
  audio/              shared AudioContext + master bus, procedural SFX,
                      adaptive music engine (bed / pulse / emotion voices / stems)
  scenes/             menu, prologue, storybeat, level runner, unlock, end
  palette.js          color-unlock system, role-based colors
data/
  chapters.json       chapter + flow definitions
  levels/*.json       level definitions (mechanic params, mood, room)
  story/*.json        monologue lines between scenes
tools/
  shoot.js            Playwright playthrough smoke test + screenshots
```

Design rules that keep the project portable and vibe-codeable:

- **All drawing goes through `Palette.get(role)`** — unlocking an
  emotion recolors the world with no scene changes.
- **The renderer is a thin layer** (`src/render/`) — a future Three.js
  port swaps that directory, nothing else.
- **Content is data** (`data/`) — new levels and story are JSON edits.

## Testing

```sh
python3 -m http.server 8010 &
node tools/shoot.js   # plays the game end-to-end, screenshots to tools/out
```

## Roadmap

- Chapters 2–6 (hope, joy, courage, warmth, clarity) — gated on the
  Chapter 1 playtest
- Color bleed-in across previously visited spaces
- Composed music stems layered over the procedural bed
- Touch controls + itch.io packaging
