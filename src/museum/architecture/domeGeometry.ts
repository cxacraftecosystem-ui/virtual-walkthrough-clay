/**
 * THE DOME'S GEOMETRY (GRAND §1.2, §2.5): a true coffered terracotta dome springing from the
 * gallery ring at y 9.0, rising to the stepped oculus and its glowing light-well (p05, p07, p09).
 *
 *   interior ...... one mesh: a plain band at the springing over a concealed uplight ledge;
 *                   5 rings × 28 coffers, diminishing like the Pantheon's, each stepped three
 *                   times (deeper on the lower edge so the steps read from the floor, a hairline
 *                   warm cove on each top lip); the three terraces of the stepped oculus; the
 *                   light-well up to the Sky Rim's lip. Vertex colours carry the tints (rose coffers,
 *                   paler frames, blush terraces), a glow channel carries the concealed light.
 *   exterior ...... the taller outer shell on its tambour (domeShell.ts), so the dome rises over
 *                   the annex from the forecourt; the coffered interior is unchanged inside it.
 *   trim .......... the tambour's piers and cornice, the glazed ribs, a solid lantern ring 1.2 m
 *                   high round the Sky Rim's deck, the Sky Rim's plinth, and the rib stair that climbs the
 *                   south-east rib to the deck. Above the deck the
 *                   collar is glass (SkyRimRoof.tsx), so the rim looks down into the rotunda.
 *
 * Sphere: centre y KEY.domeCentreY, radius KEY.domeSphereR (through the springing circle and
 * the crown). Angles: φ from the zenith, θ the plan angle (a = atan2(z, x)).
 */
import * as THREE from 'three'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { SKY_RIM } from '../config/satellites'
import { pbrTint } from '../materials/pbrSets'
import { SHELL, shellAt, shellR, shellY } from './domeShell'

/** The lantern ring's height above the Sky Rim's deck. */
const LANTERN_H = 1.2
import { linear, Mesh, revolve, type V2, type V3 } from './sweep'

const D = MUSEUM.dome
export const DOME = {
  R: KEY.domeSphereR,
  cy: KEY.domeCentreY,
  /** Outer (tiled) sphere radius. */
  RE: KEY.domeSphereR + D.shell,
  /** Top of the ambulatory / annex roof slab (where the dome's exterior emerges). */
  slabTop: MUSEUM.pavilion.ceilingHeight + MUSEUM.pavilion.roofThickness,
  /** The Sky Rim's plinth: the deck's outer edge and its top (the deck). */
  plinthR: SHELL.plinth.r,
  /** Rib profile: half-width and height proud of the tiles. */
  rib: { half: 0.17, proud: 0.16 },
  /** The concealed uplight ledge at the springing (the dome wash's source). */
  ledge: { y0: D.springY - 0.32, y1: D.springY + 0.06, out: 0.36 },
  /** The ribs' plan angles: one every 360/ribs degrees, the first on the stair's bearing. */
  ribDeg: (i: number) => STAIR_RIB_DEG + (360 / D.ribs) * i,
} as const

/** The rib the dome stair climbs (south-east, over the east stair's roof hatch). */
export const STAIR_RIB_DEG = 75

/** Height of the inner sphere at plan radius r (the coffers' frame surface). */
export const innerY = (r: number) => DOME.cy + Math.sqrt(Math.max(0, DOME.R * DOME.R - r * r))
/** Height of the tiled exterior at plan radius r. */
export const outerY = (r: number) => DOME.cy + Math.sqrt(Math.max(0, DOME.RE * DOME.RE - r * r))
/** Plan radius of the exterior at height y. */
export const outerR = (y: number) => Math.sqrt(Math.max(0, DOME.RE * DOME.RE - (y - DOME.cy) ** 2))

/**
 * The oculus as an aperture for the light engine: the open circle at the bottom of the
 * light-well (the lowest terrace's inner edge) and at its top. Kept in the shape the light
 * engine has always read (`OCULUS_STEPS` in CeilingAndSkylight.tsx re-exports these).
 */
export const OCULUS_APERTURE = [
  { r: MUSEUM.oculus.r, y: D.terraces[D.terraces.length - 1].y },
  { r: MUSEUM.oculus.r, y: D.lightWell.y1 },
] as const

/* ------------------------------------------------------------------ */
/* Coffer rings                                                        */
/* ------------------------------------------------------------------ */

/** φ (radians from the zenith) of a point of the inner sphere at plan radius r. */
const phiAt = (r: number) => Math.asin(Math.min(1, r / DOME.R))

