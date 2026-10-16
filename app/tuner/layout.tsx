import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Online Tuner',
  description: 'Free chromatic tuner for guitar, bass and ukulele. Uses your microphone for real-time pitch detection with a cents meter.',
  alternates: { canonical: '/tuner' },
  openGraph: { title: 'Online Tuner | FretWiki', description: 'Free chromatic tuner for guitar, bass and ukulele. Uses your microphone for real-time pitch detection with a cents meter.', url: '/tuner' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
