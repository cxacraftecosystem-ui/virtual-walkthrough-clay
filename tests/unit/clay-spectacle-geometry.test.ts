/**
 * The spectacle phase's geometry (SPECTACLE §1) at the grand plan's scale (GRAND §1.2): the north
 * wing's crescent rooms and the serpentine Parikrama, the notch doors and the gates, the zones
 * and surfaces they add, the navigation waypoints, the tour's new stops and the solar model.
 *
 * npm test
 */
import { PERCH_PATHS, doorOf, pathPoint } from '../../src/museum/navigation/perch'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SURFACES, WALLS, ZONES, zoneAt, type SurfaceId, type ZoneId } from '../../src/museum/config/layout'
import { MUSEUM, polar } from '../../src/museum/config/museum'
import { FLOOR_PLAN } from '../../src/museum/config/plan'
import { JALI_SLOTS, NOTCH_DOOR, PARIKRAMA, SAT_DOOR_HALF_DEG, SAT_WALL, SATELLITES, serpentineR, SPHERE_WELL, THEATRE } from '../../src/museum/config/satellites'
import { NAV_WAYPOINTS, TOUR_STOPS } from '../../src/museum/config/tour'
import { QUALITY_ORDER, QUALITY_PRESETS } from '../../src/museum/config/quality'
import { sunPosition } from '../../src/museum/lighting/solar'
import { KIND_SCHEMAS, kindDefaults } from '../../src/museum/models/propSchemas'
import { COLLIDERS, pointDistance, resolveCircle } from '../../src/museum/navigation/collision'
import { planPath, segmentClear } from '../../src/museum/tour/pathing'

const R = MUSEUM.visitor.collisionRadius
const near = (a: [number, number], b: [number, number], tol = 0.01) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol
const at = (r: number, aDeg: number) => zoneAt(...polar(r, aDeg))?.id
const sat = (id: string) => SATELLITES.find((s) => s.id === id)!
/** A crescent room's middle radius, and the walk's centreline at an angle. */
const MID = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2
const walk = (aDeg: number) => polar(serpentineR(aDeg), aDeg)
/** The gates: the open stretch between the notch wall and the first / last room. */
const WEST_GATE = (PARIKRAMA.fromDeg + SATELLITES[0].fromDeg) / 2
const EAST_GATE = (PARIKRAMA.toDeg + SATELLITES[SATELLITES.length - 1].toDeg) / 2

describe('north wing: constants', () => {
  it('derives the check values of the plan (GRAND §1.2)', () => {
    const checks: [string, [number, number], [number, number]][] = [
      ['notch-D door', polar(NOTCH_DOOR.rC, MUSEUM.drum.dNotchDeg), [-14.03, -13.55]],
      ['notch-NE door', polar(NOTCH_DOOR.rC, MUSEUM.drum.neNotchDeg), [15.97, 11.18]],
      ['Atlas door', polar(SAT_WALL.innerC, sat('atlas').doorDeg), [-8.37, -21.8]],
      ['Theatre door', polar(SAT_WALL.innerC, sat('theatre').doorDeg), [16.8, -16.22]],
      ['Library door', polar(SAT_WALL.innerC, sat('library').doorDeg), [22.21, -7.22]],
      ['Shop door', polar(SAT_WALL.innerC, sat('shop').doorDeg), [22.61, 5.85]],
      ['Atlas centre', polar(MID, -111), [-10.14, -26.42]],
      ['Library centre', polar(MID, -18), [26.91, -8.75]],
      ['Sphere Well centre', [SPHERE_WELL.cx, SPHERE_WELL.cz], [-26.31, -9.58]],
    ]
    for (const [name, got, want] of checks) assert.ok(near(got, want), `${name}: (${got[0].toFixed(3)}, ${got[1].toFixed(3)})`)
    assert.ok(Math.abs(SAT_DOOR_HALF_DEG - 2.95) < 0.01, `door half-angle ${SAT_DOOR_HALF_DEG}`)
    assert.equal(PARIKRAMA.r0, MUSEUM.drum.ringR + MUSEUM.drum.thickness)
    assert.equal(PARIKRAMA.r1, SAT_WALL.innerC - SAT_WALL.t / 2)
  })

  it('keeps the rooms on the plinth disc, with a 0.40 m gap to its edge', () => {
    assert.ok(Math.abs(MUSEUM.landscape.r - SAT_WALL.outerOuter - 0.4) < 1e-9)
    for (const s of SATELLITES) assert.ok(s.fromDeg < s.doorDeg && s.doorDeg < s.toDeg && s.height < MUSEUM.pavilion.height, s.id)
  })
})

