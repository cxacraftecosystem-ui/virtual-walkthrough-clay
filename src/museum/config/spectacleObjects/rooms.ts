/**
 * Scene objects of the four satellite rooms and the Parikrama walk (F21 meshes, F23–F26).
 * Spread into SCENE_OBJECTS (config/objects.ts). Owned by WP1.
 *
 * Every position is derived from the north wing's constants (satellites.ts) on the drum's polar
 * grid; the room shells, the serpentine, the jali screens, the alpana and the chimes are
 * architecture (architecture/{Satellites,Parikrama}.tsx), and the objects here only carry what a
 * curator may edit or a visitor may click. The library crescent holds the Red Room (GRAND §2.7):
 * its own pieces are the grand lists' (config/grandObjects); the library's stay in its two wings.
 *
 * Placeholder silence: nothing here names a place, a maker, a price or a speaker until the
 * workshop confirms it (`placeholder: true` keeps the map pins, the soil labels, the drawer
 * sherds, the oral histories and the Haat tags silent).
 */
import { DEG, polar } from '../museum'
import { RED_ROOM, SAT_WALL, satellite, serpentineR, THEATRE } from '../satellites'
import type { SceneObjectConfig } from '../objects'
import { at, facingAlong, facingIn, facingOut } from './place'

/** The rooms name the sense they mean. */
const facingIncreasing = (aDeg: number) => facingAlong(aDeg, 1)
const facingDecreasing = (aDeg: number) => facingAlong(aDeg, -1)

/** rotationDeg that turns an object's front (+z) towards the floor point (tx, tz). */
const facingPoint = (from: [number, number], to: [number, number]) => Math.atan2(to[0] - from[0], to[1] - from[1]) / DEG

/** Radius at which a flat piece stands against a room's outer wall (its face is at SAT_WALL.outerFace). */
const OUTER_STAND = SAT_WALL.outerFace - 0.22

/**
 * A curved row on arc radius `arcR` (round the drum centre): the object stands half the row's
 * sagitta nearer the drum, so its footprint box covers the whole curved row (collision).
 */
function row(arcR: number, width: number, depth: number) {
  const sag = (width * width) / (8 * arcR)
  return { r: arcR - sag / 2, footprint: [width, depth + sag] as [number, number] }
}

const ATLAS = satellite('atlas')
const LIB = satellite('library')
const SHOP = satellite('shop')
const AX = THEATRE.axisDeg
/** A crescent room: its middle. */
const MID = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2
/** Seat width per place in the theatre rows. */
const SEAT_W = 0.6
/** The three seat rows on THEATRE.rows (the tour's theatre stop stands in the aisle before the back row). */
const ROWS = THEATRE.rows.map((r) => ({ ...row(r.r, r.seats * SEAT_W, 0.62), arcR: r.r, seats: r.seats }))
/** The programme board in the lobby, east of the door's straight run in. */
const PROGRAMME = polar(SAT_WALL.innerFace + 2.0, satellite('theatre').doorDeg + 4)
/** The map (HB's panel at width 7.0, its own aspect) and the partners band beside it on the Atlas's outer wall. */
const MAP = { width: 7.0, height: 4.45, bottom: 0.75 }
const PARTNERS = { width: 1.8, height: 3.0 }
const MAP_DEG = ATLAS.doorDeg - 0.4
const PARTNERS_DEG = MAP_DEG + ((MAP.width / 2 + 0.6 + PARTNERS.width / 2) / OUTER_STAND) / DEG
/** The Red Room's wings either side of it in the library crescent (plan angles, deg). */
const RR_HALF_DEG = Math.asin((RED_ROOM.r + RED_ROOM.t) / Math.hypot(RED_ROOM.cx, RED_ROOM.cz)) / DEG
const WING_W = (LIB.fromDeg + RED_ROOM.aDeg - RR_HALF_DEG) / 2
const WING_E = (LIB.toDeg + RED_ROOM.aDeg + RR_HALF_DEG) / 2

