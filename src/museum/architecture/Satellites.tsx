/**
 * THE FOUR CRESCENT ROOMS of the north wing (SPECTACLE §1, F23–F26): what the plaster Wall
 * leaves to its owner — the rooms' interior finishes, their ceilings and roofs, the theatre's
 * brick barrel vault and lobby baffle, the Haat's pierced lattice roof, the library's clerestory
 * and roof light, the Atlas's pendant, the door architraves and the room names over the doors.
 *
 *   shell (never culled; one <StaticMerge>)
 *     roofs ........ earth-sheltered (GRAND §2.7): planted meadow roofs over the Atlas and the
 *                    Library, a planted barrel over the theatre (to THEATRE vaultApex), the
 *                    Haat's open terracotta lattice in a planted rim; on the walk side a battered
 *                    rammed-earth fascia under a tiled coping; behind them one continuous earth
 *                    berm sloping down past the plinth's edge (so from above the north wing reads
 *                    as landscape terraces and the drum, annex and dome dominate); shrubs and
 *                    rooibos from the sourced library on High and Ultra; the Red Room's drum
 *                    rising through the Library's roof; fired-clay finials at the corners
 *     doors ........ an oxblood lacquer architrave round each door on the walk side, a lacquered
 *                    threshold, and a fired-clay name plaque above (i18n zone names)
 *   interiors (in their room's ZoneGroup)
 *     linings ...... a plaster skin 1 cm inside every room face (the Wall draws rammed earth on
 *                    both faces): dark lime in the Atlas, deep red in the theatre, warm clay in
 *                    the Library, limewash in the Haat; an oxblood skirting
 *     ceilings ..... lime soffits; the theatre's vault of hand-made brick whose joints glow
 *                    ember-orange as the house fires it (models/theatreHouse.tsx), with a warm cove
 *                    at the springing that dims with the house
 *
 * Lining faces stand 1 cm off the wall faces and every horizontal face is either inside a
 * volume or 1–2 mm clear of its neighbour, so nothing shares a plane (no z-fighting).
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ZoneId } from '../config/layout'
import { kelvinToHex } from '../config/lighting'
import { DEG, polar } from '../config/museum'
import { RED_ROOM, SAT_DOOR_HALF_DEG, SAT_WALL, satellite, SATELLITES, THEATRE, type SatelliteId, type SatelliteSpec } from '../config/satellites'
import { mulberry32 } from '../materials/noise'
import { applyPbr } from '../materials/pbrSets'
import { StaticMerge } from '../effects/StaticMerge'
import { translate, useLang } from '../i18n'
import { registerSpot } from '../lighting/SpotPool'
import { ambience } from '../lighting/timeOfDayState'
import { jaali, roofTile, vaultBrick } from '../materials/brickTextures'
import { useMaterials } from '../materials/materials'
import { ensureWallFonts } from '../materials/wallGraphics'
import { lathe } from '../models/kit'
import { tinted } from '../models/modelMaterials'
import { theatreHouseState } from '../models/theatreHouse'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { cylinderFace, FaceBuilder, mergeAll, planFace } from './shellGeometry'
import { SourcedInstances, type Planting } from './sourcedInstances'

const S = SAT_WALL
/** Lining offset off each wall face, into the room. */
const LINE = 0.01
/** Roof: slab thickness, overhang past the outer faces. */
export const SAT_ROOF = { thick: 0.22, over: 0.16, coping: { batter: 0.35, w: 0.32, rise: 0.18 } }
/** Where the Red Room's drum passes through the Library's ceiling and roof (its outer face, a hair clear). */
export const LIBRARY_ROOF_LIGHT = { r: Math.hypot(RED_ROOM.cx, RED_ROOM.cz), aDeg: RED_ROOM.aDeg, radius: RED_ROOM.r + RED_ROOM.t + 0.01 }
/**
 * The berm behind the crescents: how far it runs out past the rooms' outer wall, and its end ramps
 * (deg). Beyond the plinth's edge each end ramp flares by up to `flareDeg` as the berm runs out, so
 * the mound's ends roll away into the land as long shoulders, never a pyramid's ridge.
 */
export const CRESCENT_BERM = { run: 15, rampDeg: 7, flareDeg: 16 } as const

/* ------------------------------------------------------------------ */
/* Geometry helpers (world space, plan angles in radians)              */
/* ------------------------------------------------------------------ */

const P3 = (r: number, a: number, y: number) => [r * Math.cos(a), y, r * Math.sin(a)]

/** Annular sector at height y with polar UVs (u = metres along the arc at r, v = metres across). */
export function polarBand(r0: number, r1: number, a0: number, a1: number, y: number, up: boolean, chord = 0.3): THREE.BufferGeometry | null {
  const f = new FaceBuilder()
  const n = Math.max(1, Math.ceil(((a1 - a0) * r1) / chord))
  const N = [0, up ? 1 : -1, 0]
  const rm = (r0 + r1) / 2
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n
    const q = [P3(r0, t0, y), P3(r1, t0, y), P3(r1, t1, y), P3(r0, t1, y)]
    const u = [
      [t0 * rm, r0],
      [t0 * rm, r1],
      [t1 * rm, r1],
      [t1 * rm, r0],
    ]
    // seen from above, r0→r1 then t0→t1 turns clockwise for increasing angle (x→z is clockwise on screen)
    if (up) f.quad([q[0], q[3], q[2], q[1]], [N, N, N, N], [u[0], u[3], u[2], u[1]])
    else f.quad(q, [N, N, N, N], u)
  }
  return f.build()
}

/**
 * A segmental barrel over the annulus r0 → r1 (a0 → a1): y = y0 + rise at mid-span. `down` for
 * the soffit (seen from inside), up for the extrados. UVs: u = metres along the arc at mid-span,
 * v = metres across the arch.
 */
function vault(r0: number, r1: number, a0: number, a1: number, y0: number, rise: number, down: boolean, chord = 0.3, across = 16) {
  const f = new FaceBuilder()
  const n = Math.max(1, Math.ceil(((a1 - a0) * r1) / chord))
  const half = (r1 - r0) / 2
  const R = (half * half + rise * rise) / (2 * rise)
  const rm = (r0 + r1) / 2
  // points across the arch: radius, height, normal (radial, up) and arc length
  const prof: { r: number; y: number; nr: number; ny: number; s: number }[] = []
  let s = 0
  for (let k = 0; k <= across; k++) {
    const x = -half + (2 * half * k) / across
    const y = y0 + Math.sqrt(R * R - x * x) - (R - rise)
    if (k > 0) s += Math.hypot(x - (prof[k - 1].r - rm), y - prof[k - 1].y)
    const nr = x / R
    const ny = Math.sqrt(Math.max(0, 1 - nr * nr))
    prof.push({ r: rm + x, y, nr, ny, s })
  }
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n
    for (let k = 0; k < across; k++) {
      const A = prof[k]
      const B = prof[k + 1]
      const nrm = (p: typeof A, t: number) => (down ? [-p.nr * Math.cos(t), -p.ny, -p.nr * Math.sin(t)] : [p.nr * Math.cos(t), p.ny, p.nr * Math.sin(t)])
      const q = [P3(A.r, t0, A.y), P3(B.r, t0, B.y), P3(B.r, t1, B.y), P3(A.r, t1, A.y)]
      const nn = [nrm(A, t0), nrm(B, t0), nrm(B, t1), nrm(A, t1)]
      const uv = [
        [t0 * rm, A.s],
        [t0 * rm, B.s],
        [t1 * rm, B.s],
        [t1 * rm, A.s],
      ]
      if (down) f.quad(q, nn, uv)
      else f.quad([q[0], q[3], q[2], q[1]], [nn[0], nn[3], nn[2], nn[1]], [uv[0], uv[3], uv[2], uv[1]])
    }
  }
  return { geo: f.build(), height: (r: number) => y0 + Math.sqrt(Math.max(0, R * R - (r - rm) * (r - rm))) - (R - rise) }
}

