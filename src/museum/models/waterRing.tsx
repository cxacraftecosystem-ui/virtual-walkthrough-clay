/**
 * 'water-ring' — the still pool round the lotus island under the oculus (SPECTACLE F12, GRAND
 * §2.5, §3 #33).
 *
 * A dark annulus of water (r0 … r1 at `level`; r0 0 = a full pool) holding the sky and the dome:
 *
 *   surface    materials/waterShader.ts — an analytic reflection of the court: the ring wall up to
 *              the dome's springing, the coffered dome itself (a plan texture drawn here as the
 *              pool sees it, its stepped terraces glowing round the opening) and the sky through
 *              the open 10 m oculus; Fresnel F0 0.02, slow swells
 *   basin      a matte fired-clay lip round the outside, inside the curb
 *   ripples    tap the water (Medium and up): a ring runs out with a drip; now and then a drop
 *              falls from the light-well by itself. While it rains (the weather) the pool fills
 *              with crossing rain rings on every tier.
 *   caustics   Medium and up: light thrown back onto the lip and the island's riser
 *   mirror     High and Ultra: `poolMirror()` says whether other pieces should draw their own
 *              reflections (`withWaterMirror`)
 *
 * The water is not walkable: it lies inside the curb collider (layout.ts 'oculus-plinth').
 */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { ambience } from '../lighting/timeOfDayState'
import { rainNow } from '../lighting/weather/weatherState'
import { createCausticsMaterial } from '../materials/caustics'
import { useMaterials } from '../materials/materials'
import { createPlanarMirror, tickPlanarMirrors } from '../materials/planarMirror'
import { BLACK_TEX, createWaterMaterial, MAX_RIPPLES, waterUniforms, WHITE_TEX, type WaterUniforms } from '../materials/waterShader'
import { annulusFace, cylinderFace, mergeAll } from '../architecture/shellGeometry'
import { caption } from '../spectacle/captions'
import { fireCue } from '../spectacle/cues'
import { spectacleSettings, useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import type { ModelProps } from './types'
import { num, str } from './types'

const FULL = Math.PI * 2
const noRaycast = () => null
const noBeforeRender = () => {}

/** The pool as the rest of the court sees it (the helix, the potter, the rain). */
export const POOL: { r0: number; r1: number; level: number } = { r0: 0, r1: MUSEUM.oculus.rings[1] - 0.05, level: MUSEUM.oculus.poolLevel }

/* ------------------------------------------------------------------ */
/* ripples (module-wide: anyone may drop something in)                 */
/* ------------------------------------------------------------------ */

const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0))
let rippleNext = 0
let clockNow = 0

/** Drop a ring into the pool at (x, z), amplitude 0 … 1. Ignored outside the water. */
export function addRipple(x: number, z: number, amp = 1) {
  const r = Math.hypot(x, z)
  if (r < POOL.r0 - 0.05 || r > POOL.r1 + 0.05) return
  ripples[rippleNext].set(x, z, clockNow, amp)
  rippleNext = (rippleNext + 1) % MAX_RIPPLES
}

/** Is the water a rendered planar mirror on this device (Medium and up, not Lite)? */
export function planarWater(s = spectacleSettings()): boolean {
  return s.caps.waterMirrorPx > 0 && s.mode !== 'lite'
}

/**
 * Should other pieces draw their own reflections in the pool (`withWaterMirror`)? Only where the
 * pool is not already a rendered mirror (which holds them itself).
 */
export function poolMirror(): boolean {
  const s = spectacleSettings()
  return s.caps.poolMirror && s.mode !== 'lite' && !planarWater(s)
}

/* ------------------------------------------------------------------ */
/* the dome as the water sees it                                       */
/* ------------------------------------------------------------------ */

/**
 * The shader reflects a flat "ceiling" at uCeilY: put it at the dome's springing and paint on it,
 * in plan, what a ray from the pool's centre through each point meets: the stepped terraces
 * round the opening, then 5 rings × 28 coffers diminishing towards the oculus, lighter towards
 * the light. The opening itself is the gobo disc (uGoboR), open sky.
 */
const DOME = MUSEUM.dome
const REFL = { ceilY: DOME.springY, wallR: KEY.ringR }

/** Radius on the reflection plane at which a ray from the pool's centre meets plan radius `rho` at height `y`. */
const onPlane = (rho: number, y: number, level: number) => (rho * (REFL.ceilY - level)) / (y - level)

