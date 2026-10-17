'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chordTonePcs, midiToFreq, parseChordSymbol } from './theory'
import type { BackingSpec } from './backingSpec'

type Drum = 'kick' | 'snare' | 'hat' | 'open'

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

function patternFor(style: BackingSpec['style']): Drum[][] {
  const empty = (): Drum[][] => Array.from({ length: 16 }, () => [])
  const p = empty()
  if (style === 'funk' || style === 'fusion') {
    ;[0, 6, 10].forEach(i => p[i].push('kick'))
    ;[4, 12].forEach(i => p[i].push('snare'))
    for (let i = 0; i < 16; i++) {
      if (i % 2 === 0) p[i].push('hat')
      else if (i === 3 || i === 11) p[i].push('open')
      else p[i].push('hat')
    }
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

function voiceChord(symbol: string): { bass: number; stabs: number[] } {
  const parsed = parseChordSymbol(symbol)
  if (!parsed) return { bass: 0, stabs: [] }
  const pcs = chordTonePcs(parsed)
  const root = pcs[0] ?? 0
  const bassMidi = 33 + ((root - 9 + 12) % 12)
  const stabs = pcs.slice(0, 4).map((pc, i) => {
    let midi = 55 + ((pc - 7 + 12) % 12)
    if (i === 1) midi += 12
    if (i >= 2 && midi < 62) midi += 12
    if (midi > 76) midi -= 12
    return midiToFreq(midi)
  })
  return { bass: midiToFreq(bassMidi), stabs }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function impulseBuffer(ctx: AudioContext, seconds = 0.42): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6)
    }
  }
  return buffer
}

function envGain(ctx: AudioContext, dest: AudioNode, when: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain()
  g.connect(dest)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay)
  return g
}

interface Bus {
  drums: GainNode
  bass: GainNode
  stabs: GainNode
  master: GainNode
  noise: AudioBuffer
}

function playKick(ctx: AudioContext, dest: AudioNode, when: number) {
  const body = ctx.createOscillator()
  const bodyFilter = ctx.createBiquadFilter()
  const bodyGain = envGain(ctx, dest, when, 0.72, 0.006, 0.32)
  body.type = 'sine'
  body.frequency.setValueAtTime(148, when)
  body.frequency.exponentialRampToValueAtTime(46, when + 0.14)
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.value = 180
  body.connect(bodyFilter)
  bodyFilter.connect(bodyGain)
  body.start(when)
  body.stop(when + 0.34)

  const click = ctx.createOscillator()
  const clickGain = envGain(ctx, dest, when, 0.16, 0.001, 0.03)
  click.type = 'triangle'
  click.frequency.setValueAtTime(520, when)
  click.frequency.exponentialRampToValueAtTime(90, when + 0.028)
  click.connect(clickGain)
  click.start(when)
  click.stop(when + 0.04)
}

function playSnare(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer, when: number) {
  const tone = ctx.createOscillator()
  const toneFilter = ctx.createBiquadFilter()
  const toneGain = envGain(ctx, dest, when, 0.22, 0.003, 0.16)
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(198, when)
  tone.frequency.exponentialRampToValueAtTime(140, when + 0.08)
  toneFilter.type = 'lowpass'
  toneFilter.frequency.value = 900
  tone.connect(toneFilter)
  toneFilter.connect(toneGain)
  tone.start(when)
  tone.stop(when + 0.18)

  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  const bp = ctx.createBiquadFilter()
  const g = envGain(ctx, dest, when, 0.28, 0.002, 0.18)
  hp.type = 'highpass'
  hp.frequency.value = 900
  bp.type = 'bandpass'
  bp.frequency.value = 2200
  bp.Q.value = 0.9
  src.connect(hp)
  hp.connect(bp)
  bp.connect(g)
  src.start(when)
  src.stop(when + 0.2)
}

function playHat(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer, when: number, open: boolean) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  const peak = ctx.createBiquadFilter()
  const decay = open ? 0.2 : 0.045
  const g = envGain(ctx, dest, when, open ? 0.07 : 0.034, 0.001, decay)
  hp.type = 'highpass'
  hp.frequency.value = open ? 6200 : 7800
  hp.Q.value = 0.6
  peak.type = 'peaking'
  peak.frequency.value = 9000
  peak.Q.value = 1.6
  peak.gain.value = 4
  src.connect(hp)
  hp.connect(peak)
  peak.connect(g)
  src.start(when)
  src.stop(when + decay + 0.02)
}

