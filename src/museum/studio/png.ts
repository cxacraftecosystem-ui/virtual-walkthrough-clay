/** PNG encoding for the studio's downloads and Visitors' Shelf submissions. */

function toBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/png'))
}

/** PNG of `src` scaled to `width` px wide. */
export async function pngAt(src: HTMLCanvasElement, width: number): Promise<Blob> {
  if (width >= src.width) return toBlob(src)
  const h = Math.round((src.height * width) / src.width)
  const cv = document.createElement('canvas')
  cv.width = width
  cv.height = h
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, width, h)
  return toBlob(cv)
}

/** The largest PNG (≤ 1024 px wide) that fits `maxBytes`. */
export async function pngWithin(src: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  for (const w of [1024, 880, 760, 640, 520, 420]) {
    const b = await pngAt(src, w)
    if (b.size <= maxBytes) return b
  }
  throw new Error('The picture could not be made small enough to send')
}
