/**
 * LIGHTING CONFIGURATION
 *
 * PDF lighting plan (GA-101):
 *   1. Central skylight — soft natural daylight
 *   2. Track lights (3000K LED) — ceiling-mounted linear track, warm ambient glow
 *   3. Accent spotlights — directional, one per artwork
 *   4. Ambient cove lighting — recessed perimeter cove, eliminates harsh shadows
 *
 * Intensities are in three.js physical units (spot = candela, area = nits-ish)
 * and were calibrated visually against Khronos PBR Neutral tone mapping.
 */

export const LIGHTING = {
  exposure: 1.0,

  sun: {
    /** Sun elevation above the horizon (deg). */
    elevationDeg: 58,
    /** Compass azimuth (deg): 0 = north (-z), 90 = east (+x), 180 = south (+z). */
    azimuthDeg: 118,
    intensity: 4.4,
    colorK: 5600,
  },

  /**
   * Time-of-day presets (visitor-selectable). Each overrides the sun and part of the sky;
   * `midday` equals the defaults above.
   */
  timeOfDay: {
    morning: { elevationDeg: 22, azimuthDeg: 96, intensity: 3.3, colorK: 4400, turbidity: 4.2, rayleigh: 1.6, skyExposure: 0.5 },
    midday: { elevationDeg: 58, azimuthDeg: 118, intensity: 4.4, colorK: 5600, turbidity: 3.2, rayleigh: 1.05, skyExposure: 0.55 },
    golden: { elevationDeg: 11, azimuthDeg: 252, intensity: 3.1, colorK: 3200, turbidity: 6.5, rayleigh: 2.6, skyExposure: 0.46 },
    /**
     * Blue hour: the sun is just below the horizon (the atmosphere keeps a warm band in the west);
     * the directional light becomes a faint cool sky light from `lightElevationDeg/AzimuthDeg`.
     */
    dusk: { elevationDeg: -3.2, azimuthDeg: 262, intensity: 0.32, colorK: 11000, turbidity: 3.4, rayleigh: 2.2, skyExposure: 1, lightElevationDeg: 24, lightAzimuthDeg: 250 },
    /** Night: sun off, moonlight (the directional light) from the south-east; interior lamps take over. */
    night: { elevationDeg: -26, azimuthDeg: 300, intensity: 0.16, colorK: 9000, turbidity: 2, rayleigh: 1, skyExposure: 1, lightElevationDeg: 46, lightAzimuthDeg: 148 },
  },

  /**
   * Artificial-light takeover per time of day (see lighting/timeOfDayState.ts):
   *   night     0 = daylight scene … 1 = full night (sky formers dimmed, lanterns on, stars/moon)
   *   twilight  blue-hour sky gradient amount
   *   exposure  renderer exposure multiplier (eye adapts to the darker scene)
   *   daylight  multiplier on the skylight/area daylight fill and the hemisphere "bounce" fill
   */
  ambience: {
    morning: { night: 0, twilight: 0, exposure: 1, daylight: 1 },
    midday: { night: 0, twilight: 0, exposure: 1, daylight: 1 },
    golden: { night: 0, twilight: 0, exposure: 1.02, daylight: 0.9 },
    dusk: { night: 0.55, twilight: 1, exposure: 1.2, daylight: 0.28 },
    night: { night: 1, twilight: 0, exposure: 1.35, daylight: 0.04 },
  },

  /** Courtyard wall lanterns (lit at dusk/night; they borrow slots from the SpotPool). */
  lanterns: {
    colorK: 2300,
    /** Downlight candela at full night. */
    intensity: 26,
    emissive: 3.2,
  },

  sky: {
    turbidity: 3.2,
    rayleigh: 1.05,
    mieCoefficient: 0.0045,
    mieDirectionalG: 0.82,
    /** Multiplier applied to the atmospheric scattering output. */
    exposure: 0.55,
    clouds: {
      enabled: true,
      coverage: 0.32,
      density: 0.45,
      elevation: 0.55,
      scale: 0.00022,
      speed: 0.000012,
    },
  },

  /** Diffuse daylight arriving through the skylight glass (area light under the lantern). */
  skylightFill: {
    intensity: 2.4,
    colorK: 6500,
  },

  /** Soft global fill (stands in for multi-bounce GI off white plaster and oak). */
  ambient: {
    hemisphereSky: '#e9eef2',
    hemisphereGround: '#d2b692',
    hemisphereIntensity: 0.45,
    environmentIntensity: 0.85,
  },

  track: {
    colorK: 3000,
    /** 0 = pure 3000K, 1 = neutral white. Mimics the eye/camera's partial chromatic adaptation. */
    chromaticAdaptation: 0.45,
    /** Default accent spotlight intensity (candela) per artwork (the drum is lit in pools). */
    artworkIntensity: 30,
    /** Exhibit display-table spot intensity (candela). */
    tableIntensity: 12,
    penumbra: 0.85,
    /** Height of the track rail below the ceiling. */
    railDrop: 0.12,
    /** Beam aim angle from vertical (deg) — museum rule-of-thumb is ~30°. */
    aimAngleDeg: 30,
  },

  cove: {
    colorK: 3000,
    intensity: 1.1,
    /** Emissive strength of the visible LED strip inside the cove slot. */
    stripEmissive: 2.2,
  },

  reception: {
    downlightIntensity: 22,
  },
} as const

