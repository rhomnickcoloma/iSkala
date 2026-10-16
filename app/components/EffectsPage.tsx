'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { getFile, setFile, deleteFile } from '../lib/fileStore'
import { Icon, type IconName } from './Icons'
import { autoCorrelate, getClosestNote } from '../lib/pitch'

interface ChainWire { id: string; d: string; x1: number; y1: number; x2: number; y2: number; from: string; to: string }

// ─── Rotary Knob Component ───

function RotaryKnob({ value, min, max, step, onChange, color, label, valueText }: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void; color?: string
  label?: string; valueText?: string
}) {
  const knobRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange

  const pct = (value - min) / (max - min)
  const angle = -135 + pct * 270

  // React's onWheel is passive, so preventDefault (to stop page scroll) needs a native listener
  useEffect(() => {
    const el = knobRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      const next = Math.max(min, Math.min(max, valueRef.current + dir * step))
      if (next !== valueRef.current) onChangeRef.current(next)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [min, max, step])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    startY.current = e.clientY
    startVal.current = value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dy = startY.current - e.clientY
    const range = max - min
    const sensitivity = range / 120
    let newVal = startVal.current + dy * sensitivity
    newVal = Math.round(newVal / step) * step
    newVal = Math.max(min, Math.min(max, newVal))
    if (newVal !== value) onChange(newVal)
  }

  const onPointerUp = () => { dragging.current = false }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const bigStep = Math.max(step, Math.round((max - min) / 10 / step) * step)
    const deltas: Record<string, number> = {
      ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step,
      PageUp: bigStep, PageDown: -bigStep, Home: min - value, End: max - value,
    }
    if (!(e.key in deltas)) return
    e.preventDefault()
    const next = Math.max(min, Math.min(max, Math.round((value + deltas[e.key]) / step) * step))
    if (next !== value) onChange(next)
  }

  return (
    <div
      ref={knobRef}
      className="fx-rotary"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ '--knob-angle': `${angle}deg`, '--knob-color': color || '#888' } as React.CSSProperties}
    >
      <div className="fx-rotary-track" />
      <div className="fx-rotary-body">
        <div className="fx-rotary-indicator" />
      </div>
    </div>
  )
}

// ─── Effect Definitions ───

type EffectId = string

interface ParamDef {
  key: string; label: string; min: number; max: number; step: number
  defaultValue: number; unit: string; displayFn?: (v: number) => string
}

interface ModelOption { id: string; name: string; character: string; group?: string }

interface EffectDef {
  type: string; label: string; color: string; icon: IconName
  params: ParamDef[]
  extra?: { options: string[]; key: string; label: string }
  isAmp?: boolean; isCab?: boolean
  models?: ModelOption[]
}

interface EffectInstance {
  id: EffectId; type: string; enabled: boolean
  params: Record<string, number>; extraValue?: string; modelId?: string; irName?: string; namName?: string
}

// Tone-stack voicings follow the classic families modelled in Guitarix (open-source amp sim)
type ToneStack = 'fender' | 'marshall' | 'vox' | 'mesa' | 'flat'

const TONE_STACKS: Record<ToneStack, { bass: number; mid: number; midQ: number; scoop: number; treble: number }> = {
  fender:   { bass: 120, mid: 450, midQ: 0.6, scoop: -4, treble: 2500 },
  marshall: { bass: 100, mid: 700, midQ: 0.8, scoop: -1, treble: 2800 },
  vox:      { bass: 120, mid: 1000, midQ: 0.7, scoop: -2, treble: 3200 },
  mesa:     { bass: 90, mid: 600, midQ: 0.9, scoop: -3, treble: 3000 },
  flat:     { bass: 150, mid: 800, midQ: 0.7, scoop: 0, treble: 3000 },
}

interface AmpModel extends ModelOption {
  gain: number; bass: number; mid: number; treble: number; presence: number
  drive: number    // preamp gain at Gain = 10
  stages: 1 | 2
  tight: number    // pre-clip highpass (Hz)
  asym: number     // 0 = symmetric clipping, higher = more even harmonics
  bright: number   // pre-clip treble boost (dB)
  stack: ToneStack
}

const AMP_MODELS: AmpModel[] = [
  { id: 'clean-twin', name: 'Crystal Twin', character: 'Twin Reverb-style', group: 'Clean', gain: 3, bass: 5, mid: 5, treble: 6, presence: 5, drive: 6, stages: 1, tight: 70, asym: 0.05, bright: 3, stack: 'fender' },
  { id: 'princeton', name: 'Little Prince', character: 'Princeton-style', group: 'Clean', gain: 4, bass: 5, mid: 5, treble: 6, presence: 4, drive: 10, stages: 1, tight: 90, asym: 0.1, bright: 2, stack: 'fender' },
  { id: 'jazz-clean', name: 'Jazz Chorus', character: 'JC-120-style solid state', group: 'Clean', gain: 2, bass: 5, mid: 5, treble: 5, presence: 5, drive: 3, stages: 1, tight: 60, asym: 0, bright: 0, stack: 'flat' },
  { id: 'top-boost', name: 'Top Boost 30', character: 'AC30-style chime', group: 'Clean', gain: 5, bass: 5, mid: 5, treble: 7, presence: 5, drive: 16, stages: 1, tight: 100, asym: 0.15, bright: 4, stack: 'vox' },
  { id: 'tweed-bass', name: 'Tweed 4×10', character: "'59 Bassman-style", group: 'Crunch', gain: 6, bass: 6, mid: 6, treble: 6, presence: 5, drive: 20, stages: 1, tight: 80, asym: 0.2, bright: 2, stack: 'fender' },
  { id: 'blues-amp', name: 'Blues Breaker', character: 'JTM45-style', group: 'Crunch', gain: 5, bass: 6, mid: 5, treble: 5, presence: 4, drive: 20, stages: 1, tight: 90, asym: 0.2, bright: 1, stack: 'marshall' },
  { id: 'plexi', name: 'Plexi 100', character: 'Super Lead-style', group: 'Crunch', gain: 6, bass: 5, mid: 7, treble: 6, presence: 6, drive: 28, stages: 1, tight: 110, asym: 0.2, bright: 3, stack: 'marshall' },
  { id: 'crunch-brit', name: 'British Crunch', character: 'JCM800-style', group: 'Crunch', gain: 6, bass: 6, mid: 7, treble: 5, presence: 6, drive: 40, stages: 2, tight: 120, asym: 0.15, bright: 2, stack: 'marshall' },
  { id: 'smooth-od', name: 'Smooth Overdrive', character: 'Dumble-style', group: 'Crunch', gain: 5, bass: 5, mid: 6, treble: 5, presence: 4, drive: 30, stages: 2, tight: 90, asym: 0.25, bright: 0, stack: 'fender' },
  { id: 'hot-rod', name: 'Hot Rod 100', character: 'SLO-100-style', group: 'High Gain', gain: 7, bass: 5, mid: 6, treble: 6, presence: 6, drive: 70, stages: 2, tight: 130, asym: 0.1, bright: 2, stack: 'marshall' },
  { id: 'high-gain', name: 'Rectified', character: 'Dual Rectifier-style', group: 'High Gain', gain: 8, bass: 5, mid: 6, treble: 7, presence: 7, drive: 90, stages: 2, tight: 140, asym: 0.05, bright: 1, stack: 'mesa' },
  { id: 'modern-lead', name: 'Modern Lead', character: '5150-style', group: 'High Gain', gain: 8, bass: 4, mid: 7, treble: 6, presence: 7, drive: 110, stages: 2, tight: 150, asym: 0.05, bright: 2, stack: 'marshall' },
  { id: 'teutonic', name: 'Teutonic', character: 'Engl-style, tight', group: 'High Gain', gain: 8, bass: 5, mid: 5, treble: 6, presence: 6, drive: 100, stages: 2, tight: 160, asym: 0.05, bright: 1, stack: 'mesa' },
  { id: 'bass-classic', name: 'Bass Classic', character: 'SVT-style bass amp', group: 'Bass & Acoustic', gain: 4, bass: 6, mid: 5, treble: 5, presence: 4, drive: 8, stages: 1, tight: 30, asym: 0.15, bright: 0, stack: 'flat' },
  { id: 'acoustic-sim', name: 'Acoustic Sim', character: 'Piezo-like', group: 'Bass & Acoustic', gain: 2, bass: 4, mid: 6, treble: 8, presence: 3, drive: 2, stages: 1, tight: 80, asym: 0, bright: 2, stack: 'flat' },
]

interface CabModel extends ModelOption {
  hp: number; lp: number
  peaks: [freq: number, gainDb: number, q: number][]
  irFile?: string
}

