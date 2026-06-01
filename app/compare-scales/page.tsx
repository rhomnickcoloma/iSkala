'use client'

import { useRouter } from 'next/navigation'
import { InstrumentProvider } from '../context/InstrumentContext'
import ComparisonView from '../components/ComparisonView'

export default function CompareScalesPage() {
  const router = useRouter()

  return (
    <InstrumentProvider>
      <ComparisonView onClose={() => router.push('/')} />
    </InstrumentProvider>
  )
}
