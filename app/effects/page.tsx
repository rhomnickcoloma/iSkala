'use client'

import { useRouter } from 'next/navigation'
import EffectsPage from '../components/EffectsPage'

export default function EffectsRoute() {
  const router = useRouter()

  return <EffectsPage onClose={() => router.back()} />
}
