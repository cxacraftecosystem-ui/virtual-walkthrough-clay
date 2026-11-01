/**
 * SCENE OBJECTS — the pieces on the podium row, the oculus plinth, the visitors' potter's wheel
 * and shelf, drying shelves, benches and planters of the clay pavilion.
 *
 * Each object renders either:
 *   - `model`: a GLB (CC0 library download or a supplied production model), or
 *   - `kind`: a procedural model from src/museum/models/ (always available as fallback).
 * If a GLB is missing or fails to load, the procedural `kind` is shown instead.
 *
 * `footprint` [width x, depth z] (metres, before rotation) is used for collision and
 * is the size the procedural model is built to. Rotation is about +y in degrees.
 * `zone` drives render culling (ZONE_VISIBILITY) — it must be the zone the object stands in.
 */
import { COURT_CENTER, PODIUM, PODIUM_SLOTS, type ZoneId } from './layout'
import { DEG, GRAND_FLAGS, KEY, MUSEUM, polar, type Vec3 } from './museum'
import { STUDY_NOTE, type TraditionKey } from './artworks'
import type { ContentI18n } from '../i18n/core'
import { AMENITY_OBJECTS } from './amenities'
import { ROOM_OBJECTS } from './spectacleObjects/rooms'
import { COURT_OBJECTS } from './spectacleObjects/court'
import { ATMOS_OBJECTS } from './spectacleObjects/atmosphere'
import { CRAFT_OBJECTS } from './spectacleObjects/craft'
import { EXPERIENCE_OBJECTS } from './spectacleObjects/experience'
import { GRAND_CRAFTS_OBJECTS } from './grandObjects/crafts'
import { GRAND_INSTALLATIONS_OBJECTS } from './grandObjects/installations'
import { GRAND_EXPERIENCE_OBJECTS } from './grandObjects/experience'

export type ProceduralModelId =
  | 'printing-table'
  | 'dye-vat'
  | 'drying-line'
  | 'block-shelf'
  | 'pigment-station'
  | 'wash-tank'
  | 'fabric-rolls'
  | 'carving-bench'
  | 'textile-banner'
  | 'plant-bed'
  | 'tree'
  | 'water-channel'
  | 'grand-desk'
  | 'planter'
  | 'speaker'
  | 'theatre-seating'
  | 'garden-bench'
  | 'column'
  /** Small fallbacks for CC0 props (pots / vases / baskets, stools, crates). */
  | 'vessel'
  | 'stool'
  | 'crate'
  /** v3: rotating carved-block centrepiece on a tall round table (models/centrepiece.tsx). */
  | 'centrepiece'
  /** v3: India map wall installation (models/mapWall.tsx). */
  | 'map-wall'
  /** v3: glazed table vitrine with hand blocks, plaster pedestal (models/display.tsx). */
  | 'vitrine'
  | 'pedestal'
  /** "Print it yourself" studio table, Visitors' Wall (models/printStudio.tsx). */
  | 'print-studio'
  | 'visitors-wall'
  /** Volumetric artisan capture: Gaussian splat `model` (.splat) or a glowing stand-in figure (models/artisan.tsx). */
  | 'splat'
  /** Museum shop (models/shop.tsx). */
  | 'shop-shelf'
  | 'shop-table'
  | 'shop-counter'
  | 'stole-rail'
  /** Reading room & library (models/library.tsx). */
  | 'bookcase'
  | 'reading-table'
  | 'lounge-set'
  | 'pattern-lectern'
  | 'drawing-wall'
  | 'resource-board'
  /** Credits / partners wall panel (models/credits.tsx). */
  | 'credits-panel'
  /** Clay pavilion (models/clay.tsx): loose podium {height, top}, pots {form, clay, burnish}, Bankura-style horse {scale}, Molela-style plaque {motif}, the oculus plinth, drying shelf {width, rows, fired}; the studio's potter's wheel (models/printStudio.tsx). */
  | 'podium'
  | 'clay-vessel'
  | 'terracotta-horse'
  | 'votive-plaque'
  | 'oculus-plinth'
  | 'clay-shelf'
  | 'potters-wheel'
  /** Spectacle kinds (props: models/propSchemas.ts; lists: config/spectacleObjects/*). Satellite rooms and the Parikrama (WP1). */
  | 'archive-cabinet'
  | 'listening-post'
  | 'soil-archive'
  | 'lantern-canopy'
  | 'programme-board'
  | 'compass-mandala'
  | 'theatre-house'
  | 'living-alpana'
  | 'clay-chimes'
  /** Oculus court, mandalas, duplex band (WP3). */
  | 'water-ring'
  | 'ghost-potter'
  | 'kulhad-helix'
  | 'tool-mandala'
  | 'strata-wall'
  | 'water-rill'
  | 'court-mandala'
  | 'duplex-frieze'
  /** Hands-on craft and sound (WP4). */
  | 'clay-bed'
  | 'kiln-window'
  | 'ghatam-set'
  | 'horse-procession'
  | 'pit-firing'
  /** Experience (WP5). */
  | 'stamp-post'
  | 'photo-spot'
  | 'perch-door'
  | 'spectacle'
  /** Light and atmosphere (WP2). */
  | 'atmosphere'
  | 'oculus-light'
  | 'cove-light'
  | 'diya-field'
  /** The grand plan (GRAND §7): crafts and the sourced-model runtime (P2), the PDF installations (P3). */
  | 'sourced-model'
  | 'ayyanar-horse'
  | 'relief-register'
  | 'lippan-wall'
  | 'coil-pot'
  | 'kumartuli-figure'
  | 'majuli-mask'
  | 'eroded-formation'
  | 'round-table'
  | 'lotus'
  | 'spiral-stair'
  | 'clay-sphere'
  | 'wine-plinth'
  | 'curved-shelf'
  | 'round-plinth'
  | 'courtyard-garden'

