/**
 * WATER — the still dark water of the oculus ring (F12) and the entrance rill (F2), as one
 * ShaderMaterial with an ANALYTIC reflection: no reflection render, no extra pass.
 *
 * The reflected view ray is intersected with the room it would see, in closed form:
 *
 *   'ring'   the gallery drum (cylinder r ≈ 7.85: rose clay, the oxblood duplex line, blush above),
 *            the soffit plane (5.75 m): beyond r 4.6 plain clay, r 2.6 … 4.6 the crown mandala
 *            (sampled from its plan-mapped texture), inside r 2.6 the open sky — through the jali
 *            lace (the gobo texture) — with the sun's glint when it lines up
 *   'rill'   the open sky (a horizon → zenith gradient) and the entrance front: the rammed-earth
 *            wall and the warm doorway, so the rill "mirrors the door"
 *
 * The surface normal is flat water plus four slow swells, a fine procedural ripple, up to 16 tap
 * ripples (`uRipples[i] = (x, z, startTime, amplitude)`) and, while it rains, statistical rain
 * rings in cells. Fresnel uses F0 0.02. The rill scrolls its detail along its length (`uFlow`).
 *
 * Every tier shares one program per mode (`#define WATER_RILL`); Low simply feeds no ripples.
 */
import * as THREE from 'three'

export const MAX_RIPPLES = 16

export interface WaterUniforms {
  [k: string]: THREE.IUniform
  uTime: { value: number }
  uTint: { value: THREE.Color }
  uLevel: { value: number }
  uSkyZenith: { value: THREE.Color }
  uSkyHorizon: { value: THREE.Color }
  /** Brightness of the sky and of daylit surfaces seen in the water. */
  uDay: { value: number }
  uNight: { value: number }
  /** Interior light level (walls, ceiling) seen in the water. */
  uRoom: { value: number }
  uSunDir: { value: THREE.Vector3 }
  uSunVis: { value: number }
  uCrown: { value: THREE.Texture | null }
  uCrownR: { value: number }
  uGobo: { value: THREE.Texture | null }
  uGoboR: { value: number }
  uCeilY: { value: number }
  uWallR: { value: number }
  uBandY: { value: number }
  uRipples: { value: THREE.Vector4[] }
  uRain: { value: number }
  uSwell: { value: number }
  uFlow: { value: THREE.Vector2 }
  /** Rill: entrance front plane z, half width, door half width / height, wall top. */
  uFacade: { value: THREE.Vector4 }
  uDoor: { value: THREE.Vector2 }
  /** The rill's building behind the facade: dome centre y, dome radius, drum radius, drum height (0 = none). */
  uBuilding: { value: THREE.Vector4 }
  /** Warm light from inside the open door (rill reflection). */
  uDoorGlow: { value: THREE.Color }
  uReflect: { value: number }
  /** Ring: inner and outer radius of the water (its meniscus lines). */
  uRim: { value: THREE.Vector2 }
  /** WATER_PLANAR: the rendered mirror (materials/planarMirror.ts) and its world → texture matrix. */
  uMirror: { value: THREE.Texture | null }
  uMirrorMat: { value: THREE.Matrix4 }
}

