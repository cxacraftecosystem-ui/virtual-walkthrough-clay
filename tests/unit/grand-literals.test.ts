/**
 * No literal coordinates in the plan's configuration (GRAND §1.1): every placement in
 * src/museum/config/** is an expression of the named constants in museum.ts and satellites.ts,
 * so the pavilion can be rescaled by changing those two files alone.
 *
 * Fails on `polar(`, `at(`, `ringOf(` or `spawnAt(` whose first argument (the radius) is a
 * numeric literal — `polar(1, a)`, a unit direction, aside — and on a `position: [ … ]` with a
 * literal element larger than 2 m.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(import.meta.dirname, '../../src/museum/config')
const EXEMPT = new Set(['museum.ts', 'satellites.ts'])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !(dir === ROOT && EXEMPT.has(n)) ? [p] : []
  })
}

/** Source without comments (block and line), keeping line numbers. */
function code(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const CALL = /(?<![.\w])(polar|at|ringOf|spawnAt)\(\s*(-?\d+(?:\.\d+)?)\s*[,)]/g
const POSITION = /position:\s*\[([^\]]*)\]/g
const NUMBER = /^\s*(-?\d+(?:\.\d+)?)\s*$/

function offences(path: string): string[] {
  const src = code(readFileSync(path, 'utf-8'))
  const lineOf = (i: number) => src.slice(0, i).split('\n').length
  const out: string[] = []
  for (const m of src.matchAll(CALL)) if (!(m[1] === 'polar' && Number(m[2]) === 1)) out.push(`${m[1]}(${m[2]}, …) at line ${lineOf(m.index!)}`)
  for (const m of src.matchAll(POSITION)) {
    for (const part of m[1].split(',')) {
      const n = NUMBER.exec(part)
      if (n && Math.abs(Number(n[1])) > 2) out.push(`position literal ${n[1]} at line ${lineOf(m.index!)}`)
    }
  }
  return out
}

describe('grand: no literal coordinates in the config', () => {
  it('finds the config files', () => {
    const all = files(ROOT).map((p) => relative(ROOT, p).replace(/\\/g, '/'))
    for (const f of ['layout.ts', 'tour.ts', 'objects.ts', 'spectacleObjects/rooms.ts', 'grandObjects/crafts.ts']) assert.ok(all.includes(f), f)
    assert.ok(!all.includes('museum.ts') && !all.includes('satellites.ts'))
  })

  it('derives every radius and every position from the named constants', () => {
    const bad = files(ROOT).flatMap((p) => offences(p).map((o) => `${relative(ROOT, p).replace(/\\/g, '/')}: ${o}`))
    assert.deepEqual(bad, [])
  })

  it('catches the forms it is meant to', () => {
    const probe = 'x = polar(12.4, -18)\ny = at(0.5, 90)\nz = ringOf(9.35, [1])\nw = spawnAt(4, 3, "in")\nposition: [1.85, 0, 26.5]\nok = polar(KEY.ringR, 4)\nok2 = arr.at(-1)\nok3 = position: [0, MUSEUM.x, 1.5]'
    const src = code(probe)
    assert.equal([...src.matchAll(CALL)].length, 4)
    const pos = [...src.matchAll(POSITION)].flatMap((m) => m[1].split(',').filter((p) => NUMBER.test(p) && Math.abs(Number(p)) > 2))
    assert.equal(pos.length, 1)
  })
})
