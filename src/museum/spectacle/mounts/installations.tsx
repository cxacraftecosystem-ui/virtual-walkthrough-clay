/**
 * In-scene mount: the installations' pieces that are not scene objects (GRAND §3, §6.3, §6.5).
 * Owned by P3. Mounted by spectacle/Spectacle.tsx inside its own error boundary.
 *
 *   Earth Room ring  a brass ring inlaid in the floor round the table under the skylight
 *   sky beam         the Earth Room's shaft of daylight from the skylight onto the table: a soft
 *                    additive column leaning with the sun, strongest at midday, gone at night
 *
 *   well washers    eight brass floor washers round the foot of the Sphere Well's sphere, each
 *                    with a glowing lens and a faint additive beam rising onto the sphere's
 *                    underside (the sphere's own uplit ramp is in models/claySphere.tsx)
 *
 * The raw-clay fields are drawn by architecture/RawClayPatches.tsx (also P3), mounted with the
 * pavilion. Everything here is culled with its zone and takes no pointer hit.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { annulusFace, mergeAll } from '../../architecture/shellGeometry'
import { DEG, KEY, MUSEUM } from '../../config/museum'
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
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const BEAM_FRAG = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec3 vLocal;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  // vLocal.y runs 0 (floor end) … 1 (skylight end); x, z across the unit column
  float r = length(vLocal.xz);
  float edge = smoothstep(1.0, 0.55, r);
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
const WASH = { n: 8, r: SW.sphereR + 0.75, can: 0.09, canH: 0.06 }

const WASH_VERT = /* glsl */ `
attribute float aAlong;
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main() {
  vAlong = aAlong;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`
const WASH_FRAG = /* glsl */ `
uniform float uStrength;
uniform vec3 uColor;
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main() {
  // a soft volume: bright where we look through the beam's core, gone at its silhouette
  float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float along = (1.0 - vAlong) * smoothstep(0.0, 0.08, vAlong);
  gl_FragColor = vec4(uColor * uStrength * core * along, 1.0);
}
`

function WellWashers() {
  const core = useMaterials()
  const geo = useMemo(() => {
    const cans: THREE.BufferGeometry[] = []
    const lenses: THREE.BufferGeometry[] = []
    const pos: number[] = []
    const along: number[] = []
    const idx: number[] = []
    const centre = new THREE.Vector3(SW.cx, SW.sphereY - SW.sphereR * 0.35, SW.cz)
    const segs = 18
    const rings = 6
    for (let i = 0; i < WASH.n; i++) {
      const a = ((i + 0.5) / WASH.n) * Math.PI * 2
      const x = SW.cx + Math.cos(a) * WASH.r
      const z = SW.cz + Math.sin(a) * WASH.r
      const can = new THREE.CylinderGeometry(WASH.can, WASH.can * 1.15, WASH.canH, 20)
      can.translate(x, SW.floorY + WASH.canH / 2, z)
      cans.push(can)
      const lens = new THREE.CircleGeometry(WASH.can * 0.78, 20)
      lens.rotateX(-Math.PI / 2)
      lens.translate(x, SW.floorY + WASH.canH + 0.002, z)
      lenses.push(lens)
      // the beam: a cone from the lens to the sphere's underside, widening as it rises
      const base = new THREE.Vector3(x, SW.floorY + WASH.canH, z)
      const dir = centre.clone().sub(base)
      const len = dir.length() - SW.sphereR * 0.6
      dir.normalize()
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
      const up = new THREE.Vector3().crossVectors(side, dir).normalize()
      const v0 = pos.length / 3
      for (let j = 0; j <= rings; j++) {
        const t = j / rings
        const rad = WASH.can * 0.7 + t * len * Math.tan(13 * DEG)
        for (let k = 0; k <= segs; k++) {
          const ph = (k / segs) * Math.PI * 2
          const p = base.clone().addScaledVector(dir, t * len).addScaledVector(side, Math.cos(ph) * rad).addScaledVector(up, Math.sin(ph) * rad)
          pos.push(p.x, p.y, p.z)
          along.push(t)
        }
      }
      for (let j = 0; j < rings; j++)
        for (let k = 0; k < segs; k++) {
          const a0 = v0 + j * (segs + 1) + k
          const b0 = a0 + segs + 1
          idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1)
        }
    }
    const beams = new THREE.BufferGeometry()
    beams.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    beams.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1))
    beams.setIndex(idx)
    beams.computeVertexNormals()
    beams.computeBoundingSphere()
    return { cans: mergeAll(cans.map((g) => g.toNonIndexed())), lenses: mergeAll(lenses.map((g) => g.toNonIndexed())), beams }
  }, [])
  useEffect(() => () => [geo.cans, geo.lenses, geo.beams].forEach((g) => g?.dispose()), [geo])
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ name: 'washerLens', color: new THREE.Color('#ffc58a').multiplyScalar(3), toneMapped: false }), [])
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'washerBeam',
        vertexShader: WASH_VERT,
        fragmentShader: WASH_FRAG,
        uniforms: { uStrength: { value: 0.16 }, uColor: { value: new THREE.Color('#ffb070') } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => {
    lensMat.dispose()
    beamMat.dispose()
  }, [lensMat, beamMat])
  useFrame(() => {
    // the beams read against the dark room: strongest at night, faint under a bright sky
    beamMat.uniforms.uStrength.value = 0.07 + 0.12 * (1 - ambience.daylight)
  })
  return (
    <group name="well-washers">
      {geo.cans && <mesh geometry={geo.cans} material={core.brass} receiveShadow raycast={noRaycast} />}
      {geo.lenses && <mesh geometry={geo.lenses} material={lensMat} raycast={noRaycast} />}
      <mesh geometry={geo.beams} material={beamMat} renderOrder={3} raycast={noRaycast} />
    </group>
  )
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
    </>
  )
}
