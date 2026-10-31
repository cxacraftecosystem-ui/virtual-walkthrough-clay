/**
 * <Amenities/> — scene-side visitor amenities (mounted once in MuseumScene):
 *
 *   Signage          wall plaques and directional totems (zone names in the visitor's language)
 *   TrailMedallions  "Find the motifs" medallions — only while the visitor runs the trail
 *
 * Round the drum a sign rarely faces one of the eight compass points: a sign may give an
 * exact `facingDeg` (compass degrees, 0 = north / −z, 90 = east / +x), which wins over its
 * `facing`. The pavilion's lighting is architecture's; amenities add none of their own.
 */
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { compassVec, SIGNS, TRAIL, TRAIL_SIZE, type Compass, type SignConfig, type TrailMedallion } from '../config/amenities'
import { useLang } from '../i18n'
import { useModelMaterials } from '../models/modelMaterials'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { useTrail } from '../trail/trail'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { medallionTextures, plaqueTexture, totemTexture } from './signTextures'

/** Facing of a sign or medallion: an exact `facingDeg` if given, else its compass point. */
interface Faced {
  facing: Compass
  facingDeg?: number
}

/** Outward normal [x, z], rotation.y turning a +z-facing plane to it, and the facing as compass degrees. */
export function facingOf(f: Faced, flip = false): { n: [number, number]; rot: number; deg: number } {
  let deg: number
  if (typeof f.facingDeg === 'number' && Number.isFinite(f.facingDeg)) deg = f.facingDeg
  else {
    const [x, z] = compassVec(f.facing)
    deg = (Math.atan2(x, -z) * 180) / Math.PI
  }
  if (flip) deg += 180
  const r = (deg * Math.PI) / 180
  const n: [number, number] = [Math.sin(r), -Math.cos(r)]
  return { n, rot: Math.atan2(n[0], n[1]), deg: ((deg % 360) + 360) % 360 }
}

/* ------------------------------------------------------------------ */
/* Signage                                                             */
/* ------------------------------------------------------------------ */

const PLAQUE = { w: 0.46, h: 0.2 }
const TOTEM = { w: 0.5, h: 1.95, d: 0.14, face: 1.3 }

function Plaque({ sign }: { sign: SignConfig & { facingDeg?: number } }) {
  const m = useModelMaterials()
  const lang = useLang()
  const line = sign.lines[0]
  const tex = useAsyncTexture(() => plaqueTexture(line, lang, PLAQUE.w, PLAQUE.h), [line.zone, lang])
  const { n, rot } = facingOf(sign)
  const [nx, nz] = n
  const [x, y, z] = sign.position
  return (
    <group position={[x + nx * 0.006, y, z + nz * 0.006]} rotation={[0, rot, 0]}>
      <mesh material={m.brass} position={[0, 0, 0.004]} raycast={() => null}>
        <boxGeometry args={[PLAQUE.w + 0.016, PLAQUE.h + 0.016, 0.008]} />
      </mesh>
      {tex && (
        <mesh position={[0, 0, 0.0085]} raycast={() => null}>
          <planeGeometry args={[PLAQUE.w, PLAQUE.h]} />
          <meshStandardMaterial map={tex} roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

function TotemFace({ sign, back }: { sign: SignConfig & { facingDeg?: number }; back?: boolean }) {
  const lang = useLang()
  // arrows are drawn relative to the reader, from the face's exact facing
  const facing = facingOf(sign, back).deg
  const key = sign.lines.map((l) => `${l.zone}:${l.dir ?? ''}`).join('|')
  const tex = useAsyncTexture(() => totemTexture(sign.lines, facing, lang, TOTEM.w - 0.06, TOTEM.face), [key, facing, lang])
  if (!tex) return null
  return (
    <mesh position={[0, TOTEM.h - 0.12 - TOTEM.face / 2, back ? -TOTEM.d / 2 - 0.0015 : TOTEM.d / 2 + 0.0015]} rotation={[0, back ? Math.PI : 0, 0]} raycast={() => null}>
      <planeGeometry args={[TOTEM.w - 0.06, TOTEM.face]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.15} />
    </mesh>
  )
}

function Totem({ sign }: { sign: SignConfig & { facingDeg?: number } }) {
  const m = useModelMaterials()
  const { rot } = facingOf(sign)
  return (
    <group position={sign.position} rotation={[0, rot, 0]}>
      <mesh material={m.walnut} position={[0, TOTEM.h / 2 + 0.03, 0]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[TOTEM.w, TOTEM.h - 0.06, TOTEM.d]} />
      </mesh>
      <mesh material={m.brass} position={[0, 0.015, 0]} raycast={() => null}>
        <boxGeometry args={[TOTEM.w + 0.06, 0.03, TOTEM.d + 0.06]} />
      </mesh>
      <mesh material={m.brass} position={[0, TOTEM.h + 0.006, 0]} raycast={() => null}>
        <boxGeometry args={[TOTEM.w + 0.02, 0.012, TOTEM.d + 0.02]} />
      </mesh>
      <TotemFace sign={sign} />
      <TotemFace sign={sign} back />
    </group>
  )
}

function Signage() {
  return (
    <group name="signage">
      {SIGNS.map((s) => (
        <ZoneGroup key={s.id} zones={s.zones}>
          {s.kind === 'plaque' ? <Plaque sign={s} /> : <Totem sign={s} />}
        </ZoneGroup>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Discovery trail medallions                                          */
/* ------------------------------------------------------------------ */

const medallionGeo = new THREE.CylinderGeometry(TRAIL_SIZE / 2, TRAIL_SIZE / 2, 0.012, 40).rotateX(Math.PI / 2)

function Medallion({ m }: { m: TrailMedallion & { facingDeg?: number } }) {
  const found = useTrail((s) => s.found.includes(m.id))
  const find = useTrail((s) => s.find)
  const [hover, setHover] = useState(false)
  const { map, bump } = useMemo(() => medallionTextures(m.motif, m.ink), [m.motif, m.ink])
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, metalness: 0.75, roughness: 0.38, emissive: new THREE.Color('#ffcf85'), emissiveIntensity: 0 }),
    [map, bump],
  )
  const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a47a3a', metalness: 0.9, roughness: 0.35 }), [])
  useEffect(() => {
    faceMat.emissiveIntensity = found ? 0.18 : hover ? 0.12 : 0
  }, [faceMat, found, hover])
  useEffect(
    () => () => {
      faceMat.dispose()
      edgeMat.dispose()
    },
    [faceMat, edgeMat],
  )
  const { n, rot } = facingOf(m)
  const [nx, nz] = n
  const [x, y, z] = m.position
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    find(m.id)
  }
  return (
    <group position={[x + nx * 0.006, y, z + nz * 0.006]} rotation={[0, rot, 0]}>
      <mesh
        geometry={medallionGeo}
        material={[edgeMat, faceMat, edgeMat]}
        name={`trail-${m.id}`}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
      />
    </group>
  )
}

function TrailMedallions() {
  const active = useTrail((s) => s.active)
  if (!active) return null
  return (
    <group name="trail">
      {TRAIL.map((m) => (
        <ZoneGroup key={m.id} zones={[m.zone]}>
          <Medallion m={m} />
        </ZoneGroup>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

export function Amenities() {
  return (
    <group name="amenities">
      <Signage />
      <TrailMedallions />
    </group>
  )
}
