/**
 * 'strata-wall' — Earth Section on the back of the description wall (SPECTACLE F6).
 *
 * The concave back of H (`surfaces`, h-inner-1 … 4: 52° … 128° at r 7.875) becomes a 10 m
 * cross-section of earth from 0.1 to 3.5 m: kaolin at the foot, laterite, sand, a clay band,
 * silt with clay lenses and topsoil with roots at the top — drawn procedurally in the shader from
 * wall coordinates (materials/decorTextures.ts genStrata), so it stays sharp up close;
 * `layers` overrides the default. A slit of light sweeps slowly down the layers every
 * `sweepSec`, as if someone were digging — `uDigLight` in the shader, no real light. A small
 * plate says what it is: a typical river-plain section, not a survey. The layers are not named
 * (placeholder silence).
 *
 * The panel is a bent grid (models/bend.ts) standing off the plaster, DISPLACED by the beds'
 * differential erosion (genStrata's `strataRelief`): the hard laterite and the clay band weather
 * out by a few centimetres, the sand is scoured back, the topsoil overhangs, every step a soft
 * shoulder; the relief dies away towards the panel's edges, which are ragged (the section is dug
 * out of the plaster, never a framed sheet), and every contact bleeds over a few centimetres.
 *   Low      3 noise octaves, bump relief, the sweep band
 *   Medium   5 octaves
 *   High     + a parallax step into the relief (strataPOM > 0); Ultra 6 octaves
 * Still form: no sweep (the section in even light).
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { SURFACES, type SurfaceId } from '../config/layout'
import { DEG, MUSEUM } from '../config/museum'
import { useLang } from '../i18n'
import { ambience } from '../lighting/timeOfDayState'
import { DEFAULT_STRATA, genStrata, parseStrata } from '../materials/decorTextures'
import { texCanvas } from '../materials/mandalaBand'
import { useSpectacle } from '../spectacle/settings'
import { useCue } from '../spectacle/cues'
import { bendToCylinder, wallGrid } from './bend'
import type { ModelProps } from './types'
import { num, str } from './types'

const noRaycast = () => null
const HW = MUSEUM.descriptionWall
/** The concave back face of H. */
const FACE_R = HW.r - HW.thickness / 2
const Y = { y0: 0.1, y1: 3.5 }
/** Relief depth for parallax (m). */
const DEPTH = 0.02
const PROUD = 0.004
/** The displaced panel's stand-off at full relief (the sand's scour stays in front of the plaster). */
const STANDOFF = 0.026

const LABEL: Record<'en' | 'hi' | 'bn', [string, string]> = {
  en: ['Earth section', 'A typical river-plain section, not a survey.'],
  hi: ['मिट्टी की परतें', 'नदी के मैदान की एक सामान्य परत-रचना, किसी सर्वेक्षण का माप नहीं।'],
  bn: ['মাটির স্তর', 'নদী-সমভূমির একটি সাধারণ স্তরবিন্যাস, কোনো জরিপের মাপ নয়।'],
}

type StrataU = { uDigY: { value: number }; uDig: { value: number }; uParallax: { value: number } }

/**
 * The section as a standard material whose colour and relief come from the procedural strata
 * (materials/decorTextures.ts genStrata) in wall coordinates: bump from the height's screen
 * derivatives on every tier, a parallax offset along the view on High and Ultra (`parallax`).
 */
