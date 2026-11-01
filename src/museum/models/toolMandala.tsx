/**
 * 'tool-mandala' — the Mandala of Clay Tools on F (SPECTACLE F16).
 *
 * A 1.9 m roundel (`size`) of a potter's tools laid in three rings (`rings`, `folds` per ring)
 * round an incised clay plate: fired-clay anvils, wooden beating paddles and clay stamps, wooden
 * ribs, cutting wires with their toggles, iron scrapers and the wheel stick. Three draw calls —
 * wood, iron, clay — each one merged geometry with per-part tones; the rings turn imperceptibly in
 * the vertex shader (one turn every `spinSec`, alternate rings the other way; off on Low and under
 * reduced motion).
 *
 * Origin: the floor point in front of the wall, front +z towards the court; the roundel's back
 * stands on local z = 0 at height `CENTRE_Y`. Clicking any tool opens the object; tool names are
 * placeholder (silent) until the workshop confirms them (`tools`, one name per line).
 */
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LIGHTING } from '../config/lighting'
import { registerSpot } from '../lighting/SpotPool'
import { TRACK_COLOR } from '../lighting/TrackLight'
import { focusOn } from '../navigation/focus'
import { useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import type { ModelProps } from './types'
import { num, str } from './types'

const CENTRE_Y = 2.3

type Mat = 'wood' | 'iron' | 'clay'

interface Part {
  geo: THREE.BufferGeometry
  mat: Mat
  ring: number
  color: string
}

const tmpColor = new THREE.Color()

/** Paint a geometry one colour (vertex colours) and tag its ring. */
function tag(g: THREE.BufferGeometry, ring: number, color: string): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  tmpColor.set(color)
  const c = new Float32Array(n * 3)
  const r = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpColor.r
    c[i * 3 + 1] = tmpColor.g
    c[i * 3 + 2] = tmpColor.b
    r[i] = ring
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  g.setAttribute('aRing', new THREE.BufferAttribute(r, 1))
  if (g.index) return g.toNonIndexed()
  return g
}

/** Put a tool built along +y (handle down) at radius `r`, angle `a`, lying on the plate, `lift` proud. */
function place(g: THREE.BufferGeometry, r: number, a: number, lift: number, spin = 0) {
  g.rotateZ(spin)
  g.rotateZ(a - Math.PI / 2)
  g.translate(r * Math.cos(a), r * Math.sin(a), lift)
  return g
}

/* tools, each built lying flat on z = 0 with its long axis on +y */

function paddle(len: number): THREE.BufferGeometry[] {
  // a flat oval blade and a round handle (thapi)
  const blade = new THREE.CylinderGeometry(0.075, 0.075, 0.022, 20)
  blade.rotateX(Math.PI / 2)
  blade.scale(1, 1.35, 1)
  blade.translate(0, len * 0.62, 0.011)
  const handle = new THREE.CylinderGeometry(0.016, 0.019, len * 0.55, 10)
  handle.translate(0, len * 0.22, 0.018)
  return [blade, handle]
}

function anvil(): THREE.BufferGeometry {
  // a fired-clay anvil (pindi) lying on its side: grip towards the centre, the dome outward
  const p = [
    [0, 0],
    [0.026, 0],
    [0.028, 0.045],
    [0.06, 0.055],
    [0.075, 0.08],
    [0.062, 0.105],
    [0.035, 0.118],
    [0, 0.122],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(p, 20)
  g.translate(0, 0, 0.06)
  return g
}

function rib(): THREE.BufferGeometry {
  // a kidney-shaped wooden rib
  const s = new THREE.Shape()
  s.moveTo(-0.05, 0)
  s.bezierCurveTo(-0.07, 0.07, -0.03, 0.15, 0.0, 0.16)
  s.bezierCurveTo(0.05, 0.15, 0.06, 0.07, 0.04, 0.0)
  s.bezierCurveTo(0.02, 0.04, -0.03, 0.04, -0.05, 0)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 10 })
  return g
}

function stamp(): THREE.BufferGeometry[] {
  // a clay stamp: a disc face with a knob
  const face = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18)
  face.rotateX(Math.PI / 2)
  face.translate(0, 0, 0.01)
  const knob = new THREE.SphereGeometry(0.025, 12, 8)
  knob.translate(0, 0, 0.035)
  return [face, knob]
}

