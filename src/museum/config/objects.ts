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
import { COURT_CENTER, PODIUM_SLOTS, podiumStandY, type ZoneId } from './layout'
import { DEG, GRAND_FLAGS, KEY, MUSEUM, polar, type Vec3 } from './museum'
import type { ContentI18n } from '../i18n/core'
import { AMENITY_OBJECTS } from './amenities'
import { ROOM_OBJECTS } from './spectacleObjects/rooms'
import { COURT_OBJECTS } from './spectacleObjects/court'
import { ATMOS_OBJECTS } from './spectacleObjects/atmosphere'
import { CRAFT_OBJECTS } from './spectacleObjects/craft'
import { EXPERIENCE_OBJECTS } from './spectacleObjects/experience'
import { GRAND_CRAFTS_OBJECTS, herdFloorPlace, herdPlace } from './grandObjects/crafts'
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
  | 'vessel-constellation'
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
  /** The workshop team's textured GLBs (TEAM_PIECES): a soft clay silhouette while one loads or if it fails (models/teamPiece.tsx). */
  | 'team-piece'

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
  'vessel-constellation': true,
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
  'team-piece': true,
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

/* ------------------------------------------------------------------ */
/* The workshop team's pieces                                          */
/* ------------------------------------------------------------------ */

/** Where the workshop team's GLBs live (scripts/import-team-models.mjs writes them; models/teamPiece.tsx preloads them). */
export const TEAM_MODEL_DIR = '/models/team/'

/**
 * A team piece stands on a podium of the row, on the Herd's plinth (grandObjects/crafts.ts `herdPlace`), or on
 * the floor plinth beside the Herd (`herdFloorPlace`: the life-size horse).
 */
export type TeamPlace = { podium: string } | { herd: true } | { floor: true }

export interface TeamPiece {
  slug: string
  /** Its scene object's id when a model is shown more than once (the Bankura horse at two sizes); default `team-<slug>`. */
  id?: string
  place: TeamPlace
  /** Titles from the file names, [en, hi, bn]. */
  title: Lang3
  /** Display height (m): the height scripts/import-team-models.mjs bakes into the GLB (base at y = 0). */
  height: number
  /** The GLB's footprint [x, z] at that height (m, before rotation): its click box and collider. */
  size: [number, number]
  /** Turn (deg) away from facing the court: animals stand three-quarters to the visitor. */
  turn?: number
  /** Flat pieces stand upright in a low slotted brass base (models/teamPiece.tsx PlaqueStand). */
  stand?: boolean
  /**
   * The label: the workshop's caption for the piece, verbatim, from its deck "clay craft 3d.pptx" (`slide`), a
   * full stop added where the slide's text ends without one. The two pieces the deck has no slide for carry a
   * caption the museum wrote from what they show, saying "in the manner of" where their place is not recorded.
   */
  caption: string
  /** The deck's slide the caption comes from; absent = written by the museum. */
  slide?: number
  /** A museum's note after the caption (how the piece is shown). */
  note?: string
  alt: string
}

/** The Bankura horse is shown at two sizes (one GLB): each copy's label says so after the workshop's caption. */
const HORSE_SIZES_NOTE =
  'Bankura’s horses are made in many sizes, from small toys to votive horses taller than a person: this one is shown twice here, life-size on the floor beside the Herd and slightly smaller high on the Herd’s top step.'

/**
 * The workshop's own pieces (the craft deliverables the design held the podium row empty for): sixteen
 * textured 3D models, fourteen on the podiums of the row (12 in × 12 in at 4 ft, each under its own sconce)
 * and the two horses with the Herd — the Bankura horse twice, as such horses are made in many sizes:
 * slightly smaller than life high on the Herd's top step and life-size on the floor beside it; the horse
 * figurine on the Herd's front step. Grouped by what can be seen:
 *   A, warm red wall   the four figures — a standing figure, two women seated at work, dancers — and the
 *                      horses with the Herd
 *   B, white wall      the flat pieces, upright on slotted stands: the peacock pair and the round plaque,
 *                      then the three blue-painted pieces together, and the frame of miniature pots by C
 *   C, charcoal wall   the black elephant and the three Ganeshas (the black one under glass)
 * Each podium piece fits its podium's top (≤ 0.28 m, inside the glass hood where there is one) at its display
 * height. Titles come from the file names; each piece's label is its caption (`caption`), so none is a placeholder.
 */
