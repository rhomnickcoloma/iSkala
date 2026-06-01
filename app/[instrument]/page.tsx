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
