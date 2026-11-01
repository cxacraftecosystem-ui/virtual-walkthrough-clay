/**
 * 'duplex-frieze' — the procession frieze round the duplex band (SPECTACLE F20).
 *
 * The PDF's half-height line becomes a continuous 0.6 m terracotta relief (y 4.0 … 4.6): round
 * the rotunda on the duplex balcony's fascia (Balcony.tsx), from the D arch to the bridge; in the
 * ambulatory on the lobe wall, the west run from the annex mouth to the D notch, the east run
 * from the NE notch to the annex mouth. Eight scenes of the clay's life
 * (materials/friezeTextures.ts) repeat along it, each run starting at its own seeded offset; a
 * hidden cove below grazes it with warm light (stronger by night; `cove` prop).
 *
 * The kind itself is an invisible singleton (its props: scenes, seed, cove); the band is drawn by
 * `<DuplexFriezeBand/>` from the court mount (spectacle/mounts/court.tsx), so it is shown from
 * every room that can see the drum, not only the court. One draw call per visible run.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { WALLS, type ZoneId } from '../config/layout'
import { DEG, MUSEUM } from '../config/museum'
import { ambience } from '../lighting/timeOfDayState'
import { FRIEZE, getFriezeTile, parseScenes } from '../materials/friezeTextures'
import { mulberry32 } from '../materials/noise'
import { ZoneGroup } from '../navigation/zoneCulling'
import { kindProps, useSpectacle } from '../spectacle/settings'
import { BALCONY } from './Balcony'
import { drumFaceSpans } from './Wall'

/** The band (m): bottom, top, how far it stands proud of the plaster. */
/** On the balcony's fascia (GRAND §2.5: the duplex line is the balcony at half the clear height). */
export const BAND = { y0: MUSEUM.balcony.fascia.y0, y1: MUSEUM.balcony.fascia.y0 + FRIEZE.bandM, proud: 0.015 } as const
const noRaycast = () => null

interface Run {
  id: string
  r: number
  a0: number
  a1: number
  zones: ZoneId[]
}

