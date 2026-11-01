/**
 * Floors with click-to-walk and a subtle floor cursor (GRAND §2.5 "warm earthen floors").
 *
 *   rotunda   polished warm terrazzo in the court (Terrazzo004) with brass rings at 8.2 m (the
 *             p05 floor line) and 6.4 m (the curb's foot); burnished earth beyond it through the
 *             galleries, a red runner under the podium row (p02); on Ultra the earth takes
 *             real-time blurred planar reflections
 *   wings     the Wine Hall in timber (Wood092, p08l), the Earth Room (annex) in pale polished
 *             earth, the ambulatory in burnished earth
 *   outside   the landscape plinth: a raised disc round the drum plus the forecourt in front
 *             of the door, paved in warm sandstone, its edge dropping to the ground, cut round
 *             the Sphere Well's opening
 *   north     the Parikrama's serpentine (Serpentine.tsx): the walk in deep red lime, the gate
 *             aprons paved, the courtyards and the sunken gardens in soil; each crescent room in
 *             its own floor — polished dark lime in the Atlas, deep red earth in the theatre,
 *             terracotta tiles in the Library with the Red Room's red disc, buff clay tiles in
 *             the Haat; raw earth in the jali slots
 *
 * The inside floor, the plinth and the north wing share edges along the outer wall faces and
 * never overlap (no z-fighting): the plinth's hole is the building and the north wing as ONE
 * outline. Finishes laid over a floor (terrazzo, timber, the runner) sit 2–4 mm above it with a
 * polygon offset. Every walkable floor carries the walkTo handler.
 */
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BUILDING_OUTLINE } from '../config/layout'
import { DEG, KEY, MUSEUM, polar } from '../config/museum'
import { TERRAIN } from './Landscape'
import { JALI_SLOTS, PARIKRAMA, RED_ROOM, SAT_WALL, SATELLITES, SPHERE_WELL, type SatelliteId } from '../config/satellites'
import { tinted } from '../models/modelMaterials'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMaterials } from '../materials/materials'
import { walkTo } from '../navigation/focus'
import { useMuseum } from '../state/store'
import { polarBand } from './Satellites'
import { serpentineFloors } from './Serpentine'
import { applyPbr, pbrTint, type PbrSetId } from '../materials/pbrSets'
import { annulusFace, circlePoints, mergeAll, outlineSides, planFace } from './shellGeometry'
import { useClayPaving } from './clayPaving'
import { withHaze } from './exteriorHaze'

/** Height of the landscape plinth above the surrounding ground. */
export const PLINTH_RISE = 0.18

/** Brass rings inlaid in the court's terrazzo: [inner, outer] radii (the curb's foot, the p05 floor line). */
export const FLOOR_RINGS: [number, number][] = [
  [MUSEUM.oculus.rings[0], MUSEUM.oculus.rings[0] + 0.07],
  [MUSEUM.oculus.floorRingR, MUSEUM.oculus.floorRingR + 0.07],
]
/** The court's terrazzo: out to here, then burnished earth to the ring wall. */
export const TERRAZZO_R = MUSEUM.innerMainWall.r - MUSEUM.innerMainWall.thickness / 2 - 0.6 - 0.25
/** The red runner under the podium row (p02): its radii and plan span (deg, the ring's span). */
/** (A and B only: Gallery C keeps its dark earth floor under the cool beam.) */
export const RUNNER = { r0: MUSEUM.podium.ringR - 0.42, r1: MUSEUM.podium.ringR + 0.42, fromDeg: MUSEUM.podium.anglesDeg.b[MUSEUM.podium.anglesDeg.b.length - 1] - 4, toDeg: MUSEUM.podium.anglesDeg.a[0] + 3 }

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

/** Points along a circle from → to (deg), inclusive, every ~2°. */
function arcPts(r: number, fromDeg: number, toDeg: number): [number, number][] {
  const n = Math.max(1, Math.ceil(Math.abs(toDeg - fromDeg) / 2))
  return Array.from({ length: n + 1 }, (_, i) => polar(r, fromDeg + ((toDeg - fromDeg) * i) / n))
}

