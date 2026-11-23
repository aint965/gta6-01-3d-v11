// The HUD: title, district, light preset, frame rate and controls, as
// plain DOM over the canvas. Nothing here loads over the network.
// While driving it also shows the speed and the car profile; on foot it
// shows the entry prompt when a car is close. Stage C adds the cash total,
// the current mission objective, and a banner for mission events.
import { districtAtPoint } from './city.js';

export function createHud() {
  const title = document.getElementById('hud-title');
  const district = document.getElementById('hud-district');
  const preset = document.getElementById('hud-preset');
  const fps = document.getElementById('hud-fps');
  const clock = document.getElementById('hud-clock');
  const speed = document.getElementById('hud-speed');
  const prompt = document.getElementById('hud-prompt');
  const cash = document.getElementById('hud-cash');
  const mission = document.getElementById('hud-mission');
  const banner = document.getElementById('hud-banner');
  const wanted = document.getElementById('hud-wanted');
  const health = document.getElementById('hud-health');
  const station = document.getElementById('hud-station');

  const CLOCK = { day: '12:00', sunset: '18:40', night: '23:15' };

  function update(camera, presetName, frameRate, drive) {
    if (district) district.textContent = districtAtPoint(camera.target[0], camera.target[2]);
    if (preset) preset.textContent = presetName === 'day' ? 'Midday' : presetName === 'sunset' ? 'Sunset' : 'Night';
    if (fps) fps.textContent = frameRate.toFixed(0) + ' FPS';
    if (clock) clock.textContent = CLOCK[presetName] || '12:00';
    if (cash && drive) cash.textContent = 'Cash $' + (drive.cash || 0);
    if (wanted && drive) {
      const stars = drive.wanted || 0;
      wanted.textContent = stars ? '★'.repeat(stars) : '';
      wanted.style.display = stars ? '' : 'none';
    }
    if (health && drive) {
      const hp = drive.health === undefined ? 100 : drive.health;
      health.textContent = 'Health ' + hp;
      health.style.color = hp <= 30 ? '#e5484d' : '#7fb3c8';
    }
    if (station && drive) {
      const text = drive.station || '';
      station.textContent = text ? '♪ ' + text : '';
      station.style.display = text ? '' : 'none';
    }
    if (mission && drive) {
      const text = drive.objective || '';
      mission.textContent = text;
      mission.style.display = text ? '' : 'none';
    }
    if (banner && drive) {
      const text = drive.banner || '';
      banner.textContent = text;
      banner.style.display = text ? '' : 'none';
    }
    if (speed) {
      if (drive && !drive.onFoot && drive.profile) {
        speed.textContent = drive.speedKmh.toFixed(0) + ' km/h · ' + drive.profile;
        speed.style.display = '';
      } else {
        speed.textContent = '';
        speed.style.display = 'none';
      }
    }
    if (prompt) {
      let text = '';
      // A combined prompt from the game (mission Q/X plus E/H) wins when
      // the game supplies one; otherwise the driving prompts apply.
      if (drive && drive.prompt !== undefined && drive.prompt !== null) {
        text = drive.prompt;
      } else if (drive && drive.onFoot) {
        text = drive.nearCar ? 'E — Get in the car' : '';
      } else if (drive && !drive.onFoot) {
        text = 'E — Get out · H — Headlights ' + (drive.headlightsOn ? 'on' : 'off');
      }
      prompt.textContent = text;
      prompt.style.display = text ? '' : 'none';
    }
  }

  if (title) title.textContent = 'PALKON AUTO';
  return { update };
}
