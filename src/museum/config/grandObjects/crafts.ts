/**
 * Grand scene objects: the 21 traditions' pieces and the placed sourced models (GRAND §4, §5.4
 * exhibits). Spread into SCENE_OBJECTS (config/objects.ts). Owned by P2.
 *
 * Where the pieces stand, in walking order:
 *   forecourt      two 4.2 m Ayyanar guardian horses flanking the approach
 *   gallery A      the fourth podium; The Herd, nine horses on a three-step red plinth
 *   gallery B      the sixth podium; plaques up to 1.1 m in the five niches of the white wall;
 *                  a maker's table with a plaque in progress
 *   gallery C      the fourth podium; the black ware island under one cool beam
 *   upper register 24 pieces on brackets over A, B and C; 12 Bishnupur-style relief panels
 *   F, the court   the niche figure ("form rising from matter") on a 1.4 m plinth
 *   F, corridor    the lippan wall: 25 m of mud-and-mirror relief
 *   Wine Hall      "Clay Elsewhere": scans of clay from other places and times, each as itself,
 *                  credited, on the wine plinths W1–W6, and a relief on the end wall
 *   Parikrama      13 pieces in the tall walls' niches, one per tradition
 *   theatre lobby  a Kumartuli figure in progress; five Majuli masks on stands
 *   Red Room       the survey: five regional bays on the red shelves, an Andro coil pot cut
 *                  open on the central plinth
 *   Earth Room     everyday clay on the round table
 *
 * Silence (GRAND §4.1): every piece is a placeholder with a descriptive title ("Glazed Vase —
 * Study"). The tradition's name, place and caption (content/crafts.ts) are in its description
 * only in curator review (`?review`) or once the list is confirmed (content/review.ts); until
 * then the description gives the region only. Sourced scans of objects from elsewhere carry
 * their own museum's credit and are never given an Indian tradition's name.
 *
 * The pieces that stand on the installations package's furniture (the wine plinths, the Red
 * Room's shelves and plinth, the Earth Room's table: config/grandObjects/installations.ts) are
 * placed on that furniture's surfaces, read from its objects' props; where the furniture is not
 * there, the pieces get display furniture of their own. Positions are expressions of the named
 * constants in museum.ts and satellites.ts (tests/unit/grand-literals.test.ts).
 */
import { CRAFTS, REGIONS, type CraftRegion, type CraftSlug } from '../../content/crafts'
import { traditionsVisible } from '../../content/review'
import { STUDY_NOTE, type TraditionKey } from '../artworks'
import { PODIUM_SLOTS, SURFACES, surfacePoint, type SurfaceId, type ZoneId } from '../layout'
import { DEG, KEY, MUSEUM, polar, type Vec3 } from '../museum'
import type { SceneObjectConfig } from '../objects'
import { RED_ROOM, SATELLITES, SAT_WALL, SERPENTINE, THEATRE, serpentineOffset, serpentineOuterRuns } from '../satellites'
import { SOURCED_REGISTRY } from '../sourcedRegistry.generated'
import { at, facingIn } from '../spectacleObjects/place'
import { GRAND_INSTALLATIONS_OBJECTS } from './installations'

type Lang3 = [string, string, string]
type Props = Record<string, string | number | boolean>

/* ------------------------------------------------------------------ */
/* Words                                                               */
/* ------------------------------------------------------------------ */

const STUDY: Lang3 = [' — Study', ' — अध्ययन', ' — চর্চা']
const study = (t: Lang3): Lang3 => [t[0] + STUDY[0], t[1] + STUDY[1], t[2] + STUDY[2]]

/** Descriptive form names (titles never name a tradition). */
const W = {
  waterPot: ['Water Pot', 'पानी का घड़ा', 'জলের কলসি'],
  surahi: ['Water Flask', 'सुराही', 'সুরাই'],
  cup: ['Cup', 'कुल्हड़', 'ভাঁড়'],
  lamp: ['Oil Lamp', 'दीया', 'প্রদীপ'],
  kettle: ['Kettle', 'केतली', 'কেটলি'],
  bowl: ['Bowl', 'कटोरा', 'বাটি'],
  cookingPot: ['Cooking Pot', 'हाँडी', 'হাঁড়ি'],
  griddle: ['Griddle', 'तवा', 'তাওয়া'],
  tray: ['Tray', 'थाली', 'থালা'],
  lidded: ['Lidded Jar', 'ढक्कनदार मर्तबान', 'ঢাকনাওয়ালা বয়াম'],
  jar: ['Storage Jar', 'मर्तबान', 'বয়াম'],
  vase: ['Vase', 'फूलदान', 'ফুলদানি'],
  ghatam: ['Pot Drum', 'घटम', 'ঘটম'],
  horse: ['Horse', 'घोड़ा', 'ঘোড়া'],
  smallHorse: ['Small Horse', 'छोटा घोड़ा', 'ছোট ঘোড়া'],
  ornateHorse: ['Ornamented Horse', 'सजा हुआ घोड़ा', 'সাজানো ঘোড়া'],
  smokedHorse: ['Smoke-fired Horse', 'धुएँ में पका घोड़ा', 'ধোঁয়ায় পোড়া ঘোড়া'],
  guardian: ['Guardian Horse', 'रक्षक घोड़ा', 'রক্ষক ঘোড়া'],
  plaque: ['Plaque', 'पट्टिका', 'ফলক'],
  relief: ['Relief Panel', 'उभरा फलक', 'রিলিফ ফলক'],
  fragment: ['Relief Fragment', 'उभरे फलक का अंश', 'রিলিফের টুকরো'],
  coilPot: ['Coil-built Pot, Cut Open', 'कुंडलियों से बना घड़ा, खुला कटा', 'কুণ্ডলী দিয়ে গড়া পাত্র, কাটা'],
  coiled: ['Coil-built Pot', 'कुंडलियों से बना घड़ा', 'কুণ্ডলী দিয়ে গড়া পাত্র'],
  figure: ['Figure in Progress', 'बनती हुई प्रतिमा', 'তৈরি হতে থাকা প্রতিমা'],
  armature: ['Armature, Straw and Clay', 'ढाँचा, पुआल और मिट्टी', 'কাঠামো, খড় আর মাটি'],
  mask: ['Mask', 'मुखौटा', 'মুখোশ'],
  birdMask: ['Mask: Bird', 'मुखौटा: पक्षी', 'মুখোশ: পাখি'],
  lionMask: ['Mask: Lion', 'मुखौटा: सिंह', 'মুখোশ: সিংহ'],
  roofTile: ['Roof Tile with a Bird', 'पक्षी वाला खपरैल', 'পাখি-বসানো খোলা টালি'],
  figurine: ['Figurine', 'मूर्तिका', 'ছোট মূর্তি'],
  doll: ['Mother-and-Child Doll', 'माँ-बच्चे की गुड़िया', 'মা-ও-শিশু পুতুল'],
  lippan: ['Mud-and-Mirror Relief', 'मिट्टी और शीशे का उभरा काम', 'মাটি আর আয়নার রিলিফ'],
  lippanPanel: ['Mud-and-Mirror Panel', 'मिट्टी और शीशे की पट्टी', 'মাটি আর আয়নার প্যানেল'],
  glazedVase: ['Glazed Vase', 'चमकदार फूलदान', 'চকচকে ফুলদানি'],
  glazedJar: ['Glazed Jar', 'चमकदार मर्तबान', 'চকচকে বয়াম'],
  blackVase: ['Black Vase with Silver Lines', 'चाँदी-सी रेखाओं वाला काला फूलदान', 'রুপোলি রেখার কালো ফুলদানি'],
  blackBowl: ['Black Lidded Bowl', 'ढक्कनदार काला कटोरा', 'ঢাকনাওয়ালা কালো বাটি'],
  paintedPot: ['Painted Pot', 'रँगा हुआ घड़ा', 'রং করা পাত্র'],
  blueJar: ['Blue Floral Jar', 'नीले फूलों वाला मर्तबान', 'নীল ফুলের বয়াম'],
  slipBowl: ['Slip-trailed Bowl', 'स्लिप से सजा कटोरा', 'স্লিপে আঁকা বাটি'],
  ashJar: ['Ash-glazed Jar', 'राख-ग्लेज़ वाला मर्तबान', 'ছাই-গ্লেজের বয়াম'],
  pinkJar: ['Thin-walled Jar', 'पतली दीवार का मर्तबान', 'পাতলা দেওয়ালের বয়াম'],
} satisfies Record<string, Lang3>
type Word = keyof typeof W

/** What a placeholder's description says while the traditions are silent. */
const SILENT: Lang3 = ['A study made for this exhibition.', 'इस प्रदर्शनी के लिए बनाया गया एक अध्ययन।', 'এই প্রদর্শনীর জন্য তৈরি একটি চর্চা।']

const CRAFT = new Map(CRAFTS.map((c) => [c.slug, c]))

/** Description of a piece of a tradition: region (always) and, when visible, the tradition's own text. */
function craftText(slug: CraftSlug, ring?: TraditionKey): { description: string; hi: string; bn: string } {
  const c = CRAFT.get(slug)!
  if (traditionsVisible()) {
    return {
      description: `${c.name} · ${c.place}. ${c.caption}`,
      hi: `${c.i18n.hi?.name ?? c.name} · ${c.i18n.hi?.place ?? c.place}। ${c.i18n.hi?.caption ?? c.caption}`,
      bn: `${c.i18n.bn?.name ?? c.name} · ${c.i18n.bn?.place ?? c.place}। ${c.i18n.bn?.caption ?? c.caption}`,
    }
  }
  // the drawing's three deep dives are already named in their galleries (artworks.ts)
  if (ring) return { description: STUDY_NOTE[ring].en, hi: STUDY_NOTE[ring].hi, bn: STUDY_NOTE[ring].bn }
  const r = REGIONS[c.region as CraftRegion]
  return { description: `${r.en}. ${SILENT[0]}`, hi: `${r.hi}। ${SILENT[1]}`, bn: `${r.bn}। ${SILENT[2]}` }
}

const RING: Partial<Record<CraftSlug, TraditionKey>> = { bankura: 'a', molela: 'b', longpi: 'c' }

interface PieceSpec {
  id: string
  title: Lang3
  craft: CraftSlug
  kind: SceneObjectConfig['kind']
  position: Vec3
  rotationDeg?: number
  height: number
  /** Floor pieces collide; pieces on furniture or walls leave it out. */
  footprint?: [number, number]
  props?: Props
  zone: ZoneId
  alt?: Lang3
  inspectable?: boolean
}

function piece(p: PieceSpec): SceneObjectConfig {
  const t = study(p.title)
  const d = craftText(p.craft, RING[p.craft])
  return {
    id: p.id,
    title: t[0],
    kind: p.kind,
    position: p.position,
    rotationDeg: p.rotationDeg,
    footprint: p.footprint,
    height: p.height,
    props: p.props,
    interactive: true,
    inspectable: p.inspectable ?? p.height < 1.2,
    description: d.description,
    zone: p.zone,
    placeholder: true,
    ...(p.alt ? { alt: p.alt[0] } : {}),
    i18n: { hi: { title: t[1], description: d.hi, ...(p.alt ? { alt: p.alt[1] } : {}) }, bn: { title: t[2], description: d.bn, ...(p.alt ? { alt: p.alt[2] } : {}) } },
  }
}

/** A clay vessel's props. */
const vessel = (form: string, clay: string, burnish = 0.3, decor = 'none'): Props => ({ form, clay, burnish, decor })

/** A plain display stand (the pavilion's lacquered podium), as furniture: it collides, it is not an exhibit. */
function stand(id: string, position: Vec3, rotationDeg: number, footprint: [number, number], height: number, zone: ZoneId, top: 'plain' | 'vitrine' = 'plain', finish = '', extra: Props = {}): SceneObjectConfig {
  return { id, title: 'Display stand', kind: 'podium', position, rotationDeg, footprint, height, props: { ...(finish ? { height, top, finish } : { height, top }), ...extra }, zone, i18n: { hi: { title: 'प्रदर्शन चौकी' }, bn: { title: 'প্রদর্শনী বেদি' } } }
}

