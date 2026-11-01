/**
 * Tasteful post-processing: N8AO ambient occlusion, restrained bloom that only
 * catches emissive fixtures (threshold above white: 1.8 by day, 1.0 at night — GRAND §6.2 #1 — so
 * the fixture lenses, the lamps and the coves bloom after dark and the sunlit clay never does), the clay grade (ClayGrade.ts,
 * H+), SMAA, and Khronos PBR Neutral tone mapping (colour-faithful — the standard for
 * product/art imagery).
 */
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { useFrame } from '@react-three/fiber'
import { ToneMappingMode, type BloomEffect } from 'postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { ambience, sunState } from '../lighting/timeOfDayState'
import { kindProps, useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { isWebGPU } from '../utils/renderer'
import { ClayGradeEffect } from './ClayGrade'

const BLOOM_DAY = 1.8
const BLOOM_NIGHT = 1.0
/** Grade strength at a low sun. */
const GOLDEN_GRADE = 0.2

export function PostFX() {
  const tier = useMuseum((s) => s.tier)
  const p = withDevOverrides(QUALITY_PRESETS[tier])
  const st = useSpectacle()
  // Lite (spectacleOff) drops the grade; the tier decides whether there is one at all
  const gradeOn = st.caps.grade && !st.off
  const strength = useMemo(() => {
    const v = kindProps('atmosphere').gradeStrength
    return typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 1
  }, [])
  const gradeFx = useMemo(() => (gradeOn ? new ClayGradeEffect() : null), [gradeOn])
  useEffect(() => () => gradeFx?.dispose(), [gradeFx])
  const bloom = useRef<BloomEffect>(null)
  useFrame((state) => {
    if (bloom.current) bloom.current.luminanceMaterial.threshold = BLOOM_DAY + (BLOOM_NIGHT - BLOOM_DAY) * ambience.night
    // golden hour: the grade falls to 0.2 so the sun's colour is the only warmth (no sepia frame)
    const low = sunState.curve.sunset * (1 - ambience.night)
    gradeFx?.sync(strength * (1 - (1 - GOLDEN_GRADE) * low), st.caps.grain && !st.reducedMotion, state.clock.elapsedTime)
  })
  // The postprocessing library is WebGL-only (experimental WebGPU renderer: native tone mapping only).
  if (!p.postprocessing || isWebGPU()) return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {p.ambientOcclusion && <N8AO aoRadius={0.9} distanceFalloff={0.7} intensity={2.2} quality={p.aoQuality} halfRes={tier !== 'ultra'} color="#1c1510" />}
      {p.bloom && <Bloom ref={bloom} mipmapBlur luminanceThreshold={BLOOM_DAY} luminanceSmoothing={0.2} intensity={0.35} radius={0.55} />}
      {gradeFx && <primitive object={gradeFx} />}
      {p.smaa && <SMAA />}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
