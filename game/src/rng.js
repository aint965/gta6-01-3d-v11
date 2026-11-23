// Seeded random helpers for Solmar: one seed, one city, every time.
// mulberry32 is a small, fast, deterministic PRNG; the same seed always
// produces the same sequence, so the city layout never changes between runs.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Range helper: pick a float in [min, max) from the seeded stream.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick an integer in [min, max] inclusive.
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick one element of an array.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Jitter a value by up to +/- amount, staying deterministic.
export function jitter(rng, value, amount) {
  return value + (rng() * 2 - 1) * amount;
}
