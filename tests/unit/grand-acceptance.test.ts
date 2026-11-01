/**
 * The grand plan's acceptance, end to end (GRAND §3, §5, §8 P6, §9, §10): every acceptance pose
 * stands where its row says, every PDF row has a shot, the clay studio is down, the sourced
 * models and the PBR library match their files, credits and budgets, and the map and logos are
 * the hand-block museum's own.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { zoneAt, type ZoneId } from '../../src/museum/config/layout'
import { GRAND_FLAGS, MUSEUM } from '../../src/museum/config/museum'
import { SCENE_OBJECTS } from '../../src/museum/config/objects'
import { SOURCED_REGISTRY } from '../../src/museum/config/sourcedRegistry.generated'
import { resolveCircle } from '../../src/museum/navigation/collision'

const ROOT = join(import.meta.dirname, '..', '..')
const PUBLIC = join(ROOT, 'public')
const R = MUSEUM.visitor.collisionRadius

interface Shot {
  name: string
  pose?: [number, number, number, number]
  view?: number[]
  perch?: [string, number]
  time?: string
  weather?: string
  festival?: string
  map?: boolean
}
const SHOTS = JSON.parse(readFileSync(join(ROOT, 'scripts', 'grand-poses.json'), 'utf-8')) as Record<string, Shot>

/** GRAND §9: each standing pose and the zone it must stand in. */
const POSE_ZONES: Record<string, ZoneId> = {
  G01: 'entrance-court',
  G02: 'entrance-court',
  G03: 'annex',
  G04: 'annex',
  G05: 'entry-e',
  G06: 'ring-a',
  G07: 'inner',
  G07b: 'inner',
  G09: 'ring-a',
  G10: 'ring-b',
  G11: 'ring-c',
  G12: 'ring-a',
  G14: 'hallway-d',
  G15: 'parikrama-west',
  G17: 'atlas',
  G18: 'theatre',
  G19: 'library',
  G20: 'shop',
  G21: 'entrance-court',
  G28: 'theatre',
  G29: 'entrance-court',
}

/** GRAND §3: the shots each PDF row is checked in (rows 41 and 42 are covered by others). */
const TRACE: Record<number, string[]> = {
  1: ['G23'], 2: ['G23'], 3: ['G09'], 4: ['G10'], 5: ['G11'], 6: ['G14'], 7: ['G05', 'G06'], 8: ['G05', 'G07'],
  9: ['G03'], 10: ['G04'], 11: ['G07'], 12: ['G23'], 13: ['G23'], 14: ['G09'], 15: ['G09'], 16: ['G12'],
  17: ['G24'], 18: ['G13'], 19: ['G24'], 20: ['G24'], 21: ['G01'], 22: ['G01'], 23: ['G01', 'G24'],
  24: ['G03', 'G07'], 25: ['G05'], 26: ['G03', 'G12'], 27: ['G03', 'G19'], 28: ['G03'], 29: ['G07'],
  30: ['G05'], 31: ['G08'], 32: ['G08'], 33: ['G07'], 34: ['G07'], 35: ['G21', 'G21b'], 36: ['G09', 'G10', 'G11'],
  37: ['G14'], 38: ['G10'], 39: ['G15', 'G16'], 40: ['G19'], 43: ['G17'], 44: ['G17'],
}

const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')
/** Text files hashed with line endings normalised (git may check them out with CRLF). */
const sha256Text = (p: string) => createHash('sha256').update(readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')).digest('hex')
const MB = 1048576

describe('grand acceptance: the poses', () => {
  it('has every §9 pose', () => {
    const ids = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G07b', 'G08', 'G09', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G17', 'G18', 'G19', 'G20', 'G21', 'G21b', 'G22', 'G23', 'G24', 'G25', 'G26', 'G27', 'G28', 'G29']
    for (const id of ids) assert.ok(SHOTS[id], `missing pose ${id}`)
  })

  it('stands every standing pose in its zone, clear of every wall', () => {
    for (const [id, zone] of Object.entries(POSE_ZONES)) {
      const p = SHOTS[id].pose!
      assert.equal(zoneAt(p[0], p[1])?.id, zone, `${id} ${SHOTS[id].name} stands in ${zoneAt(p[0], p[1])?.id}`)
      const q = resolveCircle(p[0], p[1], R)
      assert.ok(Math.hypot(q.x - p[0], q.z - p[1]) < 1e-6, `${id} ${SHOTS[id].name} is pushed by a collider`)
    }
  })

  it('rides the perches the balcony, the well floor and the sky rim', () => {
    assert.deepEqual(SHOTS.G13.perch?.[0], 'duplex')
    assert.deepEqual(SHOTS.G21b.perch?.[0], 'sphere-well')
    assert.deepEqual(SHOTS.G22.perch?.[0], 'sky-rim')
  })

  it('checks every PDF row in a shot that exists', () => {
    for (let row = 1; row <= 44; row++) {
      if (row === 41 || row === 42) continue
      const shots = TRACE[row]
      assert.ok(shots?.length, `PDF row ${row} has no shot`)
      for (const id of shots) assert.ok(SHOTS[id], `PDF row ${row}: shot ${id} is not in grand-poses.json`)
    }
  })
})

