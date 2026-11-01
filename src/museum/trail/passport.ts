/**
 * THE CLAY PASSPORT (SPECTACLE F31) — state.
 *
 * Stamp posts stand in the pavilion's rooms ('stamp-post' scene objects, props
 * {stamp, motif, requires}); pressing one presses its Molela-style relief roundel into the
 * visitor's clay tablet, with a thunk, a haptic pulse and a puff of dust. Some stamps have no
 * post: the three perches ("The Balcony", "Sky Rim" and "Sphere Well", on arriving by the ride),
 * "The Red Room" (standing under its disc of sky) and "Made a pot" (firing a pot in the clay
 * studio). While the clay studio is taken down (GRAND §0.2, GRAND_FLAGS.clayStudio) "Made a pot"
 * is optional and not in the set; its id stays valid, so a passport that holds it still loads.
 * Stored on this device only, under `clay.passport.v1` (the trail.ts pattern); nothing is sent
 * but an anonymous `stamp` analytics event.
 *
 *   pressStamp('atlas', 'atlas-post')    from a post (checks its `requires`)
 *   awardStamp('pot')                    a stamp earned elsewhere
 *
 * `requires` (curator text on the post): `dwell:<zone>:<seconds>` — the visitor must have spent
 * that long in the zone this visit (the theatre: a minute of film), or seen a film chapter end
 * there (cue `theatre:chapterEnd`). Empty: always.
 */
import { create } from 'zustand'
import type { ZoneId } from '../config/layout'
import { GRAND_FLAGS } from '../config/museum'
import type { MotifId } from './stampMotifs'

export const STAMP_IDS = ['arrival', 'atlas', 'a', 'b', 'c', 'oculus', 'hallway', 'parikrama', 'theatre', 'library', 'haat', 'pot', 'sky-rim', 'duplex', 'red-room', 'sphere-well'] as const
export type StampId = (typeof STAMP_IDS)[number]

export interface StampDef {
  id: StampId
  motif: MotifId
  /** How it is earned: a post in the room, firing a pot, arriving on a perch, standing in a place. */
  how: 'post' | 'pot' | 'perch' | 'visit'
  /** The room it belongs to (passport hints, the guide). */
  zone?: ZoneId
}

/** Every stamp there has been (old passports may hold any of them). */
const ALL_STAMPS: readonly StampDef[] = [
  { id: 'arrival', motif: 'door', how: 'post', zone: 'entrance-court' },
  { id: 'atlas', motif: 'compass', how: 'post', zone: 'atlas' },
  { id: 'a', motif: 'horse', how: 'post', zone: 'ring-a' },
  { id: 'b', motif: 'plaque', how: 'post', zone: 'ring-b' },
  { id: 'c', motif: 'kettle', how: 'post', zone: 'ring-c' },
  { id: 'oculus', motif: 'rings', how: 'post', zone: 'inner' },
  { id: 'hallway', motif: 'arches', how: 'post', zone: 'hallway-d' },
  { id: 'parikrama', motif: 'kolam', how: 'post', zone: 'parikrama-west' },
  { id: 'theatre', motif: 'flame', how: 'post', zone: 'theatre' },
  { id: 'library', motif: 'kothi', how: 'post', zone: 'library' },
  { id: 'haat', motif: 'lantern', how: 'post', zone: 'shop' },
  { id: 'pot', motif: 'pot', how: 'pot' },
  { id: 'sky-rim', motif: 'sun', how: 'perch', zone: 'sky-rim' },
  { id: 'duplex', motif: 'balcony', how: 'perch', zone: 'duplex' },
  { id: 'red-room', motif: 'disc', how: 'visit', zone: 'library' },
  { id: 'sphere-well', motif: 'spiral', how: 'perch', zone: 'sphere-well' },
]

/** The stamps of this pavilion: "Made a pot" only while the clay studio is open. */
export const STAMPS: readonly StampDef[] = ALL_STAMPS.filter((d) => d.how !== 'pot' || GRAND_FLAGS.clayStudio)

export const STAMP_TOTAL = STAMPS.length
export const isStampId = (v: unknown): v is StampId => typeof v === 'string' && (STAMP_IDS as readonly string[]).includes(v)
export const stampDef = (id: string) => ALL_STAMPS.find((s) => s.id === id)

/* ------------------------------------------------------------------ */
/* Requirements                                                        */
/* ------------------------------------------------------------------ */

/** Seconds spent in each zone this visit (fed by the experience mount). */
const zoneTime = new Map<string, number>()
/** Zones where a film chapter has played to its end this visit. */
const filmSeen = new Set<string>()