// Speaker/cabinet voicings modelled after the cabinet list shipped with Guitarix
const CAB_MODELS: CabModel[] = [
  // Real impulse responses bundled in public/nam/irs (MIT, see public/nam/README.md)
  { id: 'ir-celestion', name: 'Celestion IR', character: 'Real cab IR · British speaker', group: 'Real IRs', hp: 0, lp: 0, peaks: [], irFile: 'celestion.wav' },
  { id: 'ir-eminence', name: 'Eminence IR', character: 'Real cab IR · American speaker', group: 'Real IRs', hp: 0, lp: 0, peaks: [], irFile: 'eminence.wav' },
  { id: 'ir-mesa', name: 'Mesa IR', character: 'Real cab IR · Mesa-style 4×12', group: 'Real IRs', hp: 0, lp: 0, peaks: [], irFile: 'mesa.wav' },
  { id: 'ir-ampeg', name: 'Bass Cab IR', character: 'Real cab IR · Ampeg-style bass', group: 'Real IRs', hp: 0, lp: 0, peaks: [], irFile: 'ampeg.wav' },
  { id: '1x12-open', name: '1×12 Open', character: 'Deluxe-style, airy', group: 'Combo', hp: 75, lp: 5500, peaks: [[120, 3, 1.2], [2200, 3, 1.5], [4000, -4, 3]] },
  { id: '2x10-tweed', name: '2×10 Tweed', character: 'Vintage, boxy', group: 'Combo', hp: 90, lp: 5000, peaks: [[150, 2, 1], [1800, 4, 1.2], [3500, -3, 3]] },
  { id: '2x12-twin', name: '2×12 Twin', character: 'Wide, sparkly', group: 'Combo', hp: 70, lp: 6500, peaks: [[100, 2, 1], [2500, 3, 1.2], [5000, -3, 2]] },
  { id: '2x12-blue', name: '2×12 Alnico Blue', character: 'AC30-style chime', group: 'Combo', hp: 90, lp: 6000, peaks: [[200, -2, 1], [1500, 2, 1], [3200, 5, 1.5], [5000, -3, 3]] },
  { id: '4x10-bassman', name: '4×10 Tweed', character: 'Bassman-style', group: 'Combo', hp: 70, lp: 5200, peaks: [[110, 3, 1], [1200, 2, 1], [2600, 3, 1.5]] },
  { id: '2x12-closed', name: '2×12 Closed', character: 'Tight, focused', group: 'Cabinet', hp: 95, lp: 5500, peaks: [[130, 3, 1.2], [1500, 3, 1]] },
  { id: '4x12-brit', name: '4×12 Greenback', character: 'Classic rock thump', group: 'Cabinet', hp: 85, lp: 4800, peaks: [[110, 4, 1.3], [1800, 4, 1.2], [3500, -4, 2]] },
  { id: '4x12-vintage', name: '4×12 V30', character: 'Aggressive upper mids', group: 'Cabinet', hp: 85, lp: 5200, peaks: [[100, 3, 1.3], [2500, 5, 1.5], [4500, -3, 3]] },
  { id: '4x12-modern', name: '4×12 Oversized', character: 'Deep, scooped', group: 'Cabinet', hp: 75, lp: 6000, peaks: [[90, 5, 1.4], [700, -3, 1], [3000, 3, 1.2]] },
  { id: '1x15-bass', name: '1×15 Bass', character: 'Round low end', group: 'Bass', hp: 40, lp: 3500, peaks: [[80, 4, 1], [800, -2, 1]] },
  { id: '8x10-bass', name: '8×10 Bass', character: 'Punchy, huge', group: 'Bass', hp: 45, lp: 4500, peaks: [[70, 3, 1], [400, -2, 1], [1500, 2, 1]] },
  { id: 'custom-ir', name: 'Custom IR (.wav)', character: 'Load your own impulse response', group: 'Other', hp: 0, lp: 0, peaks: [] },
  { id: 'direct', name: 'DI / Direct', character: 'No coloring', group: 'Other', hp: 0, lp: 0, peaks: [] },
]

const IR_KEY_PREFIX = 'fretwiki-effects-ir-'
const MAX_IR_BYTES = 1_500_000
const NAM_KEY_PREFIX = 'nam-'
const MAX_NAM_BYTES = 30_000_000
// NAM models report loudness relative to this reference; the engine doesn't resample, and most captures are trained at 48 kHz
const NAM_TARGET_LOUDNESS_DB = -18
const SAMPLE_RATES = [44100, 48000, 88200, 96000]
const DEFAULT_SAMPLE_RATE = 48000
const dbToGain = (db: number) => 10 ** (db / 20)

interface NamSlot {
  node: import('neural-amp-modeler-wasm/engine').NamNode
  modelKey: string | null
  quality: string | null
  loudness: number | null
}

// Bundled in public/nam (MIT, TONE3000 neural-amp-modeler-wasm demo assets; see public/nam/README.md)
const NAM_LIBRARY: (ModelOption & { file: string })[] = [
  { id: 'deluxe-a2', name: 'Deluxe Clean (A2)', character: 'Deluxe Reverb-style clean, slimmable', group: 'Clean', file: 'deluxe-a2.nam' },
  { id: 'deluxe', name: 'Deluxe Clean', character: 'Deluxe Reverb-style clean', group: 'Clean', file: 'deluxe.nam' },
  { id: 'jc', name: 'JC Clean', character: 'JC-120-style solid-state clean', group: 'Clean', file: 'jc.nam' },
  { id: 'ac10', name: 'AC10 Chime', character: 'AC10-style chime and breakup', group: 'Crunch', file: 'ac10.nam' },
  { id: 'dumble', name: 'ODS Overdrive', character: 'Dumble-style smooth overdrive', group: 'Crunch', file: 'dumble.nam' },
  { id: 'jcm', name: 'JCM Crunch', character: 'JCM800-style rock crunch', group: 'Crunch', file: 'jcm.nam' },
  { id: '5153', name: '5153 High Gain', character: '5150-style high gain · by pipppriss', group: 'High Gain', file: '5153.nam' },
  { id: 'ampeg', name: 'Bass Classic', character: 'Ampeg-style bass amp', group: 'Bass', file: 'ampeg.nam' },
]
const NAM_CUSTOM_ID = 'custom'
const NAM_DEFAULT_ID = 'jcm'

const libraryJsonCache = new Map<string, Promise<string>>()
function fetchLibraryNam(id: string): Promise<string> {
  const entry = NAM_LIBRARY.find(m => m.id === id)
  if (!entry) return Promise.reject(new Error(`unknown model "${id}"`))
  let p = libraryJsonCache.get(id)
  if (!p) {
    p = fetch(`/nam/models/${entry.file}`).then(r => {
      if (!r.ok) throw new Error(`download failed (${r.status})`)
      return r.text()
    })
    p.catch(() => libraryJsonCache.delete(id))
    libraryJsonCache.set(id, p)
  }
  return p
}

// Identifies which model a Neural Amp should be running; null = nothing to load (custom slot is empty)
function namModelKey(fx: EffectInstance): string | null {
  if (fx.modelId === NAM_CUSTOM_ID) return fx.namName ? `file:${fx.namName}` : null
  return `lib:${fx.modelId || NAM_DEFAULT_ID}`
}

function eqLabel(hz: number) { return hz >= 1000 ? `${hz / 1000}k` : String(hz) }
const EQ_BANDS = [100, 250, 630, 1600, 4000, 10000]
const signedDb = (v: number) => `${v > 0 ? '+' : ''}${v}`

// Shared clipper so every mode has the same small-signal gain for a given drive
function makeClipCurve(gain: number, mode: 'soft' | 'hard' | 'fuzz', asym = 0) {
  const n = 4096
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1
    const gx = gain * x
    let y: number
    if (mode === 'hard') {
      const a = Math.abs(gx)
      y = Math.sign(gx) * (a < 0.9 ? a : 0.9 + 0.1 * Math.tanh((a - 0.9) / 0.1))
    } else if (mode === 'fuzz') {
      y = gx >= 0 ? Math.tanh(1.4 * gx) : 0.85 * Math.tanh(0.7 * gx)
    } else {
      y = gx >= 0 ? Math.tanh(gx) : Math.tanh(gx * (1 + asym)) / (1 + asym)
    }
    curve[i] = y
  }
  return curve
}

// Keeps output level roughly constant as drive rises (typical guitar input ≈ -20 dBFS)
function driveCompensation(gain: number) {
  return Math.max(0.5, Math.min(4, 0.6 / Math.tanh(gain * 0.1)))
}

