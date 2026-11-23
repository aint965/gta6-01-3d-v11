# Stage F — Title screen, 4 final screenshots, in-session README

Palkon Auto, Stage F (final build stage). All game text English; names, art
and fonts original. Palette: limestone `#ead8b2`, coral `#d77f69`, teal
`#398e99`, ink `#142d38`, leaf `#56856b`.

## What was built

- **Title screen** (`game/index.html`, `game/src/main.js`): the game opens
  on Solmar at sunset with traffic moving and the camera drifting slowly
  across the marina street, showing "PALKON AUTO / THE SOLMAR STORY /
  PRESS ENTER TO START" over the living city. The HUD and minimap stay
  hidden until the player starts. Enter (or a click on the title) starts
  the game at midday with Mara on foot at (200, 200). A `?shot=title`
  staged view reproduces the title for the cover screenshot.
- **Staged drive shots roll** (`game/src/main.js`): shots flagged
  `cruise: true` (drive-day, night-pursuit, police-pursuit) start the
  player car at 18 m/s and hold the throttle in the frame loop, so the
  final drive shots show the car moving (113 km/h in the day shot,
  78 km/h at night) instead of parked at 0.
- **Police-pursuit shot fixed** (`game/src/main.js`): the first take
  showed no patrol car — the repositioned car sat behind the chase
  camera. The nearest patrol car is now placed in the lane ahead of the
  player car, in the headlight beam with its light bar flashing.
- **README.md — written in this session** (the lesson of the v10
  rejection: never a parent commit after the seal): the competition's
  live template with `{repo}` = gta6-01-3d-v11, `{owner}` = aint965 —
  three live make.fun badges, a short description, a `## Run it`
  section (`node serve.ts`, then http://localhost:8080), and the footer
  link with NO `ref=` parameter (this competition asks for no play
  code). Verified: 3 badge lines, 0 `ref=` occurrences.
- **Four final screenshots** (`screenshots/`, `shots.json` updated to
  match): 1-title.jpg (cover), 2-drive-day.jpg (113 km/h, midday
  street), 3-finale.jpg (mission 8 hold, 20 s countdown, Cash $3500,
  coral beacon), 4-night-pursuit.jpg (2 wanted stars, patrol car in
  the headlight beam, 78 km/h). The old Stage A/B shots
  (1-drive-day, 2-sunset, 3-night) were removed; the dossier holds
  exactly 4. All four viewed in this session.

## Verification (headless Chrome, SwiftShader, all runs zero errors)

- **Title test — PASS.** Default load: `title: true`, body class
  `title`, title text "PALKON AUTO", prompt "PRESS ENTER TO START",
  HUD hidden, preset sunset, 0 errors. Real Enter keydown: title
  false, body class removed, preset day, HUD visible, Mara on foot at
  (200, 200).
- **Mission regression — PASS.** Missions 1–8 all complete, total cash
  $4,250, 0 stuck recoveries; drop test and timer-fail test pass.
- **Drive test — PASS.** Compact 115, sedan 130, van 108, coupe 158
  km/h (all maxima); red-signal stop, reverse 18.2, exit/re-enter,
  traffic stop 2.8 before the line.
- **Headlight test — PASS, both haze variants.** Asphalt +34.7 mean
  (100% pixels >10), roof +92.1 (100%), outside the beam 0.0.
- **Walk test — PASS.** On-foot movement 12 units, camera follows,
  canal edge blocks at (70, 200).
- **Police test — PASS.** Arrest: $250 → $50 (penalty $200), park
  recovery (0, 1300) on foot, wanted 0, health 100, "Salt Ledger"
  failed. Escape: gap 136.3 after 12 s, wanted 0 after 30 s.
- **Garage test — PASS.** Store/retrieve coupe in Old Solmar; sedan
  stored in Pearl Marina survives mission accept and missions reset.
- **Radio test — PASS.** Three stations cycle Solmar FM → Canal Drive
  → Sunstrand Nights.
- **Density check — PASS.** Traffic 20, pedestrians 40.
- **Screenshots:** 4 files, 1280×720, 79,649 / 104,161 / 118,604 /
  93,315 bytes (all ≤256 KiB), all viewed in this session.
- **Packaging:** two runs byte-identical (`diff -r` exit 0). Dossier
  sha256 `cc7a278d7ea1978e142caacd3c4218fb4a9fe3e897114cd4859d476a245782cc`,
  696,545 bytes.

## Errors

Zero console errors, zero page errors, zero failed requests in every
headless run above (Chrome's own D-Bus/GPU stderr noise only).

## Notes for the seal / submit (parent)

- README.md was written inside this session and is committed here —
  the v10 transcripts_witnessed failure cannot recur from it.
- Per the updated plan, a city-layout fix session follows Stage F
  (real-city road hierarchy, not a uniform grid); the four shots will
  be re-taken after that session, so this stage did not over-polish
  their staging.
- Dev server on port 8123 left running for the next session; stop it
  before sealing if the recorder complains. Recording `01a205fb`
  (pid 3358) still alive at stage end.
