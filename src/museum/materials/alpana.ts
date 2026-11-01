/**
 * LIVING ALPANA — the rice-flour floor drawing along the Parikrama walk (F21), and the shader
 * that lets it draw itself in round the visitor's footsteps.
 *
 *   alpanaTexture(pattern, px)   one tileable repeat of the band (white lines on clear), drawn on
 *                                a canvas: 'kolam-a' a dotted-grid kolam of loops round the dots
 *                                (pulli kolam), 'kolam-b' a chain of eight-petalled flowers with
 *                                creeper scrolls between them
 *   alpanaMaterial(...)          a standard material (it takes the pergola's sun stripes and the
 *                                pavilion's light) with the reveal patched in: a fragment is drawn
 *                                only where its plan angle lies within [uRevealMin, uRevealMax]
 *                                (radians), with a soft, grainy front a brush-width wide so the
 *                                lines appear to be laid down rather than switched on
 *
 * The band's UVs: u = metres along the arc, v = 0 … 1 across it (see architecture/Parikrama.tsx).
 * The revealed span is kept for the browser session, so the walk stays drawn behind the visitor.
 */
import * as THREE from 'three'

export type AlpanaPattern = 'kolam-a' | 'kolam-b'

/** Metres one repeat covers along the walk (its height spans the band's width). */
export const ALPANA_REPEAT_M = 1.4

const texCache = new Map<string, THREE.CanvasTexture>()

/** One repeat of the band as an alpha mask (white = drawn). */
export function alpanaTexture(pattern: AlpanaPattern, px = 512): THREE.CanvasTexture {
  const key = `${pattern}-${px}`
  const hit = texCache.get(key)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = px
  cv.height = px
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, px, px)
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const S = px
  // the two border lines of the band (rice-flour rules), a little in from each edge
  const rule = (y: number, w: number) => {
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(S, y)
    ctx.stroke()
  }
  rule(S * 0.05, S * 0.012)
  rule(S * 0.95, S * 0.012)
  rule(S * 0.09, S * 0.005)
  rule(S * 0.91, S * 0.005)
  if (pattern === 'kolam-a') {
    // a 4 × 4 grid of dots; a loop round each dot, and diagonal lozenges joining them
    const n = 4
    const c = (S * 0.76) / n
    const ox = (S - c * n) / 2
    const oy = S * 0.12
    ctx.lineWidth = S * 0.011
    for (let i = 0; i < n; i++)
      for (let k = 0; k < n; k++) {
        const x = ox + c * (i + 0.5)
        const y = oy + c * (k + 0.5)
        ctx.beginPath()
        ctx.arc(x, y, S * 0.008, 0, Math.PI * 2)
        ctx.fill()
        // a four-lobed loop round the dot
        ctx.beginPath()
        for (let p = 0; p <= 64; p++) {
          const t = (p / 64) * Math.PI * 2
          const rr = c * (0.3 + 0.08 * Math.cos(4 * t))
          const px2 = x + Math.cos(t) * rr
          const py2 = y + Math.sin(t) * rr
          if (p === 0) ctx.moveTo(px2, py2)
          else ctx.lineTo(px2, py2)
        }
        ctx.stroke()
      }
    // lozenges between the dots (they tile across the repeat's ends)
    ctx.lineWidth = S * 0.008
    for (let i = 0; i <= n; i++)
      for (let k = 0; k <= n; k++) {
        const x = ox + c * i
        const y = oy + c * k
        if (y < oy - 1 || y > oy + c * n + 1) continue
        const d = c * 0.2
        ctx.beginPath()
        ctx.moveTo(x, y - d)
        ctx.lineTo(x + d, y)
        ctx.lineTo(x, y + d)
        ctx.lineTo(x - d, y)
        ctx.closePath()
        ctx.stroke()
      }
    // a running wave along each rule
    ctx.lineWidth = S * 0.007
    for (const y0 of [S * 0.115, S * 0.885]) {
      ctx.beginPath()
      for (let p = 0; p <= 96; p++) {
        const x = (p / 96) * S
        const y = y0 + Math.sin((p / 96) * Math.PI * 2 * 4) * S * 0.014
        if (p === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else {
    // a chain of two eight-petalled flowers per repeat, scrolls between
    ctx.lineWidth = S * 0.01
    for (const cx of [S * 0.25, S * 0.75]) {
      const cy = S / 2
      const R = S * 0.2
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(a)
        ctx.beginPath()
        ctx.moveTo(R * 0.25, 0)
        ctx.quadraticCurveTo(R * 0.62, -R * 0.26, R, 0)
        ctx.quadraticCurveTo(R * 0.62, R * 0.26, R * 0.25, 0)
        ctx.stroke()
        ctx.restore()
      }
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2)
      ctx.lineWidth = S * 0.005
      ctx.stroke()
      ctx.lineWidth = S * 0.01
    }
    // creeper: an S-scroll joining the flowers across the repeat's seam
    ctx.lineWidth = S * 0.008
    for (const sgn of [-1, 1]) {
      ctx.beginPath()
      for (let p = 0; p <= 96; p++) {
        const t = p / 96
        const x = t * S
        const y = S / 2 + sgn * (S * 0.3 + Math.sin(t * Math.PI * 4) * S * 0.035)
        if (p === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    for (let i = 0; i < 8; i++) {
      const x = (i + 0.5) * (S / 8)
      for (const y of [S * 0.16, S * 0.84]) {
        ctx.beginPath()
        ctx.arc(x, y, S * 0.012, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.anisotropy = 8
  t.needsUpdate = true
  texCache.set(key, t)
  return t
}

export interface AlpanaUniforms {
  uRevealMin: { value: number }
  uRevealMax: { value: number }
  /** Width of the drawing front (radians). */
  uFront: { value: number }
}

/**
 * The band's material: rice-flour white on the floor, alpha from the pattern, revealed between
 * uRevealMin and uRevealMax (plan angle, radians); outside that span a faint ghost of it shows. Its uniforms are in `userData.uniforms`.
 */
export function alpanaMaterial(pattern: AlpanaPattern, color: THREE.ColorRepresentation, px: number) {
  const uniforms: AlpanaUniforms = {
    uRevealMin: { value: 0 },
    uRevealMax: { value: 0 },
    uFront: { value: 0.12 },
  }
  const map = alpanaTexture(pattern, px)
  const m = new THREE.MeshStandardMaterial({
    name: 'livingAlpana',
    color: new THREE.Color(color),
    alphaMap: map,
    transparent: true,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  m.userData.uniforms = uniforms
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPlanXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlanXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uRevealMin;
uniform float uRevealMax;
uniform float uFront;
varying vec2 vPlanXZ;
float alpanaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
{
  float a = atan(vPlanXZ.y, vPlanXZ.x);
  // how far outside the drawn span (radians); grainy so the front reads as hand-laid powder
  float outside = max(uRevealMin - a, a - uRevealMax);
  float grain = alpanaHash(floor(vPlanXZ * 90.0)) * 0.6 * uFront;
  // ahead of the visitor the pattern is already there, faint (a ghost of last night's alpana);
  // their footsteps lay it down crisp and white
  diffuseColor.a *= max(0.18, 1.0 - smoothstep(-uFront, 0.0, outside + grain - 0.3 * uFront));
}`,
      )
  }
  m.customProgramCacheKey = () => 'livingAlpana'
  return m as THREE.MeshStandardMaterial & { userData: { uniforms: AlpanaUniforms } }
}