const EFFECT_CATALOG: Record<string, EffectDef> = {
  'noise-gate': {
    type: 'noise-gate', label: 'Noise Gate', color: '#a8d8a8', icon: 'shield',
    params: [
      { key: 'threshold', label: 'Thresh', min: -80, max: 0, step: 1, defaultValue: -50, unit: 'dB' },
      { key: 'release', label: 'Release', min: 10, max: 500, step: 5, defaultValue: 80, unit: 'ms' },
    ],
  },
  'compressor': {
    type: 'compressor', label: 'Compressor', color: '#a8c8e8', icon: 'shrink',
    params: [
      { key: 'threshold', label: 'Thresh', min: -60, max: 0, step: 1, defaultValue: -20, unit: 'dB' },
      { key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 1, defaultValue: 4, unit: ':1' },
      { key: 'attack', label: 'Attack', min: 0, max: 100, step: 1, defaultValue: 3, unit: 'ms' },
      { key: 'release', label: 'Release', min: 10, max: 1000, step: 10, defaultValue: 250, unit: 'ms' },
    ],
  },
  'eq': {
    type: 'eq', label: '6-Band EQ', color: '#e8d8a8', icon: 'sliders',
    params: EQ_BANDS.map(hz => ({
      key: `b${hz}`, label: eqLabel(hz), min: -15, max: 15, step: 1, defaultValue: 0, unit: 'dB', displayFn: signedDb,
    })),
  },
  'distortion': {
    type: 'distortion', label: 'Distortion', color: '#e8a8a8', icon: 'flame',
    params: [
      { key: 'drive', label: 'Drive', min: 1, max: 100, step: 1, defaultValue: 50, unit: '' },
      { key: 'tone', label: 'Tone', min: 500, max: 10000, step: 100, defaultValue: 5000, unit: '', displayFn: v => `${(v / 1000).toFixed(1)}k` },
      { key: 'level', label: 'Level', min: 0, max: 100, step: 1, defaultValue: 50, unit: '%' },
    ],
    extra: { options: ['soft', 'hard', 'fuzz'], key: 'distType', label: 'Mode' },
  },
  'overdrive': {
    type: 'overdrive', label: 'Overdrive', color: '#c8e8a8', icon: 'zap',
    params: [
      { key: 'drive', label: 'Drive', min: 1, max: 100, step: 1, defaultValue: 30, unit: '' },
      { key: 'tone', label: 'Tone', min: 500, max: 8000, step: 100, defaultValue: 3000, unit: '', displayFn: v => `${(v / 1000).toFixed(1)}k` },
      { key: 'level', label: 'Level', min: 0, max: 100, step: 1, defaultValue: 60, unit: '%' },
    ],
  },
  'chorus': {
    type: 'chorus', label: 'Chorus', color: '#d8a8e8', icon: 'waves',
    params: [
      { key: 'rate', label: 'Rate', min: 1, max: 100, step: 1, defaultValue: 15, unit: 'Hz', displayFn: v => `${(v / 10).toFixed(1)}` },
      { key: 'depth', label: 'Depth', min: 1, max: 20, step: 1, defaultValue: 5, unit: 'ms' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, defaultValue: 30, unit: '%' },
    ],
  },
  'flanger': {
    type: 'flanger', label: 'Flanger', color: '#a8e8d8', icon: 'orbit',
    params: [
      { key: 'rate', label: 'Rate', min: 1, max: 100, step: 1, defaultValue: 5, unit: 'Hz', displayFn: v => `${(v / 10).toFixed(1)}` },
      { key: 'depth', label: 'Depth', min: 1, max: 10, step: 1, defaultValue: 3, unit: 'ms' },
      { key: 'feedback', label: 'FB', min: 0, max: 90, step: 1, defaultValue: 50, unit: '%' },
    ],
  },
  'phaser': {
    type: 'phaser', label: 'Phaser', color: '#e8c8d8', icon: 'sparkles',
    params: [
      { key: 'rate', label: 'Rate', min: 1, max: 100, step: 1, defaultValue: 8, unit: 'Hz', displayFn: v => `${(v / 10).toFixed(1)}` },
      { key: 'depth', label: 'Depth', min: 0, max: 100, step: 1, defaultValue: 60, unit: '%' },
      { key: 'feedback', label: 'FB', min: 0, max: 90, step: 1, defaultValue: 40, unit: '%' },
    ],
  },
  'tremolo': {
    type: 'tremolo', label: 'Tremolo', color: '#d8e8c8', icon: 'activity',
    params: [
      { key: 'rate', label: 'Rate', min: 1, max: 200, step: 1, defaultValue: 50, unit: 'Hz', displayFn: v => `${(v / 10).toFixed(1)}` },
      { key: 'depth', label: 'Depth', min: 0, max: 100, step: 1, defaultValue: 50, unit: '%' },
    ],
  },
  'delay': {
    type: 'delay', label: 'Delay', color: '#a8b8e8', icon: 'repeat',
    params: [
      { key: 'time', label: 'Time', min: 50, max: 2000, step: 10, defaultValue: 350, unit: 'ms' },
      { key: 'feedback', label: 'FB', min: 0, max: 90, step: 1, defaultValue: 40, unit: '%' },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, defaultValue: 30, unit: '%' },
    ],
  },
  'reverb': {
    type: 'reverb', label: 'Reverb', color: '#c8d8e8', icon: 'landmark',
    params: [
      { key: 'decay', label: 'Decay', min: 1, max: 80, step: 1, defaultValue: 20, unit: 's', displayFn: v => `${(v / 10).toFixed(1)}` },
      { key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, defaultValue: 30, unit: '%' },
    ],
  },
  'nam': {
    type: 'nam', label: 'Neural Amp', color: '#f0b0d0', icon: 'brain',
    models: [
      { id: NAM_CUSTOM_ID, name: 'Load your own (.nam)', character: 'Any NAM capture from your computer', group: 'Your Files' },
      ...NAM_LIBRARY.map(({ id, name, character, group }) => ({ id, name, character, group: `Sample · ${group}` })),
    ],
    params: [
      { key: 'input', label: 'Input', min: -24, max: 24, step: 1, defaultValue: 0, unit: 'dB', displayFn: signedDb },
      { key: 'output', label: 'Output', min: -24, max: 24, step: 1, defaultValue: 0, unit: 'dB', displayFn: signedDb },
    ],
    extra: { options: ['full', 'lite'], key: 'quality', label: 'Quality' },
  },
  'amp': {
    type: 'amp', label: 'Amplifier', color: '#f0c878', icon: 'speaker', isAmp: true,
    models: AMP_MODELS.map(a => ({ id: a.id, name: a.name, character: a.character, group: a.group })),
    params: [
      { key: 'gain', label: 'Gain', min: 0, max: 10, step: 1, defaultValue: 6, unit: '' },
      { key: 'bass', label: 'Bass', min: 0, max: 10, step: 1, defaultValue: 6, unit: '' },
      { key: 'mid', label: 'Mid', min: 0, max: 10, step: 1, defaultValue: 7, unit: '' },
      { key: 'treble', label: 'Treble', min: 0, max: 10, step: 1, defaultValue: 5, unit: '' },
      { key: 'presence', label: 'Pres', min: 0, max: 10, step: 1, defaultValue: 6, unit: '' },
      { key: 'master', label: 'Master', min: 0, max: 10, step: 1, defaultValue: 5, unit: '' },
    ],
  },
  'cab': {
    type: 'cab', label: 'Cabinet', color: '#d4a87c', icon: 'box', isCab: true,
    models: CAB_MODELS.map(c => ({ id: c.id, name: c.name, character: c.character, group: c.group })),
    extra: { options: ['center', 'edge'], key: 'mic', label: 'Mic' },
    params: [],
  },
}

// ─── Helpers ───

let instanceCounter = 0
function newId(): EffectId { return `fx_${Date.now()}_${instanceCounter++}` }

function createEffect(type: string, modelId?: string, id: EffectId = newId()): EffectInstance {
  const def = EFFECT_CATALOG[type]
  const params: Record<string, number> = {}
  def.params.forEach(p => { params[p.key] = p.defaultValue })
  const fx: EffectInstance = { id, type, enabled: true, params, extraValue: def.extra?.options[0] }
  if (def.isAmp) {
    const amp = AMP_MODELS.find(a => a.id === (modelId || 'crunch-brit')) || AMP_MODELS.find(a => a.id === 'crunch-brit')!
    fx.modelId = amp.id
    fx.params = { gain: amp.gain, bass: amp.bass, mid: amp.mid, treble: amp.treble, presence: amp.presence, master: 5 }
  }
  if (def.isCab) fx.modelId = modelId || '4x12-brit'
  if (type === 'nam') fx.modelId = modelId || NAM_CUSTOM_ID
  return fx
}

// Fixed ids so server and client render identical markup
function defaultChain(): EffectInstance[] {
  return [
    createEffect('noise-gate', undefined, 'default-gate'),
    createEffect('compressor', undefined, 'default-comp'),
    createEffect('distortion', undefined, 'default-dist'),
    createEffect('amp', 'crunch-brit', 'default-amp'),
    createEffect('cab', '4x12-brit', 'default-cab'),
    createEffect('delay', undefined, 'default-delay'),
    createEffect('reverb', undefined, 'default-reverb'),
  ]
}

const STORAGE_KEY = 'fretwiki-effects-v1'