describe('north wing: walls', () => {
  const wall = (id: string) => {
    const w = WALLS.find((x) => x.id === id)
    assert.ok(w, id)
    return w!
  }
  it('replaces each notch wall with two piers and a lintel over a door', () => {
    for (const n of ['notch-ne', 'notch-d']) {
      assert.ok(!WALLS.some((w) => w.id === n), `${n} is split`)
      assert.notEqual(wall(`${n}-in`).collide, false)
      assert.notEqual(wall(`${n}-out`).collide, false)
      const l = wall(`${n}-lintel`)
      assert.equal(l.collide, false)
      assert.equal(l.min[1], NOTCH_DOOR.height)
    }
  })

  it('builds every room: inner wall either side of its door, lintel, outer and end walls', () => {
    for (const s of SATELLITES) {
      for (const part of ['inner-a', 'inner-b', 'outer', 'end-w', 'end-e']) assert.notEqual(wall(`sat-${s.id}-${part}`).collide, false, `${s.id} ${part}`)
      assert.equal(wall(`sat-${s.id}-lintel`).collide, false)
    }
  })

  it('hands the jali screens and the baffle to their owners, but they still collide; the Sphere Well rim is a solid disc', () => {
    for (const id of ['jali-1', 'jali-2', 'jali-3', 'sat-theatre-baffle']) {
      const w = wall(id)
      assert.equal(w.render, false, id)
      assert.ok(COLLIDERS.some((c) => c.id === id), `${id} collides`)
    }
    // retired with the Kiln Stair and the horse plinth (GRAND §0.4, §2.2)
    assert.ok(!WALLS.some((w) => w.id === 'kiln-stair' || w.id === 'par-plinth'))
    const rim = COLLIDERS.find((c) => c.id === 'well-rim')!
    assert.equal(rim.kind, 'circle', 'the well rim is a solid disc')
    const p = resolveCircle(SPHERE_WELL.cx + 0.1, SPHERE_WELL.cz, R)
    assert.ok(Math.hypot(p.x - SPHERE_WELL.cx, p.z - SPHERE_WELL.cz) >= SPHERE_WELL.rimR + R - 1e-6, 'dropped inside the rim, pushed out')
  })

  it('draws the rooms, the walk, both door gaps and the well rim on the plan', () => {
    const ids = new Set(FLOOR_PLAN.walls.map((w) => w.id))
    for (const id of ['notch-d-in', 'notch-d-out', 'notch-ne-in', 'notch-ne-out', 'sat-atlas-outer', 'sat-shop-inner-b', 'well-rim', 'serp-in-1', 'rr-wall-n', 'jali-2']) assert.ok(ids.has(id), id)
    for (const id of ['notch-d-lintel', 'notch-ne-lintel', 'sat-theatre-lintel']) assert.ok(!ids.has(id), `${id}: a door is a gap on the plan`)
    for (const z of ['atlas', 'theatre', 'library', 'shop', 'parikrama-west', 'parikrama-east'] as ZoneId[]) assert.ok(FLOOR_PLAN.zones.some((p) => p.id === z), z)
    const b = FLOOR_PLAN.bounds
    assert.ok(b.minZ <= -MUSEUM.landscape.r && b.maxX >= MUSEUM.landscape.r, 'the bounds stay at the disc')
  })
})

