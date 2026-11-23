# Stage E — Police, garages, radio, density, lighting polish

Palkon Auto, Stage E. All game text English; names, art and fonts original.
Palette: limestone `#ead8b2`, coral `#d77f69`, teal `#398e99`, ink `#142d38`,
leaf `#56856b`.

## What was built

- **Police** (`game/src/police.js`, new): a wanted system. Heat bands 0/20/45/75
  give 0–3 stars; patrol cars spawn to match the stars, pursue at 32 m/s
  (a coupe at 44 outruns them, a van at 30 does not), ram (health −10/s on
  contact, player speed dragged −25%/s) and box the player in. Arrest — a
  patrol car within 5.5 units for 3 s while the player is slow, or health
  reaching 0 — ends the run: the active mission fails, the police take
  $100 + $100 per star (never more than the cash on hand), and Mara wakes
  up on foot in Solmar Park (0, 1300). Heat cools 2/s after 10 s with no
  patrol car within 120 units. A live mission tail keeps at least 1 star.
  Hard collisions damage health 12 and add 20 heat. Minimap dots for
  patrol cars are bright blue `#5aa9e6`; the HUD shows red wanted stars
  and health. Light bars are drawn on patrol-car roofs, red/blue
  alternating every third of a second.
- **Garages** (`game/src/garages.js`, new): Old Solmar Garage
  (−992, −600) and Pearl Marina Garage (−592, −1400). E in a bay stores
  the car (removed from the world); G in a bay takes the last stored car
  back out. Stored cars persist across missions and mission resets.
  Teal pads mark both bays; both pads are clear of buildings.
- **Radio** (`game/src/radio.js`, new): three procedural stations, no audio
  files, no licensed music — Solmar FM (76 bpm, triangle), Canal Drive
  (112 bpm, square), Sunstrand Nights (96 bpm, sine). R switches while
  driving; the HUD shows the station name once audio is playing (sound
  starts after a user gesture, per browser autoplay rules).
- **Density** (`game/src/traffic.js`): traffic 15 → 20 cars (3–4 per loop),
  pedestrians 20 → 40 (8 per block).
- **Lighting polish** (`game/src/renderer.js`, `game/src/textures.js`):
  the shadow map now uses 3×3 PCF taps over the 2048 map and a 0.68
  shadow floor instead of a single tap at 0.5, so shade reads as shade.
  The investigation behind it: a shadows-off render proved the dark band
  down the road was the asphalt texture itself (`#3f444b`), not a
  shadow-map shadow — so the asphalt was lightened to `#565a60` as well.

## Verification (headless Chrome, SwiftShader, all runs zero errors)

- **Police test — PASS.** Arrest: mission 1 earned $250 first; wanted 1,
  1 patrol car spawned; min police distance 4.1; busted, busts 1, penalty
  $200, cash $250 → $50, player at the park (0, 1300) on foot, wanted 0,
  health 100, mission failed "Salt Ledger". Escape: gap after 12 s at full
  speed 136.3 (coupe outruns the 32 m/s patrol car); after 30 s far away,
  wanted 0, heat 0, police 0.
- **Garage test — PASS.** Old Solmar stores a coupe (count 1, car removed
  from the world, player on foot); G retrieves it (driving a coupe again).
  A sedan stored in Pearl Marina survives a mission accept and a missions
  reset, and retrieves as a sedan. Both pads clear of buildings.
- **Radio test — PASS.** Three stations; cycle Solmar FM → Canal Drive →
  Sunstrand Nights → Solmar FM → Canal Drive.
- **Density check — PASS.** Traffic 20, pedestrians 40; 600 frames live
  traffic, zero errors.
- **Mission regression — PASS.** Missions 1–8 all complete, total cash
  $4,250, 0 stuck recoveries; drop test and timer-fail test pass.
- **Drive test — PASS.** Compact 115, sedan 130, van 108, coupe 158 km/h
  (all maxima); red-signal stop, reverse 18.2, exit/re-enter, traffic
  stop 2.8 before the line.
- **Headlight test — PASS, both haze variants.** Asphalt +34.7 mean
  (100% pixels >10), roof +92.1 (100%), outside the beam 0.0.
- **Walk test — PASS.** On-foot movement 12 units, camera follows,
  building blocks.
- **Lighting before/after — VERIFIED.** Same midday shot with the old
  single-tap shadow vs the new PCF + floor: 14,507 pixels differ by >4
  (max +80), concentrated on the shadow edges — the sidewalk shadow
  (left) brightened 185.5 → 199.4 mean RGB. A shadows-off control proved
  the road band was asphalt, not shadow; after lightening the asphalt,
  the far-road patch went 48.9 → 64.5 mean RGB (+32%) while the
  sidewalks stayed identical. Viewed: the midday street now reads as
  asphalt in shade, not a black hole; the night police-pursuit shot shows
  2 red wanted stars, the headlight pool, and a patrol car with its
  light bar ahead.
- **Final full-suite re-run — PASS.** After the last edits (garage bay
  check, radio scheduler guard, asphalt lightening), the whole suite was
  run again on the final build: police, garage, radio, density, missions
  1–8, drive, headlights (both haze variants) and walk all pass, zero
  errors. The headlight asphalt gain rose 26.6 → 34.7 from the lighter
  asphalt; the test still passes with margin.
- **Screenshots:** the dossier still holds 4 (max). The police-pursuit
  night shot replaced `4-night-pursuit.jpg` (the Stage B headlight shot
  it supersedes; the old file is backed up at
  `/tmp/palkon-stage-b-night-pursuit.jpg`). All 4 are ≤256 KiB.
- **Packaging:** two runs byte-identical (diff exit 0). Dossier sha256
  `5499dfec5cb32bea1cacfc8eb823e6efcf0c88487a41d4803eb00f9e17ac993f`,
  18 source files (185,624 bytes), 0 vendored files.

## Bugs found and fixed during testing

1. **Heat decay ate fresh wanted.** The unseen timer accumulated during
   long quiet drives (no cars, heat 0), so a freshly set wanted decayed
   before the first patrol car spawned. Fix: the timer only runs while
   heat > 0, and `setWanted`/`addHeat` reset it.
2. **Stuck detection misfired on normal driving.** A per-frame check
   (moved < 0.5 units) flags any car under 30 m/s as stuck, so patrol
   cars teleported every ~2 s instead of chasing. Fix: sample the
   position once a second; stuck means < 2 units in a sampled second
   while faster than 5 m/s.
3. **Radio catch-up burst.** A suspended audio context left the
   scheduler's next-bar time in the past, so resuming would fire a burst
   of overlapping bars. Fix: re-anchor the next-bar time on resume; the
   reset also restarts the bar counter.
4. **Garage bay test.** The bay check is now the correct rotated
   rectangle (transpose), matching the drawn pad for any heading, with
   the half-extents fixed to the pad's 16×24 local size.

## Errors

Zero console errors, zero page errors, zero failed requests in every
headless run above.
