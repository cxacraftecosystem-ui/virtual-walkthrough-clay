/**
 * Scene objects of hands-on craft and sound (F3, F17–F19, F22).
 * Spread into SCENE_OBJECTS (config/objects.ts). Owned by WP4.
 *
 * The three hands-on pieces in the galleries stand between the oculus plinth and the podium
 * row, facing the walking aisle (outwards), where visitors come upon them. None is
 * `interactive`: each owns its own gestures (a press on the piece is the piece's), so no info
 * panel hit box sits over the clay. The horse procession's object carries only its props; the
 * craft mount draws it across both halves of the Parikrama.
 */
import type { SceneObjectConfig } from '../objects'
import type { ZoneId } from '../layout'
import { DEG, KEY, MUSEUM, polar } from '../museum'
import { PARIKRAMA, SERP_OFFSET, SERPENTINE, serpentineR } from '../satellites'
import type { TourChapter } from '../tour'
import type { TimeOfDay } from '../../state/store'
import { en, type DictKey } from '../../i18n/en'
import { at, facingIn, facingOut } from './place'

/** The pit firing on the plinth, east of the portal (GRAND §2.7), and its footprint (×1.6). */
const PIT_R = KEY.lobeOuterR + 5.15
const PIT_SIZE = 3.2
/**
 * The hands-on pieces stand in the galleries' podium bays, just inside the formation gates' line:
 * off the court's terrazzo, which holds the pool, the lotus, the curb and its benches only (§6.3).
 */
const AISLE_R = MUSEUM.fins.r0 + 0.2

