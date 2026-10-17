'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { cloudPatchStore, localPatchStore, MAX_PATCH_NAME, type Patch, type PatchRig } from '../lib/patches'
import { FACTORY_PATCHES } from '../lib/factoryPatches'
import { Icon } from './Icons'

interface EffectsPatchesProps {
  currentRig: PatchRig
  activePatchId: string | null
  edited: boolean
  onLoad: (patch: Patch) => void
  onActiveChange: (patch: Patch | null) => void
}

const errorText = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : 'Something went wrong'

export default function EffectsPatches({ currentRig, activePatchId, edited, onLoad, onActiveChange }: EffectsPatchesProps) {
  const { enabled, ready, user, connect, openSignIn } = useAuth()
  const signedIn = Boolean(user)
  const store = useMemo(() => signedIn ? cloudPatchStore(connect) : localPatchStore(), [signedIn, connect])

  const [patches, setPatches] = useState<Patch[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'update' | 'other' | null>(null)
  const [done, setDone] = useState<{ id: string; kind: 'saved' | 'updated' } | null>(null)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), 2500)
    return () => clearTimeout(t)
  }, [done])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(() => {
    const preset = FACTORY_PATCHES.find(p => p.id === activePatchId)
    return preset ? `${preset.name} (mine)` : ''
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setPatches(await store.list()) } catch (e) { setError(errorText(e)) }
    setLoading(false)
  }, [store])

  useEffect(() => { if (ready) refresh() }, [ready, refresh])

  const active = patches.find(p => p.id === activePatchId) ?? null

  const run = async (fn: () => Promise<void>, kind: 'save' | 'update' | 'other' = 'other') => {
    setBusy(kind)
    setError(null)
    try { await fn() } catch (e) { setError(errorText(e)) }
    setBusy(null)
  }

  const saveNew = () => run(async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give your patch a name'); return }
    const patch = await store.create(trimmed, currentRig)
    setPatches(prev => [patch, ...prev])
    onActiveChange(patch)
    setName('')
    setDone({ id: patch.id, kind: 'saved' })
  }, 'save')

  const overwrite = () => active && run(async () => {
    const patch = await store.update(active.id, currentRig)
    setPatches(prev => [patch, ...prev.filter(p => p.id !== patch.id)])
    onActiveChange(patch)
    setDone({ id: patch.id, kind: 'updated' })
  }, 'update')

  const remove = (patch: Patch) => {
    if (!confirm(`Delete patch "${patch.name}"?`)) return
    run(async () => {
      await store.remove(patch.id)
      setPatches(prev => prev.filter(p => p.id !== patch.id))
      if (patch.id === activePatchId) onActiveChange(null)
    })
  }

  const loadFactory = (p: Patch) => {
    onLoad(p)
    setName(`${p.name} (mine)`)
  }

  return (
    <div className="fx-patches">
      <div className="fx-presets">
        <p className="fx-presets-title">NIXX Presets <span>Load one, tweak it, then save it as your own</span></p>
        <ul className="fx-presets-grid">
          {FACTORY_PATCHES.map(p => (
            <li key={p.id}>
              <button className={`fx-preset ${p.id === activePatchId ? 'active' : ''}`} onClick={() => loadFactory(p)} disabled={busy !== null} title={p.description}>
                <span className="fx-preset-name">{p.name.replace(/^NIXX /, '')}</span>
                <span className="fx-preset-desc">{p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="fx-presets-title">My Patches</p>
      <form className="fx-patches-save" onSubmit={e => { e.preventDefault(); saveNew() }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={MAX_PATCH_NAME}
          placeholder="Name this sound, e.g. Blues Lead"
          aria-label="Patch name"
          className="fx-patches-input"
        />
        <button type="submit" className="fx-patches-btn primary" disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : <><Icon name="save" size={14} /> Save new</>}
        </button>
        {active && (() => {
          const justUpdated = done?.id === active.id && done.kind === 'updated'
          return (
            <button
              type="button"
              className={`fx-patches-btn ${justUpdated ? 'done' : edited ? 'pending' : ''}`}
              onClick={overwrite}
              disabled={busy !== null || !edited}
              title={edited ? `Overwrite "${active.name}" with the current rig` : `"${active.name}" has no unsaved changes`}
            >
              {busy === 'update' ? 'Updating…'
                : justUpdated ? <><Icon name="check" size={14} /> Updated “{active.name}”</>
                : edited ? <>Update “{active.name}”</>
                : <>“{active.name}” is up to date</>}
            </button>
          )
        })()}
      </form>

      <p className="fx-patches-status">
        {signedIn ? 'Patches are synced to your account.' : 'Patches are saved in this browser. '}
        {enabled && !signedIn && (
          <button className="fx-patches-link" onClick={() => openSignIn('Sign in to keep your patches in your account and load them on any device.')}>
            Sign in to use them on any device
          </button>
        )}
      </p>

      {error && <p className="fx-patches-error" role="alert">{error}</p>}
      <p className="sr-only" role="status">{done ? (done.kind === 'saved' ? 'Patch saved' : 'Patch updated') : ''}</p>

      {loading ? (
        <p className="fx-patches-empty">Loading patches…</p>
      ) : patches.length === 0 ? (
        <p className="fx-patches-empty">No saved patches yet. Dial in a sound and save it here.</p>
      ) : (
        <ul className="fx-patches-list">
          {patches.map(p => (
            <li key={p.id} className={`${p.id === activePatchId ? 'active' : ''} ${done?.id === p.id ? 'just-saved' : ''}`}>
              <button className="fx-patch-load" onClick={() => onLoad(p)} disabled={busy !== null}>
                <span className="fx-patch-name">{p.name}</span>
                <span className="fx-patch-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
              </button>
              <button className="fx-patch-delete" onClick={() => remove(p)} disabled={busy !== null} aria-label={`Delete ${p.name}`} title="Delete">
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="fx-patches-fine">Custom IR and .nam files stay on this device; patches remember which ones you used.</p>
    </div>
  )
}