/**
 * The coffer rings' φ boundaries, springing-side first: the plain band's top, then each ring's
 * top. Each ring's height follows its width (square-ish coffers that diminish towards the
 * oculus), solved so the fifth ring ends exactly at the stop radius.
 */
export function cofferRings(): number[] {
  const phi0 = phiAt(KEY.ringR) - 0.85 / DOME.R
  const phiT = phiAt(D.coffers.stopR)
  const w = (Math.PI * 2) / D.coffers.perRing
  const run = (c: number) => {
    const out = [phi0]
    let p = phi0
    for (let k = 0; k < D.coffers.rings; k++) {
      // the ring's height ≈ c × its width at its lower edge
      p -= c * Math.sin(p) * w
      out.push(p)
    }
    return out
  }
  let lo = 0.2
  let hi = 2
  for (let i = 0; i < 50; i++) {
    const c = (lo + hi) / 2
    const end = run(c)[D.coffers.rings]
    if (end > phiT) lo = c
    else hi = c
  }
  const out = run((lo + hi) / 2)
  out[D.coffers.rings] = phiT
  return out
}

/* ------------------------------------------------------------------ */
/* Interior                                                            */
/* ------------------------------------------------------------------ */

/** Tints of the interior (target albedos on Clay005, PDF rose / terracotta / blush). */
export const DOME_TINT = {
  frame: '#e2b09f',
  riser: '#c98371',
  floor: '#ad6352',
  band: '#dcab9a',
  terrace: '#efc6b6',
  well: '#f5d6ca',
  ledge: '#6a2620',
} as const

/** Glow channel: 0…1 a warm concealed cove (night), 1…2 the sky's bounce (day), 3 a coffer's hairline (dusk only). */
export const GLOW = { cove: 1, sky: 2, coffer: 3 } as const

function sph(rho: number, phi: number, th: number): V3 {
  const s = Math.sin(phi)
  return [rho * s * Math.cos(th), DOME.cy + rho * Math.cos(phi), rho * s * Math.sin(th)]
}
/** Inward radial normal (towards the sphere's centre). */
function inward(phi: number, th: number): V3 {
  const s = Math.sin(phi)
  return [-s * Math.cos(th), -Math.cos(phi), -s * Math.sin(th)]
}
/** Unit tangent of increasing θ / increasing φ. */
const tTheta = (th: number): V3 => [-Math.sin(th), 0, Math.cos(th)]
const tPhi = (phi: number, th: number): V3 => [Math.cos(phi) * Math.cos(th), -Math.sin(phi), Math.cos(phi) * Math.sin(th)]
const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]]

