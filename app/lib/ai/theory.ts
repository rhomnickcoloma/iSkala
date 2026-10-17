/** FretWiki AI music-theory engine. Pure functions, no LLM, no DOM. */

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export const INTERVAL_NAMES: Record<number, string> = {
  0: 'unison / root',
  1: 'minor 2nd (♭2)',
  2: 'major 2nd (2)',
  3: 'minor 3rd (♭3)',
  4: 'major 3rd (3)',
  5: 'perfect 4th (4)',
  6: 'tritone (♭5/#4)',
  7: 'perfect 5th (5)',
  8: 'minor 6th (♭6)',
  9: 'major 6th (6)',
  10: 'minor 7th (♭7)',
  11: 'major 7th (7)',
}

export const INTERVAL_SHORT: Record<number, string> = {
  0: 'R',
  1: '♭2',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
}

export type ScaleId =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues'

export interface ScaleDef {
  id: ScaleId
  name: string
  intervals: number[]
  characteristic: number
  characteristicName: string
  parentDegree: number
  isMode: boolean
}

/** Church modes are defined from the tonal center, not as a rotated C-major box. */
export const SCALES: Record<ScaleId, ScaleDef> = {
  ionian: {
    id: 'ionian',
    name: 'Ionian (major)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    characteristic: 4,
    characteristicName: 'major 3rd',
    parentDegree: 0,
    isMode: true,
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    characteristic: 9,
    characteristicName: 'natural 6th',
    parentDegree: 1,
    isMode: true,
  },
  phrygian: {
    id: 'phrygian',
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    characteristic: 1,
    characteristicName: 'flat 2nd',
    parentDegree: 2,
    isMode: true,
  },
  lydian: {
    id: 'lydian',
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    characteristic: 6,
    characteristicName: 'raised 4th',
    parentDegree: 3,
    isMode: true,
  },
  mixolydian: {
    id: 'mixolydian',
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    characteristic: 10,
    characteristicName: 'flat 7th',
    parentDegree: 4,
    isMode: true,
  },
  aeolian: {
    id: 'aeolian',
    name: 'Aeolian (natural minor)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    characteristic: 8,
    characteristicName: 'flat 6th',
    parentDegree: 5,
    isMode: true,
  },
  locrian: {
    id: 'locrian',
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    characteristic: 6,
    characteristicName: 'flat 5th',
    parentDegree: 6,
    isMode: true,
  },
  'major-pentatonic': {
    id: 'major-pentatonic',
    name: 'Major pentatonic',
    intervals: [0, 2, 4, 7, 9],
    characteristic: 4,
    characteristicName: 'major 3rd',
    parentDegree: 0,
    isMode: false,
  },
  'minor-pentatonic': {
    id: 'minor-pentatonic',
    name: 'Minor pentatonic',
    intervals: [0, 3, 5, 7, 10],
    characteristic: 3,
    characteristicName: 'minor 3rd',
    parentDegree: 0,
    isMode: false,
  },
  blues: {
    id: 'blues',
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    characteristic: 6,
    characteristicName: 'blue note (♭5)',
    parentDegree: 0,
    isMode: false,
  },
}

export const MODE_IDS: ScaleId[] = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
]

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | '7' | 'maj7' | 'min7' | 'm7b5'

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
}

export const CHORD_ROLE: Record<number, 'root' | 'third' | 'fifth' | 'seventh'> = {
  0: 'root',
  3: 'third',
  4: 'third',
  6: 'fifth',
  7: 'fifth',
  8: 'fifth',
  10: 'seventh',
  11: 'seventh',
}

export interface ParsedChord {
  symbol: string
  root: string
  rootPc: number
  quality: ChordQuality
  bass: string | null
  bassPc: number | null
}

export interface GuitarTuning {
  id: string
  label: string
  midi: number[]
  names: string[]
}

/** Open-string MIDI for common guitar tunings (low E to high E). */
export const GUITAR_TUNINGS: GuitarTuning[] = [
  { id: 'standard', label: 'Standard (E A D G B E)', midi: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'] },
  { id: 'drop-d', label: 'Drop D (D A D G B E)', midi: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'] },
  { id: 'eb', label: 'E♭ (E♭ A♭ D♭ G♭ B♭ E♭)', midi: [39, 44, 49, 54, 58, 63], names: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'] },
  { id: 'dadgad', label: 'DADGAD', midi: [38, 45, 50, 55, 57, 62], names: ['D', 'A', 'D', 'G', 'A', 'D'] },
]

export function wrapPc(n: number): number {
  return ((n % 12) + 12) % 12
}

export function nameToPc(name: string): number | null {
  const raw = name.trim().replace('♯', '#').replace('♭', 'b')
  const map: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5,
    F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10,
    B: 11, Cb: 11, 'B#': 0,
  }
  if (raw in map) return map[raw]
  const letter = raw.charAt(0).toUpperCase() + raw.slice(1)
  return letter in map ? map[letter] : null
}

export function pcToName(pc: number, preferFlats = false): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES
  return names[wrapPc(pc)]
}

export function midiToNote(midi: number, preferFlats = false): { name: string; octave: number; pc: number } {
  const pc = wrapPc(midi)
  const octave = Math.floor(midi / 12) - 1
  return { name: pcToName(pc, preferFlats), octave, pc }
}

export function noteToMidi(name: string, octave: number): number | null {
  const pc = nameToPc(name)
  if (pc === null) return null
  return (octave + 1) * 12 + pc
}

export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4)
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

