/**
 * CLAY PAVILION MODELS — procedural stand-ins for the three traditions' pieces and the
 * pavilion's own display furniture. Built like every procedural model (kit.tsx): origin at
 * the floor (or podium-top) centre, front faces +z, sized from footprint / height, merged
 * per material and cached by parameters.
 *
 *   podium            {height, top: 'plain' | 'vitrine'}       loose 12 in display podium
 *   clay-vessel       {form, clay, burnish}                     turned / hand-built pots
 *   terracotta-horse  {scale}                                   upright horse, long neck, pricked ears
 *   votive-plaque     {motif: 'rider' | 'deity' | 'serpent'}    arched relief plaque on a small stand
 *   oculus-plinth     —                                         the stepped round plinth under the oculus
 *   clay-shelf        {width, rows, fired}                      timber drying shelf with rows of pots
 *
 * ('potters-wheel' is the studio's interactive wheel, models/printStudio.tsx.)
 *
 * These are stand-ins: plain forms and earth colours, nothing that claims to be a particular
 * maker's piece. A GLB (`model`) replaces them once the workshop's objects are scanned.
 */
import * as THREE from 'three'
import { annulusFace, cylinderFace } from '../architecture/shellGeometry'
import { MUSEUM } from '../config/museum'
import { Builder, cyl, lathe, Parts, rbox, rng, tube, useBuilt } from './kit'
import { tinted, useModelMaterials, type ModelMaterials } from './modelMaterials'
import { fp, geoKey, num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Clay bodies                                                         */
/* ------------------------------------------------------------------ */

export type ClayBody = 'red' | 'black' | 'buff' | 'terracotta'
export type VesselForm = 'matka' | 'surahi' | 'kulhad' | 'diya' | 'kettle' | 'bowl'

const CLAY_COLOR: Record<ClayBody, string> = {
  red: '#9a4630',
  terracotta: '#b8633f',
  buff: '#d6b38c',
  black: '#2a2523',
}

const isBody = (v: string): v is ClayBody => v in CLAY_COLOR
const FORMS: VesselForm[] = ['matka', 'surahi', 'kulhad', 'diya', 'kettle', 'bowl']
const isForm = (v: string): v is VesselForm => (FORMS as string[]).includes(v)

/** Fired-clay material for a body and a burnish (0 = matte, 1 = stone-polished). */
export function clayMaterial(m: ModelMaterials, body: ClayBody, burnish: number): THREE.Material {
  const b = Math.max(0, Math.min(1, burnish))
  const r = Math.round((0.92 - b * 0.62) * 100) / 100
  const n = Math.round((1.1 - b * 0.85) * 100) / 100
  return tinted(m.terracotta, CLAY_COLOR[body], { roughness: r, envMapIntensity: 0.5 + b * 0.7, normalScale: new THREE.Vector2(n, n) })
}

/** Leather-hard, unfired clay (drying shelves). */
const UNFIRED = '#9c8a7b'

/* ------------------------------------------------------------------ */
/* Vessel profiles — [radius, y] outside bottom → rim → inside, unit size */
/* ------------------------------------------------------------------ */

/** Closed lathe profile (outside up, over the rim, inside down) for a form, scaled to R × H. */
export function vesselProfile(form: VesselForm, R: number, H: number): [number, number][] {
  const t = Math.max(0.004, Math.min(R, H) * 0.06) // wall thickness
  const P = (pts: [number, number][]) => pts.map(([r, y]) => [r * R, y * H] as [number, number])
  switch (form) {
    case 'matka': {
      const out = P([
        [0, 0],
        [0.38, 0],
        [0.62, 0.06],
        [0.88, 0.22],
        [1, 0.45],
        [0.95, 0.62],
        [0.78, 0.78],
        [0.56, 0.88],
        [0.5, 0.93],
        [0.56, 0.97],
        [0.6, 1],
      ])
      return [...out, [0.6 * R - t, H - t * 0.2], [0.5 * R - t, 0.93 * H], [0.56 * R - t, 0.88 * H], [0.78 * R - t, 0.78 * H], [0.9 * R - t, 0.5 * H], [0.6 * R - t, 0.12 * H], [0, t]]
    }
    case 'surahi': {
      const out = P([
        [0, 0],
        [0.42, 0],
        [0.6, 0.05],
        [0.95, 0.2],
        [1, 0.32],
        [0.88, 0.45],
        [0.5, 0.55],
        [0.24, 0.62],
        [0.2, 0.8],
        [0.24, 0.92],
        [0.36, 1],
      ])
      return [...out, [0.36 * R - t, H - t * 0.3], [0.2 * R - t * 0.6, 0.92 * H], [0.16 * R - t * 0.6, 0.8 * H], [0, 0.78 * H]]
    }
    case 'kulhad':
      return [
        [0, 0],
        [0.62 * R, 0],
        [0.66 * R, 0.08 * H],
        [R, H],
        [R - t, H],
        [0.62 * R - t, 0.12 * H],
        [0, 0.12 * H],
      ]
    case 'diya':
      return [
        [0, 0],
        [0.5 * R, 0],
        [0.88 * R, 0.45 * H],
        [R, H],
        [R - t, H],
        [0.8 * R, 0.55 * H],
        [0.4 * R, 0.3 * H],
        [0, 0.28 * H],
      ]
    case 'kettle': {
      // squat round body to the shoulder, short collar for the lid
      const out = P([
        [0, 0],
        [0.42, 0],
        [0.75, 0.08],
        [0.98, 0.32],
        [1, 0.5],
        [0.88, 0.68],
        [0.58, 0.8],
        [0.42, 0.82],
        [0.42, 0.86],
      ])
      return [...out, [0.42 * R - t, 0.86 * H], [0.42 * R - t, 0.8 * H], [0, 0.8 * H]]
    }
    case 'bowl':
      return [
        [0, 0],
        [0.34 * R, 0],
        [0.36 * R, 0.14 * H],
        [0.5 * R, 0.16 * H],
        [0.86 * R, 0.55 * H],
        [R, H],
        [R - t, H],
        [0.84 * R - t, 0.58 * H],
        [0.46 * R, 0.24 * H],
        [0, 0.22 * H],
      ]
  }
}

/** Add a vessel (merged under `key`) at p, with rotation about y. */
function addVessel(b: Builder, key: string, form: VesselForm, R: number, H: number, p: [number, number, number] = [0, 0, 0], ry = 0, extrasKey?: string) {
  b.add(key, lathe(vesselProfile(form, R, H), 40), { p, r: [0, ry, 0] })
  const ek = extrasKey ?? key
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const rot = (x: number, z: number): [number, number] => [p[0] + x * c + z * s, p[2] - x * s + z * c]
  if (form === 'diya') {
    // pinched spout at local +x
    const [x, z] = rot(R * 0.98, 0)
    b.add(key, cyl(R * 0.12, R * 0.2, H * 0.5, 10), { p: [x, p[1] + H * 0.72, z], r: [0, ry, Math.PI / 2 - 0.5] })
  }
  if (form === 'kettle') {
    // spout, lid, cane-bound handle across the top
    const sp = new THREE.CatmullRomCurve3([new THREE.Vector3(R * 0.82, H * 0.45, 0), new THREE.Vector3(R * 1.12, H * 0.6, 0), new THREE.Vector3(R * 1.3, H * 0.78, 0)])
    const spout = tube(sp, R * 0.08, 12, 10)
    b.add(key, spout, { p, r: [0, ry, 0] })
    b.add(key, cyl(R * 0.38, R * 0.44, H * 0.05, 32), { p: [p[0], p[1] + H * 0.885, p[2]] })
    b.add(key, cyl(R * 0.07, R * 0.09, H * 0.07, 16), { p: [p[0], p[1] + H * 0.94, p[2]] })
    const arc = new THREE.EllipseCurve(0, 0, R * 0.62, H * 0.42, 0, Math.PI, false, 0)
    const pts = arc.getPoints(20).map((q) => new THREE.Vector3(0, H * 0.72 + q.y, q.x))
    b.add(ek, tube(new THREE.CatmullRomCurve3(pts), R * 0.045, 24, 8), { p, r: [0, ry, 0] })
  }
}

/* ------------------------------------------------------------------ */
/* clay-vessel                                                         */
/* ------------------------------------------------------------------ */

export function ClayVessel({ config }: ModelProps) {
  const m = useModelMaterials()
  const formS = str(config, 'form', 'matka')
  const form: VesselForm = isForm(formS) ? formS : 'matka'
  const bodyS = str(config, 'clay', 'terracotta')
  const body: ClayBody = isBody(bodyS) ? bodyS : 'terracotta'
  const burnish = num(config, 'burnish', body === 'black' ? 0.8 : 0.2)
  const H = config.height ?? 0.3
  const [fx, fz] = fp(config, [H, H])
  // the kettle's spout and the diya's lip reach past the body
  const R = (Math.min(fx, fz) / 2) * (form === 'kettle' ? 0.78 : form === 'diya' ? 0.82 : 1)
  const parts = useBuilt(geoKey('clay-vessel', config), () => {
    const b = new Builder()
    addVessel(b, 'body', form, R, H, [0, 0, 0], 0, 'cane')
    return b
  })
  return <Parts parts={parts} materials={{ body: clayMaterial(m, body, burnish), cane: m.rope }} />
}

/* ------------------------------------------------------------------ */
/* terracotta-horse                                                    */
/* ------------------------------------------------------------------ */

/**
 * Upright terracotta horse in the manner of the votive horses of Bengal: a stiff, open body
 * on four column legs, a tall straight neck, a long face and tall pricked ears, with a few
 * incised collar bands. Seen in profile (body along local x).
 */
export function TerracottaHorse({ config }: ModelProps) {
  const m = useModelMaterials()
  const scale = num(config, 'scale', 1)
  const H = config.height ?? 0.5 * scale
  const parts = useBuilt(geoKey('terracotta-horse', config), () => {
    const b = new Builder()
    const k = H / 0.5 // model authored 0.5 m tall
    const legH = 0.17 * k
    const bodyY = legH + 0.035 * k
    const bodyL = 0.24 * k
    const bodyR = 0.045 * k
    // body: a tapered tube, open at the rear (hollow, as fired)
    const body = cyl(bodyR * 0.92, bodyR, bodyL, 20, false)
    b.add('clay', body, { p: [0, bodyY, 0], r: [0, 0, Math.PI / 2] })
    // legs
    for (const lx of [-1, 1])
      for (const lz of [-1, 1]) b.add('clay', cyl(0.014 * k, 0.019 * k, legH + 0.02 * k, 10), { p: [lx * bodyL * 0.36, (legH + 0.02 * k) / 2, lz * bodyR * 0.55] })
    // neck: tall, slightly forward
    const neckH = 0.2 * k
    b.add('clay', cyl(0.026 * k, 0.04 * k, neckH, 16), { p: [bodyL * 0.42, bodyY + neckH / 2 + 0.01 * k, 0], r: [0, 0, -0.18] })
    // head: a long face pointing forward-down
    const headY = bodyY + neckH + 0.015 * k
    b.add('clay', cyl(0.018 * k, 0.03 * k, 0.11 * k, 14), { p: [bodyL * 0.42 + 0.075 * k, headY - 0.01 * k, 0], r: [0, 0, Math.PI / 2 + 0.55] })
    // tall pricked ears
    for (const s of [-1, 1]) b.add('clay', cyl(0.002 * k, 0.012 * k, 0.07 * k, 8), { p: [bodyL * 0.42 + 0.03 * k, headY + 0.045 * k, s * 0.015 * k], r: [s * 0.12, 0, -0.1] })
    // tail stub
    b.add('clay', cyl(0.008 * k, 0.014 * k, 0.07 * k, 8), { p: [-bodyL / 2 - 0.02 * k, bodyY + 0.01 * k, 0], r: [0, 0, 0.9] })
    // incised collar bands (darker slip) on the neck and round the body
    for (let i = 0; i < 3; i++) b.add('slip', cyl(0.031 * k + i * 0.002 * k, 0.031 * k + i * 0.002 * k, 0.006 * k, 16, true), { p: [bodyL * 0.42 + 0.004 * k * i, bodyY + 0.05 * k + i * 0.025 * k, 0], r: [0, 0, -0.18] })
    for (const x of [-0.06, 0.06]) b.add('slip', cyl(bodyR * 1.02, bodyR * 1.02, 0.006 * k, 20, true), { p: [x * k, bodyY, 0], r: [0, 0, Math.PI / 2] })
    // eyes
    for (const s of [-1, 1]) b.add('slip', new THREE.SphereGeometry(0.006 * k, 8, 6), { p: [bodyL * 0.42 + 0.06 * k, headY + 0.005 * k, s * 0.019 * k] })
    return b
  })
  return <Parts parts={parts} materials={{ clay: clayMaterial(m, 'terracotta', 0.15), slip: clayMaterial(m, 'red', 0.1) }} />
}

/* ------------------------------------------------------------------ */
/* votive-plaque                                                       */
/* ------------------------------------------------------------------ */

type PlaqueMotif = 'rider' | 'deity' | 'serpent'

/** Extruded shape from z = 0 to `depth` (+ a small bevel either side), with metre UVs. */
function extrude(shape: THREE.Shape, depth: number, bevel = depth * 0.3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 })
  g.translate(0, 0, bevel)
  // metre UVs from x/y
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i))
  return g
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
  const s = new THREE.Shape()
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0)
  return s
}

