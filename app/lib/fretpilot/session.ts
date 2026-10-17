import type { SessionRecord } from './types'

const KEY = 'fretpilot_sessions_v1'
const MAX = 20

export function loadSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionRecord[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function saveSession(record: SessionRecord): SessionRecord[] {
  const next = [record, ...loadSessions().filter(s => s.id !== record.id)].slice(0, MAX)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
  return next
}

export function clearSessions(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
