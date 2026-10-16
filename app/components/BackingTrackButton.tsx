'use client'

import { useRouter } from 'next/navigation'
import { Icon } from './Icons'

export default function BackingTrackButton() {
  const router = useRouter()

  return (
    <button className="backing-track-toggle" onClick={() => router.push('/backing-track')}>
      <Icon name="music" size="1em" className="toggle-icon" />
      <span className="label-long">Backing Track</span><span className="label-short">Backing</span>
    </button>
  )
}
