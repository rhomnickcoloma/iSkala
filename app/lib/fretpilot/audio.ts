import { autoCorrelate } from '../pitch'
import { midiToNote, nearestMidi } from './theory'
import type { LivePitch, SignalQuality } from './types'

export function rmsLevel(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}

export function qualityFromRms(rms: number): SignalQuality {
  if (rms < 0.008) return 'silent'
  if (rms < 0.02) return 'weak'
  if (rms < 0.08) return 'ok'
  return 'strong'
}

export function detectLivePitch(
  buffer: Float32Array,
  sampleRate: number,
  a4: number,
): LivePitch | null {
  const rms = rmsLevel(buffer)
  const quality = qualityFromRms(rms)
  if (quality === 'silent') return null

  const hz = autoCorrelate(buffer, sampleRate)
  if (hz < 70 || hz > 1400) return null

  const { midi, cents } = nearestMidi(hz, a4)
  if (midi < 36 || midi > 88) return null

  const note = midiToNote(midi)
  const centsPenalty = Math.min(1, Math.abs(cents) / 50)
  const rmsScore = Math.min(1, (rms - 0.008) / 0.08)
  const confidence = Math.max(0.15, Math.min(0.95, 0.35 + rmsScore * 0.45 + (1 - centsPenalty) * 0.25))

  return {
    hz,
    midi,
    name: note.name,
    octave: note.octave,
    cents,
    confidence: Number(confidence.toFixed(2)),
    quality,
    rms,
  }
}