/** Every ProceduralModelId once (a missing or extra key fails the type check). Lists for the admin's kind select. */
const KIND_SET: Record<ProceduralModelId, true> = {
  'printing-table': true,
  'dye-vat': true,
  'drying-line': true,
  'block-shelf': true,
  'pigment-station': true,
  'wash-tank': true,
  'fabric-rolls': true,
  'carving-bench': true,
  'textile-banner': true,
  'plant-bed': true,
  tree: true,
  'water-channel': true,
  'grand-desk': true,
  planter: true,
  speaker: true,
  'theatre-seating': true,
  'garden-bench': true,
  column: true,
  vessel: true,
  stool: true,
  crate: true,
  centrepiece: true,
  'map-wall': true,
  vitrine: true,
  pedestal: true,
  'print-studio': true,
  'visitors-wall': true,
  splat: true,
  'shop-shelf': true,
  'shop-table': true,
  'shop-counter': true,
  'stole-rail': true,
  bookcase: true,
  'reading-table': true,
  'lounge-set': true,
  'pattern-lectern': true,
  'drawing-wall': true,
  'resource-board': true,
  'credits-panel': true,
  podium: true,
  'clay-vessel': true,
  'terracotta-horse': true,
  'votive-plaque': true,
  'oculus-plinth': true,
  'clay-shelf': true,
  'potters-wheel': true,
  'archive-cabinet': true,
  'listening-post': true,
  'soil-archive': true,
  'lantern-canopy': true,
  'programme-board': true,
  'compass-mandala': true,
  'theatre-house': true,
  'living-alpana': true,
  'clay-chimes': true,
  'water-ring': true,
  'ghost-potter': true,
  'kulhad-helix': true,
  'tool-mandala': true,
  'strata-wall': true,
  'water-rill': true,
  'court-mandala': true,
  'duplex-frieze': true,
  'clay-bed': true,
  'kiln-window': true,
  'ghatam-set': true,
  'horse-procession': true,
  'pit-firing': true,
  'stamp-post': true,
  'photo-spot': true,
  'perch-door': true,
  spectacle: true,
  atmosphere: true,
  'oculus-light': true,
  'cove-light': true,
  'diya-field': true,
  'sourced-model': true,
  'ayyanar-horse': true,
  'relief-register': true,
  'lippan-wall': true,
  'coil-pot': true,
  'kumartuli-figure': true,
  'majuli-mask': true,
  'eroded-formation': true,
  'round-table': true,
  'lotus': true,
  'spiral-stair': true,
  'clay-sphere': true,
  'wine-plinth': true,
  'curved-shelf': true,
  'round-plinth': true,
  'courtyard-garden': true,
}
export const PROCEDURAL_KINDS: readonly ProceduralModelId[] = Object.keys(KIND_SET) as ProceduralModelId[]