export const CRAFT_OBJECTS: SceneObjectConfig[] = [
  // ── F3: pots firing in an open pit on the plinth, the first wow from the spawn ──────
  {
    id: 'pit-firing',
    title: 'Pit Firing',
    kind: 'pit-firing',
    position: at(PIT_R, 62),
    footprint: [PIT_SIZE, PIT_SIZE],
    height: 0.4,
    props: { pots: 7, smoke: true, sparks: true },
    zone: 'entrance-court',
    alt: 'A ring of stones round a low mound of ash and straw, with clay pots half buried in it, smouldering.',
    i18n: {
      hi: { title: 'खुले गड्ढे में पकाई', alt: 'पत्थरों के घेरे में राख और पुआल का एक नीचा ढेर, जिसमें मिट्टी के बर्तन आधे दबे हैं और धीमे-धीमे सुलग रहे हैं।' },
      bn: { title: 'খোলা গর্তে পোড়ানো', alt: 'পাথরের বেড়ের মাঝে ছাই আর খড়ের একটি নিচু স্তূপ, তাতে মাটির পাত্র আধখানা পোঁতা, ধিকিধিকি জ্বলছে।' },
    },
  },

  // F17, the clay bed, is unplaced (art round 3): Gallery A's floor belongs to the Herd; its kind stays

  // ── F18: Gallery C, one pot's life seen through a kiln's window ────────────────────
  {
    id: 'kiln-window',
    title: 'The Kiln Window',
    kind: 'kiln-window',
    position: at(AISLE_R, -115),
    // its arched mouth turned to the court, the ember glow behind its grille the first thing seen
    rotationDeg: facingIn(-115),
    footprint: [0.96, 0.66],
    height: 1.15,
    props: { form: 'matka', branch: 'smoked', autoSec: 30 },
    zone: 'ring-c',
    alt: 'A small brick kiln with an arched glass window. Inside, a pot changes from wet grey clay to glowing in the fire to fired terracotta; a brass lever moves it through its stages.',
    i18n: {
      hi: { title: 'भट्टी की खिड़की', alt: 'मेहराबदार काँच की खिड़की वाली ईंटों की एक छोटी भट्टी। भीतर एक बर्तन गीली स्लेटी मिट्टी से आग में दहकने तक और फिर पकी टेराकोटा तक बदलता है; पीतल का हत्था उसे इन चरणों से गुज़ारता है।' },
      bn: { title: 'ভাটির জানালা', alt: 'খিলান-আকারের কাচের জানালাসহ ইটের একটি ছোট ভাটি। ভেতরে একটি পাত্র ভেজা ধূসর মাটি থেকে আগুনে জ্বলে উঠে পোড়ামাটিতে বদলায়; পিতলের হাতল তাকে এই ধাপগুলি পেরিয়ে নিয়ে যায়।' },
    },
  },

  // ── F19: Gallery C, five clay pot drums to play ────────────────────────────────────
  {
    id: 'ghatam-set',
    title: 'Play the Ghatam',
    kind: 'ghatam-set',
    position: at(AISLE_R, 205),
    rotationDeg: facingOut(205),
    footprint: [1.6, 0.7],
    height: 0.85,
    props: { count: 5, pitches: '1,1.12,1.26,1.5,1.68', keys: true },
    zone: 'ring-c',
    alt: 'Five round clay pot drums on cloth rings on a low wooden table. Tapping one plays a deep or a bright note; keys 1 to 5 play them when standing close.',
    i18n: {
      hi: { title: 'घटम बजाइए', alt: 'नीची लकड़ी की मेज़ पर कपड़े के छल्लों पर रखे मिट्टी के पाँच गोल घड़े-वाद्य। थपकी देने पर गहरा या खनकता स्वर निकलता है; पास खड़े होकर 1 से 5 तक की कुंजियाँ भी उन्हें बजाती हैं।' },
      bn: { title: 'ঘটম বাজান', alt: 'নিচু কাঠের টেবিলে কাপড়ের বিড়ের ওপর মাটির পাঁচটি গোল ঘট-বাদ্য। টোকা দিলে গভীর বা ঝংকৃত সুর ওঠে; কাছে দাঁড়িয়ে ১ থেকে ৫ কী-ও সেগুলি বাজায়।' },
    },
  },

  // ── F22: the votive horses along the Parikrama (drawn by the craft mount) ─────────
  {
    id: 'horse-procession',
    title: 'Procession of Clay Horses',
    kind: 'horse-procession',
    position: [0, 0, 0],
    props: { fromDeg: -128, toDeg: 26, count: 21, scaleFrom: 0.45, scaleTo: 1.2, glowRadius: 2.2, bells: true },
    zone: 'parikrama-east',
    placeholder: true,
    alt: 'Terracotta horses on a low plinth along the walk, growing from palm-sized to taller than a child. Each glows warmly as a visitor passes.',
    i18n: {
      hi: { title: 'मिट्टी के घोड़ों की शोभायात्रा', alt: 'पथ के साथ एक नीचे चबूतरे पर टेराकोटा के घोड़े, हथेली भर से बढ़ते-बढ़ते बच्चे से ऊँचे तक। आगंतुक के गुज़रते ही हर घोड़ा गरमाहट से दमक उठता है।' },
      bn: { title: 'মাটির ঘোড়ার শোভাযাত্রা', alt: 'পথ বরাবর নিচু বেদিতে পোড়ামাটির ঘোড়া, হাতের তালুর মাপ থেকে বাড়তে বাড়তে শিশুর চেয়েও উঁচু। দর্শক পেরোলেই প্রতিটি ঘোড়া উষ্ণ আলোয় জ্বলে ওঠে।' },
    },
  },
]

/* ------------------------------------------------------------------ */
/* Tuning of the craft pieces and the score (pure: no three, no React) */
/* ------------------------------------------------------------------ */

/** Sa (Hz): C♯3, a comfortable tanpura pitch. The score and the ghatam set are tuned to it. */
export const SA = 138.59

export type ScoreStem = 'drone' | 'fifth' | 'pulse' | 'water' | 'air' | 'fire' | 'coda'

/** Score stem levels per chapter of "Earth to Fire" (0 … 1). */
export const CHAPTER_MIX: Record<TourChapter, Partial<Record<ScoreStem, number>>> = {
  earth: { drone: 1 },
  water: { drone: 0.75, water: 1 },
  hand: { drone: 0.75, fifth: 0.6, pulse: 1 },
  air: { drone: 0.7, air: 1 },
  fire: { drone: 0.85, fifth: 0.45, fire: 1, pulse: 0.35 },
  return: { drone: 0.8, fifth: 0.8, coda: 1 },
}

/** The chapter a zone belongs to when no tour is running. */
export const ZONE_CHAPTER: Record<ZoneId, TourChapter> = {
  'entrance-court': 'earth',
  annex: 'earth',
  inner: 'water',
  'ring-a': 'hand',
  'ring-b': 'hand',
  'ring-c': 'hand',
  'hallway-d': 'air',
  'parikrama-west': 'air',
  'parikrama-east': 'air',
  'sky-rim': 'air',
  duplex: 'hand',
  'sphere-well': 'earth',
  atlas: 'fire',
  theatre: 'fire',
  library: 'return',
  shop: 'return',
  'entry-e': 'return',
}

