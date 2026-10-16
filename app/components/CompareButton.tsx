'use client'

import { useRouter } from 'next/navigation'
import { Icon } from './Icons'

export default function CompareButton() {
  const router = useRouter()

  return (
    <button className="compare-float-btn" onClick={() => router.push('/compare-scales')}>
      <Icon name="scale" className="compare-float-icon" />
      <span className="label-long">Compare Scales</span><span className="label-short">Compare</span>
    </button>
  )
}