function wire(len: number): { iron: THREE.BufferGeometry; wood: THREE.BufferGeometry[] } {
  // a cutting wire between two wooden toggles
  const w = new THREE.CylinderGeometry(0.0022, 0.0022, len, 5)
  w.translate(0, len / 2, 0.012)
  const t0 = new THREE.CylinderGeometry(0.011, 0.011, 0.07, 8)
  t0.rotateZ(Math.PI / 2)
  t0.translate(0, 0, 0.012)
  const t1 = t0.clone()
  t1.translate(0, len, 0)
  return { iron: w, wood: [t0, t1] }
}

function scraper(): THREE.BufferGeometry {
  // an iron scraper: a thin crescent blade
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.07, 0.2, Math.PI - 0.2, false)
  s.absarc(0, -0.03, 0.06, Math.PI - 0.35, 0.35, true)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false, curveSegments: 12 })
  g.translate(0, 0.02, 0.004)
  return g
}

function stick(len: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.012, 0.016, len, 8)
  g.translate(0, len / 2, 0.016)
  return g
}

/* ------------------------------------------------------------------ */

function build(size: number, rings: number, folds: number[]): Record<Mat, THREE.BufferGeometry | null> {
  const R = size / 2
  const parts: Part[] = []
  const add = (g: THREE.BufferGeometry, mat: Mat, ring: number, color: string) => parts.push({ geo: g, mat, ring, color })
  // backing disc and its rim, the incised plate with its rings
  const disc = new THREE.CylinderGeometry(R, R, 0.03, 96)
  disc.rotateX(Math.PI / 2)
  disc.translate(0, 0, 0.015)
  add(disc, 'clay', 0, '#4a231a')
  const rim = new THREE.TorusGeometry(R, 0.012, 8, 128)
  rim.translate(0, 0, 0.03)
  add(rim, 'iron', 0, '#3b3532')
  const plateR = R * 0.3
  const plate = new THREE.CylinderGeometry(plateR, plateR * 1.02, 0.03, 64)
  plate.rotateX(Math.PI / 2)
  plate.translate(0, 0, 0.045)
  add(plate, 'clay', 0, '#b6603f')
  for (const f of [0.35, 0.6, 0.85]) {
    const inc = new THREE.TorusGeometry(plateR * f, 0.004, 6, 64)
    inc.translate(0, 0, 0.06)
    add(inc, 'clay', 0, '#5e2a1d')
  }
  const centre = new THREE.SphereGeometry(plateR * 0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  centre.rotateX(Math.PI / 2)
  centre.translate(0, 0, 0.06)
  add(centre, 'clay', 0, '#7c3b27')
  const radii = [0.42, 0.64, 0.86].map((f) => f * R)
  const k = size / 1.9
  const nr = Math.max(1, Math.min(3, rings))
  for (let ring = 0; ring < nr; ring++) {
    const n = folds[ring] ?? [8, 12, 16][ring]
    const r = radii[ring]
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (ring % 2 ? Math.PI / n : 0)
      if (ring === 0) {
        // beating paddles (thapi), blades outward like petals
        for (const g of paddle(0.34 * k)) add(place(g, r - 0.16 * k, a, 0.03), 'wood', 1, i % 2 ? '#8a5a35' : '#6c4226')
      } else if (ring === 1) {
        if (i % 2 === 0) add(place(anvil(), r - 0.06 * k, a, 0.03), 'clay', 2, i % 4 === 0 ? '#a24a2f' : '#8b3e28')
        else for (const g of stamp()) add(place(g, r, a, 0.03), 'clay', 2, '#c06a43')
      } else {
        if (i % 4 === 0) {
          const wv = wire(0.24 * k)
          add(place(wv.iron, r - 0.12 * k, a, 0.03), 'iron', 3, '#8a827a')
          for (const g of wv.wood) add(place(g, r - 0.12 * k, a, 0.03), 'wood', 3, '#9a6a40')
        } else if (i % 4 === 1) add(place(rib(), r - 0.06 * k, a, 0.03), 'wood', 3, '#a2713f')
        else if (i % 4 === 2) add(place(scraper(), r, a, 0.03), 'iron', 3, '#5a524c')
        else add(place(stick(0.26 * k), r - 0.13 * k, a, 0.03), 'wood', 3, '#7b5030')
      }
    }
  }
  // fine incised rings parting the three rings of tools
  for (const f of [0.53, 0.75]) {
    const inc = new THREE.TorusGeometry(R * f, 0.0035, 6, 160)
    inc.translate(0, 0, 0.031)
    add(inc, 'clay', 0, '#1e0e0a')
  }
  const out: Record<Mat, THREE.BufferGeometry | null> = { wood: null, iron: null, clay: null }
  for (const m of ['wood', 'iron', 'clay'] as Mat[]) {
    const gs = parts.filter((p) => p.mat === m).map((p) => {
      const g = p.geo
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k)
      return tag(g, p.ring, p.color)
    })
    if (gs.length) {
      out[m] = mergeGeometries(gs, false)
      out[m]?.translate(0, CENTRE_Y, 0)
      out[m]?.computeBoundingSphere()
    }
    gs.forEach((g) => g.dispose())
    parts.filter((p) => p.mat === m).forEach((p) => p.geo.dispose())
  }
  return out
}

