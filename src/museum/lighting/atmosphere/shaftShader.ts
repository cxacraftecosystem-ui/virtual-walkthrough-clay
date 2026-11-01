/**
 * Sun shaft shaders (SPECTACLE F8): the column of light through the oculus and the dust in it.
 *
 * The column is a unit cylinder sheared along the light in the vertex shader: each generator
 * line leaves the opening at the collar top (y 22.2) and runs down along the light until it meets
 * the floor, the gallery ring's wall or the dome's shell, whichever comes first, so the back faces
 * (all that is drawn) always end inside the rotunda and the depth test against the architecture
 * stays honest.
 *
 * The fragment integrates the beam along the view ray from where it enters the column to the
 * back face, with a few samples: a sample is lit when its projections onto the oculus's lip and
 * the light-well's top both fall inside the Ø 10 m opening (a lens at a low sun, exactly like the
 * patch on the floor). The air is clear (GRAND §6.2 #1): the beam reads as a body of light only
 * where it is, Henyey–Greenstein forward scattering makes it glow when you look up toward the
 * sun, and fbm (M+) gives it a faint drifting dust. The jali lace is retired with the jali.
 */
import { KEY, MUSEUM } from '../../config/museum'
import { ROOF_Y0, ROOF_Y1 } from './inject'

const OC = MUSEUM.oculus
const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))

/** Where a generator line from the opening ends: the floor, the ring's wall or the dome's shell. */
const COMMON = /* glsl */ `
uniform vec3 uSunDir;      // towards the light (unit)
float shaftEnd(vec3 a, vec3 L) {
  float sFloor = a.y / max(L.y, 1e-3);
  vec2 d = -L.xz;
  float A = dot(d, d);
  if (A < 1e-6) return sFloor;
  // the gallery ring's interior face (round all the way: the rotunda)
  float B = 2.0 * dot(a.xz, d);
  float C = dot(a.xz, a.xz) - ${f((KEY.ringR - 0.06) ** 2)};
  float disc = B * B - 4.0 * A * C;
  float sWall = disc > 0.0 ? (-B + sqrt(disc)) / (2.0 * A) : sFloor;
  // the dome's interior face, where the line leaves the sphere
  vec3 oc = a - vec3(0.0, ${f(KEY.domeCentreY)}, 0.0);
  float b = -dot(oc, L);
  float c = dot(oc, oc) - ${f((KEY.domeSphereR - 0.05) ** 2)};
  float ds = b * b - c;
  float sDome = ds > 0.0 ? -b + sqrt(ds) : sFloor;
  return max(min(sFloor, min(max(sWall, 0.0), max(sDome, 0.0))), 0.0);
}
`

