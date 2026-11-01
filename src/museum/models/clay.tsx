/**
 * CLAY PAVILION MODELS — procedural stand-ins for the three traditions' pieces and the
 * pavilion's own display furniture. Built like every procedural model (kit.tsx): origin at
 * the floor (or podium-top) centre, front faces +z, sized from footprint / height, merged
 * per material and cached by parameters.
 *
 *   podium            {height, top: 'plain' | 'vitrine'}       loose 12 in display podium
 *   clay-vessel       {form, clay, burnish, decor}              turned / hand-built pots (12 forms, 8 bodies,
 *                                                               6 surface decors: models/clayDecor.ts)
 *   terracotta-horse  {scale, style}                            upright horse, long neck, pricked ears;
 *                                                               bankura | gorakhpur (applied beads, bells) | sonepur (smoked)
 *   votive-plaque     {motif, size}                             arched relief plaque on a small stand, up to 1.1 m;
 *                                                               rider | deity | serpent | procession | canopy
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
import { decorMaterial, isDecor, type ClayDecor } from './clayDecor'
import { fbm, sculptDetailFor, weldNormals } from './sculpt'
import { useMuseum } from '../state/store'
import { fp, geoKey, num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Clay bodies                                                         */
/* ------------------------------------------------------------------ */

export type ClayBody = 'red' | 'black' | 'buff' | 'terracotta' | 'pink' | 'geru' | 'quartz' | 'grey'
export type VesselForm = 'matka' | 'surahi' | 'kulhad' | 'diya' | 'kettle' | 'bowl' | 'handi' | 'tawa' | 'lidded' | 'jar' | 'vase' | 'ghatam'

const CLAY_COLOR: Record<ClayBody, string> = {
  red: '#9a4630',
  terracotta: '#b8633f',
  buff: '#d6b38c',
  black: '#2a2523',
  // the pale pink-buff of Pokaran, a red-earth (geru) slip, the white quartz body of Jaipur blue, unfired grey
  pink: '#d39c84',
  geru: '#8f3d25',
  quartz: '#eeebe4',
  grey: '#8d8780',
}

export const isBody = (v: string): v is ClayBody => v in CLAY_COLOR
const FORMS: VesselForm[] = ['matka', 'surahi', 'kulhad', 'diya', 'kettle', 'bowl', 'handi', 'tawa', 'lidded', 'jar', 'vase', 'ghatam']
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
    case 'handi': {
      // a wide cooking pot: low round belly, a short flared neck
      const out = P([
        [0, 0],
        [0.45, 0],
        [0.82, 0.12],
        [1, 0.4],
        [0.94, 0.64],
        [0.74, 0.8],
        [0.64, 0.86],
        [0.68, 0.94],
        [0.76, 1],
      ])
      return [...out, [0.76 * R - t, H - t * 0.2], [0.62 * R - t, 0.88 * H], [0.9 * R - t, 0.45 * H], [0, t]]
    }
    case 'tawa':
      // a griddle: a shallow, slightly domed disc with a turned-up rim
      return [
        [0, 0.3 * H],
        [0.6 * R, 0.15 * H],
        [0.94 * R, 0],
        [R, 0.55 * H],
        [R * 0.97, H],
        [R * 0.92, H],
        [0.9 * R, 0.6 * H],
        [0.6 * R, 0.45 * H],
        [0, 0.55 * H],
      ]
    case 'lidded':
      // a storage jar with its lid on: shoulder, lid dome, knob (closed, so no inside)
      return P([
        [0, 0],
        [0.5, 0],
        [0.86, 0.16],
        [1, 0.42],
        [0.9, 0.64],
        [0.64, 0.74],
        [0.66, 0.77],
        [0.62, 0.8],
        [0.48, 0.88],
        [0.2, 0.93],
        [0.14, 0.95],
        [0.16, 0.99],
        [0.1, 1],
        [0, 1],
      ])
    case 'jar': {
      const out = P([
        [0, 0],
        [0.52, 0],
        [0.84, 0.14],
        [1, 0.48],
        [0.92, 0.76],
        [0.62, 0.9],
        [0.56, 0.94],
        [0.64, 0.98],
        [0.66, 1],
      ])
      return [...out, [0.66 * R - t, H - t * 0.2], [0.54 * R - t, 0.92 * H], [0.9 * R - t, 0.5 * H], [0, t]]
    }
    case 'vase': {
      const out = P([
        [0, 0],
        [0.52, 0],
        [0.66, 0.08],
        [1, 0.36],
        [0.86, 0.58],
        [0.44, 0.76],
        [0.36, 0.86],
        [0.42, 0.95],
        [0.56, 1],
      ])
      return [...out, [0.56 * R - t, H - t * 0.3], [0.34 * R - t * 0.6, 0.86 * H], [0, 0.8 * H]]
    }
    case 'ghatam': {
      // the clay pot drum: a big round belly, a narrow thick mouth
      const out = P([
        [0, 0],
        [0.36, 0],
        [0.76, 0.12],
        [1, 0.44],
        [0.94, 0.7],
        [0.66, 0.86],
        [0.34, 0.92],
        [0.3, 0.95],
        [0.36, 0.99],
        [0.38, 1],
      ])
      return [...out, [0.38 * R - t * 1.6, H - t * 0.2], [0.28 * R - t, 0.94 * H], [0, 0.9 * H]]
    }
  }
}

/** Number of leading profile points on a form's outside (a decor wraps only these). */
function outsideCount(form: VesselForm): number {
  const n: Record<VesselForm, number> = { matka: 11, surahi: 11, kettle: 9, handi: 9, jar: 9, vase: 9, ghatam: 10, kulhad: 4, diya: 4, bowl: 6, tawa: 5, lidded: 14 }
  return n[form]
}

/**
 * A vessel's outside with UVs for a decor: u round the pot (0 to 1), v up it by height (0 to 1).
 * The inside (if any) is added plain under `insideKey`.
 */
