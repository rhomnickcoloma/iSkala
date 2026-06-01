'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Bar {
  chords: string[]
}

interface BackingTrackPageProps {
  onClose: () => void
}

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const NOTE_FREQUENCIES: Record<string, number> = {
  'C': 130.81, 'C#': 138.59, 'Db': 138.59,
  'D': 146.83, 'D#': 155.56, 'Eb': 155.56,
  'E': 164.81,
  'F': 174.61, 'F#': 185.00, 'Gb': 185.00,
  'G': 196.00, 'G#': 207.65, 'Ab': 207.65,
  'A': 220.00, 'A#': 233.08, 'Bb': 233.08,
  'B': 246.94,
}

function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) return chord
  const match = chord.match(/^([A-G]#?)(.*)/);
  if (!match) return chord
  const [, root, suffix] = match
  const idx = ALL_NOTES.indexOf(root as typeof ALL_NOTES[number])
  if (idx === -1) return chord
  return ALL_NOTES[(idx + semitones + 12) % 12] + suffix
}

const CHORD_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  'm': [0, 3, 7],
  '7': [0, 4, 7, 10],
  'm7': [0, 3, 7, 10],
  'maj7': [0, 4, 7, 11],
  'dim': [0, 3, 6],
  'dim7': [0, 3, 6, 9],
  'aug': [0, 4, 8],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
}