type RingU = { uRingRot: { value: THREE.Vector3 } }

/** Turn each ring about the roundel's centre (local z axis through CENTRE_Y). */
function withRings<M extends THREE.MeshStandardMaterial>(m: M, u: RingU): M {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRing;\nuniform vec3 uRingRot;')
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float ringAng = aRing < 0.5 ? 0.0 : (aRing < 1.5 ? uRingRot.x : (aRing < 2.5 ? uRingRot.y : uRingRot.z));
float rc = cos(ringAng), rs = sin(ringAng);
objectNormal = vec3(rc * objectNormal.x - rs * objectNormal.y, rs * objectNormal.x + rc * objectNormal.y, objectNormal.z);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec2 q = transformed.xy - vec2(0.0, ${CENTRE_Y.toFixed(3)});
  q = vec2(rc * q.x - rs * q.y, rs * q.x + rc * q.y);
  transformed.xy = q + vec2(0.0, ${CENTRE_Y.toFixed(3)});
}`,
      )
  }
  m.customProgramCacheKey = () => `toolRings|${m.name}`
  return m
}

export function ToolMandala({ config }: ModelProps) {
  const sp = useSpectacle()
  const size = Math.max(0.8, Math.min(2.6, num(config, 'size', 1.9)))
  const rings = Math.round(num(config, 'rings', 3))
  const folds = str(config, 'folds', '8,12,16')
    .split(',')
    .map((s) => Math.max(4, Math.min(32, Math.round(Number(s)) || 0)))
  const spinSec = num(config, 'spinSec', 600)
  const key = `${size}|${rings}|${folds.join(',')}`
  const geos = useMemo(() => build(size, rings, folds), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos])
  const u = useMemo<RingU>(() => ({ uRingRot: { value: new THREE.Vector3() } }), [])
  const mats = useMemo(
    () => ({
      wood: withRings(new THREE.MeshStandardMaterial({ name: 'toolWood', vertexColors: true, roughness: 0.62, metalness: 0 }), u),
      iron: withRings(new THREE.MeshStandardMaterial({ name: 'toolIron', vertexColors: true, roughness: 0.48, metalness: 0.6 }), u),
      clay: withRings(new THREE.MeshStandardMaterial({ name: 'toolClay', vertexColors: true, roughness: 0.84, metalness: 0 }), u),
    }),
    [u],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  // its own light: a soft spot from the ceiling in front, so the roundel is a lit, precious thing
  // on the dark wall (SpotPool request; world space from the object's placement)
  useEffect(() => {
    const rot = ((config.rotationDeg ?? 0) * Math.PI) / 180
    const [px, , pz] = config.position
    const w = (lx: number, ly: number, lz: number): [number, number, number] => [px + lx * Math.cos(rot) + lz * Math.sin(rot), ly, pz - lx * Math.sin(rot) + lz * Math.cos(rot)]
    const from = w(0, CENTRE_Y + 1.7, 1.9)
    const d = Math.hypot(1.7, 1.9)
    return registerSpot({ position: from, target: w(0, CENTRE_Y, 0), intensity: LIGHTING.track.artworkIntensity * 1.1 * (d / 2.2) ** 2, angle: Math.atan((size * 0.62) / d), penumbra: 0.55, color: TRACK_COLOR, tag: 'tool-mandala' })
  }, [config.position, config.rotationDeg, size])
  const spin = sp.mode === 'full' && sp.caps.spin && spinSec > 0
  useFrame((_, dt) => {
    if (!spin) return
    const w = ((Math.PI * 2) / spinSec) * Math.min(dt, 0.1)
    u.uRingRot.value.x += w
    u.uRingRot.value.y -= w
    u.uRingRot.value.z += w * 0.5
  })
  const select = useMuseum((s) => s.select)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    select({ kind: 'object', id: config.id })
    focusOn('object', config.id)
  }
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    document.body.style.cursor = ''
  }
  return (
    <group name="tool-mandala">
      {(['clay', 'wood', 'iron'] as Mat[]).map((k) =>
        geos[k] ? <mesh key={k} geometry={geos[k]!} material={mats[k]} castShadow receiveShadow onClick={onClick} onPointerOver={over} onPointerOut={out} /> : null,
      )}
    </group>
  )
}