function decorLathe(b: Builder, key: string, insideKey: string, form: VesselForm, R: number, H: number) {
  const prof = vesselProfile(form, R, H)
  const k = outsideCount(form)
  const g = new THREE.LatheGeometry(
    prof.slice(0, k).map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    48,
  )
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), Math.min(1, Math.max(0, pos.getY(i) / H)))
  b.add(key, g)
  if (prof.length > k) b.add(insideKey, lathe(prof.slice(k - 1), 40))
}

/**
 * A pot shaped by hand on a board, not thrown (Longpi): the lathe's round eased out of true by a
 * slow wobble round the body and the paddle's broad facets, the rim a little uneven.
 */
function handBuiltLathe(profile: [number, number][], R: number, H: number) {
  const g = lathe(profile, 64)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-5) continue
    const a = Math.atan2(z, x)
    const h = y / H
    const f = 1 + 0.018 * Math.sin(a * 2 + h * 2.4) + 0.012 * Math.sin(a * 5 + 1.3) * Math.sin(h * Math.PI) + 0.01 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, h * 3, 2)
    pos.setXYZ(i, x * f, y + (h > 0.9 ? 0.006 * R * Math.sin(a * 3) : 0), z * f)
  }
  return weldNormals(g)
}

/** Add a vessel (merged under `key`) at p, with rotation about y. */
function addVessel(b: Builder, key: string, form: VesselForm, R: number, H: number, p: [number, number, number] = [0, 0, 0], ry = 0, extrasKey?: string, handBuilt = false) {
  b.add(key, handBuilt ? handBuiltLathe(vesselProfile(form, R, H), R, H) : lathe(vesselProfile(form, R, H), 40), { p, r: [0, ry, 0] })
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
  const decorS = str(config, 'decor', 'none')
  const decor: ClayDecor = isDecor(decorS) ? decorS : 'none'
  const H = config.height ?? 0.3
  const [fx, fz] = fp(config, [H, H])
  // the kettle's spout and the diya's lip reach past the body
  const R = (Math.min(fx, fz) / 2) * (form === 'kettle' ? 0.78 : form === 'diya' ? 0.82 : 1)
  const parts = useBuilt(geoKey('clay-vessel', config), () => {
    const b = new Builder()
    if (decor === 'none') addVessel(b, 'body', form, R, H, [0, 0, 0], 0, 'cane', body === 'black')
    else {
      decorLathe(b, 'decor', 'body', form, R, H)
      // the kettle's spout, lid and handle and the diya's spout come from the plain builder
      if (form === 'kettle' || form === 'diya') {
        const extra = new Builder()
        addVessel(extra, 'lathe', form, R, H, [0, 0, 0], 0, 'cane')
        for (const p of extra.build()) if (p.key === 'cane') b.add('cane', p.geometry)
      }
    }
    return b
  })
  const plain = clayMaterial(m, body, burnish)
  return <Parts parts={parts} materials={{ body: plain, decor: decor === 'none' ? plain : decorMaterial(m.terracotta, decor), cane: m.rope }} />
}

/* ------------------------------------------------------------------ */
/* terracotta-horse                                                    */
/* ------------------------------------------------------------------ */

/**
 * Upright terracotta horse in the manner of the votive horses of Bengal: one continuous body
 * swept from the rump up the arched neck to a long face with an open, hollow mouth, on four
 * column legs, with tall flared ears and a scalloped crest; slip-burnished red darkening to
 * chocolate (vertex colour, with baked occlusion). Seen in profile (body along local x).
 */
export type HorseStyle = 'bankura' | 'gorakhpur' | 'sonepur'
const isHorseStyle = (v: string): v is HorseStyle => v === 'bankura' || v === 'gorakhpur' || v === 'sonepur'

export function TerracottaHorse({ config }: ModelProps) {
  const m = useModelMaterials()
  const scale = num(config, 'scale', 1)
  const styleS = str(config, 'style', 'bankura')
  const style: HorseStyle = isHorseStyle(styleS) ? styleS : 'bankura'
  const H = config.height ?? 0.5 * scale
  const parts = useBuilt(geoKey('terracotta-horse', config), () => horseBuilder(H, style))
  return <Parts parts={parts} materials={horseMaterials(m, style)} />
}

/**
 * The bodies of the three horse styles: Bankura slip-burnished red to chocolate; Gorakhpur a
 * bright orange-red with ochre-picked ornament; Sonepur red with the dark smoke patches of a
 * chaff-pit firing.
 */
export function horseMaterials(m: ModelMaterials, style: HorseStyle): Record<string, THREE.Material> {
  if (style === 'gorakhpur')
    return { clay: tinted(m.terracotta, '#c4492b', { roughness: 0.62, envMapIntensity: 0.8 }), slip: tinted(m.terracotta, '#d9a24a', { roughness: 0.6 }), ornament: tinted(m.terracotta, '#b8401f', { roughness: 0.55, envMapIntensity: 0.9 }) }
  if (style === 'sonepur') return { clay: clayMaterial(m, 'terracotta', 0.2), slip: clayMaterial(m, 'red', 0.1), smoke: tinted(m.terracotta, '#2e2420', { roughness: 0.9 }) }
  // the body's red-to-chocolate slip and its baked occlusion are in the vertex colour; a burnished sheen
  // (a stone-polished red slip: tight highlights that run down the necks under a raking light)
  // matte fired terracotta (a soft sheen, never a lacquer highlight); the incised collars dark
  return { clay: tinted(m.terracotta, '#ffffff', { roughness: 0.78, envMapIntensity: 0.55, vertexColors: true }), slip: tinted(m.terracotta, '#3a1a10', { roughness: 0.9, envMapIntensity: 0.3 }) }
}

/**
 * The horse's geometry, `H` metres tall, merged per material ('clay' body, 'slip' bands and
 * eyes) — for instanced use (the Parikrama's horse procession). The caller owns the result.
 */
export function buildHorseGeometry(H = 0.5): { clay: THREE.BufferGeometry; slip: THREE.BufferGeometry } {
  const built = horseBuilder(H).build()
  const get = (key: string) => built.find((p) => p.key === key)!.geometry
  return { clay: get('clay'), slip: get('slip') }
}

