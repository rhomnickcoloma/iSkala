import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'fs'

// Runs the Supabase migration in an in-process Postgres (PGlite) with a minimal stand-in for Supabase's auth schema.
// Usage: yarn test:db
const migrationPath = new URL('../../supabase/migrations/20261016000000_accounts_and_patches.sql', import.meta.url)
const migration = readFileSync(migrationPath, 'utf8')
  .replace(/create extension if not exists pg_cron;/, '')
  .replace(/create extension if not exists pgcrypto with schema extensions;/, '')

const db = new PGlite({ extensions: { pgcrypto } })

// Minimal stand-in for the parts of Supabase the migration depends on
await db.exec(`
  create schema auth; create schema extensions; create schema cron;
  create extension pgcrypto with schema extensions;
  create role anon nologin; create role authenticated nologin;
  create table auth.users (id uuid primary key, is_anonymous boolean not null default false, created_at timestamptz not null default now());
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
  grant usage on schema auth, extensions, public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`)
await db.exec(migration)
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`)

const GUEST = '11111111-1111-1111-1111-111111111111'
const ACCT = '22222222-2222-2222-2222-222222222222'
const OTHER = '33333333-3333-3333-3333-333333333333'
await db.exec(`insert into auth.users (id, is_anonymous) values ('${GUEST}', true), ('${ACCT}', false), ('${OTHER}', true)`)

let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

async function as(uid, anon, fn) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uid, is_anonymous: anon, role: 'authenticated' })])
  await db.exec('set role authenticated')
  try { return await fn() } finally { await db.exec('reset role') }
}
async function fails(fn) { try { await fn(); return false } catch { return true } }

// Guest saves patches
await as(GUEST, true, async () => {
  await db.query(`insert into public.effect_patches (name, rig) values ('Blues Lead', '{"effects":[]}'), ('Clean', '{"effects":[]}')`)
})
await as(OTHER, true, async () => {
  await db.query(`insert into public.effect_patches (name, rig) values ('Other guest', '{"effects":[]}')`)
  const r = await db.query(`select count(*)::int n from public.effect_patches`)
  check('RLS: a guest only sees their own patches', r.rows[0].n === 1)
  check('RLS: cannot insert a patch for someone else', await fails(() => db.query(`insert into public.effect_patches (user_id, name, rig) values ('${GUEST}', 'x', '{}')`)))
  const u = await db.query(`update public.effect_patches set name = 'hacked' where user_id = '${GUEST}'`)
  check('RLS: cannot update someone else\'s patch', u.affectedRows === 0)
})
check('Validation: empty name rejected', await as(GUEST, true, () => fails(() => db.query(`insert into public.effect_patches (name, rig) values ('  ', '{}')`))))
check('Validation: non-object rig rejected', await as(GUEST, true, () => fails(() => db.query(`insert into public.effect_patches (name, rig) values ('x', '[]')`))))

// Account has its own patch already
await as(ACCT, false, () => db.query(`insert into public.effect_patches (name, rig) values ('Account patch', '{"effects":[]}')`))

check('Merge token: real accounts cannot mint one', await as(ACCT, false, () => fails(() => db.query(`select public.create_guest_merge_token()`))))
const token = await as(GUEST, true, async () => (await db.query(`select public.create_guest_merge_token() t`)).rows[0].t)
check('Merge token: guest gets a 64-char token', typeof token === 'string' && token.length === 64)
const stored = (await db.query(`select token_hash from public.guest_merge_tokens`)).rows
check('Merge token: only a hash is stored', stored.length === 1 && stored[0].token_hash !== token)
check('Merge token: guests cannot read the token table', await as(GUEST, true, async () => (await db.query(`select * from public.guest_merge_tokens`)).rows.length === 0))

check('Claim: a guest session cannot claim', await as(OTHER, true, () => fails(() => db.query(`select public.claim_guest_data($1)`, [token]))))
const bad = await as(ACCT, false, async () => (await db.query(`select public.claim_guest_data('nope') n`)).rows[0].n)
check('Claim: a wrong token moves nothing', bad === 0)

const moved = await as(ACCT, false, async () => (await db.query(`select public.claim_guest_data($1) n`, [token])).rows[0].n)
check('Claim: guest patches move to the account', moved === 2, `moved=${moved}`)
const names = await as(ACCT, false, async () => (await db.query(`select name from public.effect_patches order by name`)).rows.map(r => r.name))
check('Claim: account now sees its own and the guest\'s patches', JSON.stringify(names) === JSON.stringify(['Account patch', 'Blues Lead', 'Clean']), names.join(', '))
check('Claim: guest user is deleted', (await db.query(`select 1 from auth.users where id = '${GUEST}'`)).rows.length === 0)
const again = await as(ACCT, false, async () => (await db.query(`select public.claim_guest_data($1) n`, [token])).rows[0].n)
check('Claim: the token is single-use', again === 0)
check('Other guest is untouched', (await db.query(`select count(*)::int n from public.effect_patches where user_id = '${OTHER}'`)).rows[0].n === 1)

// Expired tokens
await db.exec(`insert into auth.users (id, is_anonymous) values ('${GUEST}', true)`)
const t2 = await as(GUEST, true, async () => (await db.query(`select public.create_guest_merge_token() t`)).rows[0].t)
await db.exec(`update public.guest_merge_tokens set expires_at = now() - interval '1 minute'`)
const expired = await as(ACCT, false, async () => (await db.query(`select public.claim_guest_data($1) n`, [t2])).rows[0].n)
check('Claim: expired tokens are rejected', expired === 0 && (await db.query(`select 1 from auth.users where id = '${GUEST}'`)).rows.length === 1)

// Patch cap
const capHit = await as(OTHER, true, async () => {
  for (let i = 0; i < 99; i++) await db.query(`insert into public.effect_patches (name, rig) values ($1, '{}')`, [`p${i}`])
  return fails(() => db.query(`insert into public.effect_patches (name, rig) values ('one too many', '{}')`))
})
check('Cap: the 101st patch is rejected', capHit)

// Merge respects the cap: account at 99 + guest with 3 → only newest 1 moves
await db.exec(`delete from public.effect_patches where user_id = '${ACCT}'`)
await as(ACCT, false, async () => { for (let i = 0; i < 99; i++) await db.query(`insert into public.effect_patches (name, rig) values ($1, '{}')`, [`a${i}`]) })
await as(GUEST, true, async () => {
  await db.query(`insert into public.effect_patches (name, rig, updated_at) values ('old', '{}', now())`)
  await db.query(`insert into public.effect_patches (name, rig) values ('newer', '{}')`)
})
await db.exec(`alter table public.effect_patches disable trigger effect_patches_guard; update public.effect_patches set updated_at = now() - interval '1 day' where name = 'old'; alter table public.effect_patches enable trigger effect_patches_guard;`)
const t3 = await as(GUEST, true, async () => (await db.query(`select public.create_guest_merge_token() t`)).rows[0].t)
const capped = await as(ACCT, false, async () => (await db.query(`select public.claim_guest_data($1) n`, [t3])).rows[0].n)
const kept = (await db.query(`select name from public.effect_patches where user_id = '${ACCT}' and name in ('old','newer')`)).rows.map(r => r.name)
check('Claim: merge keeps the newest guest patches that fit under the cap', capped === 1 && kept.join() === 'newer', `moved=${capped} kept=${kept}`)

// TTL job
await db.exec(`insert into auth.users (id, is_anonymous, created_at) values
  ('44444444-4444-4444-4444-444444444444', true, now() - interval '31 days'),
  ('55555555-5555-5555-5555-555555555555', true, now() - interval '29 days'),
  ('66666666-6666-6666-6666-666666666666', false, now() - interval '400 days')`)
await db.exec(`insert into public.effect_patches (user_id, name, rig) values ('44444444-4444-4444-4444-444444444444', 'old guest', '{}')`)
const cronSql = migration.match(/'17 3 \* \* \*',\s*\$\$([\s\S]*?)\$\$/)[1]
await db.exec(cronSql)
const left = (await db.query(`select id from auth.users where id::text like '4%' or id::text like '5%' or id::text like '6%' order by id`)).rows.map(r => r.id[0])
check('TTL: guests older than 30 days are deleted, younger guests and real accounts kept', left.join() === '5,6', left.join())
check('TTL: expired guest patches are removed by cascade', (await db.query(`select 1 from public.effect_patches where name = 'old guest'`)).rows.length === 0)

// Account deletion
await as(ACCT, false, () => db.query(`select public.delete_my_account()`))
check('Delete account: user and all patches removed', (await db.query(`select 1 from auth.users where id = '${ACCT}'`)).rows.length === 0
  && (await db.query(`select count(*)::int n from public.effect_patches where user_id = '${ACCT}'`)).rows[0].n === 0)

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