/** Credit of a downloaded or sourced 3D model (GRAND §5.3). */
export interface SceneCredit {
  author: string
  source: string
  license: 'CC0' | 'CC-BY-4.0' | 'PD'
  title?: string
  licenseUrl?: string
}

export interface SceneObjectConfig {
  id: string
  title: string
  kind: ProceduralModelId
  /** Optional GLB/glTF path (e.g. '/models/cc0/potted_plant_01/potted_plant_01_1k.gltf'); `kind` is the fallback. */
  model?: string
  /** Uniform GLB scale. Omitted → the GLB is scaled so its height equals `height`. */
  modelScale?: number
  /** Floor point (y = 0) or the surface it stands on (e.g. a desk top). Banners: y is the TOP. */
  position: Vec3
  rotationDeg?: number
  /** [x, z] footprint in metres (collision + procedural sizing). Omit = no collision. */
  footprint?: [number, number]
  /** Height hint (m) for procedural models. */
  height?: number
  /** Free-form props for the procedural model (colours, image, count…). */
  props?: Record<string, string | number | boolean>
  /** Clickable → information panel. */
  interactive?: boolean
  /** Opens in the 3D inspection viewer. */
  inspectable?: boolean
  description?: string
  /** Zone the object stands in. */
  zone: ZoneId
  /** Attribution for downloaded and sourced 3D models (GRAND §5.2): CC0, CC BY 4.0 or public domain. */
  credit?: SceneCredit
  placeholder?: boolean
  /** Alternative text describing the object (guide, screen readers). */
  alt?: string
  /** Optional Hindi / Bengali overrides of the text fields. */
  i18n?: ContentI18n<'title' | 'description' | 'alt'>
  /** "Meet the maker" profile (src/museum/content/artisans.ts), e.g. for shop products. */
  artisanId?: string
  /** Links listed in the info panel (shop "Visit the maker / Buy", library Resources). No href = not shown. */
  links?: { label: string; href?: string; note?: string }[]
}

/** Poly Haven CC0 model: the optimised single-file GLB (scripts/optimize-assets.mjs). */
const cc0 = (id: string) => `/models/opt/cc0/${id}.glb`
const PH = (author: string, id: string) => ({ author, source: `https://polyhaven.com/a/${id}`, license: 'CC0' as const })
/** Forecourt planters stand just beyond the annex corners, clear of the facade either side of the door. */
const PLANTER_X = KEY.annexOuterHalf + 0.8
const PLANTER_Z = KEY.annexOuterZ + 0.75

/** Plinth benches: on the landscape between the lobe and the plinth's edge. */
const PLINTH_BENCH_R = KEY.lobeOuterR + 3.2
/** Hands-on pieces and the studio stand between the curb and the formation gates. */
const AISLE_R = (MUSEUM.oculus.rings[0] + MUSEUM.fins.r0) / 2

/** rotationDeg that turns an object's front (+z) to face outwards (away from the drum centre) at plan angle `aDeg`. */
const facingOut = (aDeg: number) => Math.atan2(Math.cos(aDeg * DEG), Math.sin(aDeg * DEG)) / DEG
/** …and to face the drum centre. */
const facingIn = (aDeg: number) => facingOut(aDeg) + 180
/** A floor point on the drum's polar grid. */
const at = (r: number, aDeg: number, y = 0): Vec3 => {
  const [x, z] = polar(r, aDeg)
  return [x, y, z]
}

type Lang3 = [string, string, string]

