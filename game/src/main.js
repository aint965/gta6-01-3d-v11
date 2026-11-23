// Palkon Auto — Stage A: the city, the light and the camera.
// Stage B adds the drive: four car profiles, traffic on lane loops,
// working signals, pedestrians, headlights, entry and exit.
// Stage C adds the story: missions 1-4 for Mara Venn.
// Stage D closes the arc: missions 5-8 and the broadcast finale, and
// Mara walks on foot instead of the camera sliding alone.
// Boots the renderer, the minimap and the HUD, then runs the frame loop.
// URL parameters stage a view without touching the code:
//   ?preset=day|sunset|night   the light (1/2/3 or T in game)
//   ?cam=x,y,z&target=x,y,z    an exact camera placement
//   ?shot=day|sunset|night|drive-day|night-pursuit  a staged screenshot view
//   ?test=headlights|drive     run a verification test and report it
//   ?haze=off                  disable the decorative haze (fog)
//   ?freeze=1                  stop traffic and pedestrians
import { buildCity, verifyLayout, CITY_SEED } from './city.js';
import { createRenderer } from './renderer.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createMinimap } from './minimap.js';
import { createHud } from './hud.js';
import { PRESET_ORDER } from './lighting.js';
import { createVehicleSystem, PROFILES } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createMissions } from './missions.js';
import { createTests } from './tests.js';
import { createPolice } from './police.js';
import { createGarages, GARAGES } from './garages.js';
import { createRadio } from './radio.js';

// Staged screenshot views: street and promenade level, never from above.
// The camera sits on a street at about head height, looking down it, so
// buildings line both sides of the frame.
const SHOTS = {
  day: {
    preset: 'day',
    eye: [0, 5, -150],
    target: [0, 4, 250],
  },
  sunset: {
    preset: 'sunset',
    eye: [-700, 9, -1420],
    target: [-1300, 10, -1520],
  },
  night: {
    preset: 'night',
    eye: [900, 10, -600],
    target: [1300, 50, -800],
  },
  'drive-day': {
    preset: 'day',
    drive: true,
    cruise: true,
    car: { profile: 'coupe', x: 200, z: 300, heading: 0 },
    eye: [200, 4.5, 266],
    target: [200, 2, 330],
  },
  'night-pursuit': {
    preset: 'night',
    drive: true,
    cruise: true,
    car: { profile: 'coupe', x: 200, z: 300, heading: 0 },
    // The pursued car, ahead in the lane and slightly right: the
    // player's headlights catch its paint in the shot.
    pursuer: { profile: 'sedan', x: 202, z: 326, heading: 0 },
    eye: [216, 5, 258],
    target: [198, 2, 330],
  },
  // Stage C: mission 1 in progress — the coupe on the South Market street
  // with the coral marker beam over the package pickup.
  'mission-1': {
    preset: 'day',
    drive: true,
    mission: 1,
    car: { profile: 'coupe', x: -1000, z: 500, heading: 0 },
    // A longer chase distance so the whole marker beam fits in frame.
    dist: 30,
    pitch: 0.25,
    eye: [-1000, 6, 470],
    target: [-1000, 4, 600],
  },
  // Stage D: the finale in progress — the coupe parked at the broadcast
  // tower in Pearl Marina, the hold step live with its marker beam. The
  // chase camera frames the car from behind (it faces north, toward the
  // tower) — dist and pitch are what the shot uses; eye/target seed the
  // initial yaw.
  finale: {
    preset: 'day',
    drive: true,
    mission: 8,
    finale: true,
    car: { profile: 'coupe', x: -1200, z: -1320, heading: Math.PI },
    dist: 24,
    pitch: 0.28,
    eye: [-1200, 7, -1290],
    target: [-1200, 6, -1400],
  },
  // Stage E: a police pursuit at night — the coupe on the Canal Ward
  // street at 23:15 with two patrol cars closing in behind it, wanted
  // two stars, their light bars flashing. The camera sits low and to the
  // side so the patrol cars stay in frame.
  'police-pursuit': {
    preset: 'night',
    drive: true,
    cruise: true,
    police: true,
    car: { profile: 'coupe', x: 200, z: 300, heading: 0 },
    dist: 18,
    pitch: 0.3,
    eye: [168, 7, 276],
    target: [200, 2, 330],
  },
  // Stage F: the title screen — Solmar at sunset, traffic moving, the
  // title over the living city. The camera sits on the marina
  // promenade looking down the bay street.
  title: {
    preset: 'sunset',
    title: true,
    eye: [-700, 9, -1420],
    target: [-1300, 10, -1520],
  },
};

