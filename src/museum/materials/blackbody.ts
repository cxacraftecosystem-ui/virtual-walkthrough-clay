/**
 * BLACKBODY — the colour of hot clay, as a function of temperature (SPECTACLE F13, F14, F18).
 *
 * A fitted Planckian locus (Tanner Helland's fit, in linear sRGB) from 1000 K to 12000 K, plus a
 * "glow" ramp for firing moments: below ~800 K clay does not glow at all; from there it walks
 * through dull cherry, orange and yellow-white as a kiln climbs to 1100 °C.
 *
 *   blackbodyColor(1900)            → THREE.Color, linear, normalised so its max channel is 1
 *   glowRamp(t)                     → THREE.Color × intensity for a firing stage t ∈ 0 … 1
 *   BLACKBODY_GLSL                  → `vec3 blackbody(float kelvin)` and `vec3 emberRamp(float t)`
 *                                     for shaders (same fit, so CPU and GPU agree)
 *
 * No temperatures are shown to visitors (placeholder honesty); these only set colours.
 */
import * as THREE from 'three'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Linear-sRGB colour of a blackbody at `kelvin`, max channel 1. */
export function blackbodyColor(kelvin: number, target = new THREE.Color()): THREE.Color {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100
  // sRGB-encoded fit, 0 … 255
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  target.setRGB(clamp01(r / 255), clamp01(g / 255), clamp01(b / 255), THREE.SRGBColorSpace)
  const m = Math.max(target.r, target.g, target.b) || 1
  return target.setRGB(target.r / m, target.g / m, target.b / m)
}

/**
 * A firing stage t (0 = cold, 1 = peak) → glow colour pre-multiplied by its brightness: dark
 * until about a third of the way, then cherry → orange → yellow-white, brightness rising
 * roughly with T⁴ (gently tamed so bloom does not blow out).
 */
export function glowRamp(t: number, target = new THREE.Color()): THREE.Color {
  const x = clamp01(t)
  const kelvin = 700 + 1100 * x
  blackbodyColor(kelvin, target)
  const on = clamp01((x - 0.28) / 0.72)
  const k = on * on * (0.35 + 0.65 * on)
  return target.multiplyScalar(k * 2.2)
}

/** GLSL twin of `blackbodyColor` / `glowRamp` (returns linear colour). */
export const BLACKBODY_GLSL = /* glsl */ `
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 255.0 : 329.698727446 * pow(t - 60.0, -0.1332047592);
  float g = t <= 66.0 ? 99.4708025861 * log(t) - 161.1195681661 : 288.1221695283 * pow(t - 60.0, -0.0755148492);
  float b = t >= 66.0 ? 255.0 : (t <= 19.0 ? 0.0 : 138.5177312231 * log(t - 10.0) - 305.0447927307);
  vec3 c = clamp(vec3(r, g, b) / 255.0, 0.0, 1.0);
  c = pow(c, vec3(2.2));
  return c / max(max(c.r, c.g), max(c.b, 1e-4));
}
vec3 emberRamp(float t) {
  float x = clamp(t, 0.0, 1.0);
  float on = clamp((x - 0.28) / 0.72, 0.0, 1.0);
  return blackbody(700.0 + 1100.0 * x) * on * on * (0.35 + 0.65 * on) * 2.2;
}
`
