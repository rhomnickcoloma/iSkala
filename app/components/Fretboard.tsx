'use client'

import { useState } from 'react'
import { 
  NOTES,
  SCALES, 
  STANDARD_TUNING, 
  getNoteAtFret, 
  getScaleNotes, 
  isRootNote,
  isBlueNote,
  getIntervalName
} from '../lib/scales'
import KeySelector from './KeySelector'
import Metronome from './Metronome'
import ScaleInfoPanel from './ScaleInfoPanel'
import ComparisonView from './ComparisonView'

const FRET_COUNT = 15
const STRING_COUNT = 6

type DisplayMode = 'notes' | 'intervals' | 'none'
type PanelMode = 'none' | 'info' | 'practice'
type PatternMode = 'full' | '3nps' | 'caged' | 'diagonal'
type DiagonalType = 'pentatonic' | 'major' | 'minor'

// CAGED position fret ranges (relative to root position)
const CAGED_POSITIONS = {
  1: { name: 'Position 1', fretRange: [0, 4] },
  2: { name: 'Position 2', fretRange: [2, 6] },
  3: { name: 'Position 3', fretRange: [4, 8] },
  4: { name: 'Position 4', fretRange: [7, 11] },
  5: { name: 'Position 5', fretRange: [9, 13] },
}

// 3NPS position fret ranges
const THREE_NPS_POSITIONS = {
  1: { name: 'Position 1', fretRange: [0, 4] },
  2: { name: 'Position 2', fretRange: [2, 6] },
  3: { name: 'Position 3', fretRange: [4, 8] },
  4: { name: 'Position 4', fretRange: [5, 9] },
  5: { name: 'Position 5', fretRange: [7, 11] },
  6: { name: 'Position 6', fretRange: [9, 13] },
  7: { name: 'Position 7', fretRange: [11, 15] },
}

// Diagonal patterns - fret range per string (string 6 to string 1, low E to high E)
// These create extended diagonal runs across the neck
const DIAGONAL_PATTERNS = {
  pentatonic: {
    name: 'Pentatonic Diagonal',
    // Each array is [minFret, maxFret] for strings 6,5,4,3,2,1 (reversed in display)
    ascending: [
      [0, 3],   // String 6 (low E)
      [0, 3],   // String 5 (A)
      [2, 4],   // String 4 (D)
      [2, 5],   // String 3 (G)
      [5, 7],   // String 2 (B)
      [5, 8],   // String 1 (high E)
    ],
    descending: [
      [5, 8],   // String 6
      [5, 7],   // String 5
      [4, 7],   // String 4
      [4, 7],   // String 3
      [7, 10],  // String 2
      [7, 10],  // String 1
    ],
  },
  major: {
    name: 'Major Diagonal',
    ascending: [
      [0, 4],   // String 6
      [0, 4],   // String 5
      [1, 4],   // String 4
      [1, 4],   // String 3
      [4, 7],   // String 2
      [4, 7],   // String 1
    ],
    descending: [
      [4, 7],   // String 6
      [4, 7],   // String 5
      [6, 9],   // String 4
      [6, 9],   // String 3
      [9, 12],  // String 2
      [9, 12],  // String 1
    ],
  },
  minor: {
    name: 'Minor Diagonal',
    ascending: [
      [0, 3],   // String 6
      [0, 3],   // String 5
      [2, 5],   // String 4
      [2, 5],   // String 3
      [5, 8],   // String 2
      [5, 8],   // String 1
    ],
    descending: [
      [5, 8],   // String 6
      [5, 8],   // String 5
      [7, 10],  // String 4
      [7, 10],  // String 3
      [10, 13], // String 2
      [10, 13], // String 1
    ],
  },
}

