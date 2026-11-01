/**
 * 'compass-mandala' — the Clay Atlas's dik-mandala (F23): a compass of the eight directions
 * inlaid in the floor, ink on lime, with a brass needle that swings and settles on true north
 * (−z) the first time the visitor comes in. A floor decal: it never takes a click, so the
 * floor under it still walks.
 *
 *   rings ...... a lotus of 16 petals round a ring of 32 ticks, the cardinal rays long, the
 *                ordinal rays short, a small brass boss at the centre
 *   needle ..... a slim brass lozenge, its north point darkened (ink); Still form: it rests on
 *                north from the start
 *
 * Props: r (m), ink (colour). Local space: origin at the compass centre on the floor; the drawing
 * is fixed to the world (north is −z whatever the object's rotation).
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useCue } from '../spectacle/cues'
import { useSpectacle } from '../spectacle/settings'
import { useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

const texCache = new Map<string, THREE.CanvasTexture>()

/** The inlay (colour) as a canvas texture, north at the top (−z). */
function compassTexture(px: number, ink: string): THREE.CanvasTexture {
  const key = `${px}|${ink}`
  const hit = texCache.get(key)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = cv.height = px
  const ctx = cv.getContext('2d')!
  const c = px / 2
  const R = px / 2
  ctx.clearRect(0, 0, px, px)
  // lime disc, a faint mottle
  ctx.fillStyle = '#e6dccb'
  ctx.beginPath()
  ctx.arc(c, c, R * 0.995, 0, Math.PI * 2)
  ctx.fill()
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * R * 0.95
    const g = ctx.createRadialGradient(c + Math.cos(a) * d, c + Math.sin(a) * d, 0, c + Math.cos(a) * d, c + Math.sin(a) * d, R * 0.12)
    g.addColorStop(0, `rgba(120,90,60,${0.02 + rnd() * 0.03})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, px, px)
  }
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  const ring = (r: number, w: number) => {
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ring(R * 0.97, px * 0.006)
  ring(R * 0.93, px * 0.002)
  // 32 ticks between the outer rings, every fourth long
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const r0 = R * (i % 8 === 0 ? 0.86 : i % 2 === 0 ? 0.89 : 0.91)
    ctx.lineWidth = px * (i % 8 === 0 ? 0.004 : 0.002)
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0)
    ctx.lineTo(c + Math.cos(a) * R * 0.93, c + Math.sin(a) * R * 0.93)
    ctx.stroke()
  }
  // lotus of sixteen petals
  ring(R * 0.62, px * 0.003)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(R * 0.62, 0)
    ctx.quadraticCurveTo(R * 0.71, -R * 0.085, R * 0.8, 0)
    ctx.quadraticCurveTo(R * 0.71, R * 0.085, R * 0.62, 0)
    ctx.lineWidth = px * 0.003
    ctx.stroke()
    ctx.restore()
  }
  // the eight rays: cardinal long and filled on one half (a lit / shaded star), ordinal short
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const len = i % 2 === 0 ? R * 0.84 : R * 0.5
    const w = i % 2 === 0 ? R * 0.1 : R * 0.07
    const tip = [c + Math.cos(a) * len, c + Math.sin(a) * len]
    const l = [c + Math.cos(a - Math.PI / 2) * w, c + Math.sin(a - Math.PI / 2) * w]
    const r = [c + Math.cos(a + Math.PI / 2) * w, c + Math.sin(a + Math.PI / 2) * w]
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.lineTo(l[0], l[1])
    ctx.lineTo(tip[0], tip[1])
    ctx.closePath()
    ctx.globalAlpha = i % 2 === 0 ? 0.92 : 0.55
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.moveTo(l[0], l[1])
    ctx.lineTo(tip[0], tip[1])
    ctx.lineTo(r[0], r[1])
    ctx.closePath()
    ctx.lineWidth = px * 0.003
    ctx.stroke()
  }
  ring(R * 0.16, px * 0.004)
  ring(R * 0.12, px * 0.002)
  // a small chevron beyond the north ray (the only mark: no lettering)
  ctx.beginPath()
  ctx.moveTo(c, c - R * 0.955)
  ctx.lineTo(c - R * 0.035, c - R * 0.885)
  ctx.lineTo(c + R * 0.035, c - R * 0.885)
  ctx.closePath()
  ctx.fill()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  texCache.set(key, t)
  return t
}

/** A slim lozenge needle along local −z (north), flat on the floor. */
function needleGeometry(len: number) {
  const s = new THREE.Shape()
  const w = len * 0.06
  s.moveTo(0, len / 2)
  s.lineTo(w, 0)
  s.lineTo(0, -len / 2)
  s.lineTo(-w, 0)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 })
  // shape +y → world −z (north); extrude depth → +y (up)
  g.rotateX(-Math.PI / 2)
  return g
}

export function CompassMandala({ config }: ModelProps) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const r = Math.max(0.3, num(config, 'r', 1.3))
  const ink = str(config, 'ink', '#7a2a22')
  const px = sp.caps.spectacleTexPx
  const tex = useMemo(() => compassTexture(Math.min(1024, px), ink), [px, ink])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ name: 'compassInlay', map: tex, transparent: true, roughness: 0.55, metalness: 0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }),
    [tex],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const needle = useMemo(() => needleGeometry(r * 1.05), [r])
  useEffect(() => () => needle.dispose(), [needle])
  // the decal is fixed to the world: undo the object's own rotation
  const rot = -((config.rotationDeg ?? 0) * Math.PI) / 180

  // the needle swings from where it lay and settles on north (a damped spring)
  const nref = useRef<THREE.Group>(null)
  const st = useRef({ a: 1.9, v: 0 })
  useCue('zone-first:atlas', () => {
    st.current.a = 2.4
    st.current.v = 0
  })
  useFrame((_, dt) => {
    const g = nref.current
    if (!g) return
    const s = st.current
    if (sp.mode === 'still') s.a = 0
    else {
      const k = 6
      const d = 1.1
      s.v += (-k * s.a - d * s.v) * Math.min(dt, 0.05)
      s.a += s.v * Math.min(dt, 0.05)
    }
    g.rotation.y = rot + s.a
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, rot]} position={[0, 0.002, 0]} material={mat} raycast={() => null} receiveShadow renderOrder={1}>
        <circleGeometry args={[r, 96]} />
      </mesh>
      <group ref={nref} position={[0, 0.004, 0]}>
        <mesh geometry={needle} material={m.brass} raycast={() => null} castShadow />
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.brass} raycast={() => null}>
          <circleGeometry args={[r * 0.07, 32]} />
        </mesh>
      </group>
    </group>
  )
}
