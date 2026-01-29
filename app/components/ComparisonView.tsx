'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { 
  NOTES,
  SCALES, 
  STANDARD_TUNING, 
  getNoteAtFret, 
  getScaleNotes, 
  isRootNote
} from '../lib/scales'

const FRET_COUNT = 15
const STRING_COUNT = 6

type DisplayMode = 'notes' | 'intervals' | 'none'

interface SlideConnection {
  from: { stringIndex: number; fret: number; x: number; y: number }
  to: { stringIndex: number; fret: number; x: number; y: number }
}

interface ComparisonViewProps {
  onClose: () => void
}

export default function ComparisonView({ onClose }: ComparisonViewProps) {
  // Scale A state (Blue)
  const [keyA, setKeyA] = useState<string>('A')
  const [scaleA, setScaleA] = useState<string>('minor-pentatonic')

  // Scale B state (Orange)
  const [keyB, setKeyB] = useState<string>('A')
  const [scaleB, setScaleB] = useState<string>('major-pentatonic')

  // Display state
  const [displayMode, setDisplayMode] = useState<DisplayMode>('notes')
  const [showScaleA, setShowScaleA] = useState<boolean>(true)
  const [showScaleB, setShowScaleB] = useState<boolean>(true)
  
  // Hidden notes state
  const [hiddenPositions, setHiddenPositions] = useState<Set<string>>(new Set())
  
  // Slide connections state
  const [slideConnections, setSlideConnections] = useState<SlideConnection[]>([])
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ stringIndex: number; fret: number; x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const scaleNotesA = getScaleNotes(keyA, scaleA)
  const scaleNotesB = getScaleNotes(keyB, scaleB)
  const currentScaleA = SCALES[scaleA]
  const currentScaleB = SCALES[scaleB]

  // Find overlapping notes
  const overlappingNotes = scaleNotesA.filter(note => scaleNotesB.includes(note))
  const uniqueToA = scaleNotesA.filter(note => !scaleNotesB.includes(note))
  const uniqueToB = scaleNotesB.filter(note => !scaleNotesA.includes(note))

  // Get SVG coordinates from mouse event
  const getSVGCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
    return { x: svgP.x, y: svgP.y }
  }

  // Start dragging from a note
  const handleNoteMouseDown = (e: React.MouseEvent, stringIndex: number, fret: number, x: number, y: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragStart({ stringIndex, fret, x, y })
    setDragCurrent({ x, y })
  }

  // Track mouse movement
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const coords = getSVGCoords(e)
    if (coords) {
      setDragCurrent(coords)
    }
  }

  // End drag on a note - create connection
  const handleNoteMouseUp = (e: React.MouseEvent, stringIndex: number, fret: number, x: number, y: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isDragging && dragStart && (dragStart.stringIndex !== stringIndex || dragStart.fret !== fret)) {
      // Create new slide connection
      const newConnection: SlideConnection = {
        from: dragStart,
        to: { stringIndex, fret, x, y }
      }
      setSlideConnections(prev => [...prev, newConnection])
    }
    
    setIsDragging(false)
    setDragStart(null)
    setDragCurrent(null)
  }

  // Cancel drag if mouse up happens elsewhere
  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
    setDragCurrent(null)
  }

  // Remove a slide connection
  const removeSlideConnection = (index: number) => {
    setSlideConnections(prev => prev.filter((_, i) => i !== index))
  }

  // Clear all slides
  const clearAllSlides = () => {
    setSlideConnections([])
  }

  // Generate curved path between two points
  const generateSlidePath = (from: { x: number; y: number }, to: { x: number; y: number }): string => {
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const dx = to.x - from.x
    const dy = to.y - from.y
    
    // Create a curve that bows perpendicular to the line
    const curveAmount = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3 + 20
    const angle = Math.atan2(dy, dx)
    const perpAngle = angle + Math.PI / 2
    
    const ctrlX = midX + Math.cos(perpAngle) * curveAmount
    const ctrlY = midY + Math.sin(perpAngle) * curveAmount
    
    return `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`
  }

  // Toggle note visibility (only if not dragging)
  const toggleNoteVisibility = (stringIndex: number, fret: number) => {
    if (isDragging) return
    const key = `${stringIndex}-${fret}`
    setHiddenPositions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Check if a position is hidden
  const isPositionHidden = (stringIndex: number, fret: number): boolean => {
    return hiddenPositions.has(`${stringIndex}-${fret}`)
  }

  // Reset all hidden notes
  const resetHiddenNotes = () => {
    setHiddenPositions(new Set())
  }

  // Get note category for coloring
  const getNoteCategory = (note: string): 'overlap' | 'scaleA' | 'scaleB' | 'none' => {
    const inA = showScaleA && scaleNotesA.includes(note)
    const inB = showScaleB && scaleNotesB.includes(note)
    
    if (inA && inB) return 'overlap'
    if (inA) return 'scaleA'
    if (inB) return 'scaleB'
    return 'none'
  }

  // Colors
  const colors = {
    scaleA: { fill: '#3498db', stroke: '#5dade2' },      // Blue
    scaleB: { fill: '#e67e22', stroke: '#f39c12' },      // Orange
    overlap: { fill: '#2ecc71', stroke: '#58d68d' },     // Green for overlap
    rootA: { fill: '#1a5276', stroke: '#2874a6' },       // Dark blue for root A
    rootB: { fill: '#935116', stroke: '#b9770e' },       // Dark orange for root B
    rootOverlap: { fill: '#1e8449', stroke: '#27ae60' }, // Dark green for overlapping roots
  }

  return (
    <div className="comparison-overlay">
      <div className="comparison-modal single-fretboard">
        <div className="comparison-header">
          <h2>Scale Comparison</h2>
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
            {hiddenPositions.size > 0 && (
              <button 
                className="reset-hidden-btn"
                onClick={resetHiddenNotes}
                title="Restore all hidden notes"
              >
                ↺ Reset ({hiddenPositions.size})
              </button>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="comparison-single-content">
          {/* Centered Logo with Sound Wave */}
          <div className="comparison-logo-wrapper">
            <div className="comparison-logo">
              {/* Sound wave bars */}
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
                alt="iSkala" 
                width={60} 
                height={60}
                className="comparison-logo-img"
              />
              {/* Sound wave bars (right side) */}
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

          {/* Scale Selectors */}
          <div className="scale-selectors">
            {/* Scale A */}
            <div className={`scale-selector scale-a ${showScaleA ? 'active' : ''}`}>
              <button 
                className="toggle-scale-btn"
                onClick={() => setShowScaleA(!showScaleA)}
                style={{ background: showScaleA ? colors.scaleA.fill : 'transparent' }}
              >
                {showScaleA ? '✓' : ''}
              </button>
              <span className="scale-label" style={{ color: colors.scaleA.fill }}>A</span>
              <select 
                value={keyA} 
                onChange={(e) => setKeyA(e.target.value)}
                className="select-input compact"
              >
                {NOTES.map(note => (
                  <option key={note} value={note}>{note}</option>
                ))}
              </select>
              <select 
                value={scaleA} 
                onChange={(e) => setScaleA(e.target.value)}
                className="select-input compact"
              >
                {Object.entries(SCALES).map(([key, scale]) => (
                  <option key={key} value={key}>{scale.name}</option>
                ))}
              </select>
            </div>

            {/* Overlap indicator */}
            <div className="overlap-indicator">
              <span className="overlap-dot" style={{ background: colors.overlap.fill }}></span>
              <span>Overlap ({overlappingNotes.length})</span>
            </div>

            {/* Scale B */}
            <div className={`scale-selector scale-b ${showScaleB ? 'active' : ''}`}>
              <button 
                className="toggle-scale-btn"
                onClick={() => setShowScaleB(!showScaleB)}
                style={{ background: showScaleB ? colors.scaleB.fill : 'transparent' }}
              >
                {showScaleB ? '✓' : ''}
              </button>
              <span className="scale-label" style={{ color: colors.scaleB.fill }}>B</span>
              <select 
                value={keyB} 
                onChange={(e) => setKeyB(e.target.value)}
                className="select-input compact"
              >
                {NOTES.map(note => (
                  <option key={note} value={note}>{note}</option>
                ))}
              </select>
              <select 
                value={scaleB} 
                onChange={(e) => setScaleB(e.target.value)}
                className="select-input compact"
              >
                {Object.entries(SCALES).map(([key, scale]) => (
                  <option key={key} value={key}>{scale.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Single Fretboard */}
          <div className="comparison-fretboard-wrapper">
            {/* Hint icon - top right */}
            <div className="fretboard-hint-icon">
              <div className="hint-icon-wrapper">
                <span className="hint-icon">?</span>
                <div className="hint-tooltip">
                  <p>💡 <strong>Tips:</strong></p>
                  <ul>
                    <li>Click on any note to hide/show it</li>
                    <li>Hidden notes appear as dashed circles</li>
                    <li>Drag from one note to another to create slide indicators</li>
                  </ul>
                </div>
              </div>
              {slideConnections.length > 0 && (
                <button className="clear-slides-inline" onClick={clearAllSlides}>
                  Clear ({slideConnections.length})
                </button>
              )}
            </div>
            <svg 
              ref={svgRef}
              viewBox={`0 0 ${FRET_COUNT * 60 + 80} ${STRING_COUNT * 30 + 60}`} 
              className={`fretboard-svg comparison-svg ${isDragging ? 'dragging' : ''}`}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background */}
              <rect x="0" y="0" width={FRET_COUNT * 60 + 80} height={STRING_COUNT * 30 + 60} fill="#111"/>

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
                  const category = getNoteCategory(note)
                  
                  // Skip if note doesn't belong to any scale
                  if (category === 'none') return null
                  
                  const x = 58 + (fret - 0.5) * 60
                  const isHidden = isPositionHidden(stringIndex, fret)
                  const isRootA = isRootNote(note, keyA) && showScaleA && scaleNotesA.includes(note)
                  const isRootB = isRootNote(note, keyB) && showScaleB && scaleNotesB.includes(note)
                  
                  let fillColor: string
                  let strokeColor: string
                  
                  if (category === 'overlap') {
                    if (isRootA || isRootB) {
                      fillColor = colors.rootOverlap.fill
                      strokeColor = colors.rootOverlap.stroke
                    } else {
                      fillColor = colors.overlap.fill
                      strokeColor = colors.overlap.stroke
                    }
                  } else if (category === 'scaleA') {
                    if (isRootA) {
                      fillColor = colors.rootA.fill
                      strokeColor = colors.rootA.stroke
                    } else {
                      fillColor = colors.scaleA.fill
                      strokeColor = colors.scaleA.stroke
                    }
                  } else {
                    if (isRootB) {
                      fillColor = colors.rootB.fill
                      strokeColor = colors.rootB.stroke
                    } else {
                      fillColor = colors.scaleB.fill
                      strokeColor = colors.scaleB.stroke
                    }
                  }
                  
                  // If hidden, render as ghost note that can be clicked to restore
                  if (isHidden) {
                    return (
                      <g 
                        key={`${stringIndex}-${fret}`}
                        onClick={() => toggleNoteVisibility(stringIndex, fret)}
                        className="clickable-note hidden-note"
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill="transparent"
                          stroke="rgba(255, 255, 255, 0.15)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          style={{ cursor: 'pointer' }}
                        />
                      </g>
                    )
                  }
                  
                  return (
                    <g 
                      key={`${stringIndex}-${fret}`}
                      onClick={() => toggleNoteVisibility(stringIndex, fret)}
                      onMouseDown={(e) => handleNoteMouseDown(e, stringIndex, fret, x, y)}
                      onMouseUp={(e) => handleNoteMouseUp(e, stringIndex, fret, x, y)}
                      className="clickable-note draggable-note"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2"
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
                          {note}
                        </text>
                      )}
                    </g>
                  )
                })
              })}

              {/* Slide connections */}
              {slideConnections.map((slide, index) => (
                <g key={`slide-${index}`} className="slide-connection">
                  <path
                    d={generateSlidePath(slide.from, slide.to)}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.9"
                    className="slide-line-bg"
                  />
                  <path
                    d={generateSlidePath(slide.from, slide.to)}
                    fill="none"
                    stroke="url(#slideGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="8 4"
                    className="slide-line"
                  />
                  {/* Arrowhead */}
                  <circle
                    cx={slide.to.x}
                    cy={slide.to.y}
                    r="16"
                    fill="transparent"
                    stroke="#ffcc00"
                    strokeWidth="2"
                    className="slide-target"
                  />
                  {/* Delete button */}
                  <g 
                    className="slide-delete"
                    onClick={(e) => { e.stopPropagation(); removeSlideConnection(index); }}
                  >
                    <circle
                      cx={(slide.from.x + slide.to.x) / 2}
                      cy={(slide.from.y + slide.to.y) / 2 - 15}
                      r="8"
                      fill="#e74c3c"
                      stroke="#fff"
                      strokeWidth="1"
                    />
                    <text
                      x={(slide.from.x + slide.to.x) / 2}
                      y={(slide.from.y + slide.to.y) / 2 - 11}
                      textAnchor="middle"
                      fontSize="10"
                      fill="white"
                      fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      ×
                    </text>
                  </g>
                </g>
              ))}

              {/* Active drag line */}
              {isDragging && dragStart && dragCurrent && (
                <path
                  d={generateSlidePath(dragStart, dragCurrent)}
                  fill="none"
                  stroke="#ffcc00"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="5 5"
                  opacity="0.7"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Gradient definition for slides */}
              <defs>
                <linearGradient id="slideGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffcc00" />
                  <stop offset="50%" stopColor="#ff9500" />
                  <stop offset="100%" stopColor="#ffcc00" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Legend */}
          <div className="comparison-legend">
            <div className="legend-section">
              <h4 style={{ color: colors.scaleA.fill }}>{keyA} {currentScaleA?.name}</h4>
              <div className="legend-notes">
                {showScaleA && uniqueToA.map(note => (
                  <span key={note} className="legend-note" style={{ background: colors.scaleA.fill }}>
                    {note}
                  </span>
                ))}
                {!showScaleA && <span className="legend-hidden">Hidden</span>}
              </div>
            </div>
            
            <div className="legend-section overlap-section">
              <h4 style={{ color: colors.overlap.fill }}>Overlapping Notes</h4>
              <div className="legend-notes">
                {overlappingNotes.map(note => (
                  <span key={note} className="legend-note" style={{ background: colors.overlap.fill }}>
                    {note}
                  </span>
                ))}
                {overlappingNotes.length === 0 && <span className="legend-none">None</span>}
              </div>
            </div>
            
            <div className="legend-section">
              <h4 style={{ color: colors.scaleB.fill }}>{keyB} {currentScaleB?.name}</h4>
              <div className="legend-notes">
                {showScaleB && uniqueToB.map(note => (
                  <span key={note} className="legend-note" style={{ background: colors.scaleB.fill }}>
                    {note}
                  </span>
                ))}
                {!showScaleB && <span className="legend-hidden">Hidden</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
