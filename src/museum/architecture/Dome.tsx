/**
 * THE DOME (GRAND §2.5): Ø 32 m of coffered terracotta over the gallery ring, its stepped oculus
 * and glowing light-well, the tiled exterior with its glazed ribs, the cornice, the Sky Rim's
 * plinth and collar, and the stair up the south-east rib. Geometry in domeGeometry.ts.
 *
 * Three draw calls (plus the rib stair's brass rail):
 *   interior  Clay005, tinted per vertex (rose coffers, paler frames, blush terraces and well);
 *             a glow channel lights each coffer's top lip and the springing ledge's strip by
 *             night, and lifts the terraces and the light-well with the sky's bounce by day
 *   exterior  RoofingTiles013A terracotta (the library's roofTile): the stilted outer shell on its
 *             tambour (domeShell.ts), so the dome rises over the annex from the forecourt
 *   trim      GlazedTerracotta001 (tambour piers, ribs, cornice, plinth, stair treads; and the
 *             lantern ring round the Sky Rim's deck, which casts no shadow)
 *
 * Never culled: the dome is seen from the forecourt, every room of the rotunda and the roof.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { applyPbr } from '../materials/pbrSets'
import { useMuseum } from '../state/store'
import { MUSEUM } from '../config/museum'
import { domeExterior, domeInterior, domeTrim } from './domeGeometry'
import { makeSkyDisc } from './skyDisc'

/** Concealed light colours: the warm cove strips by night, the sky's bounce in the well by day. */
const COVE = new THREE.Color('#ffae6e')
/** p07l: the reveal glows rose with the sky's bounce (a warm rose, never a pale beige). */
const SKY = new THREE.Color('#ff8a80')
/** The springing's uplight washing the lowest coffers (warm), fading up the vault. */
const WASH = new THREE.Color('#ffc49a')
const SPRING_Y = MUSEUM.dome.springY

type GlowUniforms = { uWarm: { value: number }; uSky: { value: number }; uCoffer: { value: number }; uWash: { value: number }; uCoveColor: { value: THREE.Color }; uSkyColor: { value: THREE.Color }; uWashColor: { value: THREE.Color } }

/** The interior's material: Clay005 with vertex tints and the glow channel (one program). */
function interiorMaterial(base: THREE.MeshStandardMaterial, tier: Parameters<typeof applyPbr>[2], u: GlowUniforms) {
  const m = new THREE.MeshStandardMaterial({
    name: 'domeInterior',
    color: '#ffffff',
    vertexColors: true,
    map: base.map,
    normalMap: base.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: base.roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.5,
  })
  applyPbr(m, 'Clay005', tier, { tile: 2.8 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;\nvarying float vDomeY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;\nvDomeY = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWarm;\nuniform float uSky;\nuniform float uCoffer;\nuniform float uWash;\nuniform vec3 uCoveColor;\nuniform vec3 uSkyColor;\nuniform vec3 uWashColor;\nvarying float vGlow;\nvarying float vDomeY;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  float cove = clamp(vGlow, 0.0, 1.0) * step(vGlow, 1.01);
  float sky = clamp(vGlow - 1.0, 0.0, 1.0) * step(vGlow, 2.01);
  // the coffers' hairlines: faded out with distance, so a far line never breaks into dots
  float coffer = step(2.5, vGlow) * clamp((26.0 - length(vViewPosition)) / 10.0, 0.0, 1.0);
  totalEmissiveRadiance += uCoveColor * (cove * uWarm + coffer * uCoffer) + diffuseColor.rgb * uSkyColor * sky * uSky;
  // the springing's uplight: the lowest coffers washed warm, fading up the vault, so the coffers
  // read in gradation (lit below, dark above, glowing again at the oculus), never one flat brown
  float up = max(vDomeY - ${SPRING_Y.toFixed(2)}, 0.0);
  totalEmissiveRadiance += diffuseColor.rgb * uWashColor * uWash * exp(-up / 3.2) * step(vGlow, 0.5);
}`,
    )
  }
  m.customProgramCacheKey = () => 'domeInterior'
  injectAtmosphere(m, { coves: true })
  return m
}

export function Dome() {
  const mats = useMaterials()
  const tier = useMuseum((s) => s.tier)
  const u = useMemo<GlowUniforms>(() => ({ uWarm: { value: 0 }, uSky: { value: 0 }, uCoffer: { value: 0 }, uWash: { value: 0 }, uCoveColor: { value: COVE.clone() }, uSkyColor: { value: SKY.clone() }, uWashColor: { value: WASH.clone() } }), [])
  const inner = useMemo(() => interiorMaterial(mats.domeCoffer as THREE.MeshStandardMaterial, tier, u), [mats, tier, u])
  useEffect(() => () => inner.dispose(), [inner])
  const low = tier === 'low'
  const geo = useMemo(
    () => ({
      interior: domeInterior(),
      exterior: domeExterior({ segments: low ? 48 : 56 }),
      ...domeTrim({ segments: 56 }),
    }),
    [low],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  // the sky in the oculus: a disc at the light-well's head, so it stays blue at noon (the open sky clipped
  // to white under the court's exposure); culled from above, where the real sky is overhead
  const sky = useMemo(() => makeSkyDisc(0, MUSEUM.dome.lightWell.y1 - 0.01, 0, MUSEUM.oculus.r + 0.02, 0.8), [])
  useEffect(() => () => sky.dispose(), [sky])
  useFrame(({ clock }) => {
    sky.update(clock.elapsedTime)
    // the coves come up at dusk, as hairlines: the dome stays a dark vault at night, its oculus
    // the brightest thing in it; the well glows with the sky by day
    u.uWarm.value = 0.3 + 0.9 * ambience.night + 0.6 * ambience.twilight
    // the reveal and the terraces: rose with the sky by day; at dusk and night the terrace coves
    // take over, warm, so the vault keeps its glowing crown without the festival
    // (p07l's reveal is a glowing rose ring, the brightest surface in the vault after the sky)
    u.uSky.value = 1.15 * ambience.daylight + 0.6 * ambience.twilight + 0.55 * ambience.night + 0.05
    u.uSkyColor.value.copy(SKY).lerp(COVE, Math.min(1, ambience.night + 0.5 * ambience.twilight))
    // the springing's uplight: always a little; strongest at dusk and night
    u.uWash.value = 0.22 + 0.25 * ambience.twilight + 0.4 * ambience.night
    // the coffers' hairlines glint at dusk only: by night the vault is dark round its glowing oculus
    u.uCoffer.value = 0.5 * ambience.twilight * (1 - ambience.night)
  })
  return (
    <group name="dome">
      {geo.interior && <mesh geometry={geo.interior} material={inner} castShadow receiveShadow />}
      {geo.exterior && <mesh geometry={geo.exterior} material={mats.roofTile} castShadow receiveShadow />}
      {geo.glazed && <mesh geometry={geo.glazed} material={mats.glazedTerracotta} castShadow receiveShadow />}
      {/* the lantern ring casts no shadow: the oculus's light stays the analytic mask */}
      {geo.crown && <mesh geometry={geo.crown} material={mats.glazedTerracotta} receiveShadow />}
      {geo.brass && <mesh geometry={geo.brass} material={mats.brass} />}
      <mesh geometry={sky.geometry} material={sky.material} raycast={() => null} />
    </group>
  )
}
