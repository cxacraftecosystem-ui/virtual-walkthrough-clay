/**
 * Museum shop furniture (zone 'shop'): timber wall shelving, low display tables, a stole
 * rail and the counter — each dressed with folded printed cloths, cushions and stoles in
 * placeholder colourways (models/amenityTextures.ts print atlas: one material, one draw
 * call per piece of furniture).
 *
 * `props.dressing: 'clay'` (the default; the clay pavilion's Haat) dresses the shelf, the table
 * and the counter for clay instead: rammed earth and timber, wares of four forms in four clays
 * as instanced meshes (the tier caps how many), and a hand-tied card tag on some — blank while
 * the object is a placeholder, else written from `props.tags`. Shelves follow a curved wall with
 * `curveR`; the table becomes a round stepped "kiln load" of `tiers` drums.
 *
 * Every model: origin at floor centre, front faces +z, built to footprint/height.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { SceneObjectConfig } from '../config/objects'
import { useSpectacle } from '../spectacle/settings'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { vesselProfile } from './clay'
import { box, Builder, cyl, lathe, Parts, rbox, rng, useBuilt } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { cellUV, parseShopTags, printMaterial, TAG_ATLAS, tagAtlas, tagCellUV, type ShopTag } from './amenityTextures'
import { fp, geoKey, num, str, type ModelProps } from './types'

const isClay = (c: SceneObjectConfig) => str(c, 'dressing', 'clay') === 'clay'

/** A printed part: plain 0..1-UV box remapped into atlas cell `cell`. */
function printBox(w: number, h: number, d: number, cell: number) {
  return cellUV(new THREE.BoxGeometry(w, h, d), cell)
}

/** A neat stack of folded lengths standing on y = 0 (local), `n` cloths, returns its height. */
function foldStack(b: Builder, x: number, y: number, z: number, w: number, d: number, n: number, r: () => number, rotY = 0) {
  let top = y
  for (let i = 0; i < n; i++) {
    const h = 0.03 + r() * 0.018
    const jx = (r() - 0.5) * 0.02
    const jz = (r() - 0.5) * 0.015
    b.add('print', printBox(w + (r() - 0.5) * 0.02, h, d, Math.floor(r() * 8)), { p: [x + jx, top + h / 2, z + jz], r: [0, rotY + (r() - 0.5) * 0.05, 0] })
    top += h
  }
  return top
}

/** Two or three plump cushions leaning against each other. */
function cushions(b: Builder, x: number, y: number, z: number, r: () => number, count = 2) {
  for (let i = 0; i < count; i++) {
    const s = 0.36 + r() * 0.06
    b.add('print', cellUV(new RoundedBoxGeometry(s, s, 0.13, 3, 0.05), Math.floor(r() * 8)), {
      p: [x + (i - (count - 1) / 2) * 0.3, y + s / 2 - 0.02, z - 0.02 + i * 0.03],
      r: [-0.18 + r() * 0.1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.12],
    })
  }
}

/* ------------------------------------------------------------------ */
/* Wall shelving                                                       */
/* ------------------------------------------------------------------ */

export function ShopShelf({ config }: ModelProps) {
  return isClay(config) ? <ClayShopShelf config={config} /> : <ClothShopShelf config={config} />
}

