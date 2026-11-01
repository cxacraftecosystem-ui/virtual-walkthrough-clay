/**
 * Eased, per-frame time-of-day state shared by the lighting components.
 *
 * The store holds the clock (`timeMode`, `dayHours`); <TimeOfDayController> (NightLights.tsx)
 * glides the RENDERED clock `sunState.hours` toward it (the sun patch sweeps across the floor
 * instead of jumping), asks dayCurve.ts for the light of that moment and writes it here.
 * Changing the time only changes light INTENSITIES, directions and a few uniforms — never the
 * number of lights, so no shader recompiles.
 */
import { LIGHTING } from '../config/lighting'
import type { TimeOfDay } from '../state/store'
import { dayCurve, istDay, presetHours, sunAt, type DayCurveValues } from './atmosphere/dayCurve'

export const ambience = {
  night: 0,
  twilight: 0,
  exposure: 1,
  daylight: 1,
}

export type AmbienceKey = keyof typeof ambience

/** The rendered sun: clock, position and the day curve's values (updated every frame). */
export const sunState: {
  hours: number
  day: Date
  elevationDeg: number
  azimuthDeg: number
  curve: DayCurveValues
  /** True while the rendered clock is still gliding toward the store's. */
  moving: boolean
} = {
  hours: 12,
  day: istDay(),
  elevationDeg: 58,
  azimuthDeg: 180,
  curve: dayCurve(58, 180),
  moving: false,
}

/** Recompute the sun and its curve for the rendered clock. */
export function setSunHours(hours: number, day: Date = sunState.day) {
  sunState.hours = hours
  sunState.day = day
  const s = sunAt(day, hours)
  sunState.elevationDeg = s.elevationDeg
  sunState.azimuthDeg = s.azimuthDeg
  sunState.curve = dayCurve(s.elevationDeg, s.azimuthDeg)
}

export function ambienceTarget(t: TimeOfDay) {
  return LIGHTING.ambience[t] ?? LIGHTING.ambience.midday
}

/** Snap (no easing) — used at mount so the first frame is already right. */
export function snapAmbience(hours: number) {
  setSunHours(hours, istDay())
  const c = sunState.curve
  Object.assign(ambience, { night: c.night, twilight: c.twilight, exposure: c.exposure, daylight: c.daylight })
}

/** Sun (sky) and directional-light (sun or moon) directions for a named moment today. */
export function lightAngles(t: TimeOfDay) {
  const s = sunAt(istDay(), presetHours(istDay(), t))
  const c = dayCurve(s.elevationDeg, s.azimuthDeg)
  return { skyEl: s.elevationDeg, skyAz: s.azimuthDeg, lightEl: c.lightElevationDeg, lightAz: c.lightAzimuthDeg }
}