window.__palkon = { errors: [], ready: false, shots: Object.keys(SHOTS) };
window.addEventListener('error', (e) => {
  window.__palkon.errors.push(String(e.message || e.error));
  document.title = 'PAGEERROR: ' + (e.message || 'unknown');
});
window.addEventListener('unhandledrejection', (e) => {
  window.__palkon.errors.push('rejection: ' + String(e.reason));
});

const params = new URLSearchParams(location.search);
const city = buildCity(CITY_SEED);
const layoutProblems = verifyLayout(city);
if (layoutProblems.length > 0) {
  console.error('layout problems:', layoutProblems.join(' | '));
  window.__palkon.errors.push('layout: ' + layoutProblems.join(' | '));
}
window.__palkon.counts = city.counts;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, city);
const camera = createCamera();
const vehicles = createVehicleSystem(city);
const traffic = createTraffic(city, vehicles);

// The player walks or drives. On foot the camera follows Mara; in a car
// it follows from behind and the same keys drive instead of walking.
const player = {
  x: 200, z: 200, heading: 0,
  onFoot: true,
  car: null,
};
const missions = createMissions({
  vehicles,
  getPos: () => (player.car ? [player.car.x, player.car.z] : [player.x, player.z]),
  getHeading: () => (player.car ? player.car.heading : player.heading),
  now: () => simTime,
  setPreset,
});
// Stage E: the police, the garages and the radio. The police need the
// player and the missions; the busted handler below owns the recovery.
const garages = createGarages({ vehicles });
const radio = createRadio();
const police = createPolice({
  vehicles,
  missions,
  getPlayerPos: () => (player.car ? [player.car.x, player.car.z] : [player.x, player.z]),
  getPlayerCar: () => player.car,
  isPlayerOnFoot: () => player.onFoot,
  onBusted: ({ wanted }) => {
    // Arrest or zero health: the mission fails, the police take a cut of
    // the cash (never more than Mara has), and she wakes up in the park.
    const penalty = missions.deductCash(100 + 100 * wanted);
    if (missions.activeId) missions.failActive('Busted by the police');
    if (player.car) {
      player.car.kind = 'parked';
      player.car = null;
    }
    player.onFoot = true;
    driving = false;
    followOnFoot = true;
    player.x = 0; player.z = 1300; player.heading = 0;
    headlightsOn = false;
    camera.target = [player.x, 10, player.z];
    missions.notify('BUSTED — the police took $' + penalty + '. You wake up in Solmar Park.');
    police.acknowledgeBusted();
  },
});
// The radio only starts after a gesture (browser autoplay rules); the
// station still switches without sound.
const unlockAudio = () => radio.unlock();
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('pointerdown', unlockAudio, { once: true });
// Stage F: clicking the title screen starts the game, same as Enter.
document.getElementById('title-screen').addEventListener('click', startGame);
let headlightsOn = false;
let camYawOffset = 0; // mouse drag while driving: look around, springs back
let driving = false;
let followOnFoot = false; // once Mara has walked, the camera stays with her
const WALK_SPEED = 6; // metres per second on foot
let simTime = 0; // simulation clock: drives the signal cycle and the tests

