'use client'

import { useInstrument } from '../context/InstrumentContext'

export default function Header() {
  const { instrument, setShowSelector } = useInstrument()

  return (
    <header>
      <div className="header-content">
        <div className="brand">
          <img src="/logo.png" alt="FretWiki Logo" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">FretWiki</span>
            <span className="brand-sub">By NIXX Music</span>
          </div>
        </div>
        <div className="header-title">
          <h1>{instrument.icon} {instrument.name} Scale Reference</h1>
          <p className="subtitle">Interactive fretboard to learn scales in any key</p>
        </div>
        <button
          className="instrument-switch-btn"
          onClick={() => setShowSelector(true)}
          title="Change instrument"
        >
          {instrument.icon}
          <span className="instrument-switch-label">{instrument.name}</span>
        </button>
      </div>
    </header>
  )
}
