/**
 * The oculus court, the mandalas and the duplex band (SPECTACLE WP3): configuration and the pure
 * timing / sun geometry the court's moments run on.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SURFACES, WALLS, ZONES } from '../../src/museum/config/layout'
import { MUSEUM } from '../../src/museum/config/museum'
import { QUALITY_ORDER, QUALITY_PRESETS } from '../../src/museum/config/quality'
import { SCENE_OBJECTS } from '../../src/museum/config/objects'
import { APERTURE_Y, COURT_OBJECTS, istDay, POTTER_LOOP, potterStage, sunPatch } from '../../src/museum/config/spectacleObjects/court'
import { DECOR } from '../../src/museum/config/decor'
import { kharagpurTime } from '../../src/museum/lighting/solar'
import { KIND_SCHEMAS } from '../../src/museum/models/propSchemas'

const byId = (id: string) => {
  const o = COURT_OBJECTS.find((x) => x.id === id)
  assert.ok(o, `missing ${id}`)
  return o
}

describe('court objects', () => {
  it('are in the scene list, once each, with known kinds, props and zones', () => {
    const ids = new Set<string>()
    const zones = new Set(ZONES.map((z) => z.id))
    for (const o of COURT_OBJECTS) {
      assert.ok(!ids.has(o.id), `duplicate ${o.id}`)
      ids.add(o.id)
      assert.ok(SCENE_OBJECTS.some((x) => x.id === o.id), `${o.id} not spread into SCENE_OBJECTS`)
      const schema = KIND_SCHEMAS[o.kind]
      assert.ok(schema, `${o.kind} has no prop schema`)
      const keys = new Set(schema.props.map((p) => p.key))
      for (const k of Object.keys(o.props ?? {})) assert.ok(keys.has(k), `${o.id}: prop ${k} is not in the ${o.kind} schema`)
      assert.ok(zones.has(o.zone), `${o.id}: unknown zone ${o.zone}`)
      assert.ok(!o.footprint, `${o.id}: court pieces add no collider of their own`)
    }
  })

  it('keep factual pieces silent while placeholder', () => {
    for (const id of ['strata-wall']) assert.equal(byId(id).placeholder, true, id)
  })

  it('put the strata wall and the medallion on the surfaces reserved for them', () => {
    const strata = String(byId('strata-wall').props?.surfaces).split(',')
    for (const s of strata) assert.match(SURFACES[s as keyof typeof SURFACES].reserved ?? '', /strata/i)
    const med = DECOR.flatMap((g) => g.treatments).find((t) => t.type === 'medallion')
    assert.ok(med && med.type === 'medallion')
    assert.equal(med.surface, 'f-inner-4')
    assert.match(SURFACES['f-inner-4'].reserved ?? '', /medallion/i)
  })

  it('keep the court to pool, lotus, dome and light (GRAND §3 #29): the tool mandala is unplaced, its kind kept', () => {
    assert.ok(!SCENE_OBJECTS.some((o) => o.kind === 'tool-mandala'))
    assert.ok(KIND_SCHEMAS['tool-mandala'])
  })
})

describe('water ring', () => {
  it('lies inside the curb collider, above the plinth steps and below the lip', () => {
    const p = byId('water-ring').props as Record<string, number>
    const curb = WALLS.find((w) => w.id === 'oculus-plinth')
    assert.ok(curb?.shape?.kind === 'arc')
    const outer = curb.shape.r + curb.shape.thickness / 2
    assert.ok(p.r1 + 0.08 <= outer + 1e-9, 'the basin lip stays inside the curb collider')
    assert.equal(p.r0, 0, 'one full disc of water: the lotus floats on it, no island shows')
    assert.ok(p.level < MUSEUM.oculus.curbHeight && p.level > MUSEUM.oculus.curbHeight / 2, 'the water stands just under the low curb’s brass edge')
  })
})

describe('the ghost potter', () => {
  it('is retired with the helix (GRAND §0.4): its kind stays, unplaced', () => {
    for (const id of ['ghost-potter', 'kulhad-helix']) {
      assert.ok(!SCENE_OBJECTS.some((o) => o.kind === id), `${id} is not placed`)
      assert.ok(KIND_SCHEMAS[id], `${id} keeps its schema`)
    }
  })

  it('throws in contiguous phases that fill the loop, the pot rising at 36 s of 45', () => {
    const phases = Object.values(POTTER_LOOP)
    assert.equal(phases[0][0], 0)
    assert.equal(phases[phases.length - 1][1], 1)
    for (let i = 1; i < phases.length; i++) assert.ok(Math.abs(phases[i][0] - phases[i - 1][1]) < 1e-12)
    assert.ok(Math.abs(POTTER_LOOP.rise[0] * 45 - 36) < 1e-9)
  })

  it('shapes the pot monotonically from lump to finished form', () => {
    let prev = -1
    for (let u = 0; u <= POTTER_LOOP.wire[0]; u += 0.002) {
      const s = potterStage(u)
      assert.ok(s >= prev - 1e-9, `stage went back at u ${u}`)
      assert.ok(s >= 0 && s <= 6)
      prev = s
    }
    assert.equal(potterStage(0.01), 0)
    assert.ok(Math.abs(potterStage(POTTER_LOOP.collar[1]) - 6) < 1e-9)
  })
})

describe('the sundial', () => {
  it('lets the light in from the middle of the dome’s light-well', () => {
    const W = MUSEUM.dome.lightWell
    assert.ok(APERTURE_Y > W.y0 && APERTURE_Y < W.y1)
  })

  it('lands the late-October noon patch north of the centre, beyond the pool, at the galleries', () => {
    const p = sunPatch(kharagpurTime(new Date(Date.UTC(2026, 9, 31)), 12))
    assert.ok(p)
    const r = Math.hypot(p[0], p[1])
    assert.ok(p[1] < 0, 'the winter sun stands south, the patch north')
    // from a 21 m light-well the winter noon sun reaches the foot of Gallery B's wall
    assert.ok(r > MUSEUM.oculus.rings[0] && r < MUSEUM.drum.ringR + MUSEUM.drum.thickness, `noon patch at r ${r.toFixed(2)} should fall beyond the pool, inside the ring wall`)
  })

  it('brings the June noon patch close under the opening, and has no patch at night', () => {
    const p = sunPatch(kharagpurTime(new Date(Date.UTC(2026, 5, 21)), 12))
    assert.ok(p && Math.hypot(p[0], p[1]) < MUSEUM.oculus.rings[2])
    assert.equal(sunPatch(kharagpurTime(new Date(Date.UTC(2026, 5, 21)), 0)), null)
  })

  it('reads the IST date', () => {
    // 20:00 UTC on 31 Oct is 01:30 IST on 1 Nov
    assert.equal(istDay(new Date(Date.UTC(2026, 9, 31, 20))).getTime(), Date.UTC(2026, 10, 1))
  })
})

describe('tier caps used by the court', () => {
  it('grow with the tier and keep the mirror to High and Ultra', () => {
    let prev = 0
    for (const t of QUALITY_ORDER) {
      const c = QUALITY_PRESETS[t].spectacle
      assert.ok(c.helixCups >= prev)
      prev = c.helixCups
      assert.equal(c.poolMirror, t === 'high' || t === 'ultra', t)
    }
  })
})
