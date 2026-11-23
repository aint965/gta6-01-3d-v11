// Palkon Auto — Stage C: missions and story.
// Mara Venn, a driver-for-hire in Solmar, takes work from Neri and Oren
// while Bastion Civic and its fixer Silas Rook squeeze the city. Missions
// 1-4: a package, a ledger on a timed leg, three shutters before dusk, and
// a payment with a tail to lose.
// Stage D closes the arc with missions 5-8: a long night run home, three
// plots in Old Solmar that each buy time, an open contract with a tail,
// and the finale — the evidence, the broadcast tower, and a 20-second
// hold while the broadcast goes out. Missions are accepted with M,
// advanced with Q near the objective, and pay cash on completion; X drops
// carried cargo, which must be picked up again before the job can finish.
// A failed mission can be retried: the next mission only unlocks once the
// current one is complete.
//
// Rewards for missions 1-4 sum to $1,800; missions 5-8 pay $2,450, for a
// clean-play total of $4,250 across all eight.
export const MISSIONS = [
  {
    id: 1,
    title: 'A Receipt for Sunshine',
    giver: 'Neri',
    reward: 250,
    intro: 'Neri: pick up a package in South Market and run it to Pearl Marina.',
    steps: [
      {
        kind: 'pickup', point: [-1000, 600], cargo: 'package',
        label: 'Pick up the package in South Market',
        action: 'Pick up the package',
      },
      {
        kind: 'deliver', point: [-600, -1400], cargo: 'package',
        label: 'Deliver the package to Pearl Marina',
        action: 'Deliver the package',
      },
    ],
  },
  {
    id: 2,
    title: 'Salt Ledger',
    giver: 'Oren',
    reward: 500,
    intro: 'Oren: the ledger is at the canal office. The handover to Neri is timed.',
    steps: [
      {
        kind: 'pickup', point: [200, -200], cargo: 'ledger',
        label: 'Collect the ledger from the canal office',
        action: 'Collect the ledger',
      },
      {
        kind: 'deliver', point: [-1200, -600], cargo: 'ledger', timer: 120,
        label: 'Bring the ledger to Neri in Old Solmar',
        action: 'Hand over the ledger',
      },
    ],
  },
  {
    id: 3,
    title: 'After the Shutters',
    giver: 'Neri',
    reward: 450,
    timer: 240,
    intro: 'Neri: photograph three shuttered shops in Citrus Quarter before dusk.',
    steps: [
      {
        kind: 'photo', point: [800, 0],
        label: 'Photograph the shutter — Mercer Row',
        action: 'Photograph the shutter',
      },
      {
        kind: 'photo', point: [1200, 400],
        label: 'Photograph the shutter — Citrus Row',
        action: 'Photograph the shutter',
      },
      {
        kind: 'photo', point: [1600, 800],
        label: 'Photograph the shutter — Palm Row',
        action: 'Photograph the shutter',
      },
    ],
  },
  {
    id: 4,
    title: 'Glass Debt',
    giver: 'Oren',
    reward: 600,
    intro: 'Oren: deliver the payment to Glasspoint. Expect a tail.',
    steps: [
      {
        kind: 'deliver', point: [1200, -600], cargo: 'payment',
        label: 'Deliver the payment to Glasspoint',
        action: 'Deliver the payment',
      },
      {
        kind: 'escape', timeout: 60,
        label: 'Lose the tail',
      },
    ],
  },
  {
    id: 5,
    title: 'The Long Way Home',
    giver: 'Neri',
    reward: 500,
    preset: 'night',
    intro: 'Neri: a long run tonight — South Market to Sunstrand Beach, by way of Glasspoint. Keep the headlights on.',
    steps: [
      {
        kind: 'pickup', point: [-1000, 600], cargo: 'parcel',
        label: 'Pick up the parcel in South Market',
        action: 'Pick up the parcel',
      },
      {
        kind: 'visit', point: [1400, -1000],
        label: 'Pass through Glasspoint',
        action: 'Check in at Glasspoint',
      },
      {
        kind: 'deliver', point: [1600, 1200], cargo: 'parcel',
        label: 'Deliver the parcel to Sunstrand Beach',
        action: 'Deliver the parcel',
      },
    ],
  },
  {
    id: 6,
    title: 'Unbought Ground',
    giver: 'Oren',
    reward: 550,
    preset: 'day',
    timer: 320,
    intro: 'Oren: three plots in Old Solmar need a witness. Each one buys you time.',
    steps: [
      {
        kind: 'visit', point: [-800, -400], timeBonus: 60,
        label: 'Witness the plot — Mercer Lane',
        action: 'Witness the plot',
      },
      {
        kind: 'visit', point: [-1200, -1000], timeBonus: 60,
        label: 'Witness the plot — Old Quay',
        action: 'Witness the plot',
      },
      {
        kind: 'visit', point: [-1600, -600],
        label: 'Witness the plot — Salt Yard',
        action: 'Witness the plot',
      },
    ],
  },
  {
    id: 7,
    title: 'Open Contract',
    giver: 'Neri',
    reward: 650,
    intro: 'Neri: the contract is at the marina. Oren is waiting in Canal Ward — and the tail is back.',
    steps: [
      {
        kind: 'pickup', point: [-1000, -1400], cargo: 'contract',
        label: 'Pick up the contract at Pearl Marina',
        action: 'Pick up the contract',
      },
      {
        kind: 'deliver', point: [400, 600], cargo: 'contract',
        label: 'Deliver the contract to Oren in Canal Ward',
        action: 'Deliver the contract',
      },
      {
        kind: 'escape', timeout: 60,
        label: 'Lose the tail',
      },
    ],
  },
  {
    id: 8,
    title: 'Everyone Gets the Morning',
    giver: 'Oren',
    reward: 750,
    outro: 'The broadcast is out. Solmar wakes up.',
    intro: 'Oren: the evidence is in Glasspoint. Get it to the broadcast tower in Pearl Marina — and hold the roof while it goes out.',
    steps: [
      {
        kind: 'pickup', point: [1000, -1000], cargo: 'evidence',
        label: 'Collect the evidence in Glasspoint',
        action: 'Collect the evidence',
      },
      {
        kind: 'deliver', point: [-1200, -1400], cargo: 'evidence',
        label: 'Bring the evidence to the broadcast tower',
        action: 'Deliver the evidence',
      },
      {
        kind: 'hold', point: [-1200, -1400], holdSeconds: 20,
        label: 'Hold the rooftop while the broadcast goes out',
      },
    ],
  },
];

