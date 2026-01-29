// All notes in chromatic order
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

// Enharmonic equivalents for display
export const NOTE_DISPLAY: Record<string, string> = {
  'C': 'C',
  'C#': 'C#/Db',
  'D': 'D',
  'D#': 'D#/Eb',
  'E': 'E',
  'F': 'F',
  'F#': 'F#/Gb',
  'G': 'G',
  'G#': 'G#/Ab',
  'A': 'A',
  'A#': 'A#/Bb',
  'B': 'B',
}

// Scale intervals (semitones from root)
export const SCALES: Record<string, { name: string; intervals: number[]; description: string; practice: string[] }> = {
  'minor-pentatonic': {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    description: 'The most popular scale for rock and blues soloing',
    practice: [
      'Play ascending and descending across all strings',
      'Practice bending the ♭3 up to the major 3rd',
      'Try the "box pattern" starting from the root',
      'Jam over a 12-bar blues backing track',
      'Connect to neighboring pentatonic positions'
    ]
  },
  'major-pentatonic': {
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    description: 'Bright and happy sound, great for country and pop',
    practice: [
      'Practice country-style double stops',
      'Work on hybrid picking patterns',
      'Try sliding between positions',
      'Play over major chord progressions',
      'Mix with minor pentatonic for variety'
    ]
  },
  'mixo-pentatonic': {
    name: 'Mixolydian Pentatonic',
    intervals: [0, 2, 4, 7, 10],
    description: 'Major pentatonic with ♭7, perfect for dominant 7th chords and funk',
    practice: [
      'Use over dominant 7th chord vamps',
      'Great for funk and blues-rock grooves',
      'Emphasize the ♭7 for that dominant sound',
      'Mix with major pentatonic for color',
      'Try over I7-IV7 progressions'
    ]
  },
  'natural-minor': {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'Also known as Aeolian mode, sad and dark sound',
    practice: [
      'Learn all 7 positions across the neck',
      'Practice 3-note-per-string patterns',
      'Work on legato runs with hammer-ons',
      'Play over minor progressions (i-iv-v)',
      'Focus on the ♭6 and ♭7 characteristic tones'
    ]
  },
  'major': {
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'The foundation of Western music theory',
    practice: [
      'Master the 3-note-per-string patterns',
      'Practice scale sequences (3rds, 4ths)',
      'Work on position shifts while playing',
      'Play over I-IV-V progressions',
      'Focus on resolving to the root note'
    ]
  },
  'blues': {
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Minor pentatonic with added blue note (♭5)',
    practice: [
      'Emphasize the blue note (♭5) with bends',
      'Practice chromatic runs through the ♭5',
      'Work on vibrato on sustained notes',
      'Try call-and-response phrasing',
      'Mix with major pentatonic for major blues'
    ]
  },
  'dorian': {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Minor scale with raised 6th, jazzy sound',
    practice: [
      'Highlight the natural 6th degree',
      'Practice over minor 7th vamps',
      'Work on jazz-style phrasing',
      'Try Santana-style melodic lines',
      'Compare with natural minor to hear difference'
    ]
  },
  'mixolydian': {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Major scale with flat 7th, dominant sound',
    practice: [
      'Emphasize the ♭7 over dominant chords',
      'Practice over funk and rock grooves',
      'Work on Allman Brothers-style licks',
      'Try double stops with the ♭7',
      'Use over dominant 7th chord vamps'
    ]
  },
  'phrygian': {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: 'Spanish/Flamenco flavor with flat 2nd',
    practice: [
      'Emphasize the ♭2 for Spanish sound',
      'Practice flamenco-style rasgueados',
      'Work on metal riffs using this mode',
      'Try tremolo picking exercises',
      'Resolve phrases to the root dramatically'
    ]
  },
  'harmonic-minor': {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: 'Natural minor with raised 7th, exotic sound',
    practice: [
      'Focus on the augmented 2nd interval',
      'Practice neoclassical sweep patterns',
      'Work on Yngwie-style sequences',
      'Use over minor progressions with V7',
      'Emphasize the leading tone resolution'
    ]
  },
  'lydian': {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: 'Major scale with raised 4th, dreamy quality',
    practice: [
      'Highlight the #4 for the floating sound',
      'Practice over maj7#11 chords',
      'Work on Steve Vai-style melodies',
      'Try atmospheric clean tone playing',
      'Use for film score-style compositions'
    ]
  },
  'diminished-half-whole': {
    name: 'Diminished (Half-Whole)',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    description: 'Symmetric scale alternating half and whole steps, used over dominant 7th chords',
    practice: [
      'Practice the symmetric pattern across strings',
      'Use over dominant 7♭9 chords',
      'Work on diminished arpeggio patterns within',
      'Try jazz fusion-style chromatic lines',
      'Practice in minor 3rd transpositions (same notes)'
    ]
  },
  'diminished-whole-half': {
    name: 'Diminished (Whole-Half)',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    description: 'Symmetric scale alternating whole and half steps, used over diminished chords',
    practice: [
      'Learn the repeating 2-fret pattern',
      'Use over dim7 chords and passing diminished',
      'Practice diminished 7th arpeggios within scale',
      'Work on bebop-style enclosures',
      'Transpose in minor 3rds to see symmetry'
    ]
  },
  'whole-tone': {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    description: 'All whole steps, dreamy and unresolved sound',
    practice: [
      'Practice the even whole-step pattern',
      'Use over augmented and 7#5 chords',
      'Work on Debussy-inspired voicings',
      'Try creating tension before resolution',
      'Experiment with augmented triads within'
    ]
  },
  'augmented': {
    name: 'Augmented (Hexatonic)',
    intervals: [0, 3, 4, 7, 8, 11],
    description: 'Symmetric scale built on augmented triads, mysterious sound',
    practice: [
      'Learn the alternating minor 3rd/half step pattern',
      'Practice augmented triad arpeggios',
      'Use over augmented and maj7#5 chords',
      'Work on Coltrane-style patterns',
      'Transpose in major 3rds (same notes)'
    ]
  },
}