function ClothShopShelf({ config }: ModelProps) {
  const m = useModelMaterials()
  const [W, D] = fp(config, [3.0, 0.45])
  const H = config.height ?? 2.5
  const seed = num(config, 'seed', 1)
  const withCushions = config.props?.cushions === true
  const parts = useBuilt(geoKey('shop-shelf', config), () => {
    const b = new Builder()
    const r = rng(seed * 101)
    const bays = Math.max(1, Math.round(W / 1.0))
    const t = 0.036
    const levels = [0.1, 0.56, 1.02, 1.48, 1.94]
    // plinth, back panel, crown
    b.add('shadow', box(W - 0.04, 0.1, D - 0.06), { p: [0, 0.05, 0.01] })
    b.add('back', box(W, H - 0.1, 0.018, 'y'), { p: [0, 0.1 + (H - 0.1) / 2, -D / 2 + 0.009] })
    b.add('oak', rbox(W + 0.02, 0.05, D, 0.004, 2, 'x'), { p: [0, H - 0.025, 0] })
    // uprights
    for (let i = 0; i <= bays; i++) b.add('oak', rbox(t, H - 0.05, D - 0.02, 0.003, 2, 'y'), { p: [-W / 2 + t / 2 + (i * (W - t)) / bays, (H - 0.05) / 2, 0.01] })
    // shelves + their contents
    const bw = (W - t) / bays
    for (const y of levels) {
      b.add('oak', rbox(W - 0.01, 0.03, D - 0.04, 0.003, 2, 'x'), { p: [0, y + 0.015, 0.0] })
      for (let i = 0; i < bays; i++) {
        const cx = -W / 2 + t / 2 + bw * (i + 0.5)
        const top = y + 0.03
        const kind = r()
        if (withCushions && y > 1 && kind < 0.45) cushions(b, cx, top, 0.02, r, 2)
        else if (kind < 0.12 && y > 0.3) {
          // a CC0-free little still life: a turned bowl
          b.add('clay', lathe([[0, 0], [0.07, 0.005], [0.1, 0.04], [0.105, 0.075], [0.095, 0.08]], 20), { p: [cx, top, 0.02] })
        } else {
          const n = y < 0.3 ? 5 : 3 + Math.floor(r() * 3)
          foldStack(b, cx - bw * 0.22, top, 0.02, bw * 0.4, D * 0.66, n, r)
          foldStack(b, cx + bw * 0.22, top, 0.02, bw * 0.4, D * 0.66, Math.max(2, n - 1 - Math.floor(r() * 2)), r)
        }
      }
    }
    return b
  })
  return <Parts parts={parts} materials={{ oak: m.oak, back: m.walnut, shadow: m.shadowGap, print: printMaterial(), clay: m.terracotta }} />
}

/* ------------------------------------------------------------------ */
/* Display table                                                       */
/* ------------------------------------------------------------------ */

export function ShopTable({ config }: ModelProps) {
  return isClay(config) ? <ClayShopTable config={config} /> : <ClothShopTable config={config} />
}

function ClothShopTable({ config }: ModelProps) {
  const m = useModelMaterials()
  const [W, D] = fp(config, [1.6, 0.8])
  const H = config.height ?? 0.78
  const seed = num(config, 'seed', 3)
  const withCushions = config.props?.cushions === true
  const parts = useBuilt(geoKey('shop-table', config), () => {
    const b = new Builder()
    const r = rng(seed * 313)
    const top = 0.045
    b.add('oak', rbox(W, top, D, 0.006, 2, 'x'), { p: [0, H - top / 2, 0] })
    // slim apron + four square legs, low shelf
    for (const sz of [-1, 1]) b.add('oak', box(W - 0.14, 0.08, 0.022, 'x'), { p: [0, H - top - 0.04, sz * (D / 2 - 0.06)] })
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.add('oak', rbox(0.05, H - top, 0.05, 0.004, 2, 'y'), { p: [sx * (W / 2 - 0.06), (H - top) / 2, sz * (D / 2 - 0.06)] })
    b.add('oak', rbox(W - 0.1, 0.025, D - 0.1, 0.004, 2, 'x'), { p: [0, 0.2, 0] })
    // top: three stacks (or cushions), lower shelf: two long stacks
    if (withCushions) {
      cushions(b, -W * 0.28, H, 0, r, 2)
      foldStack(b, W * 0.12, H, 0, 0.32, 0.4, 5, r)
      foldStack(b, W * 0.36, H, -0.05, 0.3, 0.36, 3, r, 0.2)
    } else {
      foldStack(b, -W * 0.3, H, 0, 0.34, 0.42, 5, r)
      foldStack(b, 0, H, 0.02, 0.34, 0.42, 4, r)
      foldStack(b, W * 0.26, H, -0.04, 0.3, 0.38, 3, r, -0.25)
    }
    foldStack(b, -W * 0.22, 0.2125, 0, 0.5, 0.46, 3, r)
    foldStack(b, W * 0.22, 0.2125, 0, 0.5, 0.46, 2, r)
    return b
  })
  return <Parts parts={parts} materials={{ oak: m.oak, print: printMaterial() }} />
}

