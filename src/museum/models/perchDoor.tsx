/**
 * 'perch-door' — where a perch ride starts (SPECTACLE F4, GRAND §8 P5). Props:
 * models/propSchemas.ts {perch, label}.
 *
 * Two doors, from navigation/perch.ts PERCH_DOORS:
 *  • the east stair's foot (perch 'duplex' or 'sky-rim'): a slender brass portal at the flight's
 *    inner edge — two posts, a lintel carrying a clay plaque with the way up cut into it, and a
 *    lantern on the left post;
 *  • the Sphere Well's gate (perch 'sphere-well'): a gap in the rim's balustrade between two
 *    brass newels, a hanging chain and a low plaque with the way down.
 * The stair, the balustrade and the well are architecture (P1); drawn here are the portal, a
 * brass threshold strip, the plaque and an invisible panel that takes the click.
 *
 * Origin at the door's way in (PerchDoor.face), front (+z) facing out towards where the visitor
 * stands. Click the opening (or press E beside it) to ride, while the perches are offered.
 */
import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { carvedMaps } from '../exhibits/carvedText'
import { useLang } from '../i18n'
import { PERCH_DOORS, isPerchId, perchEnabled } from '../navigation/perch'
import { climb } from '../navigation/perchActions'
import { xtIn } from '../spectacle/experienceText'
import { useMuseum } from '../state/store'
import { useModelMaterials } from './modelMaterials'
import { str, type ModelProps } from './types'

/** Opening width (m) and the posts' height for each door. */
const STAIR = { w: 1.4, h: 2.55, post: 0.07 }
/** The well's gate stays as slight as its balustrade: two slim brass newels, a small low plaque, no lantern. */
const WELL = { w: 1.5, h: 1.1, post: 0.035 }
const PLAQUE = { w: 1.25, h: 0.2 }

