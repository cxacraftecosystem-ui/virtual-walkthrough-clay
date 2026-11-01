/**
 * GRAPHICS QUALITY PRESETS
 *
 * Progressive strategy: every tier is stable rasterised PBR. Higher tiers add
 * shadow resolution, ambient occlusion, bloom on emissive fixtures and
 * real-time planar floor reflections. "auto" starts at a device-appropriate
 * tier and steps down if the frame rate stays low.
 */

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra'
export type QualitySetting = QualityTier | 'auto'

export interface QualityPreset {
  label: string
  /** Device-pixel-ratio cap. */
  dpr: [number, number]
  shadows: boolean
  shadowMapSize: number
  /** Soft (PCF-soft) vs hard shadows. */
  softShadows: boolean
  postprocessing: boolean
  ambientOcclusion: boolean
  aoQuality: 'performance' | 'low' | 'medium' | 'high' | 'ultra'
  bloom: boolean
  smaa: boolean
  /** Rendered planar reflections on the oak floor (drei MeshReflectorMaterial). */
  floorReflections: boolean
  /** Accent spotlights on exhibit display tables. */
  tableSpots: boolean
  /** Number of real SpotLights shared between all track fixtures (nearest first). */
  spotPool: number
  /** Rect-area cove lights (costly per-fragment). */
  areaLights: boolean
  textureAnisotropy: number
  /** Procedural texture resolution (px). */
  textureSize: number
  antialias: boolean
  /** Per-zone irradiance/reflection probes (lighting/ZoneProbes.tsx) — experimental, also needs `?probes`. */
  zoneProbes: boolean
  /** Probe cube resolution (px per face). */
  probeSize: number
  /** Photo mode path-traces the still view by default (experimental: off everywhere; photo-bar toggle opts in). */
  pathTracing: boolean
  /** Visual density of the spectacle moments (SPECTACLE §5). Geometry, collision, zones and tour never change. */
  spectacle: SpectacleCaps
}

/**
 * Per-tier caps for the spectacle moments. Counts are upper limits (an installation may ask for
 * fewer); sizes are texture / render-target pixels. VR uses the Low particle caps.
 */
