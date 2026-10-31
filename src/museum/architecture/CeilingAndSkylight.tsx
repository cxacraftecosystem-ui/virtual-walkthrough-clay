/**
 * Roof of the clay pavilion: one slab over the drum and the annex, overhanging every
 * outside wall (the elevation's thick rim, a pale clay coping), open over the centre:
 *
 *   the OCULUS  an exposed skylight (no glass) of radius MUSEUM.oculus.r; its light well is
 *               lined in blush clay and carried up as a low collar above the roof, so from the
 *               court it reads as a deep, glowing ring (PDF p07)
 *   two steps   concentric soffit rings stepping down round the opening (3.05 / 3.5 m), the
 *               inner riser a warm concealed LED ring that glows by night
 *
 * Built face by face (shellGeometry.ts) so the slab's soffit, coping, top and the well each
 * take their own material and still merge in the pavilion's <StaticMerge>.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials, type MaterialKey } from '../materials/materials'
import { annulusFace, ARC_CHORD, circlePoints, cylinderFace, mergeAll, outlineSides, planFace } from './shellGeometry'

const H = MUSEUM.pavilion.ceilingHeight
const TOP = H + MUSEUM.pavilion.roofThickness
const OC = MUSEUM.oculus
/** Soffit steps round the oculus: [outer radius, underside height]. */
export const OCULUS_STEPS = [
  { r: OC.r + 0.45, y: H - 0.4 },
  { r: OC.r + 0.9, y: H - 0.2 },
] as const
/** The light well's collar above the roof. */
export const COLLAR = { r: OC.r + 0.35, top: TOP + 0.5 }

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
export function roofOutline(overhang = MUSEUM.pavilion.roofOverhang): [number, number][] {
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

/** Warm concealed LED ring on the oculus step riser (brighter at night). */
const ledRing = new THREE.MeshStandardMaterial({ name: 'oculusLed', color: '#f6d9c6', emissive: new THREE.Color('#ffc08f'), emissiveIntensity: 0.6, roughness: 0.7 })

type Part = { key: MaterialKey | 'led' | 'well'; geo: THREE.BufferGeometry }

export function CeilingAndRoof() {
  const m = useMaterials()
  // The well lining catches the sky: a little emissive bounce by day, none at night.
  const well = useMemo(() => {
    const w = (m.clayBlush as THREE.MeshStandardMaterial).clone()
    w.name = 'oculusWell'
    w.emissive = new THREE.Color('#f0b39d')
    w.emissiveIntensity = 0.12
    return w
  }, [m])
  useEffect(() => () => well.dispose(), [well])
  useFrame(() => {
    well.emissiveIntensity = 0.14 * ambience.daylight
    ledRing.emissiveIntensity = 0.55 + 1.6 * ambience.night
  })

  const parts = useMemo<Part[]>(() => {
    const outline = roofOutline()
    const outward = signedArea(outline) > 0 ? -1 : 1
    const full = Math.PI * 2
    const [s1, s2] = OCULUS_STEPS
    const list: Part[] = []
    const add = (key: Part['key'], ...g: (THREE.BufferGeometry | null)[]) => {
      const geo = mergeAll(g)
      if (geo) list.push({ key, geo })
    }
    // soffit: interior ceiling + the exterior overhang, open round the oculus steps
    add('clayCeiling', planFace(outline, H, false, [circlePoints(0, 0, s2.r).reverse()]), annulusFace(0, 0, s1.r, s2.r, 0, full, s2.y, false), annulusFace(0, 0, OC.r, s1.r, 0, full, s1.y, false), cylinderFace(0, 0, s2.r, 0, full, s2.y, H, 'out'))
    // the step's riser: a ring of concealed light
    add('led', cylinderFace(0, 0, s1.r, 0, full, s1.y, s2.y, 'out'))
    // pale clay coping (slab edge, the collar) round a terracotta roof
    add('clayBuff', outlineSides(outline, H, TOP, outward as 1 | -1), cylinderFace(0, 0, COLLAR.r, 0, full, TOP, COLLAR.top, 'out'), annulusFace(0, 0, OC.r, COLLAR.r, 0, full, COLLAR.top, true))
    add('clayTerracotta', planFace(outline, TOP, true, [circlePoints(0, 0, COLLAR.r).reverse()]))
    // light well lining, from the lowest step to the collar's top
    add('well', cylinderFace(0, 0, OC.r, 0, full, s1.y, COLLAR.top, 'in'))
    return list
  }, [])
  useEffect(() => () => parts.forEach((p) => p.geo.dispose()), [parts])

  return (
    <group>
      {parts.map((p) => (
        <mesh
          key={p.key}
          geometry={p.geo}
          material={p.key === 'led' ? ledRing : p.key === 'well' ? well : m[p.key]}
          castShadow={p.key !== 'led'}
          receiveShadow
        />
      ))}
    </group>
  )
}
