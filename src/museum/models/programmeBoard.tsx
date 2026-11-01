/**
 * 'programme-board' — the Agni Theatre's programme (F24): a slate on a timber easel in the
 * lobby, chalked by hand. It lists `props.films` (one title per line) once real films are
 * configured; until then it names only what the screen shows now, the Kiln Film ("Earth ·
 * Water · Hand · Fire", i18n `spectacle.kilnFilm`) — never a film that does not exist yet.
 *
 * Local space: origin at floor centre between the easel's feet, the slate faces +z.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useLang, translate } from '../i18n'
import { ensureWallFonts } from '../materials/wallGraphics'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { box, Builder, Parts, rbox, useBuilt } from './kit'
import { useModelMaterials } from './modelMaterials'
import { geoKey, str, type ModelProps } from './types'

const SLATE = { w: 0.56, h: 0.78, y: 1.22, tilt: 0.12 }
const CHALK = 'rgba(246,238,226,0.92)'
const CHALK_DIM = 'rgba(246,238,226,0.62)'
const OCHRE_CHALK = 'rgba(232,170,104,0.95)'

async function slateTexture(kicker: string, title: string, lines: string[], lang: string): Promise<THREE.Texture> {
  await ensureWallFonts()
  const s = 900
  const cv = document.createElement('canvas')
  cv.width = Math.round(SLATE.w * s)
  cv.height = Math.round(SLATE.h * s)
  const ctx = cv.getContext('2d')!
  const W = cv.width
  const H = cv.height
  // slate: near-black, chalk dust smeared in arcs (an old board, wiped many times)
  ctx.fillStyle = '#1f2321'
  ctx.fillRect(0, 0, W, H)
  let seed = 41
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(230,230,220,${0.015 + rnd() * 0.03})`
    ctx.lineWidth = 20 + rnd() * 60
    ctx.beginPath()
    ctx.arc(rnd() * W, rnd() * H, 60 + rnd() * 240, rnd() * 6, rnd() * 6 + 1.5)
    ctx.stroke()
  }
  const serif = lang === 'en' ? '"Cormorant Garamond", Georgia, serif' : '"Noto Serif Devanagari", "Noto Serif Bengali", Georgia, serif'
  const sans = 'Inter, "Noto Sans Devanagari", "Noto Sans Bengali", Arial, sans-serif'
  const wrap = (text: string, maxW: number) => {
    const out: string[] = []
    let cur = ''
    for (const w of text.split(' ')) {
      const t = cur ? `${cur} ${w}` : w
      if (ctx.measureText(t).width > maxW && cur) {
        out.push(cur)
        cur = w
      } else cur = t
    }
    if (cur) out.push(cur)
    return out
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = OCHRE_CHALK
  ctx.font = `600 ${Math.round(H * 0.036)}px ${sans}`
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${Math.round(H * 0.008)}px`
  ctx.fillText(lang === 'en' ? kicker.toUpperCase() : kicker, W / 2, H * 0.13)
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'
  // a chalk flame under the kicker
  ctx.strokeStyle = OCHRE_CHALK
  ctx.lineWidth = H * 0.005
  ctx.beginPath()
  const fx = W / 2
  const fy = H * 0.22
  ctx.moveTo(fx, fy + H * 0.035)
  ctx.bezierCurveTo(fx - H * 0.04, fy + H * 0.01, fx - H * 0.01, fy - H * 0.02, fx, fy - H * 0.045)
  ctx.bezierCurveTo(fx + H * 0.01, fy - H * 0.02, fx + H * 0.04, fy + H * 0.01, fx, fy + H * 0.035)
  ctx.stroke()
  // the title, large, then a rule and the programme
  ctx.fillStyle = CHALK
  ctx.font = `500 ${Math.round(H * 0.078)}px ${serif}`
  let y = H * 0.38
  for (const l of wrap(title, W * 0.84)) {
    ctx.fillText(l, W / 2, y)
    y += H * 0.088
  }
  if (lines.length) {
    ctx.beginPath()
    ctx.moveTo(W * 0.2, y - H * 0.02)
    ctx.lineTo(W * 0.8, y - H * 0.02)
    ctx.lineWidth = H * 0.003
    ctx.strokeStyle = CHALK_DIM
    ctx.stroke()
    y += H * 0.06
    ctx.font = `400 ${Math.round(H * 0.05)}px ${serif}`
    for (const line of lines.slice(0, 6)) {
      for (const l of wrap(line, W * 0.82)) {
        ctx.fillText(l, W / 2, y)
        y += H * 0.062
      }
      y += H * 0.025
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function ProgrammeBoard({ config }: ModelProps) {
  const m = useModelMaterials()
  const lang = useLang()
  const title = str(config, 'title', 'Agni Theatre')
  const filmsRaw = config.placeholder ? '' : str(config, 'films', '')
  const films = useMemo(
    () =>
      filmsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [filmsRaw],
  )
  // until real films are listed, the slate names only what the screen shows now
  const kicker = translate(lang, 'zone.theatre')
  const heading = films.length ? title : translate(lang, 'spectacle.kilnFilm')
  const tex = useAsyncTexture(() => slateTexture(kicker, heading, films, lang), [kicker, heading, films.join('|'), lang])

  const parts = useBuilt(geoKey('programme-board', config), () => {
    const b = new Builder()
    const legH = 1.72
    // an A-frame easel: two front legs splayed, a back leg, a ledge for the slate
    for (const sx of [-1, 1]) b.add('teak', rbox(0.04, legH, 0.035, 0.006, 2, 'y'), { p: [sx * 0.24, legH / 2, 0.04], r: [-SLATE.tilt, 0, sx * 0.05] })
    b.add('teak', rbox(0.035, legH * 0.98, 0.035, 0.006, 2, 'y'), { p: [0, legH * 0.47, -0.2], r: [0.28, 0, 0] })
    b.add('teak', rbox(0.6, 0.035, 0.08, 0.006, 2, 'x'), { p: [0, SLATE.y - SLATE.h / 2 - 0.02, 0.1], r: [-SLATE.tilt, 0, 0] })
    b.add('teak', box(0.46, 0.025, 0.025, 'x'), { p: [0, legH - 0.12, 0.0], r: [-SLATE.tilt, 0, 0] })
    // the slate's timber frame
    const f = 0.03
    const z = 0.07
    const R: [number, number, number] = [-SLATE.tilt, 0, 0]
    b.add('teak', rbox(SLATE.w + 2 * f, f, 0.03, 0.004, 2, 'x'), { p: [0, SLATE.y + SLATE.h / 2 + f / 2, z], r: R })
    b.add('teak', rbox(SLATE.w + 2 * f, f, 0.03, 0.004, 2, 'x'), { p: [0, SLATE.y - SLATE.h / 2 - f / 2, z], r: R })
    for (const sx of [-1, 1]) b.add('teak', rbox(f, SLATE.h, 0.03, 0.004, 2, 'y'), { p: [sx * (SLATE.w / 2 + f / 2), SLATE.y, z], r: R })
    b.add('slate', box(SLATE.w, SLATE.h, 0.012), { p: [0, SLATE.y, z - 0.004], r: R })
    // a stub of ochre chalk on the ledge
    b.add('chalk', box(0.05, 0.012, 0.012), { p: [0.12, SLATE.y - SLATE.h / 2 + 0.002, 0.13], r: R })
    return b
  })
  const slateMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#202422', roughness: 0.9 }), [])
  const chalkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7ab6b', roughness: 1 }), [])
  return (
    <group>
      <Parts parts={parts} materials={{ teak: m.teak, slate: slateMat, chalk: chalkMat }} />
      {tex && (
        // on the slate's face (the slate is 12 mm thick, tilted back about its centre)
        <mesh position={[0, SLATE.y + Math.sin(SLATE.tilt) * 0.0065, 0.066 + Math.cos(SLATE.tilt) * 0.0065]} rotation={[-SLATE.tilt, 0, 0]} raycast={() => null}>
          <planeGeometry args={[SLATE.w, SLATE.h]} />
          <meshStandardMaterial map={tex} roughness={0.92} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      )}
    </group>
  )
}
