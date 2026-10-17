import type { ChordToneRole, DetectedNote, KeyGuess, ModeCandidate, PhraseAnalysis, TempoGuess } from './types'
import {
  chordToneNames,
  chordTonePcs,
  estimateTempoFromOnsets,
  inferKey,
  intervalName,
  nameToPc,
  noteRoleAgainstChord,
  parseProgression,
  pcToName,
  scoreModes,
  targetNotesForChord,
  voiceLead,
  wrapPc,
} from './theory'

function uniquePcs(notes: DetectedNote[]): number[] {
  return [...new Set(notes.map(n => wrapPc(n.midi)))]
}

export function analyzePhrase(input: {
  notes: DetectedNote[]
  chordInput: string
  userKey: string
  userTempo: number | null
}): PhraseAnalysis {
  const notes = input.notes.filter(n => !n.estimated)
  const chords = parseProgression(input.chordInput)
  const pcs = uniquePcs(notes)
  const uniqueNames = [...new Set(notes.map(n => n.name))]
  const uncertainties: string[] = []

  if (notes.length === 0) {
    uncertainties.push('No confirmed notes yet. Play a phrase, or tap notes on the fretboard.')
  }
  if (notes.some(n => n.source === 'mic' && n.confidence < 0.55)) {
    uncertainties.push('Some microphone notes are low-confidence estimates. Pitch detection is monophonic and can miss chords.')
  }
  if (notes.filter(n => n.source === 'mic').length > 0) {
    uncertainties.push('Microphone detection is monophonic. Polyphonic chords are not identified automatically.')
  }

  const userKeyPc = input.userKey ? nameToPc(input.userKey) : null
  const inferred = inferKey(pcs)
  let key: KeyGuess | null = null
  if (userKeyPc !== null) {
    key = {
      root: pcToName(userKeyPc),
      quality: /m$/i.test(input.userKey.replace(/maj$/i, '')) ? 'minor' : 'major',
      label: input.userKey,
      confidence: 1,
      source: 'user',
      alternatives: inferred
        ? [{ label: `${inferred.root} ${inferred.quality}`, confidence: inferred.confidence }]
        : [],
    }
  } else if (inferred) {
    key = {
      root: inferred.root,
      quality: inferred.quality,
      label: `${inferred.root} ${inferred.quality}`,
      confidence: inferred.confidence,
      source: 'inferred',
      alternatives: inferred.alternatives.map(a => ({
        label: `${a.root} ${a.quality}`,
        confidence: a.confidence,
      })),
    }
    if (inferred.confidence < 0.55 || (inferred.alternatives[0] && inferred.alternatives[0].confidence > inferred.confidence * 0.85)) {
      uncertainties.push('Several keys fit these notes. Set the intended key to lock the analysis.')
    }
  }

  const tonalCenter = userKeyPc ?? (inferred ? nameToPc(inferred.root) : null)
  const modeScores = scoreModes(pcs, userKeyPc ?? (pcs.length >= 5 ? tonalCenter : null))
  const top = modeScores[0]
  const second = modeScores[1]
  const modes: ModeCandidate[] = modeScores.slice(0, 5).map((m, i) => {
    const close = second && top && Math.abs(m.coverage - top.coverage) < 0.12
    return {
      id: m.id,
      name: m.name,
      root: m.root,
      notes: m.notes,
      coverage: Number(m.coverage.toFixed(2)),
      characteristicPresent: m.characteristicPresent,
      characteristic: `${m.root} ${m.name}`,
      parentMajor: m.parentMajor,
      uncertain: i > 0 || !!(close && second && second.coverage >= (top?.coverage ?? 0) - 0.08),
    }
  })
  if (top && second && top.coverage - second.coverage < 0.1 && pcs.length < 7) {
    uncertainties.push(
      `${top.root} ${top.name} and ${second.root} ${second.name} share most of these notes. A mode is not confirmed from a short phrase — it depends on the tonal center and the chords underneath.`,
    )
  }

  const firstChord = chords[0] ?? null
  const roles: ChordToneRole[] = uniqueNames.map(name => {
    const pc = nameToPc(name) ?? 0
    if (!firstChord) {
      return {
        note: name,
        pc,
        role: 'unknown',
        stable: false,
        label: key ? intervalName(nameToPc(key.root) ?? 0, pc) : 'no chord context',
      }
    }
    const rel = noteRoleAgainstChord(pc, firstChord)
    return {
      note: name,
      pc,
      role: rel.role,
      stable: rel.stable,
      label: `${rel.short} of ${firstChord.symbol}`,
    }
  })

  const chordSummaries = chords.map(chord => {
    const tones = chordToneNames(chord)
    const toneSet = new Set(chordTonePcs(chord))
    const playedTones = uniqueNames.filter(n => toneSet.has(nameToPc(n) ?? -1))
    const missingTones = tones.filter(t => !playedTones.includes(t))
    const tensions = uniqueNames.filter(n => {
      const pc = nameToPc(n)
      if (pc === null) return false
      const rel = noteRoleAgainstChord(pc, chord)
      return rel.role === 'tension' || rel.role === 'outside'
    })
    return { symbol: chord.symbol, chordTones: tones, playedTones, missingTones, tensions }
  })

  const targetNotes = chords.flatMap(chord =>
    targetNotesForChord(chord).map(t => ({ ...t, chord: chord.symbol })),
  )

  const voiceLeading = []
  for (let i = 0; i < chords.length - 1; i++) {
    for (const step of voiceLead(chords[i], chords[i + 1])) {
      voiceLeading.push({
        from: `${step.from} (${chords[i].symbol})`,
        to: `${step.to} (${chords[i + 1].symbol})`,
        motion: step.semitones === 0 ? 'common tone' : `${step.semitones} semitone${step.semitones === 1 ? '' : 's'}`,
      })
    }
  }

  let tempo: TempoGuess
  if (input.userTempo && input.userTempo > 0) {
    tempo = { bpm: input.userTempo, confidence: 1, method: 'user', note: `Using your tempo of ${input.userTempo} BPM.` }
  } else {
    const onsets = estimateTempoFromOnsets(notes.map(n => n.startedAt))
    if (onsets) {
      tempo = {
        bpm: onsets.bpm,
        confidence: onsets.confidence,
        method: 'onsets',
        note: `Rough tempo from note timing (~${onsets.bpm} BPM). This is an estimate, not a click-track measurement.`,
      }
    } else {
      tempo = { bpm: null, confidence: 0, method: 'none', note: 'Not enough evenly spaced notes to estimate tempo.' }
    }
  }

  const chordToneCount = roles.filter(r => r.stable).length
  const chordToneRatio = roles.length ? chordToneCount / roles.length : 0

  if (chords.length === 0) {
    uncertainties.push('Enter a chord progression to get chord-tone and target-note coaching.')
  }

  return {
    notes: roles,
    uniqueNames,
    tempo,
    key,
    modes,
    chordSummaries,
    targetNotes,
    voiceLeading: voiceLeading.slice(0, 8),
    uncertainties,
    chordToneRatio: Number(chordToneRatio.toFixed(2)),
  }
}
