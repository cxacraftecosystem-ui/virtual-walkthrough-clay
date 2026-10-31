/**
 * The "Shape it yourself" studio's pot engine (src/museum/studio/potEngine.ts): an op list
 * reduces to one pot, the same every time; every op is clamped to a pot that can be thrown;
 * stored lists are validated; the lathe outline is closed and never crosses the axis.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyOp,
  bandRepeats,
  BASE_R,
  changes,
  MAX_BANDS,
  MAX_H,
  MAX_OPS,
  MAX_R,
  MIN_GAP,
  MIN_H,
  MIN_R,
  normalise,
  parseOps,
  potHeight,
  potSection,
  profileCurve,
  pushOp,
  radiusAt,
  reducePot,
  stampCount,
  START,
  TRIM_CM,
  type PotOp,
  type PotState,
} from '../../src/museum/studio/potEngine'

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`)

/** Profile constraints every reduced pot must satisfy. */
function assertTurnable(s: PotState) {
  const p = s.points
  assert.equal(p.length, START.points.length)
  assert.equal(p[0].y, 0)
  assert.ok(p[0].r >= BASE_R[0] && p[0].r <= BASE_R[1], `base r ${p[0].r}`)
  for (let i = 1; i < p.length; i++) {
    assert.ok(p[i].y - p[i - 1].y >= MIN_GAP - 1e-9, `rise at ${i}`)
    assert.ok(p[i].r >= MIN_R && p[i].r <= MAX_R, `r at ${i}`)
  }
  assert.ok(potHeight(s) <= MAX_H)
}

