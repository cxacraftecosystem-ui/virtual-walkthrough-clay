/**
 * In-scene mount: hands-on craft and the soundscape (F3, F7 drone, F17–F19, F22, F29).
 * Owned by WP4. Mounted by spectacle/Spectacle.tsx inside its own error boundary.
 *
 *   - installs the score (spectacle/music.ts: chapters, the Turn's opening fifth, cue accents)
 *     and the soundscape (zone reverb and the craft sources live in media/soundscape*)
 *   - draws the horse procession across both halves of the Parikrama walk
 *   - exposes `window.__craft` for automation: the score's state and the live node count
 *
 * The clay bed, the kiln window, the ghatam set and the pit firing are ordinary scene objects
 * (config/spectacleObjects/craft.ts) drawn by <SceneObjects/>.
 */
import { useEffect, useMemo } from 'react'
import { SCENE_OBJECTS } from '../../config/objects'
import { craftNodeCount } from '../../media/soundscape/craft'
import { ensureSoundscape } from '../../media/soundscape'
import { HorseProcessionView } from '../../models/horseProcession'
import { InMuseumScene } from '../../models/sceneContext'
import { ZoneGroup } from '../../navigation/zoneCulling'
import { ensureMusic, musicDebug } from '../music'
import { kindProps } from '../settings'

export function CraftMount() {
  useEffect(() => {
    ensureSoundscape()
    ensureMusic()
    const g = globalThis as { __craft?: unknown }
    g.__craft = { music: musicDebug, nodes: craftNodeCount }
    return () => {
      g.__craft = undefined
    }
  }, [])
  const horses = useMemo(() => (SCENE_OBJECTS.some((o) => o.kind === 'horse-procession') ? kindProps('horse-procession') : null), [])
  return (
    <InMuseumScene.Provider value={true}>
      {horses && (
        <ZoneGroup zones={['parikrama-west', 'parikrama-east']}>
          <HorseProcessionView props={horses} />
        </ZoneGroup>
      )}
    </InMuseumScene.Provider>
  )
}
