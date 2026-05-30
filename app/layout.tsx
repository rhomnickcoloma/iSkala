import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const SITE_URL = 'https://fretwiki.com'
const SITE_NAME = 'FretWiki'
const DESCRIPTION = 'Free interactive fretboard tool for guitar, bass, and ukulele. Explore 22+ scales in any key with visual patterns, backing tracks, metronome, tuner, and practice tools.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FretWiki — Interactive Guitar, Bass & Ukulele Scale Reference',
    template: '%s | FretWiki',
  },
  description: DESCRIPTION,
  keywords: [
    'guitar scales',
    'bass scales',
    'ukulele scales',
    'fretboard',
    'interactive fretboard',
    'scale reference',
    'guitar scale chart',
    'pentatonic scale',
    'major scale guitar',
    'minor scale guitar',
    'blues scale',
    'guitar modes',
    'CAGED system',
    '3 notes per string',
    'scale patterns',
    'guitar practice tool',
    'bass fretboard',
    'music theory',
    'guitar tuner',
    'backing tracks',
    'metronome',
    'learn guitar scales',
    'free guitar tools',
    'scale finder',
    'fret positions',
  ],
  authors: [{ name: 'NIXX Music' }],
  creator: 'NIXX Music',
  publisher: 'NIXX Music',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'FretWiki — Interactive Guitar, Bass & Ukulele Scale Reference',
    description: DESCRIPTION,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FretWiki — Interactive Scale Reference for Guitar, Bass & Ukulele',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FretWiki — Interactive Guitar, Bass & Ukulele Scale Reference',
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  manifest: '/manifest.json',
  category: 'music',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#14141c',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'NIXX Music',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
