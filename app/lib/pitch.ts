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
