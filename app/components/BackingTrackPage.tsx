'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

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
  'add9': [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  '6': [0, 4, 7, 9],
  'm6': [0, 3, 7, 9],
  'm9': [0, 3, 7, 10, 14],
}

const ROOT_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const ACCIDENTALS = [
  { id: 'natural', label: '♮', suffix: '' },
  { id: 'sharp', label: '♯', suffix: '#' },
  { id: 'flat', label: '♭', suffix: 'b' },
] as const

const CHORD_TYPES = [
  { id: 'major', label: 'Major', suffix: '' },
  { id: 'minor', label: 'Minor', suffix: 'm' },
  { id: '7', label: '7', suffix: '7' },
  { id: 'm7', label: 'm7', suffix: 'm7' },
  { id: 'maj7', label: 'maj7', suffix: 'maj7' },
  { id: 'dim', label: 'dim', suffix: 'dim' },
  { id: 'dim7', label: 'dim7', suffix: 'dim7' },
  { id: 'aug', label: 'aug', suffix: 'aug' },
  { id: 'sus4', label: 'sus4', suffix: 'sus4' },
  { id: 'sus2', label: 'sus2', suffix: 'sus2' },
  { id: 'add9', label: 'add9', suffix: 'add9' },
  { id: '9', label: '9', suffix: '9' },
  { id: '6', label: '6', suffix: '6' },
  { id: 'm6', label: 'm6', suffix: 'm6' },
  { id: 'm9', label: 'm9', suffix: 'm9' },
] as const

type Style = 'pop' | 'rock' | 'jazz' | 'blues' | 'reggae'

interface StyleConfig {
  label: string
  defaultBpm: number
  drumPattern: (beat: number, timeSig: number) => ('kick' | 'snare' | 'hihat' | 'hihat-open')[]
}

const STYLES: Record<Style, StyleConfig> = {
  pop: {
    label: 'Pop',
    defaultBpm: 120,
    drumPattern: (beat, timeSig) => {
      if (beat === 0) return ['kick', 'hihat']
      if (beat === Math.floor(timeSig / 2)) return ['snare', 'hihat']
      return beat % 2 === 1 ? ['hihat-open'] : ['hihat']
    },
  },
  rock: {
    label: 'Rock',
    defaultBpm: 130,
    drumPattern: (beat) => {
      if (beat === 0 || beat === 2) return ['kick', 'hihat']
      if (beat === 1 || beat === 3) return ['snare', 'hihat']
      return ['hihat']
    },
  },
  jazz: {
    label: 'Jazz',
    defaultBpm: 140,
    drumPattern: (beat) => {
      if (beat === 0) return ['kick', 'hihat']
      if (beat === 2) return ['hihat-open']
      return ['hihat']
    },
  },
  blues: {
    label: 'Blues',
    defaultBpm: 90,
    drumPattern: (beat, timeSig) => {
      if (beat === 0) return ['kick', 'hihat']
      if (beat === Math.floor(timeSig / 2)) return ['snare', 'hihat']
      return beat % 2 === 0 ? ['hihat'] : ['hihat-open']
    },
  },
  reggae: {
    label: 'Reggae',
    defaultBpm: 80,
    drumPattern: (beat, timeSig) => {
      if (beat === 0) return ['hihat']
      if (beat === Math.floor(timeSig / 2)) return ['kick', 'snare', 'hihat']
      return beat % 2 === 1 ? ['hihat-open'] : ['hihat']
    },
  },
}

