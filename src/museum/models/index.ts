/**
 * Procedural model library — one component per ProceduralModelId.
 * Every model: origin at floor centre, front faces +z, built to config.footprint/height.
 */
import type { ComponentType } from 'react'
import type { ProceduralModelId } from '../config/objects'
import { Column, GrandDesk, Planter, SpeakerPlaceholder, TextileBanner, TheatreSeating } from './atrium'
import { DryingLine, GardenBench, PlantBed, Tree, WaterChannel } from './courtyard'
import { Crate, Stool, Vessel } from './props'
import type { ModelProps } from './types'
import { Centrepiece } from './centrepiece'
import { Pedestal, Vitrine } from './display'
import { MapWall } from './mapWall'
import { ArtisanCapture } from './artisan'
import { PottersWheel, PrintStudioTable, VisitorsWall } from './printStudio'
import { ShopCounter, ShopShelf, ShopTable, StoleRail } from './shop'
import { Bookcase, DrawingWall, LoungeSet, PatternLectern, ReadingTable, ResourceBoard } from './library'
import { CreditsPanel } from './credits'
import { ClayShelf, ClayVessel, OculusPlinth, Podium, TerracottaHorse, VotivePlaque } from './clay'
import { BlockShelf, CarvingBench, DyeVat, FabricRolls, PigmentStation, PrintingTable, WashTank } from './workshop'
// spectacle kinds (WP0 stubs; each owned by the package named in models/propSchemas.ts)
import { ArchiveCabinet } from './archiveCabinet'
import { ListeningPost } from './listeningPost'
import { SoilArchive } from './soilArchive'
import { LanternCanopy } from './lanternCanopy'
import { ProgrammeBoard } from './programmeBoard'
import { CompassMandala } from './compassMandala'
import { TheatreHouse } from './theatreHouse'
import { LivingAlpana } from './livingAlpana'
import { ClayChimes } from './clayChimes'
import { VesselConstellation } from './vesselConstellation'
import { WaterRing } from './waterRing'
import { GhostPotter } from './ghostPotter'
import { KulhadHelix } from './kulhadHelix'
import { ToolMandala } from './toolMandala'
import { StrataWall } from './strataWall'
import { WaterRill } from './waterRill'
import { CourtFloorMandala } from '../architecture/CourtFloorMandala'
import { DuplexFrieze } from '../architecture/DuplexFrieze'
import { ClayBed } from './clayBed'
import { KilnWindow } from './kilnWindow'
import { GhatamSet } from './ghatamSet'
import { HorseProcession } from './horseProcession'
import { PitFiring } from './pitFiring'
import { StampPost } from './stampPost'
import { PhotoSpot } from './photoSpot'
import { PerchDoor } from './perchDoor'
import { SpectacleSingleton } from './spectacleSingleton'
import { AtmosphereKind, CoveLightKind, DiyaFieldKind, OculusLightKind } from '../lighting/atmosphere/kinds'
// grand kinds (P0 stubs; each owned by the package named in models/propSchemas.ts)
import { SourcedModel } from './sourcedModel'
import { AyyanarHorse } from './ayyanarHorse'
import { ReliefRegister } from './reliefRegister'
import { LippanWall } from './lippanWall'
import { CoilPot } from './coilPot'
import { KumartuliFigure } from './kumartuliFigure'
import { MajuliMask } from './majuliMask'
import { ErodedFormation } from './erodedFormation'
import { RoundTable } from './roundTable'
import { Lotus } from './lotus'
import { SpiralStair } from './spiralStair'
import { ClaySphere } from './claySphere'
import { WinePlinth } from './winePlinth'
import { CurvedShelf } from './curvedShelf'
import { RoundPlinth } from './roundPlinth'
import { CourtyardGarden } from './courtyardGarden'

export type { ModelProps } from './types'

export const PROCEDURAL_MODELS: Record<ProceduralModelId, ComponentType<ModelProps>> = {
  'printing-table': PrintingTable,
  'dye-vat': DyeVat,
  'drying-line': DryingLine,
  'block-shelf': BlockShelf,
  'pigment-station': PigmentStation,
  'wash-tank': WashTank,
  'fabric-rolls': FabricRolls,
  'carving-bench': CarvingBench,
  'textile-banner': TextileBanner,
  'plant-bed': PlantBed,
  tree: Tree,
  'water-channel': WaterChannel,
  'grand-desk': GrandDesk,
  planter: Planter,
  speaker: SpeakerPlaceholder,
  'theatre-seating': TheatreSeating,
  'garden-bench': GardenBench,
  column: Column,
  vessel: Vessel,
  stool: Stool,
  crate: Crate,
  centrepiece: Centrepiece,
  'map-wall': MapWall,
  vitrine: Vitrine,
  pedestal: Pedestal,
  'print-studio': PrintStudioTable,
  'visitors-wall': VisitorsWall,
  splat: ArtisanCapture,
  'shop-shelf': ShopShelf,
  'shop-table': ShopTable,
  'shop-counter': ShopCounter,
  'stole-rail': StoleRail,
  bookcase: Bookcase,
  'reading-table': ReadingTable,
  'lounge-set': LoungeSet,
  'pattern-lectern': PatternLectern,
  'drawing-wall': DrawingWall,
  'resource-board': ResourceBoard,
  'credits-panel': CreditsPanel,
  podium: Podium,
  'clay-vessel': ClayVessel,
  'terracotta-horse': TerracottaHorse,
  'votive-plaque': VotivePlaque,
  'oculus-plinth': OculusPlinth,
  'clay-shelf': ClayShelf,
  'potters-wheel': PottersWheel,
  'archive-cabinet': ArchiveCabinet,
  'listening-post': ListeningPost,
  'soil-archive': SoilArchive,
  'lantern-canopy': LanternCanopy,
  'programme-board': ProgrammeBoard,
  'compass-mandala': CompassMandala,
  'theatre-house': TheatreHouse,
  'living-alpana': LivingAlpana,
  'clay-chimes': ClayChimes,
  'vessel-constellation': VesselConstellation,
  'water-ring': WaterRing,
  'ghost-potter': GhostPotter,
  'kulhad-helix': KulhadHelix,
  'tool-mandala': ToolMandala,
  'strata-wall': StrataWall,
  'water-rill': WaterRill,
  'court-mandala': CourtFloorMandala,
  'duplex-frieze': DuplexFrieze,
  'clay-bed': ClayBed,
  'kiln-window': KilnWindow,
  'ghatam-set': GhatamSet,
  'horse-procession': HorseProcession,
  'pit-firing': PitFiring,
  'stamp-post': StampPost,
  'photo-spot': PhotoSpot,
  'perch-door': PerchDoor,
  spectacle: SpectacleSingleton,
  atmosphere: AtmosphereKind,
  'oculus-light': OculusLightKind,
  'cove-light': CoveLightKind,
  'diya-field': DiyaFieldKind,
  'sourced-model': SourcedModel,
  'ayyanar-horse': AyyanarHorse,
  'relief-register': ReliefRegister,
  'lippan-wall': LippanWall,
  'coil-pot': CoilPot,
  'kumartuli-figure': KumartuliFigure,
  'majuli-mask': MajuliMask,
  'eroded-formation': ErodedFormation,
  'round-table': RoundTable,
  'lotus': Lotus,
  'spiral-stair': SpiralStair,
  'clay-sphere': ClaySphere,
  'wine-plinth': WinePlinth,
  'curved-shelf': CurvedShelf,
  'round-plinth': RoundPlinth,
  'courtyard-garden': CourtyardGarden,
}