/**
 * A flat polygon in the radial plane at plan angle a (radians), shifted `off` metres along the
 * tangent (+ = towards larger angles), facing +tangent (`facing` 1) or −tangent (−1). The
 * outline is [r, y] points, counter-clockwise seen from the +tangent side.
 */
function radialPoly(a: number, off: number, pts: [number, number][], facing: 1 | -1) {
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const P = ([r, y]: [number, number]) => [r * Math.cos(a) + tx * off, y, r * Math.sin(a) + tz * off]
  const list = facing === 1 ? pts : [...pts].reverse()
  const f = new FaceBuilder()
  f.poly(
    list.map(P),
    [tx * facing, 0, tz * facing],
    list.map(([r, y]) => [r * facing, y]),
  )
  return f.build()
}

/** A rectangle in the radial plane (r0 → r1, y0 → y1). */
const radialQuad = (a: number, off: number, r0: number, r1: number, y0: number, y1: number, facing: 1 | -1) =>
  radialPoly(
    a,
    off,
    [
      [r1, y0],
      [r1, y1],
      [r0, y1],
      [r0, y0],
    ],
    facing,
  )

/** The four faces of a room's interior (a little off the walls), with its door left open. */
function roomLiningFaces(s: SatelliteSpec, y0: number, y1: number) {
  const a0 = s.fromDeg * DEG
  const a1 = s.toDeg * DEG
  const d0 = (s.doorDeg - SAT_DOOR_HALF_DEG) * DEG
  const d1 = (s.doorDeg + SAT_DOOR_HALF_DEG) * DEG
  const inR = S.innerFace + LINE
  const outR = S.outerFace - LINE
  const endOff = S.t / 2 + LINE
  const door = { a0: d0, a1: d1, y0: Math.min(y0, 0) - 1, y1: S.door.height }
  return mergeAll([
    cylinderFace(0, 0, inR, a0, a1, y0, y1, 'out', y0 < S.door.height ? [door] : []),
    cylinderFace(0, 0, outR, a0, a1, y0, y1, 'in'),
    radialQuad(a0, endOff, S.innerFace, S.outerFace, y0, y1, 1),
    radialQuad(a1, -endOff, S.innerFace, S.outerFace, y0, y1, -1),
  ])
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

/** Interior plaster per room: dark lime, deep red, warm clay, limewash. */
const ROOM_FINISH: Record<SatelliteId, { wall: string; ceiling: string }> = {
  // the Atlas: pale lime plaster in a neutral light, so the map and the partners read true
  atlas: { wall: '#ddd5c8', ceiling: '#cbc2b4' },
  theatre: { wall: '#5e2520', ceiling: '#4a1d19' },
  library: { wall: '#cfb08e', ceiling: '#eadbc8' },
  shop: { wall: '#f1e8da', ceiling: '#efe6d8' },
}

type NorthWingMaterials = ReturnType<typeof buildNorthWingMaterials>
const wingCache = new WeakMap<object, Map<number, NorthWingMaterials>>()

/** The north wing's materials, one set per tier (shared by every room, so the house can drive them). */
function useNorthWingMaterials(): NorthWingMaterials {
  const m = useMaterials()
  const tier = useMuseum((st) => st.tier)
  const px = useSpectacle().caps.spectacleTexPx
  return useMemo(() => {
    let byPx = wingCache.get(m)
    if (!byPx) wingCache.set(m, (byPx = new Map()))
    let set = byPx.get(px)
    if (!set) {
      set = buildNorthWingMaterials(m, px)
      // the meadow takes Ground054 where the tier loads it, tinted to the landscape's meadow green
      // (over the soil's warm albedo) so the earth-sheltered wing disappears into the land
      if (applyPbr(set.meadow, 'Ground054', tier, { tile: 3 })) set.meadow.color.set('#a3b465')
      byPx.set(px, set)
    }
    return set
  }, [m, px, tier])
}

function buildNorthWingMaterials(m: ReturnType<typeof useMaterials>, px: number) {
  const walls = Object.fromEntries(SATELLITES.map((s) => [s.id, tinted(m.limePlasterWarm, ROOM_FINISH[s.id].wall, { roughness: 0.93 })])) as Record<SatelliteId, THREE.Material>
  const ceilings = Object.fromEntries(SATELLITES.map((s) => [s.id, tinted(m.clayCeiling, ROOM_FINISH[s.id].ceiling, { roughness: 0.95 })])) as Record<SatelliteId, THREE.Material>
  const tiles = roofTile(Math.min(1024, px))
  const roof = new THREE.MeshStandardMaterial({ name: 'satRoofTile', map: tiles.map, normalMap: tiles.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.82, envMapIntensity: 0.4 })
  const brick = vaultBrick(Math.min(1024, px))
  const vaultMat = new THREE.MeshStandardMaterial({
    name: 'agniVault',
    map: brick.map,
    normalMap: brick.normalMap,
    // a softer relief: the fine joints moiréd at a distance
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.92,
    envMapIntensity: 0.35,
    emissive: new THREE.Color('#ff5a1c'),
    emissiveMap: brick.jointMap,
    emissiveIntensity: 0,
  })
  const lattice = jaali(px >= 1024 ? 512 : 256, 'haat')
  const latticeMat = new THREE.MeshStandardMaterial({ name: 'haatLattice', color: '#b3623f', alphaMap: lattice, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.88, envMapIntensity: 0.4 })
  const latticeDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: lattice, alphaTest: 0.5 })
  const clere = jaali(256, 'clerestory')
  const clerestory = new THREE.MeshStandardMaterial({ name: 'libraryClerestory', color: '#a9704f', roughness: 0.9, emissive: new THREE.Color('#ffe2b8'), emissiveMap: invertedMask(clere), emissiveIntensity: 1.2 })
  const cove = new THREE.MeshStandardMaterial({ name: 'satCove', color: '#f3d2b4', emissive: new THREE.Color('#ff9a5a'), emissiveIntensity: 1.2, roughness: 0.7 })
  // the planted roofs and the berm: Ground054 tinted to the landscape's meadow green (its own copy, so the
  // library's maps reach it when they arrive)
  const soil = m.groundSoil as THREE.MeshStandardMaterial
  const meadow = new THREE.MeshStandardMaterial({ name: 'crescentMeadow', color: '#7f8d4e', map: soil.map, normalMap: soil.normalMap, normalScale: new THREE.Vector2(1, 1), roughnessMap: soil.roughnessMap, roughness: 1, envMapIntensity: 0.3 })
  const pendant = new THREE.MeshStandardMaterial({ name: 'atlasPendant', color: '#f6f3ee', emissive: new THREE.Color(kelvinToHex(4000)), emissiveIntensity: 2.2, roughness: 0.5 })
  const skylight = new THREE.MeshStandardMaterial({ name: 'libSkylight', color: '#eef3f6', emissive: new THREE.Color('#e9f1ff'), emissiveIntensity: 1.4, roughness: 0.2 })
  const dapple = new THREE.MeshBasicMaterial({ name: 'haatDapple', color: '#ffd7a4', alphaMap: softDapple(), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 })
  // the scrim over the lattice: a warm glow through the stars (never a view of blue sky), the
  // sun's light softened by it, so the floor takes a soft dapple (HaatDapple), not a disco grid
  const scrim = new THREE.MeshBasicMaterial({ name: 'haatScrim', color: '#ffcf96', side: THREE.FrontSide })
  return { m, walls, ceilings, roof, meadow, vault: vaultMat, lattice: latticeMat, latticeDepth, clerestory, cove, pendant, skylight, dapple, scrim }
}

