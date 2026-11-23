// Palkon Auto — Stage A: the city, the light and the camera.
// Stage B adds the drive: four car profiles, traffic on lane loops,
// working signals, pedestrians, headlights, entry and exit.
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
import { createTests } from './tests.js';

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
    car: { profile: 'coupe', x: 200, z: 300, heading: 0 },
    eye: [200, 4.5, 266],
    target: [200, 2, 330],
  },
  'night-pursuit': {
    preset: 'night',
    drive: true,
    car: { profile: 'coupe', x: 200, z: 300, heading: 0 },
    // The pursued car, ahead in the lane and slightly right: the
    // player's headlights catch its paint in the shot.
    pursuer: { profile: 'sedan', x: 202, z: 326, heading: 0 },
    eye: [216, 5, 258],
    target: [198, 2, 330],
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

// The player walks or drives. On foot the camera orbits freely; in a car
// it follows from behind and the same keys drive instead of walking.
const player = {
  x: 0, z: 200, heading: 0,
  onFoot: true,
  car: null,
};
let headlightsOn = false;
let camYawOffset = 0; // mouse drag while driving: look around, springs back
let driving = false;
let simTime = 0; // simulation clock: drives the signal cycle and the tests

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
          car.kind = 'player';
          driving = true;
          if (camera.dist > 40) camera.dist = 18;
          if (camera.pitch < 0.15) camera.pitch = 0.3;
        }
      } else if (player.car) {
        vehicles.leaveCar(player.car, player);
        player.car.kind = 'parked';
        player.car = null;
        player.onFoot = true;
        driving = false;
      }
    }
    if (code === 'KeyH') headlightsOn = !headlightsOn;
  }
  if (player.onFoot) {
    let fwd = 0, strafe = 0;
    if (held.has('KeyW') || held.has('ArrowUp')) fwd += 1;
    if (held.has('KeyS') || held.has('ArrowDown')) fwd -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) strafe += 1;
    if (held.has('KeyA') || held.has('ArrowLeft')) strafe -= 1;
    camera.move(fwd, strafe, 30 * dt);
  } else if (player.car) {
    // The drive model takes throttle/brake/steer, not key codes.
    vehicles.driveCar(player.car, dt, {
      throttle: held.has('KeyW') || held.has('ArrowUp'),
      brake: held.has('KeyS') || held.has('ArrowDown'),
      steer: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
        (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
    });
  }
  traffic.update(dt, simTime, player.car);
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

// Stage the camera from the URL, or start on the canal bridge at midday.
const shot = SHOTS[params.get('shot') || ''];
if (shot) {
  setPreset(shot.preset);
  if (shot.drive) {
    const car = vehicles.makeCar(shot.car.profile, shot.car.x, shot.car.z, shot.car.heading, 'player');
    player.car = car;
    player.onFoot = false;
    driving = true;
    if (shot.pursuer) {
      vehicles.makeCar(shot.pursuer.profile, shot.pursuer.x, shot.pursuer.z, shot.pursuer.heading, 'traffic');
    }
  }
  camera.place(shot.eye, shot.target);
  if (shot.drive) { camera.dist = 18; camera.pitch = 0.3; }
} else {
  setPreset(params.get('preset') || 'day');
  const cam = params.get('cam');
  const tgt = params.get('target');
  if (cam && tgt) {
    camera.place(cam.split(',').map(Number), tgt.split(',').map(Number));
  } else {
    camera.place([-60, 16, 260], [0, 12, -120]);
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
    player.x = 0; player.z = 200; player.heading = 0;
    player.onFoot = true; player.car = null;
    driving = false;
    headlightsOn = false;
    simTime = 0;
  },
  spawnCar(profile, x, z, heading, kind) {
    return vehicles.makeCar(profile, x, z, heading, kind);
  },
  removeCar(car) { vehicles.removeCar(car); },
  enterCar(car) {
    player.car = car; player.onFoot = false; car.kind = 'player'; driving = true;
  },
  exitCar() { player.car = null; player.onFoot = true; driving = false; },
  player() { return player; },
  step,
  setSignalsGreen,
  setSignalOverride(ix, iz, state) { traffic.setOverride(ix, iz, state); },
  clearSignalOverrides() { traffic.clearOverrides(); },
  setPreset,
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
};
const tests = createTests(game);
window.__palkon.step = step;
window.__palkon.game = game; // debug interface: the tests drive this world
window.__palkon.state = () => ({
  player: { x: player.x, z: player.z, onFoot: player.onFoot, car: player.car ? player.car.id : null },
  cars: vehicles.cars.length,
  traffic: traffic.traffic.length,
  pedestrians: traffic.pedestrians.length,
  headlightsOn,
  preset: presetName,
});
window.__palkon.runDriveTest = () => tests.driveTest();
window.__palkon.runHeadlightTest = (haze) => tests.headlightTest(haze);
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
  step(dt, input.keys, pressed);
  renderFrame(now / 1000);
  minimap.draw(camera, vehicles.cars, player);
  if (now - hudTime >= 250) {
    hud.update(camera, presetName, fps, {
      speedKmh: player.car ? Math.abs(player.car.speed) * 3.6 : 0,
      profile: player.car ? player.car.profile : null,
      onFoot: player.onFoot,
      headlightsOn,
      nearCar: player.onFoot && !!vehicles.nearestCar(player.x, player.z, 6),
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
