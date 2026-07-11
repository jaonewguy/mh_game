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
- **Chapter One — Calm**: the breathing mechanic, now opening with a
  guided tutorial — the figure demonstrates a breath, then the ring
  literally waits for you to hold and to let go before the real cycles
  begin. Breathe with the ring (hold SPACE as it grows, release as it
  shrinks) to steady a trembling room, push closed-in walls back open,
  and reclaim the first color.
- **Chapter Two — Hope**: the dark. The world is only visible inside a
  pool of light around the figure; small lights flicker out in the
  black. Each one you reach joins you as a firefly and lets you see
  farther — until the way out appears.
- **Chapter Three — Joy**: movement. The figure runs faster here and
  leaves a trail of light — paint the floor of a room bigger than the
  screen, then chase a quick bright spark that flees and teases until
  you catch it (or breathe, and it comes to you).
- **Chapter Four — Courage**: the rooms are missing walls now, and
  dark shapes have come in. They grow when you back away and falter
  when you walk toward them — dissolve them with sustained
  confrontation or drive them off the edge of the world. One of them
  is faster than your walk; joy's dash (double-tap a direction) is
  how you close the distance.
- **Chapter Five — Warmth**: the first chapter that isn't about you.
  Small grey figures shiver alone in wide-open rooms; walk close and
  they follow — slower than you, so match their pace — and bring each
  one to the hearth, where color returns to them.
- **Chapter Six — Clarity**: fog over everything. Ringed vantage
  points wait in the haze; stand on one, hold still, and a portion of
  the fog lifts for good — until you can see the whole of it.
- **Carried abilities**: reclaimed emotions stay with you — calm's
  breath (hold SPACE anywhere), hope's glow and fireflies, joy's dash.
  Colors wash across floors, plants grow with every color found, and
  the sun climbs the horizon beyond the missing walls.
- Adaptive procedural score: an ambient bed that darkens with tension,
  swells with your breathing, a heartbeat pulse, and one generative
  voice per unlocked color.
- Progress (colors + position) persists; continue from the menu.

## Playing online (GitHub Pages)

One-time repo setup: **Settings → Pages → Source: "GitHub Actions"**.
After that, the included workflow (`.github/workflows/pages.yml`)
publishes this branch on every push at
`https://<user>.github.io/mh_game/`.

## Running locally

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
npm run test:unit   # pure logic: flow, save, palette (plain node)
npm run test:e2e    # real playthroughs in headless Chromium (needs playwright)
npm test            # both
```

The e2e tests genuinely play the game — they breathe through the
tutorial, walk to the lights in the dark, paint the joy room, and
check that unlocked colors survive a reload. They're timing-sensitive
under heavy CPU load (game time stretches when frames slow down); if
a file fails in a full run, rerun it solo to confirm. Visual review
shots:

```sh
python3 -m http.server 8010 &
node tools/shoot.cjs   # full playthrough, screenshots to tools/out
```

## Roadmap

- The Okami drawing stage (paint with earned colors; your art returns
  in the finale)
- A true finale beyond the end card — all six colors, the sun up
- Color bleed-in across previously visited spaces
- Composed music stems layered over the procedural bed
- Touch controls + itch.io packaging