const maskCache = new Map<THREE.Texture, THREE.CanvasTexture>()
/** The lattice's holes as white (for an emissive "light through the holes" map). */
/**
 * The Haat's floor dapple: soft, irregular pools of light (as through a scrimmed jali), drawn as
 * blurred blobs of uneven size and strength on a tiling canvas; white = light.
 */
let dappleTex: THREE.CanvasTexture | null = null
function softDapple(): THREE.CanvasTexture {
  if (dappleTex) return dappleTex
  const N = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const g = cv.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, N, N)
  let seed = 917
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 46; i++) {
    const x = rnd() * N
    const y = rnd() * N
    const r = 14 + rnd() * 46
    const a = 0.18 + rnd() * 0.5
    // drawn at the wrap offsets too, so the tile repeats without a seam
    for (const dx of [-N, 0, N])
      for (const dy of [-N, 0, N]) {
        const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
        grd.addColorStop(0, `rgba(255,255,255,${a})`)
        grd.addColorStop(0.55, `rgba(255,255,255,${a * 0.55})`)
        grd.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grd
        g.beginPath()
        g.ellipse(x + dx, y + dy, r, r * (0.6 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2)
        g.fill()
      }
  }
  dappleTex = new THREE.CanvasTexture(cv)
  dappleTex.wrapS = dappleTex.wrapT = THREE.RepeatWrapping
  // one tile every 3.2 m (the floor band's UVs are metres)
  dappleTex.repeat.set(1 / 3.2, 1 / 3.2)
  return dappleTex
}

function invertedMask(t: THREE.Texture): THREE.CanvasTexture {
  const hit = maskCache.get(t)
  if (hit) return hit
  const src = t.image as HTMLCanvasElement
  const cv = document.createElement('canvas')
  cv.width = src.width
  cv.height = src.height
  const ctx = cv.getContext('2d')!
  ctx.filter = 'invert(1)'
  ctx.drawImage(src, 0, 0)
  const out = new THREE.CanvasTexture(cv)
  out.wrapS = out.wrapT = THREE.RepeatWrapping
  out.repeat.copy(t.repeat)
  out.colorSpace = THREE.SRGBColorSpace
  maskCache.set(t, out)
  return out
}

/* ------------------------------------------------------------------ */
/* Shell: roofs, doors (never culled)                                  */
/* ------------------------------------------------------------------ */

/** A sloping (battered) face along the arc as it leans back from r0 to r1, rising y0 → y1, facing the walk. */
function batter(r0: number, r1: number, a0: number, a1: number, y0: number, y1: number) {
  const f = new FaceBuilder()
  const n = Math.max(2, Math.ceil(((a1 - a0) * r0) / 0.3))
  const len = Math.hypot(r1 - r0, y1 - y0)
  const nr = -(y1 - y0) / len
  const ny = (r1 - r0) / len
  const P = (r: number, t: number, y: number) => [r * Math.cos(t), y, r * Math.sin(t)]
  const N = (t: number) => [nr * Math.cos(t), ny, nr * Math.sin(t)]
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n
    // seen from the walk (looking away from the drum), increasing angle runs to the left
    f.quad([P(r0, t1, y0), P(r0, t0, y0), P(r1, t0, y1), P(r1, t1, y1)], [N(t1), N(t0), N(t0), N(t1)], [
      [-t1 * r0, 0],
      [-t0 * r0, 0],
      [-t0 * r0, len],
      [-t1 * r0, len],
    ])
  }
  return f.build()
}

/** The planted top of a flat crescent roof (the Library's cut round the Red Room's drum). */
function plantedTop(s: SatelliteSpec, r0: number, r1: number, a0: number, a1: number, y: number) {
  if (s.id !== 'library') return polarBand(r0, r1, a0, a1, y, true)
  const outline: [number, number][] = []
  const N = 48
  for (let i = 0; i <= N; i++) outline.push([r0 * Math.cos(a0 + ((a1 - a0) * i) / N), r0 * Math.sin(a0 + ((a1 - a0) * i) / N)])
  for (let i = N; i >= 0; i--) outline.push([r1 * Math.cos(a0 + ((a1 - a0) * i) / N), r1 * Math.sin(a0 + ((a1 - a0) * i) / N)])
  const L = LIBRARY_ROOF_LIGHT
  const [cx, cz] = polar(L.r, L.aDeg)
  const hole: [number, number][] = []
  for (let i = 0; i < 64; i++) hole.push([cx + L.radius * Math.cos((-i / 64) * Math.PI * 2), cz + L.radius * Math.sin((-i / 64) * Math.PI * 2)])
  return planFace(outline, y, true, [hole])
}

