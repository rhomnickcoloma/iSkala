'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Bar {
  chords: string[] // One chord per beat
}

// Note frequencies for chord generation
const NOTE_FREQUENCIES: Record<string, number> = {
  'C': 130.81, 'C#': 138.59, 'Db': 138.59,
  'D': 146.83, 'D#': 155.56, 'Eb': 155.56,
  'E': 164.81,
  'F': 174.61, 'F#': 185.00, 'Gb': 185.00,
  'G': 196.00, 'G#': 207.65, 'Ab': 207.65,
  'A': 220.00, 'A#': 233.08, 'Bb': 233.08,
  'B': 246.94,
}

// Chord intervals (semitones from root)
const CHORD_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],           // Major
  'm': [0, 3, 7],          // Minor
  '7': [0, 4, 7, 10],      // Dominant 7th
  'm7': [0, 3, 7, 10],     // Minor 7th
  'maj7': [0, 4, 7, 11],   // Major 7th
  'dim': [0, 3, 6],        // Diminished
  'aug': [0, 4, 8],        // Augmented
  'sus4': [0, 5, 7],       // Suspended 4th
  'sus2': [0, 2, 7],       // Suspended 2nd
}

export default function BackingTrackGenerator() {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isMinimized, setIsMinimized] = useState<boolean>(false)
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

  // Common chord suggestions
  const chordSuggestions = [
    'A', 'Am', 'A7', 'Am7', 'Amaj7',
    'B', 'Bm', 'B7', 'Bm7', 'Bmaj7',
    'C', 'Cm', 'C7', 'Cm7', 'Cmaj7',
    'D', 'Dm', 'D7', 'Dm7', 'Dmaj7',
    'E', 'Em', 'E7', 'Em7', 'Emaj7',
    'F', 'Fm', 'F7', 'Fm7', 'Fmaj7',
    'G', 'Gm', 'G7', 'Gm7', 'Gmaj7',
  ]

  // Initialize or resume AudioContext
  const getAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }
    
    return audioContextRef.current
  }, [])

  // Initialize bars when numBars or timeSignature changes
  useEffect(() => {
    setBars(prev => {
      const newBars: Bar[] = []
      for (let i = 0; i < numBars; i++) {
        const existingBar = prev[i]
        const chords: string[] = []
        for (let j = 0; j < timeSignature; j++) {
          chords.push(existingBar?.chords?.[j] || '')
        }
        newBars.push({ chords })
      }
      return newBars
    })
  }, [numBars, timeSignature])

  // Parse chord name to get root and type
  const parseChord = (chordName: string): { root: string; type: string } | null => {
    if (!chordName) return null
    
    const match = chordName.match(/^([A-G][#b]?)(m7|maj7|m|7|dim|aug|sus4|sus2)?$/)
    if (!match) return null
    
    return {
      root: match[1],
      type: match[2] || ''
    }
  }

  // Get frequencies for a chord
  const getChordFrequencies = (chordName: string): number[] => {
    const parsed = parseChord(chordName)
    if (!parsed) return []
    
    const rootFreq = NOTE_FREQUENCIES[parsed.root]
    if (!rootFreq) return []
    
    const intervals = CHORD_INTERVALS[parsed.type] || CHORD_INTERVALS['']
    
    return intervals.map(semitones => {
      return rootFreq * Math.pow(2, semitones / 12)
    })
  }

  // Play kick drum - acoustic style
  const playKick = useCallback(async () => {
    const ctx = await getAudioContext()
    const now = ctx.currentTime
    
    // Main kick body - deep sine wave with pitch drop
    const body = ctx.createOscillator()
    const bodyGain = ctx.createGain()
    const bodyFilter = ctx.createBiquadFilter()
    
    body.connect(bodyFilter)
    bodyFilter.connect(bodyGain)
    bodyGain.connect(ctx.destination)
    
    body.frequency.setValueAtTime(120, now)
    body.frequency.exponentialRampToValueAtTime(45, now + 0.12)
    body.type = 'sine'
    
    bodyFilter.type = 'lowpass'
    bodyFilter.frequency.value = 200
    
    // Soft attack for acoustic feel
    bodyGain.gain.setValueAtTime(0, now)
    bodyGain.gain.linearRampToValueAtTime(drumVolume * 0.9, now + 0.008)
    bodyGain.gain.exponentialRampToValueAtTime(drumVolume * 0.4, now + 0.1)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    
    body.start(now)
    body.stop(now + 0.35)
    
    // Beater attack - the "thump" of the beater hitting the head
    const beater = ctx.createOscillator()
    const beaterGain = ctx.createGain()
    
    beater.connect(beaterGain)
    beaterGain.connect(ctx.destination)
    
    beater.frequency.setValueAtTime(80, now)
    beater.frequency.exponentialRampToValueAtTime(50, now + 0.04)
    beater.type = 'triangle'
    
    beaterGain.gain.setValueAtTime(0, now)
    beaterGain.gain.linearRampToValueAtTime(drumVolume * 0.5, now + 0.003)
    beaterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    
    beater.start(now)
    beater.stop(now + 0.06)
    
    // Subtle click for definition (softer than electronic)
    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    const clickFilter = ctx.createBiquadFilter()
    
    click.connect(clickFilter)
    clickFilter.connect(clickGain)
    clickGain.connect(ctx.destination)
    
    click.frequency.setValueAtTime(400, now)
    click.frequency.exponentialRampToValueAtTime(100, now + 0.02)
    click.type = 'sine'
    
    clickFilter.type = 'lowpass'
    clickFilter.frequency.value = 1500
    
    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(drumVolume * 0.2, now + 0.001)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
    
    click.start(now)
    click.stop(now + 0.025)
  }, [getAudioContext, drumVolume])

  // Play snare drum - acoustic style
  const playSnare = useCallback(async () => {
    const ctx = await getAudioContext()
    const now = ctx.currentTime
    
    // Drum shell body - warm fundamental tone
    const body = ctx.createOscillator()
    const bodyGain = ctx.createGain()
    const bodyFilter = ctx.createBiquadFilter()
    
    body.connect(bodyFilter)
    bodyFilter.connect(bodyGain)
    bodyGain.connect(ctx.destination)
    
    body.frequency.setValueAtTime(180, now)
    body.frequency.exponentialRampToValueAtTime(120, now + 0.08)
    body.type = 'sine'
    
    bodyFilter.type = 'lowpass'
    bodyFilter.frequency.value = 500
    bodyFilter.Q.value = 1
    
    bodyGain.gain.setValueAtTime(0, now)
    bodyGain.gain.linearRampToValueAtTime(drumVolume * 0.5, now + 0.005)
    bodyGain.gain.exponentialRampToValueAtTime(drumVolume * 0.2, now + 0.05)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    
    body.start(now)
    body.stop(now + 0.25)
    
    // Drum head overtone - adds crack
    const head = ctx.createOscillator()
    const headGain = ctx.createGain()
    
    head.connect(headGain)
    headGain.connect(ctx.destination)
    
    head.frequency.setValueAtTime(300, now)
    head.frequency.exponentialRampToValueAtTime(200, now + 0.03)
    head.type = 'triangle'
    
    headGain.gain.setValueAtTime(0, now)
    headGain.gain.linearRampToValueAtTime(drumVolume * 0.3, now + 0.002)
    headGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    
    head.start(now)
    head.stop(now + 0.1)
    
    // Snare wires - bandpass filtered noise for natural rattle
    const bufferSize = Math.floor(ctx.sampleRate * 0.2)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    
    // Create noise with natural decay envelope baked in
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize
      // Soft attack, natural decay curve
      const envelope = Math.pow(1 - t, 1.5) * (1 - Math.exp(-t * 50))
      data[i] = (Math.random() * 2 - 1) * envelope
    }
    
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    const noiseLowpass = ctx.createBiquadFilter()
    const noiseHighpass = ctx.createBiquadFilter()
    
    noise.buffer = buffer
    noise.connect(noiseHighpass)
    noiseHighpass.connect(noiseLowpass)
    noiseLowpass.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    
    // Bandpass for snare wire frequency range (not too harsh)
    noiseHighpass.type = 'highpass'
    noiseHighpass.frequency.value = 1200
    noiseHighpass.Q.value = 0.5
    
    noiseLowpass.type = 'lowpass'
    noiseLowpass.frequency.value = 7000
    noiseLowpass.Q.value = 0.7
    
    noiseGain.gain.setValueAtTime(drumVolume * 0.35, now)
    
    noise.start(now)
    noise.stop(now + 0.2)
  }, [getAudioContext, drumVolume])

  // Play hi-hat - acoustic style with filtered noise
  const playHiHat = useCallback(async (isOpen: boolean = false) => {
    const ctx = await getAudioContext()
    const now = ctx.currentTime
    
    const duration = isOpen ? 0.15 : 0.06
    
    // Create noise buffer for realistic hi-hat
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize
      // Quick attack, natural decay
      const envelope = isOpen 
        ? Math.pow(1 - t, 0.8) * (1 - Math.exp(-t * 100))
        : Math.pow(1 - t, 2) * (1 - Math.exp(-t * 200))
      data[i] = (Math.random() * 2 - 1) * envelope
    }
    
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    const highpass = ctx.createBiquadFilter()
    const bandpass = ctx.createBiquadFilter()
    
    noise.buffer = buffer
    noise.connect(highpass)
    highpass.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    
    // Shape the noise to sound like metal cymbals
    highpass.type = 'highpass'
    highpass.frequency.value = 5000
    highpass.Q.value = 0.5
    
    bandpass.type = 'peaking'
    bandpass.frequency.value = 8000
    bandpass.Q.value = 2
    bandpass.gain.value = 3
    
    noiseGain.gain.setValueAtTime(drumVolume * (isOpen ? 0.18 : 0.12), now)
    
    noise.start(now)
    noise.stop(now + duration)
    
    // Add subtle metallic ring for character
    const ring = ctx.createOscillator()
    const ringGain = ctx.createGain()
    const ringFilter = ctx.createBiquadFilter()
    
    ring.connect(ringFilter)
    ringFilter.connect(ringGain)
    ringGain.connect(ctx.destination)
    
    ring.type = 'sine'
    ring.frequency.value = 6000 + Math.random() * 500
    
    ringFilter.type = 'bandpass'
    ringFilter.frequency.value = 8000
    ringFilter.Q.value = 5
    
    ringGain.gain.setValueAtTime(drumVolume * 0.02, now)
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5)
    
    ring.start(now)
    ring.stop(now + duration * 0.5)
  }, [getAudioContext, drumVolume])

  // Play drum beat based on beat position and time signature
  const playDrumBeat = useCallback(async (beat: number, timeSig: number) => {
    if (!playDrums) return
    
    // Always play hi-hat
    await playHiHat(false)
    
    // Helper to play kick with optional double
    const playKickPattern = async () => {
      await playKick()
      if (doubleKick) {
        // Schedule second kick after a short delay (eighth note feel)
        const delayMs = (60 / bpm) * 250 // Quarter of a beat
        setTimeout(() => playKick(), delayMs)
      }
    }
    
    if (timeSig === 4) {
      // 4/4 pattern: Kick on 1,3 - Snare on 2,4
      if (beat === 0 || beat === 2) {
        await playKickPattern()
      }
      if (beat === 1 || beat === 3) {
        await playSnare()
      }
    } else if (timeSig === 3) {
      // 3/4 pattern: Kick on 1, Snare on 3
      if (beat === 0) {
        await playKickPattern()
      }
      if (beat === 2) {
        await playSnare()
      }
    } else if (timeSig === 6) {
      // 6/8 pattern: Kick on 1, Snare on 4
      if (beat === 0) {
        await playKickPattern()
      }
      if (beat === 3) {
        await playSnare()
      }
    } else if (timeSig === 5) {
      // 5/4 pattern: Kick on 1,3 - Snare on 5
      if (beat === 0 || beat === 2) {
        await playKickPattern()
      }
      if (beat === 4) {
        await playSnare()
      }
    } else if (timeSig === 7) {
      // 7/8 pattern: Kick on 1,4 - Snare on 7
      if (beat === 0 || beat === 3) {
        await playKickPattern()
      }
      if (beat === 6) {
        await playSnare()
      }
    } else {
      // Default: Kick on beat 1, snare on middle beat
      if (beat === 0) {
        await playKickPattern()
      }
      if (beat === Math.floor(timeSig / 2)) {
        await playSnare()
      }
    }
  }, [playDrums, playKick, playSnare, playHiHat, doubleKick, bpm])

  // Stop currently playing chord with fade out
  const stopCurrentChord = useCallback((fadeTime: number = 0.1) => {
    if (activeChordRef.current) {
      const { gains, oscillators } = activeChordRef.current
      const ctx = audioContextRef.current
      
      if (ctx) {
        const now = ctx.currentTime
        gains.forEach(gain => {
          gain.gain.cancelScheduledValues(now)
          gain.gain.setValueAtTime(gain.gain.value, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + fadeTime)
        })
        
        // Stop oscillators after fade
        setTimeout(() => {
          oscillators.forEach(osc => {
            try { osc.stop() } catch (e) { /* already stopped */ }
          })
        }, fadeTime * 1000 + 50)
      }
      
      activeChordRef.current = null
    }
  }, [])

  // Play a chord - sustains until next chord
  const playChordSound = useCallback(async (chordName: string) => {
    if (!playChords) return
    
    // If no chord specified, don't change anything (let current chord ring)
    if (!chordName) return
    
    // If same chord, don't restart it (let it ring)
    if (chordName === lastChordRef.current) return
    
    const ctx = await getAudioContext()
    const frequencies = getChordFrequencies(chordName)
    
    if (frequencies.length === 0) return
    
    // Fade out previous chord
    stopCurrentChord(0.08)
    
    // Track the new chord
    lastChordRef.current = chordName
    
    const oscillators: OscillatorNode[] = []
    const gains: GainNode[] = []
    const now = ctx.currentTime
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      
      // Use triangle for warm guitar-like sound
      osc.type = 'triangle'
      osc.frequency.value = freq
      
      // Low-pass filter for warmth
      filter.type = 'lowpass'
      filter.frequency.value = 2000
      filter.Q.value = 1
      
      // Stagger note starts slightly for strumming effect
      const startTime = now + (i * 0.012)
      const noteVolume = chordVolume / frequencies.length
      
      // Attack and sustain - chord rings indefinitely
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(noteVolume, startTime + 0.015)
      // Slight decay to sustained level for more natural sound
      gain.gain.linearRampToValueAtTime(noteVolume * 0.7, startTime + 0.3)
      
      osc.start(startTime)
      
      oscillators.push(osc)
      gains.push(gain)
    })
    
    // Store active chord reference
    activeChordRef.current = { oscillators, gains, chord: chordName }
    
  }, [getAudioContext, chordVolume, playChords, stopCurrentChord])

  // Play beat with drum and chord
  const playBeat = useCallback(async (barIndex: number, beatIndex: number) => {
    // Play drum pattern based on beat and time signature
    await playDrumBeat(beatIndex, timeSignature)
    
    // Play chord if there's one at this beat
    const chord = bars[barIndex]?.chords?.[beatIndex]
    if (chord) {
      await playChordSound(chord)
    }
  }, [playDrumBeat, playChordSound, bars, timeSignature])

  // Start/Stop playback
  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      // Stop
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Stop any sustaining chord
      stopCurrentChord(0.2)
      lastChordRef.current = ''
      
      setIsPlaying(false)
      setCurrentBar(-1)
      setCurrentBeat(-1)
      beatIndexRef.current = 0
    } else {
      // Initialize audio context first (needed for browser autoplay policy)
      await getAudioContext()
      
      // Start
      setIsPlaying(true)
      beatIndexRef.current = 0
      
      const totalBeats = numBars * timeSignature
      const msPerBeat = (60 / bpm) * 1000
      
      // Play first beat immediately
      setCurrentBar(0)
      setCurrentBeat(0)
      playBeat(0, 0)
      beatIndexRef.current = 1
      
      intervalRef.current = setInterval(() => {
        const beatIndex = beatIndexRef.current
        const bar = Math.floor(beatIndex / timeSignature)
        const beat = beatIndex % timeSignature
        
        if (beatIndex >= totalBeats) {
          if (loop) {
            beatIndexRef.current = 0
            // Reset last chord so first chord triggers again
            lastChordRef.current = ''
            setCurrentBar(0)
            setCurrentBeat(0)
            playBeat(0, 0)
            beatIndexRef.current = 1
          } else {
            // Stop at end
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            // Stop sustaining chord
            stopCurrentChord(0.2)
            lastChordRef.current = ''
            
            setIsPlaying(false)
            setCurrentBar(-1)
            setCurrentBeat(-1)
            beatIndexRef.current = 0
          }
          return
        }
        
        setCurrentBar(bar)
        setCurrentBeat(beat)
        playBeat(bar, beat)
        beatIndexRef.current++
      }, msPerBeat)
    }
  }, [isPlaying, numBars, timeSignature, bpm, loop, playBeat, getAudioContext, stopCurrentChord])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // Stop any playing chord
      if (activeChordRef.current) {
        activeChordRef.current.oscillators.forEach(osc => {
          try { osc.stop() } catch (e) { /* already stopped */ }
        })
        activeChordRef.current = null
      }
    }
  }, [])

  // Update chord in a specific bar and beat
  const updateChord = (barIndex: number, beatIndex: number, chord: string) => {
    setBars(prev => {
      const newBars = [...prev]
      if (newBars[barIndex]) {
        const newChords = [...newBars[barIndex].chords]
        newChords[beatIndex] = chord
        newBars[barIndex] = { chords: newChords }
      }
      return newBars
    })
  }

  // Quick fill with common progressions
  const fillProgression = (progression: string[]) => {
    setBars(prev => {
      const newBars = [...prev]
      progression.forEach((chord, i) => {
        if (newBars[i]) {
          const newChords = newBars[i].chords.map((_, j) => j === 0 ? chord : '')
          newBars[i] = { chords: newChords }
        }
      })
      return newBars
    })
  }

  // Clear all chords
  const clearAll = () => {
    setBars(prev => prev.map(bar => ({
      chords: bar.chords.map(() => '')
    })))
  }

  // Preset progressions
  const presets = [
    { name: 'I-IV-V-I (Blues)', chords: ['A', 'D', 'E', 'A'] },
    { name: 'I-V-vi-IV (Pop)', chords: ['C', 'G', 'Am', 'F'] },
    { name: 'ii-V-I (Jazz)', chords: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'] },
    { name: 'i-iv-VII-III (Minor)', chords: ['Am', 'Dm', 'G', 'C'] },
    { name: '12-Bar Blues', chords: ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'] },
  ]

  // Get current chord being played
  const getCurrentChord = () => {
    if (currentBar >= 0 && currentBeat >= 0) {
      return bars[currentBar]?.chords?.[currentBeat] || bars[currentBar]?.chords?.[0] || '—'
    }
    return '—'
  }

  if (!isOpen) {
    return (
      <button className="backing-track-toggle" onClick={() => { setIsOpen(true); setIsMinimized(false); }}>
        <span className="toggle-icon">🎵</span>
        <span>Backing Track</span>
      </button>
    )
  }

  // Minimized floating player
  if (isMinimized) {
    return (
      <div className="backing-track-mini">
        <div className="mini-info">
          <span className="mini-chord">{getCurrentChord()}</span>
          <span className="mini-position">
            {isPlaying ? `Bar ${currentBar + 1} • Beat ${currentBeat + 1}` : 'Paused'}
          </span>
        </div>
        <div className="mini-controls">
          <button 
            className={`mini-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlayback}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button 
            className="mini-expand-btn"
            onClick={() => setIsMinimized(false)}
            title="Expand"
          >
            ⬆
          </button>
          <button 
            className="mini-close-btn"
            onClick={() => { setIsOpen(false); if (isPlaying) togglePlayback(); }}
            title="Close"
          >
            ✕
          </button>
        </div>
        {/* Progress indicator */}
        {isPlaying && (
          <div className="mini-progress">
            <div 
              className="mini-progress-bar" 
              style={{ 
                width: `${((currentBar * timeSignature + currentBeat + 1) / (numBars * timeSignature)) * 100}%` 
              }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="backing-track-overlay">
      <div className="backing-track-modal">
        <div className="backing-track-header">
          <h2>🎵 Backing Track Generator</h2>
          <div className="header-buttons">
            <button 
              className="minimize-btn" 
              onClick={() => setIsMinimized(true)}
              title="Minimize"
            >
              ▼
            </button>
            <button 
              className="close-btn" 
              onClick={() => { setIsOpen(false); if (isPlaying) togglePlayback(); }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="backing-track-controls">
          <div className="control-group">
            <label>Bars</label>
            <div className="number-input">
              <button onClick={() => setNumBars(Math.max(1, numBars - 1))} disabled={isPlaying}>−</button>
              <span>{numBars}</span>
              <button onClick={() => setNumBars(Math.min(16, numBars + 1))} disabled={isPlaying}>+</button>
            </div>
          </div>

          <div className="control-group">
            <label>Time Sig</label>
            <select 
              value={timeSignature} 
              onChange={(e) => setTimeSignature(Number(e.target.value))}
              disabled={isPlaying}
              className="select-input compact"
            >
              <option value={3}>3/4</option>
              <option value={4}>4/4</option>
              <option value={5}>5/4</option>
              <option value={6}>6/8</option>
              <option value={7}>7/8</option>
            </select>
          </div>

          <div className="control-group">
            <label>BPM</label>
            <div className="number-input">
              <button onClick={() => setBpm(Math.max(40, bpm - 5))}>−</button>
              <span>{bpm}</span>
              <button onClick={() => setBpm(Math.min(240, bpm + 5))}>+</button>
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
            <label>Drums</label>
            <div className="drum-controls">
              <button 
                className={`sound-toggle-btn ${playDrums ? 'active' : ''}`}
                onClick={() => setPlayDrums(!playDrums)}
                title="Toggle Drums"
              >
                🥁
              </button>
              <button 
                className={`sound-toggle-btn double-kick-btn ${doubleKick ? 'active' : ''}`}
                onClick={() => setDoubleKick(!doubleKick)}
                title="Double Kick"
                disabled={!playDrums}
              >
                ⚡
              </button>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={drumVolume * 100}
              onChange={(e) => setDrumVolume(Number(e.target.value) / 100)}
              className="volume-slider"
              title={`Drum Volume: ${Math.round(drumVolume * 100)}%`}
            />
          </div>

          <div className="control-group">
            <label>Chords</label>
            <button 
              className={`sound-toggle-btn ${playChords ? 'active' : ''}`}
              onClick={() => setPlayChords(!playChords)}
            >
              🎸
            </button>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={chordVolume * 100}
              onChange={(e) => setChordVolume(Number(e.target.value) / 100)}
              className="volume-slider"
              title={`Chord Volume: ${Math.round(chordVolume * 100)}%`}
            />
          </div>

          <button 
            className={`play-btn large ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlayback}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>
        </div>

        {/* Presets */}
        <div className="backing-track-presets">
          <span className="preset-label">Presets:</span>
          {presets.map((preset, i) => (
            <button 
              key={i}
              className="preset-btn"
              onClick={() => {
                if (preset.chords.length > numBars) {
                  setNumBars(preset.chords.length)
                }
                setTimeout(() => fillProgression(preset.chords), 50)
              }}
              disabled={isPlaying}
            >
              {preset.name}
            </button>
          ))}
          <button className="preset-btn clear" onClick={clearAll} disabled={isPlaying}>
            Clear
          </button>
        </div>

        {/* Chord Grid */}
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

        {/* Current chord display */}
        {isPlaying && currentBar >= 0 && (
          <div className="current-chord-display">
            <span className="current-label">Now Playing:</span>
            <span className="current-chord">
              {bars[currentBar]?.chords[currentBeat] || '—'}
            </span>
            <span className="current-position">
              Bar {currentBar + 1}, Beat {currentBeat + 1}
            </span>
          </div>
        )}

        {/* Chord reference */}
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
