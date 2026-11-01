/**
 * 'lantern-canopy' — the Haat's hanging lanterns (F26): pierced terracotta lanterns on cords
 * under the lattice roof, in `rows` arcs round the drum centre across the room, at different
 * heights about `y`. Each lantern's piercings glow (an emissive dot pattern on the thrown body,
 * so the light seems to come through the holes); brighter at dusk and night.
 *
 * One instanced mesh for the bodies and one line set for the cords: two draw calls for the lot.
 * The tier caps the count (QUALITY_PRESETS[tier].spectacle.lanterns). The room is the one the
 * object stands in (its zone): the arcs span that room's walls.
 *
 * Local space: origin at the object's position; lanterns are laid out in world plan
 * coordinates (round the drum centre) and placed back into the object's frame.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG } from '../config/museum'
import { SAT_WALL, SATELLITES } from '../config/satellites'
import { ambience } from '../lighting/timeOfDayState'
import { useSpectacle } from '../spectacle/settings'
import { lathe, rng } from './kit'
import { useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

let dotTex: THREE.CanvasTexture | null = null
/** Piercings: rows of small round holes and lozenges (white = glowing hole). */
function piercedTexture() {
  if (dotTex) return dotTex
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = '#fff'
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const x = (c + (r % 2 ? 0.5 : 0) + 0.25) * (S / 4)
      const y = (r + 0.5) * (S / 4)
      ctx.beginPath()
      if (r % 2) {
        ctx.moveTo(x, y - S * 0.06)
        ctx.lineTo(x + S * 0.035, y)
        ctx.lineTo(x, y + S * 0.06)
        ctx.lineTo(x - S * 0.035, y)
        ctx.closePath()
      } else ctx.arc(x, y, S * 0.03, 0, Math.PI * 2)
      ctx.fill()
    }
  dotTex = new THREE.CanvasTexture(cv)
  dotTex.wrapS = dotTex.wrapT = THREE.RepeatWrapping
  dotTex.repeat.set(1 / 0.08, 1 / 0.08)
  dotTex.colorSpace = THREE.SRGBColorSpace
  return dotTex
}

/** A lantern, about 0.36 m tall: a pot-bellied pierced body, a lid and a ring at the top. */
function lanternGeometry() {
  return lathe(
    [
      [0, -0.2],
      [0.03, -0.2],
      [0.06, -0.17],
      [0.11, -0.1],
      [0.13, -0.02],
      [0.12, 0.05],
      [0.08, 0.09],
      [0.05, 0.1],
      [0.06, 0.12],
      [0.03, 0.15],
      [0.012, 0.16],
      [0, 0.16],
    ],
    24,
  )
}

let haloTex: THREE.Texture | null = null
/** A warm radial glow (shared by every canopy). */
function haloTexture(): THREE.Texture | null {
  if (haloTex || typeof document === 'undefined') return haloTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  haloTex = new THREE.CanvasTexture(c)
  haloTex.colorSpace = THREE.SRGBColorSpace
  return haloTex
}

