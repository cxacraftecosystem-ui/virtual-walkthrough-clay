/**
 * LIME BANDS — value structure for the deep red lime walls (GRAND §6.1 palette; the art
 * direction's "one saturated red" fix). A red wall drawn in one flat colour reads as a sheet of
 * red in daylight; real lime plaster has a pale lime coping where the rain sits, a darker plinth
 * where the walk splashes it, a lime string course, and a limewash that is never one colour
 * (rose and ochre where it is thin, oxblood where it pooled, paler streaks where rain runs down).
 *
 * `limeBanded(material, spec)` patches a library material in place (before it compiles; the
 * light engine's terms chain after it): every term is in world space, so merged and swept
 * geometry need no UVs of their own.
 *
 *   coping  upward faces (wall heads, sills, niche floors) in pale lime
 *   bands   horizontal lime courses [y0, y1] on the vertical faces
 *   dado    a darker, slightly glossier plinth up to `y`
 *   mottle  two-scale limewash variation between a darker and a lighter tint, with rain streaks
 */
import * as THREE from 'three'

export interface LimeBandSpec {
  /** Program-cache key (one per distinct spec). */
  key: string
  coping?: string
  bands?: [number, number, string][]
  dado?: { y: number; color: string; mix: number }
  mottle?: { amount: number; light: string; dark: string; scale: number }
}

const lin = (hex: string) => {
  const c = new THREE.Color(hex)
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`
}

const NOISE = /* glsl */ `
float lbHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float lbNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lbHash(i), lbHash(i + vec2(1.0, 0.0)), u.x), mix(lbHash(i + vec2(0.0, 1.0)), lbHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lbFbm(vec2 p) { return 0.55 * lbNoise(p) + 0.3 * lbNoise(p * 2.07 + 5.1) + 0.15 * lbNoise(p * 4.3 + 1.7); }
`

export function limeBanded<M extends THREE.MeshStandardMaterial>(m: M, spec: LimeBandSpec): M {
  const prev = m.onBeforeCompile
  const prevKey = m.customProgramCacheKey.bind(m)
  const lines: string[] = []
  // the texel's own light and dark (the albedo map over the material colour), kept on every tint
  lines.push('vec3 lbBase = diffuseColor.rgb;')
  lines.push('float lbTex = clamp(dot(lbBase, vec3(0.3333)) / max(dot(diffuse, vec3(0.3333)), 1e-3), 0.55, 1.5);')
  lines.push('float lbUp = smoothstep(0.55, 0.85, vLbN.y);')
  if (spec.mottle) {
    const o = spec.mottle
    lines.push(`{
    // along the wall (x + z works for any plan direction at this scale) and up it
    vec2 q = vec2(vLbW.x + vLbW.z, vLbW.y) * ${o.scale.toFixed(3)};
    float big = lbFbm(q * vec2(0.6, 0.9) + 3.1);
    float small = lbNoise(q * 6.0 + 9.0);
    float streak = smoothstep(0.55, 0.9, lbFbm(vec2(q.x * 7.0, q.y * 0.35) + 17.0)) * smoothstep(0.2, 2.0, vLbW.y);
    float t = clamp(big + 0.18 * (small - 0.5), 0.0, 1.0);
    vec3 tint = mix(${lin(o.dark)}, ${lin(o.light)}, smoothstep(0.25, 0.8, t));
    diffuseColor.rgb = mix(diffuseColor.rgb, tint * lbTex, ${o.amount.toFixed(3)});
    diffuseColor.rgb *= 1.0 + 0.22 * streak;
  }`)
  }
  if (spec.dado) {
    const d = spec.dado
    lines.push(`{
    float dado = (1.0 - smoothstep(${(d.y - 0.012).toFixed(3)}, ${(d.y + 0.012).toFixed(3)}, vLbW.y)) * (1.0 - lbUp);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${lin(d.color)} * lbTex, dado * ${d.mix.toFixed(3)});
    lbDado = dado;
  }`)
  }
  for (const [y0, y1, hex] of spec.bands ?? []) {
    lines.push(`{
    float band = smoothstep(${(y0 - 0.006).toFixed(3)}, ${(y0 + 0.006).toFixed(3)}, vLbW.y) * (1.0 - smoothstep(${(y1 - 0.006).toFixed(3)}, ${(y1 + 0.006).toFixed(3)}, vLbW.y)) * (1.0 - lbUp);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${lin(hex)} * mix(1.0, lbTex, 0.6), band);
  }`)
  }
  if (spec.coping) {
    lines.push(`diffuseColor.rgb = mix(diffuseColor.rgb, ${lin(spec.coping)} * mix(1.0, lbTex, 0.6), lbUp);
  lbCope = lbUp;`)
  }
  const body = lines.join('\n  ')
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLbW;\nvarying vec3 vLbN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  {
    vec4 lbW = modelMatrix * vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    lbW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    #endif
    vLbW = lbW.xyz;
    vLbN = normalize(mat3(modelMatrix) * objectNormal);
  }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLbW;\nvarying vec3 vLbN;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n  float lbDado = 0.0;\n  float lbCope = 0.0;\n  ${body}`)
      // the plinth takes a little sheen (the walk's splash, burnished by hands); the coping is chalky
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.72, lbDado);\n  roughnessFactor = mix(roughnessFactor, 0.97, lbCope);')
  }
  m.customProgramCacheKey = () => `${prevKey()}|lime:${spec.key}`
  m.needsUpdate = true
  return m
}
