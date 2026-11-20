/**
 * The workshop team's pieces (config/objects.ts TEAM_PIECES): textured GLBs in public/models/team/
 * (scripts/import-team-models.mjs keeps every triangle and every texture byte).
 *
 *   TeamPiece         the 'team-piece' kind: a soft clay silhouette of the piece's size, seen only while
 *                     its GLB loads or if it fails
 *   PlaqueStand       the low slotted brass base a flat piece stands upright in (`props.stand: 'slot'`)
 *   TeamModelPreload  loads every team GLB the content names — geometry and all textures — with byte
 *                     progress, uploads the textures to the GPU (renderer.initTexture) and then settles;
 *                     the entry screen (ui/EntryScreen.tsx) and the shader warm-up (effects/Precompile.tsx)
 *                     wait for that, so no piece of the workshop's ever pops in after Enter. A failed file
 *                     is logged and its piece keeps its silhouette; a stalled download (no progress for
 *                     STALL_MS) or a very slow one (HARD_MS) stops holding the door, never blocking entry
 *
 * GPU memory: a 4096² texture is ~85 MB on the GPU with its mipmaps; the sixteen pieces carry four of those,
 * about 608 MB of textures in all. On the Low tier (phones) each decoded image is resized to the tier's texture
 * size (config/quality.ts `textureSize`, 512 px: ~64 MB for all sixteen) before it is uploaded; the files stay
 * as shipped, and every other tier uploads them untouched.
 */
import { useLoader, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib'
import { SCENE_OBJECTS, TEAM_MODEL_DIR } from '../config/objects'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMuseum } from '../state/store'
import { ErrorBoundary } from '../utils/ErrorBoundary'
import { rbox, Builder, Parts, useBuilt } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { fp, geoKey, type ModelProps } from './types'

/** Is `url` one of the workshop team's GLBs? (They are preloaded, so they never wait for zone streaming.) */
export const isTeamModel = (url: string | undefined): url is string => !!url && url.startsWith(TEAM_MODEL_DIR)

/* ------------------------------------------------------------------ */
/* The kind: a silhouette while loading                                */
/* ------------------------------------------------------------------ */

/** A flat piece's silhouette is a slab this thick, not its stand's depth. */
const FLAT = 0.025

export function TeamPiece({ config }: ModelProps) {
  const m = useModelMaterials()
  const h = config.height ?? 0.3
  const [w, d0] = fp(config, [h * 0.6, h * 0.6])
  const d = config.props?.stand === 'slot' ? FLAT : d0
  const parts = useBuilt(geoKey('team-piece', config), () => new Builder().add('mass', rbox(w * 0.9, h, d * 0.9, Math.min(0.02, d * 0.3)), { p: [0, h / 2, 0] }))
  return <Parts parts={parts} materials={{ mass: tinted(m.terracotta, '#a98a72', { roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }) }} castShadow={false} />
}

/* ------------------------------------------------------------------ */
/* The slotted stand                                                   */
/* ------------------------------------------------------------------ */

/** The base: as wide as the piece plus a lip each side, STAND.depth deep, its top STAND.height over the podium. */
export const STAND = { lip: 0.015, depth: 0.07, height: 0.012 }

/**
 * A low brass base with a slot: the flat piece (a tile, a plaque, a bowl on its rim) stands upright in it, its
 * foot hidden by the base's lips, the way a museum shows a plate or a tile on a plinth.
 */
export function PlaqueStand({ config }: ModelProps) {
  const m = useModelMaterials()
  const w = fp(config, [0.2, STAND.depth])[0] + 2 * STAND.lip
  const parts = useBuilt(geoKey('plaque-stand', config), () => {
    const b = new Builder()
    const slot = 0.026
    const side = (STAND.depth - slot) / 2
    // two lips either side of the slot, and a thin floor under it
    for (const s of [-1, 1]) b.add('brass', rbox(w, STAND.height, side, 0.003), { p: [0, STAND.height / 2, s * (slot / 2 + side / 2)] })
    b.add('brass', rbox(w, 0.003, slot + 0.002, 0.001), { p: [0, 0.0015, 0] })
    return b
  })
  return <Parts parts={parts} materials={{ brass: m.brass }} />
}

