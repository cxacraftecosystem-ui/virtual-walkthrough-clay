/**
 * GRAND §6.2 light, atmosphere and sound at the new scale (P4): the accent field, the fixtures'
 * mounts, the room light table, the festival lamps and the track rails. Pure data only.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ACCENT_CAPS, ACCENT_MAX, ACCENTS, BEAM_MAX, BEAM_MIN, bNicheAngles } from '../../src/museum/config/accents'
import { DIYA_CAPS, DIYA_SETS, DIYAS, standingDiyas, thinDiyas } from '../../src/museum/config/diyas'
import { PODIUM_SLOTS, ZONES } from '../../src/museum/config/layout'
import { ZONE_LIGHT } from '../../src/museum/config/lighting'
import { KEY, MUSEUM } from '../../src/museum/config/museum'
import { QUALITY_ORDER } from '../../src/museum/config/quality'
import { SPHERE_WELL } from '../../src/museum/config/satellites'
import { BALCONY_RAIL_Y, isSconceMount, mountForPodium, RAILS, railAbove } from '../../src/museum/lighting/tracks'
import { COLLIDERS, pointDistance } from '../../src/museum/navigation/collision'

describe('accent field', () => {
  it('caps the cones per tier at 8 / 12 / 16 / 24', () => {
    assert.deepEqual(ACCENT_CAPS, { low: 8, medium: 12, high: 16, ultra: 24 })
    assert.equal(ACCENT_MAX, 24)
  })

  it('lights every podium from its brass wall sconce, and every B niche', () => {
    for (const p of PODIUM_SLOTS) {
      const a = ACCENTS.find((x) => x.id === `podium-${p.id}`)
      assert.ok(a, p.id)
      assert.equal(a.fixture, 'sconce')
      assert.ok(Math.abs(Math.hypot(a.pos[0], a.pos[2]) - KEY.ringR) < 0.3, `${p.id} sconce on the ring wall`)
      assert.ok(a.pos[1] > MUSEUM.podium.height + 1 && a.pos[1] < MUSEUM.pavilion.mezzanineBand - MUSEUM.balcony.slab)
    }
    assert.equal(ACCENTS.filter((a) => a.id.startsWith('b-niche-')).length, bNicheAngles().length)
  })

  it('keeps every beam between 12° and 24°, aimed down at its piece', () => {
    for (const a of ACCENTS) {
      assert.ok(a.beamDeg >= BEAM_MIN && a.beamDeg <= BEAM_MAX, `${a.id}: ${a.beamDeg}°`)
      assert.ok(a.pos[1] > a.target[1], `${a.id} lights from above`)
      assert.ok(a.intensity > 0 && a.weight > 0)
    }
  })

  it('hangs every visible fixture from a ceiling, a soffit or a ledge — never in the open air of the dome', () => {
    for (const a of ACCENTS) {
      if (a.fixture === 'concealed' || a.fixture === 'sconce') continue
      assert.ok(a.stemTo !== undefined && a.stemTo >= a.pos[1], `${a.id} has a stem up to its support`)
      const top = a.stemTo!
      const supports = [MUSEUM.pavilion.mezzanineBand - MUSEUM.balcony.slab, MUSEUM.balcony.fascia.y0, MUSEUM.dome.springY, MUSEUM.pavilion.ceilingHeight, SPHERE_WELL.terraceTopY, 6.0, 6.5]
      assert.ok(supports.some((y) => Math.abs(y - top) < 1e-6), `${a.id}: stem to ${top}`)
    }
  })
})

describe('the rooms’ light (GRAND §6.2 #2)', () => {
  it('gives every zone a colour temperature and an exposure', () => {
    for (const z of ZONES) assert.ok(ZONE_LIGHT[z.id], z.id)
  })

  it('makes the grounds dark and the rooms different: warm A, neutral B, cool C, a dim Wine Hall', () => {
    const L = ZONE_LIGHT
    assert.equal(L['ring-a'].colorK, 3000)
    assert.equal(L['ring-b'].colorK, 4000)
    assert.equal(L['ring-c'].colorK, 4300)
    assert.ok(L.inner.colorK >= 5000 && L.inner.colorK <= 5600)
    // the Wine Hall reads well under 0.6 of the court's light
    assert.ok((L['hallway-d'].exposure * L['hallway-d'].fill) / (L.inner.exposure * L.inner.fill) < 0.6)
    assert.ok(L.theatre.exposure < L['hallway-d'].exposure)
    // the atlas stays neutral for the map and the partner logos
    assert.equal(L.atlas.colorK, 4000)
  })
})

describe('Diya Night (GRAND §6.2 #8)', () => {
  it('lights 200 / 400 / 800 lamps by tier, every set kept', () => {
    assert.deepEqual(DIYA_CAPS, { low: 200, medium: 400, high: 800, ultra: 800 })
    const standing = standingDiyas(DIYAS, (x, z) => COLLIDERS.some((c) => pointDistance(c, x, z) < 0.05))
    assert.ok(standing.length >= 800, `${standing.length} standing lamps`)
    for (const tier of QUALITY_ORDER) {
      const lit = thinDiyas(standing, DIYA_SETS, DIYA_CAPS[tier])
      assert.ok(lit.length <= DIYA_CAPS[tier] && lit.length >= DIYA_CAPS[tier] * 0.95, `${tier}: ${lit.length}`)
      for (const s of DIYA_SETS) assert.ok(lit.some((d) => d.set === s), `${tier} keeps ${s}`)
    }
  })

  it('rings the Sphere Well outside its balustrade and lines the forecourt', () => {
    const well = DIYAS.filter((d) => d.set === 'well')
    assert.ok(well.length >= 40)
    for (const d of well) assert.ok(Math.hypot(d.x - SPHERE_WELL.cx, d.z - SPHERE_WELL.cz) > SPHERE_WELL.rimR + 0.3)
    const fc = DIYAS.filter((d) => d.set === 'forecourt')
    assert.ok(fc.length >= 30 && fc.every((d) => Math.abs(d.x) < MUSEUM.forecourt.halfWidth && d.z > KEY.annexOuterZ))
  })
})

describe('track rails (GRAND §6.2 #4)', () => {
  it('hangs the gallery rail under the balcony soffit and leaves the dome without rails', () => {
    const ring = RAILS.find((r) => r.id === 'rail-ring')
    assert.ok(ring && ring.kind === 'arc' && Math.abs(ring.y - BALCONY_RAIL_Y) < 1e-9)
    assert.ok(ring.r > MUSEUM.balcony.r0 && ring.r < MUSEUM.balcony.r1)
    assert.ok(!RAILS.some((r) => r.id === 'rail-oculus'))
  })

  it('takes each podium light from its sconce, and every head’s stem up to its rail', () => {
    for (const p of PODIUM_SLOTS) assert.ok(isSconceMount(mountForPodium(p.id)))
    const ring = RAILS.find((r) => r.id === 'rail-ring')!
    if (ring.kind !== 'arc') throw new Error('arc')
    const a = (ring.a0 + ring.a1) / 2
    const [x, z] = [ring.r * Math.cos(a), ring.r * Math.sin(a)]
    assert.ok(Math.abs(railAbove(x, z, ring.y - 0.1) - ring.y) < 1e-9)
  })
})
