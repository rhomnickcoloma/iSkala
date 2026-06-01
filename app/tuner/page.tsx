'use client'

import { useRouter } from 'next/navigation'
import { InstrumentProvider } from '../context/InstrumentContext'
import Tuner from '../components/Tuner'

export default function TunerPage() {
  const router = useRouter()

  return (
    <InstrumentProvider skipRouting>
      <Tuner onClose={() => router.back()} />
    </InstrumentProvider>
  )
}
