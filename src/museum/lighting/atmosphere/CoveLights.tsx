/**
 * COVE LIGHTS (SPECTACLE §3 term 4, F5, F27; GRAND §6.2 #6) — concealed LED lines, as the
 * grazing wash they throw up or down a wall. No RectAreaLight: each line is an analytic term in
 * the shared injection (inject.ts `uAtmosCove*`), so the coves cost the same on every tier and
 * the light count never changes.
 *
 * Eight lines, each with the colour of its room:
 *   upper-register  warm uplights behind the balcony's balustrade, washing the niches and relief
 *                   panels over A, B and C (y 5.2 → 8.6)
 *   f-foot, f-head  the red coves at the foot and the head of F's piers (p07l "red cove-lit wall
 *                   ring with tall piers"): one washes up, the other down, so the oxblood glows
 *   entry           the ambulatory's lobe wall, from the balcony line up to the slab
 *   annex-east/west the Earth Room's walls above the door head, low amber (2700 K)
 *   rooms           the library wings and the Haat, washing down their outer walls (the atlas
 *                   stays neutral for the map and the partners; the theatre stays dark)
 *   red-room        a ring of light under the Red Room's ceiling, down its shelves (p09r)
 * A curator's `cove-light {walls, colorK, intensity}` object overrides the lines it names.
 * They hold their level after dusk (the walls they wash must stay dark, value ≤ 0.35, so the
 * night is pools of light rather than a lit box); a festival night halves them.
 */
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { kelvinToHex, type CoveDef } from '../../config/lighting'
import { DEG, KEY, MUSEUM } from '../../config/museum'
import { RED_ROOM, SAT_WALL, SATELLITES } from '../../config/satellites'
import { ambience } from '../timeOfDayState'
import { ATMOS, COVE_SLOTS } from './inject'

/** How far in front of the wall a line sits (m). */
const SET_IN = 0.45
/** A straight run is an arc of this radius about a far centre. */
const FAR = 400

const D = MUSEUM.drum
const F = MUSEUM.innerMainWall
const BAL = MUSEUM.balcony
const REG = MUSEUM.upperRegister

/** A straight cove along an annex wall: x = const, z from the mouth to the door wall. */
const annexRun = (id: string, side: 1 | -1, y: number, colorK: number, intensity: number): CoveDef => {
  const x = side * (KEY.annexHalf - SET_IN)
  const z0 = KEY.annexMouthZ
  const z1 = MUSEUM.annex.endZ
  const half = (z1 - z0) / 2 / FAR / DEG
  // centre far out on the other side, so the arc runs along +z near x
  return { id, cx: x - side * FAR, cz: (z0 + z1) / 2, r: FAR, y, a0: side > 0 ? -half : 180 - half, a1: side > 0 ? half : 180 + half, colorK, intensity, reach: 3.2 }
}

/** F's court face, just in front of its piers' faces (the piers stand 0.6 proud). */
const F_COVE_R = F.r - F.thickness / 2 - 0.6 - 0.25
const lit = SATELLITES.filter((s) => s.id === 'library' || s.id === 'shop')
const roomsFrom = Math.min(...lit.map((s) => s.fromDeg))
const roomsTo = Math.max(...lit.map((s) => s.toDeg))
const roomsH = Math.min(...lit.map((s) => s.height))

export const COVES: CoveDef[] = [
  { id: 'upper-register', cx: 0, cz: 0, r: KEY.ringR - 0.3, y: REG.y0, a0: BAL.fromDeg - 360, a1: BAL.toDeg - 360, colorK: 3000, intensity: 1.5, reach: REG.y1 - REG.y0 + 0.4 },
  { id: 'f-foot', cx: 0, cz: 0, r: F_COVE_R, y: 0.12, a0: F.fromDeg + 1, a1: F.toDeg - 1, colorK: 2400, intensity: 4.2, reach: 3.0, color: '#ff4a30' },
  { id: 'f-head', cx: 0, cz: 0, r: F_COVE_R, y: F.height - 0.15, a0: F.fromDeg + 1, a1: F.toDeg - 1, colorK: 2400, intensity: 3.6, reach: 2.8, dir: -1, color: '#ff5a38' },
  { id: 'entry', cx: 0, cz: 0, r: KEY.lobeR - SET_IN, y: MUSEUM.pavilion.mezzanineBand, a0: D.neNotchDeg, a1: D.dNotchDeg, colorK: 2700, intensity: 1.4, reach: MUSEUM.pavilion.ceilingHeight - MUSEUM.pavilion.mezzanineBand },
  annexRun('annex-east', 1, MUSEUM.annex.door.height, 2700, 1.0),
  annexRun('annex-west', -1, MUSEUM.annex.door.height, 2700, 1.0),
  { id: 'rooms', cx: 0, cz: 0, r: SAT_WALL.outerFace - SET_IN, y: roomsH - 0.45, a0: roomsFrom + 1, a1: roomsTo - 1, colorK: 3000, intensity: 1.2, reach: 3.2, dir: -1 },
  { id: 'red-room', cx: RED_ROOM.cx, cz: RED_ROOM.cz, r: RED_ROOM.r - 0.3, y: RED_ROOM.height - 0.4, a0: -180, a1: 180, colorK: 2700, intensity: 0.7, reach: 3.0, dir: -1 },
]

/** Curator overrides by cove id: colour temperature and intensity multiplier. */
const overrides = new Map<string, Map<string, { colorK?: number; intensity?: number }>>()

/** Register a `cove-light` object's settings (returns the unregister function). */
export function registerCoveOverride(objectId: string, walls: string[], colorK: number | undefined, intensity: number | undefined) {
  const m = new Map(walls.map((w) => [w.trim(), { colorK, intensity }] as const).filter(([w]) => w))
  overrides.set(objectId, m)
  return () => {
    overrides.delete(objectId)
  }
}

/** Extra multiplier the moments may apply (e.g. a dimmed house, a festival night); 1 = as designed. */
export const coveMaster = { gain: 1 }

const col = new THREE.Color()
/** Brightest a line may be at full night. */
const NIGHT_CAP = 1.2

function apply() {
  // the coves are the evening's architecture, but never a floodlight: at night they fall back a
  // little and each line is capped, so the walls they graze stay dark (value ≤ 0.35)
  const tod = 0.55 - 0.1 * ambience.night
  const cap = ambience.night > 1e-3 ? NIGHT_CAP / ambience.night : Infinity
  COVES.slice(0, COVE_SLOTS).forEach((c, i) => {
    let k = c.colorK
    let gain = 1
    for (const m of overrides.values()) {
      const o = m.get(c.id)
      if (!o) continue
      if (o.colorK !== undefined && o.colorK > 0) k = o.colorK
      if (o.intensity !== undefined && o.intensity >= 0) gain = o.intensity
    }
    const I = Math.min(c.intensity * gain * coveMaster.gain * tod, cap)
    // a curator's colour temperature replaces a coloured line's hue too
    col.set(c.color && k === c.colorK ? c.color : kelvinToHex(k))
    ATMOS.uAtmosCoveGeo.value[i].set(c.cx, c.cz, c.r, c.y)
    ATMOS.uAtmosCoveSpan.value[i].set(c.a0 * DEG, c.a1 * DEG, c.reach, c.dir ?? 1)
    ATMOS.uAtmosCoveCol.value[i].set(col.r * I, col.g * I, col.b * I, 0)
  })
}

/** Writes the cove uniforms (cheap: eight vectors a frame). */
export function CoveLights() {
  useFrame(apply)
  return null
}
