// Palkon Auto — Stage B: vehicles.
// Four driving profiles, arcade car physics, swept oriented collisions
// against buildings and street furniture, entry and exit with E, and parked
// cars that stay where the player leaves them.
//
// Coordinates: x east, z south, y up. A car's forward is
// (sin(heading), cos(heading)) in (x, z); heading 0 faces +z.
// Speeds are metres per second; 1 m/s is 3.6 km/h.
import { mulberry32, range, intRange, pick } from './rng.js';
import { CITY_SEED, BRIDGES } from './city.js';

export const PROFILES = {
  compact: {
    name: 'Compact', accel: 9, brake: 22, reverseAccel: 6,
    maxSpeed: 32, maxReverse: 8, steer: 0.55,
    length: 3.6, width: 1.7, color: '#398e99',
  },
  sedan: {
    name: 'Sedan', accel: 8, brake: 20, reverseAccel: 5.5,
    maxSpeed: 36, maxReverse: 8, steer: 0.5,
    length: 4.2, width: 1.8, color: '#ead8b2',
  },
  van: {
    name: 'Van', accel: 6, brake: 16, reverseAccel: 5,
    maxSpeed: 30, maxReverse: 7, steer: 0.42,
    length: 4.8, width: 2.0, color: '#56856b',
  },
  coupe: {
    name: 'Coupe', accel: 12, brake: 24, reverseAccel: 7,
    maxSpeed: 44, maxReverse: 9, steer: 0.62,
    length: 4.0, width: 1.8, color: '#d77f69',
  },
};

const PROFILE_NAMES = Object.keys(PROFILES);

// ---- spatial grid: buildings as AABBs, lamps and trees as circles ----
class Grid {
  constructor(cell = 200) {
    this.cell = cell;
    this.map = new Map();
  }
  key(cx, cz) {
    return cx + ',' + cz;
  }
  insertAABB(x0, z0, x1, z1, item) {
    const c0x = Math.floor(x0 / this.cell), c1x = Math.floor(x1 / this.cell);
    const c0z = Math.floor(z0 / this.cell), c1z = Math.floor(z1 / this.cell);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const k = this.key(cx, cz);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(item);
      }
    }
  }
  insertPoint(x, z, item) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push(item);
  }
  query(x0, z0, x1, z1, out) {
    const seen = new Set();
    const c0x = Math.floor(x0 / this.cell), c1x = Math.floor(x1 / this.cell);
    const c0z = Math.floor(z0 / this.cell), c1z = Math.floor(z1 / this.cell);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const list = this.map.get(this.key(cx, cz));
        if (!list) continue;
        for (const item of list) {
          if (!seen.has(item)) { seen.add(item); out.push(item); }
        }
      }
    }
    return out;
  }
}

function inWater(x, z) {
  if (z < -1500) return true;
  if (x > 1760) return true;
  if (x >= -70 && x <= 70) return true;
  return false;
}

function onBridge(x, z) {
  for (const br of BRIDGES) {
    if (Math.abs(z - br.z) < 20 && Math.abs(x) < 110) return true;
  }
  return false;
}

// The ground height under a car: bridge decks sit 1.6 above the street.
export function groundHeightAt(x, z) {
  return onBridge(x, z) ? 1.6 : 0;
}

