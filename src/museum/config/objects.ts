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
import { GRAND_CRAFTS_OBJECTS, herdPlace } from './grandObjects/crafts'
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

/** A team piece stands on a podium of the row, or on the Herd's plinth (grandObjects/crafts.ts `herdPlace`). */
type TeamPlace = { podium: string } | { herd: true }

interface TeamPiece {
  slug: string
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
  /** What is visible, nothing more: no maker, place, material or date the workshop has not given. */
  text: string
  alt: string
}

/** Every team piece's description ends with this until the workshop's details arrive (`placeholder: true`). */
const TEAM_NOTE = 'A piece from the workshop’s team, shown from its 3D model. Its maker, place and materials are still to be recorded.'

/**
 * The workshop's own pieces (the craft deliverables the design held the podium row empty for): sixteen
 * textured 3D models, one per podium of the row (12 in × 12 in at 4 ft, each under its own sconce) and
 * two on the front step of the Herd. Grouped by what can be seen, never by a tradition the workshop has
 * not named:
 *   A, warm red wall   the four figures — a standing figure, two women seated at work, dancers — and the
 *                      two horses with the Herd (only the Bankura Horse's name places it)
 *   B, white wall      the flat pieces, upright on slotted stands: the peacock pair and the round plaque,
 *                      then the three blue-painted pieces together, and the frame of miniature pots by C
 *   C, charcoal wall   the black elephant and the three Ganeshas (the black one under glass)
 * Each fits its podium's top (≤ 0.28 m, inside the glass hood where there is one) at its display height.
 * Titles come from the file names; every piece stays `placeholder: true` for the curators.
 */
