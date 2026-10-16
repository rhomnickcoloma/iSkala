'use client'

import { useRouter } from 'next/navigation'
import { Icon } from './Icons'

export default function EffectsButton() {
  const router = useRouter()

  return (
    <button className="effects-float-btn" onClick={() => router.push('/effects')}>
      <Icon name="sliders-horizontal" size="1em" className="toggle-icon" />
      <span>Effects</span>
    </button>
  )
}
