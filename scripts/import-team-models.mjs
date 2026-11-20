/**
 * Team models: the workshop team's textured GLB models of clay pieces → museum GLBs, every triangle and every
 * texture byte kept.
 *   node scripts/import-team-models.mjs <glb dir> [--verify] [--sheets <dir>]
 *
 * Each GLB in <glb dir> whose name matches a row of PIECES (one mesh, POSITION/NORMAL/TEXCOORD_0, one PBR
 * material with JPEG baseColor + normal + metallicRoughness, about 0.95 units on its longest side) goes through:
 *   read → bake the node transforms and the piece's orientation fix (PIECES `rotate`, applied to positions and
 *   normals) → scale to its display height in metres, centred on x/z with its base at y = 0 → a vertex normal of
 *   zero length (the Harvest Guardian has ten) takes its faces' normal, since it would shade as NaN and the
 *   museum's bloom spreads a NaN pixel over the whole frame → one scene, one
 *   node, one mesh → meshopt reorder + KHR_mesh_quantization (positions 16-bit, normals 12-bit, texcoords
 *   16-bit) + EXT_meshopt_compression at level 'medium' ('high' filters normals to 8 bits and bands the glaze).
 * No simplification, no weld, no texture work: the textures are written back byte for byte (same JPEG, same
 * size, same sampler), which the script asserts, as it asserts that every triangle is kept.
 *
 * GLTFModel.tsx loads them with drei useGLTF (meshopt decoder on), de-quantises the attributes and bakes the
 * node transform; the scene object's `height` (objects.ts TEAM_PIECES) equals the height baked here, so the
 * file is shown 1 : 1.
 *
 * --verify renders every source GLB (with the same orientation, scale and offset applied as a transform, and the
 * same zero-normal repair) and its
 * output (through GLTFModel's de-quantise → bake path) textured, under the same camera and lights, from the
 * front, the right, the back, three-quarters from above and a 3× close-up of the front, in headless Chrome, and
 * fails when more than MAX_DIFF_PCT % of the piece's pixels differ visibly (pixelmatch, threshold 0.1) or the
 * PSNR over the piece falls under MIN_PSNR dB. Pixels where the SOURCE fights itself for depth (coplanar layers in
 * some files: they flicker the same in the original) are found by drawing the source a second time with other near
 * and far planes, are left out of both measures and shown blue. Sheets (source | output | difference, one row per
 * view) go to --sheets (default scripts/out/team-models/).
 *
 * Outputs: public/models/team/<slug>.glb. Prints triangles (unchanged) and bytes before → after per piece and the
 * total. public/models/team/ is already optimised: scripts/optimize-assets.mjs skips it.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public/models/team')
const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const srcDir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--sheets'))
const verify = args.includes('--verify')
const SHEETS = path.resolve(opt('sheets') ?? path.join(ROOT, 'scripts/out/team-models'))
/** A visible difference: more than this share of the piece's pixels differ (pixelmatch, threshold 0.1)… */
const MAX_DIFF_PCT = 0.5
/** …or the piece's pixels fall under this PSNR (in views where the piece covers at least MIN_PSNR_PIXELS pixels). */
const MIN_PSNR = 38
const MIN_PSNR_PIXELS = 6000
/** A podium top is 12 in square (0.305 m): a piece on it keeps a 12 mm margin each side. */
const PODIUM_TOP = 0.28

/**
 * The pieces. `rotate`: orientation fix [x, y, z] in degrees (applied X, then Y, then Z) so the piece stands
 * upright with its front facing +Z; decided from front / side / top renders of every source file — all sixteen
 * are authored upright (+Y); fifteen face +Z already (The Basket Weaver is longest along Z because her basket and
 * its board reach forward, not because she lies down), and the Blossom Bowl's painted inside faces −Z, so it
 * turns half round. `height`: the display
 * height in metres (sizes are unknown: plausible sizes for a podium display, each fitting the 12 in podium top
 * inside PODIUM_TOP unless `podium: false`). `form` notes what the piece is, for the reader of this table.
 */