/** A bracket on a wall (a shallow lacquered podium, sized by props), its top at `y`. */
function bracket(id: string, position: Vec3, rotationDeg: number, w: number, d: number, zone: ZoneId): SceneObjectConfig {
  const h = 0.06
  // no footprint: a bracket is off the floor, so it must not become a collider
  return { id, title: 'Wall bracket', kind: 'podium', position: [position[0], position[1] - h, position[2]], rotationDeg, height: h, props: { height: h, w, d }, zone, i18n: { hi: { title: 'दीवार की ब्रैकेट' }, bn: { title: 'দেওয়ালের তাক' } } }
}

/* ------------------------------------------------------------------ */
/* Sourced models                                                      */
/* ------------------------------------------------------------------ */

/** A sourced model by slug: model, height, credit from the registry; `h` overrides the height. */
function sourced(id: string, slug: string, position: Vec3, rotationDeg: number, zone: ZoneId, o: { h?: number; finish?: string; title?: Lang3; text?: Lang3; interactive?: boolean; footprint?: [number, number]; alt?: Lang3 } = {}): SceneObjectConfig {
  const e = SOURCED_REGISTRY[slug]
  const h = o.h ?? (e ? e.bbox[4] - e.bbox[1] : 0.3)
  const credit = e ? { author: e.credit.author, source: e.credit.source, license: e.credit.license, title: e.credit.title, licenseUrl: e.credit.licenseUrl } : undefined
  const title = o.title ?? [e?.credit.title ?? slug, e?.credit.title ?? slug, e?.credit.title ?? slug]
  return {
    id,
    title: title[0],
    kind: 'sourced-model',
    position,
    rotationDeg,
    height: h,
    footprint: o.footprint,
    props: { slug, finish: o.finish ?? e?.finish ?? 'asis', lod: true },
    interactive: o.interactive ?? !!o.text,
    inspectable: !!o.text && h < 1.5,
    description: o.text?.[0],
    zone,
    credit,
    ...(o.alt ? { alt: o.alt[0] } : {}),
    i18n: { hi: { title: title[1], ...(o.text ? { description: o.text[1] } : {}), ...(o.alt ? { alt: o.alt[1] } : {}) }, bn: { title: title[2], ...(o.text ? { description: o.text[2] } : {}), ...(o.alt ? { alt: o.alt[2] } : {}) } },
  }
}

/* ------------------------------------------------------------------ */
/* Furniture of the installations package (read, never written)        */
/* ------------------------------------------------------------------ */

const num = (o: SceneObjectConfig, k: string, d: number) => {
  const v = o.props?.[k]
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : d
}
const textOf = (o: SceneObjectConfig, k: string) => (typeof o.props?.[k] === 'string' ? (o.props[k] as string) : '')

/** Local (x, y, z) on a piece of furniture → world, through its position and rotation. */
function toWorld(o: SceneObjectConfig, x: number, y: number, z: number): Vec3 {
  const r = (o.rotationDeg ?? 0) * DEG
  return [o.position[0] + x * Math.cos(r) + z * Math.sin(r), o.position[1] + y, o.position[2] - x * Math.sin(r) + z * Math.cos(r)]
}

const installations = (kind: SceneObjectConfig['kind'], zone: ZoneId) => GRAND_INSTALLATIONS_OBJECTS.filter((o) => o.kind === kind && o.zone === zone)

/**
 * The treads of a 'wine-plinth' (models/winePlinth.tsx `winePlinthTops`): tread k of n rises to
 * height·(k+1)/n at local z = depth/2 − (depth/n)(k + ½), front tread first.
 */
function winePlinthTread(o: SceneObjectConfig, k: number) {
  const n = Math.max(1, Math.round(num(o, 'steps', 3)))
  const D = num(o, 'depth', 0.9)
  const H = num(o, 'height', 1.1)
  const kk = Math.min(n - 1, k)
  return { y: (H * (kk + 1)) / n, z: D / 2 - (D / n) * (kk + 0.5), width: num(o, 'width', 2.4) }
}

/** The top of a 'round-plinth' (models/roundPlinth.tsx: tiers × h). */
const roundPlinthTop = (o: SceneObjectConfig) => Math.round(num(o, 'tiers', 2)) * num(o, 'h', 0.6)

/**
 * A spot on a 'curved-shelf' board (models/curvedShelf.tsx): the run is an arc of radius curveR
 * about (0, curveR) in its own frame, its boards `tierGap` apart above a 0.14 m kick (the lowest
 * board 0.035 m thick on top of it); pieces stand on the front row, 45 % into the depth.
 */
function shelfSpot(o: SceneObjectConfig, tier: number, a: number): Vec3 {
  const R = num(o, 'curveR', 4.2)
  const depth = num(o, 'depth', 0.32)
  const gap = num(o, 'tierGap', 0.42)
  const rr = R - depth / 2 + depth * 0.45
  const y = 0.14 + tier * gap + (tier === 0 ? 0.035 : 0)
  return toWorld(o, rr * Math.sin(a), y, R - rr * Math.cos(a))
}
const shelfSpan = (o: SceneObjectConfig) => num(o, 'spanDeg', 40) * DEG
const shelfRow = (o: SceneObjectConfig) => num(o, 'curveR', 4.2) - num(o, 'depth', 0.32) / 2 + num(o, 'depth', 0.32) * 0.45
/** Rotation (deg) that turns a piece on a shelf to face the shelf's centre of curvature. */
function shelfFacing(o: SceneObjectConfig, a: number) {
  return (o.rotationDeg ?? 0) - a / DEG
}

/* ------------------------------------------------------------------ */
/* Forecourt: the Ayyanar guardians (GRAND §4.2)                       */
/* ------------------------------------------------------------------ */

/**
 * The guardians flank the approach five paces in front of the portal, either side of the rill,
 * facing the visitor who arrives: from the spawn point they frame the door (G01, G02).
 */
const GUARD_X = KEY.doorHalf + 1.4
const GUARD_Z = KEY.annexOuterZ + 5.4

const GUARDIANS: SceneObjectConfig[] = [-1, 1].map((side, i) =>
  piece({
    id: `craft-ayyanar-guardian-${i + 1}`,
    title: W.guardian,
    craft: 'ayyanar',
    kind: 'ayyanar-horse',
    position: [side * GUARD_X, 0, GUARD_Z],
    rotationDeg: side * -6,
    height: 4.2,
    footprint: [1.75, 3.3],
    props: { height: 4.2, paint: 'weathered', seed: i + 1 },
    zone: 'entrance-court',
    inspectable: false,
    alt: [
      'A horse taller than two people, built of clay over a plastered plinth, limewashed white over red and weathered by rain, wearing clay garlands, bells and a saddle cloth.',
      'दो आदमियों से ऊँचा मिट्टी का घोड़ा, पलस्तर किए चबूतरे पर; लाल पर सफ़ेद चूने की पुताई, बारिश से घिसी हुई; मिट्टी की मालाएँ, घंटियाँ और काठी का कपड़ा पहने।',
      'দুজন মানুষের চেয়েও উঁচু মাটির ঘোড়া, পলেস্তারা করা বেদির ওপর; লালের ওপর চুনকাম, বৃষ্টিতে ক্ষয়ে যাওয়া; গায়ে মাটির মালা, ঘণ্টা আর জিনের কাপড়।',
    ],
  }),
)

/* ------------------------------------------------------------------ */
/* Gallery A: the fourth podium and The Herd                           */
/* ------------------------------------------------------------------ */

const slot = (id: string) => PODIUM_SLOTS.find((s) => s.id === id)!
const onPodium = (id: string): { position: Vec3; rotationDeg: number; zone: ZoneId } => {
  const s = slot(id)
  return { position: [s.x, MUSEUM.podium.height, s.z], rotationDeg: s.rotationY / DEG, zone: s.zone }
}

const PODIUM_EXTRA: SceneObjectConfig[] = [
  piece({ id: 'craft-bankura-podium-plaque', title: W.plaque, craft: 'bankura', kind: 'votive-plaque', ...onPodium('pod-a-4'), height: 0.52, props: { motif: 'serpent', size: 0.52 } }),
  piece({ id: 'craft-molela-podium-pot', title: W.lidded, craft: 'molela', kind: 'clay-vessel', ...onPodium('pod-b-6'), height: 0.4, footprint: undefined, props: vessel('lidded', 'red', 0.2) }),
  piece({ id: 'craft-longpi-podium-bowl', title: W.blackBowl, craft: 'longpi', kind: 'clay-vessel', ...onPodium('pod-c-4'), height: 0.32, props: vessel('lidded', 'black', 0.85) }),
]

/**
 * The Herd (GRAND §4.2): an island in Gallery A at polar(KEY.podiumR − 4.6, 5), clear of the
 * Turn: a three-step red plinth rising 0.4 → 1.8 m towards the red wall, nine horses climbing it.
 * The plinth runs radially, so a visitor walking the gallery meets the herd side-on, each horse
 * broadside, the tallest high against the lacquer.
 */
const HERD_A = 5
/** The plinth's middle. */
const HERD_R = KEY.podiumR - 4.6
const HERD_STEPS = [
  { w: 3.0, len: 2.7, h: 0.4 },
  { w: 2.7, len: 1.85, h: 1.1 },
  { w: 2.4, len: 1.0, h: 1.8 },
]
/** A point on the Herd's plinth: `x` across it (tangential), `out` along it away from the court. */
function herdAt(x: number, out: number, y: number): Vec3 {
  const [cx, cz] = polar(HERD_R + out, HERD_A)
  const tx = -Math.sin(HERD_A * DEG)
  const tz = Math.cos(HERD_A * DEG)
  return [cx + tx * x, y, cz + tz * x]
}
const stepOut = (i: number) => (HERD_STEPS[0].len - HERD_STEPS[i].len) / 2
const HERD_HORSES: { x: number; out: number; step: number; h: number; flip: boolean }[] = [
  { x: -0.85, out: -1.12, step: 0, h: 0.4, flip: false },
  { x: 0.75, out: -1.05, step: 0, h: 0.5, flip: true },
  { x: -0.1, out: -0.8, step: 0, h: 0.56, flip: false },
  { x: 0.95, out: -0.7, step: 0, h: 0.64, flip: true },
  { x: -0.75, out: -0.3, step: 1, h: 0.82, flip: false },
  { x: 0.7, out: -0.18, step: 1, h: 0.96, flip: true },
  { x: -0.02, out: 0.1, step: 1, h: 1.1, flip: false },
  { x: -0.55, out: 0.6, step: 2, h: 1.2, flip: true },
  { x: 0.5, out: 1.08, step: 2, h: 1.5, flip: false },
]
const HERD: SceneObjectConfig[] = [
  // footprint [across, along]: the podium's local x is tangential, its z radial
  // rose-lime steps (not the oxblood lacquer): under the red light they stay a warm red, never black
  // lacquered red (a low roughness, so the steps carry a sheen) with a brass lip on every edge
  ...HERD_STEPS.map((st, i) => stand(`herd-plinth-${i + 1}`, herdAt(0, stepOut(i), 0), facingIn(HERD_A), [st.w, st.len], st.h, 'ring-a', 'plain', '#a8382a', { roughness: 0.3, edge: true })),
  ...HERD_HORSES.map((hh, i) =>
    piece({
      id: `craft-bankura-herd-${i + 1}`,
      title: hh.h > 1 ? W.horse : W.smallHorse,
      craft: 'bankura',
      kind: 'terracotta-horse',
      position: herdAt(hh.x, hh.out, HERD_STEPS[hh.step].h),
      // side-on to the walk: the body (the model's x) runs along the plinth
      rotationDeg: facingIn(HERD_A) + 90 + (hh.flip ? 180 : 0),
      height: hh.h,
      props: { scale: hh.h / 0.5, style: 'bankura' },
      zone: 'ring-a',
      inspectable: hh.h < 1,
      alt:
        i === 8
          ? [
              'The tallest of nine red terracotta horses, high on a stepped red plinth: a long upright neck, pricked ears, a hollow body on four column legs.',
              'लाल सीढ़ीदार चबूतरे पर नौ लाल टेराकोटा घोड़ों में सबसे ऊँचा: लंबी सीधी गर्दन, खड़े कान, चार खंभे-सी टाँगों पर खोखला शरीर।',
              'লাল ধাপকাটা বেদির ওপর নয়টি লাল টেরাকোটার ঘোড়ার মধ্যে সবচেয়ে উঁচুটি: লম্বা খাড়া গলা, খাড়া কান, চারটি থামের মতো পায়ের ওপর ফাঁপা দেহ।',
            ]
          : undefined,
    }),
  ),
]

