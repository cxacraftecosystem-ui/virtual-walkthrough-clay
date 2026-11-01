/**
 * ACCENT FIELD (GRAND §6.2 #3) — many tight spots at a constant cost.
 *
 * The accents of the plan and of every staged piece (config/accents.ts) are analytic cones in the
 * shared injection (inject.ts `uAtmosAccent*`): no light is added, no program changes. A few
 * times a second the field picks the accents that matter to the visitor — in the rooms they can
 * see (ZONE_VISIBILITY, or the perch's view), the nearest and the most important first — up to
 * the tier's cap (8 / 12 / 16 / 24), and eases each slot in and out like the SpotPool does, so
 * nothing pops as one walks. Where a real SpotPool light already lights the same target, the
 * accent stands down (the nearest pieces keep their real, shadowed light; nothing is lit twice).
 *
 * The moments reach it too: the Turn's podium rise (`spotModifiers`) raises the podium cones in
 * sequence with the podium lights, and `accentMaster.gain` lets a moment dim the field.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ACCENT_CAPS, buildAccents, type Accent } from '../../config/accents'
import { kelvinToHex } from '../../config/lighting'
import { ZONE_VISIBILITY, zoneAt, type ZoneId } from '../../config/layout'
import { DEG, KEY, MUSEUM } from '../../config/museum'
import { SCENE_OBJECTS } from '../../config/objects'
import { perchZone } from '../../navigation/perch'
import { useMuseum } from '../../state/store'
import { visitor } from '../../state/visitor'
import { sunState } from '../timeOfDayState'
import { weatherNow } from '../weather/weatherState'
import { poolLit, spotModifiers, type SpotRequest } from '../SpotPool'
import { accentProgramSlots, ATMOS } from './inject'

/** Master gain the moments may set (1 = as designed). */
export const accentMaster = { gain: 1 }

const FADE_PER_S = 2.6
const PICK_S = 0.25
/** A SpotPool slot "covers" an accent when their targets are this close (m). */
const SAME_TARGET = 0.45
/** Pieces outside ±80° of the heading, beyond 2.5 m, rank as if this much farther (m). */
const BEHIND_COS = Math.cos(80 * DEG)
const BEHIND_NEAR = 2.5
const BEHIND_M = 5
/** An accent that lights all the way to the floor. */
const NO_CUT = -1e4

interface Prepared {
  a: Accent
  dir: THREE.Vector3
  cosOuter: number
  color: THREE.Color
  range: number
  /** Stand-in request so the SpotPool's moment modifiers (the Turn) apply to the cone too. */
  req: SpotRequest
  /** Illuminance on the target (intensity / throw²). */
  e: number
}

interface Slot {
  p: Prepared | null
  weight: number
}

function prepare(a: Accent): Prepared {
  const dir = new THREE.Vector3(a.target[0] - a.pos[0], a.target[1] - a.pos[1], a.target[2] - a.pos[2])
  const throwM = dir.length()
  dir.normalize()
  const color = new THREE.Color(kelvinToHex(a.colorK))
  return {
    a,
    dir,
    cosOuter: Math.cos(a.beamDeg * DEG),
    color,
    range: throwM * 2.4 + 2.5,
    e: a.intensity / Math.max(0.05, throwM * throwM),
    req: { position: a.pos, target: a.target, intensity: a.intensity, angle: a.beamDeg * DEG, penumbra: 1, color: '#ffffff', tag: `accent-${a.id}` },
  }
}

/**
 * Fraction of an accent already lit by a real SpotPool light (0 … 1): the real light's weight, as
 * far as it gives the piece the accent's own light (a dim fill under it does not stand the cone down).
 */
function pooled(p: Prepared): number {
  let w = 0
  const [tx, ty, tz] = p.a.target
  for (const l of poolLit) {
    if (l.w <= 0) continue
    if (Math.abs(l.x - tx) < SAME_TARGET && Math.abs(l.z - tz) < SAME_TARGET && Math.abs(l.y - ty) < 1.2) w = Math.max(w, l.w * Math.min(1, l.e / p.e))
  }
  return w
}