/**
 * COLOUR CHOREOGRAPHY (SPECTACLE F27): the light of each room, blended by the visitor's distance
 * to the zones (2 m smoothstep) and eased at 1.5/s by lighting/atmosphere/choreography.ts.
 *
 *   colorK    tint of the fill and the accent lights (and the grade's white balance on H+)
 *   fill      hemisphere / environment bounce (the old per-zone ambient)
 *   exposure  the eye's adaptation to the room
 *   shadow / high   split-tone of the H+ grade (ClayGrade), as hex; contrast around mid-grey
 *
 * Nobody should notice a single change; every room should feel different.
 */
export interface ZoneLight {
  colorK: number
  fill: number
  exposure: number
  shadow: string
  high: string
  contrast: number
  /** Fraction of the fill kept at full night (open-air zones go dark; rooms keep lamp bounce). */
  nightFloor?: number
}

const room = (colorK: number, fill: number, exposure = 1, shadow = '#5a3a32', high = '#ffe6cc', contrast = 1): ZoneLight => ({ colorK, fill, exposure, shadow, high, contrast })

/** The brass wall sconce over each podium (p02): on the ring wall, aimed down at the piece (GRAND §3 #15). */
export const SCONCE = { y: 2.95, setOff: 0.14 } as const

/** Exposure value → renderer exposure multiplier (GRAND §6.2 gives the rooms in EV). */
export const ev = (stops: number) => Math.pow(2, stops)

/**
 * GRAND §6.2 "dark grounds, bright objects": every room has its colour temperature (PDF p08
 * "warm white to neutral") and its exposure in EV. The bounce fill is low everywhere indoors, so
 * the walls fall away and the accent cones (lighting/atmosphere/accents) carry the objects. The
 * split-tones are kept near neutral: the old pink/orange cast over the whole pavilion is gone.
 */