function roofParts(s: SatelliteSpec) {
  const a0 = (s.fromDeg - (SAT_ROOF.over / S.outerOuter) / DEG) * DEG
  const a1 = (s.toDeg + (SAT_ROOF.over / S.outerOuter) / DEG) * DEG
  const r0 = S.innerC - S.t / 2 - SAT_ROOF.over
  const r1 = S.outerOuter + SAT_ROOF.over
  const h = s.height
  const tile: (THREE.BufferGeometry | null)[] = []
  const fascia: (THREE.BufferGeometry | null)[] = []
  const soffit: (THREE.BufferGeometry | null)[] = []
  const lattice: (THREE.BufferGeometry | null)[] = []
  const meadow: (THREE.BufferGeometry | null)[] = []
  const earth: (THREE.BufferGeometry | null)[] = []
  const T = SAT_ROOF.thick
  const cop = SAT_ROOF.coping
  // the planted surface starts behind the coping
  const rp = r0 + cop.batter + cop.w
  // the walk side: a battered rammed-earth fascia leaning back to a tiled coping
  earth.push(batter(r0, r0 + cop.batter, a0, a1, h - 0.25, h + T + cop.rise))
  tile.push(polarBand(r0 + cop.batter, rp, a0, a1, h + T + cop.rise, true), cylinderFace(0, 0, rp, a0, a1, h + T, h + T + cop.rise, 'in'))
  // the outer edge, behind the berm
  earth.push(cylinderFace(0, 0, r1, a0, a1, h, h + T + 0.002, 'out'))
  if (s.id === 'theatre') {
    // a planted barrel over the vault, springing at the wall tops, gables below it
    const rise = (s.vaultApex ?? h + 0.6) - h
    const ext = vault(rp, r1, a0, a1, h + T, rise * ((r1 - rp) / (S.outerFace - S.innerFace)) * 0.92, false)
    meadow.push(ext.geo)
    for (const [a, sign] of [
      [a0, -1],
      [a1, 1],
    ] as const) {
      const pts: [number, number][] = []
      const N = 16
      for (let k = 0; k <= N; k++) {
        const r = r1 - ((r1 - rp) * k) / N
        pts.push([r, ext.height(r)])
      }
      pts.push([rp, h], [r1, h])
      // gable end: counter-clockwise seen from +tangent; it faces out (−tangent at the start, +tangent at the end)
      earth.push(radialPoly(a, 0, pts, sign))
    }
    earth.push(radialQuad(a0, 0, r0, rp, h, h + T, -1), radialQuad(a1, 0, r0, rp, h, h + T, 1))
    soffit.push(polarBand(r0, S.innerC - S.t / 2, a0, a1, h, false), polarBand(S.outerOuter, r1, a0, a1, h, false))
  } else if (s.id === 'shop') {
    // the Haat: an open lattice slab (two pierced faces) in a planted rim
    const rim = 0.3
    lattice.push(polarBand(S.innerFace, S.outerFace, a0 + rim / S.outerFace, a1 - rim / S.outerFace, h + 0.12, true), polarBand(S.innerFace, S.outerFace, a0 + rim / S.outerFace, a1 - rim / S.outerFace, h + 0.004, false))
    meadow.push(polarBand(rp, S.innerFace, a0, a1, h + T, true), polarBand(S.outerFace, r1, a0, a1, h + T, true))
    meadow.push(polarBand(S.innerFace, S.outerFace, a0, a0 + rim / S.outerFace, h + T, true), polarBand(S.innerFace, S.outerFace, a1 - rim / S.outerFace, a1, h + T, true))
    earth.push(radialQuad(a0, 0, r0, r1, h, h + T, -1), radialQuad(a1, 0, r0, r1, h, h + T, 1))
    // the rim's inner edges, round the opening
    const ia0 = a0 + rim / S.outerFace
    const ia1 = a1 - rim / S.outerFace
    fascia.push(cylinderFace(0, 0, S.innerFace, ia0, ia1, h, h + T, 'out'), cylinderFace(0, 0, S.outerFace, ia0, ia1, h, h + T, 'in'), radialQuad(ia0, 0, S.innerFace, S.outerFace, h, h + T, 1), radialQuad(ia1, 0, S.innerFace, S.outerFace, h, h + T, -1))
    soffit.push(polarBand(r0, S.innerC - S.t / 2, a0, a1, h, false), polarBand(S.outerOuter, r1, a0, a1, h, false))
  } else {
    // a flat planted roof (the Library's cut round the Red Room's drum, which rises through it)
    meadow.push(plantedTop(s, rp, r1, a0, a1, h + T))
    earth.push(radialQuad(a0, 0, r0, r1, h, h + T, -1), radialQuad(a1, 0, r0, r1, h, h + T, 1))
    soffit.push(polarBand(r0, S.innerC - S.t / 2, a0, a1, h, false), polarBand(S.outerOuter, r1, a0, a1, h, false))
  }
  return { tile, fascia, soffit, lattice, meadow, earth }
}

/** Height of the berm's crest at plan angle aDeg: the rooms' roofs, ramping down at both ends. */
export function bermCrest(aDeg: number, rampDeg: number = CRESCENT_BERM.rampDeg): number {
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const from = rooms[0].fromDeg
  const to = rooms[rooms.length - 1].toDeg
  const room = rooms.find((r) => aDeg >= r.fromDeg - 1 && aDeg <= r.toDeg + 1)
  const top = (room ? room.height : 6) + SAT_ROOF.thick - 0.05
  const ramp = Math.min(1, Math.max(0, (aDeg - from + rampDeg) / rampDeg), Math.max(0, (to + rampDeg - aDeg) / rampDeg))
  // a rounded shoulder (the square root of the smoothstep): the mound swells out of the ground and
  // rolls over into the roofs, never a straight-sided pyramid
  return top * Math.sqrt(ramp * ramp * (3 - 2 * ramp))
}

/** Height of the berm at plan radius r (its crest at the roofs' edge, easing down to the ground). */
export function bermY(aDeg: number, r: number): number {
  const r0 = S.outerOuter + SAT_ROOF.over
  const t = Math.min(1, Math.max(0, (r - r0) / CRESCENT_BERM.run))
  // the ends flare as the berm runs out (none at the plinth's edge, where the end mounds meet it)
  const fall = 1 - t * t * (3 - 2 * t)
  return bermCrest(aDeg, CRESCENT_BERM.rampDeg + CRESCENT_BERM.flareDeg * Math.sqrt(t)) * fall - 0.2 * t
}

