/**
 * The pavilion by night, from outside: the dome glows. A warm wash rises from the concealed
 * uplight ledge at the springing (DOME.ledge), one soft scallop between each pair of ribs, fading up
 * the tiled shell to a lit crown round the oculus collar, so from the forecourt and the air the
 * dome is a lantern over dark land. Low bollards line the forecourt's long edges, each throwing a
 * pool of light on the clay paving and the avenue's jacaranda trunks.
 *
 * Glow only — additive films over the shell and the paving, emissive lenses — no real lights, so
 * the light count never changes with the time of day. Everything fades with `ambience.night`
 * (dusk on), and is not drawn by day; the dome's wash also comes up softly at golden hour.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { ambience, sunState } from '../lighting/timeOfDayState'
import { ZoneGroup } from '../navigation/zoneCulling'
import { DOME, domeExterior } from './domeGeometry'

const WARM = new THREE.Color('#ffa65c')
const CROWN = new THREE.Color('#ffd2a0')

const DOME_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const DOME_FRAG = /* glsl */ `
uniform float uNight;
uniform vec3 uWarm;
uniform vec3 uCrown;
uniform float uY0;
uniform float uY1;
uniform float uRibs;
uniform float uRib0;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  float t = clamp((vWorld.y - uY0) / (uY1 - uY0), 0.0, 1.0);
  float a = atan(vWorld.z, vWorld.x) - uRib0;
  // one scallop per bay: brightest midway between two ribs, its width narrowing as it climbs
  float bay = 0.5 + 0.5 * cos(a * uRibs);
  float scallop = pow(bay, 1.0 + 5.0 * t);
  float wash = scallop * pow(1.0 - t, 1.6) * 1.15 + 0.12 * (1.0 - t);
  // the crown round the oculus: a band of warm light from the light-well
  float crown = smoothstep(0.82, 0.97, t) * 0.55;
  // a soft rim, so the silhouette reads against the night sky
  vec3 v = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(normalize(vNormalW), v)), 3.0) * 0.25;
  vec3 c = uWarm * (wash + rim) + uCrown * crown;
  gl_FragColor = vec4(c * uNight, 1.0);
}
`

function DomeGlow() {
  const geo = useMemo(() => {
    const g = domeExterior({ segments: 72, rows: 24 })
    if (!g) return null
    // a hair proud of the tiles (scaled about the dome's centre) so the film never z-fights them
    g.translate(0, -DOME.cy, 0)
    g.scale(1.012, 1.008, 1.012)
    g.translate(0, DOME.cy, 0)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'domeNightGlow',
        uniforms: {
          uNight: { value: 0 },
          uWarm: { value: WARM.clone().multiplyScalar(0.55) },
          uCrown: { value: CROWN.clone() },
          uY0: { value: DOME.ledge.y0 },
          uY1: { value: MUSEUM.dome.collarTop },
          uRibs: { value: MUSEUM.dome.ribs },
          // between two ribs: half a bay round from the first rib (plan angle → atan2(z, x))
          uRib0: { value: ((DOME.ribDeg(0) + 180 / MUSEUM.dome.ribs) * Math.PI) / 180 },
        },
        vertexShader: DOME_VERT,
        fragmentShader: DOME_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: true,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo?.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    // at golden hour the wash comes up early and soft, so the shell glows warm against the low sun
    // even where the avenue's trees shade the forecourt
    const golden = Math.min(1, sunState.curve.sunset / 0.42) * (1 - ambience.night)
    const n = Math.max(ambience.night, 0.4 * golden)
    mat.uniforms.uNight.value = n
    if (ref.current) ref.current.visible = n > 0.02
  })
  if (!geo) return null
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={3} raycast={() => null} visible={false} />
}

/** The bollards: both long edges of the forecourt, every ~7 m from the plinth's edge to its far end. */
export function bollardPositions(): [number, number][] {
  const FC = MUSEUM.forecourt
  const out: [number, number][] = []
  // on the paving's very edge, outside the forecourt's line of diyas (halfWidth − 0.5)
  const x = FC.halfWidth - 0.15
  const z0 = Math.sqrt(Math.max(0, MUSEUM.landscape.r ** 2 - x * x)) + 1.2
  for (let z = z0; z <= FC.endZ - 0.8; z += 7) for (const s of [-1, 1]) out.push([s * x, z])
  return out
}

const POOL_FRAG = /* glsl */ `
uniform float uNight;
uniform vec3 uWarm;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2);
  gl_FragColor = vec4(uWarm * a * uNight, 1.0);
}
`

function Bollards() {
  const pts = useMemo(bollardPositions, [])
  const post = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.09, 0.11, 0.8, 12)
    g.translate(0, 0.4, 0)
    return g
  }, [])
  const lens = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.094, 0.094, 0.16, 12, 1, true)
    g.translate(0, 0.66, 0)
    return g
  }, [])
  const pool = useMemo(() => {
    const g = new THREE.PlaneGeometry(5.6, 5.6)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0.012, 0)
    return g
  }, [])
  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ name: 'bollard', color: '#5a3a2c', roughness: 0.7, metalness: 0.2 }), [])
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'bollardLens', color: '#3a2a20', toneMapped: false }), [])
  const poolMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'bollardPool',
        uniforms: { uNight: { value: 0 }, uWarm: { value: WARM.clone().multiplyScalar(1.1) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: POOL_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  )
  useEffect(
    () => () => {
      ;[post, lens, pool].forEach((g) => g.dispose())
      ;[postMat, lensMat, poolMat].forEach((m) => m.dispose())
    },
    [post, lens, pool, postMat, lensMat, poolMat],
  )
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)]
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (const r of refs) {
      const im = r.current
      if (!im) continue
      pts.forEach(([x, z], i) => im.setMatrixAt(i, m.makeTranslation(x, 0, z)))
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts])
  const off = useMemo(() => new THREE.Color('#3a2a20'), [])
  const on = useMemo(() => new THREE.Color('#ffcf98').multiplyScalar(3), [])
  useFrame(() => {
    const n = ambience.night
    poolMat.uniforms.uNight.value = n
    lensMat.color.copy(off).lerp(on, n)
    const p = refs[2].current
    if (p) p.visible = n > 0.02
  })
  return (
    <group name="bollards">
      <instancedMesh ref={refs[0]} args={[post, postMat, pts.length]} castShadow receiveShadow raycast={() => null} />
      <instancedMesh ref={refs[1]} args={[lens, lensMat, pts.length]} raycast={() => null} />
      <instancedMesh ref={refs[2]} args={[pool, poolMat, pts.length]} renderOrder={2} raycast={() => null} visible={false} />
    </group>
  )
}

export function ExteriorNight() {
  return (
    <>
      {/* the dome is seen from everywhere outside, and from the Sky Rim */}
      <ZoneGroup zones={['entrance-court', 'parikrama-west', 'parikrama-east', 'sphere-well', 'sky-rim']}>
        <DomeGlow />
      </ZoneGroup>
      <ZoneGroup zones={['entrance-court', 'annex', 'sky-rim']}>
        <Bollards />
      </ZoneGroup>
    </>
  )
}