/** Strips each coffer's rib is split into along θ (so the 28 columns meet true circles). */
const SUB = 2
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** One coffer: three stepped frames, three risers and the floor, in the cell θ0…θ1 × φT…φB. */
function coffer(mesh: Mesh, th0: number, th1: number, phT: number, phB: number, tint: (hex: string) => [number, number, number]) {
  const R = DOME.R
  const step = D.coffers.depth / D.coffers.steps
  const rho = (k: number) => R + k * step
  const wB = R * Math.sin(phB) * (th1 - th0)
  const wT = R * Math.sin(phT) * (th1 - th0)
  const h = R * (phB - phT)
  const w = Math.min(wB, wT, h)
  // inset of every edge at each step (k = 0 the cell's edge = the middle of the frame between cells)
  const F = [0, 0.075, 0.14, 0.2]
  type Rect = { l: number; r: number; t: number; b: number }
  const rect = (k: number, at: number): Rect => {
    const side = F[k] * w
    const top = F[k] * h * 0.62
    const bot = F[k] * h * 1.45
    const t = phT + top / at
    const b = phB - bot / at
    const sMid = Math.sin((t + b) / 2)
    return { l: th0 + side / (at * sMid), r: th1 - side / (at * sMid), t, b }
  }
  const corners = (q: Rect, at: number): V3[] => [sph(at, q.t, q.l), sph(at, q.t, q.r), sph(at, q.b, q.r), sph(at, q.b, q.l)]
  const uvOf = (p: V3[]): V2[] => p.map((v) => [Math.atan2(v[2], v[0]) * 10, v[1]] as V2)
  for (let k = 0; k < D.coffers.steps; k++) {
    const at = rho(k)
    const outer = rect(k, at)
    const inner = rect(k + 1, at)
    const O = corners(outer, at)
    const I = corners(inner, at)
    // tread k: the frame between rect k and rect k + 1 (k = 0 is the rib between coffers)
    mesh.color = tint(k === 0 ? DOME_TINT.frame : DOME_TINT.riser)
    mesh.glowValue = 0
    const n = inward((outer.t + outer.b) / 2, (outer.l + outer.r) / 2)
    for (let e = 0; e < 4; e++) {
      const a = e
      const b = (e + 1) % 4
      // the rib's top and bottom edges follow the sphere along θ (they meet the band and the
      // terraces, which are true circles): split into strips, the inner edge along its chord
      if (k === 0 && (e === 0 || e === 2)) {
        const ph = e === 0 ? outer.t : outer.b
        const ths = e === 0 ? [outer.l, outer.r] : [outer.r, outer.l]
        for (let i = 0; i < SUB; i++) {
          const u0 = i / SUB
          const u1 = (i + 1) / SUB
          const o0 = sph(at, ph, ths[0] + (ths[1] - ths[0]) * u0)
          const o1 = sph(at, ph, ths[0] + (ths[1] - ths[0]) * u1)
          const i0 = lerp3(I[a], I[b], u0)
          const i1 = lerp3(I[a], I[b], u1)
          const p = [o0, o1, i1, i0]
          mesh.quad(p, [n, n, n, n], uvOf(p))
        }
        continue
      }
      const p = [O[a], O[b], I[b], I[a]]
      mesh.quad(p, [n, n, n, n], uvOf(p))
    }
    // riser k + 1: from rect k + 1 at this depth back to the next depth
    const nx = rect(k + 1, rho(k + 1))
    const B = corners(nx, rho(k + 1))
    mesh.color = tint(DOME_TINT.riser)
    const mid = (inner.l + inner.r) / 2
    // top lip (faces down the meridian), right side, bottom (faces up), left side
    const faces: [number, number, V3][] = [
      [0, 1, tPhi(inner.t, mid)],
      [1, 2, neg(tTheta(inner.r))],
      [2, 3, neg(tPhi(inner.b, mid))],
      [3, 0, tTheta(inner.l)],
    ]
    for (const [a, b, n] of faces) {
      // the top lip of the first step carries the hairline cove (a dusk glint; dark at night)
      mesh.glowValue = k === 0 && a === 0 ? GLOW.coffer : 0
      const p = [I[a], I[b], B[b], B[a]]
      mesh.quad(p, [n, n, n, n], uvOf(p))
    }
  }
  // the coffer's floor
  const at = rho(D.coffers.steps)
  const q = rect(D.coffers.steps, at)
  const P = corners(q, at)
  mesh.color = tint(DOME_TINT.floor)
  mesh.glowValue = 0
  const n = inward((q.t + q.b) / 2, (q.l + q.r) / 2)
  mesh.quad(P, [n, n, n, n], uvOf(P))
}

