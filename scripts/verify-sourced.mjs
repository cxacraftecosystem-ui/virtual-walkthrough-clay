/**
 * Verify the sourced models (GRAND §5.1).   node scripts/verify-sourced.mjs
 *
 * Re-reads every file the registry (src/museum/config/sourcedRegistry.generated.ts) names and
 * checks, without the originals:
 *   - both LODs exist, decode (meshopt) and hold triangles;
 *   - LOD0 is within its role's cap (scripts/optimize-sourced.mjs CAPS), LOD1 is lighter than LOD0;
 *   - the bounding box in the registry matches the file's (±2 cm);
 *   - the file sizes hold (4 MB, trees 5 MB; 45 MB in all);
 *   - every model has a complete credit with a CC0, CC BY 4.0 or public-domain licence, CC BY
 *     with an attribution line;
 *   - CREDITS.json lists every slug, and no excluded model (§5.3) is in the registry;
 *   - every slug in scripts/sourced-models.json is in the registry, and no file under
 *     public/models/sourced/ is orphaned.
 * Exits 1 with a list of failures.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public/models/sourced')
const CAPS = { hero: 60000, display: 25000, dressing: 8000, tree: 30000, rock: 20000 }
const EXCLUDED = ['wc-rising-horse-sculpture', 'si-greek-slave-plaster', 'si-old-arrow-maker', 'ph-spinning-wheel-01']
const MB = 1e6

const { SOURCED_REGISTRY } = await import(pathToFileURL(path.join(ROOT, 'src/museum/config/sourcedRegistry.generated.ts')).href)
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/sourced-models.json'), 'utf8'))
const credits = fs.readFileSync(path.join(OUT, 'CREDITS.json'), 'utf8')

await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

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

const fail = []
let total = 0
const seen = new Set()
for (const [slug, e] of Object.entries(SOURCED_REGISTRY)) {
  const files = [e.url, e.lod1].map((u) => path.join(ROOT, 'public', ...u.replace(/^\//, '').split('/')))
  const tris = []
  for (const f of files) {
    seen.add(path.resolve(f))
    if (!fs.existsSync(f)) {
      fail.push(`${slug}: ${path.relative(ROOT, f)} is missing`)
      continue
    }
    const size = fs.statSync(f).size
    total += size
    const cap = e.role === 'tree' ? 5 * MB : 4 * MB
    if (size > cap) fail.push(`${slug}: ${path.basename(f)} is ${(size / MB).toFixed(2)} MB (cap ${cap / MB} MB)`)
    try {
      const doc = await io.read(f)
      const t = triangles(doc)
      if (!(t > 0)) fail.push(`${slug}: ${path.basename(f)} has no triangles`)
      tris.push(t)
      if (f === files[0]) {
        const b = getBounds(doc.getRoot().listScenes()[0])
        const got = [...b.min, ...b.max]
        if (got.some((v, i) => Math.abs(v - e.bbox[i]) > 0.02)) fail.push(`${slug}: bbox ${got.map((v) => v.toFixed(3))} ≠ registry ${e.bbox}`)
      }
    } catch (err) {
      fail.push(`${slug}: ${path.basename(f)} does not decode (${err.message})`)
    }
  }
  if (tris[0] > CAPS[e.role] * 1.05) fail.push(`${slug}: LOD0 ${tris[0]} triangles over the ${e.role} cap ${CAPS[e.role]}`)
  if (tris.length === 2 && tris[1] > tris[0]) fail.push(`${slug}: LOD1 (${tris[1]}) is heavier than LOD0 (${tris[0]})`)
  if (tris[0] !== e.tris) fail.push(`${slug}: registry says ${e.tris} triangles, the file has ${tris[0]}`)
  const c = e.credit
  if (!c?.title || !c.author || !c.source || !c.licenseUrl) fail.push(`${slug}: incomplete credit`)
  if (!['CC0', 'CC-BY-4.0', 'PD'].includes(c?.license)) fail.push(`${slug}: licence ${c?.license}`)
  if (c?.license === 'CC-BY-4.0' && !c.attribution) fail.push(`${slug}: CC BY without an attribution line`)
  if (!credits.includes(`"${slug}"`)) fail.push(`${slug}: not in CREDITS.json`)
}
for (const slug of EXCLUDED) if (SOURCED_REGISTRY[slug]) fail.push(`${slug}: excluded by GRAND §5.3 but in the registry`)
for (const m of spec.models) if (!SOURCED_REGISTRY[m.slug]) fail.push(`${m.slug}: in sourced-models.json but not in the registry (run optimize-sourced)`)
for (const dir of fs.readdirSync(OUT, { withFileTypes: true }))
  if (dir.isDirectory())
    for (const f of fs.readdirSync(path.join(OUT, dir.name)))
      if (f.endsWith('.glb') && !seen.has(path.resolve(OUT, dir.name, f))) fail.push(`orphaned file ${dir.name}/${f}`)
if (total > 45 * MB) fail.push(`total ${(total / MB).toFixed(1)} MB over 45 MB`)

const n = Object.keys(SOURCED_REGISTRY).length
console.log(`${n} sourced models, ${(total / MB).toFixed(1)} MB`)
if (fail.length) {
  console.error('FAILED:\n  ' + fail.join('\n  '))
  process.exit(1)
}
console.log('ok')
