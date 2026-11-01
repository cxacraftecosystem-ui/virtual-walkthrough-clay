/**
 * THE THREE GREAT ARCHES (GRAND §1.2, §2.5): E east, E west and D, cut through the ring circle
 * on which the dome stands. Each is a true semicircle on its chord, springing at apex − chord / 2,
 * with a 0.6 m deep reveal: an oxblood lacquer intrados, a line of concealed light tracing it
 * (it glows at dusk), and the wall above it (the spandrels) up into the roof slab — rose clay
 * towards the rotunda, blush plaster towards the ambulatory.
 *
 * WALLS keeps each arch as a non-colliding 'lintel' from the spring (layout.ts); Wall.tsx leaves
 * them to this file. The jambs are the neighbouring walls' lacquered ends (H, D) or the notch walls.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ARCH, DEG, KEY, MUSEUM } from '../config/museum'
import { StaticMerge } from '../effects/StaticMerge'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { WALL_INTO_ROOF } from './Wall'
import { mergeAll } from './shellGeometry'
import { Mesh, type V3 } from './sweep'

const TOP = MUSEUM.pavilion.ceilingHeight + WALL_INTO_ROOF
const R0 = KEY.ringR
const R1 = KEY.ringOuterR
/** The cove slot along the intrados: its half-width and how far it is set up into the soffit. */
const SLOT = { half: 0.045, up: 0.012 }

type ArchSpec = (typeof ARCH)[keyof typeof ARCH]

/** Points along the intrados: plan angle (rad), height, and the soffit's normal parameter t. */
export function intrados(a: ArchSpec, steps = 40) {
  const rc = KEY.ringC
  const half = ((a.toDeg - a.fromDeg) / 2) * DEG
  const R = rc * Math.sin(half)
  const mid = a.midDeg * DEG
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = -Math.PI / 2 + (Math.PI * i) / steps
    const u = R * Math.sin(t)
    return { a: mid + Math.asin(u / rc), y: a.spring + R * Math.cos(t), t }
  })
}

function archGeometry(a: ArchSpec) {
  const inner = new Mesh()
  const outer = new Mesh()
  const soffit = new Mesh()
  const glow = new Mesh()
  const pts = intrados(a)
  const P = (r: number, ang: number, y: number): V3 => [r * Math.cos(ang), y, r * Math.sin(ang)]
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]
    const q = pts[i + 1]
    const nIn = (ang: number): V3 => [-Math.cos(ang), 0, -Math.sin(ang)]
    const nOut = (ang: number): V3 => [Math.cos(ang), 0, Math.sin(ang)]
    inner.quad([P(R0, p.a, p.y), P(R0, q.a, q.y), P(R0, q.a, TOP), P(R0, p.a, TOP)], [nIn(p.a), nIn(q.a), nIn(q.a), nIn(p.a)], [
      [p.a * R0, p.y],
      [q.a * R0, q.y],
      [q.a * R0, TOP],
      [p.a * R0, TOP],
    ])
    outer.quad([P(R1, p.a, p.y), P(R1, q.a, q.y), P(R1, q.a, TOP), P(R1, p.a, TOP)], [nOut(p.a), nOut(q.a), nOut(q.a), nOut(p.a)], [
      [-p.a * R1, p.y],
      [-q.a * R1, q.y],
      [-q.a * R1, TOP],
      [-p.a * R1, TOP],
    ])
    // the soffit faces into the opening: towards the arch's centre in the wall's plane
    const sn = (pt: (typeof pts)[number]): V3 => {
      const tx = -Math.sin(pt.a)
      const tz = Math.cos(pt.a)
      return [-Math.sin(pt.t) * tx, -Math.cos(pt.t), -Math.sin(pt.t) * tz]
    }
    const rs0 = KEY.ringC - SLOT.half
    const rs1 = KEY.ringC + SLOT.half
    const len0 = (p.a - pts[0].a) * KEY.ringC
    const len1 = (q.a - pts[0].a) * KEY.ringC
    for (const [ra, rb] of [
      [R0, rs0],
      [rs1, R1],
    ] as const)
      soffit.quad([P(ra, p.a, p.y), P(rb, p.a, p.y), P(rb, q.a, q.y), P(ra, q.a, q.y)], [sn(p), sn(p), sn(q), sn(q)], [
        [ra, len0],
        [rb, len0],
        [rb, len1],
        [ra, len1],
      ])
    // the slot: its glowing floor set a little up into the soffit, its two cheeks
    const up = (pt: (typeof pts)[number]) => {
      const n = sn(pt)
      return (r: number): V3 => {
        const b = P(r, pt.a, pt.y)
        return [b[0] - n[0] * SLOT.up, b[1] - n[1] * SLOT.up, b[2] - n[2] * SLOT.up]
      }
    }
    const pu = up(p)
    const qu = up(q)
    glow.quad([pu(rs0), pu(rs1), qu(rs1), qu(rs0)], [sn(p), sn(p), sn(q), sn(q)], [
      [0, len0],
      [1, len0],
      [1, len1],
      [0, len1],
    ])
    const cheek = (r: number, facing: 1 | -1): void => {
      const n: V3 = [Math.cos(p.a) * facing, 0, Math.sin(p.a) * facing]
      soffit.quad([P(r, p.a, p.y), pu(r), qu(r), P(r, q.a, q.y)], [n, n, n, n], [
        [len0, 0],
        [len0, SLOT.up],
        [len1, SLOT.up],
        [len1, 0],
      ])
    }
    cheek(rs0, 1)
    cheek(rs1, -1)
  }
  return { inner: inner.build(), outer: outer.build(), soffit: soffit.build(), glow: glow.build() }
}

const coveMaterial = new THREE.MeshStandardMaterial({ name: 'archCove', color: '#5e1f1b', emissive: new THREE.Color('#ff9a5c'), emissiveIntensity: 0.4, roughness: 0.6 })

export function Arches() {
  const m = useMaterials()
  const geo = useMemo(() => {
    const all = [ARCH.eEast, ARCH.eWest, ARCH.d].map(archGeometry)
    const merge = (k: keyof (typeof all)[number]) => mergeAll(all.map((g) => g[k]))
    return { inner: merge('inner'), outer: merge('outer'), soffit: merge('soffit'), glow: merge('glow') }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  useFrame(() => {
    coveMaterial.emissiveIntensity = 0.25 + 2.2 * ambience.night + 0.9 * ambience.twilight
  })
  return (
    <group name="arches">
      <StaticMerge name="arches-shell">
        {geo.inner && <mesh geometry={geo.inner} material={m.clayRose} castShadow receiveShadow />}
        {geo.outer && <mesh geometry={geo.outer} material={m.blushPlaster} castShadow receiveShadow />}
        {geo.soffit && <mesh geometry={geo.soffit} material={m.oxbloodLacquer} castShadow receiveShadow />}
      </StaticMerge>
      {geo.glow && <mesh geometry={geo.glow} material={coveMaterial} raycast={() => null} />}
    </group>
  )
}