interface PodiumPiece {
  slot: string
  tradition: TraditionKey
  id: string
  title: Lang3
  kind: ProceduralModelId
  /** Footprint on the podium top (it is 0.305 m square). */
  size: number
  height: number
  props: Record<string, string | number | boolean>
  alt: Lang3
}

/**
 * The podium row (PDF: "Podium product display", 12 in × 12 in at 4 ft) — one piece per podium,
 * standing on its top and facing the court. The podiums themselves are architecture (they always
 * collide, layout.ts PODIUM_SLOTS), so the pieces carry no footprint of their own beyond the top.
 * Every piece is a procedural stand-in (`placeholder: true`) until the workshop's objects are
 * photographed or scanned; set `model` to a GLB then.
 */
const PODIUM_PIECES: PodiumPiece[] = [
  // A — Bankura terracotta
  {
    slot: 'pod-a-1',
    tradition: 'a',
    id: 'clay-a-horse',
    title: ['Horse — Study', 'घोड़ा — अध्ययन', 'ঘোড়া — চর্চা'],
    kind: 'terracotta-horse',
    size: 0.26,
    height: 0.6,
    props: { scale: 1.2 },
    alt: [
      'A red terracotta horse standing square, with a tall straight neck, pricked ears and an open, hollow body.',
      'सीधा खड़ा लाल टेराकोटा घोड़ा — ऊँची सीधी गर्दन, खड़े कान और भीतर से खोखला शरीर।',
      'সোজা দাঁড়ানো লাল টেরাকোটার ঘোড়া — উঁচু খাড়া গলা, খাড়া কান আর ভেতরে ফাঁপা দেহ।',
    ],
  },
  {
    slot: 'pod-a-2',
    tradition: 'a',
    id: 'clay-a-horse-small',
    title: ['Small Horse — Study', 'छोटा घोड़ा — अध्ययन', 'ছোট ঘোড়া — চর্চা'],
    kind: 'terracotta-horse',
    size: 0.2,
    height: 0.48,
    props: { scale: 0.96 },
    alt: [
      'A smaller red terracotta horse of the same upright form.',
      'उसी सीधे रूप का एक छोटा लाल टेराकोटा घोड़ा।',
      'একই খাড়া গড়নের একটি ছোট লাল টেরাকোটার ঘোড়া।',
    ],
  },
  {
    slot: 'pod-a-3',
    tradition: 'a',
    id: 'clay-a-pot',
    title: ['Water Pot — Study', 'पानी का घड़ा — अध्ययन', 'জলের কলসি — চর্চা'],
    kind: 'clay-vessel',
    size: 0.26,
    height: 0.4,
    props: { form: 'matka', clay: 'terracotta', burnish: 0.35 },
    alt: [
      'A round-bellied red clay water pot with a short rolled rim.',
      'छोटे मुड़े किनारे वाला, गोल पेट का लाल मिट्टी का पानी का घड़ा।',
      'ছোট গোটানো কানার, গোল পেটের লাল মাটির জলের কলসি।',
    ],
  },
  // B — Molela votive plaques
  {
    slot: 'pod-b-1',
    tradition: 'b',
    id: 'clay-b-plaque-rider',
    title: ['Plaque: Rider — Study', 'पट्टिका: अश्वारोही — अध्ययन', 'ফলক: অশ্বারোহী — চর্চা'],
    kind: 'votive-plaque',
    size: 0.26,
    height: 0.5,
    props: { motif: 'rider' },
    alt: [
      'A small arched clay plaque standing upright, with a horse and rider in relief, painted red, ochre and white.',
      'सीधी खड़ी एक छोटी मेहराबदार मिट्टी की पट्टिका, जिस पर उभरे घोड़ा और सवार, लाल, पीले और सफ़ेद रंग में।',
      'খাড়া করে রাখা একটি ছোট খিলান-আকারের মাটির ফলক, তাতে উঁচু করে গড়া ঘোড়া ও সওয়ার, লাল, হলুদ আর সাদায় রং করা।',
    ],
  },
  {
    slot: 'pod-b-2',
    tradition: 'b',
    id: 'clay-b-cups',
    title: ['Cups — Study', 'कुल्हड़ — अध्ययन', 'ভাঁড় — চর্চা'],
    kind: 'clay-vessel',
    size: 0.2,
    height: 0.16,
    props: { form: 'kulhad', clay: 'red', burnish: 0 },
    alt: ['A plain, unglazed red clay cup.', 'बिना चमक का एक सादा लाल मिट्टी का कुल्हड़।', 'চকচকে প্রলেপ ছাড়া একটি সাধারণ লাল মাটির ভাঁড়।'],
  },
  {
    slot: 'pod-b-3',
    tradition: 'b',
    id: 'clay-b-plaque-deity',
    title: ['Plaque: Seated Deity — Study', 'पट्टिका: आसीन देवता — अध्ययन', 'ফলক: উপবিষ্ট দেবতা — চর্চা'],
    kind: 'votive-plaque',
    size: 0.28,
    height: 0.58,
    props: { motif: 'deity' },
    alt: [
      'An arched clay plaque with a seated figure in relief under a canopy, painted in earth colours.',
      'मेहराबदार मिट्टी की पट्टिका, जिस पर छत्र के नीचे बैठी एक उभरी आकृति, मिट्टी के रंगों में रँगी।',
      'খিলান-আকারের মাটির ফলক, তাতে চাঁদোয়ার নিচে বসা এক রিলিফ মূর্তি, মাটির রঙে রং করা।',
    ],
  },
  {
    slot: 'pod-b-4',
    tradition: 'b',
    id: 'clay-b-lamp',
    title: ['Oil Lamp — Study', 'दीया — अध्ययन', 'প্রদীপ — চর্চা'],
    kind: 'clay-vessel',
    size: 0.16,
    height: 0.1,
    props: { form: 'diya', clay: 'red', burnish: 0 },
    alt: ['A small, shallow clay oil lamp with a pinched spout.', 'चुटकी से बनी टोंटी वाला छोटा, उथला मिट्टी का दीया।', 'চিমটি দিয়ে গড়া নলওয়ালা একটি ছোট, অগভীর মাটির প্রদীপ।'],
  },
  {
    slot: 'pod-b-5',
    tradition: 'b',
    id: 'clay-b-plaque-serpent',
    title: ['Plaque: Serpent — Study', 'पट्टिका: नाग — अध्ययन', 'ফলক: নাগ — চর্চা'],
    kind: 'votive-plaque',
    size: 0.26,
    height: 0.5,
    props: { motif: 'serpent' },
    alt: [
      'An arched clay plaque with a hooded serpent in relief, in red and cream.',
      'मेहराबदार मिट्टी की पट्टिका, जिस पर फन फैलाए उभरा नाग, लाल और क्रीम रंग में।',
      'খিলান-আকারের মাটির ফলক, তাতে ফণা তোলা রিলিফ সাপ, লাল আর ঘিয়ে রঙে।',
    ],
  },
  // C — Longpi black pottery
  {
    slot: 'pod-c-1',
    tradition: 'c',
    id: 'clay-c-kettle',
    title: ['Kettle — Study', 'केतली — अध्ययन', 'কেটলি — চর্চা'],
    kind: 'clay-vessel',
    size: 0.26,
    height: 0.4,
    props: { form: 'kettle', clay: 'black', burnish: 0.85 },
    alt: [
      'A black clay kettle with a short spout and a cane-bound handle, polished to a soft shine.',
      'छोटी टोंटी और बेंत से बँधे हत्थे वाली काली मिट्टी की केतली, हल्की चमक तक घिसी हुई।',
      'ছোট নল আর বেত-বাঁধা হাতলওয়ালা কালো মাটির কেটলি, নরম আভা পর্যন্ত ঘষা।',
    ],
  },
  {
    slot: 'pod-c-2',
    tradition: 'c',
    id: 'clay-c-bowl',
    title: ['Bowl — Study', 'कटोरा — अध्ययन', 'বাটি — চর্চা'],
    kind: 'clay-vessel',
    size: 0.26,
    height: 0.18,
    props: { form: 'bowl', clay: 'black', burnish: 0.85 },
    alt: ['A wide, low black clay bowl with a burnished surface.', 'घिसकर चमकाई सतह वाला चौड़ा, नीचा काली मिट्टी का कटोरा।', 'ঘষে-মাজা তলের একটি চওড়া, নিচু কালো মাটির বাটি।'],
  },
  {
    slot: 'pod-c-3',
    tradition: 'c',
    id: 'clay-c-pot',
    title: ['Cooking Pot — Study', 'खाना पकाने का बर्तन — अध्ययन', 'রান্নার হাঁড়ি — চর্চা'],
    kind: 'clay-vessel',
    size: 0.26,
    height: 0.4,
    props: { form: 'matka', clay: 'black', burnish: 0.7 },
    alt: ['A round black clay cooking pot with a wide mouth.', 'चौड़े मुँह वाला गोल, काली मिट्टी का खाना पकाने का बर्तन।', 'চওড়া মুখের গোল, কালো মাটির রান্নার হাঁড়ি।'],
  },
]

