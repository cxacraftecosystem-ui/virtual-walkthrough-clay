/**
 * 'water-rill' — the Threshold of Earth (SPECTACLE F2): a terracotta-lined rill of still water on
 * the entrance axis, running from the far edge of the forecourt to the door sill and mirroring
 * the door (materials/waterShader.ts 'rill': the sky and the entrance front, the doorway warm).
 *
 * Origin at the rill's centre on the paving; it runs along the object's local z (`length`,
 * `width`). Flush with the paving (2–3 mm proud, no pointer hits), so visitors walk over it and a
 * click on it still walks them there. Low: still water; Medium and up: the surface drifts slowly
 * towards the door. The two lines of diyas beside it belong to WP2's diya field (set 'path').
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DOME } from '../architecture/domeGeometry'
import { KEY, MUSEUM } from '../config/museum'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { createPlanarMirror, tickPlanarMirrors } from '../materials/planarMirror'
import { createWaterMaterial, waterUniforms } from '../materials/waterShader'
import { useSpectacle } from '../spectacle/settings'
import { planarWater } from './waterRing'
import type { ModelProps } from './types'
import { num } from './types'

const noRaycast = () => null
const noBeforeRender = () => {}

export function WaterRill({ config }: ModelProps) {
  const sp = useSpectacle()
  const m = useMaterials()
  const length = num(config, 'length', 8.4)
  const width = num(config, 'width', 0.4)
  const uniforms = useMemo(() => {
    const u = waterUniforms()
    u.uTint.value.set('#151012')
    u.uLevel.value = 0.003
    // the entrance front this rill looks back at (world space)
    u.uFacade.value.set(KEY.annexOuterZ, KEY.annexOuterHalf, KEY.doorHalf, MUSEUM.annex.door.height)
    u.uDoor.value.set(MUSEUM.pavilion.height, 0)
    // the drum and the dome behind it (materials/waterShader.ts): the rill holds the whole building
    u.uBuilding.value.set(DOME.cy, DOME.RE, KEY.lobeOuterR, MUSEUM.dome.springY)
    return u
  }, [])
  // Medium and up: a rendered mirror of the real front, door, drum, dome and sky; Low: analytic
  const planarPx = planarWater(sp) ? Math.round(sp.caps.waterMirrorPx * 0.75) : 0
  const camera = useThree((s) => s.camera)
  const mirror = useMemo(() => (planarPx > 0 ? createPlanarMirror(0.003, planarPx, (c) => c === camera) : null), [planarPx, camera])
  useEffect(() => () => mirror?.dispose(), [mirror])
  const water = useMemo(() => {
    if (mirror) {
      uniforms.uMirror.value = mirror.texture
      uniforms.uMirrorMat.value = mirror.matrix
    }
    return createWaterMaterial('rill', uniforms, !!mirror)
  }, [uniforms, mirror])
  useEffect(() => () => water.dispose(), [water])
  const geo = useMemo(() => {
    const surf = new THREE.PlaneGeometry(width, length, 1, Math.ceil(length / 0.5))
    surf.rotateX(-Math.PI / 2)
    surf.translate(0, 0.003, 0)
    // terracotta tile edging either side and across both ends
    const e = 0.07
    const parts = [
      [-(width / 2 + e / 2), 0, e, length + 2 * e],
      [width / 2 + e / 2, 0, e, length + 2 * e],
      [0, -(length / 2 + e / 2), width, e],
      [0, length / 2 + e / 2, width, e],
    ].map(([x, z, w, l]) => {
      const g = new THREE.PlaneGeometry(w, l)
      g.rotateX(-Math.PI / 2)
      g.translate(x, 0.004, z)
      return g
    })
    return { surf, parts }
  }, [length, width])
  useEffect(
    () => () => {
      geo.surf.dispose()
      geo.parts.forEach((g) => g.dispose())
    },
    [geo],
  )
  const flowing = sp.mode === 'full'
  useFrame(({ clock }) => {
    const u = uniforms
    u.uTime.value = clock.elapsedTime
    tickPlanarMirrors()
    u.uDay.value = ambience.daylight
    u.uNight.value = ambience.night
    u.uRoom.value = 0.4 + 0.6 * ambience.daylight
    // a calm surface: the wide channel holds the building as a mirror, barely stirred
    u.uSwell.value = sp.mode === 'still' ? 0 : 0.22
    // a slow drift towards the door (−z in world): the rill's local z is world z here
    u.uFlow.value.set(0, flowing ? -1.2 : 0)
    u.uSkyZenith.value.setRGB(0.12 + 0.2 * ambience.daylight, 0.28 + 0.3 * ambience.daylight, 0.62 + 0.25 * ambience.daylight).multiplyScalar(1 - 0.9 * ambience.night)
    u.uSkyHorizon.value.setRGB(0.85, 0.82 + 0.06 * ambience.daylight, 0.78 + 0.12 * ambience.daylight).lerp(new THREE.Color(0.95, 0.55, 0.32), ambience.twilight * 0.6).multiplyScalar(1 - 0.9 * ambience.night)
  })
  return (
    <group name="water-rill">
      <mesh geometry={geo.surf} material={water} raycast={noRaycast} onBeforeRender={mirror?.onBeforeRender ?? noBeforeRender} />
      {geo.parts.map((g, i) => (
        <mesh key={i} geometry={g} material={m.clayTerracotta} receiveShadow raycast={noRaycast} />
      ))}
    </group>
  )
}