export const TEAM_PIECES_SPEC: readonly TeamPiece[] = [
  // ── A ──
  {
    slug: 'silent-sentinel',
    place: { podium: 'pod-a-1' },
    title: ['Silent Sentinel', 'मौन प्रहरी', 'নীরব প্রহরী'],
    height: 0.45,
    size: [0.22, 0.16],
    caption:
      'Handcrafted in the pottery of Krishnanagar, West Bengal, this terracotta sculpture depicts a stylized standing bearded sentinel with a dark-burnished umber patina. Shaped from fine Jalangi riverbed alluvial clay using traditional tools and local kiln-firing, the figure features an elongated conical torso, expressive circular eyes, a rounded turban, a pleated collar, a handbell, and a hip pouch, celebrating the sculptural heritage of Krishnanagar master potters.',
    slide: 9,
    alt: 'A tall brown figure of a bearded man in a round cap, one hand raised to his face, a small pot at his side.',
  },
  {
    slug: 'harvest-guardian',
    place: { podium: 'pod-a-2' },
    title: ['Harvest Guardian', 'फ़सल की रखवाली', 'ফসলের পাহারা'],
    height: 0.25,
    size: [0.27, 0.23],
    caption:
      'Modelled in the lifelike manner of the Ghurni clay dolls (Krishnanagar matir putul) of Nadia district, West Bengal, this hand-painted miniature shows a village woman seated cross-legged at work after the harvest. Wrapped in a crimson sari, with a red bindi and dark hair, she holds a shallow winnowing tray heaped with grain, while four small bowls of grain stand around her and a few loose stalks lie at her feet on a low earthen board. Like the realist figures of Krishnanagar, it turns an everyday task of rural life into a quiet, closely observed portrait.',
    alt: 'A seated woman in a red sari with a tray of grain in her hands and bowls of grain around her.',
  },
  {
    slug: 'the-basket-weaver',
    place: { podium: 'pod-a-3' },
    title: ['The Basket Weaver', 'टोकरी बुनने वाली', 'ঝুড়ি বোনার কারিগর'],
    height: 0.22,
    size: [0.22, 0.27],
    caption:
      'Originating from Ghurni, Krishnanagar, in West Bengal Nadia district, this handcrafted Ghurni Clay Doll (Krishnanagar matir putul) depicts a seated female basket weaver immersed in her craft with lifelike realism. Draped in a purple-and-white patterned sari with a red bindi and dark hair, she bends forward to weave split bamboo into a rounded basket, accompanied by a small ceramic water bowl. Crafted for over two centuries by master kumbhakar (potter) artisans, these miniature sculptures are hand-modeled over wire and bamboo armatures using fine alluvial riverbed clay (etail mati) from the Jalangi River. Sun-dried or lightly baked, and finished with delicate hand-painted brushwork and mixed-media bamboo detailing, they celebrate the intimate storytelling of Bengal’s miniature clay-modeling heritage.',
    slide: 10,
    alt: 'A seated woman in a purple sari weaving a round basket on a mat.',
  },
  {
    slug: 'festival-dancers',
    place: { podium: 'pod-a-4' },
    title: ['Festival Dancers', 'उत्सव के नर्तक', 'উৎসবের নর্তক'],
    height: 0.355,
    size: [0.27, 0.13],
    caption:
      'Originating from the famed artisan quarter of Ghurni in Krishnanagar, Nadia district, West Bengal, this handcrafted Ghurni Clay Doll (Krishnanagar matir putul) depicts a lively pair of traditional tribal festival performers—a male drummer (madal player) and a female dancer—captured mid-celebration with lifelike anatomical realism and expressive grace. Dressed in vibrant yellow and crimson-red festive attire, the male figure wears a red headband crowned with colorful plumage as he plays a cylindrical madal drum slung across his shoulder, while his companion balances a painted ceremonial vessel topped with golden-orange plumes on her head, holding white dance clothes in each hand.',
    slide: 4,
    alt: 'Two dancing figures: a drummer in a feathered turban and a woman in a yellow sari balancing pots on her head.',
  },
  // the Bankura horse twice, as such horses are made in many sizes: slightly smaller than life high on the
  // Herd's top step, and life-size on the floor beside it (one GLB; its footprint scales with the height)
  {
    slug: 'bankura-horse',
    place: { herd: true },
    title: ['Bankura Horse', 'बाँकुड़ा घोड़ा', 'বাঁকুড়ার ঘোড়া'],
    height: 1.6,
    size: [0.39, 0.89],
    // head-on to the court, no three-quarter turn: its 0.89 m body then spans the top step's 1.0 m with room
    caption:
      'Handcrafted in West Bengal\'s Krishnanagar, this terracotta ceremonial horse features the classic Bankura votive silhouette with a dark-burnished umber finish. Characterized by a towering neck, alert ears, curved reins, and a relief-molded saddle, the figure is sculpted from fine Jalangi riverbed alluvial clay (etail mati). Shaped by hand and wheel using traditional tools and kiln-fired with natural slips, this sculpture showcases the enduring heritage of Bengal\'s master potters.',
    slide: 13,
    note: HORSE_SIZES_NOTE,
    alt: 'A brown horse figure with a very long upright neck, pricked ears and a decorated saddle cloth.',
  },
  {
    slug: 'bankura-horse',
    id: 'team-bankura-horse-life-size',
    place: { floor: true },
    title: ['Bankura Horse (life-size)', 'बाँकुड़ा घोड़ा (पूरे आकार का)', 'বাঁকুড়ার ঘোড়া (পূর্ণ আকারের)'],
    height: 2.2,
    size: [0.54, 1.22],
    // head-on to the court, so its floor plinth stays narrow (crafts.ts HERD_FLOOR)
    caption:
      'Handcrafted in West Bengal\'s Krishnanagar, this terracotta ceremonial horse features the classic Bankura votive silhouette with a dark-burnished umber finish. Characterized by a towering neck, alert ears, curved reins, and a relief-molded saddle, the figure is sculpted from fine Jalangi riverbed alluvial clay (etail mati). Shaped by hand and wheel using traditional tools and kiln-fired with natural slips, this sculpture showcases the enduring heritage of Bengal\'s master potters.',
    slide: 13,
    note: HORSE_SIZES_NOTE,
    alt: 'A brown horse figure with a very long upright neck, pricked ears and a decorated saddle cloth.',
  },
  {
    slug: 'horse-figurine',
    place: { herd: true },
    title: ['Horse Figurine', 'घोड़े की मूर्तिका', 'ঘোড়ার ছোট মূর্তি'],
    height: 0.38,
    size: [0.1, 0.25],
    turn: 35,
    caption:
      'Originating from the famed pottery workshops of Krishnanagar in Nadia district, West Bengal, this handcrafted Krishnanagar Terracotta sculpture presents a stately, stylized ceremonial horse standing in proud, upright poise with a rich, dark-burnished finish. Sculpted with an elongated, arched neck, finely incised flowing mane, pointed ears, and an upturned tail, the figure is adorned with delicate relief-molded harnesses, saddle trappings, and banded leg ornaments that echo West Bengal’s age-old votive horse traditions.',
    slide: 5,
    alt: 'A brown horse figure with a carved mane, a curled tail and a saddle cloth.',
  },
  // ── B ──
  {
    slug: 'peacock-shubh-labh',
    place: { podium: 'pod-b-1' },
    title: ['Peacock Shubh Labh', 'मोर शुभ लाभ', 'ময়ূর শুভ লাভ'],
    height: 0.24,
    size: [0.26, 0.07],
    stand: true,
    caption:
      'Handcrafted in Kutch, Gujarat, this pair of Mud & Mirror Work (Lippan Kaam) wall hangings features mirrored peacock silhouettes symbolizing auspiciousness. Set on a midnight-navy base, each paisley-curved body showcases turquoise plumage, inlaid mirrors (abhla), pearl-white beads, and raised gold Gujarati script for "Shubh" (Auspiciousness) and "Labh" (Prosperity), topped by arched necks and golden crests. Rooted in Kutch\'s pastoral mural traditions, artisans sculpt local clay and mud relief coils by hand, embedding gleaming mirrors to celebrate the shimmering elegance of Lippan heritage.',
    slide: 11,
    alt: 'Two blue peacock-shaped plaques side by side, lettered Shubh and Labh in gold.',
  },
  {
    slug: 'sunset-shores',
    place: { podium: 'pod-b-2' },
    title: ['Sunset Shores', 'सूर्यास्त का तट', 'সূর্যাস্তের তীর'],
    height: 0.25,
    size: [0.25, 0.07],
    stand: true,
    caption:
      'Originating from the arid desert villages of Kutch, Gujarat, this handcrafted Mud & Mirror Work (Lippan Kaam) circular wall plaque reimagines traditional relief artistry through a serene coastal sunset landscape. Framed by a terracotta-red border inlaid with triangular mirrors (abhla), the relief depicts a glowing orange sun descending behind emerald-green mountains against a golden sky with soaring birds. Below, layered cobalt and turquoise waves lap onto a warm sandy shore accented by dark pebbles. Rooted in Kutch\'s vernacular mural tradition, artisans sculpt raised contours from local clay and natural binders, embedding cut mirrors to catch the light and celebrate the tactile warmth and contemporary storytelling of Lippan heritage.',
    slide: 8,
    alt: 'A round plaque of a beach at sunset: sun, green hills, blue waves and sand, in a border of triangles.',
  },
  {
    slug: 'hand-of-blue-blossoms',
    place: { podium: 'pod-b-3' },
    title: ['Hand of Blue Blossoms', 'नीले फूलों वाला हाथ', 'নীল ফুলের হাত'],
    height: 0.28,
    size: [0.16, 0.07],
    stand: true,
    caption:
      'Handcrafted in Jaipur, Rajasthan, this Blue Pottery Hamsa—a protective stylized palm—unites auspicious symbolism with vibrant botanical artistry. Framed by a yellow rim, the pale sky-blue fingers feature dark-lined articulation above a deep cobalt palm showcasing a turquoise blossom with a terracotta center and white foliage. Unlike traditional clay ceramics, Jaipur\'s Turko-Persian-inspired art uses a unique quartz-stone dough molded without clay. Freehand-painted with mineral oxides, glazed in transparent alkaline, and low-fire glazed, it achieves a signature glass-like sheen and translucent depth.',
    slide: 1,
    alt: 'A hand-shaped plaque with light blue fingers and a dark blue palm painted with a flower.',
  },
  {
    slug: 'blue-floral-tile',
    place: { podium: 'pod-b-4' },
    title: ['Blue Floral Tile', 'नीली फूलदार टाइल', 'নীল ফুলেল টালি'],
    height: 0.2,
    size: [0.2, 0.07],
    stand: true,
    caption:
      'Handcrafted in Jaipur, Rajasthan, this Blue Pottery architectural tile features a symmetrical, diagonal botanical design with sage-green foliage, budding blossoms, and white-and-turquoise flowers with terracotta-coral and yellow centers against a cobalt-blue ground, framed in white, black, and cobalt. Rooted in Mughal and Turko-Persian traditions, Jaipur Blue Pottery is uniquely made without clay from a dough of crushed quartz, powdered glass, Fuller\'s earth, borax, gum, and water. Hand-molded and freehand-painted with natural mineral oxides—cobalt, copper, chrome, and iron—the tile is finished with a transparent alkaline glaze and low-fired for a glass-like sheen and jewel-toned clarity.',
    slide: 3,
    alt: 'A square deep blue tile painted with white flowers and green leaves.',
  },
  {
    slug: 'blossom-bowl',
    place: { podium: 'pod-b-5' },
    title: ['Blossom Bowl', 'फूलों वाला कटोरा', 'ফুলের বাটি'],
    height: 0.3,
    size: [0.21, 0.07],
    stand: true,
    caption:
      'Painted in the colours and manner of Jaipur Blue Pottery from Rajasthan, this shallow oval bowl is shown upright on its rim so that its painted inside can be seen. Dark cobalt-blue blossoms with brown buds and curling white leaves spread across a turquoise ground, framed by a fine white line. Jaipur’s blue pottery is known for this cool palette of cobalt, turquoise and white: rather than ordinary clay, it is shaped from a dough of crushed quartz and glass, painted freehand with mineral oxides and sealed under a clear, low-fired glaze.',
    alt: 'An oval bowl painted with blue flowers and white leaves on turquoise, standing upright.',
  },
  {
    slug: 'miniature-pottery',
    place: { podium: 'pod-b-6' },
    title: ['Miniature Pottery', 'लघु मृद्भांड', 'ক্ষুদ্র মৃৎপাত্র'],
    height: 0.26,
    size: [0.27, 0.07],
    stand: true,
    caption:
      'Hailing from Nizamabad, Uttar Pradesh, this curated shadow-box features twenty-five wheel-thrown micro-vessels in a natural wooden grid. Spanning classic silhouettes like surahi flasks, matka pots, urns, and tumblers, the collection pairs signature lustrous black pottery with terracotta-red and olive-brown variations, etched with silvery-white floral and geometric patterns. Crafted from local clay, each vessel is treated with a kabiz bark and mustard oil slip, burnished, and smoke-fired in a rice-husk reduction kiln before its incised details are highlighted with a zinc-mercury amalgam (ranga), celebrating the precision of Nizamabad miniature ceramic artistry.',
    slide: 7,
    alt: 'A square frame of twenty-five cubbies, each with a tiny pot, most of them black.',
  },
  // ── C ──
  {
    slug: 'black-elephant',
    place: { podium: 'pod-c-1' },
    title: ['Black Elephant', 'काला हाथी', 'কালো হাতি'],
    height: 0.19,
    size: [0.12, 0.26],
    turn: -40,
    caption:
      'Handcrafted in Nizamabad, Uttar Pradesh, this ceremonial elephant sculpture showcases the region\'s renowned black pottery with a rich metallic-black luster and obsidian sheen. The stoutly modeled figure features an upturned trunk, ridged ears, and intricate relief-molded royal trappings, including a braided browband, crown medallion, patterned saddle cloth, and leg bands. Crafted from local clay, the piece is treated with an herbal kabiz bark and mustard oil slip, burnished to a satin smoothness, and smoke-fired in a reduction kiln fueled by rice husk and dried leaves to infuse carbon deeply into the clay without artificial glazes.',
    slide: 12,
    alt: 'A small black elephant figure with its trunk curled and a patterned cloth on its back.',
  },
  {
    slug: 'black-ganesha-statue',
    place: { podium: 'pod-c-2' },
    title: ['Black Ganesha Statue', 'काली गणेश प्रतिमा', 'কালো গণেশ মূর্তি'],
    height: 0.38,
    size: [0.24, 0.22],
    caption:
      'Hailing from the historic ceramic workshops of Nizamabad in Azamgarh, Uttar Pradesh, this handcrafted Nizamabad Black Pottery sculpture depicts a minimalist, rounded idol of Lord Ganesha with a lustrous, metallic-black sheen. Smoothly contoured with large, ridged ears, delicate etched facial markings, and a gently curving trunk resting over a globular torso, the form balances sacred iconography with tactile, sculptural simplicity.',
    slide: 2,
    alt: 'A smooth, rounded black Ganesha with broad ears and a curving trunk.',
  },
  {
    slug: 'mud-ganesha',
    place: { podium: 'pod-c-3' },
    title: ['Mud Ganesha', 'मिट्टी के गणेश', 'মাটির গণেশ'],
    height: 0.36,
    size: [0.22, 0.2],
    caption:
      'Handcrafted in West Bengal\'s Krishnanagar workshops, this stylized Lord Ganesha terracotta sculpture features an umber-and-ochre patina, ornate leaf-crested headgear, and a bead garland. Modeled from fine Jalangi riverbed alluvial clay using traditional tools, the piece is kiln-baked and finished with natural earthy slips to highlight its organic textures and devotional artistry.',
    slide: 6,
    alt: 'A red-brown Ganesha with a tall crown and a garland of beads, on a round pedestal.',
  },
  {
    slug: 'twin-clay-ganeshas',
    place: { podium: 'pod-c-4' },
    title: ['Twin Clay Ganeshas', 'मिट्टी के जुड़वाँ गणेश', 'মাটির যমজ গণেশ'],
    height: 0.17,
    size: [0.27, 0.12],
    caption:
      'Handcrafted in Krishnanagar, West Bengal, this pair of miniature terracotta Lord Ganesha idols features twin seated figures shaped from fine Jalangi riverbed alluvial clay (etail mati). Hand-pinched with organic fluidity, each figure wears a tiered conical headdress and displays ridged ears, applied eyes, and inward-curling trunks. Baked in local kilns without artificial glazes, the raw burnt-sienna sculptures showcase the traditional sculptural heritage of Krishnanagar\'s master potters.',
    slide: 14,
    alt: 'Two small orange clay Ganeshas seated side by side.',
  },
]

