'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { authEnabled, GUEST_TTL_DAYS, hasStoredSession, loadSupabase } from '../lib/supabase'
import { Icon } from '../components/Icons'

export type OAuthProvider = 'google' | 'facebook'

export const GUEST_MERGE_KEY = 'fretwiki-guest-merge'

// Kept until the server confirms, so a failed merge is retried on the next visit
export async function claimPendingGuestData(sb: SupabaseClient) {
  const token = localStorage.getItem(GUEST_MERGE_KEY)
  if (!token) return
  const { error } = await sb.rpc('claim_guest_data', { p_token: token })
  if (!error) localStorage.removeItem(GUEST_MERGE_KEY)
}

interface AuthContextValue {
  enabled: boolean
  ready: boolean
  user: User | null
  isGuest: boolean
  guestExpiresAt: Date | null
  /** Loads the Supabase client on first use and starts tracking its session */
  connect: () => Promise<SupabaseClient>
  /** Returns the current user, creating a guest account on first use */
  ensureUser: () => Promise<User>
  signIn: (provider: OAuthProvider) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  openSignIn: (reason?: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!authEnabled)
  const [signInReason, setSignInReason] = useState<string | null>(null)
  const guestPromise = useRef<Promise<User> | null>(null)
  const connection = useRef<Promise<SupabaseClient> | null>(null)
  const unsubscribe = useRef<(() => void) | null>(null)

  const connect = useCallback(() => {
    connection.current ??= loadSupabase().then(async sb => {
      const { data } = await sb.auth.getSession()
      const sessionUser = data.session?.user
      if (sessionUser && !sessionUser.is_anonymous && window.location.pathname !== '/auth/callback') {
        await claimPendingGuestData(sb)
      }
      setUser(sessionUser ?? null)
      setReady(true)
      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
      unsubscribe.current = () => sub.subscription.unsubscribe()
      return sb
    })
    return connection.current
  }, [])

  useEffect(() => {
    if (!authEnabled) return
    if (hasStoredSession() || window.location.pathname === '/auth/callback') {
      connect().catch(() => setReady(true))
    } else {
      setReady(true)
    }
    return () => unsubscribe.current?.()
  }, [connect])

  const ensureUser = useCallback(async () => {
    const sb = await connect()
    const { data } = await sb.auth.getSession()
    if (data.session) return data.session.user
    guestPromise.current ??= sb.auth.signInAnonymously().then(({ data: res, error }) => {
      guestPromise.current = null
      if (error || !res.user) throw error ?? new Error('Could not start a guest session')
      return res.user
    })
    return guestPromise.current
  }, [connect])

  const signIn = useCallback(async (provider: OAuthProvider) => {
    const sb = await connect()
    const { data } = await sb.auth.getSession()
    if (data.session?.user.is_anonymous) {
      const { data: token } = await sb.rpc('create_guest_merge_token')
      if (typeof token === 'string') localStorage.setItem(GUEST_MERGE_KEY, token)
    }
    const next = window.location.pathname + window.location.search
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) throw error
  }, [connect])

  const signOut = useCallback(async () => {
    const sb = await connect()
    await sb.auth.signOut()
  }, [connect])

  const deleteAccount = useCallback(async () => {
    const sb = await connect()
    const { error } = await sb.rpc('delete_my_account')
    if (error) throw error
    await sb.auth.signOut({ scope: 'local' })
  }, [connect])

  const isGuest = Boolean(user?.is_anonymous)
  const guestExpiresAt = useMemo(
    () => isGuest && user ? new Date(new Date(user.created_at).getTime() + GUEST_TTL_DAYS * 86_400_000) : null,
    [isGuest, user],
  )

  const value = useMemo<AuthContextValue>(() => ({
    enabled: authEnabled, ready, user, isGuest, guestExpiresAt,
    connect, ensureUser, signIn, signOut, deleteAccount,
    openSignIn: (reason?: string) => setSignInReason(reason ?? ''),
  }), [ready, user, isGuest, guestExpiresAt, connect, ensureUser, signIn, signOut, deleteAccount])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {signInReason !== null && (
        <SignInDialog reason={signInReason} guestExpiresAt={guestExpiresAt} onSignIn={signIn} onClose={() => setSignInReason(null)} />
      )}
    </AuthContext.Provider>
  )
}

export function daysLeft(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000))
}

function SignInDialog({ reason, guestExpiresAt, onSignIn, onClose }: {
  reason: string
  guestExpiresAt: Date | null
  onSignIn: (p: OAuthProvider) => Promise<void>
  onClose: () => void
}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const go = async (provider: OAuthProvider) => {
    setPending(provider)
    setError(null)
    try { await onSignIn(provider) } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setPending(null)
    }
  }

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={e => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        <h2 id="auth-title">Sign in to FretWiki</h2>
        <p className="auth-lead">{reason || 'Keep your patches forever and use them on any device.'}</p>
        {guestExpiresAt && (
          <p className="auth-guest-note">
            Your guest saves are kept for {daysLeft(guestExpiresAt)} more days. Signing in moves them into your account.
          </p>
        )}
        <div className="auth-providers">
          <button className="auth-provider google" onClick={() => go('google')} disabled={pending !== null}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133c-1.147 1.147-2.933 2.4-6.053 2.4c-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0C5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36c2.16-2.16 2.84-5.213 2.84-7.667c0-.76-.053-1.467-.173-2.053z" /></svg>
            {pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <button className="auth-provider facebook" onClick={() => go('facebook')} disabled={pending !== null}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978c.401 0 .955.042 1.468.103a9 9 0 0 1 1.141.195v3.325a9 9 0 0 0-.653-.036a27 27 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.7 1.7 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103l-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647" /></svg>
            {pending === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
          </button>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="auth-fine">
          Every tool stays free without an account. By signing in you agree to the <Link href="/terms" onClick={onClose}>Terms</Link>.
        </p>
      </div>
    </div>
  )
}
