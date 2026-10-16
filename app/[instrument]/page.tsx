import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { INSTRUMENTS } from '../lib/instruments'
import { InstrumentProvider } from '../context/InstrumentContext'
import AppShell from '../components/AppShell'

interface Props {
  params: Promise<{ instrument: string }>
}

export function generateStaticParams() {
  return Object.keys(INSTRUMENTS).map((id) => ({ instrument: id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { instrument } = await params
  const config = INSTRUMENTS[instrument]
  if (!config) return {}
  const title = `${config.name} Scales — Interactive Fretboard`
  const description = `Learn ${config.name.toLowerCase()} scales in any key on an interactive fretboard. ${config.supportsPatterns ? '3NPS, CAGED and diagonal patterns, ' : ''}intervals, metronome, backing tracks and PNG export. Free.`
  return {
    title,
    description,
    alternates: { canonical: `/${instrument}` },
    openGraph: { title: `${title} | FretWiki`, description, url: `/${instrument}` },
  }
}

export default async function InstrumentPage({ params }: Props) {
  const { instrument } = await params

  if (!INSTRUMENTS[instrument]) {
    notFound()
  }

  return (
    <InstrumentProvider initialInstrument={instrument}>
      <AppShell />
    </InstrumentProvider>
  )
}
