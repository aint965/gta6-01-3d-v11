# Stage C report — missions 1–4

Mara Venn, driver-for-hire in Solmar, takes work from Neri and Oren while
Bastion Civic and its fixer Silas Rook squeeze the city. Four missions,
accepted with M, advanced with Q near the objective, X drops carried cargo
(the marker moves to the dropped cargo; Q picks it back up). Cash is tracked
in the HUD. Missions unlock in order; a failed mission can be retried.

## What was built

- `game/src/missions.js` (new): the mission system and the four mission
  definitions — accept, interact, dropCargo, timers, pursuer, banner,
  objective text, marker, prompt hints, status, reset.
  - 1 "A Receipt for Sunshine" (Neri, $250): pick up a package in South
    Market (-1000, 600), deliver it to Pearl Marina (-600, -1400).
  - 2 "Salt Ledger" (Oren, $500): collect a ledger from the canal office
    (200, -200), bring it to Neri in Old Solmar (-1200, -600); the delivery
    leg is timed at 120 s.
  - 3 "After the Shutters" (Neri, $450): photograph three shuttered shops
    in Citrus Quarter — Mercer Row (800, 0), Citrus Row (1200, 400),
    Palm Row (1600, 800) — within a 240 s mission timer.
  - 4 "Glass Debt" (Oren, $600): the payment is carried from accept;
    deliver it to Glasspoint (1200, -600), then lose the tail: a pursuer
    sedan spawns 35 units behind at 28 m/s; the job completes when the gap
    stays above 110 for 4 s, and fails if the tail is still on the player
    after 60 s.
- Wiring (edited in-session): `main.js` (M/Q/X keys, `game.missions`,
  `runMissionTest`, `?shot=mission-1` staged view), `hud.js` (cash,
  objective, timer, banner, combined prompt), `minimap.js` (pulsing coral
  diamond marker, red pursuer dot), `renderer.js` (`dynMeshes.marker`
  coral beacon cylinder, `dynMeshes.crate` teal box for dropped cargo),
  `index.html` (`#hud-cash`, `#hud-mission`, `#hud-banner`, help text).
- `game/src/tests.js` (edited in-session): `missionTest()` plays all four
  missions end to end with a scripted driver, plus a cargo-drop test and a
  timer-expiry failure test. The driver is pure pursuit: it steers at a
  lookahead point 40 units ahead on the current leg, with sigma-delta
  steering (binary keys spread over steps) and a speed cap that follows the
  heading error (a turn of 70 deg or more still to make runs at 3 m/s).

## Defects the mission test found and fixed

1. **Bridge rails sealed the canal (Stage B bug).** The rails in
   `vehicles.js` stood north–south across the bridge entrances at x = ±108
   and stopped a car dead at x = 112. They now run east–west along the
   deck's long sides at z = bridge ± 20, so the entrances stay open.
2. **A tree stood in the road (Stage A bug).** An oak at (-976.3, -598.6)
   sat 1.4 units off the z = -600 centreline, on mission 3's route.
   `city.js` now rolls every tree spot until it lands 13 units off every
   street centreline (road half-width 10 + tree radius 0.9 + car
   half-width 0.9, with margin). Still 256 trees, none on any mission
   route; buildings, lamps and boats unchanged.
3. **The driver drifted off the centreline and clipped a lamp post.**
   Steering at the far waypoint let the car run 13 units off the line and
   wedge against the lamp at (-986, 214). Pure pursuit plus the
   error-following speed cap keeps it on the line; U-turns now turn at
   3 m/s, where the arc stays on the road instead of bulging into the
   block. The short escape route was also replaced by a long straight
   (west down z = -600): the car brakes for corners while the tail cuts
   them, so a turny route never opens a 110 gap.

## Verification — `window.__palkon.runMissionTest()`, headless, final run

- **Pass: true.** All four missions complete; total cash **$1,800**
  ($250 + $500 + $450 + $600). Zero stuck recoveries anywhere.
- Mission 1: pickup 80.0 s, deliver 129.3 s, done, cash $250.
- Mission 2: pickup 106.8 s, deliver 101.4 s — the timed leg fits inside
  its 120 s allowance — done, cash $750.
- Mission 3: shops in 102.0 s + 36.8 s + 36.9 s = 175.7 s, inside the
  240 s timer, done, cash $1,200.
- Mission 4: payment carried from accept; deliver 66.2 s; pursuer
  spawned; escape completed in 13.9 s (inside the 60 s timeout); the
  pursuer is gone afterwards; done, cash $1,800.
- Cargo drop: X drops the package at (-999.9, 593.2), the marker moves
  to it, Q picks it back up ("package").
- Failure path: idling 130 s after the ledger pickup fails "Salt Ledger"
  with "Time ran out"; cash stays $250; M re-accepts the mission.
- Zero console errors, zero page errors, zero failed requests in every
  headless run, including the final pass.
- Mission screenshot viewed: `?shot=mission-1` shows the objective,
  banner, cash, minimap diamond and the coral marker beam over the
  pickup. The shot is kept as a Stage F candidate at
  `/tmp/palkon-stage-c-mission.jpg` (the dossier already holds 4 shots).
- Packaging twice (`MAKEFUN_OUTPUT_DIR=out node main.ts`) is
  byte-identical: dossier sha256
  `7061a430aea58becd5388245b340755873e3f612e17597e460713770cda29b28`.

## Known quirks (for a later stage)

- On foot, WASD moves the camera, not the player position — the player
  stays where they stepped out. Missions are completable from the car; a
  walking player character is a Stage D/E polish item, not Stage C scope.
- Headless runs report 1 FPS — SwiftShader software rendering, not the
  game.
- The dev server (`node serve.ts --port 8123`) is still running for the
  next stage.
