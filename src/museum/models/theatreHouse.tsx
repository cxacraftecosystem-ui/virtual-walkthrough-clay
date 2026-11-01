/**
 * 'theatre-house' — the Agni Theatre's house (F24): the curved screen and its clay proscenium,
 * the Kiln Film, the house lights, and the programme that runs them.
 *
 * The house runs a loop while the theatre can be seen:
 *
 *   firing   (firingSec)  the vault is fired: its brick joints glow up ember-orange and hold
 *                         (architecture/Satellites.tsx reads `theatreHouseState.firing`); the
 *                         cue 'theatre:firing' lets sound add the crackle
 *   dimming  (fadeSec)    the house lights fall to `dimTo` and the joints cool ('theatre:dim')
 *   film     (4·chapterSec) the film — the Kiln Film while no confirmed film is configured on
 *                         'th-screen' ('theatre:kilnFilm'; 'theatre:chapterEnd' after each chapter,
 *                         which the tour's theatre stop waits for) — then the lights come up
 *
 * The loop restarts at the firing on the visitor's first step into the theatre, and whenever
 * the tour or a docent fires 'theatre:firing' ('theatre:kilnFilm' jumps to the film).
 *
 * The screen follows the outer wall's curve (radius = the wall face less a hand's breadth, over
 * THEATRE.screenFrom … screenTo, 24°), 2.1 m to its centre. The picture's light reaches the room
 * on every tier as additive washes in the film's current colour (`kilnFilmSpill`): a halo on the
 * wall round the frame, a pool thrown up the vault and along the floor, a soft glow on the back
 * wall under the projection port. Amber aisle pucks with floor pools and a toe-kick glow before each
 * row are always on, so the rows read in the dark. Medium and up also add ONE screen-spill
 * RectAreaLight, mounted for the whole visit with its intensity at 0 outside the theatre (a
 * light that came and went would recompile every material). Reduced motion: each chapter is a
 * single still frame and the lights change without fades.
 *
 * Local space: origin on the screen's centre line at floor level, front (+z) towards the drum
 * centre (rotationDeg = facingIn(THEATRE.axisDeg)).
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG, polar, type Vec3 } from '../config/museum'
import { SAT_WALL, satellite, THEATRE } from '../config/satellites'
import { VIDEOS } from '../config/videos'
import { LIGHTING } from '../config/lighting'
import { KILN_FILM_CHAPTERS, KILN_FILM_SPILL, kilnFilmMaterial, kilnFilmSpill, kilnFilmTitles } from '../media/projection/kilnFilm'
import { useLang } from '../i18n'
import { ensureWallFonts } from '../materials/wallGraphics'
import { ProjectionTarget } from '../media/projection/projectionTarget'
import { registerSpot, type SpotRequest } from '../lighting/SpotPool'
import { isZoneVisible } from '../navigation/zoneCulling'
import { fireCue, useCue } from '../spectacle/cues'
import { useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { InMuseumScene } from './sceneContext'
import { useModelMaterials } from './modelMaterials'
import { num, type ModelProps } from './types'

/** Live state of the house, read by the theatre's architecture (vault firing, cove) each frame. */
export const theatreHouseState = {
  /** 0 … 1 ember glow in the vault's joints. */
  firing: 0,
  /** 0 … 1 house light level (1 = up). */
  house: 1,
  phase: 'film' as 'firing' | 'dimming' | 'film',
  /** 0 … 4 while the film runs. */
  chapter: 0,
  /** What the screen spills on the room: colour × level (linear, 0 … ~1.3), read by the vault each frame. */
  spill: new THREE.Color(0, 0, 0),
}

const CH = KILN_FILM_CHAPTERS

/** Screen: centre height, curve radius (a hand's breadth off the wall face) and span. */
export const THEATRE_SCREEN = {
  centerY: 2.1,
  r: SAT_WALL.outerFace - 0.07,
  fromDeg: THEATRE.screenFrom,
  toDeg: THEATRE.screenTo,
}

