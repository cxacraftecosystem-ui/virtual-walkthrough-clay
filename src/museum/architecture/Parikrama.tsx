/**
 * THE PARIKRAMA WALK (SPECTACLE F21, GRAND §2.6): the open-air walk round the outside of the
 * gallery ring from the west gate to the east gate, between the drum and the four crescent rooms.
 * Its red serpentine walls and floors are Serpentine.tsx; the pergola is retired (the walk is
 * open to the sky, p09l).
 *
 *   jali ......... pierced terracotta screens closing the three slots between the rooms (WALLS
 *                  'jali-1…3' collide; they are drawn here): two pierced faces, a solid sill, a head
 *   alpana ....... the living alpana band (materials/alpana.ts), white on the red floor along the
 *                  walk's centreline: it draws itself in round the visitor's footsteps and stays
 *                  drawn for the session; Low and reduced motion show it fully drawn; the tour's
 *                  cue 'parikrama:alpana' draws the whole walk
 *   chimes ....... the clay bells at the gates and the slots (models/clayChimes.tsx)
 *
 * The screens are shell (never culled); the alpana and the chimes are culled with the two halves
 * of the walk together (one ZoneGroup for both), so neither ever pops mid-walk.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG } from '../config/museum'
import { JALI, JALI_SLOTS, PARIKRAMA, SAT_WALL, SATELLITES, serpentineOffset } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { alpanaMaterial, ALPANA_REPEAT_M, type AlpanaPattern } from '../materials/alpana'
import { jaali } from '../materials/brickTextures'
import { useMaterials } from '../materials/materials'
import { ChimeSet } from '../models/clayChimes'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useCue } from '../spectacle/cues'
import { kindProps, useSpectacle } from '../spectacle/settings'
import { visitor } from '../state/visitor'
import { polarBand } from './Satellites'
import { cylinderFace, mergeAll } from './shellGeometry'
import { Mesh, type V3 } from './sweep'

const P = PARIKRAMA
/** The walk's middle radius. */
const RM = (P.r0 + P.r1) / 2

/** Plan-angle spans (deg) along r 10.25 with no room wall under the pergola: the gates and the slots. */
export function openSpans(): [number, number][] {
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const out: [number, number][] = [[P.fromDeg, rooms[0].fromDeg]]
  for (let i = 0; i < rooms.length - 1; i++) out.push([rooms[i].toDeg, rooms[i + 1].fromDeg])
  out.push([rooms[rooms.length - 1].toDeg, P.toDeg])
  return out
}

/** A curved beam: the solid band r0 → r1, a0 → a1 (deg), y0 → y1. */
function arcBeam(r0: number, r1: number, a0: number, a1: number, y0: number, y1: number) {
  const A0 = a0 * DEG
  const A1 = a1 * DEG
  return mergeAll([cylinderFace(0, 0, r0, A0, A1, y0, y1, 'in'), cylinderFace(0, 0, r1, A0, A1, y0, y1, 'out'), polarBand(r0, r1, A0, A1, y1, true), polarBand(r0, r1, A0, A1, y0, false)])
}

/** The jali screens in the slots: pierced faces, a sill and a head. */
function jaliGeometry() {
  const faces: (THREE.BufferGeometry | null)[] = []
  const solid: (THREE.BufferGeometry | null)[] = []
  const r = SAT_WALL.innerC
  const h = JALI.t / 2
  for (const [a0, a1] of JALI_SLOTS) {
    // the slot's ends are the rooms' end walls (0.15 either side of the slot's angles)
    const e = (SAT_WALL.t / 2 / r) / DEG
    const A0 = (a0 + e) * DEG
    const A1 = (a1 - e) * DEG
    faces.push(cylinderFace(0, 0, r - h, A0, A1, 0.12, JALI.height - 0.1, 'in'), cylinderFace(0, 0, r + h, A0, A1, 0.12, JALI.height - 0.1, 'out'))
    solid.push(arcBeam(r - h - 0.01, r + h + 0.01, a0 + e * 0.5, a1 - e * 0.5, 0, 0.12), arcBeam(r - h - 0.01, r + h + 0.01, a0 + e * 0.5, a1 - e * 0.5, JALI.height - 0.1, JALI.height))
  }
  return { faces: mergeAll(faces), solid: mergeAll(solid) }
}

function JaliScreens() {
  const m = useMaterials()
  const sp = useSpectacle()
  const jali = useMemo(jaliGeometry, [])
  useEffect(
    () => () => {
      jali.faces?.dispose()
      jali.solid?.dispose()
    },
    [jali],
  )
  const screen = useMemo(() => {
    const t = jaali(256, 'screen')
    const mat = new THREE.MeshStandardMaterial({ name: 'jaliScreen', color: '#b5643f', alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, envMapIntensity: 0.4 })
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: t, alphaTest: 0.5 })
    return { mat, depth }
  }, [])
  useEffect(
    () => () => {
      screen.mat.dispose()
      screen.depth.dispose()
    },
    [screen],
  )
  return (
    <group name="jali">
      <StaticMerge name="parikrama-jali">{jali.solid && <mesh geometry={jali.solid} material={m.oxblood} castShadow receiveShadow />}</StaticMerge>
      {jali.faces && <mesh geometry={jali.faces} material={screen.mat} customDepthMaterial={screen.depth} castShadow={sp.caps.jaliShadows} receiveShadow />}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* The living alpana                                                   */
/* ------------------------------------------------------------------ */

const ALPANA_KEY = 'clay.alpana.v1'
const A0 = P.fromDeg * DEG
const A1 = P.toDeg * DEG

function readSpan(): [number, number] | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ALPANA_KEY) ?? 'null') as unknown
    return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number') ? [v[0], v[1]] : null
  } catch {
    return null
  }
}

