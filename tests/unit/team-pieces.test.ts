/**
 * The workshop team's pieces (src/museum/config/objects.ts TEAM_PIECES; GLBs in public/models/team/ from
 * scripts/import-team-models.mjs): sixteen pieces, fourteen on the podium row — one per podium, every podium
 * used — and two on the front step of the Herd. Each stands on its support at its baked height, fits the
 * 12 in podium top (and the glass hood where there is one, the slotted stand included), sits inside its
 * support's collider without touching any other, keeps its podium's sconce, and a visitor can walk from the
 * entrance to stand in front of it (tour/pathing). The replaced stand-ins are gone.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { ACCENTS } from '../../src/museum/config/accents'
import { PODIUM, PODIUM_HOODS, PODIUM_SLOTS, podiumStandY, zoneAt } from '../../src/museum/config/layout'
import { DEG, MUSEUM, polar } from '../../src/museum/config/museum'
import { SCENE_OBJECTS, TEAM_MODEL_DIR, TEAM_PIECES, TEAM_REPLACES, type SceneObjectConfig } from '../../src/museum/config/objects'
import { GRAND_CRAFTS_OBJECTS } from '../../src/museum/config/grandObjects/crafts'
import { TOUR_STOPS } from '../../src/museum/config/tour'
import { COLLIDERS, pointDistance, type Collider } from '../../src/museum/navigation/collision'
import { planPath, type P2 } from '../../src/museum/tour/pathing'

const ROOT = path.resolve(import.meta.dirname, '../..')
const source = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

/** The glass hoods (config/layout.ts PODIUM_HOODS, drawn by architecture/Pavilion.tsx). */
const HOODED = new Set(PODIUM_HOODS.ids)
const HOOD_HEIGHT = PODIUM_HOODS.height
const HOOD_INSIDE = PODIUM.size - 2 * PODIUM_HOODS.margin
/** The slotted stand (models/teamPiece.tsx STAND). */
const STAND = /STAND = \{ lip: ([\d.]+), depth: ([\d.]+), height: ([\d.]+) \}/.exec(source('src/museum/models/teamPiece.tsx'))!
const STAND_LIP = Number(STAND[1])
const STAND_DEPTH = Number(STAND[2])
/** A piece keeps a 12 mm margin to the podium's edge. */
const PODIUM_TOP = 0.28

const pieces = TEAM_PIECES
const onPodium = pieces.filter((p) => PODIUM_SLOTS.some((s) => Math.hypot(s.x - p.position[0], s.z - p.position[2]) < 1e-6))
const onHerd = pieces.filter((p) => !onPodium.includes(p))
const slotOf = (p: SceneObjectConfig) => PODIUM_SLOTS.find((s) => Math.hypot(s.x - p.position[0], s.z - p.position[2]) < 1e-6)!
const herdSteps = SCENE_OBJECTS.filter((o) => o.id.startsWith('herd-plinth-'))

/** World size [x, y, z] of a GLB's single mesh: the quantised accessor's bounds × the node's de-quantising scale. */
function glbSize(file: string): [number, number, number] {
  const buf = fs.readFileSync(file)
  assert.equal(buf.toString('latin1', 0, 4), 'glTF')
  const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12))) as {
    nodes: { mesh?: number; scale?: number[] }[]
    meshes: { primitives: { attributes: { POSITION: number } }[] }[]
    accessors: { min: number[]; max: number[]; normalized?: boolean; componentType: number }[]
    extensionsUsed?: string[]
    images?: { mimeType?: string }[]
  }
  const nodes = json.nodes.filter((n) => n.mesh !== undefined)
  assert.equal(nodes.length, 1, `${file}: one mesh node`)
  assert.ok(json.extensionsUsed?.includes('EXT_meshopt_compression') && json.extensionsUsed.includes('KHR_mesh_quantization'), `${file}: meshopt + quantised`)
  assert.ok((json.images ?? []).length >= 3 && json.images!.every((i) => i.mimeType === 'image/jpeg'), `${file}: its JPEG textures`)
  const acc = json.accessors[json.meshes[nodes[0].mesh!].primitives[0].attributes.POSITION]
  const norm = acc.normalized ? ({ 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 } as Record<number, number>)[acc.componentType] : 1
  const s = nodes[0].scale ?? [1, 1, 1]
  return [0, 1, 2].map((k) => ((acc.max[k] - acc.min[k]) / norm) * s[k]) as [number, number, number]
}

