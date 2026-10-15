# Carom

**Not just back and forth.** Carom is a browser-only, top-down paddle duel about spin and bank shots. Strike while moving to bend the ball's flight. Two swaying, rotating obstacles make every crossing a new angle to solve.

Play **Solo** against the machine, or **Versus** with a second player on the same keyboard. First to 11 wins, with a two-point lead required. No account, backend, downloads, or runtime asset requests.

## Run locally

Requires Node.js 22.12+ (or a current Node.js LTS) and npm.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. The entire game is drawn on a canvas; the Simple 2D engine handles scaling, letterboxing, keyboard/touch input, synthesized audio, and the frame loop.

## Production build

```sh
npm ci
npm run build
```

Serve the resulting **`dist/`** directory at the root of any static web server. It includes `index.html` and all code needed to play; no additional build or setup step is needed.

To check the production build locally:

```sh
npm run preview
```

## Controls

| Input | Effect |
| --- | --- |
| **W / S** | Move the left paddle up / down |
| **↑ / ↓** | Move the right paddle in Versus; also move the left paddle in Solo |
| **W / S** or **↑ / ↓** in menus | Select an item |
| **Enter / Space** | Confirm |
| **P / Escape** | Pause or resume a match |
| **Escape** in the guide or results | Return to the menu |
| **M** | Toggle sound on any screen |
| **Backtick** | Toggle the engine's diagnostic overlay |
| **Mouse / touch** | Select and activate menu items |

On touchscreens, the engine provides a vertical paddle slider on each side and menu buttons. Touch the field to reveal them; using the keyboard or mouse hides them again. Sound unlocks on the first gesture.

A center hit sends the ball across the field; edge hits send it at a steeper angle. Moving at contact adds spin, and the trail shows the resulting curve. Obstacles preserve speed and spin, so a bank can turn an ordinary return into an unexpected shot.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The unit suite creates real Simple 2D engines over in-process canvases and counted clocks. It covers menus and pointer gestures, immutable transitions, paddle integration, AI, serving, spin, oriented collisions, scoring, debug poses, recording, and agreement between 2 ms and 16 ms frame lengths.

## Source map

- `src/game.ts`: exported state and debug contracts, initialization, frame orchestration.
- `src/simulation.ts`: render-free motion, collisions, serving, match transitions.
- `src/menus.ts`: shared menu hit regions and keyboard/pointer navigation.
- `src/render.ts`: procedural canvas graphics and interface.
- `src/debug.ts`: stateless poses and snapshots, returned through `engine.debug` only.
- `src/game.test.ts`: engine-driven tests.
- `showcase/`: player-facing description, screenshots, and a 5.6-second engine drawing replay.

The fixed geometry, rates, copy, keys, and cue names come from `src/constants.ts`. Engine documentation lives in `engine/`; the complete game specification is in `specs/`.