function horseBuilder(H: number, style: HorseStyle = 'bankura') {
    const b = new Builder()
    const k = H / 0.5 // model authored 0.5 m tall
    const legH = 0.17 * k
    const bodyY = legH + 0.035 * k
    const bodyL = 0.24 * k
    const bodyR = 0.045 * k
    // one continuous fired body (no stacked tubes): a sweep along the spine from the rump through
    // the back and chest, up the arched neck to the poll and down the long face to an open,
    // hollow mouth — the way a Bankura horse's thrown and joined parts read once paddled smooth
    const spineY = bodyY
    const spine = new THREE.CatmullRomCurve3(
      [
        [-0.125, 0.012],
        [-0.06, 0.0],
        [0.03, -0.002],
        [0.105, 0.008],
        [0.142, 0.07],
        [0.158, 0.15],
        [0.168, 0.212],
        [0.198, 0.226],
        [0.24, 0.204],
        [0.278, 0.172],
        [0.3, 0.15],
      ].map(([x, y]) => new THREE.Vector3(x * k, spineY + y * k, 0)),
      false,
      'centripetal',
    )
    // cross-section half-height / half-width along the spine (t 0 = rump, 1 = muzzle)
    const SEC: [number, number, number][] = [
      [0, 0.036, 0.034],
      [0.1, 0.052, 0.05],
      [0.28, 0.058, 0.054],
      [0.38, 0.068, 0.06],
      [0.48, 0.058, 0.05],
      [0.6, 0.05, 0.043],
      [0.7, 0.046, 0.038],
      [0.78, 0.04, 0.032],
      [0.9, 0.03, 0.025],
      [1, 0.026, 0.022],
    ]
    const secAt = (t: number) => {
      let i = 0
      while (i < SEC.length - 2 && SEC[i + 1][0] < t) i++
      const [t0, h0, w0] = SEC[i]
      const [t1, h1, w1] = SEC[i + 1]
      const f = THREE.MathUtils.smoothstep(t, t0, t1)
      return [(h0 + (h1 - h0) * f) * k, (w0 + (w1 - w0) * f) * k]
    }
    const RED = new THREE.Color('#d2683f')
    const CHOC = new THREE.Color('#5e2c1b')
    {
      const NA = 72
      const NR = 28
      // a closed, rounded muzzle: past the last section the surface runs on and closes to a point
      // (no open mouth: seen head-on an open ring read as a "ring face")
      const LIP = [
        { back: -0.008, s: 0.82 },
        { back: -0.013, s: 0.55 },
        { back: -0.0155, s: 0 },
      ]
      const rows = NA + 1 + LIP.length
      const pos: number[] = []
      const col: number[] = []
      const uv: number[] = []
      const end = spine.getPointAt(1)
      const endT = spine.getTangentAt(1)
      for (let j = 0; j < rows; j++) {
        const lip = j > NA ? LIP[j - NA - 1] : null
        const t = lip ? 1 : j / NA
        const p = lip ? end.clone().addScaledVector(endT, -lip.back * k) : spine.getPointAt(t)
        const T = spine.getTangentAt(t)
        const N = new THREE.Vector3(-T.y, T.x, 0).normalize()
        let [rh, rw] = secAt(t)
        if (lip) {
          rh *= lip.s
          rw *= lip.s
        }
        for (let i = 0; i <= NR; i++) {
          const a = (i / NR) * Math.PI * 2
          // flat-bottomed belly, a ridge along the back
          const c = Math.cos(a)
          const sn = Math.sin(a)
          const ridge = c > 0 ? 1 + 0.06 * Math.pow(c, 8) : 1 - 0.05 * Math.pow(-c, 2)
          const v = p.clone().addScaledVector(N, c * rh * ridge).add(new THREE.Vector3(0, 0, sn * rw))
          pos.push(v.x, v.y, v.z)
          uv.push((i / NR) * 0.3 * k, t * 0.6 * k)
          // slip-burnished red, darkening to chocolate at the muzzle, the mouth and the belly (AO)
          const toFace = THREE.MathUtils.smoothstep(t, 0.7, 1)
          const under = THREE.MathUtils.clamp(-c, 0, 1)
          // the mouth: an incised line round the lower muzzle, dark in the vertex colour
          const mouthLine = !lip && t > 0.9 && c < -0.1 && c > -0.75 ? 0.45 : 1
          const ao = (lip ? 0.8 : 1 - 0.32 * Math.pow(under, 1.5)) * mouthLine
          const cc = RED.clone().lerp(CHOC, 0.15 + 0.55 * toFace + 0.25 * under).multiplyScalar(ao)
          col.push(cc.r, cc.g, cc.b)
        }
      }
      // the rump: closed by a rounded fan
      const tail = spine.getPointAt(0)
      const tailIdx = pos.length / 3
      const tailP = tail.clone().addScaledVector(spine.getTangentAt(0), -0.018 * k)
      pos.push(tailP.x, tailP.y, tailP.z)
      uv.push(0, 0)
      const cr = RED.clone().lerp(CHOC, 0.25)
      col.push(cr.r, cr.g, cr.b)
      const idx: number[] = []
      for (let j = 0; j < rows - 1; j++)
        for (let i = 0; i < NR; i++) {
          const a = j * (NR + 1) + i
          const b2 = a + NR + 1
          idx.push(a, a + 1, b2, a + 1, b2 + 1, b2)
        }
      for (let i = 0; i < NR; i++) idx.push(tailIdx, i + 1, i)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(idx)
      g.computeVertexNormals()
      b.add('clay', g)
    }
    // the neck's own curve (for the styles' collars and smoke) and the poll
    const neck = new THREE.CatmullRomCurve3([0.4, 0.5, 0.6, 0.7].map((t) => spine.getPointAt(t)))
    const poll = spine.getPointAt(0.74)
    const headY = poll.y
    // legs: thrown columns flaring to the hoof, chocolate towards the foot
    for (const lx of [-1, 1])
      for (const lz of [-1, 1]) {
        const leg = cyl(0.021 * k, 0.028 * k, legH + 0.05 * k, 14, false, 4)
        const lp = leg.getAttribute('position')
        const lc = new Float32Array(lp.count * 3)
        for (let i = 0; i < lp.count; i++) {
          const f = THREE.MathUtils.clamp(lp.getY(i) / (legH + 0.05 * k) + 0.5, 0, 1)
          const c = CHOC.clone().lerp(RED, 0.25 + 0.6 * f)
          lc.set([c.r, c.g, c.b], i * 3)
        }
        leg.setAttribute('color', new THREE.BufferAttribute(lc, 3))
        b.add('clay', leg, { p: [lx * (lx > 0 ? 0.09 : 0.085) * k, (legH + 0.05 * k) / 2, lz * 0.026 * k], r: [lz * 0.05, 0, -lx * 0.04] })
      }
    // ears: tall leaf-shaped blades, cupped and flared forward and out above the poll
    // (Bankura: tall, pricked high above the poll — the horse's signature), red-brown inside
    const earH = (style === 'bankura' ? 0.12 : 0.085) * k
    const leaf = lathe(
      (
        [
          [0, 0],
          [0.5, 0.06],
          [0.9, 0.22],
          [1, 0.42],
          [0.82, 0.64],
          [0.45, 0.86],
          [0, 1],
        ] as [number, number][]
      ).map(([r, y]) => [r * 0.026 * k, y * earH] as [number, number]),
      14,
    )
    leaf.scale(0.42, 1, 1)
    for (const s of [-1, 1]) b.add('clay', leaf, { p: [poll.x + 0.004 * k, poll.y + 0.03 * k, s * 0.024 * k], r: [s * 0.28, 0, -0.22], color: '#a8472b' })
    if (style === 'bankura') {
      // incised collars: three dark rings round the thick neck
      for (const t of [0.5, 0.555, 0.61]) {
        const p = spine.getPointAt(t)
        const T = spine.getTangentAt(t)
        const N = new THREE.Vector3(-T.y, T.x, 0).normalize()
        const [rh, rw] = secAt(t)
        const ring = new THREE.TorusGeometry(1, 0.05, 6, 40)
        ring.applyMatrix4(new THREE.Matrix4().makeBasis(N.multiplyScalar(rh * 1.01), new THREE.Vector3(0, 0, rw * 1.01), T.clone().multiplyScalar(rh)))
        ring.translate(p.x, p.y, p.z)
        b.add('slip', ring)
      }
    }
    // the crest: a scalloped mane standing up along the back of the neck
    const mane = new THREE.Shape()
    const M = 9
    const back: THREE.Vector3[] = []
    for (let i = 0; i <= M; i++) back.push(spine.getPointAt(0.44 + (0.3 * i) / M))
    const nOut = (i: number) => {
      const T = spine.getTangentAt(0.44 + (0.3 * i) / M)
      return [T.y, -T.x]
    }
    mane.moveTo(back[0].x, back[0].y)
    for (let i = 0; i <= M; i++) {
      const p = back[i]
      const [nx, ny] = nOut(i)
      const r0 = secAt(0.44 + (0.3 * i) / M)[0]
      const out = r0 + (0.016 + 0.008 * Math.sin((i / M) * Math.PI) + (i % 2 ? 0.004 : -0.002)) * k
      mane.lineTo(p.x - nx * out, p.y - ny * out)
    }
    for (let i = M; i >= 0; i--) {
      const [nx, ny] = nOut(i)
      const r0 = secAt(0.44 + (0.3 * i) / M)[0] * 0.6
      mane.lineTo(back[i].x - nx * r0, back[i].y - ny * r0)
    }
    mane.closePath()
    const maneGeo = new THREE.ExtrudeGeometry(mane, { depth: 0.01 * k, bevelEnabled: true, bevelThickness: 0.003 * k, bevelSize: 0.003 * k, bevelSegments: 2, curveSegments: 4 })
    maneGeo.translate(0, 0, -0.005 * k)
    b.add('clay', maneGeo, { color: '#a34a2c' })
    // tail: a short upturned stub
    b.add('clay', cyl(0.007 * k, 0.014 * k, 0.07 * k, 10), { p: [-0.15 * k, spineY + 0.03 * k, 0], r: [0, 0, 0.75], color: '#8a3a22' })
    // incised eyes (no painted bands: the burnish carries the body)
    for (const s of [-1, 1]) b.add('slip', new THREE.SphereGeometry(0.0055 * k, 8, 6), { p: [poll.x + 0.028 * k, headY - 0.006 * k, s * 0.02 * k] })
    if (style === 'gorakhpur') {
      // applied ornament: bead collars on the neck, a breast band of hanging bells, a studded saddle cloth
      const bead = new THREE.SphereGeometry(0.0055 * k, 8, 6)
      for (let i = 0; i < 4; i++) {
        const t = 0.1 + i * 0.2
        const p = neck.getPointAt(t)
        const r = (0.041 - 0.015 * t) * k + 0.003 * k
        for (let j = 0; j < 14; j++) {
          const a = (j / 14) * Math.PI * 2
          b.add('ornament', bead, { p: [p.x + Math.cos(a) * r * 0.35, p.y + Math.sin(a) * r * 0.2, Math.sin(a) * r] })
        }
      }
      const bell = lathe(
        [
          [0, 0],
          [0.008, 0.002],
          [0.009, 0.01],
          [0.005, 0.016],
          [0, 0.017],
        ].map(([r, y]) => [r * k, y * k] as [number, number]),
        10,
      )
      for (let j = 0; j < 9; j++) {
        const z = (j / 8 - 0.5) * bodyR * 1.8
        b.add('slip', bell, { p: [bodyL / 2 + 0.012 * k, bodyY - bodyR * 0.95 - 0.017 * k, z] })
      }
      b.add('ornament', cyl(bodyR * 1.07, bodyR * 1.07, 0.06 * k, 24, true), { p: [-0.01 * k, bodyY, 0], r: [0, 0, Math.PI / 2] })
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI - Math.PI / 2
        b.add('slip', bead, { p: [-0.01 * k + ((j % 3) - 1) * 0.018 * k, bodyY + Math.sin(a + Math.PI / 2) * bodyR * 1.08, Math.cos(a + Math.PI / 2) * bodyR * 1.08] })
      }
    }
    if (style === 'sonepur') {
      // smoke from the chaff pit: dark patches lying on the body, flank and neck
      const r = rng(Math.round(H * 1000))
      for (let i = 0; i < 9; i++) {
        const blot = new THREE.SphereGeometry(0.03 * k * (0.6 + r() * 0.7), 10, 6)
        blot.scale(1, 0.6, 0.25)
        const a = r() * Math.PI * 2
        const along = (r() - 0.5) * bodyL * 0.9
        b.add('smoke', blot, { p: [along, bodyY + Math.sin(a) * bodyR * 0.88, Math.cos(a) * bodyR * 0.88], r: [a, 0, 0] })
      }
      const p = neck.getPointAt(0.55)
      const blot = new THREE.SphereGeometry(0.03 * k, 10, 6)
      blot.scale(0.6, 1.2, 0.3)
      b.add('smoke', blot, { p: [p.x, p.y, 0.028 * k] })
    }
    return b
}

