import type { Metadata } from 'next'
import { MuseumClient } from '../MuseumClient'

export const metadata: Metadata = {
  title: 'Virtual Pavilion — Clay Traditions',
}

/** The 3D pavilion (default exhibition). A fully client-side WebGL experience; this page is its host. */
export default function GalleryPage() {
  return <MuseumClient />
}
