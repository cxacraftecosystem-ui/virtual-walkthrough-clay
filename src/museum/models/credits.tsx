/**
 * Credits / partners wall panel ('credits-panel'), in two layouts (props.layout):
 *
 *   'credits'   (default) a pale limestone panel with brass fillets, mounted on the reception
 *               panelling, carrying a generic kicker ("Presented by" / "In collaboration with")
 *               and a partner logo (PNG, or SVG rasterised at panel resolution), with its own soft
 *               pooled wash light
 *   'partners'  the Clay Atlas's partners band beside the map of India (SPECTACLE F23, CONTRACT
 *               §8): both partners on one tall neutral light ground (#f4f1ea), top to bottom
 *               "Presented by" · the DC Handicrafts logo, then "In collaboration with" · the IIT
 *               Kharagpur logo, in a terracotta surround like the map's. The logos are shown as
 *               they stand: each on its own quad at the file's exact aspect (642:240 and
 *               268:300), unlit and untone-mapped (MeshBasicMaterial, colour 1,1,1 — no tint,
 *               filter, crop or texture over them), with at least 0.08 m clear round each. The
 *               ground is unlit too, so the panel reads evenly whatever the room's colour of
 *               light; one neutral (4000 K, exempt from the colour choreography) SpotPool request
 *               lights the surround.
 *
 * Origin on the wall face, front +z.
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../config/lighting'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMuseum } from '../state/store'
import { isWebGPU } from '../utils/renderer'
import { translate, useLang, type DictKey } from '../i18n'
import { registerSpot } from '../lighting/SpotPool'
import { segmentBlocked } from '../navigation/collision'
import { ensureWallFonts } from '../materials/wallGraphics'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { creditsTexture } from './amenityTextures'
import { toWorld, useLocalSpots } from './amenityLights'
import { box, Builder, Parts, rbox, useBuilt } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { InMuseumScene } from './sceneContext'
import { geoKey, num, str, type ModelProps } from './types'

export function CreditsPanel({ config }: ModelProps) {
  return str(config, 'layout', 'credits') === 'partners' ? <PartnersPanel config={config} /> : <LimestoneCredits config={config} />
}

function LimestoneCredits({ config }: ModelProps) {
  const m = useModelMaterials()
  const w = num(config, 'width', 2.3)
  const h = num(config, 'panelHeight', 1.5)
  const cy = num(config, 'center', 1.75)
  const kicker = str(config, 'kicker', 'Presented by')
  const logo = str(config, 'logo', '/brand/dc-handicrafts.png')
  const tex = useAsyncTexture(() => creditsTexture(kicker, logo, w, h), [kicker, logo, w, h])
  const parts = useBuilt(geoKey('credits-panel', config), () => {
    const b = new Builder()
    const f = 0.018
    // shadow reveal behind the slab, the slab, brass fillet frame
    b.add('shadow', box(w + 0.02, h + 0.02, 0.004), { p: [0, cy, 0.002] })
    b.add('stone', rbox(w, h, 0.03, 0.004, 2, 'x'), { p: [0, cy, 0.019] })
    b.add('brass', box(w + 2 * f, f, 0.012), { p: [0, cy + h / 2 + f / 2, 0.028] })
    b.add('brass', box(w + 2 * f, f, 0.012), { p: [0, cy - h / 2 - f / 2, 0.028] })
    b.add('brass', box(f, h, 0.012), { p: [-w / 2 - f / 2, cy, 0.028] })
    b.add('brass', box(f, h, 0.012), { p: [w / 2 + f / 2, cy, 0.028] })
    return b
  })
  useLocalSpots(config, [{ from: [0, 3.7, 1.2], to: [0, cy, 0], intensity: 14, angle: 0.55, penumbra: 0.95 }])
  return (
    <group>
      <Parts parts={parts} materials={{ stone: m.counterStone, brass: m.brass, shadow: m.shadowGap }} />
      {tex && (
        <mesh position={[0, cy, 0.0345]} raycast={() => null}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex} roughness={0.55} envMapIntensity={0.7} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Showing the logos as they stand through post-processing             */
/* ------------------------------------------------------------------ */

