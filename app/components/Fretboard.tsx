'use client'

import { useState, useRef, useCallback } from 'react'
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
import ProgressionView from './ProgressionView'
import Tuner from './Tuner'

const DEFAULT_FRET_COUNT = 15
const STRING_COUNT = 6
// Fret width in SVG units; increase for overlay on real guitar (e.g. 72–80)
const FRET_WIDTH = 72

type DisplayMode = 'notes' | 'intervals' | 'none'
type LabelRotation = 0 | 180
type PanelMode = 'none' | 'info' | 'practice'
type PatternMode = 'full' | '3nps' | 'caged' | 'diagonal'
type DiagonalType = 'pentatonic' | 'major' | 'minor'

interface SlideConnection {
  from: { stringIndex: number; fret: number; x: number; y: number }
  to: { stringIndex: number; fret: number; x: number; y: number }
}

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
  const [labelRotation, setLabelRotation] = useState<LabelRotation>(0)
  const [panelMode, setPanelMode] = useState<PanelMode>('info')
  const [patternMode, setPatternMode] = useState<PatternMode>('full')
  const [selectedPosition, setSelectedPosition] = useState<number>(1)
  const [diagonalType, setDiagonalType] = useState<DiagonalType>('pentatonic')
  const [diagonalDirection, setDiagonalDirection] = useState<'ascending' | 'descending'>('ascending')
  const [showComparison, setShowComparison] = useState<boolean>(false)
  const [showProgression, setShowProgression] = useState<boolean>(false)
  const [showTuner, setShowTuner] = useState<boolean>(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false)
  const [startFret, setStartFret] = useState<number>(1)
  const [endFret, setEndFret] = useState<number>(15)
  
  // Hidden notes state (for click-to-hide feature)
  const [hiddenPositions, setHiddenPositions] = useState<Set<string>>(new Set())
  // Outside notes (added by clicking empty fret positions)
  const [addedOutsideNotes, setAddedOutsideNotes] = useState<Set<string>>(new Set())
  
  // Slide connections state (for drag-to-connect feature)
  const [slideConnections, setSlideConnections] = useState<SlideConnection[]>([])
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ stringIndex: number; fret: number; x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  const fretboardSvgRef = useRef<SVGSVGElement>(null)
  const justDidConnectionDropRef = useRef(false)

  const scaleNotes = getScaleNotes(selectedKey, selectedScale)
  const currentScale = SCALES[selectedScale]
  const fretCount = Math.max(1, endFret - startFret + 1)

  // Toggle note visibility on click (only if not dragging)
  const toggleNoteVisibility = (stringIndex: number, fret: number) => {
    if (isDragging) return
    if (justDidConnectionDropRef.current) {
      justDidConnectionDropRef.current = false
      return
    }
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

  // Toggle outside note at empty position (add or remove)
  const toggleOutsideNote = (stringIndex: number, fret: number) => {
    if (isDragging) return
    if (justDidConnectionDropRef.current) {
      justDidConnectionDropRef.current = false
      return
    }
    const key = `${stringIndex}-${fret}`
    setAddedOutsideNotes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const clearOutsideNotes = () => {
    setAddedOutsideNotes(new Set())
  }

  // Get SVG coordinates from mouse event
  const getSVGCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!fretboardSvgRef.current) return null
    const svg = fretboardSvgRef.current
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
      justDidConnectionDropRef.current = true
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

  // Generate straight line path between two points
  const generateSlidePath = (from: { x: number; y: number }, to: { x: number; y: number }): string => {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }

  // Download fretboard as PNG with transparent background
  const downloadFretboardPNG = useCallback(() => {
    if (!fretboardSvgRef.current) return

    const svg = fretboardSvgRef.current
    const svgData = new XMLSerializer().serializeToString(svg)
    
    // Create a modified SVG with transparent background
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml')
    const svgElement = svgDoc.documentElement
    
    // Find and modify the background rect to be transparent
    const bgRect = svgElement.querySelector('rect')
    if (bgRect && bgRect.getAttribute('fill') === '#111') {
      bgRect.setAttribute('fill', 'transparent')
    }
    
    // Also hide the fretboard wood, nut, strings, fret markers, fret numbers, string labels for clean overlay
    // Only keep the scale note circles and their labels
    const modifiedSvgData = new XMLSerializer().serializeToString(svgElement)
    
    // Create a blob from the SVG
    const svgBlob = new Blob([modifiedSvgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    
    // Create an image element
    const img = new Image()
    img.onload = () => {
      // Create canvas with 2x resolution for crisp output
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = svg.viewBox.baseVal.width * scale
      canvas.height = svg.viewBox.baseVal.height * scale
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // Scale for higher resolution
      ctx.scale(scale, scale)
      
      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0)
      
      // Convert to PNG and download
      canvas.toBlob((blob) => {
        if (!blob) return
        
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${selectedKey}-${currentScale?.name.replace(/\s+/g, '-').toLowerCase()}-fretboard.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Cleanup
        URL.revokeObjectURL(downloadUrl)
      }, 'image/png')
      
      URL.revokeObjectURL(url)
    }
    
    img.src = url
  }, [selectedKey, currentScale])

  // Download dots only: scale notes, outside notes, slide lines; labels keep rotation; transparent background
  const downloadDotsOnlyPNG = useCallback(() => {
    if (!fretboardSvgRef.current) return

    const svg = fretboardSvgRef.current
    const viewBox = svg.viewBox.baseVal
    
    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    newSvg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`)
    newSvg.setAttribute('width', String(viewBox.width))
    newSvg.setAttribute('height', String(viewBox.height))
    
    // Copy scale notes and outside notes (preserves transform/rotation on labels); exclude hidden and empty-slot
    const noteGroups = svg.querySelectorAll('g.clickable-note:not(.hidden-note):not(.empty-slot)')
    noteGroups.forEach((group) => {
      const clone = group.cloneNode(true) as Element
      newSvg.appendChild(clone)
    })
    
    // Copy slide connections (green outlines and lines; remove delete buttons)
    const slideConnections = svg.querySelectorAll('g.slide-connection')
    slideConnections.forEach((group) => {
      const clone = group.cloneNode(true) as Element
      // Remove the delete button from the clone
      const deleteBtn = clone.querySelector('.slide-delete')
      if (deleteBtn) {
        deleteBtn.remove()
      }
      newSvg.appendChild(clone)
    })
    
    const svgData = new XMLSerializer().serializeToString(newSvg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = viewBox.width * scale
      canvas.height = viewBox.height * scale
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      
      canvas.toBlob((blob) => {
        if (!blob) return
        
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${selectedKey}-${currentScale?.name.replace(/\s+/g, '-').toLowerCase()}-dots-overlay.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        URL.revokeObjectURL(downloadUrl)
      }, 'image/png')
      
      URL.revokeObjectURL(url)
    }
    
    img.src = url
  }, [selectedKey, currentScale])

  // Download with fretboard: dots + frets, strings, nut, fret markers, and root fret numbers
  const downloadWithFretboardPNG = useCallback(() => {
    if (!fretboardSvgRef.current) return

    const svg = fretboardSvgRef.current
    const viewBox = svg.viewBox.baseVal

    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    newSvg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`)
    newSvg.setAttribute('width', String(viewBox.width))
    newSvg.setAttribute('height', String(viewBox.height))

    // Draw nut if starting from fret 1
    if (startFret === 1) {
      const nut = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      nut.setAttribute('x', '50')
      nut.setAttribute('y', '20')
      nut.setAttribute('width', '8')
      nut.setAttribute('height', String(STRING_COUNT * 30))
      nut.setAttribute('fill', '#f5f5dc')
      nut.setAttribute('rx', '2')
      newSvg.appendChild(nut)
    }

    // Draw fret markers (dots)
    ;[3, 5, 7, 9, 12, 15, 17, 19, 21, 24].forEach(fret => {
      if (fret < startFret || fret > endFret) return
      const mx = 58 + (fret - startFret + 0.5) * FRET_WIDTH
      const my = 20 + (STRING_COUNT * 30) / 2
      if (fret === 12 || fret === 24) {
        const d1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        d1.setAttribute('cx', String(mx)); d1.setAttribute('cy', String(my - 30))
        d1.setAttribute('r', '8'); d1.setAttribute('fill', '#1a1a1a'); d1.setAttribute('opacity', '0.8')
        newSvg.appendChild(d1)
        const d2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        d2.setAttribute('cx', String(mx)); d2.setAttribute('cy', String(my + 30))
        d2.setAttribute('r', '8'); d2.setAttribute('fill', '#1a1a1a'); d2.setAttribute('opacity', '0.8')
        newSvg.appendChild(d2)
      } else {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', String(mx)); dot.setAttribute('cy', String(my))
        dot.setAttribute('r', '8'); dot.setAttribute('fill', '#1a1a1a'); dot.setAttribute('opacity', '0.8')
        newSvg.appendChild(dot)
      }
    })

    // Draw frets
    for (let i = 0; i <= fretCount; i++) {
      const fretLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      fretLine.setAttribute('x1', String(58 + i * FRET_WIDTH))
      fretLine.setAttribute('y1', '20')
      fretLine.setAttribute('x2', String(58 + i * FRET_WIDTH))
      fretLine.setAttribute('y2', String(20 + STRING_COUNT * 30))
      fretLine.setAttribute('stroke', '#c0c0c0')
      fretLine.setAttribute('stroke-width', i === 0 ? '4' : '2')
      newSvg.appendChild(fretLine)
    }

    // Draw strings
    STANDARD_TUNING.slice().reverse().forEach((_, stringIndex) => {
      const sy = 35 + stringIndex * 30
      const thickness = 1 + stringIndex * 0.4
      const stringStartX = startFret === 1 ? 50 : 58
      const stringLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      stringLine.setAttribute('x1', String(stringStartX))
      stringLine.setAttribute('y1', String(sy))
      stringLine.setAttribute('x2', String(58 + fretCount * FRET_WIDTH))
      stringLine.setAttribute('y2', String(sy))
      stringLine.setAttribute('stroke', '#d4d4d4')
      stringLine.setAttribute('stroke-width', String(thickness))
      newSvg.appendChild(stringLine)
    })

    // Draw fret numbers
    for (let i = 0; i < fretCount; i++) {
      const fretNum = startFret + i
      const tx = 58 + (i + 0.5) * FRET_WIDTH
      const ty = STRING_COUNT * 30 + 50

      const fretText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      fretText.setAttribute('x', String(tx))
      fretText.setAttribute('y', String(ty))
      fretText.setAttribute('text-anchor', 'middle')
      fretText.setAttribute('font-size', '12')
      fretText.setAttribute('fill', '#666')
      fretText.setAttribute('font-family', 'system-ui, sans-serif')
      fretText.textContent = String(fretNum)
      newSvg.appendChild(fretText)
    }

    // Copy scale notes and outside notes
    const noteGroups = svg.querySelectorAll('g.clickable-note:not(.hidden-note):not(.empty-slot)')
    noteGroups.forEach((group) => {
      newSvg.appendChild(group.cloneNode(true) as Element)
    })

    // Copy slide connections
    const slides = svg.querySelectorAll('g.slide-connection')
    slides.forEach((group) => {
      const clone = group.cloneNode(true) as Element
      const deleteBtn = clone.querySelector('.slide-delete')
      if (deleteBtn) deleteBtn.remove()
      newSvg.appendChild(clone)
    })

    const svgData = new XMLSerializer().serializeToString(newSvg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = viewBox.width * scale
      canvas.height = viewBox.height * scale

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)

      canvas.toBlob((blob) => {
        if (!blob) return

        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${selectedKey}-${currentScale?.name.replace(/\s+/g, '-').toLowerCase()}-fretboard-full.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(downloadUrl)
      }, 'image/png')

      URL.revokeObjectURL(url)
    }

    img.src = url
  }, [selectedKey, currentScale, startFret, endFret, fretCount])

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
            className="select-input scale-select-prominent"
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
            {displayMode !== 'none' && (
              <div className="label-rotation-buttons" title="Rotate note labels">
                <button
                  className={`rotation-btn ${labelRotation === 0 ? 'active' : ''}`}
                  onClick={() => setLabelRotation(0)}
                  aria-label="Labels normal"
                >
                  0°
                </button>
                <button
                  className={`rotation-btn ${labelRotation === 180 ? 'active' : ''}`}
                  onClick={() => setLabelRotation(180)}
                  aria-label="Labels rotated 180°"
                >
                  180°
                </button>
              </div>
            )}
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
            {/* Justice scale icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="11" y="3" width="2" height="18" rx="1"/>
              <rect x="6" y="20" width="12" height="2" rx="1"/>
              <rect x="4" y="5" width="16" height="2" rx="1"/>
              <path d="M4 7l-2 7h8L8 7H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M16 7l-2 7h8l-2-7h-4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M0 14a4 4 0 0 0 8 0H0zM14 14a4 4 0 0 0 8 0h-8z"/>
            </svg>
          </button>
          <button 
            className="panel-btn progression-btn"
            onClick={() => setShowProgression(true)}
            title="Progression View (V7 Scales)"
          >
            {/* Chord progression / roman numerals icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8v8l-6 3.5L6 16V8l6-3.5z"/>
              <text x="12" y="14" fontSize="7" textAnchor="middle" fontWeight="bold">V</text>
            </svg>
          </button>
          <button 
            className="panel-btn tuner-btn"
            onClick={() => setShowTuner(true)}
            title="Tuner"
          >
            {/* Tuning fork Y icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 2l5 8M17 2l-5 8M12 10v12"/>
            </svg>
          </button>
          <div className="download-dropdown-wrapper">
            <button 
              className="panel-btn download-btn"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              title="Download Fretboard as PNG"
            >
              {/* Download icon */}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
            {showDownloadMenu && (
              <>
                <div className="download-dropdown-backdrop" onClick={() => setShowDownloadMenu(false)} />
                <div className="download-dropdown">
                  <button
                    className="download-option"
                    onClick={() => { downloadDotsOnlyPNG(); setShowDownloadMenu(false); }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="download-option-icon">
                      <circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><circle cx="8" cy="16" r="3" /><circle cx="16" cy="16" r="3" />
                    </svg>
                    <div className="download-option-text">
                      <span className="download-option-title">Dots Only</span>
                      <span className="download-option-desc">Transparent overlay for video</span>
                    </div>
                  </button>
                  <button
                    className="download-option"
                    onClick={() => { downloadWithFretboardPNG(); setShowDownloadMenu(false); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="download-option-icon">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="13" x2="21" y2="13" /><line x1="3" y1="18" x2="21" y2="18" />
                      <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                    <div className="download-option-text">
                      <span className="download-option-title">With Fretboard</span>
                      <span className="download-option-desc">Frets, strings & root fret numbers</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
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

        <div className="start-fret-selector">
          <label htmlFor="start-fret">Frets:</label>
          <input
            id="start-fret"
            type="number"
            min={1}
            max={24}
            value={startFret}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') return
              const n = parseInt(v, 10)
              if (!isNaN(n)) {
                const clamped = Math.max(1, Math.min(24, n))
                setStartFret(clamped)
                if (clamped > endFret) setEndFret(clamped)
              }
            }}
            onBlur={(e) => {
              const v = e.target.value
              if (v === '' || isNaN(parseInt(v, 10))) setStartFret(1)
            }}
            className="start-fret-input"
          />
          <span className="start-fret-range">→</span>
          <input
            id="end-fret"
            type="number"
            min={1}
            max={24}
            value={endFret}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') return
              const n = parseInt(v, 10)
              if (!isNaN(n)) {
                const clamped = Math.max(1, Math.min(24, n))
                setEndFret(clamped)
                if (clamped < startFret) setStartFret(clamped)
              }
            }}
            onBlur={(e) => {
              const v = e.target.value
              if (v === '' || isNaN(parseInt(v, 10))) setEndFret(startFret + DEFAULT_FRET_COUNT - 1)
            }}
            className="start-fret-input"
          />
        </div>
      </div>

      <div className="fretboard-main">
        {/* Fretboard SVG */}
        <div className="fretboard-wrapper">
        <svg 
          ref={fretboardSvgRef}
          viewBox={`0 0 ${fretCount * FRET_WIDTH + 80} ${STRING_COUNT * 30 + 60}`} 
          className={`fretboard-svg ${isDragging ? 'dragging' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Background */}
          <rect 
            x="0" 
            y="0" 
            width={fretCount * FRET_WIDTH + 80} 
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
            const adjustedMax = Math.min(24, maxFret + positionOffset)
            const visibleMin = Math.max(adjustedMin, startFret)
            const visibleMax = Math.min(adjustedMax, endFret)
            if (visibleMin > visibleMax) return null
            
            const x = 58 + (visibleMin - startFret) * FRET_WIDTH
            const width = (visibleMax - visibleMin + 1) * FRET_WIDTH
            
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

          {/* Nut (only when showing from fret 1) */}
          {startFret === 1 && (
            <rect x="50" y="20" width="8" height={STRING_COUNT * 30} fill="#f5f5dc" rx="2"/>
          )}

          {/* Fretboard wood */}
          <rect 
            x="58" 
            y="20" 
            width={fretCount * FRET_WIDTH} 
            height={STRING_COUNT * 30} 
            fill="#5D4037"
            rx="4"
          />

          {/* Fret markers (dots) */}
          {[3, 5, 7, 9, 12, 15, 17, 19, 21, 24].map(fret => {
            if (fret < startFret || fret > endFret) return null
            const x = 58 + (fret - startFret + 0.5) * FRET_WIDTH
            const y = 20 + (STRING_COUNT * 30) / 2
            
            if (fret === 12 || fret === 24) {
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
          {Array.from({ length: fretCount + 1 }, (_, i) => (
            <line
              key={i}
              x1={58 + i * FRET_WIDTH}
              y1="20"
              x2={58 + i * FRET_WIDTH}
              y2={20 + STRING_COUNT * 30}
              stroke="#c0c0c0"
              strokeWidth={i === 0 ? 4 : 2}
            />
          ))}

          {/* Strings */}
          {STANDARD_TUNING.slice().reverse().map((_, stringIndex) => {
            const y = 35 + stringIndex * 30
            const thickness = 1 + stringIndex * 0.4
            const stringStartX = startFret === 1 ? 50 : 58
            return (
              <line
                key={stringIndex}
                x1={stringStartX}
                y1={y}
                x2={58 + fretCount * FRET_WIDTH}
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
          {Array.from({ length: fretCount }, (_, i) => (
            <text
              key={i}
              x={58 + (i + 0.5) * FRET_WIDTH}
              y={STRING_COUNT * 30 + 50}
              textAnchor="middle"
              fontSize="12"
              fill="#666"
              fontFamily="system-ui, sans-serif"
            >
              {startFret + i}
            </text>
          ))}

          {/* Active drag preview (behind notes) */}
          {isDragging && dragStart && dragCurrent && (() => {
            const dx = dragCurrent.x - dragStart.x
            const dy = dragCurrent.y - dragStart.y
            const angle = Math.atan2(dy, dx)
            const radius = 14
            const startX = dragStart.x + Math.cos(angle) * radius
            const startY = dragStart.y + Math.sin(angle) * radius
            
            return (
              <>
                {/* Green outline on starting note */}
                <circle
                  cx={dragStart.x}
                  cy={dragStart.y}
                  r="15"
                  fill="none"
                  stroke="#2ecc71"
                  strokeWidth="3"
                  opacity="0.8"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Drag line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={dragCurrent.x}
                  y2={dragCurrent.y}
                  stroke="#2ecc71"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="8 8"
                  opacity="0.8"
                  style={{ pointerEvents: 'none' }}
                />
              </>
            )
          })()}

          {/* Scale notes and outside notes on fretboard */}
          {STANDARD_TUNING.slice().reverse().map((openNote, stringIndex) => {
            const y = 35 + stringIndex * 30
            
            return Array.from({ length: fretCount }, (_, i) => {
              const fret = startFret + i
              const note = getNoteAtFret(openNote, fret)
              const x = 58 + (i + 0.5) * FRET_WIDTH
              const isScaleNote = scaleNotes.includes(note)
              const outsideKey = `${stringIndex}-${fret}`
              const isOutsideNote = addedOutsideNotes.has(outsideKey)
              
              // Empty position: click to add outside note, or show added outside note
              if (!isScaleNote) {
                if (isOutsideNote) {
                  return (
                    <g
                      key={outsideKey}
                      onClick={() => toggleOutsideNote(stringIndex, fret)}
                      onMouseDown={(e) => handleNoteMouseDown(e, stringIndex, fret, x, y)}
                      onMouseUp={(e) => handleNoteMouseUp(e, stringIndex, fret, x, y)}
                      className="clickable-note outside-note draggable-note"
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        fill="transparent"
                        stroke="#e67e22"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      {displayMode !== 'none' && (
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#e67e22"
                          fontFamily="system-ui, sans-serif"
                          style={{ pointerEvents: 'none' }}
                          transform={labelRotation !== 0 ? `rotate(${labelRotation} ${x} ${y})` : undefined}
                        >
                          {note}
                        </text>
                      )}
                    </g>
                  )
                }
                return (
                  <g
                    key={outsideKey}
                    onClick={() => toggleOutsideNote(stringIndex, fret)}
                    className="clickable-note empty-slot"
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r="12"
                      fill="rgba(255, 255, 255, 0.06)"
                      stroke="transparent"
                      strokeWidth="0"
                    />
                  </g>
                )
              }
              
              // Scale note
              const inPattern = isInPattern(fret, stringIndex)
              const isRoot = isRootNote(note, selectedKey)
              const isBlue = isBlueNote(note, selectedKey, selectedScale)
              const hidden = isPositionHidden(stringIndex, fret)
              const intervalLabel = getIntervalName(note, selectedKey, selectedScale)
              const displayText = displayMode === 'notes' ? note : displayMode === 'intervals' ? intervalLabel : ''
              const opacity = inPattern ? 1 : 0.25
              const fillColor = isRoot ? '#c0392b' : isBlue ? '#2980b9' : '#5a5a5a'
              const strokeColor = isRoot ? '#e74c3c' : isBlue ? '#3498db' : '#bbb'
              
              if (hidden) {
                return (
                  <g 
                    key={`${stringIndex}-${fret}`} 
                    opacity={opacity * 0.5}
                    onClick={() => toggleNoteVisibility(stringIndex, fret)}
                    className="clickable-note hidden-note"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r="12"
                      fill="transparent"
                      stroke="rgba(255, 255, 255, 0.2)"
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
                  opacity={opacity}
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
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="10"
                      fontWeight="bold"
                      fill="white"
                      fontFamily="system-ui, sans-serif"
                      style={{ pointerEvents: 'none' }}
                      transform={labelRotation !== 0 ? `rotate(${labelRotation} ${x} ${y})` : undefined}
                    >
                      {displayText}
                    </text>
                  )}
                </g>
              )
            })
          })}

          {/* Slide connections with green outlines (rendered on top of notes) */}
          {slideConnections.map((slide, index) => {
            // Calculate angle between points for connecting to edge of circles
            const dx = slide.to.x - slide.from.x
            const dy = slide.to.y - slide.from.y
            const angle = Math.atan2(dy, dx)
            const radius = 14 // slightly outside the note circle (12) + stroke
            
            // Start and end points at the edge of circles
            const startX = slide.from.x + Math.cos(angle) * radius
            const startY = slide.from.y + Math.sin(angle) * radius
            const endX = slide.to.x - Math.cos(angle) * radius
            const endY = slide.to.y - Math.sin(angle) * radius
            
            return (
              <g key={`slide-${index}`} className="slide-connection">
                {/* Green outline on source note */}
                <circle
                  cx={slide.from.x}
                  cy={slide.from.y}
                  r="15"
                  fill="none"
                  stroke="#2ecc71"
                  strokeWidth="3"
                />
                {/* Green outline on destination note */}
                <circle
                  cx={slide.to.x}
                  cy={slide.to.y}
                  r="15"
                  fill="none"
                  stroke="#2ecc71"
                  strokeWidth="3"
                />
                {/* Green connector line between outlines */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#2ecc71"
                  strokeWidth="4"
                  strokeLinecap="round"
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
            )
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
            <div className="legend-item">
              <span className="legend-dot outside"></span>
              <span>Click empty = outside note</span>
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
            {slideConnections.length > 0 && (
              <button 
                className="clear-slides-btn"
                onClick={clearAllSlides}
                title="Clear all slide indicators"
              >
                ✕ Slides ({slideConnections.length})
              </button>
            )}
            {addedOutsideNotes.size > 0 && (
              <button 
                className="clear-outside-btn"
                onClick={clearOutsideNotes}
                title="Clear all outside notes"
              >
                ✕ Outside ({addedOutsideNotes.size})
              </button>
            )}
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

      {/* Progression View Modal */}
      {showProgression && (
        <ProgressionView onClose={() => setShowProgression(false)} />
      )}

      {/* Tuner Modal */}
      {showTuner && (
        <Tuner onClose={() => setShowTuner(false)} />
      )}
    </div>
  )
}