let domeTex: THREE.CanvasTexture | null = null
function domeTexture(level: number): THREE.Texture {
  if (domeTex) return domeTex
  if (typeof document === 'undefined') return BLACK_TEX
  const N = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(N, N)
  const R = KEY.domeSphereR
  const cy = KEY.domeCentreY
  const stopR = DOME.coffers.stopR
  const rib = [0.85, 0.6, 0.52]
  const deep = [0.42, 0.2, 0.15]
  const step = [0.66, 0.4, 0.33]
  const terrace = [0.98, 0.82, 0.72]
  for (let py = 0; py < N; py++)
    for (let px = 0; px < N; px++) {
      const x = (px / N - 0.5) * 2 * REFL.wallR
      const z = (1 - py / N - 0.5) * 2 * REFL.wallR
      const q = Math.hypot(x, z)
      let c = deep
      let k = 0.5
      if (q <= REFL.wallR) {
        // the ray from the pool's centre through (q, ceilY): where it meets the dome's sphere
        const dx = q
        const dy = REFL.ceilY - level
        const L = Math.hypot(dx, dy)
        const ux = dx / L
        const uy = dy / L
        const oy = level - cy
        const b = oy * uy
        const t = -b + Math.sqrt(Math.max(0, b * b - (oy * oy - R * R)))
        const rho = ux * t
        const a = Math.atan2(z, x)
        if (rho < stopR) {
          c = terrace
          k = 1.1
        } else {
          const f = (rho - stopR) / (KEY.ringR - stopR)
          // rings diminish towards the top: equal steps in the square root
          const ringF = Math.sqrt(f) * DOME.coffers.rings
          const v = ringF - Math.floor(ringF)
          const u = (((a / (Math.PI * 2)) * DOME.coffers.perRing) % 1 + 1) % 1
          const edge = Math.min(u, 1 - u, v, 1 - v)
          c = edge < 0.09 ? rib : edge < 0.17 ? step : deep
          k = 1.0 - 0.45 * f
        }
      }
      const i = (py * N + px) * 4
      img.data[i] = Math.min(255, c[0] * k * 255)
      img.data[i + 1] = Math.min(255, c[1] * k * 255)
      img.data[i + 2] = Math.min(255, c[2] * k * 255)
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  domeTex = new THREE.CanvasTexture(cv)
  domeTex.colorSpace = THREE.SRGBColorSpace
  return domeTex
}

/* ------------------------------------------------------------------ */
/* the drum wall as the water sees it                                  */
/* ------------------------------------------------------------------ */

const BAL = MUSEUM.balcony
const REG = MUSEUM.upperRegister
const NICHE_PITCH = (BAL.toDeg - BAL.fromDeg) / REG.niches
const f1 = (x: number) => x.toFixed(4)

/**
 * The shared water shader models the drum as one rose wall with a cove line. The grand court's
 * wall is a dark ground with two lit bands, and those are what still water shows: the balcony's
 * frieze fascia and, above it, the upper register's 24 lit niches over the galleries. This
 * replaces the ring's wall term (only that branch; the dome, the oculus and the sun stay the
 * shader's own) so the pool holds a row of warm lights under the coffers instead of a pink sheet.
 * If the shader's wall branch ever changes shape the material is left as it is.
 */
function withCourtWall(mat: THREE.ShaderMaterial): THREE.ShaderMaterial {
  const src = mat.fragmentShader
  const a = src.indexOf('  if (yw < uCeilY) {')
  const b = src.indexOf('  vec3 q = p + r * tc;')
  if (a < 0 || b < a) return mat
  const nicheY0 = (REG.y0 + REG.y1) / 2 - REG.niche.height / 2
  const nicheHalfU = (REG.niche.width / KEY.ringR / DEG / 2 / NICHE_PITCH).toFixed(4)
  const wall = `  if (yw < uCeilY) {
    vec3 hit = p + r * tw;
    float deg = degrees(atan(hit.z, hit.x));
    if (deg < ${f1(BAL.fromDeg - 360)}) deg += 360.0;
    if (deg < ${f1(BAL.fromDeg)}) deg += 360.0;
    float onArc = step(deg, ${f1(BAL.toDeg)});
    // the lower wall: one dim ground under the balcony
    vec3 col = vec3(0.075, 0.04, 0.032);
    // the balcony's fascia (the procession frieze), warm and lit from the soffit
    float fas = smoothstep(${f1(BAL.fascia.y0 - 0.7)}, ${f1(BAL.fascia.y0 + 0.2)}, yw) * (1.0 - smoothstep(${f1(BAL.fascia.y1 - 0.2)}, ${f1(BAL.fascia.y1 + 0.7)}, yw));
    col = mix(col, vec3(0.26, 0.1, 0.06), fas * onArc);
    // the upper register: dark relief panels between lit niches
    float reg = smoothstep(${f1(REG.y0 - 0.4)}, ${f1(REG.y0 + 0.4)}, yw) * (1.0 - smoothstep(${f1(REG.y1 - 0.4)}, ${f1(REG.y1 + 0.4)}, yw));
    col = mix(col, vec3(0.12, 0.055, 0.04), reg);
    float u = fract((deg - ${f1(BAL.fromDeg)}) / ${f1(NICHE_PITCH)});
    float nu = smoothstep(0.5 - ${nicheHalfU} - 0.08, 0.5 - ${nicheHalfU} + 0.04, u) * (1.0 - smoothstep(0.5 + ${nicheHalfU} - 0.04, 0.5 + ${nicheHalfU} + 0.08, u));
    float nv = smoothstep(${f1(nicheY0 - 0.5)}, ${f1(nicheY0 + 0.3)}, yw) * (1.0 - smoothstep(${f1(nicheY0 + REG.niche.height - 0.3)}, ${f1(nicheY0 + REG.niche.height + 0.5)}, yw));
    col += vec3(1.0, 0.6, 0.32) * 0.9 * nu * nv * onArc;
    // the cornice at the springing, catching the dome's wash
    col = mix(col, vec3(0.32, 0.15, 0.1), smoothstep(uCeilY - 0.4, uCeilY - 0.12, yw));
    return col * (0.4 + 0.6 * uRoom + 0.3 * uNight);
  }
`
  mat.fragmentShader = src.slice(0, a) + wall + src.slice(b)
  mat.needsUpdate = true
  return mat
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

const sunScratch = new THREE.Vector3()

export function WaterRing({ config }: ModelProps) {
  const sp = useSpectacle()
  const m = useMaterials()
  const scene = useThree((s) => s.scene)
  const r0 = num(config, 'r0', POOL.r0)
  const r1 = num(config, 'r1', POOL.r1)
  const level = num(config, 'level', POOL.level)
  const tapRipples = config.props?.tapRipples !== false && config.props?.tapRipples !== 'false'
  const tint = str(config, 'tint', '#0a0e12')
  useEffect(() => {
    POOL.r0 = r0
    POOL.r1 = r1
    POOL.level = level
  }, [r0, r1, level])

  // the dome as the water sees it (drawn once)
  const dome = useMemo(() => domeTexture(level), [level])

  const uniforms = useMemo<WaterUniforms>(() => {
    const u = waterUniforms()
    u.uRipples.value = ripples
    return u
  }, [])
  useEffect(() => {
    uniforms.uTint.value.set(tint)
    uniforms.uLevel.value = level
    uniforms.uRim.value.set(r0, r1)
    uniforms.uCrown.value = dome
    uniforms.uCrownR.value = REFL.wallR
    // the open oculus, as it appears on the reflection plane from the pool's centre
    uniforms.uGobo.value = WHITE_TEX
    uniforms.uGoboR.value = onPlane(MUSEUM.oculus.r, DOME.lightWell.y0, level)
    uniforms.uCeilY.value = REFL.ceilY
    uniforms.uWallR.value = REFL.wallR
    uniforms.uBandY.value = MUSEUM.pavilion.mezzanineBand
  }, [uniforms, tint, level, dome, r0, r1])
  // Medium and up: a rendered mirror (the dome, its coffers, the oculus sky, the lotus, all of it);
  // Low and Lite: the analytic reflection
  const planarPx = planarWater(sp) ? sp.caps.waterMirrorPx : 0
  const camera = useThree((s) => s.camera)
  const mirror = useMemo(() => (planarPx > 0 ? createPlanarMirror(level, planarPx, (c) => c === camera, planarPx >= 1024 ? 4 : 0) : null), [planarPx, level, camera])
  useEffect(() => () => mirror?.dispose(), [mirror])
  const water = useMemo(() => {
    if (!mirror) return withCourtWall(createWaterMaterial('ring', uniforms))
    uniforms.uMirror.value = mirror.texture
    uniforms.uMirrorMat.value = mirror.matrix
    return createWaterMaterial('ring', uniforms, true)
  }, [uniforms, mirror])
  useEffect(() => () => water.dispose(), [water])

  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(r0, r1, 160, 2)
    g.rotateX(-Math.PI / 2)
    g.translate(0, level, 0)
    return g
  }, [r0, r1, level])
  // the curb's brass edge: a narrow polished band just proud of the water, its inner face a
  // hand's breadth down into the pool (the curb itself is models/clay.tsx OCULUS_PLINTH)
  const lip = useMemo(() => {
    const t = 0.05
    const top = MUSEUM.oculus.curbHeight + 0.004
    return mergeAll([annulusFace(0, 0, r1, r1 + t, 0, FULL, top, true), cylinderFace(0, 0, r1, 0, FULL, level - 0.03, top, 'in')])
  }, [r1, level])
  // a caustic film on the face just above the water: the edge's inside (and an island's riser, if any)
  const causticGeo = useMemo(
    () => mergeAll([cylinderFace(0, 0, r1 - 0.002, 0, FULL, level, MUSEUM.oculus.curbHeight, 'in'), r0 > 0.05 ? cylinderFace(0, 0, r0 + 0.002, 0, FULL, level, MUSEUM.oculus.curbHeight, 'out') : null]),
    [r0, r1, level],
  )
  const caustics = useMemo(() => createCausticsMaterial(), [])
  useEffect(
    () => () => {
      geo.dispose()
      lip?.dispose()
      causticGeo?.dispose()
      caustics.dispose()
    },
    [geo, lip, causticGeo, caustics],
  )

  // the sun, as the scene's one directional light points it (looked up once it exists)
  const sunRef = useMemo(() => ({ light: null as THREE.DirectionalLight | null, tries: 0 }), [])
  const findSun = () => {
    if (sunRef.light || sunRef.tries++ % 60 !== 0) return sunRef.light
    scene.traverse((o) => {
      if (!sunRef.light && (o as THREE.DirectionalLight).isDirectionalLight) sunRef.light = o as THREE.DirectionalLight
    })
    return sunRef.light
  }

  const allowTap = tapRipples && sp.mode !== 'lite' && sp.mode !== 'still'
  const drips = sp.mode === 'full'
  const showCaustics = sp.caps.caustics && sp.mode !== 'lite'
  const st = useMemo(() => ({ nextDrip: 6 }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    clockNow = t
    tickPlanarMirrors()
    const u = uniforms
    u.uTime.value = t
    u.uDay.value = ambience.daylight
    u.uNight.value = ambience.night
    // the court is a dark room round a bright opening: the wall and dome the water holds are
    // dim (the drum's lower wall reads near-black against the sky disc), so the pool stays a
    // deep mirror and never a pale pink sheet
    // (dim: the warm dome must not turn the water brown; the sky disc and the lit register carry it)
    u.uRoom.value = 0.12 + 0.3 * ambience.daylight + 0.08 * ambience.night
    u.uRain.value = rainNow()
    // a still pool: the swells are a breath, so the reflected wall barely wavers (no white streaks)
    u.uSwell.value = sp.mode === 'still' ? 0 : 0.4
    const sun = findSun()
    if (sun) {
      sunScratch.copy(sun.position).sub(sun.target.position).normalize()
      u.uSunDir.value.copy(sunScratch)
      u.uSunVis.value = THREE.MathUtils.clamp(sunScratch.y * 4, 0, 1) * ambience.daylight
    }
    u.uSkyZenith.value.setRGB(0.26 + 0.24 * ambience.daylight, 0.34 + 0.27 * ambience.daylight, 0.46 + 0.26 * ambience.daylight).multiplyScalar(1 - 0.9 * ambience.night)
    u.uSkyHorizon.value.setRGB(0.85, 0.82 + 0.06 * ambience.daylight, 0.78 + 0.12 * ambience.daylight).lerp(new THREE.Color(0.95, 0.55, 0.32), ambience.twilight * 0.6).multiplyScalar(1 - 0.9 * ambience.night)
    caustics.uniforms.uTime.value = t
    caustics.uniforms.uLevel.value = level
    // faint: a shimmer on the lip and the island's riser, never a striped band
    caustics.uniforms.uGain.value = 0.16 * ambience.daylight * (1 - 0.8 * rainNow())
    // now and then a drop falls from the lowest cups into the pool
    if (drips && t > st.nextDrip) {
      st.nextDrip = t + 7 + Math.random() * 9
      const a = Math.random() * FULL
      const r = THREE.MathUtils.lerp(r0 + 0.1, r1 - 0.1, Math.random())
      addRipple(r * Math.cos(a), r * Math.sin(a), 0.45)
    }
  })

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!allowTap || e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    addRipple(e.point.x, e.point.z, 1)
    fireCue('court:drip', { source: 'visitor', data: { x: e.point.x, z: e.point.z } })
    caption('caption.drip')
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!allowTap) return
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    if (allowTap) document.body.style.cursor = ''
  }

  // the scene object stands at the court centre; the pool is built in court coordinates
  return (
    <group name="water-ring">
      <mesh geometry={geo} material={water} onBeforeRender={mirror?.onBeforeRender ?? noBeforeRender} onClick={onTap} onPointerOver={onOver} onPointerOut={onOut} />
      {/* the brass edge round the water (p07l): one thin warm line, the pool set into the floor */}
      {lip && <mesh geometry={lip} material={m.brass} receiveShadow raycast={noRaycast} />}
      {causticGeo && <mesh geometry={causticGeo} material={caustics} visible={showCaustics} renderOrder={2} raycast={noRaycast} />}
    </group>
  )
}
