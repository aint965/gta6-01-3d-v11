// Palkon Auto — Stage A: the city, the light and the camera.
// Boots the renderer, the minimap and the HUD, then runs the frame loop.
// URL parameters stage a view without touching the code:
//   ?preset=day|sunset|night   the light (1/2/3 or T in game)
//   ?cam=x,y,z&target=x,y,z    an exact camera placement
//   ?shot=day|sunset|night     a staged screenshot view
import { buildCity, verifyLayout, CITY_SEED } from './city.js';
import { createRenderer } from './renderer.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createMinimap } from './minimap.js';
import { createHud } from './hud.js';
import { PRESET_ORDER } from './lighting.js';

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
}
createInput(canvas, camera, setPreset);

// Stage the camera from the URL, or start on the canal bridge at midday.
const shot = SHOTS[params.get('shot') || ''];
if (shot) {
  setPreset(shot.preset);
  camera.place(shot.eye, shot.target);
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
  const eye = camera.eye();
  renderer.setCamera(eye, camera.target);
  renderer.render(now / 1000);
  minimap.draw(camera);
  if (now - hudTime >= 250) {
    hud.update(camera, presetName, fps);
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
