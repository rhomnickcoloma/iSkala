# FretWiki Accounts (Supabase)

Every tool stays public. Accounts only exist so people can **save things**. Today that means effects patches; scale bookmarks are a natural next step (see the end of this guide).

## How it works

| Visitor | What happens |
| --- | --- |
| Just browsing | Nothing. No account and no network calls to Supabase. |
| Saves their first patch | A Supabase **anonymous user** (guest) is created silently. Patches are stored against that user. |
| Guest, after 30 days | A nightly `pg_cron` job deletes the guest and, through cascading deletes, all of its patches. |
| Signs in with Google or Facebook | The guest's patches are **merged** into the real account and the guest is deleted. |
| Signed in | Patches sync across devices. They can sign out or delete the account from the avatar menu. |

### Merging a guest into a real account

1. While still a guest, the browser calls `create_guest_merge_token()`. Postgres returns a random 256-bit token and stores only its SHA-256 hash, valid for 1 hour.
2. The token is kept in `localStorage`, and the user is sent to Google or Facebook with `signInWithOAuth`.
3. Back on `/auth/callback`, the code is exchanged for a session (PKCE). The page then calls `claim_guest_data(token)` as the real user.
4. That function moves the guest's patches to the real account, staying under the 100-patch cap, and deletes the guest.

This one path handles both brand-new sign-ups and returning users who already have an account, so Supabase's "manual identity linking" setting isn't needed. A token works only once, only for a real (non-guest) account, and only before it expires.

### Files

- `supabase/migrations/20261016000000_accounts_and_patches.sql`: tables, row-level security, merge and account-deletion functions, and the TTL cron job
- `app/lib/supabase.ts`: browser client. Accounts switch off automatically when the env vars are missing.
- `app/context/AuthContext.tsx`: session state, guest creation, sign-in with merge, sign-out, delete account, and the sign-in dialog
- `app/auth/callback/page.tsx`: completes the OAuth redirect and redeems the merge token
- `app/components/AccountButton.tsx`: Sign in button or avatar menu, shown in the main header and the effects header
- `app/components/EffectsPatches.tsx` + `app/lib/patches.ts`: patch UI, with a Supabase store and a localStorage fallback

## Setup checklist

### 1. Create the Supabase project
1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to your users (e.g. Singapore).
2. **SQL Editor:** paste and run `supabase/migrations/20261016000000_accounts_and_patches.sql`.
   - If `create extension pg_cron` fails, enable **pg_cron** under Database → Extensions, then run it again.
3. **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins**.
4. **Authentication → URL Configuration:**
   - Site URL: `https://fretwiki.com`
   - Redirect URLs: `https://fretwiki.com/auth/callback`, `http://localhost:3000/auth/callback`, and for Vercel previews `https://*-<your-team>.vercel.app/auth/callback`

### 2. Google (Gmail) sign-in
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials): create an **OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. On the OAuth consent screen, set the app name to FretWiki, add the logo, and add `https://fretwiki.com/terms#privacy` as the privacy policy. Then publish the app.
4. Paste the Client ID and Secret into Supabase → Authentication → Providers → Google.

### 3. Facebook sign-in
1. [developers.facebook.com](https://developers.facebook.com/apps): create an app (use case: *Authenticate and request data from users with Facebook Login*).
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
3. App Settings → Basic:
   - Privacy Policy URL: `https://fretwiki.com/terms#privacy`
   - User data deletion → Instructions URL: `https://fretwiki.com/terms#data-deletion`
4. Make sure the `email` and `public_profile` permissions are enabled. Neither needs App Review.
5. Switch the app to **Live**.
6. Paste the App ID and Secret into Supabase → Authentication → Providers → Facebook.

### 4. Environment variables
Add these in Vercel (Production + Preview) and in `.env.local` for local development:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

The anon key is safe to expose; row-level security protects the data. **Never** put the `service_role` key in the app. Redeploy after adding the variables, and the Sign in button appears.

### 5. Recommended hardening
- **Abuse protection:** guest sign-ups are rate-limited to 30/hour per IP by default (Authentication → Rate Limits). If bots become a problem, enable Cloudflare Turnstile CAPTCHA. That also needs a small client change to pass `captchaToken` into `signInAnonymously` and `signInWithOAuth`.
- **Database size:** each patch is capped at 64 KB and each user at 100 patches, enforced in Postgres.

## Using accounts for scale patterns

The same guest-then-merge model works for the fretboard. Each idea below is a small table with the same row-level security policies as `effect_patches`, plus one extra `update … set user_id` line inside `claim_guest_data`.

1. **Favourite scales.** Star a key + scale + instrument (e.g. "A Dorian on 6-string guitar") and jump back to it from a "My Scales" list. The app already encodes this in the URL (`?key=A&scale=dorian`), so a favourite is just `{instrument, key, scale}`.
2. **Saved practice views.** Also store the pattern (CAGED shape, 3NPS position, diagonal), crop-fret range, and note-label mode, so "the exact view I practise from" is one click away on any device.
3. **Practice log and tempo progress.** Record which scale/pattern was practised, for how long, and at what metronome BPM. Show streaks and a "you went from 80 to 120 BPM on E minor pentatonic" chart.
4. **Backing-track progressions.** Save chord progressions and sections from the Backing Track page, and pair them with a scale ("jam over this in A minor").
5. **Custom tunings.** Save tunings like DADGAD or Drop C and have the fretboard, tuner and patterns follow them.
6. **Lessons (paid tier later).** Account-linked progress through structured lessons, while the tools themselves stay free.

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
- Custom IR (`.wav`) and `.nam` files stay on the device. A patch remembers which ones it used, but loading it on another device falls back until the file is re-loaded there. Supabase Storage could sync them later; budget for large `.nam` files.
- If the merge request fails (e.g. a network drop right after sign-in), the token stays in the browser and the merge is retried on the next visit within the hour the token is valid. After that, the guest data expires with the guest account.
