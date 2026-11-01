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
 * THEATRE.screenFrom … screenTo, 24°), 2.1 m to its centre. Medium and up add ONE screen-spill
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
import { SAT_WALL, THEATRE } from '../config/satellites'
import { VIDEOS } from '../config/videos'
import { LIGHTING } from '../config/lighting'
import { kilnFilmMaterial } from '../media/projection/kilnFilm'
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
  /** 0 … 3 while the film runs. */
  chapter: 0,
}

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
  const dimTo = num(config, 'dimTo', 0.22)
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

  const film = useMemo(() => {
    const mat = kilnFilmMaterial(octaves, rtW / rtH)
    return new ProjectionTarget(mat, rtW, rtH)
  }, [octaves, rtW, rtH])
  useEffect(() => () => film.dispose(), [film])
  // lifted: the film's dark firing frames read as a lit screen in the dim house, never a red smudge
  const screenMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'kilnFilmScreen', map: film.texture, toneMapped: false, color: new THREE.Color(1.6, 1.5, 1.4) }), [film])
  useEffect(() => () => screenMat.dispose(), [screenMat])
  const maskMat = useMemo(() => new THREE.MeshStandardMaterial({ name: 'screenMask', color: '#0c0807', roughness: 1, metalness: 0, envMapIntensity: 0.1 }), [])
  const frameMat = m.oxblood
  useEffect(() => () => maskMat.dispose(), [maskMat])

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
    if ((e.data as { from?: string } | undefined)?.from !== 'theatre-house') start('film', false)
  })

  useFrame(({ gl }, rawDt) => {
    if (!inScene) return
    // the programme keeps real time even on a slow device (a stall of over a second is skipped)
    const dt = rawDt > 1 ? 0 : rawDt
    const c = clock.current
    const seen = isZoneVisible('theatre')
    // the programme only advances while someone could see it
    if (seen) c.t += dt
    const filmLen = chapterSec * 4
    if (c.phase === 'firing' && c.t >= firingSec) {
      c.phase = 'dimming'
      c.t = 0
      fireCue('theatre:dim', { source: 'system', data: { from: 'theatre-house' } })
    } else if (c.phase === 'dimming' && c.t >= fadeSec) {
      start('film', true)
    } else if (c.phase === 'film') {
      const ch = Math.min(3, Math.floor(c.t / chapterSec))
      if (ch !== c.lastChapter) {
        if (c.lastChapter >= 0) fireCue('theatre:chapterEnd', { source: 'system', data: { chapter: c.lastChapter } })
        c.lastChapter = ch
      }
      if (c.t >= filmLen) {
        fireCue('theatre:chapterEnd', { source: 'system', data: { chapter: 3 } })
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
    theatreHouseState.chapter = c.phase === 'film' ? Math.min(3, Math.floor(c.t / chapterSec)) : 0
    const base = LIGHTING.track.artworkIntensity * 0.8
    for (const r of lights.current) r.intensity = base * c.house

    // the film: drawn only while the theatre can be seen
    const u = film.material.uniforms
    u.uChapterSec.value = chapterSec
    u.uStill.value = still ? 1 : 0
    // between films the screen holds a dim poster frame: the fired vessel, cooled to oxblood
    const POSTER = 0.55
    const level = c.phase === 'film' ? Math.max(POSTER * Math.max(0, 1 - c.t / 0.8), Math.min(1, c.t / 1.2, (filmLen - c.t) / 1.2)) : c.phase === 'dimming' ? POSTER * (1 - Math.min(1, c.t / fadeSec)) : POSTER
    u.uLevel.value = Math.max(0.02, level)
    u.uTime.value = c.phase === 'film' && c.t > 0.8 ? (still ? (Math.floor(c.t / chapterSec) + 0.5) * chapterSec : c.t) : chapterSec * 4 - 1.8
    film.tick(gl, dt, still ? 2 : hz, seen && kilnOn)
    const l = spillRef.current
    if (l) {
      // the picture's warmth spills onto the seats and the vault
      const ch = theatreHouseState.chapter
      const tint = [
        [0.85, 0.55, 0.35],
        [0.95, 0.75, 0.6],
        [0.9, 0.55, 0.38],
        [1.0, 0.5, 0.2],
      ][ch]
      l.color.setRGB(tint[0], tint[1], tint[2])
      l.intensity = seen && kilnOn ? 6 * u.uLevel.value : 0
    }
  })

  return (
    <group>
      <mesh geometry={geo.frame} material={frameMat} receiveShadow />
      <mesh geometry={geo.mask} material={maskMat} />
      <mesh geometry={geo.lip} material={m.brass} />
      {kilnOn && <mesh geometry={geo.screen} material={screenMat} />}
      {spill && inScene && kilnOn && <rectAreaLight ref={spillRef} position={[0, S.centerY, cz - S.r + 0.25]} rotation={[0, Math.PI, 0]} width={width * 0.9} height={height * 0.9} intensity={0} />}
    </group>
  )
}
