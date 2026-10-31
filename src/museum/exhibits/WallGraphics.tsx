/**
 * Wall-mounted typography & information: the exhibition title on the description wall and the
 * infographic panels (content from config/infographics.ts).
 */
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { EXHIBITION_TITLE, INFOGRAPHICS, type InfographicConfig } from '../config/infographics'
import { SURFACES, surfacePoint } from '../config/layout'
import { LIGHTING } from '../config/lighting'
import { MUSEUM, type Vec3 } from '../config/museum'
import { registerItem } from '../interaction/registry'
import { coverAngle, TrackSpot } from '../lighting/TrackLight'
import { mountFor } from '../lighting/tracks'
import { useMaterials } from '../materials/materials'
import { createInfographicTexture, createTitleWallTexture } from '../materials/wallGraphics'
import { focusOn } from '../navigation/focus'
import { useMuseum } from '../state/store'
import { useAsyncTexture } from '../utils/useAsyncTexture'

/**
 * Exhibition title and introduction on the description wall H, facing the entrance — the
 * first focal plane. H is curved, so the lettering is a curved film that follows its convex
 * face (a flat panel would stand off the wall at its ends).
 */
const TITLE_SURFACE = 'h-description' as const
const TITLE = { width: 3.4, height: 2.5, centerY: 1.75 }
/** Lettering film radius: H's entrance face plus 3 mm. */
const TITLE_R = MUSEUM.descriptionWall.r + MUSEUM.descriptionWall.thickness / 2 + 0.003

/** Curved strip of H's entrance face, centred on plan angle `aMid`, with 0..1 UVs (u left → right seen from the entrance). */
function curvedTitleGeometry(aMid: number, width: number, height: number, y0: number) {
  const half = width / 2 / TITLE_R
  const n = Math.max(8, Math.ceil(width / 0.12))
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    // seen from outside (the entrance), the plan angle increases to the left
    const u = i / n
    const a = aMid + half - u * 2 * half
    const c = Math.cos(a)
    const sn = Math.sin(a)
    for (const v of [0, 1]) {
      pos.push(TITLE_R * c, y0 + v * height, TITLE_R * sn)
      nor.push(c, 0, sn)
      uv.push(u, v)
    }
  }
  for (let i = 0; i < n; i++) {
    const k = i * 2
    idx.push(k, k + 2, k + 3, k, k + 3, k + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

export function RevealWallTitle() {
  const { width: w, height: h, centerY: cy } = TITLE
  const s = SURFACES[TITLE_SURFACE]
  const at = (s.range[0] + s.range[1]) / 2
  const tex = useAsyncTexture(() => createTitleWallTexture(w, h, { bottomY: cy - h / 2 }), [EXHIBITION_TITLE.title, EXHIBITION_TITLE.intro])
  // the facet's middle lies on H's centre angle
  const mid = surfacePoint(TITLE_SURFACE, at, cy)
  const aMid = Math.atan2(mid.position[2], mid.position[0])
  const geo = useMemo(() => curvedTitleGeometry(aMid, w, h, cy - h / 2), [aMid, w, h, cy])
  useEffect(() => () => geo.dispose(), [geo])
  const spots = useMemo(
    () =>
      [-0.8, 0.8].map((dx) => {
        const mount = mountFor(TITLE_SURFACE, at + dx)
        const tp = surfacePoint(TITLE_SURFACE, at + dx, 1.75)
        const target: Vec3 = tp.position
        const dist = Math.hypot(mount[0] - target[0], mount[1] - target[1], mount[2] - target[2])
        return { mount, target, angle: coverAngle(2.4, 2.6, dist), intensity: LIGHTING.track.artworkIntensity * 0.45 * (dist / 2.2) ** 2 }
      }),
    [at],
  )
  return (
    <group>
      {tex && (
        <mesh geometry={geo} raycast={() => null}>
          <meshStandardMaterial map={tex} transparent roughness={0.7} polygonOffset polygonOffsetFactor={-2} depthWrite={false} />
        </mesh>
      )}
      {spots.map((sp, i) => (
        <TrackSpot key={i} position={sp.mount} target={sp.target} angle={sp.angle} intensity={sp.intensity} />
      ))}
    </group>
  )
}

function InfographicPanel({ cfg }: { cfg: InfographicConfig }) {
  const m = useMaterials()
  const select = useMuseum((s) => s.select)
  const cy = cfg.placement.centerHeight ?? MUSEUM.display.artworkCenterHeight
  const tex = useAsyncTexture(() => createInfographicTexture(cfg, cfg.width, cfg.height), [cfg])
  const p = useMemo(() => surfacePoint(cfg.placement.surface, cfg.placement.at, cy, 0.001), [cfg.placement.surface, cfg.placement.at, cy])
  const depth = 0.012

  useEffect(
    () =>
      registerItem({
        id: cfg.id,
        kind: 'infographic',
        title: cfg.title,
        center: [p.position[0] + p.normal[0] * depth, cy, p.position[2] + p.normal[2] * depth],
        normal: p.normal,
        size: [cfg.width, cfg.height],
        viewDistance: 2.1,
      }),
    [cfg.id, cfg.title, cfg.width, cfg.height, p, cy],
  )

  const spot = useMemo(() => {
    const mount = mountFor(cfg.placement.surface, cfg.placement.at)
    const target: Vec3 = [p.position[0], cy, p.position[2]]
    const dist = Math.hypot(mount[0] - target[0], mount[1] - target[1], mount[2] - target[2])
    return { mount, target, angle: coverAngle(cfg.width, cfg.height, dist), intensity: LIGHTING.track.artworkIntensity * 0.45 * (dist / 2.2) ** 2 }
  }, [cfg.placement.surface, cfg.placement.at, cfg.width, cfg.height, p, cy])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    select({ kind: 'infographic', id: cfg.id })
    focusOn('infographic', cfg.id)
  }

  return (
    <group>
      <group
        position={p.position}
        rotation={[0, p.rotationY, 0]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <mesh position={[0, 0, depth / 2]} material={m.paintWhite} castShadow receiveShadow>
          <boxGeometry args={[cfg.width, cfg.height, depth]} />
        </mesh>
        {tex && (
          <mesh position={[0, 0, depth + 0.0008]} receiveShadow>
            <planeGeometry args={[cfg.width, cfg.height]} />
            <meshStandardMaterial map={tex} roughness={0.8} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        )}
      </group>
      <TrackSpot position={spot.mount} target={spot.target} angle={spot.angle} intensity={spot.intensity} />
    </group>
  )
}

export function ProductWall() {
  return (
    <group>
      {INFOGRAPHICS.map((cfg) => (
        <InfographicPanel key={cfg.id} cfg={cfg} />
      ))}
    </group>
  )
}