/**
 * Where the tier post-processes (effects/PostFX.tsx), the whole frame is tone mapped and graded
 * after the scene is drawn, so `toneMapped: false` alone does not keep the partner logos as they
 * stand (PBR Neutral cannot even reproduce a saturated yellow at the logos' brightness). The band's
 * ground and logos are therefore drawn a second time straight onto the finished frame, unlit and
 * untouched, right after the post-processing (frame priority 2) — whenever the band is in view and
 * nothing stands between it and the eye (the walls are checked in plan; nothing else stands in
 * front of a wall panel). Otherwise the post-processed band in the scene is what is seen.
 */
function PartnersOverlay({ panel }: { panel: React.RefObject<THREE.Group | null> }) {
  const tier = useMuseum((s) => s.tier)
  const post = withDevOverrides(QUALITY_PRESETS[tier]).postprocessing && !isWebGPU()
  // a frame callback with a priority takes over rendering: only mount one where the composer renders
  return post ? <OverlayPass panel={panel} /> : null
}

function OverlayPass({ panel }: { panel: React.RefObject<THREE.Group | null> }) {
  const overlay = useMemo(() => new THREE.Scene(), [])
  const box = useMemo(() => new THREE.Box3(), [])
  const frustum = useMemo(() => new THREE.Frustum(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const corners = useMemo(() => Array.from({ length: 5 }, () => new THREE.Vector3()), [])
  useFrame(({ gl, camera }) => {
    const g = panel.current
    if (!g || !isVisibleDeep(g)) return
    // in view?
    box.setFromObject(g)
    frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    if (!frustum.intersectsBox(box)) return
    // nothing between: the eye to the band's corners and middle, in plan, against the walls
    // the band's two side edges (a little in) and its middle, at the face (not the box corners,
    // which reach back into the wall and the end wall beside it)
    g.updateWorldMatrix(true, false)
    const e = g.matrixWorld.elements
    const ox = e[12]
    const oz = e[14]
    const ux = e[0]
    const uz = e[2]
    const half = PANEL.w * 0.45
    corners[0].set(ox - ux * half, 0, oz - uz * half)
    corners[1].set(ox + ux * half, 0, oz + uz * half)
    corners[2].set(ox, 0, oz)
    corners[3].set(ox - ux * half * 0.5, 0, oz - uz * half * 0.5)
    corners[4].set(ox + ux * half * 0.5, 0, oz + uz * half * 0.5)
    const ex = camera.position.x
    const ez = camera.position.z
    for (const c of corners) {
      // stop 6 cm short of the face
      const dx = c.x - ex
      const dz = c.z - ez
      const l = Math.hypot(dx, dz)
      if (l > 0.1 && segmentBlocked(ex, ez, ex + dx * (1 - 0.06 / l), ez + dz * (1 - 0.06 / l), wallsOnly)) return
    }
    // the same quads, at the same place, drawn over the finished frame
    overlay.children.length = 0
    g.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !mesh.userData.partnerExact) return
      const twin = (mesh.userData.twin as THREE.Mesh | undefined) ?? (mesh.userData.twin = new THREE.Mesh(mesh.geometry, mesh.userData.partnerExact as THREE.Material))
      twin.matrixAutoUpdate = false
      twin.matrixWorld.copy(mesh.matrixWorld)
      twin.matrix.copy(mesh.matrixWorld)
      twin.renderOrder = mesh.renderOrder
      overlay.add(twin)
    })
    const auto = gl.autoClear
    gl.autoClear = false
    gl.setRenderTarget(null)
    gl.render(overlay, camera)
    gl.autoClear = auto
  }, 2)
  return null
}

/** Only the building stands between the eye and a wall panel (furniture footprints, the band's own included, do not). */
const wallsOnly = (c: { id: string }) => c.id.startsWith('object-') || c.id.startsWith('table-') || c.id.startsWith('podium-') || c.id.startsWith('bench')

