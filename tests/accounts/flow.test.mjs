// End-to-end account flow against a mocked Supabase (guest save → Google sign-in → merge → sign out).
// Needs a dev server built with fake Supabase env vars:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test next dev -p 3005
//   yarn test:accounts
import { chromium } from 'playwright'

const SB = 'http://127.0.0.1:54321'
const APP = 'http://localhost:3005'
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = claims => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', ...claims })}.sig`
const now = new Date().toISOString()

const GUEST = { id: 'guest-1', aud: 'authenticated', role: 'authenticated', is_anonymous: true, created_at: now, app_metadata: {}, user_metadata: {} }
const ACCT = { id: 'acct-1', aud: 'authenticated', role: 'authenticated', is_anonymous: false, email: 'nixx@example.com', created_at: now, app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Nixx Player' } }
const session = user => ({ access_token: jwt({ sub: user.id, is_anonymous: user.is_anonymous }), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + user.id, user })

const db = { patches: [], calls: [] }
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const userFrom = req => {
  const tok = (req.headers()['authorization'] || '').replace('Bearer ', '')
  try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).sub } catch { return null }
}

let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', e => console.log('PAGE ERROR', e.message))
page.on('dialog', d => d.accept())

await page.route(`${SB}/**`, async route => {
  const req = route.request()
  const url = new URL(req.url())
  const path = url.pathname
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  db.calls.push(`${req.method()} ${path}`)

  if (path === '/auth/v1/signup') return json(route, session(GUEST))
  if (path === '/auth/v1/authorize') {
    db.calls.push(`authorize provider=${url.searchParams.get('provider')}`)
    const back = new URL(url.searchParams.get('redirect_to'))
    back.searchParams.set('code', 'oauth-code')
    return route.fulfill({ status: 302, headers: { location: back.toString() } })
  }
  if (path === '/auth/v1/token') return json(route, session(ACCT))
  if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })
  if (path === '/auth/v1/user') return json(route, userFrom(req) === ACCT.id ? ACCT : GUEST)

  if (path === '/rest/v1/rpc/create_guest_merge_token') return json(route, 'merge-token-abc')
  if (path === '/rest/v1/rpc/claim_guest_data') {
    const { p_token } = req.postDataJSON()
    db.claimToken = p_token
    let moved = 0
    db.patches.forEach(p => { if (p.user_id === GUEST.id) { p.user_id = userFrom(req); moved++ } })
    return json(route, moved)
  }
  if (path === '/rest/v1/effect_patches') {
    const uid = userFrom(req)
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    if (req.method() === 'GET') return json(route, db.patches.filter(p => p.user_id === uid).map(({ user_id, ...p }) => p))
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      const row = { id: `p${db.patches.length + 1}`, name: body.name, rig: body.rig, updated_at: new Date().toISOString(), user_id: uid }
      db.patches.push(row)
      const { user_id, ...out } = row
      return json(route, single ? out : [out], 201)
    }
  }
  console.log('UNMOCKED', req.method(), req.url())
  return json(route, { message: 'unmocked' }, 404)
})

await page.goto(`${APP}/effects`)
const signInBtn = page.locator('.fx-header .account-btn', { hasText: 'Sign in' })
check('Effects header shows a Sign in button when accounts are configured', await signInBtn.waitFor({ timeout: 10000 }).then(() => true, () => false))

await page.getByRole('button', { name: 'Patches' }).click()
await page.waitForSelector('.fx-patches-status')
check('Before saving: explains the free guest account', (await page.locator('.fx-patches-status').innerText()).includes('free guest account'))
check('No guest account is created just by visiting', !db.calls.some(c => c.includes('/signup')))