/** The berm: one earth mound behind all four rooms (a grid in angle × radius). */
function bermGeometry() {
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const A0 = rooms[0].fromDeg - CRESCENT_BERM.rampDeg - CRESCENT_BERM.flareDeg
  const A1 = rooms[rooms.length - 1].toDeg + CRESCENT_BERM.rampDeg + CRESCENT_BERM.flareDeg
  // (starting 0.3 m in under the roofs' edge: it overlaps the end mounds there, so no seam of sky
  // shows between them along the ramps' crest)
  const r0 = S.outerOuter + SAT_ROOF.over - 0.3
  const nA = Math.ceil(A1 - A0) * 2
  const nR = 22
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nA; i++) {
    const a = A0 + ((A1 - A0) * i) / nA
    for (let j = 0; j <= nR; j++) {
      const r = r0 + (CRESCENT_BERM.run * j) / nR
      const [x, z] = polar(r, a)
      pos.push(x, bermY(a, r), z)
      uv.push(a * DEG * r0, r - r0)
    }
  }
  for (let i = 0; i < nA; i++)
    for (let j = 0; j < nR; j++) {
      const k = i * (nR + 1) + j
      idx.push(k, k + 1, k + nR + 1, k + 1, k + nR + 2, k + nR + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // the mound must face up: turn the winding if the computed normals point down
  const n = g.getAttribute('normal') as THREE.BufferAttribute
  if (n.getY(Math.floor(n.count / 2)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    g.setIndex(idx)
    g.computeVertexNormals()
  }
  g.computeBoundingSphere()
  return g
}

/**
 * The crescents' ends: the planted berm continues over each end wall, so the north wing finishes
 * in a mound, never a flat red slab beside a bare wedge. A grid over the ramp's angles from the
 * walk's wall line to the berm's foot: its crest the ramp's (full roof height against the end
 * wall, falling away in angle), its walk-side edge a steep battered face (the earth leaning back
 * from the wall line over 1.6 m), so it meets the ground cleanly where the Parikrama runs.
 */
const END_BATTER = 1.6
function endBerms(): THREE.BufferGeometry[] {
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const from = rooms[0].fromDeg
  const to = rooms[rooms.length - 1].toDeg
  const rIn = S.innerC - S.t / 2
  const rOut = S.outerOuter + SAT_ROOF.over
  const BATTER = END_BATTER
  const grid = (a0: number, a1: number) => {
    const nA = Math.max(4, Math.ceil(Math.abs(a1 - a0)) * 3)
    const nR = 18
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= nA; i++) {
      const a = a0 + ((a1 - a0) * i) / nA
      for (let j = 0; j <= nR; j++) {
        // a little past the roofs' edge, tucked under the main berm (no seam between the two)
        const r = rIn + ((rOut + 0.4 - rIn) * j) / nR
        const t = Math.min(1, Math.max(0, (r - rIn) / BATTER))
        const [x, z] = polar(r, a)
        const yIn = bermCrest(a) * t * t * (3 - 2 * t) - 0.04
        pos.push(x, r > rOut ? Math.min(yIn, bermY(a, r) - 0.04) : yIn, z)
        uv.push(a * DEG * rOut, r - rIn)
      }
    }
    for (let i = 0; i < nA; i++)
      for (let j = 0; j < nR; j++) {
        const k = i * (nR + 1) + j
        idx.push(k, k + 1, k + nR + 1, k + 1, k + nR + 2, k + nR + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    if (n.getY(Math.floor(n.count / 2)) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
      g.setIndex(idx)
      g.computeVertexNormals()
    }
    g.computeBoundingSphere()
    return g
  }
  // a hair inside each end wall, so the mound meets it with no seam
  return [grid(from - CRESCENT_BERM.rampDeg, from + 0.05), grid(to - 0.05, to + CRESCENT_BERM.rampDeg)]
}

/** Shrub and rooibos plantings over the roofs and the berm (High and Ultra), seeded. */
export function roofPlantings(count: number): { shrubs: Planting[]; rooibos: Planting[] } {
  const rnd = mulberry32(31)
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const shrubs: Planting[] = []
  const rooibos: Planting[] = []
  const cop = SAT_ROOF.coping
  const rp = S.innerC - S.t / 2 - SAT_ROOF.over + cop.batter + cop.w
  // a fifth of them on the end mounds, so the wing's ends are planted too
  const ends = Math.round(count * 0.2)
  const rIn = S.innerC - S.t / 2
  const rOut = S.outerOuter + SAT_ROOF.over
  for (let i = 0; i < ends; i++) {
    const east = rnd() < 0.5
    const edge = east ? rooms[rooms.length - 1].toDeg : rooms[0].fromDeg
    const aDeg = edge + (east ? 1 : -1) * (0.3 + rnd() * (CRESCENT_BERM.rampDeg - 1.2))
    // on the mound's back, clear of its battered walk-side face
    const r = rIn + 2 + rnd() * (rOut - rIn - 2.4)
    const t = Math.min(1, Math.max(0, (r - rIn) / END_BATTER))
    const y = bermCrest(aDeg) * t * t * (3 - 2 * t) - 0.08
    if (y < 0.2) continue
    const [x, z] = polar(r, aDeg)
    const p: Planting = { x, y, z, rot: rnd() * Math.PI * 2, scale: 0 }
    if (rnd() < 0.45) shrubs.push({ ...p, scale: 0.6 + rnd() * 0.5 })
    else rooibos.push({ ...p, scale: 1.5 + rnd() * 1.2 })
  }
  for (let i = 0; i < count - ends; i++) {
    const room = rooms[Math.floor(rnd() * rooms.length)]
    const onBerm = rnd() < 0.55
    const aDeg = room.fromDeg + 1 + rnd() * (room.toDeg - room.fromDeg - 2)
    let r: number
    let y: number
    if (onBerm) {
      r = S.outerOuter + SAT_ROOF.over + 0.4 + rnd() * (CRESCENT_BERM.run - 1.5)
      y = bermY(aDeg, r) - 0.05
    } else {
      // the Haat's lattice stays clear: its plants keep to the rim
      if (room.id === 'shop') r = rnd() < 0.5 ? rp + 0.2 + rnd() * 0.3 : S.outerFace + 0.1 + rnd() * 0.3
      else r = rp + 0.3 + rnd() * (S.outerOuter - rp)
      // the Library's roof stays clear round the Red Room's drum
      if (room.id === 'library' && Math.abs(aDeg - RED_ROOM.aDeg) < 10) continue
      // the theatre's planted barrel is left as a smooth mound
      if (room.id === 'theatre') continue
      y = room.height + SAT_ROOF.thick - 0.02
    }
    const [x, z] = polar(r, aDeg)
    const p: Planting = { x, y, z, rot: rnd() * Math.PI * 2, scale: 0 }
    if (rnd() < 0.4) shrubs.push({ ...p, scale: 0.55 + rnd() * 0.5 })
    else rooibos.push({ ...p, scale: 1.4 + rnd() * 1.2 })
  }
  return { shrubs, rooibos }
}

/** Fired-clay finials (kalash) at a roof's four corners. */
function finialGeometry() {
  return lathe(
    [
      [0, 0],
      [0.09, 0],
      [0.1, 0.03],
      [0.06, 0.06],
      [0.1, 0.14],
      [0.11, 0.2],
      [0.07, 0.27],
      [0.03, 0.3],
      [0.05, 0.33],
      [0.02, 0.4],
      [0, 0.42],
    ],
    20,
  )
}

/** Door architrave (walk side) and threshold for a satellite door. */
function doorParts(s: SatelliteSpec) {
  const d = s.doorDeg * DEG
  const half = SAT_DOOR_HALF_DEG * DEG
  const rFace = S.innerC - S.t / 2 - 0.004
  const w = 0.12 / rFace
  const hd = S.door.height
  const trim = mergeAll([
    // jamb trims either side and the head, standing 4 mm proud of the walk-side face
    cylinderFace(0, 0, rFace, d - half - w, d - half - 0.004 / rFace, 0, hd + 0.12, 'in'),
    cylinderFace(0, 0, rFace, d + half + 0.004 / rFace, d + half + w, 0, hd + 0.12, 'in'),
    cylinderFace(0, 0, rFace, d - half - 0.004 / rFace, d + half + 0.004 / rFace, hd, hd + 0.12, 'in'),
  ])
  const sill = polarBand(S.innerC - S.t / 2 - 0.08, S.innerC + S.t / 2 + 0.08, d - half, d + half, 0.004, true)
  return { trim, sill }
}

async function plaqueTexture(text: string): Promise<THREE.CanvasTexture> {
  await ensureWallFonts()
  const W = 1024
  const H = 220
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  // fired clay: a warm terracotta tile with a pressed border and the name in relief-light letters
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#b4613f')
  g.addColorStop(1, '#9c4f33')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(60,24,14,0.55)'
  ctx.lineWidth = 6
  ctx.strokeRect(14, 14, W - 28, H - 28)
  ctx.strokeStyle = 'rgba(255,214,170,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.fillStyle = '#f6e3cc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `500 ${Math.round(H * 0.42)}px "Cormorant Garamond", "Noto Serif Devanagari", "Noto Serif Bengali", Georgia, serif`
  ctx.shadowColor = 'rgba(40,14,8,0.6)'
  ctx.shadowOffsetY = 3
  ctx.shadowBlur = 4
  ctx.fillText(text, W / 2, H * 0.54, W * 0.88)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** The room's name over its door, on the walk side (between the door head and the pergola). */
function DoorPlaque({ s }: { s: SatelliteSpec }) {
  const lang = useLang()
  const text = translate(lang, `zone.${s.id}` as Parameters<typeof translate>[1])
  const tex = useAsyncTexture(() => plaqueTexture(text), [text])
  const geo = useMemo(() => {
    const d = s.doorDeg * DEG
    const w = 1.2 / S.innerC
    return cylinderFace(0, 0, S.innerC - S.t / 2 - 0.012, d - w / 2, d + w / 2, S.door.height + 0.03, S.door.height + 0.03 + (1.2 * 220) / 1024, 'in')
  }, [s.doorDeg])
  useEffect(() => () => geo?.dispose(), [geo])
  const mat = useMemo(() => (tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, envMapIntensity: 0.5 }) : null), [tex])
  useEffect(() => () => mat?.dispose(), [mat])
  if (!geo || !mat) return null
  // cylinderFace 'in' maps u = a·r (increasing angle to the right of a viewer facing the face):
  // flip u to 0…1 so the text reads left to right
  return <mesh geometry={plaqueUV(geo)} material={mat} raycast={() => null} />
}

/** Remap a narrow face's u to 0 … 1 (left → right) and v to 0 … 1 (bottom → top). */
function plaqueUV(g: THREE.BufferGeometry) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  let u0 = Infinity
  let u1 = -Infinity
  let v0 = Infinity
  let v1 = -Infinity
  for (let i = 0; i < uv.count; i++) {
    u0 = Math.min(u0, uv.getX(i))
    u1 = Math.max(u1, uv.getX(i))
    v0 = Math.min(v0, uv.getY(i))
    v1 = Math.max(v1, uv.getY(i))
  }
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - u0) / (u1 - u0), (uv.getY(i) - v0) / (v1 - v0))
  uv.needsUpdate = true
  return g
}

