'use client'

import { fretPositionsForMidi, fretPositionsForPc, midiToNote, wrapPc } from '../../lib/fretpilot/theory'
import type { DetectedNote, LivePitch } from '../../lib/fretpilot/types'

const FRET_W = 52
const NUT = 18
const LEFT = 44
const TOP = 22
const STRING_H = 26
const FRETS = 15
const INLAYS = [3, 5, 7, 9, 12, 15]

interface Props {
  tuningMidi: number[]
  stringNames: string[]
  live: LivePitch | null
  phrase: DetectedNote[]
  chordTonePcs: number[]
  rootPc: number | null
  onTap: (midi: number) => void
}

export default function LiveFretboard({
  tuningMidi,
  stringNames,
  live,
  phrase,
  chordTonePcs,
  rootPc,
  onTap,
}: Props) {
  const strings = tuningMidi.length
  const width = LEFT + NUT + FRETS * FRET_W + 16
  const height = TOP + strings * STRING_H + 28
  const liveSpots = live ? fretPositionsForMidi(live.midi, tuningMidi, FRETS) : []
  const livePcSpots = live ? fretPositionsForPc(live.midi, tuningMidi, FRETS) : []
  const phraseMidis = new Set(phrase.map(n => n.midi))
  const phrasePcs = new Set(phrase.map(n => wrapPc(n.midi)))
  const toneSet = new Set(chordTonePcs.map(wrapPc))

  const yFor = (stringIndex: number) => TOP + (strings - 1 - stringIndex) * STRING_H + STRING_H / 2
  const xFor = (fret: number) => (fret === 0 ? LEFT + NUT / 2 : LEFT + NUT + (fret - 0.5) * FRET_W)

  return (
    <div className="fp-fret-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="fp-fretboard" role="img" aria-label="Guitar fretboard">
        <defs>
          <pattern id="fp-wood" patternUnits="userSpaceOnUse" width="80" height="80">
            <rect width="80" height="80" fill="#2a1810" />
            <path d="M0 12h80M0 31h80M0 48h80M0 67h80" stroke="#3a2418" strokeWidth="3" opacity="0.5" />
          </pattern>
        </defs>
        <rect x={LEFT} y={TOP - 8} width={NUT + FRETS * FRET_W} height={strings * STRING_H + 4} rx="4" fill="url(#fp-wood)" />
        <rect x={LEFT} y={TOP - 8} width={NUT} height={strings * STRING_H + 4} fill="#d8d4cc" />
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <line
            key={`f${i}`}
            x1={LEFT + NUT + i * FRET_W}
            y1={TOP - 8}
            x2={LEFT + NUT + i * FRET_W}
            y2={TOP + strings * STRING_H - 4}
            stroke={i === 0 ? '#f2f0ea' : '#c5c0b4'}
            strokeWidth={i === 0 ? 5 : i === 12 ? 3 : 1.5}
          />
        ))}
        {INLAYS.map(fret => {
          const cx = LEFT + NUT + (fret - 0.5) * FRET_W
          const mid = TOP + (strings * STRING_H) / 2 - 6
          if (fret === 12) {
            return (
              <g key={`i${fret}`}>
                <circle cx={cx} cy={mid - 18} r="5" fill="rgba(255,255,255,0.18)" />
                <circle cx={cx} cy={mid + 18} r="5" fill="rgba(255,255,255,0.18)" />
              </g>
            )
          }
          return <circle key={`i${fret}`} cx={cx} cy={mid} r="5" fill="rgba(255,255,255,0.16)" />
        })}
        {tuningMidi.map((_, stringIndex) => (
          <line
            key={`s${stringIndex}`}
            x1={LEFT}
            y1={yFor(stringIndex)}
            x2={LEFT + NUT + FRETS * FRET_W}
            y2={yFor(stringIndex)}
            stroke="#d0c6b0"
            strokeWidth={1 + (strings - 1 - stringIndex) * 0.35}
          />
        ))}
        {stringNames.map((name, stringIndex) => (
          <text key={`n${stringIndex}`} x={LEFT - 10} y={yFor(stringIndex) + 4} className="fp-open-label" textAnchor="end">
            {name}
          </text>
        ))}
        {Array.from({ length: FRETS }, (_, i) => (
          <text key={`fn${i + 1}`} x={LEFT + NUT + (i + 0.5) * FRET_W} y={height - 8} className="fp-fret-num" textAnchor="middle">
            {i + 1}
          </text>
        ))}

        {livePcSpots.map(spot => {
          if (liveSpots.some(s => s.stringIndex === spot.stringIndex && s.fret === spot.fret)) return null
          return (
            <circle
              key={`pc-${spot.stringIndex}-${spot.fret}`}
              cx={xFor(spot.fret)}
              cy={yFor(spot.stringIndex)}
              r="9"
              fill="rgba(46, 204, 113, 0.18)"
              stroke="rgba(46, 204, 113, 0.45)"
            />
          )
        })}

        {tuningMidi.map((open, stringIndex) =>
          Array.from({ length: FRETS + 1 }, (_, fret) => {
            const midi = open + fret
            const pc = wrapPc(midi)
            const isLive = liveSpots.some(s => s.stringIndex === stringIndex && s.fret === fret)
            const inPhrase = phraseMidis.has(midi) || (phrasePcs.has(pc) && fret === 0 && phrase.some(n => wrapPc(n.midi) === pc && Math.abs(n.midi - midi) <= 12))
            const isRoot = rootPc !== null && pc === wrapPc(rootPc)
            const isTone = toneSet.has(pc)
            let fill = 'transparent'
            let stroke = 'transparent'
            let label = ''
            if (isLive) {
              fill = '#2ecc71'
              stroke = '#b7f7d0'
              label = live?.name ?? midiToNote(midi).name
            } else if (inPhrase) {
              fill = isRoot ? '#e74c3c' : isTone ? '#5dade2' : '#f5b041'
              stroke = '#fff'
              label = midiToNote(midi).name
            } else if (isRoot) {
              fill = 'rgba(231, 76, 60, 0.22)'
              stroke = 'rgba(231, 76, 60, 0.7)'
            } else if (isTone) {
              fill = 'rgba(93, 173, 226, 0.18)'
              stroke = 'rgba(93, 173, 226, 0.55)'
            }
            return (
              <g key={`c-${stringIndex}-${fret}`} className="fp-fret-hit" onClick={() => onTap(midi)}>
                <rect
                  x={fret === 0 ? LEFT : LEFT + NUT + (fret - 1) * FRET_W}
                  y={yFor(stringIndex) - STRING_H / 2}
                  width={fret === 0 ? NUT : FRET_W}
                  height={STRING_H}
                  fill="transparent"
                />
                {fill !== 'transparent' && (
                  <>
                    <circle cx={xFor(fret)} cy={yFor(stringIndex)} r={isLive ? 11 : 9} fill={fill} stroke={stroke} strokeWidth="1.5" />
                    {label && (
                      <text x={xFor(fret)} y={yFor(stringIndex) + 4} textAnchor="middle" className="fp-dot-label">
                        {label}
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          }),
        )}
      </svg>
      <p className="fp-fret-hint">Tap a fret to add a note to the phrase. Green = live estimate (monophonic). Red = root, blue = chord tone, amber = other phrase notes.</p>
    </div>
  )
}
