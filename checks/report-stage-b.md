# Stage B build report — Palkon Auto (gta6-01-3d-v11)

Driving, traffic, signals, pedestrians, headlights, entry and exit.

## What was built

- **Four driving profiles** (`game/src/vehicles.js`): compact (32 m/s, 115 km/h),
  sedan (36 m/s, 130 km/h), van (30 m/s, 108 km/h), coupe (44 m/s, 158 km/h),
  each with its own acceleration, braking, reverse and speed-dependent steering.
  Steering bites less as speed rises and nothing at a standstill, so a car
  never spins in place.
- **Swept oriented collisions**: SAT OBB-vs-AABB on 4 axes against buildings
  and bridge rails, OBB-vs-circle against lamps and trees, OBB-vs-OBB
  car-to-car, behind a uniform grid (cell 200). Movement is sub-stepped to
  ≤0.4 units so a fast car cannot tunnel through a wall; axis-separated
  fallback gives wall sliding. Water blocks except on bridges; the city edge
  clamps.
- **Entry and exit with E**: the nearest car within 6 units; the player steps
  out beside it on its right side and the car stays where it was (parked
  cars persist after exit — 29 deterministic parked cars on the curbs).
- **Traffic** (`game/src/traffic.js`): 6 right-hand lane loops around blocks,
  15 cars that slow for the car ahead (gap <14 → match speed, <7 → stop),
  stop at red/yellow signals, and slow for the player's car ahead. Pairwise
  separation keeps cars from overlapping at corners.
- **Working 3D signals**: 24 intersections, 26 s cycle (green 8, yellow 3,
  all-red 2 per axis) with a per-intersection offset, so the city never
  changes everywhere at once. Each intersection has a pole, two heads (one
  per axis) and a lamp that sits at the red/yellow/green slot and glows only
  on the active colour.
- **Pedestrians**: 20 walkers on 5 sidewalk loops, palette shirts, bob phase.
- **Headlights** (`game/src/renderer.js`): 4 world-space spot cones in the
  standard shader (warm colour, smoothstep cone, quadratic falloff to 80
  units, a normal-independent pool term plus extra diffuse on faces turned
  toward the beam). The player's car when its lights are on (H, or automatic
  at night) plus the 3 nearest traffic cars at night. The pool lights road,
  paint, people and walls.
- **Driving HUD and minimap**: speed + profile readout, entry/exit/headlight
  prompts, and minimap car dots (coral player with a pale ring, pale traffic,
  dim parked, pale dot on foot). The Stage A minimap and HUD were extended,
  not rebuilt.
- **Chase camera**: sits behind the car, looks past it, mouse drag looks
  around and springs back; yaw/pitch/distance are set directly (placing the
  camera would feed the eye height back into the distance and drift outward
  every frame).

## Verification (headless Chrome, SwiftShader, 1280×720)

Zero console errors, zero page errors, zero failed requests in every run
(sunset, night, drive-day, night-pursuit, drive test, headlight test).

### Scripted drive test (`window.__palkon.runDriveTest()`)

| check | result |
|---|---|
| compact top speed | 32.0 m/s · 115.2 km/h · 263.4 units in 10 s |
| sedan top speed | 36.0 m/s · 129.6 km/h · 279.3 units in 10 s |
| van top speed | 30.0 m/s · 108.0 km/h · 225.3 units in 10 s |
| coupe top speed | 44.0 m/s · 158.4 km/h · 359.7 units in 10 s |
| full stop at a red signal | stopped at z = −67, nose at −64.9, line at −10 — 54.9 units before the line |
| reverse | 18.2 units, max 8.0 m/s |
| exit and re-enter | exited, car stayed, re-entered the same car |
| traffic car at a red signal | stopped 2.8 units before its stop line, speed 0 |

### Headlight test (`window.__palkon.runHeadlightTest(haze)`)

Frozen night scene, player coupe at (200, 300), parked sedan at (200, 340),
10×10 px patches read from the WebGL framebuffer. Thresholds: lit patches
≥20 mean RGB gain and ≥90% of pixels gaining >10; unlit patch within 1.

| patch | haze on | haze off |
|---|---|---|
| bare asphalt (200, 330) | +26.6 mean, 100% over 10 | +26.6 mean, 100% over 10 |
| painted roof (200, 340) | +91.3 mean, 100% over 10 | +91.3 mean, 100% over 10 |
| asphalt outside the beam (200, 420) | 0.0 | 0.0 |
| **verdict** | **PASS** | **PASS** |

Traffic is frozen onto the far west loops for the test, so no other car can
cover the target or add a competing beam.

### Packaging

`MAKEFUN_OUTPUT_DIR=out node main.ts` run twice: byte-identical output
(dossier.json sha256 `b535419cfba80bb4acb6a0329a9155d4b07600dc66563cf7d280050049680a20`).

### Screenshots (4 in the dossier)

- `1-drive-day.jpg` — street level behind the coupe at midday (replaces the
  weakest Stage A shot, `1-day.jpg`, removed).
- `2-sunset.jpg`, `3-night.jpg` — Stage A, re-checked after the renderer
  changes, still clean.
- `4-night-pursuit.jpg` — night pursuit: the player's headlight pool on the
  road and the pursued sedan lit in the beam ahead.

## Notes from the build

- The headlight test camera took three tries: the first sat inside a building
  (flat brick wall), the second saw the sedan's roof nearly edge-on (3 px
  tall, so the patch landed on road and rear), the third — above the road
  looking down the lane — sees the roof properly and passes both haze
  variants with margin.
- Two real bugs found by the tests and fixed in-session: `driveCar` takes a
  `{throttle, brake, steer}` object but was handed the raw key set (cars
  never moved), and the renderer read `car.groundY` while the field is `car.y`
  (cars invisible, headlight positions NaN). A third: the red-stop script
  braked from 36 m/s only 25 units out and held S past the stop, so the car
  reversed — the test now brakes 100 units out and releases the key.
- Headless runs report 1 FPS: SwiftShader software rendering, not the game.
- The wheels now sit on the ground (they floated 0.12 above it).