// Stage F: the title screen. The game opens on Solmar at sunset with
// traffic moving and the HUD hidden; Enter (or a click on the title)
// starts the game at midday with Mara on foot. Staged drive shots roll
// instead of sitting parked: shotAutoDrive holds the throttle for them.
let titleActive = false;
let shotAutoDrive = false;
function startGame() {
  if (!titleActive) return;
  titleActive = false;
  document.body.classList.remove('title');
  setPreset('day');
  player.x = 200; player.z = 200; player.heading = 0;
  player.onFoot = true; player.car = null;
  driving = false; followOnFoot = false;
  camera.place([-60, 16, 260], [0, 12, -120]);
}

const minimap = createMinimap(document.getElementById('minimap'), city);
const hud = createHud();

let presetName = 'day';
function setPreset(name) {
  if (name === 'cycle') {
    const i = PRESET_ORDER.indexOf(presetName);
    name = PRESET_ORDER[(i + 1) % PRESET_ORDER.length];
  }
  presetName = name;
  renderer.setPreset(name);
  headlightsOn = name === 'night';
}
const input = createInput(canvas, camera, setPreset);
// Dragging while driving looks around from the chase camera instead of
// orbiting the free camera; the offset springs back to behind the car.
input.setOrbitHandler((dx, dy) => {
  if (driving) {
    camYawOffset += dx * 0.005;
    camera.pitch = Math.min(1.0, Math.max(0.05, camera.pitch - dy * 0.002));
  } else {
    camera.orbit(dx, dy);
  }
});

