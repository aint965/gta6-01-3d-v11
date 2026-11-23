// Palkon Auto — Stage E: garages.
// Two marked bays where a car left behind is stored instead of parked on
// the street. Stored cars persist across missions (the missions module
// never touches them); press G in a bay to take the last stored car back
// out. The bays sit on the roadside, on streets no mission route needs to
// drive through with a car parked in the way — the stored car is removed
// from the world, so it never blocks traffic.
export const GARAGES = [
  { name: 'Old Solmar Garage', x: -992, z: -600, hw: 8, hd: 12, heading: 0 },
  // The pad mesh is 16 wide by 24 deep in local space for both bays, so
  // the half-extents are 8 and 12 here too — the heading turns the bay,
  // not the numbers. (The old axis-aligned check needed them swapped;
  // the rotated check does not.)
  { name: 'Pearl Marina Garage', x: -592, z: -1400, hw: 8, hd: 12, heading: Math.PI / 2 },
];

export function createGarages(deps) {
  const { vehicles } = deps;
  let stored = []; // { profile, color }, in the order they were stored

  // The bay is a rotated rectangle: the drawn pad is 16 wide by 24 deep
  // turned by the garage heading, and the test must match it. The local
  // axes for a heading h are (cos h, -sin h) and (sin h, cos h), so a
  // world offset is un-rotated with the transpose. (For the two headings
  // in use, 0 and 90 degrees, this agrees with the plain axis-aligned
  // check — the transpose is the version that stays right if a bay is
  // ever turned to another angle.)
  function inside(x, z) {
    for (const g of GARAGES) {
      const c = Math.cos(g.heading), s = Math.sin(g.heading);
      const dx = x - g.x, dz = z - g.z;
      const lx = Math.abs(dx * c - dz * s);
      const lz = Math.abs(dx * s + dz * c);
      if (lx <= g.hw && lz <= g.hd) return g;
    }
    return null;
  }

  function store(car) {
    stored.push({ profile: car.profile, color: car.color });
    vehicles.removeCar(car);
    return true;
  }

  function retrieve() {
    return stored.length ? stored.pop() : null;
  }

  function reset() { stored = []; }

  return {
    GARAGES,
    inside,
    store,
    retrieve,
    reset,
    status() {
      return { stored: stored.map((s) => s.profile), count: stored.length };
    },
  };
}
