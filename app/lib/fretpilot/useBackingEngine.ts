'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chordTonePcs, midiToFreq, parseChordSymbol } from './theory'
import type { BackingSpec } from './backingSpec'

type Drum = 'kick' | 'snare' | 'hat' | 'open'

function patternFor(style: BackingSpec['style']): Drum[][] {
  // 16 sixteenth-note slots per bar
  const empty = (): Drum[][] => Array.from({ length: 16 }, () => [])
  const p = empty()
  if (style === 'funk' || style === 'fusion') {
    ;[0, 6, 10, 14].forEach(i => p[i].push('kick'))
    ;[4, 12].forEach(i => p[i].push('snare'))
    for (let i = 0; i < 16; i++) p[i].push(i % 4 === 3 ? 'open' : 'hat')
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
  // rock / pop
  p[0].push('kick', 'hat')
  p[4].push('snare', 'hat')
  p[8].push('kick', 'hat')
  p[12].push('snare', 'hat')
  ;[2, 6, 10, 14].forEach(i => p[i].push('hat'))
  return p
}

function chordFreqs(symbol: string): number[] {
  const parsed = parseChordSymbol(symbol)
  if (!parsed) return []
  return chordTonePcs(parsed).map((pc, i) => midiToFreq(45 + pc + (i === 0 ? 0 : 12)))
}

export function useBackingEngine() {
  const [playing, setPlaying] = useState(false)
  const [chordIndex, setChordIndex] = useState(-1)
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number>(0)
  const stepRef = useRef(0)
  const specRef = useRef<BackingSpec | null>(null)
  const masterRef = useRef<GainNode | null>(null)

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current)
    masterRef.current?.gain.setTargetAtTime(0, ctxRef.current?.currentTime ?? 0, 0.03)
    setPlaying(false)
    setChordIndex(-1)
    stepRef.current = 0
  }, [])

  const getCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = 0.7
      master.connect(ctx.destination)
      ctxRef.current = ctx
      masterRef.current = master
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
    masterRef.current?.gain.setTargetAtTime(0.7, ctxRef.current.currentTime, 0.02)
    return ctxRef.current
  }, [])

  const beep = useCallback((ctx: AudioContext, dest: AudioNode, kind: Drum | 'bass' | 'stab', freq = 110, dur = 0.12, gain = 0.12) => {
    const now = ctx.currentTime
    if (kind === 'kick') {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.12)
      g.gain.setValueAtTime(0.55, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(g); g.connect(dest)
      osc.start(now); osc.stop(now + 0.2)
      return
    }
    if (kind === 'snare') {
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      noise.buffer = buf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1800
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.28, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
      noise.connect(bp); bp.connect(g); g.connect(dest)
      noise.start(now); noise.stop(now + 0.15)
      return
    }
    if (kind === 'hat' || kind === 'open') {
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      noise.buffer = buf
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 7000
      const g = ctx.createGain()
      const len = kind === 'open' ? 0.18 : 0.04
      g.gain.setValueAtTime(kind === 'open' ? 0.1 : 0.055, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + len)
      noise.connect(hp); hp.connect(g); g.connect(dest)
      noise.start(now); noise.stop(now + len)
      return
    }
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = kind === 'bass' ? 'sawtooth' : 'triangle'
    osc.frequency.value = freq
    filter.type = 'lowpass'
    filter.frequency.value = kind === 'bass' ? 420 : 1600
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.connect(filter); filter.connect(g); g.connect(dest)
    osc.start(now); osc.stop(now + dur + 0.02)
  }, [])

  const play = useCallback(async (spec: BackingSpec) => {
    specRef.current = spec
    const ctx = await getCtx()
    const dest = masterRef.current
    if (!dest) return
    window.clearTimeout(timerRef.current)
    stepRef.current = 0
    setPlaying(true)
    const pattern = patternFor(spec.style)
    const sixteenths = (60 / spec.bpm) / 4 * 1000
    const stepsPerChord = 16 * spec.barsPerChord

    const tick = () => {
      const current = specRef.current
      if (!current) return
      const step = stepRef.current
      const chordIdx = Math.floor(step / stepsPerChord) % current.chords.length
      const stepInBar = step % 16
      setChordIndex(chordIdx)
      const drums = pattern[stepInBar] ?? []
      for (const d of drums) beep(ctx, dest, d)
      const symbol = current.chords[chordIdx]
      const freqs = chordFreqs(symbol)
      if (stepInBar === 0 && freqs[0]) beep(ctx, dest, 'bass', freqs[0] / 2, 0.22, 0.16)
      if ((stepInBar === 6 || stepInBar === 10) && freqs[0]) beep(ctx, dest, 'bass', freqs[0] * (stepInBar === 10 ? 1 : 0.75), 0.1, 0.1)
      if (stepInBar === 0 || stepInBar === 6) {
        freqs.slice(0, 4).forEach((f, i) => beep(ctx, dest, 'stab', f, spec.style === 'funk' ? 0.14 : 0.28, 0.05 / (i + 1)))
      }
      stepRef.current = step + 1
      timerRef.current = window.setTimeout(tick, sixteenths)
    }
    tick()
  }, [beep, getCtx])

  useEffect(() => () => {
    stop()
    void ctxRef.current?.close()
    ctxRef.current = null
  }, [stop])

  return { playing, chordIndex, play, stop }
}
