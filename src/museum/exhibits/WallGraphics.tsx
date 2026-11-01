/**
 * Lettering in the building and the interpretation panels (GRAND §6.4: one type system):
 *
 *  • RevealWallTitle   the H title panel: a 6.0 × 4.0 m slab of raw clay on H's entrance face
 *                      with the exhibition title cut into it (cap 0.40 m) over its introduction
 *                      (cap 0.06 m), raked by two heads from the ceiling; with it, the zone
 *                      names on the great arches' lintels;
 *  • ArchLintels       the zone names in brass letters (cap 0.22 m) laid into a lacquer band on
 *                      both faces of each great arch's lintel;
 *  • RoomPlaques       a carved clay plaque over each north-wing room's door, on the walk side
 *                      (not mounted while the rooms' own name boards stand there, architecture/Satellites.tsx);
 *  • ProductWall       the interpretation panels (config/infographics.ts), 1.2 × 1.8 m;
 *  • LabelRail         a brass label rail for a podium or plinth (15° tilt, top at 0.95 m;
 *                      title 12 mm, body 9 mm, then the credit line), for the packages that
 *                      place exhibits;
 *  • PlinthLabels      the cards on the Wine Hall plinths' own brass rails (models/winePlinth.tsx):
 *                      the pieces on each, and the attribution every CC BY scan asks for.
 * Lettering follows the visitor's language (Devanagari and Bengali in the system's faces).
 * Built with exhibits/carvedText.ts.
 */
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { INFOGRAPHICS, type InfographicConfig } from '../config/infographics'
import { SCENE_OBJECTS, type SceneObjectConfig } from '../config/objects'
import { SOURCED_REGISTRY } from '../config/sourcedRegistry.generated'
import { SURFACES, surfacePoint, type ZoneId } from '../config/layout'
import { LIGHTING } from '../config/lighting'
import { ARCH, DEG, KEY, MUSEUM, type Vec3 } from '../config/museum'
import { SAT_WALL, SATELLITES } from '../config/satellites'
import { useLang, type Lang } from '../i18n'
import { exhibitionText, zoneName } from '../i18n/content'
import { registerItem } from '../interaction/registry'
import { coverAngle, TrackSpot } from '../lighting/TrackLight'
import { mountFor } from '../lighting/tracks'
import { useMaterials } from '../materials/materials'
import { createInfographicTexture } from '../materials/wallGraphics'
import { focusOn } from '../navigation/focus'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { carvedMaps, curvedStrip, inlayMaps, type CarvedLayout, type CarvedLine } from './carvedText'

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

type Maps = { map: THREE.Texture; normalMap: THREE.Texture; metalnessMap?: THREE.Texture }

/** Dispose a set's textures (carvedMaps also returns its size in metres, W and H, beside them). */
const disposeMaps = (m: Maps) => Object.values(m).forEach((t) => (t instanceof THREE.Texture ? t.dispose() : undefined))

/** Build maps asynchronously (fonts first), dispose them on change and unmount. */
function useMaps(make: () => Promise<Maps>, deps: unknown[]): Maps | null {
  const [maps, setMaps] = useState<Maps | null>(null)
  useEffect(() => {
    let live = true
    let made: Maps | null = null
    make()
      .then((m) => {
        made = m
        if (live) setMaps(m)
        else disposeMaps(m)
      })
      .catch((err) => console.warn('[museum] lettering failed', err))
    return () => {
      live = false
      if (made) disposeMaps(made)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return maps
}

/** An annular-sector slab (plan angles a0 → a1 in rad, radii r0 → r1) from y0 to y1, one merged solid. */
function sectorSlab(r0: number, r1: number, a0: number, a1: number, y0: number, y1: number) {
  const shape = new THREE.Shape()
  const n = Math.max(6, Math.ceil(((a1 - a0) * r1) / 0.15))
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    if (i === 0) shape.moveTo(r1 * Math.cos(a), r1 * Math.sin(a))
    else shape.lineTo(r1 * Math.cos(a), r1 * Math.sin(a))
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n
    shape.lineTo(r0 * Math.cos(a), r0 * Math.sin(a))
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 })
  // the shape's y is the plan's z; turned, the extrusion runs down from y1
  g.rotateX(Math.PI / 2)
  g.translate(0, y1, 0)
  g.computeVertexNormals()
  return g
}

/** A material that takes carved or inlaid maps once they are drawn. */
function useMapped(maps: Maps | null, base: THREE.MeshStandardMaterialParameters) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial(base), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    if (!maps) return
    mat.map = maps.map
    mat.normalMap = maps.normalMap
    if (mat.emissiveIntensity > 0) mat.emissiveMap = maps.map
    if (maps.metalnessMap) {
      mat.metalnessMap = maps.metalnessMap
      mat.roughnessMap = maps.metalnessMap
    }
    mat.needsUpdate = true
  }, [maps, mat])
  return mat
}

