/**
 * Scene objects of the spectacle singleton, stamp posts and photo spots (F1, F31, F32).
 * Spread into SCENE_OBJECTS (config/objects.ts). Owned by WP5.
 *
 *  • `spectacle`   the curator's settings for the arrival flight, the turn and the score (draws nothing)
 *  • `stamp-post`  one per room of the Clay Passport (trail/passport.ts); each stands against a
 *                  wall, clear of the walking lines and of every tour waypoint
 *  • `photo-spot`  a brass floor marker for each Frames of Clay preset (ui/PhotoMode.tsx); the
 *                  marker is the standing point, the props the view (flush with the floor: no footprint)
 */
import type { SceneObjectConfig } from '../objects'
import { DEG, KEY, MUSEUM, polar } from '../museum'
import { PARIKRAMA, RED_ROOM, SAT_WALL, satellite, SERP_OFFSET, serpentineR, SPHERE_WELL, THEATRE } from '../satellites'
import { at, facingIn, facingOut } from './place'

/** Stamp post: footprint (m) and height. */
const POST: [number, number] = [0.32, 0.32]
const POST_H = 1.08

type Lang3 = [string, string, string]

function post(stamp: string, motif: string, title: Lang3, zone: SceneObjectConfig['zone'], position: SceneObjectConfig['position'], rotationDeg: number, requires = ''): SceneObjectConfig {
  return {
    id: `stamp-${stamp}`,
    title: title[0],
    i18n: { hi: { title: title[1] }, bn: { title: title[2] } },
    kind: 'stamp-post',
    position,
    rotationDeg,
    footprint: POST,
    height: POST_H,
    zone,
    props: { stamp, motif, requires },
    alt: 'A terracotta post with a clay stamp on its top, for the Clay Passport.',
  }
}

/** Gallery posts stand in the podium row, one step past each tradition's last podium. */
const podiumRowR = MUSEUM.podium.ringR
const POD = MUSEUM.podium.anglesDeg
const [GATE_AB, GATE_BC] = MUSEUM.fins.atDeg
/** Against a room's inner wall, a little in from its face. */
const INSIDE = SAT_WALL.innerFace + 0.35
/** The court between the curb and F, and F's court face. */
const F_IN = MUSEUM.innerMainWall.r - MUSEUM.innerMainWall.thickness / 2
const COURT_R = (MUSEUM.oculus.rings[0] + F_IN) / 2
/** The Red Room's west wing, between the room and the library's west end (plan angle, deg). */
const LIB = satellite('library')
const WING_W = (LIB.fromDeg + RED_ROOM.aDeg - Math.asin((RED_ROOM.r + RED_ROOM.t) / Math.hypot(RED_ROOM.cx, RED_ROOM.cz)) / DEG) / 2

const STAMP_POSTS: SceneObjectConfig[] = [
  post('arrival', 'door', ['Passport stamp: Arrival', 'पासपोर्ट मुहर: आगमन', 'পাসপোর্টের ছাপ: আগমন'], 'entrance-court', [KEY.doorHalf + 0.6, 0, KEY.annexOuterZ + 0.45], 0),
  post('a', 'horse', ['Passport stamp: Gallery A', 'पासपोर्ट मुहर: दीर्घा A', 'পাসপোর্টের ছাপ: গ্যালারি A'], 'ring-a', at(KEY.ringR - 0.6, (POD.a[POD.a.length - 1] + GATE_AB) / 2), facingIn((POD.a[POD.a.length - 1] + GATE_AB) / 2)),
  post('b', 'plaque', ['Passport stamp: Gallery B', 'पासपोर्ट मुहर: दीर्घा B', 'পাসপোর্টের ছাপ: গ্যালারি B'], 'ring-b', at(podiumRowR, (POD.b[POD.b.length - 1] + GATE_BC) / 2), facingIn((POD.b[POD.b.length - 1] + GATE_BC) / 2)),
  post('c', 'kettle', ['Passport stamp: Gallery C', 'पासपोर्ट मुहर: दीर्घा C', 'পাসপোর্টের ছাপ: গ্যালারি C'], 'ring-c', at(podiumRowR, POD.c[POD.c.length - 1] - 16), facingIn(POD.c[POD.c.length - 1] - 16)),
  post('oculus', 'rings', ['Passport stamp: Oculus court', 'पासपोर्ट मुहर: आँगन', 'পাসপোর্টের ছাপ: উঠোন'], 'inner', at(F_IN - 0.35, 148), facingIn(148)),
  post('hallway', 'arches', ['Passport stamp: Wine Hall', 'पासपोर्ट मुहर: वाइन हॉल', 'পাসপোর্টের ছাপ: ওয়াইন হল'], 'hallway-d', at(MUSEUM.drum.r - 0.35, 190), facingIn(190)),
  // in the walk, against the courtyard wall where the walk swings in towards the ring
  post('parikrama', 'kolam', ['Passport stamp: Parikrama', 'पासपोर्ट मुहर: परिक्रमा', 'পাসপোর্টের ছাপ: পরিক্রমা'], 'parikrama-west', at(serpentineR(-92.5) + SERP_OFFSET - 0.45, -92.5), facingIn(-92.5)),
  post('atlas', 'compass', ['Passport stamp: Clay Atlas', 'पासपोर्ट मुहर: मिट्टी का एटलस', 'পাসপোর্টের ছাপ: মাটির অ্যাটলাস'], 'atlas', at(INSIDE, -120), facingOut(-120)),
  post('theatre', 'flame', ['Passport stamp: Agni Theatre', 'पासपोर्ट मुहर: अग्नि रंगमंच', 'পাসপোর্টের ছাপ: অগ্নি প্রেক্ষাগৃহ'], 'theatre', at(INSIDE, THEATRE.baffle.aDeg + 2.5), facingOut(THEATRE.baffle.aDeg + 2.5), 'dwell:theatre:60'),
  // the Red Room's west wing: against the library's inner wall, facing into the wing
  post('library', 'kothi', ['Passport stamp: Kothi Library', 'पासपोर्ट मुहर: कोठी पुस्तकालय', 'পাসপোর্টের ছাপ: কুঠি গ্রন্থাগার'], 'library', at(INSIDE, WING_W - 2.5), facingOut(WING_W - 2.5)),
  post('haat', 'lantern', ['Passport stamp: The Haat', 'पासपोर्ट मुहर: हाट', 'পাসপোর্টের ছাপ: হাট'], 'shop', at(INSIDE, satellite('shop').toDeg - 3), facingOut(satellite('shop').toDeg - 3)),
]

