/**
 * Aerial perspective for the land round the site (the exterior only): the terrain ring and the
 * far woods fade with distance into a haze the colour of the sky's horizon at that moment — a pale
 * blue-grey by day, honey-gold at the golden hour, deep blue by night — so the land recedes in
 * layers to the horizon instead of ending in a hard, dark rim under a pale sky.
 *
 * `withHaze(material)` patches a built-in material (onBeforeCompile); `useHazeDriver()` (mounted
 * once, by the Landscape) follows the day curve and the weather each frame.
 */
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sunState } from '../lighting/timeOfDayState'
import { weatherNow } from '../lighting/weather/weatherState'

export const HAZE = {
  uHazeColor: { value: new THREE.Color('#bccbdb') },
  /** Distance (m) where the haze begins, where it is full, and its strength at full. */
  uHazeRange: { value: new THREE.Vector3(110, 760, 0.5) },
}

const DAY = new THREE.Color('#bccbdb')
const GOLD = new THREE.Color('#e9bd8e')
const NIGHT = new THREE.Color('#0a0e19')
const RAIN = new THREE.Color('#8e979f')
const tmp = new THREE.Color()

/** Patch a material so it fades into the haze with distance from the camera. */
export function withHaze<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHazeColor = HAZE.uHazeColor
    shader.uniforms.uHazeRange = HAZE.uHazeRange
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHazeDist;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHazeDist = length(mvPosition.xyz);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHazeDist;\nuniform vec3 uHazeColor;\nuniform vec3 uHazeRange;')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, uHazeRange.z * smoothstep(uHazeRange.x, uHazeRange.y, vHazeDist));\n#include <tonemapping_fragment>')
  }
  m.customProgramCacheKey = () => 'exteriorHaze'
  return m
}

/** Follow the moment: the haze takes the horizon's colour (call from one mounted component). */
export function useHazeDriver() {
  useFrame(() => {
    const c = sunState.curve
    tmp.copy(DAY).multiplyScalar(0.35 + 0.65 * c.daylight)
    tmp.lerp(GOLD, Math.min(1, c.sunset * 1.4))
    tmp.lerp(NIGHT, c.night)
    tmp.lerp(RAIN.clone().multiplyScalar(0.3 + 0.7 * c.daylight), weatherNow.overcast * 0.7)
    HAZE.uHazeColor.value.copy(tmp)
  })
}
