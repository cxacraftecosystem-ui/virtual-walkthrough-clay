/**
 * The experience moments (SPECTACLE F1, F4, F30–F34; GRAND §8 P5): the three perches and their rides, the Clay
 * Passport's posts and state, the Frames of Clay standing points, the docent's moments and
 * the experience copy in all three languages.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { zoneAt } from '../../src/museum/config/layout'
import { MUSEUM } from '../../src/museum/config/museum'
import { SCENE_OBJECTS } from '../../src/museum/config/objects'
import { EAST_STAIR, SKY_RIM, SPHERE_WELL } from '../../src/museum/config/satellites'
import { resolveCircle } from '../../src/museum/navigation/collision'
import {
  ARRIVAL_T,
  DUPLEX_PATH,
  PERCH_DOOR,
  PERCH_DOORS,
  PERCH_IDS,
  PERCH_PATHS,
  RIDE_MAX_SECONDS,
  RIDE_MIN_SECONDS,
  RIM_ARRIVAL_T,
  SKY_RIM_PATH,
  SPHERE_WELL_PATH,
  advance,
  doorNear,
  doorOf,
  normT,
  pathLength,
  pathPoint,
  pathY,
  perchView,
  projectOnPath,
  rideMidpoint,
  ridePose,
  rideSeconds,
  rimArrivalView,
} from '../../src/museum/navigation/perch'
import { planPath } from '../../src/museum/tour/pathing'
import { DOCENT_MOMENTS, MOMENTS } from '../../src/museum/spectacle/momentList'
import { isXKey, untranslated, xtIn } from '../../src/museum/spectacle/experienceText'
import { STAMPS, addZoneTime, awardStamp, parseRequires, pressStamp, requirementMet, stampCount, usePassport } from '../../src/museum/trail/passport'
import { STAMP_MOTIFS } from '../../src/museum/trail/stampMotifs'

const R = MUSEUM.visitor.collisionRadius
const EYE = MUSEUM.visitor.eyeHeight
const SPAWN = { x: MUSEUM.visitor.start.x, z: MUSEUM.visitor.start.z }
const clear = (x: number, z: number) => {
  const q = resolveCircle(x, z, R)
  return Math.hypot(q.x - x, q.z - z) < 1e-6
}
const [TCX, TCZ] = [PERCH_DOOR.cx, PERCH_DOOR.cz]

describe('perch: the Sky Rim path', () => {
  it('is a ring of radius SKY_RIM.r round the oculus at roof height', () => {
    assert.equal(SKY_RIM_PATH.y, SKY_RIM.y)
    for (let t = 0; t < 1; t += 0.05) {
      const q = pathPoint(SKY_RIM_PATH, t)
      assert.ok(Math.abs(Math.hypot(q.x, q.z) - SKY_RIM.r) < 1e-9)
      assert.ok(Math.abs(Math.hypot(q.tx, q.tz) - 1) < 1e-9, 'unit tangent')
      assert.ok(Math.abs(q.x * q.tx + q.z * q.tz) < 1e-9, 'tangent ⟂ radius')
    }
    assert.ok(Math.abs(pathLength(SKY_RIM_PATH) - 2 * Math.PI * SKY_RIM.r) < 1e-9)
  })

  it('projects points back onto itself, wraps round and keeps the eye 20 m above the pool', () => {
    for (const t of [0, 0.13, 0.5, 0.77, 0.999]) {
      const q = pathPoint(SKY_RIM_PATH, t)
      const pr = projectOnPath(SKY_RIM_PATH, q.x * 1.05, q.z * 1.05)
      assert.ok(Math.abs(normT(SKY_RIM_PATH, pr.t - t + 0.5) - 0.5) < 1e-9)
    }
    assert.ok(Math.abs(advance(SKY_RIM_PATH, 0.99, pathLength(SKY_RIM_PATH) * 0.02) - 0.01) < 1e-9)
    assert.ok(Math.abs(SKY_RIM_PATH.y + EYE - 22.62) < 1e-9)
    assert.ok(SKY_RIM_PATH.y + EYE - MUSEUM.oculus.curbHeight > 20, 'the eye stands 20 m above the lotus')
  })

  it('arrives facing the oculus and looking down into the court', () => {
    const q = pathPoint(SKY_RIM_PATH, RIM_ARRIVAL_T)
    const v = rimArrivalView(RIM_ARRIVAL_T)
    assert.ok(v.pitchDeg < -25)
    const fx = Math.sin((v.yawDeg * Math.PI) / 180)
    const fz = -Math.cos((v.yawDeg * Math.PI) / 180)
    assert.ok(fx * -q.x + fz * -q.z > 0.99 * SKY_RIM.r)
  })
})

describe('perch: the balcony and the Sphere Well', () => {
  it('rides the balcony at half the drum’s height, between the balcony’s edges, over A, B and C', () => {
    assert.equal(DUPLEX_PATH.y, MUSEUM.pavilion.mezzanineBand)
    const r = Math.hypot(pathPoint(DUPLEX_PATH, 0.5).x, pathPoint(DUPLEX_PATH, 0.5).z)
    assert.ok(r > MUSEUM.balcony.r0 && r < MUSEUM.balcony.r1)
    // the whole arc 35° → 224° lies over the galleries' ring, walking order (decreasing angle)
    assert.ok(Math.abs(pathLength(DUPLEX_PATH) - ((MUSEUM.balcony.toDeg - MUSEUM.balcony.fromDeg) * Math.PI * r) / 180) < 1e-6)
    assert.ok((DUPLEX_PATH.toDeg ?? 0) < (DUPLEX_PATH.fromDeg ?? 0))
  })

  it('winds the well’s spiral down to its floor, the eye under the lowest terrace at the top', () => {
    assert.equal(SPHERE_WELL_PATH.kind, 'helix')
    assert.ok(Math.abs(pathY(SPHERE_WELL_PATH, 1) - SPHERE_WELL.floorY) < 1e-9)
    assert.ok(pathY(SPHERE_WELL_PATH, 0) + EYE < SPHERE_WELL.terraceTopY, 'the eye clears the lowest terrace')
    for (let t = 0; t <= 1; t += 0.05) {
      const q = pathPoint(SPHERE_WELL_PATH, t)
      const d = Math.hypot(q.x - SPHERE_WELL.cx, q.z - SPHERE_WELL.cz)
      assert.ok(d > SPHERE_WELL.sphereR + 1 && d < SPHERE_WELL.roomR, `on the treads at t = ${t.toFixed(2)}`)
    }
    assert.ok(perchView(SPHERE_WELL_PATH, 1).pitchDeg > 25, 'looks up at the sphere and the stepped oculus')
  })
})

describe('perch: the doors and the rides', () => {
  const doors = [
    { d: PERCH_DOORS['east-stair'], zone: 'entry-e' },
    { d: PERCH_DOORS['sphere-well'], zone: 'entrance-court' },
  ]
  it('puts each door’s standing point clear of every collider, in its zone, walkable from the spawn', () => {
    assert.ok(Math.abs(Math.hypot(PERCH_DOOR.face[0] - TCX, PERCH_DOOR.face[1] - TCZ) - EAST_STAIR.width / 2) < 1e-9)
    for (const { d, zone } of doors) {
      assert.ok(clear(d.stand[0], d.stand[1]), `${d.id}: standing point is clear`)
      assert.equal(zoneAt(d.stand[0], d.stand[1])?.id, zone, `${d.id}: zone`)
      assert.ok(planPath(SPAWN, { x: d.stand[0], z: d.stand[1] }), `${d.id}: walkable from the spawn`)
      assert.equal(doorNear(d.stand[0], d.stand[1])?.id, d.id)
    }
    assert.deepEqual(doorOf('duplex').id, 'east-stair')
    assert.deepEqual(doorOf('sky-rim').id, 'east-stair')
    assert.deepEqual(doorOf('sphere-well').id, 'sphere-well')
    assert.equal(doorNear(SPAWN.x, SPAWN.z), null)
  })

  for (const id of PERCH_IDS) {
    it(`rides from the door at eye height to ${id} without a jump, and never above the rim`, () => {
      const path = PERCH_PATHS[id]
      const t = ARRIVAL_T[id]
      const D = doorOf(id)
      const p0 = ridePose(0, t, path)
      assert.ok(Math.hypot(p0.x - D.stand[0], p0.z - D.stand[1]) < 1e-9)
      assert.ok(Math.abs(p0.y - EYE) < 1e-9)
      const p1 = ridePose(1, t, path)
      const end = pathPoint(path, t)
      assert.ok(Math.hypot(p1.x - end.x, p1.z - end.z) < 1e-6)
      assert.ok(Math.abs(p1.y - (pathY(path, t) + EYE)) < 1e-9)
      let prev = p0
      for (let i = 1; i <= 600; i++) {
        const p = ridePose(i / 600, t, path)
        const step = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)
        assert.ok(step < 0.35, `continuous at u = ${i / 600} (step ${step.toFixed(3)} m)`)
        assert.ok(p.y <= SKY_RIM.y + EYE + 1e-9)
        prev = p
      }
      const s = rideSeconds(path, t)
      assert.ok(s >= RIDE_MIN_SECONDS && s <= RIDE_MAX_SECONDS)
      const mid = rideMidpoint(path, t)
      assert.ok(Number.isFinite(mid.x + mid.y + mid.z))
    })
  }
})

describe('Clay Passport', () => {
  const posts = SCENE_OBJECTS.filter((o) => o.kind === 'stamp-post')

  it('has one post for every stamp earned at a post, in the stamp\'s room', () => {
    for (const s of STAMPS.filter((d) => d.how === 'post')) {
      const mine = posts.filter((o) => o.props?.stamp === s.id)
      assert.equal(mine.length, 1, `one post for ${s.id}`)
      const o = mine[0]
      assert.equal(o.zone, s.zone, `${s.id} post zone`)
      assert.equal(zoneAt(o.position[0], o.position[2])?.id, s.zone, `${s.id} post stands in its zone`)
      assert.ok(String(o.props?.motif) in STAMP_MOTIFS, `${s.id} motif`)
    }
    assert.equal(posts.length, STAMPS.filter((d) => d.how === 'post').length)
  })

  it('lets a visitor walk up to every post from the spawn and stand in front of it', () => {
    for (const o of posts) {
      const rot = ((o.rotationDeg ?? 0) * Math.PI) / 180
      const x = o.position[0] + Math.sin(rot) * 0.75
      const z = o.position[2] + Math.cos(rot) * 0.75
      assert.ok(clear(x, z), `${o.id}: the front is clear`)
      assert.ok(planPath(SPAWN, { x, z }), `${o.id}: reachable`)
    }
  })

  it('reads the theatre post\'s requirement, and stamps once', () => {
    assert.deepEqual(parseRequires('dwell:theatre:60'), { zone: 'theatre', seconds: 60 })
    assert.equal(parseRequires(''), null)
    assert.equal(parseRequires('nonsense'), null)
    assert.equal(requirementMet('dwell:theatre:60'), false)
    assert.equal(pressStamp('theatre', 'stamp-theatre', 'dwell:theatre:60'), 'locked')
    addZoneTime('theatre', 61)
    assert.equal(requirementMet('dwell:theatre:60'), true)
    assert.equal(pressStamp('theatre', 'stamp-theatre', 'dwell:theatre:60'), 'stamped')
    assert.equal(pressStamp('theatre', 'stamp-theatre', 'dwell:theatre:60'), 'already')
    assert.equal(pressStamp('not-a-stamp'), null)
  })

  it('completes when every stamp is in', () => {
    usePassport.getState().reset()
    for (const s of STAMPS) awardStamp(s.id)
    const st = usePassport.getState()
    assert.equal(stampCount(st), STAMPS.length)
    assert.ok(st.completedAt)
    assert.equal(st.celebrate, true)
    st.reset()
    assert.equal(stampCount(usePassport.getState()), 0)
  })
})

describe('Frames of Clay', () => {
  const frames = SCENE_OBJECTS.filter((o) => o.kind === 'photo-spot')
  it('lists the eleven presets, each a clear standing point in its zone, reachable from the spawn', () => {
    assert.equal(frames.length, 11)
    for (const f of frames) {
      const [x, , z] = f.position
      assert.ok(clear(x, z), `${f.id} is clear`)
      assert.equal(zoneAt(x, z)?.id, f.zone, `${f.id} zone`)
      assert.ok(planPath(SPAWN, { x, z }), `${f.id} reachable`)
      const fov = Number(f.props?.fov)
      assert.ok(fov >= 20 && fov <= 90, `${f.id} fov`)
      assert.ok(Math.abs(Number(f.props?.pitchDeg)) <= MUSEUM.visitor.pitchLimitDeg, `${f.id} pitch is one a visitor can hold`)
    }
  })
})

describe('experience copy and moments', () => {
  it('translates every experience string into Hindi and Bengali', () => {
    assert.deepEqual(untranslated('hi'), [])
    assert.deepEqual(untranslated('bn'), [])
    assert.equal(xtIn('en', 'xp.passportCount', { n: 3, total: 13 }), '3 of 13 stamps')
  })

  it('names every moment a visitor can replay and every docent moment', () => {
    for (const m of MOMENTS) assert.ok(isXKey(`xp.moment.${m.id}`), `name for ${m.id}`)
    for (const id of DOCENT_MOMENTS) assert.ok(isXKey(`xp.moment.${id}`), `name for ${id}`)
    for (const s of STAMPS) assert.ok(isXKey(`xp.stamp.${s.id}`), `name for stamp ${s.id}`)
  })
})

