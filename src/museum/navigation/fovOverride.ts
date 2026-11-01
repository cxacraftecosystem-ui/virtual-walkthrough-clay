/**
 * A temporary field of view for the walking camera (deg), or null for the architectural default.
 * Frames of Clay (ui/PhotoMode.tsx) sets it while a preset is framed; VisitorController applies it.
 */
import { create } from 'zustand'

export const useFovOverride = create<{ fov: number | null }>(() => ({ fov: null }))

export function setFovOverride(fov: number | null) {
  const v = fov !== null && Number.isFinite(fov) ? Math.max(20, Math.min(90, fov)) : null
  if (useFovOverride.getState().fov !== v) useFovOverride.setState({ fov: v })
}
