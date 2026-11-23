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

  function draw(camera) {
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
    // Frame.
    ctx.strokeStyle = '#ead8b2';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  return { draw };
}
