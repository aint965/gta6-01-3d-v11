// Palkon Auto — Stage E: the police.
// A wanted system: reckless driving and mission heat raise the heat, the
// heat bands into 0-3 wanted stars, and police cars spawn to match the
// stars. They pursue, ram and box the player in; an arrest — or zero
// health — ends the run at the park with a cash penalty and a failed
// mission. Outrun them, stay unseen, and the heat cools off.
// The system is off while a test runs (game.resetTest disables it), so
// the drive, headlight, mission and walk tests never meet a patrol car.
const HEAT_BANDS = [0, 20, 45, 75]; // heat at which 0/1/2/3 stars start
const POLICE_TOP_SPEED = 32; // a coupe (44) outruns it; a van (30) does not
const BUST_RADIUS = 5.5;
const BUST_SECONDS = 3;
const UNSEEN_SECONDS = 10;
const HEAT_COOL_RATE = 2; // heat per second once unseen long enough

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createPolice(deps) {
  const { vehicles, missions, getPlayerPos, getPlayerCar, isPlayerOnFoot, onBusted } = deps;

  let enabled = true;
  let heat = 0;
  let health = 100;
  let policeCars = [];
  let bustedTimer = 0;
  let unseenTimer = 0;
  let damageCooldown = 0;
  let busts = 0;

  function wanted() {
    if (heat >= 75) return 3;
    if (heat >= 45) return 2;
    if (heat >= 20) return 1;
    return 0;
  }

  // A spawn point on a road near the player: four candidates 80 units out
  // on the cardinal directions, the first that sits on a street
  // centreline, out of the water and clear of buildings. The fallback is
  // the (200, 200) intersection, a street the tests already trust.
  function streetSpawn(px, pz) {
    const probe = { length: 4.2, width: 1.8, heading: 0 };
    const onRoad = (x, z) => {
      if (x < -1900 || x > 1900 || z < -1700 || z > 1700) return false;
      const dx = Math.min(((x % 200) + 200) % 200, 200 - (((x % 200) + 200) % 200));
      const dz = Math.min(((z % 200) + 200) % 200, 200 - (((z % 200) + 200) % 200));
      return dx < 9 || dz < 9;
    };
    const candidates = [
      [px + 80, pz], [px - 80, pz], [px, pz + 80], [px, pz - 80],
      [px + 80, pz + 80], [px - 80, pz - 80], [px + 80, pz - 80], [px - 80, pz + 80],
    ];
    for (const [x, z] of candidates) {
      if (!onRoad(x, z)) continue;
      if (vehicles.inWater(x, z) && !vehicles.onBridge(x, z)) continue;
      if (vehicles.collidesAt(probe, x, z, null)) continue;
      return [x, z];
    }
    return [200, 200];
  }

  function spawnOne() {
    const [px, pz] = getPlayerPos();
    const [x, z] = streetSpawn(px, pz);
    const heading = Math.atan2(px - x, pz - z);
    const car = vehicles.makeCar('sedan', x, z, heading, 'police');
    car.color = '#dfe6ea'; // a pale patrol car, not a traffic sedan
    car.police = true;
    car.speed = 0;
    car._lastX = x; car._lastZ = z; car._stuckT = 0;
    policeCars.push(car);
    return car;
  }

  function removePolice(car) {
    vehicles.removeCar(car);
    const i = policeCars.indexOf(car);
    if (i >= 0) policeCars.splice(i, 1);
  }

  function doBusted() {
    const w = wanted();
    busts++;
    for (const car of [...policeCars]) removePolice(car);
    heat = 0;
    health = 100;
    bustedTimer = 0;
    unseenTimer = 0;
    if (onBusted) onBusted({ wanted: w });
  }

  function update(dt) {
    if (!enabled) return;
    damageCooldown = Math.max(0, damageCooldown - dt);

    // A live tail means the law is already looking: wanted never drops
    // below one star while a mission pursuer is on the player.
    const st = missions.status();
    if (st.active && st.active.pursuer) heat = Math.max(heat, 25);

    const [px, pz] = getPlayerPos();
    const playerCar = getPlayerCar();
    let nearest = Infinity;
    for (const p of policeCars) {
      nearest = Math.min(nearest, Math.hypot(p.x - px, p.z - pz));
    }
    // Heat cools only after ten seconds with no patrol car close. The
    // timer only runs while there is heat to cool: during a long quiet
    // drive it must not preload, or fresh heat would drain before the
    // first patrol car could even spawn.
    if (nearest > 120 && heat > 0) {
      unseenTimer += dt;
      if (unseenTimer > UNSEEN_SECONDS) heat = Math.max(0, heat - HEAT_COOL_RATE * dt);
    } else {
      unseenTimer = 0;
    }

    // Spawn and despawn patrol cars to match the wanted stars.
    const w = wanted();
    while (policeCars.length < w) spawnOne();
    while (policeCars.length > w) removePolice(policeCars[policeCars.length - 1]);

    // Pursue, ram, and watch for the arrest.
    let near = false;
    for (const p of [...policeCars]) {
      const desired = Math.atan2(px - p.x, pz - p.z);
      const err = wrapAngle(desired - p.heading);
      p.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, err));
      p.speed = Math.min(POLICE_TOP_SPEED, p.speed + 9 * dt);
      const blocked = vehicles.moveCar(p, Math.sin(p.heading) * p.speed * dt, Math.cos(p.heading) * p.speed * dt);
      if (blocked) p.speed *= 0.7;
      // Stuck: sample the position once a second. A patrol car that has
      // barely moved across two sampled seconds — wedged on a building,
      // not merely accelerating — rejoins the chase from a street near
      // itself, not next to the player, or the player could never escape
      // by distance. (A per-frame check misfires: at 60 fps a car under
      // 30 m/s moves less than 0.5 units a frame, which is normal driving.)
      p._sampleT = (p._sampleT || 0) + dt;
      if (p._sampleT >= 1) {
        const moved = Math.hypot(p.x - (p._sampleX ?? p.x), p.z - (p._sampleZ ?? p.z));
        if (p.speed > 5 && moved < 2) {
          p._stuckT += 1;
          if (p._stuckT >= 2) {
            const [nx, nz] = streetSpawn(p.x, p.z);
            p.x = nx; p.z = nz;
            p.heading = Math.atan2(px - nx, pz - nz);
            p.speed = 0;
            p._stuckT = 0;
          }
        } else {
          p._stuckT = 0;
        }
        p._sampleX = p.x; p._sampleZ = p.z; p._sampleT = 0;
      }

      // Ramming: contact drains health and drags the player's speed down.
      const d = Math.hypot(px - p.x, pz - p.z);
      if (d < 4.5) {
        health -= 10 * dt;
        if (playerCar) playerCar.speed *= (1 - 0.25 * dt);
      }
      if (d < BUST_RADIUS) near = true;
    }

    // Arrest: a patrol car close by for three seconds while the player is
    // slow (or on foot, where slow is always true). Health hitting zero
    // busts the player at once.
    const slow = isPlayerOnFoot() || !playerCar || Math.abs(playerCar.speed) < 4;
    if (near && slow) bustedTimer += dt;
    else bustedTimer = Math.max(0, bustedTimer - dt * 2);
    if (bustedTimer >= BUST_SECONDS || health <= 0) doBusted();
  }

  return {
    update,
    wanted,
    addHeat(n) { heat = Math.min(100, heat + n); unseenTimer = 0; },
    damage(n) {
      if (damageCooldown <= 0) {
        health -= n;
        damageCooldown = 1;
      }
    },
    setWanted(n) { heat = n <= 0 ? 0 : HEAT_BANDS[Math.min(3, n)]; unseenTimer = 0; },
    setEnabled(v) { enabled = !!v; },
    enable() { enabled = true; },
    isEnabled() { return enabled; },
    policeCars() { return [...policeCars]; },
    acknowledgeBusted() { /* the bust count is the record; nothing to clear */ },
    reset() {
      for (const car of [...policeCars]) removePolice(car);
      heat = 0;
      health = 100;
      bustedTimer = 0;
      unseenTimer = 0;
      damageCooldown = 0;
      busts = 0;
      enabled = false; // tests run with the police off unless they opt in
    },
    status() {
      return {
        enabled,
        wanted: wanted(),
        heat: +heat.toFixed(1),
        health: Math.round(health),
        police: policeCars.length,
        busts,
        bustedTimer: +bustedTimer.toFixed(2),
      };
    },
  };
}
