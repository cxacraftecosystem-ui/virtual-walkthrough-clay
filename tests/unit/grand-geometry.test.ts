/**
 * The grand rotunda's geometry (GRAND §1–§2, P0 acceptance): the dimensions the plan promises,
 * every zone, door, arch and gate where it should be, a visitor's circle able to pass every way
 * in and kept out of every pocket, the serpentine's clear width, and the waypoint graph.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PODIUM, PODIUM_SLOTS, SURFACES, WALLS, ZONES, zoneAt, type ZoneId } from '../../src/museum/config/layout'
import { ARCH, FT, KEY, MUSEUM, polar } from '../../src/museum/config/museum'
import { EAST_STAIR, JALI_SLOTS, NOTCH_DOOR, PARIKRAMA, RED_ROOM, SAT_WALL, SATELLITES, SERP_OFFSET, SERPENTINE, SERPENTINE_POINTS, serpentineR, SPHERE_WELL } from '../../src/museum/config/satellites'
import { NAV_WAYPOINTS } from '../../src/museum/config/tour'
import { COLLIDERS, pointDistance, resolveCircle, type Collider } from '../../src/museum/navigation/collision'
import { planPath, segmentClear } from '../../src/museum/tour/pathing'

const R = MUSEUM.visitor.collisionRadius
const D = MUSEUM.drum
const S = MUSEUM.visitor.start
const at = (r: number, aDeg: number) => zoneAt(...polar(r, aDeg))?.id
const walk = (aDeg: number) => polar(serpentineR(aDeg), aDeg)
const GROUND = ZONES.filter((z) => z.level !== 2)
const WEST_GATE = (PARIKRAMA.fromDeg + SATELLITES[0].fromDeg) / 2
const EAST_GATE = (PARIKRAMA.toDeg + SATELLITES[SATELLITES.length - 1].toDeg) / 2
const ARCHES = [ARCH.eEast, ARCH.eWest, ARCH.d]

/**
 * Everywhere a visitor's circle can get to from the spawn: a flood fill over a 0.3 m grid of
 * the site, stepping between neighbouring cells only where the swept circle clears every collider.
 */
const reach = (() => {
  const step = 0.3
  const L = MUSEUM.landscape.r + 1
  const x0 = -L
  const z0 = -L
  const nx = Math.ceil((2 * L) / step) + 1
  const nz = Math.ceil((MUSEUM.forecourt.endZ + 1 + L) / step) + 1
  const seen = new Uint8Array(nx * nz)
  const cell = (x: number, z: number) => [Math.round((x - x0) / step), Math.round((z - z0) / step)] as const
  const ok = (i: number, j: number) => {
    const x = x0 + i * step
    const z = z0 + j * step
    const q = resolveCircle(x, z, R)
    return Math.hypot(q.x - x, q.z - z) < 1e-9
  }
  const [si, sj] = cell(S.x, S.z)
  const queue: number[] = [si * nz + sj]
  seen[si * nz + sj] = 1
  while (queue.length) {
    const k = queue.pop()!
    const i = Math.floor(k / nz)
    const j = k % nz
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di
      const b = j + dj
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[a * nz + b]) continue
      if (!ok(a, b) || !segmentClear(x0 + i * step, z0 + j * step, x0 + a * step, z0 + b * step, R)) continue
      seen[a * nz + b] = 1
      queue.push(a * nz + b)
    }
  }
  /** Is (x, z) within a cell of somewhere reached? */
  return (x: number, z: number) => {
    const [i, j] = cell(x, z)
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) if (a >= 0 && b >= 0 && a < nx && b < nz && seen[a * nz + b]) return true
    return false
  }
})()