const PIECES = [
  { slug: 'bankura-horse', match: /^Bankura_ ?Horse/i, rotate: [0, 0, 0], height: 0.45, podium: false, form: 'standing horse, long upright neck (on the Herd’s plinth)' },
  { slug: 'black-elephant', match: /^Black_Elephant/i, rotate: [0, 0, 0], height: 0.19, form: 'standing elephant, trunk curled, head to +Z' },
  { slug: 'black-ganesha-statue', match: /^Black_Ganesha_Statue/i, rotate: [0, 0, 0], height: 0.38, form: 'rounded seated Ganesha, black' },
  { slug: 'blossom-bowl', match: /^Blossom_Bowl/i, rotate: [0, 180, 0], height: 0.3, form: 'shallow oval bowl on its rim; authored with its inside to −Z, turned so the painted inside faces +Z (on a slotted stand)' },
  { slug: 'blue-floral-tile', match: /^Blue_Floral_Tile/i, rotate: [0, 0, 0], height: 0.2, form: 'square tile, upright (on a slotted stand)' },
  { slug: 'festival-dancers', match: /^Festival_Dancers/i, rotate: [0, 0, 0], height: 0.355, form: 'two dancing figures, a drummer and a woman with a pot on her head' },
  { slug: 'hand-of-blue-blossoms', match: /^Hand_of_Blue_Blossoms/i, rotate: [0, 0, 0], height: 0.28, form: 'hand-shaped plaque, upright (on a slotted stand)' },
  { slug: 'harvest-guardian', match: /^Harvest_Guardian/i, rotate: [0, 0, 0], height: 0.25, form: 'seated woman at work on a square board' },
  { slug: 'horse-figurine', match: /^Horse_Figurine/i, rotate: [0, 0, 0], height: 0.38, podium: false, form: 'standing horse with a carved mane (on the Herd’s plinth)' },
  { slug: 'miniature-pottery', match: /^Miniature_Pottery/i, rotate: [0, 0, 0], height: 0.26, form: 'framed shelf of 25 miniature pots, upright (on a slotted stand)' },
  { slug: 'mud-ganesha', match: /^Mud_Ganesha/i, rotate: [0, 0, 0], height: 0.36, form: 'Ganesha on a round pedestal, beaded garland' },
  { slug: 'peacock-shubh-labh', match: /^Peacock_Shubh_Labh/i, rotate: [0, 0, 0], height: 0.24, form: 'a pair of peacock plaques side by side, upright (on a slotted stand)' },
  { slug: 'silent-sentinel', match: /^Silent_Sentinel/i, rotate: [0, 0, 0], height: 0.45, form: 'standing bearded figure in a cap' },
  { slug: 'sunset-shores', match: /^Sunset_Shores/i, rotate: [0, 0, 0], height: 0.25, form: 'round plaque, upright (on a slotted stand)' },
  { slug: 'the-basket-weaver', match: /^The_Basket_Weaver/i, rotate: [0, 0, 0], height: 0.22, form: 'seated woman weaving a basket on a board' },
  { slug: 'twin-clay-ganeshas', match: /^Twin_Clay_Ganeshas/i, rotate: [0, 0, 0], height: 0.17, form: 'two small seated Ganeshas side by side' },
]

/* ------------------------------------------------------------------ math */

const DEG = Math.PI / 180
/** Row-major 3×3 rotation for [x, y, z] degrees applied X, then Y, then Z. */
function rotation([ax, ay, az]) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax * DEG), Math.sin(ax * DEG), Math.cos(ay * DEG), Math.sin(ay * DEG), Math.cos(az * DEG), Math.sin(az * DEG)]
  const X = [1, 0, 0, 0, cx, -sx, 0, sx, cx]
  const Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  const Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1]
  return mul3(Z, mul3(Y, X))
}
function mul3(a, b) {
  const o = new Array(9).fill(0)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c]
  return o
}
/** Column-major 4×4 (glTF world matrix) → its upper-left 3×3, row-major, and translation. */
const linearOf = (m) => ({ l: [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]], t: [m[12], m[13], m[14]] })
/** Inverse transpose of a 3×3 (for normals). */
function normalMatrix(l) {
  const [a, b, c, d, e, f, g, h, i] = l
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  // inverse = adj / det; its transpose is the cofactor matrix / det
  return [A, B, C, -(b * i - c * h), a * i - c * g, -(a * h - b * g), b * f - c * e, -(a * f - c * d), a * e - b * d].map((v) => v / det)
}
const sha = (u8) => crypto.createHash('sha256').update(u8).digest('hex')