/* ------------------------------------------------------------------ */
/* Stole rail                                                          */
/* ------------------------------------------------------------------ */

export function StoleRail({ config }: ModelProps) {
  const m = useModelMaterials()
  const [W, D] = fp(config, [2.6, 0.45])
  const H = config.height ?? 1.75
  const count = Math.round(num(config, 'count', 7))
  const seed = num(config, 'seed', 21)
  const parts = useBuilt(geoKey('stole-rail', config), () => {
    const b = new Builder()
    const r = rng(seed * 17)
    const rail = H - 0.05
    // two timber A-frame ends on a walnut base, brass rail
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.05)
      b.add('walnut', rbox(0.06, 0.04, D, 0.004, 2, 'z'), { p: [x, 0.02, 0] })
      b.add('walnut', rbox(0.045, rail, 0.045, 0.004, 2, 'y'), { p: [x, rail / 2, 0] })
      b.add('brass', cyl(0.016, 0.016, 0.02, 12), { p: [x, rail, 0] })
    }
    b.add('brass', cyl(0.012, 0.012, W - 0.1, 16).rotateZ(Math.PI / 2), { p: [0, rail, 0] })
    b.add('brass', cyl(0.009, 0.009, W - 0.1, 12).rotateZ(Math.PI / 2), { p: [0, 0.3, 0] })
    // stoles draped over the rail: a front and a back fall joined over the top
    const pitch = (W - 0.4) / Math.max(1, count - 1)
    for (let i = 0; i < count; i++) {
      const x = -W / 2 + 0.2 + i * pitch + (r() - 0.5) * 0.03
      const w = 0.26 + r() * 0.06
      const cell = Math.floor(r() * 8)
      const front = 0.9 + r() * 0.3
      const back = front - 0.08 - r() * 0.1
      const tilt = (r() - 0.5) * 0.04
      b.add('print', printBox(w, front, 0.006, cell), { p: [x, rail - front / 2, 0.022], r: [0.03, 0, tilt] })
      b.add('print', printBox(w, back, 0.006, cell), { p: [x, rail - back / 2, -0.022], r: [-0.03, 0, tilt] })
      b.add('print', printBox(w, 0.012, 0.05, cell), { p: [x, rail + 0.014, 0] })
    }
    return b
  })
  return <Parts parts={parts} materials={{ walnut: m.walnut, brass: m.brass, print: printMaterial() }} />
}

/* ------------------------------------------------------------------ */
/* Counter                                                             */
/* ------------------------------------------------------------------ */

export function ShopCounter({ config }: ModelProps) {
  return isClay(config) ? <ClayShopCounter config={config} /> : <ClothShopCounter config={config} />
}

