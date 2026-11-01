/**
 * THE SPHERE WELL (GRAND §2.7, p07r "spiral stair round a sphere under a stepped oculus"): a
 * round red room sunk in the plinth south-west of the drum, open to the sky through a stepped
 * ceiling. Its spiral stair and hanging sphere are P3's; its perch is P5's.
 *
 *   at grade ..... a 3 m opening with a fired-brick kerb, ringed by a glass balustrade on brass
 *                  posts (WALLS 'well-rim' is its collider; Pavilion leaves it to this file)
 *   below ........ the room (r 6.5, floor −8.0): dark oxblood walls on a fired-brick base
 *                  course, washed warm from the foot; a polished dark floor with a brass ring that
 *                  holds the sky; the ceiling's five terraces step up from the wall to the opening
 *                  in pale rose plaster (p07r), each riser's top edge a warm line of light
 *   the throat ... a warm line of light just under the kerb, so from grade the opening is a lit
 *                  lip over the depth (by day faint, at dusk the well glows like a lamp)
 *
 * Value structure (the art direction's "one saturated red"): dark walls, pale terraces, a rose
 * sphere and stair between them; red is the accent, never the whole room.
 *
 * The plinth's paving is cut round the opening (Floor.tsx).
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { SPHERE_WELL } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { Mesh, revolve, type V2 } from './sweep'

const W = SPHERE_WELL
const FULL = Math.PI * 2
const SEG = 96

/** The ceiling's terraces: [outer radius, inner radius, soffit height] from the wall to the throat. */
export function wellTerraces(): { r0: number; r1: number; y: number }[] {
  const n = W.terraces
  return Array.from({ length: n }, (_, k) => ({
    r0: W.roomR - ((W.roomR - W.openingR) * k) / n,
    r1: W.roomR - ((W.roomR - W.openingR) * (k + 1)) / n,
    y: W.terraceTopY - (W.terraceTopY * k) / n,
  }))
}

function wellGeometry() {
  const red = new Mesh()
  const terrace = new Mesh()
  const base = new Mesh()
  const floor = new Mesh()
  const inlay = new Mesh()
  const glow = new Mesh()
  const throat = new Mesh()
  const kerb = new Mesh()
  const glass = new Mesh()
  const brass = new Mesh()
  const { cx, cz } = W
  const inn: V2 = [-1, 0]
  const up: V2 = [0, 1]
  const down: V2 = [0, -1]
  const course = 0.62
  // the room's wall over its brick base course
  revolve(base, cx, cz, [[W.roomR, W.floorY + course], [W.roomR, W.floorY]], 0, FULL, SEG, [inn, inn])
  revolve(red, cx, cz, [[W.roomR, W.terraceTopY], [W.roomR, W.floorY + course]], 0, FULL, SEG, [inn, inn])
  // the floor and its inlaid ring (under the stair's foot)
  revolve(floor, cx, cz, [[0, W.floorY], [W.roomR - 0.9, W.floorY]], 0, FULL, SEG, [up, up])
  revolve(floor, cx, cz, [[W.roomR - 0.75, W.floorY], [W.roomR, W.floorY]], 0, FULL, SEG, [up, up])
  revolve(inlay, cx, cz, [[W.roomR - 0.9, W.floorY + 0.002], [W.roomR - 0.75, W.floorY + 0.002]], 0, FULL, SEG, [up, up])
  // the stepped ceiling: soffits facing down, risers facing the axis, a glowing lip on each riser
  const T = wellTerraces()
  T.forEach((t, k) => {
    revolve(terrace, cx, cz, [[t.r0, t.y], [t.r1, t.y]], 0, FULL, SEG, [down, down])
    const yNext = k + 1 < T.length ? T[k + 1].y : 0
    revolve(terrace, cx, cz, [[t.r1, t.y], [t.r1, yNext - 0.05]], 0, FULL, SEG, [inn, inn])
    revolve(glow, cx, cz, [[t.r1 - 0.002, yNext - 0.05], [t.r1 - 0.002, yNext]], 0, FULL, SEG, [inn, inn])
  })
  // the throat's lip: a concealed line just under grade
  revolve(throat, cx, cz, [[W.openingR - 0.002, -0.16], [W.openingR - 0.002, -0.1]], 0, FULL, SEG, [inn, inn])
  // at grade: the kerb round the opening
  revolve(kerb, cx, cz, [[W.openingR + 0.5, -0.002], [W.openingR + 0.5, 0.1], [W.openingR, 0.1], [W.openingR, -0.002]], 0, FULL, SEG)
  // the balustrade: glass panes and a brass rail on posts
  const R = W.rimR
  revolve(glass, cx, cz, [[R, 0.14], [R, W.rimH - 0.04]], 0, FULL, SEG, [[1, 0], [1, 0]])
  const add = (g: THREE.BufferGeometry) => {
    const ng = g.toNonIndexed()
    const p = ng.getAttribute('position')
    const n = ng.getAttribute('normal')
    const u = ng.getAttribute('uv')
    const b0 = brass.pos.length / 3
    for (let i = 0; i < p.count; i++) {
      brass.pos.push(p.getX(i), p.getY(i), p.getZ(i))
      brass.nor.push(n.getX(i), n.getY(i), n.getZ(i))
      brass.uv.push(u.getX(i), u.getY(i))
      brass.idx.push(b0 + i)
    }
    ng.dispose()
    g.dispose()
  }
  const rail = new THREE.TorusGeometry(R, 0.018, 8, SEG)
  rail.rotateX(Math.PI / 2)
  rail.translate(cx, W.rimH, cz)
  add(rail)
  const posts = 16
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * FULL
    const g = new THREE.CylinderGeometry(0.011, 0.014, W.rimH - 0.1, 8)
    g.translate(cx + R * Math.cos(a), 0.1 + (W.rimH - 0.1) / 2, cz + R * Math.sin(a))
    add(g)
  }
  return { red: red.build(), terrace: terrace.build(), base: base.build(), floor: floor.build(), inlay: inlay.build(), glow: glow.build(), throat: throat.build(), kerb: kerb.build(), glass: glass.build(), brass: brass.build() }
}

