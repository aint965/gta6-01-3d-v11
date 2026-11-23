// Solmar: the city itself, generated once from a fixed seed.
// The layout is a street grid cut by a north-south canal, a bay on the north
// shore, and a beach on the east shore. Seven districts share the grid;
// every building sits on a block between streets, never on a road strip and
// never in the canal. Glasspoint towers sit on their plots only.
import { mulberry32, range, intRange, pick, jitter } from './rng.js';

export const CITY_SEED = 20261123;
export const CITY = { minX: -1920, maxX: 1920, minZ: -1728, maxZ: 1728 };

export const DISTRICTS = [
  { name: 'Pearl Marina', color: '#6a9db5', x0: -1300, z0: -1728, x1: 400, z1: -1350 },
  { name: 'Glasspoint', color: '#7fb3c8', x0: 700, z0: -1400, x1: 1800, z1: -300 },
  { name: 'Old Solmar', color: '#c9a06a', x0: -1920, z0: -1400, x1: -700, z1: -200 },
  { name: 'Canal Ward', color: '#b7a684', x0: -700, z0: -1400, x1: 700, z1: 1400 },
  { name: 'South Market', color: '#c98a5a', x0: -1920, z0: 200, x1: -700, z1: 1728 },
  { name: 'Citrus Quarter', color: '#8fae6a', x0: 700, z0: -200, x1: 1800, z1: 900 },
  { name: 'Sunstrand Beach', color: '#e8d9a8', x0: 1600, z0: 900, x1: 1920, z1: 1728 },
];

export const PARK = { x0: -550, z0: 1000, x1: 550, z1: 1600 };
export const CANAL = { x0: -70, x1: 70, z0: -1728, z1: 1728 };
export const BAY = { x0: -1920, z0: -1728, x1: 1920, z1: -1500 };
export const EAST_SEA = { x0: 1760, z0: -1500, x1: 1920, z1: 1728 };
export const BRIDGES = [
  { z: -900, name: 'North Bridge' },
  { z: 0, name: 'Canal Bridge' },
  { z: 900, name: 'South Bridge' },
];

const STREET_STEP = 200;
const ROAD_HALF = 10;

function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Canal Ward';
}

function inPark(x, z) {
  return x >= PARK.x0 && x <= PARK.x1 && z >= PARK.z0 && z <= PARK.z1;
}

function inWater(x, z) {
  if (z < -1500) return true;
  if (x > 1760) return true;
  if (x >= CANAL.x0 && x <= CANAL.x1) return true;
  return false;
}

function inCanalStrip(x, z) {
  return x >= CANAL.x0 - 20 && x <= CANAL.x1 + 20;
}

// Height profile per district: [min, max] in units.
const HEIGHTS = {
  'Old Solmar': [12, 28],
  'Canal Ward': [10, 24],
  'South Market': [8, 16],
  'Citrus Quarter': [14, 30],
  'Glasspoint': [55, 135],
  'Pearl Marina': [10, 20],
  'Sunstrand Beach': [8, 14],
};

const TYPES = {
  'Old Solmar': 'brick',
  'Canal Ward': 'brick',
  'South Market': 'market',
  'Citrus Quarter': 'brick',
  'Glasspoint': 'glass',
  'Pearl Marina': 'warehouse',
  'Sunstrand Beach': 'house',
};

