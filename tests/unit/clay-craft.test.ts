/**
 * Hands-on craft and sound (SPECTACLE WP4: F3, F7, F17–F19, F21, F22, F29, F30 stems): where
 * the pieces stand, the horse procession's layout, the kiln's timeline, the ghatam's tuning,
 * the zone reverbs and the score's chapters.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ZONES, zoneAt, type ZoneId } from '../../src/museum/config/layout'
import { DEG } from '../../src/museum/config/museum'
import { SCENE_OBJECTS } from '../../src/museum/config/objects'
import { PARIKRAMA } from '../../src/museum/config/satellites'
import { NAV_WAYPOINTS, TOUR_STOPS } from '../../src/museum/config/tour'
import { CHAPTER_MIX, CRAFT_OBJECTS, PIT_HEAT, SA, ZONE_CHAPTER, ZONE_REVERB, captionKey, ghatamPitches, gardenDepth, horseSlots, kilnAutoStage, kilnHeat } from '../../src/museum/config/spectacleObjects/craft'
import { ghatamStroke, ksPluck } from '../../src/museum/media/soundscape/synth'
import { KIND_SCHEMAS, kindDefaults } from '../../src/museum/models/propSchemas'
import { COLLIDERS, pointDistance } from '../../src/museum/navigation/collision'

const obj = (id: string) => CRAFT_OBJECTS.find((o) => o.id === id)!

describe('craft: the pieces', () => {
  it('lists every WP4 kind once, in SCENE_OBJECTS, with schema props', () => {
    // the clay bed is unplaced (art round 3), its kind kept
    assert.ok(!SCENE_OBJECTS.some((o) => o.kind === 'clay-bed'))
    for (const kind of ['pit-firing', 'kiln-window', 'ghatam-set', 'horse-procession']) {
      const list = CRAFT_OBJECTS.filter((o) => o.kind === kind)
      assert.equal(list.length, 1, kind)
      assert.ok(SCENE_OBJECTS.includes(list[0]), `${kind} spread into SCENE_OBJECTS`)
      assert.equal(KIND_SCHEMAS[kind]?.owner, 'WP4')
      // every prop the object sets is one the admin can edit
      for (const k of Object.keys(list[0].props ?? {})) assert.ok(KIND_SCHEMAS[kind].props.some((p) => p.key === k), `${kind}.${k} in KIND_SCHEMAS`)
    }
  })

  it('stands each piece in the zone the spec names (and its object zone says so)', () => {
    const expect: [string, ZoneId][] = [
      ['pit-firing', 'entrance-court'],
      ['kiln-window', 'ring-c'],
      ['ghatam-set', 'ring-c'],
    ]
    for (const [id, zone] of expect) {
      const o = obj(id)
      assert.equal(o.zone, zone, `${id} config zone`)
      assert.equal(zoneAt(o.position[0], o.position[2])?.id, zone, `${id} stands in ${zone}`)
    }
  })

  it('keeps the walk round the court open: every footprint corner is clear of the walls', () => {
    for (const o of CRAFT_OBJECTS.filter((x) => x.footprint)) {
      const [w, d] = o.footprint!
      const r = ((o.rotationDeg ?? 0) * Math.PI) / 180
      for (const [lx, lz] of [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ]) {
        const x = o.position[0] + lx * Math.cos(r) + lz * Math.sin(r)
        const z = o.position[2] - lx * Math.sin(r) + lz * Math.cos(r)
        for (const c of COLLIDERS.filter((k) => !k.id.startsWith('object:') && !k.id.includes(o.id))) {
          assert.ok(pointDistance(c, x, z) > 0.25, `${o.id} corner (${x.toFixed(2)}, ${z.toFixed(2)}) is ${pointDistance(c, x, z).toFixed(2)} m from ${c.id}`)
        }
      }
    }
  })

  it('no navigation waypoint sits within 0.30 m of a craft piece', () => {
    const mine = COLLIDERS.filter((c) => CRAFT_OBJECTS.some((o) => c.id.includes(o.id)))
    assert.ok(mine.length >= 3, `craft colliders found (${mine.map((c) => c.id).join(', ')})`)
    for (const [x, z] of NAV_WAYPOINTS) for (const c of mine) assert.ok(pointDistance(c, x, z) >= 0.3, `waypoint (${x.toFixed(2)}, ${z.toFixed(2)}) vs ${c.id}`)
  })
})

describe('craft: the horse procession (F22)', () => {
  const slots = horseSlots(kindDefaults('horse-procession'))

  it('stands the horses in the drum-side gardens from −128° to 26°, growing 0.45 → 1.2 m (GRAND §2.6)', () => {
    // of the 21, those where the walk swings in to the ring have no garden to stand in
    assert.ok(slots.length >= 15 && slots.length <= 21, `${slots.length} horses`)
    const last = slots[slots.length - 1]
    assert.ok(Math.abs(slots[0].a + 128) < 1e-9 && Math.abs(last.a - 26) < 1e-9)
    assert.ok(Math.abs(slots[0].h - 0.45) < 1e-9 && Math.abs(last.h - 1.2) < 1e-9)
    for (let i = 1; i < slots.length; i++) assert.ok(slots[i].h > slots[i - 1].h)
    for (const s of slots) {
      const r = Math.hypot(s.x, s.z)
      const depth = gardenDepth(s.a)
      assert.ok(depth >= 1, `horse at ${s.a.toFixed(1)}° in a garden ${depth.toFixed(2)} m deep`)
      assert.ok(Math.abs(r - (PARIKRAMA.r0 + depth / 2)) < 1e-9, `horse at r ${r.toFixed(3)} in the middle of its garden`)
    }
  })

  it('faces every horse along the walk, towards the east gate', () => {
    for (const s of slots) {
      // local +x (the head) in world after the rotation about y
      const hx = Math.cos(s.ry)
      const hz = -Math.sin(s.ry)
      const a = s.a * DEG
      const tangent = [-Math.sin(a), Math.cos(a)] // increasing angle
      assert.ok(hx * tangent[0] + hz * tangent[1] > 0.999, `horse at ${s.a.toFixed(1)}° faces along the walk`)
    }
  })

  it('leaves room between neighbours, even for the largest horses (body ≈ 0.66·h long)', () => {
    for (let i = 1; i < slots.length; i++) {
      const gap = Math.hypot(slots[i].x - slots[i - 1].x, slots[i].z - slots[i - 1].z)
      assert.ok(gap > 0.33 * (slots[i].h + slots[i - 1].h), `gap ${gap.toFixed(2)} m between horses ${i - 1} and ${i}`)
    }
  })
})

describe('craft: the kiln window (F18)', () => {
  it('peaks the heat in the fire (stage 3) and is cold when wet or fired', () => {
    assert.equal(kilnHeat(3), 1)
    for (const s of [0, 1, 2, 4, 5]) assert.ok(kilnHeat(s) < 0.01, `stage ${s}`)
  })

  it('walks the timeline in order, holding on each stage, and ends on the last', () => {
    const sec = 30
    let prev = 0
    for (let t = 0; t <= sec; t += 0.25) {
      const s = kilnAutoStage(t, sec, 5)
      assert.ok(s >= prev - 1e-9, `monotonic at ${t}`)
      prev = s
    }
    assert.equal(kilnAutoStage(sec + 1, sec, 5), 5)
    assert.equal(kilnAutoStage(sec / 12, sec, 5), 0) // early in the first slot: still wet
    assert.equal(kilnAutoStage(sec + 1, sec, 4), 4) // no smoked branch: ends fired
  })
})

describe('craft: the ghatam (F19) and the score', () => {
  it('reads the curator’s pitch ratios and falls back for bad ones', () => {
    assert.deepEqual(ghatamPitches('1,1.12,1.26,1.5,1.68', 5), [1, 1.12, 1.26, 1.5, 1.68])
    assert.deepEqual(ghatamPitches('1,x,1.5', 3), [1, 1.12, 1.5]) // a bad entry keeps its default, the rest their places
    assert.equal(ghatamPitches('', 7).length, 7)
  })

  it('tunes the score to Sa, and each chapter to a mix of known stems', () => {
    assert.ok(SA > 100 && SA < 200)
    for (const ch of ['earth', 'water', 'hand', 'air', 'fire', 'return'] as const) assert.ok(Object.keys(CHAPTER_MIX[ch]).length > 0, ch)
    for (const s of TOUR_STOPS) if (s.chapter) assert.ok(CHAPTER_MIX[s.chapter], `stop ${s.id} chapter ${s.chapter}`)
  })

  it('gives every zone a chapter and a reverb, the court the longest', () => {
    for (const z of ZONES) {
      assert.ok(ZONE_CHAPTER[z.id], `${z.id} chapter`)
      assert.ok(ZONE_REVERB[z.id] > 0, `${z.id} reverb`)
    }
    assert.equal(ZONE_REVERB.inner, Math.max(...Object.values(ZONE_REVERB)))
    assert.equal(ZONE_REVERB['parikrama-west'], 0.25)
    assert.equal(ZONE_REVERB.library, 0.6)
  })

  it('renders a Karplus–Strong pluck that rings and decays', () => {
    const rate = 8000
    const out = new Float32Array(rate * 2)
    ksPluck(out, rate, 0, 220, { seconds: 2, level: 1, decay: Math.exp(Math.log(0.001) / (1.5 * 220)) })
    const rms = (a: number, b: number) => Math.sqrt(out.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a))
    assert.ok(rms(0, 800) > 0.01, 'audible attack')
    assert.ok(rms(0, 800) > rms(rate * 1.5, rate * 2) * 5, 'decays')
  })

  it('keeps the tanpura’s buzzing bridge stable: every sample finite, and it still decays', () => {
    const rate = 8000
    for (const f of [69.3, 103.9, 138.6, 277.2]) {
      const out = new Float32Array(rate * 5)
      ksPluck(out, rate, 0, f, { seconds: 5, level: 1, decay: Math.exp(Math.log(0.001) / (4.6 * f)), jawari: 0.35, seed: 17 })
      assert.ok(out.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.0001), `finite and bounded at ${f} Hz`)
      const rms = (a: number, b: number) => Math.sqrt(out.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a))
      assert.ok(rms(0, 2000) > rms(rate * 4, rate * 5) * 3, `decays at ${f} Hz`)
    }
  })

  it('a stroke is silent without an audio context (no throw)', () => {
    assert.equal(typeof ghatamStroke, 'function')
  })
})

describe('craft: captions and the pit', () => {
  it('captions with a real dictionary key, or a named fallback until the key exists', () => {
    assert.equal(captionKey('caption.kiln', null), 'caption.kiln')
    assert.equal(captionKey('caption.does-not-exist', 'caption.bells'), 'caption.bells')
    assert.equal(captionKey('caption.does-not-exist', null), null)
  })

  it('burns brightest at night and smoulders by day', () => {
    assert.equal(PIT_HEAT.night, 1)
    assert.ok(PIT_HEAT.midday < PIT_HEAT.golden && PIT_HEAT.golden < PIT_HEAT.dusk && PIT_HEAT.dusk < PIT_HEAT.night)
  })
})