export const INTERACT_RADIUS = 10;
const PICKUP_RADIUS = 8;
const ESCAPE_DISTANCE = 110;
const ESCAPE_HOLD = 4;
const PURSUER_SPEED = 28;
const BANNER_SECONDS = 4;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createMissions(deps) {
  const { vehicles, getPos, getHeading, now, setPreset } = deps;

  let cash = 0;
  let nextIndex = 0;
  let active = null; // { def, stepIndex, stepTime, missionTime, cargo, dropped, pursuer, pursuerSpeed, escapeHold, holdProgress }
  let completed = [];
  let failed = null; // { title, reason }
  let banner = null; // { text, until }

  function setBanner(text) {
    banner = { text, until: now() + BANNER_SECONDS };
  }

  function currentStep() {
    return active ? active.def.steps[active.stepIndex] : null;
  }

  function removePursuer() {
    if (active && active.pursuer) {
      vehicles.removeCar(active.pursuer);
      active.pursuer = null;
    }
  }

  function completeMission() {
    const def = active.def;
    cash += def.reward;
    completed.push(def.id);
    // The finale ends on its broadcast line, not the standard banner.
    setBanner(def.outro
      ? def.outro + '  +$' + def.reward
      : 'Mission complete: ' + def.title + '  +$' + def.reward);
    removePursuer();
    active = null;
    nextIndex++;
  }

  function failMission(reason) {
    const def = active.def;
    failed = { title: def.title, reason };
    setBanner('Mission failed: ' + def.title + ' — ' + reason);
    removePursuer();
    active = null;
  }

  // Stage E: the police end a run — the active mission fails, the cash
  // penalty comes out of the total, and a banner says what happened.
  function failActive(reason) {
    if (active) failMission(reason);
  }

  function deductCash(n) {
    const d = Math.min(cash, n);
    cash -= d;
    return d;
  }

  function notify(text) { setBanner(text); }

  function advanceStep() {
    // A step that buys time (a witnessed plot) pushes the mission clock
    // back before the next step starts.
    const done = active.def.steps[active.stepIndex];
    if (done.timeBonus) {
      active.missionTime = Math.max(0, active.missionTime - done.timeBonus);
      setBanner('+' + done.timeBonus + 's — the witness buys you time.');
    }
    active.stepIndex++;
    active.stepTime = 0;
    if (active.stepIndex >= active.def.steps.length) {
      completeMission();
      return;
    }
    if (currentStep().kind === 'escape') spawnPursuer();
  }

  function spawnPursuer() {
    const [px, pz] = getPos();
    const heading = getHeading();
    // Thirty-five units behind the player, on the same street: the tail
    // pulls out of the traffic and starts closing in.
    const bx = px - Math.sin(heading) * 35;
    const bz = pz - Math.cos(heading) * 35;
    const car = vehicles.makeCar('sedan', bx, bz, heading, 'traffic');
    car.pursuer = true;
    active.pursuer = car;
    active.pursuerSpeed = 0;
    active.escapeHold = 0;
    setBanner('A tail is on you — lose it!');
  }

  function accept(id) {
    if (active) return false;
    const index = id === undefined
      ? nextIndex
      : MISSIONS.findIndex((m) => m.id === id);
    if (index < 0 || index >= MISSIONS.length) return false;
    // Only the next mission in order can be accepted (a staged shot may
    // name mission 1 while it is the next one).
    if (index !== nextIndex) return false;
    const def = MISSIONS[index];
    active = {
      def, stepIndex: 0, stepTime: 0, missionTime: 0,
      cargo: null, dropped: null, pursuer: null, pursuerSpeed: 0, escapeHold: 0,
      holdProgress: 0,
    };
    failed = null;
    // A mission can set the light it plays in: the long way home runs at
    // night, the next morning runs at midday.
    if (def.preset && setPreset) setPreset(def.preset);
    // A delivery that opens the mission hands the cargo over at accept.
    if (def.steps[0].kind === 'deliver' && def.steps[0].cargo) {
      active.cargo = def.steps[0].cargo;
    }
    setBanner('New mission: ' + def.title + ' — ' + def.intro);
    return true;
  }

  function interact() {
    if (!active) return false;
    const [px, pz] = getPos();
    // Dropped cargo first: pick it back up before anything else.
    if (active.dropped) {
      const d = Math.hypot(active.dropped.x - px, active.dropped.z - pz);
      if (d <= PICKUP_RADIUS) {
        active.cargo = active.dropped.kind;
        active.dropped = null;
        setBanner('Picked the ' + active.cargo + ' back up.');
        return true;
      }
      return false;
    }
    const step = currentStep();
    if (!step || !step.point) return false;
    const d = Math.hypot(step.point[0] - px, step.point[1] - pz);
    if (d > INTERACT_RADIUS) return false;
    if (step.kind === 'pickup') {
      active.cargo = step.cargo;
      setBanner('Got the ' + step.cargo + '.');
      advanceStep();
      return true;
    }
    if (step.kind === 'photo' || step.kind === 'visit') {
      advanceStep();
      return true;
    }
    if (step.kind === 'deliver') {
      if (active.cargo !== step.cargo) return false;
      active.cargo = null;
      advanceStep();
      return true;
    }
    return false;
  }

  function dropCargo() {
    if (!active || !active.cargo) return false;
    const [px, pz] = getPos();
    active.dropped = { kind: active.cargo, x: px, z: pz };
    active.cargo = null;
    setBanner('Cargo dropped — pick it up again with Q.');
    return true;
  }

  function update(dt) {
    if (!active) return;
    active.missionTime += dt;
    active.stepTime += dt;
    const def = active.def;
    if (def.timer && active.missionTime > def.timer) {
      failMission('Time ran out');
      return;
    }
    const step = currentStep();
    if (!step) return;
    if (step.timer && active.stepTime > step.timer) {
      failMission('Time ran out');
      return;
    }
    if (step.kind === 'escape' && active.pursuer) {
      const p = active.pursuer;
      const [px, pz] = getPos();
      const desired = Math.atan2(px - p.x, pz - p.z);
      const err = wrapAngle(desired - p.heading);
      p.heading += Math.max(-1.2 * dt, Math.min(1.2 * dt, err));
      active.pursuerSpeed = Math.min(PURSUER_SPEED, active.pursuerSpeed + 8 * dt);
      vehicles.moveCar(p, Math.sin(p.heading) * active.pursuerSpeed * dt, Math.cos(p.heading) * active.pursuerSpeed * dt);
      const dist = Math.hypot(px - p.x, pz - p.z);
      if (dist > ESCAPE_DISTANCE) active.escapeHold += dt;
      else active.escapeHold = 0;
      if (active.escapeHold >= ESCAPE_HOLD) advanceStep();
      else if (active.stepTime > step.timeout) failMission('The tail stayed on you');
    }
    // A hold step: stay inside the radius and the broadcast goes out.
    // Step away and the hold drains back to nothing.
    if (active && step.kind === 'hold') {
      const [px, pz] = getPos();
      const d = Math.hypot(step.point[0] - px, step.point[1] - pz);
      if (d <= INTERACT_RADIUS) {
        active.holdProgress += dt;
        if (active.holdProgress >= (step.holdSeconds || 20)) advanceStep();
      } else {
        active.holdProgress = 0;
      }
    }
  }

  // The world-space point the marker beam stands over: the dropped cargo
  // first, then the current step's point. The escape step has no point.
  function marker() {
    if (!active) return null;
    if (active.dropped) return [active.dropped.x, active.dropped.z];
    const step = currentStep();
    return step && step.point ? [...step.point] : null;
  }

  function cratePoint() {
    return active && active.dropped ? [active.dropped.x, active.dropped.z] : null;
  }

  function objectiveText() {
    if (active) {
      const step = currentStep();
      let text = active.def.title + ': ' + step.label;
      const remaining = remainingTime();
      if (remaining !== null) text += ' — ' + Math.ceil(remaining) + 's';
      if (active.dropped) text += ' — cargo dropped, pick it up (Q)';
      return text;
    }
    if (nextIndex < MISSIONS.length) {
      return 'M — Start: ' + MISSIONS[nextIndex].title + ' (' + MISSIONS[nextIndex].giver + ')';
    }
    return 'All missions complete — $' + cash + ' earned';
  }

  function remainingTime() {
    if (!active) return null;
    const def = active.def;
    if (def.timer) return Math.max(0, def.timer - active.missionTime);
    const step = currentStep();
    if (step && step.timer) return Math.max(0, step.timer - active.stepTime);
    if (step && step.kind === 'hold') return Math.max(0, (step.holdSeconds || 20) - (active.holdProgress || 0));
    if (step && step.kind === 'escape') return Math.max(0, step.timeout - active.stepTime);
    return null;
  }

  // The Q / X hints when the player is close enough to use them.
  function prompt() {
    if (!active) return '';
    const [px, pz] = getPos();
    const hints = [];
    if (active.dropped) {
      const d = Math.hypot(active.dropped.x - px, active.dropped.z - pz);
      if (d <= PICKUP_RADIUS) hints.push('Q — Pick up the ' + active.dropped.kind);
    } else {
      const step = currentStep();
      if (step && step.point) {
        const d = Math.hypot(step.point[0] - px, step.point[1] - pz);
        if (d <= INTERACT_RADIUS) {
          // A hold step has no Q action: the hint is the countdown.
          if (step.kind === 'hold') {
            hints.push('Hold the rooftop — ' + Math.ceil((step.holdSeconds || 20) - (active.holdProgress || 0)) + 's');
          } else if (step.action) {
            hints.push('Q — ' + step.action);
          }
        }
      }
    }
    if (active.cargo) hints.push('X — Drop cargo');
    return hints.join(' · ');
  }

  function bannerText() {
    return banner && now() < banner.until ? banner.text : '';
  }

  function reset() {
    removePursuer();
    cash = 0;
    nextIndex = 0;
    active = null;
    completed = [];
    failed = null;
    banner = null;
  }

  // Screenshot staging only: jump the story to the finale's hold step, as
  // if missions 1-7 were already played, so ?shot=finale can frame the
  // broadcast tower with the real hold UI. Never used by normal play.
  function stageFinale() {
    reset();
    cash = 3500;
    completed = [1, 2, 3, 4, 5, 6, 7];
    nextIndex = 7;
    accept(8);
    // Fast-forward past the pickup and the delivery: the shot frames the
    // hold itself, the car parked at the tower.
    active.stepIndex = 2;
    active.stepTime = 0;
    setBanner('New mission: Everyone Gets the Morning — hold the roof.');
  }

  return {
    accept,
    interact,
    dropCargo,
    update,
    marker,
    cratePoint,
    objectiveText,
    prompt,
    bannerText,
    reset,
    stageFinale,
    failActive,
    deductCash,
    notify,
    status() {
      return {
        cash,
        nextId: nextIndex < MISSIONS.length ? MISSIONS[nextIndex].id : null,
        completed: [...completed],
        failed,
        active: active ? {
          id: active.def.id,
          title: active.def.title,
          stepIndex: active.stepIndex,
          step: currentStep() ? currentStep().kind : null,
          label: currentStep() ? currentStep().label : null,
          carrying: active.cargo,
          dropped: active.dropped ? { ...active.dropped } : null,
          pursuer: active.pursuer ? { x: +active.pursuer.x.toFixed(1), z: +active.pursuer.z.toFixed(1) } : null,
          holdProgress: +(active.holdProgress || 0).toFixed(1),
          remaining: remainingTime(),
        } : null,
      };
    },
    get cash() { return cash; },
    get activeId() { return active ? active.def.id : null; },
  };
}