function playBass(ctx: AudioContext, dest: AudioNode, when: number, freq: number, dur: number) {
  const filter = ctx.createBiquadFilter()
  const g = envGain(ctx, dest, when, 0.28, 0.012, dur)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(720, when)
  filter.frequency.exponentialRampToValueAtTime(180, when + dur * 0.7)
  filter.Q.value = 1.1
  filter.connect(g)

  const sine = ctx.createOscillator()
  sine.type = 'sine'
  sine.frequency.setValueAtTime(freq, when)
  sine.connect(filter)
  sine.start(when)
  sine.stop(when + dur + 0.03)

  const square = ctx.createOscillator()
  const squareGain = ctx.createGain()
  square.type = 'square'
  square.frequency.setValueAtTime(freq, when)
  squareGain.gain.value = 0.18
  square.connect(squareGain)
  squareGain.connect(filter)
  square.start(when)
  square.stop(when + dur + 0.03)
}

function playStab(ctx: AudioContext, dest: AudioNode, when: number, freqs: number[], style: BackingSpec['style']) {
  const short = style === 'funk' || style === 'fusion'
  const dur = short ? 0.16 : style === 'jazz' ? 0.42 : 0.28
  const filter = ctx.createBiquadFilter()
  const g = envGain(ctx, dest, when, 0.2, 0.008, dur)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(short ? 2400 : 1800, when)
  filter.frequency.exponentialRampToValueAtTime(short ? 700 : 900, when + dur * 0.65)
  filter.Q.value = 0.8
  filter.connect(g)

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const mix = ctx.createGain()
    osc.type = i === 0 ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(freq * (i === 2 ? 1.003 : 1), when)
    mix.gain.value = 0.55 / (i + 1)
    osc.connect(mix)
    mix.connect(filter)
    osc.start(when + i * 0.006)
    osc.stop(when + dur + 0.04)
  })
}

function connectBus(ctx: AudioContext): Bus {
  const master = ctx.createGain()
  master.gain.value = 0.78

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 38

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 18
  comp.ratio.value = 2.8
  comp.attack.value = 0.01
  comp.release.value = 0.16

  const limit = ctx.createDynamicsCompressor()
  limit.threshold.value = -2.5
  limit.knee.value = 0
  limit.ratio.value = 18
  limit.attack.value = 0.003
  limit.release.value = 0.08

  const verb = ctx.createConvolver()
  verb.buffer = impulseBuffer(ctx)
  const wet = ctx.createGain()
  wet.gain.value = 0.14

  master.connect(hp)
  hp.connect(comp)
  comp.connect(limit)
  limit.connect(ctx.destination)
  hp.connect(verb)
  verb.connect(wet)
  wet.connect(limit)

  const drums = ctx.createGain()
  drums.gain.value = 0.95
  drums.connect(master)
  const bass = ctx.createGain()
  bass.gain.value = 0.9
  bass.connect(master)
  const stabs = ctx.createGain()
  stabs.gain.value = 0.85
  stabs.connect(master)

  return { drums, bass, stabs, master, noise: noiseBuffer(ctx, 0.35) }
}

export function useBackingEngine() {
  const [playing, setPlaying] = useState(false)
  const [chordIndex, setChordIndex] = useState(-1)
  const ctxRef = useRef<AudioContext | null>(null)
  const busRef = useRef<Bus | null>(null)
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

  const getCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const ctx = new AudioContext()
      busRef.current = connectBus(ctx)
      ctxRef.current = ctx
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
    const bus = busRef.current
    if (bus) {
      bus.master.gain.cancelScheduledValues(ctxRef.current.currentTime)
      bus.master.gain.setTargetAtTime(0.78, ctxRef.current.currentTime, 0.02)
    }
    return ctxRef.current
  }, [])

  const play = useCallback(async (spec: BackingSpec) => {
    specRef.current = spec
    const ctx = await getCtx()
    const bus = busRef.current
    if (!bus) return
    window.clearTimeout(timerRef.current)
    stepRef.current = 0
    nextTimeRef.current = ctx.currentTime + 0.06
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
        if (d === 'kick') playKick(ctx, bus.drums, when)
        else if (d === 'snare') playSnare(ctx, bus.drums, bus.noise, when)
        else playHat(ctx, bus.drums, bus.noise, when, d === 'open')
      }
      if (voice.bass) {
        if (stepInBar === 0) playBass(ctx, bus.bass, when, voice.bass, 0.28)
        else if (stepInBar === 6) playBass(ctx, bus.bass, when, voice.bass * 1.5, 0.12)
        else if (stepInBar === 10) playBass(ctx, bus.bass, when, voice.bass, 0.14)
      }
      if (voice.stabs.length && (stepInBar === 0 || stepInBar === 6 || (current.style === 'funk' && stepInBar === 10))) {
        playStab(ctx, bus.stabs, when, voice.stabs, current.style)
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
