/**
 * 'spiral-stair' — the sculptural red clay stair of the Sphere Well (PDF p07r "a spiral stair
 * round a sphere under a stepped oculus"; GRAND §2.7, §6.5).
 *
 *   form      a free-standing helical slab between radii `r0` and `r1` about the origin, making
 *             `turns` turns while it climbs `rise` metres: one continuous smooth soffit underneath,
 *             a solid balustrade rising from its inner edge (towards the sphere) with a rounded
 *             top and a brass handrail, a slim upstand on its outer edge, and tile treads between
 *             them (risers of about 17 cm)
 *   finish    red (the well's deep red lime) or terracotta; the treads are always fired tile
 *
 * Origin: floor centre of the well; the stair starts at plan angle 0 (local +x) on the floor and
 * climbs anticlockwise seen from above. A concealed warm LED line runs under the handrail and
 * along the foot of the upstand. Draw calls: 4 (body, treads, brass, light line).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { useModelMaterials } from './modelMaterials'
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
const UP = { t: 0.08, h: 0.12 }

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
  const ru = s.r1 - UP.t
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
  // outer upstand: inner face, top, outer face down to the soffit
  body.grid(
    ths.map((th) => [P(ru, th, y(th) - 0.02), P(ru, th, y(th) + UP.h), P(s.r1, th, y(th) + UP.h), P(s.r1, th, soff(th))]),
    ths.map((th) => [[th * ru, y(th)], [th * ru, y(th) + UP.h], [th * s.r1, y(th) + UP.h + UP.t], [th * s.r1, soff(th)]]),
    true,
  )
  // end caps (start at the floor, end at the top)
  const capAt = (th: number, flip: boolean) => {
    const yy = y(th)
    const sf = soff(th)
    body.grid(
      [
        [P(s.r0, th, sf), P(s.r1, th, sf)],
        [P(s.r0, th, yy + BAL.h), P(s.r1, th, yy + UP.h)],
      ],
      [
        [[s.r0, sf], [s.r1, sf]],
        [[s.r0, yy + BAL.h], [s.r1, yy + UP.h]],
      ],
      flip,
    )
  }
  capAt(0, true)
  capAt(Th, false)

  // treads: a wedge per step, risers of about 17 cm
  const steps = Math.max(3, Math.round(s.rise / 0.17))
  const tr = new Strip()
  for (let k = 0; k < steps; k++) {
    const a0 = (Th * k) / steps
    const a1 = (Th * (k + 1)) / steps
    const top = (s.rise * (k + 1)) / steps
    const bot = (s.rise * k) / steps
    const sub = 6
    const as = Array.from({ length: sub + 1 }, (_, i) => a0 + ((a1 - a0) * i) / sub)
    // the tread's top
    tr.grid(
      as.map((a) => [P(rb, a, top), P(ru, a, top)]),
      as.map((a) => [[a * rb, rb], [a * rb, ru]]),
      true,
    )
    // the riser at the step's front (a0)
    tr.grid(
      [
        [P(rb, a0, bot), P(ru, a0, bot)],
        [P(rb, a0, top), P(ru, a0, top)],
      ],
      [
        [[rb, bot], [ru, bot]],
        [[rb, top], [ru, top]],
      ],
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
  glow.grid(
    ths.map((th) => [P(ru - 0.004, th, y(th) + 0.035), P(ru - 0.004, th, y(th) + 0.035 + gH * 0.6)]),
    ths.map((th) => [[th * ru, 0], [th * ru, 1]]),
    true,
  )
  return { body: body.build(), soffit: under.build(), treads: tr.build(), rail: hr.build(), glow: glow.build() }
}

/** The LED line: unlit, past white so the bloom picks it up; dimmer by day than at night. */
const glowMat = new THREE.MeshBasicMaterial({ name: 'stairGlow', color: new THREE.Color('#ffb46a').multiplyScalar(2.4), toneMapped: false, side: THREE.DoubleSide })
/**
 * The stair's underside: pale rose plaster that takes the light the sphere and the treads below
 * throw back up (a faint warm self-glow), so seen from the well's floor the spiral reads as one
 * clean ribbon climbing to the sky, never a black cut-out against the terraces.
 */
const soffitMat = new THREE.MeshStandardMaterial({ name: 'stairSoffit', color: '#d99a84', emissive: new THREE.Color('#ff9f78'), emissiveIntensity: 0.22, roughness: 0.92 })

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
  const bodyMat = finish === 'terracotta' ? core.clayTerracotta : core.redLime
  return (
    <group name="spiral-stair">
      <mesh geometry={geo.body} material={bodyMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.soffit} material={soffitMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.treads} material={m.terracotta} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.rail} material={core.brass} castShadow raycast={noRaycast} />
      <mesh geometry={geo.glow} material={glowMat} raycast={noRaycast} />
    </group>
  )
}
