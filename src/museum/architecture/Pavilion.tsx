/**
 * THE CLAY PAVILION — everything built: the drum, the annex and its door, the free-standing
 * curved walls, the roof with its oculus, the podium row, the cove glow at the duplex band,
 * the forecourt lettering and the landscape plinth.
 *
 * Static pieces sit in one <StaticMerge> (one mesh per material for the whole shell); only
 * the transparent cove wash, the lettering and the lights stay separate. The podiums are
 * architecture — they always collide (layout.ts PODIUM_SLOTS) — so all of them are built
 * here, each with its own top light; the pieces standing on them are scene objects.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { EXHIBITION_TITLE } from '../config/infographics'
import { LIGHTING } from '../config/lighting'
import { PODIUM, PODIUM_SLOTS, WALLS, type WallBox } from '../config/layout'
import { KEY, MUSEUM, type Vec3 } from '../config/museum'
import { SCENE_OBJECTS } from '../config/objects'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { StaticMerge } from '../effects/StaticMerge'
import { Benches } from '../furniture/Bench'
import { ambience } from '../lighting/timeOfDayState'
import { coverAngle, TrackRail, TrackSpot } from '../lighting/TrackLight'
import { mountForPodium, RAILS } from '../lighting/tracks'
import { createMeterBoxGeometry } from '../materials/geometry'
import { useMaterials } from '../materials/materials'
import { createFacadeLetteringTexture } from '../materials/wallGraphics'
import { OculusPlinth } from '../models/clay'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { CeilingAndRoof } from './CeilingAndSkylight'
import { ExteriorGround, Floor } from './Floor'
import { Landscape } from './Landscape'
import { RawClayPatches } from './RawClayPatches'
import { cylinderFace, mergeAll } from './shellGeometry'
import { drumFaceSpans, INNER_REVEAL, Wall } from './Wall'

const H = MUSEUM.pavilion.ceilingHeight

/* ------------------------------------------------------------------ */
/* Podiums                                                             */
/* ------------------------------------------------------------------ */

