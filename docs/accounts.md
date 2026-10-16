# FretWiki Accounts (Supabase)

Every tool stays public. Accounts only exist so people can keep their saves on any device. Today that means effects patches; scale bookmarks are a natural next step (see the end of this guide).

## How it works

| Visitor | What happens |
| --- | --- |
| Signed out | Patches save to the browser's `localStorage`. Nothing is sent to Supabase, and the Supabase library isn't even downloaded. |
| Signs in with Google or Facebook | Back on `/auth/callback`, the browser's patches are uploaded with `import_patches()`, keeping the newest that fit under the 100-patch cap. The browser copy is cleared only after the server confirms. |
| Signed in | Patches are saved to and loaded from the account, on any device. The avatar menu has Sign out and Delete account. |
| Signs out | The panel shows this browser's patches again, which will be empty after an import. |

If an upload fails (e.g. the network drops right after sign-in), the browser copy stays and the upload is retried on the next visit.

### Files

- `supabase/migrations/20261016000000_accounts_and_patches.sql`: patches table, row-level security, 100-patch cap, `import_patches`, and `delete_my_account`. Safe to re-run.
- `scripts/setup-supabase.mjs` (`yarn setup:supabase`): creates and configures the project through the Management API
- `app/lib/supabase.ts`: browser client, loaded on demand. Accounts switch off automatically when the env vars are missing.
- `app/context/AuthContext.tsx`: session state, sign-in, sign-out, delete account, browser-patch import, and the sign-in dialog
- `app/auth/callback/page.tsx`: completes the OAuth redirect (PKCE)
- `app/components/AccountButton.tsx`: Sign in button or avatar menu (main header and effects header)
- `app/components/EffectsPatches.tsx` + `app/lib/patches.ts`: patch UI, with Supabase and localStorage stores

## Setup

### 1. Project, database and auth URLs (scripted)
Put a **personal access token** from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) in `.env` as `SUPABASE_ACCESS_TOKEN`, then run:

```
yarn setup:supabase
```

The script:
1. Creates a project called **FretWiki** in Singapore, or reuses one if it already exists or if `SUPABASE_PROJECT_REF` is set, and saves the database password to `.env`.
2. Runs the migration.
3. Sets the Site URL and redirect URLs (fretwiki.com, www, localhost:3000, Vercel previews) and keeps anonymous sign-ins off.
4. Writes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
5. Prints the OAuth redirect URI to give Google and Facebook.

If you add `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` to `.env` and run it again, it turns those providers on too.

### 2. Google (Gmail) sign-in
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials): create an **OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (printed by the script).
3. On the OAuth consent screen, set the app name to FretWiki, add the logo, and add `https://fretwiki.com/terms#privacy` as the privacy policy. Then publish the app.
4. Put the Client ID and Secret in `.env` and run `yarn setup:supabase` again.

### 3. Facebook sign-in
1. [developers.facebook.com](https://developers.facebook.com/apps): create an app (use case: *Authenticate and request data from users with Facebook Login*).
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
3. App Settings → Basic:
   - Privacy Policy URL: `https://fretwiki.com/terms#privacy`
   - User data deletion → Instructions URL: `https://fretwiki.com/terms#data-deletion`
4. Make sure the `email` and `public_profile` permissions are enabled (neither needs App Review), then switch the app to **Live**.
5. Put the App ID and Secret in `.env` and run `yarn setup:supabase` again.

### 4. Vercel
Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (values from `.env.local`) to the Vercel project for Production and Preview, then redeploy. The Sign in button appears once they're set.

The anon key is safe to expose; row-level security protects the data. Never put the `service_role` key or the access token in the app.

## Using accounts for scale patterns

Each idea below is a small table with the same row-level security policies as `effect_patches`. The browser-then-import model carries over unchanged.

1. **Favourite scales.** Star a key + scale + instrument (e.g. "A Dorian on 6-string guitar") and jump back to it from a "My Scales" list. The URL already encodes this (`?key=A&scale=dorian`).
2. **Saved practice views.** Also store the pattern (CAGED shape, 3NPS position, diagonal), crop-fret range, and note-label mode.
3. **Practice log and tempo progress.** Record which scale/pattern was practised, for how long, and at what metronome BPM. Show streaks and BPM-over-time charts.
4. **Backing-track progressions.** Save chord progressions and sections, paired with a scale to jam in.
5. **Custom tunings.** Save tunings like DADGAD or Drop C and have the fretboard, tuner and patterns follow them.
6. **Lessons (paid tier later).** Account-linked progress through structured lessons, while the tools stay free.

Suggested first table:

```sql
create table public.saved_scales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  instrument text not null, key text not null, scale text not null,
  view jsonb not null default '{}',   -- pattern, position, fret range, labels
  label text, created_at timestamptz not null default now()
);
```

## Known limitations
- Custom IR (`.wav`) and `.nam` files stay on the device. A patch remembers which ones it used, but on another device they need re-loading. Supabase Storage could sync them later.
- Browser patches are imported into whichever account signs in next on that browser. That's expected on a personal device but worth knowing on a shared one.
