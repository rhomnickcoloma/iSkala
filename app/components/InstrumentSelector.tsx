'use client'

import { useEffect } from 'react'
import { INSTRUMENTS } from '../lib/instruments'
import { useInstrument } from '../context/InstrumentContext'

const INSTRUMENT_IMAGES: Record<string, string> = {
  'guitar': 'https://plus.unsplash.com/premium_photo-1693169973609-342539dea9dc?w=400&h=600&fit=crop&crop=center',
  'bass-4': 'https://images.unsplash.com/photo-1664587534303-67fda298c180?w=400&h=600&fit=crop&crop=center',
  'bass-5': 'https://images.unsplash.com/photo-1595340515387-61155fd65420?w=400&h=600&fit=crop&crop=center',
  'bass-6': 'https://images.unsplash.com/photo-1593550573849-1d608bb469ca?w=400&h=600&fit=crop&crop=center',
  'ukulele': 'https://images.unsplash.com/photo-1716560314940-329a461c83fb?w=400&h=600&fit=crop&crop=center',
}

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

  const instruments = [
    { id: 'guitar', label: 'Guitar' },
    { id: 'bass-4', label: 'Bass 4' },
    { id: 'bass-5', label: 'Bass 5' },
    { id: 'bass-6', label: 'Bass 6' },
    { id: 'ukulele', label: 'Ukulele' },
  ]

  return (
    <div className="instrument-overlay" onClick={() => setShowSelector(false)}>
      <div className="instrument-modal" onClick={e => e.stopPropagation()}>
        <div className="instrument-modal-header">
          <h2>Choose Your Instrument</h2>
          <button className="instrument-close-btn" onClick={() => setShowSelector(false)}>✕</button>
          <p>Select what you play to get the right fretboard layout</p>
        </div>

        <div className="instrument-columns">
          {instruments.map(({ id, label }) => {
            const inst = INSTRUMENTS[id]
            const isSelected = instrument.id === id
            return (
              <button
                key={id}
                className={`instrument-col-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setInstrumentId(id)}
              >
                <div
                  className="instrument-col-image"
                  style={{ backgroundImage: `url(${INSTRUMENT_IMAGES[id]})` }}
                />
                <div className="instrument-col-info">
                  <span className="instrument-col-name">{inst.name}</span>
                  <span className="instrument-col-tuning">{inst.tuning.join(' ')}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