const PROGRESSIONS: Record<Style, { name: string; chords: string[] }[]> = {
  pop: [
    { name: 'I – V – vi – IV', chords: ['C', 'G', 'Am', 'F'] },
    { name: 'I – IV – V – I', chords: ['C', 'F', 'G', 'C'] },
    { name: 'I – IV – Vsus4 – V', chords: ['C', 'F', 'Gsus4', 'G'] },
    { name: 'I – vi – ii – V', chords: ['C', 'Am', 'Dm', 'G'] },
    { name: 'I – ii – IV – V', chords: ['C', 'Dm', 'F', 'G'] },
    { name: 'vi – ii – V – I', chords: ['Am', 'Dm', 'E', 'Am'] },
    { name: 'vi – I – ii – iii', chords: ['Am', 'C', 'Dm', 'Em'] },
  ],
  rock: [
    { name: 'I – vi – IV – V', chords: ['C', 'Am', 'F', 'G'] },
    { name: 'I – IV – I – V', chords: ['C', 'F', 'C', 'G'] },
    { name: 'I – I – bIII – IV', chords: ['C', 'C', 'Eb', 'F'] },
    { name: 'I – III – IV – iv', chords: ['C', 'E', 'F', 'Fm'] },
    { name: 'ii – I – V – bVII', chords: ['Dm', 'C', 'G', 'Bb'] },
    { name: 'vi – IV – I – V', chords: ['Am', 'F', 'C', 'G'] },
    { name: 'vi – V7 – II – V7', chords: ['Am', 'E7', 'D', 'G7'] },
  ],
  jazz: [
    { name: 'ii7 – V7 – Imaj7', chords: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'] },
    { name: 'ii7 – V7 – Imaj7 – VI7', chords: ['Dm7', 'G7', 'Cmaj7', 'A7'] },
    { name: 'Imaj7 – vi7 – ii7 – V7', chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'] },
    { name: 'Imaj7 – I7 – IVmaj7 – iv7', chords: ['Cmaj7', 'C7', 'Fmaj7', 'Fm7'] },
    { name: 'vi7 – ii7 – V7 – Imaj7', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7'] },
    { name: 'ii7 – V7 – im7', chords: ['Dm7', 'G7', 'Cm7', 'Cm7'] },
  ],
  blues: [
    { name: '12-Bar Blues', chords: ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'C7'] },
    { name: 'I7 – IV7 – I7 – V7', chords: ['C7', 'F7', 'C7', 'G7'] },
    { name: 'i – iv – V7 – i', chords: ['Am', 'Dm', 'E7', 'Am'] },
  ],
  reggae: [
    { name: 'I – V – vi – IV', chords: ['C', 'G', 'Am', 'F'] },
    { name: 'I – IV – V – I', chords: ['C', 'F', 'G', 'C'] },
    { name: 'vi – IV – I – V', chords: ['Am', 'F', 'C', 'G'] },
    { name: 'I – vi – IV – V', chords: ['C', 'Am', 'F', 'G'] },
  ],
}

function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) return chord
  const match = chord.match(/^([A-G][#b]?)(.*)/)
  if (!match) return chord
  const [, root, suffix] = match
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
  }
  const idx = noteMap[root]
  if (idx === undefined) return chord
  return ALL_NOTES[(idx + semitones + 12) % 12] + suffix
}

interface Section {
  id: string
  label: string
  chords: string[]
}

interface BackingTrackPageProps {
  onClose: () => void
}

function decomposeChord(chord: string): { root: string; accidental: string; type: string } {
  if (!chord) return { root: 'C', accidental: 'natural', type: 'major' }
  const match = chord.match(/^([A-G])([#b]?)(.*)$/)
  if (!match) return { root: 'C', accidental: 'natural', type: 'major' }
  const [, root, acc, suffix] = match
  const accidental = acc === '#' ? 'sharp' : acc === 'b' ? 'flat' : 'natural'
  const typeEntry = CHORD_TYPES.find(t => t.suffix === suffix)
  return { root, accidental, type: typeEntry?.id || 'major' }
}

function composeChord(root: string, accidental: string, type: string): string {
  const accSuffix = accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : ''
  const typeEntry = CHORD_TYPES.find(t => t.id === type)
  return root + accSuffix + (typeEntry?.suffix || '')
}

let sectionCounter = 0
function newSectionId() { return `s${Date.now()}_${sectionCounter++}` }

export default function BackingTrackPage({ onClose }: BackingTrackPageProps) {
  const [selectedKey, setSelectedKey] = useState<string>('C')
  const [style, setStyle] = useState<Style>('pop')
  const [bpm, setBpm] = useState<number>(120)
  const [sections, setSections] = useState<Section[]>([
    { id: newSectionId(), label: 'Section 1', chords: ['C', 'G', 'Am', 'F'] },
  ])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChordIdx, setCurrentChordIdx] = useState(-1)
  const [currentBeat, setCurrentBeat] = useState(-1)
  const [loop, setLoop] = useState(true)
  const [drumVolume, setDrumVolume] = useState(0.5)
  const [chordVolume, setChordVolume] = useState(0.4)
  const [playChordSound, setPlayChordSound] = useState(true)
  const [playDrums, setPlayDrums] = useState(true)
  const [pickerTarget, setPickerTarget] = useState<{ sectionIdx: number; chordIdx: number } | null>(null)
  const [pickerRoot, setPickerRoot] = useState('C')
  const [pickerAcc, setPickerAcc] = useState('natural')
  const [pickerType, setPickerType] = useState('major')
  const [manualInput, setManualInput] = useState('')
  const [showManual, setShowManual] = useState(false)
  const timeSignature = 4

  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const beatIndexRef = useRef(0)
  const activeChordRef = useRef<{ oscillators: OscillatorNode[]; gains: GainNode[]; chord: string } | null>(null)
  const lastChordRef = useRef('')
  const manualInputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const keyIdx = ALL_NOTES.indexOf(selectedKey as typeof ALL_NOTES[number])

  const allChords = sections.flatMap(s => s.chords)

  // --- Audio Engine ---

  const getAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  const getChordFrequencies = (chordName: string): number[] => {
    if (!chordName) return []
    const match = chordName.match(/^([A-G][#b]?)(m7|maj7|dim7|add9|m9|m6|m|7|9|6|dim|aug|sus4|sus2)?$/)
    if (!match) return []
    const rootFreq = NOTE_FREQUENCIES[match[1]]
    if (!rootFreq) return []
    const intervals = CHORD_INTERVALS[match[2] || ''] || CHORD_INTERVALS['']
    return intervals.map(s => rootFreq * Math.pow(2, s / 12))
  }

  const playKick = useCallback(async () => {
    if (!playDrums) return
    const ctx = await getAudioContext()
    const now = ctx.currentTime
    const body = ctx.createOscillator()
    const bodyGain = ctx.createGain()
    const bodyFilter = ctx.createBiquadFilter()
    body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(ctx.destination)
    body.frequency.setValueAtTime(120, now)
    body.frequency.exponentialRampToValueAtTime(45, now + 0.12)
    body.type = 'sine'
    bodyFilter.type = 'lowpass'; bodyFilter.frequency.value = 200
    bodyGain.gain.setValueAtTime(0, now)
    bodyGain.gain.linearRampToValueAtTime(drumVolume * 0.9, now + 0.008)
    bodyGain.gain.exponentialRampToValueAtTime(drumVolume * 0.4, now + 0.1)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    body.start(now); body.stop(now + 0.35)
    const beater = ctx.createOscillator()
    const beaterGain = ctx.createGain()
    beater.connect(beaterGain); beaterGain.connect(ctx.destination)
    beater.frequency.setValueAtTime(80, now)
    beater.frequency.exponentialRampToValueAtTime(50, now + 0.04)
    beater.type = 'triangle'
    beaterGain.gain.setValueAtTime(0, now)
    beaterGain.gain.linearRampToValueAtTime(drumVolume * 0.5, now + 0.003)
    beaterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    beater.start(now); beater.stop(now + 0.06)
    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    const clickFilter = ctx.createBiquadFilter()
    click.connect(clickFilter); clickFilter.connect(clickGain); clickGain.connect(ctx.destination)
    click.frequency.setValueAtTime(400, now)
    click.frequency.exponentialRampToValueAtTime(100, now + 0.02)
    click.type = 'sine'
    clickFilter.type = 'lowpass'; clickFilter.frequency.value = 1500
    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(drumVolume * 0.2, now + 0.001)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
    click.start(now); click.stop(now + 0.025)
  }, [getAudioContext, drumVolume, playDrums])

  const playSnare = useCallback(async () => {
    if (!playDrums) return
    const ctx = await getAudioContext()
    const now = ctx.currentTime
    const body = ctx.createOscillator()
    const bodyGain = ctx.createGain()
    const bodyFilter = ctx.createBiquadFilter()
    body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(ctx.destination)
    body.frequency.setValueAtTime(180, now)
    body.frequency.exponentialRampToValueAtTime(120, now + 0.08)
    body.type = 'sine'
    bodyFilter.type = 'lowpass'; bodyFilter.frequency.value = 500; bodyFilter.Q.value = 1
    bodyGain.gain.setValueAtTime(0, now)
    bodyGain.gain.linearRampToValueAtTime(drumVolume * 0.5, now + 0.005)
    bodyGain.gain.exponentialRampToValueAtTime(drumVolume * 0.2, now + 0.05)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    body.start(now); body.stop(now + 0.25)
    const head = ctx.createOscillator()
    const headGain = ctx.createGain()
    head.connect(headGain); headGain.connect(ctx.destination)
    head.frequency.setValueAtTime(300, now)
    head.frequency.exponentialRampToValueAtTime(200, now + 0.03)
    head.type = 'triangle'
    headGain.gain.setValueAtTime(0, now)
    headGain.gain.linearRampToValueAtTime(drumVolume * 0.3, now + 0.002)
    headGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    head.start(now); head.stop(now + 0.1)
    const bufferSize = Math.floor(ctx.sampleRate * 0.2)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5) * (1 - Math.exp(-t * 50))
    }
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    const noiseLp = ctx.createBiquadFilter()
    const noiseHp = ctx.createBiquadFilter()
    noise.buffer = buffer
    noise.connect(noiseHp); noiseHp.connect(noiseLp); noiseLp.connect(noiseGain); noiseGain.connect(ctx.destination)
    noiseHp.type = 'highpass'; noiseHp.frequency.value = 1200; noiseHp.Q.value = 0.5
    noiseLp.type = 'lowpass'; noiseLp.frequency.value = 7000; noiseLp.Q.value = 0.7
    noiseGain.gain.setValueAtTime(drumVolume * 0.35, now)
    noise.start(now); noise.stop(now + 0.2)
  }, [getAudioContext, drumVolume, playDrums])

  const playHiHat = useCallback(async (isOpen: boolean = false) => {
    if (!playDrums) return
    const ctx = await getAudioContext()
    const now = ctx.currentTime
    const duration = isOpen ? 0.15 : 0.06
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize
      const env = isOpen ? Math.pow(1 - t, 0.8) * (1 - Math.exp(-t * 100)) : Math.pow(1 - t, 2) * (1 - Math.exp(-t * 200))
      data[i] = (Math.random() * 2 - 1) * env
    }
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    const hp = ctx.createBiquadFilter()
    const bp = ctx.createBiquadFilter()
    noise.buffer = buffer
    noise.connect(hp); hp.connect(bp); bp.connect(noiseGain); noiseGain.connect(ctx.destination)
    hp.type = 'highpass'; hp.frequency.value = 5000; hp.Q.value = 0.5
    bp.type = 'peaking'; bp.frequency.value = 8000; bp.Q.value = 2; bp.gain.value = 3
    noiseGain.gain.setValueAtTime(drumVolume * (isOpen ? 0.18 : 0.12), now)
    noise.start(now); noise.stop(now + duration)
    const ring = ctx.createOscillator()
    const ringGain = ctx.createGain()
    const ringFilter = ctx.createBiquadFilter()
    ring.connect(ringFilter); ringFilter.connect(ringGain); ringGain.connect(ctx.destination)
    ring.type = 'sine'; ring.frequency.value = 6000 + Math.random() * 500
    ringFilter.type = 'bandpass'; ringFilter.frequency.value = 8000; ringFilter.Q.value = 5
    ringGain.gain.setValueAtTime(drumVolume * 0.02, now)
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5)
    ring.start(now); ring.stop(now + duration * 0.5)
  }, [getAudioContext, drumVolume, playDrums])

  const stopCurrentChord = useCallback((fadeTime: number = 0.1) => {
    if (activeChordRef.current) {
      const { gains, oscillators } = activeChordRef.current
      const ctx = audioContextRef.current
      if (ctx) {
        const now = ctx.currentTime
        gains.forEach(g => {
          g.gain.cancelScheduledValues(now)
          g.gain.setValueAtTime(g.gain.value, now)
          g.gain.exponentialRampToValueAtTime(0.001, now + fadeTime)
        })
        setTimeout(() => { oscillators.forEach(o => { try { o.stop() } catch {} }) }, fadeTime * 1000 + 50)
      }
      activeChordRef.current = null
    }
  }, [])

  const triggerChord = useCallback(async (chordName: string) => {
    if (!playChordSound || !chordName) return
    if (chordName === lastChordRef.current) return
    const ctx = await getAudioContext()
    const frequencies = getChordFrequencies(chordName)
    if (frequencies.length === 0) return
    stopCurrentChord(0.08)
    lastChordRef.current = chordName
    const oscillators: OscillatorNode[] = []
    const gains: GainNode[] = []
    const now = ctx.currentTime
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      osc.type = 'triangle'; osc.frequency.value = freq
      filter.type = 'lowpass'; filter.frequency.value = 2000; filter.Q.value = 1
      const st = now + (i * 0.012)
      const nv = chordVolume / frequencies.length
      gain.gain.setValueAtTime(0, st)
      gain.gain.linearRampToValueAtTime(nv, st + 0.015)
      gain.gain.linearRampToValueAtTime(nv * 0.7, st + 0.3)
      osc.start(st)
      oscillators.push(osc); gains.push(gain)
    })
    activeChordRef.current = { oscillators, gains, chord: chordName }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAudioContext, chordVolume, playChordSound, stopCurrentChord])

  const playDrumBeat = useCallback(async (beat: number) => {
    const sounds = STYLES[style].drumPattern(beat, timeSignature)
    for (const s of sounds) {
      if (s === 'kick') await playKick()
      else if (s === 'snare') await playSnare()
      else if (s === 'hihat') await playHiHat(false)
      else if (s === 'hihat-open') await playHiHat(true)
    }
  }, [style, timeSignature, playKick, playSnare, playHiHat])

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      stopCurrentChord(0.2)
      lastChordRef.current = ''
      setIsPlaying(false)
      setCurrentChordIdx(-1)
      setCurrentBeat(-1)
      beatIndexRef.current = 0
      return
    }
    const flat = sections.flatMap(s => s.chords)
    if (flat.length === 0 || flat.every(c => !c.trim())) return
    await getAudioContext()
    setIsPlaying(true)
    setPickerTarget(null)
    beatIndexRef.current = 0
    const totalBeats = flat.length * timeSignature
    const msPerBeat = (60 / bpm) * 1000
    const tick = async () => {
      const beatIdx = beatIndexRef.current
      const chordIdx = Math.floor(beatIdx / timeSignature)
      const beatInChord = beatIdx % timeSignature
      if (chordIdx >= flat.length) {
        if (loop) {
          beatIndexRef.current = 0
          lastChordRef.current = ''
          setCurrentChordIdx(0)
          setCurrentBeat(0)
          if (flat[0]?.trim()) await triggerChord(flat[0].trim())
          await playDrumBeat(0)
          beatIndexRef.current = 1
          return
        }
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = null
        stopCurrentChord(0.2)
        lastChordRef.current = ''
        setIsPlaying(false)
        setCurrentChordIdx(-1)
        setCurrentBeat(-1)
        beatIndexRef.current = 0
        return
      }
      setCurrentChordIdx(chordIdx)
      setCurrentBeat(beatInChord)
      if (beatInChord === 0 && flat[chordIdx]?.trim()) await triggerChord(flat[chordIdx].trim())
      await playDrumBeat(beatInChord)
      beatIndexRef.current++
    }
    await tick()
    intervalRef.current = setInterval(tick, msPerBeat)
  }, [isPlaying, sections, bpm, loop, timeSignature, getAudioContext, triggerChord, playDrumBeat, stopCurrentChord])

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (activeChordRef.current) {
      activeChordRef.current.oscillators.forEach(o => { try { o.stop() } catch {} })
      activeChordRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !pickerTarget && !showManual) {
        e.preventDefault()
        togglePlayback()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlayback, pickerTarget, showManual])

  // Close picker on click outside
  useEffect(() => {
    if (!pickerTarget) return
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerTarget(null)
        setShowManual(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerTarget])

  // --- Section & Chord Management ---

  const updateChord = (sectionIdx: number, chordIdx: number, value: string) => {
    setSections(prev => prev.map((s, si) =>
      si === sectionIdx ? { ...s, chords: s.chords.map((c, ci) => ci === chordIdx ? value : c) } : s
    ))
  }

  const addChordToSection = (sectionIdx: number) => {
    setSections(prev => prev.map((s, si) =>
      si === sectionIdx ? { ...s, chords: [...s.chords, ''] } : s
    ))
  }

  const removeChordFromSection = (sectionIdx: number, chordIdx: number) => {
    setSections(prev => prev.map((s, si) => {
      if (si !== sectionIdx) return s
      if (s.chords.length <= 1) return s
      return { ...s, chords: s.chords.filter((_, ci) => ci !== chordIdx) }
    }))
  }

  const addSection = () => {
    setSections(prev => [...prev, {
      id: newSectionId(),
      label: `Section ${prev.length + 1}`,
      chords: ['', '', '', ''],
    }])
  }

  const removeSection = (sectionIdx: number) => {
    if (sections.length <= 1) return
    setSections(prev => prev.filter((_, i) => i !== sectionIdx))
  }

  const openPicker = (sectionIdx: number, chordIdx: number) => {
    if (isPlaying) return
    const chord = sections[sectionIdx].chords[chordIdx]
    const decomposed = decomposeChord(chord)
    setPickerRoot(decomposed.root)
    setPickerAcc(decomposed.accidental)
    setPickerType(decomposed.type)
    setManualInput(chord)
    setShowManual(false)
    setPickerTarget({ sectionIdx, chordIdx })
  }

  const applyPicker = () => {
    if (!pickerTarget) return
    const chord = composeChord(pickerRoot, pickerAcc, pickerType)
    updateChord(pickerTarget.sectionIdx, pickerTarget.chordIdx, chord)
    setPickerTarget(null)
    setShowManual(false)
  }

  const applyManual = () => {
    if (!pickerTarget) return
    updateChord(pickerTarget.sectionIdx, pickerTarget.chordIdx, manualInput)
    setPickerTarget(null)
    setShowManual(false)
  }

  const applyProgression = (progression: string[]) => {
    const baseIdx = ALL_NOTES.indexOf('C' as typeof ALL_NOTES[number])
    const semitones = (keyIdx - baseIdx + 12) % 12
    const transposed = progression.map(c => transposeChord(c, semitones))
    setSections([{ id: newSectionId(), label: 'Section 1', chords: transposed }])
  }

  const generateRandom = () => {
    const pool = PROGRESSIONS[style]
    applyProgression(pool[Math.floor(Math.random() * pool.length)].chords)
  }

  const clearAll = () => {
    setSections([{ id: newSectionId(), label: 'Section 1', chords: ['', '', '', ''] }])
  }

  const changeStyle = (s: Style) => {
    setStyle(s)
    if (!isPlaying) setBpm(STYLES[s].defaultBpm)
  }

  const handleClose = () => {
    if (isPlaying) togglePlayback()
    onClose()
  }

  // Map flat chord index to section/chord position for playback highlighting
  const getGlobalIdx = (sectionIdx: number, chordIdx: number): number => {
    let idx = 0
    for (let si = 0; si < sectionIdx; si++) idx += sections[si].chords.length
    return idx + chordIdx
  }

  const nowPlaying = currentChordIdx >= 0 ? allChords[currentChordIdx] || '—' : '—'
  const totalBeats = allChords.length * timeSignature
  const progress = currentChordIdx >= 0
    ? ((currentChordIdx * timeSignature + currentBeat + 1) / totalBeats) * 100
    : 0

  return (
    <div className="chord-player-overlay">
      <div className="chord-player-modal">
        {/* Header */}
        <div className="chord-player-header">
          <h2>Chord Player</h2>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        {/* Style & Tempo */}
        <div className="chord-player-topbar">
          <div className="style-tabs">
            {(Object.keys(STYLES) as Style[]).map(s => (
              <button key={s} className={`style-tab ${style === s ? 'active' : ''}`}
                onClick={() => changeStyle(s)} disabled={isPlaying}>
                {STYLES[s].label}
              </button>
            ))}
          </div>
          <div className="topbar-controls">
            <div className="topbar-group">
              <label>Key</label>
              <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
                disabled={isPlaying} className="cp-select">
                {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="topbar-group">
              <label>BPM</label>
              <div className="bpm-control">
                <button onClick={() => setBpm(Math.max(40, bpm - 5))} disabled={isPlaying}>−</button>
                <span>{bpm}</span>
                <button onClick={() => setBpm(Math.min(240, bpm + 5))} disabled={isPlaying}>+</button>
              </div>
            </div>
            <button className={`cp-icon-btn ${loop ? 'active' : ''}`} onClick={() => setLoop(!loop)} title="Loop">
              🔁
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="chord-player-actions">
          <button className="cp-action-btn generate" onClick={generateRandom} disabled={isPlaying}>
            Generate chords
          </button>
          <button className="cp-action-btn" onClick={addSection} disabled={isPlaying}>
            + Add section
          </button>
          <button className="cp-action-btn clear" onClick={clearAll} disabled={isPlaying}>
            Clear
          </button>
        </div>

        {/* Sections */}
        <div className="chord-sections">
          {sections.map((section, sectionIdx) => (
            <div key={section.id} className="chord-section">
              <div className="section-header">
                <input
                  className="section-label-input"
                  value={section.label}
                  onChange={e => setSections(prev => prev.map((s, i) =>
                    i === sectionIdx ? { ...s, label: e.target.value } : s
                  ))}
                  disabled={isPlaying}
                />
                {sections.length > 1 && !isPlaying && (
                  <button className="section-remove" onClick={() => removeSection(sectionIdx)} title="Remove section">✕</button>
                )}
              </div>
              <div className="chord-timeline">
                {section.chords.map((chord, chordIdx) => {
                  const globalIdx = getGlobalIdx(sectionIdx, chordIdx)
                  const isActive = currentChordIdx === globalIdx && isPlaying
                  const isPicking = pickerTarget?.sectionIdx === sectionIdx && pickerTarget?.chordIdx === chordIdx
                  return (
                    <div key={chordIdx}
                      className={`chord-slot ${isActive ? 'playing' : ''} ${isPicking ? 'editing' : ''}`}
                      onClick={() => openPicker(sectionIdx, chordIdx)}>
                      <span className="chord-slot-name">{chord || '+'}</span>
                      {isActive && (
                        <div className="beat-dots">
                          {Array.from({ length: timeSignature }).map((_, b) => (
                            <span key={b} className={`beat-dot ${currentBeat === b ? 'active' : ''}`} />
                          ))}
                        </div>
                      )}
                      {!isPlaying && section.chords.length > 1 && (
                        <button className="chord-remove"
                          onClick={e => { e.stopPropagation(); removeChordFromSection(sectionIdx, chordIdx) }}
                          title="Remove">✕</button>
                      )}
                    </div>
                  )
                })}
                {!isPlaying && (
                  <button className="chord-add-btn" onClick={() => addChordToSection(sectionIdx)} title="Add chord">
                    +
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chord Picker Popup */}
        {pickerTarget && (
          <div className="chord-picker-backdrop">
            <div className="chord-picker" ref={pickerRef}>
              <div className="picker-header">
                <span className="picker-preview">{showManual ? manualInput || '—' : composeChord(pickerRoot, pickerAcc, pickerType)}</span>
                <button className="picker-mode-toggle" onClick={() => { setShowManual(!showManual); if (!showManual) setTimeout(() => manualInputRef.current?.focus(), 50) }}>
                  {showManual ? 'Use Picker' : 'Type manually'}
                </button>
              </div>

              {showManual ? (
                <div className="picker-manual">
                  <input ref={manualInputRef} type="text" value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyManual(); if (e.key === 'Escape') { setPickerTarget(null); setShowManual(false) } }}
                    placeholder="e.g. Bbm7, F#aug, Gsus4"
                    className="manual-chord-input" />
                  <p className="picker-hint">Type any chord name for full flexibility</p>
                </div>
              ) : (
                <>
                  <div className="picker-row">
                    <span className="picker-label">Root</span>
                    <div className="picker-options">
                      {ROOT_NOTES.map(n => (
                        <button key={n} className={`picker-opt ${pickerRoot === n ? 'active' : ''}`}
                          onClick={() => setPickerRoot(n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="picker-row">
                    <span className="picker-label">Accidental</span>
                    <div className="picker-options">
                      {ACCIDENTALS.map(a => (
                        <button key={a.id} className={`picker-opt ${pickerAcc === a.id ? 'active' : ''}`}
                          onClick={() => setPickerAcc(a.id)}>{a.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="picker-row">
                    <span className="picker-label">Type</span>
                    <div className="picker-options picker-options-wrap">
                      {CHORD_TYPES.map(t => (
                        <button key={t.id} className={`picker-opt ${pickerType === t.id ? 'active' : ''}`}
                          onClick={() => setPickerType(t.id)}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="picker-actions">
                <button className="picker-apply" onClick={showManual ? applyManual : applyPicker}>Apply</button>
                <button className="picker-cancel" onClick={() => { setPickerTarget(null); setShowManual(false) }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isPlaying && (
          <div className="chord-progress-bar">
            <div className="chord-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Now Playing */}
        {isPlaying && currentChordIdx >= 0 && (
          <div className="chord-now-playing">
            <span className="now-label">Now Playing</span>
            <span className="now-chord">{nowPlaying}</span>
          </div>
        )}

        {/* Play + Volume */}
        <div className="chord-player-footer">
          <div className="volume-group">
            <button className={`cp-icon-btn ${playChordSound ? 'active' : ''}`}
              onClick={() => setPlayChordSound(!playChordSound)} title="Chords">🎸</button>
            <input type="range" min="0" max="100" value={chordVolume * 100}
              onChange={e => setChordVolume(Number(e.target.value) / 100)} className="cp-slider" />
          </div>
          <button className={`cp-play-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlayback}>
            {isPlaying ? '⏹ Stop' : '▶ Play'}
          </button>
          <div className="volume-group">
            <button className={`cp-icon-btn ${playDrums ? 'active' : ''}`}
              onClick={() => setPlayDrums(!playDrums)} title="Drums">🥁</button>
            <input type="range" min="0" max="100" value={drumVolume * 100}
              onChange={e => setDrumVolume(Number(e.target.value) / 100)} className="cp-slider" />
          </div>
        </div>

        {/* Presets */}
        <div className="chord-player-presets">
          <div className="presets-header">Common {STYLES[style].label} Progressions</div>
          <div className="presets-grid">
            {PROGRESSIONS[style].map((p, i) => (
              <button key={i} className="progression-btn" onClick={() => applyProgression(p.chords)} disabled={isPlaying}>
                <span className="progression-name">{p.name}</span>
                <span className="progression-chords">
                  {p.chords.map(c => transposeChord(c, (keyIdx) % 12)).join(' → ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