export const SHAFT_VERT = /* glsl */ `
${COMMON}
varying vec3 vWorld;
void main() {
  // position: x, z on the unit circle (or the cap's centre), y = 0 at the opening … 1 at the end
  vec3 a = vec3(position.x * ${f(OC.r)}, ${f(ROOF_Y1)}, position.z * ${f(OC.r)});
  vec3 L = normalize(uSunDir);
  vec3 p = a - L * (position.y * shaftEnd(a, L));
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

export const SHAFT_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uColor;        // light colour × strength (linear)
uniform float uTime;
uniform float uNoise;       // 0 = smooth column (L), 1 = fbm dust
uniform float uSamples;     // samples along the chord (≤ 8)
varying vec3 vWorld;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 2; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s * 1.333;
}
// the view ray's interval inside the beam through one aperture (radius R at height y): an
// oblique cylinder, upright in sheared coordinates x' = x + Lxz/Ly·(y − p.y)
vec2 apertureSpan(vec3 ro, vec3 rd, vec2 k, float y, float R) {
  vec2 o = ro.xz + k * (y - ro.y);
  vec2 dd = rd.xz - k * rd.y;
  float A = dot(dd, dd);
  float B = dot(o, dd);
  float C = dot(o, o) - R * R;
  if (A < 1e-7) return C < 0.0 ? vec2(-1e5, 1e5) : vec2(1.0, 0.0);
  float disc = B * B - A * C;
  if (disc <= 0.0) return vec2(1.0, 0.0);
  float s = sqrt(disc);
  return vec2((-B - s) / A, (-B + s) / A);
}
void main() {
  vec3 L = normalize(uSunDir);
  vec3 ro = cameraPosition;
  vec3 seg = vWorld - ro;
  float tEnd = length(seg);
  vec3 rd = seg / tEnd;
  vec2 k = L.xz / L.y;
  // lit where the ray is inside the beams of both apertures (roof underside and collar top: a
  // lens at a low sun), below the collar and above the floor, in front of the back face
  vec2 s0 = apertureSpan(ro, rd, k, ${f(ROOF_Y0)}, ${f(OC.r)});
  vec2 s1 = apertureSpan(ro, rd, k, ${f(ROOF_Y1)}, ${f(OC.r)});
  float ta = max(max(s0.x, s1.x), 0.0);
  float tb = min(min(s0.y, s1.y), tEnd);
  if (abs(rd.y) > 1e-5) {
    float tTop = (${f(ROOF_Y1)} - ro.y) / rd.y;
    float tFloor = -ro.y / rd.y;
    ta = max(ta, min(tTop, tFloor));
    tb = min(tb, max(tTop, tFloor));
  }
  float len = tb - ta;
  if (len <= 0.0) discard;
  // a few stratified samples, jittered per pixel (interleaved gradient noise) so they never line
  // up into slices across the court: the air is a little thicker near the floor, where dust settles
  float n = clamp(uSamples, 1.0, 8.0);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float low = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    vec3 p = ro + rd * (ta + (float(i) + jit) / n * len);
    low += exp(-max(p.y, 0.0) * 0.35);
  }
  float dens = min(len, 6.0) * (1.0 + 0.6 * low / n);
  // soft edges: a grazing chord fades rather than ending on a hard line
  dens *= smoothstep(0.0, 0.6, len);
  // and the column's skin: how far the chord's middle sits from the beam's axis, measured in the
  // opening's plane, so the cylinder fades out over its outer quarter instead of ending on a rim
  vec3 pm = ro + rd * (ta + 0.5 * len);
  float rm = length(pm.xz + k * (${f(ROOF_Y1)} - pm.y)) / ${f(OC.r)};
  dens *= 1.0 - smoothstep(0.55, 1.0, rm);
  // drifting dust: one fbm look-up at the middle of the lit chord (M+)
  if (uNoise > 0.0) {
    vec3 mid = ro + rd * (ta + 0.5 * len);
    // faint and large-scale: a slow drift in the air, never cotton-wool blotches
    dens *= mix(1.0, 0.72 + 0.56 * fbm(mid * 0.45 + vec3(0.0, -uTime * 0.03, uTime * 0.012)), uNoise);
  }
  // Henyey–Greenstein, g = 0.55: bright when looking toward the light
  float g = 0.55;
  float c = dot(rd, L);
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) / 12.566;
  vec3 col = uColor * dens * (0.08 + hg * 1.4);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const MOTE_VERT = /* glsl */ `
${COMMON}
attribute vec4 aSeed;        // angle, radius fraction, height fraction, phase
uniform float uTime;
uniform float uSpeed;
uniform float uSize;
uniform vec3 uVisPos;        // visitor (body height)
uniform vec3 uVisVel;
varying float vBright;
void main() {
  vec3 L = normalize(uSunDir);
  float ang = aSeed.x + uTime * uSpeed * (0.012 + 0.02 * aSeed.w) * (aSeed.w > 0.5 ? 1.0 : -1.0);
  float r = ${f(OC.r)} * 0.97 * sqrt(aSeed.y);
  vec3 a = vec3(cos(ang) * r, ${f(ROOF_Y1)}, sin(ang) * r);
  float sEnd = shaftEnd(a, L);
  // drift slowly down the beam and wrap; a lazy wobble across it
  float h = fract(aSeed.z + uTime * uSpeed * 0.006 * (0.5 + aSeed.w));
  vec3 p = a - L * (h * sEnd);
  p += vec3(sin(uTime * 0.31 + aSeed.w * 40.0), sin(uTime * 0.23 + aSeed.x * 7.0) * 0.6, cos(uTime * 0.27 + aSeed.y * 30.0)) * 0.05 * uSpeed;
  // swirl away from the visitor's body as they pass
  vec3 dv = p - uVisPos;
  float near = exp(-dot(dv, dv) / 0.3);
  p += (uVisVel * 0.55 + normalize(dv + vec3(1e-3)) * length(uVisVel) * 0.25) * near;
  // fade at the ends of the beam and where the lace shades it
  float ends = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.9, 1.0, h)) * step(0.05, p.y);
  float tw = pow(0.5 + 0.5 * sin(uTime * (0.6 + 1.6 * aSeed.w) + aSeed.w * 60.0), 6.0);
  vBright = ends * (0.25 + 0.75 * tw);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + 0.8 * aSeed.w) / max(-mv.z, 0.3);
}
`

export const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vBright;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c));
  if (a * vBright <= 0.002) discard;
  gl_FragColor = vec4(uColor * a * a * vBright, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