describe('grand: the plan’s dimensions', () => {
  it('rings the galleries at 1.5 × the drawing’s 70 ft, keeping its lobe-to-ring ratio', () => {
    assert.ok(2 * D.ringR >= 1.5 * 70 * FT - 1e-9, `ring Ø ${(2 * D.ringR).toFixed(2)} m`)
    assert.ok(Math.abs(D.ringR / D.r - 0.735) < 0.002)
  })

  it('opens the dome with an oculus of at least 4.5 m radius under a 22 m collar', () => {
    assert.ok(MUSEUM.oculus.r >= 4.5)
    assert.ok(Math.abs(KEY.domeSphereR - 16.667) < 0.01 && Math.abs(KEY.domeCentreY - 4.333) < 0.01)
    // the dome passes through the springing circle and the crown
    assert.ok(Math.abs(KEY.domeCentreY + Math.sqrt(KEY.domeSphereR ** 2 - D.ringR ** 2) - MUSEUM.dome.springY) < 1e-9)
    assert.ok(Math.abs(KEY.domeCentreY + KEY.domeSphereR - (MUSEUM.dome.springY + MUSEUM.dome.rise)) < 1e-9)
    assert.ok(MUSEUM.dome.collarTop > MUSEUM.dome.lightWell.y1 && MUSEUM.dome.lightWell.y0 === MUSEUM.dome.terraces[2].y)
  })

  it('has fourteen podiums of 12 in × 12 in at 4 ft', () => {
    assert.equal(PODIUM_SLOTS.length, 14)
    assert.ok(Math.abs(PODIUM.size - 0.305) < 0.001 && Math.abs(PODIUM.height - 1.219) < 0.001)
  })

  it('springs each arch at its apex less half its chord', () => {
    const chords: [typeof ARCH.eEast, number][] = [
      [ARCH.eEast, 4.8],
      [ARCH.eWest, 5.1],
      [ARCH.d, 5.7],
    ]
    for (const [a, c] of chords) {
      assert.ok(Math.abs(a.chord - c) < 0.05, `chord ${a.chord.toFixed(2)}`)
      assert.ok(Math.abs(a.spring - (a.apex - a.chord / 2)) < 1e-12)
      const w = WALLS.find((x) => x.shape?.kind === 'arc' && x.kind === 'lintel' && Math.abs(x.min[1] - a.spring) < 1e-9)
      assert.ok(w && w.collide === false, 'the arch is an open bay')
    }
  })

  it('hangs the theatre screen as a 9.2 m chord', () => {
    assert.ok(Math.abs(SURFACES['th-screen'].range[1] - 9.2) <= 0.05, `${SURFACES['th-screen'].range[1]}`)
  })

  it('stands the visitor on the forecourt, 15 m out from the portal', () => {
    assert.equal(zoneAt(S.x, S.z)?.id, 'entrance-court')
    assert.ok(S.z - KEY.annexOuterZ > 14)
  })
})

