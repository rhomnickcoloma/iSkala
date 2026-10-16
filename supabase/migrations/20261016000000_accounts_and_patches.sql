-- FretWiki accounts: saved effect patches for signed-in users.
-- Guests keep patches in their browser; on sign-in the browser imports them with import_patches().
-- Run once in the Supabase SQL editor (or `supabase db push`).

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

drop policy if exists "patches: owner reads" on public.effect_patches;
create policy "patches: owner reads" on public.effect_patches
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "patches: owner inserts" on public.effect_patches;
create policy "patches: owner inserts" on public.effect_patches
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "patches: owner updates" on public.effect_patches;
create policy "patches: owner updates" on public.effect_patches
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "patches: owner deletes" on public.effect_patches;
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

-- ─── Import browser (guest) patches after sign-in ───
-- Runs as the caller, so row-level security still applies. Keeps the newest patches that fit under the cap.

create or replace function public.import_patches(p_patches jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_room integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if jsonb_typeof(p_patches) is distinct from 'array' then
    raise exception 'Expected an array of patches';
  end if;

  select greatest(0, 100 - count(*)) into v_room from public.effect_patches where user_id = v_uid;

  insert into public.effect_patches (user_id, name, rig)
  select v_uid, left(btrim(p ->> 'name'), 60), p -> 'rig'
  from jsonb_array_elements(p_patches) as p
  where jsonb_typeof(p -> 'rig') = 'object'
    and char_length(btrim(coalesce(p ->> 'name', ''))) > 0
  order by p ->> 'updatedAt' desc nulls last
  limit v_room;

  get diagnostics v_count = row_count;
  return v_count;
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

revoke all on function public.import_patches(jsonb) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.import_patches(jsonb) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
