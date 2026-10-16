'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icons'

export default function AccountButton({ className }: { className?: string }) {
  const { enabled, ready, user, isGuest, openSignIn, signOut, deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!enabled || !ready) return null

  if (!user || isGuest) {
    return (
      <button className={`account-btn ${className ?? ''}`} onClick={() => openSignIn()} title="Sign in with Google or Facebook">
        <Icon name="user" size={16} />
        <span className="account-btn-label">Sign in</span>
      </button>
    )
  }

  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string }
  const name = meta.full_name || meta.name || user.email || 'Account'
  const avatar = meta.avatar_url || meta.picture

  const onDelete = async () => {
    if (!confirm('Delete your FretWiki account and all saved patches? This cannot be undone.')) return
    try { await deleteAccount(); setOpen(false) } catch (e) { alert(e instanceof Error ? e.message : 'Could not delete account') }
  }

  return (
    <div className={`account-menu-wrap ${className ?? ''}`} ref={ref}>
      <button className="account-btn signed-in" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${name}`}>
        {avatar
          ? <img src={avatar} alt="" className="account-avatar" referrerPolicy="no-referrer" />
          : <span className="account-avatar initial">{name.charAt(0).toUpperCase()}</span>}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-head">
            <span className="account-menu-name">{name}</span>
            {user.email && user.email !== name && <span className="account-menu-email">{user.email}</span>}
          </div>
          <button role="menuitem" onClick={() => { setOpen(false); signOut() }}>
            <Icon name="log-out" size={14} /> Sign out
          </button>
          <button role="menuitem" className="danger" onClick={onDelete}>
            <Icon name="trash" size={14} /> Delete account
          </button>
        </div>
      )}
    </div>
  )
}
