/**
 * 'soil-archive' — the Kothi Library's soil archive (F25): a dark timber rack of small glass
 * jars (cols × rows) standing in front of a warm light panel, so each jar of earth reads as a
 * silhouette with a glowing rim — a wall of clay tones from pale kaolin to black.
 *
 * The jars' colours run as a gradient across the rack (`props.palette`: hex colours, one per line
 * or comma-separated, otherwise the clay tones below). They are samples-to-be: no label, place
 * or name is shown while the object is a placeholder.
 *
 * Draw calls: rack, light panel, soil fills (instanced), glass (instanced), lids (instanced).
 * Local space: origin at floor centre, front (+z) towards the room.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ambience } from '../lighting/timeOfDayState'
import { box, Builder, Parts, rbox, rng, useBuilt } from './kit'
import { useModelMaterials } from './modelMaterials'
import { fp, geoKey, num, str, type ModelProps } from './types'

/** Clay tones, pale to dark: kaolin, buff, ochre, laterite, red, umber, black cotton soil. */
const CLAY_TONES = ['#e9e1d3', '#d9c3a0', '#c99a5b', '#b36a3a', '#9a4630', '#6e4a35', '#3a302a']

function parsePalette(s: string): string[] {
  const list = s
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => /^#?[0-9a-f]{6}$/i.test(t))
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
  return list.length >= 2 ? list : CLAY_TONES
}

export function SoilArchive({ config }: ModelProps) {
  const m = useModelMaterials()
  const [W, D] = fp(config, [1.86, 0.34])
  const H = config.height ?? 2.35
  const cols = Math.max(1, Math.round(num(config, 'cols', 12)))
  const rows = Math.max(1, Math.round(num(config, 'rows', 5)))
  const palette = useMemo(() => parsePalette(str(config, 'palette', '')), [config])
  const y0 = 0.42
  const pitch = (H - y0 - 0.16) / rows
  const cw = (W - 0.08) / cols
  const jarR = Math.min(cw * 0.36, 0.06)
  const jarH = Math.min(pitch * 0.62, 0.22)

  const parts = useBuilt(geoKey('soil-archive', config), () => {
    const b = new Builder()
    const t = 0.03
    b.add('shadow', box(W - 0.04, y0 - 0.02, D - 0.04), { p: [0, (y0 - 0.02) / 2, 0] })
    for (const sx of [-1, 1]) b.add('walnut', rbox(t, H, D, 0.004, 2, 'y'), { p: [sx * (W / 2 - t / 2), H / 2, 0] })
    b.add('walnut', rbox(W, 0.05, D, 0.005, 2, 'x'), { p: [0, H - 0.025, 0] })
    for (let r = 0; r <= rows; r++) b.add('walnut', rbox(W - 2 * t, 0.022, D - 0.04, 0.003, 2, 'x'), { p: [0, y0 - 0.011 + r * pitch, 0.01] })
    // slim mullions every two columns
    for (let c = 2; c < cols; c += 2) b.add('walnut', box(0.012, H - y0 - 0.06, 0.02), { p: [-W / 2 + 0.04 + c * cw, y0 + (H - y0 - 0.06) / 2, D / 2 - 0.03] })
    return b
  })

  // the light panel behind the jars (it glows more as the room darkens)
  const panelMat = useMemo(() => new THREE.MeshStandardMaterial({ name: 'soilLight', color: '#f3e3c8', emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 0.9, roughness: 0.9 }), [])
  useEffect(() => () => panelMat.dispose(), [panelMat])
  useFrame(() => {
    panelMat.emissiveIntensity = 0.8 + 0.5 * ambience.night
  })

  const geos = useMemo(() => {
    const fill = new THREE.CylinderGeometry(jarR * 0.94, jarR * 0.94, jarH * 0.78, 18)
    fill.translate(0, (jarH * 0.78) / 2 + 0.004, 0)
    const glass = new THREE.CylinderGeometry(jarR, jarR, jarH, 18, 1, true)
    glass.translate(0, jarH / 2, 0)
    const lid = new THREE.CylinderGeometry(jarR * 1.04, jarR * 1.04, 0.022, 18)
    lid.translate(0, jarH + 0.011, 0)
    return { fill, glass, lid }
  }, [jarR, jarH])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])
  const fillMat = useMemo(() => {
    const f = (m.soil as THREE.MeshStandardMaterial).clone()
    f.color.set('#ffffff')
    return f
  }, [m.soil])
  useEffect(() => () => fillMat.dispose(), [fillMat])
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8f0ee', transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }), [])
  useEffect(() => () => glassMat.dispose(), [glassMat])

  const n = cols * rows
  const refs = { fill: useRef<THREE.InstancedMesh>(null), glass: useRef<THREE.InstancedMesh>(null), lid: useRef<THREE.InstancedMesh>(null) }
  useLayoutEffect(() => {
    const r = rng(17)
    const mx = new THREE.Matrix4()
    const c = new THREE.Color()
    const a = new THREE.Color()
    const bcol = new THREE.Color()
    let i = 0
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const x = -W / 2 + 0.04 + cw * (col + 0.5)
        const y = y0 + row * pitch
        const z = 0.02 + (r() - 0.5) * 0.02
        mx.makeTranslation(x, y, z)
        for (const k of ['fill', 'glass', 'lid'] as const) refs[k].current?.setMatrixAt(i, mx)
        // gradient across the columns, a little drift by row
        const t = Math.min(0.999, Math.max(0, (col + row * 0.35 + (r() - 0.5) * 0.6) / (cols - 1 + rows * 0.35)))
        const f = t * (palette.length - 1)
        a.set(palette[Math.floor(f)])
        bcol.set(palette[Math.min(palette.length - 1, Math.floor(f) + 1)])
        c.copy(a).lerp(bcol, f - Math.floor(f))
        c.offsetHSL(0, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05)
        refs.fill.current?.setColorAt(i, c)
        i++
      }
    for (const k of ['fill', 'glass', 'lid'] as const) {
      const im = refs[k].current
      if (!im) continue
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      im.computeBoundingSphere()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [rows, cols, W, cw, pitch, palette])

  return (
    <group>
      <Parts parts={parts} materials={{ walnut: m.darkTimber, shadow: m.shadowGap }} />
      <mesh position={[0, y0 + (H - y0 - 0.06) / 2, -D / 2 + 0.03]} material={panelMat} raycast={() => null}>
        <boxGeometry args={[W - 0.06, H - y0 - 0.06, 0.02]} />
      </mesh>
      <instancedMesh ref={refs.fill} args={[geos.fill, fillMat, n]} castShadow={false} receiveShadow raycast={() => null} />
      <instancedMesh ref={refs.lid} args={[geos.lid, m.brass, n]} castShadow={false} raycast={() => null} />
      <instancedMesh ref={refs.glass} args={[geos.glass, glassMat, n]} castShadow={false} raycast={() => null} renderOrder={2} />
    </group>
  )
}
