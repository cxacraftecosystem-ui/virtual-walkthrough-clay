/**
 * In-scene mount: satellite rooms, Parikrama walk and Sky Rim shells (F21, F23–F26). The Kiln
 * Stair (F4) is retired (GRAND §0.4): architecture/KilnStair.tsx stays compiling, unmounted.
 * Owned by WP1. Mounted by spectacle/Spectacle.tsx inside its own error boundary.
 *
 * The room furniture (map, partners, theatre house and seats, shelves, archive, Haat…) are scene
 * objects (config/spectacleObjects/rooms.ts); the notch doors' frames are part of the pavilion
 * (architecture/Pavilion.tsx). Everything here is architecture.
 */
import { Parikrama } from '../../architecture/Parikrama'
import { Satellites } from '../../architecture/Satellites'
import { SkyRimRoof } from '../../architecture/SkyRimRoof'
import { useEffect } from 'react'
import { theatreHouseState } from '../../models/theatreHouse'
import { fireCue } from '../cues'
import { ZoneGroup } from '../../navigation/zoneCulling'

export function RoomsMount() {
  // automation handle (screenshots, docent tests): fire a cue, read the theatre's state
  useEffect(() => {
    const w = window as unknown as { __spectacleRooms?: unknown }
    w.__spectacleRooms = { fireCue, theatre: theatreHouseState }
    return () => {
      w.__spectacleRooms = undefined
    }
  }, [])
  return (
    <group name="north-wing">
      <Satellites />
      <Parikrama />
      {/* the roof's shell, drawn only where it can be seen (the arrival flight shows everything) */}
      <ZoneGroup zones={['entrance-court', 'sky-rim']}>
        <SkyRimRoof />
      </ZoneGroup>
    </group>
  )
}