describe('north wing: zones', () => {
  it('finds each room at its middle, inside its door, and the walk outside it', () => {
    for (const s of SATELLITES) {
      // the library's middle is the Red Room
      assert.equal(at(MID, (s.fromDeg + s.toDeg) / 2), s.id, `${s.id} middle`)
      assert.equal(at(SAT_WALL.innerC + 0.35, s.doorDeg), s.id, `${s.id} inside the door`)
      const walkZone = s.doorDeg < PARIKRAMA.split ? 'parikrama-west' : 'parikrama-east'
      assert.equal(at(SAT_WALL.innerC - 0.35, s.doorDeg), walkZone, `${s.id} outside the door`)
    }
    assert.equal(at(MID, THEATRE.axisDeg), 'theatre')
  })

  it('joins the walk to the pavilion at both notch doors and to the plinth at both gates', () => {
    const d = MUSEUM.drum.dNotchDeg
    const ne = MUSEUM.drum.neNotchDeg
    assert.equal(at(NOTCH_DOOR.rC, d - 2), 'hallway-d')
    assert.equal(at(NOTCH_DOOR.rC, d - 360 + 2), 'parikrama-west')
    assert.equal(at(NOTCH_DOOR.rC, ne + 2), 'entry-e')
    assert.equal(at(NOTCH_DOOR.rC, ne - 2), 'parikrama-east')
    assert.equal(zoneAt(...walk(WEST_GATE))?.id, 'parikrama-west')
    assert.equal(at(SAT_WALL.innerC + 1.5, WEST_GATE), 'entrance-court', 'west gate')
    assert.equal(zoneAt(...walk(EAST_GATE))?.id, 'parikrama-east')
    assert.equal(at(SAT_WALL.innerC + 1.5, EAST_GATE), 'entrance-court', 'east gate')
  })

  it('keeps the spawn on the forecourt, and the roof out of zoneAt', () => {
    const s = MUSEUM.visitor.start
    assert.equal(zoneAt(s.x, s.z)?.id, 'entrance-court')
    const rim = ZONES.find((z) => z.id === 'sky-rim')!
    assert.equal(rim.level, 2)
    assert.equal(zoneAt(0, (MUSEUM.oculus.rings[0] + MUSEUM.innerMainWall.r) / 2)?.id, 'inner', 'standing in the court is the court, not the roof')
  })
})

describe('north wing: passage', () => {
  /** The visitor's circle swept along a → b never touches a collider. */
  const passes = (a: [number, number], b: [number, number]) => segmentClear(a[0], a[1], b[0], b[1], R)

  it('lets a visitor through every door and gate on a straight line', () => {
    const d = MUSEUM.drum.dNotchDeg
    const ne = MUSEUM.drum.neNotchDeg
    assert.ok(passes(polar(NOTCH_DOOR.rC, d - 5), polar(NOTCH_DOOR.rC, d + 5)), 'D notch door')
    assert.ok(passes(polar(NOTCH_DOOR.rC, ne - 5), polar(NOTCH_DOOR.rC, ne + 5)), 'NE notch door')
    for (const s of SATELLITES) assert.ok(passes(walk(s.doorDeg), polar(SAT_WALL.innerFace + 0.8, s.doorDeg)), `${s.id} door`)
    assert.ok(passes(walk(WEST_GATE), polar(SAT_WALL.innerC + 1.5, WEST_GATE)), 'west gate')
    assert.ok(passes(walk(EAST_GATE), polar(SAT_WALL.innerC + 1.5, EAST_GATE)), 'east gate')
  })

  it('closes the jali slots and the gap behind the rooms', () => {
    for (const [a0, a1] of JALI_SLOTS) assert.ok(!passes(polar(SAT_WALL.innerC - 0.4, (a0 + a1) / 2), polar(SAT_WALL.innerC + 2.5, (a0 + a1) / 2)), `jali ${a0}…${a1}`)
    // along the 0.40 m between the rooms' outer face and the plinth edge
    const gap = (SAT_WALL.outerOuter + MUSEUM.landscape.r) / 2
    assert.ok(!passes(polar(gap, -120), polar(gap, -100)), 'outer gap')
    for (let a = -126; a <= 26; a += 2) {
      const [x, z] = polar((SAT_WALL.outerOuter + MUSEUM.landscape.r) / 2, a)
      assert.ok(COLLIDERS.some((c) => pointDistance(c, x, z) < R), `no standing room behind the rooms at ${a}°`)
    }
  })

  it('walks the length of the Parikrama, and round the outside past the Sphere Well', () => {
    const s = MUSEUM.visitor.start
    for (const [a, b] of [
      [walk(-124), walk(20)],
      [walk(WEST_GATE), walk(EAST_GATE)],
    ] as [number, number][][]) {
      const path = planPath({ x: a[0], z: a[1] }, { x: b[0], z: b[1] })
      assert.ok(path, 'route along the walk')
    }
    const aw = Math.atan2(SPHERE_WELL.cz, SPHERE_WELL.cx)
    const beyond = { x: SPHERE_WELL.cx + Math.cos(aw) * (SPHERE_WELL.rimR + 1.4), z: SPHERE_WELL.cz + Math.sin(aw) * (SPHERE_WELL.rimR + 1.4) }
    assert.ok(planPath({ x: s.x, z: s.z }, beyond), 'round the Sphere Well')
  })
})

