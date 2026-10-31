/**
 * RAW CLAY PATCHES (PDF p05: "highlighting the raw clay texture patches gives a true essence
 * of the raw materials"). A few deliberate, organic islands of coarse, cracked raw clay laid
 * proud of the smooth trowelled walls — where no work hangs: the entry ways either side of
 * the annex mouth, the ends of the inner main wall F, the back of the description wall H,
 * and the quiet stretches of the ring wall in galleries B and C.
 *
 * Each patch is a curved strip following its wall, cut to an irregular outline by an alpha
 * mask (alphaTest: crisp edges, no sorting), 8 mm off the face with a polygon offset. The
 * outline mask is drawn once; patches vary it by flipping and by their own proportions.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, MUSEUM } from '../config/museum'
import { useMaterials } from '../materials/materials'
import { mulberry32 } from '../materials/noise'
import { ZoneGroup } from '../navigation/zoneCulling'
import type { ZoneId } from '../config/layout'
import { cylinderFace, mergeAll } from './shellGeometry'

interface Patch {
  /** Face radius of the host wall and which side of it the patch is on. */
  r: number
  side: 'in' | 'out'
  aDeg: number
  /** Centre height, width (m along the wall) and height. */
  y: number
  w: number
  h: number
  /** Mask variant: flip u / v. */
  flipU?: boolean
  flipV?: boolean
  tone: 'rose' | 'red'
}

const D = MUSEUM.drum
const FW = MUSEUM.innerMainWall
const HW = MUSEUM.descriptionWall
const OFF = 0.008

/** The patches, by zone (for culling). */
const PATCHES: { zones: ZoneId[]; list: Patch[] }[] = [
  {
    zones: ['entry-e', 'annex', 'inner', 'hallway-d'],
    list: [
      // entry ways: the lobe either side of the annex mouth
      { r: D.r - OFF, side: 'in', aDeg: 57, y: 1.75, w: 1.5, h: 2.3, tone: 'rose' },
      { r: D.r - OFF, side: 'in', aDeg: 126, y: 1.7, w: 1.3, h: 2.3, flipU: true, tone: 'rose' },
      // F's entry face, near both ends
      { r: FW.r + FW.thickness / 2 + OFF, side: 'out', aDeg: 41, y: 1.6, w: 1.0, h: 2.2, tone: 'red' },
      { r: FW.r + FW.thickness / 2 + OFF, side: 'out', aDeg: 139, y: 2.2, w: 1.1, h: 2.4, flipV: true, tone: 'red' },
      // H's back face, towards F
      { r: HW.r - HW.thickness / 2 - OFF, side: 'in', aDeg: 112, y: 1.5, w: 1.2, h: 1.9, flipU: true, flipV: true, tone: 'rose' },
    ],
  },
  {
    zones: ['ring-b', 'ring-a', 'ring-c', 'inner'],
    list: [
      // gallery B's first stretch of ring wall (b-outer-1, nothing hung)
      { r: D.ringR - OFF, side: 'in', aDeg: -31, y: 1.75, w: 1.2, h: 2.2, tone: 'rose' },
      // gallery C's ring wall (c-outer)
      { r: D.ringR - OFF, side: 'in', aDeg: 247, y: 1.75, w: 1.4, h: 2.2, flipV: true, tone: 'rose' },
    ],
  },
]

/** Organic outline mask (white = patch): a wobbly blob with a few flakes split off it. */
function maskTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, S, S)
  const rnd = mulberry32(5150)
  const blob = (cx: number, cy: number, r: number, wob: number) => {
    const harm = Array.from({ length: 6 }, (_, k) => ({ a: (wob / (k + 1)) * (0.5 + rnd()), p: rnd() * Math.PI * 2 }))
    ctx.beginPath()
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2
      let rr = 1
      harm.forEach((h, k) => (rr += h.a * Math.sin((k + 2) * t + h.p)))
      rr += (rnd() - 0.5) * wob * 0.15
      const x = cx + Math.cos(t) * r * rr
      const y = cy + Math.sin(t) * r * rr
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#fff'
  blob(S * 0.5, S * 0.5, S * 0.36, 0.32)
  // flakes at the edge
  for (let i = 0; i < 9; i++) {
    const t = rnd() * Math.PI * 2
    const d = S * (0.4 + rnd() * 0.06)
    blob(S * 0.5 + Math.cos(t) * d, S * 0.5 + Math.sin(t) * d, S * (0.015 + rnd() * 0.03), 0.4)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.name = 'raw-clay-mask'
  tex.colorSpace = THREE.NoColorSpace
  tex.channel = 1
  tex.needsUpdate = true
  return tex
}

/** One patch: a curved strip with metre UVs (uv) and a 0..1 mask UV (uv1). */
function patchGeometry(p: Patch) {
  const half = p.w / 2 / p.r
  const a = p.aDeg * DEG
  const y0 = p.y - p.h / 2
  const y1 = p.y + p.h / 2
  const g = cylinderFace(0, 0, p.r, a - half, a + half, y0, y1, p.side)
  if (!g) return null
  const pos = g.getAttribute('position')
  const uv1 = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const t = Math.atan2(pos.getZ(i), pos.getX(i))
    let da = t - (a - half)
    da -= Math.floor(da / (Math.PI * 2)) * Math.PI * 2
    // u runs left → right for a viewer facing the patch
    let u = da / (2 * half)
    if (p.side === 'out') u = 1 - u
    let v = (pos.getY(i) - y0) / (y1 - y0)
    if (p.flipU) u = 1 - u
    if (p.flipV) v = 1 - v
    uv1[i * 2] = u
    uv1[i * 2 + 1] = v
  }
  g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2))
  return g
}

export function RawClayPatches() {
  const m = useMaterials()
  const mask = useMemo(maskTexture, [])
  const mats = useMemo(() => {
    const base = m.rawClay as THREE.MeshStandardMaterial
    const mk = (name: string, color: string) => {
      const c = base.clone()
      c.name = name
      c.color.set(color)
      c.alphaMap = mask
      c.alphaTest = 0.5
      c.polygonOffset = true
      c.polygonOffsetFactor = -2
      c.polygonOffsetUnits = -2
      c.normalScale.set(2.2, 2.2)
      return c
    }
    // a shade off the host wall: the patch reads by its relief, not as a stain
    return { rose: mk('rawClayRose', '#dfa592'), red: mk('rawClayRed', '#a2493c') }
  }, [m, mask])
  const groups = useMemo(
    () =>
      PATCHES.map((grp) => ({
        zones: grp.zones,
        rose: mergeAll(grp.list.filter((p) => p.tone === 'rose').map(patchGeometry)),
        red: mergeAll(grp.list.filter((p) => p.tone === 'red').map(patchGeometry)),
      })),
    [],
  )
  useEffect(
    () => () => {
      groups.forEach((g) => {
        g.rose?.dispose()
        g.red?.dispose()
      })
      mats.rose.dispose()
      mats.red.dispose()
      mask?.dispose()
    },
    [groups, mats, mask],
  )
  if (!mask) return null
  return (
    <group name="raw-clay-patches">
      {groups.map((g, i) => (
        <ZoneGroup key={i} zones={g.zones}>
          {g.rose && <mesh geometry={g.rose} material={mats.rose} receiveShadow raycast={() => null} />}
          {g.red && <mesh geometry={g.red} material={mats.red} receiveShadow raycast={() => null} />}
        </ZoneGroup>
      ))}
    </group>
  )
}