export function addZoneTime(zone: string, seconds: number) {
  zoneTime.set(zone, (zoneTime.get(zone) ?? 0) + seconds)
}
export const zoneSeconds = (zone: string) => zoneTime.get(zone) ?? 0
export function markFilmSeen(zone: string) {
  filmSeen.add(zone)
}

/** Parse a post's `requires` text. Unknown forms are treated as no requirement. */
export function parseRequires(req: string | undefined): { zone: string; seconds: number } | null {
  const m = /^\s*dwell:([a-z0-9-]+):(\d+(?:\.\d+)?)\s*$/i.exec(req ?? '')
  return m ? { zone: m[1], seconds: Number(m[2]) } : null
}

export function requirementMet(req: string | undefined): boolean {
  const r = parseRequires(req)
  if (!r) return true
  return zoneSeconds(r.zone) >= r.seconds || filmSeen.has(r.zone)
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const KEY = 'clay.passport.v1'

interface Stored {
  /** Stamp id → ISO time it was pressed. */
  stamps: Partial<Record<StampId, string>>
  completedAt?: string
}

function read(): Stored {
  const empty: Stored = { stamps: {} }
  if (typeof window === 'undefined') return empty
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { v?: number; stamps?: Record<string, unknown>; completedAt?: unknown } | null
    if (!s || s.v !== 1 || typeof s.stamps !== 'object' || !s.stamps) return empty
    const stamps: Stored['stamps'] = {}
    for (const [k, v] of Object.entries(s.stamps)) if (isStampId(k) && typeof v === 'string') stamps[k] = v
    return { stamps, completedAt: typeof s.completedAt === 'string' ? s.completedAt : undefined }
  } catch {
    return empty
  }
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ...s }))
  } catch {
    /* storage unavailable: the passport lasts for this visit */
  }
}

export type PressResult = 'stamped' | 'already' | 'locked'

export interface PassportState extends Stored {
  /** The passport (clay tablet) is open. */
  open: boolean
  /** The last press (drives the posts' animation and the toast); `n` counts presses. */
  last: { id: StampId; result: PressResult; post?: string; n: number } | null
  /** The completion card. */
  celebrate: boolean
  setOpen: (v: boolean) => void
  setCelebrate: (v: boolean) => void
  reset: () => void
}

export const usePassport = create<PassportState>((set) => ({
  ...read(),
  open: false,
  last: null,
  celebrate: false,
  setOpen: (open) => set({ open }),
  setCelebrate: (celebrate) => set({ celebrate }),
  reset: () => {
    set({ stamps: {}, completedAt: undefined, celebrate: false, last: null })
    write({ stamps: {} })
  },
}))

let presses = 0
type Hook = (id: StampId, result: PressResult, post?: string) => void
const hooks = new Set<Hook>()
/** Side effects of a press (sound, haptics, cue, analytics): wired by the experience overlay. */
export function onStampPress(fn: Hook): () => void {
  hooks.add(fn)
  return () => {
    hooks.delete(fn)
  }
}

function record(id: StampId, result: PressResult, post?: string) {
  usePassport.setState({ last: { id, result, post, n: ++presses } })
  for (const h of hooks) {
    try {
      h(id, result, post)
    } catch {
      /* a side effect never blocks the stamp */
    }
  }
}

/** Add a stamp (idempotent). Returns 'already' when it was there. */
export function awardStamp(id: StampId, post?: string): PressResult {
  const s = usePassport.getState()
  if (s.stamps[id]) {
    record(id, 'already', post)
    return 'already'
  }
  const stamps = { ...s.stamps, [id]: new Date().toISOString() }
  const done = STAMPS.every((d) => stamps[d.id])
  const completedAt = done ? (s.completedAt ?? new Date().toISOString()) : s.completedAt
  usePassport.setState({ stamps, completedAt, celebrate: done && !s.completedAt })
  write({ stamps, completedAt })
  record(id, 'stamped', post)
  return 'stamped'
}

/** Press a post's stamp: checks its requirement first. */
export function pressStamp(id: string, post?: string, requires?: string): PressResult | null {
  if (!isStampId(id)) return null
  if (!usePassport.getState().stamps[id] && !requirementMet(requires)) {
    record(id, 'locked', post)
    return 'locked'
  }
  return awardStamp(id, post)
}

export const stampCount = (s: Pick<Stored, 'stamps'>) => STAMPS.filter((d) => s.stamps[d.id]).length
