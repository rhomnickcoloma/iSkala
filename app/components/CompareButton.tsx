'use client'

import { useRouter } from 'next/navigation'

export default function CompareButton() {
  const router = useRouter()

  return (
    <button className="compare-float-btn" onClick={() => router.push('/compare-scales')}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="compare-float-icon">
        <rect x="11" y="3" width="2" height="18" rx="1"/>
        <rect x="6" y="20" width="12" height="2" rx="1"/>
        <rect x="4" y="5" width="16" height="2" rx="1"/>
        <path d="M4 7l-2 7h8L8 7H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M16 7l-2 7h8l-2-7h-4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M0 14a4 4 0 0 0 8 0H0zM14 14a4 4 0 0 0 8 0h-8z"/>
      </svg>
      <span>Compare Scales</span>
    </button>
  )
}