/* ------------------------------------------------------------------ */
/* Gallery B: the niche wall and the maker's table                     */
/* ------------------------------------------------------------------ */

/** The five niches stand between the six podiums of B; their sill is at 0.9 m, 0.35 m deep. */
const B_ANGLES = MUSEUM.podium.anglesDeg.b
const NICHE_SILL = 0.9
const NICHE_R = KEY.ringR + 0.35 / 2
/** Each plaque fills its niche's middle: 1.1 m tall from just above the sill, its centre at ≈ 1.5 m. */
const B_PLAQUES: { motif: string; size: number; title: Lang3 }[] = [
  { motif: 'rider', size: 1.1, title: [`${W.plaque[0]}: Rider`, `${W.plaque[1]}: अश्वारोही`, `${W.plaque[2]}: অশ্বারোহী`] },
  { motif: 'deity', size: 1.1, title: [`${W.plaque[0]}: Seated Figure`, `${W.plaque[1]}: आसीन आकृति`, `${W.plaque[2]}: উপবিষ্ট মূর্তি`] },
  { motif: 'canopy', size: 1.1, title: [`${W.plaque[0]}: Figure under a Canopy`, `${W.plaque[1]}: छत्र के नीचे आकृति`, `${W.plaque[2]}: চাঁদোয়ার নিচে মূর্তি`] },
  { motif: 'serpent', size: 1.1, title: [`${W.plaque[0]}: Serpent`, `${W.plaque[1]}: नाग`, `${W.plaque[2]}: নাগ`] },
  { motif: 'procession', size: 1.1, title: [`${W.plaque[0]}: Procession`, `${W.plaque[1]}: शोभायात्रा`, `${W.plaque[2]}: শোভাযাত্রা`] },
]
const NICHE_PLAQUES: SceneObjectConfig[] = B_PLAQUES.map((p, i) => {
  const a = (B_ANGLES[i] + B_ANGLES[i + 1]) / 2
  return piece({
    id: `craft-molela-niche-${i + 1}`,
    title: p.title,
    craft: 'molela',
    kind: 'votive-plaque',
    position: at(NICHE_R, a, NICHE_SILL + 0.05),
    rotationDeg: facingIn(a),
    height: p.size,
    props: { motif: p.motif, size: p.size },
    zone: 'ring-b',
  })
})

/** A maker's place in B: a low clay-slab chowki with a plaque half modelled, its tools beside it. */
/** In B's podium bay off the terrazzo, between two of the gallery ring's points (12° apart). */
const TABLE_A = (B_ANGLES[3] + B_ANGLES[4]) / 2 + 2.5
const TABLE_R = KEY.podiumR - 1.9
const TABLE_H = 0.4
const tableAt = (dx: number, dz: number, y: number): Vec3 => {
  const [x, z] = polar(TABLE_R, TABLE_A)
  return [x + dx, y, z + dz]
}
const MAKERS_TABLE: SceneObjectConfig[] = [
  {
    id: 'makers-chowki',
    title: 'Chowki',
    kind: 'round-plinth',
    position: tableAt(0, 0, 0),
    rotationDeg: 0,
    footprint: [1.2, 1.2],
    height: TABLE_H,
    props: { tiers: 1, r: 0.6, h: TABLE_H, color: '#9a5a40' },
    zone: 'ring-b',
    alt: 'A low round slab of fired clay, the height a maker sits at on the floor.',
    i18n: { hi: { title: 'चौकी' }, bn: { title: 'চৌকি' } },
  },
  piece({
    id: 'craft-molela-in-progress',
    title: [`${W.plaque[0]} in Progress`, `बनती हुई ${W.plaque[1]}`, `তৈরি হতে থাকা ${W.plaque[2]}`],
    craft: 'molela',
    kind: 'votive-plaque',
    position: tableAt(0, 0.05, TABLE_H),
    rotationDeg: facingIn(TABLE_A),
    height: 0.5,
    props: { motif: 'rider', size: 0.5 },
    zone: 'ring-b',
  }),
  sourced('makers-trowel', 'ph-trowel-01', tableAt(0.32, -0.18, TABLE_H), 30, 'ring-b'),
  sourced('makers-spoon', 'ph-wooden-spoon', tableAt(-0.3, -0.22, TABLE_H), 110, 'ring-b'),
  piece({ id: 'craft-molela-water-cup', title: W.cup, craft: 'molela', kind: 'clay-vessel', position: tableAt(-0.34, 0.18, TABLE_H), rotationDeg: 0, height: 0.1, props: vessel('kulhad', 'red', 0) , zone: 'ring-b' }),
]

/* ------------------------------------------------------------------ */
/* Gallery C: the black ware island                                    */
/* ------------------------------------------------------------------ */

/** In C's bay beyond its last podium, off the court's terrazzo. */
const ISLAND_A = (MUSEUM.podium.anglesDeg.c[3] - 10)
const ISLAND_R = KEY.podiumR - 1.5
const ISLAND = { r: 1.2, h: 0.42 }
const islandAt = (r: number, a: number): Vec3 => {
  const [cx, cz] = polar(ISLAND_R, ISLAND_A)
  return [cx + r * Math.cos(a * DEG), ISLAND.h, cz + r * Math.sin(a * DEG)]
}
const BLACK_WARE: { word: Word; form: string; h: number; r: number; a: number }[] = [
  { word: 'kettle', form: 'kettle', h: 0.28, r: 0.32, a: 20 },
  { word: 'cookingPot', form: 'handi', h: 0.3, r: 0.3, a: 140 },
  { word: 'jar', form: 'matka', h: 0.36, r: 0.28, a: 260 },
  { word: 'kettle', form: 'kettle', h: 0.22, r: 0.86, a: 0 },
  { word: 'blackBowl', form: 'lidded', h: 0.18, r: 0.86, a: 45 },
  { word: 'tray', form: 'tawa', h: 0.05, r: 0.86, a: 90 },
  { word: 'blackBowl', form: 'lidded', h: 0.2, r: 0.86, a: 135 },
  { word: 'kettle', form: 'kettle', h: 0.25, r: 0.86, a: 180 },
  { word: 'bowl', form: 'bowl', h: 0.1, r: 0.86, a: 225 },
  { word: 'tray', form: 'tawa', h: 0.05, r: 0.86, a: 270 },
  { word: 'blackBowl', form: 'lidded', h: 0.16, r: 0.86, a: 315 },
  { word: 'cookingPot', form: 'handi', h: 0.22, r: 0.58, a: 200 },
]
const BLACK_ISLAND: SceneObjectConfig[] = [
  {
    id: 'black-ware-island',
    title: 'Black ware table',
    kind: 'round-plinth',
    position: at(ISLAND_R, ISLAND_A),
    rotationDeg: 0,
    footprint: [ISLAND.r * 2, ISLAND.r * 2],
    height: ISLAND.h,
    // a dark slate top (p04: black ware on slate under one cool beam)
    props: { tiers: 1, r: ISLAND.r, h: ISLAND.h, color: '#141719', roughness: 0.5 },
    zone: 'ring-c',
    i18n: { hi: { title: 'काले मृद्भांडों की मेज़' }, bn: { title: 'কালো মৃৎপাত্রের টেবিল' } },
  },
  ...BLACK_WARE.map((w, i) =>
    piece({
      id: `craft-longpi-island-${i + 1}`,
      title: W[w.word],
      craft: 'longpi',
      kind: 'clay-vessel',
      position: islandAt(w.r, w.a + ISLAND_A),
      rotationDeg: w.a * 1.7,
      height: w.h,
      footprint: undefined,
      props: { ...vessel(w.form, 'black', 0.85) },
      zone: 'ring-c',
    }),
  ),
]

/* ------------------------------------------------------------------ */
/* The upper register over A, B and C (GRAND §2.5, §4.2)               */
/* ------------------------------------------------------------------ */

const BAL = MUSEUM.balcony
const REG = MUSEUM.upperRegister
const REG_FROM = BAL.fromDeg - 360
const REG_TO = BAL.toDeg - 360
const REG_PITCH = (REG_TO - REG_FROM) / REG.niches
const regionZone = (a: number): ZoneId => (a >= MUSEUM.fins.atDeg[0] ? 'ring-a' : a >= MUSEUM.fins.atDeg[1] ? 'ring-b' : 'ring-c')
/**
 * Each piece stands in its niche (architecture/registerGeometry.ts: niches and relief panels
 * alternate in bays of half a pitch, a niche first), on the niche's sill, a little in from its
 * back, and fills about 60 % of its height: the piece is the lit thing, not the box round it.
 */
const NICHE_SILL_Y = (REG.y0 + REG.y1) / 2 - REG.niche.height / 2
const NICHE_FILL = 0.6
/** The niche stand's height on the sill. */
const NICHE_STAND = 0.06
const REG_R = KEY.ringR + REG.niche.depth * 0.45
/** Plan angle of niche i (0 at the balcony's `fromDeg` end) and of the panel bay after it. */
const nicheDeg = (i: number) => REG_FROM + (i + 0.75) * REG_PITCH
const panelDeg = (i: number) => REG_FROM + (i + 1.25) * REG_PITCH
/** A piece's height in a niche: 60 % of it, less for wide forms so they clear its 0.9 m width. */
const nicheH = (p: { kind: SceneObjectConfig['kind']; props: Props }) => {
  const H = REG.niche.height * NICHE_FILL
  const form = typeof p.props.form === 'string' ? p.props.form : ''
  if (form === 'bowl' || form === 'tawa') return 0.3
  if (form === 'kulhad') return 0.46
  return H
}

const REGISTER_PIECES: { craft: CraftSlug; word: Word; kind: SceneObjectConfig['kind']; h: number; props: Props }[] = [
  { craft: 'longpi', word: 'kettle', kind: 'clay-vessel', h: 0.34, props: vessel('kettle', 'black', 0.85) },
  { craft: 'manamadurai', word: 'ghatam', kind: 'clay-vessel', h: 0.42, props: vessel('ghatam', 'red', 0.3) },
  { craft: 'villianur', word: 'horse', kind: 'terracotta-horse', h: 0.6, props: { scale: 1.2, style: 'bankura' } },
  { craft: 'ayyanar', word: 'guardian', kind: 'ayyanar-horse', h: 0.8, props: { height: 0.8, paint: 'white', seed: 3 } },
  { craft: 'studio', word: 'ashJar', kind: 'clay-vessel', h: 0.44, props: vessel('jar', 'grey', 0.4, 'ash-glaze') },
  { craft: 'odisha', word: 'smokedHorse', kind: 'terracotta-horse', h: 0.56, props: { scale: 1.1, style: 'sonepur' } },
  { craft: 'kumartuli', word: 'armature', kind: 'kumartuli-figure', h: 0.9, props: { stage: 'straw', height: 0.9 } },
  { craft: 'asharikandi', word: 'waterPot', kind: 'clay-vessel', h: 0.42, props: vessel('matka', 'terracotta', 0.2) },
  { craft: 'andro', word: 'coiled', kind: 'coil-pot', h: 0.46, props: { coils: 16, cutaway: false } },
  { craft: 'majuli', word: 'mask', kind: 'majuli-mask', h: 0.95, props: { form: 'face', paint: true } },
  { craft: 'molela', word: 'plaque', kind: 'votive-plaque', h: 0.7, props: { motif: 'deity', size: 0.7 } },
  { craft: 'bishnupur', word: 'fragment', kind: 'relief-register', h: 0.55, props: { panels: 1, scene: 'procession', weather: 0.7 } },
  { craft: 'khurja', word: 'glazedVase', kind: 'clay-vessel', h: 0.46, props: vessel('vase', 'buff', 0.5, 'slip-flowers') },
  { craft: 'chinhat', word: 'vase', kind: 'clay-vessel', h: 0.42, props: vessel('vase', 'buff', 0.5, 'blue-floral') },
  { craft: 'nizamabad', word: 'blackVase', kind: 'clay-vessel', h: 0.46, props: vessel('surahi', 'black', 0.9, 'silver-incision') },
  { craft: 'gorakhpur', word: 'ornateHorse', kind: 'terracotta-horse', h: 0.62, props: { scale: 1.24, style: 'gorakhpur' } },
  { craft: 'bankura', word: 'horse', kind: 'terracotta-horse', h: 0.64, props: { scale: 1.28, style: 'bankura' } },
  { craft: 'khavda', word: 'paintedPot', kind: 'clay-vessel', h: 0.4, props: vessel('matka', 'buff', 0.2, 'geru-dots') },
  { craft: 'pokaran', word: 'pinkJar', kind: 'clay-vessel', h: 0.44, props: vessel('jar', 'pink', 0.2) },
  { craft: 'blue-pottery', word: 'blueJar', kind: 'clay-vessel', h: 0.42, props: vessel('jar', 'quartz', 0.6, 'blue-floral') },
  { craft: 'studio', word: 'slipBowl', kind: 'clay-vessel', h: 0.2, props: vessel('bowl', 'terracotta', 0.4, 'trailed-slip') },
  { craft: 'chinhat', word: 'cup', kind: 'clay-vessel', h: 0.18, props: vessel('kulhad', 'buff', 0.5, 'blue-floral') },
  { craft: 'molela', word: 'plaque', kind: 'votive-plaque', h: 0.7, props: { motif: 'canopy', size: 0.7 } },
  { craft: 'bankura', word: 'waterPot', kind: 'clay-vessel', h: 0.4, props: vessel('matka', 'terracotta', 0.35) },
]

