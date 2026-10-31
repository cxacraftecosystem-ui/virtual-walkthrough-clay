import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '../src/styles.css'
import '../src/museum/a11y/a11y.css'
import { ServiceWorkerRegistration } from '../src/museum/pwa/ServiceWorkerRegistration'

const SHARE_TITLE = 'Clay Traditions — Virtual Pavilion'
const SHARE_DESCRIPTION =
  'Earth, water, hand and fire — walk through a virtual pavilion of three Indian clay traditions, in your browser.'
const SHARE_IMAGE = { url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'Clay Traditions — Virtual Pavilion' }

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Clay Traditions — Virtual Pavilion',
  description: 'Clay Traditions — a virtual walk through a pavilion of Bankura terracotta, Molela plaques and Longpi black pottery.',
  icons: { icon: '/favicon.svg', apple: '/brand/icon-512.png' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'Clay Traditions',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3e7dc',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