export function waterUniforms(): WaterUniforms {
  return {
    uTime: { value: 0 },
    uTint: { value: new THREE.Color('#1a1210') },
    uLevel: { value: 0.38 },
    uSkyZenith: { value: new THREE.Color('#4f86d6') },
    uSkyHorizon: { value: new THREE.Color('#cfe0f0') },
    uDay: { value: 1 },
    uNight: { value: 0 },
    uRoom: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
    uSunVis: { value: 1 },
    uCrown: { value: null },
    uCrownR: { value: 4.6 },
    uGobo: { value: null },
    uGoboR: { value: 2.6 },
    uCeilY: { value: 5.75 },
    uWallR: { value: 7.85 },
    uBandY: { value: 3.05 },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
    uRain: { value: 0 },
    uSwell: { value: 1 },
    uFlow: { value: new THREE.Vector2(0, 0) },
    uFacade: { value: new THREE.Vector4(19.85, 2.64, 1.05, 3.6) },
    uDoor: { value: new THREE.Vector2(6.1, 0) },
    uBuilding: { value: new THREE.Vector4(0, 0, 0, 0) },
    uDoorGlow: { value: new THREE.Color('#ffb877') },
    uReflect: { value: 1 },
    uRim: { value: new THREE.Vector2(2.05, 2.95) },
    uMirror: { value: null },
    uMirrorMat: { value: new THREE.Matrix4() },
  }
}

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uLevel;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform float uDay;
uniform float uNight;
uniform float uRoom;
uniform vec3 uSunDir;
uniform float uSunVis;
uniform sampler2D uCrown;
uniform float uCrownR;
uniform sampler2D uGobo;
uniform float uGoboR;
uniform float uCeilY;
uniform float uWallR;
uniform float uBandY;
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uRain;
uniform float uSwell;
uniform vec2 uFlow;
uniform vec4 uFacade;
uniform vec2 uDoor;
uniform vec4 uBuilding;
uniform vec3 uDoorGlow;
uniform float uReflect;
uniform vec2 uRim;
#ifdef WATER_PLANAR
uniform sampler2D uMirror;
uniform mat4 uMirrorMat;
#endif
varying vec3 vWorld;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// height field gradient (d/dx, d/dz) of the water surface
vec2 waveGrad(vec2 p) {
  vec2 g = vec2(0.0);
  // four slow swells: faint, but enough that the reflected wall and its frieze line waver (the
  // one cue that says "water" from standing height)
  g += uSwell * 0.0042 * vec2(cos(p.x * 3.1 + uTime * 0.35), 0.0) * 3.1;
  g += uSwell * 0.0034 * vec2(0.0, cos(p.y * 2.7 - uTime * 0.29)) * 2.7;
  float d1 = dot(p, vec2(0.71, 0.70));
  g += uSwell * 0.0026 * cos(d1 * 4.3 + uTime * 0.41) * 4.3 * vec2(0.71, 0.70);
  float d2 = dot(p, vec2(-0.6, 0.8));
  g += uSwell * 0.0020 * cos(d2 * 5.9 - uTime * 0.37) * 5.9 * vec2(-0.6, 0.8);
  // a still pool (Still form) keeps one frozen, gentle undulation instead of a dead-flat plane
  g += (1.0 - uSwell) * 0.006 * vec2(cos(p.x * 3.1 + 1.3), cos(p.y * 2.7 + 0.4));
  // fine detail (scrolls along a rill)
  vec2 q = p * 9.0 + uFlow * uTime;
  float e = 0.02;
  float n0 = vnoise(q);
  g += 0.010 * vec2(vnoise(q + vec2(e, 0.0)) - n0, vnoise(q + vec2(0.0, e)) - n0) / e * 0.11;
  // tap ripples: an expanding ring wave with a decaying envelope
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 7.0) continue;
    vec2 dv = p - r.xy;
    float d = length(dv) + 1e-4;
    float front = age * 0.42;
    float x = d - front;
    float env = exp(-x * x * 18.0) * exp(-age * 0.75) * r.w;
    g += (dv / d) * cos(x * 46.0) * 46.0 * 0.0032 * env;
  }
  // rain: a ring in every cell, each on its own clock
  if (uRain > 0.001) {
    for (int k = 0; k < 2; k++) {
      vec2 cp = p * (k == 0 ? 7.0 : 11.0) + float(k) * 3.7;
      vec2 cell = floor(cp);
      for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(float(i), float(j));
          float h = hash12(c);
          vec2 ctr = c + vec2(hash12(c + 7.1), hash12(c + 3.3));
          float t = fract(uTime * (0.9 + h) + h * 9.0);
          vec2 dv = cp - ctr;
          float d = length(dv) + 1e-4;
          float x = d - t * 0.9;
          float env = exp(-x * x * 60.0) * (1.0 - t) * step(0.35, hash12(c + floor(uTime * (0.9 + h) + h * 9.0)));
          g += (dv / d) * cos(x * 40.0) * 0.028 * env * uRain;
        }
    }
  }
  return g;
}

vec3 sky(vec3 r) {
  float t = clamp(r.y, 0.0, 1.0);
  vec3 c = mix(uSkyHorizon, uSkyZenith, pow(t, 0.55));
  return c * (0.06 + 1.6 * uDay) + vec3(0.02, 0.03, 0.06) * uNight;
}