function usePlaque(lines: string[]) {
  const [maps, setMaps] = useState<Awaited<ReturnType<typeof carvedMaps>> | null>(null)
  const key = lines.join('|')
  useEffect(() => {
    let live = true
    let made: Awaited<ReturnType<typeof carvedMaps>> | null = null
    void carvedMaps(
      {
        width: PLAQUE.w,
        height: PLAQUE.h,
        pad: 0.03,
        align: 'center',
        pxPerM: 1400,
        lines: lines.map((text, i) => ({ text, cap: i === 0 ? 0.045 : 0.026, face: i === 0 ? 'serif' : 'sans', weight: i === 0 ? 600 : 500, tracking: i === 0 ? 0.04 : 0.12, upper: i > 0, before: 0.03 })),
      },
      { ground: '#c99067', floor: '#3a170c', grain: 0.4, seed: 5 },
    ).then((m) => {
      made = m
      if (live) setMaps(m)
      else [m.map, m.normalMap].forEach((t) => t.dispose())
    })
    return () => {
      live = false
      if (made) [made.map, made.normalMap].forEach((t) => t.dispose())
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return maps
}

export function PerchDoor({ config }: ModelProps) {
  const m = useModelMaterials()
  const lang = useLang()
  const enabled = useMemo(() => perchEnabled(), [])
  const perchProp = str(config, 'perch', 'sky-rim')
  const perch = isPerchId(perchProp) ? perchProp : 'sky-rim'
  const well = perch === 'sphere-well'
  const D = well ? WELL : STAIR
  const label = str(config, 'label', '')
  const lines = well ? [xtIn(lang, 'xp.door.well'), xtIn(lang, 'xp.door.wellSub')] : [xtIn(lang, 'xp.door.stair'), xtIn(lang, 'xp.door.stairSub')]
  const plaque = usePlaque(label ? [label] : lines)

  const geo = useMemo(() => {
    const half = D.w / 2
    const post = new THREE.BoxGeometry(D.post, D.h, D.post)
    const posts = [-1, 1].map((s) => post.clone().translate(s * (half + D.post / 2), D.h / 2, 0))
    const caps = [-1, 1].map((s) => new THREE.SphereGeometry(D.post * 0.75, 16, 10).translate(s * (half + D.post / 2), D.h + D.post * 0.4, 0))
    post.dispose()
    const lintel = well ? null : new THREE.BoxGeometry(D.w + D.post * 2, 0.06, 0.08).translate(0, D.h - 0.03, 0)
    // the plaque hangs under the stair's lintel, or stands on the well's left newel side
    const ps = well ? 0.55 : 1
    const pw = PLAQUE.w * ps
    const ph = PLAQUE.h * ps
    const plaqueY = well ? 0.62 : D.h - 0.06 - PLAQUE.h / 2 - 0.04
    const plaqueZ = well ? 0.06 : 0.045
    const plaqueGeo = new THREE.PlaneGeometry(pw, ph).translate(0, plaqueY, plaqueZ + 0.0075)
    const plaqueBack = new THREE.BoxGeometry(pw + 0.02, ph + 0.02, 0.01).translate(0, plaqueY, plaqueZ)
    // the well's plaque stands on a slim brass bar between the newels
    const bar = well ? new THREE.BoxGeometry(D.w, 0.014, 0.014).translate(0, plaqueY - ph / 2 - 0.02, plaqueZ) : null
    // brass threshold strip in the floor
    const threshold = new THREE.BoxGeometry(D.w + D.post * 2, 0.006, 0.05).translate(0, 0.003, 0.03)
    // a lantern on the left post (seen from outside)
    const LX = -(half + D.post / 2)
    const LY = well ? D.h - 0.25 : 1.95
    const lampArm = new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8).rotateX(Math.PI / 2).translate(LX, LY + 0.1, 0.1)
    const lampCage = new THREE.CylinderGeometry(0.06, 0.05, 0.18, 6).translate(LX, LY, 0.18)
    const lampCap = new THREE.ConeGeometry(0.075, 0.07, 6).translate(LX, LY + 0.12, 0.18)
    const lampGlow = new THREE.SphereGeometry(0.038, 12, 8).translate(LX, LY, 0.18)
    // the well's chain across the opening hangs in a catenary (shown when the rides are off)
    const chain = well ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-half, -0.6 * half, 0, 0.6 * half, half].map((x) => new THREE.Vector3(x, D.h - 0.35 - 0.18 * (1 - (x / half) ** 2), 0))), 24, 0.008, 6) : null
    const hit = new THREE.PlaneGeometry(D.w, well ? 1.4 : D.h - 0.1).translate(0, well ? 0.7 : (D.h - 0.1) / 2, 0.02)
    return { posts, caps, lintel, plaqueGeo, plaqueBack, bar, threshold, lampArm, lampCage, lampCap, lampGlow, chain, hit }
  }, [D, well])
  useEffect(
    () => () => {
      for (const v of Object.values(geo)) {
        if (Array.isArray(v)) v.forEach((g) => g.dispose())
        else v?.dispose()
      }
    },
    [geo],
  )

  const mats = useMemo(() => {
    // takes the pointer, draws nothing
    const hit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    const glow = new THREE.MeshStandardMaterial({ color: '#3a2412', emissive: '#ffc277', emissiveIntensity: 2.4 })
    // letters cut into a clay plaque, with a faint glow of its own so the way up reads in a dim ambulatory
    const plaque = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, normalScale: new THREE.Vector2(2, 2), emissive: '#ffffff', emissiveIntensity: 0.25 })
    const lacquer = new THREE.MeshStandardMaterial({ color: '#2a1410', roughness: 0.4, metalness: 0 })
    return { hit, glow, plaque, lacquer }
  }, [])
  useEffect(() => () => Object.values(mats).forEach((x) => x.dispose()), [mats])
  useEffect(() => {
    if (!plaque) return
    mats.plaque.map = plaque.map
    mats.plaque.emissiveMap = plaque.map
    mats.plaque.normalMap = plaque.normalMap
    mats.plaque.needsUpdate = true
  }, [plaque, mats])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!enabled || e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    climb(perch)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (enabled) document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    document.body.style.cursor = ''
  }

  const door = well ? PERCH_DOORS['sphere-well'] : PERCH_DOORS['east-stair']
  return (
    <group name={label ? `perch-door ${label}` : `perch-door ${door.id}`}>
      <mesh geometry={geo.hit} material={mats.hit} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
      {geo.posts.map((g, i) => (
        <mesh key={`p${i}`} geometry={g} material={m.brass} castShadow />
      ))}
      {geo.caps.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={m.brass} />
      ))}
      {geo.lintel && <mesh geometry={geo.lintel} material={m.brass} castShadow />}
      {geo.bar && <mesh geometry={geo.bar} material={m.brass} />}
      <mesh geometry={geo.plaqueBack} material={mats.lacquer} />
      {plaque && <mesh geometry={geo.plaqueGeo} material={mats.plaque} />}
      <mesh geometry={geo.threshold} material={m.brass} receiveShadow />
      {!well && (
        <>
          <mesh geometry={geo.lampArm} material={m.blackSteel} />
          <mesh geometry={geo.lampCage} material={m.blackSteel} />
          <mesh geometry={geo.lampCap} material={m.blackSteel} castShadow />
          <mesh geometry={geo.lampGlow} material={mats.glow} />
        </>
      )}
      {geo.chain && !enabled && <mesh geometry={geo.chain} material={m.brass} />}
    </group>
  )
}