/**
 * Room reverb per zone (SPECTACLE F29): the decay (s) of the space the visitor stands in.
 * Footsteps and the craft voices send into it; it cross-fades as the visitor changes zone.
 */
export const ZONE_REVERB: Record<ZoneId, number> = {
  inner: 3.2,
  'ring-a': 1.6,
  'ring-b': 1.6,
  'ring-c': 1.6,
  'entry-e': 1.6,
  annex: 1.2,
  'hallway-d': 1.0,
  atlas: 0.9,
  library: 0.6,
  shop: 0.7,
  theatre: 0.5,
  'parikrama-west': 0.25,
  'parikrama-east': 0.25,
  'entrance-court': 0.25,
  'sky-rim': 0.25,
  duplex: 3.2,
  'sphere-well': 3.2,
}

/** How hard the pit firing burns at each time of day (1 = full night glow). */
export const PIT_HEAT: Record<TimeOfDay, number> = { morning: 0.32, midday: 0.28, golden: 0.55, dusk: 0.85, night: 1 }

/** Kiln window: stage s (0 wet … 3 in the fire … 4 fired … 5 smoked) → heat 0 … 1. */
export const kilnHeat = (s: number) => Math.max(0, 1 - Math.abs(s - 3) * 1.15)

/** Kiln window auto timeline: the stage at time t (s) of a `sec`-long life, holding on each stage. */
export function kilnAutoStage(t: number, sec: number, last: number): number {
  const n = last + 1
  const per = sec / n
  const k = Math.floor(t / per)
  if (k >= n) return last
  const f = (t - k * per) / per
  const x = f < 0.7 ? 0 : (f - 0.7) / 0.3
  return Math.min(last, k + x * x * (3 - 2 * x))
}

/** Ghatam pitch ratios from the curator's text; bad entries fall back to the default five. */
export function ghatamPitches(s: string, count: number): number[] {
  const v = s.split(',').map((x) => (x.trim() === '' ? NaN : Number(x.trim())))
  const def = [1, 1.12, 1.26, 1.5, 1.68]
  return Array.from({ length: count }, (_, i) => {
    const x = v[i]
    return x !== undefined && isFinite(x) && x > 0.25 && x < 4 ? x : def[i % def.length] * (i >= def.length ? 2 : 1)
  })
}

export interface HorseSlot {
  /** Plan angle (deg). */
  a: number
  /** Height (m). */
  h: number
  x: number
  z: number
  /** Rotation about y (rad): the horse (head along local +x) faces along the walk, to the east gate. */
  ry: number
}

/** Depth of the drum-side garden at plan angle `aDeg`: from the ring's outer face to the serpentine parapet. */
export function gardenDepth(aDeg: number): number {
  return serpentineR(aDeg) - SERP_OFFSET - SERPENTINE.t / 2 - PARIKRAMA.r0
}

/**
 * Where the procession's horses stand: evenly by angle in the drum-side gardens behind the
 * serpentine's parapet (GRAND §2.6), in the middle of each garden's depth, growing towards the
 * end; angles where the garden is shallower than a metre are skipped.
 */
export function horseSlots(p: Record<string, string | number | boolean>): HorseSlot[] {
  const n = Math.max(1, Math.min(60, Math.round(Number(p.count ?? 21))))
  const from = Number(p.fromDeg ?? -128)
  const to = Number(p.toDeg ?? 26)
  const s0 = Number(p.scaleFrom ?? 0.45)
  const s1 = Number(p.scaleTo ?? 1.2)
  const dir = to >= from ? 1 : -1
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1)
    const a = from + (to - from) * t
    const [x, z] = polar(PARIKRAMA.r0 + gardenDepth(a) / 2, a)
    const ar = a * DEG
    return { a, h: s0 + (s1 - s0) * t, x, z, ry: Math.atan2(-Math.cos(ar) * dir, -Math.sin(ar) * dir) }
  }).filter((s) => gardenDepth(s.a) >= 1)
}

/**
 * A caption key that may not exist yet: the key itself once it is in the dictionary
 * (i18n/en.ts), else the nearest existing one (or none).
 */
export function captionKey(want: string, fallback: DictKey | null): DictKey | null {
  return want in en ? (want as DictKey) : fallback
}
