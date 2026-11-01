/**
 * CLAY GRADE (SPECTACLE F27, H/U) — the room's colour, applied to the image before tone mapping:
 * a gentle white balance toward the room's colour temperature, a split-tone (oxblood shadows,
 * warm highlights in A; blue-grey shadows in C …), a little contrast where the room asks for it,
 * a 0.15 vignette, and on Ultra a fine grain at night. All of it follows the colour choreography
 * (lighting/atmosphere/choreography.ts `grade`), eased, so no change is ever noticed by itself.
 *
 * L/M have no grade pass: there the room's colour rides on the fill and the accent lights.
 */
import { BlendFunction, Effect } from 'postprocessing'
import * as THREE from 'three'
import { grade } from '../lighting/atmosphere/choreography'
import { ambience } from '../lighting/timeOfDayState'

const FRAG = /* glsl */ `
uniform vec3 uWB;
uniform vec3 uShadow;
uniform vec3 uHigh;
uniform float uContrast;
uniform float uStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;

float gradeHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, vec3(0.0));
  vec3 g = c * uWB;
  float lum = dot(g, vec3(0.2126, 0.7152, 0.0722));
  // split-tone by where the pixel sits between shadow and highlight (on a compressed scale)
  float t = smoothstep(0.04, 0.75, lum / (1.0 + lum));
  g *= mix(uShadow, uHigh, t);
  // contrast about mid-grey, in log space (keeps HDR highlights)
  g = 0.18 * pow(max(g, vec3(1e-5)) / 0.18, vec3(uContrast));
  g = mix(c, g, uStrength);
  // vignette
  vec2 d = uv - 0.5;
  g *= 1.0 - uVignette * smoothstep(0.3, 0.95, length(d) * 1.414);
  // grain (Ultra, night): luminance-weighted, under the threshold of attention
  if (uGrain > 0.0) {
    float n = gradeHash(uv * vec2(1931.0, 1373.0) + uSeed) - 0.5;
    g += n * uGrain * sqrt(max(lum, 0.0)) * 0.6;
  }
  outputColor = vec4(g, inputColor.a);
}
`

/** Split-tone strength (GRAND §6.2 #1: 0.5 × the spectacle's 0.12). */
const SPLIT = 0.06

const lumaOf = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722

export class ClayGradeEffect extends Effect {
  private wb = new THREE.Vector3(1, 1, 1)
  private shadow = new THREE.Vector3(1, 1, 1)
  private high = new THREE.Vector3(1, 1, 1)
  private tmp = new THREE.Color()

  constructor() {
    super('ClayGrade', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uWB', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['uShadow', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['uHigh', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['uContrast', new THREE.Uniform(1)],
        ['uStrength', new THREE.Uniform(1)],
        ['uVignette', new THREE.Uniform(0.15)],
        ['uGrain', new THREE.Uniform(0)],
        ['uSeed', new THREE.Uniform(0)],
      ]),
    })
  }

  /** Follow the choreography; `strength` is the curator's gradeStrength, `grain` whether this tier adds it. */
  sync(strength: number, grain: boolean, time: number) {
    const u = this.uniforms
    // white balance: a quarter of the way toward the room's temperature
    this.wb.set(1 + (grade.tint.r - 1) * 0.25, 1 + (grade.tint.g - 1) * 0.25, 1 + (grade.tint.b - 1) * 0.25)
    // split-tone colours, normalised to unit luminance and applied at 6 % (GRAND §6.2 #1: half the
    // spectacle's strength, so no room carries a pink or orange cast)
    const tone = (c: THREE.Color, out: THREE.Vector3) => {
      this.tmp.copy(c)
      const l = Math.max(lumaOf(this.tmp), 1e-3)
      out.set(1 + (this.tmp.r / l - 1) * SPLIT, 1 + (this.tmp.g / l - 1) * SPLIT, 1 + (this.tmp.b / l - 1) * SPLIT)
    }
    tone(grade.shadow, this.shadow)
    tone(grade.high, this.high)
    ;(u.get('uWB')!.value as THREE.Vector3).copy(this.wb)
    ;(u.get('uShadow')!.value as THREE.Vector3).copy(this.shadow)
    ;(u.get('uHigh')!.value as THREE.Vector3).copy(this.high)
    u.get('uContrast')!.value = grade.contrast
    u.get('uStrength')!.value = strength
    u.get('uGrain')!.value = grain ? 0.04 * ambience.night : 0
    u.get('uSeed')!.value = (time * 60) % 997
  }
}
