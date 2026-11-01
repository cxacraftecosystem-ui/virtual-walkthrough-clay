/**
 * 'round-plinth' — a tiered round plinth in lacquered clay (PDF p09r "a central round plinth";
 * GRAND §2.7): the Red Room's two-tier plinth under its oculus, and the low plinths the horses
 * stand on in the Parikrama's gardens.
 *
 *   tiers     `tiers` drums, each `h` tall, stepping in from radius `r` (the top tier is about
 *             two thirds of the bottom one), so the lower tiers leave a ring to dress (flowers)
 *   finish    lacquer in `color` (low sheen), a thin brass line round each tier's top edge and a
 *             dark shadow reveal at the floor; a stepped plinth (2+ tiers) floats each tier on a
 *             concealed warm line of light
 *
 * Origin: floor centre; the top of the top tier is at tiers × h. Draw calls: 3 (4 when tiered).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeAll } from '../architecture/shellGeometry'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { num, str, type ModelProps } from './types'

const noRaycast = () => null

/** Radius of tier k of n (0 = the bottom) for a bottom radius r. */
export function tierRadius(r: number, k: number, n: number) {
  return n <= 1 ? r : r * (1 - (0.34 * k) / (n - 1))
}

function lathe(profile: [number, number][], seg: number) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)),
    seg,
  )
  const p = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < p.count; i++) uv.setXY(i, Math.atan2(p.getZ(i), p.getX(i)) * Math.hypot(p.getX(i), p.getZ(i)), p.getY(i))
  return g
}

const lacquerCache = new Map<string, THREE.MeshStandardMaterial>()
/** The tiers' light line: unlit and past white, so the bloom gives it a soft halo. */
const tierGlow = new THREE.MeshBasicMaterial({ name: 'plinthGlow', color: new THREE.Color('#ffb36b').multiplyScalar(2.2), toneMapped: false })

export function RoundPlinth({ config }: ModelProps) {
  const core = useMaterials()
  const tier = useMuseum((s) => s.tier)
  const n = Math.round(Math.max(1, Math.min(5, num(config, 'tiers', 2))))
  const r = Math.max(0.2, num(config, 'r', 1.4))
  const h = Math.max(0.05, num(config, 'h', 0.6))
  const color = str(config, 'color', '#7d1a17')
  const rough = num(config, 'roughness', 0.42)
  const seg = tier === 'low' ? 40 : r > 1 ? 96 : 56

  const geo = useMemo(() => {
    const body: THREE.BufferGeometry[] = []
    const brass: THREE.BufferGeometry[] = []
    const gap = 0.025
    for (let k = 0; k < n; k++) {
      const rk = tierRadius(r, k, n)
      const y0 = k * h + (k === 0 ? gap : 0)
      const y1 = (k + 1) * h
      const e = Math.min(0.012, h / 8)
      // side with an eased top edge, the top annulus (to the next tier, or the whole disc)
      const rNext = k + 1 < n ? tierRadius(r, k + 1, n) : 0
      body.push(lathe([[rk, y0], [rk, y1 - e - 0.006], [rk - e * 0.3, y1 - e * 0.3], [rk - e, y1], [rNext, y1]], seg))
      // the brass line: a 6 mm band just under the eased edge
      brass.push(lathe([[rk + 0.0015, y1 - e - 0.012], [rk + 0.0015, y1 - e - 0.006]], seg))
    }
    const reveal = lathe([[r - 0.03, 0], [r - 0.03, gap], [r, gap]], seg)
    // a concealed warm line at the foot of every tier above the first (and in the floor reveal):
    // each tier floats on a thread of light, so the drum reads as stepped even in a red room
    // (single drums, like the garden horses' plinths, keep their plain shadow reveal)
    const glow: THREE.BufferGeometry[] = n > 1 ? [lathe([[r - 0.028, gap * 0.35], [r - 0.028, gap * 0.85]], seg)] : []
    for (let k = 1; k < n; k++) {
      const rk = tierRadius(r, k, n)
      glow.push(lathe([[rk + 0.003, k * h + 0.004], [rk + 0.003, k * h + 0.014]], seg))
    }
    return { body: mergeAll(body)!, brass: mergeAll(brass)!, reveal, glow: mergeAll(glow) }
  }, [n, r, h, seg])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])

  const src = core.oxbloodLacquer as THREE.MeshStandardMaterial
  const lacquer = useMemo(() => {
    const k = `${src.uuid}|${color}|${rough}`
    let mat = lacquerCache.get(k)
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ name: 'plinthLacquer', color: new THREE.Color(color), normalMap: src.normalMap, normalScale: new THREE.Vector2(0.12, 0.12), roughness: rough, metalness: 0, envMapIntensity: rough > 0.6 ? 0.45 : 0.9 })
      injectAtmosphere(mat)
      lacquerCache.set(k, mat)
    }
    return mat
  }, [src, color, rough])

  return (
    <group name="round-plinth">
      <mesh geometry={geo.body} material={lacquer} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.brass} material={core.brass} raycast={noRaycast} />
      <mesh geometry={geo.reveal} material={core.shadowGap} raycast={noRaycast} />
      {geo.glow && <mesh geometry={geo.glow} material={tierGlow} raycast={noRaycast} />}
    </group>
  )
}
