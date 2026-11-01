/**
 * 'wine-plinth' — a stepped plinth in wine-red lacquered clay for the Wine Hall, "Clay Elsewhere"
 * (PDF p08l: deep wine walls, plinths and busts, track light, a timber floor; GRAND §3 #37).
 *
 *   steps     `steps` treads rising to the back, `width` × `depth`, `height` at the back; the
 *             pieces stand on the treads (`winePlinthTops` gives their heights and depths)
 *   rail      a brass label rail in front on two slender posts, tilted 15°, its top at 0.95 m
 *             (the label text is drawn by the label system from each piece's record)
 *   vitrine   a low-iron glass hood over the treads with a fine bronze frame
 *
 * Origin: floor centre of the plinth's footprint; front faces +z; the rail stands 0.16 m in
 * front of it (the scene object's footprint should include it). Draw calls: ≤ 4.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { useMaterials } from '../materials/materials'
import { Builder, box, rbox } from './kit'
import { num, type ModelProps } from './types'

const noRaycast = () => null

/** Label rail: top height, tilt and its distance in front of the plinth. */
export const LABEL_RAIL = { top: 0.95, tiltDeg: 15, depth: 0.11, offset: 0.16 }

/** Each tread's top: height and the depth (local z) of its middle, front tread first. */
export function winePlinthTops(steps: number, depth: number, height: number): { y: number; z: number }[] {
  const n = Math.max(1, Math.round(steps))
  return Array.from({ length: n }, (_, k) => ({ y: (height * (k + 1)) / n, z: depth / 2 - (depth / n) * (k + 0.5) }))
}

/** Low-iron glass: clear, a whisper of tint, reflections strongest at grazing angles (never amber). */
let clearGlass: THREE.MeshPhysicalMaterial | null = null
const glassMat = () =>
  (clearGlass ??= new THREE.MeshPhysicalMaterial({ name: 'vitrineGlass', color: '#ffffff', transparent: true, opacity: 0.035, roughness: 0.02, metalness: 0, ior: 1.5, specularIntensity: 0.6, envMapIntensity: 0.55, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }))

let wineMat: THREE.MeshStandardMaterial | null = null
const wine = (src: THREE.Material) => {
  if (!wineMat) {
    const s = src as THREE.MeshStandardMaterial
    wineMat = new THREE.MeshStandardMaterial({ name: 'wineLacquer', color: '#5c1b25', normalMap: s.normalMap, normalScale: new THREE.Vector2(0.15, 0.15), roughness: 0.46, metalness: 0, envMapIntensity: 0.85 })
    injectAtmosphere(wineMat)
  }
  return wineMat
}

export function WinePlinth({ config }: ModelProps) {
  const core = useMaterials()
  const steps = Math.round(Math.max(1, Math.min(6, num(config, 'steps', 3))))
  const W = Math.max(0.3, num(config, 'width', 2.4))
  const D = Math.max(0.3, num(config, 'depth', 0.9))
  const H = Math.max(0.2, num(config, 'height', 1.1))
  const vitrine = config.props?.vitrine === true || config.props?.vitrine === 'true'

  const parts = useMemo(() => {
    const b = new Builder()
    const gap = 0.03
    const tops = winePlinthTops(steps, D, H)
    const sd = D / steps
    tops.forEach((t, k) => {
      const y0 = gap
      b.add('body', rbox(W, t.y - y0, sd + (k < steps - 1 ? 0.01 : 0), 0.008, 2, 'x'), { p: [0, (t.y + y0) / 2, t.z - (k < steps - 1 ? 0.005 : 0)] })
    })
    // shadow reveal under the whole footprint
    b.add('gap', box(W - 0.05, gap, D - 0.05), { p: [0, gap / 2, 0] })
    // label rail: two posts and a tilted brass plate, centred in front
    const R = LABEL_RAIL
    const rw = Math.min(0.9, W * 0.6)
    const tilt = (R.tiltDeg * Math.PI) / 180
    const zr = D / 2 + R.offset
    const plateY = R.top - (R.depth / 2) * Math.sin(tilt)
    for (const sx of [-1, 1]) b.add('brass', box(0.018, plateY - 0.01, 0.018), { p: [sx * (rw / 2 - 0.06), (plateY - 0.01) / 2, zr] })
    b.add('brass', box(rw, 0.008, R.depth), { p: [0, plateY, zr], r: [tilt, 0, 0] })
    b.add('brass', box(rw * 0.55, 0.012, 0.1), { p: [0, 0.006, zr] })
    if (vitrine) {
      const y0 = tops[0].y
      const y1 = H + 0.55
      const gw = W - 0.04
      const gd = D - 0.04
      const t = 0.004
      b.add('glass', box(gw, y1 - y0, t), { p: [0, (y0 + y1) / 2, gd / 2] })
      b.add('glass', box(gw, y1 - H + 0.02, t), { p: [0, (H - 0.02 + y1) / 2, -gd / 2] })
      for (const sx of [-1, 1]) b.add('glass', box(t, y1 - y0, gd), { p: [(sx * gw) / 2, (y0 + y1) / 2, 0] })
      b.add('glass', box(gw, t, gd), { p: [0, y1, 0] })
      // bronze frame round the hood's top and front feet
      // a fine brass edge, 6 mm
      const f = 0.006
      for (const sz of [-1, 1]) b.add('frame', box(gw + f, f, f), { p: [0, y1, (sz * gd) / 2] })
      for (const sx of [-1, 1]) b.add('frame', box(f, f, gd + f), { p: [(sx * gw) / 2, y1, 0] })
      for (const sx of [-1, 1]) b.add('frame', box(f, y1 - y0, f), { p: [(sx * gw) / 2, (y0 + y1) / 2, gd / 2] })
      b.add('frame', box(gw + f, f, f), { p: [0, y0 + f / 2, gd / 2] })
    }
    return b.build()
  }, [steps, W, D, H, vitrine])
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts])

  const mats: Record<string, THREE.Material> = { body: wine(core.oxbloodLacquer), gap: core.shadowGap, brass: core.brass, glass: glassMat(), frame: core.brass }
  return (
    <group name="wine-plinth">
      {parts.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} material={mats[key]} castShadow={key === 'body' || key === 'brass'} receiveShadow={key !== 'glass'} renderOrder={key === 'glass' ? 2 : 0} raycast={noRaycast} />
      ))}
    </group>
  )
}
