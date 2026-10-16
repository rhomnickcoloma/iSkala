-- FretWiki accounts: guest (anonymous) users, saved effect patches, guest → account merge, 30-day guest TTL.
-- Run once in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

-- ─── Effect patches ───

create table if not exists public.effect_patches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  rig jsonb not null check (jsonb_typeof(rig) = 'object' and pg_column_size(rig) < 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists effect_patches_user_updated_idx on public.effect_patches (user_id, updated_at desc);

alter table public.effect_patches enable row level security;

create policy "patches: owner reads" on public.effect_patches
  for select to authenticated using (user_id = (select auth.uid()));
create policy "patches: owner inserts" on public.effect_patches
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "patches: owner updates" on public.effect_patches
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "patches: owner deletes" on public.effect_patches
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.effect_patches_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and (select count(*) from public.effect_patches where user_id = new.user_id) >= 100 then
    raise exception 'Patch limit reached (100). Delete a patch to save a new one.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists effect_patches_guard on public.effect_patches;
create trigger effect_patches_guard before insert or update on public.effect_patches
  for each row execute function public.effect_patches_guard();

-- ─── Guest → account merge ───
-- Before a guest leaves for Google/Facebook, they mint a one-time token while still signed in as the guest.
-- After signing in, the real account redeems it, which moves the guest's data over and deletes the guest.

create table if not exists public.guest_merge_tokens (
  token_hash text primary key,
  guest_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '1 hour'
);

alter table public.guest_merge_tokens enable row level security;
-- No policies: only the security-definer functions below touch this table.

create or replace function public.create_guest_merge_token()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_uid is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Only guest sessions can create a merge token';
  end if;
  delete from public.guest_merge_tokens where guest_id = v_uid or expires_at < now();
  insert into public.guest_merge_tokens (token_hash, guest_id)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_uid);
  return v_token;
end $$;

create or replace function public.claim_guest_data(p_token text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_guest uuid;
  v_moved integer := 0;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in with Google or Facebook before merging a guest account';
  end if;

  delete from public.guest_merge_tokens
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now()
    returning guest_id into v_guest;

  if v_guest is null or v_guest = v_uid then
    return 0;
  end if;
  if not exists (select 1 from auth.users where id = v_guest and is_anonymous) then
    return 0;
  end if;

  -- Respect the per-user cap: keep the guest's newest patches that still fit
  with room as (
    select greatest(0, 100 - (select count(*) from public.effect_patches where user_id = v_uid)) as n
  ), keep as (
    select id from public.effect_patches where user_id = v_guest
    order by updated_at desc limit (select n from room)
  )
  update public.effect_patches p set user_id = v_uid
    from keep where p.id = keep.id;
  get diagnostics v_moved = row_count;

  delete from auth.users where id = v_guest;
  return v_moved;
end $$;

-- ─── Self-service account deletion (required by Facebook Login's data-deletion policy) ───

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.create_guest_merge_token() from public, anon;
revoke all on function public.claim_guest_data(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.create_guest_merge_token() to authenticated;
grant execute on function public.claim_guest_data(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ─── Guest TTL: guest accounts (and their patches, via cascade) live for 30 days ───

select cron.schedule(
  'fretwiki-expire-guests',
  '17 3 * * *',
  $$
    delete from auth.users where is_anonymous and created_at < now() - interval '30 days';
    delete from public.guest_merge_tokens where expires_at < now();
  $$
);
