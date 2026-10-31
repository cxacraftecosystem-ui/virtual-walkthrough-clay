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
 * Hang, in walking order round the ring (CONTRACT §6, "Clay exhibition layout"):
 *   A  Bankura terracotta   one work at eye level where the ring opens (a-outer-1), two in the
 *                           upper register above the podium row
 *   B  Molela plaques       three works in the upper register above the five podiums
 *   C  Longpi pottery       three works at eye level on the curved wall facing the podiums
 *                           (c-south — no podiums stand in front of it)
 * Podium objects (the other hero pieces) are scene objects — objects.ts. Each tradition has
 * five hero pieces in all: two hung works here and three podium pieces.
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

/** Upper register: above the podium row (podium tops at 1.22 m, the pieces on them to about 1.7 m). */
const UPPER = 2.85
/** Clay-coloured mats instead of the paper white of the textile frames. */
const CLAY_MAT = '#eadbc8'
const SHADOW_BOX: FrameConfig = { style: 'float-walnut', matColor: CLAY_MAT }
const OAK: FrameConfig = { style: 'natural-wood', matColor: CLAY_MAT }
const DARK: FrameConfig = { style: 'dark-wood', matColor: '#e4dccf' }

export const ARTWORKS: ArtworkConfig[] = [
  // ══ A — Bankura terracotta (ring-a, the first gallery, on the right) ══════════════
  // eye level where the ring opens, between the NE notch and the first podium
  work('a', 'clay-a-01', ['Horse and Rider — Study', 'घोड़ा और सवार — अध्ययन', 'ঘোড়া ও সওয়ার — চর্চা'], { surface: 'a-outer-1', at: atAngle('a-outer-1', 24.5), centerHeight: 1.65 }, {
    hero: true,
    maxWidth: 1.0,
    maxHeight: 1.4,
    frame: SHADOW_BOX,
    alt: 'A panel of fired red clay in low relief: a long-necked horse in profile with its rider sitting upright, on a ground of incised lines.',
    altHi: 'पकी लाल मिट्टी का उभरा हुआ फलक: लंबी गर्दन वाला घोड़ा, बगल से, उस पर सीधा बैठा सवार; पीछे खुदी हुई रेखाएँ।',
    altBn: 'পোড়া লাল মাটির অল্প-উঁচু রিলিফ ফলক: পাশ থেকে দেখা লম্বা গলার একটি ঘোড়া, তার পিঠে সোজা হয়ে বসা সওয়ার; পিছনে খোদাই করা রেখা।',
  }),
  work('a', 'clay-a-02', ['Temple Frieze — Study', 'मंदिर की पट्टी — अध्ययन', 'মন্দিরের ফ্রিজ — চর্চা'], { surface: 'a-outer-3', at: midAt('a-outer-3'), centerHeight: UPPER }, {
    hero: true,
    maxWidth: 1.75,
    maxHeight: 0.9,
    frame: SHADOW_BOX,
    label: false,
    alt: 'A long panel of red clay tiles in low relief: a row of small figures under arches, above a border of lotus petals.',
    altHi: 'लाल मिट्टी की टाइलों की एक लंबी उभरी पट्टी: मेहराबों के नीचे छोटी आकृतियों की पंक्ति, नीचे कमल-पंखुड़ियों की किनारी।',
    altBn: 'লাল মাটির টালির একটি লম্বা রিলিফ ফলক: খিলানের নিচে ছোট ছোট মূর্তির সারি, নিচে পদ্মের পাপড়ির পাড়।',
  }),
  work('a', 'clay-a-03', ['Lotus Tiles — Study', 'कमल की टाइलें — अध्ययन', 'পদ্মের টালি — চর্চা'], { surface: 'a-outer-2', at: midAt('a-outer-2'), centerHeight: UPPER }, {
    maxWidth: 1.75,
    maxHeight: 0.8,
    frame: OAK,
    label: false,
    alt: 'Three square terracotta tiles side by side, each pressed with an open lotus.',
    altHi: 'टेराकोटा की तीन चौकोर टाइलें अगल-बगल, हर एक पर खिले कमल की छाप।',
    altBn: 'পাশাপাশি তিনটি চৌকো টেরাকোটা টালি, প্রতিটিতে একটি ফোটা পদ্মের ছাপ।',
  }),

  // ══ B — Molela votive plaques (ring-b, the far side of the ring) ═══════════════════
  work('b', 'clay-b-01', ['Rider Deity — Study', 'अश्वारोही देवता — अध्ययन', 'অশ্বারোহী দেবতা — চর্চা'], { surface: 'b-outer-2', at: midAt('b-outer-2'), centerHeight: UPPER }, {
    hero: true,
    maxWidth: 1.0,
    maxHeight: 1.25,
    frame: SHADOW_BOX,
    label: false,
    alt: 'An arched clay plaque in relief, painted in earth red, ochre and white: a figure on horseback under a scalloped arch.',
    altHi: 'मेहराबदार मिट्टी की उभरी पट्टिका, गेरुए लाल, पीले और सफ़ेद रंग में रँगी: झालरदार मेहराब के नीचे घोड़े पर सवार एक आकृति।',
    altBn: 'খিলান-আকারের মাটির রিলিফ ফলক, মেটে লাল, হলুদ আর সাদায় রং করা: ঢেউখেলানো খিলানের নিচে ঘোড়সওয়ার এক মূর্তি।',
  }),
  work('b', 'clay-b-02', ['Serpent Plaque — Study', 'नाग पट्टिका — अध्ययन', 'নাগ ফলক — চর্চা'], { surface: 'b-outer-3', at: midAt('b-outer-3'), centerHeight: UPPER }, {
    hero: true,
    maxWidth: 1.0,
    maxHeight: 1.25,
    frame: SHADOW_BOX,
    label: false,
    alt: 'An arched clay plaque in relief: a coiled, hooded serpent inside a border of dots, in red and cream.',
    altHi: 'मेहराबदार मिट्टी की उभरी पट्टिका: बिंदुओं की किनारी के भीतर कुंडली मारे फन फैलाए नाग, लाल और क्रीम रंग में।',
    altBn: 'খিলান-আকারের মাটির রিলিফ ফলক: বিন্দুর পাড়ের ভেতরে কুণ্ডলী পাকানো ফণা তোলা সাপ, লাল আর ঘিয়ে রঙে।',
  }),
  work('b', 'clay-b-03', ['Plaque Fragments — Study', 'पट्टिका के अंश — अध्ययन', 'ফলকের টুকরো — চর্চা'], { surface: 'b-outer-4', at: midAt('b-outer-4'), centerHeight: UPPER }, {
    maxWidth: 1.6,
    maxHeight: 0.85,
    frame: OAK,
    label: false,
    alt: 'Four small relief fragments of unpainted fired clay in a row: a face, a hand, a hoof and a leaf.',
    altHi: 'बिना रँगी पकी मिट्टी के चार छोटे उभरे अंश एक पंक्ति में: एक चेहरा, एक हाथ, एक खुर और एक पत्ता।',
    altBn: 'রং না-করা পোড়া মাটির চারটি ছোট রিলিফ টুকরো এক সারিতে: একটি মুখ, একটি হাত, একটি খুর আর একটি পাতা।',
  }),

  // ══ C — Longpi black pottery (ring-c, eye level on the curved wall facing the podiums) ═
  work('c', 'clay-c-01', ['Kettle — Study', 'केतली — अध्ययन', 'কেটলি — চর্চা'], { surface: 'c-south-1', at: midAt('c-south-1') - 0.3, centerHeight: 1.6 }, {
    hero: true,
    maxWidth: 1.1,
    maxHeight: 1.35,
    frame: DARK,
    alt: 'A black, burnished clay kettle with a cane-wrapped handle, against a pale ground.',
    altHi: 'बेंत से लिपटे हत्थे वाली काली, घिसकर चमकाई मिट्टी की केतली, हल्की पृष्ठभूमि पर।',
    altBn: 'বেত জড়ানো হাতলওয়ালা একটি কালো, ঘষে-মাজা মাটির কেটলি, হালকা পটভূমিতে।',
  }),
  work('c', 'clay-c-02', ['Bowls — Study', 'कटोरे — अध्ययन', 'বাটি — চর্চা'], { surface: 'c-south-2', at: midAt('c-south-2') - 0.3, centerHeight: 1.6 }, {
    hero: true,
    maxWidth: 1.3,
    maxHeight: 1.0,
    frame: DARK,
    alt: 'Three black clay bowls set one inside another, with a soft polished sheen.',
    altHi: 'एक के भीतर एक रखे तीन काले मिट्टी के कटोरे, हल्की चमक के साथ।',
    altBn: 'একটির ভেতরে আরেকটি রাখা তিনটি কালো মাটির বাটি, নরম মসৃণ আভা।',
  }),
  work('c', 'clay-c-03', ['Burnished Surface — Study', 'घिसकर चमकाई सतह — अध्ययन', 'ঘষে-মাজা তল — চর্চা'], { surface: 'c-south-3', at: midAt('c-south-3') - 0.3, centerHeight: 1.6 }, {
    maxWidth: 0.95,
    maxHeight: 0.95,
    frame: { style: 'thin-black', matColor: '#ece6dc' },
    alt: 'A close view of a black clay surface polished to a low shine, with flecks of grey stone in it.',
    altHi: 'हल्की चमक तक घिसी काली मिट्टी की सतह का पास का दृश्य, जिसमें धूसर पत्थर के कण दिखते हैं।',
    altBn: 'হালকা চকচকে করে ঘষা কালো মাটির তলের কাছ থেকে দেখা, তাতে ধূসর পাথরের কণা।',
  }),
]

export function getArtwork(id: string) {
  return ARTWORKS.find((a) => a.id === id)
}
