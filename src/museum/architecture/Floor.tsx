/**
 * Floors with click-to-walk and a subtle floor cursor.
 *
 *   inside   a burnished earth floor over the whole pavilion, with oxblood inlay rings
 *            concentric with the oculus plinth (PDF "concentric rings"); on Ultra the main
 *            floor takes real-time blurred planar reflections
 *   outside  the landscape plinth: a raised disc round the drum plus the forecourt in front
 *            of the door, paved in warm sandstone, its edge dropping to the ground
 *
 * The inside floor and the plinth share an edge along the building's outer wall faces and
 * never overlap (no z-fighting). Every walkable floor carries the walkTo handler.
 */
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BUILDING_OUTLINE } from '../config/layout'
import { DEG, MUSEUM } from '../config/museum'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMaterials } from '../materials/materials'
import { walkTo } from '../navigation/focus'
import { useMuseum } from '../state/store'
import { annulusFace, circlePoints, mergeAll, outlineSides, planFace } from './shellGeometry'

/** Height of the landscape plinth above the surrounding ground. */
export const PLINTH_RISE = 0.18

/** Inlay rings in the floor: [inner, outer] radii round the oculus plinth (the first is its apron). */
export const FLOOR_RINGS: [number, number][] = [
  [MUSEUM.oculus.rings[0] - 0.15, MUSEUM.oculus.rings[0] + 0.22],
  [MUSEUM.oculus.rings[0] + 0.62, MUSEUM.oculus.rings[0] + 0.68],
  [MUSEUM.oculus.rings[0] + 1.6, MUSEUM.oculus.rings[0] + 1.66],
]

/** The walkable outdoor area (landscape disc + forecourt) as a closed [x, z] ring. */
export function siteOutline(): [number, number][] {
  const L = MUSEUM.landscape.r
  const fc = MUSEUM.forecourt
  const gap = Math.asin(fc.halfWidth / L) / DEG
  const n = Math.ceil(((360 - 2 * gap) * DEG * L) / 0.3)
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (90 + gap + ((360 - 2 * gap) * i) / n) * DEG
    pts.push([L * Math.cos(a), L * Math.sin(a)])
  }
  pts.push([fc.halfWidth, fc.endZ], [-fc.halfWidth, fc.endZ])
  return pts
}

function isFirstHit(e: ThreeEvent<PointerEvent | MouseEvent>) {
  return e.intersections.length > 0 && e.intersections[0].object === e.object
}

function FloorCursor({ cursor }: { cursor: React.RefObject<THREE.Mesh | null> }) {
  useFrame(() => {
    const c = cursor.current
    if (!c) return
    const mat = c.material as THREE.MeshBasicMaterial
    const target = c.userData.visible ? 0.55 : 0
    mat.opacity += (target - mat.opacity) * 0.2
    c.visible = mat.opacity > 0.01
  })
  return null
}

export function Floor() {
  const m = useMaterials()
  const tier = useMuseum((s) => s.tier)
  const reflect = withDevOverrides(QUALITY_PRESETS[tier]).floorReflections
  const cursor = useRef<THREE.Mesh>(null)

  const geos = useMemo(() => {
    const full = Math.PI * 2
    const outerHole = FLOOR_RINGS[FLOOR_RINGS.length - 1][1]
    // interior: the main floor with a round hole; inside it alternating inlay / floor annuli
    const main = planFace(BUILDING_OUTLINE, 0, true, [circlePoints(0, 0, outerHole)])
    const inlay: (THREE.BufferGeometry | null)[] = []
    const fill: (THREE.BufferGeometry | null)[] = []
    FLOOR_RINGS.forEach(([r0, r1], i) => {
      inlay.push(annulusFace(0, 0, r0, r1, 0, full, 0, true))
      const next = FLOOR_RINGS[i + 1]
      if (next) fill.push(annulusFace(0, 0, r1, next[0], 0, full, 0, true))
    })
    // outside: the plinth top (the building's footprint left out), its edge and the forecourt's
    const site = siteOutline()
    const plinth = planFace(site, 0, true, [BUILDING_OUTLINE])
    const edge = outlineSides(site, -PLINTH_RISE - 0.02, 0, -1)
    return { main, fill: mergeAll(fill), inlay: mergeAll(inlay), plinth, edge }
  }, [])
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos])

  const earth = m.earthFloor as THREE.MeshStandardMaterial

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const c = cursor.current
    if (!c) return
    const first = isFirstHit(e)
    c.userData.visible = first && e.pointerType === 'mouse'
    if (first) c.position.set(e.point.x, e.point.y + 0.004, e.point.z)
  }
  const onOut = () => {
    if (cursor.current) cursor.current.userData.visible = false
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || !isFirstHit(e)) return
    if (useMuseum.getState().phase !== 'entered') return
    walkTo(e.point.x, e.point.z)
  }
  const handlers = { onPointerMove: onMove, onPointerOut: onOut, onClick }

  return (
    <group>
      <mesh geometry={geos.main} receiveShadow {...handlers} material={reflect ? undefined : earth}>
        {reflect && (
          <MeshReflectorMaterial
            map={earth.map}
            normalMap={earth.normalMap}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            roughnessMap={earth.roughnessMap}
            roughness={0.6}
            color={earth.color}
            metalness={0}
            blur={[400, 120]}
            resolution={1024}
            mixBlur={1.2}
            mixStrength={0.7}
            mixContrast={1}
            depthScale={0.6}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.3}
            mirror={0.25}
            envMapIntensity={0.7}
          />
        )}
      </mesh>
      {geos.fill && <mesh geometry={geos.fill} material={earth} receiveShadow {...handlers} />}
      {geos.inlay && <mesh geometry={geos.inlay} material={m.earthInlay} receiveShadow {...handlers} />}
      <mesh geometry={geos.plinth} material={m.sandPaving} receiveShadow {...handlers} />
      {geos.edge && <mesh geometry={geos.edge} material={m.rammedEarth} receiveShadow raycast={() => null} />}
      <mesh ref={cursor} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null} renderOrder={2}>
        <ringGeometry args={[0.2, 0.235, 48]} />
        <meshBasicMaterial color="#fffaf0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <FloorCursor cursor={cursor} />
    </group>
  )
}

/**
 * The ground round the landscape plinth: a wide disc of dry grass and earth, its colour
 * drifting slowly (vertex colours, no textures), meeting the distant terrain ring.
 */
export function ExteriorGround() {
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(0.5, 72, 96, 36)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    const a = new THREE.Color('#9f9472')
    const b = new THREE.Color('#858a5e')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const t = 0.5 + 0.25 * Math.sin(x * 0.21 + Math.cos(z * 0.13) * 2) + 0.25 * Math.sin(z * 0.17 - x * 0.05)
      c.copy(a).lerp(b, THREE.MathUtils.clamp(t, 0, 1))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo} position={[0, -PLINTH_RISE, 0]} receiveShadow raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  )
}
