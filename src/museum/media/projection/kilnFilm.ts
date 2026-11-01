/**
 * THE KILN FILM — "Earth · Water · Hand · Fire": the Agni Theatre's generative film (F24), a
 * 96 s loop in four chapters drawn by one fragment shader into a ProjectionTarget and shown on
 * the curved screen. It is what the theatre shows when no confirmed film exists, so it makes
 * no claim — it names no place, person or process step; it is clay, moving.
 *
 *   1 EARTH  sediment strata — bands of soils fold slowly, as a riverbank seen in section
 *   2 WATER  slip — cream and red clay slip swirl into each other, marbling
 *   3 HAND   a vessel rises on a turning wheel, its throwing lines spiralling, two hands at the wall
 *   4 FIRE   flames lick up round the vessel, which cools from white heat to exactly the oxblood
 *            of the theatre's walls as the chapter ends
 *
 * Chapters cross-fade over 1.6 s; the loop fades in from and out to black. The tier sets the
 * target size, refresh rate and fbm octaves (QUALITY_PRESETS[tier].spectacle.kilnFilmRT).
 * Still form (reduced motion): `uStill` 1 freezes each chapter on one composed frame.
 */
import * as THREE from 'three'

export const KILN_FILM_CHAPTERS = 4

/** The wall oxblood the vessel cools to (materials.ts 'oxbloodLacquer'), sRGB. */
const OXBLOOD = new THREE.Color('#6d211c')

export interface KilnFilmUniforms {
  [k: string]: THREE.IUniform
  /** Seconds into the loop (0 … 4·uChapterSec). */
  uTime: THREE.IUniform<number>
  uChapterSec: THREE.IUniform<number>
  uOctaves: THREE.IUniform<number>
  uAspect: THREE.IUniform<number>
  uStill: THREE.IUniform<number>
  /** Overall level (0 = black): fades with the house. */
  uLevel: THREE.IUniform<number>
  uOxblood: THREE.IUniform<THREE.Vector3>
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uChapterSec;
uniform float uOctaves;
uniform float uAspect;
uniform float uStill;
uniform float uLevel;
uniform vec3 uOxblood;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uOctaves) break;
    v += a * noise(p);
    p = r * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

/* 1 — EARTH: strata folding */
vec3 earth(vec2 p, float t) {
  float fold = 0.18 + 0.22 * smoothstep(0.0, 1.0, t);
  float y = p.y + fold * sin(p.x * 1.7 + 0.6) * (0.6 + 0.4 * sin(p.x * 0.6 + t * 1.3)) + 0.12 * fbm(p * 2.2 + vec2(t * 0.6, 0.0));
  y += t * 0.35;
  float band = y * 7.0;
  float i = floor(band);
  float f = fract(band);
  float k = hash(vec2(i, 3.0));
  vec3 soils[6];
  soils[0] = vec3(0.42, 0.27, 0.17);
  soils[1] = vec3(0.66, 0.44, 0.26);
  soils[2] = vec3(0.55, 0.22, 0.13);
  soils[3] = vec3(0.36, 0.33, 0.30);
  soils[4] = vec3(0.86, 0.80, 0.70);
  soils[5] = vec3(0.70, 0.36, 0.18);
  int idx = int(mod(i * 7.0 + floor(k * 3.0), 6.0));
  vec3 c = soils[0];
  for (int s = 0; s < 6; s++) if (s == idx) c = soils[s];
  // grain within the layer, darker seams between layers, roots near the top
  c *= 0.82 + 0.3 * fbm(p * vec2(9.0, 30.0) + i);
  c *= mix(0.55, 1.0, smoothstep(0.0, 0.08, f) * smoothstep(1.0, 0.92, f));
  float roots = smoothstep(0.75, 0.95, fbm(vec2(p.x * 8.0, p.y * 2.0 + t)) ) * smoothstep(0.2, 0.9, p.y);
  c = mix(c, vec3(0.18, 0.12, 0.08), roots * 0.5);
  return lin(c);
}

