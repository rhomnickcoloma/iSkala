'use client'

import { useLiveSnapshot, type LiveNoteEngine } from '../lib/useLiveNote'
import { getNoteAtFret } from '../lib/scales'
import { Icon } from './Icons'

export function ListenButton({ live }: { live: LiveNoteEngine }) {
  const { note } = useLiveSnapshot(live)
  return (
    <>
      <button
        className={`display-btn listen-btn ${live.listening ? 'active' : ''}`}
        onClick={() => (live.listening ? live.stop() : void live.start())}
        aria-pressed={live.listening}
        aria-label={live.listening ? `Stop listening${note ? ` (hearing ${note.name})` : ''}` : 'Listen'}
        title={live.listening ? 'Stop listening' : 'Highlight the notes you play (uses your microphone)'}
      >
        {live.listening ? <span className="listen-dot" aria-hidden="true" /> : <Icon name="mic" size="1em" className="listen-icon" />}
        {live.listening
          ? (note?.name ?? <span className="listen-label">Listening</span>)
          : <span className="listen-label">Listen</span>}
      </button>
      {live.error && <span className="listen-error" role="alert">{live.error}</span>}
    </>
  )
}

interface LayerProps {
  live: LiveNoteEngine
  /** Open-string MIDI notes in render order (high string first) */
  openMidis: number[]
  /** Open-string names in render order (high string first) */
  openNotes: string[]
  startFret: number
  fretCount: number
  fretWidth: number
  labelRotation: number
}

// The current note pulses; recently played notes stay as a fading trail so a run stays readable
export function LiveNoteLayer({ live, openMidis, openNotes, startFret, fretCount, fretWidth, labelRotation }: LayerProps) {
  const { note, trail } = useLiveSnapshot(live)
  if (!trail.length && !note) return null
  const latestId = note ? trail[trail.length - 1]?.id : undefined

  return (
    <g className="live-notes" style={{ pointerEvents: 'none' }}>
      {trail.map(t => {
        const current = t.id === latestId
        return openMidis.map((openMidi, stringIndex) => {
          if (openMidi < 0) return null
          const fret = t.midi - openMidi
          const y = 35 + stringIndex * 30
          if (fret === 0) {
            return current ? (
              <text key={`${t.id}-${stringIndex}`} x="25" y={y + 5} textAnchor="middle" fontSize="14" fontWeight="bold"
                fill="#2ecc71" fontFamily="system-ui, sans-serif" className="live-open-label">
                {openNotes[stringIndex]}
              </text>
            ) : null
          }
          if (fret < startFret || fret >= startFret + fretCount) return null
          const x = 58 + (fret - startFret + 0.5) * fretWidth
          return (
            <g key={`${t.id}-${stringIndex}`} className={current ? 'live-note' : 'live-note-trail'}>
              {current && <circle cx={x} cy={y} r="18" className="live-note-ring" />}
              <circle cx={x} cy={y} r="13" fill="#2ecc71" stroke="#fff" strokeWidth="2" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10"
                fontWeight="bold"
                fill="#0b2e1a"
                fontFamily="system-ui, sans-serif"
                transform={labelRotation !== 0 ? `rotate(${labelRotation} ${x} ${y})` : undefined}
              >
                {getNoteAtFret(openNotes[stringIndex], fret)}
              </text>
            </g>
          )
        })
      })}
    </g>
  )
}