/* ------------------------------------------------------------------ */
/* H: the carved title panel                                           */
/* ------------------------------------------------------------------ */

/**
 * The panel on H's entrance face: size, bottom, how deep it is carved into the wall (Wall.tsx cuts
 * the same recess, H_PANEL) and its plan angle (H's middle).
 */
export const TITLE_PANEL = { width: 6.0, height: 4.0, y0: 1.1, recess: 0.08, aDeg: (MUSEUM.descriptionWall.fromDeg + MUSEUM.descriptionWall.toDeg) / 2 } as const
/** H's entrance face. */
const H_FACE = MUSEUM.descriptionWall.r + MUSEUM.descriptionWall.thickness / 2

function titleLayout(lang: Lang): CarvedLayout {
  const P = TITLE_PANEL
  return {
    width: P.width,
    height: P.height,
    // a generous margin: the running intro sits well inside the panel's frame, seen from any angle
    pad: 0.62,
    align: 'center',
    pxPerM: 520,
    lines: [
      { text: exhibitionText('kicker', lang), cap: 0.055, face: 'sans', weight: 600, tracking: 0.28, upper: true },
      { text: exhibitionText('title', lang), cap: 0.4, face: 'serif', weight: 500, tracking: 0.02, before: 0.34 },
      { text: exhibitionText('subtitle', lang), cap: 0.11, face: 'serif', weight: 400, tracking: 0.04, before: 0.3 },
      { text: exhibitionText('intro', lang), cap: 0.06, face: 'sans', weight: 400, wrap: 1.7, before: 0.42 },
    ],
  }
}

function TitlePanel() {
  const lang = useLang()
  const P = TITLE_PANEL
  // the carved face lies at the back of the wall's recess (a raw-clay field 8 cm into H)
  const front = H_FACE - P.recess + 0.004
  const aMid = P.aDeg * DEG
  const geo = useMemo(() => curvedStrip(front, aMid, P.width, P.height, P.y0), [aMid, front, P.y0, P.height, P.width])
  useEffect(() => () => geo.dispose(), [geo])
  // a thin bronze frame standing just proud of the face: a crisp, straight edge all round the
  // panel (the recess's cut edge never shows as a ragged line)
  const frame = useMemo(() => {
    const t = 0.045
    const r = front + 0.01
    const side = (s: number) => curvedStrip(r, aMid + (s * (P.width / 2 + t / 2)) / r, t, P.height + 2 * t, P.y0 - t)
    return [curvedStrip(r, aMid, P.width + 2 * t, t, P.y0 - t), curvedStrip(r, aMid, P.width + 2 * t, t, P.y0 + P.height), side(-1), side(1)]
  }, [aMid, front, P.y0, P.height, P.width])
  useEffect(() => () => frame.forEach((g) => g.dispose()), [frame])
  const m = useMaterials()
  // a smooth pale lime-clay inlay, the letters cut crisply dark into it: flat and true, never a
  // warped sheet (a faint grain only, a shallow normal)
  const maps = useMaps(() => carvedMaps(titleLayout(lang), { ground: '#e4d5c1', floor: '#2a120a', grain: 0.12, seed: 11 }), [lang])
  const face = useMapped(maps, { color: '#ffffff', roughness: 0.86, normalScale: new THREE.Vector2(0.9, 0.9) })

  // one head off to the side and above, close in to the wall: a single raking light across the
  // pale panel that throws every cut letter's edge into shadow (the wall round it is oxblood)
  const spot = useMemo(() => {
    const tp = surfacePoint('h-description', (SURFACES['h-description'].range[0] + SURFACES['h-description'].range[1]) / 2, P.y0 + P.height * 0.5)
    const [nx, , nz] = tp.normal
    // along the wall (the visitor's left, facing it) and out from it
    const tx = -nz
    const tz = nx
    const mount: Vec3 = [tp.position[0] + nx * 1.4 + tx * 4.4, P.y0 + P.height + 1.6, tp.position[2] + nz * 1.4 + tz * 4.4]
    const target: Vec3 = tp.position
    const dist = Math.hypot(mount[0] - target[0], mount[1] - target[1], mount[2] - target[2])
    return { mount, target, angle: coverAngle(P.width + 0.6, P.height + 0.4, dist), intensity: LIGHTING.track.artworkIntensity * 1.1 * (dist / 2.2) ** 2 }
  }, [P.y0, P.height, P.width])

  return (
    <group name="h-title-panel">
      {maps && <mesh geometry={geo} material={face} receiveShadow raycast={() => null} />}
      {frame.map((g, i) => (
        <mesh key={i} geometry={g} material={m.brass} raycast={() => null} />
      ))}
      <TrackSpot position={spot.mount} target={spot.target} angle={spot.angle} intensity={spot.intensity} />
    </group>
  )
}

