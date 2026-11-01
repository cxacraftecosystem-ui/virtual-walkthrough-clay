/**
 * THE DUPLEX BALCONY (GRAND §1.2, §2.5): the PDF's half-height line made a real upper gallery —
 * a ring round A/B/C at y 4.6, from the D arch to the E-east arch, and a bridge out through the
 * E-east arch to the east stair's landing. Ridden by the duplex perch, never walked.
 *
 *   slab ......... 0.3 m, its soffit carrying the gallery's track (lighting/Fixtures.tsx)
 *   fascia ....... 4.0 → 4.6 facing the court: the ground of the procession frieze (DuplexFrieze.tsx)
 *   balustrade ... 1.05 m of terracotta above the fascia, so fascia and balustrade read as one
 *                  deep band round the rotunda, under a round brass handrail
 *   bridge ....... through the arch's west side to the stair's landing, the balustrade running
 *                  round the balcony's end and along both sides of the bridge
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, MUSEUM } from '../config/museum'
import { EAST_STAIR } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { useMaterials } from '../materials/materials'
import { EAST_STAIR_RENDER } from './EastStair'
import { Mesh, revolve, type V2, type V3 } from './sweep'

const B = MUSEUM.balcony
export const BALCONY = {
  y: MUSEUM.pavilion.mezzanineBand,
  r0: B.r0,
  r1: B.r1,
  /** Fascia (frieze) thickness. */
  fasciaT: 0.15,
  /** Balustrade top (below the brass rail's centre). */
  railY: MUSEUM.pavilion.mezzanineBand + B.balustrade - 0.06,
  railR: 0.065,
  /** The balcony's span (deg): from the D arch round to the bridge's far side. */
  fromDeg: B.fromDeg,
  toDeg: EAST_STAIR.bridge.toDeg + 360,
  /** The bridge's sides (deg) and its outer end (the stair landing's inner edge). */
  bridge: { fromDeg: EAST_STAIR.bridge.fromDeg + 360, toDeg: EAST_STAIR.bridge.toDeg + 360, r1: EAST_STAIR_RENDER.landingR0 },
} as const

