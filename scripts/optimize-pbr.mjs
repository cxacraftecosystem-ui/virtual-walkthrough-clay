/**
 * PBR material library (GRAND §6.1): turns the staged ambientCG sets (CC0) into the web maps the
 * museum loads (src/museum/materials/pbrSets.ts):
 *
 *   public/textures/pbr/<Set>/color.<size>.webp    sRGB albedo
 *   public/textures/pbr/<Set>/normal.<size>.webp   OpenGL tangent-space normal
 *   public/textures/pbr/<Set>/orm.<size>.webp      R ambient occlusion, G roughness, B 0
 *
 * at 1024 and 512. The sets ship no AO for most materials, so AO is the set's own map when it has
 * one, otherwise a soft cavity term from its displacement (deep = darker, never below 0.55).
 * Tinting toward the PDF swatches happens in the material (colour multiply), not here, so one set
 * serves every tint. The sets in NEUTRAL are stored as levelled greyscale (mean 0.82, their own
 * light and dark kept) so a multiply reaches any swatch: the clays, the plasters, the slate-dark
 * roofing tile and the blue glaze would otherwise drag every tint toward their own hue.
 *
 *   node scripts/optimize-pbr.mjs [--src <dir with Set/Set_1K-JPG_*.jpg>]
 *
 * Writes public/textures/pbr/CREDITS.json (all ambientCG, CC0) and prints the byte totals per
 * size. Idempotent: re-running overwrites.
 */
import { mkdirSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def
}
const SRC = resolve(opt('src', process.env.PBR_SRC || join(ROOT, '..', 'pbr-src')))
const OUT = join(ROOT, 'public', 'textures', 'pbr')

/** The library (GRAND §6.1). */
const SETS = ['Clay005', 'Clay007', 'Clay009', 'Ground054', 'Plaster001', 'PaintedPlaster017', 'GlazedTerracotta001', 'GlazedTerracotta002', 'RoofingTiles013A', 'Bricks051', 'Terrazzo004', 'Wood092']
const SIZES = [1024, 512]
const NEUTRAL = new Set(['Clay005', 'Clay007', 'Clay009', 'Plaster001', 'PaintedPlaster017', 'RoofingTiles013A', 'GlazedTerracotta002'])

/** Albedo at `size`: as authored, or levelled greyscale for the NEUTRAL sets. */
async function albedo(set, path, size) {
  const base = sharp(path).resize(size, size, { fit: 'fill' })
  if (!NEUTRAL.has(set)) return base
  const grey = await base.greyscale().raw().toBuffer({ resolveWithObject: true })
  let sum = 0
  for (let i = 0; i < grey.data.length; i++) sum += grey.data[i]
  const mean = sum / grey.data.length
  const a = Math.min(2.2, Math.max(1, 180 / mean))
  const b = 209 - a * mean
  return sharp(grey.data, { raw: { width: size, height: size, channels: 1 } }).linear(a, b).toColourspace('srgb')
}
const Q = { color: 86, normal: 92, orm: 92 }

function find(dir, suffix) {
  const f = readdirSync(dir).find((n) => n.endsWith(suffix))
  return f ? join(dir, f) : null
}

async function raw(path, size) {
  const { data, info } = await sharp(path).resize(size, size, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  return { data, channels: info.channels }
}

async function ormMap(dir, size) {
  const rough = find(dir, '_Roughness.jpg')
  const ao = find(dir, '_AmbientOcclusion.jpg')
  const disp = find(dir, '_Displacement.jpg')
  const n = size * size
  const out = Buffer.alloc(n * 3)
  const R = rough ? await raw(rough, size) : null
  const A = ao ? await raw(ao, size) : null
  const D = !A && disp ? await raw(disp, size) : null
  // the displacement's own range, so the cavity term reads the same on every set
  let lo = 255
  let hi = 0
  if (D) for (let i = 0; i < n; i++) {
    const v = D.data[i * D.channels]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  for (let i = 0; i < n; i++) {
    let occ = 255
    if (A) occ = A.data[i * A.channels]
    else if (D) {
      const t = (D.data[i * D.channels] - lo) / Math.max(1, hi - lo)
      occ = Math.round(255 * (0.55 + 0.45 * Math.pow(t, 0.6)))
    }
    out[i * 3] = occ
    out[i * 3 + 1] = R ? R.data[i * R.channels] : 200
    out[i * 3 + 2] = 0
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } })
}

const totals = Object.fromEntries(SIZES.map((s) => [s, 0]))
const credits = []
for (const set of SETS) {
  const dir = join(SRC, set)
  if (!existsSync(dir)) {
    console.warn(`skip ${set}: no ${dir}`)
    continue
  }
  const color = find(dir, '_Color.jpg')
  const normal = find(dir, '_NormalGL.jpg')
  if (!color || !normal) throw new Error(`${set}: colour or normal map missing in ${dir}`)
  mkdirSync(join(OUT, set), { recursive: true })
  for (const size of SIZES) {
    const files = {
      color: (await albedo(set, color, size)).webp({ quality: Q.color, effort: 6 }),
      normal: sharp(normal).resize(size, size, { fit: 'fill' }).webp({ quality: Q.normal, effort: 6 }),
      orm: (await ormMap(dir, size)).webp({ quality: Q.orm, effort: 6 }),
    }
    for (const [k, img] of Object.entries(files)) {
      const p = join(OUT, set, `${k}.${size}.webp`)
      await img.toFile(p)
      totals[size] += statSync(p).size
    }
  }
  credits.push({ set, title: set, author: 'ambientCG (Lennart Demes)', source: `https://ambientcg.com/view?id=${set}`, license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' })
  console.log(`${set} ✓`)
}
writeFileSync(join(OUT, 'CREDITS.json'), JSON.stringify(credits, null, 2) + '\n')
for (const s of SIZES) console.log(`${s}: ${(totals[s] / 1048576).toFixed(2)} MB`)
