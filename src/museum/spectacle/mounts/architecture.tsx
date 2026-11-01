/**
 * In-scene mount: the grand plan's architecture (GRAND §2.5–§2.7). Owned by P1. Mounted by
 * spectacle/Spectacle.tsx inside its own error boundary.
 *
 *   dome ............ the coffered dome, its stepped oculus and light-well, ribs, cornice, the Sky
 *                     Rim's plinth and the rib stair (never culled: seen from everywhere)
 *   arches .......... E east, E west and D in the ring circle
 *   balcony ......... the duplex ring and its bridge to the east stair
 *   east stair ...... in the east ambulatory, up to the roof
 *   serpentine ...... the Parikrama's red walls (their floors are Floor.tsx's)
 *   Red Room ........ its ceiling, oculus and cap (its wall is a Wall)
 *   Sphere Well ..... the sunken room, its stepped ceiling, the rim's kerb and balustrade
 *
 * The rest of the shell (walls, the ambulatory's slab, floors, crescents, landscape) is built
 * by architecture/Pavilion.tsx and the rooms mount.
 */
import { Arches } from '../../architecture/Arches'
import { Balcony } from '../../architecture/Balcony'
import { Dome } from '../../architecture/Dome'
import { EastStair } from '../../architecture/EastStair'
import { RedRoomShell } from '../../architecture/RedRoomShell'
import { Serpentine } from '../../architecture/Serpentine'
import { SphereWellShell } from '../../architecture/SphereWellShell'
import { ZoneGroup } from '../../navigation/zoneCulling'

export function ArchitectureMount() {
  return (
    <group name="grand-architecture">
      <Dome />
      <Arches />
      <ZoneGroup zones={['inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'annex', 'duplex', 'sky-rim']}>
        <Balcony />
      </ZoneGroup>
      <ZoneGroup zones={['entry-e', 'annex', 'inner', 'ring-a', 'duplex', 'sky-rim', 'entrance-court']}>
        <EastStair />
      </ZoneGroup>
      <ZoneGroup zones={['parikrama-west', 'parikrama-east', 'atlas', 'theatre', 'library', 'shop', 'hallway-d', 'entrance-court', 'sky-rim']}>
        <Serpentine />
      </ZoneGroup>
      <ZoneGroup zones={['library', 'parikrama-west', 'parikrama-east', 'entrance-court', 'sky-rim']}>
        <RedRoomShell />
      </ZoneGroup>
      <ZoneGroup zones={['entrance-court', 'sphere-well', 'hallway-d', 'parikrama-west', 'sky-rim']}>
        <SphereWellShell />
      </ZoneGroup>
    </group>
  )
}
