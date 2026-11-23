// The three lighting presets of Solmar: scorching midday, sunset, night.
// Each preset carries the sun (or moon) direction and colour, the sky
// colours, the fog, and how much the windows and lamps glow.
export const PRESETS = {
  day: {
    label: 'Midday',
    sunDir: [-0.45, -0.85, -0.28],
    sunColor: [1.0, 0.92, 0.78],
    sunStrength: 1.5,
    ambient: [0.55, 0.58, 0.62],
    skyTop: [0.24, 0.55, 0.85],
    skyHorizon: [0.78, 0.86, 0.94],
    fogColor: [0.78, 0.85, 0.92],
    fogDensity: 0.00012,
    windowGlow: 0.0,
    lampGlow: 0.0,
    stars: 0.0,
    waterColor: [0.12, 0.45, 0.55],
  },
  sunset: {
    label: 'Sunset',
    sunDir: [0.92, -0.22, 0.18],
    sunColor: [1.0, 0.55, 0.28],
    sunStrength: 1.1,
    ambient: [0.38, 0.32, 0.34],
    skyTop: [0.22, 0.28, 0.55],
    skyHorizon: [0.98, 0.55, 0.28],
    fogColor: [0.92, 0.58, 0.38],
    fogDensity: 0.00016,
    windowGlow: 0.35,
    lampGlow: 0.5,
    stars: 0.15,
    waterColor: [0.25, 0.3, 0.45],
  },
  night: {
    label: 'Night',
    sunDir: [0.35, -0.7, 0.45],
    sunColor: [0.55, 0.65, 0.9],
    sunStrength: 0.5,
    ambient: [0.12, 0.14, 0.22],
    skyTop: [0.02, 0.03, 0.1],
    skyHorizon: [0.08, 0.1, 0.22],
    fogColor: [0.06, 0.08, 0.16],
    fogDensity: 0.00022,
    windowGlow: 1.0,
    lampGlow: 1.0,
    stars: 1.0,
    waterColor: [0.04, 0.1, 0.18],
  },
};

export const PRESET_ORDER = ['day', 'sunset', 'night'];

export function presetByName(name) {
  return PRESETS[name] || PRESETS.day;
}
