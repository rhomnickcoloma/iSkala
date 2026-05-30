export interface InstrumentConfig {
  id: string
  name: string
  icon: string
  tuning: string[]
  stringCount: number
  defaultFretCount: number
  tunerStrings: { note: string; frequency: number; string: number }[]
  supportsPatterns: boolean
}

export const INSTRUMENTS: Record<string, InstrumentConfig> = {
  'guitar': {
    id: 'guitar',
    name: 'Guitar (6-String)',
    icon: '🎸',
    tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
    stringCount: 6,
    defaultFretCount: 15,
    tunerStrings: [
      { note: 'E2', frequency: 82.41, string: 6 },
      { note: 'A2', frequency: 110.00, string: 5 },
      { note: 'D3', frequency: 146.83, string: 4 },
      { note: 'G3', frequency: 196.00, string: 3 },
      { note: 'B3', frequency: 246.94, string: 2 },
      { note: 'E4', frequency: 329.63, string: 1 },
    ],
    supportsPatterns: true,
  },
  'bass-4': {
    id: 'bass-4',
    name: 'Bass (4-String)',
    icon: '🎸',
    tuning: ['E', 'A', 'D', 'G'],
    stringCount: 4,
    defaultFretCount: 15,
    tunerStrings: [
      { note: 'E1', frequency: 41.20, string: 4 },
      { note: 'A1', frequency: 55.00, string: 3 },
      { note: 'D2', frequency: 73.42, string: 2 },
      { note: 'G2', frequency: 98.00, string: 1 },
    ],
    supportsPatterns: false,
  },
  'bass-5': {
    id: 'bass-5',
    name: 'Bass (5-String)',
    icon: '🎸',
    tuning: ['B', 'E', 'A', 'D', 'G'],
    stringCount: 5,
    defaultFretCount: 15,
    tunerStrings: [
      { note: 'B0', frequency: 30.87, string: 5 },
      { note: 'E1', frequency: 41.20, string: 4 },
      { note: 'A1', frequency: 55.00, string: 3 },
      { note: 'D2', frequency: 73.42, string: 2 },
      { note: 'G2', frequency: 98.00, string: 1 },
    ],
    supportsPatterns: false,
  },
  'bass-6': {
    id: 'bass-6',
    name: 'Bass (6-String)',
    icon: '🎸',
    tuning: ['B', 'E', 'A', 'D', 'G', 'C'],
    stringCount: 6,
    defaultFretCount: 15,
    tunerStrings: [
      { note: 'B0', frequency: 30.87, string: 6 },
      { note: 'E1', frequency: 41.20, string: 5 },
      { note: 'A1', frequency: 55.00, string: 4 },
      { note: 'D2', frequency: 73.42, string: 3 },
      { note: 'G2', frequency: 98.00, string: 2 },
      { note: 'C3', frequency: 130.81, string: 1 },
    ],
    supportsPatterns: false,
  },
  'ukulele': {
    id: 'ukulele',
    name: 'Ukulele',
    icon: '🪕',
    tuning: ['G', 'C', 'E', 'A'],
    stringCount: 4,
    defaultFretCount: 12,
    tunerStrings: [
      { note: 'G4', frequency: 392.00, string: 4 },
      { note: 'C4', frequency: 261.63, string: 3 },
      { note: 'E4', frequency: 329.63, string: 2 },
      { note: 'A4', frequency: 440.00, string: 1 },
    ],
    supportsPatterns: false,
  },
}

export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS)
export const DEFAULT_INSTRUMENT_ID = 'guitar'

export function getInstrument(id: string): InstrumentConfig {
  return INSTRUMENTS[id] || INSTRUMENTS[DEFAULT_INSTRUMENT_ID]
}
