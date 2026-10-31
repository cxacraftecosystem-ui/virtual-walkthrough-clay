/**
 * Clay bench: a low, solid block of burnished terracotta on a recessed oxblood plinth — the
 * pavilion's seating reads as part of its walls (PDF: modern minimalism in clay).
 */
import { useEffect, useMemo } from 'react'
import { BENCH_SIZE, BENCHES, type BenchPlacement } from '../config/layout'
import { createMeterBoxGeometry } from '../materials/geometry'
import { useMaterials } from '../materials/materials'

const { length: L, depth: D, height: H } = BENCH_SIZE
const BASE_H = 0.07
const INSET = 0.05

export function Bench({ bench }: { bench: BenchPlacement }) {
  const m = useMaterials()
  const geo = useMemo(
    () => ({
      seat: createMeterBoxGeometry(L, H - BASE_H, D, { grainAxis: 'x' }),
      base: createMeterBoxGeometry(L - INSET * 2, BASE_H, D - INSET * 2),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return (
    <group position={[bench.x, 0, bench.z]} rotation={[0, bench.along === 'z' ? Math.PI / 2 : 0, 0]}>
      <mesh geometry={geo.seat} material={m.clayTerracotta} position={[0, BASE_H + (H - BASE_H) / 2, 0]} castShadow receiveShadow />
      <mesh geometry={geo.base} material={m.oxblood} position={[0, BASE_H / 2, 0]} receiveShadow />
    </group>
  )
}

export function Benches() {
  return (
    <>
      {BENCHES.map((b) => (
        <Bench key={b.id} bench={b} />
      ))}
    </>
  )
}