function podiumObject(p: PodiumPiece): SceneObjectConfig {
  const slot = PODIUM_SLOTS.find((s) => s.id === p.slot)
  if (!slot) throw new Error(`objects.ts: unknown podium slot ${p.slot}`)
  const note = STUDY_NOTE[p.tradition]
  return {
    id: p.id,
    title: p.title[0],
    kind: p.kind,
    position: [slot.x, PODIUM.height, slot.z],
    rotationDeg: slot.rotationY / DEG,
    footprint: [p.size, p.size],
    height: p.height,
    props: p.props,
    interactive: true,
    inspectable: true,
    description: note.en,
    zone: slot.zone,
    placeholder: true,
    alt: p.alt[0],
    i18n: { hi: { title: p.title[1], description: note.hi, alt: p.alt[1] }, bn: { title: p.title[2], description: note.bn, alt: p.alt[2] } },
  }
}

/**
 * The visitors' clay studio: the potter's wheel in Gallery B (it opens studio/ClayStudio.tsx) and
 * the Visitors' Shelf in the entrance hall. Mounted only with GRAND_FLAGS.clayStudio.
 */
const CLAY_STUDIO: SceneObjectConfig[] = [
  {
    id: 'potters-wheel',
    title: 'Shape It Yourself — Potter’s Wheel',
    kind: 'potters-wheel',
    position: at(AISLE_R, -72.5),
    rotationDeg: facingIn(-72.5),
    footprint: [1.2, 1.0],
    height: 0.56,
    interactive: true,
    description: 'A potter’s wheel for visitors. Raise a pot from the clay, finish its surface, and set it on the Visitors’ Shelf in the entrance hall.',
    zone: 'ring-b',
    alt: 'A low potter’s wheel with a pot on its head, turning slowly.',
    i18n: {
      hi: {
        title: 'ख़ुद गढ़कर देखें — कुम्हार का चाक',
        description: 'आगंतुकों के लिए एक कुम्हार का चाक। मिट्टी से एक बर्तन उठाइए, उसकी सतह को अंतिम रूप दीजिए, और उसे प्रवेश कक्ष में आगंतुकों की टाँड़ पर रख दीजिए।',
        alt: 'एक नीचा कुम्हार का चाक, जिसके ऊपर एक बर्तन धीरे-धीरे घूम रहा है।',
      },
      bn: {
        title: 'নিজে গড়ে দেখুন — কুমোরের চাক',
        description: 'দর্শকদের জন্য একটি কুমোরের চাক। মাটি থেকে একটি পাত্র গড়ে তুলুন, তার তল শেষ করুন, আর প্রবেশকক্ষে দর্শকদের তাকে রেখে দিন।',
        alt: 'একটি নিচু কুমোরের চাক, তার মাথায় একটি পাত্র ধীরে ধীরে ঘুরছে।',
      },
    },
  },

  // the Visitors' Shelf on the entrance hall's west wall (pots made at the wheel, after review)
  {
    id: 'visitors-wall',
    title: 'The Visitors’ Shelf',
    kind: 'visitors-wall',
    position: [-KEY.annexHalf + 0.17, 0, (KEY.annexMouthZ + MUSEUM.annex.endZ) / 2 + 0.2],
    rotationDeg: 90,
    footprint: [3.8, 0.32],
    height: 2.6,
    props: { cols: 6, rows: 3, width: 3.6, bottom: 0.6, depth: 0.3 },
    interactive: true,
    description: 'Pots shaped by visitors at the potter’s wheel in Gallery B, set out here after review by the pavilion team.',
    zone: 'annex',
    i18n: {
      hi: {
        title: 'आगंतुकों की टाँड़',
        description: 'गैलरी B में कुम्हार के चाक पर आगंतुकों के गढ़े बर्तन, मंडप की टीम की समीक्षा के बाद यहाँ रखे जाते हैं।',
      },
      bn: {
        title: 'দর্শকদের তাক',
        description: 'গ্যালারি B-তে কুমোরের চাকে দর্শকদের গড়া পাত্র, প্যাভিলিয়ন দলের পর্যালোচনার পরে এখানে রাখা হয়।',
      },
    },
  },
]

