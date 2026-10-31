/**
 * The clay pavilion's geometry core: curved-wall collision, line of sight across arcs, zones as
 * sectors and polygons, hanging surfaces along faceted walls, the podium ring and path planning
 * from the forecourt spawn into every zone.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PODIUM, PODIUM_SLOTS, SURFACES, WALLS, ZONES, shapeContains, surfacePoint, zoneAt, type SurfaceId } from '../../src/museum/config/layout'
import { MUSEUM, polar } from '../../src/museum/config/museum'
import { FLOOR_PLAN } from '../../src/museum/config/plan'
import { NAV_WAYPOINTS } from '../../src/museum/config/tour'
import { mountFor, mountForPodium, RAIL_Y } from '../../src/museum/lighting/tracks'
import { COLLIDERS, pointDistance, resolveCircle, segmentBlocked, type Collider } from '../../src/museum/navigation/collision'
import { pathLength, planPath, segmentClear } from '../../src/museum/tour/pathing'

const R = MUSEUM.visitor.collisionRadius
const D = MUSEUM.drum
const collider = (id: string) => {
  const c = COLLIDERS.find((cc) => cc.id === id)
  assert.ok(c, `collider ${id}`)
  return c as Collider
}
const radius = (p: { x: number; z: number }) => Math.hypot(p.x, p.z)

describe('arc collision', () => {
  it('pushes a visitor pressed against the gallery ring wall back into the room', () => {
    const [x, z] = polar(D.ringR - 0.1, -60)
    const p = resolveCircle(x, z, R)
    assert.ok(Math.abs(radius(p) - (D.ringR - R)) < 1e-6, `r = ${radius(p)}`)
    // stays on the same ray (pure radial push)
    assert.ok(Math.abs(Math.atan2(p.z, p.x) - Math.atan2(z, x)) < 1e-9)
  })

  it('pushes a point inside the wall band out through the nearer face', () => {
    const c = collider('drum-ring')
    assert.equal(c.kind, 'arc')
    const inner = resolveCircle(...polar(D.ringR + 0.05, 300), R)
    assert.ok(radius(inner) <= D.ringR - R + 1e-6, `inner face: r = ${radius(inner)}`)
    const outer = resolveCircle(...polar(D.ringR + D.thickness - 0.05, 300), R)
    assert.ok(radius(outer) >= D.ringR + D.thickness + R - 1e-6, `outer face: r = ${radius(outer)}`)
  })

  it('treats the free end of a curved wall as a flat cap', () => {
    const H = MUSEUM.descriptionWall
    // just beyond H's east end, on its centreline: pushed along the arc, away from the cap
    const [x, z] = polar(H.r, H.fromDeg - 1)
    const p = resolveCircle(x, z, R)
    assert.ok(pointDistance(collider('wall-h'), p.x, p.z) >= R - 1e-6)
    assert.ok(Math.abs(radius(p) - H.r) < 0.05, 'the push is tangential, not radial')
  })

  it('keeps visitors off the oculus plinth, even when dropped onto it', () => {
    assert.equal(collider('oculus-plinth').kind, 'circle')
    for (const r of [2.9, 1.0, 0]) {
      const p = resolveCircle(0.2 * Math.sign(r), r, R)
      assert.ok(radius(p) >= MUSEUM.oculus.rings[0] + R - 1e-6, `from r ${r}: r = ${radius(p)}`)
    }
  })

  it('does not move the visitor at the spawn point or at any zone spawn', () => {
    const s = MUSEUM.visitor.start
    const p = resolveCircle(s.x, s.z, R)
    assert.ok(Math.hypot(p.x - s.x, p.z - s.z) < 1e-9)
    for (const zn of ZONES) {
      const q = resolveCircle(zn.spawn.x, zn.spawn.z, R)
      assert.ok(Math.hypot(q.x - zn.spawn.x, q.z - zn.spawn.z) < 1e-9, `${zn.id} spawn is clear`)
    }
  })

  it('rotated footprints collide as oriented boxes (podiums)', () => {
    const slot = PODIUM_SLOTS.find((p) => p.id === 'pod-b-3')!
    const c = collider(`podium-${slot.id}`)
    assert.equal(c.kind, 'obb')
    // a point just inside the podium's corner along its own diagonal is inside; the same
    // distance along the world x axis from the centre may not be (rotation honoured)
    const half = PODIUM.size / 2
    assert.equal(pointDistance(c, slot.x, slot.z), 0)
    assert.ok(pointDistance(c, slot.x + half * 1.3 * Math.cos(slot.angleDeg * (Math.PI / 180)), slot.z + half * 1.3 * Math.sin(slot.angleDeg * (Math.PI / 180))) > 0)
  })
})

describe('line of sight across arcs', () => {
  it('the inner main wall F blocks the view from the entry corridor into the oculus court', () => {
    const [ax, az] = polar(7.0, 90)
    const [bx, bz] = polar(4.5, 90)
    assert.equal(segmentBlocked(ax, az, bx, bz), true)
  })

  it('a chord that stays between F and H is clear', () => {
    const [ax, az] = polar(7.0, 70)
    const [bx, bz] = polar(7.0, 100)
    assert.equal(segmentBlocked(ax, az, bx, bz), false)
  })

  it('a ray from the court to the ring wall between two podiums is clear', () => {
    const [ax, az] = polar(4.0, 9.5)
    const [bx, bz] = polar(D.ringR - 0.3, 9.5)
    assert.equal(segmentBlocked(ax, az, bx, bz), false)
  })

  it('the drum blocks a segment from inside to outside, but not one through the annex door', () => {
    assert.equal(segmentBlocked(...polar(6, 180), ...polar(13, 180)), true)
    assert.equal(segmentBlocked(0, 15, 0, 24), false)
  })

  it('ignores low colliders when asked (the plinth curb is below eye level)', () => {
    const plinth = collider('oculus-plinth')
    assert.equal(plinth.low, true)
    const [ax, az] = polar(4.5, 0)
    const [bx, bz] = polar(4.5, 180)
    assert.equal(segmentBlocked(ax, az, bx, bz), true)
    assert.equal(
      segmentBlocked(ax, az, bx, bz, (c) => !!c.low),
      false,
    )
  })
})

describe('zones', () => {
  const at = (r: number, aDeg: number) => zoneAt(...polar(r, aDeg))?.id
  it('resolves the sectors and polygons of the plan', () => {
    assert.equal(at(5, 0), 'ring-a')
    assert.equal(at(5, -60), 'ring-b')
    assert.equal(at(5, 235), 'ring-c')
    assert.equal(at(9.4, 190), 'hallway-d')
    assert.equal(at(7.0, 90), 'entry-e')
    assert.equal(at(9.4, 45), 'entry-e')
    assert.equal(at(9.4, 90), 'annex')
    assert.equal(zoneAt(0, 15)?.id, 'annex')
    assert.equal(at(4.5, 90), 'inner')
    assert.equal(zoneAt(MUSEUM.visitor.start.x, MUSEUM.visitor.start.z)?.id, 'entrance-court')
    assert.equal(at(13, 0), 'entrance-court')
    assert.equal(at(10, 300), 'entrance-court', 'outside the narrower gallery ring')
    assert.equal(zoneAt(40, 0), undefined)
  })

  it('every spawn lies in its own zone, inside its bounding rect', () => {
    for (const z of ZONES) {
      assert.equal(zoneAt(z.spawn.x, z.spawn.z)?.id, z.id, z.id)
      assert.ok(z.spawn.x >= z.rect.minX && z.spawn.x <= z.rect.maxX && z.spawn.z >= z.rect.minZ && z.spawn.z <= z.rect.maxZ)
    }
  })

  it('zone footprints do not overlap, and the building interior is fully covered', () => {
    for (let x = -15; x <= 15; x += 0.37) {
      for (let z = -15; z <= 29; z += 0.41) {
        const inside = ZONES.filter((zn) => zn.shape && shapeContains(zn.shape, x, z)).map((zn) => zn.id)
        assert.ok(inside.length <= 1, `(${x.toFixed(2)}, ${z.toFixed(2)}) in ${inside.join(' and ')}`)
        // anywhere a visitor can stand (clear of every collider) belongs to some zone
        if (z < MUSEUM.forecourt.endZ && COLLIDERS.every((c) => pointDistance(c, x, z) > R) && Math.hypot(x, z) < MUSEUM.landscape.r) {
          assert.equal(inside.length, 1, `(${x.toFixed(2)}, ${z.toFixed(2)}) has a zone`)
        }
      }
    }
  })
})

describe('display surfaces along walls', () => {
  const ids = Object.keys(SURFACES) as SurfaceId[]

  it('every surface is a straight run with a unit direction to the right of the viewer', () => {
    for (const id of ids) {
      const s = SURFACES[id]
      assert.equal(s.runAxis, 'along', id)
      assert.equal(s.range[0], 0)
      assert.ok(s.range[1] > 0.9, `${id} is long enough to hang on`)
      assert.ok(Math.abs(Math.hypot(...s.dir) - 1) < 1e-9)
      assert.ok(Math.abs(s.dir[0] - s.normal[1]) < 1e-9 && Math.abs(s.dir[1] + s.normal[0]) < 1e-9, `${id} dir = right of a viewer facing it`)
      assert.ok(WALLS.some((w) => w.id === s.wall), `${id} hangs on a wall`)
    }
  })

  it('surfacePoint walks from a along dir, standing off along the normal', () => {
    const s = SURFACES['h-description']
    const p0 = surfacePoint('h-description', 0, 1.6, 0.1)
    assert.ok(Math.abs(p0.position[0] - (s.a[0] + s.normal[0] * 0.1)) < 1e-9)
    assert.ok(Math.abs(p0.position[2] - (s.a[1] + s.normal[1] * 0.1)) < 1e-9)
    assert.equal(p0.position[1], 1.6)
    const L = s.range[1]
    const p1 = surfacePoint('h-description', L, 1.6)
    assert.ok(Math.abs(p1.position[0] - (s.a[0] + s.dir[0] * L)) < 1e-9)
    assert.ok(Math.abs(p1.position[2] - (s.a[1] + s.dir[1] * L)) < 1e-9)
    assert.ok(Math.abs(p1.rotationY - Math.atan2(s.normal[0], s.normal[1])) < 1e-12)
    // the title wall faces the entrance (+z)
    assert.ok(s.normal[1] > 0.99)
  })

  it('a flat frame hung anywhere on a surface never sinks into its (curved) wall', () => {
    for (const id of ids) {
      const s = SURFACES[id]
      const c = collider(s.wall)
      for (let i = 0; i <= 8; i++) {
        const p = surfacePoint(id, (s.range[1] * i) / 8, 1.6, MUSEUM.display.wallStandOff)
        const d = pointDistance(c, p.position[0], p.position[2])
        assert.ok(d > 0.001 && d < 0.25, `${id} @${i}/8: ${d.toFixed(4)} m off the wall`)
      }
    }
  })

  it('assigns each surface to the zone it faces into, and names the key surfaces', () => {
    assert.equal(SURFACES['h-description'].zone, 'annex')
    assert.equal(SURFACES['f-inner-main'].zone, 'inner')
    assert.equal(SURFACES['a-outer-1'].zone, 'ring-a')
    assert.equal(SURFACES['b-outer-2'].zone, 'ring-b')
    assert.equal(SURFACES['c-outer-1'].zone, 'ring-c')
    assert.equal(SURFACES['d-hallway-3'].zone, 'hallway-d')
    assert.equal(SURFACES['g-facade-east'].zone, 'entrance-court')
  })

  it('mounts accent lights on a rail or under the ceiling, in front of the surface', () => {
    for (const id of ids) {
      const s = SURFACES[id]
      const mid = s.range[1] / 2
      const m = mountFor(id, mid)
      const p = surfacePoint(id, mid, 0)
      const ahead = (m[0] - p.position[0]) * s.normal[0] + (m[2] - p.position[2]) * s.normal[1]
      assert.ok(ahead > 0.2, `${id}: light ${ahead.toFixed(2)} m in front of the wall`)
      assert.ok(m[1] <= MUSEUM.pavilion.ceilingHeight && m[1] > 3, `${id}: mount height ${m[1]}`)
    }
  })
})

describe('podium ring', () => {
  it('has the eleven drawn podiums, 3 / 5 / 3 through A → B → C', () => {
    assert.equal(PODIUM_SLOTS.length, 11)
    assert.deepEqual(
      PODIUM_SLOTS.map((p) => p.id),
      ['pod-a-1', 'pod-a-2', 'pod-a-3', 'pod-b-1', 'pod-b-2', 'pod-b-3', 'pod-b-4', 'pod-b-5', 'pod-c-1', 'pod-c-2', 'pod-c-3'],
    )
    assert.ok(Math.abs(PODIUM.size - 0.3048) < 1e-9 && Math.abs(PODIUM.height - 1.2192) < 1e-9)
  })

  it('stands on its ring, in its zone, evenly spaced and facing the court', () => {
    for (const p of PODIUM_SLOTS) {
      assert.ok(Math.abs(Math.hypot(p.x, p.z) - MUSEUM.podium.ringR) < 1e-9)
      assert.equal(zoneAt(p.x, p.z)?.id, p.zone, p.id)
      // local +z (front) points at the centre
      const fx = Math.sin(p.rotationY)
      const fz = Math.cos(p.rotationY)
      assert.ok(fx * -p.x + fz * -p.z > MUSEUM.podium.ringR * 0.999, `${p.id} faces the centre`)
    }
    for (let i = 1; i < PODIUM_SLOTS.length; i++) {
      const a = PODIUM_SLOTS[i - 1]
      const b = PODIUM_SLOTS[i]
      const gap = Math.hypot(a.x - b.x, a.z - b.z)
      if (a.zone === b.zone) assert.ok(gap > 1.3 && gap < 1.7, `${a.id} → ${b.id}: ${gap.toFixed(2)} m`)
      else assert.ok(gap > 1.7, `${a.id} → ${b.id} spans a fin`)
    }
  })

  it('leaves room to walk between podium and ring wall, and clears every wall', () => {
    const walls = COLLIDERS.filter((c) => WALLS.some((w) => w.id === c.id))
    for (const p of PODIUM_SLOTS) {
      for (const w of walls) assert.ok(pointDistance(w, p.x, p.z) > PODIUM.size, `${p.id} vs ${w.id}`)
      assert.ok(mountForPodium(p.id)[1] <= RAIL_Y)
    }
  })
})

describe('path planning', () => {
  it('every waypoint is clear of the walls', () => {
    for (const [x, z] of NAV_WAYPOINTS) {
      assert.ok(segmentClear(x, z, x, z, R), `waypoint (${x.toFixed(2)}, ${z.toFixed(2)})`)
    }
  })

  it('reaches every zone from the forecourt spawn', () => {
    const s = MUSEUM.visitor.start
    for (const zn of ZONES) {
      const path = planPath({ x: s.x, z: s.z }, { x: zn.spawn.x, z: zn.spawn.z })
      assert.ok(path && path.length > 0, `route to ${zn.id}`)
      // a sane length: never more than a lap of the site
      assert.ok(pathLength({ x: s.x, z: s.z }, path!) < 90, `${zn.id}: ${pathLength({ x: s.x, z: s.z }, path!).toFixed(1)} m`)
    }
  })

  it('walks round F rather than through it, and through the door rather than the wall', () => {
    const [fx, fz] = polar(4.6, 70)
    const from = { x: fx, z: fz } // oculus court, in front of F
    const path = planPath(from, { x: 0, z: 7.0 })! // corridor behind F
    assert.ok(path.length >= 2, 'needs at least one waypoint')
    let p = from
    for (const q of path) {
      assert.equal(segmentBlocked(p.x, p.z, q.x, q.z), false)
      p = q
    }
  })

  it('every podium and every hanging surface can be walked to', () => {
    const s = MUSEUM.visitor.start
    for (const p of PODIUM_SLOTS) {
      const [x, z] = polar(MUSEUM.podium.ringR - 1.2, p.angleDeg)
      assert.ok(planPath({ x: s.x, z: s.z }, { x, z }), p.id)
    }
    for (const id of Object.keys(SURFACES) as SurfaceId[]) {
      const sf = SURFACES[id]
      const q = surfacePoint(id, sf.range[1] / 2, 0, 1.3)
      assert.ok(planPath({ x: s.x, z: s.z }, { x: q.position[0], z: q.position[2] }), id)
    }
  })
})

describe('floor plan', () => {
  it('covers every zone, and draws walls and zones as closed SVG paths', () => {
    const b = FLOOR_PLAN.bounds
    for (const z of ZONES) assert.ok(z.rect.minX >= b.minX && z.rect.maxX <= b.maxX && z.rect.minZ >= b.minZ && z.rect.maxZ <= b.maxZ, z.id)
    assert.equal(FLOOR_PLAN.zones.length, ZONES.length)
    for (const p of [...FLOOR_PLAN.walls, ...FLOOR_PLAN.zones]) {
      assert.match(p.d, /^M[-\d.]+ [-\d.]+/, p.id)
      assert.match(p.d, /Z$/, p.id)
      assert.doesNotMatch(p.d, /NaN|Infinity/, p.id)
    }
    assert.ok(FLOOR_PLAN.walls.some((w) => w.id === 'drum-ring' && w.d.includes(' A')), 'arcs use SVG arc commands')
    assert.ok(!FLOOR_PLAN.walls.some((w) => w.kind === 'boundary'), 'the invisible site edge is not drawn')
  })
})