export default function Fretboard() {
  const [selectedKey, setSelectedKey] = useState<string>('A')
  const [selectedScale, setSelectedScale] = useState<string>('minor-pentatonic')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('notes')
  const [panelMode, setPanelMode] = useState<PanelMode>('info')
  const [patternMode, setPatternMode] = useState<PatternMode>('full')
  const [selectedPosition, setSelectedPosition] = useState<number>(1)
  const [diagonalType, setDiagonalType] = useState<DiagonalType>('pentatonic')
  const [diagonalDirection, setDiagonalDirection] = useState<'ascending' | 'descending'>('ascending')
  const [showComparison, setShowComparison] = useState<boolean>(false)

  const scaleNotes = getScaleNotes(selectedKey, selectedScale)
  const currentScale = SCALES[selectedScale]

  // Get root note offset for position calculation
  const rootIndex = NOTES.indexOf(selectedKey as typeof NOTES[number])
  const positionOffset = rootIndex >= 5 ? rootIndex - 12 : rootIndex

  const togglePanel = (mode: PanelMode) => {
    setPanelMode(panelMode === mode ? 'none' : mode)
  }

  // Check if a fret/string is within the current pattern position
  const isInPattern = (fret: number, stringIndex?: number): boolean => {
    if (patternMode === 'full') return true
    
    if (patternMode === 'diagonal' && stringIndex !== undefined) {
      const pattern = DIAGONAL_PATTERNS[diagonalType]
      const direction = pattern[diagonalDirection]
      // stringIndex is 0-5 where 0 is high E (string 1) in our reversed display
      // direction array is 0-5 where 0 is low E (string 6)
      const actualStringIndex = 5 - stringIndex
      const [minFret, maxFret] = direction[actualStringIndex]
      const adjustedMin = minFret + positionOffset
      const adjustedMax = maxFret + positionOffset
      return fret >= adjustedMin && fret <= adjustedMax
    }
    
    const positions = patternMode === '3nps' ? THREE_NPS_POSITIONS : CAGED_POSITIONS
    const position = positions[selectedPosition as keyof typeof positions]
    if (!position) return true
    
    const [minFret, maxFret] = position.fretRange
    const adjustedMin = minFret + positionOffset
    const adjustedMax = maxFret + positionOffset
    
    return fret >= adjustedMin && fret <= adjustedMax
  }

  const getPositions = () => {
    if (patternMode === '3nps') return THREE_NPS_POSITIONS
    if (patternMode === 'caged') return CAGED_POSITIONS
    return null
  }

  return (
    <div className={`fretboard-container ${panelMode !== 'none' ? 'with-panel' : ''}`}>
      <div className="scale-header">
        <div className="header-left">
          <select 
            id="scale-select"
            value={selectedScale} 
            onChange={(e) => setSelectedScale(e.target.value)}
            className="select-input scale-select"
          >
            {Object.entries(SCALES).map(([key, scale]) => (
              <option key={key} value={key}>{scale.name}</option>
            ))}
          </select>
          <div className="display-buttons">
            <button
              className={`display-btn ${displayMode === 'notes' ? 'active' : ''}`}
              onClick={() => setDisplayMode('notes')}
              title="Show Notes"
            >
              ABC
            </button>
            <button
              className={`display-btn ${displayMode === 'intervals' ? 'active' : ''}`}
              onClick={() => setDisplayMode('intervals')}
              title="Show Intervals"
            >
              1-3-5
            </button>
            <button
              className={`display-btn ${displayMode === 'none' ? 'active' : ''}`}
              onClick={() => setDisplayMode('none')}
              title="Hide Labels"
            >
              ○
            </button>
          </div>
        </div>
        <div className="header-center">
          <h2>{selectedKey} {currentScale?.name}</h2>
          <p className="scale-description">{currentScale?.description}</p>
        </div>
        <div className="panel-buttons">
          <button 
            className={`panel-btn ${panelMode === 'info' ? 'active' : ''}`}
            onClick={() => togglePanel('info')}
            title="Scale Info"
          >
            {/* Music notes / scale info icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
            </svg>
          </button>
          <button 
            className={`panel-btn ${panelMode === 'practice' ? 'active' : ''}`}
            onClick={() => togglePanel('practice')}
            title="Practice Tips"
          >
            {/* Dumbbell / exercise icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
            </svg>
          </button>
          <button 
            className="panel-btn compare-btn"
            onClick={() => setShowComparison(true)}
            title="Compare Scales"
          >
            {/* Compare / layers icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16"/>
              <circle cx="8" cy="6" r="2" fill="currentColor"/>
              <circle cx="16" cy="12" r="2" fill="currentColor"/>
              <circle cx="10" cy="18" r="2" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Pattern Mode Selector */}
      <div className="pattern-selector">
        <div className="pattern-modes">
          <button
            className={`pattern-btn ${patternMode === 'full' ? 'active' : ''}`}
            onClick={() => setPatternMode('full')}
          >
            Full Scale
          </button>
          <button
            className={`pattern-btn ${patternMode === '3nps' ? 'active' : ''}`}
            onClick={() => { setPatternMode('3nps'); setSelectedPosition(1); }}
          >
            3NPS
          </button>
          <button
            className={`pattern-btn ${patternMode === 'caged' ? 'active' : ''}`}
            onClick={() => { setPatternMode('caged'); setSelectedPosition(1); }}
          >
            CAGED
          </button>
          <button
            className={`pattern-btn diagonal ${patternMode === 'diagonal' ? 'active' : ''}`}
            onClick={() => setPatternMode('diagonal')}
          >
            Diagonal
          </button>
        </div>
        
        {patternMode !== 'full' && patternMode !== 'diagonal' && (
          <div className="position-selector">
            {Object.entries(getPositions() || {}).map(([key, pos]) => (
              <button
                key={key}
                className={`position-btn ${selectedPosition === Number(key) ? 'active' : ''}`}
                onClick={() => setSelectedPosition(Number(key))}
              >
                {key}
              </button>
            ))}
          </div>
        )}

        {patternMode === 'diagonal' && (
          <div className="diagonal-options">
            <div className="diagonal-types">
              <button
                className={`diagonal-type-btn ${diagonalType === 'pentatonic' ? 'active' : ''}`}
                onClick={() => setDiagonalType('pentatonic')}
              >
                Pentatonic
              </button>
              <button
                className={`diagonal-type-btn ${diagonalType === 'major' ? 'active' : ''}`}
                onClick={() => setDiagonalType('major')}
              >
                Major
              </button>
              <button
                className={`diagonal-type-btn ${diagonalType === 'minor' ? 'active' : ''}`}
                onClick={() => setDiagonalType('minor')}
              >
                Minor
              </button>
            </div>
            <div className="diagonal-direction">
              <button
                className={`direction-btn ${diagonalDirection === 'ascending' ? 'active' : ''}`}
                onClick={() => setDiagonalDirection('ascending')}
                title="Ascending (low to high)"
              >
                ↗ Up
              </button>
              <button
                className={`direction-btn ${diagonalDirection === 'descending' ? 'active' : ''}`}
                onClick={() => setDiagonalDirection('descending')}
                title="Descending (high to low)"
              >
                ↘ Down
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="fretboard-main">
        {/* Fretboard SVG */}
        <div className="fretboard-wrapper">
        <svg 
          viewBox={`0 0 ${FRET_COUNT * 60 + 80} ${STRING_COUNT * 30 + 60}`} 
          className="fretboard-svg"
        >
          {/* Background */}
          <rect 
            x="0" 
            y="0" 
            width={FRET_COUNT * 60 + 80} 
            height={STRING_COUNT * 30 + 60} 
            fill="#111"
          />

          {/* Position highlight box */}
          {patternMode !== 'full' && (() => {
            const positions = patternMode === '3nps' ? THREE_NPS_POSITIONS : CAGED_POSITIONS
            const position = positions[selectedPosition as keyof typeof positions]
            if (!position) return null
            
            const [minFret, maxFret] = position.fretRange
            const adjustedMin = Math.max(1, minFret + positionOffset)
            const adjustedMax = Math.min(FRET_COUNT, maxFret + positionOffset)
            
            const x = 58 + (adjustedMin - 1) * 60
            const width = (adjustedMax - adjustedMin + 1) * 60
            
            return (
              <rect
                x={x}
                y="15"
                width={width}
                height={STRING_COUNT * 30 + 10}
                fill="rgba(52, 152, 219, 0.1)"
                stroke="rgba(52, 152, 219, 0.4)"
                strokeWidth="2"
                rx="8"
              />
            )
          })()}

          {/* Nut */}
          <rect x="50" y="20" width="8" height={STRING_COUNT * 30} fill="#f5f5dc" rx="2"/>

          {/* Fretboard wood */}
          <rect 
            x="58" 
            y="20" 
            width={FRET_COUNT * 60} 
            height={STRING_COUNT * 30} 
            fill="#5D4037"
            rx="4"
          />

          {/* Fret markers (dots) */}
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
            return (
              <circle key={fret} cx={x} cy={y} r="8" fill="#1a1a1a" opacity="0.8"/>
            )
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
          {STANDARD_TUNING.slice().reverse().map((_, stringIndex) => {
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

          {/* String labels (open notes) */}
          {STANDARD_TUNING.slice().reverse().map((note, stringIndex) => {
            const y = 40 + stringIndex * 30
            return (
              <text
                key={stringIndex}
                x="25"
                y={y}
                textAnchor="middle"
                fontSize="14"
                fill="#888"
                fontFamily="system-ui, sans-serif"
              >
                {note}
              </text>
            )
          })}

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

          {/* Scale notes on fretboard */}
          {STANDARD_TUNING.slice().reverse().map((openNote, stringIndex) => {
            const y = 35 + stringIndex * 30
            
            return Array.from({ length: FRET_COUNT }, (_, i) => {
              const fret = i + 1
              const note = getNoteAtFret(openNote, fret)
              
              if (!scaleNotes.includes(note)) return null
              
              const inPattern = isInPattern(fret, stringIndex)
              const x = 58 + (fret - 0.5) * 60
              const isRoot = isRootNote(note, selectedKey)
              const isBlue = isBlueNote(note, selectedKey, selectedScale)
              
              const intervalLabel = getIntervalName(note, selectedKey, selectedScale)
              const displayText = displayMode === 'notes' ? note : displayMode === 'intervals' ? intervalLabel : ''
              
              // Dim notes outside pattern
              const opacity = inPattern ? 1 : 0.25
              const fillColor = isRoot ? '#c0392b' : isBlue ? '#2980b9' : '#5a5a5a'
              const strokeColor = isRoot ? '#e74c3c' : isBlue ? '#3498db' : '#bbb'
              
              return (
                <g key={`${stringIndex}-${fret}`} opacity={opacity}>
                  <circle
                    cx={x}
                    cy={y}
                    r="12"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
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

          {/* Legend */}
          <div className="legend">
            <div className="legend-item">
              <span className="legend-dot root"></span>
              <span>Root ({selectedKey})</span>
            </div>
            {currentScale?.intervals.includes(6) && (
              <div className="legend-item">
                <span className="legend-dot blue"></span>
                <span>Blue Note (♭5)</span>
              </div>
            )}
            <div className="legend-item">
              <span className="legend-dot scale"></span>
              <span>Scale Notes</span>
            </div>
          </div>

          {/* Notes in Scale */}
          <div className="scale-notes-inline">
            <span className="notes-label">Notes:</span>
            <div className="notes-row-inline">
              {scaleNotes.map((note, index) => {
                const isRoot = isRootNote(note, selectedKey)
                const isBlue = isBlueNote(note, selectedKey, selectedScale)
                const noteClass = isRoot ? 'root' : isBlue ? 'blue' : ''
                return (
                  <span key={index} className={`note-pill ${noteClass}`}>
                    {note}
                  </span>
                )
              })}
            </div>
          </div>
          
          {/* Key Selection */}
          <KeySelector 
            selectedKey={selectedKey}
            onKeyChange={setSelectedKey}
          />

          {/* Metronome */}
          <Metronome />
        </div>

        {/* Side Panel */}
        <ScaleInfoPanel 
          panelMode={panelMode}
          scaleNotes={scaleNotes}
          currentScale={currentScale}
        />
      </div>

      {/* Comparison View Modal */}
      {showComparison && (
        <ComparisonView onClose={() => setShowComparison(false)} />
      )}
    </div>
  )
}
