'use client'

import { useEffect } from 'react'
import { INSTRUMENTS } from '../lib/instruments'
import { useInstrument } from '../context/InstrumentContext'

export default function InstrumentSelector() {
  const { instrument, setInstrumentId, showSelector, setShowSelector } = useInstrument()

  useEffect(() => {
    if (!showSelector) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSelector(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSelector, setShowSelector])

  if (!showSelector) return null

  const groups = [
    { label: 'Guitar', ids: ['guitar'] },
    { label: 'Bass', ids: ['bass-4', 'bass-5', 'bass-6'] },
    { label: 'Ukulele', ids: ['ukulele'] },
  ]

  return (
    <div className="instrument-overlay" onClick={() => setShowSelector(false)}>
      <div className="instrument-modal" onClick={e => e.stopPropagation()}>
        <div className="instrument-modal-header">
          <h2>Choose Your Instrument</h2>
          <button className="instrument-close-btn" onClick={() => setShowSelector(false)}>✕</button>
          <p>Select what you play to get the right fretboard layout</p>
        </div>

        <div className="instrument-groups">
          {groups.map(group => (
            <div key={group.label} className="instrument-group">
              <h3 className="instrument-group-label">{group.label}</h3>
              <div className="instrument-cards">
                {group.ids.map(id => {
                  const inst = INSTRUMENTS[id]
                  const isSelected = instrument.id === id
                  return (
                    <button
                      key={id}
                      className={`instrument-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setInstrumentId(id)}
                    >
                      <span className="instrument-card-icon">{inst.icon}</span>
                      <span className="instrument-card-name">{inst.name}</span>
                      <span className="instrument-card-tuning">
                        {inst.tuning.join(' ')}
                      </span>
                      <span className="instrument-card-strings">
                        {inst.stringCount} strings
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