function ClothShopCounter({ config }: ModelProps) {
  const m = useModelMaterials()
  const [W, D] = fp(config, [2.2, 0.6])
  const H = config.height ?? 1.0
  const parts = useBuilt(geoKey('shop-counter', config), () => {
    const b = new Builder()
    const r = rng(5)
    // recessed plinth, fluted walnut front, stone top
    b.add('shadow', box(W - 0.08, 0.08, D - 0.08), { p: [0, 0.04, 0] })
    b.add('walnut', rbox(W - 0.02, H - 0.12, D - 0.04, 0.005, 2, 'y'), { p: [0, 0.08 + (H - 0.12) / 2, 0] })
    const flutes = Math.floor((W - 0.1) / 0.06)
    for (let i = 0; i < flutes; i++) {
      const x = -W / 2 + 0.05 + (i + 0.5) * ((W - 0.1) / flutes)
      b.add('walnut', cyl(0.016, 0.016, H - 0.18, 8), { p: [x, 0.08 + (H - 0.12) / 2, D / 2 - 0.02 + 0.004] })
    }
    b.add('brass', box(W - 0.02, 0.012, 0.012), { p: [0, H - 0.046, D / 2 - 0.008] })
    b.add('stone', rbox(W + 0.04, 0.04, D + 0.04, 0.006, 2, 'x'), { p: [0, H - 0.02, 0] })
    // on top: a folded length, a brass bell, a small tray of cards
    foldStack(b, W * 0.28, H, 0, 0.36, 0.3, 2, r, 0.2)
    b.add('brass', lathe([[0, 0], [0.04, 0.002], [0.042, 0.01], [0.03, 0.03], [0.012, 0.05], [0.004, 0.07], [0, 0.072]], 20), { p: [-W * 0.3, H, 0.05] })
    b.add('walnut', rbox(0.2, 0.02, 0.12, 0.003), { p: [-W * 0.08, H + 0.01, 0.1] })
    b.add('paper', box(0.18, 0.012, 0.1), { p: [-W * 0.08, H + 0.026, 0.1] })
    // low back shelf against the wall with more stock
    const bz = -D / 2 - 0.36
    b.add('walnut', rbox(W, 0.03, 0.32, 0.004, 2, 'x'), { p: [0, 0.86, bz] })
    b.add('walnut', rbox(W, 0.03, 0.32, 0.004, 2, 'x'), { p: [0, 0.44, bz] })
    for (const sx of [-1, 0, 1]) b.add('walnut', box(0.03, 0.87, 0.32), { p: [sx * (W / 2 - 0.015), 0.435, bz] })
    for (const y of [0.455, 0.875]) for (let i = 0; i < 3; i++) foldStack(b, -W / 2 + 0.36 + i * ((W - 0.72) / 2), y, bz, 0.34, 0.26, 3 + Math.floor(r() * 2), r)
    return b
  })
  return <Parts parts={parts} materials={{ walnut: m.walnut, brass: m.brass, stone: m.counterStone, shadow: m.shadowGap, print: printMaterial(), paper: m.paper }} />
}

/* ------------------------------------------------------------------ */
/* The Haat: clay dressing (props.dressing 'clay')                     */
/* ------------------------------------------------------------------ */

/** One piece of ware on a shelf or a table (local space). */
interface Ware {
  form: WareForm
  clay: WareClay
  x: number
  y: number
  z: number
  s: number
  ry: number
  /** Hang a card tag on it. */
  tag?: boolean
}
type WareForm = 'matka' | 'kulhad' | 'surahi' | 'diya' | 'handi' | 'jar' | 'vase' | 'lidded'
/** The traditions' bodies: red and terracotta (Bankura, Gorakhpur, Manamadurai), black (Longpi, Nizamabad), buff, Pokaran pink, geru slip, Jaipur's white quartz, glazed blue (Khurja). */
type WareClay = 'terracotta' | 'red' | 'black' | 'buff' | 'pink' | 'geru' | 'quartz' | 'blue'

/** Base size of each form at scale 1: [radius, height]. */
const WARE_SIZE: Record<WareForm, [number, number]> = {
  matka: [0.11, 0.2],
  kulhad: [0.042, 0.075],
  surahi: [0.075, 0.26],
  diya: [0.05, 0.03],
  handi: [0.1, 0.15],
  jar: [0.085, 0.19],
  vase: [0.07, 0.24],
  lidded: [0.08, 0.15],
}
const WARE_COLOR: Record<WareClay, string> = { terracotta: '#b8633f', red: '#9a4630', black: '#2a2523', buff: '#d6b38c', pink: '#d39c84', geru: '#8f3d25', quartz: '#ece9e2', blue: '#3b5ea8' }
const WARE_FORMS: WareForm[] = ['matka', 'kulhad', 'surahi', 'diya', 'handi', 'jar', 'vase', 'lidded']

