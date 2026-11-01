/**
 * CAUSTICS — the light the water ring throws back onto its curb (SPECTACLE F12, Medium and up).
 *
 * An additive film for the basin's inner faces: two layers of drifting, sharpened cell noise
 * (the classic "abs of sin" caustic), bright only by day and only where the sun can reach,
 * fading with height above the water. No light is added; no texture is sampled.
 *
 *   const mat = createCausticsMaterial()
 *   useFrame((s) => { mat.uniforms.uTime.value = s.clock.elapsedTime; mat.uniforms.uGain.value = … })
 */
import * as THREE from 'three'

export function createCausticsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'waterCaustics',
    uniforms: {
      uTime: { value: 0 },
      uGain: { value: 0 },
      uLevel: { value: 0.38 },
      uReach: { value: 0.12 },
      uColor: { value: new THREE.Color('#fff1d6') },
    },
    vertexShader: /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uGain;
uniform float uLevel;
uniform float uReach;
uniform vec3 uColor;
varying vec3 vWorld;
float caustic(vec2 p, float t) {
  float c = 0.0;
  vec2 q = p;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    q = vec2(q.x + sin(q.y * 1.7 + t * (0.6 + fi * 0.2)) * 0.6, q.y + cos(q.x * 1.3 - t * (0.5 + fi * 0.15)) * 0.6);
    c += abs(sin(q.x) * cos(q.y));
  }
  return pow(1.0 - clamp(c / 3.0, 0.0, 1.0), 6.0);
}
void main() {
  float ang = atan(vWorld.z, vWorld.x);
  vec2 p = vec2(ang * 18.0, (vWorld.y - uLevel) * 22.0);
  float c = caustic(p, uTime * 0.7) + 0.6 * caustic(p * 1.7 + 3.1, uTime * 0.9);
  float fade = 1.0 - smoothstep(0.0, uReach, vWorld.y - uLevel);
  gl_FragColor = vec4(uColor * c * fade * uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}