/** Shrubs and rooibos over the planted roofs and the berm (Medium up; a meadow alone on Low). */
function RoofPlanting() {
  const tier = useMuseum((st) => st.tier)
  const on = tier !== 'low'
  const sets = useMemo(() => roofPlantings(tier === 'ultra' ? 380 : tier === 'high' ? 170 : 110), [tier])
  if (!on) return null
  return (
    <group name="roof-planting">
      {/* LOD1 below Ultra (GRAND §10): seen from the forecourt and the parikrama, never at arm's length */}
      <SourcedInstances slug="ph-shrub-02" lod1={tier !== 'ultra'} items={sets.shrubs} castShadow />
      <SourcedInstances slug="ph-wild-rooibos-bush" lod1={tier !== 'ultra'} items={sets.rooibos} castShadow />
    </group>
  )
}

function SatelliteShell() {
  const mats = useNorthWingMaterials()
  const { m } = mats
  const parts = useMemo(() => {
    const tile: (THREE.BufferGeometry | null)[] = []
    const fascia: (THREE.BufferGeometry | null)[] = []
    const soffit: (THREE.BufferGeometry | null)[] = []
    const lattice: (THREE.BufferGeometry | null)[] = []
    const meadow: (THREE.BufferGeometry | null)[] = [bermGeometry(), ...endBerms()]
    const earth: (THREE.BufferGeometry | null)[] = []
    const trim: (THREE.BufferGeometry | null)[] = []
    const sill: (THREE.BufferGeometry | null)[] = []
    for (const s of SATELLITES) {
      const r = roofParts(s)
      tile.push(...r.tile)
      fascia.push(...r.fascia)
      soffit.push(...r.soffit)
      lattice.push(...r.lattice)
      meadow.push(...r.meadow)
      earth.push(...r.earth)
      const d = doorParts(s)
      trim.push(d.trim)
      sill.push(d.sill)
    }
    // finials at the copings' ends, on the walk side
    const fin = finialGeometry()
    const finials: THREE.BufferGeometry[] = []
    const cop = SAT_ROOF.coping
    const rc = S.innerC - S.t / 2 - SAT_ROOF.over + cop.batter + cop.w / 2
    for (const s of SATELLITES) {
      for (const a of [s.fromDeg, s.toDeg]) {
        const [x, z] = polar(rc, a + (a === s.fromDeg ? 0.5 : -0.5))
        finials.push(fin.clone().translate(x, s.height + SAT_ROOF.thick + cop.rise, z))
      }
    }
    fin.dispose()
    return {
      tile: mergeAll(tile),
      fascia: mergeAll(fascia),
      soffit: mergeAll(soffit),
      lattice: mergeAll(lattice),
      meadow: mergeAll(meadow),
      earth: mergeAll(earth),
      trim: mergeAll(trim),
      sill: mergeAll(sill),
      finials: mergeAll(finials),
    }
  }, [])
  useEffect(() => () => Object.values(parts).forEach((g) => g?.dispose()), [parts])
  return (
    <>
      <StaticMerge name="north-wing-shell">
        {parts.tile && <mesh geometry={parts.tile} material={mats.roof} castShadow receiveShadow />}
        {parts.fascia && <mesh geometry={parts.fascia} material={m.oxblood} castShadow receiveShadow />}
        {parts.soffit && <mesh geometry={parts.soffit} material={m.clayCeiling} receiveShadow />}
        {parts.trim && <mesh geometry={parts.trim} material={m.oxbloodLacquer} receiveShadow />}
        {parts.sill && <mesh geometry={parts.sill} material={m.oxbloodLacquer} receiveShadow />}
        {parts.finials && <mesh geometry={parts.finials} material={m.clayTerracotta} castShadow receiveShadow />}
        {parts.meadow && <mesh geometry={parts.meadow} material={mats.meadow} receiveShadow />}
        {parts.earth && <mesh geometry={parts.earth} material={m.rammedEarth} castShadow receiveShadow />}
      </StaticMerge>
      {parts.lattice && <mesh geometry={parts.lattice} material={mats.lattice} customDepthMaterial={mats.latticeDepth} castShadow receiveShadow />}
      <RoofPlanting />
      {SATELLITES.map((s) => (
        <DoorPlaque key={s.id} s={s} />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Interiors (culled with their rooms)                                 */
/* ------------------------------------------------------------------ */

/** Geometry of the theatre's vault soffit and its end lunettes, shared by the interior and tests. */
function theatreVault() {
  const s = satellite('theatre')
  const a0 = s.fromDeg * DEG
  const a1 = s.toDeg * DEG
  const rise = (s.vaultApex ?? s.height + 0.6) - s.height
  const v = vault(S.innerFace + LINE, S.outerFace - LINE, a0, a1, s.height, rise, true)
  const lunettes: (THREE.BufferGeometry | null)[] = []
  const endOff = S.t / 2 + LINE
  for (const [a, off, facing] of [
    [a0, endOff, 1],
    [a1, -endOff, -1],
  ] as const) {
    const pts: [number, number][] = [[S.outerFace, s.height - 0.002]]
    const N = 16
    for (let k = 0; k <= N; k++) {
      const r = S.outerFace - ((S.outerFace - S.innerFace) * k) / N
      pts.push([r, v.height(r) + 0.01])
    }
    pts.push([S.innerFace, s.height - 0.002])
    // counter-clockwise seen from +tangent; radialPoly turns it for the face looking −tangent
    lunettes.push(radialPoly(a, off, pts, facing))
  }
  return { soffit: v.geo, lunettes: mergeAll(lunettes) }
}

function RoomInterior({ s }: { s: SatelliteSpec }) {
  const mats = useNorthWingMaterials()
  const { m } = mats
  const geo = useMemo(() => {
    const h = s.height
    const walls = roomLiningFaces(s, 0.12, s.id === 'theatre' ? h - 0.002 : h - 0.004)
    const skirting = roomLiningFaces(s, 0, 0.12)
    let ceiling: THREE.BufferGeometry | null = null
    let lunettes: THREE.BufferGeometry | null = null
    const a0 = s.fromDeg * DEG
    const a1 = s.toDeg * DEG
    if (s.id === 'theatre') {
      const v = theatreVault()
      ceiling = v.soffit
      lunettes = v.lunettes
    } else if (s.id === 'library') {
      // a lime ceiling cut round the Red Room's drum, which rises through it
      const L = LIBRARY_ROOF_LIGHT
      const [cx, cz] = polar(L.r, L.aDeg)
      const holes: [number, number][] = []
      for (let i = 0; i < 48; i++) {
        const t = -(i / 48) * Math.PI * 2
        holes.push([cx + L.radius * Math.cos(t), cz + L.radius * Math.sin(t)])
      }
      const outline: [number, number][] = []
      const N = 40
      for (let i = 0; i <= N; i++) outline.push(polar(S.innerFace, s.fromDeg + ((s.toDeg - s.fromDeg) * i) / N))
      for (let i = N; i >= 0; i--) outline.push(polar(S.outerFace, s.fromDeg + ((s.toDeg - s.fromDeg) * i) / N))
      const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)))
      shape.holes.push(new THREE.Path(holes.map(([x, z]) => new THREE.Vector2(x, -z))))
      const g = new THREE.ShapeGeometry(shape, 1)
      g.rotateX(-Math.PI / 2)
      // a ceiling faces down: flip the winding and the normals
      const idx = g.getIndex()!
      for (let i = 0; i < idx.count; i += 3) {
        const t = idx.getX(i + 1)
        idx.setX(i + 1, idx.getX(i + 2))
        idx.setX(i + 2, t)
      }
      const n = g.getAttribute('normal') as THREE.BufferAttribute
      for (let i = 0; i < n.count; i++) n.setY(i, -1)
      g.translate(0, h - 0.004, 0)
      ceiling = g
    } else if (s.id === 'atlas') {
      ceiling = polarBand(S.innerFace, S.outerFace, a0, a1, h - 0.004, false)
    }
    return { walls, skirting, ceiling, lunettes }
  }, [s])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  return (
    <group name={`room-${s.id}`}>
      {geo.walls && <mesh geometry={geo.walls} material={mats.walls[s.id]} receiveShadow />}
      {geo.skirting && <mesh geometry={geo.skirting} material={m.oxbloodLacquer} receiveShadow />}
      {geo.ceiling && <mesh geometry={geo.ceiling} material={s.id === 'theatre' ? mats.vault : mats.ceilings[s.id]} receiveShadow />}
      {geo.lunettes && <mesh geometry={geo.lunettes} material={mats.walls[s.id]} receiveShadow />}
      {s.id === 'theatre' && <TheatreFittings />}
      {s.id === 'library' && <LibraryClerestory />}
      {s.id === 'atlas' && <AtlasPendant />}
      {s.id === 'shop' && <HaatDapple />}
      <RoomLights s={s} />
    </group>
  )
}

/** The theatre: the warm cove at the vault's springing, the lobby baffle; both follow the house. */
function TheatreFittings() {
  const mats = useNorthWingMaterials()
  const { m } = mats
  const s = satellite('theatre')
  const geo = useMemo(() => {
    const a0 = s.fromDeg * DEG
    const a1 = s.toDeg * DEG
    const y = s.height - 0.16
    const cove = mergeAll([cylinderFace(0, 0, S.innerFace + 0.03, a0, a1, y, y + 0.03, 'out'), cylinderFace(0, 0, S.outerFace - 0.03, a0, a1, y, y + 0.03, 'in')])
    // a ledge over each cove strip hides the source
    const ledge = mergeAll([polarBand(S.innerFace + LINE, S.innerFace + 0.09, a0, a1, y + 0.06, false), polarBand(S.innerFace + LINE, S.innerFace + 0.09, a0, a1, y + 0.06 + 0.04, true), cylinderFace(0, 0, S.innerFace + 0.09, a0, a1, y + 0.06, y + 0.1, 'out'), polarBand(S.outerFace - 0.09, S.outerFace - LINE, a0, a1, y + 0.06, false), polarBand(S.outerFace - 0.09, S.outerFace - LINE, a0, a1, y + 0.1, true), cylinderFace(0, 0, S.outerFace - 0.09, a0, a1, y + 0.06, y + 0.1, 'in')])
    // the lobby baffle: a clay wall with a lacquered cap (drawn here; WALLS 'sat-theatre-baffle' collides)
    const b = THEATRE.baffle
    const ab = b.aDeg * DEG
    const h = b.t / 2
    const baffle = mergeAll([radialQuad(ab, h, b.r0, b.r1, 0, b.h, 1), radialQuad(ab, -h, b.r0, b.r1, 0, b.h, -1), endCap(ab, b.r1, h, b.h)])
    const cap = mergeAll([polarBandRadial(ab, b.r0, b.r1 + 0.02, h + 0.015, b.h + 0.035, b.h)])
    // lacquered pilasters along both long walls, catching the cove's light (none over the door,
    // the baffle or the screen and its frame)
    const pil: THREE.BufferGeometry[] = []
    const pH = y - 0.16
    const add = (r: number, aDeg: number, inward: 1 | -1) => {
      const g = new THREE.BoxGeometry(0.06, pH - 0.12, 0.22)
      const a = aDeg * DEG
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const rr = r + inward * 0.03
      g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(c, 0, sn), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-sn, 0, c)).setPosition(rr * c, 0.12 + (pH - 0.12) / 2, rr * sn))
      pil.push(g)
    }
    const away = (aDeg: number, from: number, half: number) => Math.abs(aDeg - from) > half
    for (let aDeg = s.fromDeg + 3.5; aDeg < s.toDeg - 2; aDeg += 6.9)
      if (away(aDeg, s.doorDeg, SAT_DOOR_HALF_DEG + 1.6) && away(aDeg, b.aDeg, 1.6)) add(S.innerFace + LINE, aDeg, 1)
    for (let aDeg = s.fromDeg + 3; aDeg < s.toDeg - 2; aDeg += 5)
      if (aDeg < THEATRE.screenFrom - 3.2 || aDeg > THEATRE.screenTo + 3.2) add(S.outerFace - LINE, aDeg, -1)
    return { cove, ledge, baffle, cap, pilasters: mergeAll(pil) }
  }, [s])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  useFrame(({ clock }) => {
    // the vault fires like a kiln: the joints glow at the firing, and through the film they keep a
    // slow warm pulse (a kiln breathing), never quite dark while the house lights are down
    const film = theatreHouseState.phase === 'film' ? 1 - theatreHouseState.house : 0
    const pulse = film * (0.28 + 0.2 * Math.sin(clock.elapsedTime * 0.9))
    mats.vault.emissiveIntensity = Math.max(theatreHouseState.firing * 2.4, pulse)
    // the joints take the picture's colour while the film runs, ember-orange when fired
    const sp = theatreHouseState.spill
    const lit = Math.max(sp.r, sp.g, sp.b)
    if (theatreHouseState.firing > 0.05 || lit < 0.01) mats.vault.emissive.set(0xff5a1c)
    else mats.vault.emissive.setRGB(sp.r / lit, (sp.g / lit) * 0.85, (sp.b / lit) * 0.8)
    mats.cove.emissiveIntensity = 0.15 + 1.25 * theatreHouseState.house + 0.5 * pulse
  })
  return (
    <group>
      {geo.cove && <mesh geometry={geo.cove} material={mats.cove} raycast={() => null} />}
      {geo.ledge && <mesh geometry={geo.ledge} material={mats.walls.theatre} />}
      {geo.baffle && <mesh geometry={geo.baffle} material={m.oxblood} castShadow receiveShadow />}
      {geo.cap && <mesh geometry={geo.cap} material={m.brass} />}
      {geo.pilasters && <mesh geometry={geo.pilasters} material={m.oxbloodLacquer} castShadow receiveShadow />}
    </group>
  )
}