const wareGeos = new Map<WareForm, THREE.BufferGeometry>()
function wareGeometry(form: WareForm) {
  let g = wareGeos.get(form)
  if (!g) {
    const [R, H] = WARE_SIZE[form]
    g = lathe(vesselProfile(form, R, H), 24)
    wareGeos.set(form, g)
  }
  return g
}

const wareMats = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>()
/** One fired-clay material for every piece (per tier's maps); the instance colour gives the body. */
function wareMaterial(m: ReturnType<typeof useModelMaterials>) {
  const base = m.terracotta as THREE.MeshStandardMaterial
  let w = wareMats.get(base)
  if (!w) {
    w = new THREE.MeshStandardMaterial({ name: 'haatWare', color: '#ffffff', map: base.map, normalMap: base.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.62, metalness: 0, envMapIntensity: 0.75 })
    wareMats.set(base, w)
  }
  return w
}

const TAG_W = 0.06
const TAG_H = 0.036

/** The wares as one instanced mesh per form (four draws), plus their card tags (one more). */
function ClayWares({ wares, tags }: { wares: Ware[]; tags: ShopTag[] }) {
  const m = useModelMaterials()
  const mat = wareMaterial(m)
  const byForm = useMemo(() => WARE_FORMS.map((f) => ({ form: f, list: wares.filter((w) => w.form === f) })).filter((g) => g.list.length), [wares])
  const tagged = useMemo(() => wares.filter((w) => w.tag), [wares])
  const tagGeo = useMemo(() => new THREE.PlaneGeometry(TAG_W, TAG_H), [])
  const tagMat = useMemo(() => new THREE.MeshStandardMaterial({ name: 'haatTag', color: '#c9a77a', roughness: 0.95, side: THREE.DoubleSide }), [])
  useEffect(
    () => () => {
      tagGeo.dispose()
      tagMat.dispose()
    },
    [tagGeo, tagMat],
  )
  const written = tags.length > 0
  return (
    <group>
      {byForm.map(({ form, list }) => (
        <WareInstances key={form} geo={wareGeometry(form)} mat={mat} list={list} />
      ))}
      {!written && tagged.length > 0 && <TagInstances geo={tagGeo} mat={tagMat} list={tagged} />}
      {written && <WrittenTags wares={tagged} tags={tags} />}
    </group>
  )
}

/** Where a ware's tag hangs: off its shoulder, towards the front, tipped a little. */
function tagMatrix(w: Ware, out: THREE.Matrix4) {
  const [R, H] = WARE_SIZE[w.form]
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, w.ry * 0.2 + 0.3, 0.25))
  return out.compose(new THREE.Vector3(w.x + R * w.s * 0.7, w.y + H * w.s * 0.55, w.z + R * w.s + 0.012), q, new THREE.Vector3(1, 1, 1))
}

function WareInstances({ geo, mat, list }: { geo: THREE.BufferGeometry; mat: THREE.Material; list: Ware[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const mx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    list.forEach((w, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.ry)
      mx.compose(new THREE.Vector3(w.x, w.y, w.z), q, new THREE.Vector3(w.s, w.s, w.s))
      im.setMatrixAt(i, mx)
      im.setColorAt(i, c.set(WARE_COLOR[w.clay]))
    })
    im.count = list.length
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
  }, [list])
  return <instancedMesh key={list.length} ref={ref} args={[geo, mat, Math.max(1, list.length)]} castShadow receiveShadow raycast={() => null} />
}

