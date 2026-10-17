import type { CoachingFeedback, DetectedNote, Difficulty, PhraseAnalysis, PracticeExercise } from './types'
import { parseProgression, SCALES } from './theory'
import { buildExercise } from './exercises'

function listNotes(names: string[]): string {
  if (names.length === 0) return 'no confirmed notes'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export function buildRuleCoach(analysis: PhraseAnalysis, notes: DetectedNote[], difficulty: Difficulty): {
  coaching: CoachingFeedback
  exercise: PracticeExercise
} {
  const chords = analysis.chordSummaries
  const first = chords[0]
  const second = chords[1]
  const played = analysis.uniqueNames
  const stable = analysis.notes.filter(n => n.stable).map(n => n.note)
  const tense = analysis.notes.filter(n => n.role === 'tension' || n.role === 'outside')
  const topMode = analysis.modes[0]
  const closeMode = analysis.modes[1]

  let playedText: string
  if (played.length === 0) {
    playedText = 'I did not catch a confirmed phrase yet. Play a single-note line into the microphone, or tap notes on the fretboard to show me what you meant.'
  } else {
    const confNotes = notes.filter(n => n.source === 'mic' && n.confidence < 0.55)
    playedText = `You played ${listNotes(played)}${first ? ` over ${chords.map(c => c.symbol).join('–')}` : ''}.`
    if (confNotes.length) {
      playedText += ' A few of those are low-confidence microphone estimates — treat them as likely notes, not a transcription.'
    }
  }

  let meaning: string
  if (played.length === 0) {
    meaning = 'Without notes I cannot map intervals yet. Once I hear (or you tap) a phrase, I will name chord tones versus tension notes against your chords.'
  } else if (first) {
    const roles = analysis.notes
      .filter(n => n.role !== 'unknown')
      .slice(0, 4)
      .map(n => `${n.note} is the ${n.label}`)
    meaning = roles.length
      ? `${roles.join('. ')}.`
      : `Those notes sit against ${first.symbol}, but I need a clearer phrase to name each interval.`
    if (second && stable.length) {
      const nextTargets = second.chordTones.slice(0, 3).join(', ')
      meaning += ` When the harmony moves to ${second.symbol}, the strongest landing notes are ${nextTargets}.`
    }
    if (topMode && analysis.uniqueNames.length >= 4) {
      meaning += ` The pitch collection is also consistent with ${topMode.root} ${topMode.name}`
      if (closeMode && closeMode.uncertain) {
        meaning += `, but ${closeMode.root} ${closeMode.name} is close — those two share notes while the sound depends on which pitch feels like home`
      }
      const def = SCALES[topMode.id as keyof typeof SCALES]
      if (def?.isMode) {
        meaning += `. ${topMode.root} ${topMode.name} uses the same notes as ${topMode.parentMajor} major, but it should be heard from ${topMode.root}, not as a ${topMode.parentMajor} scale that merely starts on a different degree`
      }
      meaning += '.'
    }
  } else if (analysis.key) {
    meaning = `No chords were entered, so I am treating ${analysis.key.label} as a possible tonal center (${analysis.key.source === 'user' ? 'you set this' : `confidence ${Math.round(analysis.key.confidence * 100)}%`}). Add chords such as G–Em–C–D to talk about target notes per change.`
  } else {
    meaning = 'I heard notes but cannot yet name a key or chord. Enter the backing chords and, if you know it, the intended key.'
  }

  let worked: string
  if (played.length === 0) {
    worked = 'Nothing to evaluate yet — the first successful take is the one where a few notes lock in.'
  } else if (stable.length >= Math.max(1, Math.ceil(played.length * 0.5))) {
    worked = `Landing on ${listNotes(stable)} keeps the line inside the harmony${first ? ` of ${first.symbol}` : ''}. Those are chord tones, so they sound resolved if you sit on them.`
  } else if (tense.length && first) {
    worked = `The line is moving — ${listNotes(tense.map(t => t.note))} sit off the ${first.symbol} chord tones. That can sound musical if you resolve, but it is not a strong landing yet.`
  } else {
    worked = 'There is a usable pitch set here. Once chord tones show up on the longer notes, the phrase will feel more grounded.'
  }

  let improve: string
  if (played.length === 0) {
    improve = 'Play 3–5 slow single notes. Monophonic detection needs one note at a time.'
  } else if (second && first) {
    const land = second.chordTones[0]
    improve = `Connect ${first.symbol} into ${second.symbol} by aiming for ${land} (the root of ${second.symbol}) or another chord tone on the change, instead of freezing on a note that only belongs to the first chord.`
  } else if (topMode && !topMode.characteristicPresent && !topMode.uncertain) {
    const def = SCALES[topMode.id as keyof typeof SCALES]
    improve = `To make ${topMode.root} ${topMode.name} actually sound like that mode, emphasize ${topMode.root} and its ${def?.characteristicName ?? 'characteristic note'} — the shared parent-major notes alone will not establish the mode.`
  } else if (analysis.chordToneRatio < 0.4 && first) {
    improve = `Lean on the chord tones of ${first.symbol} (${first.chordTones.join(', ')}) at the ends of phrases. Color notes work better when they resolve.`
  } else {
    improve = 'Leave more space: play a short idea, rest, then answer it. Timing reads more clearly when notes are not all the same length.'
  }

  const exercise = buildExercise({ analysis, difficulty, chords: parseProgression(chords.map(c => c.symbol).join(' ')) })
  const coaching: CoachingFeedback = {
    played: playedText,
    meaning,
    worked,
    improve,
    exercise: `${exercise.title}: ${exercise.instructions}`,
    listenFor: exercise.listenFor,
  }
  return { coaching, exercise }
}

export function attemptSummary(current: {
  noteNames: string[]
  chordToneRatio: number
  noteCount: number
  timingSpreadMs: number | null
}, previous: {
  noteNames: string[]
  chordToneRatio: number
  noteCount: number
  timingSpreadMs: number | null
} | null): string {
  if (!previous) return 'First attempt captured. Repeat the exercise to compare.'
  const parts: string[] = []
  const ratioDelta = current.chordToneRatio - previous.chordToneRatio
  if (Math.abs(ratioDelta) >= 0.08) {
    parts.push(
      `Chord-tone share ${Math.round(current.chordToneRatio * 100)}% (was ${Math.round(previous.chordToneRatio * 100)}%).`,
    )
  } else {
    parts.push(`Chord-tone share is similar (${Math.round(current.chordToneRatio * 100)}% vs ${Math.round(previous.chordToneRatio * 100)}%).`)
  }
  if (current.noteCount !== previous.noteCount) {
    parts.push(`Note count ${current.noteCount} vs ${previous.noteCount}.`)
  }
  if (current.timingSpreadMs !== null && previous.timingSpreadMs !== null) {
    if (current.timingSpreadMs + 20 < previous.timingSpreadMs) {
      parts.push('Note spacing is a bit more even.')
    } else if (current.timingSpreadMs > previous.timingSpreadMs + 20) {
      parts.push('Note spacing is more uneven than last time — not necessarily worse, just less regular.')
    }
  }
  parts.push('These are measurements of this take, not a grade.')
  return parts.join(' ')
}
