/**
 * Scene-object kinds of the light and atmosphere package (SPECTACLE §2). They draw nothing of
 * their own — the pavilion's light is global, so their props are read where it is made:
 *   'atmosphere'    time, weather, festival, grade (read through spectacle/settings kindProps)
 *   'oculus-light'  the sun shaft, motes and gobo (SunShaft, Motes)
 *   'diya-field'    the festival lamps (lighting/diyas/DiyaField, mounted once for the whole site)
 *   'cove-light'    overrides the colour / intensity of the cove lines it names (CoveLights)
 */
import { useEffect } from 'react'
import type { ModelProps } from '../../models/types'
import { num, str } from '../../models/types'
import { registerCoveOverride } from './CoveLights'

export function AtmosphereKind() {
  return null
}

export function OculusLightKind() {
  return null
}

export function CoveLightKind({ config }: ModelProps) {
  const walls = str(config, 'walls', '')
  const colorK = num(config, 'colorK', NaN)
  const intensity = num(config, 'intensity', NaN)
  useEffect(
    () =>
      registerCoveOverride(
        config.id,
        walls.split(',').map((w) => w.trim()),
        isNaN(colorK) ? undefined : colorK,
        isNaN(intensity) ? undefined : intensity,
      ),
    [config.id, walls, colorK, intensity],
  )
  return null
}

export function DiyaFieldKind() {
  return null
}