/* ------------------------------------------------------------------ */
/* votive-plaque                                                       */
/* ------------------------------------------------------------------ */

type PlaqueMotif = 'rider' | 'deity' | 'serpent' | 'procession' | 'canopy'
const MOTIFS: PlaqueMotif[] = ['rider', 'deity', 'serpent', 'procession', 'canopy']

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

/** The plaque's paints, worn: the fired body, red earth, ochre, chalk, soot. */
type Paint = 'clay' | 'red' | 'ochre' | 'white' | 'dark'
const PAINT: Record<Paint, THREE.Color> = {
  clay: new THREE.Color('#b8633f'),
  red: new THREE.Color('#8e3a26'),
  ochre: new THREE.Color('#c48a4c'),
  white: new THREE.Color('#dcc3a2'),
  dark: new THREE.Color('#4e281c'),
}

/**
 * A relief element, modelled as Molela's makers build a plaque: rolled coils and pressed pads of
 * clay laid on the slab and smoothed in. Plaque-local units (width 1, origin at the bottom
 * centre, y up to ~1.1); `h` is the element's height in units of the plaque's relief depth
 * (negative: an incision, a pressed eye).
 */
type Prim = { kind: 'pad'; x: number; y: number; rx: number; ry: number; h: number; c: Paint; rot?: number } | { kind: 'coil'; pts: [number, number][]; r: number; h: number; c: Paint }

