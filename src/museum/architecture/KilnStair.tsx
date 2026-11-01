/**
 * THE KILN STAIR (SPECTACLE F4, the tower's shell): a round rammed-earth tower outside the drum
 * to the south-west, shaped like an updraught kiln — a battered brick footing, a body banded with
 * fired-brick courses and pierced by narrow sun slits that climb in a spiral (the stair inside
 * follows them), and a corbelled crown round the top landing, from which a short bridge steps
 * down onto the pavilion's roof.
 *
 * The visitor never walks in: WALLS 'kiln-stair' collides as a solid disc, and the climb is the
 * perch's rail ride (WP5), which starts at the arched door facing out from the drum. The slits
 * and the door glow faintly from within at dusk and night.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, KEY, MUSEUM, polar } from '../config/museum'
import { KILN_STAIR } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { annulusFace, arcEndCap, cylinderFace, mergeAll, type ArcWindow } from './shellGeometry'
import { polarBand } from './Satellites'

const K = KILN_STAIR
const [CX, CZ] = polar(K.r, K.aDeg)
/** Body radius; the footing and the crown stand proud of it. */
const R = K.radius
const FOOT = { h: 0.32, out: 0.1 }
const CROWN = { y: K.height - 0.35, out: 0.2 }
/** The landing's parapet above the tower's height. */
const PARAPET = 0.95
/** The door faces away from the drum (tower-local plan angle = the tower's own bearing). */
export const KILN_DOOR = { aDeg: K.aDeg, width: 0.96, height: 2.3, depth: 0.32 }
/** The landing on top, and the plan point outside the door (for the perch and the tour). */
export const KILN_TOP = { x: CX, z: CZ, y: K.height }
export const KILN_DOOR_POINT = polar(K.r + R + 0.5, K.aDeg)

/** Sun slits: a spiral of narrow openings climbing with the stair. */
function slits(): ArcWindow[] {
  const out: ArcWindow[] = []
  const w = 0.13 / R
  const n = 9
  for (let i = 0; i < n; i++) {
    const a = (K.aDeg + 70 + i * 52) * DEG
    const y0 = 1.0 + i * 0.52
    out.push({ a0: a - w / 2, a1: a + w / 2, y0, y1: y0 + 0.78 })
  }
  return out
}

function towerGeometry() {
  const wins = slits()
  const door: ArcWindow = { a0: (KILN_DOOR.aDeg * DEG) - KILN_DOOR.width / 2 / R, a1: (KILN_DOOR.aDeg * DEG) + KILN_DOOR.width / 2 / R, y0: FOOT.h - 0.01, y1: KILN_DOOR.height }
  const full = Math.PI * 2
  const body = cylinderFace(CX, CZ, R, 0, full, FOOT.h, CROWN.y, 'out', [...wins, door])
  // fired-brick courses banding the body, 5 mm proud, skipping the openings
  const bands: (THREE.BufferGeometry | null)[] = []
  for (let y = FOOT.h + 0.9; y < CROWN.y - 0.3; y += 1.05) {
    const wsAt = [...wins, door].filter((w) => !(w.y1 < y || w.y0 > y + 0.08))
    bands.push(cylinderFace(CX, CZ, R + 0.005, 0, full, y, y + 0.08, 'out', wsAt.map((w) => ({ ...w, y0: y - 1, y1: y + 1 }))))
  }
  // the openings' reveals: jambs, sills, heads, and a dark back (the stair's core) a slit's depth in
  const reveal: (THREE.BufferGeometry | null)[] = []
  const back: (THREE.BufferGeometry | null)[] = []
  for (const w of [...wins, door]) {
    const d = w === door ? KILN_DOOR.depth : 0.24
    reveal.push(arcEndCap(CX, CZ, R - d, R, w.a0, w.y0, w.y1, 'end'), arcEndCap(CX, CZ, R - d, R, w.a1, w.y0, w.y1, 'start'), annulusFace(CX, CZ, R - d, R, w.a0, w.a1, w.y0, true), annulusFace(CX, CZ, R - d, R, w.a0, w.a1, w.y1, false))
    back.push(cylinderFace(CX, CZ, R - d, w.a0 - 0.01, w.a1 + 0.01, w.y0, w.y1, 'out'))
  }
  // footing: a battered brick plinth; crown: three corbelled rings, the landing's parapet
  const foot = mergeAll([cylinderFace(CX, CZ, R + FOOT.out, 0, full, 0, FOOT.h, 'out', [{ ...door, y0: -1, y1: FOOT.h + 1 }]), annulusFace(CX, CZ, R, R + FOOT.out, 0, full, FOOT.h, true)])
  const crown: (THREE.BufferGeometry | null)[] = []
  for (let i = 0; i < 3; i++) {
    const rr = R + ((i + 1) * CROWN.out) / 3
    const y0 = CROWN.y + i * 0.09
    crown.push(cylinderFace(CX, CZ, rr, 0, full, y0, y0 + 0.09, 'out'), annulusFace(CX, CZ, R, rr, 0, full, y0, false))
  }
  const top = CROWN.y + 0.27
  const pr = R + CROWN.out
  // the parapet opens towards the drum, where the bridge leaves the landing
  const gapA = (K.aDeg + 180) * DEG
  const gw = 0.42 / pr
  const g0 = gapA + gw - Math.PI * 2
  crown.push(
    cylinderFace(CX, CZ, pr, 0, full, top, K.height, 'out'),
    cylinderFace(CX, CZ, pr, g0, gapA - gw, K.height, K.height + PARAPET, 'out'),
    cylinderFace(CX, CZ, pr - 0.18, g0, gapA - gw, K.height, K.height + PARAPET, 'in'),
    annulusFace(CX, CZ, pr - 0.18, pr, g0, gapA - gw, K.height + PARAPET, true),
    arcEndCap(CX, CZ, pr - 0.18, pr, g0, K.height, K.height + PARAPET, 'start'),
    arcEndCap(CX, CZ, pr - 0.18, pr, gapA - gw, K.height, K.height + PARAPET, 'end'),
  )
  // the landing floor and the top of the body below the crown
  const landing = annulusFace(CX, CZ, 0, pr - 0.18, 0, full, K.height, true)
  const inner = cylinderFace(CX, CZ, R, 0, full, CROWN.y, top, 'out')
  // a glimpse of the first treads inside the door
  const treads: THREE.BufferGeometry[] = []
  const da = KILN_DOOR.aDeg * DEG
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(0.28, 0.16, 0.8)
    const rr = R - KILN_DOOR.depth - 0.15 - i * 0.02
    const t = da + 0.25 + i * 0.22
    g.rotateY(-t)
    g.translate(CX + rr * Math.cos(t), FOOT.h + 0.08 + i * 0.17, CZ + rr * Math.sin(t))
    treads.push(g)
  }
  return { body: mergeAll([body, inner]), bands: mergeAll(bands), reveal: mergeAll(reveal), back: mergeAll(back), foot, crown: mergeAll(crown), landing, treads: mergeAll(treads) }
}

