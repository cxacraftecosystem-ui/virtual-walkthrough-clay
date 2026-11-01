/**
 * 'spiral-stair' — the sculptural red clay stair of the Sphere Well (PDF p07r "a spiral stair
 * round a sphere under a stepped oculus"; GRAND §2.7, §6.5).
 *
 *   form      a free-standing helical slab between radii `r0` and `r1` about the origin, making
 *             `turns` turns while it climbs `rise` metres: one continuous smooth soffit underneath,
 *             a solid balustrade rising from its inner edge (towards the sphere) with a rounded
 *             top and a brass handrail, and tile treads open on the outer edge (risers of about
 *             17 cm), each with a dark nosing, so the steps' sawtooth reads from the floor
 *   finish    rose (p07r: rose clay plaster, the room's dark walls behind it), red (the deep
 *             red lime) or terracotta; the treads are always fired tile
 *
 * Origin: floor centre of the well; the stair starts at plan angle 0 (local +x) on the floor and
 * climbs anticlockwise seen from above. A concealed warm LED line runs under the handrail.
 * Draw calls: 6 (body, soffit, treads, nosings, brass, light line).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { tinted, useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

const noRaycast = () => null

/** Quad-strip mesh builder with explicit normals from the triangles. */
class Strip {
  pos: number[] = []
  uv: number[] = []
  idx: number[] = []
  /** Add a grid of rows × cols points (row-major), facing by winding; returns nothing. */
  grid(pts: [number, number, number][][], uvs: [number, number][][], flip = false) {
    const rows = pts.length
    const cols = pts[0].length
    const base = this.pos.length / 3
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        this.pos.push(...pts[j][i])
        this.uv.push(...uvs[j][i])
      }
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const a = base + j * cols + i
        const b = a + cols
        if (flip) this.idx.push(a, a + 1, b, a + 1, b + 1, b)
        else this.idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    return g
  }
}

interface StairSpec {
  r0: number
  r1: number
  turns: number
  rise: number
  seg: number
}

const T = 0.3
const BAL = { t: 0.14, h: 1.0 }

function stairGeometry(s: StairSpec) {
  const Th = s.turns * Math.PI * 2
  const N = s.seg
  const y = (th: number) => (s.rise * th) / Th
  const P = (r: number, th: number, yy: number): [number, number, number] => [r * Math.cos(th), yy, -r * Math.sin(th)]
  const body = new Strip()
  const under = new Strip()
  const ths = Array.from({ length: N + 1 }, (_, i) => (Th * i) / N)
  const soff = (th: number) => Math.max(0, y(th) - T)
  const rb = s.r0 + BAL.t
  // soffit (facing down): from r0 to r1, in its own pale plaster so the spiral reads from below
  under.grid(
    ths.map((th) => [P(s.r0, th, soff(th)), P(s.r1, th, soff(th))]),
    ths.map((th) => [[th * s.r0, s.r0], [th * s.r0, s.r1]]),
    false,
  )
  // inner face of the balustrade (towards the sphere), soffit → top
  body.grid(
    ths.map((th) => [P(s.r0, th, soff(th)), P(s.r0, th, y(th) + BAL.h)]),
    ths.map((th) => [[th * s.r0, soff(th)], [th * s.r0, y(th) + BAL.h]]),
    true,
  )
  // rounded top of the balustrade: a half-round from r0 to rb
  const cap = 6
  body.grid(
    ths.map((th) =>
      Array.from({ length: cap + 1 }, (_, k) => {
        const a = (Math.PI * k) / cap
        const rr = s.r0 + (BAL.t / 2) * (1 - Math.cos(a))
        return P(rr, th, y(th) + BAL.h + (BAL.t / 2) * Math.sin(a) * 0.8)
      }),
    ),
    ths.map((th) => Array.from({ length: cap + 1 }, (_, k) => [th * s.r0, k * 0.03] as [number, number])),
    true,
  )
  // tread-side face of the balustrade: tread line → top
  body.grid(
    ths.map((th) => [P(rb, th, y(th) + BAL.h), P(rb, th, y(th) - 0.02)]),
    ths.map((th) => [[th * rb, y(th) + BAL.h], [th * rb, y(th)]]),
    true,
  )
  // outer stringer: the outer face from the soffit up to the treads' line (no upstand above it: the
  // steps stand open on the outer edge, so their sawtooth reads from the floor, as in p07r)
  body.grid(
    ths.map((th) => [P(s.r1, th, y(th) - 0.02), P(s.r1, th, soff(th))]),
    ths.map((th) => [[th * s.r1, y(th)], [th * s.r1, soff(th)]]),
    true,
  )
  // end caps (start at the floor, end at the top)
  const capAt = (th: number, flip: boolean) => {
    const yy = y(th)
    const sf = soff(th)
    body.grid(
      [
        [P(s.r0, th, sf), P(s.r1, th, sf)],
        [P(s.r0, th, yy + BAL.h), P(s.r1, th, yy)],
      ],
      [
        [[s.r0, sf], [s.r1, sf]],
        [[s.r0, yy + BAL.h], [s.r1, yy]],
      ],
      flip,
    )
  }
  capAt(0, true)
  capAt(Th, false)

  // treads: a wedge per step, risers of about 17 cm, out to the stair's outer edge; each tread has a
  // rounded nosing proud of the riser and of the outer face, a dark fired-clay edge that draws
  // every step as a line seen from below
  const steps = Math.max(3, Math.round(s.rise / 0.17))
  const tr = new Strip()
  const nose = new Strip()
  const NO = { out: 0.03, h: 0.035 }
  const ro = s.r1 + NO.out
  for (let k = 0; k < steps; k++) {
    const a0 = (Th * k) / steps
    const a1 = (Th * (k + 1)) / steps
    const top = (s.rise * (k + 1)) / steps
    const bot = (s.rise * k) / steps
    const sub = 6
    const as = Array.from({ length: sub + 1 }, (_, i) => a0 + ((a1 - a0) * i) / sub)
    // the tread's top
    tr.grid(
      as.map((a) => [P(rb, a, top), P(s.r1, a, top)]),
      as.map((a) => [[a * rb, rb], [a * rb, s.r1]]),
      true,
    )
    // the riser at the step's front (a0)
    tr.grid(
      [
        [P(rb, a0, bot), P(s.r1, a0, bot)],
        [P(rb, a0, top), P(s.r1, a0, top)],
      ],
      [
        [[rb, bot], [s.r1, bot]],
        [[rb, top], [s.r1, top]],
      ],
      true,
    )
    // the step's open outer side: from the stringer's line up to the tread
    tr.grid(
      as.map((a) => [P(s.r1, a, top), P(s.r1, a, Math.min(top, y(a) - 0.02))]),
      as.map((a) => [[a * s.r1, top], [a * s.r1, y(a)]]),
      true,
    )
    // the nosing: a slim band along the front edge and the outer edge of the tread
    const da = NO.out / Math.max(rb, 0.5)
    const nf = a0 - da
    nose.grid(
      [
        [P(rb, nf, top - NO.h), P(ro, nf, top - NO.h)],
        [P(rb, nf, top + 0.004), P(ro, nf, top + 0.004)],
        [P(rb, a0 + da, top + 0.004), P(ro, a0 + da, top + 0.004)],
      ],
      [
        [[0, 0], [1, 0]],
        [[0, 0.5], [1, 0.5]],
        [[0, 1], [1, 1]],
      ],
      true,
    )
    nose.grid(
      as.map((a) => [P(ro, a, top + 0.004), P(ro, a, top - NO.h)]),
      as.map((a) => [[a * ro, 0], [a * ro, 1]]),
      true,
    )
    nose.grid(
      as.map((a) => [P(s.r1, a, top - NO.h), P(ro, a, top - NO.h)]),
      as.map((a) => [[a * ro, 0], [a * ro, 1]]),
      true,
    )
  }
  // brass handrail along the balustrade's top, on the tread side
  const hr = new Strip()
  const hrR = 0.022
  const ring = 8
  const railR = rb - 0.02
  hr.grid(
    ths.map((th) =>
      Array.from({ length: ring + 1 }, (_, k) => {
        const a = (k / ring) * Math.PI * 2
        return P(railR + hrR * Math.cos(a), th, y(th) + BAL.h - 0.12 + hrR * Math.sin(a))
      }),
    ),
    ths.map((th) => Array.from({ length: ring + 1 }, (_, k) => [th * railR, k / ring] as [number, number])),
    false,
  )
  // the concealed warm line under the handrail: it washes every tread below it (p07r's glowing
  // stair), and a second, fainter one at the foot of the outer upstand
  const glow = new Strip()
  const gH = 0.028
  glow.grid(
    ths.map((th) => [P(rb + 0.004, th, y(th) + BAL.h - 0.17), P(rb + 0.004, th, y(th) + BAL.h - 0.17 - gH)]),
    ths.map((th) => [[th * rb, 0], [th * rb, 1]]),
    true,
  )
  return { body: body.build(), soffit: under.build(), treads: tr.build(), nosing: nose.build(), rail: hr.build(), glow: glow.build() }
}