const UPPER_REGISTER: SceneObjectConfig[] = REGISTER_PIECES.flatMap((p, i) => {
  const a = nicheDeg(i)
  const zone = regionZone(a)
  const rot = facingIn(a)
  const flat = p.kind === 'relief-register' || p.kind === 'votive-plaque'
  // scaled as one: a horse's scale and a plaque's size follow its height in the niche
  const h = nicheH(p)
  const k = h / p.h
  const props: Props = { ...p.props }
  if (typeof props.scale === 'number') props.scale = props.scale * k
  if (typeof props.size === 'number') props.size = h
  if (typeof props.height === 'number') props.height = h
  // each piece stands on a low lacquered stand on the niche's sill (a little lift off the sill)
  const y = NICHE_SILL_Y + NICHE_STAND
  return [
    bracket(`register-bracket-${i + 1}`, at(REG_R, a, y), rot, 0.6, 0.28, zone),
    piece({
      id: `craft-${p.craft}-register-${i + 1}`,
      title: W[p.word],
      craft: p.craft,
      kind: p.kind,
      // flat pieces stand against the niche's back
      position: at(REG_R + (flat ? REG.niche.depth * 0.3 : 0), a, y),
      // the guardian maquette turns side-on to the room, like the horses
      rotationDeg: p.kind === 'ayyanar-horse' ? rot + 90 : rot,
      height: h,
      props,
      zone,
      inspectable: true,
    }),
  ]
})

/** Bishnupur-style relief panels between the niches over A and B. */
const RELIEF_SCENES = ['epic', 'procession', 'boats', 'daily'] as const
const REGISTER_RELIEFS: SceneObjectConfig[] = Array.from({ length: 12 }, (_, j) => {
  const i = REG.niches - 2 - j
  // on the panel bay after niche i, never over a niche's opening
  const a = panelDeg(i)
  const size = 0.95
  return piece({
    id: `craft-bishnupur-relief-${j + 1}`,
    title: W.relief,
    craft: 'bishnupur',
    kind: 'relief-register',
    position: at(KEY.ringR - 0.01, a, (REG.y0 + REG.y1) / 2 - size / 2),
    rotationDeg: facingIn(a),
    height: size,
    props: { panels: 1, scene: RELIEF_SCENES[j % 4], weather: 0.35 + (j % 3) * 0.2 },
    zone: regionZone(a),
    inspectable: false,
  })
})

/* ------------------------------------------------------------------ */
/* F: the court niche figure and the lippan corridor                   */
/* ------------------------------------------------------------------ */

const F = MUSEUM.innerMainWall
const F_NICHE_A = (F.fromDeg + F.toDeg) / 2
/** In the lit niche between the piers (they stand `niche.depth` proud of F's face), its back to the wall. */
const F_PLINTH_R = F.r - F.thickness / 2 - Math.min(F.niche.depth, 0.6) / 2
const F_PLINTH_H = 1.4
const F_COURT: SceneObjectConfig[] = [
  stand('f-niche-plinth', at(F_PLINTH_R, F_NICHE_A), facingIn(F_NICHE_A), [0.56, 0.56], F_PLINTH_H, 'inner'),
  // shown large (≈ 60 % of the niche's height above the plinth), like p07l's lit niche figure
  sourced('elsewhere-forme-sortant', 'wc-forme-sortant-de-la-matiere', at(F_PLINTH_R, F_NICHE_A, F_PLINTH_H), facingIn(F_NICHE_A), 'inner', {
    h: F.niche.height * 0.38,
    // a pale buff clay finish: against the niche's glowing red the grey read as a dark lump
    finish: 'buff',
    title: ['Form Rising from Matter', 'पदार्थ से उठता रूप', 'পদার্থ থেকে উঠে আসা রূপ'],
    text: [
      'A sculpture by Paul Le Goff, “La forme sortant de la matière”: a figure emerging from an uncut block. Shown from a 3D scan, in a pale clay finish, as the court’s one figure.',
      'पॉल ल गॉफ़ की मूर्ति, “ला फ़ॉर्म सॉर्तां द ला मातियेर”: बिना तराशे ढोके से उभरती एक आकृति। 3D स्कैन से, हल्की मिट्टी जैसी सतह में, आँगन की अकेली आकृति के रूप में।',
      'পল ল গফের ভাস্কর্য, “লা ফর্ম সর্তাঁ দ্য লা মাতিয়ের”: না-কাটা পাথরের খণ্ড থেকে বেরিয়ে আসা এক মূর্তি। 3D স্ক্যান থেকে, হালকা মাটির রঙে, উঠোনের একমাত্র মূর্তি হিসেবে।',
    ],
  }),
]

/** Lippan kaam on F's corridor face: the object stands at the origin, the band is built on F's arc. */
const LIPPAN: SceneObjectConfig = {
  id: 'craft-lippan-wall',
  title: 'Mud-and-Mirror Relief — Study',
  kind: 'lippan-wall',
  position: [0, 0, 0],
  props: { pattern: 'lattice', mirrors: 0.55, surfaces: 'f-outer-1,f-outer-2,f-outer-3,f-outer-4,f-outer-5' },
  zone: 'entry-e',
  placeholder: true,
  description: craftText('lippan').description,
  alt: 'A long band of raised clay coils, washed white on a mud plaster ground, with small round mirrors set into the knots of a diamond lattice.',
  i18n: {
    hi: { title: 'मिट्टी और शीशे का उभरा काम — अध्ययन', description: craftText('lippan').hi, alt: 'मिट्टी के पलस्तर पर सफ़ेद पुती उभरी कुंडलियों की लंबी पट्टी; हीरे जैसी जाली की गाँठों में छोटे गोल शीशे जड़े।' },
    bn: { title: 'মাটি আর আয়নার রিলিফ — চর্চা', description: craftText('lippan').bn, alt: 'মাটির পলেস্তারার ওপর সাদা করা উঁচু কুণ্ডলীর লম্বা পাড়; হিরের মতো জালির গিঁটে ছোট গোল আয়না বসানো।' },
  },
}

/* ------------------------------------------------------------------ */
/* The Wine Hall: Clay Elsewhere (GRAND §5.4)                          */
/* ------------------------------------------------------------------ */

interface Elsewhere {
  slug: string
  title: Lang3
  text: Lang3
}
/** "Clay elsewhere" (or, where it is not clay, the material), the object, its place and time, the scan. */
const E = (slug: string, title: Lang3, text: Lang3): Elsewhere => ({ slug, title, text })
const SCAN: Lang3 = [' Shown from a 3D scan.', ' 3D स्कैन से।', ' 3D স্ক্যান থেকে।']
const scan = (t: Lang3): Lang3 => [t[0] + SCAN[0], t[1] + SCAN[1], t[2] + SCAN[2]]