describe('grand: zones', () => {
  it('finds every ground zone at its own anchor and spawn', () => {
    for (const z of GROUND) {
      assert.equal(zoneAt(...z.anchor)?.id, z.id, `${z.id} anchor`)
      assert.equal(zoneAt(z.spawn.x, z.spawn.z)?.id, z.id, `${z.id} spawn`)
    }
  })

  it('names both sides of every door, arch and gate', () => {
    const want: [string, ZoneId | undefined, ZoneId][] = [
      ['portal, outside', zoneAt(0, KEY.annexOuterZ + 1)?.id, 'entrance-court'],
      ['portal, inside', zoneAt(0, MUSEUM.annex.endZ - 1)?.id, 'annex'],
      ['annex mouth', at(KEY.ambMidR, 90), 'annex'],
      ['D notch, hallway side', at(NOTCH_DOOR.rC, D.dNotchDeg - 2), 'hallway-d'],
      ['D notch, walk side', at(NOTCH_DOOR.rC, D.dNotchDeg - 358), 'parikrama-west'],
      ['NE notch, entry side', at(NOTCH_DOOR.rC, D.neNotchDeg + 2), 'entry-e'],
      ['NE notch, walk side', at(NOTCH_DOOR.rC, D.neNotchDeg - 2), 'parikrama-east'],
      ['E-east arch, outside', at(KEY.ambMidR, ARCH.eEast.midDeg), 'entry-e'],
      ['E-east arch, threshold', at(KEY.ringC, ARCH.eEast.midDeg), 'entry-e'],
      ['E-east arch, inside', at(D.ringR - 1, ARCH.eEast.midDeg), 'entry-e'],
      ['E-west arch, threshold', at(KEY.ringC, ARCH.eWest.midDeg), 'entry-e'],
      ['E-west arch, inside', at(D.ringR - 1, ARCH.eWest.midDeg), 'entry-e'],
      ['D arch, outside', at(KEY.ambMidR, ARCH.d.midDeg), 'hallway-d'],
      ['D arch, threshold', at(KEY.ringC, ARCH.d.midDeg), 'hallway-d'],
      ['D arch, inside', at(D.ringR - 1, ARCH.d.midDeg), 'ring-c'],
      ['west gate, walk', zoneAt(...walk(WEST_GATE))?.id, 'parikrama-west'],
      ['west gate, plinth', at(SAT_WALL.innerC + 1.5, WEST_GATE), 'entrance-court'],
      ['east gate, walk', zoneAt(...walk(EAST_GATE))?.id, 'parikrama-east'],
      ['east gate, plinth', at(SAT_WALL.innerC + 1.5, EAST_GATE), 'entrance-court'],
      ['Red Room', zoneAt(RED_ROOM.cx, RED_ROOM.cz)?.id, 'library'],
    ]
    for (const s of SATELLITES) {
      want.push([`${s.id} door, walk`, zoneAt(...walk(s.doorDeg))?.id, s.doorDeg < PARIKRAMA.split ? 'parikrama-west' : 'parikrama-east'])
      want.push([`${s.id} door, room`, at(SAT_WALL.innerFace + 0.5, s.doorDeg), s.id])
    }
    for (const [name, got, zone] of want) assert.equal(got, zone, name)
  })

  it('keeps the perches (the roof, the balcony, the well’s room) out of zoneAt', () => {
    for (const id of ['sky-rim', 'duplex', 'sphere-well'] as ZoneId[]) assert.equal(ZONES.find((z) => z.id === id)?.level, 2, id)
    assert.equal(zoneAt(...polar((MUSEUM.balcony.r0 + MUSEUM.balcony.r1) / 2, -45))?.id, 'ring-b', 'under the balcony is the gallery')
  })
})

describe('grand: passage', () => {
  it('lets a visitor reach every door, arch, gate and room', () => {
    const points: [string, [number, number]][] = [
      ['portal', [0, KEY.annexEndZ + MUSEUM.annex.thickness / 2]],
      ['D notch door', polar(NOTCH_DOOR.rC, D.dNotchDeg)],
      ['NE notch door', polar(NOTCH_DOOR.rC, D.neNotchDeg)],
      ...ARCHES.map((a) => [`arch ${a.fromDeg}°`, polar(KEY.ringC, a.midDeg)] as [string, [number, number]]),
      ['west gate', polar(SAT_WALL.innerC + 1.5, WEST_GATE)],
      ['east gate', polar(SAT_WALL.innerC + 1.5, EAST_GATE)],
      ...SATELLITES.map((s) => [`${s.id} door`, polar(SAT_WALL.innerC, s.doorDeg)] as [string, [number, number]]),
      ['Red Room', polar(Math.hypot(RED_ROOM.cx, RED_ROOM.cz) - RED_ROOM.r / 2, RED_ROOM.aDeg)],
      ['library west wing', polar((SAT_WALL.innerFace + SAT_WALL.outerFace) / 2, SATELLITES[2].fromDeg + 3)],
      ['library east wing', polar((SAT_WALL.innerFace + SAT_WALL.outerFace) / 2, SATELLITES[2].toDeg - 3)],
      ['beside the Sphere Well', [SPHERE_WELL.cx, SPHERE_WELL.cz + SPHERE_WELL.rimR + 1]],
    ]
    for (const [name, [x, z]] of points) assert.ok(reach(x, z), name)
  })

  it('keeps visitors out of the pockets, the jali slots, the berm, the well and the stair', () => {
    const blocked: [string, [number, number]][] = []
    // courtyards behind the walk's outer wall, and gardens behind its parapet
    for (const p of SERPENTINE_POINTS) {
      if (p.kind === 'touch') blocked.push([`courtyard at ${p.aDeg.toFixed(1)}°`, polar((serpentineR(p.aDeg) + SERP_OFFSET + PARIKRAMA.r1) / 2 + 0.1, p.aDeg)])
      if (p.kind === 'door') blocked.push([`garden at ${p.aDeg}°`, polar((PARIKRAMA.r0 + serpentineR(p.aDeg) - SERP_OFFSET) / 2, p.aDeg)])
    }
    for (const [a0, a1] of JALI_SLOTS) blocked.push([`jali slot ${a0}…${a1}`, polar(SAT_WALL.innerC + 2.5, (a0 + a1) / 2)])
    blocked.push(['behind the rooms', polar((SAT_WALL.outerOuter + MUSEUM.landscape.r) / 2, -60)])
    blocked.push(['in the well', [SPHERE_WELL.cx, SPHERE_WELL.cz]])
    blocked.push(['under the stair’s foot', polar(EAST_STAIR.r, EAST_STAIR.lower.fromDeg - 4)])
    assert.ok(blocked.length >= 12)
    for (const [name, [x, z]] of blocked) assert.ok(!reach(x, z), name)
  })
})

