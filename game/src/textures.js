// Procedural textures for Solmar, painted on 2D canvases at boot.
// No image files, no network: every facade, the ground plan and the water
// detail are drawn here, so the game ships as code alone.
import { mulberry32, range, intRange } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// One facade tile: a 256x256 canvas standing for a 16x16 unit wall patch,
// with a 2x2 grid of windows. The emissive twin paints only the windows
// that are lit, so at night the same walls glow from inside.
function facadeTile(base, frame, litRatio, seed) {
  const rng = mulberry32(seed);
  const diffuse = canvas(256, 256);
  const d = diffuse.getContext('2d');
  d.fillStyle = base;
  d.fillRect(0, 0, 256, 256);
  // Subtle brick courses / panel shading.
  d.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < 256; y += 16) d.fillRect(0, y, 256, 2);
  const emissive = canvas(256, 256);
  const e = emissive.getContext('2d');
  e.fillStyle = '#000000';
  e.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const wx = 34 + col * 128;
      const wy = 34 + row * 128;
      const ww = 60;
      const wh = 76;
      // Window frame.
      d.fillStyle = frame;
      d.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
      // Dark glass by day, with a little variation between panes.
      d.fillStyle = ['#2a3d47', '#33454f', '#24343e'][intRange(rng, 0, 2)];
      d.fillRect(wx, wy, ww, wh);
      d.fillStyle = 'rgba(255,255,255,0.14)';
      d.fillRect(wx, wy, ww, 10);
      // A lit window glows warm at night.
      if (rng() < litRatio) {
        e.fillStyle = rng() < 0.7 ? '#ffb45e' : '#ffe6a8';
        e.fillRect(wx, wy, ww, wh);
        e.fillStyle = 'rgba(0,0,0,0.25)';
        e.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      }
    }
  }
  return { diffuse, emissive };
}

export function makeFacadeTextures() {
  return {
    brick: facadeTile('#bd7a54', '#8a5a3c', 0.35, 11),
    market: facadeTile('#c98a5a', '#8a5a34', 0.45, 23),
    house: facadeTile('#e0c9a0', '#a8895f', 0.5, 37),
    warehouse: facadeTile('#9a8f7a', '#6f6455', 0.25, 51),
    glass: facadeTile('#5d8b9b', '#2f4d5c', 0.55, 67),
    tower: facadeTile('#4e7d92', '#274b5c', 0.6, 83),
  };
}

// The whole city plan, painted once into a 2048x2048 canvas and laid on the
// ground plane: roads, sidewalks, district tints, the park, the beach sand
// and the plaza stone. World x maps to u, world z maps to v.
export function makeGroundTexture(city) {
  const S = 2048;
  const g = canvas(S, S);
  const ctx = g.getContext('2d');
  const px = (x) => ((x + 1920) / 3840) * S;
  const pz = (z) => ((z + 1728) / 3456) * S;
  const pw = (w) => (w / 3840) * S;

  // Limestone base.
  ctx.fillStyle = '#d9cba6';
  ctx.fillRect(0, 0, S, S);

  // District tints, faint so the plan reads as one city.
  for (const d of city.districts) {
    ctx.fillStyle = d.color + '22';
    ctx.fillRect(px(d.x0), pz(d.z0), pw(d.x1 - d.x0), pw(d.z1 - d.z0));
  }

  // Park lawn with paths.
  ctx.fillStyle = '#5d8a4f';
  ctx.fillRect(px(-550), pz(1000), pw(1100), pw(600));
  ctx.fillStyle = '#cbb98a';
  ctx.fillRect(px(-40), pz(1000), pw(80), pw(600));
  ctx.fillRect(px(-550), pz(1260), pw(1100), pw(60));
  ctx.fillStyle = '#4a7a44';
  for (let i = 0; i < 40; i++) {
    const rng = mulberry32(900 + i);
    ctx.beginPath();
    ctx.arc(px(range(rng, -500, 500)), pz(range(rng, 1040, 1560)), 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Beach sand on the east shore and the south-east corner.
  ctx.fillStyle = '#e8d9a8';
  ctx.fillRect(px(1760), pz(-1500), pw(160), pw(3228));
  ctx.fillRect(px(1600), pz(900), pw(320), pw(828));

  // Bay and canal beds (dark sand under the water planes).
  ctx.fillStyle = '#7d8a7a';
  ctx.fillRect(px(-1920), pz(-1728), pw(3840), pw(228));
  ctx.fillStyle = '#8a9a86';
  ctx.fillRect(px(-70), pz(-1728), pw(140), pw(3456));

  // Old Solmar plaza stone.
  ctx.fillStyle = '#c4b28a';
  ctx.fillRect(px(-1400), pz(-800), pw(500), pw(500));
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(px(-1400 + i * 50), pz(-800));
    ctx.lineTo(px(-1400 + i * 50), pz(-300));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px(-1400), pz(-800 + i * 50));
    ctx.lineTo(px(-900), pz(-800 + i * 50));
    ctx.stroke();
  }

  // Roads: asphalt with a pale centre line.
  ctx.fillStyle = '#3f444b';
  for (const s of city.streets) {
    if (s.axis === 'x') ctx.fillRect(px(s.at - 10), 0, pw(20), S);
    else ctx.fillRect(0, pz(s.at - 10), S, pw(20));
  }
  ctx.fillStyle = '#c9b98a';
  for (const s of city.streets) {
    if (s.axis === 'x') {
      for (let z = -1700; z < 1700; z += 60) ctx.fillRect(px(s.at - 1.5), pz(z), pw(3), pw(30));
    } else {
      for (let x = -1900; x < 1900; x += 60) ctx.fillRect(px(x), pz(s.at - 1.5), pw(30), pw(3));
    }
  }

  // Canal bridges: pale decks over the water.
  ctx.fillStyle = '#cbb98a';
  for (const b of [{ z: -900 }, { z: 0 }, { z: 900 }]) {
    ctx.fillRect(px(-110), pz(b.z - 20), pw(220), pw(40));
  }

  // Marina piers.
  ctx.fillStyle = '#8a6f4d';
  for (let k = 0; k < 5; k++) {
    ctx.fillRect(px(-1000 + k * 260 - 8), pz(-1650), pw(16), pw(150));
  }

  return g;
}
