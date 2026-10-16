// Provisions FretWiki's Supabase project through the Management API.
// Reads secrets from .env / .env.local (never commit them):
//   SUPABASE_ACCESS_TOKEN   personal access token (supabase.com/dashboard/account/tokens)
//   SUPABASE_PROJECT_REF    optional: use an existing project instead of creating one
//   SUPABASE_ORG_ID         optional: organization for a new project (defaults to the only one you have)
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, FACEBOOK_APP_ID / FACEBOOK_APP_SECRET   optional: enable providers
// Usage: yarn setup:supabase
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomBytes } from 'crypto'

const ROOT = new URL('..', import.meta.url)
const API = 'https://api.supabase.com/v1'
const SITE_URL = 'https://fretwiki.com'
const REDIRECTS = [
  'https://fretwiki.com/auth/callback',
  'https://www.fretwiki.com/auth/callback',
  'http://localhost:3000/auth/callback',
  'https://*.vercel.app/auth/callback',
]

function readEnvFile(name) {
  const path = new URL(name, ROOT)
  if (!existsSync(path)) return {}
  return Object.fromEntries(readFileSync(path, 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^['"]|['"]$/g, '')]))
}

function upsertEnvFile(name, values) {
  const path = new URL(name, ROOT)
  let text = existsSync(path) ? readFileSync(path, 'utf8') : ''
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`
    text = new RegExp(`^${k}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${k}=.*$`, 'm'), line) : `${text.replace(/\n?$/, '\n')}${line}\n`
  }
  writeFileSync(path, text.replace(/^\n/, ''))
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env }
const token = env.SUPABASE_ACCESS_TOKEN
if (!token) { console.error('Missing SUPABASE_ACCESS_TOKEN in .env'); process.exit(1) }

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : text
    throw new Error(`${method} ${path} → ${res.status} ${msg}`)
  }
  return data
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function findOrCreateProject() {
  if (env.SUPABASE_PROJECT_REF) {
    const p = await api('GET', `/projects/${env.SUPABASE_PROJECT_REF}`)
    console.log(`Using existing project ${p.name} (${p.id})`)
    return p.id
  }
  const existing = (await api('GET', '/projects')).find(p => p.name === 'FretWiki')
  if (existing) {
    console.log(`Found project FretWiki (${existing.id})`)
    return existing.id
  }
  let orgId = env.SUPABASE_ORG_ID
  if (!orgId) {
    const orgs = await api('GET', '/organizations')
    if (orgs.length !== 1) throw new Error(`Set SUPABASE_ORG_ID; this token sees ${orgs.length} organizations`)
    orgId = orgs[0].id
  }
  const dbPass = randomBytes(24).toString('base64url')
  const p = await api('POST', '/projects', { name: 'FretWiki', organization_id: orgId, region: 'ap-southeast-1', db_pass: dbPass })
  upsertEnvFile('.env', { SUPABASE_DB_PASSWORD: dbPass })
  console.log(`Created project FretWiki (${p.id}) in Singapore; database password saved to .env`)
  return p.id
}

async function waitHealthy(ref) {
  for (let i = 0; i < 60; i++) {
    const { status } = await api('GET', `/projects/${ref}`)
    if (status === 'ACTIVE_HEALTHY') return
    process.stdout.write(i === 0 ? `Waiting for project (${status})` : '.')
    await sleep(5000)
  }
  throw new Error('Project did not become healthy within 5 minutes')
}

const ref = await findOrCreateProject()
await waitHealthy(ref)
console.log('\nProject is healthy')

// Postgres may still be warming up right after creation
const migration = readFileSync(new URL('supabase/migrations/20261016000000_accounts_and_patches.sql', ROOT), 'utf8')
for (let attempt = 1; ; attempt++) {
  try { await api('POST', `/projects/${ref}/database/query`, { query: migration }); break } catch (e) {
    if (attempt >= 6) throw e
    await sleep(10000)
  }
}
const tables = await api('POST', `/projects/${ref}/database/query`, {
  query: "select count(*)::int as n from pg_policies where tablename = 'effect_patches'",
})
console.log(`Migration applied (${tables[0]?.n ?? '?'} row-level security policies on effect_patches)`)

const auth = { site_url: SITE_URL, uri_allow_list: REDIRECTS.join(','), external_anonymous_users_enabled: false }
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  Object.assign(auth, { external_google_enabled: true, external_google_client_id: env.GOOGLE_CLIENT_ID, external_google_secret: env.GOOGLE_CLIENT_SECRET })
}
if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
  Object.assign(auth, { external_facebook_enabled: true, external_facebook_client_id: env.FACEBOOK_APP_ID, external_facebook_secret: env.FACEBOOK_APP_SECRET })
}
await api('PATCH', `/projects/${ref}/config/auth`, auth)
console.log(`Auth configured: site URL, ${REDIRECTS.length} redirect URLs` +
  `${auth.external_google_enabled ? ', Google on' : ', Google not configured yet'}` +
  `${auth.external_facebook_enabled ? ', Facebook on' : ', Facebook not configured yet'}`)

const keys = await api('GET', `/projects/${ref}/api-keys`)
const anon = keys.find(k => k.name === 'anon')?.api_key
if (!anon) throw new Error('Could not find the anon API key')
upsertEnvFile('.env.local', { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon })
upsertEnvFile('.env', { SUPABASE_PROJECT_REF: ref })
console.log('Wrote NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
console.log(`\nOAuth redirect URI for Google and Facebook: https://${ref}.supabase.co/auth/v1/callback`)