function teamObject(p: TeamPiece): SceneObjectConfig {
  let where: { position: Vec3; rotationDeg: number; zone: ZoneId }
  if ('podium' in p.place) {
    const id = p.place.podium
    const slot = PODIUM_SLOTS.find((s) => s.id === id)
    if (!slot) throw new Error(`objects.ts: unknown podium slot ${id}`)
    // on the podium's top (a hooded podium's: its base plate), the podium's front (+z) facing the court
    where = { position: [slot.x, podiumStandY(slot.id), slot.z], rotationDeg: slot.rotationY / DEG + (p.turn ?? 0), zone: slot.zone }
  } else if ('floor' in p.place) {
    const f = herdFloorPlace()
    where = { position: f.position, rotationDeg: facingIn(f.aDeg) + (p.turn ?? 0), zone: f.zone }
  } else {
    const h = herdPlace(p.slug)
    where = { position: h.position, rotationDeg: facingIn(h.aDeg) + (p.turn ?? 0), zone: h.zone }
  }
  return {
    id: p.id ?? `team-${p.slug}`,
    title: p.title[0],
    kind: 'team-piece',
    model: `${TEAM_MODEL_DIR}${p.slug}.glb`,
    ...where,
    footprint: p.size,
    height: p.height,
    ...(p.stand ? { props: { stand: 'slot' } } : {}),
    interactive: true,
    inspectable: true,
    description: p.note ? `${p.caption} ${p.note}` : p.caption,
    placeholder: false,
    alt: p.alt,
    i18n: { hi: { title: p.title[1] }, bn: { title: p.title[2] } },
  }
}

