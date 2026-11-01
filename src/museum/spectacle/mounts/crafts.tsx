/**
 * In-scene mount: the grand plan's crafts (GRAND §4–§5): what the crafts package draws outside
 * its scene objects (config/grandObjects/crafts.ts). Owned by P2. Mounted by
 * spectacle/Spectacle.tsx inside its own error boundary.
 *
 *  - SourcedStreamer: loads the sourced models zone by zone as the visitor moves (§5.2);
 *  - SourcedBatches: three or more plain placements of one sourced model drawn instanced;
 *  - FinishWarmup: one hidden speck per clay finish and tier, so effects/Precompile.tsx builds
 *    their programs before Enter and none compiles mid-visit;
 *  - PlinthLabels: the Wine Hall rails' cards, with the CC BY scans' attribution (§5.3).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { PlinthLabels } from '../../exhibits/WallGraphics'
import { FINISH_IDS, sourcedFinishMaterial } from '../../materials/sourcedFinish'
import { SourcedBatches, SourcedStreamer } from '../../models/sourcedModel'
import { useMuseum } from '../../state/store'

const speck = new THREE.BoxGeometry(0.001, 0.001, 0.001)

function FinishWarmup() {
  const tier = useMuseum((s) => s.tier)
  const mats = useMemo(() => FINISH_IDS.map((f) => sourcedFinishMaterial(f, tier)!), [tier])
  // far below the plinth: drawn (so compiled), never seen
  return (
    <group position={[0, -60, 0]} name="sourced-finish-warmup">
      {mats.map((m, i) => (
        <mesh key={i} geometry={speck} material={m} position={[i * 0.01, 0, 0]} />
      ))}
    </group>
  )
}

export function CraftsMount() {
  return (
    <group name="grand-crafts">
      <SourcedStreamer />
      <SourcedBatches />
      <FinishWarmup />
      <PlinthLabels />
    </group>
  )
}