interface SavedRig {
  effects: EffectInstance[]
  selectedInput: string
  selectedOutput: string
  masterVolume: number
  inputGain: number
  sampleRate: number
}

function bufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function base64ToBuffer(b64: string) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function clampNum(v: unknown, min: number, max: number, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
}

// Stored data may be from an older build or hand-edited, so rebuild each effect against the catalog
function sanitizeEffects(raw: unknown): EffectInstance[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const out: EffectInstance[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Partial<EffectInstance>
    const def = r.type ? EFFECT_CATALOG[r.type] : undefined
    if (!def) continue
    const base = createEffect(def.type, typeof r.modelId === 'string' ? r.modelId : undefined)
    const id = typeof r.id === 'string' && !seen.has(r.id) ? r.id : base.id
    seen.add(id)
    const params: Record<string, number> = {}
    def.params.forEach(p => { params[p.key] = clampNum(r.params?.[p.key], p.min, p.max, base.params[p.key]) })
    out.push({
      ...base,
      id,
      enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
      params,
      extraValue: def.extra && typeof r.extraValue === 'string' && def.extra.options.includes(r.extraValue) ? r.extraValue : base.extraValue,
      modelId: def.models?.some(m => m.id === r.modelId) ? r.modelId
        // Neural Amps saved before the bundled library existed only had a user-loaded file
        : def.type === 'nam' && typeof r.namName === 'string' ? NAM_CUSTOM_ID
        : base.modelId,
      irName: typeof r.irName === 'string' ? r.irName : undefined,
      namName: typeof r.namName === 'string' ? r.namName : undefined,
    })
  }
  return out
}

// ─── Component ───

interface EffectsPageProps { onClose: () => void }