describe('reducePot', () => {
  it('starts from the plain lump with no ops', () => {
    assert.deepEqual(reducePot([]), START)
    assertTurnable(START)
  })

  it('is deterministic: the same ops give the same pot', () => {
    const ops: PotOp[] = [
      { t: 'pull' },
      { t: 'widen', at: 0.4 },
      { t: 'narrow', at: 0.85 },
      { t: 'set', i: 3, r: 9.1, y: 15 },
      { t: 'trim' },
      { t: 'foot' },
      { t: 'body', id: 'black' },
      { t: 'slip', id: 'white' },
      { t: 'burnish', on: true },
      { t: 'band', motif: 'zigzag', tech: 'sgraffito', at: 0.6 },
      { t: 'band', motif: 'dots', tech: 'stamp', at: 0.3 },
      { t: 'fire' },
    ]
    const a = reducePot(ops)
    const b = reducePot(JSON.parse(JSON.stringify(ops)) as PotOp[])
    assert.deepEqual(a, b)
    assert.equal(JSON.stringify(a), JSON.stringify(b))
    assertTurnable(a)
    assert.equal(a.body, 'black')
    assert.equal(a.slip, 'white')
    assert.equal(a.burnish, true)
    assert.equal(a.foot, true)
    assert.equal(a.trims, 1)
    assert.equal(a.bands.length, 2)
    assert.equal(a.fired, true)
  })

  it('never mutates the state it is given', () => {
    const frozen = JSON.stringify(START)
    reducePot([{ t: 'pull' }, { t: 'set', i: 0, r: 10, y: 5 }, { t: 'band', motif: 'leaf', tech: 'stamp', at: 0.5 }])
    assert.equal(JSON.stringify(START), frozen)
  })

  it('clamps a dragged point into a turnable profile', () => {
    const s = reducePot([
      { t: 'set', i: 0, r: 99, y: 12 },
      { t: 'set', i: 2, r: -5, y: -10 },
      { t: 'set', i: 5, r: 50, y: 500 },
    ])
    assertTurnable(s)
    assert.equal(s.points[0].r, BASE_R[1])
    assert.equal(s.points[0].y, 0)
    assert.equal(s.points[2].r, MIN_R)
    near(s.points[2].y, s.points[1].y + MIN_GAP)
    assert.equal(s.points[5].r, MAX_R)
    assert.equal(s.points[5].y, MAX_H)
  })

  it('ignores ops that are malformed or would change nothing', () => {
    assert.equal(applyOp(START, { t: 'set', i: 9, r: 5, y: 5 }), START)
    assert.equal(applyOp(START, { t: 'set', i: 1.5, r: 5, y: 5 }), START)
    assert.equal(applyOp(START, { t: 'set', i: 1, r: NaN, y: 5 }), START)
    assert.equal(applyOp(START, { t: 'body', id: START.body }), START)
    assert.equal(applyOp(START, { t: 'slip', id: null }), START)
    assert.equal(applyOp(START, { t: 'burnish', on: false }), START)
    assert.equal(applyOp(START, { t: 'body', id: 'porcelain' } as unknown as PotOp), START)
    assert.equal(changes(START, { t: 'set', i: 1, r: START.points[1].r, y: START.points[1].y }), false)
    assert.equal(changes(START, { t: 'pull' }), true)
  })

  it('pull draws the walls taller and a little thinner, up to the limit', () => {
    const s = applyOp(START, { t: 'pull' })
    assert.ok(potHeight(s) > potHeight(START))
    assert.ok(s.points[5].r < START.points[5].r)
    assert.equal(s.points[0].r, START.points[0].r)
    let t = START
    for (let i = 0; i < 40; i++) t = applyOp(t, { t: 'pull' })
    assertTurnable(t)
    assert.equal(potHeight(t), MAX_H)
    assert.equal(applyOp(t, { t: 'pull' }), t)
  })

  it('widen and narrow act most where they touch', () => {
    const w = applyOp(START, { t: 'widen', at: 0.9 })
    const dTop = w.points[5].r - START.points[5].r
    const dLow = w.points[1].r - START.points[1].r
    assert.ok(dTop > 0 && dLow >= 0 && dTop > dLow)
    const n = applyOp(START, { t: 'narrow', at: 0.45 })
    assert.ok(n.points[2].r < START.points[2].r)
    assert.ok(START.points[2].r - n.points[2].r > START.points[5].r - n.points[5].r)
    let t = START
    for (let i = 0; i < 50; i++) t = applyOp(t, { t: 'narrow', at: 0.5 })
    assertTurnable(t)
  })

  it('trim cuts the rim lower without changing the wall below it', () => {
    const before = applyOp(START, { t: 'set', i: 4, r: 4, y: 18 })
    const s = applyOp(before, { t: 'trim' })
    const h = potHeight(before)
    near(potHeight(s), h - TRIM_CM, 0.011)
    // the new rim is the old wall at that height
    near(s.points[5].r, radiusAt(before.points, h - TRIM_CM), 0.011)
    assert.equal(s.trims, 1)
    let t = START
    for (let i = 0; i < 100; i++) t = applyOp(t, { t: 'trim' })
    assert.ok(potHeight(t) >= MIN_H - 1e-9)
    assertTurnable(t)
  })

  it('a foot is turned once', () => {
    const s = applyOp(START, { t: 'foot' })
    assert.equal(s.foot, true)
    assert.equal(applyOp(s, { t: 'foot' }), s)
  })

  it('keeps at most MAX_BANDS bands, centred inside the pot', () => {
    let s = START
    for (let i = 0; i < MAX_BANDS + 3; i++) s = applyOp(s, { t: 'band', motif: 'waves', tech: 'stamp', at: i === 0 ? -3 : 0.5 })
    assert.equal(s.bands.length, MAX_BANDS)
    assert.equal(s.bands[0].at, 0.05)
  })

  it('nothing changes a fired pot', () => {
    const fired = reducePot([{ t: 'fire' }])
    for (const op of [{ t: 'pull' }, { t: 'set', i: 1, r: 9, y: 4 }, { t: 'glaze', id: 'blue' }, { t: 'fire' }, { t: 'band', motif: 'dots', tech: 'stamp', at: 0.5 }] as PotOp[])
      assert.equal(applyOp(fired, op), fired)
  })

  it('undo is replaying one op fewer', () => {
    const ops: PotOp[] = [{ t: 'pull' }, { t: 'widen', at: 0.3 }, { t: 'glaze', id: 'honey' }]
    assert.deepEqual(reducePot(ops.slice(0, -1)), reducePot([{ t: 'pull' }, { t: 'widen', at: 0.3 }]))
    assert.equal(reducePot(ops.slice(0, -1)).glaze, null)
  })
})

describe('pushOp', () => {
  it('merges a drag on one point into one step, and only when asked', () => {
    let ops: PotOp[] = []
    ops = pushOp(ops, { t: 'set', i: 2, r: 8, y: 9 }, true)
    ops = pushOp(ops, { t: 'set', i: 2, r: 9, y: 9 }, true)
    ops = pushOp(ops, { t: 'set', i: 2, r: 10, y: 10 }, true)
    assert.deepEqual(ops, [{ t: 'set', i: 2, r: 10, y: 10 }])
    ops = pushOp(ops, { t: 'set', i: 3, r: 7, y: 14 }, true)
    ops = pushOp(ops, { t: 'set', i: 3, r: 7, y: 15 }, false)
    assert.equal(ops.length, 3)
  })

  it('caps the list at MAX_OPS, keeping the latest', () => {
    let ops: PotOp[] = []
    for (let i = 0; i < MAX_OPS + 10; i++) ops = pushOp(ops, { t: 'widen', at: i / (MAX_OPS + 10) })
    assert.equal(ops.length, MAX_OPS)
    assert.deepEqual(ops[ops.length - 1], { t: 'widen', at: (MAX_OPS + 9) / (MAX_OPS + 10) })
  })
})

