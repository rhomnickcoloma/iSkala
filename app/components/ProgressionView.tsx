'use client'

import { useState } from 'react'
import Image from 'next/image'
import { 
  NOTES,
  SCALES, 
  getNoteAtFret, 
  getScaleNotes, 
  isRootNote,
  getDominantNote,
  DOMINANT_SCALES
} from '../lib/scales'
import { useInstrument } from '../context/InstrumentContext'

type DisplayMode = 'notes' | 'intervals' | 'none'
type KeyQuality = 'minor' | 'major'

interface ProgressionViewProps {
  onClose: () => void
}

export default function ProgressionView({ onClose }: ProgressionViewProps) {
  const { instrument } = useInstrument()
  const tuning = instrument.tuning
  const STRING_COUNT = instrument.stringCount
  const FRET_COUNT = instrument.defaultFretCount

  // Key state
  const [selectedKey, setSelectedKey] = useState<string>('A')
  const [keyQuality, setKeyQuality] = useState<KeyQuality>('minor')
  
  // Selected dominant scale
  const [selectedDominantScale, setSelectedDominantScale] = useState<string>('mixolydian')
  
  // Display state
  const [displayMode, setDisplayMode] = useState<DisplayMode>('notes')

  // Calculate the dominant (V) note
  const dominantNote = getDominantNote(selectedKey, keyQuality === 'minor')
  
  // Get scale notes for the dominant
  const dominantScaleNotes = getScaleNotes(dominantNote, selectedDominantScale)
  const currentDominantScale = SCALES[selectedDominantScale]

  // Get the key name
  const keyName = `${selectedKey}${keyQuality === 'minor' ? 'm' : ''}`
  const dominantChordName = `${dominantNote}7`

  // Get scale descriptions with context
  const getScaleContext = (scaleKey: string): string => {
    const contexts: Record<string, string> = {
      'mixolydian': 'Basic dominant sound, safe choice for any V7',
      'phrygian-dominant': 'Spanish/flamenco feel, great for V7→im resolution',
      'altered': 'Maximum tension, all altered notes (♭9, #9, ♭5, #5)',
      'lydian-dominant': 'Bright and floaty, good for static dominants',
      'mixolydian-b6': 'Melodic minor sound, exotic ♭6 over V7',
      'diminished-half-whole': 'Symmetric tension, works over V7♭9',
      'whole-tone': 'Dreamy, unresolved, for V7#5 chords',
      'bebop-dominant': 'Jazz lines with chromatic passing tone',
      'mixo-pentatonic': 'Simple and bluesy dominant sound',
    }
    return contexts[scaleKey] || ''
  }

  // Colors for visualization
  const colors = {
    dominant: { fill: '#e67e22', stroke: '#f39c12' },      // Orange for dominant
    root: { fill: '#c0392b', stroke: '#e74c3c' },          // Red for V root
    tension: { fill: '#9b59b6', stroke: '#a569bd' },       // Purple for tensions
  }

  // Get interval name
  const getIntervalName = (note: string): string => {
    const scale = SCALES[selectedDominantScale]
    if (!scale) return ''
    
    const rootIndex = NOTES.indexOf(dominantNote as typeof NOTES[number])
    const noteIndex = NOTES.indexOf(note as typeof NOTES[number])
    const interval = (noteIndex - rootIndex + 12) % 12
    
    const intervalNames: Record<number, string> = {
      0: 'R',
      1: '♭9',
      2: '9',
      3: '#9',
      4: '3',
      5: '11',
      6: '#11',
      7: '5',
      8: '♭13',
      9: '13',
      10: '♭7',
      11: '7',
    }
    
    return intervalNames[interval] || ''
  }

  // Check if note is a tension (altered note)
  const isTensionNote = (note: string): boolean => {
    const rootIndex = NOTES.indexOf(dominantNote as typeof NOTES[number])
    const noteIndex = NOTES.indexOf(note as typeof NOTES[number])
    const interval = (noteIndex - rootIndex + 12) % 12
    // ♭9, #9, #11, ♭13 are tension notes
    return [1, 3, 6, 8].includes(interval)
  }

  return (
    <div className="comparison-overlay">
      <div className="comparison-modal single-fretboard progression-modal">
        <div className="comparison-header">
          <h2>Progression View</h2>
          <div className="comparison-header-controls">
            <div className="comparison-display-modes">
              <button
                className={`display-btn ${displayMode === 'notes' ? 'active' : ''}`}
                onClick={() => setDisplayMode('notes')}
              >
                ABC
              </button>
              <button
                className={`display-btn ${displayMode === 'intervals' ? 'active' : ''}`}
                onClick={() => setDisplayMode('intervals')}
              >
                1-3-5
              </button>
              <button
                className={`display-btn ${displayMode === 'none' ? 'active' : ''}`}
                onClick={() => setDisplayMode('none')}
              >
                ○
              </button>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="comparison-single-content">
          {/* Logo Banner */}
          <div className="comparison-logo-wrapper">
            <div className="comparison-logo">
              <div className="sound-wave">
                {Array.from({ length: 40 }, (_, i) => (
                  <div 
                    key={i} 
                    className="wave-bar"
                    style={{ 
                      animationDelay: `${i * 0.05}s`,
                      height: `${20 + Math.sin(i * 0.3) * 15 + Math.random() * 10}%`
                    }}
                  />
                ))}
              </div>
              <Image 
                src="/logo.png" 
                alt="FretWiki" 
                width={60} 
                height={60}
                className="comparison-logo-img"
              />
              <div className="sound-wave right">
                {Array.from({ length: 40 }, (_, i) => (
                  <div 
                    key={i} 
                    className="wave-bar"
                    style={{ 
                      animationDelay: `${(40 - i) * 0.05}s`,
                      height: `${20 + Math.sin(i * 0.3) * 15 + Math.random() * 10}%`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Key & Progression Info */}
          <div className="progression-info">
            <div className="progression-key-selector">
              <div className="key-quality-toggle">
                <button
                  className={`quality-btn ${keyQuality === 'minor' ? 'active' : ''}`}
                  onClick={() => setKeyQuality('minor')}
                >
                  Minor
                </button>
                <button
                  className={`quality-btn ${keyQuality === 'major' ? 'active' : ''}`}
                  onClick={() => setKeyQuality('major')}
                >
                  Major
                </button>
              </div>
              <div className="key-select-group">
                <label>Key:</label>
                <select 
                  value={selectedKey} 
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="select-input"
                >
                  {NOTES.map(note => (
                    <option key={note} value={note}>{note}{keyQuality === 'minor' ? 'm' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="progression-chain">
              <div className="chain-item tonic">
                <span className="chord-numeral">i</span>
                <span className="chord-name">{keyName}</span>
              </div>
              <span className="chain-arrow">→</span>
              <div className="chain-item subdominant">
                <span className="chord-numeral">iv</span>
                <span className="chord-name">{getDominantNote(getDominantNote(selectedKey), false)}{keyQuality === 'minor' ? 'm' : ''}</span>
              </div>
              <span className="chain-arrow">→</span>
              <div className="chain-item dominant active">
                <span className="chord-numeral">V7</span>
                <span className="chord-name">{dominantChordName}</span>
              </div>
              <span className="chain-arrow">→</span>
              <div className="chain-item tonic">
                <span className="chord-numeral">i</span>
                <span className="chord-name">{keyName}</span>
              </div>
            </div>
          </div>

          {/* Dominant Scale Selection */}
          <div className="dominant-scale-selector">
            <h3>Scales for <span className="highlight">{dominantChordName}</span> (V7 of {keyName})</h3>
            <div className="dominant-scale-grid">
              {DOMINANT_SCALES.map(scaleKey => {
                const scale = SCALES[scaleKey]
                if (!scale) return null
                return (
                  <button
                    key={scaleKey}
                    className={`dominant-scale-btn ${selectedDominantScale === scaleKey ? 'active' : ''}`}
                    onClick={() => setSelectedDominantScale(scaleKey)}
                  >
                    <span className="scale-name">{scale.name}</span>
                    <span className="scale-context">{getScaleContext(scaleKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fretboard */}
          <div className="comparison-fretboard-wrapper">
            <div className="fretboard-scale-title">
              <h4>{dominantNote} {currentDominantScale?.name}</h4>
              <p>{currentDominantScale?.description}</p>
            </div>
            <svg 
              viewBox={`0 0 ${FRET_COUNT * 60 + 80} ${STRING_COUNT * 30 + 60}`} 
              className="fretboard-svg comparison-svg"
            >
              {/* Background */}
              <rect x="0" y="0" width={FRET_COUNT * 60 + 80} height={STRING_COUNT * 30 + 60} fill="#111"/>

              {/* Nut */}
              <rect x="50" y="20" width="8" height={STRING_COUNT * 30} fill="#f5f5dc" rx="2"/>

              {/* Fretboard wood */}
              <defs>
                <pattern id="woodgrain-prog" patternUnits="userSpaceOnUse" width={FRET_COUNT * 60} height={STRING_COUNT * 30}>
                  <rect width="100%" height="100%" fill="#3E2723"/>
                  {Array.from({ length: 14 }, (_, i) => {
                    const y1 = i * 14 + 3
                    return (
                      <line key={`g${i}`} x1="0" y1={y1} x2={FRET_COUNT * 60} y2={y1 + (i % 3 === 0 ? 2 : -1)}
                        stroke={i % 2 === 0 ? 'rgba(255,220,180,0.06)' : 'rgba(0,0,0,0.12)'}
                        strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
                      />
                    )
                  })}
                </pattern>
              </defs>
              <rect x="58" y="20" width={FRET_COUNT * 60} height={STRING_COUNT * 30} fill="url(#woodgrain-prog)" rx="4"/>

              {/* Fret markers */}
              {[3, 5, 7, 9, 12, 15].map(fret => {
                if (fret > FRET_COUNT) return null
                const x = 58 + (fret - 0.5) * 60
                const y = 20 + (STRING_COUNT * 30) / 2
                
                if (fret === 12) {
                  return (
                    <g key={fret}>
                      <circle cx={x} cy={y - 30} r="8" fill="#1a1a1a" opacity="0.8"/>
                      <circle cx={x} cy={y + 30} r="8" fill="#1a1a1a" opacity="0.8"/>
                    </g>
                  )
                }
                return <circle key={fret} cx={x} cy={y} r="8" fill="#1a1a1a" opacity="0.8"/>
              })}

              {/* Frets */}
              {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
                <line
                  key={i}
                  x1={58 + i * 60}
                  y1="20"
                  x2={58 + i * 60}
                  y2={20 + STRING_COUNT * 30}
                  stroke="#c0c0c0"
                  strokeWidth={i === 0 ? 4 : 2}
                />
              ))}

              {/* Strings */}
              {tuning.slice().reverse().map((_, stringIndex) => {
                const y = 35 + stringIndex * 30
                const thickness = 1 + stringIndex * 0.4
                return (
                  <line
                    key={stringIndex}
                    x1="50"
                    y1={y}
                    x2={58 + FRET_COUNT * 60}
                    y2={y}
                    stroke="#d4d4d4"
                    strokeWidth={thickness}
                  />
                )
              })}

              {/* String labels */}
              {tuning.slice().reverse().map((note, stringIndex) => (
                <text
                  key={stringIndex}
                  x="25"
                  y={40 + stringIndex * 30}
                  textAnchor="middle"
                  fontSize="14"
                  fill="#888"
                  fontFamily="system-ui, sans-serif"
                >
                  {note}
                </text>
              ))}

              {/* Fret numbers */}
              {Array.from({ length: FRET_COUNT }, (_, i) => (
                <text
                  key={i}
                  x={58 + (i + 0.5) * 60}
                  y={STRING_COUNT * 30 + 50}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#666"
                  fontFamily="system-ui, sans-serif"
                >
                  {i + 1}
                </text>
              ))}

              {/* Scale notes */}
              {tuning.slice().reverse().map((openNote, stringIndex) => {
                const y = 35 + stringIndex * 30
                
                return Array.from({ length: FRET_COUNT }, (_, i) => {
                  const fret = i + 1
                  const note = getNoteAtFret(openNote, fret)
                  
                  if (!dominantScaleNotes.includes(note)) return null
                  
                  const x = 58 + (fret - 0.5) * 60
                  const isRoot = isRootNote(note, dominantNote)
                  const isTension = isTensionNote(note)
                  
                  let fillColor: string
                  let strokeColor: string
                  
                  if (isRoot) {
                    fillColor = colors.root.fill
                    strokeColor = colors.root.stroke
                  } else if (isTension) {
                    fillColor = colors.tension.fill
                    strokeColor = colors.tension.stroke
                  } else {
                    fillColor = colors.dominant.fill
                    strokeColor = colors.dominant.stroke
                  }
                  
                  const intervalLabel = getIntervalName(note)
                  const displayText = displayMode === 'notes' ? note : displayMode === 'intervals' ? intervalLabel : ''
                  
                  return (
                    <g key={`${stringIndex}-${fret}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2"
                      />
                      {displayMode !== 'none' && (
                        <text
                          x={x}
                          y={y + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="white"
                          fontFamily="system-ui, sans-serif"
                          style={{ pointerEvents: 'none' }}
                        >
                          {displayText}
                        </text>
                      )}
                    </g>
                  )
                })
              })}
            </svg>
          </div>

          {/* Legend & Scale Notes */}
          <div className="progression-legend">
            <div className="legend-section">
              <h4>Legend</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: colors.root.fill }}></span>
                  <span>Root ({dominantNote})</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: colors.dominant.fill }}></span>
                  <span>Chord Tones</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: colors.tension.fill }}></span>
                  <span>Tensions</span>
                </div>
              </div>
            </div>
            
            <div className="legend-section scale-notes-section">
              <h4>Scale Notes</h4>
              <div className="scale-notes-row">
                {dominantScaleNotes.map((note, index) => {
                  const isRoot = isRootNote(note, dominantNote)
                  const isTension = isTensionNote(note)
                  const interval = getIntervalName(note)
                  return (
                    <div 
                      key={index} 
                      className="scale-note-item"
                      style={{ 
                        background: isRoot ? colors.root.fill : isTension ? colors.tension.fill : colors.dominant.fill 
                      }}
                    >
                      <span className="note-name">{note}</span>
                      <span className="note-interval">{interval}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Practice Tips */}
          <div className="progression-practice">
            <h4>💡 Practice Tips</h4>
            <ul>
              {currentDominantScale?.practice.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