export default function EffectsPage({ onClose }: EffectsPageProps) {
  const [effects, setEffects] = useState<EffectInstance[]>(defaultChain)

  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedInput, setSelectedInput] = useState('')
  const [selectedOutput, setSelectedOutput] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [muted, setMuted] = useState(true)
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE)
  const [inputLevel, setInputLevel] = useState(0)
  const [outputLevel, setOutputLevel] = useState(0)
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [inputGain, setInputGain] = useState(1.0)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [tunerOpen, setTunerOpen] = useState(false)
  const [tunerReading, setTunerReading] = useState<{ note: string; cents: number; hz: number } | null>(null)
  const [armedId, setArmedId] = useState<EffectId | null>(null)
  const [wires, setWires] = useState<ChainWire[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  // Read after mount (not in useState initializers) to keep SSR markup identical
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedRig>
        const fx = sanitizeEffects(saved.effects)
        if (fx) setEffects(fx)
        if (typeof saved.selectedInput === 'string') setSelectedInput(saved.selectedInput)
        if (typeof saved.selectedOutput === 'string') setSelectedOutput(saved.selectedOutput)
        setMasterVolume(clampNum(saved.masterVolume, 0, 1, 0.8))
        setInputGain(clampNum(saved.inputGain, 0, 2, 1))
        if (typeof saved.sampleRate === 'number' && SAMPLE_RATES.includes(saved.sampleRate)) setSampleRate(saved.sampleRate)
      }
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const rig: SavedRig = { effects, selectedInput, selectedOutput, masterVolume, inputGain, sampleRate }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rig)) } catch {}
  }, [loaded, effects, selectedInput, selectedOutput, masterVolume, inputGain, sampleRate])

  useEffect(() => {
    if (selectedInput && inputDevices.length && !inputDevices.some(d => d.deviceId === selectedInput)) setSelectedInput('')
  }, [inputDevices, selectedInput])

  useEffect(() => {
    if (selectedOutput && outputDevices.length && !outputDevices.some(d => d.deviceId === selectedOutput)) setSelectedOutput('')
  }, [outputDevices, selectedOutput])

  const resetRig = () => {
    if (!confirm('Reset the signal chain to the default rig?')) return
    try { effects.forEach(fx => localStorage.removeItem(IR_KEY_PREFIX + fx.id)) } catch {}
    effects.forEach(fx => { if (fx.type === 'nam') deleteFile(NAM_KEY_PREFIX + fx.id) })
    setEffects(defaultChain())
    setMasterVolume(0.8)
    setInputGain(1)
  }

  const computeWires = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const nodes = Array.from(board.querySelectorAll<HTMLElement>('[data-chain-node]'))
    const next: ChainWire[] = []
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1]
      const ax = a.offsetLeft + a.offsetWidth, ay = a.offsetTop + a.offsetHeight / 2
      const bx = b.offsetLeft, by = b.offsetTop + b.offsetHeight / 2
      let d: string
      if (Math.abs(ay - by) < 4 && bx >= ax) {
        d = `M${ax},${ay} L${bx},${by}`
      } else {
        const gapY = (a.offsetTop + a.offsetHeight + b.offsetTop) / 2
        const x1 = ax + 18, x2 = bx - 18
        const r = Math.max(0, Math.min(12, (gapY - ay) / 2, (by - gapY) / 2, (x1 - x2) / 2))
        d = [
          `M${ax},${ay}`, `L${x1 - r},${ay}`, `Q${x1},${ay} ${x1},${ay + r}`,
          `L${x1},${gapY - r}`, `Q${x1},${gapY} ${x1 - r},${gapY}`,
          `L${x2 + r},${gapY}`, `Q${x2},${gapY} ${x2},${gapY + r}`,
          `L${x2},${by - r}`, `Q${x2},${by} ${x2 + r},${by}`, `L${bx},${by}`,
        ].join(' ')
      }
      next.push({
        id: b.dataset.chainId || String(i), d, x1: ax, y1: ay, x2: bx, y2: by,
        from: a.dataset.color || '#555', to: b.dataset.color || '#555',
      })
    }
    setWires(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
  }, [])

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    computeWires()
    const ro = new ResizeObserver(computeWires)
    ro.observe(board)
    board.querySelectorAll('[data-chain-node]').forEach(n => ro.observe(n))
    return () => ro.disconnect()
  }, [effects, computeWires])

  useEffect(() => {
    const disarm = () => setArmedId(null)
    window.addEventListener('pointerup', disarm)
    return () => window.removeEventListener('pointerup', disarm)
  }, [])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nodesRef = useRef<Record<string, AudioNode[]>>({})
  const lfosRef = useRef<OscillatorNode[]>([])
  const gateTimersRef = useRef<number[]>([])
  const irBuffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const irPendingRef = useRef<Set<string>>(new Set())
  const namSlotsRef = useRef<Map<EffectId, NamSlot>>(new Map())
  const namPendingRef = useRef<Set<EffectId>>(new Set())
  const [namLoading, setNamLoading] = useState<Set<EffectId>>(new Set())
  const appliedChainRef = useRef<EffectInstance[] | null>(null)
  const inputGainRef = useRef<GainNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const inputAnalyserRef = useRef<AnalyserNode | null>(null)
  const outputAnalyserRef = useRef<AnalyserNode | null>(null)
  const tunerAnalyserRef = useRef<AnalyserNode | null>(null)
  const animRef = useRef(0)

  useEffect(() => {
    async function enumerate() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        setInputDevices(devices.filter(d => d.kind === 'audioinput'))
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'))
      } catch {}
    }
    enumerate()
  }, [])

  const generateReverbIR = useCallback((ctx: AudioContext, decay: number) => {
    const length = Math.floor(ctx.sampleRate * decay)
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) { const d = impulse.getChannelData(ch); for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2) }
    return impulse
  }, [])

  function startLfo(osc: OscillatorNode) {
    osc.start()
    lfosRef.current.push(osc)
  }

  // ConvolverNode needs an AudioBuffer at the live context's sample rate, so decode lazily then rebuild
  function requestIrDecode(ctx: AudioContext, key: string, load: () => Promise<ArrayBuffer | null>) {
    if (irPendingRef.current.has(key)) return
    irPendingRef.current.add(key)
    load()
      .then(bytes => {
        if (!bytes) throw new Error('missing IR data')
        return ctx.decodeAudioData(bytes)
      })
      .then(buf => {
        irBuffersRef.current.set(key, buf)
        if (audioCtxRef.current === ctx && appliedChainRef.current) connectChain(appliedChainRef.current)
      })
      .catch(() => setError('Could not decode the impulse response file.'))
      .finally(() => irPendingRef.current.delete(key))
  }

  const setNamBusy = (fxId: EffectId, busy: boolean) => {
    setNamLoading(prev => { const next = new Set(prev); if (busy) next.add(fxId); else next.delete(fxId); return next })
  }

  // NAM nodes are created and loaded asynchronously, then the chain is rebuilt to include them
  function requestNamLoad(ctx: AudioContext, fx: EffectInstance) {
    if (namPendingRef.current.has(fx.id)) return
    namPendingRef.current.add(fx.id)
    setNamBusy(fx.id, true)
    ;(async () => {
      const modelKey = namModelKey(fx)
      const json = fx.modelId === NAM_CUSTOM_ID
        ? await getFile(NAM_KEY_PREFIX + fx.id)
        : await fetchLibraryNam(fx.modelId || NAM_DEFAULT_ID)
      if (!json) throw new Error('the saved model file is missing, please load it again')
      const { NamEngine } = await import('neural-amp-modeler-wasm/engine')
      const engine = await NamEngine.attach(ctx)
      if (audioCtxRef.current !== ctx) return
      let slot = namSlotsRef.current.get(fx.id)
      if (!slot) {
        slot = { node: await engine.createNode(), modelKey: null, quality: null, loudness: null }
        namSlotsRef.current.set(fx.id, slot)
      }
      const quality = fx.extraValue || 'full'
      const info = await slot.node.loadModel(json, quality === 'lite' ? { slimSize: 0.3 } : undefined)
      slot.modelKey = modelKey
      slot.quality = quality
      slot.loudness = info.hasLoudness ? info.loudness : null
      if (info.expectedSampleRate > 0 && info.expectedSampleRate !== ctx.sampleRate) {
        setError(`This model was trained at ${info.expectedSampleRate} Hz; audio runs at ${ctx.sampleRate} Hz, so it may sound slightly off. Switch the sample rate next to Output to ${info.expectedSampleRate / 1000} kHz for best results.`)
      }
    })()
      .then(() => { if (audioCtxRef.current === ctx && appliedChainRef.current) connectChain(appliedChainRef.current) })
      .catch(err => setError(`Could not load the NAM model: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => { namPendingRef.current.delete(fx.id); setNamBusy(fx.id, false) })
  }

  const loadNamFile = async (fxId: EffectId, file: File) => {
    if (file.size > MAX_NAM_BYTES) { setError('That .nam file is too large (max 30 MB).'); return }
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as { architecture?: unknown; weights?: unknown }
      if (typeof parsed.architecture !== 'string' || !Array.isArray(parsed.weights)) throw new Error('not a NAM model')
      await setFile(NAM_KEY_PREFIX + fxId, text)
    } catch {
      setError('That file is not a valid .nam model.')
      return
    }
    setError(null)
    const slot = namSlotsRef.current.get(fxId)
    if (slot) slot.modelKey = null
    setEffects(prev => prev.map(fx => fx.id === fxId ? { ...fx, modelId: NAM_CUSTOM_ID, namName: file.name } : fx))
  }

  const loadIrFile = async (fxId: EffectId, file: File) => {
    if (file.size > MAX_IR_BYTES) { setError('IR file is too large (max 1.5 MB). Use a short mono .wav IR.'); return }
    try {
      const bytes = await file.arrayBuffer()
      await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes.slice(0))
      localStorage.setItem(IR_KEY_PREFIX + fxId, bufferToBase64(bytes))
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'QuotaExceededError'
        ? 'Not enough browser storage to save this IR.'
        : 'That file is not a readable .wav impulse response.')
      return
    }
    for (const key of irBuffersRef.current.keys()) if (key.startsWith(`${fxId}|`)) irBuffersRef.current.delete(key)
    setError(null)
    setEffects(prev => prev.map(fx => fx.id === fxId ? { ...fx, irName: file.name } : fx))
    // irName may be unchanged when re-loading the same file name, so rebuild explicitly
    if (appliedChainRef.current) connectChain(appliedChainRef.current)
  }

  function buildEffectNodes(ctx: AudioContext, fx: EffectInstance): AudioNode[] {
    if (!fx.enabled) { const p = ctx.createGain(); p.gain.value = 1; return [p] }
    switch (fx.type) {
      case 'noise-gate': {
        const input = ctx.createGain()
        const gate = ctx.createGain(); gate.gain.value = 0
        const an = ctx.createAnalyser(); an.fftSize = 512
        input.connect(an); input.connect(gate)
        const buf = new Float32Array(an.fftSize)
        const openLevel = 10 ** (fx.params.threshold / 20)
        const closeLevel = openLevel * 0.6
        const release = fx.params.release / 1000
        let open = false, lastAbove = 0
        const timer = window.setInterval(() => {
          an.getFloatTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
          const rms = Math.sqrt(sum / buf.length)
          const now = ctx.currentTime
          if (rms > openLevel) {
            lastAbove = now
            if (!open) { open = true; gate.gain.cancelScheduledValues(now); gate.gain.setTargetAtTime(1, now, 0.002) }
          } else if (open && rms < closeLevel && now - lastAbove > 0.05) {
            open = false; gate.gain.cancelScheduledValues(now); gate.gain.setTargetAtTime(0, now, release / 3)
          }
        }, 10)
        gateTimersRef.current.push(timer)
        return [input, gate]
      }
      case 'compressor': { const c = ctx.createDynamicsCompressor(); c.threshold.value = fx.params.threshold; c.ratio.value = fx.params.ratio; c.attack.value = fx.params.attack / 1000; c.release.value = fx.params.release / 1000; c.knee.value = 6; return [c] }
      case 'eq': {
        const filters = EQ_BANDS.map((hz, i) => {
          const f = ctx.createBiquadFilter()
          f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
          f.frequency.value = hz; f.Q.value = 1.1; f.gain.value = fx.params[`b${hz}`] ?? 0
          return f
        })
        for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1])
        return [filters[0], filters[filters.length - 1]]
      }
      case 'distortion': case 'overdrive': {
        const isOd = fx.type === 'overdrive'
        const mode = isOd ? 'soft' : ((fx.extraValue as 'soft' | 'hard' | 'fuzz') || 'soft')
        const g = 10 ** ((fx.params.drive / 100) * (isOd ? 1.2 : 1.7))
        // Cut rumble and hiss before clipping so they aren't amplified with the signal
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = isOd ? 120 : 90; hp.Q.value = 0.7
        const preLp = ctx.createBiquadFilter(); preLp.type = 'lowpass'; preLp.frequency.value = 6500; preLp.Q.value = 0.7
        const hump = ctx.createBiquadFilter(); hump.type = 'peaking'; hump.frequency.value = 720; hump.Q.value = 0.8; hump.gain.value = isOd ? 5 : 0
        const ws = ctx.createWaveShaper(); ws.curve = makeClipCurve(g, mode); ws.oversample = '4x'
        const dc = ctx.createBiquadFilter(); dc.type = 'highpass'; dc.frequency.value = 25
        const t = ctx.createBiquadFilter(); t.type = 'lowpass'; t.frequency.value = fx.params.tone; t.Q.value = 0.6
        const l = ctx.createGain(); l.gain.value = (fx.params.level / 50) * driveCompensation(g)
        hp.connect(preLp); preLp.connect(hump); hump.connect(ws); ws.connect(dc); dc.connect(t); t.connect(l)
        return [hp, l]
      }
      case 'chorus': case 'flanger': {
        const isFlanger = fx.type === 'flanger'
        const split = ctx.createGain(); const dry = ctx.createGain(); dry.gain.value = 0.7; const wet = ctx.createGain(); wet.gain.value = isFlanger ? 0.7 : fx.params.mix / 100
        const del = ctx.createDelay(); del.delayTime.value = isFlanger ? 0.005 : 0.025
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = fx.params.rate / 10
        const lfoG = ctx.createGain(); lfoG.gain.value = fx.params.depth / 1000; const merge = ctx.createGain()
        lfo.connect(lfoG); lfoG.connect(del.delayTime); split.connect(dry); split.connect(del)
        if (isFlanger) { const fb = ctx.createGain(); fb.gain.value = fx.params.feedback / 100; del.connect(fb); fb.connect(del) }
        del.connect(wet); dry.connect(merge); wet.connect(merge); startLfo(lfo); return [split, merge]
      }
      case 'phaser': {
        const filters: BiquadFilterNode[] = []
        for (let i = 0; i < 4; i++) { const f = ctx.createBiquadFilter(); f.type = 'allpass'; f.frequency.value = 1000 + i * 500; f.Q.value = 5; filters.push(f) }
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = fx.params.rate / 10
        const lfoG = ctx.createGain(); lfoG.gain.value = fx.params.depth * 10; filters.forEach(f => lfoG.connect(f.frequency))
        for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1])
        const split = ctx.createGain(); const dry = ctx.createGain(); dry.gain.value = 0.7; const wet = ctx.createGain(); wet.gain.value = 0.7
        const fb = ctx.createGain(); fb.gain.value = fx.params.feedback / 100; const merge = ctx.createGain()
        split.connect(dry); split.connect(filters[0]); filters[filters.length - 1].connect(fb); fb.connect(filters[0])
        filters[filters.length - 1].connect(wet); dry.connect(merge); wet.connect(merge); lfo.connect(lfoG); startLfo(lfo); return [split, merge]
      }
      case 'tremolo': {
        const g = ctx.createGain(); g.gain.value = 1; const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = fx.params.rate / 10
        const lfoG = ctx.createGain(); lfoG.gain.value = fx.params.depth / 200; lfo.connect(lfoG); lfoG.connect(g.gain); startLfo(lfo); return [g]
      }
      case 'delay': {
        const split = ctx.createGain(); const dry = ctx.createGain(); dry.gain.value = 1; const wet = ctx.createGain(); wet.gain.value = fx.params.mix / 100
        const del = ctx.createDelay(3); del.delayTime.value = fx.params.time / 1000; const fb = ctx.createGain(); fb.gain.value = fx.params.feedback / 100
        const merge = ctx.createGain(); split.connect(dry); split.connect(del); del.connect(fb); fb.connect(del); del.connect(wet); dry.connect(merge); wet.connect(merge); return [split, merge]
      }
      case 'reverb': {
        const split = ctx.createGain(); const dry = ctx.createGain(); dry.gain.value = 1; const wet = ctx.createGain(); wet.gain.value = fx.params.mix / 100
        const conv = ctx.createConvolver(); conv.buffer = generateReverbIR(ctx, fx.params.decay / 10); const merge = ctx.createGain()
        split.connect(dry); split.connect(conv); conv.connect(wet); dry.connect(merge); wet.connect(merge); return [split, merge]
      }
      case 'nam': {
        const inGain = ctx.createGain(); inGain.gain.value = dbToGain(fx.params.input)
        const outGain = ctx.createGain()
        const modelKey = namModelKey(fx)
        if (!modelKey) { inGain.connect(outGain); return [inGain, outGain] }
        const slot = namSlotsRef.current.get(fx.id)
        const quality = fx.extraValue || 'full'
        if (!slot || slot.modelKey !== modelKey || slot.quality !== quality) {
          // Mute while the model loads rather than blasting the raw DI signal
          outGain.gain.value = 0
          inGain.connect(outGain)
          requestNamLoad(ctx, fx)
          return [inGain, outGain]
        }
        const norm = slot.loudness === null ? 1 : dbToGain(NAM_TARGET_LOUDNESS_DB - slot.loudness)
        outGain.gain.value = dbToGain(fx.params.output) * norm
        inGain.connect(slot.node); slot.node.connect(outGain)
        return [inGain, outGain]
      }
      case 'amp': {
        const model = AMP_MODELS.find(a => a.id === fx.modelId) || AMP_MODELS[0]
        const stack = TONE_STACKS[model.stack]
        const g = 1 + (fx.params.gain / 10) ** 2 * (model.drive - 1)
        const nodes: AudioNode[] = []
        const chain = (n: AudioNode) => { if (nodes.length) nodes[nodes.length - 1].connect(n); nodes.push(n); return n }
        const filter = (type: BiquadFilterType, freq: number, q = 0.7, gainDb = 0) => {
          const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = gainDb; return chain(f)
        }
        filter('highpass', model.tight)
        filter('lowpass', 7000)
        if (model.bright) filter('highshelf', 2500, 0.7, model.bright)
        const stageGain = model.stages === 2 ? Math.sqrt(g) * 1.2 : g
        for (let s = 0; s < model.stages; s++) {
          const ws = ctx.createWaveShaper(); ws.curve = makeClipCurve(stageGain, 'soft', model.asym); ws.oversample = '4x'
          chain(ws)
          if (s < model.stages - 1) { filter('highpass', model.tight * 1.5); filter('lowpass', 6000) }
        }
        filter('highpass', 25)
        filter('lowshelf', stack.bass, 0.7, (fx.params.bass - 5) * 2.4)
        filter('peaking', stack.mid, stack.midQ, stack.scoop + (fx.params.mid - 5) * 2.4)
        filter('highshelf', stack.treble, 0.7, (fx.params.treble - 5) * 2.4)
        filter('highshelf', 5000, 0.7, (fx.params.presence - 5) * 2)
        const master = ctx.createGain(); master.gain.value = (fx.params.master / 5) * driveCompensation(g)
        chain(master)
        return [nodes[0], master]
      }
      case 'cab': {
        if (fx.modelId === 'custom-ir') {
          const key = `${fx.id}|${ctx.sampleRate}`
          const buffer = irBuffersRef.current.get(key)
          if (!buffer) {
            const data = localStorage.getItem(IR_KEY_PREFIX + fx.id)
            if (data) requestIrDecode(ctx, key, async () => base64ToBuffer(data))
            const p = ctx.createGain(); return [p]
          }
          const conv = ctx.createConvolver(); conv.buffer = buffer
          return [conv]
        }
        const model = CAB_MODELS.find(c => c.id === fx.modelId)
        if (model?.irFile) {
          const key = `lib:${model.id}|${ctx.sampleRate}`
          const buffer = irBuffersRef.current.get(key)
          if (!buffer) {
            const file = model.irFile
            requestIrDecode(ctx, key, () => fetch(`/nam/irs/${file}`).then(r => r.ok ? r.arrayBuffer() : null))
            // Silent until decoded; an uncabbed amp signal is harsh
            const p = ctx.createGain(); p.gain.value = 0; return [p]
          }
          const conv = ctx.createConvolver(); conv.buffer = buffer
          return [conv]
        }
        if (!model || fx.modelId === 'direct') { const p = ctx.createGain(); return [p] }
        const edge = fx.extraValue === 'edge'
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = model.hp; hp.Q.value = 0.8
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = model.lp * (edge ? 0.8 : 1.15); lp.Q.value = 0.9
        // Second lowpass gives the steep top-end rolloff of a real speaker
        const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = model.lp * (edge ? 0.9 : 1.3); lp2.Q.value = 0.6
        hp.connect(lp); lp.connect(lp2)
        let last: AudioNode = lp2
        for (const [freq, gainDb, q] of model.peaks) {
          const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = freq; pk.Q.value = q; pk.gain.value = gainDb
          last.connect(pk); last = pk
        }
        if (!edge) {
          const air = ctx.createBiquadFilter(); air.type = 'peaking'; air.frequency.value = 3000; air.Q.value = 1; air.gain.value = 2
          last.connect(air); last = air
        }
        return [hp, last]
      }
      default: { const p = ctx.createGain(); p.gain.value = 1; return [p] }
    }
  }

  const connectChain = useCallback((chain: EffectInstance[]) => {
    const ctx = audioCtxRef.current, inAn = inputAnalyserRef.current, masterGain = masterGainRef.current
    if (!ctx || !inAn || !masterGain) return
    lfosRef.current.forEach(o => { try { o.stop() } catch {} })
    lfosRef.current = []
    gateTimersRef.current.forEach(t => clearInterval(t))
    gateTimersRef.current = []
    inAn.disconnect()
    Object.values(nodesRef.current).forEach(nodes => nodes.forEach(n => n.disconnect()))
    nodesRef.current = {}
    // NAM nodes are reused across rebuilds (reloading a model is slow), so detach them and drop removed ones
    for (const [id, slot] of namSlotsRef.current) {
      slot.node.disconnect()
      if (!chain.some(fx => fx.id === id && fx.type === 'nam')) {
        slot.node.dispose().catch(() => {})
        namSlotsRef.current.delete(id)
      }
    }
    let prev: AudioNode = inAn
    for (const fx of chain) {
      const nodes = buildEffectNodes(ctx, fx)
      nodesRef.current[fx.id] = nodes
      if (nodes.length > 0) { prev.connect(nodes[0]); prev = nodes[nodes.length - 1] }
    }
    prev.connect(masterGain)
    appliedChainRef.current = chain
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildGraph = useCallback(async () => {
    try {
      setError(null)
      const constraints: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      if (selectedInput) (constraints as Record<string, unknown>).deviceId = { exact: selectedInput }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
      streamRef.current = stream
      const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate })
      audioCtxRef.current = ctx
      if (selectedOutput && 'setSinkId' in ctx) { try { await (ctx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedOutput) } catch {} }
      const source = ctx.createMediaStreamSource(stream)
      const inGain = ctx.createGain(); inGain.gain.value = inputGain; inputGainRef.current = inGain
      const inAn = ctx.createAnalyser(); inAn.fftSize = 256; inputAnalyserRef.current = inAn
      const tunerAn = ctx.createAnalyser(); tunerAn.fftSize = 4096; tunerAnalyserRef.current = tunerAn
      source.connect(inGain); inGain.connect(inAn); inGain.connect(tunerAn)
      const masterGain = ctx.createGain(); masterGain.gain.value = 0; masterGainRef.current = masterGain
      const outAn = ctx.createAnalyser(); outAn.fftSize = 256; outputAnalyserRef.current = outAn
      masterGain.connect(outAn); outAn.connect(ctx.destination)
      connectChain(effects)
      setIsActive(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not access audio input.') }
  }, [selectedInput, selectedOutput, sampleRate, effects, inputGain, connectChain])

  const stopAudio = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
    cancelAnimationFrame(animRef.current)
    gateTimersRef.current.forEach(t => clearInterval(t))
    nodesRef.current = {}; lfosRef.current = []; gateTimersRef.current = []; appliedChainRef.current = null
    namSlotsRef.current.clear()
    inputAnalyserRef.current = null; tunerAnalyserRef.current = null; masterGainRef.current = null
    setIsActive(false); setInputLevel(0); setOutputLevel(0)
  }, [])

  // Live-apply chain edits; debounced so a knob drag doesn't rebuild on every pixel
  useEffect(() => {
    if (!isActive || appliedChainRef.current === effects) return
    const t = setTimeout(() => connectChain(effects), 60)
    return () => clearTimeout(t)
  }, [effects, isActive, connectChain])

  useEffect(() => () => { stopAudio() }, [stopAudio])

  useEffect(() => {
    if (!isActive) return
    const inD = new Uint8Array(128); const outD = new Uint8Array(128)
    const meter = () => {
      if (inputAnalyserRef.current) { inputAnalyserRef.current.getByteFrequencyData(inD); setInputLevel(inD.reduce((a, b) => a + b, 0) / inD.length / 255) }
      if (outputAnalyserRef.current) { outputAnalyserRef.current.getByteFrequencyData(outD); setOutputLevel(outD.reduce((a, b) => a + b, 0) / outD.length / 255) }
      animRef.current = requestAnimationFrame(meter)
    }
    animRef.current = requestAnimationFrame(meter)
    return () => cancelAnimationFrame(animRef.current)
  }, [isActive])

  // Mute only silences the output; the graph keeps running so unmuting is instant (no mic prompt or model reload)
  useEffect(() => {
    const g = masterGainRef.current, ctx = audioCtxRef.current
    if (!g || !ctx) return
    g.gain.setTargetAtTime(muted || tunerOpen ? 0 : masterVolume, ctx.currentTime, 0.015)
  }, [masterVolume, muted, tunerOpen, isActive])

  // Pitch detection is expensive, so the tuner samples ~20 times a second instead of every frame
  useEffect(() => {
    if (!tunerOpen || !isActive) { setTunerReading(null); return }
    const an = tunerAnalyserRef.current, ctx = audioCtxRef.current
    if (!an || !ctx) return
    const buf = new Float32Array(an.fftSize)
    let silentFrames = 0
    const timer = setInterval(() => {
      an.getFloatTimeDomainData(buf)
      const hz = autoCorrelate(buf, ctx.sampleRate)
      if (hz > 25 && hz < 1500) {
        silentFrames = 0
        const { note, cents } = getClosestNote(hz)
        setTunerReading({ note, cents, hz })
      } else if (++silentFrames > 15) {
        setTunerReading(null)
      }
    }, 50)
    return () => clearInterval(timer)
  }, [tunerOpen, isActive])

  const toggleTuner = async () => {
    const opening = !tunerOpen
    setTunerOpen(opening)
    if (opening && !isActive) await buildGraph()
  }

  // Device or sample-rate changes need a fresh AudioContext, so restart audio if it's running
  const audioConfigRef = useRef({ input: selectedInput, output: selectedOutput, rate: sampleRate })
  useEffect(() => {
    const prev = audioConfigRef.current
    audioConfigRef.current = { input: selectedInput, output: selectedOutput, rate: sampleRate }
    if (!isActive || (prev.input === selectedInput && prev.output === selectedOutput && prev.rate === sampleRate)) return
    stopAudio()
    buildGraph()
  }, [selectedInput, selectedOutput, sampleRate, isActive, stopAudio, buildGraph])

  const toggleMute = async () => {
    if (!isActive) { setMuted(false); await buildGraph(); return }
    setMuted(m => !m)
  }
  const live = isActive && !muted
  useEffect(() => { if (inputGainRef.current) inputGainRef.current.gain.value = inputGain }, [inputGain])

  // Chain management
  const toggleEffect = (id: EffectId) => { setEffects(prev => prev.map(fx => fx.id === id ? { ...fx, enabled: !fx.enabled } : fx)) }
  const updateParam = (id: EffectId, key: string, value: number) => { setEffects(prev => prev.map(fx => fx.id === id ? { ...fx, params: { ...fx.params, [key]: value } } : fx)) }
  const updateExtra = (id: EffectId, value: string) => { setEffects(prev => prev.map(fx => fx.id === id ? { ...fx, extraValue: value } : fx)) }
  const updateModel = (id: EffectId, modelId: string) => {
    setEffects(prev => prev.map(fx => {
      if (fx.id !== id) return fx
      if (fx.type === 'amp') {
        const amp = AMP_MODELS.find(a => a.id === modelId)
        if (amp) return { ...fx, modelId, params: { gain: amp.gain, bass: amp.bass, mid: amp.mid, treble: amp.treble, presence: amp.presence, master: fx.params.master || 5 } }
      }
      return { ...fx, modelId }
    }))
  }
  const removeEffect = (id: EffectId) => {
    try { localStorage.removeItem(IR_KEY_PREFIX + id) } catch {}
    deleteFile(NAM_KEY_PREFIX + id)
    setEffects(prev => prev.filter(fx => fx.id !== id))
  }
  const addEffect = (type: string) => { setEffects(prev => [...prev, createEffect(type)]); setShowAddPicker(false) }
  const moveEffect = (from: number, to: number) => { setEffects(prev => { const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n }) }

  const onDragStart = (idx: number) => { setDragIdx(idx) }
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx) }
  const onDrop = (idx: number) => { if (dragIdx !== null && dragIdx !== idx) moveEffect(dragIdx, idx); setDragIdx(null); setDragOverIdx(null) }
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); setArmedId(null) }

  const handleClose = () => { stopAudio(); onClose() }
  const meterColor = (l: number) => l > 0.85 ? '#e74c3c' : l > 0.6 ? '#f39c12' : '#2ecc71'

  return (
    <div className="fx-overlay">
      <div className="fx-modal">
        <div className="fx-header">
          <div className="fx-header-left">
            <h1>Guitar Effects</h1>
            <span className="fx-header-sub">Signal Processor</span>
          </div>
          <button className="close-btn fx-home-btn" onClick={handleClose} aria-label="Back to FretWiki" title="Back to FretWiki">
            <Icon name="house" size={18} />
          </button>
        </div>

        {error && <div className="fx-error"><p><Icon name="alert" size="1em" className="inline-icon" />{error}</p><p className="fx-error-hint">Check microphone access and audio input device.</p></div>}

        {/* I/O Bar */}
        <div className="fx-io-bar">
          <div className="fx-io-section">
            <div className="fx-io-device">
              <label>Input</label>
              <select value={selectedInput} onChange={e => setSelectedInput(e.target.value)} className="fx-device-select" aria-label="Input device">
                <option value="">Default</option>
                {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${d.deviceId.slice(0, 8)}`}</option>)}
              </select>
            </div>
            <div className="fx-meter-group">
              <div className="fx-meter"><div className="fx-meter-fill" style={{ width: `${inputLevel * 100}%`, background: meterColor(inputLevel) }} /></div>
              <input type="range" min="0" max="200" value={inputGain * 100} onChange={e => setInputGain(Number(e.target.value) / 100)} className="fx-mini-slider" aria-label="Input gain" />
              <span className="fx-meter-label">{Math.round(inputGain * 100)}%</span>
            </div>
          </div>
          <div className="fx-io-center">
          <button
            className={`fx-power-btn ${live ? 'active' : 'muted'}`}
            onClick={toggleMute}
            aria-pressed={!live}
            title={live ? 'Mute output' : 'Unmute and play through the rig'}
          >
            <Icon name={live ? 'volume-on' : 'volume-off'} className="fx-power-icon" />
            <span>{live ? 'MUTE' : 'UNMUTE'}</span>
          </button>
          <button
            className={`fx-tuner-btn ${tunerOpen ? 'active' : ''}`}
            onClick={toggleTuner}
            aria-pressed={tunerOpen}
            title={tunerOpen ? 'Close tuner' : 'Tune up (output is silenced while tuning)'}
          >
            <Icon name="tuning-fork" className="fx-power-icon" />
            <span>TUNER</span>
          </button>
          </div>
          <div className="fx-io-section">
            <div className="fx-io-device">
              <label>Output</label>
              <select value={selectedOutput} onChange={e => setSelectedOutput(e.target.value)} className="fx-device-select" aria-label="Output device">
                <option value="">Default</option>
                {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${d.deviceId.slice(0, 8)}`}</option>)}
              </select>
              <Icon name="settings" size={14} className="fx-rate-icon" />
              <select value={sampleRate} onChange={e => setSampleRate(Number(e.target.value))} className="fx-device-select fx-rate-select" title="Sample rate">
                {SAMPLE_RATES.map(r => <option key={r} value={r}>{(r / 1000).toFixed(r % 1000 ? 1 : 0)} kHz</option>)}
              </select>
            </div>
            <div className="fx-meter-group">
              <div className="fx-meter"><div className="fx-meter-fill" style={{ width: `${outputLevel * 100}%`, background: meterColor(outputLevel) }} /></div>
              <input type="range" min="0" max="100" value={masterVolume * 100} onChange={e => setMasterVolume(Number(e.target.value) / 100)} className="fx-mini-slider" aria-label="Output volume" />
              <span className="fx-meter-label">{Math.round(masterVolume * 100)}%</span>
            </div>
          </div>
        </div>

        {!isActive && !tunerOpen && !error && (
          <div className="fx-start-hint">
            <Icon name="plug" size={14} />
            <span>Plug in your guitar or audio interface, then press <strong>Unmute</strong> to play through the rig.</span>
          </div>
        )}

        {tunerOpen && (() => {
          const cents = tunerReading?.cents ?? 0
          const inTune = tunerReading !== null && Math.abs(cents) <= 5
          const status = !tunerReading ? 'Play a string' : inTune ? 'In tune' : cents < 0 ? 'Tune up' : 'Tune down'
          return (
            <div className={`fx-tuner ${inTune ? 'in-tune' : ''}`}>
              <div className="fx-tuner-note">
                {tunerReading ? tunerReading.note.replace(/\d/, '') : '–'}
                <sub>{tunerReading?.note.match(/\d/)?.[0]}</sub>
              </div>
              <div className="fx-tuner-meter">
                <div className="fx-tuner-scale">
                  {[-50, -25, 0, 25, 50].map(c => <span key={c} style={{ left: `${50 + c}%` }} className={c === 0 ? 'center' : ''} />)}
                  {tunerReading && <div className="fx-tuner-needle" style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }} />}
                </div>
                <div className="fx-tuner-labels"><span>♭ −50</span><span>0</span><span>+50 ♯</span></div>
              </div>
              <div className="fx-tuner-info">
                <span className="fx-tuner-status">{status}</span>
                <span className="fx-tuner-detail">
                  {tunerReading ? `${tunerReading.hz.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents}¢` : isActive ? 'Listening…' : 'Starting input…'}
                </span>
                <span className="fx-tuner-detail">Output silenced while tuning</span>
              </div>
            </div>
          )
        })()}

        {/* Chain Header */}
        <div className="fx-section-title">
          <span>Signal Chain</span>
          <div className="fx-section-actions">
            <button className="fx-add-btn" onClick={() => setShowAddPicker(!showAddPicker)}>+ Add</button>
            <button className="fx-reset-btn" onClick={resetRig} title="Restore the default chain">Reset</button>
          </div>
        </div>

        {showAddPicker && (
          <div className="fx-add-picker">
            {Object.values(EFFECT_CATALOG).map(def => (
              <button key={def.type} className="fx-add-option" onClick={() => addEffect(def.type)} style={{ borderColor: def.color + '60' }}>
                <Icon name={def.icon} className="fx-add-option-icon" /><span>{def.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pedalboard Chain */}
        <div className="fx-pedalboard" ref={boardRef}>
          <svg className="fx-chain-svg" aria-hidden="true">
            <defs>
              {wires.map(w => (
                <linearGradient key={w.id} id={`fx-wire-${w.id}`} gradientUnits="userSpaceOnUse" x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}>
                  <stop offset="0" stopColor={w.from} />
                  <stop offset="1" stopColor={w.to} />
                </linearGradient>
              ))}
            </defs>
            {wires.map(w => (
              <path key={w.id} d={w.d} className="fx-chain-cable" stroke={`url(#fx-wire-${w.id})`} />
            ))}
            {wires.map(w => (
              <circle key={w.id} cx={w.x2} cy={w.y2} r={3.5} fill={w.to} className="fx-chain-dot" />
            ))}
          </svg>

          <div className="fx-chain-endpoint" data-chain-node data-chain-id="in" data-color="#2ecc71"><div className="fx-chain-jack">IN</div></div>

          {effects.map((fx, idx) => {
            const def = EFFECT_CATALOG[fx.type]
            if (!def) return null
            return (
                <div
                  key={fx.id}
                  data-chain-node
                  data-chain-id={fx.id}
                  data-color={fx.enabled ? def.color : '#444'}
                  className={`fx-pedal ${fx.enabled ? 'on' : 'off'} ${dragIdx === idx ? 'dragging' : ''} ${dragOverIdx === idx && dragIdx !== idx ? 'drag-over' : ''}`}
                  style={{ '--pedal-color': def.color } as React.CSSProperties}
                  draggable={armedId === fx.id}
                  onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)} onDrop={() => onDrop(idx)} onDragEnd={onDragEnd}
                >
                  <div
                    className="fx-pedal-top"
                    onPointerDown={e => { if (!(e.target as HTMLElement).closest('button')) setArmedId(fx.id) }}
                  >
                    <span className="fx-pedal-drag" title="Drag to reorder">⋮⋮</span>
                    <button className="fx-pedal-switch" onClick={() => toggleEffect(fx.id)} aria-label={`${fx.enabled ? 'Bypass' : 'Enable'} ${def.label}`} aria-pressed={fx.enabled}><span className="fx-led" /></button>
                    <h3><Icon name={def.icon} size={14} />{def.label}</h3>
                    <button className="fx-pedal-remove" onClick={() => removeEffect(fx.id)} title="Remove"><Icon name="x" size={12} /></button>
                  </div>

                  {/* Model selector for amp/cab */}
                  {def.models && (
                    <div className="fx-model-selector">
                      <select value={fx.modelId || ''} onChange={e => updateModel(fx.id, e.target.value)} className="fx-model-select" aria-label={`${def.label} model`}>
                        {[...new Set(def.models.map(m => m.group))].map(group => (
                          <optgroup key={group || 'models'} label={group || 'Models'}>
                            {def.models!.filter(m => m.group === group).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <span className="fx-model-char">{def.models.find(m => m.id === fx.modelId)?.character}</span>
                      {fx.modelId === 'custom-ir' && (
                        <label className="fx-ir-load" title={fx.irName || 'Load an impulse response .wav file'}>
                          <input type="file" accept=".wav,audio/wav,audio/x-wav" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) loadIrFile(fx.id, f); e.target.value = '' }} />
                          {fx.irName ? <><Icon name="check" size="1em" className="inline-icon" />{fx.irName}</> : 'Load IR (.wav)'}
                        </label>
                      )}
                    </div>
                  )}

                  {fx.type === 'nam' && (
                    <div className="fx-model-selector">
                      {fx.modelId === NAM_CUSTOM_ID && (
                        <label className="fx-ir-load" title={fx.namName || 'Load a Neural Amp Modeler .nam file'}>
                          <input type="file" accept=".nam,application/json" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) loadNamFile(fx.id, f); e.target.value = '' }} />
                          {fx.namName ? <><Icon name="check" size="1em" className="inline-icon" />{fx.namName}</> : 'Load model (.nam)'}
                        </label>
                      )}
                      {namLoading.has(fx.id) && <span className="fx-model-char">Loading model…</span>}
                    </div>
                  )}

                  {def.extra && !(def.isCab && (fx.modelId === 'direct' || fx.modelId === 'custom-ir' || CAB_MODELS.some(c => c.id === fx.modelId && c.irFile))) && (
                    <div className="fx-type-btns">
                      {def.extra.options.map(opt => (
                        <button key={opt} className={`fx-type-btn ${fx.extraValue === opt ? 'active' : ''}`} onClick={() => updateExtra(fx.id, opt)}>{opt}</button>
                      ))}
                    </div>
                  )}

                  {def.params.length > 0 && (
                    <div className="fx-knob-row">
                      {def.params.map(p => (
                        <div key={p.key} className="fx-knob-group">
                          <label>{p.label}</label>
                          <RotaryKnob value={fx.params[p.key]} min={p.min} max={p.max} step={p.step}
                            onChange={v => updateParam(fx.id, p.key, v)} color={def.color}
                            label={`${def.label} ${p.label}`}
                            valueText={`${p.displayFn ? p.displayFn(fx.params[p.key]) : fx.params[p.key]}${p.unit ? ` ${p.unit}` : ''}`} />
                          <span className="fx-knob-val">{p.displayFn ? p.displayFn(fx.params[p.key]) : fx.params[p.key]}{p.unit && ` ${p.unit}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            )
          })}

          <div className="fx-chain-endpoint" data-chain-node data-chain-id="out" data-color="#2ecc71"><div className="fx-chain-jack out">OUT</div></div>
        </div>

        {effects.length === 0 && <div className="fx-empty">No effects. Click <strong>+ Add</strong> to build your chain.</div>}

        <div className="fx-footer-hint">
          <p><Icon name="plug" size="1em" className="inline-icon" />Connect your guitar via an audio interface. Drag a pedal by its title bar to reorder · Drag or scroll knobs to tweak · Changes apply live and are saved automatically.</p>
        </div>
      </div>
    </div>
  )
}
