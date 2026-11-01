/**
 * 'coil-pot' — a pot built the Andro way, from coils of clay laid one on another without a
 * wheel (GRAND §4.2, §4.3; CRAFTS D8), shown cut open: a quarter of the wall is taken away so the
 * coils stand in section, their ridges visible on the inside where the potter has not smoothed
 * them, while the outside is beaten smooth and burnished.
 *
 *   props {coils = 18, cutaway = true}
 *
 * Height from the object's height (default 0.5), radius from the footprint. Origin at the foot,
 * the open quarter faces +z. It is the Red Room's centrepiece ("object of the month").
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, Parts, type BuiltParts } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { fp, num, type ModelProps } from './types'

/** The pot's outside radius at height fraction v (a wide-shouldered storage pot with a rolled rim). */
function outsideR(v: number): number {
  const pts: [number, number][] = [
    [0, 0.42],
    [0.08, 0.66],
    [0.3, 0.92],
    [0.48, 1],
    [0.66, 0.94],
    [0.82, 0.72],
    [0.9, 0.58],
    [0.95, 0.6],
    [1, 0.66],
  ]
  for (let i = 1; i < pts.length; i++)
    if (v <= pts[i][0]) {
      const [v0, r0] = pts[i - 1]
      const [v1, r1] = pts[i]
      const t = (v - v0) / (v1 - v0)
      return r0 + (r1 - r0) * (t * t * (3 - 2 * t))
    }
  return pts[pts.length - 1][1]
}

const cache = new Map<string, BuiltParts>()

function build(R: number, H: number, coils: number, cut: boolean): BuiltParts {
  const b = new Builder()
  const wall = Math.max(0.008, R * 0.075)
  // the open quarter, centred on +z (lathe angle 0 lies on +z)
  const gap = cut ? Math.PI / 2 : 0
  const phi0 = gap / 2
  const phiLen = Math.PI * 2 - gap
  const N = 28
  const prof: [number, number][] = []
  for (let i = 0; i <= N; i++) prof.push([outsideR(i / N) * R, (i / N) * H])
  // the beaten, burnished outside
  b.add('skin', new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48, phi0, phiLen))
  // the inside: one torus per coil, so the ridges show; squashed a little where they were pressed
  const pitch = H / coils
  for (let i = 0; i < coils; i++) {
    const v = (i + 0.5) / coils
    // each coil overlaps its neighbours (no dark gaps between them: paddled, not striped), and
    // stays inside the beaten skin
    const tube = Math.max(wall * 0.55, pitch * 0.62)
    const r = outsideR(v) * R - tube - 0.002
    const t = new THREE.TorusGeometry(r, tube, 8, 48, phiLen)
    t.scale(1, 1, 0.82)
    t.rotateX(Math.PI / 2)
    // a torus arc runs from +x; turn it so its opening matches the skin's (around +z)
    t.rotateY(-Math.PI / 2 - phi0)
    b.add('coil', t, { p: [0, v * H, 0], s: [1, pitch / (wall * 1.1) > 1 ? 1 : pitch / (wall * 1.1), 1] })
  }
  // a base slab inside, and the rim coil
  b.add('coil', new THREE.CylinderGeometry(outsideR(0.02) * R - wall, outsideR(0) * R - wall, wall, 32, 1, false, phi0, phiLen), { p: [0, wall / 2, 0] })
  const rim = new THREE.TorusGeometry(outsideR(1) * R - wall * 0.2, wall * 0.75, 8, 48, phiLen)
  rim.rotateX(Math.PI / 2)
  rim.rotateY(-Math.PI / 2 - phi0)
  b.add('skin', rim, { p: [0, H, 0] })
  if (cut) {
    // the two cut faces: the wall in section, a scalloped inner edge where the coils meet
    for (const a of [phi0, phi0 + phiLen]) {
      const s = new THREE.Shape()
      s.moveTo(0, 0)
      for (let i = 0; i <= N; i++) s.lineTo(outsideR(i / N) * R, (i / N) * H)
      for (let i = coils - 1; i >= 0; i--) {
        const v = (i + 0.5) / coils
        const r = outsideR(v) * R - wall
        s.lineTo(r - wall * 0.15, (v + 0.5 / coils) * H)
        s.lineTo(r + wall * 0.05, v * H)
      }
      s.lineTo(0, wall)
      s.closePath()
      const g = new THREE.ShapeGeometry(s, 4)
      // shape plane (x = radius, y = height) turned onto the lathe angle a
      g.rotateY(a - Math.PI / 2)
      b.add('section', g)
    }
  }
  return b.build()
}

export function CoilPot({ config }: ModelProps) {
  const m = useModelMaterials()
  const H = config.height ?? 0.5
  const [fx, fz] = fp(config, [H * 0.9, H * 0.9])
  const R = Math.min(fx, fz) / 2
  const coils = Math.max(4, Math.min(60, Math.round(num(config, 'coils', 18))))
  const cut = config.props?.cutaway !== false
  const parts = useMemo(() => {
    const key = `${R.toFixed(3)}|${H.toFixed(3)}|${coils}|${cut}`
    let hit = cache.get(key)
    if (!hit) cache.set(key, (hit = build(R, H, coils, cut)))
    return hit
  }, [R, H, coils, cut])
  const mats = useMemo(
    () => ({
      // burnished outside, rougher coils, the raw section a lighter, unburnt core
      // (the coils only a shade from the skin: they read in their shadows, never as stripes)
      skin: tinted(m.terracotta, '#5a3626', { roughness: 0.34, envMapIntensity: 1.1, side: THREE.DoubleSide }),
      coil: tinted(m.terracotta, '#5e3a29', { roughness: 0.8, side: THREE.DoubleSide }),
      section: tinted(m.terracotta, '#8a5a40', { roughness: 0.97, side: THREE.DoubleSide }),
    }),
    [m],
  )
  return <Parts parts={parts} materials={mats} />
}