/** The baffle's outer end (a flat face at r1, facing out along the radius). */
function endCap(a: number, r: number, h: number, y1: number) {
  const f = new FaceBuilder()
  const c = Math.cos(a)
  const s = Math.sin(a)
  const tx = -s
  const tz = c
  const P = (o: number, y: number) => [r * c + tx * o, y, r * s + tz * o]
  // counter-clockwise seen from outside (+radius), where +tangent is on the viewer's left
  f.quad([P(h, 0), P(-h, 0), P(-h, y1), P(h, y1)], Array(4).fill([c, 0, s]), [
    [-h, 0],
    [h, 0],
    [h, y1],
    [-h, y1],
  ])
  return f.build()
}

/** A thin box along the radius at angle a (r0 → r1), `half` either side of the plane, y0 → y1: the baffle's cap. */
function polarBandRadial(a: number, r0: number, r1: number, half: number, y1: number, y0: number) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const tx = -s
  const tz = c
  const g = new THREE.BoxGeometry(r1 - r0, y1 - y0, 2 * half)
  const mid = (r0 + r1) / 2
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(c, 0, s), new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx, 0, tz)).setPosition(mid * c, (y0 + y1) / 2, mid * s))
  return g
}

/**
 * The library's clerestory: a pierced clay band along the outer wall above the shelves (2.6 →
 * 4.0 m), daylight glowing through its holes, brighter by day; at night the holes go dark.
 */