const pad = (x: number, y: number, rx: number, ry: number, h: number, c: Paint, rot = 0): Prim => ({ kind: 'pad', x, y, rx, ry, h, c, rot })
const coil = (pts: [number, number][], r: number, h: number, c: Paint): Prim => ({ kind: 'coil', pts, r, h, c })
const eye = (x: number, y: number, r: number): Prim[] => [pad(x, y, r, r * 0.7, 0.25, 'white'), pad(x, y, r * 0.45, r * 0.45, -0.35, 'dark')]

/** A rider on a horse at (x, y), scale s (the procession's riders are small ones). */
function riderPrims(x: number, y: number, s: number): Prim[] {
  const P = (px: number, py: number): [number, number] => [x + px * s, y + py * s]
  const out: Prim[] = []
  // the horse: barrel, chest, arched neck, long head, ears, four legs, a tail
  out.push(pad(...P(0, 0), 0.25 * s, 0.1 * s, 1, 'white'))
  out.push(pad(...P(0.19, 0.03), 0.09 * s, 0.1 * s, 1, 'white'))
  out.push(coil([P(0.2, 0.08), P(0.27, 0.2), P(0.3, 0.3)], 0.055 * s, 0.95, 'white'))
  out.push(coil([P(0.29, 0.31), P(0.38, 0.27), P(0.44, 0.22)], 0.045 * s, 0.9, 'white'))
  out.push(coil([P(0.27, 0.34), P(0.26, 0.41)], 0.016 * s, 0.7, 'white'))
  out.push(coil([P(0.31, 0.34), P(0.31, 0.41)], 0.016 * s, 0.7, 'white'))
  out.push(...eye(...P(0.34, 0.29), 0.022 * s))
  for (const [lx, bend] of [
    [-0.18, 0.02],
    [-0.1, -0.03],
    [0.12, 0.03],
    [0.2, -0.02],
  ])
    out.push(coil([P(lx, -0.04), P(lx + bend, -0.14), P(lx, -0.25)], 0.025 * s, 0.8, 'white'))
  out.push(coil([P(-0.24, 0.03), P(-0.31, -0.04), P(-0.3, -0.16)], 0.022 * s, 0.7, 'white'))
  // trappings: a saddle cloth with a border, a collar of dots, a bridle
  out.push(pad(...P(-0.03, 0.02), 0.11 * s, 0.075 * s, 1.3, 'red'))
  out.push(coil([P(-0.14, -0.04), P(0.08, -0.04)], 0.012 * s, 1.45, 'ochre'))
  for (let i = 0; i < 5; i++) out.push(pad(...P(0.2 + i * 0.022, 0.1 + i * 0.045), 0.012 * s, 0.012 * s, 1.25, 'ochre'))
  out.push(coil([P(0.34, 0.33), P(0.41, 0.2)], 0.008 * s, 1.15, 'red'))
  // the rider: a leg over the flank, the torso, a raised arm with a staff, the head, a turban
  out.push(coil([P(0.0, 0.08), P(0.04, -0.02), P(0.02, -0.12)], 0.03 * s, 1.5, 'red'))
  out.push(coil([P(-0.01, 0.1), P(0.0, 0.28)], 0.055 * s, 1.5, 'red'))
  out.push(coil([P(0.02, 0.25), P(0.12, 0.3), P(0.15, 0.4)], 0.02 * s, 1.5, 'ochre'))
  out.push(coil([P(0.16, 0.2), P(0.14, 0.58)], 0.01 * s, 1.4, 'dark'))
  out.push(pad(...P(0.0, 0.36), 0.05 * s, 0.055 * s, 1.6, 'ochre'))
  out.push(pad(...P(-0.01, 0.42), 0.06 * s, 0.03 * s, 1.7, 'red'))
  out.push(...eye(...P(0.022, 0.365), 0.016 * s))
  return out
}

