/**
 * State of the "Shape it yourself" studio (zustand, independent of the museum store).
 *
 * The pot is `seed + ops`: `pot` is always `reducePot(ops)` (see potEngine.ts), so undo / redo
 * are just moves of ops between the list and the redo stack. The seed fixes the hand-made
 * unevenness and the flecks, so a reload shows the very same pot. Both are kept in
 * localStorage per browser.
 */
import { create } from 'zustand'
import type { BandTechnique, PotMotifId } from './clayPalette'
import { changes, parseOps, pushOp, reducePot, START, type PotOp, type PotState } from './potEngine'

const STORAGE_KEY = 'museum.clayStudio.v1'

interface Saved {
  v: 1
  seed: number
  ops: PotOp[]
}

interface ClayStudioState {
  open: boolean
  seed: number
  ops: PotOp[]
  /** Undone ops, latest last. */
  redo: PotOp[]
  /** Ops removed by the last "clear" (undo brings them back). */
  cleared: PotOp[] | null
  pot: PotState
  /** Where on the pot widen / narrow / a new band act (0 = base, 1 = rim). */
  at: number
  motif: PotMotifId
  tech: BandTechnique
  /** The wheel is turning (off under reduced motion until the visitor starts it). */
  spin: boolean
  /** The firing animation is running. */
  firing: boolean
  setOpen: (v: boolean) => void
  set: (patch: Partial<Pick<ClayStudioState, 'at' | 'motif' | 'tech' | 'spin'>>) => void
  /**
   * Records `op` if it changes the pot. `merge`: a 'set' continuing the same gesture on the
   * same point replaces the previous one (a drag is one step to undo). Returns whether it applied.
   */
  apply: (op: PotOp, merge?: boolean) => boolean
  /** Ends a merge gesture (pointer up, slider released). */
  endGesture: () => void
  undo: () => void
  redoOp: () => void
  clear: () => void
  /** Records the firing and starts its animation (the view calls `setFiring(false)` when it has cooled). */
  fire: () => boolean
  setFiring: (v: boolean) => void
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Saved>
    if (!s || typeof s !== 'object' || typeof s.seed !== 'number' || !Number.isFinite(s.seed)) return null
    return { v: 1, seed: s.seed >>> 0, ops: parseOps(s.ops) }
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function persist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const { seed, ops } = useClayStudio.getState()
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, seed, ops } satisfies Saved))
    } catch {
      /* storage full / unavailable — the pot still works for this visit */
    }
  }, 400)
}

const newSeed = () => ((Date.now() ^ (typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 0)) * 2654435761) >>> 0

const saved = typeof window !== 'undefined' ? load() : null
/** A drag in progress may replace its own last 'set'. */
let gestureOpen = false

export const useClayStudio = create<ClayStudioState>((set, get) => ({
  open: false,
  seed: saved?.seed ?? newSeed(),
  ops: saved?.ops ?? [],
  redo: [],
  cleared: null,
  pot: saved ? reducePot(saved.ops) : START,
  at: 0.5,
  motif: 'zigzag',
  tech: 'sgraffito',
  spin: true,
  firing: false,

  setOpen: (open) => set({ open }),
  set: (patch) => set(patch),

  apply: (op, merge = false) => {
    const s = get()
    if (s.firing) return false
    const mergeable = merge && gestureOpen && op.t === 'set'
    if (!mergeable && !changes(s.pot, op)) return false
    const ops = pushOp(s.ops, op, mergeable)
    gestureOpen = merge && op.t === 'set'
    set({ ops, redo: [], cleared: null, pot: reducePot(ops) })
    persist()
    return true
  },
  endGesture: () => {
    gestureOpen = false
  },

  undo: () => {
    const s = get()
    if (s.firing) return
    gestureOpen = false
    if (!s.ops.length && s.cleared) {
      const ops = s.cleared
      set({ ops, cleared: null, redo: [], pot: reducePot(ops) })
      persist()
      return
    }
    const last = s.ops[s.ops.length - 1]
    if (!last) return
    const ops = s.ops.slice(0, -1)
    set({ ops, redo: [...s.redo, last], pot: reducePot(ops) })
    persist()
  },
  redoOp: () => {
    const s = get()
    if (s.firing) return
    gestureOpen = false
    const op = s.redo[s.redo.length - 1]
    if (!op) return
    const ops = [...s.ops, op]
    set({ ops, redo: s.redo.slice(0, -1), pot: reducePot(ops) })
    persist()
  },
  clear: () => {
    const s = get()
    if (s.firing || !s.ops.length) return
    gestureOpen = false
    set({ ops: [], redo: [], cleared: s.ops, pot: START })
    persist()
  },
  fire: () => {
    const s = get()
    if (s.firing || s.pot.fired) return false
    gestureOpen = false
    const ops = pushOp(s.ops, { t: 'fire' })
    set({ ops, redo: [], cleared: null, pot: reducePot(ops), firing: true })
    persist()
    return true
  },
  setFiring: (firing) => set({ firing }),
}))
