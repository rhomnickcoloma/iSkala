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

function voiceChord(symbol: string): { bass: number; tones: number[] } {
  const parsed = parseChordSymbol(symbol)
  if (!parsed) return { bass: 0, tones: [] }
  const pcs = chordTonePcs(parsed)
  const root = pcs[0] ?? 0
  const bassMidi = 33 + ((root - 9 + 12) % 12)
  // Close keyboard voicing around E3–A4 so the quality (m / 7) is obvious.
  const tones = pcs.slice(0, 4).map((pc, i) => {
    let midi = 52 + ((pc - 4 + 12) % 12)
    if (i > 0 && midi <= 54) midi += 12
    if (midi > 72) midi -= 12
    return midiToFreq(midi)
  })
  return { bass: midiToFreq(bassMidi), tones }
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
  chords: GainNode
  master: GainNode
  noise: AudioBuffer
}

interface HeldChord {
  oscs: OscillatorNode[]
  gain: GainNode
}

function playKick(ctx: AudioContext, dest: AudioNode, when: number) {
  const body = ctx.createOscillator()
  const bodyFilter = ctx.createBiquadFilter()
  const bodyGain = envGain(ctx, dest, when, 0.42, 0.006, 0.28)
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
  const g = envGain(ctx, dest, when, 0.18, 0.002, 0.16)
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
  const g = envGain(ctx, dest, when, open ? 0.045 : 0.02, 0.001, decay)
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
  const g = envGain(ctx, dest, when, 0.22, 0.012, dur)
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

function releaseHeld(ctx: AudioContext, held: HeldChord | null, when: number, fade = 0.07) {
  if (!held) return
  held.gain.gain.cancelScheduledValues(when)
  const current = Math.max(held.gain.gain.value, 0.0002)
  held.gain.gain.setValueAtTime(current, when)
  held.gain.gain.exponentialRampToValueAtTime(0.0001, when + fade)
  held.oscs.forEach(o => { try { o.stop(when + fade + 0.03) } catch { /* already stopped */ } })
}

function startHeldChord(ctx: AudioContext, dest: AudioNode, when: number, freqs: number[], dur: number): HeldChord {
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2600, when)
  filter.frequency.linearRampToValueAtTime(1900, when + 0.12)
  filter.Q.value = 0.7
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(0.62, when + 0.025)
  gain.gain.linearRampToValueAtTime(0.5, when + Math.min(0.18, dur * 0.2))
  gain.gain.setValueAtTime(0.5, when + Math.max(0.2, dur - 0.12))
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  filter.connect(gain)
  gain.connect(dest)

  const oscs: OscillatorNode[] = []
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const mix = ctx.createGain()
    osc.type = i % 2 === 0 ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(freq, when)
    mix.gain.value = 0.9 / Math.sqrt(freqs.length)
    osc.connect(mix)
    mix.connect(filter)
    osc.start(when)
    osc.stop(when + dur + 0.04)
    oscs.push(osc)

    const detune = ctx.createOscillator()
    const detuneMix = ctx.createGain()
    detune.type = 'triangle'
    detune.frequency.setValueAtTime(freq * 1.004, when)
    detuneMix.gain.value = 0.22 / freqs.length
    detune.connect(detuneMix)
    detuneMix.connect(filter)
    detune.start(when)
    detune.stop(when + dur + 0.04)
    oscs.push(detune)
  })
  return { oscs, gain }
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
  drums.gain.value = 0.55
  drums.connect(master)
  const bass = ctx.createGain()
  bass.gain.value = 0.7
  bass.connect(master)
  const chords = ctx.createGain()
  chords.gain.value = 1.15
  chords.connect(master)

  return { drums, bass, chords, master, noise: noiseBuffer(ctx, 0.35) }
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
  const heldRef = useRef<HeldChord | null>(null)
  const lastChordRef = useRef('')

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current)
    const ctx = ctxRef.current
    const bus = busRef.current
    if (ctx && bus) {
      releaseHeld(ctx, heldRef.current, ctx.currentTime, 0.05)
      heldRef.current = null
      bus.master.gain.cancelScheduledValues(ctx.currentTime)
      bus.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03)
    }
    lastChordRef.current = ''
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
      const symbol = current.chords[chordIdx] ?? ''
      const voice = voiceChord(symbol)
      for (const d of pattern[stepInBar] ?? []) {
        if (d === 'kick') playKick(ctx, bus.drums, when)
        else if (d === 'snare') playSnare(ctx, bus.drums, bus.noise, when)
        else playHat(ctx, bus.drums, bus.noise, when, d === 'open')
      }
      if (voice.bass) {
        if (stepInBar === 0) playBass(ctx, bus.bass, when, voice.bass, 0.32)
        else if (stepInBar === 6) playBass(ctx, bus.bass, when, voice.bass * 1.5, 0.12)
        else if (stepInBar === 10) playBass(ctx, bus.bass, when, voice.bass, 0.14)
      }
      const chordChanged = symbol !== lastChordRef.current
      if (voice.tones.length && (chordChanged || step % stepsPerChord === 0)) {
        lastChordRef.current = symbol
        releaseHeld(ctx, heldRef.current, when, 0.06)
        const hold = stepsPerChord * sixteenths - 0.04
        heldRef.current = startHeldChord(ctx, bus.chords, when, voice.tones, Math.max(0.35, hold))
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
