import type { Patch } from './patches'

// Overdrive/distortion level 50 ≈ unity, 100 ≈ +6 dB. Reverb decay is in tenths of a second.

interface FactoryFx {
  type: string
  params: Record<string, number>
  modelId?: string
  extraValue?: string
  enabled?: boolean
}

const FACTORY_DATE = '2026-10-16T00:00:00.000Z'

function preset(slug: string, name: string, description: string, chain: FactoryFx[], inputGain = 0.75, masterVolume = 0.75): FactoryPatch {
  return {
    id: `nixx-${slug}`,
    name,
    description,
    updatedAt: FACTORY_DATE,
    rig: {
      effects: chain.map((fx, i) => ({ id: `nixx-${slug}-${i}-${fx.type}`, enabled: true, ...fx })),
      masterVolume,
      inputGain,
    },
  }
}

export interface FactoryPatch extends Patch { description: string }

const gate = (threshold = -55, release = 80): FactoryFx => ({ type: 'noise-gate', params: { threshold, release } })
const comp = (threshold: number, ratio: number, attack: number, release: number): FactoryFx => ({ type: 'compressor', params: { threshold, ratio, attack, release } })
const od = (drive: number, tone: number, level: number): FactoryFx => ({ type: 'overdrive', params: { drive, tone, level } })
const dist = (drive: number, tone: number, level: number, mode = 'soft'): FactoryFx => ({ type: 'distortion', extraValue: mode, params: { drive, tone, level } })
const amp = (modelId: string, gain: number, bass: number, mid: number, treble: number, presence: number, master: number): FactoryFx =>
  ({ type: 'amp', modelId, params: { gain, bass, mid, treble, presence, master } })
const cab = (modelId: string, mic: 'center' | 'edge' = 'center'): FactoryFx => ({ type: 'cab', modelId, extraValue: mic, params: {} })
const delay = (time: number, feedback: number, mix: number): FactoryFx => ({ type: 'delay', params: { time, feedback, mix } })
const reverb = (decay: number, mix: number): FactoryFx => ({ type: 'reverb', params: { decay, mix } })

export const FACTORY_PATCHES: FactoryPatch[] = [
  preset('clean', 'NIXX Clean', 'Glassy Twin clean with light compression and room', [
    gate(-60, 80),
    comp(-24, 3, 10, 200),
    amp('clean-twin', 2, 5, 5, 6, 6, 4),
    reverb(18, 22),
  ]),

  preset('clean-sky', 'NIXX Clean Sky', 'Ambient clean with long delay and a deep wash', [
    comp(-22, 3, 15, 300),
    amp('jazz-clean', 2, 5, 4, 6, 6, 4),
    cab('2x12-twin'),
    { type: 'chorus', enabled: false, params: { rate: 5, depth: 6, mix: 35 } },
    delay(480, 55, 25),
    reverb(60, 60),
  ]),

  preset('funk', 'NIXX Funk', 'Squashed chicken-pickin clean with auto-wah and a slow phaser', [
    gate(-60, 60),
    comp(-30, 6, 5, 150),
    { type: 'auto-wah', params: { sense: 70, range: 55, q: 10, mix: 100 }, extraValue: 'up' },
    amp('jazz-clean', 3, 4, 6, 7, 8, 3),
    cab('2x12-twin'),
    { type: 'phaser', params: { rate: 6, depth: 45, feedback: 30 } },
    reverb(12, 12),
  ]),

  preset('blues-od', 'NIXX Blues OD', 'Compressed tweed pushed into breakup', [
    gate(-50, 80),
    comp(-20, 4, 3, 250),
    amp('tweed-bass', 6, 5, 6, 6, 7, 2),
  ], 0.86, 0.8),

  preset('butter-od', 'NIXX Butter OD', 'Soft distortion into a Twin with delay and reverb', [
    gate(-50, 80),
    comp(-20, 4, 3, 250),
    dist(33, 4600, 13),
    amp('clean-twin', 3, 5, 5, 7, 8, 2),
    delay(350, 40, 30),
    reverb(20, 30),
  ], 0.86, 0.8),

  preset('drive', 'NIXX Drive', 'Pushed Plexi crunch for rock rhythm', [
    gate(-55, 80),
    od(30, 4500, 70),
    amp('plexi', 4, 5, 7, 6, 6, 3),
    cab('4x12-brit'),
    delay(320, 20, 12),
    reverb(15, 15),
  ]),

  preset('lead', 'NIXX Lead', 'Boosted Hot Rod solo with delay and room', [
    gate(-50, 120),
    od(8, 4600, 33),
    amp('hot-rod', 7, 5, 7, 6, 5, 2),
    cab('4x12-vintage'),
    delay(450, 30, 26),
    reverb(25, 30),
  ]),

  preset('metal', 'NIXX Metal', 'Distortion into a 5150-style head, tight lows', [
    gate(-45, 50),
    dist(69, 5000, 35),
    amp('modern-lead', 6, 6, 5, 6, 6, 2),
    cab('4x12-vintage'),
    { type: 'eq', params: { b100: -3, b250: 0, b630: -1, b1600: 1, b4000: 1, b10000: 2 } },
  ]),
]

export const isFactoryPatchId = (id: string | null) => Boolean(id?.startsWith('nixx-'))
