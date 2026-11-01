/**
 * 'photo-spot' — a brass floor marker for a Frames of Clay preset (SPECTACLE F32). Props:
 * models/propSchemas.ts {yawDeg, pitchDeg, fov, time, weather, caption, dof} (+ optional `cue`).
 *
 * A small brass disc set flush in the floor, engraved with an aperture's six blades. The disc is
 * the standing point of the frame; clicking it (or pressing P nearby) frames the view: pose,
 * field of view, time of day, weather and caption (ui/PhotoMode.tsx `applyFrame`).
 */
import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useMuseum } from '../state/store'
import { applyFrame } from '../ui/PhotoMode'
import { useModelMaterials } from './modelMaterials'
import type { ModelProps } from './types'

const R = 0.2

let engraving: THREE.Texture | null = null
/** Six aperture blades and a ring, as a bump map (cut into the brass). */
function engravingTexture(): THREE.Texture | null {
  if (engraving) return engraving
  if (typeof document === 'undefined') return null
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, N, N)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  const cx = N / 2
  ctx.beginPath()
  ctx.arc(cx, cx, N * 0.43, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cx, N * 0.15, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const b = a + 0.95
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * N * 0.15, cx + Math.sin(a) * N * 0.15)
    ctx.quadraticCurveTo(cx + Math.cos(a + 0.5) * N * 0.36, cx + Math.sin(a + 0.5) * N * 0.36, cx + Math.cos(b) * N * 0.43, cx + Math.sin(b) * N * 0.43)
    ctx.stroke()
  }
  engraving = new THREE.CanvasTexture(c)
  engraving.colorSpace = THREE.NoColorSpace
  engraving.anisotropy = 4
  return engraving
}

export function PhotoSpot({ config }: ModelProps) {
  const m = useModelMaterials()
  const geo = useMemo(() => {
    const disc = new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2)
    const rim = new THREE.RingGeometry(R, R + 0.018, 48).rotateX(-Math.PI / 2)
    return { disc, rim }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const mats = useMemo(() => {
    const base = m.brass as THREE.MeshStandardMaterial
    // drawn just above the floor and pulled forward in depth, so it never fights the paving
    const disc = new THREE.MeshStandardMaterial({
      color: base.color?.clone() ?? new THREE.Color('#b08d57'),
      metalness: 0.85,
      roughness: 0.32,
      bumpMap: engravingTexture(),
      bumpScale: 1.4,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const rim = new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    return { disc, rim }
  }, [m])
  useEffect(() => () => Object.values(mats).forEach((x) => x.dispose()), [mats])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    applyFrame(config.id)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    document.body.style.cursor = ''
  }

  return (
    <group position={[0, 0.004, 0]}>
      <mesh geometry={geo.disc} material={mats.disc} receiveShadow onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
      <mesh geometry={geo.rim} material={mats.rim} receiveShadow />
    </group>
  )
}