/**
 * The building and the north wing as one outline (the plinth's hole): BUILDING_OUTLINE with its
 * gallery-ring arc between the two notches (the walk's inner edge) replaced by the wing's outer
 * edge — across the west gate, round the rooms' outer faces, across the east gate.
 */
export function buildingAndWingOutline(): [number, number][] {
  const ringR = KEY.ringOuterR
  const cut = BUILDING_OUTLINE.findIndex(([x, z]) => Math.abs(Math.hypot(x, z) - ringR) < 1e-6)
  const head = cut >= 0 ? BUILDING_OUTLINE.slice(0, cut) : BUILDING_OUTLINE.slice()
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const first = rooms[0].fromDeg
  const last = rooms[rooms.length - 1].toDeg
  return [
    ...head,
    ...arcPts(SAT_WALL.innerC, PARIKRAMA.fromDeg, first),
    ...arcPts(SAT_WALL.outerOuter, first, last),
    ...arcPts(SAT_WALL.innerC, last, PARIKRAMA.toDeg),
  ]
}

/** Polar band floors of the north wing, by finish. */
function northWingFloors() {
  const D = DEG
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const byRoom = Object.fromEntries(rooms.map((s) => [s.id, polarBand(SAT_WALL.innerC, SAT_WALL.outerOuter, s.fromDeg * D, s.toDeg * D, 0, true, 0.25)])) as Record<SatelliteId, THREE.BufferGeometry | null>
  const slots = mergeAll(JALI_SLOTS.map(([a0, a1]) => polarBand(SAT_WALL.innerC, SAT_WALL.outerOuter, a0 * D, a1 * D, 0, true, 0.25)))
  // a band of oxblood inlay across each gate, on the walk's outer edge
  const gates = mergeAll([
    polarBand(SAT_WALL.innerC - 0.3, SAT_WALL.innerC - 0.12, PARIKRAMA.fromDeg * D, rooms[0].fromDeg * D, 0.002, true),
    polarBand(SAT_WALL.innerC - 0.3, SAT_WALL.innerC - 0.12, rooms[rooms.length - 1].toDeg * D, PARIKRAMA.toDeg * D, 0.002, true),
  ])
  return { byRoom, slots, gates }
}

