/**
 * In-scene mount: the installations' pieces that are not scene objects (GRAND §3, §6.3, §6.5).
 * Owned by P3. Mounted by spectacle/Spectacle.tsx inside its own error boundary.
 *
 *   Earth Room ring  a brass ring inlaid in the floor round the table under the skylight
 *   sky beam         the Earth Room's shaft of daylight from the skylight onto the table: a soft
 *                    additive column leaning with the sun, strongest at midday, gone at night
 *
 *   well washers    eight in-ground uplights round the foot of the Sphere Well's sphere, flush
 *                    with the floor: a brass trim and a glowing lens, no drawn beam (the
 *                    sphere's own uplit ramp is in models/claySphere.tsx)
 *   island shaft     Gallery C's one cool beam made visible: a faint haze column from its
 *                    concealed head down onto the black ware island (accents.ts `c-island-beam`)
 *
 * The raw-clay fields are drawn by architecture/RawClayPatches.tsx (also P3), mounted with the
 * pavilion. Everything here is culled with its zone and takes no pointer hit.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { annulusFace, mergeAll } from '../../architecture/shellGeometry'
import { buildAccents } from '../../config/accents'
import { KEY, MUSEUM } from '../../config/museum'
import { SPHERE_WELL } from '../../config/satellites'
import { sunDirection } from '../../lighting/solar'
import { ambience, sunState } from '../../lighting/timeOfDayState'
import { useMaterials } from '../../materials/materials'
import { ZoneGroup } from '../../navigation/zoneCulling'

const noRaycast = () => null

/* ------------------------------------------------------------------ */
/* the Earth Room: floor ring and sky beam                             */
/* ------------------------------------------------------------------ */

const TABLE = { z: KEY.annexSkylightZ, ringR: MUSEUM.annex.skylight.r, top: 0.9 }

const inlay = new THREE.MeshStandardMaterial({ name: 'earthRingBrass', color: '#b48a4a', metalness: 0.85, roughness: 0.32, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })

const BEAM_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vV;
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`
const BEAM_FRAG = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vV;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  // vLocal.y runs 0 (floor end) … 1 (skylight end). The column is an open shell, so its soft edge
  // comes from the view: bright where the eye looks through the shaft's core, gone at its
  // silhouette (a radius test on the shell itself was 1 everywhere, and drew nothing)
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float along = smoothstep(0.0, 0.18, vLocal.y) * (0.55 + 0.45 * vLocal.y);
  float dust = 0.75 + 0.25 * n2(vec2(atan(vLocal.z, vLocal.x) * 3.0, vLocal.y * 6.0 - uTime * 0.05));
  float a = uStrength * edge * along * dust;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`

function SkyBeam() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'earthSkyBeam',
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: { uStrength: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffe7c4') } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  // a unit open column: radius 1 across, y 0 … 1
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 48, 8, true)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  useEffect(() => () => {
    mat.dispose()
    geo.dispose()
  }, [mat, geo])
  const top = new THREE.Vector3(0, MUSEUM.pavilion.ceilingHeight, TABLE.z)
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), q: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0) }), [])
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    // towards the sun
    tmp.dir.set(...sunDirection(sunState))
    const sunUp = Math.max(0, tmp.dir.y)
    const strength = 0.11 * ambience.daylight * THREE.MathUtils.smoothstep(sunUp, 0.25, 0.75)
    mat.uniforms.uStrength.value = strength
    mat.uniforms.uTime.value = clock.elapsedTime
    m.visible = strength > 0.004
    if (!m.visible) return
    // from the floor patch up to the skylight, leaning with the sun
    const len = top.y / Math.max(0.25, tmp.dir.y)
    m.position.copy(top).addScaledVector(tmp.dir, -len)
    m.quaternion.copy(tmp.q.setFromUnitVectors(tmp.up, tmp.dir))
    m.scale.set(MUSEUM.annex.skylight.r * 0.92, len, MUSEUM.annex.skylight.r * 0.92)
  })
  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={3} raycast={noRaycast} />
}

