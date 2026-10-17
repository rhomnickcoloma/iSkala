# FretWiki

Interactive fretboard reference for guitar, bass, and ukulele, plus **FretWiki AI**, an in-browser guitar coach.

## Run locally

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) for FretWiki scales.

Open [http://localhost:3000/ai](http://localhost:3000/ai) for FretWiki AI.

Copy `.env.example` to `.env.local` if you need optional services. The apps start without those variables.

## FretWiki AI

Listen to a guitar through the browser microphone, see estimated notes on a fretboard, enter a chord progression, and get coaching plus a short exercise. Then press **Try Again**.

- Pitch detection is **monophonic**. It does not identify polyphonic chords from the mic.
- Audio is processed **in the browser**. Raw recordings are not uploaded.
- Coaching works **without an API key** using the music-theory engine.
- Optional LLM coaching: set `OPENAI_API_KEY` in `.env.local` (server only). You can set `OPENAI_MODEL` (default `gpt-4o-mini`). Only structured analysis (notes, chords, inferred key) is sent, never audio.

### FretWiki AI tests

```bash
yarn test:theory
```

## Scripts

```bash
yarn dev          # Next.js dev server
yarn build        # Production build (required for Vercel)
yarn start        # Serve the production build
yarn lint         # ESLint
yarn test         # Playwright UI tests
yarn test:theory  # FretWiki AI music-theory unit tests
```

## Optional accounts (FretWiki effects patches)

See `.env.example` and `docs/accounts.md`. Leave Supabase empty to run without accounts.
