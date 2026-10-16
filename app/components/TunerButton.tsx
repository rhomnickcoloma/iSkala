'use client'

import { useRouter } from 'next/navigation'
import { Icon } from './Icons'

export default function TunerButton() {
  const router = useRouter()

  return (
    <button className="tuner-float-btn" onClick={() => router.push('/tuner')}>
      <Icon name="tuning-fork" className="tuner-float-icon" />
      <span>Tuner</span>
    </button>
  )
}
