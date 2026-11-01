/**
 * The grand plan's model stubs (GRAND §7): until a kind's owner builds its model, an object of
 * that kind shows a soft clay mass of its footprint and height, so a placement never shows a
 * hole and never floats. Each kind's own file re-exports one of these; its owner replaces it.
 *
 * Local space: origin at floor centre, front faces +z.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useModelMaterials, type ModelMaterialKey } from './modelMaterials'
import { fp, type ModelProps } from './types'

/** A rounded clay block of the object's footprint and height (default `size` [w, h, d]). */
export function StubMass({ config, size, material = 'terracotta', round = false }: ModelProps & { size: [number, number, number]; material?: ModelMaterialKey; round?: boolean }) {
  const m = useModelMaterials()
  const [w, d] = fp(config, [size[0], size[2]])
  const h = config.height ?? size[1]
  const geo = useMemo(() => {
    const g = round ? new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, h, 32) : new THREE.BoxGeometry(w, h, d)
    g.translate(0, h / 2, 0)
    return g
  }, [w, d, h, round])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={m[material]} castShadow receiveShadow />
}
