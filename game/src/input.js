// Keyboard and mouse for Solmar. WASD moves the camera on foot and drives
// the car in it, drag orbits, wheel zooms, 1/2/3 switch the light
// (midday / sunset / night), T cycles it, E enters and exits a car,
// H toggles the headlights. The main loop reads the keys and the
// just-pressed codes each step, so the same input drives the live game
// and the scripted tests.
export function createInput(canvas, camera, onPreset) {
  const keys = new Set();
  const pressed = new Set();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let orbitHandler = null;

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
    if (e.code === 'Digit1') onPreset('day');
    if (e.code === 'Digit2') onPreset('sunset');
    if (e.code === 'Digit3') onPreset('night');
    if (e.code === 'KeyT') onPreset('cycle');
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (orbitHandler) orbitHandler(e.clientX - lastX, e.clientY - lastY);
    else camera.orbit(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom(e.deltaY);
  }, { passive: false });

  // Codes that went down since the last frame; the main loop drains them
  // once per step and the set empties.
  function takePressed() {
    const out = [...pressed];
    pressed.clear();
    return out;
  }

  return { keys, takePressed, setOrbitHandler(fn) { orbitHandler = fn; } };
}