/** The building's lettering: the H title panel, the arch lintels and the rooms' plaques. */
export function RevealWallTitle() {
  return (
    <>
      <TitlePanel />
      <ArchLintels />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Arch lintels: brass letters in lacquer                              */
/* ------------------------------------------------------------------ */

/** The band on each lintel face: size, and its middle's height, between the arch's apex and the dome's springing. */
const LINTEL_BAND = { width: 3.4, height: 0.56 } as const
const LINTEL_Y = (MUSEUM.arches.eEast.apex + MUSEUM.dome.springY) / 2

type Arch = (typeof ARCH)[keyof typeof ARCH]
/** What each arch names on its outer (ambulatory) face and on its inner (rotunda) face. */
const ARCH_SIGNS: { arch: Arch; outer: ZoneId; inner: ZoneId }[] = [
  { arch: ARCH.eEast, outer: 'ring-a', inner: 'entry-e' },
  { arch: ARCH.eWest, outer: 'inner', inner: 'entry-e' },
  { arch: ARCH.d, outer: 'ring-c', inner: 'hallway-d' },
]

const signName = (z: ZoneId, lang: Lang) => (z.startsWith('ring-') ? zoneName(z, lang, true) : zoneName(z, lang))

function LintelBand({ text, r, aDeg, inward }: { text: string; r: number; aDeg: number; inward: boolean }) {
  const B = LINTEL_BAND
  const geo = useMemo(() => curvedStrip(r, aDeg * DEG, B.width, B.height, LINTEL_Y - B.height / 2, inward), [r, aDeg, inward, B.width, B.height])
  useEffect(() => () => geo.dispose(), [geo])
  const maps = useMaps(
    () => inlayMaps({ width: B.width, height: B.height, pad: 0.1, align: 'center', pxPerM: 700, lines: [{ text, cap: 0.22, face: 'serif', weight: 600, tracking: 0.12, upper: true }] }, { ground: '#3a1512' }),
    [text],
  )
  // a faint glow from the letters keeps the name readable high up in a dim arch
  const mat = useMapped(maps, { color: '#ffffff', roughness: 1, metalness: 0.5, envMapIntensity: 1.2, emissive: '#ffffff', emissiveIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })
  return maps ? <mesh geometry={geo} material={mat} raycast={() => null} /> : null
}

export function ArchLintels() {
  const lang = useLang()
  return (
    <group name="arch-lintels">
      {ARCH_SIGNS.map(({ arch, outer, inner }) => (
        <group key={arch.midDeg}>
          <ZoneGroup zones={['entry-e', 'hallway-d', 'annex']}>
            <LintelBand text={signName(outer, lang)} r={KEY.ringOuterR + 0.004} aDeg={arch.midDeg} inward={false} />
          </ZoneGroup>
          <ZoneGroup zones={['inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e']}>
            <LintelBand text={signName(inner, lang)} r={KEY.ringR - 0.004} aDeg={arch.midDeg} inward />
          </ZoneGroup>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* North-wing room plaques                                             */
/* ------------------------------------------------------------------ */

const PLAQUE = { width: 2.4, height: 0.52, proud: 0.035 } as const
/** The rooms' inner wall (walk-side face), and the plaque's middle above the door. */
const PLAQUE_R = SAT_WALL.innerC - SAT_WALL.t / 2
const PLAQUE_Y = SAT_WALL.door.height + 0.25 + PLAQUE.height / 2

function RoomPlaque({ zone, aDeg }: { zone: ZoneId; aDeg: number }) {
  const lang = useLang()
  const r = PLAQUE_R - PLAQUE.proud
  const half = PLAQUE.width / 2 / r
  const a = aDeg * DEG
  const geo = useMemo(
    () => ({
      slab: sectorSlab(r + 0.002, PLAQUE_R + 0.01, a - half, a + half, PLAQUE_Y - PLAQUE.height / 2, PLAQUE_Y + PLAQUE.height / 2),
      face: curvedStrip(r, a, PLAQUE.width, PLAQUE.height, PLAQUE_Y - PLAQUE.height / 2, true),
    }),
    [r, a, half],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const maps = useMaps(
    () =>
      carvedMaps(
        { width: PLAQUE.width, height: PLAQUE.height, pad: 0.08, align: 'center', pxPerM: 800, lines: [{ text: zoneName(zone, lang), cap: 0.12, face: 'serif', weight: 600, tracking: 0.06 }] },
        { ground: '#c38a63', floor: '#4a2414', grain: 0.6, seed: Math.round(Math.abs(aDeg) * 7) },
      ),
    [lang, zone],
  )
  const face = useMapped(maps, { color: '#ffffff', roughness: 0.9, normalScale: new THREE.Vector2(1.4, 1.4) })
  const slab = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b07752', roughness: 0.95 }), [])
  useEffect(() => () => slab.dispose(), [slab])
  return (
    <group name={`plaque ${zone}`}>
      <mesh geometry={geo.slab} material={slab} castShadow raycast={() => null} />
      {maps && <mesh geometry={geo.face} material={face} raycast={() => null} />}
    </group>
  )
}

const ROOM_ZONE: Record<string, ZoneId> = { atlas: 'atlas', theatre: 'theatre', library: 'library', shop: 'shop' }

export function RoomPlaques() {
  return (
    <ZoneGroup zones={['parikrama-west', 'parikrama-east', 'entrance-court']}>
      {SATELLITES.map((s) => (
        <RoomPlaque key={s.id} zone={ROOM_ZONE[s.id]} aDeg={s.doorDeg} />
      ))}
    </ZoneGroup>
  )
}

/* ------------------------------------------------------------------ */
/* Label rails                                                         */
/* ------------------------------------------------------------------ */

/** A label rail's card: width, depth up the slope, tilt and the height of its top edge. */
export const LABEL_RAIL = { width: 0.3, depth: 0.1, tiltDeg: 15, top: 0.95 } as const

export interface LabelRailProps {
  title: string
  body?: string
  /** The credit line (sourced models), set last in small capitals. */
  credit?: string
  /** The rail's centre in plan [x, z]. */
  position: [number, number]
  /** Rotation (rad) about y that turns the rail's front (+z) to its reader. */
  rotationY: number
  width?: number
}

/** A brass label rail: a card tilted 15° towards its reader, its top edge at 0.95 m. */
export function LabelRail({ title, body, credit, position, rotationY, width = LABEL_RAIL.width }: LabelRailProps) {
  const m = useMaterials()
  const R = LABEL_RAIL
  const tilt = R.tiltDeg * DEG
  const lines = useMemo(() => {
    const out: CarvedLine[] = [{ text: title, cap: 0.012 * 0.68, face: 'serif', weight: 600 }]
    if (body) out.push({ text: body, cap: 0.009 * 0.73, face: 'sans', weight: 400, wrap: 1.55, before: 0.006 })
    if (credit) out.push({ text: credit, cap: 0.0062, face: 'sans', weight: 500, tracking: 0.06, upper: true, wrap: 1.5, before: 0.006 })
    return out
  }, [title, body, credit])
  const maps = useMaps(
    () => carvedMaps({ width, height: R.depth, pad: 0.012, valign: 'top', pxPerM: 4000, lines }, { ground: '#efe6d6', floor: '#2e2a26', grain: 0, depth: 0.0004, wall: 0.0004 }),
    [lines, width],
  )
  const card = useMapped(maps, { color: '#ffffff', roughness: 0.75 })
  // the card's top edge at R.top, sloping down towards the reader
  const cy = R.top - (R.depth / 2) * Math.sin(tilt)
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, cy - 0.006, -0.002]} rotation={[-(Math.PI / 2 - tilt), 0, 0]} material={m.brass}>
        <boxGeometry args={[width + 0.016, R.depth + 0.016, 0.008]} />
      </mesh>
      {maps && (
        <mesh position={[0, cy, 0]} rotation={[-(Math.PI / 2 - tilt), 0, 0]} material={card}>
          <planeGeometry args={[width, R.depth]} />
        </mesh>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Plinth labels (the Wine Hall)                                       */
/* ------------------------------------------------------------------ */

/** models/winePlinth.tsx's rail: top, tilt, depth up the slope and its distance in front of the plinth. */
const PLINTH_RAIL = { top: 0.95, tiltDeg: 15, depth: 0.11, offset: 0.16 } as const

interface PlinthLabel {
  id: string
  position: Vec3
  rotationY: number
  /** The rail's width (the plate is min(0.9, 0.6 × plinth width)). */
  width: number
  /** The plinth's depth (the rail stands `offset` in front of its front face). */
  depth: number
  pieces: SceneObjectConfig[]
}

const numProp = (o: SceneObjectConfig, k: string, d: number) => {
  const v = o.props?.[k]
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : d
}

/** Every wine plinth with sourced pieces standing on it, and those pieces in order across it. */
export function plinthLabels(objects: readonly SceneObjectConfig[]): PlinthLabel[] {
  const pieces = objects.filter((o) => o.kind === 'sourced-model')
  const out: PlinthLabel[] = []
  for (const p of objects) {
    if (p.kind !== 'wine-plinth') continue
    const W = Math.max(0.3, numProp(p, 'width', 2.4))
    const D = Math.max(0.3, numProp(p, 'depth', 0.9))
    const r = (p.rotationDeg ?? 0) * DEG
    const c = Math.cos(r)
    const sn = Math.sin(r)
    // world → the plinth's frame (three's y rotation: world = (x c + z s, −x s + z c))
    const local = (o: SceneObjectConfig) => {
      const dx = o.position[0] - p.position[0]
      const dz = o.position[2] - p.position[2]
      return [dx * c - dz * sn, dx * sn + dz * c] as const
    }
    const on = pieces
      .map((o) => ({ o, l: local(o) }))
      .filter(({ l }) => Math.abs(l[0]) <= W / 2 + 0.05 && Math.abs(l[1]) <= D / 2 + 0.05)
      .sort((a, b) => a.l[0] - b.l[0])
      .map(({ o }) => o)
    if (!on.length) continue
    out.push({ id: p.id, position: p.position, rotationY: r, width: Math.min(0.9, W * 0.6) - 0.02, depth: D, pieces: on })
  }
  return out
}

/** "Title — author, via source (CC BY 4.0)": the registry's line, else one made from the object's credit. */
function attribution(o: SceneObjectConfig): string | null {
  if (!o.credit || o.credit.license === 'CC0') return null
  const slug = typeof o.props?.slug === 'string' ? o.props.slug : ''
  const line = SOURCED_REGISTRY[slug]?.credit.attribution
  if (o.credit.license === 'PD') return `${o.credit.title ?? o.title}: public domain`
  return line ?? `${o.credit.title ?? o.title} — ${o.credit.author} (CC BY 4.0)`
}

function PlinthCard({ label }: { label: PlinthLabel }) {
  const lang = useLang()
  const R = PLINTH_RAIL
  const tilt = R.tiltDeg * DEG
  const lines = useMemo(() => {
    const titles = label.pieces.map((o) => (lang === 'en' ? o.title : (o.i18n?.[lang]?.title ?? o.title)))
    const out: CarvedLine[] = [{ text: titles.join('  ·  '), cap: 0.0078, face: 'serif', weight: 600, wrap: 1.5 }]
    const credits = label.pieces.map(attribution).filter((x): x is string => !!x)
    credits.forEach((text, i) => out.push({ text, cap: 0.0042, face: 'sans', weight: 500, wrap: 1.45, before: i ? 0.002 : 0.005 }))
    return out
  }, [label, lang])
  const maps = useMaps(
    () => carvedMaps({ width: label.width, height: R.depth - 0.012, pad: 0.008, valign: 'top', pxPerM: 4000, lines }, { ground: '#efe6d6', floor: '#2e2a26', grain: 0, depth: 0.0004, wall: 0.0004 }),
    [lines, label.width],
  )
  const card = useMapped(maps, { color: '#ffffff', roughness: 0.75 })
  if (!maps) return null
  // on the plate's top face (its centre plus half its 8 mm thickness along the plate's normal)
  const D = label.depth
  const plateY = R.top - (R.depth / 2) * Math.sin(tilt)
  const lift = 0.0055
  return (
    <group position={label.position} rotation={[0, label.rotationY, 0]}>
      <mesh position={[0, plateY + lift * Math.cos(tilt), D / 2 + R.offset + lift * Math.sin(tilt)]} rotation={[-(Math.PI / 2 - tilt), 0, 0]} material={card} raycast={() => null}>
        <planeGeometry args={[label.width, R.depth - 0.012]} />
      </mesh>
    </group>
  )
}

/** The Wine Hall's label cards: the scans' names and, for CC BY scans, their attribution. */
export function PlinthLabels() {
  const labels = useMemo(() => plinthLabels(SCENE_OBJECTS), [])
  return (
    <ZoneGroup zones={['hallway-d']}>
      {labels.map((l) => (
        <PlinthCard key={l.id} label={l} />
      ))}
    </ZoneGroup>
  )
}

/* ------------------------------------------------------------------ */
/* Interpretation panels                                               */
/* ------------------------------------------------------------------ */

function InfographicPanel({ cfg }: { cfg: InfographicConfig }) {
  const m = useMaterials()
  const select = useMuseum((s) => s.select)
  const cy = cfg.placement.centerHeight ?? MUSEUM.display.artworkCenterHeight
  const tex = useAsyncTexture(() => createInfographicTexture(cfg, cfg.width, cfg.height), [cfg])
  const p = useMemo(() => surfacePoint(cfg.placement.surface, cfg.placement.at, cy, 0.001), [cfg.placement.surface, cfg.placement.at, cy])
  const depth = 0.012

  useEffect(
    () =>
      registerItem({
        id: cfg.id,
        kind: 'infographic',
        title: cfg.title,
        center: [p.position[0] + p.normal[0] * depth, cy, p.position[2] + p.normal[2] * depth],
        normal: p.normal,
        size: [cfg.width, cfg.height],
        viewDistance: 2.1,
      }),
    [cfg.id, cfg.title, cfg.width, cfg.height, p, cy],
  )

  const spot = useMemo(() => {
    const mount = mountFor(cfg.placement.surface, cfg.placement.at)
    const target: Vec3 = [p.position[0], cy, p.position[2]]
    const dist = Math.hypot(mount[0] - target[0], mount[1] - target[1], mount[2] - target[2])
    return { mount, target, angle: coverAngle(cfg.width, cfg.height, dist), intensity: LIGHTING.track.artworkIntensity * 0.45 * (dist / 2.2) ** 2 }
  }, [cfg.placement.surface, cfg.placement.at, cfg.width, cfg.height, p, cy])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    select({ kind: 'infographic', id: cfg.id })
    focusOn('infographic', cfg.id)
  }

  return (
    <group>
      <group
        position={p.position}
        rotation={[0, p.rotationY, 0]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <mesh position={[0, 0, depth / 2]} material={m.paintWhite} castShadow receiveShadow>
          <boxGeometry args={[cfg.width, cfg.height, depth]} />
        </mesh>
        {tex && (
          <mesh position={[0, 0, depth + 0.0008]} receiveShadow>
            <planeGeometry args={[cfg.width, cfg.height]} />
            <meshStandardMaterial map={tex} roughness={0.8} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        )}
      </group>
      <TrackSpot position={spot.mount} target={spot.target} angle={spot.angle} intensity={spot.intensity} />
    </group>
  )
}

export function ProductWall() {
  return (
    <group>
      {INFOGRAPHICS.map((cfg) => (
        <InfographicPanel key={cfg.id} cfg={cfg} />
      ))}
    </group>
  )
}
