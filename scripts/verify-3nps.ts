/**
 * Verifies 3NPS shapes against the Jens Larsen C major chart
 * and that other roots are the same fingerings transposed.
 */
import {
  STANDARD_TUNING,
  getScaleNotes,
  getNoteAtFret,
  get3NPSNotes,
} from '../app/lib/scales.ts'

const C_MAJOR_CHART: Record<number, number[][]> = {
  // tuning index 0 = low E … 5 = high E
  1: [[1, 3, 5], [2, 3, 5], [2, 3, 5], [2, 4, 5], [3, 5, 6], [3, 5, 7]],
  2: [[3, 5, 7], [3, 5, 7], [3, 5, 7], [4, 5, 7], [5, 6, 8], [5, 7, 8]],
  3: [[5, 7, 8], [5, 7, 8], [5, 7, 9], [5, 7, 9], [6, 8, 10], [7, 8, 10]],
  4: [[7, 8, 10], [7, 8, 10], [7, 9, 10], [7, 9, 10], [8, 10, 12], [8, 10, 12]],
  5: [[8, 10, 12], [8, 10, 12], [9, 10, 12], [9, 10, 12], [10, 12, 13], [10, 12, 13]],
  6: [[10, 12, 13], [10, 12, 14], [10, 12, 14], [10, 12, 14], [12, 13, 15], [12, 13, 15]],
  7: [[12, 13, 15], [12, 14, 15], [12, 14, 15], [12, 14, 16], [13, 15, 17], [13, 15, 17]],
}

function byString(notes: { tuningIndex: number; fret: number }[]): number[][] {
  const strings: number[][] = Array.from({ length: STANDARD_TUNING.length }, () => [])
  for (const n of notes) strings[n.tuningIndex].push(n.fret)
  return strings
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const cMajor = getScaleNotes('C', 'major')
let failures = 0

for (let pos = 1; pos <= 7; pos++) {
  const notes = get3NPSNotes(STANDARD_TUNING, cMajor, pos)
  const got = byString(notes)
  const exp = C_MAJOR_CHART[pos]

  for (let s = 0; s < 6; s++) {
    const stringNotes = notes.filter(n => n.tuningIndex === s)
    if (stringNotes.length !== 3) {
      console.error(`C major pos ${pos} string ${s}: expected 3 notes, got ${stringNotes.length}`)
      failures++
    }
  }

  const roots = notes.filter(n => getNoteAtFret(STANDARD_TUNING[n.tuningIndex], n.fret) === 'C')
  if (roots.length === 0) {
    console.error(`C major pos ${pos}: no C roots`)
    failures++
  }

  if (JSON.stringify(got) !== JSON.stringify(exp)) {
    console.error(`C major pos ${pos} mismatch\n  got ${JSON.stringify(got)}\n  exp ${JSON.stringify(exp)}`)
    failures++
  } else {
    console.log(`C major position ${pos}: OK (${notes.length} notes, ${roots.length} roots)`)
  }
}

const gMajor = getScaleNotes('G', 'major')
const gPos1 = byString(get3NPSNotes(STANDARD_TUNING, gMajor, 1))
const cPos1Shifted = C_MAJOR_CHART[1].map(frets => frets.map(f => f + 7))
if (JSON.stringify(gPos1) !== JSON.stringify(cPos1Shifted)) {
  console.error(`G major pos 1 is not C major pos 1 + 7\n  got ${JSON.stringify(gPos1)}\n  exp ${JSON.stringify(cPos1Shifted)}`)
  failures++
} else {
  console.log('G major position 1: OK (C major position 1 transposed +7)')
}

const aMinor = getScaleNotes('A', 'natural-minor')
const aPos1 = get3NPSNotes(STANDARD_TUNING, aMinor, 1)
assert(aPos1.length === 18, 'A minor pos 1 should have 18 notes')
for (let s = 0; s < 6; s++) {
  assert(aPos1.filter(n => n.tuningIndex === s).length === 3, `A minor pos 1 string ${s} should have 3 notes`)
}
console.log('A natural minor position 1: OK (3 notes per string)')

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll 3NPS checks passed')
