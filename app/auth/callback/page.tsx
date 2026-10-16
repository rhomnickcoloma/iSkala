'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authEnabled } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// Only same-origin paths, never protocol-relative URLs
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

export default function AuthCallback() {
  const router = useRouter()
  const { connect } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = safeNext(params.get('next'))
    const providerError = params.get('error_description') || params.get('error')

    ;(async () => {
      if (!authEnabled) { router.replace(next); return }
      if (providerError) {
        setError(providerError)
        return
      }
      const sb = await connect()
      const { data, error: sessionError } = await sb.auth.getSession()
      if (sessionError || !data.session) {
        setError(sessionError?.message || 'Sign-in did not complete. Please try again.')
        return
      }
      router.replace(next)
    })()
  }, [router, connect])

  return (
    <main className="auth-callback">
      {error ? (
        <>
          <h1>Sign-in failed</h1>
          <p>{error}</p>
          <Link href="/">Back to FretWiki</Link>
        </>
      ) : (
        <>
          <h1>Signing you in…</h1>
          <p>Moving patches saved in this browser into your account.</p>
        </>
      )}
    </main>
  )
}
