/**
 * CURATOR REVIEW — whether the survey traditions' names, places and captions may show.
 *
 * Every craft piece of the grand plan is a placeholder until the workshop (DC Handicrafts and
 * IIT Kharagpur) confirms it (GRAND §4.1, §11.3). Until then the visitor sees each piece's
 * descriptive form title ("Coil-built pot, cut open — Study") and the region bay headers only;
 * tradition names, places and captions stay silent.
 *
 *   ?review                   curator review mode (this site only): every name and caption shows
 *   CRAFTS_CONFIRMED = true   the lead's switch once the workshop has confirmed the list
 *
 * Pure (no React, no three.js): read by the config at module load, so the scene object list is
 * built once in either form.
 */
import { SITE } from '../../site'

/** Flip once the workshop has confirmed the survey list (GRAND §11.3, lead decision). */
export const CRAFTS_CONFIRMED = false

/** Curator review mode: `?review` in the address, on the clay site only. */
export function reviewMode(): boolean {
  if (SITE.id !== 'clay' || typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).has('review')
  } catch {
    return false
  }
}

/** Whether a tradition's name, place and caption may be shown to whoever is looking. */
export function traditionsVisible(): boolean {
  return CRAFTS_CONFIRMED || reviewMode()
}