/* 2 — WATER: slip marbling */
vec3 water(vec2 p, float t) {
  vec2 q = p * 1.6;
  float a = t * 1.1;
  vec2 w1 = vec2(fbm(q + vec2(0.0, a * 0.4)), fbm(q + vec2(5.2, 1.3 - a * 0.3)));
  vec2 w2 = vec2(fbm(q + 3.0 * w1 + vec2(1.7, 9.2) + a * 0.25), fbm(q + 3.0 * w1 + vec2(8.3, 2.8)));
  float v = fbm(q + 3.2 * w2);
  vec3 slipCream = vec3(0.90, 0.80, 0.66);
  vec3 slipRed = vec3(0.62, 0.25, 0.15);
  vec3 wet = vec3(0.30, 0.16, 0.11);
  vec3 c = mix(wet, slipRed, smoothstep(0.25, 0.55, v));
  c = mix(c, slipCream, smoothstep(0.55, 0.78, v + 0.15 * w2.x));
  // a wet sheen catching the light
  float sheen = pow(smoothstep(0.62, 0.7, fbm(q * 2.0 + w1 * 2.0 + a * 0.2)), 3.0);
  c += vec3(0.25, 0.2, 0.16) * sheen;
  return lin(c);
}

/* the vessel's half-width at height y (0 … h), as thrown: a cylinder opening into a belly, a collar */
float vesselR(float y, float h, float grow) {
  float u = clamp(y / max(h, 1e-3), 0.0, 1.0);
  float belly = 0.34 * sin(3.14159 * pow(u, 0.85)) * grow;
  float collar = 0.11 + 0.05 * smoothstep(0.86, 1.0, u);
  return mix(0.16, collar, smoothstep(0.7, 0.95, u) * grow) + belly * (1.0 - smoothstep(0.75, 1.0, u)) + 0.02;
}

/* 3 — HAND: a vessel rises on the wheel */
vec3 hand(vec2 p, float t, out float potMask, out float potY) {
  vec3 bg = mix(vec3(0.16, 0.07, 0.05), vec3(0.32, 0.15, 0.09), smoothstep(-1.0, 1.0, p.y));
  bg *= 0.75 + 0.25 * smoothstep(1.6, 0.0, length(p));
  float base = -0.62;
  float h = mix(0.25, 1.05, smoothstep(0.02, 0.75, t));
  float grow = smoothstep(0.25, 0.9, t);
  float y = p.y - base;
  float r = vesselR(y, h, grow);
  float inside = step(0.0, y) * step(y, h) * step(abs(p.x), r);
  potMask = inside;
  potY = y / h;
  // the wheel head: a flat ellipse with streaks turning
  vec2 wq = vec2(p.x / 0.62, (p.y - base + 0.02) / 0.08);
  float wheel = smoothstep(1.0, 0.94, length(wq)) * step(p.y, base + 0.02);
  float ang = atan(wq.y, wq.x * 0.2);
  float streak = 0.5 + 0.5 * sin(ang * 14.0 + t * 40.0);
  vec3 c = mix(bg, mix(vec3(0.24, 0.17, 0.13), vec3(0.34, 0.25, 0.19), streak), wheel);
  // the thrown wall: lit from the left, throwing lines spiral as it turns
  float nx = clamp(p.x / max(r, 1e-3), -1.0, 1.0);
  float shade = 0.35 + 0.65 * clamp(0.6 - 0.8 * nx + 0.4 * sqrt(1.0 - nx * nx), 0.0, 1.0);
  float lines = 0.9 + 0.1 * sin(y * 70.0 + nx * 3.0 - t * 35.0);
  vec3 clay = vec3(0.62, 0.36, 0.25) * shade * lines;
  // wet sheen
  clay += vec3(0.2, 0.16, 0.13) * pow(max(0.0, 1.0 - abs(nx + 0.45) * 3.0), 6.0);
  c = mix(c, clay, inside);
  // two hands: soft dark shapes pressing the wall at the throwing height
  float hy = base + h * (0.25 + 0.55 * fract(t * 2.0));
  for (int s = 0; s < 2; s++) {
    float sg = s == 0 ? -1.0 : 1.0;
    float rr = vesselR(hy - base, h, grow);
    vec2 hp = p - vec2(sg * (rr + 0.17), hy);
    hp.y *= 1.7;
    float d = length(hp) - 0.15;
    float fingers = length(vec2(hp.x + sg * 0.12, hp.y * 0.7)) - 0.06;
    float m = smoothstep(0.02, -0.02, min(d, fingers)) * smoothstep(0.98, 0.9, t) * smoothstep(0.02, 0.12, t);
    c = mix(c, vec3(0.08, 0.04, 0.03), m * 0.92);
  }
  return lin(c);
}