/** The three runs, ending flush against the notch walls and the annex mouth. */
function runs(): Run[] {
  const half = MUSEUM.drum.thickness / 2 + 0.004
  const out: Run[] = []
  const zonesOf: Record<string, ZoneId[]> = {
    'drum-ring': ['inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'duplex', 'sky-rim'],
    'drum-lobe-west': ['entry-e', 'hallway-d', 'annex'],
    'drum-lobe-east': ['entry-e', 'annex'],
  }
  // the rotunda's run: the balcony's fascia
  out.push({ id: 'drum-ring', r: BALCONY.r0, a0: BALCONY.fromDeg * DEG + 0.0005, a1: BALCONY.toDeg * DEG - 0.0005, zones: zonesOf['drum-ring'] })
  for (const id of ['drum-lobe-west', 'drum-lobe-east']) {
    const w = WALLS.find((x) => x.id === id)
    if (w?.shape?.kind !== 'arc') continue
    const rFace = w.shape.r - w.shape.thickness / 2
    const [i0, i1] = drumFaceSpans(w).in
    const notch = half / rFace
    // the ring's span runs into both notches; each lobe meets one notch and the annex mouth
    const a0 = id === 'drum-lobe-west' ? i0 + 0.002 : w.shape.a0 + notch
    const a1 = id === 'drum-lobe-east' ? i1 - 0.002 : w.shape.a1 - notch
    if (a1 > a0) out.push({ id, r: rFace, a0, a1, zones: zonesOf[id] })
  }
  return out
}

/** Front face, top and soffit ledges and the two end returns of one run, with tile UVs. */
function runGeometry(run: Run, tileM: number, offset: number): THREE.BufferGeometry {
  const rf = run.r - BAND.proud
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const quad = (p0: number[][], n: number[][], u0: number[][]) => {
    // wind every quad counter-clockwise about its normal, whatever order it was listed in
    const e1 = [p0[1][0] - p0[0][0], p0[1][1] - p0[0][1], p0[1][2] - p0[0][2]]
    const e2 = [p0[2][0] - p0[0][0], p0[2][1] - p0[0][1], p0[2][2] - p0[0][2]]
    const cx = e1[1] * e2[2] - e1[2] * e2[1]
    const cy = e1[2] * e2[0] - e1[0] * e2[2]
    const cz = e1[0] * e2[1] - e1[1] * e2[0]
    const flip = cx * n[0][0] + cy * n[0][1] + cz * n[0][2] < 0
    const order = flip ? [0, 3, 2, 1] : [0, 1, 2, 3]
    const p = order.map((i) => p0[i])
    const u = order.map((i) => u0[i])
    n = order.map((i) => n[i])
    const b = pos.length / 3
    for (let i = 0; i < 4; i++) {
      pos.push(...p[i])
      nor.push(...n[i])
      uv.push(...u[i])
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const n = Math.max(2, Math.ceil(((run.a1 - run.a0) * rf) / 0.2))
  // the ledges sample the moulding (a solid strip near the band's top / bottom)
  const vTop = 1 - (FRIEZE.borderM * 0.5) / FRIEZE.bandM
  const vBot = (FRIEZE.borderM * 0.5) / FRIEZE.bandM
  for (let i = 0; i < n; i++) {
    const t0 = run.a0 + ((run.a1 - run.a0) * i) / n
    const t1 = run.a0 + ((run.a1 - run.a0) * (i + 1)) / n
    const c0 = Math.cos(t0)
    const s0 = Math.sin(t0)
    const c1 = Math.cos(t1)
    const s1 = Math.sin(t1)
    const u0 = offset + ((t0 - run.a0) * rf) / tileM
    const u1 = offset + ((t1 - run.a0) * rf) / tileM
    // front (faces the centre): counter-clockwise seen from inside
    quad(
      [
        [rf * c1, BAND.y0, rf * s1],
        [rf * c0, BAND.y0, rf * s0],
        [rf * c0, BAND.y1, rf * s0],
        [rf * c1, BAND.y1, rf * s1],
      ],
      [
        [-c1, 0, -s1],
        [-c0, 0, -s0],
        [-c0, 0, -s0],
        [-c1, 0, -s1],
      ],
      [
        [u1, 0],
        [u0, 0],
        [u0, 1],
        [u1, 1],
      ],
    )
    const r1 = run.r + 0.002
    // top ledge (faces up)
    quad(
      [
        [rf * c0, BAND.y1, rf * s0],
        [r1 * c0, BAND.y1, r1 * s0],
        [r1 * c1, BAND.y1, r1 * s1],
        [rf * c1, BAND.y1, rf * s1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [u0, vTop],
        [u0, vTop],
        [u1, vTop],
        [u1, vTop],
      ],
    )
    // soffit (faces down): lit by the cove
    quad(
      [
        [rf * c1, BAND.y0, rf * s1],
        [r1 * c1, BAND.y0, r1 * s1],
        [r1 * c0, BAND.y0, r1 * s0],
        [rf * c0, BAND.y0, rf * s0],
      ],
      [
        [0, -1, 0],
        [0, -1, 0],
        [0, -1, 0],
        [0, -1, 0],
      ],
      [
        [u1, vBot],
        [u1, vBot],
        [u0, vBot],
        [u0, vBot],
      ],
    )
  }
  // end returns (radial faces) where a run stops at a notch wall or the annex mouth
  for (const [a, sgn] of [
    [run.a0, -1],
    [run.a1, 1],
  ] as const) {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const r1 = run.r + 0.002
    const tx = -s * sgn
    const tz = c * sgn
    const p = [
      [rf * c, BAND.y0, rf * s],
      [r1 * c, BAND.y0, r1 * s],
      [r1 * c, BAND.y1, r1 * s],
      [rf * c, BAND.y1, rf * s],
    ]
    const u = offset + (a === run.a0 ? 0 : ((run.a1 - run.a0) * rf) / tileM)
    const q = sgn > 0 ? p : [p[1], p[0], p[3], p[2]]
    quad(q, [0, 1, 2, 3].map(() => [tx, 0, tz]), [
      [u, 0.02],
      [u, 0.02],
      [u, 0.98],
      [u, 0.98],
    ])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

type CoveU = { uCove: { value: number } }

function friezeMaterial(map: THREE.Texture, normalMap: THREE.Texture, u: CoveU) {
  const m = new THREE.MeshStandardMaterial({ name: 'duplexFrieze', map, normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.86, metalness: 0, envMapIntensity: 0.6 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBandY;').replace('#include <begin_vertex>', `#include <begin_vertex>\nvBandY = (position.y - ${BAND.y0.toFixed(3)}) / ${(BAND.y1 - BAND.y0).toFixed(3)};`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uCove;\nvarying float vBandY;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  // a hidden cove below: warm light grazing up the relief — brightest at the foot, on faces turned down
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float down = clamp(-dot(normal, upV) * 1.6 + 0.35, 0.0, 1.4);
  float foot = pow(1.0 - clamp(vBandY, 0.0, 1.0), 1.6);
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.48) * uCove * (0.25 + foot * down);
}`,
    )
  }
  m.customProgramCacheKey = () => 'duplexFrieze'
  return m
}

/** The kind: settings only (the band is `<DuplexFriezeBand/>`). */
export function DuplexFrieze() {
  return null
}

/** The frieze itself, mounted once by the court mount. */
export function DuplexFriezeBand() {
  const sp = useSpectacle()
  const props = useMemo(() => kindProps('duplex-frieze'), [])
  const scenes = useMemo(() => parseScenes(String(props.scenes ?? '')), [props.scenes])
  const seed = Number(props.seed) || 1
  const cove = props.cove !== false && props.cove !== 'false'
  const ppm = sp.caps.spectacleTexPx / 4
  const tile = useMemo(() => (typeof document === 'undefined' ? null : getFriezeTile(Math.max(128, ppm), scenes)), [ppm, scenes])
  const u = useMemo<CoveU>(() => ({ uCove: { value: 0 } }), [])
  const mat = useMemo(() => (tile ? friezeMaterial(tile.map, tile.normalMap, u) : null), [tile, u])
  useEffect(() => () => mat?.dispose(), [mat])
  const geos = useMemo(() => {
    if (!tile) return []
    const rnd = mulberry32(seed * 977 + 5)
    return runs().map((run) => ({ run, geo: runGeometry(run, tile.tileM, Math.floor(rnd() * 8) / 8) }))
  }, [tile, seed])
  useEffect(() => () => geos.forEach((g) => g.geo.dispose()), [geos])
  useFrame(() => {
    u.uCove.value = cove ? 0.12 + 0.55 * ambience.night + 0.1 * ambience.twilight : 0.06
  })
  if (!mat) return null
  return (
    <group name="duplex-frieze">
      {geos.map(({ run, geo }) => (
        <ZoneGroup key={run.id} zones={run.zones}>
          <mesh geometry={geo} material={mat} receiveShadow raycast={noRaycast} />
        </ZoneGroup>
      ))}
    </group>
  )
}

/** Plan angle span of each run (deg), for checks. */
export function friezeSpans(): { id: string; fromDeg: number; toDeg: number }[] {
  return runs().map((r) => ({ id: r.id, fromDeg: r.a0 / DEG, toDeg: r.a1 / DEG }))
}