export interface SpectacleCaps {
  /** Dust motes in the oculus sun shaft. */
  motes: number
  /** fbm noise in the shaft (off = smooth column). */
  shaftNoise: boolean
  helixCups: number
  helixShadows: boolean
  /** Lamps on Diya Night, the diya light map size (px) and its refresh rate (Hz; 0 = static). */
  diyas: number
  diyaMapPx: number
  diyaMapHz: number
  /** Rain streaks through the oculus; rain outdoors too. */
  rainDrops: number
  outdoorRain: boolean
  poolMirror: boolean
  /** Rendered planar mirror for the pool and the rill (render-target px on the long side; 0 = the analytic reflection). */
  waterMirrorPx: number
  caustics: boolean
  /** Pit firing: smoke billboards, sparks, ember particles. */
  smoke: number
  sparks: number
  embers: number
  /** Parallax steps on the strata wall (0 = flat with a sweep band). */
  strataPOM: number
  /** Generated spectacle textures (mandalas, frieze, compass…). */
  spectacleTexPx: number
  /** Kiln Film render target [width, height, Hz, fbm octaves]. */
  kilnFilmRT: [number, number, number, number]
  clayBedRT: number
  clayBedDisplace: boolean
  lathePotSegs: number
  pergolaShadows: boolean
  jaliShadows: boolean
  shopVessels: number
  lanterns: number
  /** Share of the library's books drawn. */
  bookFrac: number
  horseSpot: boolean
  horseDiyas: boolean
  heatShimmer: boolean
  grade: boolean
  grain: boolean
  /** The Parikrama's alpana draws itself live; slow spins (mandalas, helix bands). */
  alpanaLive: boolean
  spin: boolean
  /** Motes while perched on the Sky Rim. */
  perchMotes: number
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: {
    label: 'Low',
    dpr: [0.75, 1],
    shadows: false,
    shadowMapSize: 1024,
    softShadows: false,
    postprocessing: false,
    ambientOcclusion: false,
    aoQuality: 'performance',
    bloom: false,
    smaa: false,
    floorReflections: false,
    tableSpots: false,
    spotPool: 6,
    areaLights: false,
    textureAnisotropy: 2,
    textureSize: 512,
    antialias: false,
    zoneProbes: false,
    probeSize: 32,
    pathTracing: false,
    spectacle: {
      motes: 0,
      shaftNoise: false,
      helixCups: 200,
      helixShadows: false,
      diyas: 160,
      diyaMapPx: 128,
      diyaMapHz: 0,
      rainDrops: 150,
      outdoorRain: false,
      poolMirror: false,
      waterMirrorPx: 0,
      caustics: false,
      smoke: 0,
      sparks: 0,
      embers: 60,
      strataPOM: 0,
      spectacleTexPx: 512,
      kilnFilmRT: [384, 128, 12, 2],
      clayBedRT: 128,
      clayBedDisplace: false,
      lathePotSegs: 24,
      pergolaShadows: false,
      jaliShadows: false,
      shopVessels: 40,
      lanterns: 12,
      bookFrac: 0.6,
      horseSpot: false,
      horseDiyas: false,
      heatShimmer: false,
      grade: false,
      grain: false,
      alpanaLive: false,
      spin: false,
      perchMotes: 0,
    },
  },
  medium: {
    label: 'Medium',
    dpr: [1, 1.25],
    shadows: true,
    shadowMapSize: 2048,
    softShadows: true,
    // No composer on Medium: native MSAA + renderer tone mapping is ~2x faster on integrated GPUs.
    postprocessing: false,
    ambientOcclusion: false,
    aoQuality: 'performance',
    bloom: false,
    smaa: true,
    floorReflections: false,
    tableSpots: true,
    spotPool: 10,
    areaLights: true,
    textureAnisotropy: 4,
    textureSize: 1024,
    antialias: true,
    zoneProbes: true,
    probeSize: 64,
    pathTracing: false,
    spectacle: {
      motes: 400,
      shaftNoise: true,
      helixCups: 420,
      helixShadows: false,
      diyas: 320,
      diyaMapPx: 256,
      diyaMapHz: 10,
      rainDrops: 600,
      outdoorRain: true,
      poolMirror: false,
      waterMirrorPx: 512,
      caustics: true,
      smoke: 12,
      sparks: 0,
      embers: 120,
      strataPOM: 0,
      spectacleTexPx: 1024,
      kilnFilmRT: [768, 256, 24, 3],
      clayBedRT: 256,
      clayBedDisplace: false,
      lathePotSegs: 48,
      pergolaShadows: true,
      jaliShadows: true,
      shopVessels: 90,
      lanterns: 30,
      bookFrac: 1,
      horseSpot: true,
      horseDiyas: true,
      heatShimmer: false,
      grade: false,
      grain: false,
      alpanaLive: true,
      spin: true,
      perchMotes: 200,
    },
  },
  high: {
    label: 'High',
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 4096,
    softShadows: true,
    postprocessing: true,
    ambientOcclusion: true,
    aoQuality: 'performance',
    bloom: true,
    smaa: true,
    floorReflections: false,
    tableSpots: true,
    spotPool: 12,
    areaLights: true,
    textureAnisotropy: 8,
    textureSize: 1024,
    antialias: false,
    zoneProbes: true,
    probeSize: 128,
    pathTracing: false,
    spectacle: {
      motes: 1000,
      shaftNoise: true,
      helixCups: 720,
      helixShadows: true,
      diyas: 600,
      diyaMapPx: 512,
      diyaMapHz: 20,
      rainDrops: 1500,
      outdoorRain: true,
      poolMirror: true,
      // 1024 takes the mirror's MSAA (materials/planarMirror.ts): the pool's edges never stair-step
      waterMirrorPx: 1024,
      caustics: true,
      smoke: 32,
      sparks: 40,
      embers: 200,
      strataPOM: 12,
      spectacleTexPx: 1024,
      kilnFilmRT: [1024, 344, 30, 5],
      clayBedRT: 512,
      clayBedDisplace: true,
      lathePotSegs: 48,
      pergolaShadows: true,
      jaliShadows: true,
      shopVessels: 140,
      lanterns: 30,
      bookFrac: 1,
      horseSpot: true,
      horseDiyas: true,
      heatShimmer: true,
      grade: true,
      grain: false,
      alpanaLive: true,
      spin: true,
      perchMotes: 1000,
    },
  },
  ultra: {
    label: 'Ultra',
    dpr: [1, 2],
    shadows: true,
    shadowMapSize: 4096,
    softShadows: true,
    postprocessing: true,
    ambientOcclusion: true,
    aoQuality: 'high',
    bloom: true,
    smaa: true,
    floorReflections: true,
    tableSpots: true,
    spotPool: 14,
    areaLights: true,
    textureAnisotropy: 16,
    textureSize: 2048,
    antialias: false,
    zoneProbes: true,
    probeSize: 128,
    pathTracing: false,
    spectacle: {
      motes: 1600,
      shaftNoise: true,
      helixCups: 960,
      helixShadows: true,
      diyas: 600,
      diyaMapPx: 512,
      diyaMapHz: 30,
      rainDrops: 2500,
      outdoorRain: true,
      poolMirror: true,
      waterMirrorPx: 1024,
      caustics: true,
      smoke: 32,
      sparks: 40,
      embers: 200,
      strataPOM: 16,
      spectacleTexPx: 2048,
      kilnFilmRT: [1536, 512, 60, 5],
      clayBedRT: 512,
      clayBedDisplace: true,
      lathePotSegs: 48,
      pergolaShadows: true,
      jaliShadows: true,
      shopVessels: 140,
      lanterns: 30,
      bookFrac: 1,
      horseSpot: true,
      horseDiyas: true,
      heatShimmer: true,
      grade: true,
      grain: true,
      alpanaLive: true,
      spin: true,
      perchMotes: 1600,
    },
  },
}

