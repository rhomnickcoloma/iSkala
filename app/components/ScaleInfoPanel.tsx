'use client'

interface ScaleInfoPanelProps {
  panelMode: 'none' | 'info' | 'practice'
  scaleNotes: string[]
  currentScale: {
    name: string
    intervals: number[]
    description: string
    practice: string[]
  } | undefined
}

const intervalNames: Record<number, string> = {
  0: '1 (Root)',
  1: '♭2 (Minor 2nd)',
  2: '2 (Major 2nd)',
  3: '♭3 (Minor 3rd)',
  4: '3 (Major 3rd)',
  5: '4 (Perfect 4th)',
  6: '♭5 (Tritone)',
  7: '5 (Perfect 5th)',
  8: '♭6 (Minor 6th)',
  9: '6 (Major 6th)',
  10: '♭7 (Minor 7th)',
  11: '7 (Major 7th)',
}

export default function ScaleInfoPanel({ panelMode, scaleNotes, currentScale }: ScaleInfoPanelProps) {
  if (panelMode === 'none') return null

  return (
    <div className="side-panel">
      {panelMode === 'info' && (
        <>
          <h3>Scale Intervals</h3>
          <div className="interval-list">
            {currentScale?.intervals.map((interval, index) => (
              <div key={index} className="interval-item">
                <span className={`interval-note ${interval === 0 ? 'root' : interval === 6 ? 'blue' : ''}`}>
                  {scaleNotes[index]}
                </span>
                <span className="interval-name">{intervalNames[interval]}</span>
              </div>
            ))}
          </div>
          <div className="scale-formula">
            <h4>Formula</h4>
            <p>{currentScale?.intervals.map(i => intervalNames[i]?.split(' ')[0]).join(' - ')}</p>
          </div>
        </>
      )}
      {panelMode === 'practice' && (
        <>
          <h3>Practice Routine</h3>
          <ul className="practice-list">
            {currentScale?.practice.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