export const ROOM_OBJECTS: SceneObjectConfig[] = [
  // ══ The Clay Atlas (F23) ══════════════════════════════════════════════════════════
  {
    id: 'atlas-map',
    title: 'A Map of Making — India',
    kind: 'map-wall',
    // HB's panel at 7.0 m wide (its own aspect: the outline, projection and face are unchanged); a
    // hair west of the door's axis so the partners band fits beside it, clear of the end wall
    position: at(OUTER_STAND, MAP_DEG),
    rotationDeg: facingIn(MAP_DEG),
    footprint: [MAP.width + 0.3, 0.3],
    height: MAP.bottom + MAP.height + 0.2,
    props: { width: MAP.width, height: MAP.height, bottom: MAP.bottom, title: 'A Map of Making', finish: 'clay', kicker: 'CLAY ATLAS  ·  MAP WALL', pins: '' },
    interactive: true,
    // the places are pinned (props.pins "lon,lat;…") once the workshop confirms them
    placeholder: true,
    description: 'The map of India, with the places where the traditions in this pavilion are made. The places are marked once the workshop confirms them.',
    zone: 'atlas',
    alt: 'A large relief map of India in a terracotta surround, lit evenly from above.',
    i18n: {
      hi: { title: 'निर्माण का मानचित्र — भारत', description: 'भारत का मानचित्र, उन जगहों के साथ जहाँ इस मंडप की परंपराएँ बनती हैं। कार्यशाला की पुष्टि के बाद जगहें चिह्नित की जाएँगी।', alt: 'टेराकोटा चौखटे में भारत का एक बड़ा उभरा मानचित्र, ऊपर से समान रोशनी में।' },
      bn: { title: 'নির্মাণের মানচিত্র — ভারত', description: 'ভারতের মানচিত্র, যেখানে এই প্যাভিলিয়নের ঐতিহ্যগুলি তৈরি হয় সেই জায়গাগুলি সহ। কর্মশালা নিশ্চিত করলে জায়গাগুলি চিহ্নিত হবে।', alt: 'পোড়ামাটির কাঠামোয় ভারতের একটি বড় উঁচু মানচিত্র, ওপর থেকে সমান আলোয়।' },
    },
  },
  {
    id: 'atlas-partners',
    title: 'Partners',
    kind: 'credits-panel',
    position: at(OUTER_STAND, PARTNERS_DEG),
    rotationDeg: facingIn(PARTNERS_DEG),
    footprint: [PARTNERS.width, 0.3],
    height: PARTNERS.height,
    props: { layout: 'partners' },
    zone: 'atlas',
    alt: 'A pale panel beside the map with the two partner logos: DC Handicrafts, presenting the exhibition, and IIT Kharagpur, in collaboration.',
    i18n: {
      hi: { title: 'सहयोगी', alt: 'मानचित्र के पास एक हल्के रंग का पटल, जिस पर दोनों सहयोगियों के लोगो हैं: प्रदर्शनी प्रस्तुत करने वाला डीसी हस्तशिल्प, और सहयोग में आईआईटी खड़गपुर।' },
      bn: { title: 'সহযোগী', alt: 'মানচিত্রের পাশে একটি হালকা প্যানেল, তাতে দুই সহযোগীর লোগো: প্রদর্শনীর উপস্থাপক ডিসি হস্তশিল্প, আর সহযোগিতায় আইআইটি খড়্গপুর।' },
    },
  },
  {
    id: 'atlas-compass',
    title: 'Compass of the Eight Directions',
    kind: 'compass-mandala',
    position: at(SAT_WALL.innerFace + 3.5, ATLAS.doorDeg),
    rotationDeg: 0,
    props: { r: 2.0, ink: '#7a2a22' },
    zone: 'atlas',
    alt: 'A round compass inlaid in the floor, with eight pointed rays and a brass needle turned to the north.',
  },

  // ══ The Agni Theatre (F24) ════════════════════════════════════════════════════════
  {
    id: 'theatre-house',
    title: 'The Agni Theatre',
    kind: 'theatre-house',
    position: at(SAT_WALL.outerFace - 0.12, AX),
    rotationDeg: facingIn(AX),
    footprint: [2 * SAT_WALL.outerFace * Math.sin(((THEATRE.screenTo - THEATRE.screenFrom) / 2) * DEG) + 0.2, 0.16],
    height: 4.6,
    props: { dimTo: 0.22, fadeSec: 2, firingSec: 20, kilnFilm: true, chapterSec: 24 },
    interactive: true,
    description: 'A long room under a brick vault, with a screen that follows the curve of the wall. Between films the joints of the vault glow as a kiln does when it is fired. Until the pavilion’s films are ready, the screen shows a short abstract piece in four parts: earth, water, hand and fire.',
    zone: 'theatre',
    alt: 'A dim red hall with two curved rows of seats facing a wide curved screen under a brick barrel vault.',
    i18n: {
      hi: { title: 'अग्नि रंगमंच', description: 'ईंटों की मेहराबदार छत के नीचे एक लंबा कक्ष, जिसका परदा दीवार के घुमाव के साथ मुड़ता है। फ़िल्मों के बीच छत के जोड़ वैसे ही दहकते हैं जैसे आँवा पकाते समय। मंडप की फ़िल्में तैयार होने तक परदे पर चार भागों की एक छोटी अमूर्त रचना चलती है: मिट्टी, पानी, हाथ और आग।', alt: 'ईंटों की मेहराबदार छत के नीचे एक धीमी रोशनी वाला लाल कक्ष, जिसमें सीटों की दो घुमावदार पंक्तियाँ एक चौड़े घुमावदार परदे की ओर हैं।' },
      bn: { title: 'অগ্নি প্রেক্ষাগৃহ', description: 'ইটের খিলান-ছাদের নিচে একটি লম্বা ঘর, যার পর্দা দেয়ালের বাঁক ধরে বেঁকে আছে। ছবির ফাঁকে ছাদের জোড়গুলি ভাটি পোড়ানোর মতো জ্বলে ওঠে। প্যাভিলিয়নের ছবি তৈরি না হওয়া পর্যন্ত পর্দায় চার পর্বের একটি ছোট বিমূর্ত রচনা চলে: মাটি, জল, হাত আর আগুন।', alt: 'ইটের খিলান-ছাদের নিচে একটি আবছা লাল ঘর, যেখানে দুটি বাঁকা সারির আসন একটি চওড়া বাঁকা পর্দার দিকে মুখ করে।' },
    },
  },
  ...ROWS.map<SceneObjectConfig>((r, i) => ({
    id: ['theatre-row-back', 'theatre-row-mid', 'theatre-row-front'][i] ?? `theatre-row-${i + 1}`,
    title: 'Theatre seats',
    kind: 'theatre-seating',
    position: at(r.r, AX),
    rotationDeg: facingOut(AX),
    footprint: r.footprint,
    height: 1.0,
    props: { seats: r.seats, arcR: r.arcR },
    zone: 'theatre',
    alt: `A curved row of ${r.seats} low seats in clay-red cloth on a rammed-earth step.`,
  })),
  {
    id: 'theatre-programme',
    title: 'Programme',
    kind: 'programme-board',
    position: [PROGRAMME[0], 0, PROGRAMME[1]],
    rotationDeg: facingPoint(PROGRAMME, polar(MID, satellite('theatre').doorDeg)),
    footprint: [0.62, 0.42],
    height: 1.75,
    props: { title: 'Agni Theatre', films: '' },
    zone: 'theatre',
    alt: 'A slate board on a timber easel listing what is showing in the theatre.',
  },

  // ══ The Kothi Library (F25) ═══════════════════════════════════════════════════════
  ...[WING_W, WING_E].map<SceneObjectConfig>((a, i) => ({
    id: `library-shelves-${i + 1}`,
    title: 'Library shelves',
    kind: 'bookcase',
    position: at(SAT_WALL.outerFace - 0.25, a),
    rotationDeg: facingIn(a),
    footprint: [2.1, 0.4],
    height: 2.45,
    props: { seed: 41 + i, curveR: SAT_WALL.outerFace, finish: 'clay' },
    zone: 'library',
    alt: 'Curved shelves of dark timber set in clay niches along the outer wall, filled with books.',
  })),
  {
    id: 'library-soils',
    title: 'Soil archive',
    kind: 'soil-archive',
    // against the east wing's end wall, facing back along the wing
    position: at(MID, LIB.toDeg - ((0.17 + SAT_WALL.t / 2 + 0.03) / MID) / DEG),
    rotationDeg: facingDecreasing(LIB.toDeg),
    footprint: [1.86, 0.34],
    height: 2.35,
    props: { cols: 12, rows: 5 },
    interactive: true,
    placeholder: true,
    description: 'Glass jars for soil and clay samples, lit from behind. The samples and their places are added as the workshop collects them.',
    zone: 'library',
    alt: 'A wall of small glass jars in a timber rack, glowing from behind in a gradient of earth colours.',
  },
  {
    id: 'library-table',
    title: 'Reading table',
    kind: 'reading-table',
    // in the east wing, between its inner wall and the shelves
    position: at(SAT_WALL.innerFace + 2.3, WING_E),
    rotationDeg: facingIn(WING_E),
    footprint: [1.8, 1.8],
    height: 0.76,
    props: { round: true, r: 0.7, chairs: 4 },
    zone: 'library',
    alt: 'A round timber reading table with four chairs under a small round roof light.',
  },
  {
    id: 'library-archive',
    title: 'Archive cabinet',
    kind: 'archive-cabinet',
    // against the west wing's end wall, facing along the wing
    position: at(MID, LIB.fromDeg + ((0.19 + SAT_WALL.t / 2 + 0.03) / MID) / DEG),
    rotationDeg: facingIncreasing(LIB.fromDeg),
    footprint: [1.6, 0.38],
    height: 1.32,
    props: { cols: 4, rows: 3, drawers: '' },
    interactive: true,
    placeholder: true,
    description: 'A cabinet of shallow drawers for sherds and samples. Each drawer is lit from inside when it is opened. Its contents are added as the workshop catalogues them.',
    zone: 'library',
    alt: 'A low clay-plastered cabinet of twelve shallow drawers with brass pulls; one drawer stands open, lit from inside.',
    i18n: {
      hi: { title: 'संग्रह की अलमारी', description: 'ठीकरों और नमूनों के लिए उथली दराज़ों की अलमारी। खोलने पर हर दराज़ भीतर से रोशन होती है। इसकी सामग्री कार्यशाला की सूची बनने के साथ जोड़ी जाएगी।' },
      bn: { title: 'সংগ্রহের আলমারি', description: 'খোলামকুচি আর নমুনার জন্য অগভীর দেরাজের আলমারি। খুললে প্রতিটি দেরাজ ভেতর থেকে আলোকিত হয়। কর্মশালা তালিকা করলে ভেতরের জিনিস যোগ হবে।' },
    },
  },
  ...[MID - 1.2, MID + 1.2].map<SceneObjectConfig>((r, i) => ({
    id: `library-listen-${i + 1}`,
    title: 'Listening seat',
    kind: 'listening-post',
    position: at(r, WING_W + 1),
    rotationDeg: facingDecreasing(WING_W + 1),
    footprint: [0.66, 0.66],
    height: 1.45,
    props: { clip: '', speaker: '', durationSec: 0 },
    interactive: true,
    placeholder: true,
    description: 'A seat with a clay horn for listening. Recordings are added when they have been made.',
    zone: 'library',
    alt: 'A low clay seat with a cushion and a flared terracotta horn on a stem beside it.',
  })),
  {
    id: 'library-resources',
    title: 'Resources',
    kind: 'resource-board',
    position: at(SAT_WALL.innerFace + 0.03, WING_W + 2.5),
    rotationDeg: facingOut(WING_W + 2.5),
    footprint: [0.97, 0.05],
    height: 2.2,
    props: { width: 0.9 },
    interactive: true,
    description: 'Further reading and tools for visitors, teachers and researchers.',
    links: [{ label: 'Accessible text guide', href: '/guide', note: 'Every room and item as plain text — printable, screen-reader friendly' }],
    zone: 'library',
    alt: 'A framed wall board titled Resources, listing the accessible text guide.',
  },

  // ══ The Haat (F26) ════════════════════════════════════════════════════════════════
  // the Haat's shelves are curved runs along its outer wall (config/grandObjects/installations.ts)
  {
    id: 'haat-table',
    title: 'The kiln-load table',
    kind: 'shop-table',
    // in the middle of the room, ahead of the door
    position: at(MID, SHOP.doorDeg),
    rotationDeg: facingIn(SHOP.doorDeg),
    footprint: [1.8, 1.8],
    height: 1.05,
    props: { seed: 11, dressing: 'clay', tiers: 3 },
    interactive: true,
    placeholder: true,
    description: 'A round stepped table, stacked like a kiln before firing, with pieces made by potters of these traditions.',
    zone: 'shop',
    alt: 'A round three-tiered table in rammed earth, stacked with pots and cups like a kiln before firing.',
  },
  {
    id: 'haat-counter',
    title: 'Counter',
    kind: 'shop-counter',
    position: at(SAT_WALL.innerFace + 1.2, SHOP.fromDeg + 2.6),
    rotationDeg: facingIncreasing(SHOP.fromDeg + 2.6),
    footprint: [1.5, 0.55],
    height: 1.0,
    props: { dressing: 'clay' },
    zone: 'shop',
    alt: 'A clay-plastered counter on a brick base, with a brass bell and a stack of paper wrappings.',
  },
  {
    id: 'haat-lanterns',
    title: 'Lanterns',
    kind: 'lantern-canopy',
    position: at(MID, SHOP.doorDeg),
    rotationDeg: 0,
    props: { count: 30, rows: 3, y: 4.6, color: '#ffb066' },
    zone: 'shop',
    alt: 'Pierced terracotta lanterns hanging at different heights under the lattice roof.',
  },

  // ══ The Parikrama walk (F21): settings of the walk's alpana and chimes ════════════
  {
    id: 'parikrama-alpana',
    title: 'Living alpana',
    kind: 'living-alpana',
    position: at(serpentineR(-100), -100),
    rotationDeg: 0,
    props: { pattern: 'kolam-a', color: '#efe6d6', width: 1.4 },
    zone: 'parikrama-west',
  },
  {
    id: 'parikrama-chimes',
    title: 'Clay chimes',
    kind: 'clay-chimes',
    position: at(serpentineR(-133), -133),
    rotationDeg: 0,
    props: { count: 5 },
    zone: 'parikrama-west',
  },
]