describe('north wing: navigation', () => {
  it('keeps every waypoint 0.30 m clear of every collider', () => {
    for (const [x, z] of NAV_WAYPOINTS) {
      for (const c of COLLIDERS) assert.ok(pointDistance(c, x, z) >= 0.3, `waypoint (${x.toFixed(2)}, ${z.toFixed(2)}) is ${pointDistance(c, x, z).toFixed(2)} m from ${c.id}`)
    }
  })

  it('reaches every room and both walks from the spawn', () => {
    const s = MUSEUM.visitor.start
    for (const id of ['atlas', 'theatre', 'library', 'shop', 'parikrama-west', 'parikrama-east'] as ZoneId[]) {
      const zn = ZONES.find((z) => z.id === id)!
      assert.equal(zoneAt(zn.spawn.x, zn.spawn.z)?.id, id, `${id} spawn in its zone`)
      const q = resolveCircle(zn.spawn.x, zn.spawn.z, R)
      assert.ok(Math.hypot(q.x - zn.spawn.x, q.z - zn.spawn.z) < 1e-9, `${id} spawn is clear`)
      assert.ok(planPath({ x: s.x, z: s.z }, { x: zn.spawn.x, z: zn.spawn.z }), `route to ${id}`)
    }
  })

  it('every waypoint links to the graph (no orphan)', () => {
    const s = MUSEUM.visitor.start
    for (const [x, z] of NAV_WAYPOINTS) assert.ok(planPath({ x: s.x, z: s.z }, { x, z }), `waypoint (${x.toFixed(2)}, ${z.toFixed(2)})`)
  })
})

