import type { Metadata } from 'next'
import FretPilotApp from '../components/fretpilot/FretPilotApp'

export const metadata: Metadata = {
  title: 'FretPilot AI — Guitar Coach That Listens',
  description:
    'Play a phrase, see it on the fretboard, and get a guitar coach that explains chord tones, modes, and a next exercise. Microphone audio stays in the browser.',
  alternates: { canonical: '/fretpilot' },
  openGraph: {
    title: 'FretPilot AI | FretWiki',
    description: 'An in-browser guitar coach: listen, analyze, teach, try again.',
    url: '/fretpilot',
  },
}

export default function FretPilotPage() {
  return <FretPilotApp />
}
