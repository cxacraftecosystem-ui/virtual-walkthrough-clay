/**
 * Sourced-model pipeline (GRAND §5.1).   node scripts/optimize-sourced.mjs [--src <dir>] [--only slug,slug] [--force]
 *
 * Reads scripts/sourced-models.json (one entry per published model) and the downloaded originals
 * with their MANIFEST.json (licence, author, source), and writes for every entry
 *
 *   public/models/sourced/<slug>/<slug>.glb        LOD0 (role cap, textures ≤ 1024 px WebP)
 *   public/models/sourced/<slug>/<slug>.lod1.glb   LOD1 (25 % of LOD0's triangles, textures ≤ 256 px)
 *
 * then public/models/sourced/CREDITS.json and src/museum/config/sourcedRegistry.generated.ts.
 *
 * Per model: read (Draco registered) → keep only `keepRoots` (one variant of a Poly Haven multi-
 * variant file) → `orient` (rotations about x / y / z, degrees, applied in order) → bake a uniform
 * scale so the height is `targetHeight` (fixes mm / cm scans) → base at y 0, centred → dequantise,
 * weld, dedup, prune → simplify to the role cap → textures resized and re-encoded to WebP with
 * sharp → meshopt (quantisation + EXT_meshopt_compression).
 *
 * Fails when the total is above 45 MB, or any single file is above 4 MB (trees 5 MB).
 *
 * Sources: `--src`, else SOURCED_SRC, else the build's staging folder. The originals are not
 * kept in the repository; the outputs and the registry are.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Logger, NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { center, dedup, dequantize, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions'
import draco3d from 'draco3d'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public/models/sourced')
const REGISTRY = path.join(ROOT, 'src/museum/config/sourcedRegistry.generated.ts')
const SPEC = path.join(ROOT, 'scripts/sourced-models.json')
const args = process.argv.slice(2)
const arg = (k) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : undefined
}
const SRC = path.resolve(
  arg('--src') ?? process.env.SOURCED_SRC ?? 'C:/Users/anujk/AppData/Local/Temp/claude/C--dev-IIT-virtual-walkthrough/e0114da7-a983-4e19-9a07-2cecf243c37c/scratchpad/grand/models',
)
const ONLY = arg('--only')?.split(',')
const FORCE = args.includes('--force')

/** LOD0 triangle caps per role (GRAND §5.1); LOD1 is a quarter of LOD0. */
export const CAPS = { hero: 60000, display: 25000, dressing: 8000, tree: 30000, rock: 20000 }
const TEX = { lod0: 1024, lod1: 256 }
const MAX_TOTAL = 45e6
const MAX_FILE = (role) => (role === 'tree' ? 5e6 : 4e6)

const LICENSE = { 'CC0-1.0': 'CC0', 'CC-BY-4.0': 'CC-BY-4.0' }
const toLicense = (l) => LICENSE[l] ?? (l.startsWith('Public Domain') ? 'PD' : null)
const LICENSE_URL = { CC0: 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/', PD: 'https://commons.wikimedia.org/wiki/Commons:Public_domain' }

async function io() {
  await MeshoptDecoder.ready
  await MeshoptEncoder.ready
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })
}

function triangles(doc) {
  let n = 0
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      if (p.getMode() !== 4) continue
      const idx = p.getIndices()
      n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3
    }
  return Math.round(n)
}

/** Euler steps [[axis, deg], …] → one quaternion (applied in order). */
function orientQuat(steps) {
  let q = [0, 0, 0, 1]
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
  for (const [axis, deg] of steps) {
    const h = (deg * Math.PI) / 360
    const s = Math.sin(h)
    const r = axis === 'x' ? [s, 0, 0, Math.cos(h)] : axis === 'y' ? [0, s, 0, Math.cos(h)] : [0, 0, s, Math.cos(h)]
    q = mul(r, q)
  }
  return q
}