export function LanternCanopy({ config }: ModelProps) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const want = Math.max(0, Math.round(num(config, 'count', 30)))
  const count = Math.min(want, sp.caps.lanterns)
  const rows = Math.max(1, Math.round(num(config, 'rows', 3)))
  const y = num(config, 'y', 3.4)
  const color = str(config, 'color', '#ffb066')
  // the room the canopy hangs in (its zone), or the satellite nearest its position
  const room = useMemo(() => {
    const a = Math.atan2(config.position[2], config.position[0]) / DEG
    return SATELLITES.find((s) => s.id === config.zone) ?? SATELLITES.reduce((b, s) => (Math.abs((s.fromDeg + s.toDeg) / 2 - a) < Math.abs((b.fromDeg + b.toDeg) / 2 - a) ? s : b))
  }, [config.position, config.zone])
  const ceiling = room.height

  const layout = useMemo(() => {
    const r = rng(`${config.id}|lanterns`)
    const rot = ((config.rotationDeg ?? 0) * Math.PI) / 180
    const [px, , pz] = config.position
    const toLocal = (wx: number, wz: number) => {
      const dx = wx - px
      const dz = wz - pz
      return [dx * Math.cos(rot) - dz * Math.sin(rot), dx * Math.sin(rot) + dz * Math.cos(rot)] as [number, number]
    }
    const r0 = SAT_WALL.innerFace + 0.8
    const r1 = SAT_WALL.outerFace - 0.8
    const a0 = room.fromDeg + 2.2
    const a1 = room.toDeg - 2.2
    const out: { x: number; y: number; z: number; s: number }[] = []
    // lanterns per row in proportion to the row's length
    const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? (r0 + r1) / 2 : r0 + ((r1 - r0) * i) / (rows - 1)))
    const total = radii.reduce((s, rr) => s + rr, 0)
    let left = count
    radii.forEach((rr, i) => {
      const n = i === rows - 1 ? left : Math.round((count * rr) / total)
      left -= n
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5 + (r() - 0.5) * 0.4) / n
        const a = (a0 + (a1 - a0) * t + (i % 2 ? 0.8 : 0)) * DEG
        const [lx, lz] = toLocal(rr * Math.cos(a), rr * Math.sin(a))
        out.push({ x: lx, y: y + (r() - 0.5) * 0.55, z: lz, s: 0.85 + r() * 0.35 })
      }
    })
    return out
  }, [config.id, config.position, config.rotationDeg, count, rows, y, room])

  const geo = useMemo(lanternGeometry, [])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(() => {
    const base = m.terracotta as THREE.MeshStandardMaterial
    const mm = new THREE.MeshStandardMaterial({ name: 'lanternBody', map: base.map, normalMap: base.normalMap, color: new THREE.Color('#b8653f'), roughness: 0.85, emissive: new THREE.Color(color), emissiveMap: piercedTexture(), emissiveIntensity: 1.2, envMapIntensity: 0.5 })
    return mm
  }, [m.terracotta, color])
  useEffect(() => () => mat.dispose(), [mat])
  // a soft halo round every lantern (one additive point each), and brighter piercings, as the
  // light goes: by night the Haat is lit by its lanterns
  const halo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(layout.flatMap((l) => [l.x, l.y, l.z]), 3))
    const pm = new THREE.PointsMaterial({ name: 'lanternHalo', map: haloTexture(), color: new THREE.Color(color), size: 0.95, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    return { g, pm }
  }, [layout, color])
  useEffect(
    () => () => {
      halo.g.dispose()
      halo.pm.dispose()
    },
    [halo],
  )
  useFrame(() => {
    const dark = Math.max(ambience.night, ambience.twilight * 0.7)
    mat.emissiveIntensity = 1.1 + 4.2 * ambience.night + 1.2 * ambience.twilight
    halo.pm.opacity = 0.06 + 0.5 * dark
  })

  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const mx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    layout.forEach((l, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7)
      mx.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(l.s, l.s, l.s))
      im.setMatrixAt(i, mx)
    })
    im.count = layout.length
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [layout])

  const cords = useMemo(() => {
    const pts: number[] = []
    for (const l of layout) pts.push(l.x, l.y + 0.16 * l.s, l.z, l.x, ceiling - 0.01, l.z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [layout, ceiling])
  useEffect(() => () => cords.dispose(), [cords])
  const cordMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#3a2a20' }), [])
  useEffect(() => () => cordMat.dispose(), [cordMat])

  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, Math.max(1, want)]} castShadow={false} receiveShadow={false} raycast={() => null} />
      <lineSegments geometry={cords} material={cordMat} raycast={() => null} />
      <points geometry={halo.g} material={halo.pm} renderOrder={4} raycast={() => null} />
    </group>
  )
}