#ifdef WATER_RILL
vec3 surroundings(vec3 p, vec3 r) {
  // the entrance front (plane z = uFacade.x, facing +z) — seen when the ray heads back to it
  if (r.z < -1e-4) {
    float t = (uFacade.x - p.z) / r.z;
    vec3 q = p + r * t;
    if (t > 0.0 && abs(q.x) < uFacade.y && q.y < uDoor.x) {
      float door = step(abs(q.x), uFacade.z) * step(q.y, uFacade.w);
      // the facade seen in dark water is darker than the facade itself (and the rill reads as water)
      // (shaded by height and course, so the reflected front is a darker wall, never a flat block)
      float course = 0.82 + 0.18 * step(0.5, fract(q.y * 3.2));
      vec3 earth = vec3(0.62, 0.3, 0.2) * (0.06 + 0.26 * uDay) * course * (0.7 + 0.3 * clamp(q.y / uFacade.w, 0.0, 1.5)) + vec3(0.04, 0.022, 0.014) * uNight;
      vec3 inside = uDoorGlow * (0.45 + 0.9 * uNight);
      return mix(earth, inside, door);
    }
  }
  // the drum and the dome rising behind the front (a cylinder and a sphere about the y axis), so
  // the rill holds the whole building against the sky: terracotta by day, the dome's glow by night
  if (uBuilding.y > 0.0) {
    vec3 clay = vec3(0.74, 0.38, 0.25) * (0.1 + 0.5 * uDay);
    vec3 glow = vec3(1.0, 0.6, 0.3) * uNight;
    // the dome: nearest hit on the sphere
    vec3 oc = p - vec3(0.0, uBuilding.x, 0.0);
    float b = dot(oc, r);
    float c = dot(oc, oc) - uBuilding.y * uBuilding.y;
    float h = b * b - c;
    if (h > 0.0) {
      float t = -b - sqrt(h);
      vec3 q = p + r * t;
      if (t > 0.0 && q.y > uBuilding.w) {
        float k = clamp((q.y - uBuilding.w) / (uBuilding.x + uBuilding.y - uBuilding.w), 0.0, 1.0);
        return clay * (0.75 + 0.35 * k) + glow * 0.32 * (1.0 - 0.7 * k);
      }
    }
    // the drum: nearest hit on the cylinder below its eaves
    float a2 = dot(r.xz, r.xz);
    float b2 = dot(p.xz, r.xz);
    float c2 = dot(p.xz, p.xz) - uBuilding.z * uBuilding.z;
    float h2 = b2 * b2 - a2 * c2;
    if (h2 > 0.0 && a2 > 1e-6) {
      float t = (-b2 - sqrt(h2)) / a2;
      vec3 q = p + r * t;
      if (t > 0.0 && q.y < uBuilding.w) return clay * 0.8 + glow * 0.22 * (1.0 - q.y / uBuilding.w);
    }
  }
  return sky(r);
}
#else
vec3 surroundings(vec3 p, vec3 r) {
  // the drum wall first (if the ray meets it below the soffit), else the soffit plane
  float a = dot(r.xz, r.xz);
  float b = dot(p.xz, r.xz);
  float c = dot(p.xz, p.xz) - uWallR * uWallR;
  float tw = (-b + sqrt(max(b * b - a * c, 0.0))) / max(a, 1e-5);
  float yw = p.y + r.y * tw;
  float tc = (uCeilY - p.y) / max(r.y, 1e-4);
  vec3 room = vec3(0.0);
  if (yw < uCeilY) {
    vec3 rose = vec3(0.50, 0.21, 0.15);
    vec3 blush = vec3(0.66, 0.36, 0.27);
    vec3 band = vec3(0.22, 0.05, 0.035);
    vec3 col = yw < uBandY ? rose : blush;
    col = mix(col, band, 1.0 - smoothstep(0.02, 0.045, abs(yw - uBandY)));
    // the cove glow above the band (always a little, strongest at night)
    col *= 0.5;
    col += vec3(1.0, 0.62, 0.35) * (0.35 + 0.5 * uNight) * smoothstep(0.5, 0.0, yw - uBandY) * step(uBandY, yw);
    return col * (0.25 + 0.75 * uRoom) * (0.55 + 0.45 * smoothstep(0.0, 2.0, yw));
  }
  vec3 q = p + r * tc;
  float rq = length(q.xz);
  if (rq < uGoboR) {
    vec2 guv = 0.5 + q.xz / (2.0 * uGoboR);
    float open = texture2D(uGobo, guv).r;
    vec3 s = sky(r);
    // the sun's disc, when it lines up with the opening
    float sd = max(dot(r, uSunDir), 0.0);
    s += vec3(1.0, 0.92, 0.78) * pow(sd, 900.0) * 40.0 * uSunVis;
    vec3 jali = vec3(0.42, 0.19, 0.12) * uRoom * 0.6;
    return mix(jali, s, open);
  }
  if (rq < uCrownR) {
    vec2 cuv = 0.5 + q.xz / (2.0 * uCrownR);
    // the gold crown: its gilding catches the light, the clay between stays dark
    vec3 cr = texture2D(uCrown, cuv).rgb;
    float gold = smoothstep(0.35, 0.7, cr.r - cr.b);
    // the coffers and the glowing terraces hold their light in the water (a still pool holding the dome)
    return cr * (0.32 + 0.95 * uRoom) * (0.6 + 0.7 * gold);
  }
  return vec3(0.72, 0.52, 0.40) * uRoom * 0.3;
}
#endif

