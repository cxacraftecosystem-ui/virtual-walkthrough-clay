/**
 * COLOUR CHOREOGRAPHY (SPECTACLE F27) — every room has its own light (config/lighting.ts
 * `ZONE_LIGHT`), blended by the visitor's distance to the zones (2 m smoothstep) and eased at
 * 1.5/s, so no single change is ever noticed.
 *
 * The blend lands in `grade`, read each frame by:
 *   - the hemisphere / environment fill (Lighting.tsx ZoneAmbience): `fill`, `tint`
 *   - the accent lights (SpotPool): tinted toward `tint` unless a request is `neutral`
 *   - the renderer exposure (TimeOfDayController): `exposure` (× the Turn's overshoot, the
 *     monsoon's dimming, the festival's dark before the lamps)
 *   - the H+ grade pass (effects/ClayGrade.ts): white balance, split-tone, contrast, vignette
 * On L/M there is no grade pass: the tint of the fill and the spots carries the room's colour.
 */
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kelvinToRGB, ZONE_LIGHT, type ZoneLight } from '../../config/lighting'
import { ZONES, zoneDistance } from '../../config/layout'
import { perchZone } from '../../navigation/perch'
import { visitor } from '../../state/visitor'
import { weatherNow } from '../weather/weatherState'

const NEUTRAL_K = 4500

/** Blended, eased light of where the visitor stands (plus the moments layered on top). */
export const grade = {
  /** Renderer exposure multiplier (room × moments). */
  exposure: 1,
  /** Room part of it, before the moments. */
  roomExposure: 1,
  fill: 1,
  /** Fraction of the fill kept at night. */
  nightFloor: 0.3,
  colorK: 5000,
  /** Linear RGB tint of the colorK, normalised to the neutral (≈1 for 4500 K). */
  tint: new THREE.Color(1, 1, 1),
  shadow: new THREE.Color('#463c38'),
  high: new THREE.Color('#fff4e8'),
  contrast: 1,
  /** Multipliers set by the moments (the Turn, the monsoon, the festival), 1 = none. */
  turn: 1,
  weather: 1,
  festival: 1,
}

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

/** Neutral-normalised linear tint of a colour temperature. */
export function kelvinTint(k: number, out = new THREE.Color()) {
  const [r, g, b] = kelvinToRGB(k)
  const [nr, ng, nb] = kelvinToRGB(NEUTRAL_K)
  out.setRGB(r, g, b, THREE.SRGBColorSpace)
  tmpA.setRGB(nr, ng, nb, THREE.SRGBColorSpace)
  out.setRGB(out.r / tmpA.r, out.g / tmpA.g, out.b / tmpA.b)
  // keep the luminance: only the hue moves
  const l = out.r * 0.2126 + out.g * 0.7152 + out.b * 0.0722
  return out.multiplyScalar(1 / Math.max(l, 1e-3))
}

interface Blend {
  colorK: number
  fill: number
  exposure: number
  contrast: number
  nightFloor: number
  shadow: THREE.Color
  high: THREE.Color
}

const target: Blend = { colorK: 5000, fill: 1, exposure: 1, contrast: 1, nightFloor: 0.3, shadow: new THREE.Color(), high: new THREE.Color() }
const GROUND = ZONES.filter((z) => z.level !== 2)
const FALLBACK = ZONE_LIGHT.inner

/** Weighted light of the zones round (x, z): weight 1 inside, fading to 0 at 2 m. */
export function blendAt(x: number, z: number, out: Blend = target): Blend {
  const perched = perchZone()
  let wsum = 0
  let k = 0
  let fill = 0
  let exp = 0
  let con = 0
  let nf = 0
  out.shadow.setRGB(0, 0, 0)
  out.high.setRGB(0, 0, 0)
  const add = (zl: ZoneLight, w: number) => {
    wsum += w
    k += zl.colorK * w
    fill += zl.fill * w
    exp += zl.exposure * w
    con += zl.contrast * w
    nf += (zl.nightFloor ?? 0.3) * w
    out.shadow.add(tmpA.set(zl.shadow).multiplyScalar(w))
    out.high.add(tmpB.set(zl.high).multiplyScalar(w))
  }
  if (perched) add(ZONE_LIGHT[perched] ?? FALLBACK, 1)
  else
    for (const zn of GROUND) {
      const d = zoneDistance(zn, x, z)
      if (d >= 2) continue
      const t = 1 - d / 2
      add(ZONE_LIGHT[zn.id] ?? FALLBACK, t * t * (3 - 2 * t))
    }
  if (wsum <= 0) add(FALLBACK, 1)
  out.colorK = k / wsum
  out.fill = fill / wsum
  out.exposure = exp / wsum
  out.contrast = con / wsum
  out.nightFloor = nf / wsum
  out.shadow.multiplyScalar(1 / wsum)
  out.high.multiplyScalar(1 / wsum)
  return out
}

const EASE_PER_S = 1.5
let first = true

/** Advance the choreography (call once per frame). */
export function stepChoreography(dt: number) {
  const b = blendAt(visitor.x, visitor.z)
  const k = first ? 1 : 1 - Math.exp(-EASE_PER_S * dt)
  first = false
  grade.colorK += (b.colorK - grade.colorK) * k
  grade.fill += (b.fill - grade.fill) * k
  grade.roomExposure += (b.exposure - grade.roomExposure) * k
  grade.contrast += (b.contrast - grade.contrast) * k
  grade.nightFloor += (b.nightFloor - grade.nightFloor) * k
  grade.shadow.lerp(b.shadow, k)
  grade.high.lerp(b.high, k)
  kelvinTint(grade.colorK, grade.tint)
  // the monsoon dims the day a little (the eye adapts only part way); its brightening lifts it
  grade.weather = (1 - 0.12 * weatherNow.overcast) * (1 + 0.35 * weatherNow.flash)
  grade.exposure = grade.roomExposure * grade.turn * grade.weather * grade.festival
}

/** In-scene driver (mounted once by Lighting). */
export function Choreography() {
  useFrame((_, dt) => stepChoreography(Math.min(dt, 0.1)))
  return null
}