/** A short bridge from the landing's parapet gap down onto the drum roof, towards the oculus. */
function bridgeGeometry() {
  const a = K.aDeg * DEG
  const roofTop = MUSEUM.pavilion.ceilingHeight + MUSEUM.pavilion.roofThickness
  const r0 = K.r - R - CROWN.out + 0.1
  const r1 = KEY.lobeOuterR - 0.2
  const w = 0.5 / ((r0 + r1) / 2)
  const deck = polarBand(r1, r0, a - w, a + w, roofTop + 0.12, true)
  const side = mergeAll([cylinderFace(0, 0, r1, a - w, a + w, roofTop, roofTop + 0.12, 'in'), cylinderFace(0, 0, r0, a - w, a + w, roofTop, roofTop + 0.12, 'out')])
  return { deck, side }
}

export function KilnStair() {
  const m = useMaterials()
  const geo = useMemo(towerGeometry, [])
  const bridge = useMemo(bridgeGeometry, [])
  useEffect(() => () => [...Object.values(geo), ...Object.values(bridge)].forEach((g) => g?.dispose()), [geo, bridge])
  // the stair's core: dark by day, a warm lamp-glow by night
  const core = useMemo(() => new THREE.MeshStandardMaterial({ name: 'kilnStairCore', color: '#2a1612', roughness: 1, emissive: new THREE.Color('#ff8a45'), emissiveIntensity: 0 }), [])
  useEffect(() => () => core.dispose(), [core])
  useFrame(() => {
    core.emissiveIntensity = 0.08 + 0.9 * ambience.night + 0.35 * ambience.twilight
  })
  return (
    <group name="kiln-stair">
      <StaticMerge name="kiln-stair-shell">
        {geo.body && <mesh geometry={geo.body} material={m.rammedEarth} castShadow receiveShadow />}
        {geo.bands && <mesh geometry={geo.bands} material={m.brick} castShadow receiveShadow />}
        {geo.reveal && <mesh geometry={geo.reveal} material={m.clayTerracotta} receiveShadow />}
        {geo.foot && <mesh geometry={geo.foot} material={m.brick} castShadow receiveShadow />}
        {geo.crown && <mesh geometry={geo.crown} material={m.brick} castShadow receiveShadow />}
        {geo.landing && <mesh geometry={geo.landing} material={m.sandPaving} receiveShadow />}
        {geo.treads && <mesh geometry={geo.treads} material={m.clayTerracotta} receiveShadow />}
        {bridge.deck && <mesh geometry={bridge.deck} material={m.timber} receiveShadow />}
        {bridge.side && <mesh geometry={bridge.side} material={m.oxblood} receiveShadow />}
      </StaticMerge>
      {geo.back && <mesh geometry={geo.back} material={core} />}
    </group>
  )
}
