// Note tracking for the fretboard's Listen feature. Runs on the audio thread so detection keeps
// pace with the guitar even when the page is busy rendering. Posts only when the held note changes.
// detectPitch mirrors app/lib/pitch.ts (worklets can't import app modules).

// A note must hold for ~30 ms before it's shown, which filters blips while one note fades into the next
const STABLE_S = 0.03
const RELEASE_SAMPLES_S = 0.25

// x holds the frame decimated by 2; rate2 is the decimated sample rate
function detectPitch(x, rate2, minHz, maxHz, d) {
  const half = x.length
  const minLag = Math.max(2, Math.floor(rate2 / maxHz))
  const maxLag = Math.min(Math.floor(rate2 / minHz), Math.floor(half / 2))
  const win = half - maxLag
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let sum = 0
    for (let j = 0; j < win; j++) {
      const diff = x[j] - x[j + lag]
      sum += diff * diff
    }
    d[lag] = sum
  }
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
  return rate2 / (denom !== 0 ? lag + (a - c) / (2 * denom) : lag)
}

class LiveNoteProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const { minHz, maxHz, windowSize } = options.processorOptions
    this.minHz = minHz
    this.maxHz = maxHz
    this.ring = new Float32Array(windowSize)
    this.frame = new Float32Array(windowSize)
    this.x = new Float32Array(windowSize >> 1)
    this.d = new Float32Array((windowSize >> 2) + 2)
    // Analyse 4 times per window: ~10 ms hops on guitar, ~21 ms on bass where windows are longer
    this.hop = windowSize >> 2
    this.stableReads = Math.max(2, Math.round((STABLE_S * sampleRate) / this.hop))
    this.write = 0
    this.sinceHop = 0
    this.filled = 0
    this.candidate = -1
    this.reads = 0
    this.held = -1
    this.silentFor = 0
    this.prevRms = 0
    this.onset = false
  }

  analyse() {
    const n = this.ring.length
    // Unroll the ring buffer, oldest sample first
    this.frame.set(this.ring.subarray(this.write))
    this.frame.set(this.ring.subarray(0, this.write), n - this.write)

    let tail = 0
    const hop = this.hop
    for (let i = n - hop; i < n; i++) tail += this.frame[i] * this.frame[i]
    const rms = Math.sqrt(tail / hop)
    // A sharp level jump is a new pick attack: forget reads from the previous note
    if (rms > 0.015 && rms > this.prevRms * 1.6) { this.onset = true; this.candidate = -1; this.reads = 0 }
    this.prevRms = this.prevRms * 0.7 + rms * 0.3

    let midi = -1
    if (rms > 0.006) {
      for (let i = 0; i < this.x.length; i++) this.x[i] = (this.frame[2 * i] + this.frame[2 * i + 1]) * 0.5
      const hz = detectPitch(this.x, sampleRate / 2, this.minHz, this.maxHz, this.d)
      if (hz > 0) midi = Math.round(69 + 12 * Math.log2(hz / 440))
    }

    if (midi >= 0) {
      this.reads = midi === this.candidate ? this.reads + 1 : 1
      this.candidate = midi
      if (this.reads >= this.stableReads) {
        this.silentFor = 0
        if (this.held !== midi || this.onset) {
          this.held = midi
          this.onset = false
          this.port.postMessage({ type: 'note', midi })
        }
        return
      }
    } else {
      this.candidate = -1
      this.reads = 0
    }
    if (this.held >= 0) {
      this.silentFor += this.hop / sampleRate
      if (this.silentFor > RELEASE_SAMPLES_S) {
        this.held = -1
        this.port.postMessage({ type: 'release' })
      }
    }
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    const n = this.ring.length
    for (let i = 0; i < ch.length; i++) {
      this.ring[this.write] = ch[i]
      this.write = (this.write + 1) % n
    }
    this.filled = Math.min(n, this.filled + ch.length)
    this.sinceHop += ch.length
    if (this.sinceHop >= this.hop && this.filled === n) {
      this.sinceHop = 0
      this.analyse()
    }
    return true
  }
}

registerProcessor('live-note', LiveNoteProcessor)
