/**
 * THE SKY RIM (GRAND §1.2, §6.5 "standing 20 m above the lotus"): the deck round the oculus at
 * the top of the dome, reached by the perch (the east stair, the roof, the dome's rib stair).
 *
 *   deck ......... timber from the oculus's lip out to the plinth's edge (domeGeometry's
 *                  DOME.plinthR), on the glazed plinth drum that stands on the tiles
 *   collar ....... glass, a clear upstand at the lip from the deck to the collar's top, so the
 *                  rim looks straight down the light-well into the rotunda; one slim brass rail
 *   balustrade ... glass with a brass rail at the deck's outer edge, over the tiles (behind the
 *                  visitor, who faces the opening)
 *
 * Nothing here collides: the visitor only reaches the roof on the perch's rail.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { SKY_RIM } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { useMaterials } from '../materials/materials'
import { DOME } from './domeGeometry'
import { Mesh, revolve, type V2 } from './sweep'

/** Deck: thickness, ring extent (the oculus's lip → the plinth's outer edge). */
export const RIM_DECK = { t: 0.04, r0: MUSEUM.oculus.r, r1: DOME.plinthR + 0.1 }
const GLASS_H = 1.05
const SEG = 160

function rimGeometry() {
  const deck = new Mesh()
  const kerb = new Mesh()
  const brass = new Mesh()
  const glass = new Mesh()
  const full = Math.PI * 2
  const y = SKY_RIM.y
  const up: V2 = [0, 1]
  revolve(deck, 0, 0, [[RIM_DECK.r0 + 0.08, y], [RIM_DECK.r1 - 0.12, y]], 0, full, SEG, [up, up])
  // the lip round the oculus and the kerb at the outer edge: glazed terracotta
  revolve(kerb, 0, 0, [[RIM_DECK.r0, y - 0.06], [RIM_DECK.r0, y + 0.05], [RIM_DECK.r0 + 0.08, y + 0.05], [RIM_DECK.r0 + 0.08, y]], 0, full, SEG)
  revolve(kerb, 0, 0, [[RIM_DECK.r1 - 0.12, y], [RIM_DECK.r1 - 0.12, y + 0.12], [RIM_DECK.r1, y + 0.12], [RIM_DECK.r1, y - 0.12]], 0, full, SEG)
  // glass: the collar at the lip (to the collar's top) and a balustrade at the deck's edge
  const pane = (r: number, y0: number, y1: number, railR = 0.026) => {
    revolve(glass, 0, 0, [[r, y0], [r, y1]], 0, full, SEG, [[1, 0], [1, 0]])
    const rail = new THREE.TorusGeometry(r, railR, 8, SEG)
    rail.rotateX(Math.PI / 2)
    rail.translate(0, y1 + railR, 0)
    for (const g of [rail]) {
      const ng = g.toNonIndexed()
      const p = ng.getAttribute('position')
      const n = ng.getAttribute('normal')
      const u = ng.getAttribute('uv')
      const b = brass.pos.length / 3
      for (let i = 0; i < p.count; i++) {
        brass.pos.push(p.getX(i), p.getY(i), p.getZ(i))
        brass.nor.push(n.getX(i), n.getY(i), n.getZ(i))
        brass.uv.push(u.getX(i), u.getY(i))
        brass.idx.push(b + i)
      }
      ng.dispose()
      g.dispose()
    }
  }
  // the collar's glass upstand with one slim rail: the view down the light-well stays open
  pane(RIM_DECK.r0 + 0.04, y + 0.05, MUSEUM.dome.collarTop, 0.014)
  pane(RIM_DECK.r1 - 0.06, y + 0.12, y + GLASS_H)
  return { deck: deck.build(), kerb: kerb.build(), brass: brass.build(), glass: glass.build() }
}

export function SkyRimRoof() {
  const m = useMaterials()
  const geo = useMemo(rimGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ name: 'skyRimGlass', color: '#dfeef0', transparent: true, opacity: 0.07, roughness: 0.02, metalness: 0, envMapIntensity: 0.45, depthWrite: false, side: THREE.DoubleSide }), [])
  useEffect(() => () => glass.dispose(), [glass])
  return (
    <group name="sky-rim">
      <StaticMerge name="sky-rim-shell">
        {geo.deck && <mesh geometry={geo.deck} material={m.timber} receiveShadow />}
        {geo.kerb && <mesh geometry={geo.kerb} material={m.glazedTerracotta} castShadow receiveShadow />}
        {geo.brass && <mesh geometry={geo.brass} material={m.brass} castShadow />}
      </StaticMerge>
      {geo.glass && <mesh geometry={geo.glass} material={glass} raycast={() => null} renderOrder={3} />}
    </group>
  )
}