async function build(IO, e, lod) {
  const file = path.join(SRC, e.src)
  const doc = await IO.read(file)
  doc.setLogger(new Logger(Logger.Verbosity.WARN))
  // the sources' Draco is decoded on read; the output is meshopt, so the extension goes
  for (const x of doc.getRoot().listExtensionsUsed()) if (x.extensionName === 'KHR_draco_mesh_compression') x.dispose()
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  // 1. keep only the chosen roots (a variant pick)
  if (e.keepRoots?.length) {
    for (const n of scene.listChildren()) if (!e.keepRoots.includes(n.getName())) scene.removeChild(n)
    const kept = scene.listChildren().map((n) => n.getName())
    for (const k of e.keepRoots) if (!kept.includes(k)) throw new Error(`${e.slug}: root "${k}" not found (has ${kept.join(', ')})`)
  }
  // 2. orientation and 3. a uniform scale to the target height, on one wrapper node
  const wrap = doc.createNode('sourced_fit')
  for (const c of scene.listChildren()) {
    scene.removeChild(c)
    wrap.addChild(c)
  }
  scene.addChild(wrap)
  if (e.orient?.length) wrap.setRotation(orientQuat(e.orient))
  const b0 = getBounds(scene)
  const h0 = b0.max[1] - b0.min[1]
  const w0 = Math.max(b0.max[0] - b0.min[0], b0.max[2] - b0.min[2])
  if (!(h0 > 0)) throw new Error(`${e.slug}: empty bounds`)
  // targetHeight fits the height; targetWidth the larger plan extent (a relief); neither keeps the authored scale
  const s = typeof e.targetHeight === 'number' ? e.targetHeight / h0 : typeof e.targetWidth === 'number' ? e.targetWidth / w0 : 1
  wrap.setScale([s, s, s])
  // 4. base at y 0, centred on x / z
  await doc.transform(center({ pivot: 'below' }))
  // 5. clean-up, 6. simplify to the role cap
  await doc.transform(dequantize(), weld(), dedup(), prune())
  const before = triangles(doc)
  const cap = Math.round(CAPS[e.role] * (lod === 1 ? 0.25 : 1))
  if (before > cap) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: cap / before, error: lod === 1 ? 0.05 : 0.02 }), prune())
  // a scan the simplifier could not bring under the cap (locked borders) gets a looser pass
  if (triangles(doc) > cap * 1.05) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: cap / triangles(doc), error: 0.1, lockBorder: false }), prune())
  // 7. textures: colour at q 86, data maps (normal, ORM) at q 92
  const size = lod === 1 ? TEX.lod1 : TEX.lod0
  if (root.listTextures().length) {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 86, slots: /^(baseColor|emissive|diffuse)/ }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 92 }),
    )
  }
  // 8. meshopt (quantisation + compression), one self-contained GLB
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const [buffer, ...extra] = root.listBuffers()
  if (extra.length) {
    for (const a of root.listAccessors()) a.setBuffer(buffer)
    for (const x of extra) x.dispose()
  }
  const b = getBounds(scene)
  return { doc, before, tris: triangles(doc), bbox: [...b.min, ...b.max].map((v) => +v.toFixed(4)) }
}

function registryTs(entries, pbr) {
  const lines = []
  lines.push(`/**
 * GENERATED by scripts/optimize-sourced.mjs (GRAND §5.1) — do not edit by hand.
 *
 * Every optimised sourced model under public/models/sourced/: its LOD0 / LOD1 urls, bounding
 * box (metres, after scaling), triangle count, default finish and credit. Objects of kind
 * 'sourced-model' name a slug here; the runtime resolves the model, the credit and the height.
 * PBR_CREDITS lists the material library's sources (the /credits page).
 */

export type SourcedLicense = 'CC0' | 'CC-BY-4.0' | 'PD'

export type SourcedFinish = 'asis' | 'terracotta' | 'red-slip' | 'black-burnished' | 'buff' | 'grey-clay' | 'stone' | 'plaster'

export type SourcedRole = 'hero' | 'display' | 'dressing' | 'tree' | 'rock'

export interface SourcedCredit {
  title: string
  author: string
  source: string
  license: SourcedLicense
  licenseUrl: string
  attribution: string
}

export interface SourcedEntry {
  url: string
  lod1: string
  /** Bounding box (m): [minX, minY, minZ, maxX, maxY, maxZ]. */
  bbox: [number, number, number, number, number, number]
  tris: number
  finish: SourcedFinish
  role: SourcedRole
  credit: SourcedCredit
}
`)
  lines.push(`export const SOURCED_REGISTRY: Record<string, SourcedEntry> = ${JSON.stringify(entries, null, 2)}\n`)
  lines.push(`/** The PBR material library (ambientCG, CC0): the /credits page lists it. */`)
  lines.push(`export const PBR_CREDITS: SourcedCredit[] = ${JSON.stringify(pbr, null, 2)}\n`)
  return lines.join('\n')
}