/** The sixteen team pieces as scene objects (`team-<slug>`), in walking order A → B → C. */
export const TEAM_PIECES: SceneObjectConfig[] = TEAM_PIECES_SPEC.map(teamObject)

/**
 * The procedural stand-ins the team's pieces took the place of: the podium row's fourteen and the Herd's two
 * front horses, each with the piece that now stands there. A content store seeded before this still holds
 * them; scripts/sync-team-models.mjs removes them there (only while they are untouched stand-ins).
 */
export const TEAM_REPLACES: readonly { id: string; by: string }[] = [
  { id: 'clay-a-horse', by: 'team-silent-sentinel' },
  { id: 'clay-a-horse-small', by: 'team-harvest-guardian' },
  { id: 'clay-a-pot', by: 'team-the-basket-weaver' },
  { id: 'craft-bankura-podium-plaque', by: 'team-festival-dancers' },
  { id: 'craft-bankura-herd-1', by: 'team-bankura-horse' },
  // the Bankura horse moved up to the top step at 1.6 m, in the place of the Herd's tallest stand-in
  { id: 'craft-bankura-herd-9', by: 'team-bankura-horse' },
  { id: 'craft-bankura-herd-2', by: 'team-horse-figurine' },
  { id: 'clay-b-plaque-rider', by: 'team-peacock-shubh-labh' },
  { id: 'clay-b-cups', by: 'team-sunset-shores' },
  { id: 'clay-b-plaque-deity', by: 'team-hand-of-blue-blossoms' },
  { id: 'clay-b-lamp', by: 'team-blue-floral-tile' },
  { id: 'clay-b-plaque-serpent', by: 'team-blossom-bowl' },
  { id: 'craft-molela-podium-pot', by: 'team-miniature-pottery' },
  { id: 'clay-c-kettle', by: 'team-black-elephant' },
  { id: 'clay-c-bowl', by: 'team-black-ganesha-statue' },
  { id: 'clay-c-pot', by: 'team-mud-ganesha' },
  { id: 'craft-longpi-podium-bowl', by: 'team-twin-clay-ganeshas' },
]

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

  // ── The podium row, A → B → C, and the Herd's front step: the workshop team's pieces ──
  ...TEAM_PIECES,

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
