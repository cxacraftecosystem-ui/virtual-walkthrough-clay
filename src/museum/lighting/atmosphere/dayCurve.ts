/**
 * DAY CURVE — everything the light of a moment depends on, from the sun's real position
 * (SPECTACLE F9). Pure functions, no three.js: unit-tested in tests/unit/clay-atmosphere.test.ts.
 *
 *   sunAt(day, hours)            the sun over Kharagpur at IST clock `hours` on `day`
 *   dayCurve(elevationDeg)       sun / moon intensity and colour, sky turbidity, exposure, ambience
 *   presetHours(day, preset)     the clock time that matches a named moment on that day
 *   bucketOf(day, hours)         the named moment a clock time belongs to (HUD label, soundscape)
 *
 * Keyframes are by elevation, so a winter noon is gentler than a summer one and the golden hour
 * comes when the sun is really low. Below the horizon the same directional light becomes a faint
 * cool moonlight from the south-east: its intensity passes through zero at the swap, so nothing
 * ever jumps.
 */
import { KHARAGPUR, kharagpurTime, sunPosition } from '../solar'

export type DayPreset = 'morning' | 'midday' | 'golden' | 'dusk' | 'night'

export interface SunNow {
  elevationDeg: number
  azimuthDeg: number
  /** Before solar noon. */
  rising: boolean
}

export interface DayCurveValues {
  /** Directional light: elevation / azimuth it shines from (sun by day, moon by night). */
  lightElevationDeg: number
  lightAzimuthDeg: number
  intensity: number
  colorK: number
  /** Sky shader. */
  turbidity: number
  rayleigh: number
  skyExposure: number
  /** lighting/timeOfDayState `ambience`. */
  night: number
  twilight: number
  exposure: number
  daylight: number
  /** 0 … 1: how much the oculus shaft is a sunbeam (0 below 4° of elevation). */
  shaft: number
  /** 0 … 1: moonlight shaft at night (0.25 of the day shaft at most). */
  moonShaft: number
  /** 0 … 1: the pastel sunset wash over the whole sky (peach horizon, lilac zenith) at a low sun. */
  sunset: number
}

