'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const TRAIL_MS = 1500
const TRAIL_MAX = 8
const MAX_HZ = 1400

export interface LiveNote {
  midi: number
  name: string
}

export interface TrailNote extends LiveNote {
  id: number
  at: number
}

export interface LiveSnapshot {
  note: LiveNote | null
  trail: TrailNote[]
}

const EMPTY: LiveSnapshot = { note: null, trail: [] }

export function noteNameToMidi(note: string): number | null {
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return null
  return (Number(m[2]) + 1) * 12 + NOTE_NAMES.indexOf(m[1])
}

const midiName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

// Mic pitch tracking. Notes go to an external store so only the components that subscribe
// (the highlight layer and the Listen button) re-render, not the whole fretboard.
// lowestHz should be the instrument's lowest open string: a tight range stops two ringing
// notes being read as their much lower common pitch, and lets guitar use a shorter, faster window.
export function useLiveNote(lowestHz: number) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pruneRef = useRef(0)
  const snapshotRef = useRef<LiveSnapshot>(EMPTY)
  const listenersRef = useRef(new Set<() => void>())
  const lowestHzRef = useRef(lowestHz)
  lowestHzRef.current = lowestHz

  const publish = useCallback((next: LiveSnapshot) => {
    snapshotRef.current = next
    listenersRef.current.forEach(l => l())
  }, [])

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)
    return () => { listenersRef.current.delete(listener) }
  }, [])
  const getSnapshot = useCallback(() => snapshotRef.current, [])

  const stop = useCallback(() => {
    clearTimeout(pruneRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    void ctxRef.current?.close()
    ctxRef.current = null
    publish(EMPTY)
    setListening(false)
  }, [publish])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      if (ctx.state === 'suspended') await ctx.resume()
      const minHz = lowestHzRef.current * 0.85
      // The pitch search halves the window and needs two periods of the lowest note to fit
      const windowSize = minHz * 2048 >= ctx.sampleRate * 2 ? 2048 : 4096
      await ctx.audioWorklet.addModule('/worklets/live-note.js')
      const node = new AudioWorkletNode(ctx, 'live-note', {
        numberOfOutputs: 0,
        processorOptions: { minHz, maxHz: MAX_HZ, windowSize },
      })
      ctx.createMediaStreamSource(stream).connect(node)
      streamRef.current = stream
      ctxRef.current = ctx
      setListening(true)

      let nextId = 1
      const prune = () => {
        const now = performance.now()
        const snap = snapshotRef.current
        const trail = snap.trail.filter(t => now - t.at < TRAIL_MS)
        if (trail.length !== snap.trail.length) publish({ ...snap, trail })
        if (trail.length) pruneRef.current = window.setTimeout(prune, 250)
      }

      node.port.onmessage = (e: MessageEvent<{ type: 'note'; midi: number } | { type: 'release' }>) => {
        const msg = e.data
        if (msg.type === 'release') {
          publish({ ...snapshotRef.current, note: null })
          return
        }
        const now = performance.now()
        const note = { midi: msg.midi, name: midiName(msg.midi) }
        const trail = [...snapshotRef.current.trail.filter(t => now - t.at < TRAIL_MS), { ...note, id: nextId++, at: now }].slice(-TRAIL_MAX)
        publish({ note, trail })
        clearTimeout(pruneRef.current)
        pruneRef.current = window.setTimeout(prune, 250)
      }
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setError(denied ? 'Microphone access was blocked. Allow it in your browser to listen.' : 'Could not open the microphone.')
      stop()
    }
  }, [stop, publish])

  useEffect(() => stop, [stop])

  // Switching instrument changes the pitch range and window size, so restart if listening
  const lowestRef = useRef(lowestHz)
  useEffect(() => {
    if (lowestRef.current === lowestHz) return
    lowestRef.current = lowestHz
    if (ctxRef.current) { stop(); void start() }
  }, [lowestHz, start, stop])

  return { listening, error, start, stop, subscribe, getSnapshot }
}

export type LiveNoteEngine = ReturnType<typeof useLiveNote>

export function useLiveSnapshot(live: LiveNoteEngine): LiveSnapshot {
  return useSyncExternalStore(live.subscribe, live.getSnapshot, () => EMPTY)
}