// Standard guitar tuning (low to high): E A D G B E
export const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E']

// Get the note at a specific fret given the open string note
export function getNoteAtFret(openNote: string, fret: number): string {
  const noteIndex = NOTES.indexOf(openNote as typeof NOTES[number])
  const newIndex = (noteIndex + fret) % 12
  return NOTES[newIndex]
}

// Get all notes in a scale given the root note
export function getScaleNotes(rootNote: string, scaleType: string): string[] {
  const scale = SCALES[scaleType]
  if (!scale) return []
  
  const rootIndex = NOTES.indexOf(rootNote as typeof NOTES[number])
  return scale.intervals.map(interval => NOTES[(rootIndex + interval) % 12])
}

// Check if a note is the root of the scale
export function isRootNote(note: string, rootNote: string): boolean {
  return note === rootNote
}

// Check if a note is the blue note (♭5) in the scale
export function isBlueNote(note: string, rootNote: string, scaleType: string): boolean {
  const scale = SCALES[scaleType]
  if (!scale) return false
  
  // Blue note is the ♭5 interval (6 semitones from root)
  const rootIndex = NOTES.indexOf(rootNote as typeof NOTES[number])
  const noteIndex = NOTES.indexOf(note as typeof NOTES[number])
  const interval = (noteIndex - rootIndex + 12) % 12
  
  // Only mark as blue note if the scale contains interval 6 (♭5)
  return interval === 6 && scale.intervals.includes(6)
}

// Get interval name for a note in a scale
export function getIntervalName(note: string, rootNote: string, scaleType: string): string {
  const scale = SCALES[scaleType]
  if (!scale) return ''
  
  const rootIndex = NOTES.indexOf(rootNote as typeof NOTES[number])
  const noteIndex = NOTES.indexOf(note as typeof NOTES[number])
  const interval = (noteIndex - rootIndex + 12) % 12
  
  const intervalNames: Record<number, string> = {
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
  
  return intervalNames[interval] || ''
}
