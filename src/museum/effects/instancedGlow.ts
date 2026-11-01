/**
 * INSTANCED GLOW — per-instance warmth on an InstancedMesh with a standard material, in one
 * draw call: the kulhad helix, the horse procession, lamp bowls.
 *
 * Two per-instance attributes drive it:
 *   aGlow   0 … 1   how much the instance glows (written by the owner as visitors pass, cues fire…)
 *   aPhase  radians a per-instance offset for the gentle breathing (no two instances in step)
 *
 * The material adds `uGlowColor · aGlow · uGlowGain · breath` to the emissive term, where
 * breath = 1 − uBreath · (0.5 + 0.5 sin(uTime · uBreathHz · 2π + aPhase)). Keep uBreathHz under
 * 3 Hz and uBreath ≤ 0.1 (flicker limits); set uBreath 0 for the Still form.
 *
 *   const mat = instancedGlowMaterial(new THREE.MeshStandardMaterial({ color: '#b4553f' }))
 *   const { glow, phase } = addGlowAttributes(mesh)   // after the InstancedMesh exists
 *   glow.setX(i, 1); glow.needsUpdate = true
 *   useFrame((s) => { mat.userData.uniforms.uTime.value = s.clock.elapsedTime })
 *
 * The program is cached under one key (`instancedGlow`), so every user shares it; mount the
 * material in Precompile so it never compiles mid-visit.
 */
import * as THREE from 'three'

export interface GlowUniforms {
  uTime: { value: number }
  uGlowColor: { value: THREE.Color }
  uGlowGain: { value: number }
  uBreath: { value: number }
  uBreathHz: { value: number }
}

/** Patch a standard (or physical) material in place for instanced glow; returns it. Its uniforms are in `material.userData.uniforms`. */
export function instancedGlowMaterial<M extends THREE.MeshStandardMaterial>(mat: M, opts: { color?: THREE.ColorRepresentation; gain?: number; breath?: number; breathHz?: number } = {}): M & { userData: { uniforms: GlowUniforms } } {
  const uniforms: GlowUniforms = {
    uTime: { value: 0 },
    uGlowColor: { value: new THREE.Color(opts.color ?? '#ff9a4d') },
    uGlowGain: { value: opts.gain ?? 1.6 },
    uBreath: { value: opts.breath ?? 0.08 },
    uBreathHz: { value: opts.breathHz ?? 0.35 },
  }
  mat.userData.uniforms = uniforms
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aGlow;
attribute float aPhase;
varying float vGlow;
varying float vPhase;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow;
vPhase = aPhase;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform vec3 uGlowColor;
uniform float uGlowGain;
uniform float uBreath;
uniform float uBreathHz;
varying float vGlow;
varying float vPhase;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float glowBreath = 1.0 - uBreath * (0.5 + 0.5 * sin(uTime * uBreathHz * 6.2831853 + vPhase));
totalEmissiveRadiance += uGlowColor * vGlow * uGlowGain * glowBreath;`,
      )
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|instancedGlow`
  mat.needsUpdate = true
  return mat as M & { userData: { uniforms: GlowUniforms } }
}

/**
 * Give an instanced geometry its `aGlow` (all 0) and `aPhase` (spread pseudo-randomly)
 * attributes. Call once per mesh, before the first render.
 */
export function addGlowAttributes(target: THREE.InstancedMesh | THREE.BufferGeometry, count?: number, seed = 1) {
  const geo = target instanceof THREE.InstancedMesh ? target.geometry : target
  const n = count ?? (target instanceof THREE.InstancedMesh ? target.count : 0)
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  glow.setUsage(THREE.DynamicDrawUsage)
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  let s = seed >>> 0 || 1
  for (let i = 0; i < n; i++) {
    // xorshift: deterministic, so the breathing pattern is the same every visit
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    phase.setX(i, ((s >>> 0) / 4294967296) * Math.PI * 2)
  }
  geo.setAttribute('aGlow', glow)
  geo.setAttribute('aPhase', phase)
  return { glow, phase }
}
