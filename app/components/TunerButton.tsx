'use client'

import { useRouter } from 'next/navigation'

export default function TunerButton() {
  const router = useRouter()

  return (
    <button className="tuner-float-btn" onClick={() => router.push('/tuner')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tuner-float-icon">
        <path d="M7 2l5 8M17 2l-5 8M12 10v12"/>
      </svg>
      <span>Tuner</span>
    </button>
  )
}
