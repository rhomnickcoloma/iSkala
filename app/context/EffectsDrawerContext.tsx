'use client'

import { useCallback, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
const EffectsPage = dynamic(() => import('../components/EffectsPage'), { ssr: false })

// The drawer lives above the page routes so audio keeps running while navigating
const FULL_EFFECTS_PATH = '/effects'

export function EffectsDrawerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), [])
  const openFullPage = useCallback(() => router.push('/effects'), [router])

  return (
    <>
      {children}
      {/* Opening the full effects page unmounts the drawer, which stops its audio */}
      {pathname !== FULL_EFFECTS_PATH && (
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
