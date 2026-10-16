'use client'

import { useInstrument } from '../context/InstrumentContext'
import { Icon } from './Icons'
import AccountButton from './AccountButton'

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
          <h1><Icon name={instrument.icon} size="0.9em" className="inline-icon" />{instrument.name} Scale Reference</h1>
          <p className="subtitle">Interactive fretboard to learn scales in any key</p>
        </div>
        <div className="header-actions">
          <AccountButton />
          <button
            className="instrument-switch-btn"
            onClick={() => setShowSelector(true)}
            title="Change instrument"
          >
            <Icon name={instrument.icon} size={18} />
            <span className="instrument-switch-label">{instrument.name}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