/** Extent [along the support's x, along its z] of a w × d box turned by `deg` relative to the support. */
function turned(w: number, d: number, deg: number): [number, number] {
  const r = deg * DEG
  return [Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * d, Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * d]
}

/** The corners and centre of an object's footprint, in world x/z. */
function footprintPoints(o: SceneObjectConfig): P2[] {
  const [w, d] = o.footprint!
  const r = ((o.rotationDeg ?? 0) * Math.PI) / 180
  const pts: P2[] = [{ x: o.position[0], z: o.position[2] }]
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    pts.push({ x: o.position[0] + (sx * w * Math.cos(r)) / 2 + (sz * d * Math.sin(r)) / 2, z: o.position[2] - (sx * w * Math.sin(r)) / 2 + (sz * d * Math.cos(r)) / 2 })
  return pts
}

describe('the workshop team’s pieces', () => {
  it('places all sixteen, each a titled, described, inspectable placeholder with its GLB', () => {
    assert.equal(pieces.length, 16)
    const ids = SCENE_OBJECTS.map((o) => o.id)
    assert.equal(new Set(ids).size, ids.length, 'scene object ids are unique')
    const slugs = fs.readdirSync(path.join(ROOT, 'public', TEAM_MODEL_DIR)).filter((f) => f.endsWith('.glb'))
    assert.equal(slugs.length, 16, 'sixteen GLBs in public/models/team/')
    for (const p of pieces) {
      assert.ok(SCENE_OBJECTS.includes(p), `${p.id} is in SCENE_OBJECTS`)
      assert.equal(p.kind, 'team-piece')
      assert.match(p.model!, /^\/models\/team\/[a-z0-9-]+\.glb$/)
      assert.ok(fs.existsSync(path.join(ROOT, 'public', p.model!)), `${p.model} exists`)
      assert.equal(p.id, `team-${path.basename(p.model!, '.glb')}`)
      assert.ok(p.interactive && p.inspectable && p.placeholder, `${p.id}: interactive, inspectable, placeholder`)
      assert.ok(p.title && p.description && p.alt && p.i18n?.hi?.title && p.i18n?.bn?.title, `${p.id}: title, description, alt and hi/bn titles`)
      assert.equal(zoneAt(p.position[0], p.position[2])?.id, p.zone, `${p.id} stands in its zone`)
    }
  })

  it('names no tradition, region or maker the file names do not give', () => {
    // the traditions of the pavilion's galleries and survey; only the Bankura Horse's own name carries one
    const NAMES = /\b(Bankura|Molela|Longpi|Nizamabad|Khurja|Jaipur|Kumartuli|Majuli|Bishnupur|Ayyanar|Gorakhpur|Khavda|Pokaran|Lippan|Asharikandi|Andro|Chinhat|Manamadurai|Villianur|Odisha|Gujarat|Rajasthan|Bengal|Manipur|Assam)\b/i
    for (const p of pieces) {
      const own = NAMES.exec(p.title)?.[0]
      for (const text of [p.description!, p.alt!]) {
        const m = NAMES.exec(text)
        assert.ok(!m || m[0] === own, `${p.id} names “${m?.[0]}”`)
      }
    }
  })

  it('fills every podium of the row with one piece, standing on its top and facing the court', () => {
    assert.equal(onPodium.length, PODIUM_SLOTS.length)
    assert.deepEqual(onPodium.map((p) => slotOf(p).id).sort(), PODIUM_SLOTS.map((s) => s.id).sort())
    for (const p of onPodium) {
      const s = slotOf(p)
      // on the podium's top, or on the base plate of its glass hood
      assert.equal(p.position[1], podiumStandY(s.id), `${p.id} stands on the podium top`)
      assert.equal(p.position[1], PODIUM.height + (HOODED.has(s.id) ? PODIUM_HOODS.base : 0))
      assert.equal(p.zone, s.zone)
      // the podium's own turn, plus at most a three-quarter turn for an animal
      const turn = (((p.rotationDeg! - s.rotationY / DEG + 540) % 360) + 360) % 360 - 180
      assert.ok(Math.abs(turn) <= 45, `${p.id} turns ${turn.toFixed(0)}° from the court`)
    }
    // nothing else stands on a podium of the row
    for (const o of SCENE_OBJECTS) {
      if (pieces.includes(o)) continue
      const on = PODIUM_SLOTS.find((s) => Math.hypot(s.x - o.position[0], s.z - o.position[2]) < PODIUM.size && Math.abs(o.position[1] - PODIUM.height) < 0.05)
      assert.ok(!on, `${o.id} also stands on ${on?.id}`)
    }
  })

  it('stands two horses on the Herd’s front step, inside it, clear of the other horses', () => {
    assert.deepEqual(onHerd.map((p) => p.id).sort(), ['team-bankura-horse', 'team-horse-figurine'])
    const step = herdSteps.find((s) => s.id === 'herd-plinth-1')!
    for (const p of onHerd) {
      assert.ok(Math.abs(p.position[1] - step.height!) < 1e-9, `${p.id} stands on the front step's top`)
      // every corner of the horse inside the step's footprint (the step's local frame)
      const r = ((step.rotationDeg ?? 0) * Math.PI) / 180
      for (const q of footprintPoints(p)) {
        const dx = q.x - step.position[0]
        const dz = q.z - step.position[2]
        const lx = dx * Math.cos(r) - dz * Math.sin(r)
        const lz = dx * Math.sin(r) + dz * Math.cos(r)
        assert.ok(Math.abs(lx) <= step.footprint![0] / 2 - 0.05 && Math.abs(lz) <= step.footprint![1] / 2 - 0.05, `${p.id} overhangs the step`)
      }
      for (const h of SCENE_OBJECTS.filter((o) => o.id.startsWith('craft-bankura-herd-') || (onHerd.includes(o) && o !== p))) {
        const d = Math.hypot(h.position[0] - p.position[0], h.position[2] - p.position[2])
        if (Math.abs(h.position[1] - p.position[1]) < 0.05) assert.ok(d > 0.45, `${p.id} is ${d.toFixed(2)} m from ${h.id}`)
      }
    }
    // nine horses on the Herd, as before: seven stand-ins and the two
    assert.equal(GRAND_CRAFTS_OBJECTS.filter((o) => o.id.startsWith('craft-bankura-herd-')).length + onHerd.length, 9)
  })

  it('bakes each GLB at its display height, and it fits its podium top, its hood and its stand', () => {
    for (const p of pieces) {
      const [w, h, d] = glbSize(path.join(ROOT, 'public', p.model!))
      assert.ok(Math.abs(h - p.height!) < 0.002, `${p.id}: GLB ${h.toFixed(3)} m tall, config ${p.height}`)
      // the click box covers the piece
      assert.ok(p.footprint![0] >= w - 0.006 && p.footprint![1] >= d - 0.006, `${p.id}: footprint ${p.footprint} under the GLB's ${w.toFixed(3)} × ${d.toFixed(3)}`)
      if (!onPodium.includes(p)) continue
      const s = slotOf(p)
      const turn = p.rotationDeg! - s.rotationY / DEG
      const stand = p.props?.stand === 'slot'
      const [ex, ez] = turned(stand ? w + 2 * STAND_LIP : w, stand ? Math.max(d, STAND_DEPTH) : d, turn)
      const limit = stand ? PODIUM.size - 0.004 : PODIUM_TOP
      assert.ok(Math.max(ex, ez) <= limit, `${p.id}: ${ex.toFixed(3)} × ${ez.toFixed(3)} m on a ${PODIUM.size.toFixed(3)} m top`)
      if (HOODED.has(s.id)) {
        assert.ok(Math.max(ex, ez) <= HOOD_INSIDE - 0.01, `${p.id}: ${ex.toFixed(3)} × ${ez.toFixed(3)} m inside the ${HOOD_INSIDE.toFixed(3)} m hood of ${s.id}`)
        assert.ok(h <= HOOD_HEIGHT - 0.05, `${p.id}: ${h} m under the ${HOOD_HEIGHT} m hood`)
      }
    }
    assert.equal(HOODED.size, 4, 'four hooded podiums')
    // Pavilion.tsx draws the hoods from the same constants
    const pavilion = source('src/museum/architecture/Pavilion.tsx')
    assert.match(pavilion, /new Set\(PODIUM_HOODS\.ids\)/)
    assert.match(pavilion, /PODIUM_HOODS\.base/)
  })

  it('sits inside its support’s collider and touches no other', () => {
    for (const p of pieces) {
      const own = COLLIDERS.find((c) => c.id === `object-${p.id}`)
      assert.ok(own, `${p.id} has its collider (its click box)`)
      const support = onPodium.includes(p) ? `podium-${slotOf(p).id}` : 'object-herd-plinth-1'
      const sup = COLLIDERS.find((c) => c.id === support)!
      assert.ok(sup, support)
      const pts = footprintPoints(p)
      for (const q of pts) assert.equal(pointDistance(sup, q.x, q.z), 0, `${p.id} reaches out of ${support}`)
      const others = COLLIDERS.filter((c: Collider) => c !== own && c !== sup && !(onHerd.includes(p) && c.id.startsWith('object-herd-plinth-')))
      for (const c of others) for (const q of pts) assert.ok(pointDistance(c, q.x, q.z) > 0, `${p.id} overlaps ${c.id}`)
    }
  })

  it('keeps each podium’s sconce on its piece', () => {
    for (const p of onPodium) {
      const s = slotOf(p)
      const a = ACCENTS.find((x) => x.id === `podium-${s.id}`)
      assert.ok(a, `${s.id} keeps its accent light`)
      assert.ok(Math.hypot(a.target[0] - s.x, a.target[2] - s.z) < 0.05)
    }
  })

  it('a visitor can walk from the entrance to stand in front of each piece', () => {
    const start = { x: MUSEUM.visitor.start.x, z: MUSEUM.visitor.start.z }
    for (const p of pieces) {
      // a step inside the podium row on the piece's own angle (the court side of the Herd for the horses)
      const a = Math.atan2(p.position[2], p.position[0]) / DEG
      const r = Math.hypot(p.position[0], p.position[2])
      const [x, z] = polar(onPodium.includes(p) ? r - 1.0 : r - 2.0, a)
      const goal = { x, z }
      const route = planPath(start, goal)
      assert.ok(route, `no route to ${p.id}`)
      const end = route[route.length - 1]
      assert.ok(Math.hypot(end.x - goal.x, end.z - goal.z) < 0.05, `${p.id}: the spot in front of it is free floor`)
      assert.equal(zoneAt(end.x, end.z)?.id, p.zone, `${p.id}: seen from its own gallery`)
    }
  })

  it('retires the stand-ins it replaced, and the tour names pieces that are there', () => {
    assert.equal(TEAM_REPLACES.length, 16)
    assert.deepEqual(TEAM_REPLACES.map((r) => r.by).sort(), pieces.map((p) => p.id).sort(), 'one stand-in per piece')
    for (const { id } of TEAM_REPLACES) assert.ok(!SCENE_OBJECTS.some((o) => o.id === id), `${id} is gone`)
    for (const t of TOUR_STOPS) if (t.item?.kind === 'object') assert.ok(SCENE_OBJECTS.some((o) => o.id === t.item!.id), `${t.id}: ${t.item.id}`)
  })
})
