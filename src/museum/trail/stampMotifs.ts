/**
 * CLAY PASSPORT MOTIFS — the relief drawn on each stamp (SPECTACLE F31), in the spirit of a
 * Molela plaque: a few bold, rounded lines pressed into clay, no lettering.
 *
 * Each motif is SVG path data in a 100 × 100 box (centre 50, 50), drawn as a 5-unit round
 * stroke (`fill` paths are filled too). The same data draws the passport's roundels (SVG),
 * the stamp head and the pressed tablet on the posts (canvas Path2D → bump map) and the
 * printed certificate, so the three always match. Shapes only: they claim nothing.
 */
export interface StampMotif {
  /** Stroked paths. */
  stroke: string[]
  /** Filled paths (small solids: eyes, dots, flames). */
  fill?: string[]
}

const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy}`

function star(points: number, rOut: number, rIn: number, rot = -90) {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rIn : rOut
    const a = ((rot + (i * 180) / points) * Math.PI) / 180
    d += `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`
  }
  return d + 'Z'
}

function rays(cx: number, cy: number, r0: number, r1: number, n: number, from = 0, to = 360) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * (i + 0.5)) / n) * Math.PI) / 180
    d += `M${(cx + r0 * Math.cos(a)).toFixed(2)} ${(cy + r0 * Math.sin(a)).toFixed(2)}L${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}`
  }
  return d
}

export const STAMP_MOTIFS = {
  /** A doorway with the sun rising in it. */
  door: { stroke: ['M28 86V46A22 22 0 0 1 72 46V86', ring(50, 62, 9), rays(50, 62, 13, 19, 5, 180, 360), 'M20 86H80'] },
  /** An eight-point compass star. */
  compass: { stroke: [star(8, 36, 13), ring(50, 50, 6)] },
  /** A long-necked horse with pricked ears (after the Bankura horse). */
  horse: {
    stroke: ['M24 80L28 60Q31 51 42 51H57Q62 51 63 45L61 24L65 15L67 23L71 15L72 26L75 42Q76 52 70 57L72 80', 'M28 60L26 80', 'M44 53L44 80', 'M58 55L60 80', 'M24 62Q16 66 18 74'],
    fill: [ring(68, 33, 2.2)],
  },
  /** An arched votive plaque with a rider (after Molela). */
  plaque: { stroke: ['M28 88V42A22 22 0 0 1 72 42V88Z', 'M36 74Q42 62 50 62Q60 62 64 74', 'M50 62V50', 'M42 80L38 88M58 80L62 88'], fill: [ring(50, 44, 5.5)] },
  /** A round kettle with a spout and a cane handle (after Longpi). */
  kettle: { stroke: [ring(50, 60, 22), 'M71 54L86 42', 'M34 42Q50 16 66 42', 'M44 38H56'], fill: [ring(50, 37, 3)] },
  /** Concentric rings round an eye of light. */
  rings: { stroke: [ring(50, 50, 36), ring(50, 50, 25), ring(50, 50, 14)], fill: [ring(50, 50, 5)] },
  /** Three arches in a row. */
  arches: { stroke: ['M14 82V52A10 10 0 0 1 34 52V82', 'M40 82V44A10 10 0 0 1 60 44V82', 'M66 82V52A10 10 0 0 1 86 52V82', 'M10 82H90'] },
  /** A kolam loop drawn round four dots. */
  kolam: {
    stroke: ['M50 18C66 18 82 34 82 50C82 66 66 82 50 82C34 82 18 66 18 50C18 34 34 18 50 18Z', 'M50 18C40 34 34 40 18 50C34 60 40 66 50 82C60 66 66 60 82 50C66 40 60 34 50 18Z'],
    fill: [ring(36, 36, 3), ring(64, 36, 3), ring(36, 64, 3), ring(64, 64, 3)],
  },
  /** A flame. */
  flame: { stroke: ['M50 12C62 34 76 44 72 64C69 80 60 88 50 88C40 88 31 80 28 64C25 48 42 40 50 12Z', 'M50 50C56 60 60 66 58 74C56 80 44 80 42 74C40 66 46 62 50 50Z'] },
  /** A kothi, the clay grain bin: banded, with its small opening. */
  kothi: { stroke: ['M32 24Q50 14 68 24V80Q50 90 32 80Z', 'M32 40Q50 48 68 40', 'M32 56Q50 64 68 56', 'M24 24H76'], fill: [ring(50, 72, 4)] },
  /** A hanging lantern. */
  lantern: { stroke: ['M50 8V20', 'M36 30Q50 16 64 30', 'M34 30H66V70Q50 82 34 70Z', 'M44 36V66M50 36V70M56 36V66', 'M42 82Q50 90 58 82'] },
  /** A thrown pot. */
  pot: { stroke: ['M40 18H60Q57 27 64 32Q82 44 77 64Q72 84 50 86Q28 84 23 64Q18 44 36 32Q43 27 40 18Z', 'M30 54Q50 62 70 54'] },
  /** A balcony railing on its arc, the dome rising over it. */
  balcony: { stroke: ['M14 58A36 36 0 0 1 86 58', 'M14 74H86', 'M14 64H86', 'M24 64V74M36 64V74M50 64V74M64 64V74M76 64V74', 'M38 36A12 12 0 0 1 62 36'] },
  /** A round room: shelves round a plinth under a disc of sky. */
  disc: { stroke: [ring(50, 50, 36), 'M26 30A30 30 0 0 1 74 30', 'M20 46A30 30 0 0 1 26 34', 'M80 46A30 30 0 0 0 74 34', 'M38 70H62V60H38Z'], fill: [ring(50, 34, 6)] },
  /** A stair spiralling round a hanging sphere. */
  spiral: { stroke: ['M50 10V30', 'M24 30Q50 18 76 30Q86 44 50 50Q14 56 24 70Q50 82 76 70', 'M50 82V92'], fill: [ring(50, 50, 9)] },
  /** The sun over the ring of the oculus. */
  sun: { stroke: [ring(50, 38, 11), rays(50, 38, 15, 23, 8), 'M16 72A34 11 0 1 0 84 72A34 11 0 1 0 16 72'] },
} satisfies Record<string, StampMotif>

export type MotifId = keyof typeof STAMP_MOTIFS

export const isMotif = (v: unknown): v is MotifId => typeof v === 'string' && v in STAMP_MOTIFS

export function motif(id: string | undefined): StampMotif {
  return isMotif(id) ? STAMP_MOTIFS[id] : STAMP_MOTIFS.rings
}

/**
 * Draw a motif on a 2D canvas, filling the box (x, y, size). Used for bump maps (white relief
 * on black, softened with `blur`) and the certificate.
 */
export function drawStampMotif(ctx: CanvasRenderingContext2D, id: string | undefined, x: number, y: number, size: number, color: string, lineWidth = 5, mirror = false) {
  const m = motif(id)
  ctx.save()
  ctx.translate(x, y)
  if (mirror) {
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
  }
  ctx.scale(size / 100, size / 100)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of m.stroke) ctx.stroke(new Path2D(d))
  for (const d of m.fill ?? []) ctx.fill(new Path2D(d))
  ctx.restore()
}