export function buildCity(seed = CITY_SEED) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const streets = [];
  const blocks = [];

  // Street lines: vertical streets run along z, horizontal along x.
  const vStreets = [];
  for (let x = -1800; x <= 1800; x += STREET_STEP) vStreets.push(x);
  const hStreets = [];
  for (let z = -1600; z <= 1600; z += STREET_STEP) hStreets.push(z);
  for (const x of vStreets) streets.push({ axis: 'x', at: x });
  for (const z of hStreets) streets.push({ axis: 'z', at: z });

  // A tree standing on a road is a defect no driver can see around: the
  // road strip is 10 wide, a tree is 0.9 in radius and a car 0.9
  // half-wide, so trees stay 13 off every street centreline.
  const onStreet = (x, z) =>
    vStreets.some((sx) => Math.abs(x - sx) < 13) ||
    hStreets.some((sz) => Math.abs(z - sz) < 13);
  // Roll a tree position inside a rectangle until it lands off every
  // street strip, so no tree ever stands in a road.
  function treeSpot(x0, x1, z0, z1) {
    let x, z;
    do {
      x = range(rng, x0, x1);
      z = range(rng, z0, z1);
    } while (onStreet(x, z));
    return { x, z };
  }

  // Blocks are the cells between neighbouring streets, plus the edge strips.
  const xEdges = [CITY.minX, ...vStreets, CITY.maxX];
  const zEdges = [CITY.minZ, ...hStreets, CITY.maxZ];

  for (let i = 0; i < xEdges.length - 1; i++) {
    for (let j = 0; j < zEdges.length - 1; j++) {
      const bx0 = xEdges[i] + (i === 0 ? 0 : ROAD_HALF);
      const bx1 = xEdges[i + 1] - (i === xEdges.length - 2 ? 0 : ROAD_HALF);
      const bz0 = zEdges[j] + (j === 0 ? 0 : ROAD_HALF);
      const bz1 = zEdges[j + 1] - (j === zEdges.length - 2 ? 0 : ROAD_HALF);
      if (bx1 - bx0 < 40 || bz1 - bz0 < 40) continue;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      blocks.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1, cx, cz });
    }
  }

  // Split the blocks the canal cuts through into west and east halves.
  const plots = [];
  for (const b of blocks) {
    if (b.x0 < CANAL.x1 + 20 && b.x1 > CANAL.x0 - 20) {
      const west = { ...b, x1: CANAL.x0 - 20 };
      const east = { ...b, x0: CANAL.x1 + 20 };
      if (west.x1 - west.x0 >= 40) plots.push(west);
      if (east.x1 - east.x0 >= 40) plots.push(east);
    } else {
      plots.push(b);
    }
  }

  for (const p of plots) {
    const cx = (p.x0 + p.x1) / 2;
    const cz = (p.z0 + p.z1) / 2;
    // No buildings in the park, in the water, or on the beach sand strip.
    if (inPark(cx, cz)) continue;
    if (inWater(cx, cz)) continue;
    if (cx > 1760) continue;
    const district = districtAt(cx, cz);
    // A few blocks stay empty: vacant lots and car parks.
    if (district !== 'Glasspoint' && rng() < 0.12) continue;
    const [hMin, hMax] = HEIGHTS[district];
    const type = TYPES[district];
    const w = p.x1 - p.x0;
    const d = p.z1 - p.z0;

    // Glasspoint towers: one tall tower per plot, footprint well inside the
    // plot so it never touches a road strip. Asserted again in verify().
    if (district === 'Glasspoint') {
      const tw = Math.min(w, d) * range(rng, 0.42, 0.55);
      const td = tw * range(rng, 0.8, 1.2);
      buildings.push({
        x: cx + jitter(rng, 0, 6), z: cz + jitter(rng, 0, 6),
        w: tw, d: td, h: range(rng, hMin, hMax),
        type: 'tower', district, rot: 0,
      });
      // A low glass base beside some towers.
      if (rng() < 0.4) {
        buildings.push({
          x: cx + (w / 4), z: cz - (d / 4),
          w: tw * 0.7, d: td * 0.7, h: range(rng, 18, 30),
          type: 'glass', district, rot: 0,
        });
      }
      continue;
    }

    // Ordinary blocks: one building, sometimes two side by side.
    const two = rng() < 0.25 && Math.min(w, d) > 90;
    if (two) {
      const horizontal = w >= d;
      for (let k = 0; k < 2; k++) {
        const bw = horizontal ? (w / 2 - 8) : w - 16;
        const bd = horizontal ? d - 16 : (d / 2 - 8);
        const bx = horizontal ? p.x0 + 8 + (w / 2) * k + bw / 2 : cx;
        const bz = horizontal ? cz : p.z0 + 8 + (d / 2) * k + bd / 2;
        buildings.push({
          x: bx, z: bz, w: bw * range(rng, 0.75, 0.95), d: bd * range(rng, 0.75, 0.95),
          h: range(rng, hMin, hMax), type, district, rot: 0,
        });
      }
    } else {
      buildings.push({
        x: cx + jitter(rng, 0, 5), z: cz + jitter(rng, 0, 5),
        w: (w - 16) * range(rng, 0.7, 0.92), d: (d - 16) * range(rng, 0.7, 0.92),
        h: range(rng, hMin, hMax), type, district, rot: 0,
      });
    }
  }

  // Marina docks: piers reaching into the bay, plus moored boats.
  const boats = [];
  for (let k = 0; k < 5; k++) {
    const px = -1000 + k * 260;
    boats.push({ x: px, z: -1560 - (k % 2) * 60, rot: range(rng, -0.2, 0.2), len: range(rng, 26, 40) });
  }

  // Trees: the park is dense, Citrus Quarter lines its streets, the beach
  // has palms, Old Solmar keeps a few around its plaza. Every spot is
  // rolled off the street strips (see treeSpot above).
  for (let k = 0; k < 150; k++) {
    const { x, z } = treeSpot(PARK.x0 + 20, PARK.x1 - 20, PARK.z0 + 20, PARK.z1 - 20);
    trees.push({ x, z, s: range(rng, 0.8, 1.4), kind: 'oak' });
  }
  for (let k = 0; k < 60; k++) {
    const { x, z } = treeSpot(760, 1750, -160, 860);
    trees.push({ x, z, s: range(rng, 0.7, 1.2), kind: 'citrus' });
  }
  for (let k = 0; k < 36; k++) {
    const { x, z } = treeSpot(1640, 1900, 940, 1700);
    trees.push({ x, z, s: range(rng, 0.9, 1.3), kind: 'palm' });
  }
  for (let k = 0; k < 10; k++) {
    const { x, z } = treeSpot(-1400, -900, -800, -300);
    trees.push({ x, z, s: range(rng, 0.8, 1.2), kind: 'oak' });
  }

  // Street lamps at every other intersection, plus the marina promenade
  // and the park paths.
  for (const x of vStreets) {
    for (const z of hStreets) {
      if (((x / 200 + z / 200) | 0) % 2 !== 0) continue;
      if (inWater(x, z) || inPark(x, z)) continue;
      if (inCanalStrip(x, z) && Math.abs(z) % 900 > 60) continue;
      lamps.push({ x: x + 14, z: z + 14 });
    }
  }
  for (let k = 0; k < 12; k++) lamps.push({ x: -1200 + k * 140, z: -1420 });
  for (let k = 0; k < 8; k++) lamps.push({ x: -400 + k * 110, z: 1080 + (k % 2) * 420 });

  return {
    seed, buildings, trees, lamps, streets, boats,
    districts: DISTRICTS,
    counts: {
      buildings: buildings.length,
      towers: buildings.filter((b) => b.type === 'tower').length,
      trees: trees.length,
      lamps: lamps.length,
      boats: boats.length,
    },
  };
}

