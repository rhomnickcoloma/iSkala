'use client'

import { useRouter } from 'next/navigation'
import BackingTrackPage from '../components/BackingTrackPage'

export default function BackingTrackRoute() {
  const router = useRouter()

  return <BackingTrackPage onClose={() => router.back()} />
}