function TagInstances({ geo, mat, list }: { geo: THREE.BufferGeometry; mat: THREE.Material; list: Ware[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const mx = new THREE.Matrix4()
    list.forEach((w, i) => im.setMatrixAt(i, tagMatrix(w, mx)))
    im.count = list.length
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [list])
  return <instancedMesh key={list.length} ref={ref} args={[geo, mat, Math.max(1, list.length)]} castShadow={false} raycast={() => null} />
}

function WrittenTags({ wares, tags }: { wares: Ware[]; tags: ShopTag[] }) {
  const atlas = useAsyncTexture(() => tagAtlas(tags), [JSON.stringify(tags)])
  if (!atlas) return null
  return (
    <>
      {wares.slice(0, Math.min(tags.length, TAG_ATLAS.cols * TAG_ATLAS.rows)).map((w, i) => (
        <WrittenTag key={i} ware={w} cell={i} map={atlas} />
      ))}
    </>
  )
}

function WrittenTag({ ware, cell, map }: { ware: Ware; cell: number; map: THREE.Texture }) {
  const geo = useMemo(() => tagCellUV(new THREE.PlaneGeometry(TAG_W * 1.4, TAG_H * 1.4), cell), [cell])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map, roughness: 0.95, side: THREE.DoubleSide }), [map])
  const mx = useMemo(() => tagMatrix(ware, new THREE.Matrix4()), [ware])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} matrix={mx} matrixAutoUpdate={false} raycast={() => null} />
}

/** The object's shop tags: none while it is a placeholder (nothing named before it is confirmed). */
function useShopTags(config: SceneObjectConfig) {
  const raw = config.placeholder ? '' : str(config, 'tags', '')
  return useMemo(() => parseShopTags(raw), [raw])
}

/** Choose a form and clay for a ware on shelf level `level` (0 = lowest) of `levels`. */
function pickWare(r: () => number, level: number, levels: number): { form: WareForm; clay: WareClay } {
  // weighted: mostly the everyday reds, then black ware, pale bodies and the glazes
  const clays: WareClay[] = ['terracotta', 'terracotta', 'red', 'red', 'black', 'black', 'buff', 'pink', 'geru', 'quartz', 'blue']
  const clay = clays[Math.floor(r() * clays.length)]
  const t = level / Math.max(1, levels - 1)
  const x = r()
  if (t < 0.34) return { form: x < 0.4 ? 'matka' : x < 0.6 ? 'handi' : x < 0.8 ? 'jar' : 'surahi', clay }
  if (t < 0.67) return { form: x < 0.3 ? 'surahi' : x < 0.5 ? 'vase' : x < 0.7 ? 'lidded' : x < 0.85 ? 'jar' : 'kulhad', clay }
  return { form: x < 0.45 ? 'kulhad' : x < 0.75 ? 'diya' : 'lidded', clay }
}

/**
 * Wall shelving dressed with clay wares, on a curved wall (`curveR`, round the drum centre at
 * `|position|` along local +z) in bays ~0.62 m wide turned to the curve: rammed-earth uprights,
 * timber shelves on `tiers` levels, wares in rows, a card tag on every third piece.
 */
