// Palkon Auto — Stage B: traffic and pedestrians.
// Cars run right-hand loops around city blocks, slowing for the car ahead
// and stopping at red signals. Signals run a 26 second cycle (green 8,
// yellow 3, all-red 2 per axis) with a per-intersection offset, so the
// city never changes everywhere at once. Pedestrians walk sidewalk loops.
import { mulberry32, range, intRange, pick } from './rng.js';
import { CITY_SEED } from './city.js';

const LANE = 4.5; // lane centre offset from the street centre line
const CYCLE = 26; // green 8 + yellow 3 + all-red 2, per axis

// Loops are rectangles around blocks; the inset rectangle IS the right-hand
// lane: heading +x runs at z0 + LANE, heading +z at x1 - LANE, and so on,
// so two loops on either side of a street never meet head-on.
const LOOP_BLOCKS = [
  { x0: -1400, x1: -1000, z0: -1200, z1: -800 },
  { x0: -600, x1: -200, z0: -800, z1: -400 },
  { x0: 200, x1: 600, z0: -400, z1: 0 },
  { x0: 600, x1: 1000, z0: 400, z1: 800 },
  { x0: -1400, x1: -1000, z0: 800, z1: 1200 },
  { x0: 1000, x1: 1400, z0: -1200, z1: -800 },
];

const PED_BLOCKS = [
  { x0: -1400, x1: -1000, z0: -1200, z1: -800 },
  { x0: -600, x1: -200, z0: -800, z1: -400 },
  { x0: 200, x1: 600, z0: -400, z1: 0 },
  { x0: 600, x1: 1000, z0: 400, z1: 800 },
  { x0: -1400, x1: -1000, z0: 800, z1: 1200 },
];

const SHIRTS = ['#d77f69', '#398e99', '#ead8b2', '#56856b', '#c9a06a', '#7fb3c8'];

function loopCorners(b, inset) {
  return [
    [b.x0 + inset, b.z0 + inset],
    [b.x1 - inset, b.z0 + inset],
    [b.x1 - inset, b.z1 - inset],
    [b.x0 + inset, b.z1 - inset],
  ];
}

function edgeInfo(corners) {
  const edges = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const axis = Math.abs(dx) > Math.abs(dz) ? 'ew' : 'ns';
    // The intersection this edge ends at: the street crossing at the far
    // corner, and the stop line 10 units before it.
    const ix = axis === 'ew' ? b[0] + (dx > 0 ? LANE : -LANE) : a[0] + (dz > 0 ? LANE : -LANE);
    const iz = axis === 'ew' ? a[1] + (dx > 0 ? LANE : -LANE) : b[1] + (dz > 0 ? LANE : -LANE);
    edges.push({
      from: a, to: b, len, axis,
      dirX: dx / len, dirZ: dz / len,
      heading: Math.atan2(dx, dz),
      intersection: { x: axis === 'ew' ? b[0] + (dx > 0 ? LANE : -LANE) : b[0], z: axis === 'ew' ? b[1] : b[1] + (dz > 0 ? LANE : -LANE) },
      stopS: len - 10,
    });
  }
  return edges;
}

