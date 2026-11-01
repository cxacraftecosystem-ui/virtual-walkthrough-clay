/**
 * 'archive-cabinet' — the Kothi Library's archive cabinet (F25): a low clay-plastered chest of
 * shallow drawers (cols × rows), walnut fronts with brass cup pulls and card frames, on a
 * recessed plinth under a stone top.
 *
 * Each time the cabinet is clicked (selected), the next drawer slides out — lit from inside, a
 * sherd lying on felt in it — and the one before slides home; walking away closes it. Drawer
 * contents come from `props.drawers` ("id|title|objectId" per line). While the object is a
 * placeholder, or a drawer has no line, the sherd is a plain unglazed piece with a blank card:
 * nothing is named until the workshop catalogues it. Still form: drawers open without sliding.
 *
 * Local space: origin at floor centre, front (+z) towards the room, width along x.
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { proximity } from '../interaction/proximity'
import { useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { box, Builder, cyl, lathe, Parts, rbox, useBuilt } from './kit'
import { toWorld } from './amenityLights'
import { InMuseumScene } from './sceneContext'
import { useModelMaterials } from './modelMaterials'
import { fp, geoKey, num, str, type ModelProps } from './types'

const PLINTH = 0.09
const TOP = 0.04
/** How far an open drawer slides out (m). */
const TRAVEL = 0.26

export interface ArchiveDrawer {
  id: string
  title: string
  objectId: string
}

export function parseDrawers(s: string): ArchiveDrawer[] {
  return s
    .split('\n')
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p[0])
    .map(([id, title = '', objectId = '']) => ({ id, title, objectId }))
}

/** A curved sherd: a slice of a thrown wall with its broken edges. */
function sherdGeometry() {
  const prof: [number, number][] = [
    [0.12, 0],
    [0.128, 0.03],
    [0.13, 0.06],
    [0.118, 0.06],
    [0.116, 0.03],
    [0.108, 0],
  ]
  const g = lathe(prof, 10, 0.75)
  g.rotateZ(Math.PI / 2)
  g.translate(0.03, -0.11, 0)
  return g
}

