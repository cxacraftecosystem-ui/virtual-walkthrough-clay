/**
 * VIDEO SCREENS — embedded films with positional / surround audio.
 *
 * `src` may be any browser-playable file (MP4 H.264/AAC recommended; WebM VP9/Opus fine).
 * Multichannel (5.1) files are routed channel-by-channel to the virtual speakers in
 * `audio.speakers`; stereo files are up-mixed (L→FL+SL, R→FR+SR, L+R→C).
 *
 * STAND-IN STATUS: none yet (see the note above VIDEOS).
 */
import type { Vec3 } from './museum'
import type { SurfaceId } from './layout'
import type { ContentI18n } from '../i18n/core'

export type SpeakerChannel = 'FL' | 'FR' | 'C' | 'LFE' | 'SL' | 'SR' | 'BL' | 'BR'

export interface VideoConfig {
  id: string
  title: string
  description?: string
  src: string
  poster?: string
  /** Wall mounting (like artworks) … */
  placement: { surface: SurfaceId; at: number; centerHeight: number }
  /** Screen width in metres; height follows the video's aspect ratio (fallback 16:9). */
  width: number
  screen: 'flat' | 'led-wall' | 'curved'
  /** Horizontal arc (deg) for curved screens. */
  curveDeg?: number
  audio: {
    mode: 'spatial' | 'surround' | 'none'
    /** 0–1 */
    volume: number
    /** Distance (m) at which volume starts to fall off. */
    refDistance: number
    rolloff: number
    maxDistance: number
    /** Surround speakers (world positions); only for mode 'surround'. */
    speakers?: { channel: SpeakerChannel; position: Vec3 }[]
    /**
     * Source channel count override (2 = stereo → up-mixed, 6 = 5.1, 8 = 7.1).
     * Omit to auto-detect from the decoded stream.
     */
    channels?: 2 | 6 | 8
    /** Room reverb send (0–1) for surround rooms. Default 0.16 for 'surround', 0 otherwise. */
    reverb?: number
  }
  /** Add ONE colour-following RectAreaLight in front of the screen (areaLights tiers only). Default: true for 'curved'. */
  lightSpill?: boolean
  /** 'proximity' = plays while the visitor is in `zone` (or within activationDistance). */
  playback: 'proximity' | 'always' | 'click'
  activationDistance?: number
  zone?: string
  loop: boolean
  placeholder?: boolean
  /**
   * 'portrait' = a small vertical "Meet the maker" screen on a free-standing stand beside a
   * printing table (`stand`), the film centre-cropped to `cropAspect`. Default: a wall screen.
   */
  kind?: 'wall' | 'portrait'
  /** Free-standing position (floor x/z; rotationDeg about +y, 0 = the screen faces +z). Overrides `placement` for positioning. */
  stand?: { x: number; z: number; rotationDeg: number }
  /** Portrait crop of a landscape source (width / height). Default 9 / 16. */
  cropAspect?: number
  /** Text description of the film (guide, screen readers). */
  alt?: string
  /** Optional Hindi / Bengali overrides of the text fields. */
  i18n?: ContentI18n<'title' | 'description' | 'alt'>
}

/**
 * The pavilion has no screen yet. The generated films in public/videos are the hand block museum's (their
 * titles and imagery are printing), so none is reused here. When the workshop supplies a film of the making,
 * a flat screen fits the hallway (`placement: { surface: 'd-hallway-6', at: 1.16, centerHeight: 1.7 }`,
 * `width: 1.9`, spatial audio, `playback: 'proximity'`, `zone: 'hallway-d'`) or the entrance hall's west wall.
 */
export const VIDEOS: VideoConfig[] = []