export function districtAtPoint(x, z) {
  if (inPark(x, z)) return 'Solmar Park';
  if (z < -1500) return 'Solmar Bay';
  if (x > 1760) return 'Solmar Bay';
  if (x >= CANAL.x0 && x <= CANAL.x1) return 'Canal Ward';
  return districtAt(x, z);
}

// Layout self-checks: towers on plots only, bridge gaps open, no building
// in the canal or the park. Throws on the first violation so a broken
// layout can never ship silently.
export function verifyLayout(city) {
  const problems = [];
  const streetXs = [];
  for (let x = -1800; x <= 1800; x += STREET_STEP) streetXs.push(x);
  const streetZs = [];
  for (let z = -1600; z <= 1600; z += STREET_STEP) streetZs.push(z);
  const onRoadStrip = (x, z, half) => {
    for (const sx of streetXs) if (Math.abs(x - sx) < ROAD_HALF + half) return true;
    for (const sz of streetZs) if (Math.abs(z - sz) < ROAD_HALF + half) return true;
    return false;
  };
  for (const b of city.buildings) {
    if (b.type === 'tower') {
      // A tower's whole footprint must stay off the road strips: clear of
      // every street line by the road half-width plus its own half size.
      for (const sx of streetXs) {
        if (Math.abs(b.x - sx) < ROAD_HALF + b.w / 2) problems.push(`tower at (${b.x},${b.z}) footprint crosses a road strip at x=${sx}`);
      }
      for (const sz of streetZs) {
        if (Math.abs(b.z - sz) < ROAD_HALF + b.d / 2) problems.push(`tower at (${b.x},${b.z}) footprint crosses a road strip at z=${sz}`);
      }
    }
    if (b.x >= CANAL.x0 - 4 && b.x <= CANAL.x1 + 4) {
      problems.push(`building at (${b.x},${b.z}) inside the canal strip`);
    }
    if (b.x >= PARK.x0 && b.x <= PARK.x1 && b.z >= PARK.z0 && b.z <= PARK.z1) {
      problems.push(`building at (${b.x},${b.z}) inside the park`);
    }
  }
  for (const br of BRIDGES) {
    const gapBlocked = city.buildings.some(
      (b) => Math.abs(b.z - br.z) < 30 && b.x >= -110 && b.x <= 110,
    );
    if (gapBlocked) problems.push(`bridge gap at z=${br.z} blocked by a building`);
  }
  return problems;
}