/** The interior: ledge, band, coffers, terraces and light-well (one mesh, colour + glow channels). */
export function domeInterior(): THREE.BufferGeometry | null {
  // revolved rings share the coffer columns' vertices: the same count, the same start angle
  const seg = D.coffers.perRing * SUB
  const mesh = new Mesh({ color: true, glow: true })
  const tint = (hex: string) => {
    const c = pbrTint('Clay005', hex)
    return [c.r, c.g, c.b] as [number, number, number]
  }
  const full = Math.PI * 2
  const R = DOME.R
  const rings = cofferRings()
  const phSpring = phiAt(KEY.ringR)
  // the first column's edge: half a column before the stair rib (so a frame runs up every rib's bearing)
  const TH0 = DOME.ribDeg(0) * DEG - full / D.coffers.perRing / 2

  // ── the springing ledge: a lacquered shelf hiding the uplight that washes the coffers ──
  const L = DOME.ledge
  const r0 = KEY.ringR
  const r1 = KEY.ringR - L.out
  mesh.color = tint(DOME_TINT.ledge)
  const coarse = seg
  revolve(mesh, 0, 0, [
    [r0 + 0.002, L.y0],
    [r1, L.y0],
    [r1, L.y1],
    [r1 + 0.07, L.y1],
    [r1 + 0.07, L.y1 - 0.14],
  ], 0, full, coarse)
  // the glowing strip behind the lip (seen only as light on the band above)
  mesh.glowValue = GLOW.cove
  revolve(mesh, 0, 0, [
    [r1 + 0.07, L.y1 - 0.14],
    [r0 - 0.002, L.y1 - 0.14],
  ], 0, full, coarse, [
    [0, 1],
    [0, 1],
  ])
  mesh.glowValue = 0

  // ── the plain band from the springing to the first coffer ring ──
  mesh.color = tint(DOME_TINT.band)
  const bandRows = 1
  const band: V2[] = []
  const bandN: V2[] = []
  for (let i = 0; i <= bandRows; i++) {
    const p = phSpring + ((rings[0] - phSpring) * i) / bandRows
    band.push([R * Math.sin(p), DOME.cy + R * Math.cos(p)])
    bandN.push([-Math.sin(p), -Math.cos(p)])
  }
  revolve(mesh, 0, 0, band, TH0, TH0 + full, seg, bandN)

  // ── coffers: 5 rings × 28, the columns offset so a frame runs up each rib's bearing ──
  const cols = D.coffers.perRing
  const th = (i: number) => TH0 + (i / cols) * full
  for (let k = 0; k < D.coffers.rings; k++) {
    for (let i = 0; i < cols; i++) coffer(mesh, th(i), th(i + 1), rings[k + 1], rings[k], tint)
  }

  // ── the stepped oculus (p07r): risers glowing faintly with sky, soffits catching it ──
  let prevY = innerY(D.coffers.stopR)
  for (const t of D.terraces) {
    mesh.color = tint(DOME_TINT.terrace)
    mesh.glowValue = GLOW.sky - 0.6
    revolve(mesh, 0, 0, [
      [t.r0, prevY - 0.01],
      [t.r0, t.y],
    ], TH0, TH0 + full, t === D.terraces[0] ? seg : coarse, [
      [-1, 0],
      [-1, 0],
    ])
    mesh.glowValue = GLOW.sky - 0.75
    revolve(mesh, 0, 0, [
      [t.r0, t.y],
      [t.r1, t.y],
    ], 0, full, coarse, [
      [0, -1],
      [0, -1],
    ])
    prevY = t.y
  }
  // ── the light-well (p07l's thick glowing reveal), up to the Sky Rim's deck (the lip) ──
  mesh.color = tint(DOME_TINT.well)
  const wr = MUSEUM.oculus.r
  const rows = 2
  const wellP: V2[] = []
  const wellN: V2[] = []
  for (let i = 0; i <= rows; i++) {
    wellP.push([wr, prevY + ((SKY_RIM.y - prevY) * i) / rows])
    wellN.push([-1, 0])
  }
  // brighter towards the sky
  for (let i = 0; i < rows; i++) {
    mesh.glowValue = GLOW.sky - 0.5 + 0.5 * ((i + 1) / rows)
    revolve(mesh, 0, 0, [wellP[i], wellP[i + 1]], 0, full, coarse, [wellN[i], wellN[i + 1]])
  }
  return mesh.build()
}

/* ------------------------------------------------------------------ */
/* Exterior                                                            */
/* ------------------------------------------------------------------ */

/**
 * The tiled shell: the stilted outer shell (domeShell.ts) from the tambour's top to the Sky Rim's
 * plinth, plus the tambour's own wall between its piers (UV u along the courses, v up the slope).
 */
export function domeExterior(opts: { segments?: number; rows?: number } = {}): THREE.BufferGeometry | null {
  const seg = opts.segments ?? 56
  const rows = opts.rows ?? 16
  const mesh = new Mesh()
  const prof: V2[] = []
  const nor: V2[] = []
  for (let i = 0; i <= rows; i++) {
    const q = shellAt(((Math.PI / 2) * i) / rows)
    prof.push([q.r, q.y])
    nor.push([q.nr, q.ny])
  }
  revolve(mesh, 0, 0, prof, 0, Math.PI * 2, seg, nor)
  // the tambour's wall, from the slab to the shell
  const T = SHELL.tambour
  revolve(mesh, 0, 0, [[T.r, T.y0 - 0.05], [T.r, T.y1 + 0.02]], 0, Math.PI * 2, seg * 2)
  return mesh.build()
}

/** Points of the rib stair's treads: [plan radius, tread height] from the roof to the deck (up the stair pier, then the shell). */
export function ribStairTreads(riser = 0.2): V2[] {
  const y0 = DOME.slabTop + 0.2
  const y1 = SKY_RIM.y
  const n = Math.ceil((y1 - y0) / riser)
  return Array.from({ length: n }, (_, i) => {
    const y = y0 + ((y1 - y0) * (i + 1)) / n
    return [y <= SHELL.tambour.y1 ? SHELL.tambour.r + SHELL.tambour.pierOut : shellR(y), y] as V2
  })
}