describe('parseOps', () => {
  it('keeps valid ops and drops anything else', () => {
    const raw = [
      { t: 'pull' },
      { t: 'set', i: 1, r: 7, y: 3 },
      { t: 'set', i: '1', r: 7, y: 3 },
      { t: 'widen', at: 'x' },
      { t: 'body', id: 'buff' },
      { t: 'body', id: '<script>' },
      { t: 'slip', id: null },
      { t: 'glaze', id: 'green' },
      { t: 'burnish', on: 1 },
      { t: 'band', motif: 'leaf', tech: 'stamp', at: 0.4 },
      { t: 'band', motif: 'leaf', tech: 'etched', at: 0.4 },
      { t: 'explode' },
      null,
      7,
      { t: 'fire', extra: true },
    ]
    assert.deepEqual(parseOps(raw), [
      { t: 'pull' },
      { t: 'set', i: 1, r: 7, y: 3 },
      { t: 'body', id: 'buff' },
      { t: 'slip', id: null },
      { t: 'glaze', id: 'green' },
      { t: 'band', motif: 'leaf', tech: 'stamp', at: 0.4 },
      { t: 'fire' },
    ])
    assert.deepEqual(parseOps('nope'), [])
    assert.deepEqual(parseOps({ length: 3 }), [])
  })

  it('round-trips through JSON to the same pot', () => {
    const ops: PotOp[] = [{ t: 'pull' }, { t: 'set', i: 4, r: 3.3, y: 17 }, { t: 'band', motif: 'rings', tech: 'stamp', at: 0.7 }, { t: 'fire' }]
    assert.deepEqual(reducePot(parseOps(JSON.parse(JSON.stringify(ops)))), reducePot(ops))
  })
})

describe('profile and section', () => {
  it('the spline passes through every control point, base to rim', () => {
    const pts = reducePot([{ t: 'pull' }, { t: 'widen', at: 0.5 }]).points
    const c = profileCurve(pts, 10)
    assert.equal(c.length, (pts.length - 1) * 10 + 1)
    pts.forEach((p, i) => {
      near(c[i * 10].r, p.r)
      near(c[i * 10].y, p.y)
    })
    pts.forEach((p) => near(radiusAt(pts, p.y), p.r, 1e-6))
  })

  it('normalise is idempotent', () => {
    const s = reducePot([{ t: 'set', i: 3, r: 30, y: 2 }])
    assert.deepEqual(normalise(s.points), s.points)
  })

  for (const [name, ops] of [
    ['the start lump', []],
    ['a tall narrow-necked bottle with a foot', [{ t: 'pull' }, { t: 'pull' }, { t: 'pull' }, { t: 'narrow', at: 0.9 }, { t: 'narrow', at: 0.9 }, { t: 'narrow', at: 0.9 }, { t: 'foot' }]],
    ['a wide trimmed bowl', [{ t: 'set', i: 5, r: 18, y: 9 }, { t: 'set', i: 4, r: 16, y: 7 }, { t: 'set', i: 3, r: 13, y: 5 }, { t: 'trim' }]],
  ] as [string, PotOp[]][]) {
    it(`the lathe outline of ${name} is closed on the axis and stays off it in between`, () => {
      const s = reducePot(ops)
      const sec = potSection(s)
      assert.equal(sec.pts.length, sec.part.length)
      assert.equal(sec.pts[0][0], 0)
      assert.equal(sec.pts[sec.pts.length - 1][0], 0)
      for (const [r, y] of sec.pts) {
        assert.ok(Number.isFinite(r) && Number.isFinite(y))
        assert.ok(r >= 0)
        assert.ok(y >= 0 && y <= sec.height + 1e-9)
      }
      // the floor sits above the underside, inside the walls
      assert.ok(sec.pts[sec.pts.length - 1][1] > sec.pts[0][1])
      assert.ok(sec.part.includes('outer') && sec.part.includes('rim') && sec.part.includes('inner'))
      near(sec.top, potHeight(s) + sec.bodyBase)
    })
  }

  it('stamped bands count their impressions; sgraffito is drawn, not stamped', () => {
    const s = reducePot([
      { t: 'band', motif: 'dots', tech: 'stamp', at: 0.5 },
      { t: 'band', motif: 'zigzag', tech: 'sgraffito', at: 0.3 },
    ])
    const n = bandRepeats(s, s.bands[0])
    assert.ok(Number.isInteger(n) && n >= 6)
    assert.equal(stampCount(s), n)
  })
})