/* ------------------------------------------------------------------ */
/* Preloading                                                          */
/* ------------------------------------------------------------------ */

/** No byte or file has arrived for this long: stop holding the entry for the rest. */
const STALL_MS = 30000
/** However it is going, the entry waits no longer than this for the team's pieces. */
const HARD_MS = 240000
/** The stall clock's tick. */
const TICK_MS = 500
/** The Low tier uploads the team's textures at most at its texture size (px, long edge). */
export const lowTierMax = () => withDevOverrides(QUALITY_PRESETS.low).textureSize

export interface TeamModelsState {
  /** GLBs to load (from the content's scene objects). */
  total: number
  /** Loaded with their textures on the GPU. */
  done: number
  /** Failed to load (their pieces keep the silhouette). */
  failed: number
  /** Bytes received / expected (0 until every file's size is known, from its download or a range request). */
  bytes: number
  bytesTotal: number
  /** Everything is done or failed, or the wait was given up (stall / hard limit): the entry may open. */
  settled: boolean
}

let state: TeamModelsState = { total: 0, done: 0, failed: 0, bytes: 0, bytesTotal: 0, settled: false }
let begun = false
const listeners = new Set<() => void>()
const progress = new Map<string, { loaded: number; total: number }>()
/** Each file's size from a one-byte range request: a compressed download reports no length of its own. */
const expected = new Map<string, number>()
const finished = new Set<string>()
let lastActivity = 0

function set(next: Partial<TeamModelsState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** The preload's state now (for loops outside React: the entry screen's check, Precompile's wait). */
export const teamModels = () => state
// automation handle (like window.__museum): screenshot scripts wait on it
if (typeof window !== 'undefined') (window as unknown as { __teamModels?: () => TeamModelsState }).__teamModels = teamModels
/** …and as a hook. */
export const useTeamModels = () => useSyncExternalStore(subscribe, teamModels, teamModels)

function teamUrls(): string[] {
  return [...new Set(SCENE_OBJECTS.map((o) => o.model).filter(isTeamModel))]
}

function begin(urls: string[]) {
  if (begun) return
  begun = true
  lastActivity = performance.now()
  set({ total: urls.length, settled: urls.length === 0 })
  if (!urls.length) return
  // sizes for the progress bar: a gzip / br download streams without a length, so ask for one byte of each
  // file (a range response is never compressed) and read the size from Content-Range; best effort
  for (const u of urls)
    // no-store: past the HTTP cache, which would hold this behind the file's own download (and answer 200)
    void fetch(u, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
      .then((r) => {
        const range = /\/(\d+)\s*$/.exec(r.headers.get('content-range') ?? '')
        // a server that ignores the range answers 200: its length counts only if the body is not compressed
        const n = range ? Number(range[1]) : r.status === 200 && !r.headers.get('content-encoding') ? Number(r.headers.get('content-length')) : 0
        if (r.ok && n > 0) expected.set(u, n)
        void r.body?.cancel()
        recount()
      })
      .catch(() => {})
  const start = performance.now()
  let lastTick = start
  let busy = 0
  const id = window.setInterval(() => {
    if (state.settled) return window.clearInterval(id)
    const now = performance.now()
    // a late tick means the page itself was busy (building the scene, decoding), not that the network stalled:
    // progress events could not be delivered meanwhile, so that time counts neither as a stall nor as waiting
    const gap = now - lastTick
    lastTick = now
    if (gap > TICK_MS * 4) {
      lastActivity += gap - TICK_MS
      busy += gap - TICK_MS
    }
    if (now - lastActivity > STALL_MS || now - start - busy > HARD_MS) {
      const waiting = urls.filter((u) => !finished.has(u))
      console.warn(`[museum] the workshop's pieces: stopped waiting for ${waiting.length} model(s) after ${((now - start) / 1000).toFixed(0)} s; they appear when they arrive:`, waiting)
      set({ settled: true })
      window.clearInterval(id)
    }
  }, TICK_MS)
}

function onProgress(url: string, e: ProgressEvent) {
  lastActivity = performance.now()
  progress.set(url, { loaded: e.loaded, total: e.lengthComputable ? e.total : 0 })
  recount()
}

function recount() {
  let bytes = 0
  for (const p of progress.values()) bytes += p.loaded
  // the total is known once every file's size is: from its range request (a compressed download's own length
  // is its compressed size, while the bytes counted are decoded ones), else from its download
  let bytesTotal = 0
  for (const u of teamUrls()) {
    const n = expected.get(u) || progress.get(u)?.total || 0
    if (!n) {
      bytesTotal = 0
      break
    }
    bytesTotal += n
  }
  set({ bytes, bytesTotal })
}

function finish(url: string, ok: boolean) {
  // a file already in the cache (a remount) can finish before the preloader's own effect has run
  begin(teamUrls())
  if (finished.has(url)) return
  finished.add(url)
  lastActivity = performance.now()
  const done = state.done + (ok ? 1 : 0)
  const failed = state.failed + (ok ? 0 : 1)
  set({ done, failed, settled: state.settled || done + failed >= state.total })
}

/** The textures of a loaded GLB's materials (each once). */
function texturesOf(scene: THREE.Object3D): THREE.Texture[] {
  const out = new Set<THREE.Texture>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) out.add(v)
    }
  })
  return [...out]
}

