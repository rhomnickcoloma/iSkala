import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  chordToneNames,
  enharmonicPair,
  fretPositionsForMidi,
  GUITAR_TUNINGS,
  inferKey,
  intervalName,
  midiToNote,
  nameToPc,
  noteRoleAgainstChord,
  noteToMidi,
  parentMajorRoot,
  parseChordSymbol,
  parseProgression,
  pcToName,
  sameCollectionDifferentCenter,
  scaleNoteNames,
  scalePitchClasses,
  scoreModes,
  targetNotesForChord,
  voiceLead,
  wrapPc,
} from '../app/lib/ai/theory'
import { analyzePhrase } from '../app/lib/ai/analyze'
import { buildRuleCoach } from '../app/lib/ai/coach'
import type { DetectedNote } from '../app/lib/ai/types'

describe('pitch and enharmonics', () => {
  it('maps MIDI 69 to A4', () => {
    const n = midiToNote(69)
    assert.equal(n.name, 'A')
    assert.equal(n.octave, 4)
  })

  it('round-trips note names through MIDI', () => {
    const midi = noteToMidi('E', 2)
    assert.equal(midi, 40)
    assert.equal(midiToNote(40).name, 'E')
  })

  it('lists enharmonic pairs', () => {
    assert.equal(enharmonicPair(1), 'C#/Db')
    assert.equal(enharmonicPair(0), 'C')
  })
})

describe('scales and modes', () => {
  it('builds G major / Ionian from the tonal center', () => {
    assert.deepEqual(scaleNoteNames('G', 'ionian'), ['G', 'A', 'B', 'C', 'D', 'E', 'F#'])
  })

  it('builds A natural minor / Aeolian', () => {
    assert.deepEqual(scaleNoteNames('A', 'aeolian'), ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })

  it('treats D Dorian and C Ionian as the same collection with different centers', () => {
    assert.equal(sameCollectionDifferentCenter('D', 'dorian', 'C', 'ionian'), true)
    assert.equal(parentMajorRoot(nameToPc('D')!, 'dorian'), nameToPc('C'))
    const dorian = scalePitchClasses(nameToPc('D')!, 'dorian')
    const ionian = scalePitchClasses(nameToPc('C')!, 'ionian')
    assert.deepEqual([...dorian].sort((a, b) => a - b), [...ionian].sort((a, b) => a - b))
    assert.notEqual(nameToPc('D'), nameToPc('C'))
  })

  it('gives Dorian a natural sixth against D, not C', () => {
    const notes = scaleNoteNames('D', 'dorian')
    assert.ok(notes.includes('B'))
    assert.equal(intervalName(nameToPc('D')!, nameToPc('B')!), 'major 6th (6)')
  })
})

describe('chords', () => {
  it('parses a G–Em–C–D progression', () => {
    const prog = parseProgression('G–Em–C–D')
    assert.deepEqual(prog.map(c => `${c.root}:${c.quality}`), ['G:maj', 'E:min', 'C:maj', 'D:maj'])
  })

  it('parses seventh and altered qualities', () => {
    assert.equal(parseChordSymbol('G7')?.quality, '7')
    assert.equal(parseChordSymbol('Gmaj7')?.quality, 'maj7')
    assert.equal(parseChordSymbol('Am7')?.quality, 'min7')
    assert.equal(parseChordSymbol('Bdim')?.quality, 'dim')
    assert.equal(parseChordSymbol('Caug')?.quality, 'aug')
    assert.equal(parseChordSymbol('Bm7b5')?.quality, 'm7b5')
  })

  it('identifies B as the major third of G', () => {
    const g = parseChordSymbol('G')!
    const rel = noteRoleAgainstChord(nameToPc('B')!, g)
    assert.equal(rel.role, 'third')
    assert.equal(rel.stable, true)
    assert.equal(rel.short, '3')
  })

  it('names G major chord tones G B D', () => {
    assert.deepEqual(chordToneNames(parseChordSymbol('G')!), ['G', 'B', 'D'])
  })

  it('suggests chord-tone targets', () => {
    const targets = targetNotesForChord(parseChordSymbol('Em')!)
    assert.deepEqual(targets.map(t => t.note), ['E', 'G', 'B'])
  })

  it('keeps G and B as common tones from G to Em', () => {
    const steps = voiceLead(parseChordSymbol('G')!, parseChordSymbol('Em')!)
    const commons = steps.filter(s => s.semitones === 0).map(s => s.from)
    assert.ok(commons.includes('G'))
    assert.ok(commons.includes('B'))
  })
})

describe('fretboard', () => {
  it('finds E4 on standard guitar', () => {
    const standard = GUITAR_TUNINGS.find(t => t.id === 'standard')!
    const spots = fretPositionsForMidi(64, standard.midi, 15)
    assert.ok(spots.some(s => s.stringIndex === 5 && s.fret === 0))
    assert.ok(spots.some(s => s.stringIndex === 4 && s.fret === 5))
  })
})

describe('key inference', () => {
  it('leans G major for a G major collection', () => {
    const pcs = scalePitchClasses(nameToPc('G')!, 'ionian')
    const guess = inferKey(pcs)!
    assert.equal(guess.root, 'G')
    assert.equal(guess.quality, 'major')
  })

  it('does not pick a single mode from a short shared collection without a center', () => {
    const pcs = ['C', 'D', 'E', 'G'].map(n => nameToPc(n)!)
    const modes = scoreModes(pcs, null)
    assert.ok(modes.length > 1)
    assert.ok(Math.abs(modes[0].coverage - modes[1].coverage) <= 0.25 || modes[0].coverage === 1)
  })
})

function tap(name: string, midi: number, at = 0): DetectedNote {
  const pc = wrapPc(midi)
  void pc
  return {
    id: `${name}-${at}`,
    midi,
    name,
    octave: midiToNote(midi).octave,
    hz: null,
    cents: 0,
    confidence: 0.9,
    quality: 'ok',
    startedAt: at,
    endedAt: at + 200,
    source: 'manual',
    estimated: false,
  }
}

describe('analysis and coach', () => {
  it('explains B over G as a chord tone and stays useful without an LLM', () => {
    const notes = [tap('G', 55, 0), tap('B', 59, 400), tap('D', 62, 800)]
    const analysis = analyzePhrase({ notes, chordInput: 'G Em C D', userKey: 'G', userTempo: 90 })
    const b = analysis.notes.find(n => n.note === 'B')
    assert.equal(b?.role, 'third')
    assert.equal(b?.stable, true)
    const { coaching, exercise } = buildRuleCoach(analysis, notes, 'beginner')
    assert.match(coaching.played, /G/)
    assert.match(coaching.meaning, /B/)
    assert.ok(exercise.instructions.length > 10)
    assert.equal(exercise.difficulty, 'beginner')
  })

  it('records uncertainty when no notes are present', () => {
    const analysis = analyzePhrase({ notes: [], chordInput: '', userKey: '', userTempo: null })
    assert.ok(analysis.uncertainties.length > 0)
  })
})