export const ZONE_LIGHT: Record<string, ZoneLight> = {
  /** Forecourt: open daylight. */
  'entrance-court': { ...room(5400, 1.15, ev(0), '#403c3a', '#fff6ea'), nightFloor: 0.04 },
  /** The Earth Room (annex G, p05): 3400 K, −0.15 EV — a soft rose canyon under its skylight, never an orange cave. */
  annex: { ...room(3400, 0.42, ev(-0.15), '#362622', '#fff0e4', 1.05), nightFloor: 0.2 },
  /** Ambulatory and H: 3000 K, 0 EV. */
  'entry-e': { ...room(3000, 0.45, ev(0), '#3a2a24', '#ffe8d0', 1.06), nightFloor: 0.15 },
  /** A: 3000 K on the red lacquer ground, −0.1 EV (p02): the red ground stays dark by its own colour. */
  'ring-a': { ...room(3000, 0.34, ev(-0.1), '#3a1c18', '#ffe4c8', 1.1), nightFloor: 0.15 },
  /** B: 4000 K neutral, for the white niche wall of plaques (p08r). */
  'ring-b': { ...room(4000, 0.6, ev(0), '#34302e', '#fbf6f0', 1.08), nightFloor: 0.15 },
  /** C: 4300 K cool, −0.35 EV: black ware under one cool beam, on a charcoal wall that still reads. */
  'ring-c': { ...room(4300, 0.5, ev(-0.35), '#24262e', '#f2f2f2', 1.1), nightFloor: 0.15 },
  /** The Wine Hall ("Clay Elsewhere", p08l): 2700 K, −0.4 EV — wine walls, timber, spot-lit plinths. */
  'hallway-d': { ...room(2700, 0.28, ev(-0.4), '#2a1216', '#ffdcb8', 1.12), nightFloor: 0.15 },
  /** The court under the dome: daylight 5000–5600 K, +0.2 EV. */
  inner: { ...room(5300, 0.5, ev(0.2), '#36302e', '#fff8ee', 1.06), nightFloor: 0.15 },
  'parikrama-west': { ...room(5400, 1.05, ev(0), '#403632', '#fff4e6'), nightFloor: 0.12 },
  'parikrama-east': { ...room(5400, 1.05, ev(0), '#403632', '#fff4e6'), nightFloor: 0.12 },
  /** The atlas reads true: 4000 K neutral, 0 EV, so the map and the partner logos are never washed. */
  atlas: room(4000, 1.15, ev(0.15), '#3a3836', '#faf8f4'),
  /** A dim red theatre: 2400 K, −0.55 EV, with enough house fill that the rows and the vault read during the film. */
  theatre: room(2400, 0.4, ev(-0.55), '#2e1210', '#ffcfa8', 1.04),
  /** Kothi — the Red Room: 3000 K, −0.6 EV. */
  library: { ...room(3000, 0.3, ev(-0.6), '#341210', '#ffe0c0', 1.1), nightFloor: 0.2 },
  /** The Haat: 3500 K, 0 EV. */
  shop: room(3500, 1.0, ev(0), '#3e3430', '#fff2e0'),
  'sky-rim': { ...room(5400, 1.15, ev(0), '#403c3a', '#fff6ea'), nightFloor: 0.04 },
  /** The balcony shares the rotunda's light (between A's warmth and the court's daylight). */
  duplex: { ...room(4000, 0.42, ev(0), '#34302e', '#fbf4ec', 1.08), nightFloor: 0.15 },
  /** The Sphere Well: 2700 K red, −0.6 EV. */
  'sphere-well': { ...room(2700, 0.3, ev(-0.6), '#3a120e', '#ffd2a8', 1.1), nightFloor: 0.2 },
}

/**
 * Cove lines (SPECTACLE §3 term 4, F5, F27; GRAND §6.2 #6): concealed LEDs washing a wall up or
 * down from a line, as arcs about (cx, cz) at height y between a0 … a1 (deg); a long straight run
 * is an arc of a very large radius. Up to 8. `id`s are what the curator's `cove-light {walls}` names.
 */
export interface CoveDef {
  id: string
  cx: number
  cz: number
  r: number
  y: number
  a0: number
  a1: number
  colorK: number
  /** Brightness of the wash (irradiance at the wall just above the line). */
  intensity: number
  /** How far it reaches (m). */
  reach: number
  /** Washes up the wall (1, the default) or down it (−1). */
  dir?: 1 | -1
  /** A coloured line (hex) instead of a white of `colorK` (the red coves of F, p07l). */
  color?: string
}

/** Tanner Helland's blackbody approximation → linear-ish sRGB hex (good enough for lighting design). */
export function kelvinToRGB(kelvin: number): [number, number, number] {
  const t = kelvin / 100
  let r: number, g: number, b: number
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255
  return [c(r), c(g), c(b)]
}

export function kelvinToHex(kelvin: number, adaptation = 0): string {
  const [r, g, b] = kelvinToRGB(kelvin).map((v) => v + (1 - v) * adaptation)
  const h = (v: number) =>
    Math.round(Math.min(1, v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
