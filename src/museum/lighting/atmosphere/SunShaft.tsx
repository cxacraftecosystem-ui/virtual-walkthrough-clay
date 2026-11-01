/**
 * SUN SHAFT (SPECTACLE F8, GRAND §6.2 #1, #5) — a leaning column of sunlight from the Ø 10 m
 * oculus, 20 m down to the court floor, that follows the real sun. Clear air: the wash exists only
 * inside the beam's cylinder and is a third of the old haze, so the court reads crisp and the beam
 * reads as light, not fog. Back faces only, additive, no depth write, drawn after the water, the
 * flames and the rain (renderOrder 40).
 *
 * It fades below 4° of elevation and becomes a faint cool moonbeam at night (0.25), closes with
 * the monsoon's cloud, and swells with the Turn. Off with `spectacleOff` (Lite) or the curator's
 * `oculus-light {shaft:false}`; the sun patch on the floor stays either way.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../../config/lighting'
import type { QualityTier } from '../../config/quality'
import { ZoneGroup } from '../../navigation/zoneCulling'
import { kindProps } from '../../spectacle/settings'
import { useMuseum } from '../../state/store'
import { sunState } from '../timeOfDayState'
import { weatherNow } from '../weather/weatherState'
import { ATMOS } from './inject'
import { SHAFT_FRAG, SHAFT_VERT } from './shaftShader'
import { turnState } from './turn'

/** Radial segments and samples along the view ray per tier (L: no fbm). */
const TIER: Record<QualityTier, { segs: number; samples: number; noise: number }> = {
  low: { segs: 32, samples: 3, noise: 0 },
  medium: { segs: 48, samples: 4, noise: 1 },
  high: { segs: 64, samples: 5, noise: 1 },
  ultra: { segs: 64, samples: 7, noise: 1 },
}

/** Overall brightness of the beam (scattering per metre at full sun): × 0.35 the old haze (GRAND §6.2 #1). */
const BEAM = 0.34 * 0.35
const MOON_K = 9000
const tmpC = new THREE.Color()

/**
 * Unit column: y = 0 at the opening … 1 at the far end. The vertex shader maps local y downward
 * (a mirror), which the scale here mirrors back, so BackSide still draws the far, inner faces.
 */
function columnGeometry(segs: number) {
  const g = new THREE.CylinderGeometry(1, 1, 1, segs, 6, false)
  g.translate(0, -0.5, 0)
  g.scale(1, -1, 1)
  return g
}

export function SunShaft({ tier, still }: { tier: QualityTier; still: boolean }) {
  const t = TIER[tier]
  const props = kindProps('oculus-light')
  const strength = typeof props.shaftStrength === 'number' ? props.shaftStrength : 1
  const shaftOn = props.shaft !== false
  const { mesh, mat } = useMemo(() => {
    const geo = columnGeometry(t.segs)
    const mat = new THREE.ShaderMaterial({
      name: 'sunShaft',
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uColor: { value: new THREE.Color(0, 0, 0) },
        uTime: { value: 0 },
        uNoise: { value: t.noise },
        uSamples: { value: t.samples },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 40
    mesh.raycast = () => null
    mesh.name = 'sun-shaft'
    return { mesh, mat }
  }, [t.segs, t.noise, t.samples])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mat.dispose()
    },
    [mesh, mat],
  )

  const sunCol = useMemo(() => new THREE.Color(), [])
  const moonCol = useMemo(() => new THREE.Color(kelvinToHex(MOON_K)), [])
  useFrame((_, dt) => {
    const c = sunState.curve
    const u = mat.uniforms
    const L = ATMOS.uAtmosSun.value
    u.uSunDir.value.set(L.x, Math.max(L.y, 0.02), L.z)
    if (!still) u.uTime.value += dt
    const clear = 1 - weatherNow.overcast
    const day = c.shaft * c.intensity / 4.4
    const night = c.moonShaft
    sunCol.set(kelvinToHex(c.colorK))
    u.uColor.value.copy(sunCol).multiplyScalar(day).add(tmpC.copy(moonCol).multiplyScalar(night * 0.6))
    u.uColor.value.multiplyScalar(BEAM * strength * clear * turnState.shaft)
    // stays visible until the shaders are compiled (Precompile only compiles what is visible)
    mesh.visible = !useMuseum.getState().sceneCompiled || (shaftOn && (day + night) * clear > 0.002)
  })

  return (
    <ZoneGroup zones={['inner']}>
      <primitive object={mesh} />
    </ZoneGroup>
  )
}