export function createTraffic(city, vehicles) {
  const rng = mulberry32(CITY_SEED + 31);
  const loops = LOOP_BLOCKS.map((b) => {
    const corners = loopCorners(b, LANE);
    return { block: b, corners, edges: edgeInfo(corners), length: 0 };
  });
  for (const loop of loops) {
    loop.length = loop.edges.reduce((s, e) => s + e.len, 0);
  }

  const intersections = new Map();
  for (const loop of loops) {
    for (const e of loop.edges) {
      const ix = Math.round(e.intersection.x / 200) * 200;
      const iz = Math.round(e.intersection.z / 200) * 200;
      intersections.set(ix + ',' + iz, { x: ix, z: iz });
    }
  }

  let allGreen = false;
  const overrides = new Map();
  let frozen = false;

  function signalOffset(ix, iz) {
    return (((ix * 7 + iz * 13) % CYCLE) + CYCLE) % CYCLE;
  }

  function signalStateAt(ix, iz, axis, time) {
    const key = ix + ',' + iz;
    if (overrides.has(key)) return overrides.get(key);
    if (allGreen) return 'green';
    const phase = (time + signalOffset(ix, iz)) % CYCLE;
    if (axis === 'ew') {
      if (phase < 8) return 'green';
      if (phase < 11) return 'yellow';
      return 'red';
    }
    if (phase >= 13 && phase < 21) return 'green';
    if (phase >= 21 && phase < 24) return 'yellow';
    return 'red';
  }

  // ---- traffic cars ----
  const traffic = [];
  const cruise = { compact: 13, sedan: 12, van: 10, coupe: 14 };
  const profiles = ['compact', 'sedan', 'van', 'coupe'];
  // The initial placement, rebuilt on reset so a test always starts from
  // the same deterministic city.
  function buildInitial() {
    traffic.length = 0;
    pedestrians.length = 0;
    for (let li = 0; li < loops.length; li++) {
      const count = 2 + intRange(rng, 0, 1);
      for (let k = 0; k < count; k++) {
        const edge = intRange(rng, 0, 3);
        const s = range(rng, 0, loops[li].edges[edge].len);
        const profile = pick(rng, profiles);
        const e = loops[li].edges[edge];
        const x = e.from[0] + e.dirX * s;
        const z = e.from[1] + e.dirZ * s;
        const car = vehicles.makeCar(profile, x, z, e.heading, 'traffic');
        traffic.push({
          car, loop: li, edge, s,
          speed: range(rng, 6, 10),
          cruise: cruise[profile],
        });
      }
    }
    for (let li = 0; li < PED_BLOCKS.length; li++) {
      const corners = loopCorners(PED_BLOCKS[li], 14);
      for (let k = 0; k < 4; k++) {
        const edge = intRange(rng, 0, 3);
        const e = { from: corners[edge], to: corners[(edge + 1) % 4] };
        const len = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);
        const s = range(rng, 0, len);
        pedestrians.push({
          loop: li, corners, edge, s,
          speed: range(rng, 1.1, 1.6),
          shirt: pick(rng, SHIRTS),
          phase: range(rng, 0, Math.PI * 2),
          x: e.from[0] + ((e.to[0] - e.from[0]) / len) * s,
          z: e.from[1] + ((e.to[1] - e.from[1]) / len) * s,
          heading: Math.atan2(e.to[0] - e.from[0], e.to[1] - e.from[1]),
        });
      }
    }
  }
  // ---- pedestrians ----
  const pedestrians = [];
  buildInitial();

  function carTotal(t) {
    let total = t.s;
    for (let i = 0; i < t.edge; i++) total += loops[t.loop].edges[i].len;
    return total;
  }

  function placeOnLoop(t) {
    const e = loops[t.loop].edges[t.edge];
    t.car.x = e.from[0] + e.dirX * t.s;
    t.car.z = e.from[1] + e.dirZ * t.s;
    // Smooth the heading toward the edge direction so corners turn.
    let target = e.heading;
    let diff = target - t.car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    t.car.heading += diff * 0.25;
    t.car.y = vehicles.groundHeightAt(t.car.x, t.car.z);
  }

  function updateTraffic(dt, time, playerCar) {
    if (frozen) return;
    for (const t of traffic) {
      const loop = loops[t.loop];
      const edge = loop.edges[t.edge];
      let target = t.cruise;
      // The car ahead on the same loop: keep a gap, never tailgate.
      let gap = Infinity, aheadSpeed = 0;
      for (const o of traffic) {
        if (o === t || o.loop !== t.loop) continue;
        let g = carTotal(o) - carTotal(t);
        if (g <= 0) g += loop.length;
        if (g < gap) { gap = g; aheadSpeed = o.speed; }
      }
      if (gap < 14) target = Math.min(target, aheadSpeed * 0.9);
      if (gap < 7) target = 0;
      // The signal at the end of this edge.
      const distToStop = edge.stopS - t.s;
      if (distToStop > 0 && distToStop < 26) {
        const st = signalStateAt(edge.intersection.x, edge.intersection.z, edge.axis, time);
        if (st !== 'green') {
          if (distToStop < 3) target = 0;
          else target = Math.min(target, distToStop * 0.55);
        }
      }
      // The player's car ahead in this lane.
      if (playerCar) {
        const dx = playerCar.x - t.car.x, dz = playerCar.z - t.car.z;
        const ahead = dx * Math.sin(t.car.heading) + dz * Math.cos(t.car.heading);
        const side = Math.abs(dx * Math.cos(t.car.heading) - dz * Math.sin(t.car.heading));
        if (ahead > 0 && ahead < 14 && side < 3) {
          target = ahead < 7 ? 0 : Math.min(target, 4);
        }
      }
      const accel = target > t.speed ? 4 : 9;
      t.speed += Math.max(-accel * dt, Math.min(accel * dt, target - t.speed));
      if (t.speed < 0.01 && target === 0) t.speed = 0;
      t.s += t.speed * dt;
      while (t.s >= edge.len) {
        t.s -= edge.len;
        t.edge = (t.edge + 1) % 4;
      }
      placeOnLoop(t);
    }
    // Gentle separation so two cars never overlap at a corner.
    for (let i = 0; i < traffic.length; i++) {
      for (let j = i + 1; j < traffic.length; j++) {
        const a = traffic[i].car, b = traffic[j].car;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 12 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (3.5 - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
        }
      }
    }
  }

  function updatePedestrians(dt) {
    if (frozen) return;
    for (const p of pedestrians) {
      const a = p.corners[p.edge], b = p.corners[(p.edge + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      p.s += p.speed * dt;
      if (p.s >= len) {
        p.s -= len;
        p.edge = (p.edge + 1) % 4;
      }
      const c = p.corners[p.edge], d = p.corners[(p.edge + 1) % 4];
      const l2 = Math.hypot(d[0] - c[0], d[1] - c[1]);
      p.x = c[0] + ((d[0] - c[0]) / l2) * p.s;
      p.z = c[1] + ((d[1] - c[1]) / l2) * p.s;
      p.heading = Math.atan2(d[0] - c[0], d[1] - c[1]);
      p.phase += dt * p.speed * 4;
    }
  }

  return {
    traffic,
    pedestrians,
    loops,
    intersections: [...intersections.values()],
    signalStateAt,
    // The signal state for one axis at one intersection, at sim time.
    stateFor(ix, iz, axis, time) { return signalStateAt(ix, iz, axis, time); },
    update(dt, time, playerCar) {
      updateTraffic(dt, time, playerCar);
      updatePedestrians(dt);
    },
    setAllGreen(v) { allGreen = v; },
    setOverride(ix, iz, state) { overrides.set(ix + ',' + iz, state); },
    clearOverrides() { overrides.clear(); },
    reset() {
      frozen = false;
      allGreen = false;
      overrides.clear();
      buildInitial();
    },
    // Test mode: park every traffic car on the far west loops and freeze
    // all movement, so the test lane stays clear of competing beams.
    freezeForTest() {
      frozen = true;
      for (let i = 0; i < traffic.length; i++) {
        const t = traffic[i];
        t.loop = i % 2 === 0 ? 0 : 4;
        t.edge = 0;
        t.s = 20 + (i * 37) % 300;
        t.speed = 0;
        placeOnLoop(t);
      }
    },
    unfreeze() { frozen = false; },
    isFrozen() { return frozen; },
  };
}
