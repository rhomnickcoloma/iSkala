import type { Metadata } from 'next'
import AppShell from '../components/AppShell'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function NixxPage() {
  return <AppShell />
}
