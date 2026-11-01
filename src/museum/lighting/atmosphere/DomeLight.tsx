/**
 * DOME LIGHT (GRAND §6.2 #5) — the light of the coffered dome, as ring washes of the shared
 * injection (inject.ts `uAtmosRing*`), on every tier, with no light added:
 *
 *   dome wash      a concealed uplight ring at the springing (y 9.0) washing the coffers; quiet by
 *                  day (the oculus does the work); after dusk its reach shortens, so the wash is a
 *                  gradient from the springing that fades to dark well before the crown, and the
 *                  night sky reads through the oculus
 *   terrace coves  warm LED rings on the two outer steps of the stepped oculus (p07r), lit at dusk;
 *                  by day the sky's bounce off the blush plaster lifts the steps to near white
 *   light-well     the 1.4 m reveal over the opening (p07l "thick glowing reveal"): blush-white by
 *                  day (the bounce of the sky off blush plaster), a warm ring at night
 *
 * The festival dims the springing wash so the lamps and the Akash Deep carry the night. At the
 * golden hour every ring turns amber and brightens (the light-well glows off the low sun).
 */
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kelvinToHex } from '../../config/lighting'
import { KEY, MUSEUM } from '../../config/museum'
import { diyaNow } from '../diyas/diyaState'
import { ambience, sunState } from '../timeOfDayState'
import { weatherNow } from '../weather/weatherState'
import { goldenNow } from './AccentField'
import { ATMOS, RING_SLOTS } from './inject'

const DOME = MUSEUM.dome
const OC = MUSEUM.oculus
const T = DOME.terraces

interface RingDef {
  r: number
  y: number
  reach: number
  dir: 1 | -1
  /** Irradiance by day and at full night; colour temperature by day and night. */
  day: number
  /** Reach at full night (m), when it differs from `reach`. */
  nightReach?: number
  night: number
  dayK: number
  nightK: number
}

export const DOME_RINGS: RingDef[] = [
  // the springing uplight: just inside the ring wall, reaching the crown's lower coffers
  { r: KEY.ringR - 0.5, y: DOME.springY + 0.05, reach: DOME.rise + 1, nightReach: DOME.rise * 0.4, dir: 1, day: 0.6, night: 0.5, dayK: 3000, nightK: 2700 },
  // the stepped oculus: an LED line on each outer terrace's lip, washing the riser above
  { r: T[0].r1 - 0.3, y: T[0].y, reach: 1.7, dir: 1, day: 1.5, night: 1.4, dayK: 4300, nightK: 2600 },
  { r: T[1].r1 - 0.3, y: T[1].y, reach: 1.5, dir: 1, day: 1.8, night: 1.4, dayK: 4600, nightK: 2600 },
  // the light-well's reveal
  { r: OC.r - 0.35, y: DOME.lightWell.y0 + 0.05, reach: DOME.lightWell.y1 - DOME.lightWell.y0 + 0.6, dir: 1, day: 3.4, night: 1.1, dayK: 5000, nightK: 2700 },
]

const cDay = new THREE.Color()
const cGold = new THREE.Color(kelvinToHex(2200))
const cNight = new THREE.Color()

function apply() {
  const n = ambience.night
  // the sky's own brightness reaches the reveal: less under monsoon cloud and at a low sun
  const sky = (1 - 0.6 * weatherNow.overcast) * Math.min(1, 0.35 + sunState.curve.daylight)
  // the golden hour warms the light-well and the terraces (amber off the low sun), and lifts them
  const g = goldenNow()
  DOME_RINGS.slice(0, RING_SLOTS).forEach((d, i) => {
    cDay.set(kelvinToHex(d.dayK)).lerp(cGold, i === 0 ? 0.5 * g : 0.85 * g)
    cNight.set(kelvinToHex(d.nightK))
    const day = d.day * (i === DOME_RINGS.length - 1 ? sky : 1) * (1 + (i === 0 ? 0.6 : 0.9) * g)
    let I = day + (d.night - day) * n
    if (i === 0) I *= 1 - 0.45 * diyaNow.festival
    cDay.lerp(cNight, n).multiplyScalar(I)
    const reach = d.nightReach === undefined ? d.reach : d.reach + (d.nightReach - d.reach) * n
    ATMOS.uAtmosRingGeo.value[i].set(d.r, d.y, reach, d.dir)
    ATMOS.uAtmosRingCol.value[i].set(cDay.r, cDay.g, cDay.b, 0)
  })
}

/** Writes the ring-wash uniforms (four vectors a frame). */
export function DomeLight() {
  useFrame(apply)
  return null
}