export function ArchiveCabinet({ config }: ModelProps) {
  const m = useModelMaterials()
  const inScene = useContext(InMuseumScene)
  const sp = useSpectacle()
  const [W, D] = fp(config, [1.6, 0.38])
  const H = config.height ?? 1.32
  const cols = Math.max(1, Math.round(num(config, 'cols', 4)))
  const rows = Math.max(1, Math.round(num(config, 'rows', 3)))
  // catalogued drawers carry a written card; the rest stay blank
  const drawers = useMemo(() => (config.placeholder ? [] : parseDrawers(str(config, 'drawers', ''))), [config])
  const written = drawers.length
  const gap = 0.012
  const dw = (W - 0.08 - gap * (cols - 1)) / cols
  const bodyH = H - PLINTH - TOP
  const dh = (bodyH - 0.06 - gap * (rows - 1)) / rows
  const cell = (i: number) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    return { x: -W / 2 + 0.04 + dw / 2 + c * (dw + gap), y: PLINTH + 0.03 + dh / 2 + (rows - 1 - r) * (dh + gap) }
  }

  const parts = useBuilt(geoKey('archive-cabinet', config), () => {
    const b = new Builder()
    b.add('shadow', box(W - 0.06, PLINTH, D - 0.06), { p: [0, PLINTH / 2, -0.01] })
    // the clay carcass: back, sides, the rails between the drawers
    b.add('clay', rbox(W, bodyH, D - 0.02, 0.012, 2, 'y'), { p: [0, PLINTH + bodyH / 2, -0.01] })
    b.add('stone', rbox(W + 0.03, TOP, D + 0.02, 0.006, 2, 'x'), { p: [0, H - TOP / 2, 0] })
    // closed drawer fronts, flush with a 6 mm shadow line round each
    for (let i = 0; i < cols * rows; i++) {
      const { x, y } = cell(i)
      b.add('walnut', rbox(dw, dh, 0.022, 0.003, 2, 'x'), { p: [x, y, D / 2 - 0.02 + 0.011] })
      b.add('brass', cyl(0.018, 0.022, 0.016, 16).rotateX(Math.PI / 2), { p: [x, y - dh * 0.15, D / 2 + 0.008] })
      b.add('card', box(dw * 0.36, dh * 0.22, 0.002), { p: [x, y + dh * 0.2, D / 2 + 0.002] })
      b.add('brass', box(dw * 0.4, 0.004, 0.004), { p: [x, y + dh * 0.2 - dh * 0.13, D / 2 + 0.003] })
    }
    return b
  })
  const clayMat = useMemo(() => (m.terracotta as THREE.MeshStandardMaterial).clone(), [m.terracotta])
  useEffect(() => {
    clayMat.color.set('#c8a48a')
    clayMat.roughness = 0.95
  }, [clayMat])
  useEffect(() => () => clayMat.dispose(), [clayMat])
  const cardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: written ? '#efe4cc' : '#e9dcc0', roughness: 0.95 }), [written])
  useEffect(() => () => cardMat.dispose(), [cardMat])

  // the open drawer: a tray with felt, a warm light strip under its front edge, and a sherd
  const tray = useMemo(() => {
    const b = new Builder()
    const depth = D - 0.06
    b.add('walnut', rbox(dw, dh, 0.022, 0.003, 2, 'x'), { p: [0, 0, depth / 2 + 0.011] })
    b.add('walnut', box(dw - 0.02, 0.012, depth), { p: [0, -dh / 2 + 0.012, 0] })
    for (const sx of [-1, 1]) b.add('walnut', box(0.012, dh * 0.6, depth), { p: [sx * (dw / 2 - 0.016), -dh * 0.2 + 0.006, 0] })
    b.add('felt', box(dw - 0.05, 0.004, depth - 0.03), { p: [0, -dh / 2 + 0.02, 0] })
    b.add('brass', cyl(0.018, 0.022, 0.016, 16).rotateX(Math.PI / 2), { p: [0, -dh * 0.15, depth / 2 + 0.03] })
    b.add('card', box(dw * 0.36, dh * 0.22, 0.002), { p: [0, dh * 0.2, depth / 2 + 0.023] })
    return b.build()
  }, [D, dw, dh])
  useEffect(() => () => tray.forEach((p) => p.geometry.dispose()), [tray])
  const sherd = useMemo(sherdGeometry, [])
  useEffect(() => () => sherd.dispose(), [sherd])
  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1d8', emissive: new THREE.Color('#ffcf90'), emissiveIntensity: 0, roughness: 0.6 }), [])
  useEffect(() => () => glowMat.dispose(), [glowMat])
  const feltMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f3a35', roughness: 1, emissive: new THREE.Color('#ffcf90'), emissiveIntensity: 0 }), [])
  useEffect(() => () => feltMat.dispose(), [feltMat])

  // which drawer is open, and how far
  const state = useRef({ open: -1, out: 0, next: 0 })
  const trayRef = useRef<THREE.Group>(null)
  const recessRef = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (!inScene) return
    return useMuseum.subscribe((s, prev) => {
      const sel = s.selection
      if (sel && sel.kind === 'object' && sel.id === config.id && sel !== prev.selection) {
        const st = state.current
        st.open = st.next % (cols * rows)
        st.next = st.open + 1
        st.out = sp.mode === 'still' ? 1 : 0
      }
    })
  }, [inScene, config.id, cols, rows, sp.mode])

  useFrame((_, dt) => {
    const g = trayRef.current
    if (!g) return
    const st = state.current
    // walking away closes it
    const [wx, , wz] = toWorld(config, [0, 0, 0])
    if (st.open >= 0 && proximity(wx, wz, 3, 4.5) === 0) st.open = -1
    const target = st.open >= 0 ? 1 : 0
    if (sp.mode === 'still') st.out = target
    else st.out += (target - st.out) * (1 - Math.exp(-dt * 6))
    g.visible = st.out > 0.002 && st.open >= 0
    if (st.open >= 0) {
      const { x, y } = cell(st.open)
      // the tray's front starts a hair proud of the closed fronts and slides out from there
      g.position.set(x, y, 0.012 + TRAVEL * st.out)
      const r = recessRef.current
      if (r) {
        r.visible = g.visible
        r.position.set(x, y, D / 2 + 0.0025)
      }
    }
    glowMat.emissiveIntensity = 1.6 * st.out
    feltMat.emissiveIntensity = 0.05 * st.out
  })

  return (
    <group>
      <Parts parts={parts} materials={{ clay: clayMat, stone: m.counterStone, walnut: m.walnut, brass: m.brass, card: cardMat, shadow: m.shadowGap }} />
      <group ref={trayRef} visible={false}>
        <Parts parts={tray} materials={{ walnut: m.walnut, felt: feltMat, brass: m.brass, card: cardMat }} castShadow={false} />
        {/* the lit edge inside the tray front, and the sherd on the felt */}
        <mesh position={[0, -dh / 2 + 0.03, (D - 0.06) / 2 - 0.006]} material={glowMat} raycast={() => null}>
          <boxGeometry args={[dw - 0.05, 0.008, 0.006]} />
        </mesh>
        <mesh geometry={sherd} position={[0, -dh / 2 + 0.024, 0]} rotation={[0, 0.5, 0]} material={m.terracotta} raycast={() => null} />
      </group>
      {/* the dark opening where the drawer came out */}
      <mesh ref={recessRef} visible={false} material={m.shadowGap} raycast={() => null}>
        <planeGeometry args={[dw, dh]} />
      </mesh>
    </group>
  )
}
