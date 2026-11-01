/**
 * THE EAST STAIR (GRAND §1.2, §6.5 "the cantilevered east stair climbing the lobe wall"): a
 * switchback in the east ambulatory, reached by the perch only (its door is P5's perch door at
 * the foot; WALLS 'stair-e' closes the footprint where the flight is below head height).
 *
 *   lower flight ... open glazed-terracotta treads cantilevered from the lobe wall off a lacquered
 *                    wall stringer, climbing from the foot (by the annex) to the landing at the balcony's
 *                    level; a glass balustrade with a brass rail on the open side
 *   landing ........ against the NE notch wall, spanning both flights; the bridge (Balcony.tsx)
 *                    leaves it through the E-east arch onto the balcony
 *   upper flight ... inboard of the lower one, its treads on a lacquered spine beam, climbing back
 *                    to the roof; glass both sides
 *   hatch .......... the slab is open over the flight where it would cut the headroom
 *                    (CeilingAndSkylight.tsx cuts it); a terracotta stair-house with a glazed
 *                    sloping lid closes it on the roof, its door opening towards the dome's rib
 *                    stair (domeGeometry.ts). Under the glass a frosted diffuser: seen from the
 *                    Earth Room and the ambulatory the hatch is a soft slot of daylight over the
 *                    climbing flight (dim and cool at night), never a raw sliver of blue sky
 *
 * The two flights stand side by side (the spec's single centreline would stack them a metre
 * apart at the landing): the lower on EAST_STAIR.r, the upper one flight-width further in.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, MUSEUM } from '../config/museum'
import { EAST_STAIR, EAST_STAIR_FOOT_DEG } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { Mesh, revolve, type V2, type V3 } from './sweep'

const E = EAST_STAIR
const SLAB_SOFFIT = MUSEUM.pavilion.ceilingHeight
const ROOF_TOP = SLAB_SOFFIT + MUSEUM.pavilion.roofThickness
/** Clear headroom kept over every tread (m). */
const HEADROOM = 2.25

/** Where each flight runs (plan radii, degrees, heights). */
export const EAST_STAIR_RENDER = {
  lower: { r: E.r, r0: E.r - E.width / 2, r1: E.r + E.width / 2, fromDeg: EAST_STAIR_FOOT_DEG, toDeg: E.bridge.toDeg, y0: E.lower.y0, y1: E.lower.y1 },
  upper: { r: E.r - E.width, r0: E.r - E.width * 1.5, r1: E.r - E.width / 2, fromDeg: E.bridge.toDeg, toDeg: E.upper.toDeg, y0: E.upper.y0, y1: ROOF_TOP },
  /** The landing: both flights wide, from the notch wall's face to the flights' turn. */
  landing: { fromDeg: E.bridge.fromDeg, toDeg: E.bridge.toDeg, y: E.lower.y1 },
  /** Inner edge of the landing (where the bridge from the balcony meets it). */
  landingR0: E.r - E.width * 1.5,
} as const

const U = EAST_STAIR_RENDER.upper
/** Height of the upper flight's treads at plan angle aDeg. */
export const upperY = (aDeg: number) => U.y0 + ((U.y1 - U.y0) * (aDeg - U.fromDeg)) / (U.toDeg - U.fromDeg)

/** The slab's opening over the upper flight: wherever its headroom would meet the soffit. */
export const EAST_STAIR_HATCH = {
  r0: U.r0 - 0.1,
  r1: U.r1 + 0.1,
  fromDeg: U.fromDeg + ((U.toDeg - U.fromDeg) * (SLAB_SOFFIT - HEADROOM - U.y0)) / (U.y1 - U.y0),
  toDeg: U.toDeg + 0.6,
} as const

/** The hatch opening as a closed plan outline (for the slab's holes). */
export function hatchOutline(): [number, number][] {
  const h = EAST_STAIR_HATCH
  const pts: [number, number][] = []
  const n = 24
  for (let i = 0; i <= n; i++) {
    const a = (h.fromDeg + ((h.toDeg - h.fromDeg) * i) / n) * DEG
    pts.push([h.r1 * Math.cos(a), h.r1 * Math.sin(a)])
  }
  for (let i = n; i >= 0; i--) {
    const a = (h.fromDeg + ((h.toDeg - h.fromDeg) * i) / n) * DEG
    pts.push([h.r0 * Math.cos(a), h.r0 * Math.sin(a)])
  }
  return pts
}