/** The motif's relief elements. */
function motifPrims(motif: PlaqueMotif): Prim[] {
  const out: Prim[] = []
  if (motif === 'rider') {
    out.push(...riderPrims(-0.04, 0.48, 1))
    // a ground line of pressed dots under the hooves
    for (let i = 0; i < 9; i++) out.push(pad(-0.36 + i * 0.09, 0.15, 0.022, 0.022, 0.6, 'ochre'))
  } else if (motif === 'deity') {
    // a seated figure under a canopy: a lotus seat, crossed legs, the torso, two arms raised, a crowned head
    const arc: [number, number][] = []
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (i / 14)
      arc.push([Math.cos(a) * 0.36, 0.72 + Math.sin(a) * 0.3])
    }
    out.push(coil(arc, 0.03, 0.9, 'ochre'))
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (i / 12)
      out.push(pad(Math.cos(a) * 0.43, 0.72 + Math.sin(a) * 0.36, 0.024, 0.024, 0.7, 'red'))
    }
    for (const sx of [-1, 1]) out.push(coil([[sx * 0.36, 0.72], [sx * 0.36, 0.22]], 0.026, 0.8, 'ochre'))
    for (let i = 0; i < 7; i++) out.push(pad(-0.24 + i * 0.08, 0.22, 0.045, 0.03, 0.9, 'red', i % 2 ? 0.3 : -0.3))
    out.push(pad(0, 0.33, 0.22, 0.075, 1.1, 'red'))
    out.push(coil([[0, 0.38], [0, 0.6]], 0.085, 1.2, 'ochre'))
    for (const sx of [-1, 1]) {
      out.push(coil([[sx * 0.07, 0.56], [sx * 0.17, 0.5], [sx * 0.2, 0.62]], 0.025, 1.3, 'ochre'))
      out.push(pad(sx * 0.2, 0.65, 0.03, 0.035, 1.35, 'white'))
    }
    out.push(pad(0, 0.71, 0.075, 0.085, 1.55, 'white'))
    out.push(...eye(-0.028, 0.72, 0.018), ...eye(0.028, 0.72, 0.018))
    out.push(coil([[-0.07, 0.8], [0, 0.86], [0.07, 0.8]], 0.03, 1.5, 'red'))
    for (const dx of [-0.05, 0, 0.05]) out.push(pad(dx, 0.88 + (dx === 0 ? 0.03 : 0), 0.02, 0.035, 1.5, 'ochre'))
    // a necklace of dots
    for (let i = 0; i < 5; i++) out.push(pad(-0.06 + i * 0.03, 0.6 - Math.abs(i - 2) * 0.012, 0.012, 0.012, 1.4, 'white'))
  } else if (motif === 'procession') {
    // three riders, one a little ahead, between a band of dots and a ground line
    for (const [i, x] of [-0.27, 0.02, 0.3].entries()) out.push(...riderPrims(x - 0.07, 0.5 + (i === 1 ? 0.04 : 0), 0.52))
    for (let i = 0; i < 9; i++) out.push(pad(-0.36 + i * 0.09, 0.9, 0.022, 0.022, 0.8, 'ochre'))
    out.push(coil([[-0.42, 0.34], [0.42, 0.34]], 0.014, 0.7, 'dark'))
  } else if (motif === 'canopy') {
    // a standing figure in a shrine: two pillars, a stepped roof, a lotus base
    for (const sx of [-1, 1]) {
      out.push(coil([[sx * 0.3, 0.26], [sx * 0.3, 0.84]], 0.035, 0.9, 'ochre'))
      for (const y of [0.3, 0.8]) out.push(pad(sx * 0.3, y, 0.055, 0.025, 1.0, 'red'))
    }
    out.push(coil([[-0.4, 0.88], [0.4, 0.88]], 0.025, 1.0, 'red'))
    out.push(coil([[-0.3, 0.95], [0.3, 0.95]], 0.022, 1.0, 'red'))
    out.push(coil([[-0.16, 1.0], [0, 1.1], [0.16, 1.0]], 0.024, 1.0, 'red'))
    for (let i = 0; i < 5; i++) out.push(pad(-0.16 + i * 0.08, 0.27, 0.04, 0.025, 0.9, 'ochre', i % 2 ? 0.4 : -0.4))
    out.push(coil([[0, 0.32], [0, 0.6]], 0.075, 1.2, 'red'))
    out.push(pad(0, 0.36, 0.11, 0.06, 1.15, 'red'))
    for (const sx of [-1, 1]) {
      out.push(coil([[sx * 0.07, 0.58], [sx * 0.13, 0.48], [sx * 0.11, 0.38]], 0.022, 1.3, 'white'))
      out.push(coil([[sx * 0.035, 0.32], [sx * 0.04, 0.28]], 0.02, 1.2, 'white'))
    }
    out.push(pad(0, 0.68, 0.06, 0.07, 1.5, 'white'))
    out.push(...eye(-0.022, 0.69, 0.015), ...eye(0.022, 0.69, 0.015))
    out.push(pad(0, 0.765, 0.065, 0.028, 1.5, 'ochre'))
  } else {
    // a hooded serpent: three coils, the body rising, a fan of five hoods
    for (let i = 0; i < 3; i++) {
      const pts: [number, number][] = []
      const rx = 0.3 - i * 0.065
      for (let j = 0; j <= 16; j++) {
        const a = Math.PI * 2 * (j / 16)
        pts.push([Math.cos(a) * rx, 0.27 + i * 0.1 + Math.sin(a) * 0.05])
      }
      out.push(coil(pts, 0.032, 1 + i * 0.1, i % 2 ? 'ochre' : 'white'))
    }
    out.push(coil([[0.12, 0.45], [0.05, 0.55], [0, 0.66]], 0.045, 1.3, 'white'))
    for (let i = -2; i <= 2; i++) {
      const a = Math.PI / 2 + i * 0.32
      const cx = Math.cos(a) * 0.12
      const cy = 0.72 + Math.sin(a) * 0.12
      out.push(pad(cx, cy, 0.075, 0.1, 1.15, 'red', a - Math.PI / 2))
      out.push(pad(cx, cy + 0.01, 0.03, 0.05, 1.35, 'ochre', a - Math.PI / 2))
      out.push(...eye(cx + Math.cos(a) * 0.05 - 0.015, cy + Math.sin(a) * 0.05, 0.012), ...eye(cx + Math.cos(a) * 0.05 + 0.015, cy + Math.sin(a) * 0.05, 0.012))
    }
    // the scales: pressed dots along the body's coils
    for (let i = 0; i < 14; i++) out.push(pad(-0.26 + i * 0.04, 0.27 + Math.sin(i) * 0.012, 0.01, 0.01, -0.2, 'dark'))
  }
  return out
}

