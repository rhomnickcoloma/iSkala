'use client'

import { NOTES } from '../lib/scales'

interface KeySelectorProps {
  selectedKey: string
  onKeyChange: (key: string) => void
}

export default function KeySelector({ selectedKey, onKeyChange }: KeySelectorProps) {
  return (
    <div className="key-row">
      <label>Key</label>
      <div className="key-buttons">
        {NOTES.map(note => (
          <button
            key={note}
            className={`key-btn ${selectedKey === note ? 'active' : ''}`}
            onClick={() => onKeyChange(note)}
          >
            {note}
          </button>
        ))}
      </div>
    </div>
  )
}
