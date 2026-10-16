import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guitar Effects & Amp Simulator',
  description: 'Free in-browser guitar effects: amps, cabinets, distortion, delay, reverb, chorus, EQ and Neural Amp Modeler (.nam) support. Plug in and play.',
  alternates: { canonical: '/effects' },
  openGraph: { title: 'Guitar Effects & Amp Simulator | FretWiki', description: 'Free in-browser guitar effects: amps, cabinets, distortion, delay, reverb, chorus, EQ and Neural Amp Modeler (.nam) support. Plug in and play.', url: '/effects' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
