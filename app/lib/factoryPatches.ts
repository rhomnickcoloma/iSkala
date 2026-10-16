import type { Patch } from './patches'

// Starting points modelled on well-documented rigs; knob values are mapped onto FretWiki's own ranges.
// Overdrive/distortion level 50 ≈ unity, 100 ≈ +6 dB. Reverb decay is in tenths of a second.

interface FactoryFx {
  type: string
  params: Record<string, number>
  modelId?: string
  extraValue?: string
  enabled?: boolean
}

const FACTORY_DATE = '2026-10-16T00:00:00.000Z'

function preset(slug: string, name: string, description: string, chain: FactoryFx[], inputGain = 1, masterVolume = 0.8): FactoryPatch {
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
const amp = (modelId: string, gain: number, bass: number, mid: number, treble: number, presence: number, master: number): FactoryFx =>
  ({ type: 'amp', modelId, params: { gain, bass, mid, treble, presence, master } })
const cab = (modelId: string, mic: 'center' | 'edge' = 'center'): FactoryFx => ({ type: 'cab', modelId, extraValue: mic, params: {} })
const delay = (time: number, feedback: number, mix: number): FactoryFx => ({ type: 'delay', params: { time, feedback, mix } })
const reverb = (decay: number, mix: number): FactoryFx => ({ type: 'reverb', params: { decay, mix } })

export const FACTORY_PATCHES: FactoryPatch[] = [
  // Mayer-style glassy clean: loud clean Twin, light compression, a touch of warm delay
  preset('clean', 'NIXX Clean', 'Glassy Twin clean with light compression', [
    gate(-60, 80),
    comp(-24, 3, 10, 200),
    amp('clean-twin', 3, 5, 5, 6, 6, 5),
    cab('2x12-twin'),
    delay(380, 20, 15),
    reverb(18, 22),
  ]),

  // Ambient pad: JC clean, slow chorus, ~480 ms delay at 45% feedback, long hall at 50% mix
  preset('clean-sky', 'NIXX Clean Sky', 'Ambient clean with slow chorus and a long wash', [
    comp(-22, 3, 15, 300),
    amp('jazz-clean', 2, 5, 4, 6, 6, 5),
    cab('2x12-twin'),
    { type: 'chorus', params: { rate: 5, depth: 6, mix: 35 } },
    delay(480, 45, 35),
    reverb(60, 50),
  ]),

  // Funk rhythm: heavy, fast compression into a bright clean with a slow phaser
  preset('funk', 'NIXX Funk', 'Squashed, bright clean with a slow phaser', [
    gate(-60, 60),
    comp(-30, 6, 5, 150),
    amp('jazz-clean', 3, 4, 6, 7, 6, 5),
    cab('2x12-twin'),
    { type: 'phaser', params: { rate: 6, depth: 45, feedback: 30 } },
    reverb(12, 12),
  ]),

  // SRV: Tube Screamer as a mid boost (drive low, level high, tone past noon) into a Fender at the edge of breakup
  preset('blues-od', 'NIXX Blues OD', 'Tube Screamer boost into an edge-of-breakup tweed', [
    gate(-58, 90),
    od(12, 4800, 85),
    amp('tweed-bass', 5, 5, 6, 6, 5, 6),
    cab('4x10-bassman'),
    reverb(15, 20),
  ]),

  // Dumble-style "butter": light comp, gentle transparent drive, smooth amp, warm short delay
  preset('butter-od', 'NIXX Butter OD', 'Smooth Dumble-style lead with warm delay', [
    gate(-58, 100),
    comp(-20, 3, 20, 250),
    od(25, 3200, 70),
    amp('smooth-od', 5, 5, 6, 5, 4, 5),
    cab('1x12-open'),
    delay(420, 25, 20),
    reverb(20, 18),
  ]),

  // Classic rock: overdrive pushed to about 1 o'clock into a Plexi and Greenbacks
  preset('drive', 'NIXX Drive', 'Pushed Plexi crunch for rock rhythm', [
    gate(-55, 80),
    od(30, 4500, 70),
    amp('plexi', 6, 5, 7, 6, 6, 5),
    cab('4x12-brit'),
    delay(320, 20, 12),
    reverb(15, 15),
  ]),

  // Singing high-gain solo: boosted Hot Rod with mids up, delay and some room
  preset('lead', 'NIXX Lead', 'Boosted high-gain solo with delay', [
    gate(-50, 120),
    od(5, 4500, 85),
    amp('hot-rod', 7, 5, 7, 6, 5, 5),
    cab('4x12-vintage'),
    delay(450, 30, 25),
    reverb(25, 20),
  ]),

  // Modern metal 5150: gate, TS boost (drive ~0, level ~9), amp gain only ~6, tightened lows, no reverb
  preset('metal', 'NIXX Metal', 'Tight boosted 5150-style rhythm', [
    gate(-45, 50),
    od(3, 4500, 90),
    amp('modern-lead', 6, 6, 5, 6, 6, 4),
    cab('4x12-vintage'),
    { type: 'eq', params: { b100: -3, b250: 0, b630: -1, b1600: 1, b4000: 1, b10000: -2 } },
  ]),
]

export const isFactoryPatchId = (id: string | null) => Boolean(id?.startsWith('nixx-'))