/** The six sets in walking order (W1 by the D arch → W6 by the E-west arch). */
const WINE_SETS: Elsewhere[][] = [
  [
    E('wc-kaen-doki-jomon-flame-pot', ['Flame-rimmed Pot, Jōmon Japan', 'ज्वाला-किनारी घड़ा, जोमोन जापान', 'শিখা-কানার পাত্র, জোমোন জাপান'], scan([
      'Clay elsewhere. A pot of the middle Jōmon period, about 5,000 years old, from Umataka, Nagaoka, Japan: built up in coils, its rim rising in thick loops of clay like flames. In a plain clay finish.',
      'मिट्टी, कहीं और। जापान के नागाओका के उमाताका से मध्य जोमोन काल का, लगभग 5,000 वर्ष पुराना घड़ा: कुंडलियों से गढ़ा गया, किनारा मिट्टी के मोटे घुमावों में लपटों-सा उठता है। सादी मिट्टी की सतह में।',
      'মাটি, অন্যত্র। জাপানের নাগাওকার উমাতাকা থেকে মধ্য জোমোন যুগের, প্রায় ৫,০০০ বছরের পুরনো পাত্র: কুণ্ডলী জুড়ে গড়া, কানা উঠেছে মাটির মোটা পাকে শিখার মতো। সাদামাটা মাটির রঙে।',
    ])),
    E('wc-dogu-clay-figurine', ['Clay Figurine (Dogū), Japan', 'मिट्टी की मूर्तिका (दोगू), जापान', 'মাটির মূর্তি (দোগু), জাপান'], scan([
      'Clay elsewhere. A clay figurine of the Jōmon period, found at Umataka, Nagaoka, Japan.',
      'मिट्टी, कहीं और। जापान के नागाओका के उमाताका में मिली जोमोन काल की मिट्टी की मूर्तिका।',
      'মাটি, অন্যত্র। জাপানের নাগাওকার উমাতাকায় পাওয়া জোমোন যুগের মাটির মূর্তি।',
    ])),
  ],
  [
    E('si-colonoware-pot', ['Colonoware Pot, South Carolina', 'कोलोनोवेयर घड़ा, दक्षिण कैरोलिना', 'কলোনোওয়্যার পাত্র, দক্ষিণ ক্যারোলিনা'], scan([
      'Clay elsewhere. A hand-built, low-fired pot of the kind called colonoware, from the Cooper River, Charleston County, South Carolina, USA (National Museum of African American History and Culture).',
      'मिट्टी, कहीं और। हाथ से गढ़ा, कम आँच पर पका, कोलोनोवेयर कहलाने वाली क़िस्म का घड़ा; कूपर नदी, चार्ल्सटन काउंटी, दक्षिण कैरोलिना, अमेरिका से।',
      'মাটি, অন্যত্র। হাতে গড়া, কম আঁচে পোড়া, কলোনোওয়্যার নামের ধরনের পাত্র; কুপার নদী, চার্লসটন কাউন্টি, দক্ষিণ ক্যারোলিনা, আমেরিকা থেকে।',
    ])),
    E('si-stoneware-jug-commeraw', ['Stoneware Jug, New York', 'स्टोनवेयर सुराही, न्यूयॉर्क', 'স্টোনওয়্যার জগ, নিউ ইয়র্ক'], scan([
      'Clay elsewhere. A salt-glazed stoneware jug by Thomas Commeraw, a potter working in New York around 1800 (National Museum of African American History and Culture).',
      'मिट्टी, कहीं और। लगभग 1800 के आसपास न्यूयॉर्क में काम करने वाले कुम्हार थॉमस कॉमेरॉ की नमक-ग्लेज़ वाली स्टोनवेयर सुराही।',
      'মাটি, অন্যত্র। ১৮০০ নাগাদ নিউ ইয়র্কে কাজ করা কুমোর টমাস কমেরর নুন-গ্লেজের স্টোনওয়্যার জগ।',
    ])),
    E('si-delft-ewer', ['Tin-glazed Ewer, Delft', 'टिन-ग्लेज़ वाली झारी, डेल्फ़्ट', 'টিন-গ্লেজের ঝারি, ডেলফট'], scan([
      'Clay elsewhere. An ewer of tin-glazed earthenware, the white-and-blue ware of Delft in the Netherlands (Cooper Hewitt, Smithsonian Design Museum).',
      'मिट्टी, कहीं और। टिन-ग्लेज़ वाले मिट्टी के बर्तन की झारी, नीदरलैंड के डेल्फ़्ट का सफ़ेद-नीला माल।',
      'মাটি, অন্যত্র। টিন-গ্লেজের মাটির ঝারি, নেদারল্যান্ডসের ডেলফটের সাদা-নীল পাত্র।',
    ])),
  ],
  [
    E('si-kylix', ['Kylix, Ancient Greece', 'काइलिक्स, प्राचीन यूनान', 'কাইলিক্স, প্রাচীন গ্রিস'], scan([
      'Clay elsewhere. A kylix, the shallow two-handled drinking cup of ancient Greece (Cooper Hewitt, Smithsonian Design Museum).',
      'मिट्टी, कहीं और। काइलिक्स, प्राचीन यूनान का दो हत्थों वाला उथला पीने का प्याला।',
      'মাটি, অন্যত্র। কাইলিক্স, প্রাচীন গ্রিসের দুই হাতলওয়ালা অগভীর পানপাত্র।',
    ])),
    E('wc-msr-vase-aryballisque', ['Aryballos-shaped Vase, Toulouse', 'अरिबालोस-आकार का पात्र, तूलूज़', 'অ্যারিবালোস-আকারের পাত্র, তুলুজ'], scan([
      'Clay elsewhere. A small round-bodied flask of the ancient Mediterranean (Musée Saint-Raymond, Toulouse). In a terracotta finish.',
      'मिट्टी, कहीं और। प्राचीन भूमध्यसागरीय क्षेत्र की गोल पेट वाली छोटी कुप्पी (म्यूज़े सें-रेमों, तूलूज़)। टेराकोटा सतह में।',
      'মাটি, অন্যত্র। প্রাচীন ভূমধ্যসাগরীয় অঞ্চলের গোল পেটের ছোট কুপি (মিউজে স্যাঁ-রেমোঁ, তুলুজ)। টেরাকোটা রঙে।',
    ])),
    E('wc-roman-pottery-r3950', ['Roman Pottery, Apulum', 'रोमन मृद्भांड, अपुलम', 'রোমান মৃৎপাত্র, অ্যাপুলাম'], scan([
      'Clay elsewhere. Roman pottery from the governor’s palace at Apulum, Roman Dacia, now Alba Iulia, Romania (Muzeul Național al Unirii Alba Iulia). In a red-slip finish.',
      'मिट्टी, कहीं और। रोमन डेशिया के अपुलम (आज का आल्बा यूलिया, रोमानिया) के राज्यपाल-महल से रोमन मृद्भांड। लाल स्लिप सतह में।',
      'মাটি, অন্যত্র। রোমান ডেসিয়ার অ্যাপুলাম (আজকের আলবা ইউলিয়া, রোমানিয়া) গভর্নরের প্রাসাদ থেকে রোমান মৃৎপাত্র। লাল স্লিপ রঙে।',
    ])),
    E('wc-roman-pottery-r3997', ['Roman Jug, Apulum', 'रोमन सुराही, अपुलम', 'রোমান জগ, অ্যাপুলাম'], scan([
      'Clay elsewhere. A Roman vessel from the same palace at Apulum (Muzeul Național al Unirii Alba Iulia). In a red-slip finish.',
      'मिट्टी, कहीं और। अपुलम के उसी महल से एक रोमन पात्र। लाल स्लिप सतह में।',
      'মাটি, অন্যত্র। অ্যাপুলামের সেই প্রাসাদ থেকেই একটি রোমান পাত্র। লাল স্লিপ রঙে।',
    ])),
  ],
  [
    E('wc-geto-dacian-biconical-vessel', ['Biconical Vessel, Chirnogi', 'द्विशंकु पात्र, किर्नोगी', 'দ্বিশঙ্কু পাত্র, কির্নোগি'], scan([
      'Clay elsewhere. A Geto-Dacian vessel with a sharply turned shoulder, found at Chirnogi, Romania (Institutul Național al Patrimoniului).',
      'मिट्टी, कहीं और। तीखे मुड़े कंधे वाला गेटो-डेशियन पात्र, किर्नोगी, रोमानिया में मिला।',
      'মাটি, অন্যত্র। তীক্ষ্ণ বাঁকা কাঁধের গেটো-ডেসিয়ান পাত্র, রোমানিয়ার কির্নোগিতে পাওয়া।',
    ])),
    E('wc-neolithic-pottery', ['Neolithic Vessel', 'नवपाषाण काल का पात्र', 'নবপ্রস্তর যুগের পাত্র'], scan([
      'Clay elsewhere. A pottery vessel of the Neolithic, scanned by Călin Șuteu.',
      'मिट्टी, कहीं और। नवपाषाण काल का मिट्टी का पात्र; स्कैन: कालिन शुतेउ।',
      'মাটি, অন্যত্র। নবপ্রস্তর যুগের মাটির পাত্র; স্ক্যান: কালিন শুতেউ।',
    ])),
    E('wc-neolithic-clay-idol', ['Neolithic Clay Idol', 'नवपाषाण काल की मिट्टी की मूर्ति', 'নবপ্রস্তর যুগের মাটির মূর্তি'], scan([
      'Clay elsewhere. A small clay figure of the Neolithic, scanned by Călin Șuteu.',
      'मिट्टी, कहीं और। नवपाषाण काल की छोटी मिट्टी की आकृति; स्कैन: कालिन शुतेउ।',
      'মাটি, অন্যত্র। নবপ্রস্তর যুগের ছোট মাটির মূর্তি; স্ক্যান: কালিন শুতেউ।',
    ])),
  ],
  [
    E('wc-mahg-terracotta-man-holding-child', ['Man Holding a Child, Terracotta', 'बच्चे को थामे आदमी, टेराकोटा', 'শিশু কোলে পুরুষ, টেরাকোটা'], scan([
      'Clay elsewhere. A terracotta figurine of a man holding a child (Musée d’art et d’histoire, Geneva).',
      'मिट्टी, कहीं और। बच्चे को थामे आदमी की टेराकोटा मूर्तिका (म्यूज़े द’आर ए द’इस्तुआर, जिनेवा)।',
      'মাটি, অন্যত্র। শিশু কোলে এক পুরুষের টেরাকোটা মূর্তি (মিউজে দার এ দিস্তোয়ার, জেনেভা)।',
    ])),
    E('wc-mahg-terracotta-tambourine-player', ['Tambourine Player, Terracotta', 'डफ़ बजाने वाली, टेराकोटा', 'খঞ্জনি বাদক, টেরাকোটা'], scan([
      'Clay elsewhere. A terracotta figurine of a tambourine player (Musée d’art et d’histoire, Geneva).',
      'मिट्टी, कहीं और। डफ़ बजाती आकृति की टेराकोटा मूर्तिका (म्यूज़े द’आर ए द’इस्तुआर, जिनेवा)।',
      'মাটি, অন্যত্র। খঞ্জনি বাজানো এক মূর্তির টেরাকোটা প্রতিমা (মিউজে দার এ দিস্তোয়ার, জেনেভা)।',
    ])),
    E('wc-mahg-standing-man-figurine', ['Standing Man, Figurine', 'खड़ा आदमी, मूर्तिका', 'দাঁড়ানো পুরুষ, মূর্তি'], scan([
      'Clay elsewhere. A small figure of a standing man (Musée d’art et d’histoire, Geneva). In a terracotta finish.',
      'मिट्टी, कहीं और। खड़े आदमी की छोटी आकृति (म्यूज़े द’आर ए द’इस्तुआर, जिनेवा)। टेराकोटा सतह में।',
      'মাটি, অন্যত্র। দাঁড়ানো এক পুরুষের ছোট মূর্তি (মিউজে দার এ দিস্তোয়ার, জেনেভা)। টেরাকোটা রঙে।',
    ])),
    E('wc-bust-singing-woman', ['Bust of a Singing Woman', 'गाती स्त्री का आवक्ष', 'গায়িকা নারীর আবক্ষ মূর্তি'], scan([
      'Carved in ivory, not modelled in clay: a bust of a singing woman, 18th century (Hunt Museum, Limerick). The scan is shown in a plain finish, beside the clay heads.',
      'मिट्टी में गढ़ा नहीं, हाथीदाँत में तराशा: गाती स्त्री का आवक्ष, 18वीं सदी (हंट म्यूज़ियम, लिमरिक)। स्कैन सादी सतह में, मिट्टी के सिरों के पास।',
      'মাটিতে গড়া নয়, হাতির দাঁতে খোদাই: গায়িকা নারীর আবক্ষ মূর্তি, অষ্টাদশ শতক (হান্ট মিউজিয়াম, লিমেরিক)। স্ক্যান সাদামাটা রঙে, মাটির মাথাগুলির পাশে।',
    ])),
    E('si-fugitives-story-figurine', ['The Fugitive’s Story, Plaster Group', 'द फ़्यूजिटिव्स स्टोरी, प्लास्टर समूह', 'দ্য ফিউজিটিভস স্টোরি, প্লাস্টার দল'], scan([
      'Cast in plaster: “The Fugitive’s Story”, a sculpture group by John Rogers, United States, 1869 (National Museum of African American History and Culture).',
      'प्लास्टर में ढला: “द फ़्यूजिटिव्स स्टोरी”, जॉन रॉजर्स का मूर्ति-समूह, अमेरिका, 1869।',
      'প্লাস্টারে ঢালা: “দ্য ফিউজিটিভস স্টোরি”, জন রজার্সের ভাস্কর্য-দল, আমেরিকা, ১৮৬৯।',
    ])),
  ],
  [
    E('wc-sevres-pedestal-bowl', ['Porcelain Fruit Bowl, Sèvres', 'चीनी मिट्टी का फलदान, सेव्र', 'চিনামাটির ফলদানি, সেভ্র'], scan([
      'Where clay becomes porcelain: a pedestal fruit bowl made at Sèvres, France, in 1844, from a refined white body fired hard (Institutul Național al Patrimoniului).',
      'जहाँ मिट्टी चीनी मिट्टी बनती है: 1844 में फ़्रांस के सेव्र में बना पायेदार फलदान, शुद्ध सफ़ेद मिट्टी से, तेज़ आँच पर पका।',
      'যেখানে মাটি চিনামাটি হয়: ১৮৪৪ সালে ফ্রান্সের সেভ্রে তৈরি পায়াওয়ালা ফলদানি, পরিশোধিত সাদা মাটি থেকে, কড়া আঁচে পোড়া।',
    ])),
    E('wc-mia-ganesha', ['Ganesha, in Stone', 'गणेश, पत्थर में', 'গণেশ, পাথরে'], scan([
      'From clay to stone: Ganesha, carved in volcanic stone, India, 10th–11th century (Minneapolis Institute of Art), shown beside modelled clay to compare the two ways of making a form.',
      'मिट्टी से पत्थर तक: गणेश, ज्वालामुखीय पत्थर में तराशे, भारत, 10वीं–11वीं सदी (मिनियापोलिस इंस्टीट्यूट ऑफ़ आर्ट); गढ़ी हुई मिट्टी के पास, रूप बनाने के दो तरीक़ों की तुलना के लिए।',
      'মাটি থেকে পাথরে: গণেশ, আগ্নেয় পাথরে খোদাই, ভারত, দশম–একাদশ শতক (মিনিয়াপোলিস ইনস্টিটিউট অফ আর্ট); গড়া মাটির পাশে, রূপ তৈরির দুই পথের তুলনায়।',
    ])),
    E('wc-mia-uma-maheshvara', ['Uma-Maheshvara, in Stone', 'उमा-महेश्वर, पत्थर में', 'উমা-মহেশ্বর, পাথরে'], scan([
      'From clay to stone: Uma-Maheshvara, carved in sandstone, India, 10th–11th century (Minneapolis Institute of Art).',
      'मिट्टी से पत्थर तक: उमा-महेश्वर, बलुआ पत्थर में तराशे, भारत, 10वीं–11वीं सदी (मिनियापोलिस इंस्टीट्यूट ऑफ़ आर्ट)।',
      'মাটি থেকে পাথরে: উমা-মহেশ্বর, বেলেপাথরে খোদাই, ভারত, দশম–একাদশ শতক (মিনিয়াপোলিস ইনস্টিটিউট অফ আর্ট)।',
    ])),
    E('wc-iron-age-cup-lamp', ['Cup or Lamp, Iron Age Ireland', 'प्याला या दीया, लौह युग आयरलैंड', 'পেয়ালা বা প্রদীপ, লৌহযুগের আয়ারল্যান্ড'], scan([
      'In stone, not clay: an Iron Age cup or lamp (Hunt Museum, Limerick), set beside the clay vessels for comparison.',
      'मिट्टी नहीं, पत्थर में: लौह युग का एक प्याला या दीया (हंट म्यूज़ियम, लिमरिक), तुलना के लिए मिट्टी के पात्रों के पास रखा।',
      'মাটি নয়, পাথরে: লৌহযুগের একটি পেয়ালা বা প্রদীপ (হান্ট মিউজিয়াম, লিমেরিক), তুলনার জন্য মাটির পাত্রের পাশে রাখা।',
    ])),
  ],
]