/** Relief shapes (plaque-local, unit = plaque width 1, origin at the bottom centre) by paint colour. */
function motifShapes(motif: PlaqueMotif): Record<'ochre' | 'white' | 'red' | 'dark', THREE.Shape[]> {
  const out = { ochre: [] as THREE.Shape[], white: [] as THREE.Shape[], red: [] as THREE.Shape[], dark: [] as THREE.Shape[] }
  if (motif === 'rider') {
    out.white.push(ellipse(0, 0.5, 0.26, 0.11)) // horse body
    out.white.push(ellipse(0.27, 0.66, 0.05, 0.15)) // neck
    out.white.push(ellipse(0.33, 0.8, 0.09, 0.045)) // head
    for (const x of [-0.18, -0.09, 0.1, 0.19]) out.white.push(ellipse(x, 0.33, 0.025, 0.1)) // legs
    out.red.push(ellipse(-0.02, 0.72, 0.07, 0.13)) // rider body
    out.ochre.push(ellipse(-0.02, 0.92, 0.055, 0.06)) // rider head
    out.dark.push(ellipse(-0.08, 0.53, 0.12, 0.03)) // saddle cloth
  } else if (motif === 'deity') {
    const canopy = new THREE.Shape()
    canopy.moveTo(-0.36, 0.9)
    canopy.quadraticCurveTo(0, 1.2, 0.36, 0.9)
    canopy.lineTo(0.32, 0.86)
    canopy.quadraticCurveTo(0, 1.12, -0.32, 0.86)
    canopy.closePath()
    out.ochre.push(canopy)
    out.red.push(ellipse(0, 0.5, 0.2, 0.2)) // seated body / lap
    out.white.push(ellipse(0, 0.78, 0.075, 0.085)) // head
    out.ochre.push(ellipse(0, 0.885, 0.06, 0.03)) // crown
    for (const s of [-1, 1]) out.white.push(ellipse(s * 0.2, 0.56, 0.035, 0.12)) // arms
    out.dark.push(ellipse(0, 0.27, 0.27, 0.04)) // seat
  } else {
    // hooded serpent: coils + raised hood
    for (let i = 0; i < 3; i++) out.white.push(ellipse(0, 0.26 + i * 0.12, 0.28 - i * 0.06, 0.06))
    out.red.push(ellipse(0, 0.72, 0.17, 0.2)) // hood
    out.ochre.push(ellipse(0, 0.74, 0.08, 0.12)) // hood mark
    out.white.push(ellipse(0, 0.93, 0.06, 0.05)) // head
  }
  return out
}

