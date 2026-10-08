# Racing Simulator

A 2026-season F1 racing game that runs in the browser. Pick a circuit from the calendar, choose your driver and race a full grid of AI cars.

**Play:** https://lilbodnar.github.io/racing-simulator/

## Controls

| Key | Action |
|---|---|
| ↑ / W | Throttle |
| ↓ / S | Brake (hold when stopped to reverse) |
| ← → / A D | Steer |
| M | Switch automatic / manual gearbox |
| Q / E | Shift down / up (manual gearbox) |
| Space | Overtake mode (within 1 s of the car ahead) |
| C | Change camera |
| R | Rejoin behind the last car (full-grid race) |
| N | Sound on/off |
| Esc | Pause |

Steering wheels, pedals, H-shifters and game controllers are supported too.

## Features

- All 2026 calendar circuits, built from real track layouts with elevation
- Full 22-car grid with AI that follows, waits for gaps and overtakes
- Grass, gravel and sand run-off, kerbs, dirty tyres
- 2026-style track limits: black-and-white flag on the 3rd offence, 5 s penalty from the 4th
- Car-to-car contact physics, overtake mode, lap and race records

## Running locally

No build step. Open `index.html` in a browser.

## Credits

- [three.js](https://threejs.org/) (MIT licence) for 3D rendering
- Circuit layouts from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT licence)

This is a fan project and isn't affiliated with Formula 1 or any team.
