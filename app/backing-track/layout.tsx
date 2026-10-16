import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Backing Track & Chord Player',
  description: 'Build chord progressions and jam over drum and chord backing tracks in any key, with pop, rock, jazz, blues and reggae styles.',
  alternates: { canonical: '/backing-track' },
  openGraph: { title: 'Backing Track & Chord Player | FretWiki', description: 'Build chord progressions and jam over drum and chord backing tracks in any key, with pop, rock, jazz, blues and reggae styles.', url: '/backing-track' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