describe('grand: the serpentine Parikrama', () => {
  const walls = COLLIDERS.filter((c: Collider) => WALLS.some((w) => w.id === c.id))
  it('keeps a clear width of at least 2.6 m between its walls, gate to gate', () => {
    // the walk's centreline is at least 1.3 m from every wall, from the first room to the last
    // (beyond them the gates open the walk's outer side onto the plinth)
    let least = Infinity
    for (let a = SATELLITES[0].fromDeg; a <= SATELLITES[SATELLITES.length - 1].toDeg; a += 0.25) {
      const [x, z] = walk(a)
      for (const c of walls) least = Math.min(least, pointDistance(c, x, z))
    }
    assert.ok(least >= SERPENTINE.walkW / 2 - 0.05 && 2 * least >= 2.6, `half width ${least.toFixed(3)} m`)
  })

  it('swings out to every room’s door and in towards the ring between them', () => {
    const doors = SERPENTINE_POINTS.filter((p) => p.kind === 'door')
    assert.equal(doors.length, SATELLITES.length)
    for (const d of doors) assert.ok(Math.abs(d.r + SERP_OFFSET - SAT_WALL.innerC) < 1e-9, 'the outer wall lies on the room’s wall across its door')
    const touches = SERPENTINE_POINTS.filter((p) => p.kind === 'touch')
    assert.ok(touches.length >= 2)
    assert.ok(touches.some((t) => Math.abs(t.r - SERP_OFFSET - SERPENTINE.t / 2 - PARIKRAMA.r0) < 1e-9), 'at least one touch reaches the ring')
  })
})

describe('grand: navigation', () => {
  it('keeps every waypoint 0.30 m clear of every collider', () => {
    for (const [x, z] of NAV_WAYPOINTS) for (const c of COLLIDERS) assert.ok(pointDistance(c, x, z) >= 0.3, `waypoint (${x.toFixed(2)}, ${z.toFixed(2)}) is ${pointDistance(c, x, z).toFixed(2)} m from ${c.id}`)
  })

  it('connects the spawn to every room and every waypoint', () => {
    for (const z of GROUND) assert.ok(planPath({ x: S.x, z: S.z }, { x: z.spawn.x, z: z.spawn.z }), `route to ${z.id}`)
    for (const [x, z] of NAV_WAYPOINTS) assert.ok(planPath({ x: S.x, z: S.z }, { x, z }), `waypoint (${x.toFixed(2)}, ${z.toFixed(2)})`)
  })
})
