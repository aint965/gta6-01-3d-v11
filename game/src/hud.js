// The HUD: title, district, light preset, frame rate and controls, as
// plain DOM over the canvas. Nothing here loads over the network.
import { districtAtPoint } from './city.js';

export function createHud() {
  const title = document.getElementById('hud-title');
  const district = document.getElementById('hud-district');
  const preset = document.getElementById('hud-preset');
  const fps = document.getElementById('hud-fps');
  const clock = document.getElementById('hud-clock');

  const CLOCK = { day: '12:00', sunset: '18:40', night: '23:15' };

  function update(camera, presetName, frameRate) {
    if (district) district.textContent = districtAtPoint(camera.target[0], camera.target[2]);
    if (preset) preset.textContent = presetName === 'day' ? 'Midday' : presetName === 'sunset' ? 'Sunset' : 'Night';
    if (fps) fps.textContent = frameRate.toFixed(0) + ' FPS';
    if (clock) clock.textContent = CLOCK[presetName] || '12:00';
  }

  if (title) title.textContent = 'PALKON AUTO';
  return { update };
}
