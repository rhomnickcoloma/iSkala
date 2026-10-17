'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useInstrument } from '../context/InstrumentContext'
import { INSTRUMENTS } from '../lib/instruments'
import { useAuth } from '../context/AuthContext'
import AccountButton from './AccountButton'
import { Icon } from './Icons'

function ProfileButton() {
  const { user } = useAuth()
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

  if (user) return <AccountButton />

  return (
    <div className="profile-wrap" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen(o => !o)} aria-label="Profile" aria-expanded={open} title="Profile">
        <Icon name="user" size={18} />
      </button>
      {open && <div className="profile-pop" role="status">We are working on it. Please stay tuned!</div>}
    </div>
  )
}

export default function SiteHeader() {
  const { instrument } = useInstrument()
  const pathname = usePathname()
  const onScalePage = pathname === '/' || pathname === '/nixx' || Boolean(INSTRUMENTS[pathname.slice(1)])
  const nav = [
    { href: `/${instrument.id}`, icon: 'house', label: 'Home', long: 'Home', active: onScalePage },
    { href: '/compare-scales', icon: 'scale', label: 'Compare', long: 'Compare Scales', active: pathname === '/compare-scales' },
    { href: '/backing-track', icon: 'music', label: 'Backing', long: 'Backing Track', active: pathname === '/backing-track' },
  ] as const

  return (
    <header className="site-header">
      <Link href={`/${instrument.id}`} className="brand" aria-label="FretWiki home">
        <img src="/logo.png" alt="" className="brand-logo" />
        <span className="brand-text">
          <span className="brand-name">FretWiki</span>
          <span className="brand-sub">By NIXX Music</span>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Tools">
        {nav.map(item => (
          <Link key={item.label} href={item.href} className={`site-nav-link ${item.active ? 'active' : ''}`}
            aria-current={item.active ? 'page' : undefined}>
            <Icon name={item.icon} size={15} />
            <span className="label-long">{item.long}</span><span className="label-short">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="site-header-actions">
        <ProfileButton />
      </div>
    </header>
  )
}