function balconyGeometry() {
  const body = new Mesh()
  const fascia = new Mesh()
  const brass = new Mesh()
  const { y, r0, r1, fasciaT, railY, railR } = BALCONY
  const yS = y - B.slab
  const yF = B.fascia.y0
  const a0 = BALCONY.fromDeg * DEG
  const a1 = BALCONY.toDeg * DEG
  const seg = Math.ceil((Math.PI * 2 * r1) / 0.3)
  const rb = r0 + fasciaT
  const up: V2 = [0, 1]
  const down: V2 = [0, -1]
  const inn: V2 = [-1, 0]
  const out: V2 = [1, 0]
  // the ring: walking surface, soffit, the fascia + balustrade face, its back, the fascia's foot
  revolve(body, 0, 0, [[rb, y], [r1 - 0.002, y]], a0, a1, seg, [up, up])
  revolve(body, 0, 0, [[rb, yS], [r1 - 0.002, yS]], a0, a1, seg, [down, down])
  revolve(fascia, 0, 0, [[r0, yF], [r0, railY]], a0, a1, seg, [inn, inn])
  revolve(body, 0, 0, [[rb, y], [rb, railY]], a0, a1, seg, [out, out])
  revolve(body, 0, 0, [[rb, yF], [rb, yS]], a0, a1, seg, [out, out])
  revolve(body, 0, 0, [[r0, yF], [rb, yF]], a0, a1, seg, [down, down])
  // the handrail along the ring
  const rail: V2[] = []
  const railN: V2[] = []
  const cx = r0 + fasciaT / 2
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI * (i / 10)
    rail.push([cx - railR * Math.cos(t), railY + railR * Math.sin(t) * 0.8])
    railN.push([-Math.cos(t), Math.sin(t)])
  }
  revolve(brass, 0, 0, rail, a0, a1, seg, railN)

  // the balcony's end at the D arch: a flat lacquered return
  const end = (a: number, facing: 1 | -1) => {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const n: V3 = [-s * facing, 0, c * facing]
    const P = (r: number, yy: number): V3 => [r * c, yy, r * s]
    body.flat([P(r0, yF), P(rb, yF), P(rb, railY), P(r0, railY)], n, [[r0, yF], [rb, yF], [rb, railY], [r0, railY]])
    body.flat([P(rb, yS), P(r1, yS), P(r1, y), P(rb, y)], n, [[rb, yS], [r1, yS], [r1, y], [rb, y]])
  }
  end(a0, -1)

  // the bridge through the arch: deck, soffit, its two parapets and beams
  const br = BALCONY.bridge
  const b0 = br.fromDeg * DEG
  const b1 = br.toDeg * DEG
  revolve(body, 0, 0, [[r1 - 0.004, y], [br.r1 + 0.02, y]], b0, b1, 24, [up, up])
  revolve(body, 0, 0, [[r1 - 0.004, yS], [br.r1 + 0.02, yS]], b0, b1, 24, [down, down])
  // a parapet along each side of the bridge, and across the balcony's end on the far side
  const parapet = (aDeg: number, rA: number, rB: number, inward: 1 | -1) => {
    const a = aDeg * DEG
    const t: V2 = [Math.cos(a), Math.sin(a)]
    const len = rB - rA
    const mid = (rA + rB) / 2
    const off = (inward * fasciaT) / 2 / mid
    const c = Math.cos(a + off)
    const s = Math.sin(a + off)
    // body: from the beam's foot to the parapet's top, one oriented box
    body.box([mid * c, (yF + railY) / 2, mid * s], [t[0] * (len / 2), 0, t[1] * (len / 2)], [0, (railY - yF) / 2, 0], [-s * (fasciaT / 2), 0, c * (fasciaT / 2)])
    // its rail
    const g = new THREE.CylinderGeometry(railR, railR, len, 10, 1)
    g.rotateZ(Math.PI / 2)
    g.rotateY(-a)
    g.translate(mid * c, railY + railR * 0.4, mid * s)
    appendTo(brass, g)
  }
  parapet(br.fromDeg, r1 - 0.002, br.r1, 1)
  parapet(br.toDeg, r0, br.r1, -1)
  return { body: body.build(), fascia: fascia.build(), brass: brass.build() }
}

/** Copy a three.js geometry's triangles into a Mesh. */
function appendTo(mesh: Mesh, g: THREE.BufferGeometry) {
  const ng = g.toNonIndexed()
  const p = ng.getAttribute('position')
  const n = ng.getAttribute('normal')
  const u = ng.getAttribute('uv')
  const b = mesh.pos.length / 3
  for (let i = 0; i < p.count; i++) {
    mesh.pos.push(p.getX(i), p.getY(i), p.getZ(i))
    mesh.nor.push(n.getX(i), n.getY(i), n.getZ(i))
    mesh.uv.push(u.getX(i), u.getY(i))
    mesh.idx.push(b + i)
  }
  ng.dispose()
  g.dispose()
}

export function Balcony() {
  const m = useMaterials()
  const geo = useMemo(balconyGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  return (
    <group name="balcony">
      <StaticMerge name="balcony-shell">
        {geo.body && <mesh geometry={geo.body} material={m.clayTerracotta} castShadow receiveShadow />}
        {geo.fascia && <mesh geometry={geo.fascia} material={m.clayTerracotta} castShadow receiveShadow />}
        {geo.brass && <mesh geometry={geo.brass} material={m.brass} castShadow />}
      </StaticMerge>
    </group>
  )
}

/** The balcony's walking radius (the duplex perch rides it). */
export const BALCONY_WALK_R = (BALCONY.r0 + BALCONY.r1) / 2
