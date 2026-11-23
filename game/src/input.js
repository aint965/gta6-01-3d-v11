// Keyboard and mouse for Solmar. WASD moves, drag orbits, wheel zooms,
// 1/2/3 switch the light (midday / sunset / night), T cycles it.
export function createInput(canvas, camera, onPreset) {
  const keys = new Set();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    if (e.code === 'Digit1') onPreset('day');
    if (e.code === 'Digit2') onPreset('sunset');
    if (e.code === 'Digit3') onPreset('night');
    if (e.code === 'KeyT') onPreset('cycle');
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    camera.orbit(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom(e.deltaY);
  }, { passive: false });

  // Called every frame with the elapsed seconds.
  function update(dt) {
    const speed = 260 * dt * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.2 : 1);
    let fwd = 0;
    let strafe = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
    if (fwd !== 0 || strafe !== 0) camera.move(fwd, strafe, speed);
  }

  return { update, keys };
}