/** Distance from (px, py) to the segment a–b. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - dx * t, py - ay - dy * t)
}

/**
 * The plaque's modelled face: a height field over the round-headed slab (W wide, ph tall), each
 * element a rounded pad or coil, coloured by the paint of the element that stands highest
 * there, a coil border inset from the edge. Vertex colours carry the paint; metre UVs.
 */
function plaqueFace(motif: PlaqueMotif, W: number, ph: number, relief: number, detail = 1) {
  const prims = motifPrims(motif)
  // the motifs are drawn on a unit-wide plan 1.1 high: fit it to the slab with at most a slight
  // vertical stretch (a tall plaque gives the figures room above and below, never a giraffe's neck)
  const sx = W * 0.82
  const sy = Math.min(ph / 1.1, sx * 1.25)
  const y0 = (ph - 1.1 * sy) * 0.42
  // ~1 cm cells on a niche plaque at full detail, fewer for a small one and on the lower tiers
  // (GRAND §10: a 136-column grid on every plaque was ~60k triangles each)
  const nx = Math.max(28, Math.round(Math.min(136, 150 * W) * detail))
  const ny = Math.min(220, Math.round((nx * ph) / W))
  const spring = ph - W / 2
  const pos: number[] = []
  const col: number[] = []
  const uv: number[] = []
  const c = new THREE.Color()
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const u = (i / nx) * 2 - 1
      const v = j / ny
      let x = (u * W) / 2
      let y = v * ph
      if (y > spring) {
        // the square above the springing mapped on to the half disc (elliptical grid mapping)
        const a = u
        const b = (y - spring) / (W / 2)
        x = (a * Math.sqrt(Math.max(0, 1 - (b * b) / 2)) * W) / 2
        y = spring + (b * Math.sqrt(Math.max(0, 1 - (a * a) / 2)) * W) / 2
      }
      const X = x / sx
      const Y = (y - y0) / sy
      let best = 0
      let paint: Paint = 'clay'
      let cut = 0
      // the paint blends between neighbouring elements by their height (no stair-stepped edges)
      let wSum = 0
      const mix = new THREE.Color(0, 0, 0)
      for (const p of prims) {
        let d: number
        if (p.kind === 'pad') {
          const cr = Math.cos(p.rot ?? 0)
          const sr = Math.sin(p.rot ?? 0)
          const lx = (X - p.x) * cr + (Y - p.y) * sr
          const ly = -(X - p.x) * sr + (Y - p.y) * cr
          d = Math.hypot(lx / p.rx, ly / p.ry)
        } else {
          d = Infinity
          for (let k = 0; k < p.pts.length - 1; k++) d = Math.min(d, segDist(X, Y, p.pts[k][0], p.pts[k][1], p.pts[k + 1][0], p.pts[k + 1][1]) / p.r)
        }
        if (d >= 1) continue
        // a rounded pillow profile, steep at its edge as a pressed-on pad is
        const z = p.h * Math.pow(1 - d * d, 1.15)
        if (p.h < 0) cut = Math.min(cut, z)
        else {
          const w = z ** 6
          wSum += w
          mix.r += PAINT[p.c].r * w
          mix.g += PAINT[p.c].g * w
          mix.b += PAINT[p.c].b * w
          if (z > best) {
            best = z
            paint = p.c
          }
        }
      }
      // the coil border, inset from the slab's edge
      const edge = y <= spring ? Math.min(W / 2 - Math.abs(x), y) : W / 2 - Math.hypot(x, y - spring)
      const rim = 0.8 * Math.exp(-(((edge - W * 0.045) / (W * 0.016)) ** 2))
      if (rim > 0.02) {
        const w = rim ** 6
        wSum += w
        mix.r += PAINT.red.r * w
        mix.g += PAINT.red.g * w
        mix.b += PAINT.red.b * w
      }
      if (rim > best) {
        best = rim
        paint = 'red'
      }
      const z = (best + cut) * relief + relief * 0.025 * fbm(x * 16, y * 16, 3, 2)
      pos.push(x, y, Math.max(0, z))
      uv.push(x, y)
      c.copy(PAINT.clay)
      if (wSum > 0) c.lerp(mix.multiplyScalar(1 / wSum), THREE.MathUtils.smoothstep(best, 0.01, 0.3))
      if (cut < 0) c.lerp(PAINT.dark, THREE.MathUtils.smoothstep(-cut, 0.02, 0.15))
      // worn paint: the fired body shows through on the high points and in flakes
      const wear = 0.5 + 0.5 * fbm(x * 9, y * 9, 7, 2)
      if (paint !== 'clay' && wear > 0.66) c.lerp(PAINT.clay, Math.min(0.5, (wear - 0.66) * 2.5))
      col.push(c.r, c.g, c.b)
    }
  const idx: number[] = []
  const R = nx + 1
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * R + i
      idx.push(a, a + 1, a + R, a + 1, a + R + 1, a + R)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function VotivePlaque({ config }: ModelProps) {
  const m = useModelMaterials()
  const motifS = str(config, 'motif', 'rider')
  const motif: PlaqueMotif = (MOTIFS as string[]).includes(motifS) ? (motifS as PlaqueMotif) : 'rider'
  // `size` (the plaque's height, up to 1.1 m for the niche wall) wins over the object's height
  const sizeP = config.props?.size
  const H = typeof sizeP === 'number' ? sizeP : (config.height ?? 0.38)
  const fx = typeof sizeP === 'number' ? sizeP * 0.7 : fp(config, [0.26, 0.26])[0]
  const detail = sculptDetailFor(useMuseum((s) => s.tier))
  const parts = useBuilt(`${geoKey('votive-plaque', config)}|${detail}`, () => {
    const b = new Builder()
    const W = fx * 0.9
    const ph = H - 0.03 // plaque height above its stand
    // a real slab and real relief: modelled up 5 % of the plaque's height (≥ 25 mm on the niche
    // wall's 0.6–1.1 m plaques), so raking light from the niche head models every figure
    const T = Math.max(0.025, H * 0.05)
    const RELIEF = Math.max(0.008, H * 0.05)
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
    const tilt = (g: THREE.BufferGeometry, z: number) => {
      g.translate(0, 0, z)
      g.rotateX(lean)
      g.translate(0, 0.03, 0)
      return g
    }
    b.add('clay', tilt(slabG, 0))
    // the modelled, painted face, laid on the slab's front
    b.add('face', tilt(plaqueFace(motif, W - 2 * SB, ph - SB, RELIEF, detail), T / 2 + 0.0012))
    // small stand behind the foot
    b.add('clay', rbox(W * 0.7, 0.03, 0.08, 0.006), { p: [0, 0.015, 0] })
    return b
  })
  const clay = clayMaterial(m, 'terracotta', 0.1)
  return <Parts parts={parts} materials={{ clay, face: tinted(m.terracotta, '#ffffff', { vertexColors: true, roughness: 0.88, envMapIntensity: 0.55 }) }} />
}

