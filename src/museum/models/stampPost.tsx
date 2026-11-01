/**
 * 'stamp-post' — a Clay Passport stamp post (SPECTACLE F31). Props: models/propSchemas.ts
 * {stamp, motif, requires}.
 *
 * A tapered terracotta post, waist high, carrying a sloped clay tablet; above it a turned
 * timber stamp hangs from a brass arm. Its face carries the room's relief (trail/stampMotifs.ts).
 * Click it, or stand by it and press E, and the stamp comes down into the tablet with a thunk:
 * the tablet keeps the impression once it is in the visitor's passport (trail/passport.ts).
 *
 * Forms: Full and Lite press with a short drop and a puff of dust; Still (reduced motion)
 * shows the impression at once, nothing moves. One small set of meshes, no lights: a faint
 * warm line round the tablet says "not stamped yet" and goes out once it is.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { spectacleSettings } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { visitor, yawToRad } from '../state/visitor'
import { pressStamp, usePassport, isStampId } from '../trail/passport'
import { drawStampMotif } from '../trail/stampMotifs'
import { tinted, useModelMaterials } from './modelMaterials'
import { str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Motif bump maps (cached per motif)                                  */
/* ------------------------------------------------------------------ */

const bumpCache = new Map<string, THREE.Texture>()

/**
 * Relief of a motif as a bump map: `raised` (stamp head) or pressed in (tablet); `tone` gives the
 * impression's colour map instead (a shade darker in the hollows, white elsewhere).
 */
function motifBump(id: string, raised: boolean, tone = false): THREE.Texture | null {
  const key = `${id}|${raised}|${tone}`
  const hit = bumpCache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = raised ? '#000' : '#fff'
  ctx.fillRect(0, 0, N, N)
  ctx.filter = 'blur(2.5px)'
  // the tablet shows the stamp's mirror image, as a real impression does
  drawStampMotif(ctx, id, N * 0.1, N * 0.1, N * 0.8, raised ? '#fff' : tone ? '#b39582' : '#000', 7, !raised)
  ctx.filter = 'none'
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  bumpCache.set(key, tex)
  return tex
}

/* ------------------------------------------------------------------ */
/* Dimensions                                                          */
/* ------------------------------------------------------------------ */

const POST_H = 0.94
const TABLET = { w: 0.22, d: 0.22, t: 0.035, tilt: 0.21 }
const TABLET_Y = POST_H + 0.03
const HEAD = { r: 0.08, h: 0.03 }
/** Stamp at rest (face height above the tablet) and the drop when pressed. */
const REST = 0.17
const DROP = REST - TABLET.t / 2 - 0.004
const PRESS_MS = { down: 170, hold: 120, up: 420 }
/** The brass collar the handle slides through (tablet space), and where that is on the post. */
const COLLAR_Y = TABLET.t / 2 + REST + HEAD.h / 2 + 0.085
const COLLAR_W = { y: TABLET_Y + COLLAR_Y * Math.cos(TABLET.tilt), z: 0.01 + COLLAR_Y * Math.sin(TABLET.tilt) }

/** Within this distance (m) a click presses at once; further, the visitor walks up first. */
const REACH = 2.4

const DUST = 26