// One fixed step of the world. `held` is the set of codes down this step;
// `pressed` is the list of codes that went down at its start. The live
// loop feeds it the real input; the tests feed it scripted keys.
function step(dt, held, pressed) {
  simTime += dt;
  for (const code of pressed) {
    if (code === 'KeyE') {
      if (player.onFoot) {
        const car = vehicles.nearestCar(player.x, player.z, 6);
        if (car) {
          player.car = car;
          player.onFoot = false;
          followOnFoot = false;
          car.kind = 'player';
          driving = true;
          if (camera.dist > 40) camera.dist = 18;
          if (camera.pitch < 0.15) camera.pitch = 0.3;
        }
      } else if (player.car) {
        const car = player.car;
        vehicles.leaveCar(car, player);
        // Stage E: a car left in a garage bay is stored, not parked on
        // the street — take it back out with G.
        if (garages.inside(car.x, car.z)) {
          garages.store(car);
          missions.notify(car.name + ' stored in the garage.');
        } else {
          car.kind = 'parked';
        }
        player.car = null;
        player.onFoot = true;
        followOnFoot = true;
        driving = false;
        if (camera.dist > 40) camera.dist = 18;
        if (camera.pitch < 0.15) camera.pitch = 0.3;
      }
    }
    if (code === 'KeyH') headlightsOn = !headlightsOn;
    if (code === 'KeyM') missions.accept();
    if (code === 'KeyQ') missions.interact();
    if (code === 'KeyX') missions.dropCargo();
    if (code === 'KeyR' && !player.onFoot) radio.next();
    if (code === 'KeyG' && player.onFoot) {
      const bay = garages.inside(player.x, player.z);
      const stored = bay && garages.retrieve();
      if (stored) {
        const car = vehicles.makeCar(stored.profile, bay.x, bay.z, bay.heading, 'player');
        car.color = stored.color;
        player.car = car;
        player.onFoot = false;
        followOnFoot = false;
        driving = true;
        if (camera.dist > 40) camera.dist = 18;
        if (camera.pitch < 0.15) camera.pitch = 0.3;
      }
    }
  }
  if (player.onFoot) {
    // Stage D: WASD walks Mara on the ground, relative to the camera, and
    // the camera follows her. (As first written, WASD only slid the
    // camera and Mara never moved — she even spawned in the canal at
    // (0, 200).) The walk is blocked by buildings, street furniture, cars
    // and water, the same collision the cars use, with an axis-separated
    // slide along walls. Until she first walks, the camera keeps the
    // opening overview instead of snapping to her.
    let fwd = 0, strafe = 0;
    if (held.has('KeyW') || held.has('ArrowUp')) fwd += 1;
    if (held.has('KeyS') || held.has('ArrowDown')) fwd -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) strafe += 1;
    if (held.has('KeyA') || held.has('ArrowLeft')) strafe -= 1;
    if (fwd || strafe) {
      followOnFoot = true;
      if (camera.dist > 40) {
        camera.dist = 20;
        if (camera.pitch < 0.3) camera.pitch = 0.3;
      }
      const f = camera.forward();
      const r = camera.right();
      let dx = f[0] * fwd + r[0] * strafe;
      let dz = f[2] * fwd + r[2] * strafe;
      const len = Math.hypot(dx, dz);
      if (len > 0) {
        dx = (dx / len) * WALK_SPEED * dt;
        dz = (dz / len) * WALK_SPEED * dt;
        player.heading = Math.atan2(dx, dz);
        // A 1x1 probe against the vehicle collision grid: buildings,
        // lamps, trees, other cars, water and the city edge.
        const probe = { length: 1.0, width: 1.0, heading: 0 };
        const nx = player.x + dx, nz = player.z + dz;
        if (!vehicles.collidesAt(probe, nx, nz, null)) {
          player.x = nx; player.z = nz;
        } else if (!vehicles.collidesAt(probe, nx, player.z, null)) {
          player.x = nx;
        } else if (!vehicles.collidesAt(probe, player.x, nz, null)) {
          player.z = nz;
        }
      }
    }
    if (followOnFoot) camera.target = [player.x, 10, player.z];
  } else if (player.car) {
    // The drive model takes throttle/brake/steer, not key codes. A hard
    // hit (blocked while fast) hurts: the police count it as reckless.
    const speedBefore = Math.abs(player.car.speed);
    const blocked = vehicles.driveCar(player.car, dt, {
      throttle: held.has('KeyW') || held.has('ArrowUp'),
      brake: held.has('KeyS') || held.has('ArrowDown'),
      steer: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
        (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
    });
    if (blocked && speedBefore > 15) {
      police.damage(12);
      police.addHeat(20);
    }
  }
  traffic.update(dt, simTime, player.car);
  police.update(dt);
  missions.update(dt);
  // Chase camera: sit behind the car, look past it, and let the mouse
  // drag the view around while the car keeps its heading. The yaw,
  // pitch and distance are set directly — placing the camera would feed
  // the eye height back into the distance and drift outward every frame.
  if (!player.onFoot && player.car) {
    const c = player.car;
    camera.yaw = c.heading + Math.PI + camYawOffset;
    camera.dist = Math.max(camera.dist, 14);
    camera.pitch = Math.max(0.15, Math.min(1.0, camera.pitch));
    camera.target = [c.x + Math.sin(c.heading) * 8, 1.5, c.z + Math.cos(c.heading) * 8];
    camYawOffset *= Math.pow(0.2, dt);
  }
}
function setSignalsGreen(on) {
  traffic.setAllGreen(on);
}