function isVisibleDeep(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** The exact twin of a band material: unlit, untone-mapped, drawn over the frame without depth. */
function exactTwin(m: THREE.MeshBasicMaterial) {
  const t = m.clone()
  t.depthTest = false
  t.depthWrite = false
  t.polygonOffset = false
  return t
}

/* ------------------------------------------------------------------ */
/* Partners band (Clay Atlas)                                          */
/* ------------------------------------------------------------------ */

/** The partners as they stand: file, pixel size (aspect), display width (m), kicker, alt text (CONTRACT §8). */
export const PARTNER_LOGOS = [
  { src: '/brand/dc-handicrafts.png', px: [642, 240] as const, width: 1.4, kicker: 'partners.presented' as DictKey, alt: 'DC Handicrafts — Indian Handicrafts, continuing tradition' },
  { src: '/brand/iit-kharagpur.svg', px: [268, 300] as const, width: 0.66, kicker: 'partners.collab' as DictKey, alt: 'Indian Institute of Technology Kharagpur' },
] as const

/** The partners ground. */
export const PARTNERS_GROUND = '#f4f1ea'
/** GRAND §2.7: a 1.8 × 3.0 m neutral ground, the DC Handicrafts logo 1.4 m wide, IIT Kharagpur's 0.66 m. */
const PANEL = { w: 1.8, h: 3.0, bottom: 0.45 }
const KICKER_CAP = 0.06
const CLEAR = 0.12

/** Top-to-bottom layout in panel metres from the top edge: kicker baselines and logo boxes. */
function partnersLayout() {
  const items = PARTNER_LOGOS.map((l) => ({ ...l, height: (l.width * l.px[1]) / l.px[0] }))
  const gapBetween = 0.5
  const content = items.reduce((s, it) => s + KICKER_CAP + CLEAR + it.height, 0) + gapBetween
  let y = (PANEL.h - content) / 2
  const out = items.map((it, i) => {
    if (i > 0) y += gapBetween
    const kickerBase = y + KICKER_CAP
    const top = kickerBase + CLEAR
    y = top + it.height
    return { ...it, kickerBase, top }
  })
  return { items: out, dividerY: out[0].top + out[0].height + gapBetween / 2 }
}

async function partnersGround(lang: 'en' | 'hi' | 'bn'): Promise<THREE.CanvasTexture> {
  await ensureWallFonts()
  const s = 1400
  const cv = document.createElement('canvas')
  cv.width = Math.round(PANEL.w * s)
  cv.height = Math.round(PANEL.h * s)
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = PARTNERS_GROUND
  ctx.fillRect(0, 0, cv.width, cv.height)
  const L = partnersLayout()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6a5040'
  const sans = 'Inter, "Noto Sans Devanagari", "Noto Sans Bengali", "Helvetica Neue", Arial, sans-serif'
  for (const it of L.items) {
    const text = translate(lang, it.kicker)
    ctx.font = `600 ${Math.round(KICKER_CAP * 1.32 * s)}px ${sans}`
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = lang === 'en' ? `${Math.round(KICKER_CAP * 0.28 * s)}px` : '0px'
    ctx.fillText(lang === 'en' ? text.toUpperCase() : text, cv.width / 2, it.kickerBase * s)
  }
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'
  // a hairline between the two partners
  ctx.fillStyle = 'rgba(106,80,64,0.35)'
  ctx.fillRect(cv.width * 0.36, L.dividerY * s, cv.width * 0.28, Math.max(2, 0.0025 * s))
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/**
 * A logo file as a texture, unmodified: PNGs load as they are; SVGs are rasterised at 6× their
 * intrinsic size (sharp at reading distance) onto a transparent canvas, aspect untouched.
 */
function logoTexture(src: string, px: readonly [number, number]): Promise<THREE.Texture> {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      let t: THREE.Texture
      if (src.endsWith('.svg')) {
        const k = 6
        const cv = document.createElement('canvas')
        cv.width = px[0] * k
        cv.height = px[1] * k
        cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
        t = new THREE.CanvasTexture(cv)
      } else {
        t = new THREE.Texture(img)
      }
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      // premultiplied, so the mipmaps never bleed the transparent pixels' colour into the edges
      t.premultiplyAlpha = true
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.needsUpdate = true
      resolve(t)
    }
    img.onerror = () => reject(new Error(`logo ${src} failed to load`))
    img.src = src
  })
}