function EarthRoom() {
  const geo = useMemo(() => annulusFace(0, TABLE.z, TABLE.ringR, TABLE.ringR + 0.045, 0, Math.PI * 2, 0.003, true), [])
  useEffect(() => () => geo?.dispose(), [geo])
  return (
    <group name="earth-room">
      {geo && <mesh geometry={geo} material={inlay} receiveShadow raycast={noRaycast} />}
      <SkyBeam />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* the Sphere Well's floor washers                                     */
/* ------------------------------------------------------------------ */

const SW = SPHERE_WELL
/**
 * In-ground uplights round the sphere, sunk flush into the floor: a thin brass trim ring and a
 * warm lens, nothing standing proud of the floor (the fittings read as a smudge under the sphere
 * from the stair) and no drawn beam (the additive cones read as five amber traffic cones). The
 * sphere's underside glow is its own accent; these are the visible sources.
 */
const WASH = { n: 8, r: SW.sphereR + 0.75, can: 0.07, trim: 0.012 }

function WellWashers() {
  const core = useMaterials()
  const geo = useMemo(() => {
    const trims: THREE.BufferGeometry[] = []
    const lenses: THREE.BufferGeometry[] = []
    for (let i = 0; i < WASH.n; i++) {
      const a = ((i + 0.5) / WASH.n) * Math.PI * 2
      const x = SW.cx + Math.cos(a) * WASH.r
      const z = SW.cz + Math.sin(a) * WASH.r
      const trim = new THREE.RingGeometry(WASH.can * 0.78, WASH.can + WASH.trim, 24)
      trim.rotateX(-Math.PI / 2)
      trim.translate(x, SW.floorY + 0.003, z)
      trims.push(trim)
      const lens = new THREE.CircleGeometry(WASH.can * 0.78, 20)
      lens.rotateX(-Math.PI / 2)
      lens.translate(x, SW.floorY + 0.0035, z)
      lenses.push(lens)
    }
    return { trims: mergeAll(trims.map((g) => g.toNonIndexed())), lenses: mergeAll(lenses.map((g) => g.toNonIndexed())) }
  }, [])
  useEffect(() => () => [geo.trims, geo.lenses].forEach((g) => g?.dispose()), [geo])
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'washerLens', color: new THREE.Color('#ffc58a').multiplyScalar(2.2), toneMapped: false }), [])
  useEffect(() => () => lensMat.dispose(), [lensMat])
  return (
    <group name="well-washers">
      {geo.trims && <mesh geometry={geo.trims} material={core.brass} receiveShadow raycast={noRaycast} />}
      {geo.lenses && <mesh geometry={geo.lenses} material={lensMat} raycast={noRaycast} />}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Gallery C: the island's cool beam, seen in the air                   */
/* ------------------------------------------------------------------ */

const SHAFT_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vY = uv.y;
  gl_Position = projectionMatrix * mv;
}
`
const SHAFT_FRAG = /* glsl */ `
uniform float uStrength;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  // a haze, not a cone: bright only through the column's core, gone at its silhouette and fading
  // out towards the head
  float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.4);
  float fade = smoothstep(0.0, 0.12, vY) * (1.0 - smoothstep(0.55, 1.0, vY));
  gl_FragColor = vec4(uColor * uStrength * core * fade, 1.0);
}
`

function IslandShaft() {
  const beam = useMemo(() => buildAccents().find((a) => a.id === 'c-island-beam'), [])
  const geo = useMemo(() => {
    if (!beam) return null
    const top = new THREE.Vector3(...beam.pos)
    const foot = new THREE.Vector3(...beam.target)
    const len = top.distanceTo(foot)
    const r1 = Math.tan(beam.beamDeg * (Math.PI / 180)) * len
    // uv.y 1 at the head (CylinderGeometry's top), 0 on the island
    const g = new THREE.CylinderGeometry(0.08, r1, len, 40, 4, true)
    g.translate(0, len / 2, 0)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize()))
    g.translate(foot.x, foot.y, foot.z)
    return g
  }, [beam])
  useEffect(() => () => geo?.dispose(), [geo])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'islandShaft',
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        uniforms: { uStrength: { value: 0.06 }, uColor: { value: new THREE.Color('#dfe9ff') } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    // the haze reads against the dark bay: a little stronger after dark
    mat.uniforms.uStrength.value = 0.05 + 0.04 * (1 - ambience.daylight)
  })
  if (!geo) return null
  return <mesh geometry={geo} material={mat} renderOrder={3} raycast={noRaycast} />
}

export function InstallationsMount() {
  return (
    <>
      <ZoneGroup zones={['annex', 'entrance-court', 'entry-e']}>
        <EarthRoom />
      </ZoneGroup>
      <ZoneGroup zones={['entrance-court', 'sphere-well']}>
        <WellWashers />
      </ZoneGroup>
      <ZoneGroup zones={['ring-c']}>
        <IslandShaft />
      </ZoneGroup>
    </>
  )
}
