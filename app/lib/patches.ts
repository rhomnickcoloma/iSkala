import type { SupabaseClient } from '@supabase/supabase-js'

export interface PatchRig {
  effects: unknown[]
  masterVolume: number
  inputGain: number
}

export interface Patch {
  id: string
  name: string
  rig: PatchRig
  updatedAt: string
}

export interface PatchStore {
  list(): Promise<Patch[]>
  create(name: string, rig: PatchRig): Promise<Patch>
  update(id: string, rig: PatchRig): Promise<Patch>
  remove(id: string): Promise<void>
}

export const MAX_PATCH_NAME = 60

interface PatchRow { id: string; name: string; rig: PatchRig; updated_at: string }
const fromRow = (r: PatchRow): Patch => ({ id: r.id, name: r.name, rig: r.rig, updatedAt: r.updated_at })

export function cloudPatchStore(getClient: () => Promise<SupabaseClient>): PatchStore {
  const TABLE = 'effect_patches'
  const cols = 'id, name, rig, updated_at'
  return {
    async list() {
      const sb = await getClient()
      const { data, error } = await sb.from(TABLE).select(cols).order('updated_at', { ascending: false })
      if (error) throw error
      return (data as PatchRow[]).map(fromRow)
    },
    async create(name, rig) {
      const sb = await getClient()
      const { data, error } = await sb.from(TABLE).insert({ name, rig }).select(cols).single()
      if (error) throw error
      return fromRow(data as PatchRow)
    },
    async update(id, rig) {
      const sb = await getClient()
      const { data, error } = await sb.from(TABLE).update({ rig }).eq('id', id).select(cols).single()
      if (error) throw error
      return fromRow(data as PatchRow)
    },
    async remove(id) {
      const sb = await getClient()
      const { error } = await sb.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
  }
}

const LOCAL_KEY = 'fretwiki-patches-v1'

export function localPatchStore(): PatchStore {
  const read = (): Patch[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }
  const write = (patches: Patch[]) => localStorage.setItem(LOCAL_KEY, JSON.stringify(patches))
  const sorted = (patches: Patch[]) => [...patches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return {
    async list() { return sorted(read()) },
    async create(name, rig) {
      const patch: Patch = { id: crypto.randomUUID(), name, rig, updatedAt: new Date().toISOString() }
      write([patch, ...read()])
      return patch
    },
    async update(id, rig) {
      const all = read()
      const existing = all.find(p => p.id === id)
      if (!existing) throw new Error('Patch not found')
      const patch = { ...existing, rig, updatedAt: new Date().toISOString() }
      write(all.map(p => p.id === id ? patch : p))
      return patch
    },
    async remove(id) { write(read().filter(p => p.id !== id)) },
  }
}
