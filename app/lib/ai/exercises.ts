import type { Difficulty, PhraseAnalysis, PracticeExercise } from './types'
import type { ParsedChord } from './theory'
import { SCALES } from './theory'

function id(): string {
  return `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function buildExercise(input: {
  analysis: PhraseAnalysis
  difficulty: Difficulty
  chords: ParsedChord[]
}): PracticeExercise {
  const { analysis, difficulty, chords } = input
  const first = chords[0]
  const second = chords[1]
  const topMode = analysis.modes[0]
  const tempo = analysis.tempo.bpm ?? (difficulty === 'beginner' ? 70 : difficulty === 'intermediate' ? 90 : 110)
  const ctx = chords.length ? chords.map(c => c.symbol).join(' – ') : analysis.key?.label ?? 'your phrase'
  const modeDef = topMode ? SCALES[topMode.id as keyof typeof SCALES] : null

  if (difficulty === 'beginner' && first) {
    return {
      id: id(),
      title: 'Chord tones only',
      goal: `Hear the outline of ${ctx}.`,
      instructions: `Play the root, third, and fifth of each chord in order (${chords.map(c => c.symbol).join(', ')}). One chord at a time, quarter notes, then rest a bar.`,
      context: ctx,
      tempoBpm: Math.min(tempo, 80),
      listenFor: 'Each arpeggio should sound like the chord even without the backing. The third is what makes major vs minor obvious.',
      evaluate: 'You are on track if you can name the third of each chord after the take.',
      difficulty,
    }
  }

  if (difficulty === 'beginner') {
    return {
      id: id(),
      title: 'Three-note cell',
      goal: 'Make a short idea you can repeat.',
      instructions: 'Pick any three notes from what you just played. Repeat the same rhythm four times, then change only the last note.',
      context: ctx,
      tempoBpm: 70,
      listenFor: 'Whether the last note feels like an ending or a question.',
      evaluate: 'Success is a phrase you could sing back, not a lot of notes.',
      difficulty,
    }
  }

  if (second && first) {
    const thirdKind = second.quality === 'min' || second.quality === 'min7' || second.quality === 'm7b5' || second.quality === 'dim'
      ? 'minor third'
      : 'major third'
    const land = `${second.root} or the ${thirdKind} of ${second.symbol}`
    return {
      id: id(),
      title: 'Resolve on the change',
      goal: `Connect ${first.symbol} to ${second.symbol} with a clear landing.`,
      instructions: `Improvise a two-bar idea over ${first.symbol}. On the downbeat of ${second.symbol}, land on ${land}. Hold that note.`,
      context: ctx,
      tempoBpm: tempo,
      listenFor: `The held note should feel like it belongs to ${second.symbol}. If it stings, you landed on a tension — slide to a chord tone.`,
      evaluate: 'Count how many times the change note is a chord tone of the new chord.',
      difficulty,
    }
  }

  if (topMode && modeDef?.isMode) {
    return {
      id: id(),
      title: `Characteristic ${topMode.name}`,
      goal: `Make ${topMode.root} ${topMode.name} sound like that mode, not like ${topMode.parentMajor} major from a different starting note.`,
      instructions: `Use the ${topMode.root} ${topMode.name} notes, but start and end phrases on ${topMode.root}. Hit the ${modeDef.characteristicName} at least twice. If you have a backing chord, use a ${topMode.root} drone or ${topMode.root}m / ${topMode.root} chord.`,
      context: `${topMode.root} ${topMode.name} (parent collection: ${topMode.parentMajor} major)`,
      tempoBpm: tempo,
      listenFor: `The ${modeDef.characteristicName} against ${topMode.root} in the bass. Without that bass, Dorian and Aeolian (for example) collapse into the same sound.`,
      evaluate: 'Record whether the characteristic note appeared. Coverage of the parent major scale alone does not prove the mode.',
      difficulty,
    }
  }

  if (difficulty === 'advanced') {
    return {
      id: id(),
      title: 'Tension then resolve',
      goal: 'Use color notes on purpose, then come home.',
      instructions: 'Play a four-note cell: two chord tones, one tension (9, 11, ♭7, or chromatic), then resolve by step into a chord tone. Repeat at a slightly higher tempo.',
      context: ctx,
      tempoBpm: Math.max(tempo, 100),
      listenFor: 'The sting of the tension and the release of the last note. If both sting, you did not resolve.',
      evaluate: 'Each cell should end on a chord tone. Extra notes in the middle are fine.',
      difficulty,
    }
  }

  return {
    id: id(),
    title: 'Space and placement',
    goal: 'Make rhythm as intentional as pitch.',
    instructions: 'Play a 4-note phrase, rest for two beats, repeat it. Do not add notes during the rest.',
    context: ctx,
    tempoBpm: tempo,
    listenFor: 'Whether the rest is actually empty, and whether the phrase starts on the beat or pushes ahead.',
    evaluate: 'If the second take has the same number of notes and a clearer gap, the exercise worked.',
    difficulty,
  }
}