/* 4 — FIRE: flames round the vessel, which cools to the walls' oxblood */
vec3 fire(vec2 p, float t) {
  float potMask;
  float potY;
  vec3 pot = hand(p, 1.0, potMask, potY);
  float heat = 1.0 - smoothstep(0.15, 0.95, t);
  vec2 q = vec2(p.x * 1.4, p.y * 0.9 - t * 2.4);
  float n = fbm(q * 2.2 + vec2(0.0, -t * 6.0));
  float n2 = fbm(q * 4.1 + vec2(3.0, -t * 9.0));
  float flame = smoothstep(0.15, 0.95, (n * 0.7 + n2 * 0.5) * 1.25 - (p.y + 0.6) * 0.55) * (0.25 + 0.75 * heat);
  vec3 fc = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.75, 0.25), smoothstep(0.4, 0.95, flame));
  fc = mix(fc, vec3(1.0, 0.95, 0.8), smoothstep(0.85, 1.0, flame));
  vec3 bg = vec3(0.05, 0.015, 0.01) + fc * flame;
  // the vessel: blackbody from white heat to the wall's oxblood
  vec3 hot = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.92, 0.72), heat);
  vec3 cool = uOxblood * (0.75 + 0.25 * (1.0 - potY));
  vec3 vc = mix(cool, hot, pow(heat, 1.4));
  // rounded: brighter at the middle of the belly, falling off to the sides
  vc *= (0.85 + 0.15 * fbm(p * 8.0)) * (0.62 + 0.38 * clamp(1.0 - abs(p.x + 0.08) / 0.55, 0.0, 1.0));
  vec3 c = mix(lin(bg), vc, potMask);
  return c;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect * 0.5;
  float total = uChapterSec * 4.0;
  float T = mod(uTime, total);
  float ch = floor(T / uChapterSec);
  float tc = (T - ch * uChapterSec) / uChapterSec;
  if (uStill > 0.5) tc = 0.72;
  float fade = 1.6 / uChapterSec;
  float pm;
  float py;
  vec3 col;
  vec3 next;
  if (ch < 0.5) { col = earth(p, tc); next = water(p, 0.0); }
  else if (ch < 1.5) { col = water(p, tc); next = hand(p, 0.0, pm, py); }
  else if (ch < 2.5) { col = hand(p, tc, pm, py); next = fire(p, 0.0); }
  else { col = fire(p, tc); next = vec3(0.0); }
  float x = smoothstep(1.0 - fade, 1.0, tc);
  col = mix(col, next, x * (uStill > 0.5 ? 0.0 : 1.0));
  // fade in from black at the very start of the loop
  col *= smoothstep(0.0, 1.2, T);
  // projection: soft vignette, a hint of grain
  float v = smoothstep(1.35, 0.35, length(vec2(p.x / (uAspect * 0.5), p.y)));
  col *= mix(0.72, 1.0, v);
  col += (hash(vUv * 917.0 + uTime) - 0.5) * 0.012;
  // a projector's punch: the screen is unlit and not tone-mapped, so the picture is lifted ~3.5×
  // through a soft shoulder (dark chapters become legible, the fire never clips to a flat white)
  col = max(col, 0.0) * 3.6;
  col = col / (1.0 + 0.75 * col);
  gl_FragColor = vec4(col * uLevel, 1.0);
}
`

/** The film's shader material (one per theatre); drive `uniforms.uTime` and draw it with a ProjectionTarget. */
export function kilnFilmMaterial(octaves: number, aspect: number): THREE.ShaderMaterial & { uniforms: KilnFilmUniforms } {
  const ox = OXBLOOD.clone().convertSRGBToLinear()
  const uniforms: KilnFilmUniforms = {
    uTime: { value: 0 },
    uChapterSec: { value: 24 },
    uOctaves: { value: octaves },
    uAspect: { value: aspect },
    uStill: { value: 0 },
    uLevel: { value: 1 },
    uOxblood: { value: new THREE.Vector3(ox.r, ox.g, ox.b) },
  }
  const m = new THREE.ShaderMaterial({ name: 'kilnFilm', vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false })
  return m as THREE.ShaderMaterial & { uniforms: KilnFilmUniforms }
}
