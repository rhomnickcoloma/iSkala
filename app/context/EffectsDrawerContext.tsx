'use client'

import { useCallback, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { INSTRUMENTS } from '../lib/instruments'

const EffectsPage = dynamic(() => import('../components/EffectsPage'), { ssr: false })

// The drawer lives above the page routes so audio keeps running while switching instruments
const FRETBOARD_PATHS = new Set(['/', '/nixx', ...Object.keys(INSTRUMENTS).map(id => `/${id}`)])

export function EffectsDrawerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), [])
  const openFullPage = useCallback(() => router.push('/effects'), [router])

  return (
    <>
      {children}
      {/* Leaving the fretboard (e.g. for the full effects page) unmounts the drawer, which stops its audio */}
      {FRETBOARD_PATHS.has(pathname) && (
        <EffectsPage
          variant="drawer"
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenFullPage={openFullPage}
        />
      )}
    </>
  )
}