const capped = new Set<string>()

/**
 * Low tier only, once per file (decided by the tier it first loads on, so a desktop is never touched): each
 * texture's decoded image larger than the tier's texture size is redrawn at that size before it reaches the GPU, halving
 * step by step for a clean filter, and the full-size bitmap is released.
 */
function capForLowTier(url: string, scene: THREE.Object3D) {
  if (capped.has(url)) return
  capped.add(url)
  if (useMuseum.getState().tier !== 'low' || typeof document === 'undefined') return
  const max = lowTierMax()
  for (const t of texturesOf(scene)) {
    const img = t.image as (ImageBitmap | HTMLImageElement | HTMLCanvasElement) & { close?: () => void }
    const w0 = (img as HTMLImageElement).naturalWidth || img.width
    const h0 = (img as HTMLImageElement).naturalHeight || img.height
    if (!w0 || !h0 || Math.max(w0, h0) <= max) continue
    let src: CanvasImageSource = img
    let w = w0
    let h = h0
    while (Math.max(w, h) > max) {
      const k = Math.max(0.5, max / Math.max(w, h))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * k))
      c.height = Math.max(1, Math.round(h * k))
      const g = c.getContext('2d')
      if (!g) return
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = 'high'
      g.drawImage(src, 0, 0, c.width, c.height)
      src = c
      w = c.width
      h = c.height
    }
    img.close?.()
    t.image = src
    t.needsUpdate = true
  }
}

/** drei's useGLTF uses three-stdlib's GLTFLoader with the meshopt decoder: the same loader, so the same cache entry. */
const withMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder)
}

function Warm({ url }: { url: string }) {
  const gl = useThree((s) => s.gl)
  const gltf = useLoader(GLTFLoader, url, withMeshopt, (e: ProgressEvent) => onProgress(url, e))
  // during render, before any frame can upload a texture (the frame loop waits for Precompile, which waits for us)
  useMemo(() => capForLowTier(url, gltf.scene), [url, gltf])
  useEffect(() => {
    for (const t of texturesOf(gltf.scene)) gl.initTexture(t)
    finish(url, true)
  }, [gl, gltf, url])
  return null
}

/**
 * Mount once in the scene (MuseumScene, before the scene objects, so its loads carry the byte progress): it
 * loads every team GLB the content names into the shared GLTF cache — the pieces then render from it at once.
 */
export function TeamModelPreload() {
  const urls = useMemo(teamUrls, [])
  useEffect(() => begin(urls), [urls])
  return (
    <>
      {urls.map((url) => (
        <ErrorBoundary
          key={url}
          fallback={null}
          onError={(e) => {
            console.warn(`[museum] a workshop piece failed to load: ${url}`, e.message)
            finish(url, false)
          }}
        >
          <Suspense fallback={null}>
            <Warm url={url} />
          </Suspense>
        </ErrorBoundary>
      ))}
    </>
  )
}