/** The moon: fixed, south-east and high, so moonlight reaches the court floor. */
export const MOON = { elevationDeg: 46, azimuthDeg: 148 } as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Piecewise-linear interpolation over [x, y] keys sorted by x. */
function interp(keys: readonly (readonly [number, number])[], x: number): number {
  if (x <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i]
    if (x <= x1) {
      const [x0, y0] = keys[i - 1]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return keys[keys.length - 1][1]
}

/** Sun intensity (three.js units) by elevation: 0 at the horizon, the pavilion's midday 4.4 at 58°. */
const SUN_I = [[-1.5, 0], [0, 0.35], [4, 1.5], [11, 3.1], [22, 3.3], [58, 4.4], [90, 4.6]] as const
const SUN_K = [[0, 2000], [4, 2400], [11, 2950], [18, 3300], [26, 3800], [35, 4700], [45, 5400], [58, 5600], [90, 5800]] as const
// a clear gold low sky (a warm-gold gradient over blue), never a brown haze: turbidity stays modest
// golden hour: the warmth is in the sun's own colour, not in a haze over the whole sky — the
// zenith stays blue-violet, so turbidity is held low and rayleigh high while the sun is low
const TURB = [[-6, 3.0], [0, 3.6], [11, 3.2], [22, 3.2], [58, 3.2], [90, 3]] as const
const RAYL = [[-6, 2.2], [0, 2.8], [11, 2.4], [22, 1.5], [58, 1.05], [90, 1]] as const
const SKY_EXP = [[-26, 1], [-6, 1], [-3, 1], [0, 0.66], [11, 0.56], [22, 0.55], [58, 0.55], [90, 0.55]] as const
/** Moonlight by elevation of the (set) sun: rises from 0 just after sunset. */
const MOON_I = [[-12, 0.16], [-5, 0.3], [-2.5, 0.12], [-1.5, 0]] as const
const MOON_K = [[-12, 9000], [-3, 11000]] as const
const NIGHT = [[-18, 1], [-8, 0.85], [-3.2, 0.55], [0, 0.12], [3, 0]] as const
const TWILIGHT = [[-14, 0], [-8, 0.6], [-3.2, 1], [0, 0.7], [5, 0]] as const
/**
 * The eye's adaptation. Night is NOT lifted: a lifted exposure turned the lamp-lit interiors into a
 * flat clipped orange, brighter than by day. Dark rooms with pools of light are the point.
 */
const EXPOSURE = [[-18, 1.0], [-3.2, 1.06], [0, 1.06], [11, 1.02], [22, 1], [90, 1]] as const
const DAYLIGHT = [[-12, 0.04], [-3.2, 0.28], [0, 0.5], [11, 0.9], [22, 1], [90, 1]] as const
const SUNSET = [[-4, 0], [-1, 0.45], [2, 0.6], [9, 0.5], [17, 0.2], [26, 0]] as const
/**
 * Elevation the directional light (and so the oculus mask and the shadows) uses while the sun is
 * low. The opening is a 0.85 m deep well: below ~14° no real ray clears both its rims, so the
 * golden hour would leave the court without a sunbeam. The light is held a little steeper than the
 * sun (the sky keeps the real, low sun and its colours), so the crescent still rakes the ring wall
 * in amber. Identity from 26° up.
 */
const LIGHT_EL = [[-1.5, 15.4], [0, 16], [26, 26]] as const

export function dayCurve(elevationDeg: number, azimuthDeg: number): DayCurveValues {
  const el = elevationDeg
  const sunUp = el > -1.5
  const intensity = sunUp ? interp(SUN_I, el) : interp(MOON_I, el)
  return {
    lightElevationDeg: sunUp ? (el >= 26 ? el : interp(LIGHT_EL, el)) : MOON.elevationDeg,
    lightAzimuthDeg: sunUp ? azimuthDeg : MOON.azimuthDeg,
    intensity,
    colorK: sunUp ? interp(SUN_K, el) : interp(MOON_K, el),
    turbidity: interp(TURB, el),
    rayleigh: interp(RAYL, el),
    skyExposure: interp(SKY_EXP, el),
    night: interp(NIGHT, el),
    twilight: interp(TWILIGHT, el),
    exposure: interp(EXPOSURE, el),
    daylight: interp(DAYLIGHT, el),
    shaft: smooth(0, 4, el) * (0.55 + 0.45 * smooth(4, 30, el)),
    moonShaft: 0.25 * smooth(-4, -10, el),
    sunset: interp(SUNSET, el),
  }
}

/** The sun at Kharagpur at IST clock `hours` (may run past 24) on the date of `day`. */
export function sunAt(day: Date, hours: number): SunNow {
  const p = sunPosition(kharagpurTime(day, hours), KHARAGPUR.lat, KHARAGPUR.lon)
  return { elevationDeg: p.elevationDeg, azimuthDeg: p.azimuthDeg, rising: hours < solarNoonHours(day) }
}

/** IST clock hours of local solar noon on `day`. */
export function solarNoonHours(day: Date): number {
  const p = sunPosition(kharagpurTime(day, 12), KHARAGPUR.lat, KHARAGPUR.lon)
  return 12 + KHARAGPUR.tzHours - KHARAGPUR.lon / 15 - p.eqTimeMin / 60
}

/** Clock hours when the sun crosses `elevationDeg` on the way up (rising) or down, by bisection. */
export function hoursAtElevation(day: Date, elevationDeg: number, rising: boolean): number {
  const noon = solarNoonHours(day)
  let lo = rising ? noon - 12 : noon
  let hi = rising ? noon : noon + 12
  const el = (h: number) => sunPosition(kharagpurTime(day, h), KHARAGPUR.lat, KHARAGPUR.lon).elevationDeg
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const above = el(mid) > elevationDeg
    if (above === rising) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/**
 * Clock time of each named moment on `day`: morning 22° up, solar noon, golden hour at 7° (a
 * real low sun: amber light and a pastel sky; the light is held steeper, LIGHT_EL, so the oculus
 * still throws its crescent up the ring wall), dusk −3.5°, night.
 */
export function presetHours(day: Date, preset: DayPreset): number {
  switch (preset) {
    case 'morning':
      return hoursAtElevation(day, 22, true)
    case 'midday':
      return solarNoonHours(day)
    case 'golden':
      return hoursAtElevation(day, 7, false)
    case 'dusk':
      return hoursAtElevation(day, -3.5, false)
    case 'night':
      return solarNoonHours(day) + 9.5
  }
}

/** Sunrise and sunset (clock hours, upper limb at the horizon). */
export function sunriseSunset(day: Date): { rise: number; set: number } {
  return { rise: hoursAtElevation(day, -0.833, true), set: hoursAtElevation(day, -0.833, false) }
}

/** The named moment a clock time belongs to. */
export function bucketOf(day: Date, hours: number): DayPreset {
  const h = ((hours % 24) + 24) % 24
  const { elevationDeg: el, rising } = sunAt(day, h)
  if (el < -6) return 'night'
  if (el < 1.5) return rising ? 'morning' : 'dusk'
  if (el < 28) return rising ? 'morning' : 'golden'
  if (el < 30 && rising) return 'morning'
  return 'midday'
}

/** Live clock hours at Kharagpur now (IST, 0 … 24). */
export function istHoursNow(now: Date = new Date()): number {
  const ms = now.getTime() + KHARAGPUR.tzHours * 3600000
  return (((ms / 3600000) % 24) + 24) % 24
}

/** The IST calendar date now (a Date at UTC midnight of that date, as kharagpurTime expects). */
export function istDay(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + KHARAGPUR.tzHours * 3600000)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()))
}

/** "MM-DD" of the IST date (festival windows). */
export function istMonthDay(now: Date = new Date()): string {
  const d = istDay(now)
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Is "MM-DD" `md` inside [from, to] (inclusive; a window may wrap the new year)? */
export function inWindow(md: string, from: string, to: string): boolean {
  const ok = (s: string) => /^\d{2}-\d{2}$/.test(s)
  if (!ok(md) || !ok(from) || !ok(to)) return false
  return from <= to ? md >= from && md <= to : md >= from || md <= to
}

/** "6:45" style label for clock hours. */
export function clockLabel(hours: number): string {
  const h = ((hours % 24) + 24) % 24
  let hh = Math.floor(h)
  let mm = Math.round((h - hh) * 60)
  if (mm === 60) {
    mm = 0
    hh = (hh + 1) % 24
  }
  return `${hh}:${String(mm).padStart(2, '0')}`
}