type ShellPoint = { r: number; y: number; nr: number; ny: number }

/**
 * The glazed trim: the tambour's 24 piers and its cornice, the 24 ribs up the shell, the lantern
 * ring round the deck, the Sky Rim's plinth, and the stair that climbs the south-east rib from the
 * roof to the deck (treads, a brass rail). The lantern ring is returned apart (as `crown`), so it
 * can be drawn without casting shadows into the oculus.
 */
export function domeTrim(opts: { segments?: number } = {}): { glazed: THREE.BufferGeometry | null; brass: THREE.BufferGeometry | null; crown: THREE.BufferGeometry | null } {
  const seg = opts.segments ?? 96
  const glazed = new Mesh()
  const crown = new Mesh()
  const brass = new Mesh()
  const full = Math.PI * 2
  const top = DOME.slabTop
  const T = SHELL.tambour

  // the tambour's foot on the slab and its cornice under the shell
  revolve(glazed, 0, 0, [
    [KEY.ringOuterR + 0.02, top - 0.02],
    [T.r + 0.12, top - 0.02],
    [T.r + 0.12, top + 0.32],
    [T.r, top + 0.4],
  ], 0, full, seg)
  revolve(glazed, 0, 0, [
    [T.r, T.y1 - 0.5],
    [T.r + T.pierOut + 0.08, T.y1 - 0.42],
    [T.r + T.pierOut + 0.08, T.y1 - 0.12],
    [T.r + T.pierOut + 0.22, T.y1 - 0.04],
    [T.r + T.pierOut + 0.22, T.y1 + 0.14],
    [T.r - 0.2, T.y1 + 0.3],
  ], 0, full, seg)

  const { half, proud } = DOME.rib
  for (let i = 0; i < MUSEUM.dome.ribs; i++) {
    const th = DOME.ribDeg(i) * DEG
    const t = tTheta(th)
    const rad: V3 = [Math.cos(th), 0, Math.sin(th)]
    // the tambour's pier under the rib
    const pc: V3 = [rad[0] * (T.r + T.pierOut / 2), (T.y0 + T.y1 - 0.5) / 2, rad[2] * (T.r + T.pierOut / 2)]
    glazed.box(pc, [rad[0] * (T.pierOut / 2 + 0.02), 0, rad[2] * (T.pierOut / 2 + 0.02)], [0, (T.y1 - 0.5 - T.y0) / 2, 0], [t[0] * T.pierHalf, 0, t[2] * T.pierHalf])
    // a rib along a meridian curve (shell or crown), `depth` off it, 2·w wide
    const rib = (mesh: Mesh, at: (u: number) => ShellPoint, u0: number, u1: number, rows: number, w: number, depth: number) => {
      const P = (q: ShellPoint, out: number, side: number): V3 => [rad[0] * (q.r + q.nr * out) + t[0] * side, q.y + q.ny * out, rad[2] * (q.r + q.nr * out) + t[2] * side]
      const N = (q: ShellPoint): V3 => [rad[0] * q.nr, q.ny, rad[2] * q.nr]
      for (let j = 0; j < rows; j++) {
        const a = at(u0 + ((u1 - u0) * j) / rows)
        const b = at(u0 + ((u1 - u0) * (j + 1)) / rows)
        const va = (j / rows) * 8
        const vb = ((j + 1) / rows) * 8
        mesh.quad([P(a, depth, -w), P(a, depth, w), P(b, depth, w), P(b, depth, -w)], [N(a), N(a), N(b), N(b)], [[0, va], [2 * w, va], [2 * w, vb], [0, vb]])
        for (const sd of [-1, 1]) {
          const n: V3 = [t[0] * sd, 0, t[2] * sd]
          mesh.quad([P(a, -0.05, sd * w), P(a, depth, sd * w), P(b, depth, sd * w), P(b, -0.05, sd * w)], [n, n, n, n], [[0, va], [depth, va], [depth, vb], [0, vb]])
        }
      }
    }
    rib(glazed, shellAt, 0.03, Math.PI / 2, 10, half, proud)
  }
  // the lantern ring: a solid low parapet round the Sky Rim's deck (1.2 m, a moulded glazed
  // cap), so the dome ends in one clean silhouette from the forecourt (the open crown of ribs read
  // as scaffolding); the glass collar over the oculus stands inside it
  const P = { r0: DOME.plinthR - 0.3, r1: DOME.plinthR + 0.1, y0: SKY_RIM.y - 0.02, y1: SKY_RIM.y + LANTERN_H }
  const lantern: V2[] = [
    [P.r1, P.y0 - 0.1],
    [P.r1, P.y1 - 0.18],
    [P.r1 + 0.12, P.y1 - 0.12],
    [P.r1 + 0.08, P.y1 - 0.02],
    [P.r0 - 0.06, P.y1 - 0.02],
    [P.r0, P.y1 - 0.08],
    [P.r0, P.y0],
  ]
  // open where the rib stair arrives on the deck
  const gap = 0.7 / DOME.plinthR
  const s0 = STAIR_RIB_DEG * DEG + gap
  revolve(crown, 0, 0, lantern, s0, s0 + full - 2 * gap, seg)

  // the Sky Rim's plinth: a short drum where the shell levels out, up to the deck
  revolve(glazed, 0, 0, [
    [DOME.plinthR, SHELL.plinth.y - 0.12],
    [DOME.plinthR, SKY_RIM.y - 0.12],
    [DOME.plinthR + 0.1, SKY_RIM.y - 0.12],
    [DOME.plinthR + 0.1, SKY_RIM.y - 0.02],
  ], 0, full, seg)

  // the rib stair: a tread every riser up the stair rib, a brass handrail on its outer side
  const th = STAIR_RIB_DEG * DEG
  const t = tTheta(th)
  const radial: V3 = [Math.cos(th), 0, Math.sin(th)]
  const treads = ribStairTreads()
  const W = 0.42
  const off = DOME.rib.half + W + 0.02
  const railPts: V3[] = []
  let prev: V2 = [SHELL.tambour.r + SHELL.tambour.pierOut + 0.3, top]
  for (const [r, y] of treads) {
    const going = Math.max(0.12, prev[0] - r)
    const rc = r + going / 2
    // each tread reaches down to the shell (or the roof, beside the pier) at its outer edge
    const h = Math.max(0.12, Math.min(y - top, y - shellY(rc + going / 2) + 0.06))
    const c: V3 = [radial[0] * rc + t[0] * off, y - h / 2, radial[2] * rc + t[2] * off]
    glazed.box(c, [radial[0] * (going / 2 + 0.02), 0, radial[2] * (going / 2 + 0.02)], [0, h / 2, 0], [t[0] * W, 0, t[2] * W])
    railPts.push([radial[0] * r + t[0] * (off + W - 0.03), y + 0.95, radial[2] * r + t[2] * (off + W - 0.03)])
    prev = [r, y]
  }
  // handrail: short cylinders between consecutive rail points, posts every fourth tread
  const seg3 = (a: V3, b: V3, rad: number) => {
    const g = new THREE.CylinderGeometry(rad, rad, 1, 6, 1, true)
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = dir.length()
    g.scale(1, len, 1)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return g
  }
  const parts: THREE.BufferGeometry[] = []
  for (let i = 1; i < railPts.length; i++) parts.push(seg3(railPts[i - 1], railPts[i], 0.022))
  for (let i = 0; i < railPts.length; i += 4) {
    const p = railPts[i]
    parts.push(seg3([p[0], p[1] - 0.95, p[2]], p, 0.016))
  }
  for (const g of parts) appendGeometry(brass, g)
  return { glazed: glazed.build(), brass: brass.build(), crown: crown.build() }
}

/** Copy a three.js geometry's triangles into a Mesh (positions, normals, uvs). */
export function appendGeometry(mesh: Mesh, g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g
  const p = ng.getAttribute('position')
  const n = ng.getAttribute('normal')
  const u = ng.getAttribute('uv')
  const b = mesh.pos.length / 3
  for (let i = 0; i < p.count; i++) {
    mesh.pos.push(p.getX(i), p.getY(i), p.getZ(i))
    mesh.nor.push(n.getX(i), n.getY(i), n.getZ(i))
    mesh.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0)
    if (mesh.channels.color) mesh.col.push(...mesh.color)
    if (mesh.channels.glow) mesh.glow.push(mesh.glowValue)
    mesh.idx.push(b + i)
  }
  if (ng !== g) ng.dispose()
  g.dispose()
}

/** Linear colour of a target albedo on Clay005 (exported for the shells that share the tint). */
export const clayTint = (hex: string) => pbrTint('Clay005', hex)
export { linear }