describe('north wing: surfaces', () => {
  it('hangs the theatre screen on the outer wall, 9.2 m across, facing the drum centre', () => {
    const s = SURFACES['th-screen']
    assert.ok(Math.abs(s.range[1] - 9.2) <= 0.05, `length ${s.range[1]}`)
    assert.equal(s.zone, 'theatre')
    assert.equal(s.wall, 'sat-theatre-outer')
    const mid: [number, number] = [s.a[0] + (s.dir[0] * s.range[1]) / 2, s.a[1] + (s.dir[1] * s.range[1]) / 2]
    const toCentre = Math.hypot(...mid)
    assert.ok((s.normal[0] * -mid[0] + s.normal[1] * -mid[1]) / toCentre > 0.999, 'normal points to the centre')
    assert.ok(Math.abs((Math.atan2(mid[1], mid[0]) * 180) / Math.PI - THEATRE.axisDeg) < 1e-6)
    assert.equal(s.reserved, 'Agni Theatre screen')
  })

  it('reserves the surfaces of the spectacle and grand installations, and no others', () => {
    const reserved = (Object.keys(SURFACES) as SurfaceId[]).filter((id) => SURFACES[id].reserved).sort()
    const want = ['b-outer-1', 'b-outer-2', 'b-outer-3', 'b-outer-4', 'd-hallway-1', 'd-hallway-2', 'd-hallway-3', 'd-hallway-4', 'd-hallway-5', 'd-hallway-6']
    want.push('f-inner-1', 'f-inner-4', 'f-inner-main', 'f-outer-1', 'f-outer-2', 'f-outer-3', 'f-outer-4', 'f-outer-5', 'g-east', 'g-west', 'h-inner-1', 'h-inner-2', 'h-inner-3', 'h-inner-4', 'th-screen')
    assert.deepEqual(reserved, want.sort())
  })

  it('every existing surface keeps its id, in the room it faces at the grand scale', () => {
    // GRAND §2.4: the ambulatory either side of the annex mouth is the entry ways; only H's middle faces the annex
    const before: Record<string, ZoneId> = {"a-outer-1":"ring-a","a-outer-2":"ring-a","a-outer-3":"ring-a","b-outer-1":"ring-b","b-outer-2":"ring-b","b-outer-3":"ring-b","b-outer-4":"ring-b","c-outer-1":"ring-c","c-outer-2":"ring-c","c-south-1":"ring-c","c-south-2":"ring-c","c-south-3":"ring-c","d-hallway-1":"hallway-d","d-hallway-2":"hallway-d","d-hallway-3":"hallway-d","d-hallway-4":"hallway-d","d-hallway-5":"hallway-d","d-hallway-6":"hallway-d","d-inner-1":"hallway-d","d-inner-2":"hallway-d","d-inner-3":"hallway-d","e-north-1":"entry-e","e-north-2":"entry-e","e-north-3":"entry-e","e-south-1":"entry-e","e-south-2":"entry-e","e-south-3":"entry-e","h-east":"entry-e","h-description":"annex","h-west":"entry-e","h-inner-1":"entry-e","h-inner-2":"entry-e","h-inner-3":"entry-e","h-inner-4":"entry-e","f-outer-1":"entry-e","f-outer-2":"entry-e","f-outer-3":"entry-e","f-outer-4":"entry-e","f-outer-5":"entry-e","f-inner-1":"inner","f-inner-2":"inner","f-inner-main":"inner","f-inner-3":"inner","f-inner-4":"inner","g-east":"annex","g-west":"annex","g-facade-east":"entrance-court","g-facade-west":"entrance-court","th-screen":"theatre"}
    for (const [id, zone] of Object.entries(before)) assert.equal(SURFACES[id as SurfaceId].zone, zone, id)
  })
})

describe('tour: Earth to Fire', () => {
  it('walks the grand route, every stop in a chapter, the chapters in order', () => {
    const ids = TOUR_STOPS.map((s) => s.id)
    assert.deepEqual(ids, [
      'arrival', 'guardians', 'earth-room', 'description', 'lippan',
      'turn', 'court',
      'gallery-a', 'gate', 'gallery-b', 'gallery-c',
      'balcony', 'hallway', 'threshold', 'parikrama',
      'atlas', 'theatre',
      'red-room', 'haat', 'sphere-well', 'return',
    ])
    for (const s of TOUR_STOPS) assert.ok(s.chapter, `${s.id} has a chapter`)
    const runs = TOUR_STOPS.map((s) => s.chapter).filter((c, i, a) => i === 0 || a[i - 1] !== c)
    assert.deepEqual(runs, ['earth', 'water', 'hand', 'air', 'fire', 'return'])
  })

  it('stands every ground stop where a visitor can stand, in the room it describes', () => {
    const want: Record<string, ZoneId> = {
      arrival: 'entrance-court', guardians: 'entrance-court', 'earth-room': 'annex', description: 'annex', lippan: 'entry-e',
      turn: 'ring-a', court: 'inner', 'gallery-a': 'ring-a', gate: 'ring-a', 'gallery-b': 'ring-b', 'gallery-c': 'ring-c',
      hallway: 'hallway-d', threshold: 'hallway-d', parikrama: 'parikrama-west', atlas: 'atlas', theatre: 'theatre',
      'red-room': 'library', haat: 'shop', return: 'entrance-court',
    }
    const s = MUSEUM.visitor.start
    for (const [id, zone] of Object.entries(want)) {
      const v = TOUR_STOPS.find((x) => x.id === id)!.view
      assert.equal(zoneAt(v.x, v.z)?.id, zone, id)
      const q = resolveCircle(v.x, v.z, R)
      assert.ok(Math.hypot(q.x - v.x, q.z - v.z) < 1e-9, `${id} stands clear`)
      assert.ok(planPath({ x: s.x, z: s.z }, { x: v.x, z: v.z }), `${id} can be walked to`)
    }
  })

  it('reaches the perch stops by their doors', () => {
    const s = MUSEUM.visitor.start
    for (const stop of TOUR_STOPS.filter((x) => x.perch)) {
      const d = doorOf(stop.perch!.id)
      assert.ok(planPath({ x: s.x, z: s.z }, { x: d.stand[0], z: d.stand[1] }), `${stop.id}: its door can be walked to`)
      const q = pathPoint(PERCH_PATHS[stop.perch!.id], stop.perch!.t)
      assert.ok(Math.hypot(q.x - stop.view.x, q.z - stop.view.z) < 1e-9, `${stop.id}: the view stands on the perch`)
    }
    assert.deepEqual(TOUR_STOPS.filter((x) => x.perch).map((x) => x.perch!.id), ['duplex', 'sphere-well'])
  })
})

