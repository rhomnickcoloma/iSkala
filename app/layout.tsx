import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FretWiki | Guitar Scale Reference',
  description: 'Learn guitar scales in any key with interactive fretboard, metronome, backing tracks, and practice tips.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FretWiki',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