export function createVehicleSystem(city) {
  const grid = new Grid(200);
  const buildings = [];
  for (const b of city.buildings) {
    const item = { kind: 'aabb', x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 };
    buildings.push(item);
    grid.insertAABB(item.x0, item.z0, item.x1, item.z1, item);
  }
  // Bridge rails: thin walls at the deck edges, so a car cannot drive off
  // the side of a bridge into the canal.
  for (const br of BRIDGES) {
    for (const sx of [-108, 108]) {
      const item = { kind: 'aabb', x0: sx - 2, z0: br.z - 20, x1: sx + 2, z1: br.z + 20 };
      grid.insertAABB(item.x0, item.z0, item.x1, item.z1, item);
    }
  }
  for (const l of city.lamps) {
    grid.insertPoint(l.x, l.z, { kind: 'circle', x: l.x, z: l.z, r: 0.5 });
  }
  for (const t of city.trees) {
    grid.insertPoint(t.x, t.z, { kind: 'circle', x: t.x, z: t.z, r: 0.9 });
  }

  const cars = [];
  let nextId = 1;

  function makeCar(profileName, x, z, heading, kind) {
    const p = PROFILES[profileName];
    const car = {
      id: nextId++,
      profile: profileName,
      name: p.name,
      x, z, heading,
      speed: 0,
      steer: 0,
      length: p.length,
      width: p.width,
      color: p.color,
      kind, // 'parked' | 'traffic' | 'player'
      y: groundHeightAt(x, z),
    };
    cars.push(car);
    return car;
  }

  // ---- oriented collision: SAT on the car's axes plus the world axes ----
  function obbHitsAABB(car, box) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const rx = -fz, rz = fx;
    const hl = car.length / 2, hw = car.width / 2;
    const corners = [
      [car.x + fx * hl + rx * hw, car.z + fz * hl + rz * hw],
      [car.x + fx * hl - rx * hw, car.z + fz * hl - rz * hw],
      [car.x - fx * hl + rx * hw, car.z - fz * hl + rz * hw],
      [car.x - fx * hl - rx * hw, car.z - fz * hl - rz * hw],
    ];
    const boxCorners = [
      [box.x0, box.z0], [box.x1, box.z0], [box.x1, box.z1], [box.x0, box.z1],
    ];
    const axes = [[fx, fz], [rx, rz], [1, 0], [0, 1]];
    for (const [ax, az] of axes) {
      let minA = Infinity, maxA = -Infinity;
      for (const [px, pz] of corners) {
        const d = px * ax + pz * az;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      let minB = Infinity, maxB = -Infinity;
      for (const [px, pz] of boxCorners) {
        const d = px * ax + pz * az;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      if (maxA < minB || maxB < minA) return false;
    }
    return true;
  }

  function obbHitsCircle(car, c) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const rx = -fz, rz = fx;
    const dx = c.x - car.x, dz = c.z - car.z;
    const u = Math.max(-car.length / 2, Math.min(car.length / 2, dx * fx + dz * fz));
    const v = Math.max(-car.width / 2, Math.min(car.width / 2, dx * rx + dz * rz));
    const cx = car.x + fx * u + rx * v;
    const cz = car.z + fz * u + rz * v;
    const ddx = c.x - cx, ddz = c.z - cz;
    return ddx * ddx + ddz * ddz < (c.r + 0.3) * (c.r + 0.3);
  }

  function obbHitsObb(a, b) {
    const axes = [];
    for (const car of [a, b]) {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      axes.push([fx, fz], [-fz, fx]);
    }
    const cornersOf = (car) => {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const rx = -fz, rz = fx;
      const hl = car.length / 2, hw = car.width / 2;
      return [
        [car.x + fx * hl + rx * hw, car.z + fz * hl + rz * hw],
        [car.x + fx * hl - rx * hw, car.z + fz * hl - rz * hw],
        [car.x - fx * hl + rx * hw, car.z - fz * hl + rz * hw],
        [car.x - fx * hl - rx * hw, car.z - fz * hl - rz * hw],
      ];
    };
    const ca = cornersOf(a), cb = cornersOf(b);
    for (const [ax, az] of axes) {
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [px, pz] of ca) { const d = px * ax + pz * az; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const [px, pz] of cb) { const d = px * ax + pz * az; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      if (maxA < minB || maxB < minA) return false;
    }
    return true;
  }

  const scratch = [];
  function collidesAt(car, x, z, ignore) {
    const hl = car.length / 2, hw = car.width / 2;
    const r = Math.hypot(hl, hw) + 2;
    scratch.length = 0;
    grid.query(x - r, z - r, x + r, z + r, scratch);
    const probe = { ...car, x, z };
    for (const item of scratch) {
      if (item.kind === 'aabb') {
        if (obbHitsAABB(probe, item)) return item;
      } else if (obbHitsCircle(probe, item)) {
        return item;
      }
    }
    if (inWater(x, z) && !onBridge(x, z)) return { kind: 'water' };
    if (x < -1910 || x > 1910 || z < -1718 || z > 1718) return { kind: 'edge' };
    for (const other of cars) {
      if (other === car || other === ignore) continue;
      const dx = other.x - x, dz = other.z - z;
      if (dx * dx + dz * dz > 144) continue;
      if (obbHitsObb(probe, other)) return other;
    }
    return null;
  }

  // Move a car one frame, swept in substeps of at most 0.4 units so it can
  // never tunnel through a wall at top speed. Axis-separated fallback
  // gives a natural slide along walls.
  function moveCar(car, dx, dz) {
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.4));
    const sx = dx / steps, sz = dz / steps;
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      const nx = car.x + sx, nz = car.z + sz;
      if (!collidesAt(car, nx, nz, null)) {
        car.x = nx; car.z = nz;
      } else if (!collidesAt(car, nx, car.z, null)) {
        car.x = nx;
        blocked = true;
      } else if (!collidesAt(car, car.x, nz, null)) {
        car.z = nz;
        blocked = true;
      } else {
        blocked = true;
      }
    }
    car.y = groundHeightAt(car.x, car.z);
    return blocked;
  }

  // Arcade drive model for one car. Input is { throttle, brake, steer }
  // with steer -1 (left) .. 1 (right). Steering bites less as speed rises
  // and nothing at a standstill, so the car never spins in place.
  function driveCar(car, dt, input) {
    const p = PROFILES[car.profile];
    if (input.throttle) {
      car.speed = Math.min(p.maxSpeed, car.speed + p.accel * dt);
    }
    if (input.brake) {
      if (car.speed > 0.5) {
        car.speed = Math.max(0, car.speed - p.brake * dt);
      } else {
        car.speed = Math.max(-p.maxReverse, car.speed - p.reverseAccel * dt);
      }
    }
    if (!input.throttle && !input.brake) {
      car.speed -= car.speed * 0.35 * dt;
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }
    const steerTarget = input.steer || 0;
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    const grip = 1 / (1 + Math.abs(car.speed) * 0.045);
    const bite = Math.min(1, Math.abs(car.speed) / 2.5);
    const yawRate = car.steer * p.steer * grip * bite * Math.sign(car.speed || 1);
    car.heading += yawRate * dt;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const blocked = moveCar(car, fx * car.speed * dt, fz * car.speed * dt);
    if (blocked && car.speed > 0) car.speed *= 0.4;
    return blocked;
  }

  function nearestCar(x, z, maxDist, kinds) {
    let best = null, bestD = maxDist;
    for (const car of cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  // Step out of a car: the player appears beside it on its right side,
  // facing the way the car faces, and the car stays where it was.
  function leaveCar(car, player) {
    const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
    const side = car.width / 2 + 0.8;
    player.x = car.x + rx * side;
    player.z = car.z + rz * side;
    player.heading = car.heading;
  }

  // Parked cars: deterministic, along the curb on the right side of the
  // road, on streets away from the test street (x = 200) and away from
  // the canal, the park and the beach.
  function placeParkedCars() {
    const rng = mulberry32(CITY_SEED + 77);
    const spots = [];
    for (const sx of [-1400, -1000, -600, 600, 1000, 1400]) {
      for (const sz of [-600, 600]) spots.push({ x: sx, z: sz, vertical: true });
    }
    for (const sz of [-1200, -800, -400, 400, 800, 1200]) {
      for (const sx of [-1200, -400, 800]) spots.push({ x: sx, z: sz, vertical: false });
    }
    for (const s of spots) {
      const profile = pick(rng, PROFILE_NAMES);
      if (s.vertical) {
        const side = rng() < 0.5 ? 1 : -1;
        const x = s.x + side * 7.5;
        const z = s.z + range(rng, -40, 40);
        if (inWater(x, z)) continue;
        makeCar(profile, x, z, side > 0 ? 0 : Math.PI, 'parked');
      } else {
        const side = rng() < 0.5 ? 1 : -1;
        const x = s.x + range(rng, -40, 40);
        const z = s.z + side * 7.5;
        if (inWater(x, z)) continue;
        if (x > -550 && x < 550 && z > 1000 && z < 1600) continue;
        makeCar(profile, x, z, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'parked');
      }
    }
  }

  placeParkedCars();

  return {
    cars,
    profiles: PROFILES,
    makeCar,
    driveCar,
    leaveCar,
    moveCar,
    collidesAt,
    nearestCar,
    groundHeightAt,
    inWater,
    onBridge,
    removeCar(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
    // Clear every car and re-place the deterministic parked set, so a
    // test always starts from the same street.
    reset() {
      cars.length = 0;
      placeParkedCars();
    },
  };
}
