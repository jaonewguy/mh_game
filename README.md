# mh_game (working title: *Chroma*)

A game about mental health, told through color — or the absence of it.

The world begins in pure black and white. Each scene is a visual metaphor
for a mental-health challenge; working through it lets the player reclaim
an **emotion**, which unlocks a **color** that begins to bleed back into
the world. Six colors, six emotions: calm, hope, joy, courage, warmth,
clarity.

## Scene I — The Fall

A stickman falls through empty black space and lands in a cube: a solid
white floor and transparent walls. Every second, the walls slam inward.
There is nowhere to go. Fade to black — end of scene.

*(The feeling of the world closing in. No color is unlocked here yet —
the journey starts colorless.)*

## Running the game

No build step, no dependencies. Either open `index.html` directly in a
browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

| Key | Action |
| --- | --- |
| ← / → or A / D | Move (slight air control while falling) |
| R | Restart the scene |

## Structure

```
index.html        entry point
css/style.css     fullscreen black canvas
js/palette.js     color-unlock system (localStorage-persisted) + role-based colors
js/audio.js       procedural WebAudio thuds (landing, wall slams)
js/stickman.js    procedurally animated stick figure (fall / crouch / idle / run poses)
js/scene1.js      Scene I state machine: falling -> landing -> settle -> walls -> end
js/main.js        game loop, input, palette HUD
```

All drawing colors are requested through `MH.Palette.get(role)`, so when
an emotion is unlocked later, assigning it to a role recolors the world
with no changes to scene code.

## Roadmap

- Scene II+: challenges that unlock the first color
- Color bleed-in effect when an emotion is reclaimed
- Persistent scene progression / scene select
