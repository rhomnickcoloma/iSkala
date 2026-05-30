'use client'

import { useState } from 'react'
import Tuner from './Tuner'

export default function TunerButton() {
  const [showTuner, setShowTuner] = useState(false)

  return (
    <>
      <button className="tuner-float-btn" onClick={() => setShowTuner(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tuner-float-icon">
          <path d="M7 2l5 8M17 2l-5 8M12 10v12"/>
        </svg>
        <span>Tuner</span>
      </button>
      {showTuner && <Tuner onClose={() => setShowTuner(false)} />}
    </>
  )
}
