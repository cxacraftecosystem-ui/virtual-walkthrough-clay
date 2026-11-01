/**
 * 'curved-shelf' — a run of curved display shelving (PDF p05 "curved shelving with products",
 * p09r the round red room's shelves; GRAND §3 #27): the Earth Room's two runs round the table,
 * the Red Room's six tiers round its wall and the Haat's back wall.
 *
 *   plan      the run's centreline is an arc of radius `curveR` spanning `spanDeg`, concave to
 *             the front (+z): its centre of curvature is `curveR` in front of the origin, which
 *             is the run's middle on the floor. `depth` is the boards' depth.
 *   build     a recessed kick plinth, `tiers` display boards `tierGap` apart, a cornice board on
 *             top, uprights about every 0.9 m and a curved back panel. `finish` sets the
 *             boards (lacquer-red: the Red Room's red; timber; clay: p05's thin curved blades of
 *             clay, 25 mm, floating free — no plinth, no uprights, no back panel).
 *   lit       a warm light line under each board's front edge (emissive, picked up by bloom),
 *             so the goods glow and the shelf reads from across a room.
 *   items     one line per kind of piece, `form-or-slug|count[|clay]`: a vessel form (below) is
 *             drawn procedurally, a registry slug (config/sourcedRegistry.generated.ts) is the
 *             sourced model, instanced. Pieces fill the boards from the middle outwards, tier by
 *             tier, sized to the tier's clear height. `clay` picks the body: terracotta, red,
 *             buff, blush, ochre, black, grey, white, blue or mixed (the default).
 *
 * Forms: kulhad, matka, surahi, handi, tawa, diya, lamp-stack, vase, jar, lidded, bowl, ghatam.
 * Draw calls: the shelf's materials (≤ 4) plus one per form or slug present.
 * Also exports the vessel forms (`vesselGeometry`, `VESSEL_FORMS`) for the other installations.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { arcEndCap, annulusFace, cylinderFace, mergeAll } from '../architecture/shellGeometry'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { resolveSlug, SourcedInstances, type InstanceSpot } from './erodedFormation'
import { rng } from './kit'
import { useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

const DEG = Math.PI / 180
const noRaycast = () => null

/* ------------------------------------------------------------------ */
/* vessel forms                                                        */
/* ------------------------------------------------------------------ */

/** A form: lathe profile (r, y) at unit height, its usual height (m) and its clays. */
interface VesselForm {
  profile: [number, number][]
  h: number
}