/* ------------------------------------------------------------------ one piece */

/** The material's texture slots → { slot: { hash, bytes, mime, size } } (the source of truth for "unchanged"). */
function textureSlots(doc) {
  const mats = doc.getRoot().listMaterials()
  if (mats.length !== 1) throw new Error(`expected one material, found ${mats.length}`)
  const m = mats[0]
  const out = {}
  for (const [slot, tex, info] of [
    ['baseColor', m.getBaseColorTexture(), m.getBaseColorTextureInfo()],
    ['normal', m.getNormalTexture(), m.getNormalTextureInfo()],
    ['metallicRoughness', m.getMetallicRoughnessTexture(), m.getMetallicRoughnessTextureInfo()],
    ['occlusion', m.getOcclusionTexture(), m.getOcclusionTextureInfo()],
    ['emissive', m.getEmissiveTexture(), m.getEmissiveTextureInfo()],
  ]) {
    if (!tex) continue
    const img = tex.getImage()
    out[slot] = {
      hash: sha(img),
      bytes: img.byteLength,
      mime: tex.getMimeType(),
      size: tex.getSize()?.join('×') ?? '?',
      sampler: [info.getMagFilter(), info.getMinFilter(), info.getWrapS(), info.getWrapT(), info.getTexCoord()].join(','),
    }
  }
  return out
}

/** Bake every mesh node's world transform and the orientation fix into its vertices; returns the bounds. */
function bakeOrientation(doc, rot) {
  const root = doc.getRoot()
  const R = rotation(rot)
  const meshNodes = root.listNodes().filter((n) => n.getMesh())
  if (meshNodes.length !== 1) throw new Error(`expected one mesh node, found ${meshNodes.length}`)
  const node = meshNodes[0]
  const { l, t } = linearOf(node.getWorldMatrix())
  const L = mul3(R, l)
  const T = [0, 1, 2].map((r) => R[r * 3] * t[0] + R[r * 3 + 1] * t[1] + R[r * 3 + 2] * t[2])
  const N = normalMatrix(L)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const seen = new Set()
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const nor = prim.getAttribute('NORMAL')
    if (seen.has(pos)) throw new Error('a POSITION accessor is shared between primitives')
    seen.add(pos)
    const p = pos.getArray()
    const out = new Float32Array(p.length)
    for (let i = 0; i < p.length; i += 3) {
      for (let r = 0; r < 3; r++) {
        const v = L[r * 3] * p[i] + L[r * 3 + 1] * p[i + 1] + L[r * 3 + 2] * p[i + 2] + T[r]
        out[i + r] = v
        if (v < min[r]) min[r] = v
        if (v > max[r]) max[r] = v
      }
    }
    pos.setArray(out)
    if (nor) {
      const n = nor.getArray()
      const on = new Float32Array(n.length)
      for (let i = 0; i < n.length; i += 3) {
        const v = [0, 1, 2].map((r) => N[r * 3] * n[i] + N[r * 3 + 1] * n[i + 1] + N[r * 3 + 2] * n[i + 2])
        const len = Math.hypot(...v) || 1
        for (let r = 0; r < 3; r++) on[i + r] = v[r] / len
      }
      nor.setArray(on)
    }
  }
  return { node, min, max }
}

/**
 * A vertex whose normal has no length (a few exported scans carry some) normalises to NaN in the shader, and the
 * museum's post-processing bloom smears one NaN pixel over the whole frame: give each such vertex the
 * area-weighted normal of the triangles round it (straight up if it has none). Every valid normal is kept.
 */