export function AccentField() {
  const tier = useMuseum((s) => s.tier)
  const cap = Math.min(ACCENT_CAPS[tier], accentProgramSlots())
  const all = useMemo(() => buildAccents(SCENE_OBJECTS).map(prepare), [])
  const slots = useMemo<Slot[]>(() => Array.from({ length: cap }, () => ({ p: null, weight: 0 })), [cap])
  const run = useRef({ t: 0, zone: 'entrance-court' as ZoneId, want: new Set<Prepared>() })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const r = run.current
    r.t -= dt
    if (r.t <= 0) {
      r.t = PICK_S
      const perched = perchZone()
      const here = perched ?? zoneAt(visitor.x, visitor.z)?.id ?? r.zone
      r.zone = here
      const seen = new Set<string>(ZONE_VISIBILITY[here] ?? [here])
      // the visitor's heading (yaw 0 faces −z, positive turns west)
      const fx = -Math.sin(visitor.yaw)
      const fz = -Math.cos(visitor.yaw)
      const ranked = all
        .filter((p) => seen.has(p.a.zone))
        .map((p) => {
          const dx = p.a.target[0] - visitor.x
          const dz = p.a.target[2] - visitor.z
          const d = Math.hypot(dx, dz)
          // the room one stands in comes first, then what is in front of the visitor (on the low
          // tiers' few slots, the pieces behind would otherwise take the cones from the view);
          // the most visible pieces win at equal distance
          const behind = d > BEHIND_NEAR && (dx * fx + dz * fz) / d < BEHIND_COS ? BEHIND_M : 0
          return [p, (d + (p.a.zone === here ? 0 : 6) + behind) / Math.sqrt(p.a.weight)] as const
        })
        .sort((a, b) => a[1] - b[1])
      r.want = new Set(ranked.slice(0, slots.length).map(([p]) => p))
    }
    const want = r.want
    const held = new Set(slots.map((s) => s.p).filter((p): p is Prepared => !!p && want.has(p)))
    const pending = [...want].filter((p) => !held.has(p))
    const U = ATMOS
    let n = 0
    for (const s of slots) {
      const keep = !!s.p && want.has(s.p)
      s.weight = keep ? Math.min(1, s.weight + dt * FADE_PER_S) : Math.max(0, s.weight - dt * FADE_PER_S)
      if (s.weight === 0 && !keep) s.p = pending.shift() ?? null
      if (!s.p) continue
      const p = s.p
      let gain = s.weight * accentMaster.gain * (1 - pooled(p))
      for (const m of spotModifiers) gain *= m(p.req)
      if (gain <= 0.001) continue
      const I = p.a.intensity * gain
      U.uAtmosAccentPos.value[n].set(p.a.pos[0], p.a.pos[1], p.a.pos[2], p.a.cutY ?? NO_CUT)
      U.uAtmosAccentDir.value[n].set(p.dir.x, p.dir.y, p.dir.z, p.cosOuter)
      U.uAtmosAccentCol.value[n].set(p.color.r * I, p.color.g * I, p.color.b * I, p.range)
      n++
    }
    // the golden hour's crescent (GRAND §6.2 #5): while the sun is low, a broad warm cone from the
    // light-well's sun side throws a crescent of amber across F, its piers and the upper register
    // on the far side of the court (it takes the last slot when the field is full)
    const g = goldenNow()
    if (g > 0.01 && ROTUNDA_ZONES.has(r.zone) && accentProgramSlots() > 0) {
      const k = Math.min(n, accentProgramSlots() - 1)
      const c = golden(g)
      U.uAtmosAccentPos.value[k].set(c.pos[0], c.pos[1], c.pos[2], NO_CUT)
      U.uAtmosAccentDir.value[k].set(c.dir.x, c.dir.y, c.dir.z, c.cosOuter)
      U.uAtmosAccentCol.value[k].set(GOLD.r * c.I, GOLD.g * c.I, GOLD.b * c.I, c.range)
      n = Math.max(n, k + 1)
    }
    U.uAtmosAccentN.value = n
  })
  return null
}

/** The spaces under the dome, where the golden crescent is seen. */
const ROTUNDA_ZONES = new Set<string>(['inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'duplex', 'sky-rim', 'annex'])
const GOLD = new THREE.Color(kelvinToHex(2300))
const _gd = new THREE.Vector3()

/** 0 … 1: how golden the hour is (a low, clear sun; nothing at night or under monsoon cloud). */
export function goldenNow(): number {
  const c = sunState.curve
  return Math.min(1, Math.max(0, c.sunset / 0.42)) * (1 - c.night) * (1 - 0.85 * weatherNow.overcast)
}

/** The crescent's cone for golden-hour strength `g`: from the light-well, opposite the sun's azimuth. */
function golden(g: number) {
  const az = sunState.azimuthDeg * DEG
  // the plan direction the low sun's light travels (compass azimuth: 0 = −z, 90 = +x)
  const tx = -Math.sin(az)
  const tz = Math.cos(az)
  const a = Math.atan2(tz, tx) / DEG
  const F = MUSEUM.innerMainWall
  const onF = a > F.fromDeg && a < F.toDeg
  // F's court face at its piers' height, else the ring's upper register
  const r = onF ? F.r - F.thickness / 2 - 0.2 : KEY.ringR - 0.2
  const y = onF ? F.height * 0.62 : (MUSEUM.upperRegister.y0 + MUSEUM.upperRegister.y1) / 2
  const target = [Math.cos(a * DEG) * r, y, Math.sin(a * DEG) * r]
  const so = MUSEUM.oculus.r * 0.85
  const pos: [number, number, number] = [-tx * so, MUSEUM.dome.lightWell.y0, -tz * so]
  _gd.set(target[0] - pos[0], target[1] - pos[1], target[2] - pos[2])
  const d = _gd.length()
  _gd.normalize()
  // (a crescent, never a flood: a tighter, softer cone, so the galleries below keep their own light)
  return { pos, dir: _gd, cosOuter: Math.cos(15 * DEG), range: d * 1.4 + 2, I: 3.2 * d * d * g * accentMaster.gain }
}
