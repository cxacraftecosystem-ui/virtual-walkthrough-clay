/**
 * Light, sky and atmosphere (SPECTACLE F9, F15, F28, §3): the day curve built on the solar model,
 * the named moments, the festival window, the diya placements and their thinning, and the
 * monsoon's envelopes.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DIYA_SETS, DIYAS, EVENING_SETS, PATH, standingDiyas, thinDiyas } from '../../src/museum/config/diyas'
import { KEY, MUSEUM } from '../../src/museum/config/museum'
import { QUALITY_ORDER, QUALITY_PRESETS } from '../../src/museum/config/quality'
import { bucketOf, clockLabel, dayCurve, inWindow, istDay, istHoursNow, istMonthDay, presetHours, solarNoonHours, sunAt, sunriseSunset } from '../../src/museum/lighting/atmosphere/dayCurve'
import { stepWeather, useWeather, weatherNow } from '../../src/museum/lighting/weather/weatherState'
import { COLLIDERS, pointDistance } from '../../src/museum/navigation/collision'

const DAYS = [new Date(Date.UTC(2026, 2, 20)), new Date(Date.UTC(2026, 5, 21)), new Date(Date.UTC(2026, 9, 31)), new Date(Date.UTC(2026, 11, 21))]

describe('day curve', () => {
  it('puts each named moment where it belongs, every season', () => {
    for (const d of DAYS) {
      const el = (p: Parameters<typeof presetHours>[1]) => sunAt(d, presetHours(d, p)).elevationDeg
      assert.ok(Math.abs(el('morning') - 22) < 0.05, `morning ${el('morning')}`)
      assert.ok(Math.abs(el('golden') - 7) < 0.05, `golden ${el('golden')}`)
      assert.ok(Math.abs(el('dusk') + 3.5) < 0.05, `dusk ${el('dusk')}`)
      assert.ok(el('night') < -30, `night ${el('night')}`)
      // solar noon: the sun due south (Kharagpur is north of the tropic all year but midsummer's)
      const noon = sunAt(d, solarNoonHours(d))
      assert.ok(Math.abs(noon.azimuthDeg - 180) < 0.5 || Math.abs(noon.azimuthDeg) < 0.5 || Math.abs(noon.azimuthDeg - 360) < 0.5, `noon az ${noon.azimuthDeg}`)
      for (const p of ['morning', 'midday', 'golden', 'dusk', 'night'] as const) assert.equal(bucketOf(d, presetHours(d, p)), p, `${p} on ${d.toISOString()}`)
    }
  })

  it('knows sunrise and sunset at Kharagpur (≈ 5:43 / 17:05 IST at the end of October)', () => {
    const { rise, set } = sunriseSunset(new Date(Date.UTC(2026, 9, 31)))
    assert.ok(Math.abs(rise - (5 + 43 / 60)) < 0.12, clockLabel(rise))
    assert.ok(Math.abs(set - (17 + 5 / 60)) < 0.12, clockLabel(set))
  })

  it('never jumps: light, sky and ambience are continuous through the day and the night', () => {
    const d = DAYS[2]
    let prev = dayCurve(sunAt(d, 0).elevationDeg, sunAt(d, 0).azimuthDeg)
    for (let i = 1; i <= 24 * 60; i++) {
      const s = sunAt(d, i / 60)
      const c = dayCurve(s.elevationDeg, s.azimuthDeg)
      // a minute moves the sun a quarter of a degree: nothing may leap
      assert.ok(Math.abs(c.intensity - prev.intensity) < 0.12, `intensity at ${clockLabel(i / 60)}`)
      for (const k of ['night', 'twilight', 'exposure', 'daylight', 'shaft', 'sunset'] as const) assert.ok(Math.abs(c[k] - prev[k]) < 0.06, `${k} at ${clockLabel(i / 60)}`)
      // where the light swaps from the sun to the moon it is off
      if (c.lightAzimuthDeg !== prev.lightAzimuthDeg && Math.abs(c.lightAzimuthDeg - prev.lightAzimuthDeg) > 5) assert.ok(c.intensity < 0.06 && prev.intensity < 0.06, `swap at ${clockLabel(i / 60)}`)
      prev = c
    }
  })

  it('keeps the shaft for a real sunbeam and turns it to moonlight after dark', () => {
    assert.equal(dayCurve(-1, 250).shaft, 0)
    assert.ok(dayCurve(2, 250).shaft > 0 && dayCurve(2, 250).shaft < 0.5)
    assert.ok(dayCurve(50, 180).shaft > 0.95)
    assert.ok(Math.abs(dayCurve(-20, 300).moonShaft - 0.25) < 1e-9)
  })

  it('reads the clock and the calendar in IST', () => {
    const t = new Date(Date.UTC(2026, 10, 1, 20, 0)) // 01:30 IST on 2 Nov
    assert.ok(Math.abs(istHoursNow(t) - 1.5) < 1e-9)
    assert.equal(istMonthDay(t), '11-02')
    assert.equal(istDay(t).toISOString(), '2026-11-02T00:00:00.000Z')
    assert.equal(clockLabel(17.999), '18:00')
  })

  it('opens the festival window inclusively, across the new year too', () => {
    assert.ok(inWindow('11-01', '11-01', '11-15'))
    assert.ok(inWindow('11-15', '11-01', '11-15'))
    assert.ok(!inWindow('10-31', '11-01', '11-15'))
    assert.ok(inWindow('01-02', '12-20', '01-05'))
    assert.ok(!inWindow('02-01', '12-20', '01-05'))
    assert.ok(!inWindow('bad', '11-01', '11-15'))
  })
})

describe('diya night', () => {
  it('places every set, about 800 lamps in all (GRAND §6.2 #8)', () => {
    for (const s of DIYA_SETS) assert.ok(DIYAS.some((d) => d.set === s), `set ${s}`)
    assert.ok(DIYAS.length >= 800 && DIYAS.length <= 1000, `${DIYAS.length} lamps`)
  })

  it('lights the spiral from the water ring outward', () => {
    const first = (s: string) => Math.min(...DIYAS.filter((d) => d.set === s).map((d) => d.seq))
    for (let i = 1; i < DIYA_SETS.length; i++) assert.ok(first(DIYA_SETS[i]) >= first(DIYA_SETS[i - 1]), `${DIYA_SETS[i]} after ${DIYA_SETS[i - 1]}`)
    for (const d of DIYAS) assert.ok(d.seq >= 0 && d.seq <= 1)
  })

  it('keeps the threshold lines of F2: x ±1.1, every 0.9 m from the sill outward', () => {
    const path = DIYAS.filter((d) => d.set === 'path')
    assert.ok(path.every((d) => Math.abs(Math.abs(d.x) - 1.1) < 1e-9))
    const zs = [...new Set(path.map((d) => d.z.toFixed(3)))].map(Number).sort((a, b) => a - b)
    assert.ok(Math.abs(zs[0] - PATH.z0) < 1e-6 && zs[zs.length - 1] <= PATH.z1 + 1e-6)
    assert.ok(zs[0] > KEY.annexOuterZ && PATH.z1 < MUSEUM.forecourt.endZ, 'from the sill to the forecourt’s far edge')
    for (let i = 1; i < zs.length; i++) assert.ok(Math.abs(zs[i] - zs[i - 1] - 0.9) < 1e-6)
  })

  it('stands every floor lamp on the plinth disc or the forecourt, clear of walls and furniture', () => {
    const walls = COLLIDERS.filter((c) => !c.low && !c.id.startsWith('bench') && !c.id.startsWith('table-'))
    const blocked = (x: number, z: number) => COLLIDERS.some((c) => pointDistance(c, x, z) < 0.05)
    const standing = standingDiyas(DIYAS, blocked)
    // furniture takes only a few of the lamps; the walls none
    assert.ok(standing.length >= DIYAS.length * 0.9, `${DIYAS.length - standing.length} lamps lost to furniture`)
    for (const d of DIYAS) for (const c of walls.filter((w) => !w.id.startsWith('object-'))) if (d.set !== 'pool' && d.set !== 'curb') assert.ok(pointDistance(c, d.x, d.z) >= 0.05, `${d.set} lamp at (${d.x.toFixed(2)}, ${d.z.toFixed(2)}) in ${c.id}`)
    for (const d of standing) {
      const r = Math.hypot(d.x, d.z)
      const forecourt = Math.abs(d.x) <= MUSEUM.forecourt.halfWidth && d.z <= MUSEUM.forecourt.endZ
      assert.ok(r <= MUSEUM.landscape.r || forecourt, `${d.set} lamp off the site at (${d.x.toFixed(2)}, ${d.z.toFixed(2)})`)
      if (d.set === 'pool' || d.set === 'curb') continue // on the water and the curb, inside the plinth's collider
      for (const c of walls) assert.ok(pointDistance(c, d.x, d.z) >= 0.05, `${d.set} lamp at (${d.x.toFixed(2)}, ${d.z.toFixed(2)}) in ${c.id}`)
    }
  })

  it('thins to every tier cap, keeping every chosen set and the path whole', () => {
    for (const tier of QUALITY_ORDER) {
      const cap = QUALITY_PRESETS[tier].spectacle.diyas
      const all = thinDiyas(DIYAS, DIYA_SETS, cap)
      assert.ok(all.length <= cap, `${tier}: ${all.length} > ${cap}`)
      for (const s of DIYA_SETS) assert.ok(all.some((d) => d.set === s), `${tier} keeps ${s}`)
      assert.equal(all.filter((d) => d.set === 'path').length, DIYAS.filter((d) => d.set === 'path').length)
      const eve = thinDiyas(DIYAS, EVENING_SETS, cap)
      assert.ok(eve.every((d) => EVENING_SETS.includes(d.set)))
    }
  })
})

describe('monsoon', () => {
  it('eases the rain in and out, lets the floors dry slowly, and passes by itself', () => {
    const w = useWeather.getState()
    w.setWeather('monsoon')
    let t = 0
    while (t < 20) {
      stepWeather(0.1, 90, false)
      t += 0.1
    }
    assert.ok(weatherNow.rain > 0.99, `rain ${weatherNow.rain}`)
    assert.ok(weatherNow.overcast > 0.99)
    // the monsoon clears after monsoonSec
    while (t < 95) {
      stepWeather(0.1, 90, false)
      t += 0.1
    }
    assert.equal(useWeather.getState().weather, 'clear')
    while (t < 110) {
      stepWeather(0.1, 90, false)
      t += 0.1
    }
    assert.equal(weatherNow.rain, 0)
    assert.ok(weatherNow.wet > 0 && weatherNow.wet < 1, `wet ${weatherNow.wet}`)
  })

  it('brightens at most once every 20 s, for 1.5 s, and never in the Still form', () => {
    for (const still of [false, true]) {
      useWeather.getState().setWeather('monsoon')
      weatherNow.rain = 1
      weatherNow.overcast = 1
      weatherNow.nextFlash = 0
      weatherNow.flashT = -1
      const starts: number[] = []
      let lit = 0
      let was = 0
      for (let i = 0; i < 1200; i++) {
        stepWeather(0.05, 0, still)
        if (weatherNow.flash > 0 && was === 0) starts.push(i * 0.05)
        if (weatherNow.flash > 0) lit++
        was = weatherNow.flash
      }
      if (still) assert.equal(starts.length, 0)
      else {
        assert.ok(starts.length >= 1)
        for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 20, `gap ${starts[i] - starts[i - 1]}`)
        assert.ok((lit * 0.05) / starts.length <= 1.55, 'each brightening lasts 1.5 s')
      }
    }
    useWeather.getState().setWeather('clear')
  })
})
