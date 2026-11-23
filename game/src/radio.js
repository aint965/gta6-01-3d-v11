// Palkon Auto — Stage E: the radio.
// Three procedural stations, no audio files and no licensed music: a few
// oscillators scheduled a bar ahead. The station name is what the game
// shows; the sound only starts after a user gesture (browser autoplay
// rules), and every call is guarded so a browser without audio still
// plays — switching stations always works, with or without sound.
const STATIONS = [
  {
    name: 'Solmar FM',
    bpm: 76, wave: 'triangle', gain: 0.05,
    chords: [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 220, 261.6]],
    bass: [110, 87.3, 98, 82.4],
    lead: [440, 523.3, 659.3, 523.3, 587.3, 523.3, 440, 392],
  },
  {
    name: 'Canal Drive',
    bpm: 112, wave: 'square', gain: 0.035,
    chords: [[146.8, 220, 293.7], [130.8, 196, 261.6], [146.8, 220, 293.7], [164.8, 246.9, 329.6]],
    bass: [73.4, 65.4, 73.4, 82.4],
    lead: [293.7, 293.7, 440, 349.2, 293.7, 261.6, 293.7, 329.6],
  },
  {
    name: 'Sunstrand Nights',
    bpm: 96, wave: 'sine', gain: 0.06,
    chords: [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 293.7], [196, 246.9, 329.6]],
    bass: [130.8, 110, 87.3, 98],
    lead: [523.3, 659.3, 784, 659.3, 587.3, 523.3, 659.3, 587.3],
  },
];

export function createRadio() {
  let index = 0;
  let ctx = null;
  let master = null;
  let timer = null;
  let bar = 0;
  let nextBarTime = 0;

  function station() { return STATIONS[index].name; }
  function stations() { return STATIONS.map((s) => s.name); }

  function tone(freq, at, dur, wave, gain) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  // One bar: a soft chord, a bass note per beat, and an eighth-note lead.
  function scheduleBar() {
    const st = STATIONS[index];
    const beat = 60 / st.bpm;
    const at = nextBarTime;
    const chord = st.chords[bar % st.chords.length];
    for (const f of chord) tone(f, at, beat * 4, st.wave, st.gain * 0.6);
    for (let b = 0; b < 4; b++) {
      tone(st.bass[bar % st.bass.length], at + b * beat, beat * 0.9, 'sine', st.gain * 1.2);
    }
    for (let e = 0; e < 8; e++) {
      tone(st.lead[(bar * 8 + e) % st.lead.length], at + e * beat / 2, beat * 0.45, st.wave, st.gain * 0.7);
    }
    bar++;
    nextBarTime = at + beat * 4;
  }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      nextBarTime = ctx.currentTime + 0.1;
      timer = setInterval(() => {
        if (!ctx || ctx.state !== 'running') return;
        // A suspended context leaves nextBarTime in the past; without
        // this guard the scheduler would fire a burst of catch-up bars
        // (dozens of overlapping notes) the moment it resumes.
        if (nextBarTime < ctx.currentTime) nextBarTime = ctx.currentTime + 0.1;
        while (nextBarTime < ctx.currentTime + 0.6) scheduleBar();
      }, 200);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function next() {
    index = (index + 1) % STATIONS.length;
    return station();
  }

  function isPlaying() { return !!ctx && ctx.state === 'running'; }

  function reset() {
    index = 0;
    bar = 0;
    if (ctx) nextBarTime = ctx.currentTime + 0.1;
  }

  return { station, stations, next, unlock, isPlaying, reset };
}