// Stage the camera from the URL, or start on the title screen at sunset.
const shot = SHOTS[params.get('shot') || ''];
if (shot) {
  setPreset(shot.preset);
  if (shot.title) {
    titleActive = true;
    document.body.classList.add('title');
  }
  if (shot.drive) {
    const car = vehicles.makeCar(shot.car.profile, shot.car.x, shot.car.z, shot.car.heading, 'player');
    player.car = car;
    player.onFoot = false;
    driving = true;
    if (shot.cruise) {
      // A staged drive shot shows the car moving, not parked: rolling
      // speed now, and the frame loop holds the throttle for it.
      car.speed = 18;
      shotAutoDrive = true;
    }
    if (shot.pursuer) {
      vehicles.makeCar(shot.pursuer.profile, shot.pursuer.x, shot.pursuer.z, shot.pursuer.heading, 'traffic');
    }
  }
  camera.place(shot.eye, shot.target);
  if (shot.drive) { camera.dist = shot.dist || 18; camera.pitch = shot.pitch !== undefined ? shot.pitch : 0.3; }
  if (shot.mission) {
    // The finale shot jumps the story to its hold step (see
    // missions.stageFinale); every other shot accepts the next mission.
    if (shot.finale) missions.stageFinale();
    else missions.accept(shot.mission);
  }
  if (shot.police) {
    // Two stars, two patrol cars closing in behind the coupe. Warm the
    // world a few steps so the patrol cars spawn, then pull the nearest
    // one into the lane ahead of the player car: behind the chase
    // camera it would never be seen, but ahead it sits in the
    // headlight beam with its light bar flashing.
    police.enable();
    police.setWanted(2);
    for (let i = 0; i < 3; i++) step(0.05, new Set(), []);
    const pcs = police.policeCars();
    if (pcs.length > 0) {
      const near = pcs[0];
      near.x = shot.car.x + 2; near.z = shot.car.z + 30;
      near.heading = shot.car.heading; near.speed = 8;
    }
  }
} else {
  const cam = params.get('cam');
  const tgt = params.get('target');
  if (cam && tgt) {
    setPreset(params.get('preset') || 'day');
    camera.place(cam.split(',').map(Number), tgt.split(',').map(Number));
  } else if (params.get('test')) {
    setPreset(params.get('preset') || 'day');
    camera.place([-60, 16, 260], [0, 12, -120]);
  } else {
    // Stage F: the game opens on the title screen — Solmar at sunset,
    // traffic moving, HUD hidden until Enter.
    setPreset('sunset');
    camera.place([-700, 9, -1420], [-1300, 10, -1520]);
    titleActive = true;
    document.body.classList.add('title');
  }
}
if (params.get('haze') === 'off') renderer.setHazeEnabled(false);
if (params.get('freeze') === '1') traffic.freezeForTest();