function ClayShopShelf({ config }: ModelProps) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const [W, D] = fp(config, [2.5, 0.45])
  const H = config.height ?? 2.3
  const seed = num(config, 'seed', 1)
  const tiers = Math.max(2, Math.round(num(config, 'tiers', 4)))
  const Rw = num(config, 'curveR', 0)
  const cz = Math.hypot(config.position[0], config.position[2])
  const curved = Rw > 0
  const rMid = Rw - 0.01 - D / 2
  const bays = Math.max(1, Math.round(W / 0.62))
  const span = curved ? W / rMid : 0
  const bw = curved ? 2 * rMid * Math.sin(span / bays / 2) * 1.002 : W / bays
  const levels = useMemo(() => Array.from({ length: tiers }, (_, i) => 0.14 + (i * (H - 0.4)) / (tiers - 1 + 0.35)), [tiers, H])
  const bayT = useMemo(
    () =>
      Array.from({ length: bays }, (_, i) => {
        if (!curved) return { x: -W / 2 + bw * (i + 0.5), z: 0, ry: 0 }
        const a = -span / 2 + (span * (i + 0.5)) / bays
        return { x: rMid * Math.sin(a), z: cz - rMid * Math.cos(a), ry: -a }
      }),
    [bays, curved, W, bw, span, rMid, cz],
  )
  const parts = useBuilt(geoKey('shop-shelf-clay', config), () => {
    const b = new Builder()
    for (const { x, z, ry } of bayT) {
      const P = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)]
      const R: [number, number, number] = [0, ry, 0]
      b.add('back', box(bw, H - 0.1, 0.02, 'y'), { p: P(0, 0.1 + (H - 0.1) / 2, -D / 2 + 0.01), r: R })
      for (const sx of [-1, 1]) b.add('earth', rbox(0.035, H, D, 0.006, 2, 'y'), { p: P(sx * (bw / 2 - 0.0175), H / 2, 0), r: R })
      for (const y of levels) b.add('oak', rbox(bw - 0.07, 0.03, D - 0.04, 0.004, 2, 'x'), { p: P(0, y + 0.015, 0), r: R })
      b.add('earth', rbox(bw, 0.06, D + 0.02, 0.008, 2, 'x'), { p: P(0, H - 0.03, 0.01), r: R })
    }
    return b
  })
  const tags = useShopTags(config)
  const cap = Math.ceil(sp.caps.shopVessels / 3)
  const wares = useMemo(() => {
    const r = rng(seed * 101 + 7)
    const out: Ware[] = []
    levels.forEach((y, li) => {
      for (const { x, z, ry } of bayT) {
        let lx = -bw / 2 + 0.07
        while (lx < bw / 2 - 0.07) {
          const { form, clay } = pickWare(r, li, levels.length)
          const s = 0.85 + r() * 0.3
          const R = WARE_SIZE[form][0] * s
          if (lx + 2 * R > bw / 2 - 0.05) break
          const cx = lx + R
          const lz = (r() - 0.5) * 0.08
          out.push({ form, clay, x: x + cx * Math.cos(ry) + lz * Math.sin(ry), y: y + 0.03, z: z - cx * Math.sin(ry) + lz * Math.cos(ry), s, ry: r() * Math.PI * 2, tag: out.length % 3 === 1 })
          // a stack of kulhads: two more on top, each nested a little higher
          if (form === 'kulhad' && r() < 0.5)
            for (let k = 1; k <= 2; k++) out.push({ form, clay, x: out[out.length - 1].x, y: y + 0.03 + k * 0.05 * s, z: out[out.length - 1].z, s, ry: r() * 6 })
          lx += 2 * R + 0.035 + r() * 0.04
        }
      }
    })
    return out.slice(0, cap)
  }, [levels, bayT, bw, seed, cap])
  return (
    <group>
      <Parts parts={parts} materials={{ oak: m.teak, back: m.darkTimber, earth: m.rammedEarth }} />
      <ClayWares wares={wares} tags={tags} />
    </group>
  )
}

/**
 * The kiln-load table: a round stepped table in rammed earth (`tiers` drums, radii 0.9 / 0.65 /
 * 0.4 for three), its oxblood-lacquered rims stacked with wares as a kiln is loaded — upturned
 * kulhads in rows on the lowest tier, diyas and surahis on the middle, matkas on top.
 */