/**
 * The stepped ceiling in rose plaster that holds the sky: by day the light falling through the
 * opening bounces off every terrace and lifts the steps to a glowing pink (p07r); at night only
 * their LED lips carry them.
 */
const terraceMat = new THREE.MeshStandardMaterial({ name: 'wellTerrace', color: '#d9a497', emissive: new THREE.Color('#ffc8b8'), emissiveIntensity: 0.3, roughness: 0.92 })

/**
 * The drum's red wall, washed from a concealed uplight in its base course: warm at the foot,
 * fading up the wall, so the room is a lit red drum round the stair and the sphere, never black.
 */
function washedWall(base: THREE.MeshStandardMaterial) {
  const m = base.clone()
  m.name = 'wellWall'
  m.emissive = new THREE.Color('#ff8a66')
  m.emissiveIntensity = 0.42
  const y0 = (W.floorY + 0.62).toFixed(3)
  const y1 = W.terraceTopY.toFixed(3)
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWellY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWellY = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWellY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb * 2.2 * (0.12 + 0.88 * pow(1.0 - smoothstep(${y0}, ${y1}, vWellY), 2.2));`)
  }
  m.customProgramCacheKey = () => 'wellWall'
  // the light engine's terms join later (inject.ts opts every lit material in before it compiles)
  return m
}

const glowMat = new THREE.MeshStandardMaterial({ name: 'wellCove', color: '#4a1410', emissive: new THREE.Color('#ff9a5c'), emissiveIntensity: 1.2, roughness: 0.6 })
/** The throat's lip: unlit warm white past 1, so the bloom draws a ring of light round the opening. */
const throatMat = new THREE.MeshBasicMaterial({ name: 'wellThroat', color: new THREE.Color('#ffc890').multiplyScalar(1.6), toneMapped: false })
const glassMat = new THREE.MeshPhysicalMaterial({ name: 'wellGlass', color: '#e2eef0', transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0, envMapIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide })

export function SphereWellShell() {
  const m = useMaterials()
  const geo = useMemo(wellGeometry, [])
  const wall = useMemo(() => washedWall(m.oxblood as THREE.MeshStandardMaterial), [m.oxblood])
  useEffect(() => () => wall.dispose(), [wall])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  useFrame(() => {
    glowMat.emissiveIntensity = 0.9 + 1.6 * ambience.night
    throatMat.color.set('#ffc890').multiplyScalar(0.7 + 1.6 * Math.max(ambience.night, 1 - ambience.daylight))
    terraceMat.emissiveIntensity = 0.06 + 0.42 * ambience.daylight
  })
  return (
    <group name="sphere-well">
      <StaticMerge name="sphere-well-shell">
        {geo.red && <mesh geometry={geo.red} material={wall} castShadow receiveShadow />}
        {geo.terrace && <mesh geometry={geo.terrace} material={terraceMat} castShadow receiveShadow />}
        {geo.base && <mesh geometry={geo.base} material={m.bricks} receiveShadow />}
        {geo.floor && <mesh geometry={geo.floor} material={m.oxbloodLacquer} receiveShadow />}
        {geo.inlay && <mesh geometry={geo.inlay} material={m.brass} receiveShadow />}
        {geo.kerb && <mesh geometry={geo.kerb} material={m.bricks} castShadow receiveShadow />}
        {geo.brass && <mesh geometry={geo.brass} material={m.brass} castShadow />}
      </StaticMerge>
      {geo.glow && <mesh geometry={geo.glow} material={glowMat} raycast={() => null} />}
      {geo.throat && <mesh geometry={geo.throat} material={throatMat} raycast={() => null} />}
      {geo.glass && <mesh geometry={geo.glass} material={glassMat} raycast={() => null} renderOrder={2} />}
    </group>
  )
}
