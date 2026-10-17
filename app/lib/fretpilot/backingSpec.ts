import { parseChordSymbol } from './theory'

export type BackingStyle = 'funk' | 'fusion' | 'jazz' | 'blues' | 'rock' | 'pop' | 'reggae'

export interface BackingSpec {
  title: string
  style: BackingStyle
  bpm: number
  chords: string[]
  key: string
  barsPerChord: number
  feel: string
  explanation: string
  source: 'rules' | 'llm'
}

const STYLE_WORDS: BackingStyle[] = ['funk', 'fusion', 'jazz', 'blues', 'rock', 'pop', 'reggae']

const STYLE_ALIASES: Record<string, BackingStyle> = {
  funky: 'funk',
  groove: 'funk',
  fusion: 'fusion',
  jazz: 'jazz',
  swing: 'jazz',
  bebop: 'jazz',
  blues: 'blues',
  shuffle: 'blues',
  rock: 'rock',
  metal: 'rock',
  pop: 'pop',
  reggae: 'reggae',
  ska: 'reggae',
  soul: 'funk',
  rnb: 'funk',
  'r&b': 'funk',
}

const DEFAULT_BPM: Record<BackingStyle, number> = {
  funk: 108,
  fusion: 104,
  jazz: 132,
  blues: 88,
  rock: 126,
  pop: 118,
  reggae: 78,
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

export function matchStyleWord(raw: string): BackingStyle | null {
  const word = raw.toLowerCase().replace(/[^a-z&]/g, '')
  if (!word) return null
  if (word in STYLE_ALIASES) return STYLE_ALIASES[word]
  if ((STYLE_WORDS as string[]).includes(word)) return word as BackingStyle
  let best: BackingStyle | null = null
  let bestDist = 3
  for (const style of STYLE_WORDS) {
    const dist = levenshtein(word, style)
    if (dist < bestDist && dist <= 2) {
      best = style
      bestDist = dist
    }
  }
  return best
}

function extractBpm(text: string): number | null {
  const m = text.match(/\b(\d{2,3})\s*(?:bpm)?\b/i)
  if (!m) return null
  const n = Number(m[1])
  return n >= 40 && n <= 220 ? n : null
}

function extractKey(text: string): string | null {
  const m = text.match(/\b(?:in|key(?:\s+of)?)\s+([A-G](?:#|b|♯|♭)?(?:m(?!aj)|min(?:or)?)?)\b/i)
  if (!m) return null
  const raw = m[1].replace('♯', '#').replace('♭', 'b').replace(/minor/i, 'm').replace(/min$/i, 'm')
  return parseChordSymbol(raw)?.root ? raw.replace(/minor/i, 'm') : null
}

function extractChords(text: string): string[] {
  const cleaned = text
    .replace(/\b(\d{2,3})\s*(?:bpm)?\b/gi, ' ')
    .replace(/\b(?:in|key(?:\s+of)?|style|groove|feel|backing|track|please|make|generate|play)\b/gi, ' ')
  const tokens = cleaned.split(/[\s,–—/]+/).map(t => t.trim()).filter(Boolean)
  const chords: string[] = []
  for (const token of tokens) {
    if (matchStyleWord(token)) continue
    const parsed = parseChordSymbol(token)
    if (parsed) chords.push(parsed.symbol.replace('♯', '#').replace('♭', 'b'))
  }
  return chords
}

function pickStyle(styles: BackingStyle[]): BackingStyle {
  if (styles.includes('funk') && styles.includes('fusion')) return 'funk'
  if (styles.includes('fusion')) return 'fusion'
  return styles[0] ?? 'pop'
}

function explanationFor(spec: Omit<BackingSpec, 'explanation' | 'source'>): string {
  const vamp = spec.chords.join(' – ')
  if (spec.style === 'funk' && spec.chords.some(c => /^D7$/i.test(c)) && spec.chords.some(c => /^Am/.test(c))) {
    return `${vamp} is a classic fusion-funk vamp. Am to D7 points at A Dorian (F♯ lives in D7). This is a browser-synthesized practice loop — drums, bass, and stabs — not a studio recording.`
  }
  return `${spec.title}: ${vamp || 'no chords yet'} at ${spec.bpm} BPM. Synthesized in the browser so you can jam without uploading audio.`
}

export function generateBackingFromPrompt(prompt: string): BackingSpec {
  const text = prompt.trim()
  const words = text.split(/[\s,]+/)
  const styles = words.map(matchStyleWord).filter((s): s is BackingStyle => !!s)
  const uniqueStyles = [...new Set(styles)]
  const style = pickStyle(uniqueStyles)
  const chords = extractChords(text)
  const key = extractKey(text) ?? (chords[0] ? (parseChordSymbol(chords[0])?.root ?? 'A') + (parseChordSymbol(chords[0])?.quality === 'min' || parseChordSymbol(chords[0])?.quality === 'min7' ? 'm' : '') : 'A')
  const bpm = extractBpm(text) ?? DEFAULT_BPM[style]
  const fusionFunk = uniqueStyles.includes('funk') && (uniqueStyles.includes('fusion') || /fusion|fusikn/i.test(text))
  const barsPerChord = chords.length <= 2 ? 2 : 1
  const title = fusionFunk
    ? 'Fusion funk vamp'
    : `${style[0].toUpperCase()}${style.slice(1)} backing`
  const feel = fusionFunk
    ? '16th-note hats, syncopated kick, short guitar-style stabs'
    : style === 'jazz'
      ? 'swung ride feel, walking bass'
      : style === 'blues'
        ? 'shuffle backbeat'
        : 'straight groove'
  const spec = {
    title,
    style: fusionFunk ? 'funk' as const : style,
    bpm,
    chords: chords.length
      ? chords
      : (fusionFunk || style === 'funk' ? ['Am', 'D7'] : ['G', 'Em', 'C', 'D']),
    key,
    barsPerChord,
    feel,
  }
  return {
    ...spec,
    chords: spec.chords,
    explanation: explanationFor(spec),
    source: 'rules',
  }
}

export function isBackingSpec(value: unknown): value is BackingSpec {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.title === 'string'
    && typeof v.style === 'string'
    && typeof v.bpm === 'number'
    && Array.isArray(v.chords)
    && v.chords.every(c => typeof c === 'string')
    && typeof v.key === 'string'
    && typeof v.explanation === 'string'
}