const RELIEF_END: Elsewhere = E('si-gathering-of-buddhas', ['Gathering of Buddhas, Relief', 'बुद्धों की सभा, उभरा फलक', 'বুদ্ধদের সমাবেশ, রিলিফ'], scan([
  'In stone: a carved relief of a gathering of Buddhas and Bodhisattvas (National Museum of Asian Art, Smithsonian, F1921.1), at the end of the hall.',
  'पत्थर में: बुद्धों और बोधिसत्वों की सभा का तराशा हुआ उभरा फलक (नेशनल म्यूज़ियम ऑफ़ एशियन आर्ट, स्मिथसोनियन), कक्ष के छोर पर।',
  'পাথরে: বুদ্ধ ও বোধিসত্ত্বদের সমাবেশের খোদাই করা রিলিফ (ন্যাশনাল মিউজিয়াম অফ এশিয়ান আর্ট, স্মিথসোনিয়ান), কক্ষের শেষ প্রান্তে।',
]))

const HALL_SURFACES: SurfaceId[] = ['d-hallway-1', 'd-hallway-2', 'd-hallway-3', 'd-hallway-4', 'd-hallway-5', 'd-hallway-6']
/** Plan angle (deg, 0 … 360) of a point: the hall runs from the D arch (224°) back to E-west (146°). */
const planDeg = (x: number, z: number) => ((Math.atan2(z, x) / DEG) % 360 + 360) % 360

function wineHall(): SceneObjectConfig[] {
  const out: SceneObjectConfig[] = []
  // the installations package's wine plinths, in walking order (decreasing plan angle): the
  // stepped plinths W1–W6, the tall single pedestals (busts) and the low ledge (the relief)
  const all = installations('wine-plinth', 'hallway-d').sort((a, b) => planDeg(b.position[0], b.position[2]) - planDeg(a.position[0], a.position[2]))
  const plinths = all.filter((o) => num(o, 'width', 2.4) >= 1.2 && num(o, 'depth', 0.9) >= 0.6)
  const pedestals = all.filter((o) => num(o, 'width', 2.4) < 1.2 && num(o, 'steps', 3) === 1)
  const ledge = all.find((o) => num(o, 'width', 2.4) >= 1.2 && num(o, 'depth', 0.9) < 0.6)
  // the two carved stone figures stand on the tall pedestals; the heads and figures stay together
  // as one group on W5 (p08l "plinths and busts")
  const TALL = ['wc-mia-ganesha', 'wc-mia-uma-maheshvara']
  const onPedestal = new Map(TALL.slice(0, pedestals.length).map((slug, i) => [slug, pedestals[i]]))
  for (const [slug, ped] of onPedestal) {
    const e = WINE_SETS.flat().find((x) => x.slug === slug)!
    out.push(sourced(`elsewhere-${slug}`, slug, toWorld(ped, 0, num(ped, 'height', 1.36), 0), ped.rotationDeg ?? 0, 'hallway-d', { title: e.title, text: e.text }))
  }
  WINE_SETS.forEach((full, wi) => {
    const set = plinths.length ? full.filter((e) => !onPedestal.has(e.slug)) : full
    const p = plinths[wi]
    if (p) {
      // the small pieces on the top tread at eye level, the taller ones on the front tread below,
      // spread across the width
      const n = set.length
      set.forEach((e, k) => {
        const h = SOURCED_REGISTRY[e.slug] ? SOURCED_REGISTRY[e.slug].bbox[4] - SOURCED_REGISTRY[e.slug].bbox[1] : 0.3
        const tread = winePlinthTread(p, h > 0.36 ? 0 : 1)
        const x = (k - (n - 1) / 2) * Math.min(0.62, (tread.width - 0.4) / Math.max(1, n - 1))
        out.push(sourced(`elsewhere-${e.slug}`, e.slug, toWorld(p, x, tread.y, tread.z), (p.rotationDeg ?? 0) + (k % 2 ? -12 : 12), 'hallway-d', { title: e.title, text: e.text }))
      })
      return
    }
    // no plinth there: each piece gets a wine-lacquered stand of its own, in front of the wall
    const sid = HALL_SURFACES[wi]
    const s = SURFACES[sid]
    const mid = (s.range[0] + s.range[1]) / 2
    set.forEach((e, k) => {
      const along = mid + (k - (set.length - 1) / 2) * 0.8
      const sp = surfacePoint(sid, along, 0, 0.55)
      const h = 1.1
      out.push(stand(`elsewhere-stand-${wi + 1}-${k + 1}`, sp.position, sp.rotationY / DEG, [0.42, 0.42], h, 'hallway-d', k === 0 && wi === 0 ? 'vitrine' : 'plain'))
      out.push(sourced(`elsewhere-${e.slug}`, e.slug, [sp.position[0], h, sp.position[2]], sp.rotationY / DEG, 'hallway-d', { title: e.title, text: e.text }))
    })
  })
  // p08l "plinths and busts": sculpted heads in a terracotta finish at the ends of four plinths'
  // top treads, at eye level, turned a little towards the walk (fittings of the hall, not curated
  // pieces: no label, credited on /credits)
  const HEADS = ['ph-marble-bust-01', 'ph-horse-head', 'ph-lion-head', 'ph-bull-head']
  const headOn = [0, 1, 3, 5]
  HEADS.forEach((slug, k) => {
    const p = plinths[headOn[k]]
    if (!p || !SOURCED_REGISTRY[slug]) return
    const t = winePlinthTread(p, 1)
    const side = k % 2 ? -1 : 1
    out.push(sourced(`wine-head-${k + 1}`, slug, toWorld(p, side * (t.width / 2 - 0.24), t.y, t.z), (p.rotationDeg ?? 0) - side * 18, 'hallway-d', { finish: 'terracotta' }))
  })
  // the relief at the hall's end: on its ledge if there is one, else on the lobe wall at eye level
  if (ledge) {
    const t = winePlinthTread(ledge, 0)
    out.push(sourced(`elsewhere-${RELIEF_END.slug}`, RELIEF_END.slug, toWorld(ledge, 0, t.y, t.z - 0.06), ledge.rotationDeg ?? 0, 'hallway-d', { title: RELIEF_END.title, text: RELIEF_END.text }))
  } else {
    const endA = MUSEUM.hallwayWall.fromDeg + 4
    const relief = SOURCED_REGISTRY[RELIEF_END.slug]
    const rh = relief ? relief.bbox[4] - relief.bbox[1] : 0.45
    out.push(sourced(`elsewhere-${RELIEF_END.slug}`, RELIEF_END.slug, at(KEY.lobeR - 0.03, endA, MUSEUM.display.artworkCenterHeight - rh / 2), facingIn(endA), 'hallway-d', { title: RELIEF_END.title, text: RELIEF_END.text }))
  }
  return out
}

/* ------------------------------------------------------------------ */
/* The Parikrama: one piece per tradition in the tall walls (§2.6)     */
/* ------------------------------------------------------------------ */

const PARIKRAMA_PIECES: { craft: CraftSlug; word: Word; kind: SceneObjectConfig['kind']; h: number; props: Props }[] = [
  { craft: 'gorakhpur', word: 'ornateHorse', kind: 'terracotta-horse', h: 0.46, props: { scale: 0.92, style: 'gorakhpur' } },
  { craft: 'asharikandi', word: 'lidded', kind: 'clay-vessel', h: 0.4, props: vessel('lidded', 'terracotta', 0.25) },
  { craft: 'nizamabad', word: 'surahi', kind: 'clay-vessel', h: 0.44, props: vessel('surahi', 'black', 0.9, 'silver-incision') },
  { craft: 'pokaran', word: 'pinkJar', kind: 'clay-vessel', h: 0.42, props: vessel('jar', 'pink', 0.2) },
  { craft: 'khavda', word: 'paintedPot', kind: 'clay-vessel', h: 0.38, props: vessel('matka', 'buff', 0.2, 'geru-dots') },
  { craft: 'khurja', word: 'glazedVase', kind: 'clay-vessel', h: 0.44, props: vessel('vase', 'buff', 0.5, 'slip-flowers') },
  { craft: 'andro', word: 'coiled', kind: 'coil-pot', h: 0.4, props: { coils: 14, cutaway: false } },
  { craft: 'manamadurai', word: 'ghatam', kind: 'clay-vessel', h: 0.4, props: vessel('ghatam', 'red', 0.3) },
  { craft: 'villianur', word: 'horse', kind: 'terracotta-horse', h: 0.46, props: { scale: 0.92, style: 'bankura' } },
  { craft: 'odisha', word: 'smokedHorse', kind: 'terracotta-horse', h: 0.44, props: { scale: 0.88, style: 'sonepur' } },
  { craft: 'longpi', word: 'kettle', kind: 'clay-vessel', h: 0.32, props: vessel('kettle', 'black', 0.85) },
  { craft: 'molela', word: 'plaque', kind: 'votive-plaque', h: 0.5, props: { motif: 'rider', size: 0.5 } },
  { craft: 'bankura', word: 'horse', kind: 'terracotta-horse', h: 0.5, props: { scale: 1, style: 'bankura' } },
]
const NICHE_Y = 1.1

function parikrama(): SceneObjectConfig[] {
  // the outer (courtyard) wall's runs, in walking order (west gate → east gate)
  const runs = serpentineOuterRuns().map(([a0, a1]) => [a0 + 2.5, a1 - 2.5] as [number, number]).filter(([a0, a1]) => a1 - a0 > 3)
  const total = runs.reduce((s, [a0, a1]) => s + (a1 - a0), 0)
  const n = PARIKRAMA_PIECES.length
  const out: SceneObjectConfig[] = []
  PARIKRAMA_PIECES.forEach((p, i) => {
    // evenly along the runs' combined length
    let d = ((i + 0.5) / n) * total
    let a = runs[0][0]
    for (const [a0, a1] of runs) {
      if (d <= a1 - a0) {
        a = a0 + d
        break
      }
      d -= a1 - a0
    }
    const [fx, fz] = serpentineOffset(SERPENTINE.walkW / 2, a, a, 1)[0]
    const [cx, cz] = serpentineOffset(0, a, a, 1)[0]
    const len = Math.hypot(cx - fx, cz - fz) || 1
    const ux = (cx - fx) / len
    const uz = (cz - fz) / len
    const rot = Math.atan2(ux, uz) / DEG
    const zone: ZoneId = a < -60 ? 'parikrama-west' : 'parikrama-east'
    const off = 0.16
    out.push(bracket(`parikrama-bracket-${i + 1}`, [fx + ux * off, NICHE_Y, fz + uz * off], rot, 0.6, 0.3, zone))
    out.push(
      piece({
        id: `craft-${p.craft}-parikrama`,
        title: W[p.word],
        craft: p.craft,
        kind: p.kind,
        position: [fx + ux * (p.kind === 'votive-plaque' ? off - 0.06 : off), NICHE_Y, fz + uz * (p.kind === 'votive-plaque' ? off - 0.06 : off)],
        rotationDeg: rot,
        height: p.h,
        props: p.props,
        zone,
      }),
    )
  })
  return out
}