describe('spectacle seams', () => {
  it('caps every tier, with the same keys everywhere', () => {
    const keys = Object.keys(QUALITY_PRESETS.low.spectacle).sort()
    for (const t of QUALITY_ORDER) assert.deepEqual(Object.keys(QUALITY_PRESETS[t].spectacle).sort(), keys, t)
    assert.equal(QUALITY_PRESETS.low.spectacle.motes, 0)
    assert.equal(QUALITY_PRESETS.ultra.spectacle.helixCups, 960)
  })

  it('types the props of every spectacle kind', () => {
    const kinds = ['spectacle', 'water-rill', 'pit-firing', 'perch-door', 'cove-light', 'strata-wall', 'oculus-light', 'atmosphere', 'court-mandala', 'water-ring', 'ghost-potter', 'kulhad-helix', 'tool-mandala', 'clay-bed', 'kiln-window', 'ghatam-set', 'duplex-frieze', 'living-alpana', 'clay-chimes', 'horse-procession', 'map-wall', 'credits-panel', 'compass-mandala', 'programme-board', 'theatre-house', 'theatre-seating', 'bookcase', 'soil-archive', 'archive-cabinet', 'listening-post', 'shop-shelf', 'shop-table', 'lantern-canopy', 'diya-field', 'stamp-post', 'photo-spot']
    for (const k of kinds) assert.ok(KIND_SCHEMAS[k], k)
    assert.equal(kindDefaults('kulhad-helix').turns, 2.25)
    assert.equal(kindDefaults('atmosphere').defaultTime, 'live')
    assert.equal(kindDefaults('map-wall').finish, 'clay')
    for (const k of Object.values(KIND_SCHEMAS)) for (const p of k.props) if (p.type === 'select' && p.default !== undefined) assert.ok(p.options.includes(p.default), `${k.kind}.${p.key}`)
  })
})

describe('solar position', () => {
  // Reference values: NREL SPA's worked example (Reda & Andreas 2004) and a numerical ephemeris
  // (PyEphem 4.2) for Kharagpur, both with standard refraction. Compass azimuth, degrees.
  const REF: [string, number, number, number, number][] = [
    ['2003-10-17T19:30:30Z', 39.742476, -105.1786, 39.888, 194.34],
    ['2026-06-21T04:30:00Z', 22.32, 87.31, 66.399, 82.281],
    ['2026-12-21T10:00:00Z', 22.32, 87.31, 17.577, 234.511],
    ['2026-03-20T01:30:00Z', 22.32, 87.31, 16.501, 97.21],
  ]
  it('matches the reference sun within 0.2°', () => {
    for (const [d, lat, lon, el, az] of REF) {
      const p = sunPosition(new Date(d), lat, lon)
      assert.ok(Math.abs(p.elevationDeg - el) < 0.2, `${d}: elevation ${p.elevationDeg.toFixed(3)} vs ${el}`)
      assert.ok(Math.abs(p.azimuthDeg - az) < 0.2, `${d}: azimuth ${p.azimuthDeg.toFixed(3)} vs ${az}`)
    }
  })
})