function strataMaterial(glsl: string, key: string, parallax: boolean, u: StrataU, lengthM: number) {
  const m = new THREE.MeshStandardMaterial({ name: 'strata', roughness: 0.94, metalness: 0, envMapIntensity: 0.45 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vWallP;
varying vec3 vWallT;
varying vec2 vSUv;`,
      )
      .replace('#include <common>', `#include <common>\n${glsl}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWallP = vec2(atan(wp.z, wp.x) * ${FACE_R.toFixed(4)}, wp.y);
  float a = atan(wp.z, wp.x);
  vWallT = normalize(normalMatrix * vec3(-sin(a), 0.0, cos(a)));
  vSUv = uv;
  // the beds' relief, dying away towards the panel's edges
  float tap = smoothstep(0.0, 0.035, uv.x) * smoothstep(1.0, 0.965, uv.x) * smoothstep(0.0, 0.09, uv.y) * smoothstep(1.0, 0.88, uv.y);
  transformed += normalize(objectNormal) * (${STANDOFF.toFixed(3)} + strataRelief(vWallP)) * tap;
}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uDigY;
uniform float uDig;
uniform float uParallax;
varying vec2 vWallP;
varying vec3 vWallT;
varying vec2 vSUv;
${glsl}
vec3 strataAlbedo;
float strataH;
vec3 strataBump(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
{
  vec2 wp = vWallP;
${
  parallax
    ? `  // one parallax step: look into the relief along the view
  vec3 vv = normalize(vViewPosition);
  vec3 nn = normalize(vNormal);
  vec3 bb = normalize(cross(nn, vWallT));
  vec3 vt = vec3(dot(vv, vWallT), dot(vv, bb), dot(vv, nn));
  vec3 a0; float h0;
  strata(wp, a0, h0);
  // (faded out at grazing angles: a long offset there smeared the beds into streaks)
  wp -= vt.xy / max(vt.z, 0.5) * (1.0 - h0) * uParallax * smoothstep(0.3, 0.65, vt.z);`
    : ''
}
  strata(wp, strataAlbedo, strataH);
  // the edges are dug, not cut: ragged where the section meets the plaster round it
  float ragT = ${Y.y1.toFixed(3)} - 0.03 - 0.16 * sFbm(vec2(vWallP.x * 1.6, 2.0));
  float ragB = ${Y.y0.toFixed(3)} + 0.02 + 0.07 * sFbm(vec2(vWallP.x * 2.3, 7.0));
  float ragS = 0.03 + 0.12 * sFbm(vec2(vWallP.y * 2.0, 9.0));
  if (vWallP.y > ragT || vWallP.y < ragB || min(vSUv.x, 1.0 - vSUv.x) * ${lengthM.toFixed(3)} < ragS) discard;
  // the weathered steps between the beds light as relief
  strataH += strataRelief(vWallP) * 28.0;
}`,
      )
      .replace('#include <map_fragment>', 'diffuseColor.rgb *= strataAlbedo;')
      .replace(
        '#include <normal_fragment_maps>',
        `normal = strataBump(-vViewPosition, normal, vec2(dFdx(strataH), dFdy(strataH)) * 0.022, faceDirection);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  // the digging light: a soft slit moving down the section, raking from above
  float band = exp(-pow((vWallP.y - uDigY) / 0.09, 2.0));
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float rake = clamp(dot(normal, upV) * 2.4 + 0.6, 0.0, 1.7);
  totalEmissiveRadiance += diffuseColor.rgb * band * uDig * rake;
}`,
      )
  }
  m.customProgramCacheKey = () => `strata|${key}|${parallax ? 1 : 0}|${lengthM.toFixed(3)}`
  return m
}

/** The plate: two lines of text on buff clay, drawn once per language. */
function labelTexture(lang: 'en' | 'hi' | 'bn'): THREE.CanvasTexture {
  const [c, ctx] = texCanvas(1024, 256)
  ctx.fillStyle = '#e9dcc6'
  ctx.fillRect(0, 0, 1024, 256)
  ctx.strokeStyle = '#7a2e24'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, 1004, 236)
  const [title, sub] = LABEL[lang]
  ctx.fillStyle = '#3b241b'
  ctx.textBaseline = 'middle'
  ctx.font = '600 64px "Noto Serif", "Noto Sans Devanagari", "Noto Sans Bengali", Georgia, serif'
  ctx.fillText(title, 48, 92)
  ctx.font = '400 40px "Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", system-ui, sans-serif'
  ctx.fillStyle = '#5a3a2c'
  let s = sub
  while (ctx.measureText(s).width > 930 && s.length > 4) s = s.slice(0, -2)
  ctx.fillText(s === sub ? sub : `${s}…`, 48, 182)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function StrataWall({ config }: ModelProps) {
  const sp = useSpectacle()
  const lang = useLang()
  const sweepSec = Math.max(8, num(config, 'sweepSec', 40))
  const layersText = str(config, 'layers', '')
  const surfacesText = str(config, 'surfaces', 'h-inner-1,h-inner-2,h-inner-3,h-inner-4')
  // the angular span the listed facets cover on H's back (the facets tile 52° … 128°)
  const span = useMemo(() => {
    const ids = surfacesText
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is SurfaceId => s in SURFACES)
    if (!ids.length) return { a0: HW.fromDeg, a1: HW.toDeg }
    const angs = ids.flatMap((id) => {
      const s = SURFACES[id]
      const ends = [s.a, [s.a[0] + s.dir[0] * s.range[1], s.a[1] + s.dir[1] * s.range[1]]]
      return ends.map(([x, z]) => Math.atan2(z, x) / DEG)
    })
    return { a0: Math.max(HW.fromDeg, Math.min(...angs) - 0.4), a1: Math.min(HW.toDeg, Math.max(...angs) + 0.4) }
  }, [surfacesText])
  const lengthM = (span.a1 - span.a0) * DEG * FACE_R - 0.16
  const heightM = Y.y1 - Y.y0
  const caps = sp.caps
  const layers = useMemo(() => (layersText ? parseStrata(layersText) : DEFAULT_STRATA), [layersText])
  // (one more octave than the texture tier suggests from Medium up: the section reads sharp up close)
  const octaves = caps.spectacleTexPx >= 2048 ? 7 : caps.spectacleTexPx >= 1024 ? 6 : 3
  const shaderSrc = useMemo(() => genStrata(layers, 3, Y.y0, Y.y1, octaves), [layers, octaves])
  const parallax = caps.strataPOM > 0
  const u = useMemo<StrataU>(() => ({ uDigY: { value: -10 }, uDig: { value: 0 }, uParallax: { value: DEPTH } }), [])
  const mat = useMemo(() => strataMaterial(shaderSrc.glsl, shaderSrc.key, parallax, u, lengthM), [shaderSrc, parallax, u, lengthM])
  useEffect(() => () => mat.dispose(), [mat])

  // fine enough to carry the beds' weathered steps (a few cm shoulders); coarser below High, where
  // the bump does the fine work (GRAND §10: the full grid alone is ~100k triangles)
  const coarse = caps.strataPOM > 0 ? 1 : 1.8
  const geo = useMemo(() => {
    const g = wallGrid(-lengthM / 2, lengthM / 2, Y.y0, Y.y1, 0.05 * coarse, { unit: true, rows: Math.ceil(heightM / (0.03 * coarse)) })
    return bendToCylinder(g, { r: FACE_R - PROUD, aMidDeg: (span.a0 + span.a1) / 2, concave: true })
  }, [lengthM, heightM, span.a0, span.a1, coarse])
  useEffect(() => () => geo.dispose(), [geo])

  // the plate, at the west end near the floor
  const plate = useMemo(() => {
    const a = (span.a1 - 2.2) * DEG
    const r = FACE_R - PROUD - 0.008
    const x = r * Math.cos(a)
    const z = r * Math.sin(a)
    return { pos: [x, 0.42, z] as [number, number, number], rotY: Math.atan2(-Math.cos(a), -Math.sin(a)) }
  }, [span.a1])
  const plateTex = useMemo(() => (typeof document === 'undefined' ? null : labelTexture(lang)), [lang])
  useEffect(() => () => plateTex?.dispose(), [plateTex])

  const still = sp.mode === 'still'
  const st = useMemo(() => ({ t0: 0, replay: false }), [])
  useCue('strata:sweep', () => {
    st.replay = true
  })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (st.replay) {
      st.t0 = t
      st.replay = false
    }
    if (still) {
      u.uDig.value = 0
      return
    }
    // sweep down over 70 % of the period, then rest dark; brighter by night
    const ph = ((t - st.t0) % sweepSec) / sweepSec
    const k = Math.min(1, ph / 0.7)
    u.uDigY.value = Y.y1 + 0.1 - k * (heightM + 0.25)
    u.uDig.value = ph < 0.72 ? 0.9 + 0.8 * ambience.night : 0
  })

  return (
    <group name="strata-wall">
      <mesh geometry={geo} material={mat} receiveShadow raycast={noRaycast} />
      {plateTex && (
        <mesh position={plate.pos} rotation={[0, plate.rotY, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.62, 0.155]} />
          <meshStandardMaterial map={plateTex} roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}
