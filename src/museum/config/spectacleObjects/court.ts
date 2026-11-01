/**
 * Scene objects of the pool court, the sundial, the strata and the duplex band (SPECTACLE F2 rill,
 * F6, F11, F12, F16, F20; GRAND §2.5, §3 #33). Spread into SCENE_OBJECTS (config/objects.ts).
 * Owned by P3.
 *
 * Positions derive from the pavilion's constants. The court is one composition (p07l): the pool,
 * the red clay lotus floating on the pool, the dome and the light. The court pieces (sundial, pool,
 * lotus) are built in court coordinates and stand at the oculus centre. The terracotta medallion on F (f-inner-4) is wall decor
 * (config/decor.ts), not an object.
 *
 * Placeholder silence: the tool names, the strata layers' names and the potter make no factual
 * claim until the workshop confirms them (`placeholder: true`).
 */
import { KHARAGPUR, sunDirection, sunPosition } from '../../lighting/solar'
import { SURFACES } from '../layout'
import { KEY, MUSEUM } from '../museum'
import { WATER_RING } from '../diyas'
import type { SceneObjectConfig } from '../objects'


/** The rill: on the entrance axis from the forecourt's far edge to the portal's sill (SPECTACLE F2, GRAND §2.7). */
const RILL = { z0: MUSEUM.forecourt.endZ - 1.0, z1: KEY.annexOuterZ + 0.1 }

export const COURT_OBJECTS: SceneObjectConfig[] = [
  {
    id: 'court-mandala',
    title: 'The Sun Mandala',
    kind: 'court-mandala',
    position: [0, 0, 0],
    // GRAND §0.4: the dome replaces the crown and the coloured floor; the sundial's brass hour lines stay
    props: { pattern: 'chakra', petals: 16, gold: true, spinSec: 600, floor: false, sundial: true },
    zone: 'inner',
    alt: 'Thin brass hour lines cross the court floor round the pool, where the sun through the oculus marks the time.',
  },
  {
    id: 'court-lotus',
    title: 'The Lotus',
    kind: 'lotus',
    // floating on the still water at the pool's centre (p07l: no island shows)
    position: [0, MUSEUM.oculus.poolLevel, 0],
    // no footprint: the curb's collider keeps visitors out of the pool
    height: 1.4,
    props: { r: 1.6, petals: 8, layers: 2, color: '#b3261e', bloom: 'sun' },
    zone: 'inner',
    interactive: true,
    description: 'A lotus of glazed red clay, three metres across, floating on the still pool under the open oculus. Its petals open with the morning sun and close again at dusk.',
    alt: 'A great red clay lotus with glossy petals floats on a dark, still pool that holds the circle of sky in the dome.',
    i18n: {
      hi: {
        title: 'कमल',
        description: 'चमकदार लाल मिट्टी का तीन मीटर चौड़ा कमल, खुले गवाक्ष के नीचे ठहरे ताल पर तैरता हुआ। सुबह की धूप के साथ इसकी पंखुड़ियाँ खुलती हैं और साँझ को फिर बंद हो जाती हैं।',
        alt: 'गुंबद के आकाश-घेरे को थामे अँधेरे, ठहरे ताल पर तैरता चमकदार पंखुड़ियों वाला लाल मिट्टी का बड़ा कमल।',
      },
      bn: {
        title: 'পদ্ম',
        description: 'চকচকে লাল মাটির তিন মিটার চওড়া একটি পদ্ম, খোলা গবাক্ষের নিচে স্থির জলে ভাসছে। সকালের রোদে এর পাপড়ি খোলে, সন্ধ্যায় আবার বন্ধ হয়।',
        alt: 'গম্বুজের আকাশ-বৃত্ত ধরে রাখা অন্ধকার স্থির জলে ভাসমান চকচকে পাপড়ির বিশাল লাল মাটির পদ্ম।',
      },
    },
  },
  {
    id: 'water-ring',
    title: 'The Still Water',
    kind: 'water-ring',
    position: [0, 0, 0],
    props: { r0: WATER_RING.r0, r1: WATER_RING.r1, level: WATER_RING.y, tapRipples: true, tint: '#0e0b0c' },
    zone: 'inner',
    alt: 'A ring of dark, still water inside the plinth reflects the sky through the opening in the roof.',
  },
  // the Great Wheel (F13) and the Kulhad Helix (F14) are retired (GRAND §0.4): their kinds stay, unplaced
  // the Mandala of Clay Tools is unplaced (art round 3): the court holds pool, lotus, dome and
  // light only (GRAND §3 #29); its kind stays
  {
    id: 'strata-wall',
    title: 'Earth Section',
    kind: 'strata-wall',
    position: [0, 0, 0],
    props: { surfaces: 'h-inner-1,h-inner-2,h-inner-3,h-inner-4', layers: '', sweepSec: 40 },
    zone: SURFACES['h-inner-2'].zone,
    placeholder: true,
    alt: 'The back of the curved description wall shows layers of earth in section: dark topsoil with roots, grey silt, lenses of clay, red laterite and white kaolin.',
  },
  {
    id: 'water-rill',
    title: 'Threshold of Earth',
    kind: 'water-rill',
    position: [0, 0, (RILL.z0 + RILL.z1) / 2],
    props: { length: RILL.z0 - RILL.z1, width: 0.4 },
    zone: 'entrance-court',
    alt: 'A narrow channel of still water lined with terracotta tiles runs on the path towards the entrance door and reflects it.',
  },
  {
    id: 'duplex-frieze',
    title: 'Procession Frieze',
    kind: 'duplex-frieze',
    position: [0, 0, 0],
    props: { scenes: '', seed: 1, cove: true },
    zone: 'inner',
    alt: 'A band of terracotta relief runs round the inside of the drum at the height of the duplex line, showing people digging, carrying, kneading, throwing, beating, drying and firing clay and carrying pots to market.',
  },
]

