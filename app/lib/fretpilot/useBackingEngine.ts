'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chordTonePcs, parseChordSymbol } from './theory'
import type { BackingSpec } from './backingSpec'

type Drum = 'kick' | 'snare' | 'hat' | 'open'

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12
const FLAT_NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

function midiToFile(midi: number): string {
  return `${FLAT_NOTE[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

function patternFor(style: BackingSpec['style']): Drum[][] {
  const empty = (): Drum[][] => Array.from({ length: 16 }, () => [])
  const p = empty()
  if (style === 'funk' || style === 'fusion') {
    ;[0, 6, 10].forEach(i => p[i].push('kick'))
    ;[4, 12].forEach(i => p[i].push('snare'))
    for (let i = 0; i < 16; i++) p[i].push(i === 3 || i === 11 ? 'open' : 'hat')
    return p
  }
  if (style === 'jazz') {
    p[0].push('kick')
    p[4].push('hat')
    p[8].push('kick', 'open')
    p[12].push('hat')
    return p
  }
  if (style === 'reggae') {
    p[4].push('kick', 'snare')
    p[12].push('snare')
    for (let i = 0; i < 16; i += 2) p[i].push(i % 4 === 2 ? 'open' : 'hat')
    return p
  }
  if (style === 'blues') {
    p[0].push('kick')
    p[4].push('snare', 'hat')
    p[8].push('kick')
    p[12].push('snare', 'open')
    ;[2, 6, 10, 14].forEach(i => p[i].push('hat'))
    return p
  }
  p[0].push('kick', 'hat')
  p[4].push('snare', 'hat')
  p[8].push('kick', 'hat')
  p[12].push('snare', 'hat')
  ;[2, 6, 10, 14].forEach(i => p[i].push('hat'))
  return p
}

function voiceChord(symbol: string): { bassMidi: number; toneMidis: number[] } {
  const parsed = parseChordSymbol(symbol)
  if (!parsed) return { bassMidi: 0, toneMidis: [] }
  const pcs = chordTonePcs(parsed)
  const root = pcs[0] ?? 0
  const bassMidi = 33 + ((root - 9 + 12) % 12)
  const toneMidis = pcs.slice(0, 4).map((pc, i) => {
    let midi = 52 + ((pc - 4 + 12) % 12)
    if (i > 0 && midi <= 54) midi += 12
    if (midi > 72) midi -= 12
    return midi
  })
  return { bassMidi, toneMidis }
}

interface Bus {
  drums: GainNode
  bass: GainNode
  chords: GainNode
  master: GainNode
}

function connectBus(ctx: AudioContext): Bus {
  const master = ctx.createGain()
  master.gain.value = 0.9
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 35
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 12
  comp.ratio.value = 2.4
  comp.attack.value = 0.012
  comp.release.value = 0.18
  master.connect(hp)
  hp.connect(comp)
  comp.connect(ctx.destination)

  const drums = ctx.createGain()
  drums.gain.value = 0.55
  drums.connect(master)
  const bass = ctx.createGain()
  bass.gain.value = 0.85
  bass.connect(master)
  const chords = ctx.createGain()
  chords.gain.value = 1.2
  chords.connect(master)
  return { drums, bass, chords, master }
}

function playSample(
  ctx: AudioContext,
  dest: AudioNode,
  buffer: AudioBuffer | undefined,
  when: number,
  gain: number,
  dur?: number,
) {
  if (!buffer) return
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  src.buffer = buffer
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.012)
  if (dur && dur > 0.05) {
    g.gain.setValueAtTime(gain, when + Math.max(0.05, dur - 0.08))
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.start(when)
    src.stop(when + dur + 0.02)
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, when + buffer.duration)
    src.start(when)
    src.stop(when + buffer.duration + 0.01)
  }
  src.connect(g)
  g.connect(dest)
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await ctx.decodeAudioData(await res.arrayBuffer())
  } catch {
    return null
  }
}

export function useBackingEngine() {
  const [playing, setPlaying] = useState(false)
  const [chordIndex, setChordIndex] = useState(-1)
  const ctxRef = useRef<AudioContext | null>(null)
  const busRef = useRef<Bus | null>(null)
  const samplesRef = useRef<Map<string, AudioBuffer>>(new Map())
  const loadedRef = useRef(false)
  const timerRef = useRef<number>(0)
  const stepRef = useRef(0)
  const nextTimeRef = useRef(0)
  const specRef = useRef<BackingSpec | null>(null)

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current)
    const ctx = ctxRef.current
    const bus = busRef.current
    if (ctx && bus) {
      bus.master.gain.cancelScheduledValues(ctx.currentTime)
      bus.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03)
    }
    setPlaying(false)
    setChordIndex(-1)
    stepRef.current = 0
  }, [])

  const ensureSamples = useCallback(async (ctx: AudioContext) => {
    if (loadedRef.current) return
    const jobs: Promise<void>[] = []
    const add = (key: string, url: string) => {
      jobs.push(loadBuffer(ctx, url).then(buf => {
        if (buf) samplesRef.current.set(key, buf)
      }))
    }
    add('kick', '/backing-samples/drums/kick.mp3')
    add('snare', '/backing-samples/drums/snare.mp3')
    add('hat', '/backing-samples/drums/hihat.mp3')
    for (let midi = 33; midi <= 45; midi++) add(`bass:${midi}`, `/backing-samples/bass/${midiToFile(midi)}.mp3`)
    for (let midi = 52; midi <= 72; midi++) add(`ep:${midi}`, `/backing-samples/ep/${midiToFile(midi)}.mp3`)
    await Promise.all(jobs)
    loadedRef.current = true
  }, [])

  const getCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = new AudioContext()
      busRef.current = connectBus(ctx)
      ctxRef.current = ctx
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
    await ensureSamples(ctxRef.current)
    const bus = busRef.current
    if (bus) {
      bus.master.gain.cancelScheduledValues(ctxRef.current.currentTime)
      bus.master.gain.setTargetAtTime(0.9, ctxRef.current.currentTime, 0.02)
    }
    return ctxRef.current
  }, [ensureSamples])

  const play = useCallback(async (spec: BackingSpec) => {
    specRef.current = spec
    const ctx = await getCtx()
    const bus = busRef.current
    const samples = samplesRef.current
    if (!bus) return
    window.clearTimeout(timerRef.current)
    stepRef.current = 0
    nextTimeRef.current = ctx.currentTime + 0.08
    setPlaying(true)
    const pattern = patternFor(spec.style)
    const sixteenths = (60 / spec.bpm) / 4
    const stepsPerChord = 16 * spec.barsPerChord

    const schedule = (when: number, step: number) => {
      const current = specRef.current
      if (!current) return
      const chordIdx = Math.floor(step / stepsPerChord) % current.chords.length
      const stepInBar = step % 16
      if (stepInBar === 0 || step % 4 === 0) setChordIndex(chordIdx)
      const voice = voiceChord(current.chords[chordIdx] ?? '')
      for (const d of pattern[stepInBar] ?? []) {
        if (d === 'kick') playSample(ctx, bus.drums, samples.get('kick'), when, 0.95)
        else if (d === 'snare') playSample(ctx, bus.drums, samples.get('snare'), when, 0.72)
        else playSample(ctx, bus.drums, samples.get('hat'), when, d === 'open' ? 0.38 : 0.2)
      }
      if (voice.bassMidi) {
        const bassBuf = samples.get(`bass:${voice.bassMidi}`) ?? samples.get(`bass:${voice.bassMidi + 12}`)
        if (stepInBar === 0) playSample(ctx, bus.bass, bassBuf, when, 0.95, 0.36)
        else if (stepInBar === 6) playSample(ctx, bus.bass, bassBuf, when, 0.55, 0.14)
        else if (stepInBar === 10) playSample(ctx, bus.bass, bassBuf, when, 0.7, 0.16)
      }
      if (voice.toneMidis.length && stepInBar === 0) {
        const barDur = 16 * sixteenths - 0.03
        const accent = step % stepsPerChord === 0 ? 0.95 : 0.72
        voice.toneMidis.forEach((midi, i) => {
          playSample(ctx, bus.chords, samples.get(`ep:${midi}`), when + i * 0.008, accent / Math.sqrt(voice.toneMidis.length), barDur)
        })
      }
    }

    const tick = () => {
      if (!specRef.current) return
      while (nextTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
        schedule(nextTimeRef.current, stepRef.current)
        stepRef.current += 1
        nextTimeRef.current += sixteenths
      }
      timerRef.current = window.setTimeout(tick, LOOKAHEAD_MS)
    }
    tick()
  }, [getCtx])

  useEffect(() => () => {
    stop()
    void ctxRef.current?.close()
    ctxRef.current = null
    busRef.current = null
  }, [stop])

  return { playing, chordIndex, play, stop }
}