function PartnerLogo({ src, px, width, y }: { src: string; px: readonly [number, number]; width: number; y: number }) {
  const tex = useAsyncTexture(() => logoTexture(src, px), [src])
  const mat = useMemo(() => (tex ? new THREE.MeshBasicMaterial({ name: 'partnerLogo', map: tex, color: new THREE.Color(1, 1, 1), transparent: true, premultipliedAlpha: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) : null), [tex])
  const exact = useMemo(() => (mat ? exactTwin(mat) : null), [mat])
  useEffect(
    () => () => {
      mat?.dispose()
      exact?.dispose()
    },
    [mat, exact],
  )
  if (!mat) return null
  const h = (width * px[1]) / px[0]
  return (
    <mesh position={[0, y, 0.0005]} material={mat} raycast={() => null} renderOrder={2} userData={{ partnerLogo: src, partnerExact: exact }}>
      <planeGeometry args={[width, h]} />
    </mesh>
  )
}

function PartnersPanel({ config }: ModelProps) {
  const m = useModelMaterials()
  const inScene = useContext(InMuseumScene)
  const lang = useLang()
  const ground = useAsyncTexture(() => partnersGround(lang), [lang])
  const groundMat = useMemo(() => (ground ? new THREE.MeshBasicMaterial({ name: 'partnersGround', map: ground, toneMapped: false }) : null), [ground])
  const groundExact = useMemo(() => (groundMat ? exactTwin(groundMat) : null), [groundMat])
  useEffect(
    () => () => {
      groundMat?.dispose()
      groundExact?.dispose()
    },
    [groundMat, groundExact],
  )
  const band = useRef<THREE.Group>(null)
  const L = useMemo(partnersLayout, [])
  const cy = PANEL.bottom + PANEL.h / 2
  const z = 0.05
  const surround = useMemo(() => tinted(m.terracottaPlaster, '#a65a3f', { roughness: 0.92 }), [m.terracottaPlaster])
  const parts = useBuilt('credits-panel|partners', () => {
    const b = new Builder()
    const f = 0.045
    const depth = 0.24
    // a terracotta frame returning to the wall behind (the wall curves away), a slim brass fillet
    b.add('surround', rbox(PANEL.w + 2 * (f + 0.006), PANEL.h + 2 * (f + 0.006), depth, 0.01, 2, 'x'), { p: [0, cy, z - depth / 2 - 0.006] })
    // the frame stands 6 mm off the ground's edge, so a brass line shows between them
    const o = 0.006
    b.add('frame', rbox(PANEL.w + 2 * (f + o), f, 0.03, 0.004, 2, 'x'), { p: [0, cy + PANEL.h / 2 + o + f / 2, z + 0.004] })
    b.add('frame', rbox(PANEL.w + 2 * (f + o), f, 0.03, 0.004, 2, 'x'), { p: [0, cy - PANEL.h / 2 - o - f / 2, z + 0.004] })
    for (const sx of [-1, 1]) b.add('frame', rbox(f, PANEL.h + 2 * o, 0.03, 0.004, 2, 'y'), { p: [sx * (PANEL.w / 2 + o + f / 2), cy, z + 0.004] })
    b.add('brass', box(PANEL.w + 2 * o + 0.004, PANEL.h + 2 * o + 0.004, 0.004), { p: [0, cy, z - 0.004] })
    return b
  })

  // one neutral light on the band (exempt from the colour choreography)
  useEffect(() => {
    if (!inScene) return
    return registerSpot({
      position: toWorld(config, [0, 3.7, 1.5]),
      target: toWorld(config, [0, cy, 0]),
      intensity: 13,
      angle: 0.42,
      penumbra: 0.9,
      color: kelvinToHex(4000),
      neutral: true,
      tag: `partners:${config.id}`,
    })
  }, [inScene, config, cy])

  return (
    <group>
      {inScene && <PartnersOverlay panel={band} />}
      <Parts parts={parts} materials={{ surround, frame: m.terracotta, brass: m.brass }} />
      <group position={[0, cy, z]} ref={band}>
        {groundMat && (
          <mesh material={groundMat} raycast={() => null} userData={{ partnerExact: groundExact }}>
            <planeGeometry args={[PANEL.w, PANEL.h]} />
          </mesh>
        )}
        {L.items.map((it) => (
          <PartnerLogo key={it.src} src={it.src} px={it.px} width={it.width} y={PANEL.h / 2 - it.top - it.height / 2} />
        ))}
      </group>
    </group>
  )
}