/** The rill's door end (for checks): it stops short of the threshold. */
export const RILL_DOOR_GAP = RILL.z1 - KEY.annexOuterZ

/* ------------------------------------------------------------------ */
/* the Great Wheel's loop (models/ghostPotter.tsx), as fractions of it */
/* ------------------------------------------------------------------ */

/** Phases of the potter's loop (45 s reference): centre, open, three pulls, belly, collar, wire off, rise, rest. */
export const POTTER_LOOP = {
  centre: [0 / 45, 6 / 45],
  open: [6 / 45, 11 / 45],
  pulls: [11 / 45, 23 / 45],
  belly: [23 / 45, 29 / 45],
  collar: [29 / 45, 34 / 45],
  wire: [34 / 45, 36 / 45],
  rise: [36 / 45, 41.5 / 45],
  rest: [41.5 / 45, 1],
} as const

export const easeInOut = (x: number) => x * x * (3 - 2 * x)
/** 0 … 1 through the span [a, b] at u. */
export const spanAt = (u: number, [a, b]: readonly number[]) => Math.min(1, Math.max(0, (u - a) / (b - a)))

/** The pot's shape stage (0 lump … 6 finished, fractional) at loop fraction u. */
export function potterStage(u: number): number {
  const T = POTTER_LOOP
  if (u < T.open[0]) return 0
  if (u < T.pulls[0]) return easeInOut(spanAt(u, T.open))
  if (u < T.belly[0]) {
    // three pulls, each a lift then a pause
    const p = spanAt(u, T.pulls) * 3
    const i = Math.min(2, Math.floor(p))
    return 1 + i + easeInOut(Math.min(1, (p - i) / 0.75))
  }
  if (u < T.collar[0]) return 4 + easeInOut(spanAt(u, T.belly))
  return 5 + easeInOut(spanAt(u, T.collar))
}

/* ------------------------------------------------------------------ */
/* the sundial (architecture/CourtFloorMandala.tsx)                    */
/* ------------------------------------------------------------------ */

/** Height the sunlight enters at: the middle of the dome's light-well above the oculus (GRAND §1.2). */
export const APERTURE_Y = (MUSEUM.dome.lightWell.y0 + MUSEUM.dome.lightWell.y1) / 2

/** Where the centre of the sun patch through the oculus falls on the floor at `date` (null when the sun is low). */
export function sunPatch(date: Date, minElevationDeg = 8): [number, number] | null {
  const p = sunPosition(date, KHARAGPUR.lat, KHARAGPUR.lon)
  if (p.elevationDeg < minElevationDeg) return null
  const [dx, dy, dz] = sunDirection(p)
  const k = APERTURE_Y / dy
  return [-dx * k, -dz * k]
}

/** The IST calendar day of `now`, as UTC midnight of that date. */
export function istDay(now = new Date()): Date {
  const ist = new Date(now.getTime() + KHARAGPUR.tzHours * 3600000)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()))
}
