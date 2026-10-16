import type { Metadata } from 'next'
import { InstrumentProvider } from '../context/InstrumentContext'
import AppShell from '../components/AppShell'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// skipRouting keeps returning visitors on /nixx instead of redirecting to their saved instrument route
export default function NixxPage() {
  return (
    <InstrumentProvider skipRouting>
      <AppShell />
    </InstrumentProvider>
  )
}
