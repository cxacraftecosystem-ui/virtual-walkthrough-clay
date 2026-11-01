/**
 * A disc of sky seen up through an oculus (the dome's, the Red Room's): unlit and not tone-mapped
 * at about 1.0, so the opening reads as real sky at every hour — a clear zenith blue by day (paler
 * towards its rim, a few soft clouds), peach and lilac at a low sun, a deep starry blue at night —
 * and never clips to a white hole under the room's exposure, nor greys into a frosted lamp.
 *
 * One-sided, facing down: from above (the Sky Rim, the roof) it is culled, and the real sky and
 * the room below show through the opening.
 */
import * as THREE from 'three'
import { ambience, sunState } from '../lighting/timeOfDayState'
import { weatherNow } from '../lighting/weather/weatherState'

const DAY = new THREE.Color('#5f97dc')
const DAY_EDGE = new THREE.Color('#a9c8ee')
const DUSK = new THREE.Color('#d9a08f')
const DUSK_EDGE = new THREE.Color('#f1cfae')
const NIGHT = new THREE.Color('#0c1838')
const NIGHT_EDGE = new THREE.Color('#1a2950')
/** A monsoon sky: low grey cloud. */
const OVERCAST = new THREE.Color('#9aa0a6')
const grey = new THREE.Color()

const VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const FRAG = /* glsl */ `
uniform vec3 uCentre;
uniform vec3 uEdge;
uniform float uStars;
uniform float uClouds;
uniform float uR;
uniform float uTime;
uniform vec2 uC;
varying vec2 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 q = (vP - uC) / uR;
  float t = clamp(length(q), 0.0, 1.0);
  vec3 c = mix(uCentre, uEdge, smoothstep(0.15, 1.0, t));
  // a few soft clouds drifting slowly across (by day only)
  vec2 cp = q * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
  float n = noise(cp * 2.0) * 0.6 + noise(cp * 4.3) * 0.3 + noise(cp * 9.1) * 0.1;
  float cloud = smoothstep(0.52, 0.78, n) * uClouds;
  c = mix(c, vec3(0.96, 0.95, 0.93), cloud * 0.75);
  // stars: a sparse grid of tiny points, a few brighter
  vec2 g = q * 34.0;
  vec2 cell = floor(g);
  float h = hash(cell);
  vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  float d = length(fract(g) - 0.5 - o * 0.6);
  float star = step(0.9, h) * smoothstep(0.09, 0.0, d) * (0.6 + 0.8 * hash(cell + 1.3));
  c += vec3(0.9, 0.93, 1.0) * star * uStars;
  gl_FragColor = vec4(c, 1.0);
}
`

export interface SkyDisc {
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  /** Follow the hour (call every frame). */
  update(elapsed: number): void
  dispose(): void
}

/** A sky disc of radius `r` centred on (cx, y, cz), facing down. `clouds` 0 … 1 (a small oculus: none). */
export function makeSkyDisc(cx: number, y: number, cz: number, r: number, clouds = 0): SkyDisc {
  const geometry = new THREE.CircleGeometry(r, 96)
  // facing down into the room
  geometry.rotateX(Math.PI / 2)
  geometry.translate(cx, y, cz)
  const material = new THREE.ShaderMaterial({
    name: 'skyDisc',
    uniforms: {
      uCentre: { value: DAY.clone() },
      uEdge: { value: DAY_EDGE.clone() },
      uStars: { value: 0 },
      uClouds: { value: clouds },
      uR: { value: r },
      uTime: { value: 0 },
      uC: { value: new THREE.Vector2(cx, cz) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    toneMapped: false,
    side: THREE.FrontSide,
  })
  const u = material.uniforms
  return {
    geometry,
    material,
    update(elapsed: number) {
      const d = ambience.daylight
      const dusk = Math.min(1, sunState.curve.sunset / 0.42) * (1 - ambience.night)
      u.uCentre.value.copy(NIGHT).lerp(DAY, d).lerp(DUSK, dusk * 0.7)
      u.uEdge.value.copy(NIGHT_EDGE).lerp(DAY_EDGE, d).lerp(DUSK_EDGE, dusk * 0.7)
      // under monsoon cloud the disc is a low grey sky (dimmed with the light at night)
      const oc = weatherNow.overcast * 0.85
      grey.copy(OVERCAST).multiplyScalar(0.25 + 0.75 * d)
      u.uCentre.value.lerp(grey, oc)
      u.uEdge.value.lerp(grey, oc)
      u.uStars.value = Math.max(0, 1 - d * 2.5) * (1 - ambience.twilight * 0.5) * (1 - weatherNow.overcast)
      u.uClouds.value = clouds * d * (1 - weatherNow.overcast)
      u.uTime.value = elapsed
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