/** The LED line: unlit, past white so the bloom picks it up; dimmer by day than at night. */
const glowMat = new THREE.MeshBasicMaterial({ name: 'stairGlow', color: new THREE.Color('#ffbe7a').multiplyScalar(3.0), toneMapped: false, side: THREE.DoubleSide })
/**
 * The stair's underside: pale rose plaster that takes the light the sphere and the treads below
 * throw back up (a faint warm self-glow), so seen from the well's floor the spiral reads as one
 * clean ribbon climbing to the sky, never a black cut-out against the terraces.
 */

export function SpiralStair({ config }: ModelProps) {
  const core = useMaterials()
  const m = useModelMaterials()
  const tier = useMuseum((s) => s.tier)
  const r0 = Math.max(0.5, num(config, 'r0', 4.6))
  const r1 = Math.max(r0 + 0.5, num(config, 'r1', 6.1))
  const turns = Math.max(0.25, Math.min(4, num(config, 'turns', 1.25)))
  const rise = Math.max(0.5, num(config, 'rise', 5.4))
  const finish = str(config, 'finish', 'red')
  const seg = Math.round(turns * (tier === 'low' ? 90 : 220))
  const geo = useMemo(() => stairGeometry({ r0, r1, turns, rise, seg }), [r0, r1, turns, rise, seg])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  // the plastered soffit (the plaster maps, so the underside has a hand-floated grain, never a flat
  // tan plane), a faint warm self-glow from the light the treads and the sphere throw back up
  const soffitMat = useMemo(() => tinted(m.terracotta, '#cf9a88', { roughness: 0.96, emissive: new THREE.Color('#7a3a28'), emissiveIntensity: 0.22 }), [m.terracotta])
  const nosingMat = useMemo(() => tinted(m.terracotta, '#6e3426', { roughness: 0.7, side: THREE.DoubleSide }), [m.terracotta])
  const bodyMat = finish === 'terracotta' ? core.clayTerracotta : finish === 'rose' ? core.clayRose : core.redLime
  return (
    <group name="spiral-stair">
      <mesh geometry={geo.body} material={bodyMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.soffit} material={soffitMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.treads} material={m.terracotta} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.nosing} material={nosingMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.rail} material={core.brass} castShadow raycast={noRaycast} />
      <mesh geometry={geo.glow} material={glowMat} raycast={noRaycast} />
    </group>
  )
}
