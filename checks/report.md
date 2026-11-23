# Stage A build report — "Palkon Auto" (gta6-01-3d-v11)

## What was built

- **Handwritten WebGL 2 renderer** (`game/src/renderer.js`, no Three.js, no
  vendored 3D library): standard / water / sky / depth (shadow) programs,
  a 2048 shadow map, merged meshes per facade group, procedural canvas
  textures. `main.ts` was written by hand in this session (not the kit
  starter).
- **Deterministic seeded city** (`game/src/city.js`, seed 20261123): Solmar,
  3,840 x 3,456 units, seven districts (Old Solmar, Canal Ward, South
  Market, Citrus Quarter, Pearl Marina, Glasspoint, Sunstrand Beach).
  353 buildings (241 brick, 52 market, 9 warehouse, 30 towers, 16 glass,
  5 houses), 256 trees, 148 street lamps, 5 boats. A canal crosses the city
  with 3 bridges whose gaps stay open for crossing; harbour, beach and park
  are in. Glasspoint towers sit on building plots only, never on road
  strips. Brick buildings have real windows; glass buildings show day glare
  and lit interiors at night.
- **Three lighting presets** (`game/src/lighting.js`): scorching midday sun
  with real shadows, sunset (sun low in the west), night with moon, stars
  and street lights. Switchable in-game with keys 1 / 2 / 3 or T.
- **Native canvas minimap** (`game/src/minimap.js`): local streets, building
  footprints, player heading. HUD (`game/src/hud.js`) with district, time
  and preset.
- **Screenshots** (`screenshots/`): 1-day.jpg, 2-sunset.jpg, 3-night.jpg —
  real renders of the game in headless Chrome, staged at street / canal /
  promenade level, each viewed and re-staged until it read as a real place.

## Bugs found and fixed while verifying

- `mat4LookAt` built the camera transform instead of the view matrix (basis
  vectors stored as columns instead of rows). Views looking up or north-east
  came out vertically flipped; the night shot showed the ground texture at
  the top of the frame. Fixed to store the axes as rows; verified
  numerically (target maps to (0, 0, -449), above-target to y > 0,
  ground-below-camera to y < 0).
- `mat4LookAt`'s camera y-axis cross product degenerated to (0, 0, 0) on a
  level view and sheared the image diagonally. Fixed to `y = z cross x`.
- The ground's default emissive map was white, so at night the whole ground
  glowed white (and pale at sunset). Default emissive is now black; only
  real lit-window textures emit.
- The sunset sun pointed east (sign error in `sunDir`). Fixed so the sun
  sets in the west; the sunset shot now shows the sun glow over the
  rooftops and warm light on the west facades.

## Verification numbers

- Headless Chrome (kit harness, `serve.ts`, 1280x720, all three presets):
  **0 console errors, 0 page errors, 0 failed requests** on every run.
  (Chrome stderr carries only its own GPU SharedImageManager / D-Bus
  noise, no CONSOLE lines, no Uncaught, no failed loads.)
- City layout (`node`, `buildCity` + `verifyLayout`): 353 buildings,
  30 towers, 256 trees, 148 lamps, 5 boats; **layout problems: []**
  (no tower footprint on a road strip, no building in the canal strip or
  the park, no bridge gap blocked).
- Determinism: `buildCity()` twice with the same seed produces byte-equal
  building lists; packaging twice with `MAKEFUN_OUTPUT_DIR=out node
  main.ts` produces byte-identical output (`diff -r out out2` identical,
  dossier.json sha256
  `74334ed899e171f8a08920a15a73f00a49de71a008d523c6f07e4fabb466f659`
  on both runs; dossier 446,839 bytes).
- Screenshots: 3 files, 1280x720, 81,736 / 87,329 / 119,424 bytes
  (all under the 256 KiB cap), each viewed: day = canal with bridge and
  buildings on both banks; sunset = warm marina street, sun glow over the
  rooftops, lamps lit; night = Glasspoint towers with lit windows under
  stars.

## Not done in this stage

- No README.md (a later stage writes it inside the recording).
- No vehicles, traffic, missions, police, title screen or save (stages B–F).
- Not pushed, not submitted, not bundled.
