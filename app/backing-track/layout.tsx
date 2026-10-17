import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Backing Track',
  description: 'Describe a groove and generate a practice loop, or switch to Classic to build chord progressions with drums in any key.',
  alternates: { canonical: '/backing-track' },
  openGraph: { title: 'Backing Track | FretWiki', description: 'Describe a groove and generate a practice loop, or switch to Classic to build chord progressions with drums in any key.', url: '/backing-track' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