export function nearestMidi(freq: number, a4 = 440): { midi: number; cents: number } {
  const raw = freqToMidi(freq, a4)
  const midi = Math.round(raw)
  const cents = Math.round((raw - midi) * 100)
  return { midi, cents }
}

export function enharmonicPair(pc: number): string {
  const sharp = SHARP_NAMES[wrapPc(pc)]
  const flat = FLAT_NAMES[wrapPc(pc)]
  return sharp === flat ? sharp : `${sharp}/${flat}`
}

export function intervalSemitones(fromPc: number, toPc: number): number {
  return wrapPc(toPc - fromPc)
}

export function intervalName(fromPc: number, toPc: number): string {
  return INTERVAL_NAMES[intervalSemitones(fromPc, toPc)]
}

export function scalePitchClasses(rootPc: number, scaleId: ScaleId): number[] {
  return SCALES[scaleId].intervals.map(i => wrapPc(rootPc + i))
}

export function scaleNoteNames(root: string, scaleId: ScaleId, preferFlats = false): string[] {
  const rootPc = nameToPc(root)
  if (rootPc === null) return []
  return scalePitchClasses(rootPc, scaleId).map(pc => pcToName(pc, preferFlats))
}

/** Parent major tonic of a church mode, e.g. D Dorian → C major. */
export function parentMajorRoot(tonalCenterPc: number, scaleId: ScaleId): number {
  const def = SCALES[scaleId]
  const ionianIntervals = SCALES.ionian.intervals
  const offset = ionianIntervals[def.parentDegree] ?? 0
  return wrapPc(tonalCenterPc - offset)
}

export function sharedPitchClasses(a: number[], b: number[]): number[] {
  const setB = new Set(b.map(wrapPc))
  return [...new Set(a.map(wrapPc))].filter(pc => setB.has(pc))
}

