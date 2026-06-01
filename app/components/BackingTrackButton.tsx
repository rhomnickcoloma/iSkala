'use client'

import { useRouter } from 'next/navigation'

export default function BackingTrackButton() {
  const router = useRouter()

  return (
    <button className="backing-track-toggle" onClick={() => router.push('/backing-track')}>
      <span className="toggle-icon">🎵</span>
      <span>Backing Track</span>
    </button>
  )
}