// Queue every moving thing for this frame: cars, people, signals.
// Cars use their profile tint; signal lamps glow only on the active lamp.
function queueDynamic(time) {
  renderer.beginFrame();
  const R = renderer;
  for (const car of vehicles.cars) {
    const m = R.model(car.x, car.y, car.z, car.heading);
    R.queueDynamic(R.dynMeshes['car_' + car.profile], m, {
      tint: R.hexToRgb(car.color), shininess: 60,
    });
    R.queueDynamic(R.dynMeshes['wheels_' + car.profile], m, {
      tint: [0.08, 0.08, 0.09], shininess: 4,
    });
  }
  for (const p of traffic.pedestrians) {
    const bob = Math.abs(Math.sin(p.phase)) * 0.12;
    const m = R.model(p.x, bob, p.z, p.heading);
    R.queueDynamic(R.dynMeshes.pedBody, m, {
      tint: R.hexToRgb(p.shirt), shininess: 8,
    });
    R.queueDynamic(R.dynMeshes.pedLegs, m, {
      tint: [0.16, 0.2, 0.24], shininess: 4,
    });
  }
  // Stage D: Mara on foot — a coral-jacket figure with the same
  // pedestrian meshes, so the walk is visible in the world.
  if (player.onFoot) {
    const m = R.model(player.x, vehicles.groundHeightAt(player.x, player.z), player.z, player.heading);
    R.queueDynamic(R.dynMeshes.pedBody, m, {
      tint: [0.84, 0.5, 0.41], shininess: 8,
    });
    R.queueDynamic(R.dynMeshes.pedLegs, m, {
      tint: [0.08, 0.18, 0.22], shininess: 4,
    });
  }
  for (const inter of traffic.intersections) {
    const pole = R.model(inter.x + 14, 0, inter.z + 14, 0);
    R.queueDynamic(R.dynMeshes.sigPole, pole, { tint: [0.2, 0.22, 0.24], shininess: 6 });
    const heads = [
      { axis: 'EW', heading: -Math.PI / 2, st: traffic.stateFor(inter.x, inter.z, 'EW', time) },
      { axis: 'NS', heading: Math.PI, st: traffic.stateFor(inter.x, inter.z, 'NS', time) },
    ];
    for (const h of heads) {
      const m = R.model(inter.x + 14, 0, inter.z + 14, h.heading);
      R.queueDynamic(R.dynMeshes.sigHead, m, { tint: [0.12, 0.13, 0.14], shininess: 4 });
      const slot = h.st === 'red' ? 7.3 : h.st === 'yellow' ? 6.9 : 6.5;
      const lampColors = { red: [1, 0.1, 0.08], yellow: [1, 0.75, 0.1], green: [0.15, 0.9, 0.3] };
      // The lamp sits on the head's face (local +z, 0.4 out), at the slot
      // height for its colour; the active one glows, the rest are dark.
      for (const [name, y] of [['red', 7.3], ['yellow', 6.9], ['green', 6.5]]) {
        const lm = mat4Lamp(R, inter, h.heading, y);
        const active = name === h.st;
        R.queueDynamic(R.dynMeshes.sigLamp, lm, {
          tint: active ? lampColors[name] : [0.1, 0.1, 0.1],
          emissiveTint: active ? lampColors[name] : [0, 0, 0],
          shininess: 2,
        });
      }
    }
  }
  // Stage C: the mission marker beam over the current objective, and the
  // dropped-cargo crate where the player left it.
  const mark = missions.marker();
  if (mark) {
    R.queueDynamic(R.dynMeshes.marker, R.model(mark[0], 0, mark[1], 0), {
      tint: [0.84, 0.5, 0.41], emissiveTint: [0.84, 0.5, 0.41], shininess: 2,
    });
  }
  const crate = missions.cratePoint();
  if (crate) {
    R.queueDynamic(R.dynMeshes.crate, R.model(crate[0], 0, crate[1], 0), {
      tint: [0.22, 0.56, 0.6], emissiveTint: [0.22, 0.56, 0.6], shininess: 8,
    });
  }
  // Stage E: the garage bays — teal slabs with a back wall at each spot.
  for (const g of GARAGES) {
    R.queueDynamic(R.dynMeshes.garagePad, R.model(g.x, 0.1, g.z, g.heading), {
      tint: [0.22, 0.56, 0.6], shininess: 8,
    });
  }
  // Stage E: police light bars. Two small boxes on the roof, red left and
  // blue right, swapping every third of a second so the bar flashes.
  const barPhase = Math.floor(simTime * 3) % 2 === 0;
  const red = [1, 0.1, 0.08], blue = [0.1, 0.3, 1];
  for (const car of police.policeCars()) {
    const c = Math.cos(car.heading), s = Math.sin(car.heading);
    for (const [side, on] of [[-0.45, barPhase], [0.45, !barPhase]]) {
      const bx = car.x + side * c;
      const bz = car.z - side * s;
      const tint = side < 0 ? red : blue;
      R.queueDynamic(R.dynMeshes.policeBar, R.model(bx, car.y + 1.5, bz, car.heading), {
        tint: on ? tint : [0.15, 0.15, 0.16],
        emissiveTint: on ? tint : [0, 0, 0],
        shininess: 2,
      });
    }
  }
}

// Model matrix for a signal lamp: the head is rotated by `heading` around
// the pole, the lamp hangs 0.4 out from its face at height `y`.
function mat4Lamp(R, inter, heading, y) {
  const px = inter.x + 14, pz = inter.z + 14;
  const lx = px + Math.sin(heading) * 0.4;
  const lz = pz + Math.cos(heading) * 0.4;
  return R.model(lx, y, lz, heading);
}

