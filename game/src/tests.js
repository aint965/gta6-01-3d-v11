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

  return { driveTest, headlightTest };
}
