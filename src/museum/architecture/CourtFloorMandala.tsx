/**
 * 'court-mandala' — the court's sundial and, optionally, its floor mandala (SPECTACLE F11; GRAND
 * §0.4: the coffered dome and its stepped oculus replace the old soffit crown and the jali ring,
 * so neither is drawn any more, and the floor mandala is off by default: the court is pool,
 * lotus, dome and light, with the brass hour lines on the terrazzo).
 *
 *   floor     (`floor: true` only) a terracotta, slip and black-tile mandala (r 3.2 … 5.6) inlaid 2 mm above the earth
 *             floor. On the visitor's first step into the court (`zone-first:inner`, or the
 *             `court:mandala` cue) it assembles ring by ring, spiralling outward like a pot rising
 *             on the wheel; the Still form is simply drawn. It never takes a pointer hit, so the
 *             floor underneath still walks the visitor where they click.
 *   sundial   brass hour lines (7 … 17 IST, apparent time), the figure-8 of 12:00 IST through the
 *             year and today's path of the sun patch, computed from lighting/solar.ts for the
 *             light coming through the 10 m oculus 20 m up; inlaid in the terrazzo between the
 *             pool's curb and the podium ring (and never under F), redrawn when the date changes.
 *
 * Props (models/propSchemas.ts): pattern, petals, gold and floor (the floor mandala's), sundial;
 * spinSec is kept for content compatibility and unused.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { DEG, MUSEUM } from '../config/museum'
import { FLOOR_MANDALA, getMandalaBand, setPlanUV, type MandalaBandOptions } from '../materials/mandalaBand'
import { istDay, sunPatch } from '../config/spectacleObjects/court'
import { KHARAGPUR, kharagpurTime, sunPosition } from '../lighting/solar'
import { visitorDistance } from '../interaction/proximity'
import { perchZone } from '../navigation/perch'
import { useCue } from '../spectacle/cues'
import { useMuseum } from '../state/store'
import { useSpectacle } from '../spectacle/settings'
import type { ModelProps } from '../models/types'
import { num, str } from '../models/types'
import { annulusFace, mergeAll } from './shellGeometry'

const FULL = Math.PI * 2
const noRaycast = () => null

const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : v === 'false' ? false : v === 'true' ? true : def)

/* ------------------------------------------------------------------ */
/* floor mandala with its polar reveal                                 */
/* ------------------------------------------------------------------ */

/** Ring boundaries the reveal walks through, one after another (m). */
/** The reveal's bands, at the old plan's fractions of the floor ring. */
const REVEAL_RINGS = [0, 0.125, 0.5, 0.604, 0.9, 1].map((f) => FLOOR_MANDALA.r0 + f * (FLOOR_MANDALA.r1 - FLOOR_MANDALA.r0))
/** Seconds the whole floor takes to assemble. */
const REVEAL_SEC = 3.6

type RevealUniforms = { uReveal: { value: number } }