function writeSpan(s: [number, number]) {
  try {
    sessionStorage.setItem(ALPANA_KEY, JSON.stringify(s.map((n) => Math.round(n * 1000) / 1000)))
  } catch {
    // storage blocked: the walk is drawn afresh next visit
  }
}

/** The walk's clear width (between the serpentine's wall faces). */
const SERP_WALK_CLEAR = 2.7

/** The alpana's band along the serpentine's centreline: u = metres along it, v 0 → 1 across. */
function alpanaBand(width: number) {
  const step = 0.4
  const a = serpentineOffset(width / 2, P.fromDeg, P.toDeg, step)
  const b = serpentineOffset(-width / 2, P.fromDeg, P.toDeg, step)
  const mesh = new Mesh()
  const up: V3 = [0, 1, 0]
  let u = 0
  const y = 0.003
  for (let i = 0; i < a.length - 1; i++) {
    const mx0 = (a[i][0] + b[i][0]) / 2
    const mz0 = (a[i][1] + b[i][1]) / 2
    const mx1 = (a[i + 1][0] + b[i + 1][0]) / 2
    const mz1 = (a[i + 1][1] + b[i + 1][1]) / 2
    const du = Math.hypot(mx1 - mx0, mz1 - mz0)
    mesh.flat([[a[i][0], y, a[i][1]], [a[i + 1][0], y, a[i + 1][1]], [b[i + 1][0], y, b[i + 1][1]], [b[i][0], y, b[i][1]]], up, [
      [u, 1],
      [u + du, 1],
      [u + du, 0],
      [u, 0],
    ])
    u += du
  }
  return mesh.build()
}

function LivingAlpanaBand() {
  const sp = useSpectacle()
  const props = useMemo(() => kindProps('living-alpana'), [])
  const pattern: AlpanaPattern = props.pattern === 'kolam-b' ? 'kolam-b' : 'kolam-a'
  const color = typeof props.color === 'string' ? props.color : '#efe6d6'
  const width = typeof props.width === 'number' && props.width > 0.2 ? Math.min(props.width, SERP_WALK_CLEAR - 0.4) : 1.4
  const px = Math.min(1024, sp.caps.spectacleTexPx)
  const mat = useMemo(() => {
    const mm = alpanaMaterial(pattern, color, px)
    mm.alphaMap!.repeat.set(1 / ALPANA_REPEAT_M, 1)
    return mm
  }, [pattern, color, px])
  useEffect(() => () => mat.dispose(), [mat])
  const geo = useMemo(() => alpanaBand(width), [width])
  useEffect(() => () => geo?.dispose(), [geo])

  const live = sp.caps.alpanaLive && sp.mode !== 'still'
  const span = useRef<{ min: number; max: number; tMin: number; tMax: number; sweep: number }>({ min: 0, max: 0, tMin: 0, tMax: 0, sweep: 0 })
  useEffect(() => {
    const s = span.current
    if (!live) {
      s.min = s.tMin = A0 - 0.2
      s.max = s.tMax = A1 + 0.2
      return
    }
    const saved = readSpan()
    if (saved) [s.min, s.max] = [s.tMin, s.tMax] = saved
    else s.min = s.max = s.tMin = s.tMax = (A0 + A1) / 2
  }, [live])
  // the tour's Air chapter: draw the whole walk, sweeping out from where it has reached
  useCue('parikrama:alpana', () => {
    span.current.sweep = 1
  })
  const lastSave = useRef(0)
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = span.current
    const u = mat.userData.uniforms
    if (live) {
      // the visitor's footsteps on the walk widen the drawn span by a brush round them
      const r = Math.hypot(visitor.x, visitor.z)
      const a = Math.atan2(visitor.z, visitor.x)
      if (r > P.r0 - 0.2 && r < P.r1 + 0.6 && a > A0 - 0.05 && a < A1 + 0.05) {
        const brush = 1.2 / RM
        if (s.tMin === s.tMax) {
          s.tMin = s.min = a
          s.tMax = s.max = a
        }
        s.tMin = Math.min(s.tMin, a - brush)
        s.tMax = Math.max(s.tMax, a + brush)
      }
      if (s.sweep > 0) {
        s.tMin = A0 - 0.2
        s.tMax = A1 + 0.2
      }
      // the line is laid down at walking pace (about 1.6 m/s of arc), never in a jump
      const step = ((s.sweep > 0 ? 4 : 1.6) / RM) * dt
      s.min = Math.max(s.tMin, s.min - step)
      s.max = Math.min(s.tMax, s.max + step)
      if (st.clock.elapsedTime - lastSave.current > 1) {
        lastSave.current = st.clock.elapsedTime
        writeSpan([s.tMin, s.tMax])
      }
    }
    u.uRevealMin.value = s.min
    u.uRevealMax.value = s.max
    u.uFront.value = live ? 0.9 / RM : 0.001
  })
  if (!geo) return null
  return <mesh geometry={geo} material={mat} raycast={() => null} receiveShadow renderOrder={1} />
}

export function Parikrama() {
  const count = useMemo(() => {
    const c = kindProps('clay-chimes').count
    return typeof c === 'number' ? c : 5
  }, [])
  return (
    <group name="parikrama">
      <JaliScreens />
      <ZoneGroup zones={['parikrama-west', 'parikrama-east']}>
        <LivingAlpanaBand />
        <ChimeSet count={count} />
      </ZoneGroup>
    </group>
  )
}