/* ------------------------------------------------------------------ */
/* The theatre lobby: Kumartuli in progress, Majuli masks               */
/* ------------------------------------------------------------------ */

const THEATRE_END = SATELLITES.find((s) => s.id === 'theatre')!.toDeg
const LOBBY_A = (THEATRE.baffle.aDeg + THEATRE_END) / 2
function theatreLobby(): SceneObjectConfig[] {
  const out: SceneObjectConfig[] = [
    piece({
      id: 'craft-kumartuli-figure',
      title: W.figure,
      craft: 'kumartuli',
      kind: 'kumartuli-figure',
      // beside the line in from the door, turned towards it
      position: at(SAT_WALL.innerFace + 5.4, LOBBY_A - 3),
      rotationDeg: facingIn(LOBBY_A - 3) + 25,
      height: 2.6,
      footprint: [1.2, 0.86],
      props: { stage: 'first-coat', height: 2.6 },
      zone: 'theatre',
      inspectable: false,
      alt: [
        'A life-size figure on a plank, half made: a bamboo frame bound with golden straw and twine, its head, shoulders and arms pressed over with grey clay; no face is modelled yet.',
        'तख़्ते पर आदमक़द, आधी बनी आकृति: सुनहरे पुआल और सुतली से बँधा बाँस का ढाँचा, सिर, कंधे और बाँहें धूसर मिट्टी से लिपी; चेहरा अभी गढ़ा नहीं गया।',
        'তক্তার ওপর মানুষ-সমান, আধা-গড়া মূর্তি: সোনালি খড় আর সুতলিতে বাঁধা বাঁশের কাঠামো, মাথা, কাঁধ আর হাতে ধূসর মাটি চাপানো; মুখ এখনও গড়া হয়নি।',
      ],
    }),
  ]
  // five oversized masks hung on the lobby's end wall from bamboo brackets, facing back into the room
  const forms: [string, Word][] = [
    ['face', 'mask'],
    ['bird', 'birdMask'],
    ['lion', 'lionMask'],
    ['face', 'mask'],
    ['bird', 'birdMask'],
  ]
  forms.forEach(([form, word], i) => {
    const r = SAT_WALL.innerFace + 3.3 + i * 1.2
    const a = THEATRE_END - 0.2 / r / DEG
    out.push(
      piece({
        id: `craft-majuli-mask-${i + 1}`,
        title: W[word],
        craft: 'majuli',
        kind: 'majuli-mask',
        position: at(r, a),
        rotationDeg: 180 - THEATRE_END,
        height: 1.9,
        footprint: [0.9, 0.3],
        // every face painted (a bare one read as a blank disc)
        props: { form, paint: true },
        zone: 'theatre',
        inspectable: false,
      }),
    )
  })
  return out
}

/* ------------------------------------------------------------------ */
/* The Red Room: the survey in five regional bays (GRAND §4.2)         */
/* ------------------------------------------------------------------ */

interface BayPiece {
  craft: CraftSlug
  word: Word
  kind: SceneObjectConfig['kind']
  h: number
  props: Props
}
const V = (craft: CraftSlug, word: Word, form: string, clay: string, h: number, burnish = 0.3, decor = 'none'): BayPiece => ({ craft, word, kind: 'clay-vessel', h, props: vessel(form, clay, burnish, decor) })

interface Bay {
  region: CraftRegion
  /** Plan angle (deg) about the Red Room's centre of the bay's middle. */
  aDeg: number
  pieces: BayPiece[]
  /** Pieces that stand apart on a white plinth of their own (Jaipur blue, "almost no clay"). */
  apart?: BayPiece[]
}

/** The door looks back along the room's own angle; side openings at ±90° from it. */
const RR_DOOR = RED_ROOM.aDeg + 180
const BAYS: Bay[] = [
  {
    region: 'north',
    aDeg: RED_ROOM.aDeg,
    pieces: [
      V('khurja', 'glazedVase', 'vase', 'buff', 0.3, 0.5, 'slip-flowers'),
      V('khurja', 'glazedJar', 'jar', 'buff', 0.26, 0.5, 'slip-flowers'),
      V('khurja', 'bowl', 'bowl', 'buff', 0.12, 0.5, 'slip-flowers'),
      V('khurja', 'surahi', 'surahi', 'buff', 0.3, 0.5, 'slip-flowers'),
      V('khurja', 'lidded', 'lidded', 'buff', 0.24, 0.5, 'slip-flowers'),
      V('chinhat', 'vase', 'vase', 'buff', 0.28, 0.5, 'blue-floral'),
      V('chinhat', 'bowl', 'bowl', 'buff', 0.12, 0.5, 'blue-floral'),
      V('chinhat', 'cup', 'kulhad', 'buff', 0.1, 0.5, 'blue-floral'),
      V('nizamabad', 'blackVase', 'vase', 'black', 0.3, 0.9, 'silver-incision'),
      V('nizamabad', 'surahi', 'surahi', 'black', 0.32, 0.9, 'silver-incision'),
      V('nizamabad', 'blackBowl', 'lidded', 'black', 0.2, 0.9, 'silver-incision'),
      V('nizamabad', 'bowl', 'bowl', 'black', 0.1, 0.9, 'silver-incision'),
      V('nizamabad', 'lamp', 'diya', 'black', 0.06, 0.9),
      { craft: 'gorakhpur', word: 'ornateHorse', kind: 'terracotta-horse', h: 0.32, props: { scale: 0.64, style: 'gorakhpur' } },
      { craft: 'gorakhpur', word: 'ornateHorse', kind: 'terracotta-horse', h: 0.26, props: { scale: 0.52, style: 'gorakhpur' } },
      V('gorakhpur', 'lamp', 'diya', 'red', 0.07, 0.3),
      V('studio', 'slipBowl', 'bowl', 'terracotta', 0.12, 0.4, 'trailed-slip'),
      V('studio', 'jar', 'jar', 'terracotta', 0.26, 0.4, 'trailed-slip'),
      V('studio', 'cup', 'kulhad', 'terracotta', 0.1, 0.4, 'trailed-slip'),
    ],
  },
  {
    region: 'west',
    aDeg: RED_ROOM.aDeg - 52,
    pieces: [
      V('pokaran', 'pinkJar', 'jar', 'pink', 0.28, 0.2),
      V('pokaran', 'vase', 'vase', 'pink', 0.3, 0.2),
      V('pokaran', 'surahi', 'surahi', 'pink', 0.3, 0.2),
      V('pokaran', 'bowl', 'bowl', 'pink', 0.1, 0.2),
      V('khavda', 'paintedPot', 'matka', 'buff', 0.26, 0.2, 'geru-dots'),
      V('khavda', 'cookingPot', 'handi', 'buff', 0.2, 0.2, 'geru-dots'),
      V('khavda', 'jar', 'jar', 'buff', 0.28, 0.2, 'geru-dots'),
      V('khavda', 'bowl', 'bowl', 'buff', 0.1, 0.2, 'geru-dots'),
      V('khavda', 'lidded', 'lidded', 'buff', 0.2, 0.2, 'geru-dots'),
    ],
    apart: [V('blue-pottery', 'blueJar', 'jar', 'quartz', 0.3, 0.6, 'blue-floral'), V('blue-pottery', 'vase', 'vase', 'quartz', 0.34, 0.6, 'blue-floral'), V('blue-pottery', 'bowl', 'bowl', 'quartz', 0.12, 0.6, 'blue-floral')],
  },
  {
    region: 'east',
    aDeg: RED_ROOM.aDeg + 52,
    pieces: [
      { craft: 'kumartuli', word: 'armature', kind: 'kumartuli-figure', h: 0.34, props: { stage: 'straw', height: 0.34 } },
      { craft: 'odisha', word: 'smokedHorse', kind: 'terracotta-horse', h: 0.3, props: { scale: 0.6, style: 'sonepur' } },
      { craft: 'odisha', word: 'smokedHorse', kind: 'terracotta-horse', h: 0.24, props: { scale: 0.48, style: 'sonepur' } },
      V('odisha', 'cookingPot', 'handi', 'red', 0.2, 0.2),
      { craft: 'bishnupur', word: 'fragment', kind: 'relief-register', h: 0.3, props: { panels: 1, scene: 'epic', weather: 0.8 } },
      { craft: 'bishnupur', word: 'fragment', kind: 'relief-register', h: 0.26, props: { panels: 1, scene: 'boats', weather: 0.6 } },
    ],
  },
  {
    region: 'ne',
    aDeg: RR_DOOR - 50,
    pieces: [
      V('asharikandi', 'waterPot', 'matka', 'terracotta', 0.26, 0.25),
      V('asharikandi', 'lidded', 'lidded', 'terracotta', 0.22, 0.25),
      V('asharikandi', 'lamp', 'diya', 'terracotta', 0.07, 0.2),
      V('asharikandi', 'bowl', 'bowl', 'terracotta', 0.1, 0.2),
      { craft: 'andro', word: 'coiled', kind: 'coil-pot', h: 0.3, props: { coils: 12, cutaway: false } },
      { craft: 'andro', word: 'coiled', kind: 'coil-pot', h: 0.24, props: { coils: 10, cutaway: false } },
      V('andro', 'cookingPot', 'handi', 'red', 0.2, 0.5),
      V('andro', 'jar', 'jar', 'black', 0.26, 0.6),
    ],
  },
  {
    region: 'south',
    aDeg: RR_DOOR + 50,
    pieces: [
      V('manamadurai', 'ghatam', 'ghatam', 'red', 0.3, 0.3),
      V('manamadurai', 'ghatam', 'ghatam', 'red', 0.26, 0.3),
      V('manamadurai', 'waterPot', 'matka', 'red', 0.26, 0.3),
      V('manamadurai', 'surahi', 'surahi', 'red', 0.3, 0.3),
      { craft: 'villianur', word: 'horse', kind: 'terracotta-horse', h: 0.32, props: { scale: 0.64, style: 'bankura' } },
      V('villianur', 'lamp', 'diya', 'terracotta', 0.07, 0.2),
      V('villianur', 'vase', 'vase', 'terracotta', 0.28, 0.2),
      V('studio', 'ashJar', 'jar', 'grey', 0.28, 0.4, 'ash-glaze'),
      V('studio', 'bowl', 'bowl', 'grey', 0.12, 0.4, 'ash-glaze'),
      V('studio', 'vase', 'vase', 'grey', 0.3, 0.4, 'ash-glaze'),
      { craft: 'ayyanar', word: 'guardian', kind: 'ayyanar-horse', h: 0.34, props: { height: 0.34, paint: 'white', seed: 5 } },
    ],
  },
]

const RR = { cx: RED_ROOM.cx, cz: RED_ROOM.cz }
const rrAt = (r: number, a: number, y = 0): Vec3 => {
  const [x, z] = polar(r, a, RR.cx, RR.cz)
  return [x, y, z]
}

/**
 * Widths (m) of the shelf package's vessel forms at their usual height (models/curvedShelf.tsx
 * VESSEL_FORMS: 2 × widest radius × height), to estimate how many boards its `items` fill.
 */
const ITEM_W: Record<string, number> = { kulhad: 0.084, matka: 0.31, surahi: 0.24, handi: 0.22, tawa: 0.3, diya: 0.1, 'lamp-stack': 0.21, vase: 0.2, jar: 0.22, lidded: 0.19, bowl: 0.14, ghatam: 0.3 }

