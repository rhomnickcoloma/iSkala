import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compare Scales',
  description: 'Compare two scales side by side on an interactive fretboard. See shared notes, differences and overlaps for guitar, bass and ukulele.',
  alternates: { canonical: '/compare-scales' },
  openGraph: { title: 'Compare Scales | FretWiki', description: 'Compare two scales side by side on an interactive fretboard. See shared notes, differences and overlaps for guitar, bass and ukulele.', url: '/compare-scales' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