/** A confirmed (non-placeholder) film configured on the theatre screen replaces the Kiln Film. */
const realFilm = () => VIDEOS.some((v) => v.placement.surface === 'th-screen' && !v.placeholder && !!v.src)

/** Curved panel in local space: a band of the circle (radius R round local (0, 0, cz)) from −half … +half (rad), y0 … y1. */
function curvedBand(R: number, cz: number, half: number, y0: number, y1: number, segs: number, facing: 1 | -1 = 1) {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const t = -half + (2 * half * i) / segs
    const x = R * Math.sin(t)
    const z = cz - R * Math.cos(t)
    const nx = -Math.sin(t) * facing
    const nz = Math.cos(t) * facing
    for (const [y, v] of [
      [y0, 0],
      [y1, 1],
    ]) {
      pos.push(x, y, z)
      nor.push(nx, 0, nz)
      uv.push(i / segs, v)
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2
    if (facing === 1) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** Local point on the drum's polar grid: radius R, angle t (rad) off the theatre axis, height y. */
const L = (R: number, t: number, y: number, cz: number): [number, number, number] => [R * Math.sin(t), y, cz - R * Math.cos(t)]

/**
 * A light-wash sheet: an (nu × nv) grid of points from `at(u, v)` (u, v in 0 … 1) whose vertex
 * colours carry the falloff `w(u, v)` (0 … 1). Drawn additively in the screen's colour, it is the
 * picture's light on the room without a light (so on every tier, and no material recompiles).
 */
function washGrid(nu: number, nv: number, at: (u: number, v: number) => [number, number, number], w: (u: number, v: number) => number) {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = i / nu
      const v = j / nv
      pos.push(...at(u, v))
      const k = Math.max(0, Math.min(1, w(u, v)))
      col.push(k, k, k)
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i
      idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** Merge wash grids (position + color + index) into one geometry; the parts are disposed. */
function mergeGeos(gs: THREE.BufferGeometry[]) {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  let base = 0
  for (const g of gs) {
    const p = g.getAttribute('position')
    const c = g.getAttribute('color')
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      col.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    const ix = g.getIndex()
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base)
    base += p.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  out.setIndex(idx)
  out.computeBoundingSphere()
  return out
}

/** The barrel vault's soffit height at radius R (architecture/Satellites.tsx `vault`, same constants). */
function vaultY(R: number) {
  const s = satellite('theatre')
  const half = (SAT_WALL.outerFace - SAT_WALL.innerFace) / 2
  const rise = (s.vaultApex ?? s.height + 0.6) - s.height
  const Rv = (half * half + rise * rise) / (2 * rise)
  const rm = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2
  return s.height + Math.sqrt(Math.max(0, Rv * Rv - (R - rm) * (R - rm))) - (Rv - rise)
}

/** Half-angle (rad) of a seat row about the axis (0.6 m a place, config/spectacleObjects/rooms.ts). */
const rowHalf = (r: { r: number; seats: number }) => (r.seats * 0.6) / 2 / r.r

/** World points of the house lights: over each row's middle and its two ends, and over the lobby. */
function houseLights(): { from: Vec3; to: Vec3 }[] {
  const y = 4.85
  const rows = (THEATRE.rows[0].r + THEATRE.rows[1].r) / 2 + 0.35
  const list: [number, number][] = [
    [rows, THEATRE.axisDeg],
    [rows, THEATRE.axisDeg - 9],
    [rows, THEATRE.axisDeg + 9],
    [11.6, THEATRE.baffle.aDeg + 6],
  ]
  return list.map(([r, a]) => {
    const [x, z] = polar(r, a)
    const [fx, fz] = polar(r - 0.4, a)
    return { from: [fx, y, fz], to: [x, 0.5, z] }
  })
}

export function TheatreHouse({ config }: ModelProps) {
  const inScene = useContext(InMuseumScene)
  const m = useModelMaterials()
  const sp = useSpectacle()
  const tier = useMuseum((s) => s.tier)
  const dimTo = num(config, 'dimTo', 0.38)
  const fadeSec = Math.max(0.2, num(config, 'fadeSec', 2))
  const firingSec = Math.max(2, num(config, 'firingSec', 20))
  const chapterSec = Math.max(4, num(config, 'chapterSec', 24))
  const kilnOn = config.props?.kilnFilm !== false && !realFilm()
  const [rtW, rtH, hz, octaves] = sp.caps.kilnFilmRT
  const still = sp.mode === 'still'
  const spill = tier !== 'low'

  // local frame: the drum centre lies at +z, |position| away
  const cz = Math.hypot(config.position[0], config.position[2])
  const S = THEATRE_SCREEN
  const half = ((S.toDeg - S.fromDeg) / 2) * DEG
  const width = 2 * S.r * Math.sin(half)
  const height = width / (rtW / rtH)
  const y0 = S.centerY - height / 2
  const y1 = S.centerY + height / 2

  const geo = useMemo(() => {
    const seg = 48
    return {
      screen: curvedBand(S.r, cz, half, y0, y1, seg),
      // the proscenium: a matt black border, then a raised oxblood clay frame
      mask: curvedBand(S.r + 0.012, cz, half + 0.16 / S.r, y0 - 0.12, y1 + 0.14, seg),
      frame: curvedBand(S.r + 0.03, cz, half + 0.62 / S.r, y0 - 0.55, y1 + 0.55, seg),
      lip: curvedBand(S.r - 0.004, cz, half + 0.19 / S.r, y0 - 0.15, y0 - 0.12, seg),
    }
  }, [S.r, cz, half, y0, y1])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const lang = useLang()
  const titles = useMemo(() => kilnFilmTitles(lang, rtW / rtH, ensureWallFonts()), [lang, rtW, rtH])
  useEffect(() => () => titles.dispose(), [titles])
  const film = useMemo(() => {
    const mat = kilnFilmMaterial(octaves, rtW / rtH)
    return new ProjectionTarget(mat, rtW, rtH)
  }, [octaves, rtW, rtH])
  useEffect(() => () => film.dispose(), [film])
  useEffect(() => {
    film.material.uniforms.uTitles.value = titles
    film.invalidate()
  }, [film, titles])
  // a projector's brightness: the picture reads as light in the dim house (not tone-mapped)
  const screenMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'kilnFilmScreen', map: film.texture, toneMapped: false, color: new THREE.Color(1.3, 1.26, 1.2) }), [film])
  useEffect(() => () => screenMat.dispose(), [screenMat])
  const maskMat = useMemo(() => new THREE.MeshStandardMaterial({ name: 'screenMask', color: '#0c0807', roughness: 1, metalness: 0, envMapIntensity: 0.1 }), [])
  const frameMat = m.oxblood
  useEffect(() => () => maskMat.dispose(), [maskMat])

  // the picture's light on the room: additive washes in the screen's colour (every tier)
  const washes = useMemo(() => {
    const sw = half
    const R0 = SAT_WALL.innerFace + 0.03
    const R1 = SAT_WALL.outerFace - 0.05
    const gauss = (d: number, s: number) => Math.exp(-(d * d) / (s * s))
    const outside = (a: number, lo: number, hi: number) => (a < lo ? lo - a : a > hi ? a - hi : 0)
    const wallTop = vaultY(R1) - 0.06
    // the wall round the screen: a halo just outside the frame
    const haloA = sw + 0.24
    const halo = washGrid(
      48,
      16,
      (u, v) => L(SAT_WALL.outerFace - 0.012, -haloA + 2 * haloA * u, 0.02 + v * wallTop, cz),
      (u, v) => {
        const t = -haloA + 2 * haloA * u
        const y = 0.02 + v * wallTop
        const dx = outside(Math.abs(t) * S.r, 0, sw * S.r + 0.6)
        const dy = outside(y, y0 - 0.6, y1 + 0.6)
        return dx === 0 && dy === 0 ? 0 : 0.28 * gauss(Math.hypot(dx, dy), 1.1)
      },
    )
    // the vault: the light thrown up and back along the barrel, falling off from the screen
    const vA = 0.42
    const vault = washGrid(
      40,
      24,
      (u, v) => {
        const R = R0 + (R1 - R0) * v
        return L(R, -vA + 2 * vA * u, vaultY(R) - 0.035, cz)
      },
      (u, v) => {
        const R = R0 + (R1 - R0) * v
        const t = -vA + 2 * vA * u
        const along = (S.r - R) / (S.r - R0)
        return (0.3 * gauss(along, 0.5) + 0.05) * gauss(outside(Math.abs(t), 0, sw * 0.6), 0.22) * Math.min(1, (R1 - R) * 3 + 0.4)
      },
    )
    // the floor in front of the screen
    const fA = 0.36
    const floor = washGrid(
      36,
      18,
      (u, v) => L(R0 + 0.3 + (R1 - R0 - 0.3) * v, -fA + 2 * fA * u, 0.012, cz),
      (u, v) => {
        const R = R0 + 0.3 + (R1 - R0 - 0.3) * v
        const t = -fA + 2 * fA * u
        const along = (S.r - R) / (S.r - R0)
        return 0.22 * gauss(along, 0.4) * gauss(outside(Math.abs(t), 0, sw * 0.8), 0.14)
      },
    )
    // the back wall, facing the picture
    const bA = 0.3
    const backTop = vaultY(R0) - 0.06
    const back = washGrid(
      24,
      12,
      (u, v) => L(SAT_WALL.innerFace + 0.012, -bA + 2 * bA * u, 0.02 + v * backTop, cz),
      (u, v) => {
        const t = -bA + 2 * bA * u
        const y = 0.02 + v * backTop
        return 0.1 * gauss(t / bA, 0.6) * gauss((y - 2.6) / 2.6, 0.8)
      },
    )
    // the projection booth's port, high in the back wall on the axis
    const port = L(SAT_WALL.innerFace + 0.03, 0, 4.7, cz)
    return { geos: { halo, vault, floor, back }, port }
  }, [cz, half, S.r, y0, y1])
  useEffect(() => () => Object.values(washes.geos).forEach((g) => g.dispose()), [washes])
  const washMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'theatreWash', vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, fog: false }), [])
  useEffect(() => () => washMat.dispose(), [washMat])
  const portMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'projectorPort', color: new THREE.Color(1.8, 1.6, 1.3), toneMapped: false }), [])
  useEffect(() => () => portMat.dispose(), [portMat])

  // aisle lights, always on so the rows read in the dark: amber pucks at each row's ends and down
  // both side aisles, each with its pool on the floor, and a toe-kick glow before every step
  const aisle = useMemo(() => {
    const rows = THEATRE.rows
    const pucks: [number, number, number][] = []
    const maxHalf = Math.max(...rows.map(rowHalf))
    for (const r of rows) for (const sg of [-1, 1]) pucks.push(L(r.r, sg * (rowHalf(r) + 0.3 / r.r), 0.01, cz))
    for (let R = SAT_WALL.innerFace + 0.8; R < S.r - 3.6; R += 0.8) for (const sg of [-1, 1]) pucks.push(L(R, sg * (maxHalf + 0.9 / R), 0.01, cz))
    const glows = rows.map((r) => {
      const h = rowHalf(r)
      return washGrid(24, 4, (u, v) => L(r.r + 0.3 + v * 0.45, -h + 2 * h * u, 0.014, cz), (u, v) => 0.3 * (1 - v) * (1 - v) * Math.min(1, Math.min(u, 1 - u) * 12))
    })
    const pools = pucks.map((p) => washGrid(12, 3, (u, v) => [p[0] + Math.cos(u * Math.PI * 2) * (0.04 + v * 0.45), 0.013, p[2] + Math.sin(u * Math.PI * 2) * (0.04 + v * 0.45)], (_u, v) => 0.35 * (1 - v) * (1 - v)))
    return { pucks, glow: mergeGeos([...glows, ...pools]) }
  }, [cz, S.r])
  useEffect(() => () => aisle.glow.dispose(), [aisle])
  const aisleMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'aisleGlow', color: '#ffb066', vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [])
  const puckMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'aislePuck', color: new THREE.Color(2.2, 1.35, 0.6), toneMapped: false }), [])
  useEffect(
    () => () => {
      aisleMat.dispose()
      puckMat.dispose()
    },
    [aisleMat, puckMat],
  )
  const puckRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const im = puckRef.current
    if (!im) return
    const mx = new THREE.Matrix4()
    aisle.pucks.forEach((p, i) => im.setMatrixAt(i, mx.makeTranslation(p[0], p[1], p[2])))
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [aisle])

  // house lights: SpotPool requests whose intensity follows the house level
  const lights = useRef<SpotRequest[]>([])
  useEffect(() => {
    if (!inScene) return
    const base = LIGHTING.track.artworkIntensity * 0.8
    const reqs: SpotRequest[] = houseLights().map((l) => ({ position: l.from, target: l.to, intensity: base, angle: 0.62, penumbra: 0.9, color: '#ffc58e', tag: 'theatre-house' }))
    lights.current = reqs
    const offs = reqs.map((r) => registerSpot(r))
    return () => {
      offs.forEach((f) => f())
      lights.current = []
    }
  }, [inScene])

  const spillRef = useRef<THREE.RectAreaLight>(null)
  const clock = useRef({ phase: 'film' as 'firing' | 'dimming' | 'film', t: 0, lastChapter: -1, house: 1, firing: 0 })

  const start = (phase: 'firing' | 'film', announce: boolean) => {
    const c = clock.current
    c.phase = phase
    c.t = 0
    c.lastChapter = -1
    if (phase === 'firing' && announce) fireCue('theatre:firing', { source: 'system', data: { from: 'theatre-house' } })
    if (phase === 'film') fireCue('theatre:kilnFilm', { source: 'system', data: { from: 'theatre-house' } })
    film.invalidate()
  }
  useCue('zone-first:theatre', () => start('firing', true))
  useCue('theatre:firing', (e) => {
    if ((e.data as { from?: string } | undefined)?.from !== 'theatre-house') start('firing', false)
  })
  useCue('theatre:kilnFilm', (e) => {
    const d = e.data as { from?: string; at?: number } | undefined
    if (d?.from === 'theatre-house') return
    start('film', false)
    // a docent (or the shot harness) may join the film part-way: `data.at` seconds in
    if (typeof d?.at === 'number' && d.at > 0) clock.current.t = Math.min(d.at, chapterSec * CH - 0.5)
  })

  useFrame(({ gl }, rawDt) => {
    if (!inScene) return
    // the programme keeps real time even on a slow device (a stall of over a second is skipped)
    const dt = rawDt > 1 ? 0 : rawDt
    const c = clock.current
    const seen = isZoneVisible('theatre')
    // the programme only advances while someone could see it
    if (seen) c.t += dt
    const filmLen = chapterSec * CH
    if (c.phase === 'firing' && c.t >= firingSec) {
      c.phase = 'dimming'
      c.t = 0
      fireCue('theatre:dim', { source: 'system', data: { from: 'theatre-house' } })
    } else if (c.phase === 'dimming' && c.t >= fadeSec) {
      start('film', true)
    } else if (c.phase === 'film') {
      const ch = Math.min(CH - 1, Math.floor(c.t / chapterSec))
      if (ch !== c.lastChapter) {
        if (c.lastChapter >= 0) fireCue('theatre:chapterEnd', { source: 'system', data: { chapter: c.lastChapter } })
        c.lastChapter = ch
      }
      if (c.t >= filmLen) {
        fireCue('theatre:chapterEnd', { source: 'system', data: { chapter: CH - 1 } })
        start('firing', true)
      }
    }
    // targets per phase
    let houseT: number
    let firingT: number
    if (c.phase === 'firing') {
      houseT = 0.55
      firingT = Math.min(1, c.t / (firingSec * 0.75))
      firingT = firingT * firingT * (3 - 2 * firingT)
    } else if (c.phase === 'dimming') {
      const k = Math.min(1, c.t / fadeSec)
      houseT = 0.55 + (dimTo - 0.55) * k
      firingT = 1 - k
    } else {
      houseT = c.t < filmLen - fadeSec ? dimTo : 1
      firingT = 0
    }
    if (still) {
      c.house = houseT
      c.firing = c.phase === 'firing' ? 1 : firingT
    } else {
      const ease = 1 - Math.exp(-dt * 3)
      c.house += (houseT - c.house) * ease
      c.firing = firingT
    }
    theatreHouseState.house = c.house
    theatreHouseState.firing = c.firing
    theatreHouseState.phase = c.phase
    theatreHouseState.chapter = c.phase === 'film' ? Math.min(CH - 1, Math.floor(c.t / chapterSec)) : 0
    const base = LIGHTING.track.artworkIntensity * 0.8
    for (const r of lights.current) r.intensity = base * c.house

    // the film: drawn only while the theatre can be seen. Between showings (the firing and the
    // dimming) the screen holds the lit poster; the film fades up from black and out at its end.
    const u = film.material.uniforms
    u.uChapterSec.value = chapterSec
    u.uStill.value = still ? 1 : 0
    const POSTER = 0.8
    let level: number
    if (c.phase === 'film') {
      u.uPoster.value = 0
      level = Math.min(1, c.t / 1.2, (filmLen - c.t) / 1.2)
      u.uTime.value = still ? (Math.floor(c.t / chapterSec) + 0.5) * chapterSec : c.t
    } else {
      u.uPoster.value = 1
      level = c.phase === 'dimming' ? POSTER * (1 - Math.min(1, c.t / fadeSec)) : POSTER
    }
    u.uLevel.value = Math.max(0.02, level)
    film.tick(gl, dt, still ? 2 : hz, seen && kilnOn)
    // what the picture spills on the room (the washes, the area light, the vault's joints)
    const sc = theatreHouseState.spill
    if (c.phase === 'film') kilnFilmSpill(c.t, chapterSec, sc)
    else sc.setRGB(...KILN_FILM_SPILL[CH])
    sc.multiplyScalar(kilnOn ? u.uLevel.value : 0)
    // the washes read most when the house is down
    washMat.color.copy(sc).multiplyScalar(0.55 + 0.45 * (1 - c.house))
    const l = spillRef.current
    if (l) {
      l.color.copy(sc)
      l.intensity = seen && kilnOn ? 14 : 0
    }
  })

  return (
    <group>
      <mesh geometry={geo.frame} material={frameMat} receiveShadow />
      <mesh geometry={geo.mask} material={maskMat} />
      <mesh geometry={geo.lip} material={m.brass} />
      {kilnOn && <mesh geometry={geo.screen} material={screenMat} />}
      {kilnOn && (
        <group>
          {Object.entries(washes.geos).map(([k, g]) => (
            <mesh key={k} geometry={g} material={washMat} raycast={() => null} renderOrder={2} />
          ))}
          {/* the projection booth's port in the back wall */}
          <mesh position={washes.port} rotation={[0, Math.PI, 0]} material={portMat} raycast={() => null}>
            <planeGeometry args={[0.34, 0.2]} />
          </mesh>
        </group>
      )}
      <mesh geometry={aisle.glow} material={aisleMat} raycast={() => null} renderOrder={2} />
      <instancedMesh key={aisle.pucks.length} ref={puckRef} args={[undefined, undefined, aisle.pucks.length]} material={puckMat} raycast={() => null}>
        <cylinderGeometry args={[0.045, 0.05, 0.02, 12]} />
      </instancedMesh>
      {spill && inScene && kilnOn && <rectAreaLight ref={spillRef} position={[0, S.centerY, cz - S.r + 0.25]} rotation={[0, Math.PI, 0]} width={width * 0.9} height={height * 0.9} intensity={0} />}
    </group>
  )
}
