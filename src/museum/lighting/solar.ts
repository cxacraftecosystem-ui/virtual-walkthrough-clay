/**
 * SOLAR POSITION — where the real sun stands over the pavilion (NOAA solar calculator
 * equations, after Meeus; good to ~0.01° for 1950–2050, refraction included).
 *
 *   sunPosition(new Date(), KHARAGPUR.lat, KHARAGPUR.lon) → { elevationDeg, azimuthDeg }
 *
 * Azimuth is a compass bearing like every yaw in the app: 0 = north (−z), 90 = east (+x),
 * clockwise. The model's −z is true north. `sunDirection` turns a position into the world unit
 * vector pointing towards the sun.
 */

export const KHARAGPUR = { lat: 22.32, lon: 87.31, tzHours: 5.5 } as const

const RAD = Math.PI / 180

export interface SunPosition {
  /** Apparent elevation above the horizon, with atmospheric refraction (deg). */
  elevationDeg: number
  /** Compass bearing: 0 = north, 90 = east (deg, 0 … 360). */
  azimuthDeg: number
  /** Solar declination (deg). */
  declinationDeg: number
  /** Equation of time (minutes). */
  eqTimeMin: number
}

/** Julian day of a JavaScript date (UTC). */
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

export function sunPosition(date: Date, latDeg: number, lonDeg: number): SunPosition {
  const jc = (julianDay(date) - 2451545) / 36525
  // geometric mean longitude / anomaly of the sun, eccentricity of the earth's orbit
  const l0 = (((280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360) + 360) % 360
  const m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
  const c = Math.sin(m * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * jc) + Math.sin(3 * m * RAD) * 0.000289
  const trueLong = l0 + c
  const omega = 125.04 - 1934.136 * jc
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)
  const meanObliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
  const obliq = meanObliq + 0.00256 * Math.cos(omega * RAD)
  const decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD)) / RAD
  const y = Math.tan((obliq / 2) * RAD) ** 2
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(m * RAD) + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) - 0.5 * y * y * Math.sin(4 * l0 * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD))

  // true solar time (minutes past UTC midnight, shifted by longitude and the equation of time)
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000
  const tst = (((utcMin + eqTime + 4 * lonDeg) % 1440) + 1440) % 1440
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180

  const lat = latDeg * RAD
  const cosZen = Math.min(1, Math.max(-1, Math.sin(lat) * Math.sin(decl * RAD) + Math.cos(lat) * Math.cos(decl * RAD) * Math.cos(ha * RAD)))
  const zen = Math.acos(cosZen) / RAD
  const elev = 90 - zen

  // atmospheric refraction (NOAA approximation), degrees
  let refr = 0
  if (elev <= 85) {
    const te = Math.tan(elev * RAD)
    if (elev > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5
    else if (elev > -0.575) refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)))
    else refr = -20.772 / te
    refr /= 3600
  }

  const sinZen = Math.sin(zen * RAD)
  let az: number
  if (sinZen < 1e-9) az = 180
  else {
    const cosAz = Math.min(1, Math.max(-1, (Math.sin(lat) * cosZen - Math.sin(decl * RAD)) / (Math.cos(lat) * sinZen)))
    const a = Math.acos(cosAz) / RAD
    az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360
  }
  return { elevationDeg: elev + refr, azimuthDeg: az, declinationDeg: decl, eqTimeMin: eqTime }
}

/** World unit vector [x, y, z] towards the sun (north = −z, east = +x, up = +y). */
export function sunDirection(p: Pick<SunPosition, 'elevationDeg' | 'azimuthDeg'>): [number, number, number] {
  const el = p.elevationDeg * RAD
  const az = p.azimuthDeg * RAD
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
}

/** Clock time at Kharagpur (IST) on the date of `day` → a Date (for the day dial and hour lines). */
export function kharagpurTime(day: Date, hours: number): Date {
  const utc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) + (hours - KHARAGPUR.tzHours) * 3600000
  return new Date(utc)
}
