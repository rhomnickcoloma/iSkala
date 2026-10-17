import type { Metadata } from 'next'
import FretWikiAIApp from '../components/ai/FretWikiAIApp'

export const metadata: Metadata = {
  title: 'FretWiki AI — Guitar Coach That Listens',
  description:
    'Play a phrase, see it on the fretboard, and get a guitar coach that explains chord tones, modes, and a next exercise. Microphone audio stays in the browser.',
  alternates: { canonical: '/ai' },
  openGraph: {
    title: 'FretWiki AI — Guitar Coach That Listens',
    description: 'An in-browser guitar coach: listen, analyze, teach, try again.',
    url: '/ai',
  },
}

export default function FretWikiAIPage() {
  return <FretWikiAIApp />
}
