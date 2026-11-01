/**
 * 'spectacle' — the curator's spectacle settings (SPECTACLE F1, F7, F29). Props:
 * models/propSchemas.ts {arrival: 'full' | 'short' | 'off', turnReveal, music, ambience}.
 *
 * Draws nothing: the object only carries the settings, read through `kindProps('spectacle')`
 * (spectacle/settings.ts) by the arrival flight (navigation/ArrivalFlight.tsx), the turn into
 * the court and the score. One per exhibition (config/spectacleObjects/experience.ts).
 */
export function SpectacleSingleton() {
  return null
}