/** Every podium of the row: an oxblood clay column on a recessed shadow plinth. */
function PodiumRow() {
  const m = useMaterials()
  const geo = useMemo(() => {
    const s = PODIUM.size
    const gap = 0.03
    return {
      body: createMeterBoxGeometry(s, PODIUM.height - gap, s),
      base: createMeterBoxGeometry(s - 0.03, gap, s - 0.03),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return (
    <group name="podiums">
      {PODIUM_SLOTS.map((p) => (
        <group key={p.id} position={[p.x, 0, p.z]} rotation={[0, p.rotationY, 0]}>
          <mesh geometry={geo.base} material={m.shadowGap} position={[0, 0.015, 0]} receiveShadow />
          <mesh geometry={geo.body} material={m.oxblood} position={[0, 0.03 + (PODIUM.height - 0.03) / 2, 0]} castShadow receiveShadow />
        </group>
      ))}
    </group>
  )
}

/** One accent light per podium, from the ring rail onto the podium top. */
function PodiumLights() {
  const tier = useMuseum((s) => s.tier)
  const lit = withDevOverrides(QUALITY_PRESETS[tier]).tableSpots
  const spots = useMemo(
    () =>
      PODIUM_SLOTS.map((p) => {
        const mount = mountForPodium(p.id)
        const target: Vec3 = [p.x, PODIUM.height + 0.18, p.z]
        const dist = Math.hypot(mount[0] - target[0], mount[1] - target[1], mount[2] - target[2])
        return { id: p.id, zone: p.zone, mount, target, angle: coverAngle(0.42, 0.62, dist), intensity: LIGHTING.track.tableIntensity * 1.15 * (dist / 3.4) ** 2 }
      }),
    [],
  )
  return (
    <group name="podium-lights">
      {spots.map((s) => (
        <ZoneGroup key={s.id} zones={[s.zone, 'inner']}>
          <TrackSpot position={s.mount} target={s.target} angle={s.angle} intensity={s.intensity} lit={lit} />
        </ZoneGroup>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cove glow above the duplex band                                     */
/* ------------------------------------------------------------------ */

/** Height of the glow band on the wall above the interior reveal. */
const WASH = { y0: INNER_REVEAL.y1, y1: INNER_REVEAL.y1 + 0.55, off: 0.006 }

/** Re-map a face's v to 0 (bottom) … 1 (top) for the glow gradient. */
function unitV(g: THREE.BufferGeometry | null, y0: number, y1: number) {
  if (!g) return null
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0))
  return g
}

/** A straight wash quad along a wall face (offset `off` into the room). */
function washQuad(ax: number, az: number, bx: number, bz: number, nx: number, nz: number) {
  const g = new THREE.BufferGeometry()
  const o = WASH.off
  const p = [
    [ax + nx * o, WASH.y0, az + nz * o],
    [bx + nx * o, WASH.y0, bz + nz * o],
    [bx + nx * o, WASH.y1, bz + nz * o],
    [ax + nx * o, WASH.y1, az + nz * o],
  ]
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flat(), 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

/** Vertical gradient (bright at the band, gone at the top) for the wash's alpha. */
function washGradient() {
  const data = new Uint8Array(4 * 64)
  for (let i = 0; i < 64; i++) {
    const t = i / 63
    const a = Math.pow(1 - t, 2.2) * (0.35 + 0.65 * Math.min(1, t * 12))
    // alphaMap reads the green channel
    const g = Math.round(a * 255)
    data.set([g, g, g, 255], i * 4)
  }
  const tex = new THREE.DataTexture(data, 1, 64, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/**
 * The concealed LED line in the duplex band, as the soft warm glow it throws up the wall:
 * an additive gradient film just off every interior perimeter face (drum, notches, annex).
 * One draw call; brighter by night. No light is added (the cove area lights do the work
 * where the tier allows them).
 */
function CoveWash() {
  const { geo, mat } = useMemo(() => {
    const parts: (THREE.BufferGeometry | null)[] = []
    for (const w of WALLS) {
      const s = w.shape
      if (!s) continue
      if (w.kind === 'drum' && s.kind === 'arc') {
        const [a0, a1] = drumFaceSpans(w).in
        parts.push(unitV(cylinderFace(0, 0, s.r - s.thickness / 2 - WASH.off, a0, a1, WASH.y0, WASH.y1, 'in'), WASH.y0, WASH.y1))
      } else if ((w.kind === 'notch' || w.id === 'annex-east' || w.id === 'annex-west') && s.kind === 'seg') {
        // the face looking into the pavilion
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
        let nx = -(s.bz - s.az) / len
        let nz = (s.bx - s.ax) / len
        const mx = (s.ax + s.bx) / 2
        const mz = (s.az + s.bz) / 2
        if (w.kind === 'annex') {
          if (nx * mx > 0) [nx, nz] = [-nx, -nz]
        } else {
          // notch: towards the lobe (larger angle at the NE notch, smaller at the D notch)
          const a = Math.atan2(mz, mx)
          const t = nx * -Math.sin(a) + nz * Math.cos(a)
          if ((w.id === 'notch-ne') !== t > 0) [nx, nz] = [-nx, -nz]
        }
        const h = s.thickness / 2
        // interior span: the annex from its mouth to the door wall; the notch from ring to lobe
        const [ax, az, bx, bz] =
          w.kind === 'annex'
            ? [s.ax, KEY.annexMouthZ, s.bx, MUSEUM.annex.endZ]
            : (() => {
                const ux = (s.bx - s.ax) / len
                const uz = (s.bz - s.az) / len
                const run = MUSEUM.drum.r - MUSEUM.drum.ringR
                return [s.ax, s.az, s.ax + ux * run, s.az + uz * run]
              })()
        parts.push(washQuad(ax + nx * h, az + nz * h, bx + nx * h, bz + nz * h, nx, nz))
      }
    }
    const merged = mergeAll(parts)
    const m = new THREE.MeshBasicMaterial({
      name: 'coveWash',
      color: new THREE.Color('#ffb989'),
      alphaMap: washGradient(),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
      toneMapped: true,
    })
    return { geo: merged, mat: m }
  }, [])
  useEffect(
    () => () => {
      geo?.dispose()
      mat.alphaMap?.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame(() => {
    mat.opacity = 0.4 + 0.45 * ambience.night
  })
  if (!geo) return null
  return <mesh geometry={geo} material={mat} renderOrder={1} raycast={() => null} />
}

/* ------------------------------------------------------------------ */
/* The entrance: threshold and lettering                               */
/* ------------------------------------------------------------------ */

function Threshold() {
  const m = useMaterials()
  const geo = useMemo(() => createMeterBoxGeometry(MUSEUM.annex.door.width, 0.008, MUSEUM.annex.thickness + 0.06), [])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={m.brass} position={[0, 0.004, KEY.annexEndZ + MUSEUM.annex.thickness / 2]} receiveShadow />
}

/** The exhibition's name in tall spaced capitals above the door (follows the content's title). */
function FacadeLettering() {
  const w = KEY.annexOuterHalf * 2 - 0.5
  const h = 0.5
  const title = EXHIBITION_TITLE.title
  const tex = useAsyncTexture(() => createFacadeLetteringTexture(title, w, h), [title])
  if (!tex) return null
  const y = MUSEUM.annex.door.height + (MUSEUM.pavilion.mezzanineBand > MUSEUM.annex.door.height ? 0.4 : (H - MUSEUM.annex.door.height) / 2)
  return (
    <mesh position={[0, y, KEY.annexOuterZ + 0.004]} raycast={() => null}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} transparent roughness={0.55} metalness={0.2} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

/** The oculus plinth is a scene object (clickable, described); built here only if content drops it. */
const hasPlinthObject = () => SCENE_OBJECTS.some((o) => o.kind === 'oculus-plinth')

function renderable(w: WallBox) {
  return w.render !== false && w.kind !== 'boundary'
}

export function Pavilion() {
  const plinth = useMemo(hasPlinthObject, [])
  return (
    <group name="pavilion">
      {/* the shell: one mesh per material */}
      <StaticMerge name="shell">
        {WALLS.filter(renderable).map((w) => (
          <Wall key={w.id} wall={w} />
        ))}
        <CeilingAndRoof />
        <Threshold />
        {RAILS.map((r) => (
          <TrackRail key={r.id} rail={r} />
        ))}
        <Benches />
        <PodiumRow />
        {!plinth && <OculusPlinth />}
      </StaticMerge>
      <CoveWash />
      <RawClayPatches />
      <PodiumLights />
      <ZoneGroup zones={['entrance-court', 'annex']}>
        <FacadeLettering />
        <Landscape />
      </ZoneGroup>
      <Floor />
      <ExteriorGround />
    </group>
  )
}