export function StampPost({ config }: ModelProps) {
  const m = useModelMaterials()
  const stamp = str(config, 'stamp', '')
  const motifId = str(config, 'motif', 'rings')
  const requires = str(config, 'requires', '')
  const stamped = usePassport((s) => (isStampId(stamp) ? !!s.stamps[stamp] : false))

  const geo = useMemo(() => {
    // a square post (4-sided cylinder turned 45°), tapering a little to the top
    const post = new THREE.CylinderGeometry(0.15, 0.19, POST_H, 4, 1).rotateY(Math.PI / 4).translate(0, POST_H / 2, 0)
    const foot = new THREE.CylinderGeometry(0.215, 0.225, 0.05, 4, 1).rotateY(Math.PI / 4).translate(0, 0.025, 0)
    const tablet = new THREE.BoxGeometry(TABLET.w, TABLET.t, TABLET.d)
    const impression = new THREE.PlaneGeometry(TABLET.w * 0.94, TABLET.d * 0.94).rotateX(-Math.PI / 2).translate(0, TABLET.t / 2 + 0.0005, 0)
    const groove = new THREE.TorusGeometry(HEAD.r + 0.012, 0.0035, 6, 48).rotateX(Math.PI / 2)
    const handle = new THREE.CylinderGeometry(0.022, 0.03, 0.12, 16).translate(0, HEAD.h / 2 + 0.06, 0)
    const knob = new THREE.SphereGeometry(0.03, 16, 10).translate(0, HEAD.h / 2 + 0.13, 0)
    const head = new THREE.CylinderGeometry(HEAD.r, HEAD.r, HEAD.h, 40)
    // the head's face (pointing down) carries the relief: a disc with its own UVs
    const face = new THREE.CircleGeometry(HEAD.r * 0.97, 40).rotateX(Math.PI / 2).translate(0, -HEAD.h / 2 - 0.0005, 0)
    // brass arm: up the back of the post and over the tablet, ending in the collar
    const arm = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, POST_H - 0.05, -0.135),
        new THREE.Vector3(0, COLLAR_W.y + 0.05, -0.13),
        new THREE.Vector3(0, COLLAR_W.y + 0.035, COLLAR_W.z - 0.07),
        new THREE.Vector3(0, COLLAR_W.y, COLLAR_W.z - 0.036),
      ]),
      24,
      0.009,
      8,
    )
    const collar = new THREE.TorusGeometry(0.034, 0.007, 8, 24).rotateX(Math.PI / 2)
    const dust = new THREE.BufferGeometry()
    dust.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3))
    return { post, foot, tablet, impression, groove, handle, knob, head, face, arm, collar, dust }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mats = useMemo(() => {
    const clay = tinted(m.terracotta, '#b25f3c', { roughness: 0.88 })
    const clayDark = tinted(m.terracotta, '#7d3f28', { roughness: 0.92 })
    const tabletBump = motifBump(motifId, false)
    const tabletPlain = new THREE.MeshStandardMaterial({ color: '#a98a72', roughness: 0.95 })
    // the impression, on the tablet's top face only: pressed in (bump), a shade darker in its hollows
    const tabletPressed = new THREE.MeshStandardMaterial({
      color: '#a98a72',
      map: motifBump(motifId, false, true),
      roughness: 0.95,
      bumpMap: tabletBump,
      bumpScale: 4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    // the head's face: the relief, lighter on its raised lines (map + bump, the same program as the
    // tablet's impression, so the first press compiles nothing new)
    const face = new THREE.MeshStandardMaterial({ color: '#8a5a3c', map: motifBump(motifId, true), roughness: 0.7, bumpMap: motifBump(motifId, true), bumpScale: 3 })
    const glow = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ffb45e', emissiveIntensity: 1.4, roughness: 0.6, toneMapped: true })
    const dust = new THREE.PointsMaterial({ color: '#c9a885', size: 0.022, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true })
    return { clay, clayDark, tabletPlain, tabletPressed, face, glow, dust, timber: m.darkTimber, brass: m.brass }
  }, [m, motifId])
  useEffect(
    () => () => {
      for (const k of ['clay', 'clayDark', 'tabletPlain', 'tabletPressed', 'face', 'glow', 'dust'] as const) mats[k].dispose()
    },
    [mats],
  )

  const stampRef = useRef<THREE.Group>(null)
  const dustRef = useRef<THREE.Points>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const anim = useRef({ start: -1, seen: 0, dust: [] as { x: number; y: number; z: number; vx: number; vy: number; vz: number }[] })

  // play the press when this post's stamp is pressed (from here, from the E key or VR)
  useEffect(
    () =>
      usePassport.subscribe((s, p) => {
        const l = s.last
        if (!l || l === p.last || l.post !== config.id) return
        if (l.result === 'locked') return
        if (spectacleSettings().mode === 'still') return
        anim.current.start = performance.now()
        anim.current.dust = []
      }),
    [config.id],
  )

  useFrame(() => {
    const a = anim.current
    const g = stampRef.current
    const glow = glowRef.current
    if (glow) {
      // "not stamped yet": a slow, faint breath (steady in Still)
      const still = spectacleSettings().mode === 'still'
      const k = still ? 0.8 : 0.65 + 0.35 * Math.sin(performance.now() / 900)
      ;(glow.material as THREE.MeshStandardMaterial).emissiveIntensity = stamped ? 0 : 1.1 * k
      glow.visible = !stamped
    }
    if (!g) return
    if (a.start < 0) {
      g.position.y = 0
      // no draw call for the dust between presses (the material stays mounted, so it was compiled)
      mats.dust.visible = false
      return
    }
    const t = performance.now() - a.start
    const { down, hold, up } = PRESS_MS
    let y = 0
    if (t < down) y = -DROP * (t / down) ** 2
    else if (t < down + hold) y = -DROP
    else if (t < down + hold + up) {
      const k = (t - down - hold) / up
      y = -DROP * (1 - k * k * (3 - 2 * k))
    }
    g.position.y = y
    // dust: a puff from under the stamp as it lands
    const pts = dustRef.current
    if (pts) {
      const pos = pts.geometry.getAttribute('position') as THREE.BufferAttribute
      if (t >= down && a.dust.length === 0) {
        for (let i = 0; i < DUST; i++) {
          const ang = (i / DUST) * Math.PI * 2 + Math.random() * 0.3
          const sp = 0.12 + Math.random() * 0.16
          a.dust.push({ x: Math.cos(ang) * HEAD.r, y: 0, z: Math.sin(ang) * HEAD.r, vx: Math.cos(ang) * sp, vy: 0.05 + Math.random() * 0.12, vz: Math.sin(ang) * sp })
        }
      }
      const life = (t - down) / 900
      const mat = pts.material as THREE.PointsMaterial
      if (a.dust.length && life < 1) {
        const dt = (t - down) / 1000
        a.dust.forEach((d, i) => pos.setXYZ(i, d.x + d.vx * dt, d.y + d.vy * dt - 0.12 * dt * dt, d.z + d.vz * dt))
        pos.needsUpdate = true
        mat.opacity = 0.55 * (1 - life)
      } else mat.opacity = 0
      mat.visible = mat.opacity > 0
    }
    if (t > down + hold + up + 900) a.start = -1
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    const [px, , pz] = config.position
    const rot = ((config.rotationDeg ?? 0) * Math.PI) / 180
    const sx = px + Math.sin(rot) * 0.75
    const sz = pz + Math.cos(rot) * 0.75
    if (Math.hypot(visitor.x - px, visitor.z - pz) <= REACH) {
      pressStamp(stamp, config.id, requires)
      return
    }
    // walk up to it first (facing the post), then press
    const yaw = yawToRad(((Math.atan2(px - sx, -(pz - sz)) * 180) / Math.PI + 360) % 360)
    visitor.walkTarget = { x: sx, z: sz, yaw, pitch: (-12 * Math.PI) / 180, onArrive: () => pressStamp(stamp, config.id, requires) }
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    document.body.style.cursor = ''
  }

  const tiltX = TABLET.tilt
  return (
    <group>
      <mesh geometry={geo.foot} material={mats.clayDark} receiveShadow />
      <mesh geometry={geo.post} material={mats.clay} castShadow receiveShadow onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
      <group position={[0, TABLET_Y, 0.01]} rotation={[tiltX, 0, 0]}>
        <mesh geometry={geo.tablet} material={mats.tabletPlain} castShadow receiveShadow onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
        {stamped && <mesh geometry={geo.impression} material={mats.tabletPressed} receiveShadow />}
        <mesh ref={glowRef} geometry={geo.groove} material={mats.glow} position={[0, TABLET.t / 2 + 0.001, 0]} />
        <group ref={stampRef}>
          <group position={[0, TABLET.t / 2 + REST, 0]}>
            <mesh geometry={geo.head} material={mats.timber} castShadow onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
            <mesh geometry={geo.face} material={mats.face} />
            <mesh geometry={geo.handle} material={mats.timber} castShadow />
            <mesh geometry={geo.knob} material={mats.brass} />
          </group>
        </group>
        <mesh geometry={geo.collar} material={mats.brass} position={[0, COLLAR_Y, 0]} />
        <points ref={dustRef} geometry={geo.dust} material={mats.dust} position={[0, TABLET.t / 2 + 0.01, 0]} frustumCulled={false} />
      </group>
      <mesh geometry={geo.arm} material={mats.brass} castShadow />
    </group>
  )
}

/** Eye-level reach used by the overlay's "Press the stamp" prompt. */
export const STAMP_REACH = Math.min(REACH, 1.6 + MUSEUM.visitor.collisionRadius)
