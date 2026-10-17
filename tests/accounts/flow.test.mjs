// End-to-end account flow against a mocked Supabase (save in browser → Google sign-in → import → sign out).
// Needs a dev server built with fake Supabase env vars:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test next dev -p 3005
//   yarn test:accounts
import { chromium } from 'playwright'

const SB = 'http://127.0.0.1:54321'
const APP = 'http://localhost:3005'
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = claims => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', ...claims })}.sig`

const ACCT = { id: 'acct-1', aud: 'authenticated', role: 'authenticated', email: 'nixx@example.com', created_at: new Date().toISOString(), app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Nixx Player' } }
const session = user => ({ access_token: jwt({ sub: user.id }), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + user.id, user })

const db = { patches: [], calls: [], imported: null }
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const userFrom = req => {
  const tok = (req.headers()['authorization'] || '').replace('Bearer ', '')
  try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).sub } catch { return null }
}
const addRow = (uid, name, rig) => {
  const row = { id: `p${db.patches.length + 1}`, name, rig, updated_at: new Date().toISOString(), user_id: uid }
  db.patches.push(row)
  const { user_id, ...out } = row
  return out
}

let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }
const shows = loc => loc.waitFor({ timeout: 10000 }).then(() => true, () => false)

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

  if (path === '/auth/v1/authorize') {
    db.calls.push(`authorize provider=${url.searchParams.get('provider')}`)
    const back = new URL(url.searchParams.get('redirect_to'))
    back.searchParams.set('code', 'oauth-code')
    return route.fulfill({ status: 302, headers: { location: back.toString() } })
  }
  if (path === '/auth/v1/token') return json(route, session(ACCT))
  if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })
  if (path === '/auth/v1/user') return json(route, ACCT)

  if (path === '/rest/v1/rpc/import_patches') {
    const { p_patches } = req.postDataJSON()
    db.imported = p_patches
    p_patches.forEach(p => addRow(userFrom(req), p.name, p.rig))
    return json(route, p_patches.length)
  }
  if (path === '/rest/v1/effect_patches') {
    const uid = userFrom(req)
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    if (req.method() === 'GET') return json(route, db.patches.filter(p => p.user_id === uid).map(({ user_id, ...p }) => p))
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      const out = addRow(uid, body.name, body.rig)
      return json(route, single ? out : [out], 201)
    }
  }
  console.log('UNMOCKED', req.method(), req.url())
  return json(route, { message: 'unmocked' }, 404)
})

await page.goto(`${APP}/effects`)
const signInBtn = page.locator('.fx-header .account-btn', { hasText: 'Sign in' })
check('Effects header shows a Sign in button when accounts are configured', await shows(signInBtn))

await page.getByRole('button', { name: 'Patches' }).click()
check('Signed out: patches are saved in this browser', (await page.locator('.fx-patches-status').innerText()).includes('saved in this browser'))
await page.getByLabel('Patch name').fill('Local Tone')
await page.getByRole('button', { name: 'Save new' }).click()
check('Signed out: saving works', await shows(page.locator('.fx-patch-name', { hasText: 'Local Tone' })))
check('Signed out: nothing is sent to Supabase', db.calls.length === 0, db.calls.join(', '))
const local = await page.evaluate(() => JSON.parse(localStorage.getItem('fretwiki-patches-v1') || '[]'))
check('Signed out: the patch is in localStorage', local.length === 1 && local[0].name === 'Local Tone')

await page.getByRole('button', { name: 'Sign in to use them on any device' }).click()
const dialog = page.getByRole('dialog', { name: 'Sign in to FretWiki' })
check('Sign-in dialog says the browser patch will move', (await dialog.innerText()).includes('The patch saved in this browser will move into your account'))
await page.screenshot({ path: 'test-results/auth-dialog.png' })

const importReq = page.waitForRequest(r => r.url().endsWith('/rpc/import_patches'), { timeout: 15000 })
await dialog.getByRole('button', { name: 'Continue with Google' }).click()
await importReq
await page.waitForURL(`${APP}/effects`, { timeout: 15000 })
check('Redirected to Google via Supabase', db.calls.includes('authorize provider=google'))
check('Callback exchanged the code', db.calls.some(c => c.startsWith('POST /auth/v1/token')))
check('Browser patches were imported into the account', db.imported?.length === 1 && db.imported[0].name === 'Local Tone' && db.imported[0].rig?.effects?.length > 0)
check('Browser copy cleared after import', (await page.evaluate(() => localStorage.getItem('fretwiki-patches-v1'))) === null)
check('Returned to the page the user started on', page.url() === `${APP}/effects`)

const avatar = page.locator('.fx-header .account-btn.signed-in')
check('Header shows the signed-in avatar', await shows(avatar))
await page.getByRole('button', { name: 'Patches' }).click()
check('Imported patch is listed from the account', await shows(page.locator('.fx-patch-name', { hasText: 'Local Tone' })))
check('Status says patches are synced', (await page.locator('.fx-patches-status').innerText()).includes('synced to your account'))

await page.getByLabel('Patch name').fill('Cloud Tone')
await page.getByRole('button', { name: 'Save new' }).click()
check('Signed in: saving goes to the account', await shows(page.locator('.fx-patch-name', { hasText: 'Cloud Tone' })) && db.patches.some(p => p.name === 'Cloud Tone' && p.user_id === ACCT.id))
check('Signed in: nothing is written to localStorage', (await page.evaluate(() => localStorage.getItem('fretwiki-patches-v1'))) === null)

await page.reload()
check('Signed-in session survives a reload', await shows(avatar))
const importsBefore = db.calls.filter(c => c.endsWith('/rpc/import_patches')).length
check('No repeat import when the browser has nothing new', importsBefore === 1)

await avatar.click()
const menu = await page.locator('.account-menu').innerText()
check('Account menu shows name and email', menu.includes('Nixx Player') && menu.includes('nixx@example.com'))
await page.screenshot({ path: 'test-results/account-menu.png' })
await page.getByRole('menuitem', { name: 'Sign out' }).click()
check('Sign out returns to the Sign in button', await shows(signInBtn))
await page.getByRole('button', { name: 'Patches' }).click()
check('After sign-out the panel shows the (empty) browser list', await shows(page.locator('.fx-patches-empty')))

await page.goto(`${APP}/guitar`)
check('Main header also shows the account button', await shows(page.locator('header .account-btn')))

const errPage = await browser.newPage()
await errPage.goto(`${APP}/auth/callback?error=access_denied&error_description=User+cancelled+login&next=/effects`)
check('Cancelled sign-in shows a friendly error', await shows(errPage.getByText('User cancelled login')))
await errPage.goto(`${APP}/auth/callback?next=//evil.com`)
await errPage.waitForTimeout(2000)
check('Open-redirect via next=//evil.com is blocked', new URL(errPage.url()).host === 'localhost:3005')

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } })
await mobile.goto(`${APP}/effects`)
await mobile.getByRole('button', { name: 'Patches' }).click()
await mobile.waitForTimeout(500)
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check('Mobile effects page has no horizontal scroll with Sign in + Patches', overflow <= 1, `overflow=${overflow}`)
await mobile.screenshot({ path: 'test-results/patches-mobile.png' })

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
