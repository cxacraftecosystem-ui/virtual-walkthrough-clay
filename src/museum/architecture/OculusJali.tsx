/**
 * THE OCULUS JALI — a pierced terracotta ring hung in the opening of the roof (SPECTACLE F10).
 *
 * r JALI.r0 … r1 (2.0 … 2.6 m), its underside flush with the roof's lowest soffit step. Sunlight
 * through its 32 lancets and quatrefoils throws a lace mandala onto the court floor: on Medium
 * and up through the shadow map (the ring casts alpha-tested shadows), on every tier through
 * the gobo (materials/mandalaBand.ts getJaliGobo) that the oculus mask samples (WP2). The kulhad
 * helix (models/kulhadHelix.tsx) hangs from it.
 *
 * Built from plan-mapped faces (underside, top, inner and outer rims) sharing one alpha mask, so
 * the piercings line up through the slab. Draws nothing it does not need: no raycast, no event.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { getJaliAlpha, GOBO_R, JALI, setPlanUV } from '../materials/mandalaBand'
import { OCULUS_STEPS } from './CeilingAndSkylight'
import { annulusFace, cylinderFace, mergeAll } from './shellGeometry'

/** Underside / top of the ring (m). */
export const JALI_Y = { y0: OCULUS_STEPS[0].y, y1: OCULUS_STEPS[0].y + 0.06 } as const

const noRaycast = () => null

export function OculusJali({ texPx = 1024 }: { texPx?: number }) {
  const geo = useMemo(() => {
    const full = Math.PI * 2
    const slabs = mergeAll([annulusFace(0, 0, JALI.r0, JALI.r1 - 0.002, 0, full, JALI_Y.y0, false), annulusFace(0, 0, JALI.r0, JALI.r1 - 0.002, 0, full, JALI_Y.y1, true)])
    const rim = cylinderFace(0, 0, JALI.r0, 0, full, JALI_Y.y0, JALI_Y.y1, 'in')
    if (!slabs || !rim) return null
    setPlanUV(slabs, GOBO_R)
    // the inner rim is solid clay: every vertex samples the solid band just outside r0
    const uv = rim.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (JALI.r0 + 0.035) / (2 * GOBO_R), 0.5)
    return mergeAll([slabs, rim])
  }, [])
  const mat = useMemo(() => {
    const alpha = getJaliAlpha(Math.min(2048, Math.max(512, texPx)))
    return new THREE.MeshStandardMaterial({
      name: 'oculusJali',
      color: new THREE.Color('#a4543a'),
      roughness: 0.82,
      metalness: 0,
      alphaMap: alpha,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    })
  }, [texPx])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null
  return <mesh name="oculus-jali" geometry={geo} material={mat} castShadow receiveShadow raycast={noRaycast} />
}

/** Underside height of the ring (helix anchor). */
export const JALI_UNDERSIDE = JALI_Y.y0
/** Clear height under the ring above the court floor (for checks). */
export const JALI_CLEAR = JALI_Y.y0 - MUSEUM.oculus.curbHeight
