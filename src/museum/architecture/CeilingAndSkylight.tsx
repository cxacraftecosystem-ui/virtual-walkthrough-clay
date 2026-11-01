/**
 * The flat roof of the ambulatory and the annex (GRAND §2.5, PDF p03/p04 "roof slab and
 * overhang"): one slab from the gallery ring's circle out over the lobe and the annex,
 * overhanging every outside wall by the elevation's 0.9 m, with a parapet up to the drum's
 * 10 m line. Over the ring the coffered dome (Dome.tsx) rises out of it, its cornice standing
 * on the slab.
 *
 *   soffit ....... the ambulatory's and the annex's ceiling (blush plaster), open over the ring
 *   slab edge .... a pale clay fascia from the soffit to the parapet's top, a parapet cap
 *   roof ......... terracotta between the parapet and the dome's cornice
 *   hatch ........ the slab is open over the east stair's upper flight (EastStair.tsx builds the
 *                  stair-house over it)
 *   skylight ..... the Earth Room's round roof light over its table (p05 "round table under an
 *                  oculus"): a light-well lined in blush plaster up through the slab, a low
 *                  upstand and a glazed disc
 *
 * `OCULUS_STEPS` and `COLLAR` keep the shape the light engine reads (lighting/atmosphere): the
 * oculus as an aperture at the bottom and top of the dome's light-well, and the collar round it.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ambience } from '../lighting/timeOfDayState'
import { weatherNow } from '../lighting/weather/weatherState'
import { ZoneGroup } from '../navigation/zoneCulling'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { SKY_RIM } from '../config/satellites'
import { useMaterials, type MaterialKey } from '../materials/materials'
import { OCULUS_APERTURE } from './domeGeometry'
import { hatchOutline } from './EastStair'
import { ARC_CHORD, circlePoints, cylinderFace, mergeAll, outlineSides, planFace } from './shellGeometry'

const H = MUSEUM.pavilion.ceilingHeight
const TOP = H + MUSEUM.pavilion.roofThickness
const PARAPET = { top: MUSEUM.pavilion.height, t: 0.3 }
/** The parapet's glazed coping: its height and how far it drips past the fascia. */
const COPING = 0.16
const COPING_DRIP = 0.06

/** The oculus as the light engine's aperture: [0] the open circle at the lowest terrace, [1] the light-well's top. */
export const OCULUS_STEPS = OCULUS_APERTURE
/** The collar round the light-well, above the dome. */
export const COLLAR = { r: SKY_RIM.upstand.r1, top: MUSEUM.dome.collarTop }

/** The Earth Room's roof light: centre and radius (GRAND §1.2 annex.skylight). */
export const ANNEX_SKYLIGHT = { x: 0, z: KEY.annexSkylightZ, r: MUSEUM.annex.skylight.r, upstand: 0.35 }

/** Points along a circle from → to (radians), inclusive. */
function arc(r: number, a0: number, a1: number): [number, number][] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / ARC_CHORD))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [r * Math.cos(a), r * Math.sin(a)] as [number, number]
  })
}

/**
 * Roof edge in plan: the building's outer wall faces pushed out by the overhang — the lobe
 * and gallery-ring circles, the annex, and at each notch a straight return parallel to the
 * notch wall's outer face.
 */
export function roofOutline(overhang: number = MUSEUM.pavilion.roofOverhang): [number, number][] {
  const d = MUSEUM.drum.thickness / 2 + overhang
  const R1 = KEY.lobeOuterR + overhang
  const R2 = KEY.ringOuterR + overhang
  const xa = KEY.annexOuterHalf + overhang
  const zEnd = KEY.annexOuterZ + overhang
  const ne = MUSEUM.drum.neNotchDeg * DEG
  const dn = MUSEUM.drum.dNotchDeg * DEG
  const toAnnex = Math.acos(xa / R1)
  return [
    ...arc(R1, ne - Math.asin(d / R1), toAnnex),
    [xa, zEnd],
    [-xa, zEnd],
    ...arc(R1, Math.PI - toAnnex, dn + Math.asin(d / R1)),
    ...arc(R2, dn + Math.asin(d / R2), ne + Math.PI * 2 - Math.asin(d / R2)),
  ]
}

/** Signed area in (x, z): > 0 when the outline turns from +x towards +z. */
function signedArea(p: [number, number][]) {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i]
    const [x1, z1] = p[(i + 1) % p.length]
    a += x0 * z1 - x1 * z0
  }
  return a / 2
}

const skylightGlass = new THREE.MeshPhysicalMaterial({ name: 'annexSkylight', color: '#e4f0f2', transparent: true, opacity: 0.18, roughness: 0.04, metalness: 0, envMapIntensity: 1.2, depthWrite: false })

type Part = { key: MaterialKey; geo: THREE.BufferGeometry; cast: boolean }