/** Profiles at height 1, outside up to the lip, then down the inside to the floor of the mouth. */
export const VESSEL_FORMS: Record<string, VesselForm> = {
  kulhad: { h: 0.095, profile: [[0, 0], [0.3, 0], [0.33, 0.05], [0.42, 0.92], [0.44, 1], [0.4, 1], [0.37, 0.25], [0, 0.2]] },
  matka: { h: 0.3, profile: [[0, 0], [0.22, 0.02], [0.43, 0.15], [0.52, 0.4], [0.48, 0.62], [0.35, 0.78], [0.24, 0.84], [0.24, 0.9], [0.3, 0.97], [0.32, 1], [0.27, 1], [0.2, 0.9], [0, 0.86]] },
  surahi: { h: 0.34, profile: [[0, 0], [0.18, 0.01], [0.32, 0.12], [0.35, 0.3], [0.29, 0.45], [0.14, 0.55], [0.08, 0.62], [0.07, 0.88], [0.1, 0.96], [0.11, 1], [0.08, 1], [0.05, 0.9], [0, 0.88]] },
  handi: { h: 0.2, profile: [[0, 0], [0.3, 0.02], [0.5, 0.25], [0.56, 0.5], [0.5, 0.7], [0.4, 0.8], [0.42, 0.92], [0.46, 1], [0.41, 1], [0.36, 0.85], [0, 0.8]] },
  tawa: { h: 0.045, profile: [[0, 0], [2.2, 0], [3.1, 0.55], [3.3, 1], [3.05, 1], [2.6, 0.62], [0, 0.4]] },
  diya: { h: 0.045, profile: [[0, 0], [0.7, 0.04], [1.05, 0.7], [1.12, 1], [0.98, 1], [0.78, 0.55], [0, 0.45]] },
  'lamp-stack': {
    h: 0.4,
    profile: [[0, 0], [0.26, 0], [0.26, 0.06], [0.1, 0.09], [0.08, 0.3], [0.22, 0.32], [0.24, 0.38], [0.07, 0.4], [0.06, 0.62], [0.18, 0.64], [0.19, 0.69], [0.06, 0.7], [0.05, 0.9], [0.13, 0.92], [0.12, 1], [0, 0.98]],
  },
  vase: { h: 0.32, profile: [[0, 0], [0.17, 0], [0.27, 0.2], [0.32, 0.45], [0.23, 0.7], [0.14, 0.82], [0.18, 0.95], [0.21, 1], [0.16, 1], [0, 0.9]] },
  jar: { h: 0.24, profile: [[0, 0], [0.33, 0], [0.43, 0.3], [0.45, 0.7], [0.37, 0.88], [0.29, 0.92], [0.29, 1], [0, 1]] },
  lidded: { h: 0.22, profile: [[0, 0], [0.33, 0], [0.43, 0.3], [0.44, 0.62], [0.35, 0.72], [0.38, 0.74], [0.33, 0.85], [0.12, 0.9], [0.07, 0.93], [0.09, 1], [0, 1]] },
  bowl: { h: 0.1, profile: [[0, 0], [0.32, 0], [0.55, 0.4], [0.66, 0.95], [0.68, 1], [0.62, 1], [0.52, 0.45], [0, 0.32]] },
  ghatam: { h: 0.3, profile: [[0, 0], [0.24, 0.02], [0.45, 0.2], [0.5, 0.45], [0.46, 0.7], [0.32, 0.86], [0.17, 0.92], [0.18, 1], [0.12, 1], [0, 0.92]] },
}

export const isVesselForm = (s: string) => Object.prototype.hasOwnProperty.call(VESSEL_FORMS, s)

/** Widest radius of a form (relative to its height). */
export const formRadius = (f: string) => Math.max(...VESSEL_FORMS[f].profile.map((p) => p[0]))

const vesselCache = new Map<string, THREE.BufferGeometry>()

/** A form at unit height (scale the instance by the piece's height), smooth-shaded, `seg` sides. */
export function vesselGeometry(form: string, seg = 24): THREE.BufferGeometry {
  const key = `${form}|${seg}`
  let g = vesselCache.get(key)
  if (!g) {
    const f = VESSEL_FORMS[form] ?? VESSEL_FORMS.matka
    g = new THREE.LatheGeometry(
      f.profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)),
      seg,
    )
    g.computeVertexNormals()
    vesselCache.set(key, g)
  }
  return g
}

/** Clay bodies (sRGB). */
export const CLAYS: Record<string, string> = {
  terracotta: '#b65c3c',
  red: '#9a3022',
  buff: '#d6b289',
  blush: '#d58f78',
  ochre: '#c7874c',
  black: '#2a2523',
  grey: '#8a837c',
  white: '#e8e1d4',
  blue: '#2d5d9c',
}
const MIXED = ['terracotta', 'terracotta', 'red', 'buff', 'blush', 'ochre', 'terracotta', 'black']

const clayMatCache = new Map<string, THREE.MeshStandardMaterial>()

/** One clay material for every instanced piece (its body colour is the instance colour). */
export function useVesselMaterial(): THREE.MeshStandardMaterial {
  const m = useModelMaterials()
  return useMemo(() => {
    const src = m.terracotta as THREE.MeshStandardMaterial
    let mat = clayMatCache.get(src.uuid)
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        name: 'shelfClay',
        color: '#ffffff',
        normalMap: src.normalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughnessMap: src.roughnessMap,
        roughness: 0.78,
        metalness: 0,
        envMapIntensity: 0.6,
      })
      injectAtmosphere(mat)
      clayMatCache.set(src.uuid, mat)
    }
    return mat
  }, [m.terracotta])
}