function repairZeroNormals(node) {
  let fixed = 0
  for (const prim of node.getMesh().listPrimitives()) {
    const nor = prim.getAttribute('NORMAL')
    if (!nor) continue
    const n = nor.getArray()
    const bad = new Set()
    for (let v = 0; v < n.length / 3; v++) if (!(Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) > 1e-6)) bad.add(v)
    if (!bad.size) continue
    const p = prim.getAttribute('POSITION').getArray()
    const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: p.length / 3 }, (_, i) => i)
    const acc = new Map([...bad].map((v) => [v, [0, 0, 0]]))
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]
      if (!acc.has(a) && !acc.has(b) && !acc.has(c)) continue
      const e1 = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k])
      const e2 = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k])
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      for (const v of [a, b, c]) {
        const s = acc.get(v)
        if (s) for (let k = 0; k < 3; k++) s[k] += f[k]
      }
    }
    for (const [v, s] of acc) {
      const len = Math.hypot(...s)
      const u = len > 1e-12 ? s.map((x) => x / len) : [0, 1, 0]
      for (let k = 0; k < 3; k++) n[v * 3 + k] = u[k]
      fixed++
    }
    nor.setArray(n)
  }
  return fixed
}

/** Scale to `height` m, centre x/z, base at y = 0 (positions only: a uniform scale keeps the normals). */
function placeOnFloor(node, min, max, height) {
  const s = height / (max[1] - min[1])
  const off = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const p = pos.getArray()
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] = (p[i + k] - off[k]) * s
    pos.setArray(p)
  }
  return { s, off, size: [0, 1, 2].map((k) => (max[k] - min[k]) * s) }
}

/** One scene holding the one mesh node, with no transform of its own; every other node goes. */
function flattenToOneNode(doc, node, slug) {
  const root = doc.getRoot()
  node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).setName(slug)
  for (const n of root.listNodes()) if (n !== node) for (const c of n.listChildren()) if (c === node) n.removeChild(node)
  for (const sc of root.listScenes()) for (const c of sc.listChildren()) sc.removeChild(c)
  for (const n of root.listNodes()) if (n !== node) n.dispose()
  const scenes = root.listScenes()
  for (const sc of scenes.slice(1)) sc.dispose()
  const scene = scenes[0] ?? doc.createScene()
  scene.setName(slug).addChild(node)
  root.setDefaultScene(scene)
  node.getMesh().setName(slug)
}

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0)

/* ------------------------------------------------------------------ main */

