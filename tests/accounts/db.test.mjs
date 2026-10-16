import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

// Runs the Supabase migration in an in-process Postgres (PGlite) with a minimal stand-in for Supabase's auth schema.
// Usage: yarn test:db
const migrationPath = new URL('../../supabase/migrations/20261016000000_accounts_and_patches.sql', import.meta.url)
const migration = readFileSync(migrationPath, 'utf8')

const db = new PGlite()

await db.exec(`
  create schema auth;
  create role anon nologin; create role authenticated nologin;
  create table auth.users (id uuid primary key, created_at timestamptz not null default now());
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`)
await db.exec(migration)
// Must be safe to re-run (the setup script applies it on every run)
await db.exec(migration)
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`)

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`)

let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

async function as(uid, fn, role = 'authenticated') {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(uid ? { sub: uid, role } : { role })])
  await db.exec(`set role ${role}`)
  try { return await fn() } finally { await db.exec('reset role') }
}
const fails = async fn => { try { await fn(); return false } catch { return true } }
const count = async uid => (await db.query(`select count(*)::int n from public.effect_patches where user_id = $1`, [uid])).rows[0].n
const importAs = (uid, patches) => as(uid, async () => (await db.query(`select public.import_patches($1::jsonb) n`, [JSON.stringify(patches)])).rows[0].n)

// Row-level security
await as(A, () => db.query(`insert into public.effect_patches (name, rig) values ('Blues Lead', '{"effects":[]}'), ('Clean', '{"effects":[]}')`))
await as(B, async () => {
  await db.query(`insert into public.effect_patches (name, rig) values ('B patch', '{"effects":[]}')`)
  check('RLS: users only see their own patches', (await db.query(`select count(*)::int n from public.effect_patches`)).rows[0].n === 1)
  check('RLS: cannot insert a patch for someone else', await fails(() => db.query(`insert into public.effect_patches (user_id, name, rig) values ('${A}', 'x', '{}')`)))
  check('RLS: cannot update someone else\'s patch', (await db.query(`update public.effect_patches set name = 'hacked' where user_id = '${A}'`)).affectedRows === 0)
  check('RLS: cannot delete someone else\'s patch', (await db.query(`delete from public.effect_patches where user_id = '${A}'`)).affectedRows === 0)
})
check('RLS: signed-out visitors see nothing', await as(null, async () => (await db.query(`select * from public.effect_patches`)).rows.length === 0, 'anon'))
check('RLS: signed-out visitors cannot insert', await as(null, () => fails(() => db.query(`insert into public.effect_patches (user_id, name, rig) values ('${A}', 'x', '{}')`)), 'anon'))

// Validation
check('Validation: blank name rejected', await as(A, () => fails(() => db.query(`insert into public.effect_patches (name, rig) values ('  ', '{}')`))))
check('Validation: non-object rig rejected', await as(A, () => fails(() => db.query(`insert into public.effect_patches (name, rig) values ('x', '[]')`))))

// Importing browser patches after sign-in
const imported = await importAs(A, [
  { name: 'Local One', rig: { effects: [] }, updatedAt: '2026-10-01T00:00:00Z' },
  { name: '   ', rig: { effects: [] } },
  { name: 'Bad rig', rig: [] },
  { name: 'Local Two', rig: { effects: [] }, updatedAt: '2026-10-02T00:00:00Z' },
])
check('Import: valid browser patches are added, invalid ones skipped', imported === 2 && await count(A) === 4, `imported=${imported}`)
check('Import: rejects non-array input', await as(A, () => fails(() => db.query(`select public.import_patches('{}'::jsonb)`))))
check('Import: signed-out visitors cannot call it', await as(null, () => fails(() => db.query(`select public.import_patches('[]'::jsonb)`)), 'anon'))
check('Import: patches go to the caller only', await count(B) === 1)

// Cap of 100, and import keeps the newest that fit
await as(B, async () => { for (let i = 0; i < 98; i++) await db.query(`insert into public.effect_patches (name, rig) values ($1, '{}')`, [`b${i}`]) })
const capped = await importAs(B, [
  { name: 'oldest', rig: {}, updatedAt: '2026-01-01T00:00:00Z' },
  { name: 'newest', rig: {}, updatedAt: '2026-10-10T00:00:00Z' },
  { name: 'middle', rig: {}, updatedAt: '2026-05-01T00:00:00Z' },
])
const kept = (await db.query(`select name from public.effect_patches where user_id = '${B}' and name in ('oldest','middle','newest') order by name`)).rows.map(r => r.name)
check('Import: stops at the 100-patch cap, keeping the newest', capped === 1 && kept.join() === 'newest', `imported=${capped} kept=${kept}`)
check('Cap: inserting a 101st patch is rejected', await as(B, () => fails(() => db.query(`insert into public.effect_patches (name, rig) values ('one too many', '{}')`))))

// Account deletion
await as(A, () => db.query(`select public.delete_my_account()`))
check('Delete account: user and all their patches removed', (await db.query(`select 1 from auth.users where id = '${A}'`)).rows.length === 0 && await count(A) === 0)
check('Delete account: other users untouched', await count(B) === 100)
check('Delete account: signed-out visitors cannot call it', await as(null, () => fails(() => db.query(`select public.delete_my_account()`)), 'anon'))

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