export function VotivePlaque({ config }: ModelProps) {
  const m = useModelMaterials()
  const motifS = str(config, 'motif', 'rider')
  const motif: PlaqueMotif = motifS === 'deity' || motifS === 'serpent' ? motifS : 'rider'
  const H = config.height ?? 0.38
  const [fx] = fp(config, [0.26, 0.26])
  const parts = useBuilt(geoKey('votive-plaque', config), () => {
    const b = new Builder()
    const W = fx * 0.9
    const ph = H - 0.03 // plaque height above its stand
    const T = 0.025
    const lean = -0.12
    // arched slab
    const slab = new THREE.Shape()
    slab.moveTo(-W / 2, 0)
    slab.lineTo(W / 2, 0)
    slab.lineTo(W / 2, ph - W / 2)
    slab.absarc(0, ph - W / 2, W / 2, 0, Math.PI, false)
    slab.lineTo(-W / 2, 0)
    const SB = 0.003
    const slabG = extrude(slab, T - 2 * SB, SB)
    slabG.translate(0, 0, -T / 2)
    // front face of the slab (painted parts sit just proud of it)
    const front = T / 2 + 0.0004
    const tilt = (g: THREE.BufferGeometry, z: number) => {
      g.translate(0, 0, z)
      g.rotateX(lean)
      g.translate(0, 0.03, 0)
      return g
    }
    b.add('clay', tilt(slabG, 0))
    // painted border band
    const border = new THREE.Shape()
    border.moveTo(-W / 2 + 0.008, 0.008)
    border.lineTo(W / 2 - 0.008, 0.008)
    border.lineTo(W / 2 - 0.008, ph - W / 2)
    border.absarc(0, ph - W / 2, W / 2 - 0.008, 0, Math.PI, false)
    border.closePath()
    const hole = new THREE.Path()
    hole.moveTo(-W / 2 + 0.02, 0.02)
    hole.lineTo(W / 2 - 0.02, 0.02)
    hole.lineTo(W / 2 - 0.02, ph - W / 2)
    hole.absarc(0, ph - W / 2, W / 2 - 0.02, 0, Math.PI, false)
    hole.closePath()
    border.holes.push(hole)
    b.add('red', tilt(extrude(border, 0.0015, 0), front))
    // relief
    const shapes = motifShapes(motif)
    const sc = W * 0.82
    for (const [key, list] of Object.entries(shapes)) {
      for (const sh of list) {
        const g = extrude(sh, 0.005, 0.0015)
        g.scale(sc, ph / 1.1, 1)
        g.translate(0, 0.01, 0)
        b.add(key, tilt(g, front))
      }
    }
    // small stand behind the foot
    b.add('clay', rbox(W * 0.7, 0.03, 0.08, 0.006), { p: [0, 0.015, 0] })
    return b
  })
  const clay = clayMaterial(m, 'terracotta', 0.1)
  return (
    <Parts
      parts={parts}
      materials={{
        clay,
        red: tinted(m.terracotta, '#9e3428', { roughness: 0.85 }),
        ochre: tinted(m.terracotta, '#d29a45', { roughness: 0.85 }),
        white: tinted(m.terracotta, '#ece2cf', { roughness: 0.85 }),
        dark: tinted(m.terracotta, '#3b2a22', { roughness: 0.85 }),
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* oculus-plinth                                                       */
/* ------------------------------------------------------------------ */

/**
 * The plinth under the oculus: concentric steps on the drawn rings (MUSEUM.oculus.rings),
 * rising towards the light, the centre a disc of sun-dried clay. Its outer edge is the
 * layout's solid 'oculus-plinth' collider; the top step is the curb height.
 */
export const OCULUS_PLINTH = (() => {
  const [r0, r1, r2, r3] = MUSEUM.oculus.rings
  const top = MUSEUM.oculus.curbHeight
  return { steps: [{ r: r0, y: top / 3 }, { r: r1, y: (top * 2) / 3 }, { r: r2, y: top }], centre: { r: r3, y: top - 0.012 }, top }
})()

export function OculusPlinth() {
  const m = useModelMaterials()
  const parts = useBuilt('oculus-plinth', () => {
    const b = new Builder()
    const keys = ['step0', 'step1', 'step2']
    const full = Math.PI * 2
    const S = OCULUS_PLINTH.steps
    // crisp faces only (no lathe: its averaged normals would round every step)
    S.forEach((s, i) => {
      const yBase = i === 0 ? 0 : S[i - 1].y
      const inner = i < S.length - 1 ? S[i + 1].r : OCULUS_PLINTH.centre.r
      const riser = cylinderFace(0, 0, s.r, 0, full, yBase, s.y, 'out')
      const tread = annulusFace(0, 0, inner, s.r, 0, full, s.y, true)
      if (riser) b.add(keys[i], riser)
      if (tread) b.add(keys[i], tread)
    })
    // the centre: a disc of sun-dried clay set 12 mm below the top step
    const c = OCULUS_PLINTH.centre
    const lip = cylinderFace(0, 0, c.r, 0, full, c.y, OCULUS_PLINTH.top, 'in')
    const disc = annulusFace(0, 0, 0, c.r, 0, full, c.y, true)
    if (lip) b.add('step2', lip)
    if (disc) b.add('centre', disc)
    return b
  })
  return <Parts parts={parts} materials={{ step0: m.oxblood, step1: m.clayTerracotta, step2: m.clayRose, centre: m.rawClay }} />
}

/* ------------------------------------------------------------------ */
/* podium (loose)                                                      */
/* ------------------------------------------------------------------ */

export function Podium({ config }: ModelProps) {
  const m = useModelMaterials()
  const H = num(config, 'height', config.height ?? MUSEUM.podium.height)
  const [fx, fz] = fp(config, [MUSEUM.podium.size, MUSEUM.podium.size])
  const vitrine = str(config, 'top', 'plain') === 'vitrine'
  const parts = useBuilt(geoKey('podium', config), () => {
    const b = new Builder()
    b.add('gap', rbox(fx - 0.02, 0.025, fz - 0.02, 0.002), { p: [0, 0.0125, 0] })
    b.add('body', rbox(fx, H - 0.025, fz, 0.004), { p: [0, 0.025 + (H - 0.025) / 2, 0] })
    if (vitrine) b.add('glass', rbox(fx - 0.01, fx * 1.1, fz - 0.01, 0.002), { p: [0, H + (fx * 1.1) / 2, 0] })
    return b
  })
  return <Parts parts={parts} materials={{ body: m.oxblood, gap: m.shadowGap, glass: m.glass }} />
}

/* ------------------------------------------------------------------ */
/* clay-shelf                                                          */
/* ------------------------------------------------------------------ */

/**
 * Drying shelf: timber uprights and planks, each plank carrying a row of pots — leather-hard
 * (`fired: false`, or a title that says "unfired") or fired terracotta.
 */
export function ClayShelf({ config }: ModelProps) {
  const m = useModelMaterials()
  const W = num(config, 'width', fp(config, [1.6, 0.34])[0])
  const D = fp(config, [W, 0.34])[1]
  const H = config.height ?? 1.9
  const rows = Math.max(1, Math.min(6, Math.round(num(config, 'rows', 3))))
  const firedProp = config.props?.fired
  const fired = typeof firedProp === 'boolean' ? firedProp : !/unfired/i.test(config.title)
  const parts = useBuilt(geoKey('clay-shelf', config, String(fired)), () => {
    const b = new Builder()
    const post = 0.045
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('wood', rbox(post, H, post, 0.004), { p: [sx * (W / 2 - post / 2), H / 2, sz * (D / 2 - post / 2)] })
    const pitch = (H - 0.12) / rows
    const r = rng(config.id)
    for (let i = 0; i < rows; i++) {
      const y = 0.12 + i * pitch
      b.add('plank', rbox(W - 0.01, 0.028, D, 0.004, 2, 'x'), { p: [0, y, 0] })
      // pots along the plank
      let x = -W / 2 + 0.08
      while (x < W / 2 - 0.12) {
        const form = (['matka', 'kulhad', 'bowl', 'matka', 'surahi'] as VesselForm[])[Math.floor(r() * 5)]
        const h = Math.min(pitch - 0.08, form === 'kulhad' ? 0.09 + r() * 0.03 : form === 'bowl' ? 0.07 + r() * 0.03 : form === 'surahi' ? 0.24 + r() * 0.04 : 0.15 + r() * 0.06)
        const R = form === 'surahi' ? h * 0.38 : form === 'bowl' ? h * 1.1 : form === 'kulhad' ? h * 0.45 : h * 0.55
        if (x + R > W / 2 - 0.06) break
        addVessel(b, 'pot', form, R, h, [x + R, y + 0.014, (r() - 0.5) * (D - 2 * R - 0.04) * 0.6], r() * Math.PI * 2)
        x += 2 * R + 0.03 + r() * 0.05
      }
    }
    return b
  })
  const pot = fired ? clayMaterial(m, 'terracotta', 0.05) : tinted(m.terracotta, UNFIRED, { roughness: 0.97 })
  return <Parts parts={parts} materials={{ wood: m.darkTimber, plank: m.oak, pot }} />
}
