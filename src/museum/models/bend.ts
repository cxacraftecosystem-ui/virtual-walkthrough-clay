/**
 * BEND — wrap flat geometry onto a curved wall face (SPECTACLE F6, F16, F20).
 *
 * Geometry is authored flat in a wall frame: x along the wall (to the right of a visitor facing
 * it), y up, z out of the face towards the visitor, x = 0 at `aMidDeg`. `bendToCylinder` maps
 * it onto the cylinder of radius `r` about (cx, cz):
 *
 *   concave  (the inside of a ring, seen from the centre): +x runs towards increasing plan
 *            angle, +z moves towards the centre (radius r − z)
 *   convex   (the outside, seen from beyond it): +x runs towards decreasing plan angle, +z
 *            moves away from the centre (radius r + z)
 *
 * Arc length is preserved along x (the angle advances x / r), so textures keep their metres.
 * Normals are rotated with each vertex; an existing `tangent` attribute is recomputed when the
 * geometry is indexed and has uvs (normal-mapped relief keeps its lighting after bending).
 */
import * as THREE from 'three'
import { DEG } from '../config/museum'

export interface BendSpec {
  r: number
  aMidDeg: number
  concave: boolean
  cx?: number
  cz?: number
}

/** Bend `geo` in place (and return it). Subdivide long flat runs first: only vertices move. */
export function bendToCylinder<G extends THREE.BufferGeometry>(geo: G, s: BendSpec): G {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined
  const cx = s.cx ?? 0
  const cz = s.cz ?? 0
  const sense = s.concave ? 1 : -1
  const a0 = s.aMidDeg * DEG
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = a0 + (sense * x) / s.r
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const rr = s.r - sense * z
    pos.setXYZ(i, cx + rr * ca, y, cz + rr * sa)
    if (nor) {
      // local frame at this angle: right, up, towards the viewer
      const rx = -sa * sense
      const rz = ca * sense
      const tx = -ca * sense
      const tz = -sa * sense
      const nx = nor.getX(i)
      const ny = nor.getY(i)
      const nz = nor.getZ(i)
      nor.setXYZ(i, nx * rx + nz * tx, ny, nx * rz + nz * tz)
    }
  }
  pos.needsUpdate = true
  if (nor) nor.needsUpdate = true
  if (geo.getAttribute('tangent') && geo.index && geo.getAttribute('uv')) geo.computeTangents()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * A flat grid in the wall frame (x ∈ [x0, x1], y ∈ [y0, y1], z = 0 facing +z), segmented so it
 * bends smoothly: about one column per `step` metres. UVs: u = x / uScale, v = y / vScale
 * (metres by default), or 0 … 1 across the panel with `unit`.
 */
export function wallGrid(x0: number, x1: number, y0: number, y1: number, step = 0.12, opts: { unit?: boolean; rows?: number } = {}): THREE.BufferGeometry {
  const cols = Math.max(1, Math.ceil((x1 - x0) / step))
  const rows = Math.max(1, opts.rows ?? 1)
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, cols, rows)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0)
  if (!opts.unit) {
    const p = g.getAttribute('position')
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getY(i))
  }
  return g
}