/** One instanced form: every piece's matrix and body colour. */
export function VesselInstances({ form, pieces, seg }: { form: string; pieces: { p: [number, number, number]; h: number; rotY: number; color: THREE.Color }[]; seg: number }) {
  const geo = vesselGeometry(form, seg)
  const mat = useVesselMaterial()
  return (
    <instancedMesh
      key={`${form}-${pieces.length}-${seg}`}
      args={[geo, mat, pieces.length]}
      castShadow
      receiveShadow
      raycast={noRaycast}
      ref={(mesh) => {
        if (!mesh) return
        const mtx = new THREE.Matrix4()
        const q = new THREE.Quaternion()
        const up = new THREE.Vector3(0, 1, 0)
        pieces.forEach((pc, i) => {
          mesh.setMatrixAt(i, mtx.compose(new THREE.Vector3(...pc.p), q.setFromAxisAngle(up, pc.rotY), new THREE.Vector3(pc.h, pc.h, pc.h)))
          mesh.setColorAt(i, pc.color)
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mesh.computeBoundingSphere()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* items                                                               */
/* ------------------------------------------------------------------ */

export interface ItemLine {
  key: string
  count: number
  clay: string
}

/** Parse `form-or-slug|count[|clay]` lines (blank and malformed lines are skipped). */
export function parseItems(text: string): ItemLine[] {
  return text
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [k, c, clay] = l.split('|').map((s) => s.trim())
      return { key: k, count: Math.max(0, Math.min(200, Math.round(Number(c) || 1))), clay: clay || 'mixed' }
    })
    .filter((x) => x.key && x.count > 0)
}

/** Piece placement on one run: positions in the shelf's local frame. */
interface Placed {
  key: string
  p: [number, number, number]
  h: number
  rotY: number
  color: THREE.Color
}

/* ------------------------------------------------------------------ */
/* the shelf                                                           */
/* ------------------------------------------------------------------ */

/** An annular-sector block about (cx, cz) from radius r0 to r1, a0 → a1 (rad), y0 → y1, all faces. */
function arcBlock(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, y0: number, y1: number) {
  return mergeAll([
    annulusFace(cx, cz, r0, r1, a0, a1, y1, true),
    annulusFace(cx, cz, r0, r1, a0, a1, y0, false),
    cylinderFace(cx, cz, r0, a0, a1, y0, y1, 'in'),
    cylinderFace(cx, cz, r1, a0, a1, y0, y1, 'out'),
    arcEndCap(cx, cz, r0, r1, a0, y0, y1, 'start'),
    arcEndCap(cx, cz, r0, r1, a1, y0, y1, 'end'),
  ])
}

interface ShelfSpec {
  R: number
  span: number
  tiers: number
  gap: number
  depth: number
  finish: string
}

const KICK = 0.14
const BOARD = 0.035

function shelfGeometry(s: ShelfSpec) {
  // plan angles about the centre of curvature (0, R): the run's middle points along −z from it
  const a0 = -Math.PI / 2 - (s.span * DEG) / 2
  const a1 = -Math.PI / 2 + (s.span * DEG) / 2
  const rf = s.R - s.depth / 2
  const rb = s.R + s.depth / 2
  // p05's floating blades: thin clay boards cantilevered from the wall, nothing else
  const blades = s.finish === 'clay'
  const t = blades ? 0.025 : BOARD
  const top = KICK + s.tiers * s.gap
  const boards: (THREE.BufferGeometry | null)[] = []
  const frame: (THREE.BufferGeometry | null)[] = []
  const lights: (THREE.BufferGeometry | null)[] = []
  const glows: (THREE.BufferGeometry | null)[] = []
  if (blades) {
    for (let k = 0; k < s.tiers; k++) {
      const y = KICK + 0.5 * s.gap + k * s.gap
      boards.push(arcBlock(0, s.R, rf, rb, a0, a1, y - t, y))
      lights.push(annulusFace(0, s.R, rf + 0.015, rf + 0.035, a0 + 0.004, a1 - 0.004, y - t - 0.002, false))
    }
    return { boards: mergeAll(boards), frame: null, lights: mergeAll(lights), glow: null, back: null, top }
  }
  // kick plinth, set back 5 cm
  frame.push(arcBlock(0, s.R, rf + 0.05, rb, a0, a1, 0, KICK))
  for (let k = 0; k <= s.tiers; k++) {
    const y = KICK + k * s.gap
    boards.push(arcBlock(0, s.R, rf, rb, a0, a1, y - (k === 0 ? 0 : t), y + (k === 0 ? t : 0)))
    // the light line under the board above each tier (not under the plinth's top)
    if (k > 0) {
      lights.push(annulusFace(0, s.R, rf + 0.015, rf + 0.04, a0 + 0.004, a1 - 0.004, y - t - 0.002, false))
      // the light's wash on the back panel just under the board
      glows.push(cylinderFace(0, s.R, rb - 0.012, a0, a1, y - t - 0.14, y - t, 'in'))
    }
  }
  // cornice
  boards.push(arcBlock(0, s.R, rf - 0.02, rb, a0 - 0.002, a1 + 0.002, top, top + 0.06))
  // uprights about every 0.9 m, plus both ends
  const len = s.R * s.span * DEG
  const n = Math.max(1, Math.round(len / 0.9))
  const ut = 0.04
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    const half = ut / 2 / s.R
    const b = Math.min(a1, Math.max(a0, a))
    frame.push(arcBlock(0, s.R, rf + 0.01, rb, Math.max(a0, b - half), Math.min(a1, b + half), KICK, top))
  }
  // back panel
  const back = cylinderFace(0, s.R, rb - 0.01, a0, a1, 0, top + 0.06, 'in')
  const glow = mergeAll(glows)
  if (glow) {
    const p = glow.getAttribute('position')
    const c = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      // the band's top edge (against the board) is lit, its bottom edge fades out
      const d = (((p.getY(i) - KICK + t) % s.gap) + s.gap) % s.gap
      const v = d < 0.01 || d > s.gap - 0.01 ? 1 : 0
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v
    }
    glow.setAttribute('color', new THREE.BufferAttribute(c, 3))
  }
  return { boards: mergeAll(boards), frame: mergeAll(frame), lights: mergeAll(lights), glow, back, top }
}

const glowMat = new THREE.MeshBasicMaterial({ name: 'shelfGlow', color: '#ffb46a', vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lightMat = new THREE.MeshStandardMaterial({ name: 'shelfLight', color: '#2a1a10', emissive: new THREE.Color('#ffc98a'), emissiveIntensity: 2.4, roughness: 1, metalness: 0 })
/** The red shelves' strips (p09r): a red-tinted line and wash, so the lacquer stays red, never timber-yellow. */
const glowMatRed = new THREE.MeshBasicMaterial({ name: 'shelfGlowRed', color: '#ff5a3c', vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lightMatRed = new THREE.MeshStandardMaterial({ name: 'shelfLightRed', color: '#2a0e0a', emissive: new THREE.Color('#ff7050'), emissiveIntensity: 2.2, roughness: 1, metalness: 0 })

export function CurvedShelf({ config }: ModelProps) {
  const core = useMaterials()
  const m = useModelMaterials()
  const tier = useMuseum((s) => s.tier)
  const R = Math.max(0.5, num(config, 'curveR', 4.2))
  const span = Math.max(5, Math.min(360, num(config, 'spanDeg', 40)))
  const tiers = Math.round(Math.max(1, Math.min(8, num(config, 'tiers', 4))))
  const gap = Math.max(0.15, num(config, 'tierGap', 0.42))
  const depth = Math.max(0.1, num(config, 'depth', 0.32))
  const finish = str(config, 'finish', 'lacquer-red')
  const lit = config.props?.lit !== false && config.props?.lit !== 'false'
  const items = str(config, 'items', '')

  const geo = useMemo(() => shelfGeometry({ R, span, tiers, gap, depth, finish }), [R, span, tiers, gap, depth, finish])
  useEffect(() => () => [geo.boards, geo.frame, geo.lights, geo.glow, geo.back].forEach((g) => g?.dispose()), [geo])

  // pieces: fill each board from the middle outwards
  const placed = useMemo<Placed[]>(() => {
    const lines = parseItems(items)
    if (!lines.length) return []
    const r = rng(`shelf|${config.id}|${items}`)
    const queue: { key: string; clay: string }[] = []
    // interleave the kinds so every tier has a mix
    const left = lines.map((l) => ({ ...l }))
    while (left.some((l) => l.count > 0)) for (const l of left) if (l.count-- > 0) queue.push({ key: l.key, clay: l.clay })
    const out: Placed[] = []
    const front = R - depth / 2
    const rowR = front + depth * 0.45
    const usable = R * span * DEG - 0.12
    let qi = 0
    const blades = finish === 'clay'
    for (let k = 0; k < tiers && qi < queue.length; k++) {
      const y = blades ? KICK + 0.5 * gap + k * gap : KICK + k * gap + (k === 0 ? BOARD : 0)
      const clear = gap - BOARD - 0.04
      // lay pieces left to right, then centre the row
      const row: { key: string; clay: string; h: number; w: number }[] = []
      let used = 0
      while (qi < queue.length) {
        const it = queue[qi]
        const form = isVesselForm(it.key) ? it.key : 'vase'
        const f = VESSEL_FORMS[form]
        const h = Math.min(clear, f.h * (0.85 + r() * 0.3))
        const w = Math.max(0.05, 2 * formRadius(form) * h * (isVesselForm(it.key) ? 1 : 1.4))
        if (w > depth * 1.6 && !isVesselForm(it.key)) {
          qi++
          continue
        }
        if (used + w + 0.04 > usable) break
        row.push({ ...it, h, w })
        used += w + 0.04
        qi++
      }
      let s = -used / 2
      for (const pc of row) {
        const along = s + pc.w / 2
        s += pc.w + 0.04
        const a = along / rowR
        const depthJitter = (r() - 0.5) * Math.max(0, depth * 0.9 - pc.w) * 0.5
        const rr = rowR + depthJitter
        const clayKey = pc.clay === 'mixed' ? MIXED[Math.floor(r() * MIXED.length)] : pc.clay
        const c = new THREE.Color(CLAYS[clayKey] ?? CLAYS.terracotta)
        c.offsetHSL(0, 0, (r() - 0.5) * 0.06)
        out.push({ key: pc.key, p: [rr * Math.sin(a), y, R - rr * Math.cos(a)], h: pc.h, rotY: r() * Math.PI * 2, color: c })
      }
    }
    return out
  }, [items, R, span, tiers, gap, depth, finish, config.id])

  const byKey = useMemo(() => {
    const map = new Map<string, Placed[]>()
    for (const p of placed) {
      const list = map.get(p.key) ?? []
      list.push(p)
      map.set(p.key, list)
    }
    return [...map.entries()]
  }, [placed])

  const boardMat = finish === 'timber' ? m.teak : finish === 'clay' ? core.clayBuff : core.redLacquer
  const backMat = finish === 'timber' ? m.darkTimber : finish === 'clay' ? core.clayTerracotta : core.redLacquer
  const seg = tier === 'low' ? 12 : tier === 'medium' ? 18 : 24
  const red = finish === 'lacquer-red'

  return (
    <group name="curved-shelf">
      {geo.boards && <mesh geometry={geo.boards} material={boardMat} castShadow receiveShadow raycast={noRaycast} />}
      {geo.frame && <mesh geometry={geo.frame} material={boardMat} castShadow receiveShadow raycast={noRaycast} />}
      {geo.back && <mesh geometry={geo.back} material={backMat} receiveShadow raycast={noRaycast} />}
      {lit && geo.lights && <mesh geometry={geo.lights} material={red ? lightMatRed : lightMat} raycast={noRaycast} />}
      {lit && geo.glow && <mesh geometry={geo.glow} material={red ? glowMatRed : glowMat} renderOrder={1} raycast={noRaycast} />}
      {byKey.map(([key, list]) =>
        isVesselForm(key) ? (
          <VesselInstances key={key} form={key} pieces={list} seg={seg} />
        ) : (
          <SourcedInstances
            key={key}
            slug={resolveSlug(key)}
            spots={list.map<InstanceSpot>((p) => ({ p: p.p, rotY: p.rotY, h: p.h }))}
            fallback={<VesselInstances form="vase" pieces={list} seg={seg} />}
          />
        ),
      )}
    </group>
  )
}
