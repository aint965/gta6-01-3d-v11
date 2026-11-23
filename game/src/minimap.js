// The minimap: a native 2D canvas in the corner of the screen. It draws
// Solmar's plan from the same city data the 3D view uses: district tints,
// the bay and canal water, the park, the streets, every building footprint,
// and the camera marker with its heading wedge.
import { PARK, CANAL, BAY, EAST_SEA } from './city.js';

const W = 220;
const H = 198;

export function createMinimap(canvas, city) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sx = (x) => ((x + 1920) / 3840) * W;
  const sz = (z) => ((z + 1728) / 3456) * H;

  function draw(camera, cars, player, marker) {
    ctx.fillStyle = '#142d38';
    ctx.fillRect(0, 0, W, H);
    // District tints.
    for (const d of city.districts) {
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(sx(d.x0), sz(d.z0), sx(d.x1) - sx(d.x0), sz(d.z1) - sz(d.z0));
    }
    ctx.globalAlpha = 1;
    // Water: the bay, the east sea and the canal.
    ctx.fillStyle = '#398e99';
    ctx.fillRect(sx(BAY.x0), sz(BAY.z0), sx(BAY.x1) - sx(BAY.x0), sz(BAY.z1) - sz(BAY.z0));
    ctx.fillRect(sx(EAST_SEA.x0), sz(EAST_SEA.z0), sx(EAST_SEA.x1) - sx(EAST_SEA.x0), sz(EAST_SEA.z1) - sz(EAST_SEA.z0));
    ctx.fillRect(sx(CANAL.x0), sz(CANAL.z0), sx(CANAL.x1) - sx(CANAL.x0), sz(CANAL.z1) - sz(CANAL.z0));
    // Park.
    ctx.fillStyle = '#56856b';
    ctx.fillRect(sx(PARK.x0), sz(PARK.z0), sx(PARK.x1) - sx(PARK.x0), sz(PARK.z1) - sz(PARK.z0));
    // Streets.
    ctx.strokeStyle = 'rgba(20,45,56,0.85)';
    ctx.lineWidth = 1;
    for (const s of city.streets) {
      ctx.beginPath();
      if (s.axis === 'x') { ctx.moveTo(sx(s.at), 0); ctx.lineTo(sx(s.at), H); }
      else { ctx.moveTo(0, sz(s.at)); ctx.lineTo(W, sz(s.at)); }
      ctx.stroke();
    }
    // Building footprints.
    ctx.fillStyle = 'rgba(20,45,56,0.75)';
    for (const b of city.buildings) {
      ctx.fillRect(sx(b.x - b.w / 2), sz(b.z - b.d / 2), Math.max(1, sx(b.x + b.w / 2) - sx(b.x - b.w / 2)), Math.max(1, sz(b.z + b.d / 2) - sz(b.z - b.d / 2)));
    }
    // Bridges.
    ctx.fillStyle = '#ead8b2';
    for (const z of [-900, 0, 900]) ctx.fillRect(sx(-110), sz(z - 20), sx(110) - sx(-110), sz(z + 20) - sz(z - 20));
    // Camera marker: a coral triangle pointing where the camera looks.
    const eye = camera.eye();
    const tx = camera.target[0];
    const tz = camera.target[2];
    const mx = sx(tx);
    const my = sz(tz);
    const ang = Math.atan2(eye[0] - tx, eye[2] - tz);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang + Math.PI);
    ctx.fillStyle = '#d77f69';
    ctx.strokeStyle = '#ead8b2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Cars: the player's car is coral with a pale ring, traffic is pale,
    // parked cars are dim, police are blue. A 3-pixel square at this scale
    // is a car. A pursuer tailing the player is red.
    for (const car of cars) {
      const isPlayer = player && car === player.car;
      ctx.fillStyle = car.pursuer ? '#e5484d' : car.police ? '#5aa9e6' : isPlayer ? '#d77f69' : car.kind === 'traffic' ? '#ead8b2' : 'rgba(234,216,178,0.45)';
      const cx = sx(car.x), cy = sz(car.z);
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      if (isPlayer) {
        ctx.strokeStyle = '#ead8b2';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 3.5, cy - 3.5, 7, 7);
      }
    }
    // The player on foot is a pale dot.
    if (player && player.onFoot) {
      ctx.fillStyle = '#ead8b2';
      ctx.beginPath();
      ctx.arc(sx(player.x), sz(player.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The mission objective: a pulsing coral diamond.
    if (marker) {
      const mx = sx(marker[0]), my = sz(marker[1]);
      const pulse = 1 + 0.25 * Math.sin(performance.now() / 300);
      ctx.fillStyle = '#d77f69';
      ctx.strokeStyle = '#ead8b2';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, my - 7 * pulse);
      ctx.lineTo(mx + 5 * pulse, my);
      ctx.lineTo(mx, my + 7 * pulse);
      ctx.lineTo(mx - 5 * pulse, my);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Frame.
    ctx.strokeStyle = '#ead8b2';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  return { draw };
}
