/**
 * THROAT OF THE KILN (SPECTACLE F5) — the entrance hall is dim and oxblood (its zone light,
 * config/lighting.ts `ZONE_LIGHT.annex`); a 30 mm warm light-line runs down the middle of the
 * floor from the door to the mouth, and a glow gathers on the description wall H round its
 * title, so from the forecourt you see only H, lit at the end of a dark throat.
 *
 * The line is an emissive strip (it blooms on H+); the glow is the injection's spare glow point
 * (inject.ts GLOW_SLOT.spare): light on the wall, not a sprite over the lettering.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../../config/lighting'
import { SURFACES, surfacePoint } from '../../config/layout'
import { KEY, MUSEUM } from '../../config/museum'
import { ZoneGroup } from '../../navigation/zoneCulling'
import { visitor } from '../../state/visitor'
import { ambience } from '../timeOfDayState'
import { GLOW_SLOT, setGlowPoint } from './inject'

const LINE_W = 0.03
/** The strip stands just proud of the floor (no shared plane with it). */
const LINE_Y = 0.003
/** The glow on H: its height, how far in front of the wall it sits, and its radius (m). */
/** The glow on H: local to the title (its reach is 4 × r), so the hall's far end stays dark at night. */
const H_GLOW = { y: 3.4, standOff: 1.8, r: 2.4 }

export function ThroatOfKiln() {
  const { mesh, mat } = useMemo(() => {
    const z0 = KEY.annexMouthZ + 0.35
    const z1 = MUSEUM.annex.endZ - 0.12
    const geo = new THREE.PlaneGeometry(LINE_W, z1 - z0).rotateX(-Math.PI / 2)
    geo.translate(0, LINE_Y, (z0 + z1) / 2)
    const mat = new THREE.MeshBasicMaterial({ name: 'annexLightLine', color: new THREE.Color(kelvinToHex(2300)), toneMapped: true })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.raycast = () => null
    mesh.name = 'annex-light-line'
    return { mesh, mat }
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mat.dispose()
    },
    [mesh, mat],
  )

  // the glow on H: in front of the title's middle, at its height
  const glow = useMemo(() => {
    const s = SURFACES['h-description']
    const at = (s.range[0] + s.range[1]) / 2
    // H's carved title panel (6 × 4 m, GRAND §2.5): the glow gathers on its middle
    const p = surfacePoint('h-description', at, H_GLOW.y, H_GLOW.standOff).position
    return { p, color: new THREE.Color(kelvinToHex(2500)) }
  }, [])
  const base = useMemo(() => new THREE.Color(kelvinToHex(2300)), [])

  useFrame(() => {
    // brighter as the day goes: a glowing seam at night, a quiet one at noon
    const k = 1.6 + 2.2 * ambience.night
    mat.color.copy(base).multiplyScalar(k)
    // a strong halo: the title is the one lit thing at the end of the dark throat (the spare slot
    // is the guardians' while the visitor is outside the annex's door)
    if (visitor.z >= MUSEUM.annex.endZ) return
    setGlowPoint(GLOW_SLOT.spare, glow.p[0], glow.p[1], glow.p[2], H_GLOW.r, glow.color, 0.9)
  })

  return (
    <ZoneGroup zones={['annex']}>
      <primitive object={mesh} />
    </ZoneGroup>
  )
}