await page.getByLabel('Patch name').fill('Guest Tone')
await page.getByRole('button', { name: 'Save new' }).click()
await page.locator('.fx-patch-name', { hasText: 'Guest Tone' }).waitFor({ timeout: 5000 })
check('Saving creates the guest account', db.calls.includes('POST /auth/v1/signup'))
check('Patch is stored under the guest user', db.patches[0]?.user_id === GUEST.id)
const status = await page.locator('.fx-patches-status').innerText()
check('Status shows the 30-day guest window', status.includes('guest account for 30 more days'), status)

await page.getByRole('button', { name: 'Sign in to keep them forever' }).click()
const dialog = page.getByRole('dialog')
check('Sign-in dialog shows the guest countdown', (await dialog.innerText()).includes('30 more days'))
await page.screenshot({ path: 'test-results/auth-dialog.png' })

const claimed = page.waitForRequest(r => r.url().endsWith('/rpc/claim_guest_data'), { timeout: 15000 })
await dialog.getByRole('button', { name: 'Continue with Google' }).click()
await claimed
await page.waitForURL(`${APP}/effects`, { timeout: 15000 })
check('Merge token minted while still a guest', db.calls.includes('POST /rest/v1/rpc/create_guest_merge_token'))
check('Redirected to Google via Supabase', db.calls.includes('authorize provider=google'))
check('Callback exchanged the code', db.calls.some(c => c.startsWith('POST /auth/v1/token')))
check('Callback redeemed the guest merge token', db.claimToken === 'merge-token-abc')
check('Merge token removed from the browser', (await page.evaluate(() => localStorage.getItem('fretwiki-guest-merge'))) === null)
check('Returned to the page the user started on', page.url() === `${APP}/effects`)

const avatar = page.locator('.fx-header .account-btn.signed-in')
check('Header now shows the signed-in avatar', await avatar.waitFor({ timeout: 5000 }).then(() => true, () => false))
await page.getByRole('button', { name: 'Patches' }).click()
await page.locator('.fx-patch-name', { hasText: 'Guest Tone' }).waitFor({ timeout: 5000 }).catch(() => {})
check('Guest patch now belongs to the account', db.patches[0]?.user_id === ACCT.id && await page.locator('.fx-patch-name', { hasText: 'Guest Tone' }).isVisible())
check('Status says patches are synced', (await page.locator('.fx-patches-status').innerText()).includes('synced to your account'))

await page.reload()
check('Signed-in session survives a reload', await avatar.waitFor({ timeout: 10000 }).then(() => true, () => false))

await avatar.click()
const menu = await page.locator('.account-menu').innerText()
check('Account menu shows name and email', menu.includes('Nixx Player') && menu.includes('nixx@example.com'))
await page.screenshot({ path: 'test-results/account-menu.png' })
await page.getByRole('menuitem', { name: 'Sign out' }).click()
check('Sign out returns to the Sign in button', await signInBtn.waitFor({ timeout: 5000 }).then(() => true, () => false))

await page.goto(`${APP}/guitar`)
check('Main header also shows the account button', await page.locator('header .account-btn').waitFor({ timeout: 10000 }).then(() => true, () => false))

const errPage = await browser.newPage()
await errPage.goto(`${APP}/auth/callback?error=access_denied&error_description=User+cancelled+login&next=/effects`)
check('Cancelled sign-in shows a friendly error', await errPage.getByText('User cancelled login').waitFor({ timeout: 10000 }).then(() => true, () => false))
await errPage.goto(`${APP}/auth/callback?next=//evil.com`)
await errPage.waitForTimeout(2000)
check('Open-redirect via next=//evil.com is blocked', new URL(errPage.url()).host === 'localhost:3005')

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } })
await mobile.route(`${SB}/**`, r => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{}' }))
await mobile.goto(`${APP}/effects`)
await mobile.getByRole('button', { name: 'Patches' }).click()
await mobile.waitForTimeout(500)
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check('Mobile effects page has no horizontal scroll with Sign in + Patches', overflow <= 1, `overflow=${overflow}`)
await mobile.screenshot({ path: 'test-results/patches-mobile.png' })

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
