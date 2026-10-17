// All chromatic notes with frequencies for detection
const NOTE_FREQUENCIES: { note: string; frequency: number }[] = []

// Generate all notes from C0 to B8 (scientific pitch notation, so bass B0 and guitar E2 match tunerStrings)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for (let octave = 0; octave <= 8; octave++) {
  for (let i = 0; i < NOTE_NAMES.length; i++) {
    const noteIndex = (octave - 4) * 12 + i - 9 // A4 = 440Hz is index 0
    const frequency = 440 * Math.pow(2, noteIndex / 12)
    NOTE_FREQUENCIES.push({
      note: `${NOTE_NAMES[i]}${octave}`,
      frequency: frequency
    })
  }
}

// Find closest note to a frequency
export function getClosestNote(frequency: number): { note: string; targetFreq: number; cents: number } {
  let closestNote = NOTE_FREQUENCIES[0]
  let minDiff = Math.abs(frequency - closestNote.frequency)
  
  for (const noteData of NOTE_FREQUENCIES) {
    const diff = Math.abs(frequency - noteData.frequency)
    if (diff < minDiff) {
      minDiff = diff
      closestNote = noteData
    }
  }
  
  // Calculate cents (100 cents = 1 semitone)
  const cents = 1200 * Math.log2(frequency / closestNote.frequency)
  
  return {
    note: closestNote.note,
    targetFreq: closestNote.frequency,
    cents: Math.round(cents)
  }
}

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// YIN pitch detection with parabolic interpolation. Returns Hz, or -1 when there is no clear pitch.
// Input is decimated by 2 first so a 4096-sample buffer stays cheap while still reaching low B (~31 Hz).
export function detectPitch(buffer: Float32Array, sampleRate: number, minHz = 28, maxHz = 1400): number {
  let rms = 0
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i]
  if (Math.sqrt(rms / buffer.length) < 0.008) return -1

  const half = buffer.length >> 1
  const x = new Float32Array(half)
  for (let i = 0; i < half; i++) x[i] = (buffer[2 * i] + buffer[2 * i + 1]) * 0.5
  const rate = sampleRate / 2

  const minLag = Math.max(2, Math.floor(rate / maxHz))
  const maxLag = Math.min(Math.floor(rate / minHz), Math.floor(half / 2))
  const window = half - maxLag
  const d = new Float32Array(maxLag + 2)
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let sum = 0
    for (let j = 0; j < window; j++) {
      const diff = x[j] - x[j + lag]
      sum += diff * diff
    }
    d[lag] = sum
  }
  // Cumulative mean normalised difference
  d[0] = 1
  let running = 0
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    running += d[lag]
    d[lag] = running > 0 ? (d[lag] * lag) / running : 1
  }

  let lag = -1
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < 0.15) {
      while (t + 1 <= maxLag && d[t + 1] < d[t]) t++
      lag = t
      break
    }
  }
  if (lag < 0) return -1

  const a = d[lag - 1], b = d[lag], c = d[lag + 1]
  const denom = a - 2 * b + c
  const refined = denom !== 0 ? lag + (a - c) / (2 * denom) : lag
  return rate / refined
}

export interface TunerReading { note: string; cents: number; hz: number }

// Turns noisy per-frame pitch into a steady tuner reading: median filter, outlier rejection,
// exponential smoothing, and note hysteresis so the label doesn't flip at ±50¢.
export function createTunerSmoother() {
  const history: number[] = []
  let smoothed: number | null = null
  let shownMidi: number | null = null
  let pending: number[] = []

  const reset = () => { history.length = 0; smoothed = null; shownMidi = null; pending = [] }

  const push = (hz: number): TunerReading | null => {
    const m = 69 + 12 * Math.log2(hz / 440)
    if (history.length) {
      const med = median(history)
      if (Math.abs(m - med) > 0.7) {
        // A jump of more than ~70¢ is either a glitch or a new string: require 3 agreeing reads
        pending.push(m)
        if (pending.length < 3 || Math.abs(Math.max(...pending) - Math.min(...pending)) > 0.5) {
          if (pending.length >= 3) pending.shift()
          return current()
        }
        history.length = 0
        history.push(...pending)
        smoothed = median(pending)
        shownMidi = null
        pending = []
        return current()
      }
    }
    pending = []
    history.push(m)
    if (history.length > 7) history.shift()
    const target = median(history)
    smoothed = smoothed === null ? target : smoothed + (target - smoothed) * 0.35
    return current()
  }

  const current = (): TunerReading | null => {
    if (smoothed === null) return null
    if (shownMidi === null || Math.abs(smoothed - shownMidi) > 0.6) shownMidi = Math.round(smoothed)
    const cents = Math.max(-50, Math.min(50, Math.round((smoothed - shownMidi) * 100)))
    const note = `${NOTE_LETTERS[((shownMidi % 12) + 12) % 12]}${Math.floor(shownMidi / 12) - 1}`
    return { note, cents, hz: 440 * Math.pow(2, (smoothed - 69) / 12) }
  }

  return { push, reset }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Autocorrelation pitch detection
export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length
  const MAX_SAMPLES = Math.floor(SIZE / 2)
  let bestOffset = -1
  let bestCorrelation = 0
  let rms = 0
  let foundGoodCorrelation = false
  
  // Calculate RMS (volume level)
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i]
    rms += val * val
  }
  rms = Math.sqrt(rms / SIZE)
  
  // Not enough signal
  if (rms < 0.01) return -1
  
  let lastCorrelation = 1
  
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0
    
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset])
    }
    
    correlation = 1 - correlation / MAX_SAMPLES
    
    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestOffset = offset
      }
    } else if (foundGoodCorrelation) {
      // We've found a good correlation, then a bad one, so we're done
      const shift = (buffer[bestOffset - 1] - buffer[bestOffset + 1]) / buffer[bestOffset]
      return sampleRate / (bestOffset + 8 * shift)
    }
    
    lastCorrelation = correlation
  }
  
  if (bestCorrelation > 0.01) {
    return sampleRate / bestOffset
  }
  
  return -1
}