void main() {
  vec2 g = waveGrad(vWorld.xz);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(vWorld - cameraPosition);
  vec3 r = reflect(v, n);
  r.y = max(r.y, 0.002);
  float cosT = clamp(dot(-v, n), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  // still dark water holds its reflection: a dark body makes even 2 % read as a mirror
#if defined(WATER_PLANAR)
  // the rendered mirror: dark still water holds the scene almost whole, a little more at grazing
  float mirror = clamp(F * 1.6 + 0.7, 0.0, 0.94) * uReflect;
#elif defined(WATER_RILL)
  // a shallow channel over dark tile: it holds the doorway like a strip of glass
  float mirror = clamp(F * 1.8 + 0.42, 0.0, 0.92) * uReflect;
#else
  // a dark, still mirror: strong at grazing angles (Fresnel), never a matte band
  // (≥ 0.6 at grazing angles: the dome and the sky, never a matte floor)
  float mirror = clamp(F * 2.4 + 0.5, 0.0, 0.96) * uReflect;
#endif
#ifdef WATER_PLANAR
  // the scene drawn from the mirrored eye, displaced by the surface's slope (swell, ripples, rain)
  vec4 mc = uMirrorMat * vec4(vWorld, 1.0);
  vec2 muv = mc.xy / mc.w + vec2(g.x, -g.y) * 0.22;
  // a 5-tap soft sample (a slight ripple blur): the mirror's hard edges never stair-step
  vec2 mo = vec2(0.0016, 0.0011);
  vec2 mc0 = clamp(muv, vec2(0.003), vec2(0.997));
  vec3 refl = texture2D(uMirror, mc0).rgb * 0.36
    + (texture2D(uMirror, mc0 + mo).rgb + texture2D(uMirror, mc0 - mo).rgb
     + texture2D(uMirror, mc0 + vec2(-mo.y, mo.x)).rgb + texture2D(uMirror, mc0 + vec2(mo.y, -mo.x)).rgb) * 0.16;
#else
  vec3 refl = surroundings(vWorld, r);
#endif
#ifdef WATER_RILL
  vec3 body = uTint * (0.35 + 0.65 * uRoom) * (0.6 + 0.4 * uDay);
#else
  // a dark basin: the body reads near black so the reflection carries the pool
  vec3 body = uTint * (0.06 + 0.16 * uRoom) * (0.6 + 0.4 * uDay);
#endif
#if !defined(WATER_RILL) && !defined(WATER_PLANAR)
  // still black water reads a shade cooler than what it holds
  refl *= vec3(0.86, 0.93, 1.0);
#endif
#ifdef WATER_PLANAR
  // dark water: what it holds is a shade deeper and cooler than the room itself
  refl *= vec3(0.8, 0.85, 0.9);
#endif
  vec3 col = mix(body, refl, mirror);
#ifndef WATER_RILL
  // the meniscus: a thin bright line where the water meets the stone at both rims
  float rr = length(vWorld.xz);
  // (its width never below a pixel and a half, so it never breaks into a glittering dotted rim;
  // no inner line on a full pool)
  float mw = max(0.012, fwidth(rr) * 1.5);
  float men = (uRim.x > 0.05 ? exp(-pow((rr - uRim.x) / mw, 2.0)) : 0.0) + exp(-pow((rr - uRim.y) / mw, 2.0));
  col += refl * men * 0.5 * uReflect * clamp(0.012 / mw, 0.15, 1.0);
  // sky glints: the swell turns a few facets to the oculus and they catch the light
  float glint = pow(max(dot(r, normalize(vec3(-vWorld.x, 6.0, -vWorld.z))), 0.0), 220.0);
  col += sky(vec3(0.0, 1.0, 0.0)) * glint * 0.3 * uSwell * uReflect;
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** The water material: 'ring' (oculus court) or 'rill' (entrance). Shares its uniforms object. */
export function createWaterMaterial(mode: 'ring' | 'rill', uniforms: WaterUniforms = waterUniforms(), planar = false): THREE.ShaderMaterial {
  const defines: Record<string, string> = mode === 'rill' ? { WATER_RILL: '' } : {}
  if (planar) defines.WATER_PLANAR = ''
  const m = new THREE.ShaderMaterial({
    name: mode === 'rill' ? 'waterRill' : 'waterRing',
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
  })
  return m
}

/** 1×1 placeholders so the program never compiles without its samplers. */
export const BLACK_TEX = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()
export const WHITE_TEX = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()

/* ------------------------------------------------------------------ */
/* the pool mirror (High / Ultra)                                      */
/* ------------------------------------------------------------------ */

export interface MirrorPlane {
  level: number
  r0: number
  r1: number
}

/**
 * Turn a (lit) material into its reflection in the water ring, with no second scene render and
 * no stencil: the mesh is drawn mirrored about the water plane (the caller flips it), and every
 * fragment is moved onto the water surface it is seen through — `gl_FragDepth` is the depth of
 * the point where the view ray meets the plane, and fragments whose ray meets the plane outside
 * the ring are dropped. So the reflection shows only on the water, is hidden by anything that
 * stands in front of the water (the potter, the curb), and blends over the water drawn before it.
 *
 * Patches `mat` in place (keeps any earlier onBeforeCompile) and returns it.
 */
export function withWaterMirror<M extends THREE.Material>(mat: M, plane: MirrorPlane, opacity = 0.5): M {
  const uniforms = { uMirLevel: { value: plane.level }, uMirR0: { value: plane.r0 }, uMirR1: { value: plane.r1 } }
  mat.userData.mirror = uniforms
  mat.transparent = true
  mat.opacity = opacity
  mat.depthWrite = false
  mat.side = THREE.DoubleSide
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMirWorld;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
{
  vec4 mw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  mw = instanceMatrix * mw;
  #endif
  vMirWorld = (modelMatrix * mw).xyz;
}`,
    )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform mat4 projectionMatrix;
uniform float uMirLevel;
uniform float uMirR0;
uniform float uMirR1;
varying vec3 vMirWorld;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
{
  vec3 md = vMirWorld - cameraPosition;
  if (md.y > -1e-4 || vMirWorld.y > uMirLevel) discard;
  vec3 mq = cameraPosition + md * ((uMirLevel - cameraPosition.y) / md.y);
  float mr = length(mq.xz);
  if (mr < uMirR0 + 0.01 || mr > uMirR1 - 0.01) discard;
  vec4 mc = projectionMatrix * viewMatrix * vec4(mq, 1.0);
  gl_FragDepth = clamp((mc.z / mc.w) * 0.5 + 0.5 - 2e-6, 0.0, 1.0);
}`,
      )
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|waterMirror`
  mat.needsUpdate = true
  return mat
}

/** The mirror transform about a horizontal plane at y = level (apply to a parent group). */
export const mirrorGroupProps = (level: number) => ({ position: [0, 2 * level, 0] as [number, number, number], scale: [1, -1, 1] as [number, number, number] })