// The headlight list for the frame: the player's car when its lights are
// on, plus the three nearest traffic cars when it is night.
function headlightList() {
  const list = [];
  if (!player.onFoot && player.car && headlightsOn) {
    list.push({ car: player.car, on: true });
  }
  if (presetName === 'night') {
    const near = [...traffic.traffic]
      .sort((a, b) => {
        const da = Math.hypot(a.car.x - camera.target[0], a.car.z - camera.target[2]);
        const db = Math.hypot(b.car.x - camera.target[0], b.car.z - camera.target[2]);
        return da - db;
      })
      .slice(0, 3);
    for (const t of near) list.push({ car: t.car, on: true });
  }
  return list.map(({ car, on }) => {
    const fwd = [Math.sin(car.heading), 0, Math.cos(car.heading)];
    const half = car.length / 2 + 0.1;
    return {
      on,
      pos: [
        car.x + fwd[0] * half,
        car.y + 0.75,
        car.z + fwd[2] * half,
      ],
      dir: [fwd[0] * 0.998, -0.07, fwd[2] * 0.998],
    };
  });
}

function renderFrame(time) {
  const eye = camera.eye();
  renderer.setCamera(eye, camera.target);
  renderer.setHeadlights(headlightList());
  queueDynamic(simTime);
  renderer.render(time);
}

