export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type NoteSource = 'mic' | 'manual'

export type SignalQuality = 'silent' | 'weak' | 'ok' | 'strong'

export interface DetectedNote {
  id: string
  midi: number
  name: string
  octave: number
  hz: number | null
  cents: number | null
  confidence: number
  quality: SignalQuality
  startedAt: number
  endedAt: number | null
  source: NoteSource
  estimated: boolean
}

export interface LivePitch {
  hz: number
  midi: number
  name: string
  octave: number
  cents: number
  confidence: number
  quality: SignalQuality
  rms: number
}

export interface ChordToneRole {
  note: string
  pc: number
  role: 'root' | 'third' | 'fifth' | 'seventh' | 'tension' | 'outside' | 'unknown'
  stable: boolean
  label: string
}

export interface ModeCandidate {
  id: string
  name: string
  root: string
  notes: string[]
  coverage: number
  characteristicPresent: boolean
  characteristic: string
  parentMajor: string
  uncertain: boolean
}

export interface KeyGuess {
  root: string
  quality: 'major' | 'minor'
  label: string
  confidence: number
  source: 'user' | 'inferred'
  alternatives: { label: string; confidence: number }[]
}

export interface TempoGuess {
  bpm: number | null
  confidence: number
  method: 'user' | 'onsets' | 'none'
  note: string
}

export interface PhraseAnalysis {
  notes: ChordToneRole[]
  uniqueNames: string[]
  tempo: TempoGuess
  key: KeyGuess | null
  modes: ModeCandidate[]
  chordSummaries: {
    symbol: string
    chordTones: string[]
    playedTones: string[]
    missingTones: string[]
    tensions: string[]
  }[]
  targetNotes: { note: string; role: string; chord: string }[]
  voiceLeading: { from: string; to: string; motion: string }[]
  uncertainties: string[]
  chordToneRatio: number
}

export interface CoachingFeedback {
  played: string
  meaning: string
  worked: string
  improve: string
  exercise: string
  listenFor: string
}

export interface PracticeExercise {
  id: string
  title: string
  goal: string
  instructions: string
  context: string
  tempoBpm: number | null
  listenFor: string
  evaluate: string
  difficulty: Difficulty
}

export interface AttemptRecord {
  id: string
  at: number
  noteNames: string[]
  chordToneRatio: number
  noteCount: number
  timingSpreadMs: number | null
  summary: string
}

export interface SessionRecord {
  id: string
  at: number
  chords: string[]
  key: string
  difficulty: Difficulty
  notes: string[]
  coaching: CoachingFeedback
  exerciseTitle: string
  source: 'rules' | 'llm'
}
