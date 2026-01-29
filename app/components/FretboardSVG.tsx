'use client'

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

const FRET_COUNT = 15
const STRING_COUNT = 6

type DisplayMode = 'notes' | 'intervals' | 'none'
type PatternMode = 'full' | '3nps' | 'caged' | 'diagonal'
type DiagonalType = 'pentatonic' | 'major' | 'minor'

// CAGED position fret ranges
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

// Diagonal patterns
const DIAGONAL_PATTERNS = {
  pentatonic: {
    ascending: [[0, 3], [0, 3], [2, 4], [2, 5], [5, 7], [5, 8]],
    descending: [[5, 8], [5, 7], [4, 7], [4, 7], [7, 10], [7, 10]],
  },
  major: {
    ascending: [[0, 4], [0, 4], [1, 4], [1, 4], [4, 7], [4, 7]],
    descending: [[4, 7], [4, 7], [6, 9], [6, 9], [9, 12], [9, 12]],
  },
  minor: {
    ascending: [[0, 3], [0, 3], [2, 5], [2, 5], [5, 8], [5, 8]],
    descending: [[5, 8], [5, 8], [7, 10], [7, 10], [10, 13], [10, 13]],
  },
}

interface FretboardSVGProps {
  selectedKey: string
  selectedScale: string
  displayMode: DisplayMode
  patternMode: PatternMode
  selectedPosition: number
  diagonalType: DiagonalType
  diagonalDirection: 'ascending' | 'descending'
  compact?: boolean
  label?: string
  accentColor?: string
}

export default function FretboardSVG({
  selectedKey,
  selectedScale,
  displayMode,
  patternMode,
  selectedPosition,
  diagonalType,
  diagonalDirection,
  compact = false,
  label,
  accentColor = '#3498db'
}: FretboardSVGProps) {
  const scaleNotes = getScaleNotes(selectedKey, selectedScale)
  const currentScale = SCALES[selectedScale]

  const rootIndex = NOTES.indexOf(selectedKey as typeof NOTES[number])
  const positionOffset = rootIndex >= 5 ? rootIndex - 12 : rootIndex

  const isInPattern = (fret: number, stringIndex?: number): boolean => {
    if (patternMode === 'full') return true
    
    if (patternMode === 'diagonal' && stringIndex !== undefined) {
      const pattern = DIAGONAL_PATTERNS[diagonalType]
      const direction = pattern[diagonalDirection]
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

  return (
    <div className={`fretboard-svg-container ${compact ? 'compact' : ''}`}>
      {label && (
        <div className="fretboard-label" style={{ borderColor: accentColor, color: accentColor }}>
          <span className="label-key">{selectedKey}</span>
          <span className="label-scale">{currentScale?.name}</span>
        </div>
      )}
      <svg 
        viewBox={`0 0 ${FRET_COUNT * 60 + 80} ${STRING_COUNT * 30 + 60}`} 
        className="fretboard-svg"
      >
        {/* Background */}
        <rect x="0" y="0" width={FRET_COUNT * 60 + 80} height={STRING_COUNT * 30 + 60} fill="#111"/>

        {/* Position highlight box */}
        {patternMode !== 'full' && patternMode !== 'diagonal' && (() => {
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
              fill={`${accentColor}15`}
              stroke={`${accentColor}66`}
              strokeWidth="2"
              rx="8"
            />
          )
        })()}

        {/* Nut */}
        <rect x="50" y="20" width="8" height={STRING_COUNT * 30} fill="#f5f5dc" rx="2"/>

        {/* Fretboard wood */}
        <rect x="58" y="20" width={FRET_COUNT * 60} height={STRING_COUNT * 30} fill="#5D4037" rx="4"/>

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

        {/* String labels */}
        {STANDARD_TUNING.slice().reverse().map((note, stringIndex) => (
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
    </div>
  )
}