/** Room floor finishes (tints of the core floor materials). */
const ROOM_FLOOR: Record<SatelliteId, { base: 'earthFloor' | 'sandPaving'; color: string; roughness: number }> = {
  atlas: { base: 'earthFloor', color: '#5a4b42', roughness: 0.55 },
  theatre: { base: 'earthFloor', color: '#5a2620', roughness: 0.85 },
  library: { base: 'sandPaving', color: '#c58a66', roughness: 0.8 },
  shop: { base: 'sandPaving', color: '#dcbb98', roughness: 0.85 },
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
  // the forecourt and the plinth in handmade clay tiles (architecture/clayPaving.ts)
  const clayPaving = useClayPaving(tier)

  const geos = useMemo(() => {
    const full = Math.PI * 2
    // interior: burnished earth with the court's terrazzo disc left out; the court's brass rings
    const main = planFace(BUILDING_OUTLINE, 0, true, [circlePoints(0, 0, TERRAZZO_R)])
    const terrazzo = planFace(circlePoints(0, 0, TERRAZZO_R), 0, true)
    const inlay = mergeAll([...FLOOR_RINGS.map(([r0, r1]) => annulusFace(0, 0, r0, r1, 0, full, 0.003, true)), annulusFace(0, 0, TERRAZZO_R - 0.05, TERRAZZO_R, 0, full, 0.003, true)])
    // laid over the earth: the podium row's runner, the Wine Hall's timber, the Earth Room's dark floor
    const runner = annulusFace(0, 0, RUNNER.r0, RUNNER.r1, RUNNER.fromDeg * DEG, RUNNER.toDeg * DEG, 0.002, true)
    const hw = MUSEUM.hallwayWall
    const timber = mergeAll([annulusFace(0, 0, KEY.ringOuterR, MUSEUM.drum.r, hw.fromDeg * DEG, MUSEUM.drum.dNotchDeg * DEG, 0.002, true), annulusFace(0, 0, KEY.ringR, KEY.ringOuterR, (hw.toDeg + 0.4) * DEG, (MUSEUM.drum.dNotchDeg - 0.4) * DEG, 0.002, true)])
    const annex = planFace(
      [
        [-KEY.annexHalf, KEY.annexMouthZ],
        [KEY.annexHalf, KEY.annexMouthZ],
        [KEY.annexHalf, KEY.annexEndZ],
        [-KEY.annexHalf, KEY.annexEndZ],
      ],
      0.002,
      true,
    )
    // outside: the plinth top (the building's footprint and the well's opening left out), its edge
    const site = siteOutline()
    const plinth = planFace(site, 0, true, [buildingAndWingOutline(), circlePoints(SPHERE_WELL.cx, SPHERE_WELL.cz, SPHERE_WELL.openingR)])
    const edge = outlineSides(site, -PLINTH_RISE - 0.02, 0, -1)
    // the Red Room's floor, over the Library's
    const redRoom = planFace(circlePoints(RED_ROOM.cx, RED_ROOM.cz, RED_ROOM.r + RED_ROOM.t / 2), 0.003, true)
    return { main, terrazzo, inlay, runner, timber, annex, plinth, edge, redRoom }
  }, [])
  const north = useMemo(northWingFloors, [])
  useEffect(() => () => [north.slots, north.gates, ...Object.values(north.byRoom)].forEach((g) => g?.dispose()), [north])
  const serp = useMemo(serpentineFloors, [])
  useEffect(() => () => [serp.walk, serp.gardens, ...serp.aprons, ...serp.courtyards].forEach((g) => g.dispose()), [serp])
  const aprons = useMemo(() => mergeAll(serp.aprons.map((g) => g.clone())), [serp])
  const courtyards = useMemo(() => mergeAll(serp.courtyards.map((g) => g.clone())), [serp])
  useEffect(() => () => [aprons, courtyards].forEach((g) => g?.dispose()), [aprons, courtyards])
  // finishes laid over a floor: their own copies with a polygon offset (the library's maps reach them)
  const over = useMemo(() => {
    const mk = (name: string, base: THREE.MeshStandardMaterial, rough: number, set: PbrSetId | null, hex: string) => {
      const mm = new THREE.MeshStandardMaterial({ name, color: base.color.clone(), map: base.map, normalMap: base.normalMap, normalScale: base.normalScale.clone(), roughnessMap: base.roughnessMap, roughness: rough, metalness: base.metalness, envMapIntensity: base.envMapIntensity, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
      if (set && applyPbr(mm, set, tier)) mm.color.copy(pbrTint(set, hex))
      return mm
    }
    return {
      runner: mk('podiumRunner', m.redLime as THREE.MeshStandardMaterial, 0.9, 'Clay005', '#9e2a22'),
      // a pale oiled timber with a soft sheen, so it reads as wood even in the hall's red light
      timber: mk('wineHallFloor', m.timberFloor as THREE.MeshStandardMaterial, 0.42, 'Wood092', '#ddb57c'),
      // p05: a pale, smooth blush floor under the canyon, catching the skylight
      annex: mk('earthRoomFloor', m.earthFloor as THREE.MeshStandardMaterial, 0.5, 'Clay005', '#d6b2a0'),
      red: mk('redRoomFloor', m.redLime as THREE.MeshStandardMaterial, 0.8, 'Clay005', '#8c1f18'),
      brass: mk('floorBrass', m.brass as THREE.MeshStandardMaterial, 0.3, null, '#b8955a'),
    }
  }, [m, tier])
  useEffect(() => () => Object.values(over).forEach((mm) => mm.dispose()), [over])
  // p09l: grey stone in the tree courts
  const courtStone = useMemo(() => tinted(m.stone, '#a7a29b', { roughness: 0.82 }), [m])
  const gateMat = useMemo(() => tinted(m.earthInlay, '#8c3a2f', { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [m])
  const roomMats = useMemo(
    () => Object.fromEntries(SATELLITES.map((s) => [s.id, tinted(m[ROOM_FLOOR[s.id].base], ROOM_FLOOR[s.id].color, { roughness: ROOM_FLOOR[s.id].roughness })])) as Record<SatelliteId, THREE.Material>,
    [m],
  )
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
      <mesh geometry={geos.terrazzo} material={m.terrazzo} receiveShadow {...handlers} />
      {geos.inlay && <mesh geometry={geos.inlay} material={over.brass} receiveShadow {...handlers} />}
      {geos.runner && <mesh geometry={geos.runner} material={over.runner} receiveShadow {...handlers} />}
      {geos.timber && <mesh geometry={geos.timber} material={over.timber} receiveShadow {...handlers} />}
      <mesh geometry={geos.annex} material={over.annex} receiveShadow {...handlers} />
      <mesh geometry={geos.redRoom} material={over.red} receiveShadow {...handlers} />
      <mesh geometry={geos.plinth} material={clayPaving} receiveShadow {...handlers} />
      {geos.edge && <mesh geometry={geos.edge} material={m.rammedEarth} receiveShadow raycast={() => null} />}
      <mesh geometry={serp.walk} material={m.parikramaFloor} receiveShadow {...handlers} />
      {aprons && <mesh geometry={aprons} material={m.sandPaving} receiveShadow {...handlers} />}
      {courtyards && <mesh geometry={courtyards} material={courtStone} receiveShadow raycast={() => null} />}
      <mesh geometry={serp.gardens} material={m.groundSoil} receiveShadow raycast={() => null} />
      {north.slots && <mesh geometry={north.slots} material={m.rawClay} receiveShadow {...handlers} />}
      {north.gates && <mesh geometry={north.gates} material={gateMat} receiveShadow raycast={() => null} />}
      {SATELLITES.map((s) => {
        const g = north.byRoom[s.id]
        return g ? <mesh key={s.id} geometry={g} material={roomMats[s.id]} receiveShadow {...handlers} /> : null
      })}
      <mesh ref={cursor} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null} renderOrder={2}>
        <ringGeometry args={[0.2, 0.235, 48]} />
        <meshBasicMaterial color="#fffaf0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <FloorCursor cursor={cursor} />
    </group>
  )
}

/**
 * The ground round the landscape plinth: a wide disc of meadow grass, its colour
 * drifting slowly (vertex colours, no textures), meeting the distant terrain ring.
 */
export function ExteriorGround() {
  const m = useMaterials()
  const geo = useMemo(() => {
    // from just inside the plinth's edge (nothing below the plinth is seen; the Sphere Well's room lies under it)
    const g = new THREE.RingGeometry(MUSEUM.landscape.r - 1, TERRAIN.inner + 2, 128, 36)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    // a warm, dry meadow: sun-faded greens drifting into straw (Landscape.tsx's terrain carries on
    // from it), in long soft swathes, never a mottle of khaki blotches
    const a = new THREE.Color('#87994c')
    const b = new THREE.Color('#a8a462')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const t = 0.5 + 0.3 * Math.sin(x * 0.045 + Math.cos(z * 0.031) * 2) + 0.2 * Math.sin(z * 0.052 - x * 0.019)
      c.copy(a).lerp(b, THREE.MathUtils.clamp(t, 0, 1))
      col.set([c.r, c.g, c.b], i * 3)
      // the soil's grain in metres (a 4 m tile), so the meadow has a surface up close
      uv.setXY(i, x / 4, z / 4)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  // it recedes into the horizon's haze with the terrain ring beyond it (no seam where they meet)
  const soil = m.groundSoil as THREE.MeshStandardMaterial
  const mat = useMemo(
    () =>
      withHaze(
        new THREE.MeshStandardMaterial({
          name: 'exteriorGround',
          vertexColors: true,
          // the vertex colour carries the green; the soil's normal map its grain
          normalMap: soil.normalMap,
          normalScale: new THREE.Vector2(0.6, 0.6),
          roughness: 1,
        }),
      ),
    [soil],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} position={[0, -PLINTH_RISE, 0]} receiveShadow raycast={() => null} />
}