/** A tread: a slab between plan angles a0 → a1 (deg) and radii r0 → r1, its top at y, `t` thick. */
function tread(mesh: Mesh, r0: number, r1: number, a0: number, a1: number, y: number, t: number) {
  const am = ((a0 + a1) / 2) * DEG
  const rm = (r0 + r1) / 2
  const c = Math.cos(am)
  const s = Math.sin(am)
  const going = Math.abs(a1 - a0) * DEG * rm
  mesh.box([rm * c, y - t / 2, rm * s], [c * ((r1 - r0) / 2), 0, s * ((r1 - r0) / 2)], [0, t / 2, 0], [-s * (going / 2), 0, c * (going / 2)])
}

/** A brass tube from a to b. */
function tube(mesh: Mesh, a: V3, b: V3, rad: number) {
  const g = new THREE.CylinderGeometry(rad, rad, 1, 8, 1, true)
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  g.scale(1, dir.length(), 1)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  const ng = g.toNonIndexed()
  const p = ng.getAttribute('position')
  const n = ng.getAttribute('normal')
  const u = ng.getAttribute('uv')
  const base = mesh.pos.length / 3
  for (let i = 0; i < p.count; i++) {
    mesh.pos.push(p.getX(i), p.getY(i), p.getZ(i))
    mesh.nor.push(n.getX(i), n.getY(i), n.getZ(i))
    mesh.uv.push(u.getX(i), u.getY(i))
    mesh.idx.push(base + i)
  }
  ng.dispose()
  g.dispose()
}

/** A sloping glass balustrade along radius r from (aA, yA) to (aB, yB), and its rail. */
function balustrade(glass: Mesh, brass: Mesh, r: number, aA: number, yA: number, aB: number, yB: number, steps = 24) {
  const P = (aDeg: number, y: number): V3 => [r * Math.cos(aDeg * DEG), y, r * Math.sin(aDeg * DEG)]
  const rail: V3[] = []
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps
    const t1 = (i + 1) / steps
    const a0 = aA + (aB - aA) * t0
    const a1 = aA + (aB - aA) * t1
    const y0 = yA + (yB - yA) * t0
    const y1 = yA + (yB - yA) * t1
    const n0: V3 = [Math.cos(a0 * DEG), 0, Math.sin(a0 * DEG)]
    const n1: V3 = [Math.cos(a1 * DEG), 0, Math.sin(a1 * DEG)]
    glass.quad([P(a0, y0 + 0.05), P(a1, y1 + 0.05), P(a1, y1 + 0.98), P(a0, y0 + 0.98)], [n0, n1, n1, n0], [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ])
    if (i === 0) rail.push(P(a0, y0 + 1.0))
    rail.push(P(a1, y1 + 1.0))
  }
  for (let i = 1; i < rail.length; i++) tube(brass, rail[i - 1], rail[i], 0.024)
}