export function parseChordSymbol(raw: string): ParsedChord | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const [main, bassRaw] = trimmed.split('/')
  const m = main.trim().match(/^([A-Ga-g])([#b♯♭]?)(.*)$/)
  if (!m) return null
  const root = `${m[1].toUpperCase()}${m[2].replace('♯', '#').replace('♭', 'b')}`
  const rootPc = nameToPc(root)
  if (rootPc === null) return null

  const qualRaw = m[3].trim().toLowerCase().replace(/maj/g, 'maj').replace(/min/g, 'min')
  let quality: ChordQuality = 'maj'
  if (/^(m7b5|min7b5|ø|ø7|m7♭5)$/.test(qualRaw)) quality = 'm7b5'
  else if (/^(maj7|ma7|Δ|Δ7|m7\+|major7)$/.test(qualRaw)) quality = 'maj7'
  else if (/^(m7|min7|mi7|-7)$/.test(qualRaw)) quality = 'min7'
  else if (/^(7)$/.test(qualRaw)) quality = '7'
  else if (/^(dim|o|°|dim7)$/.test(qualRaw)) quality = 'dim'
  else if (/^(aug|\+|(\+5))$/.test(qualRaw)) quality = 'aug'
  else if (/^(m|min|mi|-)$/.test(qualRaw)) quality = 'min'
  else if (qualRaw === '' || /^(maj|major|M)$/.test(qualRaw)) quality = 'maj'
  else if (/^m/.test(qualRaw)) quality = qualRaw.includes('7') ? 'min7' : 'min'
  else if (qualRaw.includes('7') && (qualRaw.includes('maj') || qualRaw.includes('Δ'))) quality = 'maj7'
  else if (qualRaw.includes('7')) quality = '7'

  let bass: string | null = null
  let bassPc: number | null = null
  if (bassRaw) {
    const bm = bassRaw.trim().match(/^([A-Ga-g])([#b♯♭]?)/)
    if (bm) {
      bass = `${bm[1].toUpperCase()}${bm[2].replace('♯', '#').replace('♭', 'b')}`
      bassPc = nameToPc(bass)
    }
  }

  return { symbol: trimmed, root, rootPc, quality, bass, bassPc }
}

export function parseProgression(input: string): ParsedChord[] {
  const chunks = input
    .split(/[–—,\n]|-(?=[A-G])|\s+/g)
    .map(s => s.trim())
    .filter(Boolean)
  const out: ParsedChord[] = []
  for (const chunk of chunks) {
    const parsed = parseChordSymbol(chunk)
    if (parsed) out.push(parsed)
  }
  return out
}

export function chordTonePcs(chord: ParsedChord): number[] {
  return CHORD_INTERVALS[chord.quality].map(i => wrapPc(chord.rootPc + i))
}

export function chordToneNames(chord: ParsedChord, preferFlats = false): string[] {
  return chordTonePcs(chord).map(pc => pcToName(pc, preferFlats))
}

export function noteRoleAgainstChord(notePc: number, chord: ParsedChord): {
  role: 'root' | 'third' | 'fifth' | 'seventh' | 'tension' | 'outside'
  stable: boolean
  interval: number
  short: string
} {
  const interval = intervalSemitones(chord.rootPc, notePc)
  const tones = new Set(CHORD_INTERVALS[chord.quality])
  if (tones.has(interval)) {
    const role = CHORD_ROLE[interval] ?? 'tension'
    return { role, stable: true, interval, short: INTERVAL_SHORT[interval] }
  }
  const mildTension = new Set([2, 5, 9])
  if (mildTension.has(interval)) {
    return { role: 'tension', stable: false, interval, short: INTERVAL_SHORT[interval] }
  }
  return { role: 'outside', stable: false, interval, short: INTERVAL_SHORT[interval] }
}

export function targetNotesForChord(chord: ParsedChord, preferFlats = false): { note: string; role: string }[] {
  return chordTonePcs(chord).map(pc => {
    const interval = intervalSemitones(chord.rootPc, pc)
    return { note: pcToName(pc, preferFlats), role: CHORD_ROLE[interval] ?? 'tone' }
  })
}

/** Nearest chord-tone resolutions from one chord to the next (simple voice leading). */
export function voiceLead(from: ParsedChord, to: ParsedChord, preferFlats = false): { from: string; to: string; semitones: number }[] {
  const fromPcs = chordTonePcs(from)
  const toPcs = chordTonePcs(to)
  return fromPcs.map(fp => {
    let best = toPcs[0]
    let bestDist = 99
    for (const tp of toPcs) {
      const up = intervalSemitones(fp, tp)
      const down = intervalSemitones(tp, fp)
      const dist = Math.min(up, down)
      if (dist < bestDist) {
        bestDist = dist
        best = tp
      }
    }
    return { from: pcToName(fp, preferFlats), to: pcToName(best, preferFlats), semitones: bestDist }
  })
}

export function fretPositionsForMidi(
  midi: number,
  tuningMidi: number[],
  fretCount = 15,
): { stringIndex: number; fret: number }[] {
  const out: { stringIndex: number; fret: number }[] = []
  tuningMidi.forEach((open, stringIndex) => {
    const fret = midi - open
    if (fret >= 0 && fret <= fretCount) out.push({ stringIndex, fret })
  })
  return out
}

export function fretPositionsForPc(
  pc: number,
  tuningMidi: number[],
  fretCount = 15,
): { stringIndex: number; fret: number; midi: number }[] {
  const out: { stringIndex: number; fret: number; midi: number }[] = []
  tuningMidi.forEach((open, stringIndex) => {
    for (let fret = 0; fret <= fretCount; fret++) {
      const midi = open + fret
      if (wrapPc(midi) === wrapPc(pc)) out.push({ stringIndex, fret, midi })
    }
  })
  return out
}

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlate(hist: number[], profile: number[], shift: number): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += hist[i] * profile[wrapPc(i - shift)]
  return sum
}

export function inferKey(playedPcs: number[]): {
  root: string
  quality: 'major' | 'minor'
  confidence: number
  alternatives: { root: string; quality: 'major' | 'minor'; confidence: number }[]
} | null {
  if (playedPcs.length === 0) return null
  const unique = [...new Set(playedPcs.map(wrapPc))]
  const hist = new Array(12).fill(0)
  for (const pc of playedPcs) hist[wrapPc(pc)] += 1
  const max = Math.max(...hist, 1)
  const norm = hist.map(v => v / max)

  const ranked: { root: string; rootPc: number; quality: 'major' | 'minor'; score: number }[] = []
  for (let root = 0; root < 12; root++) {
    for (const quality of ['major', 'minor'] as const) {
      const scaleId = quality === 'major' ? 'ionian' : 'aeolian'
      const scale = new Set(scalePitchClasses(root, scaleId))
      const hits = unique.filter(pc => scale.has(pc)).length
      const coverage = hits / unique.length
      const completeness = hits / 7
      const profile = quality === 'major' ? MAJOR_PROFILE : MINOR_PROFILE
      const krum = correlate(norm, profile, root) / 20
      const tonicBonus = unique.includes(root) ? 0.08 : 0
      ranked.push({
        root: pcToName(root),
        rootPc: root,
        quality,
        score: coverage * 2 + completeness + krum + tonicBonus,
      })
    }
  }
  ranked.sort((a, b) => b.score - a.score)
  let best = ranked[0]
  const second = ranked[1]
  const relativeMinorPc = wrapPc(best.rootPc + 9)
  const relativeMajorPc = wrapPc(best.rootPc + 3)
  if (second && Math.abs(best.score - second.score) < 0.15) {
    const relatives = ranked.filter(r =>
      (best.quality === 'major' && r.quality === 'minor' && r.rootPc === relativeMinorPc)
      || (best.quality === 'minor' && r.quality === 'major' && r.rootPc === relativeMajorPc),
    )
    if (relatives[0] && best.quality === 'minor') best = relatives[0]
  }
  const gap = best.score - (ranked.find(r => r !== best)?.score ?? best.score)
  const confidence = Math.max(0.2, Math.min(0.9, 0.4 + gap))
  return {
    root: best.root,
    quality: best.quality,
    confidence: Number(confidence.toFixed(2)),
    alternatives: ranked.filter(r => !(r.root === best.root && r.quality === best.quality)).slice(0, 3).map(r => ({
      root: r.root,
      quality: r.quality,
      confidence: Number(Math.max(0.1, r.score / (best.score || 1) * confidence).toFixed(2)),
    })),
  }
}

export function scoreModes(
  playedPcs: number[],
  tonalCenterPc: number | null,
): {
  id: ScaleId
  name: string
  root: string
  rootPc: number
  coverage: number
  characteristicPresent: boolean
  notes: string[]
  parentMajor: string
}[] {
  const unique = [...new Set(playedPcs.map(wrapPc))]
  if (unique.length === 0) return []
  const roots = tonalCenterPc === null ? [...Array(12).keys()] : [wrapPc(tonalCenterPc)]
  const results = []
  for (const root of roots) {
    for (const id of MODE_IDS) {
      const scale = scalePitchClasses(root, id)
      const scaleSet = new Set(scale)
      const hits = unique.filter(pc => scaleSet.has(pc)).length
      const coverage = hits / unique.length
      const charPc = wrapPc(root + SCALES[id].characteristic)
      results.push({
        id,
        name: SCALES[id].name,
        root: pcToName(root),
        rootPc: root,
        coverage,
        characteristicPresent: unique.includes(charPc),
        notes: scale.map(pc => pcToName(pc)),
        parentMajor: pcToName(parentMajorRoot(root, id)),
      })
    }
  }
  results.sort((a, b) => {
    if (b.coverage !== a.coverage) return b.coverage - a.coverage
    return Number(b.characteristicPresent) - Number(a.characteristicPresent)
  })
  return results
}

export function sameCollectionDifferentCenter(aRoot: string, aMode: ScaleId, bRoot: string, bMode: ScaleId): boolean {
  const a = scalePitchClasses(nameToPc(aRoot) ?? 0, aMode).slice().sort((x, y) => x - y)
  const b = scalePitchClasses(nameToPc(bRoot) ?? 0, bMode).slice().sort((x, y) => x - y)
  return a.every((pc, i) => pc === b[i])
}

export function estimateTempoFromOnsets(timesMs: number[]): { bpm: number; confidence: number } | null {
  if (timesMs.length < 4) return null
  const sorted = [...timesMs].sort((a, b) => a - b)
  const iois: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1]
    if (d > 80 && d < 2000) iois.push(d)
  }
  if (iois.length < 3) return null
  iois.sort((a, b) => a - b)
  const median = iois[Math.floor(iois.length / 2)]
  let bpm = 60000 / median
  while (bpm < 50) bpm *= 2
  while (bpm > 200) bpm /= 2
  const mean = iois.reduce((s, n) => s + n, 0) / iois.length
  const variance = iois.reduce((s, n) => s + (n - mean) ** 2, 0) / iois.length
  const cv = Math.sqrt(variance) / mean
  const confidence = Math.max(0.15, Math.min(0.75, 0.75 - cv))
  return { bpm: Math.round(bpm), confidence: Number(confidence.toFixed(2)) }
}

export function timingSpreadMs(timesMs: number[]): number | null {
  if (timesMs.length < 3) return null
  const sorted = [...timesMs].sort((a, b) => a - b)
  const iois: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1]
    if (d > 80 && d < 2500) iois.push(d)
  }
  if (iois.length < 2) return null
  const mean = iois.reduce((s, n) => s + n, 0) / iois.length
  const variance = iois.reduce((s, n) => s + (n - mean) ** 2, 0) / iois.length
  return Math.round(Math.sqrt(variance))
}