if (!srcDir || !fs.existsSync(srcDir)) {
  console.error('usage: node scripts/import-team-models.mjs <glb dir> [--verify] [--sheets <dir>]')
  process.exit(2)
}
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
fs.mkdirSync(OUT, { recursive: true })
const files = fs.readdirSync(srcDir).filter((f) => /\.glb$/i.test(f))
const done = []
let failed = 0
for (const piece of PIECES) {
  const file = files.find((f) => piece.match.test(f))
  if (!file) {
    console.warn(`  ${piece.slug}: no matching GLB in ${srcDir} — skipped`)
    failed++
    continue
  }
  const src = path.join(srcDir, file)
  const doc = await io.read(src)
  doc.setLogger(new Logger(Logger.Verbosity.WARN))
  const before = textureSlots(doc)
  const trisBefore = triangles(doc)
  const { node, min, max } = bakeOrientation(doc, piece.rotate)
  const fit = placeOnFloor(node, min, max, piece.height)
  const normalsFixed = repairZeroNormals(node)
  flattenToOneNode(doc, node, piece.slug)
  // 'medium': quantise and pack only; positions 16-bit ≈ 0.01 mm on a 0.45 m piece, normals 12-bit, UVs 16-bit
  // (1/16 texel at 4096 px); texcoords outside [0, 1] stay float (gltf-transform skips them)
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16 }))
  doc.getRoot().getAsset().generator = 'clay pavilion scripts/import-team-models.mjs (@gltf-transform)'
  const out = path.join(OUT, `${piece.slug}.glb`)
  await io.write(out, doc)

  // read it back the way the museum will (decoder on) and hold it to the promises above
  const back = await io.read(out)
  const tris = triangles(back)
  const after = textureSlots(back)
  const problems = []
  if (tris !== trisBefore) problems.push(`triangles ${trisBefore} → ${tris}`)
  for (const slot of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const [a, b] = [before[slot], after[slot]]
    if (!a || !b) problems.push(`texture ${slot} ${a ? 'lost' : 'added'}`)
    else if (a.hash !== b.hash || a.mime !== b.mime || a.sampler !== b.sampler) problems.push(`texture ${slot} changed`)
  }
  if (back.getRoot().listTextures().length !== Object.keys(before).length) problems.push('texture count changed')
  const bnode = back.getRoot().listNodes().find((n) => n.getMesh())
  const bpos = bnode.getMesh().listPrimitives()[0].getAttribute('POSITION')
  // de-quantised extent: accessor bounds × the node's de-quantising scale
  const nm = bnode.getWorldMatrix()
  const lo = bpos.getMinNormalized([])
  const hi = bpos.getMaxNormalized([])
  const size = [0, 1, 2].map((k) => (hi[k] - lo[k]) * Math.abs(nm[k * 5]))
  const baseY = lo[1] * nm[5] + nm[13]
  if (Math.abs(size[1] - piece.height) > 1e-3) problems.push(`height ${size[1].toFixed(4)} ≠ ${piece.height}`)
  if (Math.abs(baseY) > 1e-3) problems.push(`base at y = ${baseY.toFixed(4)}`)
  if (piece.podium !== false && Math.max(size[0], size[2]) > PODIUM_TOP) problems.push(`footprint ${size[0].toFixed(3)} × ${size[2].toFixed(3)} m exceeds the podium top (${PODIUM_TOP} m)`)
  if (problems.length) {
    failed++
    console.error(`  FAIL ${piece.slug}: ${problems.join('; ')}`)
  }
  const r = { piece, file, src, out, trisBefore, tris, bytesBefore: fs.statSync(src).size, bytes: fs.statSync(out).size, size, fit, textures: after, normalsFixed }
  done.push(r)
  const tex = Object.entries(after)
    .map(([k, v]) => `${k} ${v.size}`)
    .join(', ')
  console.log(
    `  ${piece.slug.padEnd(22)} ${String(r.tris.toLocaleString('en')).padStart(6)} tris (unchanged)  ${(r.bytesBefore / 1048576).toFixed(2).padStart(5)} MB → ${(r.bytes / 1048576).toFixed(2).padStart(5)} MB` +
      `   ${size.map((v) => v.toFixed(3)).join(' × ')} m (w × h × d)   rotate [${piece.rotate.join(', ')}]   textures byte-identical: ${tex}` +
      (normalsFixed ? `   (${normalsFixed} zero-length normal(s) of the source given their faces' normal)` : ''),
  )
}
const sum = (k) => done.reduce((a, r) => a + r[k], 0)
console.log(`total: ${sum('tris').toLocaleString('en')} triangles (unchanged), ${(sum('bytesBefore') / 1048576).toFixed(1)} MB → ${(sum('bytes') / 1048576).toFixed(1)} MB`)
if (failed) {
  console.error(`${failed} piece(s) failed`)
  process.exit(1)
}

if (verify) process.exit((await verifyRenders(done)) ? 0 : 1)

/* ------------------------------------------------------------------ --verify */