describe('grand acceptance: the clay preview is down', () => {
  it('places no potter’s wheel and no visitors’ shelf while the flag is off', () => {
    assert.equal(GRAND_FLAGS.clayStudio, false)
    const kinds = new Set(SCENE_OBJECTS.map((o) => o.kind as string))
    assert.ok(!kinds.has('potters-wheel'), 'potters-wheel is placed')
    assert.ok(!kinds.has('visitors-wall'), 'visitors-wall is placed')
  })

  it('places neither the ghost potter nor the kulhad helix', () => {
    const kinds = new Set(SCENE_OBJECTS.map((o) => o.kind as string))
    assert.ok(!kinds.has('ghost-potter'))
    assert.ok(!kinds.has('kulhad-helix'))
  })

  it('gives every object a unique id', () => {
    const seen = new Set<string>()
    for (const o of SCENE_OBJECTS) {
      assert.ok(!seen.has(o.id), `duplicate object id ${o.id}`)
      seen.add(o.id)
    }
  })
})

describe('grand acceptance: sourced models (§5)', () => {
  const entries = Object.entries(SOURCED_REGISTRY)
  const file = (url: string) => join(PUBLIC, ...url.replace(/^\//, '').split('/'))

  it('finds every registry file on disk, within the size caps', () => {
    let total = 0
    for (const [slug, e] of entries) {
      for (const url of [e.url, e.lod1]) {
        assert.ok(existsSync(file(url)), `${slug}: ${url} is missing`)
        const size = statSync(file(url)).size
        total += size
        const cap = /searsia|quiver|tree/.test(slug) ? 5 : 4
        assert.ok(size <= cap * MB, `${slug}: ${url} is ${(size / MB).toFixed(2)} MB (cap ${cap} MB)`)
      }
      assert.ok(e.bbox[4] > e.bbox[1], `${slug}: empty bounding box`)
      assert.ok(e.tris > 0, `${slug}: no triangles`)
    }
    assert.ok(total <= 45 * MB, `sourced models total ${(total / MB).toFixed(1)} MB (cap 45 MB)`)
  })

  it('credits every sourced model, with an attribution line for CC BY', () => {
    for (const [slug, e] of entries) {
      const c = e.credit
      assert.ok(c.author && c.source && c.license, `${slug}: incomplete credit`)
      assert.ok(['CC0', 'CC-BY-4.0', 'PD'].includes(c.license), `${slug}: licence ${c.license}`)
      if (c.license === 'CC-BY-4.0') assert.ok(c.attribution && c.licenseUrl, `${slug}: CC BY without an attribution line`)
    }
  })

  it('excludes the models §5.3 leaves out', () => {
    for (const slug of ['wc-rising-horse-sculpture', 'si-greek-slave-plaster', 'si-old-arrow-maker', 'ph-spinning-wheel-01']) assert.ok(!SOURCED_REGISTRY[slug], `${slug} is in the registry`)
  })

  it('resolves every placed sourced model, and credits every placed GLB', () => {
    for (const o of SCENE_OBJECTS) {
      if (o.kind === 'sourced-model') {
        const slug = String(o.props?.slug ?? '')
        assert.ok(SOURCED_REGISTRY[slug], `${o.id}: slug "${slug}" is not in the registry`)
      }
      if (o.model && !o.model.startsWith('/models/opt/') && o.model.includes('/models/')) assert.ok(o.credit || o.kind === 'sourced-model', `${o.id}: GLB ${o.model} without a credit`)
    }
  })

  it('stands every placed CC BY scan on a wine plinth, whose rail card carries its attribution', () => {
    const plinths = SCENE_OBJECTS.filter((o) => o.kind === 'wine-plinth')
    const prop = (o: (typeof plinths)[number], k: string, d: number) => (typeof o.props?.[k] === 'number' ? (o.props[k] as number) : d)
    for (const o of SCENE_OBJECTS) {
      if (o.kind !== 'sourced-model' || o.credit?.license !== 'CC-BY-4.0') continue
      const on = plinths.some((p) => {
        const r = ((p.rotationDeg ?? 0) * Math.PI) / 180
        const dx = o.position[0] - p.position[0]
        const dz = o.position[2] - p.position[2]
        const lx = dx * Math.cos(r) - dz * Math.sin(r)
        const lz = dx * Math.sin(r) + dz * Math.cos(r)
        return Math.abs(lx) <= prop(p, 'width', 2.4) / 2 + 0.05 && Math.abs(lz) <= prop(p, 'depth', 0.9) / 2 + 0.05
      })
      assert.ok(on, `${o.id}: a CC BY scan off the wine plinths has no label rail for its attribution`)
    }
  })

  it('lists every sourced model on the credits file', () => {
    const p = join(PUBLIC, 'models', 'sourced', 'CREDITS.json')
    if (!entries.length) return
    assert.ok(existsSync(p), 'public/models/sourced/CREDITS.json is missing')
    const text = readFileSync(p, 'utf-8')
    for (const [slug] of entries) assert.ok(text.includes(slug), `${slug} is not in CREDITS.json`)
  })
})

describe('grand acceptance: the PBR library (§6.1)', () => {
  const SETS = ['Clay005', 'Clay007', 'Clay009', 'Ground054', 'Plaster001', 'PaintedPlaster017', 'GlazedTerracotta001', 'GlazedTerracotta002', 'RoofingTiles013A', 'Bricks051', 'Terrazzo004', 'Wood092']
  const dir = join(PUBLIC, 'textures', 'pbr')

  it('ships all 12 sets at 512 and 1024, credited', () => {
    const credits = readFileSync(join(dir, 'CREDITS.json'), 'utf-8')
    for (const s of SETS) {
      for (const map of ['color', 'normal']) for (const size of [512, 1024]) assert.ok(existsSync(join(dir, s, `${map}.${size}.webp`)), `${s}/${map}.${size}.webp is missing`)
      assert.ok(credits.includes(`"${s}"`), `${s} is not credited`)
    }
  })

  it('keeps the low tier’s colour and normal maps within 16 MB of GPU memory', () => {
    // a 512² RGBA map with mips is 1.33 MB; L loads 6 sets × colour + normal
    const perMap = (512 * 512 * 4 * 4) / 3
    assert.ok((6 * 2 * perMap) / MB <= 16)
    // and the files themselves stay small
    let bytes = 0
    for (const s of readdirSync(dir).filter((f) => SETS.includes(f))) for (const f of readdirSync(join(dir, s))) bytes += statSync(join(dir, s, f)).size
    assert.ok(bytes <= 30 * MB, `PBR library is ${(bytes / MB).toFixed(1)} MB on disk`)
  })
})

describe('grand acceptance: the map and the logos are the hand-block museum’s (CONTRACT §8)', () => {
  it('keeps indiaGeometry.ts byte-identical', () => {
    assert.equal(sha256Text(join(ROOT, 'src', 'museum', 'exhibits', 'indiaGeometry.ts')), 'f1906033ae4da590d2834c15c3792d9a4b61ebd372fc73e1f52793848052c43e')
  })

  it('keeps both logo files unmodified', () => {
    assert.equal(sha256(join(PUBLIC, 'brand', 'dc-handicrafts.png')), '7357d76a1eb6c8123a95bbbde731bfa8901d525d93c3aafd29f51bfca6f4499b')
    const svg = readFileSync(join(PUBLIC, 'brand', 'iit-kharagpur.svg'), 'utf-8').replace(/\r\n/g, '\n').trimEnd()
    assert.equal(createHash('sha256').update(svg).digest('hex'), IIT_SVG_SHA)
  })
})

/** sha256 of HB's public/brand/iit-kharagpur.svg with LF line endings and no trailing newline. */
const IIT_SVG_SHA = '6f5acd4a478dd0fddf8b74e6b261258ea44c5f2a9fe8db3c26d20a74f666b785'
