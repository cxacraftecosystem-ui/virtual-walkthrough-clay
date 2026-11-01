/**
 * 'round-table' — the fluted round table under the Earth Room's skylight (PDF p05 "round table
 * under an oculus"; GRAND §3 #28, §6.5 "a sky beam onto the fluted round table").
 *
 *   top       a disc of radius `r`, 8 cm thick, its edge eased in a soft round-over
 *   drum      a fluted pedestal (0.72 r), `flutes` concave scallops running floor to top, on a
 *             recessed foot ring; a dark shadow reveal under the top lets it float
 *   finish    timber (warm oiled top, clay-plastered drum) or clay (burnished terracotta)
 *
 * Origin: floor centre. Draw calls: 3 (top, drum, reveal).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeAll } from '../architecture/shellGeometry'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

const noRaycast = () => null

/** A fluted drum: radius rb with `n` concave flutes, from y0 to y1, metre uvs. */
function flutedDrum(rb: number, n: number, y0: number, y1: number, seg: number, rows: number): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const depth = n > 0 ? Math.min(0.035, (Math.PI * rb) / n / 3) : 0
  const rad = (a: number) => (n > 0 ? rb - depth * Math.pow(Math.abs(Math.sin((a * n) / 2)), 0.6) : rb)
  for (let j = 0; j <= rows; j++) {
    const y = y0 + ((y1 - y0) * j) / rows
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const r = rad(a)
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r)
      uv.push((i / seg) * Math.PI * 2 * rb, y)
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i
      const b = a + seg + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // the seam column: average its two copies' normals
  const nor = g.getAttribute('normal') as THREE.BufferAttribute
  for (let j = 0; j <= rows; j++) {
    const p0 = j * (seg + 1)
    const p1 = p0 + seg
    const v = new THREE.Vector3(nor.getX(p0) + nor.getX(p1), nor.getY(p0) + nor.getY(p1), nor.getZ(p0) + nor.getZ(p1)).normalize()
    nor.setXYZ(p0, v.x, v.y, v.z)
    nor.setXYZ(p1, v.x, v.y, v.z)
  }
  return g
}

/** A lathe whose uvs are metres (u round the circumference at radius r, v up the profile). */
function lathe(profile: [number, number][], seg: number) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)),
    seg,
  )
  const p = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    uv.setXY(i, x, z)
  }
  return g
}

export function RoundTable({ config }: ModelProps) {
  const core = useMaterials()
  const m = useModelMaterials()
  const tier = useMuseum((s) => s.tier)
  const r = Math.max(0.3, num(config, 'r', 1.2))
  const H = Math.max(0.3, num(config, 'height', config.height ?? 0.9))
  const flutes = Math.round(Math.max(0, Math.min(128, num(config, 'flutes', 48))))
  const finish = str(config, 'finish', 'timber')
  const seg = tier === 'low' ? Math.max(48, flutes * 2) : Math.max(96, flutes * 6)

  const geo = useMemo(() => {
    const t = 0.08
    const rb = r * 0.72
    const reveal = 0.05
    const foot = 0.06
    const eased = 0.03
    const top = lathe(
      [
        [0, H - t],
        [r - eased, H - t],
        [r - eased * 0.3, H - t + eased * 0.3],
        [r, H - t + eased],
        [r, H - eased],
        [r - eased * 0.3, H - eased * 0.3],
        [r - eased, H],
        [0, H],
      ],
      Math.max(64, Math.round(seg / 2)),
    )
    const drum = flutedDrum(rb, flutes, foot, H - t - reveal, seg, 1)
    // the drum's cap under the reveal and the foot ring, set back into shadow
    const ds = Math.max(48, Math.round(seg / 3))
    const dark = mergeAll([
      lathe(
        [
          [0, 0.002],
          [rb - 0.04, 0.002],
          [rb - 0.04, foot],
          [rb, foot],
        ],
        ds,
      ),
      lathe(
        [
          [rb, H - t - reveal],
          [rb * 0.86, H - t - reveal],
          [rb * 0.86, H - t],
          [0, H - t],
        ],
        ds,
      ),
    ])!
    return { top, drum, dark }
  }, [r, H, flutes, seg])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const topMat = finish === 'clay' ? core.clayTerracotta : m.teak
  const drumMat = finish === 'clay' ? core.clayTerracotta : core.clayBlush
  return (
    <group name="round-table">
      <mesh geometry={geo.top} material={topMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.drum} material={drumMat} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.dark} material={core.shadowGap} receiveShadow raycast={noRaycast} />
    </group>
  )
}
