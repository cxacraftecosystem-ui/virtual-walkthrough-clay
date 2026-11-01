/**
 * ARTWORK CONTENT — edit this file to add, replace or move artworks.
 *
 * Frames are generated automatically from each image's intrinsic aspect ratio:
 * swap the image file (or `image` path) and the frame, mat and spotlight adapt.
 *
 * Placement: `surface` is a display-surface id from layout.ts. Every pavilion surface is a
 * straight run ('along'), so `at` is metres along the run from its start; `atAngle` below
 * turns a plan angle on the drum into that distance, so works can be set between podiums.
 *
 * Hang, in walking order round the ring (GRAND §6.3: the flat hang is trimmed to a few large
 * frames; the walls belong to the objects now):
 *   A  Bankura terracotta   two wall-scale frames on the red wall, between the podiums and clear
 *                           of The Herd (a-outer-1, a-outer-3)
 *   B  Molela plaques       none: B's wall is the white niche wall, its plaques are objects
 *   C  Longpi pottery       three works at eye level on the curved wall facing the podiums
 *                           (c-south — no podiums stand in front of it)
 * Podium, niche, island and register pieces are scene objects (objects.ts,
 * grandObjects/crafts.ts).
 *
 * STAND-IN STATUS: every image below is a procedurally generated study (see
 * scripts/generate-placeholders.mjs) flagged `placeholder: true`; its description says it was made
 * for this exhibition, so nothing is passed off as a documented object. Titles are working titles.
 */

import type { FrameConfig, FrameStyleId } from './frames'
import { SURFACES, type SurfaceId } from './layout'
import { polar } from './museum'
import type { ContentI18n } from '../i18n/core'

export interface ArtworkConfig {
  id: string
  title: string
  /** Traditional craft style the piece belongs to. */
  tradition: string
  artisan?: string
  /** "Meet the maker" profile id (src/museum/content/artisans.ts / admin → Makers). */
  artisanId?: string
  region?: string
  material?: string
  technique?: string
  year?: string
  description?: string
  context?: string
  /** Public path under /public. Any aspect ratio. */
  image: string
  /**
   * Optional very-high-resolution source for the full-screen "Examine closely" viewer
   * (used when there is no `deepZoom` pyramid; loaded whole, so keep it ≤ ~8k px).
   */
  highRes?: string
  /**
   * Optional Deep Zoom Image pyramid (URL of a .dzi descriptor) for the "Examine closely"
   * viewer — see docs/CONTENT_CAPTURE.md and admin → Capture tools → Deep zoom.
   */
  deepZoom?: string
  /** Hero pieces: exactly 5 per tradition (PDF §4). */
  hero?: boolean
  placement: {
    surface: SurfaceId
    at: number
    /** Centre height (m). Default 1.6 (PDF). */
    centerHeight?: number
  }
  /** Maximum outer (framed) size in metres. The artwork is fitted inside without distortion. */
  maxWidth: number
  maxHeight: number
  /**
   * Optional real-world image size in metres (width). When supplied the artwork is
   * shown 1:1 instead of fitted to maxWidth/maxHeight (height derived from aspect).
   */
  physicalWidth?: number
  frame?: FrameConfig | FrameStyleId
  spotlight?: { enabled?: boolean; intensity?: number; spread?: number }
  /** Exhibit id shown on the adjacent table or podium (see exhibits.ts). */
  exhibitId?: string
  /** Individual wall label beside the work (default true; salon hangs share one key panel). */
  label?: boolean
  placeholder?: boolean
  metadata?: Record<string, string>
  /** Alternative text describing the image (guide, screen readers). Falls back to the title. */
  alt?: string
  /** Optional Hindi / Bengali overrides of the text fields (UI falls back to English). */
  i18n?: ContentI18n<'title' | 'tradition' | 'artisan' | 'region' | 'material' | 'technique' | 'description' | 'context' | 'alt'>
}

//** The pavilion's three traditions (working titles until the workshop confirms them), with Hindi / Bengali. */
export const TRADITIONS = {
  a: {
    name: 'Bankura terracotta',
    region: 'Bankura, West Bengal',
    i18n: { hi: { tradition: 'बाँकुड़ा टेराकोटा', region: 'बाँकुड़ा, पश्चिम बंगाल' }, bn: { tradition: 'বাঁকুড়ার টেরাকোটা', region: 'বাঁকুড়া, পশ্চিমবঙ্গ' } },
  },
  b: {
    name: 'Molela votive plaques',
    region: 'Molela, Rajasthan',
    i18n: { hi: { tradition: 'मोलेला की मन्नत पट्टिकाएँ', region: 'मोलेला, राजस्थान' }, bn: { tradition: 'মোলেলার মানতের ফলক', region: 'মোলেলা, রাজস্থান' } },
  },
  c: {
    name: 'Longpi black pottery',
    region: 'Longpi, Manipur',
    i18n: { hi: { tradition: 'लोंगपी के काले मृद्भांड', region: 'लोंगपी, मणिपुर' }, bn: { tradition: 'লংপির কালো মৃৎপাত্র', region: 'লংপি, মণিপুর' } },
  },
} as const