function LibraryClerestory() {
  const mats = useNorthWingMaterials()
  const s = satellite('library')
  // u = metres along the arc, v = height: the lattice map repeats per JAALI_REPEAT_M.clerestory
  const geo = useMemo(() => cylinderFace(0, 0, S.outerFace - LINE - 0.006, s.fromDeg * DEG, s.toDeg * DEG, 2.6, 4.0, 'in'), [s])
  useEffect(() => () => geo?.dispose(), [geo])
  // daylight through the holes by day; after dark only a lamp-warm ember of the room's own light
  const day = useMemo(() => new THREE.Color('#ffe2b8'), [])
  const lamp = useMemo(() => new THREE.Color('#ff9a52'), [])
  useFrame(() => {
    const d = ambience.daylight
    mats.clerestory.emissiveIntensity = 0.08 + 1.15 * d * d
    mats.clerestory.emissive.copy(lamp).lerp(day, Math.min(1, d * 1.4))
  })
  if (!geo) return null
  return <mesh geometry={geo} material={mats.clerestory} receiveShadow />
}

/** The Atlas pendant: a brass ring with a glowing inner band over the compass, on three rods. */
function AtlasPendant() {
  const mats = useNorthWingMaterials()
  const { m } = mats
  const s = satellite('atlas')
  // over the compass in the floor (spectacleObjects/rooms.ts), a little under the room's height
  const [x, z] = polar(SAT_WALL.innerFace + 3.5, s.doorDeg)
  const y = s.height - 1.85
  useFrame(() => {
    mats.pendant.emissiveIntensity = 1.6 + 1.4 * ambience.night
  })
  return (
    <group position={[x, y, z]}>
      {/* no shadow: its ring would print dark blotches along the top of the map */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
        <torusGeometry args={[0.62, 0.025, 10, 96]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
        <torusGeometry args={[0.46, 0.012, 8, 96]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={mats.pendant} raycast={() => null}>
        <ringGeometry args={[0.47, 0.6, 96]} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.6 * 0.5, (s.height - y) / 2, Math.sin(a) * 0.6 * 0.5]} rotation={[Math.cos(a) * 0.14, 0, -Math.sin(a) * 0.14]} material={m.brass}>
            <cylinderGeometry args={[0.005, 0.005, s.height - y, 6]} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * The Haat's light: a warm scrim glowing over the star lattice (the sky's light through it by
 * day, a low amber at night), and on every tier a soft, irregular dapple on its floor (the sun
 * itself is held off the floor by the roof, inject.ts SOLID_ROOMS).
 */
function HaatDapple() {
  const mats = useNorthWingMaterials()
  const s = satellite('shop')
  const geo = useMemo(() => polarBand(S.innerFace + 0.6, S.outerFace - 0.5, (s.fromDeg + 3) * DEG, (s.toDeg - 3) * DEG, 0.006, true), [s])
  // the scrim runs out over the walls to the roof's edges, so no oblique look up through the
  // lattice's edge ever finds the sky beyond it
  const scrim = useMemo(() => polarBand(S.innerC - S.t / 2 - SAT_ROOF.over + 0.06, S.outerOuter + 0.12, (s.fromDeg - 0.8) * DEG, (s.toDeg + 2.5) * DEG, s.height + 0.4, false), [s])
  useEffect(
    () => () => {
      geo?.dispose()
      scrim?.dispose()
    },
    [geo, scrim],
  )
  const warm = useMemo(() => new THREE.Color('#ffcf96'), [])
  useFrame(() => {
    mats.dapple.opacity = 0.16 * ambience.daylight
    mats.scrim.color.copy(warm).multiplyScalar(0.18 + 0.95 * ambience.daylight)
  })
  return (
    <>
      {scrim && <mesh geometry={scrim} material={mats.scrim} raycast={() => null} />}
      {geo && <mesh geometry={geo} material={mats.dapple} raycast={() => null} renderOrder={1} />}
    </>
  )
}

/** General light for the library and the Haat: SpotPool requests from the ceiling over the shelves. */
function RoomLights({ s }: { s: SatelliteSpec }) {
  useEffect(() => {
    // radii of the room (its middle, its shelves on the outer wall) and the Red Room's wings
    const mid = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2
    const shelf = SAT_WALL.outerFace - 0.6
    const rrHalf = Math.asin((RED_ROOM.r + RED_ROOM.t) / Math.hypot(RED_ROOM.cx, RED_ROOM.cz)) / DEG
    const list: { r: number; a: number; to: number }[] =
      s.id === 'atlas'
        ? [{ r: SAT_WALL.innerFace + 3.1, a: s.doorDeg, to: SAT_WALL.innerFace + 3.5 }]
        : s.id === 'library'
        ? [
            { r: mid, a: (s.fromDeg + RED_ROOM.aDeg - rrHalf) / 2, to: shelf },
            { r: mid, a: (s.toDeg + RED_ROOM.aDeg + rrHalf) / 2, to: shelf },
          ]
        : s.id === 'shop'
          ? [
              { r: mid, a: s.fromDeg + 6, to: shelf },
              { r: mid, a: s.toDeg - 6, to: shelf },
              { r: mid - 1, a: s.doorDeg, to: mid },
            ]
          : []
    // the Atlas's light falls straight down on its compass; the others wash the shelves
    const offs = list.map(({ r, a, to }) => {
      const [x, z] = polar(r, a)
      const [tx, tz] = polar(to, a)
      // the Atlas is neutral (4000 K: the map and the logos read true); the others warm
      return registerSpot({ position: [x, s.height - 0.15, z], target: [tx, 1.1, tz], intensity: 20, angle: 0.7, penumbra: 0.9, color: s.id === 'atlas' ? kelvinToHex(4000) : s.id === 'shop' ? '#ffe2bf' : '#ffd6a6', neutral: s.id === 'atlas', tag: `room-${s.id}` })
    })
    return () => offs.forEach((f) => f())
  }, [s])
  return null
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

export function Satellites() {
  return (
    <group name="satellites">
      <SatelliteShell />
      {SATELLITES.map((s) => (
        <ZoneGroup key={s.id} zones={[s.id as ZoneId]}>
          <RoomInterior s={s} />
        </ZoneGroup>
      ))}
    </group>
  )
}