function floorMaterial(t: ReturnType<typeof getMandalaBand>) {
  const uniforms: RevealUniforms = { uReveal: { value: 1 } }
  const m = new THREE.MeshStandardMaterial({
    name: 'courtFloorMandala',
    map: t?.albedo ?? null,
    normalMap: t?.normal ?? null,
    roughness: 0.55,
    metalness: 0,
    alphaTest: 0.5,
    envMapIntensity: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    emissive: new THREE.Color('#ff9a4d'),
  })
  m.userData.uniforms = uniforms
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPlanXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlanXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
    const bands = REVEAL_RINGS.map((r) => r.toFixed(3))
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uReveal;
varying vec2 vPlanXZ;
float revealEdge;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
{
  float rr = length(vPlanXZ);
  float ring = step(${bands[1]}, rr) + step(${bands[2]}, rr) + step(${bands[3]}, rr) + step(${bands[4]}, rr);
  float ang = atan(vPlanXZ.y, vPlanXZ.x) / 6.2831853 + 0.5;
  float t = (ring + ang) / 5.0;
  float d = uReveal * 1.04 - t;
  if (d < 0.0) discard;
  revealEdge = 1.0 - smoothstep(0.0, 0.035, d);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance = emissive * revealEdge * revealEdge * 2.2;`,
      )
  }
  m.customProgramCacheKey = () => 'courtFloorMandala'
  return m
}

/** The floor has assembled once on this page. */
const REVEALED = { done: false }

const SEEN_KEY = 'clay.zonesSeen.v1'
/** Has the court been seen this session already (then the floor is simply there)? */
function courtSeen(): boolean {
  try {
    return (JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]).includes('inner')
  } catch {
    return false
  }
}

function FloorMandala({ opts, still }: { opts: MandalaBandOptions; still: boolean }) {
  const tex = useMemo(() => getMandalaBand({ ...opts, r0: FLOOR_MANDALA.r0, r1: FLOOR_MANDALA.r1 }), [opts])
  const mat = useMemo(() => floorMaterial(tex), [tex])
  useEffect(() => () => mat.dispose(), [mat])
  const geo = useMemo(() => {
    const f = annulusFace(0, 0, FLOOR_MANDALA.r0, FLOOR_MANDALA.r1, 0, FULL, 0.002, true)
    return f ? setPlanUV(f, FLOOR_MANDALA.r1) : null
  }, [])
  useEffect(() => () => geo?.dispose(), [geo])
  // reveal state: 1 = drawn. Before the first visit it waits at 0, then plays — once per page
  // (a remount, e.g. on a tier change, finds it already drawn)
  const st = useRef({ v: still || REVEALED.done || courtSeen() ? 1 : 0, playing: false })
  const uniforms = mat.userData.uniforms as RevealUniforms
  const play = () => {
    if (still) {
      st.current.v = 1
      return
    }
    st.current.v = 0
    st.current.playing = true
  }
  // the first time the court is seen up close: stepping into it, or into the gallery ring round it
  const first = () => {
    if (st.current.v === 0 && !st.current.playing) play()
  }
  useCue('zone-first:inner', first)
  useCue('zone-first:ring-a', first)
  useCue('zone-first:ring-b', first)
  useCue('zone-first:ring-c', first)
  useCue('court:mandala', play)
  useFrame((_, dt) => {
    const s = st.current
    // also starts by itself the first time the visitor stands inside the drum's ring (in case the
    // zone cue was missed, e.g. after a teleport between two zone checks)
    if (!still && s.v === 0 && !s.playing && useMuseum.getState().phase === 'entered' && !perchZone() && visitorDistance(0, 0) < MUSEUM.drum.ringR) first()
    if (still) s.v = 1
    else if (s.playing) {
      s.v = Math.min(1, s.v + Math.min(dt, 0.1) / REVEAL_SEC)
      if (s.v >= 1) {
        s.playing = false
        REVEALED.done = true
      }
    }
    uniforms.uReveal.value = s.v
  })
  if (!geo) return null
  return <mesh name="court-floor-mandala" geometry={geo} material={mat} receiveShadow raycast={noRaycast} />
}

/* ------------------------------------------------------------------ */
/* sundial                                                             */
/* ------------------------------------------------------------------ */

/** The dial: from just outside the curb to a little short of the podium ring, on the terrazzo. */
const DIAL = { r0: MUSEUM.oculus.rings[0] + 0.12, r1: MUSEUM.podium.ringR - 1.4, y: 0.0045 }
const FW = MUSEUM.innerMainWall
/** F's court face less a margin: the lines stop short of it where it stands. */
const F_FACE = FW.r - FW.thickness / 2 - 0.25

const patchAt = (date: Date) => sunPatch(date)

const inDial = ([x, z]: [number, number]) => {
  const r = Math.hypot(x, z)
  if (r < DIAL.r0 || r > DIAL.r1) return false
  const a = Math.atan2(z, x) / DEG
  return !(r > F_FACE && a >= FW.fromDeg - 2 && a <= FW.toDeg + 2)
}

/** A flat strip of `width` along a polyline at y; runs leaving the dial annulus are cut. */
function strips(lines: [number, number][][], width: number, y: number): THREE.BufferGeometry | null {
  const pos: number[] = []
  const idx: number[] = []
  const w = width / 2
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]
      const b = line[i + 1]
      if (!inDial(a) || !inDial(b)) continue
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const len = Math.hypot(dx, dz)
      if (len < 1e-4 || len > 0.6) continue
      const nx = (-dz / len) * w
      const nz = (dx / len) * w
      const base = pos.length / 3
      pos.push(a[0] + nx, y, a[1] + nz, a[0] - nx, y, a[1] - nz, b[0] - nx, y, b[1] - nz, b[0] + nx, y, b[1] + nz)
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }
  if (!pos.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const n = pos.length / 3
  const nor = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) nor[i * 3 + 1] = 1
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  g.setIndex(idx)
  return g
}

/** Small brass discs (hour marks on today's path). */
function dots(points: [number, number][], r: number, y: number): THREE.BufferGeometry | null {
  const parts = points.filter(inDial).map(([x, z]) => {
    const g = new THREE.CircleGeometry(r, 16)
    g.rotateX(-Math.PI / 2)
    g.translate(x, y, z)
    return g
  })
  return mergeAll(parts)
}

function buildSundial(day: Date) {
  const year = day.getUTCFullYear()
  // winter solstice → summer solstice: with the equation of time removed the patch depends on the
  // declination only, so this half year draws each hour line once, end to end
  const days: Date[] = []
  for (let d = -11; d <= 172; d += 3) days.push(new Date(Date.UTC(year, 0, 1 + d)))
  // hour lines in apparent solar time: for IST hour h, the patch on every day of the year at the
  // moment the sun's hour angle equals that of mean solar time h (equation of time removed)
  const hourLines: [number, number][][] = []
  for (let h = 7; h <= 17; h++) {
    const line: [number, number][] = []
    for (const d of days) {
      const eq = sunPosition(kharagpurTime(d, 12), KHARAGPUR.lat, KHARAGPUR.lon).eqTimeMin
      const p = patchAt(new Date(kharagpurTime(d, h).getTime() - eq * 60000))
      if (p) line.push(p)
    }
    hourLines.push(line)
  }
  // 12:00 IST through the year: the figure-8 (equation of time + declination)
  const analemma: [number, number][] = []
  for (let d = 0; d <= 366; d += 2) {
    const p = patchAt(kharagpurTime(new Date(Date.UTC(year, 0, 1 + d)), 12))
    if (p) analemma.push(p)
  }
  // today's path, and its hour marks
  const today: [number, number][] = []
  for (let m = 6 * 60; m <= 18 * 60; m += 6) {
    const p = patchAt(kharagpurTime(day, m / 60))
    if (p) today.push(p)
  }
  const marks: [number, number][] = []
  for (let h = 7; h <= 17; h++) {
    const p = patchAt(kharagpurTime(day, h))
    if (p) marks.push(p)
  }
  const noon = patchAt(kharagpurTime(day, 12))
  return {
    lines: mergeAll([strips(hourLines, 0.014, DIAL.y), strips([analemma], 0.012, DIAL.y + 0.0004)]),
    today: mergeAll([strips([today], 0.01, DIAL.y + 0.0008), dots(marks, 0.022, DIAL.y + 0.0012), noon ? dots([noon], 0.045, DIAL.y + 0.0014) : null]),
  }
}

// a quiet, darkened bronze inlay: bright brass lines read as stray strokes across the court
const brass = new THREE.MeshStandardMaterial({ name: 'sundialBrass', color: new THREE.Color('#8f6d3c'), metalness: 0.55, roughness: 0.48, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide })
const brassToday = new THREE.MeshStandardMaterial({ name: 'sundialToday', color: new THREE.Color('#b08a48'), metalness: 0.6, roughness: 0.38, emissive: new THREE.Color('#ffcf7a'), emissiveIntensity: 0.04, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, side: THREE.DoubleSide })

function Sundial() {
  const [day, setDay] = useState(() => istDay().getTime())
  useEffect(() => {
    const t = setInterval(() => {
      const d = istDay().getTime()
      setDay((cur) => (cur === d ? cur : d))
    }, 60000)
    return () => clearInterval(t)
  }, [])
  const geo = useMemo(() => buildSundial(new Date(day)), [day])
  useEffect(() => () => [geo.lines, geo.today].forEach((g) => g?.dispose()), [geo])
  return (
    <group name="court-sundial">
      {geo.lines && <mesh geometry={geo.lines} material={brass} receiveShadow raycast={noRaycast} />}
      {geo.today && <mesh geometry={geo.today} material={brassToday} receiveShadow raycast={noRaycast} />}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

const PATTERNS = ['chakra', 'lotus', 'alpana'] as const

export function CourtFloorMandala({ config }: ModelProps) {
  const sp = useSpectacle()
  const patternRaw = str(config, 'pattern', 'chakra')
  const pattern = (PATTERNS as readonly string[]).includes(patternRaw) ? (patternRaw as MandalaBandOptions['pattern']) : 'chakra'
  const petals = Math.max(8, Math.min(32, Math.round(num(config, 'petals', 16))))
  const gold = bool(config.props?.gold, true)
  const showFloor = bool(config.props?.floor, false)
  const showDial = bool(config.props?.sundial, true)
  const size = sp.caps.spectacleTexPx
  const opts = useMemo<MandalaBandOptions>(() => ({ pattern, petals, gold, size, r0: FLOOR_MANDALA.r0, r1: FLOOR_MANDALA.r1 }), [pattern, petals, gold, size])
  // the scene object stands at the court centre; everything below is in court coordinates
  return (
    <group name="court-mandala">
      {showFloor && <FloorMandala opts={opts} still={sp.mode === 'still'} />}
      {showDial && <Sundial />}
    </group>
  )
}
