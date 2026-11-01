/**
 * Scene objects of light, sky and atmosphere settings and the festival lamps (F5, F8, F9, F15, F27, F28).
 * Spread into SCENE_OBJECTS (config/objects.ts). They draw nothing themselves: each carries the
 * curator's settings for a global light moment (props: models/propSchemas.ts), so the admin can
 * tune the time, the weather, the shaft, the lamps and the coves without code. Positions only
 * place them on the plan for the admin's lists.
 */
import type { SceneObjectConfig } from '../objects'
import { MUSEUM } from '../museum'
import { at } from './place'

/** On the plan: in the court, between the curb and F (they draw nothing). */
const COURT_R = (MUSEUM.oculus.rings[0] + MUSEUM.innerMainWall.r) / 2

export const ATMOS_OBJECTS: SceneObjectConfig[] = [
  {
    id: 'atmosphere',
    title: 'Atmosphere: time, weather and the festival of lamps',
    kind: 'atmosphere',
    position: at(COURT_R, 75),
    zone: 'inner',
    props: {
      defaultTime: 'live',
      allowScrub: true,
      weather: 'menu',
      monsoonSec: 90,
      monsoonChance: 0.15,
      petrichorCaption: false,
      gradeStrength: 1,
      reveal: true,
      festival: 'auto',
      festivalFrom: '11-01',
      festivalTo: '11-15',
    },
  },
  {
    id: 'oculus-light',
    title: 'Oculus light: sun shaft and motes',
    kind: 'oculus-light',
    position: at(COURT_R, 105),
    zone: 'inner',
    // the jali gobo is retired with the soffit crown (GRAND §0.4): a clean disc of sun
    props: { shaft: true, shaftStrength: 1, motes: true, gobo: 'none' },
  },
  {
    id: 'diya-field',
    title: 'Diya Night: the festival of lamps',
    kind: 'diya-field',
    position: at(COURT_R, 135),
    zone: 'inner',
    props: { sets: 'pool,curb,podiums,hallway,parikrama,well,annex,path,forecourt,edge', colorK: 1900, flicker: 0.6, ignite: 'spiral', beacon: true, akashDeep: true },
  },
]
