# Big Three Trainer — notes for Claude Code

React + Vite app with two Vercel serverless functions (`api/speech-token.js`, `api/grade.js`) and a Supabase database. See README.md for what the app does.

## Rules

- The user runs this on **Windows** (PowerShell, VS Code terminal). Use commands that work there; prefer `npx …` and the Node scripts in `scripts/`.
- **Never print, echo, log or commit secret values** (Azure key, Supabase keys, grader key). `.env.local` is git-ignored; keep it that way.
- Never edit or reorder existing items in `src/content/` (IDs are stored in the user's log). Append only.
- Run `npm test` and `npm run build` before any deploy. Do not deploy if either fails.
- Ask the user before any step that needs their browser or a dashboard login; don't guess credentials.

## Deploy runbook (Vercel, from the local terminal)

Work through these in order and report progress after each step.

1. **Tooling check**: `node -v` (needs 18+), `npm -v`, `npx vercel --version`. If `npx vercel whoami` fails, ask the user to run `npx vercel login` themselves (it opens a browser) and wait.
2. **Install and verify**: `npm ci` (or `npm install` if there is no lockfile), then `npm test`, then `npm run build`.
3. **Environment file**: if `.env.local` doesn't exist, copy `.env.example` to `.env.local` and ask the user to fill it in (don't fill secrets yourself). They need:
   - Supabase → Project Settings → API: Project URL and `anon` public key → `VITE_SUPABASE_URL` = `SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` = `SUPABASE_ANON_KEY`.
   - Azure Speech key and region, the same resource as FrenchFry (Vercel → frenchfries project → Settings → Environment Variables, or Azure Portal → the Speech resource → Keys and Endpoint) → `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`.
   - `ALLOWED_EMAIL` = the email they will sign in with.
   - Optional AI rater: `GRADER_API_KEY` (+ `GRADER_PROVIDER=anthropic` or `groq`).
   Then validate without changing anything: `node scripts/set-vercel-env.mjs --check`.
4. **Database**: ask the user to open Supabase → SQL Editor, paste the whole of `supabase/schema.sql` and run it (safe to re-run). If they instead give you a Postgres connection string and `psql` is installed, you may run `psql "<url>" -f supabase/schema.sql` (don't print the URL).
5. **Link the Vercel project**: `npx vercel link` → create a new project named `big-three-trainer` (framework Vite, build `vite build`, output `dist`; the defaults are right). This step is interactive: let the user answer the prompts if needed.
6. **Push the variables**: `node scripts/set-vercel-env.mjs` (sets production and preview; values go through stdin and are never shown). Confirm with `npx vercel env ls` (names only).
7. **Deploy**: `npx vercel --prod`. Note the production URL it prints.
8. **Supabase auth redirect**: ask the user to set Supabase → Authentication → URL Configuration → Site URL = the production URL, and add `<production URL>/**` to Redirect URLs. Without this, the email sign-in link goes to localhost.
9. **Smoke test** (no secrets involved):
   - `curl -s -o NUL -w "%{http_code}" -X POST <url>/api/speech-token` → expect **401** (signed-out request refused). A 500 means Azure variables are missing; 404 means the functions didn't deploy.
   - Open `<url>` in Chrome or Edge, sign in with the email link, then Settings → **Test my microphone**: the engine chip should say **Azure Speech**.
10. **Lock it down** (optional): Supabase → Authentication → Providers → Email → turn off new sign-ups after the first sign-in.
11. Report the production URL and anything that failed.

## Local development

- `npm run dev`: local mode (browser storage, browser speech), no secrets needed.
- `npx vercel env pull .env.local` then `npx vercel dev`: full mode with the API functions locally.

## Troubleshooting

- Sign-in link opens localhost → step 8 not done.
- "Speech token request failed (401)" in the app → session expired: sign out and in. (403) → `ALLOWED_EMAIL` doesn't match the signed-in email.
- "(502) Azure token request failed" → wrong `AZURE_SPEECH_KEY` or `AZURE_SPEECH_REGION`.
- Microphone blocked → Chrome address bar → site settings → Microphone → Allow.