/* ------------------------------------------------------------------ */
/* oculus-plinth                                                       */
/* ------------------------------------------------------------------ */

/**
 * The pool court under the oculus (GRAND §2.5, p07l) on the drawn rings (MUSEUM.oculus.rings): a
 * low curb (its top at the curb height, a brass edge drawn by the water ring) round a pool set
 * into the floor, its floor a dark basin under one full disc of still water. No island shows:
 * the lotus floats on the water. The curb's outer edge is the layout's solid 'oculus-plinth'
 * collider.
 */
export const OCULUS_PLINTH = (() => {
  const [curb, pool, island, centre] = MUSEUM.oculus.rings
  const top = MUSEUM.oculus.curbHeight
  const floor = MUSEUM.oculus.poolLevel - 0.06
  // the island and its centre stay as numbers (older pieces measure from them), sunk under the water
  return { curb: { r: curb, y: top }, pool: { r: pool, y: floor }, island: { r: island, y: floor }, centre: { r: centre, y: floor }, top }
})()

export function OculusPlinth() {
  const m = useModelMaterials()
  const parts = useBuilt('oculus-plinth', () => {
    const b = new Builder()
    const full = Math.PI * 2
    const P = OCULUS_PLINTH
    // crisp faces only (no lathe: its averaged normals would round every step)
    const add = (key: string, ...g: (THREE.BufferGeometry | null)[]) => g.forEach((x) => x && b.add(key, x))
    // the curb: outer face, top, and its inner face down to the pool's floor
    add('step0', cylinderFace(0, 0, P.curb.r, 0, full, 0, P.curb.y, 'out'), annulusFace(0, 0, P.pool.r, P.curb.r, 0, full, P.curb.y, true), cylinderFace(0, 0, P.pool.r, 0, full, P.pool.y, P.curb.y, 'in'))
    // the pool's floor, under the water
    add('step1', annulusFace(0, 0, 0, P.pool.r, 0, full, P.pool.y, true))
    return b
  })
  // a dark stone curb and a black basin: the pool reads as still water holding the sky
  const curb = tinted(m.terracotta, '#2a1712', { roughness: 0.55, envMapIntensity: 0.5 })
  const basin = tinted(m.terracotta, '#07080a', { roughness: 0.6, envMapIntensity: 0.2 })
  return <Parts parts={parts} materials={{ step0: curb, step1: basin }} />
}

/* ------------------------------------------------------------------ */
/* podium (loose)                                                      */
/* ------------------------------------------------------------------ */

export function Podium({ config }: ModelProps) {
  const m = useModelMaterials()
  const H = num(config, 'height', config.height ?? MUSEUM.podium.height)
  // a bracket or stand with no collider gives its size as props w / d instead of a footprint
  const [fx, fz] = fp(config, [num(config, 'w', MUSEUM.podium.size), num(config, 'd', MUSEUM.podium.size)])
  const vitrine = str(config, 'top', 'plain') === 'vitrine'
  const parts = useBuilt(geoKey('podium', config), () => {
    const b = new Builder()
    b.add('gap', rbox(fx - 0.02, 0.025, fz - 0.02, 0.002), { p: [0, 0.0125, 0] })
    b.add('body', rbox(fx, H - 0.025, fz, 0.004), { p: [0, 0.025 + (H - 0.025) / 2, 0] })
    if (vitrine) b.add('glass', rbox(fx - 0.01, fx * 1.1, fz - 0.01, 0.002), { p: [0, H + (fx * 1.1) / 2, 0] })
    // `edge`: a polished brass lip round the top, so a lacquered plinth's edge catches the light
    if (config.props?.edge === true) b.add('brass', rbox(fx + 0.012, 0.014, fz + 0.012, 0.003), { p: [0, H - 0.007, 0] })
    // `label`: a brass label strip on the visitor's face (+z), under the top
    if (config.props?.label === true) b.add('brass', rbox(Math.min(fx * 0.62, 0.42), 0.045, 0.006, 0.002), { p: [0, H - 0.11, fz / 2 + 0.003] })
    return b
  })
  // `finish`: an optional body colour over the oxblood lacquer (the Herd's rose-lime steps, C's charcoal)
  const finish = str(config, 'finish', '')
  const body = /^#[0-9a-f]{6}$/i.test(finish) ? tinted(m.oxblood, finish, { roughness: num(config, 'roughness', 0.7) }) : m.oxblood
  return <Parts parts={parts} materials={{ body, gap: m.shadowGap, glass: m.glass, brass: m.brass }} />
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