export type TraditionKey = keyof typeof TRADITIONS

/** The exhibition as a whole (kept for shared code that names one craft). */
export const TRADITION = 'Clay'

/**
 * Distance along a straight surface run (`at`) of the point where a plan angle meets it —
 * the foot of the ray from the drum centre at `aDeg`. Clamped to the run.
 */
export function atAngle(surface: SurfaceId, aDeg: number): number {
  const s = SURFACES[surface]
  const [px, pz] = polar(1, aDeg)
  // the ray t·(px, pz) meets the wall plane dot(p, normal) = face
  const denom = px * s.normal[0] + pz * s.normal[1]
  const t = Math.abs(denom) > 1e-6 ? s.face / denom : 0
  const at = (t * px - s.a[0]) * s.dir[0] + (t * pz - s.a[1]) * s.dir[1]
  return Math.min(s.range[1], Math.max(s.range[0], at))
}

/** Middle of a surface run. */
export const midAt = (surface: SurfaceId) => (SURFACES[surface].range[0] + SURFACES[surface].range[1]) / 2

type Place = ArtworkConfig['placement']
interface Opts {
  maxWidth: number
  maxHeight: number
  frame: FrameConfig | FrameStyleId
  hero?: boolean
  label?: boolean
  spotlight?: ArtworkConfig['spotlight']
  alt: string
  altHi: string
  altBn: string
}

/** What every stand-in says about itself: made for the exhibition, in the manner of its tradition. */
export const STUDY_NOTE: Record<TraditionKey, { en: string; hi: string; bn: string }> = {
  a: {
    en: 'A study made for this exhibition, in the manner of Bankura terracotta.',
    hi: 'इस प्रदर्शनी के लिए बनाया गया एक अध्ययन, बाँकुड़ा टेराकोटा की शैली में।',
    bn: 'এই প্রদর্শনীর জন্য তৈরি একটি চর্চা, বাঁকুড়ার টেরাকোটার ধরনে।',
  },
  b: {
    en: 'A study made for this exhibition, in the manner of the votive plaques of Molela.',
    hi: 'इस प्रदर्शनी के लिए बनाया गया एक अध्ययन, मोलेला की मन्नत पट्टिकाओं की शैली में।',
    bn: 'এই প্রদর্শনীর জন্য তৈরি একটি চর্চা, মোলেলার মানতের ফলকের ধরনে।',
  },
  c: {
    en: 'A study made for this exhibition, in the manner of Longpi black pottery.',
    hi: 'इस प्रदर्शनी के लिए बनाया गया एक अध्ययन, लोंगपी के काले मृद्भांडों की शैली में।',
    bn: 'এই প্রদর্শনীর জন্য তৈরি একটি চর্চা, লংপির কালো মৃৎপাত্রের ধরনে।',
  },
}

/** Compact constructor for a stand-in work of tradition `t`; titles are [en, hi, bn]. */
function work(t: TraditionKey, id: string, title: [string, string, string], placement: Place, o: Opts): ArtworkConfig {
  const tr = TRADITIONS[t]
  const { alt, altHi, altBn, ...rest } = o
  return {
    id,
    title: title[0],
    tradition: tr.name,
    region: tr.region,
    image: `/artworks/${id}.jpg`,
    placement,
    description: STUDY_NOTE[t].en,
    placeholder: true,
    alt,
    ...rest,
    i18n: {
      hi: { title: title[1], ...tr.i18n.hi, description: STUDY_NOTE[t].hi, alt: altHi },
      bn: { title: title[2], ...tr.i18n.bn, description: STUDY_NOTE[t].bn, alt: altBn },
    },
  }
}

const DARK: FrameConfig = { style: 'dark-wood', matColor: '#e4dccf' }

export const ARTWORKS: ArtworkConfig[] = [
  // ══ A — Bankura terracotta: the red wall carries its sconced podiums and the Herd alone (p02) ══

  // ══ B — Molela votive plaques: the niche wall (grandObjects/crafts.ts), nothing hung ══

  // ══ C — Longpi black pottery: one large photograph on the charcoal wall, nothing small ═
  work('c', 'clay-c-01', ['Kettle — Study', 'केतली — अध्ययन', 'কেটলি — চর্চা'], { surface: 'c-south-2', at: midAt('c-south-2'), centerHeight: 1.75 }, {
    hero: true,
    maxWidth: 1.7,
    maxHeight: 2.1,
    frame: DARK,
    alt: 'A black, burnished clay kettle with a cane-wrapped handle, against a pale ground.',
    altHi: 'बेंत से लिपटे हत्थे वाली काली, घिसकर चमकाई मिट्टी की केतली, हल्की पृष्ठभूमि पर।',
    altBn: 'বেত জড়ানো হাতলওয়ালা একটি কালো, ঘষে-মাজা মাটির কেটলি, হালকা পটভূমিতে।',
  }),
]

export function getArtwork(id: string) {
  return ARTWORKS.find((a) => a.id === id)
}