export const QUALITY_ORDER: QualityTier[] = ['low', 'medium', 'high', 'ultra']

/** Pick a starting tier for "auto" from coarse device signals. */
export function detectInitialTier(): QualityTier {
  if (typeof window === 'undefined') return 'high'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.screen.width, window.screen.height) < 820
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (coarse && small) return 'low'
  if (coarse || (mem !== undefined && mem <= 4)) return 'medium'
  const cls = gpuClass()
  // Integrated / mobile GPUs: start at Medium (measured ~55-60 fps on Iris Xe vs ~20 on High).
  if (cls === 'integrated') return 'medium'
  if (cls === 'flagship') return 'ultra'
  return 'high'
}

export type GpuClass = 'integrated' | 'discrete' | 'flagship' | 'unknown'

/** Coarse GPU class from the WebGL renderer string (used for the starting tier and the auto ceiling). */
export function gpuClass(): GpuClass {
  const r = gpuRenderer()
  if (!r) return 'unknown'
  if (/rtx\s?(20[6-9]0|30\d0|40\d0|50\d0)|rx\s?(6[7-9]\d0|7[6-9]\d0|9\d{3})|radeon pro w\d|apple m\d\s?(pro|max|ultra)|arc a7/i.test(r)) return 'flagship'
  if (/nvidia|geforce|quadro|rtx|radeon rx|radeon pro|arc a|apple m\d/i.test(r)) return 'discrete'
  if (isIntegratedGPU()) return 'integrated'
  return 'unknown'
}

/**
 * Highest tier "auto" may climb to on this device class. With vsync the frame rate
 * saturates at the display refresh, so "holding 60 fps" says nothing about headroom on
 * weak GPUs — integrated GPUs therefore stay at their starting tier (measured: Iris Xe
 * holds 60 fps on Medium but ~20 fps on High), only discrete GPUs may climb.
 */
export function autoCeiling(): QualityTier {
  // Touch devices (phones/tablets; iOS reports an 'unknown' "Apple GPU") never climb: each tier
  // change rebuilds the WebGL context, and repeated rebuilds get the tab killed on iOS Safari.
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return detectInitialTier()
  const c = gpuClass()
  if (c === 'flagship' || c === 'discrete') return 'ultra'
  if (c === 'integrated') return 'medium'
  return 'high'
}

let gpuName: string | null = null
export function gpuRenderer(): string {
  if (gpuName !== null) return gpuName
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    gpuName = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    gpuName = ''
  }
  return gpuName
}

function isIntegratedGPU() {
  const r = gpuRenderer()
  if (/nvidia|geforce|quadro|rtx|radeon rx|radeon pro|arc a/i.test(r)) return false
  return /intel|iris|uhd|mali|adreno|powervr|swiftshader|llvmpipe|microsoft basic/i.test(r)
}

/**
 * Dev-only profiling overrides, e.g. `?quality=high&fx=0&shadows=0&area=0&ao=0&dpr=1`.
 * Ignored in production builds.
 */
export function withDevOverrides(p: QualityPreset): QualityPreset {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return p
  const q = new URLSearchParams(window.location.search)
  const flag = (k: string) => (q.has(k) ? q.get(k) !== '0' : undefined)
  const out = { ...p }
  if (flag('fx') !== undefined) out.postprocessing = flag('fx')!
  if (flag('shadows') !== undefined) out.shadows = flag('shadows')!
  if (flag('area') !== undefined) out.areaLights = flag('area')!
  if (flag('ao') !== undefined) out.ambientOcclusion = flag('ao')!
  if (flag('bloom') !== undefined) out.bloom = flag('bloom')!
  if (q.has('dpr')) out.dpr = [Number(q.get('dpr')), Number(q.get('dpr'))]
  return out
}