export default function BackingTrackPage({ onClose }: BackingTrackPageProps) {
  const [selectedKey, setSelectedKey] = useState<string>('A')
  const [numBars, setNumBars] = useState<number>(4)
  const [timeSignature, setTimeSignature] = useState<number>(4)
  const [bpm, setBpm] = useState<number>(120)
  const [bars, setBars] = useState<Bar[]>([])
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentBar, setCurrentBar] = useState<number>(-1)
  const [currentBeat, setCurrentBeat] = useState<number>(-1)
  const [loop, setLoop] = useState<boolean>(true)
  const [drumVolume, setDrumVolume] = useState<number>(0.5)
  const [chordVolume, setChordVolume] = useState<number>(0.4)
  const [playChords, setPlayChords] = useState<boolean>(true)
  const [playDrums, setPlayDrums] = useState<boolean>(true)
  const [doubleKick, setDoubleKick] = useState<boolean>(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const beatIndexRef = useRef<number>(0)
  const activeChordRef = useRef<{ oscillators: OscillatorNode[]; gains: GainNode[]; chord: string } | null>(null)
  const lastChordRef = useRef<string>('')

  const keyIdx = ALL_NOTES.indexOf(selectedKey as typeof ALL_NOTES[number])
  const diatonicIntervals = [0, 2, 4, 5, 7, 9, 11]
  const diatonicQualities = ['', 'm', 'm', '', '', 'm', 'dim']
  const diatonicNotes = diatonicIntervals.map(i => ALL_NOTES[(keyIdx + i) % 12])

  const chordSuggestions = diatonicNotes.flatMap((note, i) => {
    const quality = diatonicQualities[i]
    return [note + quality, note + quality + '7']
  })

  useEffect(() => {
    const newBars: Bar[] = Array.from({ length: numBars }, (_, barIdx) => {
      if (bars[barIdx]) {
        const existing = bars[barIdx].chords
        if (existing.length === timeSignature) return bars[barIdx]
        if (existing.length < timeSignature) {
          return { chords: [...existing, ...Array(timeSignature - existing.length).fill('')] }
        }
        return { chords: existing.slice(0, timeSignature) }
      }
      return { chords: Array(timeSignature).fill('') }
    })
    setBars(newBars)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numBars, timeSignature])

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  const updateChord = (barIndex: number, beatIndex: number, value: string) => {
    setBars(prev => {
      const newBars = [...prev]
      const newChords = [...newBars[barIndex].chords]
      newChords[beatIndex] = value
      newBars[barIndex] = { chords: newChords }
      return newBars
    })
  }

  const getCurrentChord = useCallback(() => {
    if (currentBar < 0 || currentBar >= bars.length) return '—'
    return bars[currentBar]?.chords[currentBeat] || '—'
  }, [currentBar, currentBeat, bars])

  const playChord = useCallback((chordName: string) => {
    if (!playChords || !chordName) return
    const ctx = getAudioContext()
    const match = chordName.match(/^([A-G]#?)(.*)/)
    if (!match) return
    const [, root, quality] = match
    const intervals = CHORD_INTERVALS[quality] || CHORD_INTERVALS['']
    const baseFreq = NOTE_FREQUENCIES[root]
    if (!baseFreq) return

    if (activeChordRef.current && activeChordRef.current.chord !== chordName) {
      activeChordRef.current.gains.forEach(g => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
      })
      setTimeout(() => {
        if (activeChordRef.current) {
          activeChordRef.current.oscillators.forEach(o => { try { o.stop() } catch {} })
          activeChordRef.current = null
        }
      }, 100)
    } else if (activeChordRef.current && activeChordRef.current.chord === chordName) {
      return
    }

    const oscillators: OscillatorNode[] = []
    const gains: GainNode[] = []

    intervals.forEach((interval, i) => {
      const freq = baseFreq * Math.pow(2, interval / 12)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = i === 0 ? 'sawtooth' : 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(chordVolume * (i === 0 ? 0.15 : 0.1), ctx.currentTime + 0.02)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      oscillators.push(osc)
      gains.push(gain)
    })

    activeChordRef.current = { oscillators, gains, chord: chordName }
    lastChordRef.current = chordName
  }, [playChords, chordVolume, getAudioContext])

  const playKick = useCallback(async () => {
    if (!playDrums) return
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(drumVolume * 0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }, [playDrums, drumVolume, getAudioContext])

  const playSnare = useCallback(async () => {
    if (!playDrums) return
    const ctx = getAudioContext()
    const bufferSize = ctx.sampleRate * 0.1
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(drumVolume * 0.25, ctx.currentTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(1000, ctx.currentTime)
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start()
    noise.stop(ctx.currentTime + 0.15)
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05)
    oscGain.gain.setValueAtTime(drumVolume * 0.3, ctx.currentTime)
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  }, [playDrums, drumVolume, getAudioContext])

  const playHiHat = useCallback(async (isOpenHat: boolean = false) => {
    if (!playDrums) return
    const ctx = getAudioContext()
    const bufferSize = ctx.sampleRate * (isOpenHat ? 0.15 : 0.06)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(isOpenHat ? 8000 : 10000, ctx.currentTime)
    filter.Q.setValueAtTime(isOpenHat ? 0.5 : 1, ctx.currentTime)
    const envelope = isOpenHat
      ? { attack: drumVolume * 0.15, decay: 0.2 }
      : { attack: drumVolume * 0.1, decay: 0.05 }
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(drumVolume * (isOpenHat ? 0.18 : 0.12), ctx.currentTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + envelope.decay)
    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start()
    noise.stop(ctx.currentTime + envelope.decay)
  }, [playDrums, drumVolume, getAudioContext])

  const stopAllSounds = useCallback(() => {
    if (activeChordRef.current) {
      const ctx = audioContextRef.current
      if (ctx) {
        activeChordRef.current.gains.forEach(g => {
          g.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
        })
        setTimeout(() => {
          if (activeChordRef.current) {
            activeChordRef.current.oscillators.forEach(o => { try { o.stop() } catch {} })
            activeChordRef.current = null
          }
        }, 100)
      }
    }
    lastChordRef.current = ''
  }, [])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      beatIndexRef.current = 0
      setCurrentBar(-1)
      setCurrentBeat(-1)
      setIsPlaying(false)
      stopAllSounds()
      return
    }

    const hasChords = bars.some(bar => bar.chords.some(c => c.trim()))
    if (!hasChords) return

    getAudioContext()
    setIsPlaying(true)
    beatIndexRef.current = 0

    const totalBeats = numBars * timeSignature
    const msPerBeat = (60 / bpm) * 1000

    const tick = () => {
      const beatIdx = beatIndexRef.current
      const barIdx = Math.floor(beatIdx / timeSignature)
      const beatInBar = beatIdx % timeSignature

      if (barIdx >= numBars) {
        if (loop) {
          beatIndexRef.current = 0
          return
        }
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = null
        setIsPlaying(false)
        setCurrentBar(-1)
        setCurrentBeat(-1)
        stopAllSounds()
        return
      }

      setCurrentBar(barIdx)
      setCurrentBeat(beatInBar)

      const chord = bars[barIdx]?.chords[beatInBar]
      if (chord && chord.trim()) {
        playChord(chord.trim())
      }

      if (beatInBar === 0) {
        playKick()
        playHiHat()
      } else if (beatInBar === Math.floor(timeSignature / 2)) {
        playSnare()
        playHiHat()
      } else {
        playHiHat(beatInBar % 2 === 1)
        if (doubleKick && beatInBar === timeSignature - 1) {
          playKick()
        }
      }

      beatIndexRef.current = (beatIdx + 1) % totalBeats
    }

    tick()
    intervalRef.current = setInterval(tick, msPerBeat)
  }, [isPlaying, bars, numBars, timeSignature, bpm, loop, doubleKick, getAudioContext, playChord, playKick, playSnare, playHiHat, stopAllSounds])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      stopAllSounds()
    }
  }, [stopAllSounds])

  const loadPreset = (chords: string[]) => {
    const semitones = keyIdx
    const transposed = chords.map(c => transposeChord(c, semitones))
    const newBars: Bar[] = transposed.map(chord => ({
      chords: [chord, ...Array(timeSignature - 1).fill('')]
    }))
    setNumBars(newBars.length)
    setBars(newBars)
  }

  const handleClose = () => {
    if (isPlaying) togglePlayback()
    onClose()
  }

  return (
    <div className="backing-track-overlay">
      <div className="backing-track-modal">
        <div className="backing-track-header">
          <h2>🎵 Backing Track Generator</h2>
          <div className="header-buttons">
            <button className="close-btn" onClick={handleClose}>✕</button>
          </div>
        </div>

        <div className="backing-track-controls">
          <div className="control-group">
            <label>Key</label>
            <select
              className="select-input compact"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              disabled={isPlaying}
            >
              {ALL_NOTES.map(note => (
                <option key={note} value={note}>{note}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Bars</label>
            <div className="number-input">
              <button onClick={() => setNumBars(Math.max(1, numBars - 1))} disabled={isPlaying || numBars <= 1}>−</button>
              <span>{numBars}</span>
              <button onClick={() => setNumBars(Math.min(16, numBars + 1))} disabled={isPlaying || numBars >= 16}>+</button>
            </div>
          </div>

          <div className="control-group">
            <label>Time Sig</label>
            <div className="number-input">
              <button onClick={() => setTimeSignature(Math.max(2, timeSignature - 1))} disabled={isPlaying || timeSignature <= 2}>−</button>
              <span>{timeSignature}/4</span>
              <button onClick={() => setTimeSignature(Math.min(7, timeSignature + 1))} disabled={isPlaying || timeSignature >= 7}>+</button>
            </div>
          </div>

          <div className="control-group">
            <label>BPM</label>
            <div className="number-input">
              <button onClick={() => setBpm(Math.max(40, bpm - 5))} disabled={isPlaying}>−</button>
              <span>{bpm}</span>
              <button onClick={() => setBpm(Math.min(240, bpm + 5))} disabled={isPlaying}>+</button>
            </div>
          </div>

          <div className="control-group">
            <label>Loop</label>
            <button
              className={`loop-btn ${loop ? 'active' : ''}`}
              onClick={() => setLoop(!loop)}
            >
              🔁
            </button>
          </div>

          <div className="control-group">
            <label>Sounds</label>
            <div className="drum-controls">
              <button
                className={`sound-toggle-btn ${playChords ? 'active' : ''}`}
                onClick={() => setPlayChords(!playChords)}
                title="Toggle chords"
              >
                🎸
              </button>
              <button
                className={`sound-toggle-btn ${playDrums ? 'active' : ''}`}
                onClick={() => setPlayDrums(!playDrums)}
                title="Toggle drums"
              >
                🥁
              </button>
              <button
                className={`sound-toggle-btn double-kick-btn ${doubleKick ? 'active' : ''}`}
                onClick={() => setDoubleKick(!doubleKick)}
                disabled={!playDrums}
                title="Double kick on last beat"
              >
                2×🦶
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>🎸 Vol</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={chordVolume}
              onChange={(e) => setChordVolume(Number(e.target.value))}
              className="volume-slider"
            />
          </div>

          <div className="control-group">
            <label>🥁 Vol</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={drumVolume}
              onChange={(e) => setDrumVolume(Number(e.target.value))}
              className="volume-slider"
            />
          </div>

          <button
            className={`play-btn large ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlayback}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>
        </div>

        <div className="backing-track-presets">
          <span className="preset-label">Presets:</span>
          <button className="preset-btn" onClick={() => loadPreset(['C', 'G', 'Am', 'F'])} disabled={isPlaying}>I-V-vi-IV</button>
          <button className="preset-btn" onClick={() => loadPreset(['C', 'Am', 'F', 'G'])} disabled={isPlaying}>I-vi-IV-V</button>
          <button className="preset-btn" onClick={() => loadPreset(['Am', 'F', 'C', 'G'])} disabled={isPlaying}>vi-IV-I-V</button>
          <button className="preset-btn" onClick={() => loadPreset(['C', 'F', 'C', 'G7', 'C', 'F', 'C', 'G7', 'F', 'F', 'C', 'C7'])} disabled={isPlaying}>12-Bar Blues</button>
          <button className="preset-btn" onClick={() => loadPreset(['Am', 'Dm', 'G', 'C'])} disabled={isPlaying}>ii-V-I (minor)</button>
          <button
            className="preset-btn clear"
            onClick={() => {
              setBars(Array.from({ length: numBars }, () => ({ chords: Array(timeSignature).fill('') })))
            }}
            disabled={isPlaying}
          >
            Clear All
          </button>
        </div>

        <div className="chord-grid-container">
          <div className="chord-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, numBars)}, 1fr)` }}>
            {bars.map((bar, barIndex) => (
              <div
                key={barIndex}
                className={`bar-container ${currentBar === barIndex ? 'active' : ''}`}
              >
                <div className="bar-header">Bar {barIndex + 1}</div>
                <div className="beat-boxes" style={{ gridTemplateColumns: `repeat(${timeSignature}, 1fr)` }}>
                  {bar.chords.map((chord, beatIndex) => (
                    <div
                      key={beatIndex}
                      className={`beat-box ${currentBar === barIndex && currentBeat === beatIndex ? 'current' : ''} ${beatIndex === 0 ? 'downbeat' : ''}`}
                    >
                      <span className="beat-number">{beatIndex + 1}</span>
                      <input
                        type="text"
                        value={chord}
                        onChange={(e) => updateChord(barIndex, beatIndex, e.target.value)}
                        placeholder="—"
                        className="chord-input"
                        disabled={isPlaying}
                        list={`chords-${barIndex}-${beatIndex}`}
                      />
                      <datalist id={`chords-${barIndex}-${beatIndex}`}>
                        {chordSuggestions.map(c => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isPlaying && currentBar >= 0 && (
          <div className="current-chord-display">
            <span className="current-label">Now Playing:</span>
            <span className="current-chord">{getCurrentChord()}</span>
            <span className="current-position">Bar {currentBar + 1}, Beat {currentBeat + 1}</span>
          </div>
        )}

        <div className="chord-reference">
          <details>
            <summary>Quick Chord Reference</summary>
            <div className="chord-categories">
              <div className="chord-category">
                <h4>Major</h4>
                <div className="chord-list">A, B, C, D, E, F, G</div>
              </div>
              <div className="chord-category">
                <h4>Minor</h4>
                <div className="chord-list">Am, Bm, Cm, Dm, Em, Fm, Gm</div>
              </div>
              <div className="chord-category">
                <h4>7th</h4>
                <div className="chord-list">A7, B7, C7, D7, E7, F7, G7</div>
              </div>
              <div className="chord-category">
                <h4>Minor 7th</h4>
                <div className="chord-list">Am7, Bm7, Cm7, Dm7, Em7, Fm7, Gm7</div>
              </div>
              <div className="chord-category">
                <h4>Major 7th</h4>
                <div className="chord-list">Amaj7, Bmaj7, Cmaj7, Dmaj7, Emaj7, Fmaj7, Gmaj7</div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
