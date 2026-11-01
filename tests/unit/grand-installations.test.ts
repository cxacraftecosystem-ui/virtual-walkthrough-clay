/**
 * The grand plan's PDF installations (GRAND §3, §6.3, P3 acceptance):
 *
 *  - the Earth Room holds a canyon of eight formations round a table under the skylight, with two
 *    curved shelf runs; the A|B and B|C gates hold two formations each and every E arch is
 *    flanked by two;
 *  - every gate formation keeps inside its gate box (the wall collider that holds visitors off
 *    it), and every free-standing formation has a footprint of its own size;
 *  - the court holds the pool, the lotus, the curb, the benches and the sundial — nothing else
 *    stands inside the curb;
 *  - the Sphere Well's stair runs between the sphere and the wall up to the lowest terrace;
 *  - the Wine Hall has its six plinths W1–W6, the Red Room its six-tier shelves round a two-tier
 *    plinth under the oculus, and the Parikrama its planted courtyards and gardens.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SCENE_OBJECTS, type SceneObjectConfig } from '../../src/museum/config/objects'
import { GRAND_INSTALLATIONS_OBJECTS, RED_ROOM_PLINTH_TOP } from '../../src/museum/config/grandObjects/installations'
import { DEG, KEY, MUSEUM } from '../../src/museum/config/museum'
import { RED_ROOM, SPHERE_WELL } from '../../src/museum/config/satellites'

const byPrefix = (p: string) => GRAND_INSTALLATIONS_OBJECTS.filter((o) => o.id.startsWith(p))
const num = (o: SceneObjectConfig, k: string) => Number((o.props as Record<string, unknown>)[k])
const radius = (o: SceneObjectConfig) => Math.hypot(o.position[0], o.position[2])

describe('grand installations: formations (p05)', () => {
  it('stands nine in the Earth Room (the canyon seated on the floor, five of them to the soffit), two in each gate and two either side of each E arch', () => {
    const earth = byPrefix('earth-formation-')
    assert.equal(earth.length, 9)
    assert.equal(byPrefix('earth-cliff-wall').length, 0, 'no scan hangs half-sunk in a wall')
    for (const o of earth) assert.equal(o.position[1], 0, `${o.id} stands on the floor`)
    assert.ok(earth.filter((o) => num(o, 'height') > MUSEUM.pavilion.ceilingHeight - 1).length >= 5)
    for (const o of earth) assert.ok(num(o, 'height') < MUSEUM.pavilion.ceilingHeight, `${o.id} under the soffit`)
    assert.equal(byPrefix('gate-formation-').length, 4)
    assert.equal(byPrefix('arch-formation-').length, 4)
    for (const o of [...byPrefix('earth-formation-'), ...byPrefix('gate-formation-'), ...byPrefix('arch-formation-')]) assert.equal(o.kind, 'eroded-formation', o.id)
  })

  it('keeps every gate formation inside its gate box', () => {
    const FIN = MUSEUM.fins
    for (const o of byPrefix('gate-formation-')) {
      const r = radius(o)
      const a = Math.atan2(o.position[2], o.position[0]) / DEG
      const gate = FIN.atDeg.reduce((best, g) => (Math.abs(((a - g + 540) % 360) - 180) < Math.abs(((a - best + 540) % 360) - 180) ? g : best), FIN.atDeg[0])
      assert.ok(Math.abs(((a - gate + 540) % 360) - 180) < 0.01, `${o.id} stands on its gate's line`)
      // the model's footprint: width across the gate, depth along it (it faces the court)
      const w = num(o, 'width')
      const d = num(o, 'depth')
      assert.ok(r - d / 2 >= FIN.r0 - 1e-6 && r + d / 2 <= FIN.r1 + 1e-6, `${o.id}: radial ${(r - d / 2).toFixed(2)}…${(r + d / 2).toFixed(2)} in ${FIN.r0}…${FIN.r1}`)
      assert.ok(w <= FIN.thickness + 1e-6, `${o.id}: ${w} across a ${FIN.thickness} gate`)
      assert.ok(num(o, 'height') <= FIN.height + 1e-6, `${o.id} no taller than the gate`)
    }
  })

  it('gives every free-standing formation a collider of its own size', () => {
    for (const o of [...byPrefix('earth-formation-'), ...byPrefix('arch-formation-')]) {
      assert.ok(o.footprint, `${o.id} has a footprint`)
      assert.ok(Math.abs(o.footprint![0] - num(o, 'width')) < 1e-6 && Math.abs(o.footprint![1] - num(o, 'depth')) < 1e-6, `${o.id} footprint = width × depth`)
    }
  })
})

describe('grand installations: the court (p07l)', () => {
  it('stands only the pool, the lotus, the sundial and the frieze in the court', () => {
    // pieces built in court coordinates stand at the centre; anything else inside the curb is a stray
    const strays = SCENE_OBJECTS.filter((o) => radius(o) > 0.01 && radius(o) < MUSEUM.oculus.rings[0] && o.position[1] < MUSEUM.pavilion.mezzanineBand && o.kind !== 'lotus')
    assert.deepEqual(strays.map((o) => o.id), [])
    const centred = SCENE_OBJECTS.filter((o) => o.zone === 'inner' && radius(o) <= 0.01)
    const allowed = new Set(['oculus-plinth', 'court-mandala', 'court-lotus', 'water-ring', 'duplex-frieze'])
    for (const o of centred) assert.ok(allowed.has(o.id) || o.kind === 'spectacle', `${o.id} (${o.kind}) stands in the court`)
    assert.ok(centred.some((o) => o.kind === 'lotus'))
    assert.ok(centred.some((o) => o.kind === 'water-ring'))
  })

  it('floats the lotus on the water, with nothing in the court that catches a floor click', () => {
    const lotus = SCENE_OBJECTS.find((o) => o.kind === 'lotus')!
    assert.equal(lotus.position[1], MUSEUM.oculus.poolLevel)
    assert.ok(num(lotus, 'r') <= MUSEUM.oculus.rings[1], 'the open lotus stays over the water')
    assert.equal(lotus.footprint, undefined, 'the curb collider keeps visitors off the water')
    const water = SCENE_OBJECTS.find((o) => o.kind === 'water-ring')!
    assert.ok(num(water, 'r1') < MUSEUM.oculus.rings[0], 'the water stays inside the curb')
  })
})

describe('grand installations: the Sphere Well (p07r)', () => {
  it('winds the stair between the sphere and the wall, up to the lowest terrace', () => {
    const stair = GRAND_INSTALLATIONS_OBJECTS.find((o) => o.kind === 'spiral-stair')!
    const sphere = GRAND_INSTALLATIONS_OBJECTS.find((o) => o.kind === 'clay-sphere')!
    assert.ok(num(stair, 'r0') > SPHERE_WELL.sphereR + 1, 'a clear gap round the sphere')
    assert.ok(num(stair, 'r1') < SPHERE_WELL.roomR, 'inside the room')
    assert.equal(stair.position[1], SPHERE_WELL.floorY)
    assert.ok(Math.abs(stair.position[1] + num(stair, 'rise') - SPHERE_WELL.terraceTopY) < 1e-6, 'it reaches the lowest terrace')
    assert.deepEqual([sphere.position[0], sphere.position[2]], [SPHERE_WELL.cx, SPHERE_WELL.cz])
    assert.equal(num(sphere, 'r'), SPHERE_WELL.sphereR)
  })
})

describe('grand installations: Wine Hall, Red Room, Parikrama, Earth Room', () => {
  it('lines the Wine Hall with W1–W6', () => {
    const w = GRAND_INSTALLATIONS_OBJECTS.filter((o) => /^wine-plinth-\d$/.test(o.id))
    assert.equal(w.length, 6)
    for (const o of w) assert.equal(o.zone, 'hallway-d', o.id)
  })

  it('rings the Red Room with six-tier shelves round a two-tier plinth under its oculus', () => {
    const shelves = byPrefix('red-shelf-')
    assert.ok(shelves.length >= 6)
    for (const o of shelves) assert.equal(num(o, 'tiers'), 6, o.id)
    const plinth = GRAND_INSTALLATIONS_OBJECTS.find((o) => o.id === 'red-plinth')!
    assert.equal(num(plinth, 'tiers'), 2)
    assert.ok(Math.hypot(plinth.position[0] - RED_ROOM.cx, plinth.position[2] - RED_ROOM.cz) < 1e-6)
    assert.ok(num(plinth, 'r') > RED_ROOM.oculusR - 0.2, 'the plinth fills the disc of sky')
    assert.deepEqual(RED_ROOM_PLINTH_TOP, [RED_ROOM.cx, num(plinth, 'tiers') * num(plinth, 'h'), RED_ROOM.cz])
  })

  it('plants the Parikrama: walled courtyards and sunken gardens with horse plinths', () => {
    const gardens = GRAND_INSTALLATIONS_OBJECTS.filter((o) => o.kind === 'courtyard-garden')
    assert.ok(gardens.length >= 8, `${gardens.length} planted pockets`)
    const horses = GRAND_INSTALLATIONS_OBJECTS.filter((o) => /^garden-\d+-plinth-/.test(o.id))
    assert.equal(horses.length, 20, 'twenty horse plinths')
    for (const g of gardens) assert.ok(g.zone === 'parikrama-west' || g.zone === 'parikrama-east', g.id)
  })

  it('sets the Earth Room table under the skylight between two curved runs', () => {
    const table = GRAND_INSTALLATIONS_OBJECTS.find((o) => o.kind === 'round-table')!
    assert.deepEqual([table.position[0], table.position[2]], [0, KEY.annexSkylightZ])
    assert.equal(byPrefix('earth-shelf-').length, 2)
    for (const o of byPrefix('earth-shelf-')) assert.equal(o.kind, 'curved-shelf')
  })
})
