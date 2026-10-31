/**
 * PLACEHOLDER clay vessel (procedural) for an exhibit without a model.
 *
 * Stand-in only — to be replaced by a scan of the workshop's own piece (config/exhibits.ts
 * `model`). The form is picked from the exhibit id; the clay body follows its tradition
 * (black for Longpi, red for Molela, terracotta for Bankura, buff otherwise). Origin = the
 * centre of its foot, so it stands on a table or podium top as placed.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { hashStr, lathe } from '../models/kit'
import { clayMaterial, vesselProfile, type ClayBody, type VesselForm } from '../models/clay'
import { useModelMaterials } from '../models/modelMaterials'

const FORMS: VesselForm[] = ['matka', 'surahi', 'kulhad', 'bowl', 'matka', 'bowl']

/** Clay body for a tradition / region text. */
export function clayForTradition(text: string | undefined): { body: ClayBody; burnish: number } {
  const t = (text ?? '').toLowerCase()
  if (/longpi|manipur|black/.test(t)) return { body: 'black', burnish: 0.8 }
  if (/molela|rajasthan/.test(t)) return { body: 'red', burnish: 0.1 }
  if (/bankura|bengal|terracotta/.test(t)) return { body: 'terracotta', burnish: 0.15 }
  return { body: 'buff', burnish: 0.2 }
}

export interface ClayVesselPlaceholderProps {
  /** Seed for the form (the exhibit id). */
  seed: string
  tradition?: string
  /** Overall height (m). */
  height?: number
}

export function ClayVesselPlaceholder({ seed, tradition, height = 0.26 }: ClayVesselPlaceholderProps) {
  const m = useModelMaterials()
  const form = FORMS[hashStr(seed) % FORMS.length]
  const { body, burnish } = clayForTradition(tradition)
  const h = form === 'bowl' ? height * 0.5 : form === 'kulhad' ? height * 0.55 : height
  const r = form === 'surahi' ? h * 0.36 : form === 'bowl' ? h * 1.3 : form === 'kulhad' ? h * 0.5 : h * 0.5
  const geo = useMemo(() => lathe(vesselProfile(form, r, h), 40), [form, r, h])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = clayMaterial(m, body, burnish) as THREE.Material
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />
}
