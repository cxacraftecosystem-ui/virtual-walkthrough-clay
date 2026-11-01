/**
 * In-scene mount of light, sky and atmosphere (SPECTACLE F2, F5, F7–F10, F15, F27, F28).
 * Owned by WP2; mounted by spectacle/Spectacle.tsx inside its own error boundary.
 *
 * The always-on light engine (the oculus mask, the live sun, the choreography, the coves) lives
 * in lighting/Lighting.tsx; this mount adds the moments: the Turn, the sun shaft and its motes,
 * the monsoon, Diya Night with the Akash Deep and the beacon, and the throat of the annex.
 * The jali gobo is retired with the soffit crown (GRAND §0.4): the oculus throws a clean disc.
 * Forms: Lite (`spectacleOff`) drops the shaft, the motes and the lamps' halos; Still (reduced
 * motion) keeps the light and drops every movement. Nothing here on the experimental WebGPU renderer.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { AkashDeep, Beacon, GuardianGlow } from '../../lighting/atmosphere/Beacon'
import { grade } from '../../lighting/atmosphere/choreography'
import { Motes } from '../../lighting/atmosphere/Motes'
import { SunShaft } from '../../lighting/atmosphere/SunShaft'
import { ThroatOfKiln } from '../../lighting/atmosphere/ThroatOfKiln'
import { installTurn, stepTurn, turnState } from '../../lighting/atmosphere/turn'
import { DiyaField } from '../../lighting/diyas/DiyaField'
import { Monsoon } from '../../lighting/weather/Monsoon'
import { useMuseum } from '../../state/store'
import { ATMOS } from '../../lighting/atmosphere/inject'
import { accentMaster } from '../../lighting/atmosphere/AccentField'
import { coveMaster } from '../../lighting/atmosphere/CoveLights'
import { diyaNow } from '../../lighting/diyas/diyaState'
import { sunState } from '../../lighting/timeOfDayState'
import { weatherNow } from '../../lighting/weather/weatherState'
import { kindProps, useSpectacle } from '../settings'
import { isWebGPU } from '../../utils/renderer'

/** Development handle for the screenshot and profiling scripts (`window.__atmos`). */
function useDebugHandle() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const w = window as unknown as { __atmos?: unknown }
    w.__atmos = { sunState, turnState, grade, ATMOS, diyaNow, weatherNow, accentMaster, coveMaster, scene }
    return () => {
      w.__atmos = undefined
    }
  }, [scene])
}

function TheTurn() {
  useDebugHandle()
  useEffect(() => installTurn(), [])
  useFrame(() => {
    stepTurn()
    grade.turn = turnState.exposure
  })
  return null
}

export function AtmosphereMount() {
  const st = useSpectacle()
  const tier = useMuseum((s) => s.tier)
  const still = st.mode === 'still'
  const motesOn = kindProps('oculus-light').motes !== false
  // the experimental WebGPU renderer has no GLSL: the moments stay off there (the light itself,
  // sun, sky and choreography, still runs in Lighting)
  if (isWebGPU()) return null
  return (
    <group name="atmosphere">
      <TheTurn />
      <ThroatOfKiln />
      {!st.off && <SunShaft tier={tier} still={still} />}
      {!st.off && !still && motesOn && st.caps.motes > 0 && <Motes count={st.caps.motes} />}
      <Monsoon drops={st.caps.rainDrops} outdoor={st.caps.outdoorRain && !st.off} />
      <DiyaField />
      <AkashDeep />
      <Beacon />
      <GuardianGlow />
    </group>
  )
}