interface Frame {
  id: string
  title: Lang3
  zone: SceneObjectConfig['zone']
  x: number
  z: number
  yawDeg: number
  pitchDeg: number
  fov: number
  time: string
  weather?: string
  cue?: string
  dof?: boolean
  /** Framed from a perch (navigation/perch.ts): the marker stands at its door, the view is ridden to. */
  perch?: { id: string; t: number }
}

/**
 * Frames of Clay (F32, GRAND §8 P5). Each standing point is walkable, clear of every collider;
 * `time` is a time-of-day preset ('morning', 'noon', 'golden', 'dusk', 'night' or '' to keep the
 * visitor's), `cue` a moment to play (spectacle/cues.ts). `fov` is the vertical field of view on
 * a 16:10 screen; narrower screens widen it to keep the same horizontal view, so the Atlas frame
 * always holds the whole map and the partners' panel beside it. A frame with `perch` puts the
 * visitor on that perch (the Sphere Well's floor, looking up the spiral).
 */
/** A standing point on the drum's polar grid (or about `c`), facing a target: x, z and the compass yaw. */
function stand(r: number, aDeg: number, target: [number, number], c: [number, number] = [0, 0]) {
  const [x, z] = polar(r, aDeg, c[0], c[1])
  return { x, z, yawDeg: ((Math.atan2(target[0] - x, -(target[1] - z)) / DEG) % 360 + 360) % 360 }
}
const ATLAS_DOOR = satellite('atlas').doorDeg
/** The pit firing (spectacleObjects/craft.ts) and the map wall's middle (rooms.ts). */
const PIT = polar(KEY.lobeOuterR + 5.15, 62)
const MAP_MID = polar(SAT_WALL.outerFace, ATLAS_DOOR + 4)
/** Inside the curb on gallery A's side, the Herd island (GRAND §4.2) and the red wall behind it. */
const HERD = polar(KEY.podiumR - 4.6, 5)
/** Just outside the court's edge (layout.ts COURT: midway between the curb and the floor ring), so it stands in Gallery A. */
const HERD_STAND_R = Math.max(KEY.curbR + 0.9, (KEY.curbR + MUSEUM.oculus.floorRingR) / 2 + 0.3)
/** The Wine Hall: from its D-arch end, along the hall towards the plinths. */
const WINE_A = MUSEUM.drum.dNotchDeg - 3
/** The Red Room: just inside its door, the plinth and the shelves ahead. */
const RR_STAND_R = Math.hypot(RED_ROOM.cx, RED_ROOM.cz) - RED_ROOM.r + 0.7
/** The Sphere Well: its gate in the rim, facing the drum. */
const WELL_GATE = Math.atan2(-SPHERE_WELL.cz, -SPHERE_WELL.cx) / DEG