function stairGeometry() {
  const clay = new Mesh()
  const lacquer = new Mesh()
  const brass = new Mesh()
  const glass = new Mesh()
  const L = EAST_STAIR_RENDER.lower
  const R = EAST_STAIR_RENDER.landing
  const riser = 0.17
  // ── lower flight: open treads cantilevered from the lobe wall (into it by 0.1 m) ──
  const nL = Math.round((L.y1 - L.y0) / riser)
  for (let k = 1; k < nL; k++) {
    const a0 = L.fromDeg + ((L.toDeg - L.fromDeg) * (k - 1)) / (nL - 1)
    const a1 = L.fromDeg + ((L.toDeg - L.fromDeg) * k) / (nL - 1)
    tread(clay, L.r0, MUSEUM.drum.r + 0.1, a0, a1 + (L.toDeg < L.fromDeg ? -0.25 : 0.25), L.y0 + ((L.y1 - L.y0) * k) / nL, 0.14)
  }
  // a lacquered wall stringer under the treads' wall ends, following the flight's slope: the
  // cantilevered treads read as springing from it, never floating in front of the wall
  for (let k = 1; k < nL; k++) {
    const a0 = L.fromDeg + ((L.toDeg - L.fromDeg) * (k - 1)) / (nL - 1)
    const a1 = L.fromDeg + ((L.toDeg - L.fromDeg) * k) / (nL - 1)
    const y0 = L.y0 + ((L.y1 - L.y0) * k) / nL
    const y1 = L.y0 + ((L.y1 - L.y0) * (k + 1)) / nL
    const am = ((a0 + a1) / 2) * DEG
    const c = Math.cos(am)
    const sn = Math.sin(am)
    const rs = MUSEUM.drum.r - 0.05
    const going = Math.abs(a1 - a0) * DEG * rs
    lacquer.box([rs * c, (y0 + y1) / 2 - 0.32, rs * sn], [c * 0.05, 0, sn * 0.05], [0, 0.26, 0], [-sn * (going / 2 + 0.01), 0, c * (going / 2 + 0.01)])
  }
  balustrade(glass, brass, L.r0 + 0.03, L.fromDeg, L.y0 + (L.y1 - L.y0) / nL, L.toDeg, L.y1)
  // ── the landing: both flights wide, against the notch wall ──
  const landing = new Mesh()
  revolve(landing, 0, 0, [[EAST_STAIR_RENDER.landingR0, R.y], [MUSEUM.drum.r + 0.1, R.y]], R.fromDeg * DEG, R.toDeg * DEG, 12, [[0, 1], [0, 1]])
  revolve(landing, 0, 0, [[EAST_STAIR_RENDER.landingR0, R.y - 0.3], [MUSEUM.drum.r + 0.1, R.y - 0.3]], R.fromDeg * DEG, R.toDeg * DEG, 12, [[0, -1], [0, -1]])
  revolve(landing, 0, 0, [[EAST_STAIR_RENDER.landingR0, R.y - 0.3], [EAST_STAIR_RENDER.landingR0, R.y]], R.fromDeg * DEG, R.toDeg * DEG, 12, [[-1, 0], [-1, 0]])
  // ── upper flight: treads on a lacquered spine, climbing back to the roof ──
  const nU = Math.round((U.y1 - U.y0) / riser)
  const spine: V2[] = []
  for (let k = 1; k <= nU; k++) {
    const a0 = U.fromDeg + ((U.toDeg - U.fromDeg) * (k - 1)) / nU
    const a1 = U.fromDeg + ((U.toDeg - U.fromDeg) * k) / nU
    tread(clay, U.r0, U.r1, a0, a1 + 0.2, U.y0 + ((U.y1 - U.y0) * k) / nU, 0.1)
    spine.push([a0, U.y0 + ((U.y1 - U.y0) * (k - 1)) / nU])
  }
  // the spine: a deep beam under the treads' middle, following the flight's slope
  for (let i = 0; i < spine.length; i++) {
    const [a0, y0] = spine[i]
    const a1 = i + 1 < spine.length ? spine[i + 1][0] : U.toDeg
    const y1 = i + 1 < spine.length ? spine[i + 1][1] : U.y1
    const am = ((a0 + a1) / 2) * DEG
    const c = Math.cos(am)
    const s = Math.sin(am)
    const going = (a1 - a0) * DEG * U.r
    lacquer.box([U.r * c, (y0 + y1) / 2 - 0.28, U.r * s], [c * 0.16, 0, s * 0.16], [0, 0.3, 0], [-s * (going / 2 + 0.01), 0, c * (going / 2 + 0.01)])
  }
  balustrade(glass, brass, U.r0 + 0.03, U.fromDeg, U.y0, U.toDeg - 1.5, U.y1 - 0.2)
  balustrade(glass, brass, U.r1 - 0.03, U.fromDeg + 1.5, U.y0 + 0.2, U.toDeg - 1.5, U.y1 - 0.2)
  // ── the stair-house over the hatch: walls following the flight, a glazed sloping lid ──
  const house = new Mesh()
  // the house's inner skins, pale so the slot reads as a lit stairwell from the annex below
  const well = new Mesh()
  // the frosted diffuser under the lid
  const lid = new Mesh()
  const h = EAST_STAIR_HATCH
  const topY = (aDeg: number) => Math.max(ROOF_TOP + 0.35, upperY(Math.min(aDeg, U.toDeg)) + HEADROOM + 0.15)
  const n = 20
  const t = 0.16
  for (const [r, face] of [
    [h.r0, -1],
    [h.r1, 1],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a0 = h.fromDeg + ((h.toDeg - h.fromDeg) * i) / n
      const a1 = h.fromDeg + ((h.toDeg - h.fromDeg) * (i + 1)) / n
      const P = (rr: number, aDeg: number, y: number): V3 => [rr * Math.cos(aDeg * DEG), y, rr * Math.sin(aDeg * DEG)]
      const N = (aDeg: number, f: number): V3 => [Math.cos(aDeg * DEG) * f, 0, Math.sin(aDeg * DEG) * f]
      const ro = r + face * t
      // outer skin, inner skin, coping along the sloping top
      house.quad([P(ro, a0, ROOF_TOP - 0.02), P(ro, a1, ROOF_TOP - 0.02), P(ro, a1, topY(a1)), P(ro, a0, topY(a0))], [N(a0, face), N(a1, face), N(a1, face), N(a0, face)], [[a0 * DEG * ro, ROOF_TOP], [a1 * DEG * ro, ROOF_TOP], [a1 * DEG * ro, topY(a1)], [a0 * DEG * ro, topY(a0)]])
      well.quad([P(r, a0, ROOF_TOP - 0.02), P(r, a1, ROOF_TOP - 0.02), P(r, a1, topY(a1)), P(r, a0, topY(a0))], [N(a0, -face), N(a1, -face), N(a1, -face), N(a0, -face)], [[a0 * DEG * r, ROOF_TOP], [a1 * DEG * r, ROOF_TOP], [a1 * DEG * r, topY(a1)], [a0 * DEG * r, topY(a0)]])
      house.quad([P(r, a0, topY(a0)), P(ro, a0, topY(a0)), P(ro, a1, topY(a1)), P(r, a1, topY(a1))], [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], [[0, 0], [t, 0], [t, 1], [0, 1]])
      // the glazed lid between the walls
      glass.quad([P(h.r0, a0, topY(a0) - 0.04), P(h.r1, a0, topY(a0) - 0.04), P(h.r1, a1, topY(a1) - 0.04), P(h.r0, a1, topY(a1) - 0.04)], [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]])
      if (face > 0) lid.quad([P(h.r0, a0, topY(a0) - 0.08), P(h.r1, a0, topY(a0) - 0.08), P(h.r1, a1, topY(a1) - 0.08), P(h.r0, a1, topY(a1) - 0.08)], [[0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]])
    }
  }
  // the end wall at the top, its door opening onto the roof towards the dome
  {
    const aE = h.toDeg * DEG
    const c = Math.cos(aE)
    const s = Math.sin(aE)
    const yTop = topY(h.toDeg)
    const doorW = 1.0
    const doorH = 2.2
    const rm = (h.r0 + h.r1) / 2
    const n3: V3 = [-s, 0, c]
    const P = (r: number, y: number): V3 => [r * c + n3[0] * 0.08, y, r * s + n3[2] * 0.08]
    const w0 = h.r0 - t
    const w1 = h.r1 + t
    // either side of the door, and over it
    house.flat([P(w0, ROOF_TOP), P(rm - doorW / 2, ROOF_TOP), P(rm - doorW / 2, yTop), P(w0, yTop)], n3, [[0, 0], [1, 0], [1, 1], [0, 1]])
    house.flat([P(rm + doorW / 2, ROOF_TOP), P(w1, ROOF_TOP), P(w1, yTop), P(rm + doorW / 2, yTop)], n3, [[0, 0], [1, 0], [1, 1], [0, 1]])
    house.flat([P(rm - doorW / 2, ROOF_TOP + doorH), P(rm + doorW / 2, ROOF_TOP + doorH), P(rm + doorW / 2, yTop), P(rm - doorW / 2, yTop)], n3, [[0, 0], [1, 0], [1, 1], [0, 1]])
    const back: V3 = [s, 0, -c]
    const Q = (r: number, y: number): V3 => [r * c - n3[0] * 0.08, y, r * s - n3[2] * 0.08]
    house.flat([Q(w0, ROOF_TOP), Q(rm - doorW / 2, ROOF_TOP), Q(rm - doorW / 2, yTop), Q(w0, yTop)], back, [[0, 0], [1, 0], [1, 1], [0, 1]])
    house.flat([Q(rm + doorW / 2, ROOF_TOP), Q(w1, ROOF_TOP), Q(w1, yTop), Q(rm + doorW / 2, yTop)], back, [[0, 0], [1, 0], [1, 1], [0, 1]])
    house.flat([Q(rm - doorW / 2, ROOF_TOP + doorH), Q(rm + doorW / 2, ROOF_TOP + doorH), Q(rm + doorW / 2, yTop), Q(rm - doorW / 2, yTop)], back, [[0, 0], [1, 0], [1, 1], [0, 1]])
    // door reveals and the wall's top
    for (const r of [rm - doorW / 2, rm + doorW / 2]) {
      const nn: V3 = r < rm ? [c, 0, s] : [-c, 0, -s]
      lacquer.flat([P(r, ROOF_TOP), Q(r, ROOF_TOP), Q(r, ROOF_TOP + doorH), P(r, ROOF_TOP + doorH)], nn, [[0, 0], [1, 0], [1, 1], [0, 1]])
    }
    lacquer.flat([P(rm - doorW / 2, ROOF_TOP + doorH), Q(rm - doorW / 2, ROOF_TOP + doorH), Q(rm + doorW / 2, ROOF_TOP + doorH), P(rm + doorW / 2, ROOF_TOP + doorH)], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]])
    house.flat([P(w0, yTop), Q(w0, yTop), Q(w1, yTop), P(w1, yTop)], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]])
  }
  // the hatch's low end: a short wall closing the slot
  {
    const a0 = h.fromDeg * DEG
    const c = Math.cos(a0)
    const s = Math.sin(a0)
    const n3: V3 = [s, 0, -c]
    const y1 = topY(h.fromDeg)
    const P = (r: number, y: number): V3 => [r * c, y, r * s]
    house.flat([P(h.r0 - t, ROOF_TOP - 0.02), P(h.r1 + t, ROOF_TOP - 0.02), P(h.r1 + t, y1), P(h.r0 - t, y1)], n3, [[0, 0], [1, 0], [1, 1], [0, 1]])
  }
  return { clay: clay.build(), landing: landing.build(), lacquer: lacquer.build(), brass: brass.build(), glass: glass.build(), house: house.build(), well: well.build(), lid: lid.build() }
}