/** The first board a shelf's own `items` leave free (they fill from the lowest board up). */
function firstFreeTier(o: SceneObjectConfig): number {
  const items = textOf(o, 'items')
    .split('\n')
    .map((l) => l.split('|'))
    .filter((p) => p[0]?.trim())
  if (!items.length) return 0
  const used = items.reduce((sum, [form, count]) => sum + (Number(count) || 1) * ((ITEM_W[form.trim()] ?? 0.24) + 0.04), 0)
  const usable = num(o, 'curveR', 4.2) * shelfSpan(o) - 0.12
  // their rows break early on a wide piece: allow a little slack before the next board
  return Math.ceil((used * 1.15) / Math.max(0.5, usable))
}

/** The Red Room's shelves (curved shelves about the room), with their free boards, round from the door. */
function redRoomShelves() {
  return installations('curved-shelf', 'library')
    .filter((o) => Math.hypot(o.position[0] - RR.cx, o.position[2] - RR.cz) < RED_ROOM.r + 0.5)
    .map((o) => ({ o, free: firstFreeTier(o), tiers: Math.max(1, Math.round(num(o, 'tiers', 4))), around: (((planAngle(o.position[0] - RR.cx, o.position[2] - RR.cz) - RR_DOOR) % 360) + 360) % 360 }))
    .filter((s) => s.free < s.tiers)
    .sort((p, q) => p.around - q.around)
}
const planAngle = (x: number, z: number) => Math.atan2(z, x) / DEG

function redRoom(): SceneObjectConfig[] {
  const out: SceneObjectConfig[] = []
  const shelves = redRoomShelves()
  // the bays share the shelves round the room: a big bay takes two
  const need = BAYS.map((b) => Math.max(1, Math.round(b.pieces.length / 12)))
  const total = need.reduce((a, b) => a + b, 0)
  let next = 0
  BAYS.forEach((bay, bi) => {
    const id = (p: BayPiece, k: number) => `craft-${p.craft}-redroom-${bay.region}-${k + 1}`
    const own = shelves.length >= total ? shelves.slice(next, next + need[bi]) : []
    next += need[bi]
    if (own.length) {
      // on the shelves' free boards, lowest free board first, pieces centred along each board
      const slots: { shelf: SceneObjectConfig; tier: number; a: number }[] = []
      for (const { o, free, tiers } of own) {
        const row = shelfRow(o)
        const span = shelfSpan(o)
        const per = Math.max(1, Math.floor((row * span - 0.2) / 0.4))
        for (let t = free; t < tiers; t++) for (let j = 0; j < per; j++) slots.push({ shelf: o, tier: t, a: (j - (per - 1) / 2) * (0.4 / row) })
      }
      // spread the pieces over the boards rather than packing the first one
      const step = Math.max(1, Math.floor(slots.length / bay.pieces.length))
      bay.pieces.forEach((p, k) => {
        const sl = slots[Math.min(slots.length - 1, k * step)]
        out.push(piece({ id: id(p, k), title: W[p.word], craft: p.craft, kind: p.kind, position: shelfSpot(sl.shelf, sl.tier, sl.a), rotationDeg: shelfFacing(sl.shelf, sl.a), height: p.h, props: p.props, zone: 'library' }))
      })
    } else {
      // no shelf here: two lacquered steps against the wall, the pieces along their tops
      const steps = [
        { back: 0.62, d: 0.42, h: 0.8 },
        { back: 0.24, d: 0.32, h: 1.22 },
      ]
      steps.forEach((st, si) => out.push(stand(`redroom-bay-${bi + 1}-${si + 1}`, rrAt(RED_ROOM.r - st.back, bay.aDeg), facingIn(bay.aDeg), [2.4, st.d], st.h, 'library')))
      bay.pieces.forEach((p, k) => {
        const st = steps[k % 2]
        const n = Math.ceil(bay.pieces.length / 2)
        const j = Math.floor(k / 2)
        const along = (j - (n - 1) / 2) * Math.min(0.42, 2.2 / Math.max(1, n))
        const r = RED_ROOM.r - st.back
        const a = bay.aDeg + along / r / DEG
        out.push(piece({ id: id(p, k), title: W[p.word], craft: p.craft, kind: p.kind, position: rrAt(r, a, st.h), rotationDeg: facingIn(a), height: p.h, props: p.props, zone: 'library' }))
      })
    }
    // Jaipur blue sits apart on a white plinth of its own, in front of the bay
    if (bay.apart) {
      const r = RED_ROOM.r - 1.35
      out.push({ id: 'redroom-white-plinth', title: 'White plinth', kind: 'round-plinth', position: rrAt(r, bay.aDeg), rotationDeg: 0, footprint: [0.76, 0.76], height: 0.7, props: { tiers: 1, r: 0.38, h: 0.7, color: '#ebe6dd' }, zone: 'library', i18n: { hi: { title: 'सफ़ेद चबूतरा' }, bn: { title: 'সাদা বেদি' } } })
      bay.apart.forEach((p, k) => {
        const a = (k / bay.apart!.length) * 360 + 30
        const [x, , z] = rrAt(r, bay.aDeg)
        out.push(piece({ id: `craft-${p.craft}-redroom-apart-${k + 1}`, title: W[p.word], craft: p.craft, kind: p.kind, position: [x + Math.cos(a * DEG) * 0.19, 0.7, z + Math.sin(a * DEG) * 0.19], rotationDeg: a, height: p.h, props: p.props, zone: 'library' }))
      })
    }
  })
  // the centrepiece: an Andro coil pot cut open, on the two-tier plinth under the oculus
  const plinth = installations('round-plinth', 'library').find((o) => Math.hypot(o.position[0] - RR.cx, o.position[2] - RR.cz) < 1)
  const top = plinth ? roundPlinthTop(plinth) : 0.9
  if (!plinth)
    out.push({ id: 'redroom-centre-plinth', title: 'Round plinth', kind: 'round-plinth', position: [RR.cx, 0, RR.cz], rotationDeg: 0, footprint: [2.2, 2.2], height: top, props: { tiers: 2, r: 1.1, h: top / 2, color: '#7d1a17' }, zone: 'library', i18n: { hi: { title: 'गोल चबूतरा' }, bn: { title: 'গোল বেদি' } } })
  out.push(
    piece({
      id: 'craft-andro-coil-pot-hero',
      title: W.coilPot,
      craft: 'andro',
      kind: 'coil-pot',
      position: [plinth ? plinth.position[0] : RR.cx, top, plinth ? plinth.position[2] : RR.cz],
      // the open quarter turned to the door (a few degrees off, so the burnished skin shows beside
      // the cut): from the doorway the coils show in section and as ridges inside
      rotationDeg: facingIn(RED_ROOM.aDeg) + 12,
      height: 0.82,
      footprint: undefined,
      props: { coils: 22, cutaway: true },
      zone: 'library',
      alt: [
        'A dark burnished pot as tall as a child’s arm, a quarter of its wall cut away so the coils of clay it was built from show in section and as ridges inside.',
        'बच्चे की बाँह जितना ऊँचा, घिसकर चमकाया गहरा घड़ा; उसकी दीवार का चौथाई हिस्सा काटकर हटाया गया है, ताकि जिन मिट्टी की कुंडलियों से वह बना, वे कटान में और भीतर उभारों की तरह दिखें।',
        'শিশুর হাতের মতো উঁচু, ঘষে-মাজা গাঢ় পাত্র; দেওয়ালের এক-চতুর্থাংশ কেটে সরানো, যাতে যে মাটির কুণ্ডলী দিয়ে এটি গড়া, তা কাটা অংশে আর ভেতরে খাঁজ হয়ে দেখা যায়।',
      ],
    }),
  )
  return out
}

/* ------------------------------------------------------------------ */
/* The Earth Room: everyday clay on the round table (GRAND §4.2)       */
/* ------------------------------------------------------------------ */

function earthRoom(): SceneObjectConfig[] {
  const table = installations('round-table', 'annex')[0]
  if (!table) return []
  const r = num(table, 'r', 1.2)
  const y = num(table, 'height', 0.9)
  const ware: { word: Word; form: string; clay: string; h: number }[] = [
    { word: 'waterPot', form: 'matka', clay: 'terracotta', h: 0.3 },
    { word: 'surahi', form: 'surahi', clay: 'red', h: 0.34 },
    { word: 'cookingPot', form: 'handi', clay: 'terracotta', h: 0.22 },
    { word: 'griddle', form: 'tawa', clay: 'red', h: 0.05 },
    { word: 'cup', form: 'kulhad', clay: 'terracotta', h: 0.1 },
    { word: 'lamp', form: 'diya', clay: 'buff', h: 0.06 },
  ]
  return ware.map((w, i) => {
    const a = (i / ware.length) * 360 + 15
    const t = SILENT
    const title = study(W[w.word])
    return {
      id: `earth-room-ware-${i + 1}`,
      title: title[0],
      kind: 'clay-vessel',
      position: [table.position[0] + Math.cos(a * DEG) * r * 0.62, y, table.position[2] + Math.sin(a * DEG) * r * 0.62] as Vec3,
      rotationDeg: a,
      height: w.h,
      props: vessel(w.form, w.clay, 0.2),
      interactive: true,
      inspectable: true,
      description: t[0],
      zone: 'annex' as ZoneId,
      placeholder: true,
      i18n: { hi: { title: title[1], description: t[1] }, bn: { title: title[2], description: t[2] } },
    }
  })
}

/* ------------------------------------------------------------------ */
/* Gallery C: black ware on wall brackets between the podiums          */
/* ------------------------------------------------------------------ */

/**
 * The C ring wall between its podiums was a blank charcoal sheet: four lacquered brackets at
 * shoulder height, each carrying one burnished black piece under its own cool spot (the soffit
 * track over it), so the wall reads as a run of lit shelves of black ware.
 */
const C_WALL_PIECES: { craft: CraftSlug; word: Word; h: number; props: Props }[] = [
  { craft: 'longpi', word: 'kettle', h: 0.28, props: vessel('kettle', 'black', 0.85) },
  { craft: 'nizamabad', word: 'surahi', h: 0.36, props: vessel('surahi', 'black', 0.9, 'silver-incision') },
  { craft: 'longpi', word: 'blackBowl', h: 0.24, props: vessel('lidded', 'black', 0.85) },
  { craft: 'nizamabad', word: 'jar', h: 0.32, props: vessel('jar', 'black', 0.9, 'silver-incision') },
]
const C_WALL_Y = 2.1
const C_WALL: SceneObjectConfig[] = C_WALL_PIECES.flatMap((p, i) => {
  const angs = MUSEUM.podium.anglesDeg.c
  // between consecutive podiums, and past the last one towards the D notch
  const a = i < angs.length - 1 ? (angs[i] + angs[i + 1]) / 2 : angs[angs.length - 1] - (angs[angs.length - 2] - angs[angs.length - 1]) / 2
  const r = KEY.ringR - 0.17
  const rot = facingIn(a)
  return [
    bracket(`c-wall-bracket-${i + 1}`, at(r, a, C_WALL_Y), rot, 0.5, 0.3, 'ring-c'),
    piece({ id: `craft-${p.craft}-c-wall-${i + 1}`, title: W[p.word], craft: p.craft, kind: 'clay-vessel', position: at(r, a, C_WALL_Y), rotationDeg: rot, height: p.h, props: p.props, zone: 'ring-c', inspectable: true }),
  ]
})

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

export const GRAND_CRAFTS_OBJECTS: SceneObjectConfig[] = [
  ...GUARDIANS,
  ...PODIUM_EXTRA,
  ...HERD,
  ...NICHE_PLAQUES,
  ...MAKERS_TABLE,
  ...BLACK_ISLAND,
  ...C_WALL,
  ...UPPER_REGISTER,
  ...REGISTER_RELIEFS,
  ...F_COURT,
  LIPPAN,
  ...wineHall(),
  ...parikrama(),
  ...theatreLobby(),
  ...redRoom(),
  ...earthRoom(),
]