export function CeilingAndRoof() {
  const m = useMaterials()
  const parts = useMemo<Part[]>(() => {
    const outline = roofOutline()
    const inset = roofOutline(MUSEUM.pavilion.roofOverhang - PARAPET.t)
    const outward = (signedArea(outline) > 0 ? -1 : 1) as 1 | -1
    const full = Math.PI * 2
    const S = ANNEX_SKYLIGHT
    const sky = circlePoints(S.x, S.z, S.r).reverse()
    const list: Part[] = []
    const add = (key: MaterialKey, cast: boolean, ...g: (THREE.BufferGeometry | null)[]) => {
      const geo = mergeAll(g)
      if (geo) list.push({ key, geo, cast })
    }
    // soffit: the ambulatory and the annex, open over the ring (the dome), the skylight and the stair's hatch
    const hatch = hatchOutline()
    add('clayCeiling', true, planFace(outline, H, false, [circlePoints(0, 0, KEY.ringC).reverse(), sky, hatch]))
    // the slab's edge up to the parapet and the parapet's inner face: a deep terracotta fascia;
    // a glazed terracotta coping on top that catches the sky (never a pale band of slab)
    add('clayTerracotta', true, outlineSides(outline, H, PARAPET.top - COPING, outward), outlineSides(inset, TOP, PARAPET.top - COPING, (-outward) as 1 | -1))
    add('glazedTerracotta', true, outlineSides(roofOutline(MUSEUM.pavilion.roofOverhang + COPING_DRIP), PARAPET.top - COPING, PARAPET.top, outward), outlineSides(inset, PARAPET.top - COPING, PARAPET.top, (-outward) as 1 | -1), planFace(roofOutline(MUSEUM.pavilion.roofOverhang + COPING_DRIP), PARAPET.top, true, [inset.slice().reverse()]), planFace(roofOutline(MUSEUM.pavilion.roofOverhang + COPING_DRIP), PARAPET.top - COPING, false, [outline.slice().reverse()]))
    // the roof: from the parapet to the dome's cornice, round the skylight's upstand
    add('clayTerracotta', true, planFace(inset, TOP, true, [circlePoints(0, 0, KEY.ringOuterR).reverse(), circlePoints(S.x, S.z, S.r + 0.12).reverse(), hatch]))
    // the hatch's cut through the slab
    add('blushPlaster', false, outlineSides(hatch, H - 0.01, TOP + 0.01, 1))
    // the skylight: its well through the slab, the upstand, the upstand's cap
    add('blushPlaster', false, cylinderFace(S.x, S.z, S.r, 0, full, H - 0.01, TOP + S.upstand, 'in'))
    add('clayBuff', true, cylinderFace(S.x, S.z, S.r + 0.12, 0, full, TOP - 0.01, TOP + S.upstand, 'out'), planFace(circlePoints(S.x, S.z, S.r + 0.12), TOP + S.upstand, true, [circlePoints(S.x, S.z, S.r).reverse()]))
    return list
  }, [])
  useEffect(() => () => parts.forEach((p) => p.geo.dispose()), [parts])
  const glass = useMemo(() => {
    const g = new THREE.CircleGeometry(ANNEX_SKYLIGHT.r, 48)
    g.rotateX(-Math.PI / 2)
    g.translate(ANNEX_SKYLIGHT.x, TOP + ANNEX_SKYLIGHT.upstand - 0.02, ANNEX_SKYLIGHT.z)
    return g
  }, [])
  useEffect(() => () => glass.dispose(), [glass])

  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={m[p.key]} castShadow={p.cast} receiveShadow />
      ))}
      <mesh geometry={glass} material={skylightGlass} raycast={() => null} renderOrder={2} />
      <ZoneGroup zones={['annex', 'entrance-court', 'entry-e']}>
        <SkylightBeam />
      </ZoneGroup>
    </group>
  )
}

/**
 * The Earth Room's beam (p05 "round table under a skylight", GRAND §6.5): a soft column of
 * daylight from the round roof light down to the fluted table, as the dust in the hall shows it.
 * One additive open cylinder: brightest where the column is seen through its middle, soft at its
 * silhouette, fading towards the table; it follows the daylight and goes out at night.
 */
const BEAM_TOP = H - 0.02
const BEAM_FOOT = 0.92
const beamMat = new THREE.ShaderMaterial({
  name: 'annexBeam',
  uniforms: { uColor: { value: new THREE.Color('#fff1dc') }, uGain: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    varying float vT;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      vT = clamp((wp.y - ${BEAM_FOOT.toFixed(3)}) / ${(BEAM_TOP - BEAM_FOOT).toFixed(3)}, 0.0, 1.0);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uGain;
    varying vec3 vN;
    varying vec3 vV;
    varying float vT;
    void main() {
      float face = abs(dot(normalize(vN), normalize(vV)));
      float a = pow(face, 1.6) * (0.35 + 0.65 * vT) * smoothstep(0.0, 0.12, vT);
      gl_FragColor = vec4(uColor * a * uGain, 1.0);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
})

function SkylightBeam() {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(ANNEX_SKYLIGHT.r * 0.96, ANNEX_SKYLIGHT.r * 0.82, BEAM_TOP - BEAM_FOOT, 48, 1, true)
    g.translate(ANNEX_SKYLIGHT.x, (BEAM_TOP + BEAM_FOOT) / 2, ANNEX_SKYLIGHT.z)
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(() => {
    beamMat.uniforms.uGain.value = 0.085 * ambience.daylight * (1 - 0.6 * weatherNow.overcast)
  })
  return <mesh geometry={geo} material={beamMat} renderOrder={40} raycast={() => null} frustumCulled={false} />
}