const TEAM_PIECES_SPEC: TeamPiece[] = [
  // ── A ──
  {
    slug: 'silent-sentinel',
    place: { podium: 'pod-a-1' },
    title: ['Silent Sentinel', 'मौन प्रहरी', 'নীরব প্রহরী'],
    height: 0.45,
    size: [0.22, 0.16],
    text: 'A standing figure with a full beard, a round cap and heavy earrings. One hand is raised beside his face holding a small bell-shaped object; the other holds a small pot at his side. His robe flares to a fluted hem, and the whole surface is a glossy deep brown.',
    alt: 'A tall brown figure of a bearded man in a round cap, one hand raised to his face, a small pot at his side.',
  },
  {
    slug: 'harvest-guardian',
    place: { podium: 'pod-a-2' },
    title: ['Harvest Guardian', 'फ़सल की रखवाली', 'ফসলের পাহারা'],
    height: 0.25,
    size: [0.27, 0.23],
    text: 'A woman in a red sari sits cross-legged on a dark board, holding a shallow tray heaped with grain. Four bowls of grain stand around her and a few loose stalks lie at her feet.',
    alt: 'A seated woman in a red sari with a tray of grain in her hands and bowls of grain around her.',
  },
  {
    slug: 'the-basket-weaver',
    place: { podium: 'pod-a-3' },
    title: ['The Basket Weaver', 'टोकरी बुनने वाली', 'ঝুড়ি বোনার কারিগর'],
    height: 0.22,
    size: [0.22, 0.27],
    text: 'A woman in a purple patterned sari sits on a dark mat, weaving a round basket in front of her; its upright strands are not yet worked in. A small metal bowl stands at her side.',
    alt: 'A seated woman in a purple sari weaving a round basket on a mat.',
  },
  {
    slug: 'festival-dancers',
    place: { podium: 'pod-a-4' },
    title: ['Festival Dancers', 'उत्सव के नर्तक', 'উৎসবের নর্তক'],
    height: 0.355,
    size: [0.27, 0.13],
    text: 'Two dancers in yellow and red. A man in a feathered red turban beats a drum slung at his waist; beside him a woman in a yellow sari balances a stack of pots crowned with a sheaf on her head and holds a white cloth in each hand.',
    alt: 'Two dancing figures: a drummer in a feathered turban and a woman in a yellow sari balancing pots on her head.',
  },
  {
    slug: 'bankura-horse',
    place: { herd: true },
    title: ['Bankura Horse', 'बाँकुड़ा घोड़ा', 'বাঁকুড়ার ঘোড়া'],
    height: 0.45,
    size: [0.11, 0.25],
    turn: -35,
    text: 'A horse standing square on four column legs, its long neck held straight up, ears pricked and a crest between them. Bands of ornament run round the neck and over the saddle cloth; the surface is a glossy deep brown.',
    alt: 'A brown horse figure with a very long upright neck, pricked ears and a decorated saddle cloth.',
  },
  {
    slug: 'horse-figurine',
    place: { herd: true },
    title: ['Horse Figurine', 'घोड़े की मूर्तिका', 'ঘোড়ার ছোট মূর্তি'],
    height: 0.38,
    size: [0.1, 0.25],
    turn: 35,
    text: 'A standing horse with a carved mane falling down its neck, a raised tail curled at the tip and a patterned saddle cloth, in a glossy warm brown.',
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
    text: 'A pair of plaques, each shaped as a blue peacock curving round a dark medallion edged with white beads. The medallions carry the words ‘Shubh’ and ‘Labh’ in gold.',
    alt: 'Two blue peacock-shaped plaques side by side, lettered Shubh and Labh in gold.',
  },
  {
    slug: 'sunset-shores',
    place: { podium: 'pod-b-2' },
    title: ['Sunset Shores', 'सूर्यास्त का तट', 'সূর্যাস্তের তীর'],
    height: 0.25,
    size: [0.25, 0.07],
    stand: true,
    text: 'A round plaque with a seashore in low relief: an orange sun between green hills, blue waves breaking on a sandy beach and dark blue shrubs along the bottom, inside a border of red and pale triangles.',
    alt: 'A round plaque of a beach at sunset: sun, green hills, blue waves and sand, in a border of triangles.',
  },
  {
    slug: 'hand-of-blue-blossoms',
    place: { podium: 'pod-b-3' },
    title: ['Hand of Blue Blossoms', 'नीले फूलों वाला हाथ', 'নীল ফুলের হাত'],
    height: 0.28,
    size: [0.16, 0.07],
    stand: true,
    text: 'A plaque in the shape of an open hand, fingers up, outlined in yellow: pale blue fingers above a deep blue palm painted with one turquoise flower and white leaves.',
    alt: 'A hand-shaped plaque with light blue fingers and a dark blue palm painted with a flower.',
  },
  {
    slug: 'blue-floral-tile',
    place: { podium: 'pod-b-4' },
    title: ['Blue Floral Tile', 'नीली फूलदार टाइल', 'নীল ফুলেল টালি'],
    height: 0.2,
    size: [0.2, 0.07],
    stand: true,
    text: 'A square tile on a deep blue ground with a white border, painted with white and yellow flowers, red buds and green leaves on curling stems.',
    alt: 'A square deep blue tile painted with white flowers and green leaves.',
  },
  {
    slug: 'blossom-bowl',
    place: { podium: 'pod-b-5' },
    title: ['Blossom Bowl', 'फूलों वाला कटोरा', 'ফুলের বাটি'],
    height: 0.3,
    size: [0.21, 0.07],
    stand: true,
    text: 'A shallow oval bowl, shown upright on its rim so its inside can be seen: white leaves and dark blue flowers with brown buds on a turquoise ground, within a white line.',
    alt: 'An oval bowl painted with blue flowers and white leaves on turquoise, standing upright.',
  },
  {
    slug: 'miniature-pottery',
    place: { podium: 'pod-b-6' },
    title: ['Miniature Pottery', 'लघु मृद्भांड', 'ক্ষুদ্র মৃৎপাত্র'],
    height: 0.26,
    size: [0.27, 0.07],
    stand: true,
    text: 'A square frame of twenty-five small compartments, each holding one miniature pot. Most are black, a few red or brown; several carry fine white lines.',
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
    text: 'A standing elephant in black, its trunk curled up at the tip, with a cloth worked in raised patterns over its back and bands round its legs.',
    alt: 'A small black elephant figure with its trunk curled and a patterned cloth on its back.',
  },
  {
    slug: 'black-ganesha-statue',
    place: { podium: 'pod-c-2' },
    title: ['Black Ganesha Statue', 'काली गणेश प्रतिमा', 'কালো গণেশ মূর্তি'],
    height: 0.38,
    size: [0.24, 0.22],
    text: 'A smooth, rounded figure of Ganesha in black: an egg-shaped body, broad ears spread wide and a trunk curving down over the belly, with a small point at the crown.',
    alt: 'A smooth, rounded black Ganesha with broad ears and a curving trunk.',
  },
  {
    slug: 'mud-ganesha',
    place: { podium: 'pod-c-3' },
    title: ['Mud Ganesha', 'मिट्टी के गणेश', 'মাটির গণেশ'],
    height: 0.36,
    size: [0.22, 0.2],
    text: 'Ganesha on a round pedestal, with a tall pointed crown, a trunk curling to one side and a garland of large beads hanging round him, in a mottled red-brown.',
    alt: 'A red-brown Ganesha with a tall crown and a garland of beads, on a round pedestal.',
  },
  {
    slug: 'twin-clay-ganeshas',
    place: { podium: 'pod-c-4' },
    title: ['Twin Clay Ganeshas', 'मिट्टी के जुड़वाँ गणेश', 'মাটির যমজ গণেশ'],
    height: 0.17,
    size: [0.27, 0.12],
    text: 'Two small seated Ganeshas side by side in orange clay, each with its trunk curled across its body, its ears spread and a pointed crown, modelled in soft coils.',
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
  } else {
    const h = herdPlace(p.slug)
    where = { position: h.position, rotationDeg: facingIn(h.aDeg) + (p.turn ?? 0), zone: h.zone }
  }
  return {
    id: `team-${p.slug}`,
    title: p.title[0],
    kind: 'team-piece',
    model: `${TEAM_MODEL_DIR}${p.slug}.glb`,
    ...where,
    footprint: p.size,
    height: p.height,
    ...(p.stand ? { props: { stand: 'slot' } } : {}),
    interactive: true,
    inspectable: true,
    description: `${p.text} ${TEAM_NOTE}`,
    placeholder: true,
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