async function verifyRenders(list) {
  const { default: puppeteer } = await import('puppeteer-core')
  const { default: pixelmatch } = await import('pixelmatch')
  const { PNG } = await import('pngjs')
  const SIZE = 512
  const PAGE = `<!doctype html><html><body style="margin:0;background:#808080">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
// GLTFModel.tsx: de-quantise, then bake the node transforms
function dequantize(g) {
  for (const [name, a] of Object.entries(g.attributes)) {
    if (a.isBufferAttribute && a.array instanceof Float32Array) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
  }
  return g
}
function bake(scene) {
  scene.updateMatrixWorld(true)
  const root = new THREE.Group()
  scene.traverse((o) => { if (o.isMesh) { const g = dequantize(o.geometry.clone()); g.applyMatrix4(o.matrixWorld); root.add(new THREE.Mesh(g, o.material)) } })
  return root
}
// the importer's one intended change to shading: a zero-length normal takes its faces' normal (repairZeroNormals)
function repairZeroNormals(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return
    const g = o.geometry, n = g.getAttribute('normal'), p = g.getAttribute('position')
    if (!n) return
    const bad = new Map()
    for (let v = 0; v < n.count; v++) if (!(Math.hypot(n.getX(v), n.getY(v), n.getZ(v)) > 1e-6)) bad.set(v, new THREE.Vector3())
    if (!bad.size) return
    const idx = g.index, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3()
    const tris = idx ? idx.count : p.count
    for (let t = 0; t < tris; t += 3) {
      const [a, b, c] = idx ? [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)] : [t, t + 1, t + 2]
      if (!bad.has(a) && !bad.has(b) && !bad.has(c)) continue
      A.fromBufferAttribute(p, a); B.fromBufferAttribute(p, b).sub(A); C.fromBufferAttribute(p, c).sub(A)
      const f = B.clone().cross(C)
      for (const v of [a, b, c]) bad.get(v)?.add(f)
    }
    for (const [v, s] of bad) { if (s.lengthSq() > 0) s.normalize(); else s.set(0, 1, 0); n.setXYZ(v, s.x, s.y, s.z) }
    n.needsUpdate = true
  })
}
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
renderer.setSize(${SIZE}, ${SIZE}, false)
renderer.setPixelRatio(1)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping
document.body.appendChild(renderer.domElement)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
window.__render = async (srcUrl, outUrl, fit) => {
  const [a, b] = await Promise.all([loader.loadAsync(srcUrl), loader.loadAsync(outUrl)])
  // the source as the importer placed it: rotate, then scale and offset (T · S · R)
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...fit.rotate.map((d) => d * Math.PI / 180), 'XYZ'))
  const S = new THREE.Matrix4().makeScale(fit.s, fit.s, fit.s)
  const T = new THREE.Matrix4().makeTranslation(-fit.off[0] * fit.s, -fit.off[1] * fit.s, -fit.off[2] * fit.s)
  const before = new THREE.Group()
  before.matrixAutoUpdate = false
  before.matrix.copy(T).multiply(S).multiply(R)
  repairZeroNormals(a.scene)
  before.add(a.scene)
  const after = bake(b.scene)
  const box = new THREE.Box3().setFromObject(after), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2
  // front, right, back, three-quarters from above, and a 3× close-up of the front
  const views = [[0, 0.1, 1, 1], [1, 0.1, 0, 1], [0, 0.1, -1, 1], [0.7, 0.8, 0.7, 1], [0.15, 0.1, 1, 3]]
  const shots = []
  for (const [vx, vy, vz, zoom] of views) {
    // the source a second time with other near / far planes: only depth precision changes (x and y map the same),
    // so the pixels that differ between the two are where the source's own surfaces fight for depth
    for (const [object, near, far] of [[before, r / 100, r * 100], [after, r / 100, r * 100], [before, r / 30, r * 8]]) {
      const cam = new THREE.PerspectiveCamera(30 / zoom, 1, near, far)
      cam.position.copy(c).add(new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(15))))
      cam.lookAt(c)
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x808080)
      scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3530, 1.6))
      const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(2, 4, 3); scene.add(sun)
      const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8); rim.position.set(-3, 1, -2); scene.add(rim)
      scene.add(object)
      renderer.render(scene, cam)
      shots.push(renderer.domElement.toDataURL('image/png'))
      scene.remove(object)
    }
  }
  return shots
}
window.__ready = true
</script></body></html>`
  const sources = new Map(list.map((r) => [`/src/${r.piece.slug}.glb`, r.src]))
  const MIME = { '.js': 'text/javascript', '.glb': 'model/gltf-binary' }
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE)
    let file
    if (url.startsWith('/three/')) file = path.join(ROOT, 'node_modules/three', url.slice(7))
    else if (url.startsWith('/models/')) file = path.join(ROOT, 'public/models', url.slice(8))
    else file = sources.get(url)
    if (!file || !fs.existsSync(file)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find((p) => p && fs.existsSync(p))
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', protocolTimeout: 600000, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  fs.mkdirSync(SHEETS, { recursive: true })
  const BG = [128, 128, 128]
  let ok = true
  try {
    const page = await browser.newPage()
    page.on('pageerror', (e) => console.error('page error:', e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.waitForFunction('window.__ready === true')
    console.log(`verify (textured; front / right / back / ¾ above / 3× close-up; fail above ${MAX_DIFF_PCT} % visibly different pixels or under ${MIN_PSNR} dB):`)
    for (const r of list) {
      const fit = { rotate: r.piece.rotate, s: r.fit.s, off: r.fit.off }
      const shots = await page.evaluate((a, b, f) => window.__render(a, b, f), `/src/${r.piece.slug}.glb`, `/models/team/${r.piece.slug}.glb`, fit)
      const imgs = shots.map((d) => PNG.sync.read(Buffer.from(d.split(',')[1], 'base64')))
      const rows = imgs.length / 3
      const sheet = new PNG({ width: SIZE * 3, height: SIZE * rows })
      const stats = []
      for (let v = 0; v < rows; v++) {
        const [a, b, a2] = [imgs[v * 3], imgs[v * 3 + 1], imgs[v * 3 + 2]]
        const diff = new PNG({ width: SIZE, height: SIZE })
        pixelmatch(a.data, b.data, diff.data, SIZE, SIZE, { threshold: 0.1, alpha: 0.25, diffColor: [255, 0, 0], aaColor: [255, 255, 0] })
        // over the piece's pixels (either image off the background), leaving out the source's own depth fights
        let px = 0
        let fight = 0
        let n = 0
        let se = 0
        let maxd = 0
        for (let i = 0; i < SIZE * SIZE; i++) {
          const o = i * 4
          const onA = a.data[o] !== BG[0] || a.data[o + 1] !== BG[1] || a.data[o + 2] !== BG[2]
          const onB = b.data[o] !== BG[0] || b.data[o + 1] !== BG[1] || b.data[o + 2] !== BG[2]
          if (!onA && !onB) continue
          if (a.data[o] !== a2.data[o] || a.data[o + 1] !== a2.data[o + 1] || a.data[o + 2] !== a2.data[o + 2]) {
            fight++
            diff.data.set([60, 110, 235, 255], o) // blue: the source fights itself here
            continue
          }
          px++
          if (diff.data[o] === 255 && diff.data[o + 1] === 0 && diff.data[o + 2] === 0) n++
          for (let k = 0; k < 3; k++) {
            const d = a.data[o + k] - b.data[o + k]
            se += d * d
            maxd = Math.max(maxd, Math.abs(d))
          }
        }
        const mse = se / Math.max(1, px * 3)
        const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse)
        stats.push({ pct: (100 * n) / Math.max(1, px), psnr, maxd, fight: (100 * fight) / Math.max(1, px + fight), px })
        ;[a, b, diff].forEach((img, k) => PNG.bitblt(img, sheet, 0, 0, SIZE, SIZE, k * SIZE, v * SIZE))
      }
      fs.writeFileSync(path.join(SHEETS, `${r.piece.slug}.png`), PNG.sync.write(sheet))
      const worstPct = Math.max(...stats.map((s) => s.pct))
      // PSNR only where the piece fills a fair share of the frame: an edge-on plaque is a few hundred edge pixels,
      // where a couple of flipped pixels swing the figure without anything to see (pixelmatch still covers them)
      const worstPsnr = Math.min(...stats.filter((s) => s.px >= MIN_PSNR_PIXELS).map((s) => s.psnr))
      const pass = worstPct <= MAX_DIFF_PCT && worstPsnr >= MIN_PSNR
      ok &&= pass
      console.log(
        `  ${pass ? 'ok  ' : 'FAIL'} ${r.piece.slug.padEnd(22)} differing ${stats.map((s) => s.pct.toFixed(3)).join(' / ')} %   PSNR ${stats.map((s) => (s.psnr === Infinity ? '∞' : s.psnr.toFixed(1))).join(' / ')} dB` +
          `   (source's own depth fights left out: ${stats.map((s) => s.fight.toFixed(2)).join(' / ')} %)`,
      )
    }
  } finally {
    await browser.close()
    server.close()
  }
  console.log(ok ? `no visible differences (sheets: ${SHEETS})` : `visible differences (see ${SHEETS})`)
  return ok
}