const glassMat = new THREE.MeshPhysicalMaterial({ name: 'stairGlass', color: '#e3eef0', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide })

const LID_DAY = new THREE.Color('#fff6ec').multiplyScalar(1.15)
const LID_DUSK = new THREE.Color('#ffd6b4').multiplyScalar(0.7)
const LID_NIGHT = new THREE.Color('#262c3c').multiplyScalar(0.5)
const lidMat = new THREE.MeshBasicMaterial({ name: 'stairLaylight', color: LID_DAY.clone(), toneMapped: false, side: THREE.DoubleSide })

export function EastStair() {
  const m = useMaterials()
  const geo = useMemo(stairGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  useFrame(() => {
    const d = ambience.daylight
    lidMat.color.copy(LID_NIGHT).lerp(LID_DUSK, Math.min(1, d * 2)).lerp(LID_DAY, Math.max(0, d * 2 - 1))
  })
  return (
    <group name="east-stair">
      <StaticMerge name="east-stair-shell">
        {geo.clay && <mesh geometry={geo.clay} material={m.glazedTerracotta} castShadow receiveShadow />}
        {geo.landing && <mesh geometry={geo.landing} material={m.clayTerracotta} castShadow receiveShadow />}
        {geo.lacquer && <mesh geometry={geo.lacquer} material={m.oxbloodLacquer} castShadow receiveShadow />}
        {geo.brass && <mesh geometry={geo.brass} material={m.brass} />}
        {geo.house && <mesh geometry={geo.house} material={m.clayBuff} castShadow receiveShadow />}
        {geo.well && <mesh geometry={geo.well} material={m.clayCeiling} receiveShadow />}
      </StaticMerge>
      {geo.lid && <mesh geometry={geo.lid} material={lidMat} raycast={() => null} />}
      {geo.glass && <mesh geometry={geo.glass} material={glassMat} raycast={() => null} renderOrder={2} />}
    </group>
  )
}