/** Hallway shelves stand against the outer face of the hallway wall, facing the drum. */
const SHELF_R = MUSEUM.hallwayWall.r + MUSEUM.hallwayWall.thickness / 2 + 0.2

export const SCENE_OBJECTS: SceneObjectConfig[] = [
  // ── Forecourt ───────────────────────────────────────────────────────────────────
  ...[-1, 1].map<SceneObjectConfig>((side, i) => ({
    id: `forecourt-planter-${i + 1}`,
    title: 'Planter',
    kind: 'planter',
    model: cc0('potted_plant_02'),
    position: [side * PLANTER_X, 0, PLANTER_Z],
    rotationDeg: i * 140,
    footprint: [0.8, 0.8],
    height: 1.0,
    zone: 'entrance-court',
    credit: PH('Rico Cilliers', 'potted_plant_02'),
  })),
  // benches on the landscape plinth, looking out over it
  ...[38, 142].map<SceneObjectConfig>((aDeg, i) => ({
    id: `plinth-bench-${i + 1}`,
    title: 'Bench',
    kind: 'garden-bench',
    position: at(PLINTH_BENCH_R, aDeg),
    rotationDeg: facingOut(aDeg),
    footprint: [1.8, 0.5],
    zone: 'entrance-court',
    i18n: { hi: { title: 'बेंच' }, bn: { title: 'বেঞ্চ' } },
  })),

  // ── The podium row, A → B → C ───────────────────────────────────────────────────
  ...PODIUM_PIECES.map(podiumObject),

  // ── Oculus court: the plinth under the open sky ─────────────────────────────────
  {
    id: 'oculus-plinth',
    title: 'The Oculus',
    kind: 'oculus-plinth',
    position: [COURT_CENTER.x, 0, COURT_CENTER.z],
    // its curb is a wall collider (layout.ts 'oculus-plinth'); no second footprint here
    height: MUSEUM.oculus.curbHeight,
    interactive: true,
    description:
      'The roof opens to the sky above a round plinth of concentric rings. Daylight falls through the opening onto the rings and moves across them through the day.',
    zone: 'inner',
    alt: 'A round, low plinth of concentric clay-coloured rings under a circular opening in the roof.',
    i18n: {
      hi: {
        title: 'ओकुलस',
        description: 'छत यहाँ आकाश की ओर खुलती है, और नीचे संकेंद्रित वलयों का एक गोल चबूतरा है। दिन की रोशनी इस झरोखे से वलयों पर पड़ती है और दिन भर उन पर सरकती रहती है।',
        alt: 'छत के गोल झरोखे के नीचे मिट्टी के रंग के संकेंद्रित वलयों का एक नीचा, गोल चबूतरा।',
      },
      bn: {
        title: 'অকুলাস',
        description: 'এখানে ছাদ আকাশের দিকে খোলা, নিচে সমকেন্দ্রিক বলয়ের একটি গোল বেদি। দিনের আলো এই ফোকর দিয়ে বলয়গুলির ওপর পড়ে আর সারা দিন ধরে তাদের ওপর সরে সরে যায়।',
        alt: 'ছাদের গোল ফোকরের নিচে মাটি-রঙা সমকেন্দ্রিক বলয়ের একটি নিচু, গোল বেদি।',
      },
    },
  },

  // ── The clay studio (GRAND §0.2: taken down for the time being; GRAND_FLAGS.clayStudio restores it) ──
  ...(GRAND_FLAGS.clayStudio ? CLAY_STUDIO : []),

  // ── Gallery C: a bench facing the works on the curved wall ──────────────────────
  {
    id: 'bench-c',
    title: 'Bench',
    kind: 'garden-bench',
    position: at(MUSEUM.podium.ringR - 3, 185),
    rotationDeg: facingOut(185),
    footprint: [1.8, 0.45],
    zone: 'ring-c',
    i18n: { hi: { title: 'बेंच' }, bn: { title: 'বেঞ্চ' } },
  },

  // ── Hallway D: drying shelves against the hallway wall, opposite the making panels ──
  ...[
    { aDeg: 194, rows: 3, title: ['Drying Shelf — Unfired', 'सुखाने की टाँड़ — कच्चे बर्तन', 'শুকোনোর তাক — কাঁচা পাত্র'] as Lang3 },
    { aDeg: 168, rows: 3, title: ['Drying Shelf — Fired', 'सुखाने की टाँड़ — पके बर्तन', 'শুকোনোর তাক — পোড়া পাত্র'] as Lang3 },
  ].map<SceneObjectConfig>((s, i) => ({
    id: `hallway-shelf-${i + 1}`,
    title: s.title[0],
    kind: 'clay-shelf',
    position: at(SHELF_R, s.aDeg),
    rotationDeg: facingOut(s.aDeg),
    footprint: [1.6, 0.34],
    height: 1.9,
    props: { width: 1.6, rows: s.rows, fired: i === 1 },
    interactive: true,
    description:
      i === 0
        ? 'Shaped pieces are set out to dry in the shade before they are fired, turned now and then so they dry evenly.'
        : 'After firing the same pieces are harder, have changed colour, and ring when tapped.',
    zone: 'hallway-d',
    placeholder: true,
    i18n: {
      hi: {
        title: s.title[1],
        description: i === 0 ? 'आकार दिए गए बर्तन पकाने से पहले छाया में सूखने के लिए रखे जाते हैं, और बीच-बीच में पलटे जाते हैं ताकि वे एकसार सूखें।' : 'पकने के बाद वही बर्तन ज़्यादा सख़्त हो जाते हैं, उनका रंग बदल जाता है, और ठोकने पर वे खनकते हैं।',
      },
      bn: {
        title: s.title[2],
        description: i === 0 ? 'আকার দেওয়া পাত্র পোড়ানোর আগে ছায়ায় শুকোতে রাখা হয়, মাঝে মাঝে ওলটানো হয় যাতে সমানভাবে শুকোয়।' : 'পোড়ানোর পরে সেই একই পাত্র আরও শক্ত হয়, রং বদলায়, আর টোকা দিলে টুংটাং বাজে।',
      },
    },
  })),
  ...AMENITY_OBJECTS,

  // ── Spectacle: each package's own list (config/spectacleObjects/*) ──────────────
  ...ROOM_OBJECTS,
  ...COURT_OBJECTS,
  ...ATMOS_OBJECTS,
  ...CRAFT_OBJECTS,
  ...EXPERIENCE_OBJECTS,

  // ── The grand plan: each package's own list (config/grandObjects/*) ─────────────
  ...GRAND_CRAFTS_OBJECTS,
  ...GRAND_INSTALLATIONS_OBJECTS,
  ...GRAND_EXPERIENCE_OBJECTS,
]

export function getSceneObject(id: string) {
  return SCENE_OBJECTS.find((o) => o.id === id)
}
