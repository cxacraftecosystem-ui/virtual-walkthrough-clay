/**
 * Grand scene objects: the grand plan's experience objects (GRAND §8 P5). Spread into
 * SCENE_OBJECTS (config/objects.ts). Owned by P5.
 *
 *  • `perch-door` ×2  where the rides start (navigation/perch.ts PERCH_DOORS): the brass portal at
 *                     the east stair's foot in the east ambulatory (up to the balcony, then on up
 *                     to the Sky Rim), and the gate in the Sphere Well's rim (down the spiral).
 *
 * The stamp posts and the Frames of Clay spots are in spectacleObjects/experience.ts. Positions
 * are expressions of the named constants (tests/unit/grand-literals.test.ts).
 */
import type { SceneObjectConfig } from '../objects'
import { PERCH_DOORS } from '../../navigation/perch'

const STAIR = PERCH_DOORS['east-stair']
const WELL = PERCH_DOORS['sphere-well']

const PERCH_DOOR_OBJECTS: SceneObjectConfig[] = [
  {
    id: 'perch-east-stair',
    title: 'The east stair',
    i18n: { hi: { title: 'पूर्वी सीढ़ी' }, bn: { title: 'পূর্বের সিঁড়ি' } },
    kind: 'perch-door',
    position: [STAIR.face[0], 0, STAIR.face[1]],
    rotationDeg: STAIR.rotationDeg,
    zone: 'entry-e',
    props: { perch: 'duplex', label: '' },
    alt: 'A slender brass portal at the foot of a stair that climbs the curved wall, with a small plaque on its lintel and a lantern beside it.',
  },
  {
    id: 'perch-sphere-well',
    title: 'The Sphere Well',
    i18n: { hi: { title: 'गोले का कुआँ' }, bn: { title: 'গোলকের কূপ' } },
    kind: 'perch-door',
    position: [WELL.face[0], 0, WELL.face[1]],
    rotationDeg: WELL.rotationDeg,
    zone: 'entrance-court',
    props: { perch: 'sphere-well', label: '' },
    alt: 'A gate between two brass posts in the balustrade round a round opening in the ground, with a small plaque.',
  },
]

export const GRAND_EXPERIENCE_OBJECTS: SceneObjectConfig[] = [...PERCH_DOOR_OBJECTS]
