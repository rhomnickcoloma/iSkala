'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { detectLivePitch, rmsLevel } from './audio'
import type { DetectedNote, LivePitch } from './types'

interface Options {
  a4: number
  onConfirmedNote: (note: DetectedNote) => void
}

export function useGuitarInput({ a4, onConfirmedNote }: Options) {
  const [listening, setListening] = useState(false)
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const [live, setLive] = useState<LivePitch | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const onNoteRef = useRef(onConfirmedNote)
  const a4Ref = useRef(a4)
  const stableRef = useRef<{ midi: number; since: number; id: string } | null>(null)
  onNoteRef.current = onConfirmedNote
  a4Ref.current = a4

  const stopTracks = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    analyserRef.current = null
    void ctxRef.current?.close()
    ctxRef.current = null
    stableRef.current = null
    setLive(null)
    setLevel(0)
    setListening(false)
  }, [])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const ctx = ctxRef.current
    if (!analyser || !ctx) return
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    const rms = rmsLevel(buf)
    const pitch = detectLivePitch(buf, ctx.sampleRate, a4Ref.current)
    setLevel(Math.min(1, rms * 10))
    setLive(pitch)

    const now = performance.now()
    if (pitch && pitch.confidence >= 0.45 && pitch.quality !== 'weak') {
      const stable = stableRef.current
      if (!stable || stable.midi !== pitch.midi) {
        stableRef.current = { midi: pitch.midi, since: now, id: `mic-${now}` }
      } else if (now - stable.since > 90) {
        onNoteRef.current({
          id: stable.id,
          midi: pitch.midi,
          name: pitch.name,
          octave: pitch.octave,
          hz: pitch.hz,
          cents: pitch.cents,
          confidence: pitch.confidence,
          quality: pitch.quality,
          startedAt: stable.since,
          endedAt: now,
          source: 'mic',
          estimated: false,
        })
        stableRef.current = { midi: pitch.midi, since: now, id: `mic-${now}` }
      }
    } else {
      stableRef.current = null
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0
      source.connect(analyser)
      streamRef.current = stream
      ctxRef.current = ctx
      analyserRef.current = analyser
      setPermission('granted')
      setListening(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setPermission(denied ? 'denied' : 'unknown')
      setError(denied
        ? 'Microphone permission was denied. Allow it in the browser to listen.'
        : 'Could not open the microphone. Check the input device and try again.')
      stopTracks()
    }
  }, [stopTracks, tick])

  useEffect(() => () => stopTracks(), [stopTracks])

  return { listening, permission, error, level, live, start, stop: stopTracks }
}