async function main() {
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'MANIFEST.json'), 'utf8'))
  const bySlug = new Map(manifest.map((m) => [m.slug, m]))
  const IO = await io()
  fs.mkdirSync(OUT, { recursive: true })
  const registry = {}
  const credits = []
  let total = 0
  const failures = []
  for (const e of spec.models) {
    const m = bySlug.get(e.from ?? e.slug)
    if (!m) throw new Error(`${e.slug}: no MANIFEST entry ${e.from ?? e.slug}`)
    const license = toLicense(m.licence)
    if (!license) throw new Error(`${e.slug}: licence "${m.licence}" is not CC0, CC BY 4.0 or public domain`)
    const dir = path.join(OUT, e.slug)
    const f0 = path.join(dir, `${e.slug}.glb`)
    const f1 = path.join(dir, `${e.slug}.lod1.glb`)
    const src = path.join(SRC, e.src)
    const fresh = !FORCE && fs.existsSync(f0) && fs.existsSync(f1) && fs.existsSync(f0 + '.json') && fs.statSync(f0).mtimeMs >= Math.max(fs.statSync(src).mtimeMs, fs.statSync(SPEC).mtimeMs)
    let info
    if ((ONLY && !ONLY.includes(e.slug)) || fresh) {
      if (!fs.existsSync(f0 + '.json')) throw new Error(`${e.slug}: not built yet (run without --only)`)
      info = JSON.parse(fs.readFileSync(f0 + '.json', 'utf8'))
    } else {
      fs.mkdirSync(dir, { recursive: true })
      const l0 = await build(IO, e, 0)
      await IO.write(f0, l0.doc)
      const l1 = await build(IO, e, 1)
      await IO.write(f1, l1.doc)
      info = { bbox: l0.bbox, tris: l0.tris, tris1: l1.tris, before: l0.before }
      fs.writeFileSync(f0 + '.json', JSON.stringify(info))
    }
    const s0 = fs.statSync(f0).size
    const s1 = fs.statSync(f1).size
    total += s0 + s1
    if (s0 > MAX_FILE(e.role) || s1 > MAX_FILE(e.role)) failures.push(`${e.slug}: ${(s0 / 1e6).toFixed(2)} MB over the ${MAX_FILE(e.role) / 1e6} MB cap`)
    const credit = {
      title: m.title,
      author: m.author,
      source: m.url,
      license,
      licenseUrl: m.licenceUrl && /^https?:/.test(m.licenceUrl) ? m.licenceUrl : LICENSE_URL[license],
      attribution: m.attributionText,
    }
    registry[e.slug] = { url: `/models/sourced/${e.slug}/${e.slug}.glb`, lod1: `/models/sourced/${e.slug}/${e.slug}.lod1.glb`, bbox: info.bbox, tris: info.tris, finish: e.finish ?? 'asis', role: e.role, credit }
    credits.push({ slug: e.slug, ...credit, files: [registry[e.slug].url, registry[e.slug].lod1], bytes: s0 + s1 })
    console.log(`${e.slug.padEnd(40)} ${String(info.before ?? '').padStart(7)} → ${String(info.tris).padStart(6)} / ${String(info.tris1 ?? '').padStart(5)} tris  ${(s0 / 1e6).toFixed(2)} + ${(s1 / 1e6).toFixed(2)} MB  h ${(info.bbox[4] - info.bbox[1]).toFixed(3)}`)
  }
  const pbr = manifest
    .filter((m) => m.category === 'material')
    .map((m) => ({ title: m.title, author: m.author, source: m.url, license: toLicense(m.licence), licenseUrl: m.licenceUrl ?? LICENSE_URL.CC0, attribution: m.attributionText }))
  fs.writeFileSync(path.join(OUT, 'CREDITS.json'), JSON.stringify({ generated: 'scripts/optimize-sourced.mjs', models: credits, materials: pbr }, null, 2))
  fs.writeFileSync(REGISTRY, registryTs(registry, pbr))
  console.log(`\n${spec.models.length} models, ${(total / 1e6).toFixed(1)} MB (cap ${MAX_TOTAL / 1e6} MB)`)
  if (total > MAX_TOTAL) failures.push(`total ${(total / 1e6).toFixed(1)} MB over ${MAX_TOTAL / 1e6} MB`)
  if (failures.length) {
    console.error('\nFAILED:\n  ' + failures.join('\n  '))
    process.exit(1)
  }
}

await main()