const FRAMES: Frame[] = [
  { id: 'dome-eye', title: ['Dome Eye', 'गुंबद की आँख', 'গম্বুজের চোখ'], zone: 'inner', ...stand(COURT_R, 108, [0, 0]), pitchDeg: 54, fov: 70, time: 'noon' },
  { id: 'lotus-noon', title: ['Lotus at Noon', 'दोपहर का कमल', 'দুপুরের পদ্ম'], zone: 'inner', ...stand(KEY.curbR + 1.0, 76, [0, 0]), pitchDeg: -14, fov: 52, time: 'noon' },
  { id: 'herd', title: ['The Herd', 'घोड़ों का झुंड', 'ঘোড়ার পাল'], zone: 'ring-a', ...stand(HERD_STAND_R, -4, HERD), pitchDeg: 3, fov: 50, time: '', dof: true },
  { id: 'wine-hall', title: ['Wine Hall', 'मदिरा-रंग कक्ष', 'ওয়াইন হল'], zone: 'hallway-d', ...stand(KEY.ambMidR, WINE_A, polar(KEY.ambMidR, WINE_A - 34)), pitchDeg: 1, fov: 56, time: '' },
  { id: 'serpentine', title: ['Serpentine', 'सर्पिल दीवारें', 'সর্পিল দেয়াল'], zone: 'parikrama-west', ...stand(serpentineR(PARIKRAMA.fromDeg + 6), PARIKRAMA.fromDeg + 6, polar(serpentineR(PARIKRAMA.fromDeg + 20), PARIKRAMA.fromDeg + 20)), pitchDeg: 4, fov: 60, time: 'golden' },
  { id: 'red-room', title: ['Red Room', 'लाल कक्ष', 'লাল ঘর'], zone: 'library', ...stand(RR_STAND_R, RED_ROOM.aDeg, [RED_ROOM.cx, RED_ROOM.cz]), pitchDeg: 12, fov: 66, time: 'noon' },
  {
    id: 'sphere-well',
    title: ['Sphere Well', 'गोले का कुआँ', 'গোলকের কূপ'],
    zone: 'entrance-court',
    ...stand(SPHERE_WELL.rimR + 1.3, WELL_GATE, [SPHERE_WELL.cx, SPHERE_WELL.cz], [SPHERE_WELL.cx, SPHERE_WELL.cz]),
    pitchDeg: 38,
    fov: 72,
    time: 'noon',
    perch: { id: 'sphere-well', t: 1 },
  },
  { id: 'atlas', title: ['The Atlas', 'एटलस', 'অ্যাটলাস'], zone: 'atlas', ...stand(SAT_WALL.innerFace + 1.0, ATLAS_DOOR + 4, MAP_MID), pitchDeg: 4, fov: 76, time: '' },
  { id: 'diya', title: ['Diya Night', 'दीयों की रात', 'প্রদীপের রাত'], zone: 'inner', ...stand(COURT_R, 54, [0, 0]), pitchDeg: -4, fov: 62, time: 'night', cue: 'night:diyas' },
  { id: 'pit', title: ['Firelight', 'आग की रोशनी', 'আগুনের আলো'], zone: 'entrance-court', ...stand(KEY.lobeOuterR + 5.15 + 4, 78, PIT), pitchDeg: 2, fov: 55, time: 'dusk', dof: true },
  { id: 'vault', title: ['Agni Vault', 'अग्नि मेहराब', 'অগ্নি খিলান'], zone: 'theatre', ...stand(SAT_WALL.outerFace - 1.6, THEATRE.screenTo - 2, polar(SAT_WALL.innerFace, THEATRE.screenFrom)), pitchDeg: 16, fov: 68, time: '', cue: 'theatre:firing' },
]

const PHOTO_SPOTS: SceneObjectConfig[] = FRAMES.map((f) => ({
  id: `frame-${f.id}`,
  title: f.title[0],
  i18n: { hi: { title: f.title[1] }, bn: { title: f.title[2] } },
  kind: 'photo-spot',
  position: [f.x, 0, f.z],
  rotationDeg: 0,
  zone: f.zone,
  props: { yawDeg: f.yawDeg, pitchDeg: f.pitchDeg, fov: f.fov, time: f.time, weather: f.weather ?? '', caption: f.title[0], dof: !!f.dof, ...(f.cue ? { cue: f.cue } : {}), ...(f.perch ? { perch: f.perch.id, perchT: f.perch.t } : {}) },
  alt: 'A small brass disc set in the floor, marking a place to take a photograph.',
}))

export const EXPERIENCE_OBJECTS: SceneObjectConfig[] = [
  {
    id: 'spectacle',
    title: 'Spectacle settings',
    kind: 'spectacle',
    position: [0, 0, 0],
    zone: 'entrance-court',
    props: { arrival: 'full', turnReveal: true, music: 0.6, ambience: 0.8, layoutEpoch: 2 },
  },
  // The Kiln Stair's door is retired with its tower (GRAND §0.4): the perch doors of the east stair
  // (the roof, the balcony) and of the Sphere Well are the experience package's (grandObjects/experience.ts).
  ...STAMP_POSTS,
  ...PHOTO_SPOTS,
]