function ClayShopTable({ config }: ModelProps) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const tiers = Math.max(1, Math.min(4, Math.round(num(config, 'tiers', 3))))
  const seed = num(config, 'seed', 3)
  const radii = useMemo(() => Array.from({ length: tiers }, (_, i) => 0.9 - (i * 0.5) / Math.max(1, tiers - 1)), [tiers])
  const heights = useMemo(() => Array.from({ length: tiers }, (_, i) => 0.42 + i * 0.27), [tiers])
  const parts = useBuilt(geoKey('shop-table-clay', config), () => {
    const b = new Builder()
    radii.forEach((r, i) => {
      const h = heights[i]
      b.add('earth', cyl(r, r, h - 0.04, 48), { p: [0, (h - 0.04) / 2, 0] })
      b.add('rim', cyl(r + 0.015, r + 0.015, 0.04, 48), { p: [0, h - 0.02, 0] })
    })
    b.add('shadow', cyl(radii[0] - 0.03, radii[0] - 0.03, 0.04, 48), { p: [0, 0.02, 0] })
    return b
  })
  const tags = useShopTags(config)
  const cap = Math.ceil(sp.caps.shopVessels / 3)
  const wares = useMemo(() => {
    const r = rng(seed * 313)
    const out: Ware[] = []
    // load from the top down, so a lower tier cap keeps the crown of the stack
    ;[...radii.keys()].reverse().forEach((i) => {
      const rad = radii[i]
      const y = heights[i]
      const inner = i + 1 < radii.length ? radii[i + 1] : 0
      const ringR = inner > 0 ? (rad + inner) / 2 + 0.01 : 0
      const top = i === radii.length - 1
      if (top) {
        out.push({ form: 'matka', clay: 'black', x: 0, y, z: 0, s: 1.25, ry: 0.4, tag: true })
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2
          out.push({ form: k % 2 ? 'surahi' : 'diya', clay: k % 2 ? 'terracotta' : 'buff', x: Math.cos(a) * rad * 0.68, y, z: Math.sin(a) * rad * 0.68, s: 0.85, ry: a, tag: k === 2 })
        }
        return
      }
      const form: WareForm = i === 0 ? 'kulhad' : r() < 0.5 ? 'surahi' : 'diya'
      const R = WARE_SIZE[form][0]
      const n = Math.floor((Math.PI * 2 * ringR) / (2 * R + 0.035))
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + i * 0.3
        const clay: WareClay = (['terracotta', 'red', 'black', 'buff'] as const)[(k + i) % 4]
        const s = 0.95 + r() * 0.1
        out.push({ form, clay, x: Math.cos(a) * ringR, y, z: Math.sin(a) * ringR, s, ry: a, tag: k % 5 === 0 })
        if (form === 'kulhad' && k % 2 === 0) out.push({ form, clay, x: Math.cos(a) * ringR, y: y + 0.05 * s, z: Math.sin(a) * ringR, s, ry: a + 1 })
      }
    })
    return out.slice(0, cap)
  }, [radii, heights, seed, cap])
  return (
    <group>
      <Parts parts={parts} materials={{ earth: m.rammedEarth, rim: m.oxbloodLacquer, shadow: m.shadowGap }} />
      <ClayWares wares={wares} tags={tags} />
    </group>
  )
}

/** The Haat's counter: clay plaster on a brick base, a walnut top, a brass bell, paper and twine for wrapping. */
function ClayShopCounter({ config }: ModelProps) {
  const m = useModelMaterials()
  const [W, D] = fp(config, [1.5, 0.55])
  const H = config.height ?? 1.0
  const parts = useBuilt(geoKey('shop-counter-clay', config), () => {
    const b = new Builder()
    b.add('brick', box(W - 0.04, 0.22, D - 0.04), { p: [0, 0.11, 0] })
    b.add('clay', rbox(W, H - 0.26, D, 0.012, 2, 'y'), { p: [0, 0.22 + (H - 0.26) / 2, 0] })
    b.add('walnut', rbox(W + 0.05, 0.04, D + 0.05, 0.006, 2, 'x'), { p: [0, H - 0.02, 0] })
    // a band of oxblood at the counter's shoulder
    b.add('band', box(W + 0.002, 0.04, D + 0.002), { p: [0, H - 0.1, 0] })
    // the bell, a stack of paper wrappings, a spool of twine
    b.add('brass', lathe([[0, 0], [0.04, 0.002], [0.042, 0.01], [0.03, 0.03], [0.012, 0.05], [0.004, 0.07], [0, 0.072]], 20), { p: [-W * 0.32, H, 0.08] })
    for (let i = 0; i < 6; i++) b.add('paper', box(0.34, 0.006, 0.26), { p: [W * 0.18, H + 0.003 + i * 0.006, -0.02], r: [0, (i % 2 ? 1 : -1) * 0.04, 0] })
    b.add('twine', cyl(0.035, 0.035, 0.07, 16), { p: [W * 0.02, H + 0.035, 0.12] })
    return b
  })
  const twine = useMemo(() => tinted(m.rope, '#b48a5a'), [m.rope])
  return <Parts parts={parts} materials={{ brick: m.brick, clay: m.clayBuff, walnut: m.walnut, band: m.oxblood, brass: m.brass, paper: m.paper, twine }} />
}
