// Palkon Auto — Stage B: verification tests, run in the page itself.
// The drive test steps the real simulation with fixed 1/60 s steps and
// scripted keys; the headlight test renders one frozen night scene twice
// (headlights off, then on) and reads the framebuffer patches straight
// from WebGL, so the numbers are the pixels the player sees.
export function createTests(game) {
  const W = new Set(['KeyW']);
  const S = new Set(['KeyS']);
  const NONE = new Set();

  function stepN(n, held) {
    for (let i = 0; i < n; i++) game.step(1 / 60, held, []);
  }

  function driveTest() {
    const out = { profiles: {}, redStop: null, reverse: null, exitReenter: null, trafficStop: null };
    // Top speed per profile: a clean run down the test street (x = 200),
    // all signals green, 10 s of full throttle from a standstill.
    game.setSignalsGreen(true);
    for (const name of ['compact', 'sedan', 'van', 'coupe']) {
      game.resetTest();
      const car = game.spawnCar(name, 200, -1400, 0, 'player');
      game.enterCar(car);
      let top = 0;
      const z0 = car.z;
      for (let i = 0; i < 600; i++) {
        game.step(1 / 60, W, []);
        top = Math.max(top, Math.abs(car.speed));
      }
      out.profiles[name] = {
        topMs: +top.toFixed(2),
        topKmh: +(top * 3.6).toFixed(1),
        distance: +(car.z - z0).toFixed(1),
      };
      game.removeCar(car);
      game.exitCar();
    }
    game.setSignalsGreen(false);

    // Full stop at a red signal: run up to speed on the test street,
    // brake 100 units before the (200, 0) intersection, and stop with
    // the nose before the line. The brake key is released once the car
    // is nearly stopped, or it would start reversing.
    game.resetTest();
    game.setSignalOverride(200, 0, 'red');
    const car = game.spawnCar('sedan', 200, -300, 0, 'player');
    game.enterCar(car);
    let braking = false;
    let stoppedAt = null;
    for (let i = 0; i < 1200; i++) {
      const held = braking ? (car.speed > 0.5 ? S : NONE) : W;
      game.step(1 / 60, held, []);
      if (!braking && car.z >= -100) braking = true;
      if (braking && Math.abs(car.speed) < 0.05) { stoppedAt = car.z; break; }
    }
    const frontZ = stoppedAt === null ? null : stoppedAt + car.length / 2;
    out.redStop = {
      stopped: stoppedAt !== null,
      stopZ: stoppedAt === null ? null : +stoppedAt.toFixed(1),
      frontZ: frontZ === null ? null : +frontZ.toFixed(1),
      lineZ: -10,
      beforeLine: frontZ !== null && frontZ < -10,
    };

    // Reverse from the stop: 3 s of reverse, then exit and re-enter.
    const zBefore = car.z;
    let maxRev = 0;
    for (let i = 0; i < 180; i++) {
      game.step(1 / 60, S, []);
      maxRev = Math.max(maxRev, -car.speed);
    }
    out.reverse = {
      distance: +(zBefore - car.z).toFixed(1),
      maxReverseMs: +maxRev.toFixed(2),
    };
    const leftAt = { x: car.x, z: car.z };
    game.step(1 / 60, NONE, ['KeyE']);
    const onFoot = game.player().onFoot;
    const stayed = Math.hypot(car.x - leftAt.x, car.z - leftAt.z) < 0.01;
    game.step(1 / 60, NONE, ['KeyE']);
    const backIn = !game.player().onFoot && game.player().car === car;
    out.exitReenter = { exited: onFoot, carStayed: stayed, reentered: backIn };

    // A traffic car must stop at a red signal too: put one 41 units
    // before the stop line of loop 0's first edge and hold the light red.
    game.resetTest();
    const t = game.traffic.traffic[0];
    for (const o of game.traffic.traffic) {
      if (o.loop === 0 && o !== t) { o.edge = 2; o.s = 10; o.speed = 0; }
    }
    const edge = game.traffic.loops[0].edges[0];
    t.loop = 0; t.edge = 0; t.s = edge.stopS - 41; t.speed = 10;
    game.traffic.setOverride(edge.intersection.x, edge.intersection.z, 'red');
    let stopped = false;
    for (let i = 0; i < 900; i++) {
      game.step(1 / 60, NONE, []);
      if (t.speed === 0 && t.s >= edge.stopS - 4 && t.s <= edge.stopS + 0.5) { stopped = true; break; }
    }
    out.trafficStop = {
      stopped,
      s: +t.s.toFixed(1),
      stopS: +edge.stopS.toFixed(1),
      gapToLine: +(edge.stopS - t.s).toFixed(1),
      speed: +t.speed.toFixed(2),
    };
    game.traffic.clearOverrides();
    return out;
  }

  function samplePatch(p, size) {
    const [px, py, behind] = game.projectPoint(p);
    if (behind) return null;
    const half = Math.floor(size / 2);
    const data = game.readPixels(Math.round(px - half), Math.round(py - half), size, size);
    if (!data) return null;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return { x: Math.round(px), y: Math.round(py), mean: [(r / n), (g / n), (b / n)], pixels: data };
  }

  function headlightTest(haze) {
    game.resetTest();
    game.setPreset('night');
    game.setHaze(haze);
    game.traffic.freezeForTest();
    const playerCar = game.spawnCar('coupe', 200, 300, 0, 'player');
    game.enterCar(playerCar);
    game.spawnCar('sedan', 200, 340, 0, 'parked');
    // Camera above the road, looking down the lane: the coupe ahead,
    // the sedan beyond it, the beam pool between them, and the sedan's
    // roof seen from above — from street level the roof is nearly
    // edge-on (3 px tall) and the patch lands on the road instead.
    // (An earlier camera at (170, 9, 275) sat inside a building and saw
    // only a brick wall — the street is the only clear sight line.)
    game.setCamera([200, 32, 272], [200, 0, 345]);
    const patches = {
      asphalt: [200, 0.1, 330],
      roof: [200, 1.42, 339.8],
      outside: [200, 0.1, 420],
    };
    // A 10 px patch: small enough to sit on the flat of the roof without
    // catching its edge or the windshield, big enough to mean something.
    const size = 10;
    game.setHeadlightsOn(false);
    game.renderFrame(0);
    const off = {};
    for (const [k, p] of Object.entries(patches)) off[k] = samplePatch(p, size);
    game.setHeadlightsOn(true);
    game.renderFrame(0);
    const on = {};
    for (const [k, p] of Object.entries(patches)) on[k] = samplePatch(p, size);

    const result = { haze, patches: {}, pass: true };
    for (const k of Object.keys(patches)) {
      if (!off[k] || !on[k]) {
        result.patches[k] = { error: 'patch not visible', off: off[k], on: on[k] };
        result.pass = false;
        continue;
      }
      const meanGain = (on[k].mean[0] + on[k].mean[1] + on[k].mean[2]) / 3 -
        (off[k].mean[0] + off[k].mean[1] + off[k].mean[2]) / 3;
      let over = 0;
      const n = on[k].pixels.length / 4;
      for (let i = 0; i < on[k].pixels.length; i += 4) {
        const g = ((on[k].pixels[i] + on[k].pixels[i + 1] + on[k].pixels[i + 2]) / 3) -
          ((off[k].pixels[i] + off[k].pixels[i + 1] + off[k].pixels[i + 2]) / 3);
        if (g > 10) over++;
      }
      result.patches[k] = {
        at: [off[k].x, off[k].y],
        offMean: off[k].mean.map((v) => +v.toFixed(1)),
        onMean: on[k].mean.map((v) => +v.toFixed(1)),
        meanGain: +meanGain.toFixed(1),
        pctOver10: +(100 * over / n).toFixed(1),
      };
    }
    const a = result.patches.asphalt, r = result.patches.roof, o = result.patches.outside;
    result.pass = !!(
      a && a.meanGain >= 20 && a.pctOver10 >= 90 &&
      r && r.meanGain >= 20 && r.pctOver10 >= 90 &&
      o && Math.abs(o.meanGain) <= 1
    );
    return result;
  }

  // ---- Stage C: mission playthroughs ----
  // A pure-pursuit driver: steer at a lookahead point on the current leg
  // instead of at the far waypoint. Steering at the far waypoint lets the
  // car drift wide off the street centreline and clip lamp posts at
  // intersections; the lookahead point, 40 units ahead on the leg, pulls
  // it back onto the centreline within a few dozen units of travel.
  // Waypoints sit on street centre lines, so the path never has to cross
  // a block — but a turn taken fast swings wide off the road and wedges
  // the car against a building face (the turn radius grows with speed),
  // so the driver slows to a crawl before any sharp corner and recovers
  // by reversing out if it still gets stuck.
  function driveTo(targets, opts = {}) {
    const car = game.player().car;
    if (!car) return { reached: false, reason: 'not in a car' };
    const lookahead = opts.lookahead || 40;
    const radius = opts.radius || 8;
    const maxSteps = (opts.maxSeconds || 180) * 60;
    let wi = 0;
    let steps = 0;
    let lastX = car.x, lastZ = car.z, stuckSteps = 0, reversing = 0;
    // Sigma-delta steering: the keys are binary, so a fractional steer
    // command is spread over steps (D on a fraction of them). That keeps
    // the heading error tiny on straights — with plain on/off steering the
    // car weaves, and the speed cap below would hold it slow everywhere.
    let steerAcc = 0;
    // The leg the car is on starts where the drive begins.
    let legStart = [car.x, car.z];
    while (wi < targets.length && steps < maxSteps) {
      if (opts.done && opts.done()) return { reached: true, done: true, steps, seconds: +(steps / 60).toFixed(1) };
      const [tx, tz] = targets[wi];
      const dx = tx - car.x, dz = tz - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) { legStart = targets[wi]; wi++; continue; }
      // The turn waiting at this waypoint: the angle between this leg and
      // the next one. A sharp corner needs a slow approach.
      let turn = 0;
      if (wi + 1 < targets.length) {
        const [nx, nz] = targets[wi + 1];
        const a1 = Math.atan2(dx, dz);
        const a2 = Math.atan2(nx - tx, nz - tz);
        turn = a2 - a1;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
      }
      // Pure pursuit: project the car onto the leg, then steer at the
      // point `lookahead` ahead of the projection, clamped to the leg end.
      const [ax, az] = legStart;
      const abx = tx - ax, abz = tz - az;
      const abLen = Math.hypot(abx, abz) || 1;
      const ux = abx / abLen, uz = abz / abLen;
      let along = (car.x - ax) * ux + (car.z - az) * uz;
      along = Math.max(0, Math.min(along + lookahead, abLen));
      const px = ax + ux * along, pz = az + uz * along;
      const desired = Math.atan2(px - car.x, pz - car.z);
      let err = desired - car.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const speed = Math.abs(car.speed);
      // Speed follows the heading error: fast only while aligned. A car
      // that accelerates mid-turn swings wide off the road and wedges
      // against a building face, so a large error holds it to a crawl —
      // a turn of 70 deg or more still to make runs at 3 m/s, where a
      // U-turn's arc stays on the road instead of bulging into the block.
      let want = Math.min(36, dist * 0.3 + 5);
      if (Math.abs(turn) > 0.35 && dist < 60) want = Math.min(want, 5);
      else if (dist < 30) want = Math.min(want, 12);
      want = Math.min(want, 3 + 30 * Math.max(0, 1.2 - Math.abs(err)));
      const codes = new Set();
      if (reversing > 0) {
        // Back out of the wedge, steering the other way.
        codes.add('KeyS');
        if (err > 0) codes.add('KeyA');
        else codes.add('KeyD');
        reversing--;
      } else {
        if (speed < want) codes.add('KeyW');
        else if (speed > want + 2) codes.add('KeyS');
        steerAcc += Math.max(-1, Math.min(1, err * 2.0));
        if (steerAcc >= 0.5) { codes.add('KeyD'); steerAcc -= 1; }
        else if (steerAcc <= -0.5) { codes.add('KeyA'); steerAcc += 1; }
      }
      game.step(1 / 60, codes, []);
      steps++;
      // Stuck detection: barely moved in 3 s of driving means the car is
      // wedged against something; reverse out for 1.5 s.
      if (steps % 180 === 0) {
        if (Math.hypot(car.x - lastX, car.z - lastZ) < 1 && reversing === 0) {
          stuckSteps++;
          reversing = 90;
        }
        lastX = car.x; lastZ = car.z;
      }
    }
    return {
      reached: wi >= targets.length,
      steps,
      seconds: +(steps / 60).toFixed(1),
      stuckRecoveries: stuckSteps,
      finalDist: wi < targets.length
        ? +Math.hypot(targets[wi][0] - car.x, targets[wi][1] - car.z).toFixed(1)
        : 0,
    };
  }

  function stopCar(maxSteps = 240) {
    const car = game.player().car;
    if (!car) return;
    for (let i = 0; i < maxSteps; i++) {
      if (Math.abs(car.speed) < 0.5) break;
      game.step(1 / 60, S, []);
    }
  }

  function press(code) {
    game.step(1 / 60, NONE, [code]);
  }

  function missionTest() {
    const out = { missions: [], totalCash: 0, dropTest: null, timerFailTest: null, pass: false };
    game.resetTest();
    game.traffic.freezeForTest();
    // A coupe on the x = 200 street, facing north. Routes below stay on
    // street centre lines and cross the canal only on the z = 0 bridge:
    // the x = 0 "street" is the canal itself, and horizontal streets cross
    // the water nowhere else.
    const car = game.spawnCar('coupe', 200, 100, Math.PI, 'player');
    game.enterCar(car);

    // Mission 1: pick up in South Market, deliver to Pearl Marina.
    press('KeyM');
    const m1 = { id: 1, title: 'A Receipt for Sunshine' };
    m1.markerAtAccept = game.missions.marker();
    m1.objectiveAtAccept = game.missions.status().active
      ? game.missions.status().active.label : null;
    m1.toPickup = driveTo([[200, 0], [-1000, 0], [-1000, 600]]);
    stopCar();
    press('KeyQ');
    m1.pickedUp = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    // Cargo drop: X leaves the package on the street; the marker moves to
    // it and Q picks it back up before the job can finish.
    press('KeyX');
    const droppedAt = game.missions.status().active
      ? game.missions.status().active.dropped : null;
    out.dropTest = {
      dropped: droppedAt,
      markerAtCargo: game.missions.marker(),
    };
    press('KeyQ');
    out.dropTest.repicked = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    m1.toDeliver = driveTo([[-1000, 0], [-200, 0], [-200, -1400], [-600, -1400]]);
    stopCar();
    press('KeyQ');
    m1.done = game.missions.status().completed.includes(1);
    m1.cash = game.missions.cash;
    out.missions.push(m1);

    // Mission 2: the ledger, with a 120 s timed leg after pickup.
    press('KeyM');
    const m2 = { id: 2, title: 'Salt Ledger' };
    m2.toPickup = driveTo([[-200, -1400], [-200, 0], [200, 0], [200, -200]]);
    stopCar();
    press('KeyQ');
    m2.pickedUp = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    m2.toDeliver = driveTo([[200, 0], [-200, 0], [-200, -600], [-1200, -600]]);
    stopCar();
    press('KeyQ');
    m2.done = game.missions.status().completed.includes(2);
    m2.cash = game.missions.cash;
    // The timed leg is the drive from pickup to delivery: it must fit
    // inside the 120 s the mission allows.
    m2.timedLegSeconds = m2.toDeliver.seconds;
    out.missions.push(m2);

    // Mission 3: three shutters in Citrus Quarter, 240 s from accept.
    press('KeyM');
    const m3 = { id: 3, title: 'After the Shutters' };
    m3.toShop1 = driveTo([[-200, -600], [-200, 0], [800, 0]]);
    stopCar();
    press('KeyQ');
    m3.toShop2 = driveTo([[1200, 0], [1200, 400]]);
    stopCar();
    press('KeyQ');
    m3.toShop3 = driveTo([[1200, 800], [1600, 800]]);
    stopCar();
    press('KeyQ');
    m3.done = game.missions.status().completed.includes(3);
    m3.cash = game.missions.cash;
    out.missions.push(m3);

    // Mission 4: deliver the payment (carried from accept), then lose the
    // tail. The pursuer starts 35 units behind and tops out at 28 m/s
    // against the coupe's 36, so the escape is a long straight: the car
    // runs west down z = -600, gaining ~8 m/s on the tail, and the gap
    // clears 110 well before the first corner. (A short route with an
    // early turn fails: the car brakes for the corner while the tail,
    // which cuts corners, does not, and the gap never reaches 110.)
    press('KeyM');
    const m4 = { id: 4, title: 'Glass Debt' };
    m4.carryingAtAccept = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    m4.toDeliver = driveTo([[1600, -600], [1200, -600]]);
    stopCar();
    press('KeyQ');
    m4.pursuerSpawned = game.missions.status().active
      ? !!game.missions.status().active.pursuer : false;
    m4.escape = driveTo([[-1400, -600], [-1400, 200]], {
      maxSeconds: 70,
      done: () => game.missions.status().active === null,
    });
    m4.done = game.missions.status().completed.includes(4);
    m4.cash = game.missions.cash;
    m4.pursuerLeft = !game.vehicles.cars.some((c) => c.pursuer);
    out.missions.push(m4);

    // Mission 5: the long night run — South Market to Sunstrand Beach by
    // way of Glasspoint. Accepting it flips the light to night (the
    // mission carries its own preset) and the headlights come on with it.
    press('KeyM');
    const m5 = { id: 5, title: 'The Long Way Home' };
    m5.preset = game.preset();
    m5.headlights = game.headlightsOn();
    // The pickup leg crosses the canal ONLY on the z = 0 bridge: the car
    // ends mission 4 running west down z = -600, and z = -600 has no
    // bridge — a straight west run stops dead in the canal water at x = 70
    // (25 stuck recoveries in the first run of this test). So the route
    // comes back east to x = 200 first, then north to the bridge.
    m5.toPickup = driveTo([[200, -600], [200, 0], [-1000, 0], [-1000, 600]], { maxSeconds: 240 });
    stopCar();
    press('KeyQ');
    m5.pickedUp = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    m5.toWaypoint = driveTo([[-1000, 0], [200, 0], [1400, 0], [1400, -1000]], { maxSeconds: 300 });
    stopCar();
    press('KeyQ');
    m5.visited = game.missions.status().active
      ? game.missions.status().active.stepIndex : null;
    m5.toDeliver = driveTo([[1400, 0], [1600, 0], [1600, 1200]], { maxSeconds: 180 });
    stopCar();
    press('KeyQ');
    m5.done = game.missions.status().completed.includes(5);
    m5.cash = game.missions.cash;
    out.missions.push(m5);

    // Mission 6: three plots in Old Solmar on a 320 s clock; each witness
    // buys 60 s back. The approach from Sunstrand Beach is the long leg —
    // the clock has to cover it, the bonuses only the legs between plots.
    press('KeyM');
    const m6 = { id: 6, title: 'Unbought Ground' };
    m6.preset = game.preset();
    m6.toCp1 = driveTo([[1600, 0], [200, 0], [-800, 0], [-800, -400]], { maxSeconds: 320 });
    stopCar();
    m6.remainingBeforeCp1 = game.missions.status().active
      ? game.missions.status().active.remaining : null;
    press('KeyQ');
    m6.remainingAfterCp1 = game.missions.status().active
      ? game.missions.status().active.remaining : null;
    m6.bonusApplied = (m6.remainingAfterCp1 !== null && m6.remainingBeforeCp1 !== null)
      ? +(m6.remainingAfterCp1 - m6.remainingBeforeCp1).toFixed(2) : null;
    m6.toCp2 = driveTo([[-800, -1000], [-1200, -1000]], { maxSeconds: 180 });
    stopCar();
    press('KeyQ');
    m6.toCp3 = driveTo([[-1200, -600], [-1600, -600]], { maxSeconds: 180 });
    stopCar();
    press('KeyQ');
    m6.done = game.missions.status().completed.includes(6);
    m6.cash = game.missions.cash;
    out.missions.push(m6);

    // Mission 7: the contract from the marina to Oren in Canal Ward, then
    // lose the tail — this time east, down z = 600: the tail spawns
    // behind a southbound car, and a west escape would run straight into
    // the canal, which has no bridge at z = 600.
    press('KeyM');
    const m7 = { id: 7, title: 'Open Contract' };
    m7.toPickup = driveTo([[-1600, -1400], [-1000, -1400]], { maxSeconds: 180 });
    stopCar();
    press('KeyQ');
    m7.pickedUp = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    m7.toDeliver = driveTo([[-1000, 0], [200, 0], [400, 0], [400, 600]], { maxSeconds: 300 });
    stopCar();
    press('KeyQ');
    m7.pursuerSpawned = game.missions.status().active
      ? !!game.missions.status().active.pursuer : false;
    m7.escape = driveTo([[1600, 600], [1600, 200]], {
      maxSeconds: 70,
      done: () => game.missions.status().active === null,
    });
    m7.done = game.missions.status().completed.includes(7);
    m7.cash = game.missions.cash;
    m7.pursuerLeft = !game.vehicles.cars.some((c) => c.pursuer);
    out.missions.push(m7);

    // Mission 8: the finale — the evidence from Glasspoint to the
    // broadcast tower in Pearl Marina, then hold the rooftop for 20 s
    // while the broadcast goes out.
    press('KeyM');
    const m8 = { id: 8, title: 'Everyone Gets the Morning' };
    m8.toPickup = driveTo([[1000, 600], [1000, 0], [1000, -1000]], { maxSeconds: 240 });
    stopCar();
    press('KeyQ');
    m8.pickedUp = game.missions.status().active
      ? game.missions.status().active.carrying : null;
    m8.toTower = driveTo([[1000, 0], [200, 0], [-1200, 0], [-1200, -1400]], { maxSeconds: 360 });
    stopCar();
    press('KeyQ');
    m8.holdStep = game.missions.status().active
      ? game.missions.status().active.step : null;
    m8.holdRemainingAtStart = game.missions.status().active
      ? game.missions.status().active.remaining : null;
    // Hold the rooftop: wait out the 20 s broadcast, catching the banner
    // the moment it plays (it only lasts 4 s).
    let finaleBanner = '';
    for (let i = 0; i < 25 * 60; i++) {
      game.step(1 / 60, NONE, []);
      const b = game.missions.bannerText();
      if (b && b.includes('broadcast')) finaleBanner = b;
      if (game.missions.status().completed.includes(8)) break;
    }
    m8.banner = finaleBanner;
    m8.done = game.missions.status().completed.includes(8);
    m8.cash = game.missions.cash;
    out.missions.push(m8);

    out.totalCash = game.missions.cash;

    // Failure path: play missions 1 and 2 up to the ledger pickup, then
    // idle past the 120 s leg and confirm the mission fails.
    game.resetTest();
    game.traffic.freezeForTest();
    const car2 = game.spawnCar('coupe', 200, 100, Math.PI, 'player');
    game.enterCar(car2);
    press('KeyM');
    driveTo([[200, 0], [-1000, 0], [-1000, 600]]);
    stopCar();
    press('KeyQ');
    driveTo([[-1000, 0], [-200, 0], [-200, -1400], [-600, -1400]]);
    stopCar();
    press('KeyQ');
    press('KeyM');
    driveTo([[-200, -1400], [-200, 0], [200, 0], [200, -200]]);
    stopCar();
    press('KeyQ');
    for (let i = 0; i < 130 * 60; i++) game.step(1 / 60, NONE, []);
    const failStatus = game.missions.status();
    out.timerFailTest = {
      failed: failStatus.failed,
      activeAfterFail: failStatus.active,
      cashUnchanged: failStatus.cash === 250,
    };
    // A failed mission can be retried: M accepts it again.
    press('KeyM');
    out.timerFailTest.retryAccepted = game.missions.status().active !== null &&
      game.missions.status().active.id === 2;

    game.resetTest();
    out.pass = out.missions.every((m) => m.done) &&
      out.totalCash === 4250 &&
      out.missions[4].preset === 'night' &&
      out.missions[4].headlights === true &&
      out.missions[4].visited === 2 &&
      out.missions[5].preset === 'day' &&
      out.missions[5].bonusApplied !== null && out.missions[5].bonusApplied > 59 &&
      out.missions[6].pursuerSpawned === true &&
      out.missions[7].holdStep === 'hold' &&
      out.missions[7].holdRemainingAtStart !== null && out.missions[7].holdRemainingAtStart >= 19.9 &&
      out.missions[7].banner.includes('broadcast') &&
      out.dropTest.repicked === 'package' &&
      out.timerFailTest.failed !== null &&
      out.timerFailTest.failed.title === 'Salt Ledger' &&
      out.timerFailTest.cashUnchanged &&
      out.timerFailTest.retryAccepted;
    return out;
  }

  // ---- Stage D: walking on foot ----
  // Mara walks where the camera looks: W for 2 s north down the x = 200
  // street moves her about 12 units and the camera follows her. The canal
  // edge blocks her: walking west from (72, 200) she stops at the water
  // instead of wading in.
  function walkTest() {
    const out = { walk: null, blocked: null, pass: false };
    game.resetTest();
    game.traffic.freezeForTest();
    // Face north: the camera sits south of Mara, looking north.
    game.setCamera([200, 20, 240], [200, 0, 200]);
    const start = { x: game.player().x, z: game.player().z };
    for (let i = 0; i < 120; i++) game.step(1 / 60, W, []);
    const after = { x: +game.player().x.toFixed(1), z: +game.player().z.toFixed(1) };
    const target = game.cameraTarget();
    out.walk = {
      start,
      after,
      moved: +Math.hypot(after.x - start.x, after.z - start.z).toFixed(1),
      cameraTarget: target.map((v) => +v.toFixed(1)),
      cameraFollows: Math.abs(target[0] - after.x) < 0.01 && Math.abs(target[2] - after.z) < 0.01,
    };
    // The canal edge: two units of dry ground, then the water.
    const p = game.player();
    p.x = 72; p.z = 200; p.heading = 0;
    game.setCamera([100, 20, 200], [72, 0, 200]);
    for (let i = 0; i < 120; i++) game.step(1 / 60, W, []);
    out.blocked = { x: +p.x.toFixed(1), z: +p.z.toFixed(1) };
    out.pass = out.walk.moved >= 10 && out.walk.moved <= 14 &&
      after.z < start.z &&
      out.walk.cameraFollows &&
      out.blocked.x >= 69.9 && out.blocked.x < 72 &&
      out.blocked.z === 200;
    game.resetTest();
    return out;
  }

  // ---- Stage E: police, garages, radio, density ----
  // The police test plays mission 1 for cash, then gets busted on purpose:
  // wanted 1, stop, wait for the arrest, and check the park recovery, the
  // $200 penalty and the failed mission. Then it outruns a patrol car at
  // full speed and checks the heat cools off once far away.
  function policeTest() {
    const out = { arrest: null, escape: null, pass: false };
    game.resetTest();
    game.traffic.freezeForTest();
    game.police.enable();
    const car = game.spawnCar('coupe', 200, 100, Math.PI, 'player');
    game.enterCar(car);
    // Earn $250 first (mission 1), so the penalty has something to take.
    press('KeyM');
    driveTo([[200, 0], [-1000, 0], [-1000, 600]]);
    stopCar();
    press('KeyQ');
    driveTo([[-1000, 0], [-200, 0], [-200, -1400], [-600, -1400]]);
    stopCar();
    press('KeyQ');
    const cashBefore = game.missions.cash;
    // Accept mission 2 so the bust has a mission to fail.
    press('KeyM');
    game.police.setWanted(1);
    for (let i = 0; i < 120; i++) game.step(1 / 60, NONE, []);
    const spawned = game.police.status();
    // Drive off, then stop and wait for the arrest.
    for (let i = 0; i < 180; i++) game.step(1 / 60, W, []);
    stopCar();
    let minDist = Infinity;
    let busted = false;
    for (let i = 0; i < 40 * 60; i++) {
      game.step(1 / 60, NONE, []);
      const st = game.police.status();
      // While driving, player.x/z are where Mara got in the car — the
      // police chase the car, so measure to the car when there is one.
      const pl = game.player();
      const ppx = pl.car ? pl.car.x : pl.x;
      const ppz = pl.car ? pl.car.z : pl.z;
      for (const p of game.police.policeCars()) {
        minDist = Math.min(minDist, Math.hypot(p.x - ppx, p.z - ppz));
      }
      if (st.busts >= 1) { busted = true; break; }
    }
    const after = game.police.status();
    const p = game.player();
    const fail = game.missions.status().failed;
    out.arrest = {
      cashBefore,
      wantedAtSpawn: spawned.wanted,
      policeAtSpawn: spawned.police,
      minPoliceDist: +minDist.toFixed(1),
      busted,
      busts: after.busts,
      cashAfter: game.missions.cash,
      penalty: cashBefore - game.missions.cash,
      playerAtPark: Math.abs(p.x - 0) < 25 && Math.abs(p.z - 1300) < 25,
      playerPos: [+p.x.toFixed(1), +p.z.toFixed(1)],
      onFoot: p.onFoot,
      wantedAfter: after.wanted,
      healthAfter: after.health,
      missionFailed: fail ? fail.title : null,
    };

    // Escape: outrun the patrol car, then stay far away and watch the
    // heat cool off. The car is moved far away (a teleport stands in for
    // a long clean getaway); the point under test is the decay timer, not
    // the driving — the outrun above it proves the coupe is faster.
    game.resetTest();
    game.traffic.freezeForTest();
    game.police.enable();
    const car2 = game.spawnCar('coupe', 200, 100, Math.PI, 'player');
    game.enterCar(car2);
    game.police.setWanted(1);
    for (let i = 0; i < 120; i++) game.step(1 / 60, NONE, []);
    let gapAfter12s = 0;
    for (let i = 0; i < 12 * 60; i++) {
      game.step(1 / 60, W, []);
      for (const pc of game.police.policeCars()) {
        gapAfter12s = Math.max(gapAfter12s, Math.hypot(pc.x - car2.x, pc.z - car2.z));
      }
    }
    car2.x = 1600; car2.z = 1200;
    for (let i = 0; i < 30 * 60; i++) game.step(1 / 60, NONE, []);
    const esc = game.police.status();
    out.escape = {
      gapAfter12s: +gapAfter12s.toFixed(1),
      wantedAfter30s: esc.wanted,
      heatAfter30s: esc.heat,
      policeAfter30s: esc.police,
    };
    game.resetTest();
    out.pass = out.arrest.cashBefore === 250 &&
      out.arrest.wantedAtSpawn === 1 &&
      out.arrest.policeAtSpawn === 1 &&
      out.arrest.minPoliceDist < 30 &&
      out.arrest.busted &&
      out.arrest.penalty === 200 &&
      out.arrest.cashAfter === 50 &&
      out.arrest.playerAtPark &&
      out.arrest.onFoot &&
      out.arrest.wantedAfter === 0 &&
      out.arrest.healthAfter === 100 &&
      out.arrest.missionFailed === 'Salt Ledger' &&
      out.escape.gapAfter12s > 100 &&
      out.escape.wantedAfter30s === 0 &&
      out.escape.policeAfter30s === 0;
    return out;
  }

  // The garage test: store a coupe in Old Solmar, take it back out with G,
  // store a sedan in Pearl Marina, and check the stored car survives a
  // mission accept and a missions reset.
  function garageTest() {
    const out = { store: null, retrieve: null, persist: null, padsClear: null, pass: false };
    game.resetTest();
    game.traffic.freezeForTest();
    const probe = { length: 4.2, width: 1.8, heading: 0 };
    out.padsClear = {
      oldSolmar: game.vehicles.collidesAt(probe, -992, -600, null) === null,
      pearlMarina: game.vehicles.collidesAt(probe, -592, -1400, null) === null,
    };
    const car = game.spawnCar('coupe', -992, -600, 0, 'player');
    game.enterCar(car);
    const carId = car.id;
    out.store = {
      bayAtSpawn: !!game.garages.inside(-992, -600),
      bayName: game.garages.inside(-992, -600) ? game.garages.inside(-992, -600).name : null,
    };
    press('KeyE');
    const stillThere = game.vehicles.cars.some((c) => c.id === carId);
    out.store.storedCount = game.garages.status().count;
    out.store.carRemoved = !stillThere;
    out.store.onFoot = game.player().onFoot;
    press('KeyG');
    out.retrieve = {
      storedCount: game.garages.status().count,
      driving: !game.player().onFoot,
      profile: game.player().car ? game.player().car.profile : null,
    };
    // Store a second car in Pearl Marina, then check persistence.
    const old = game.player().car;
    if (old) game.vehicles.removeCar(old);
    game.exitCar();
    const car2 = game.spawnCar('sedan', -592, -1400, Math.PI / 2, 'player');
    game.enterCar(car2);
    press('KeyE');
    out.persist = {
      storedAfterSecond: game.garages.status().count,
      storedProfiles: game.garages.status().stored,
    };
    game.missions.accept(1);
    out.persist.storedAfterAccept = game.garages.status().count;
    game.missions.reset();
    out.persist.storedAfterMissionsReset = game.garages.status().count;
    press('KeyG');
    out.persist.retrievedProfile = game.player().car ? game.player().car.profile : null;
    out.persist.drivingAgain = !game.player().onFoot;
    game.resetTest();
    out.pass = out.padsClear.oldSolmar && out.padsClear.pearlMarina &&
      out.store.bayAtSpawn && out.store.bayName === 'Old Solmar Garage' &&
      out.store.storedCount === 1 && out.store.carRemoved && out.store.onFoot &&
      out.retrieve.storedCount === 0 && out.retrieve.driving && out.retrieve.profile === 'coupe' &&
      out.persist.storedAfterSecond === 1 && out.persist.storedProfiles[0] === 'sedan' &&
      out.persist.storedAfterAccept === 1 && out.persist.storedAfterMissionsReset === 1 &&
      out.persist.retrievedProfile === 'sedan' && out.persist.drivingAgain;
    return out;
  }

  // The radio test: the three stations cycle by name, with or without
  // sound (headless Chrome has no gesture, so audio may stay locked —
  // switching is what the game promises).
  function radioTest() {
    const out = { stations: null, cycle: [], pass: false };
    game.resetTest();
    out.stations = game.radio.stations();
    out.cycle.push(game.radio.station());
    out.cycle.push(game.radio.next());
    out.cycle.push(game.radio.next());
    out.cycle.push(game.radio.next());
    out.cycle.push(game.radio.next());
    out.pass = out.stations.length === 3 &&
      out.stations[0] === 'Solmar FM' &&
      out.stations[1] === 'Canal Drive' &&
      out.stations[2] === 'Sunstrand Nights' &&
      out.cycle[0] === 'Solmar FM' &&
      out.cycle[1] === 'Canal Drive' &&
      out.cycle[2] === 'Sunstrand Nights' &&
      out.cycle[3] === 'Solmar FM' &&
      out.cycle[4] === 'Canal Drive';
    game.resetTest();
    return out;
  }

  // The density check: more traffic and twice the pedestrians, counted
  // after a fresh reset, plus ten seconds of live traffic with no errors.
  function densityCheck() {
    const out = { traffic: 0, pedestrians: 0, pass: false };
    game.resetTest();
    out.traffic = game.traffic.traffic.length;
    out.pedestrians = game.traffic.pedestrians.length;
    for (let i = 0; i < 600; i++) game.step(1 / 60, NONE, []);
    out.pass = out.traffic >= 18 && out.pedestrians === 40;
    game.resetTest();
    return out;
  }

  return { driveTest, headlightTest, missionTest, walkTest, policeTest, garageTest, radioTest, densityCheck };
}