// The test harness interface: the tests drive this same world through
// fixed steps and read the framebuffer back.
const game = {
  resetTest() {
    vehicles.reset();
    traffic.reset();
    missions.reset();
    police.reset(); // the police are off in tests unless a test opts in
    garages.reset();
    radio.reset();
    // Stage D: Mara starts on the x = 200 street, not in the canal — the
    // old (0, 200) spawn sat in the water at x = 0.
    player.x = 200; player.z = 200; player.heading = 0;
    player.onFoot = true; player.car = null;
    driving = false;
    followOnFoot = false;
    headlightsOn = false;
    simTime = 0;
  },
  spawnCar(profile, x, z, heading, kind) {
    return vehicles.makeCar(profile, x, z, heading, kind);
  },
  removeCar(car) { vehicles.removeCar(car); },
  enterCar(car) {
    player.car = car; player.onFoot = false; car.kind = 'player'; driving = true;
    followOnFoot = false;
  },
  exitCar() {
    player.car = null; player.onFoot = true; driving = false;
    followOnFoot = true;
    if (camera.dist > 40) camera.dist = 18;
    if (camera.pitch < 0.15) camera.pitch = 0.3;
  },
  player() { return player; },
  step,
  setSignalsGreen,
  setSignalOverride(ix, iz, state) { traffic.setOverride(ix, iz, state); },
  clearSignalOverrides() { traffic.clearOverrides(); },
  setPreset,
  preset() { return presetName; },
  headlightsOn() { return headlightsOn; },
  cameraTarget() { return [...camera.target]; },
  setHaze(on) { renderer.setHazeEnabled(on); },
  setHeadlightsOn(on) { headlightsOn = on; },
  setCamera(eye, target) { camera.place(eye, target); },
  renderFrame(time) { renderFrame(time); },
  projectPoint(p) { return renderer.projectPoint(p); },
  readPixels(x, y, w, h) {
    // x, y are top-origin (as projectPoint returns); WebGL reads from
    // the bottom, so the row is flipped here.
    const gl = renderer.gl;
    const data = new Uint8Array(w * h * 4);
    gl.readPixels(x, canvas.height - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
  },
  traffic,
  vehicles,
  missions,
  police,
  garages,
  radio,
};
const tests = createTests(game);
window.__palkon.step = step;
window.__palkon.game = game; // debug interface: the tests drive this world
window.__palkon.state = () => ({
  title: titleActive,
  player: { x: player.x, z: player.z, onFoot: player.onFoot, car: player.car ? player.car.id : null },
  cars: vehicles.cars.length,
  traffic: traffic.traffic.length,
  pedestrians: traffic.pedestrians.length,
  headlightsOn,
  preset: presetName,
  missions: missions.status(),
  wanted: police.status().wanted,
  health: police.status().health,
  station: radio.station(),
  garageStored: garages.status().count,
});
window.__palkon.runDriveTest = () => tests.driveTest();
window.__palkon.runHeadlightTest = (haze) => tests.headlightTest(haze);
window.__palkon.runMissionTest = () => tests.missionTest();
window.__palkon.runWalkTest = () => tests.walkTest();
window.__palkon.runPoliceTest = () => tests.policeTest();
window.__palkon.runGarageTest = () => tests.garageTest();
window.__palkon.runRadioTest = () => tests.radioTest();
window.__palkon.runDensityCheck = () => tests.densityCheck();
window.__palkon.startTitle = startGame;
function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let frames = 0;
let fps = 0;
let fpsTime = last;
let hudTime = last;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  if (now - fpsTime >= 1000) {
    fps = (frames * 1000) / (now - fpsTime);
    frames = 0;
    fpsTime = now;
  }
  const pressed = input.takePressed();
  if (titleActive) {
    // The living-city title: the world runs and traffic moves, the
    // player idles, and the camera drifts slowly across the sunset
    // street. Enter starts the game; the HUD stays hidden until then.
    if (pressed.includes('Enter') || pressed.includes('NumpadEnter')) startGame();
    step(dt, new Set(), []);
    camera.yaw += dt * 0.012;
  } else {
    const held = new Set(input.keys);
    if (shotAutoDrive) held.add('KeyW'); // staged drive shots keep rolling
    step(dt, held, pressed);
  }
  renderFrame(now / 1000);
  if (titleActive) {
    if (!window.__palkon.ready) {
      window.__palkon.ready = true;
      const eyeNow = camera.eye();
      document.getElementById('status').textContent =
        'DBG eye=' + eyeNow.map((v) => v.toFixed(1)).join(',') +
        ' target=' + camera.target.map((v) => v.toFixed(1)).join(',') +
        ' yaw=' + camera.yaw.toFixed(3) + ' pitch=' + camera.pitch.toFixed(3) +
        ' dist=' + camera.dist.toFixed(1) + ' preset=' + presetName;
    }
    requestAnimationFrame(frame);
    return;
  }
  minimap.draw(camera, vehicles.cars, player, missions.marker());
  if (now - hudTime >= 250) {
    // The prompt line combines the mission hints (Q/X) with the driving
    // hints (E/H) so the player always sees what they can do here.
    let prompt = missions.prompt();
    const drivePrompt = player.onFoot
      ? (vehicles.nearestCar(player.x, player.z, 6) ? 'E — Get in the car' : '')
      : 'E — Get out · H — Headlights ' + (headlightsOn ? 'on' : 'off');
    if (prompt && drivePrompt) prompt += ' · ' + drivePrompt;
    else if (!prompt) prompt = drivePrompt;
    // Stage E: the garage prompt when standing in a bay with a stored car.
    if (player.onFoot) {
      const bay = garages.inside(player.x, player.z);
      if (bay && garages.status().count > 0) {
        const next = garages.status().stored[garages.status().count - 1];
        const gp = 'G — Take the ' + next + ' from the garage';
        prompt = prompt ? prompt + ' · ' + gp : gp;
      }
    }
    hud.update(camera, presetName, fps, {
      speedKmh: player.car ? Math.abs(player.car.speed) * 3.6 : 0,
      profile: player.car ? player.car.profile : null,
      onFoot: player.onFoot,
      headlightsOn,
      nearCar: player.onFoot && !!vehicles.nearestCar(player.x, player.z, 6),
      cash: missions.cash,
      objective: missions.objectiveText(),
      banner: missions.bannerText(),
      prompt,
      wanted: police.status().wanted,
      health: police.status().health,
      station: radio.isPlaying() ? radio.station() : null,
    });
    hudTime = now;
  }
  if (!window.__palkon.ready) {
    window.__palkon.ready = true;
    const eyeNow = camera.eye();
    document.getElementById('status').textContent =
      'DBG eye=' + eyeNow.map((v) => v.toFixed(1)).join(',') +
      ' target=' + camera.target.map((v) => v.toFixed(1)).join(',') +
      ' yaw=' + camera.yaw.toFixed(3) + ' pitch=' + camera.pitch.toFixed(3) +
      ' dist=' + camera.dist.toFixed(1) + ' preset=' + presetName;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
