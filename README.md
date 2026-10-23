# Big Three Trainer

Daily PTE Core drills for every task in the Mission CLB 10 booklet. The **Today** tab loads the booklet's tasks and counts for each date. Every attempt is logged automatically to Supabase, each day gets a coach report with your real mistakes and targeted exercises, and Repeat Sentence / Read Aloud are scored with **Azure pronunciation assessment** (same Azure Speech resource as FrenchFry).

## What it does

| Area | How |
|---|---|
| Daily set | 20 dictation, 10 repeat sentence, 5 read aloud. Built when the day first opens and saved, so reloads never change it. |
| Spaced review | Anything you got wrong comes back the next day first (up to 8 / 4 / 1). |
| Dictation scoring | Word by word, in order, like PTE. Errors classified: spelling, -s, -ed, -ing, articles, prepositions, helping verbs, whole words. British and American spellings both accepted. |
| Speaking scoring | Azure: words said (completeness), pronunciation accuracy, fluency, intonation (prosody, en-US), unclear words, start time, hesitations, words per minute. The mic closes after 3 s of silence, like PTE. |
| Audio | Azure neural voices rotating British, American, Australian and Canadian accents. Browser voices if Azure is unavailable. |
| Coach report | Saved to `daily_summaries` after every attempt. Headline weakness, 3 actions, examples from your own errors, spelling sprint, focus drill, word workout with per-word pronunciation check. |
| Trends | Day-by-day table, 7-day averages, readiness signal, content remaining. |
| Exam timing | On by default (Settings). Writing: 10 / 9 / 8 min like the test. Reading pace limits that fit the 30-minute section: R&W FIB 1:45, Reading FIB 1:15, Reorder 2:00. Listening: dictation and Listening FIB 40 s, Highlight Incorrect Words 15 s after the audio ends. At 0:00 the answer submits itself and the coach report counts timeouts. Focus drills and learning mode show the clock but never submit. |

## Tasks and content (all original practice items)

| Section | Task | Items | Scoring |
|---|---|---|---|
| Speaking | Read Aloud | 75 | Azure: words, pronunciation, fluency, intonation, pace, pauses |
| Speaking | Repeat Sentence | 180 | Azure: words, start time, fluency; mic closes after 3 s silence |
| Speaking | Describe Image | 24 charts drawn in the app | Azure fluency + mentions highest, lowest, trend, numbers, conclusion |
| Speaking | Respond to a Situation | 30 | Azure fluency + key points, register, duration |
| Speaking | Answer Short Question | 80 | Accepted answers, answer within 3 s |
| Writing | Summarize Written Text | 15 | One sentence, 25–50 words, key points, model answer |
| Writing | Write Email | 20 | 80–120 words, greeting, sign-off, paragraphs, 3 bullets, register |
| Reading | R&W Fill in the Blanks | 40 | Exact; missed gaps go to Word pairs |
| Reading | Reading Fill in the Blanks | 40 | Exact; missed gaps go to Word pairs |
| Reading | Reorder Paragraph | 90 | Correct adjacent pairs, like PTE |
| Listening | Summarize Spoken Text | 15 lectures | 20–30 words, key points, model answer |
| Listening | Listening Fill in the Blanks | 75 | Exact spelling |
| Listening | Highlight Incorrect Words | 40 | +1 correct click, −1 wrong click |
| Listening | Write From Dictation | 250 | Word by word, error types |

Listening Fill in the Blanks, Highlight Incorrect Words and Reorder Paragraph are generated from the Read Aloud, R&W and Summarize Written Text passages, so they share IDs.

**Optional AI rater** for grammar and vocabulary on Summarize Written Text, Write Email, Summarize Spoken Text, Describe Image and Respond to a Situation: set `GRADER_API_KEY` (Anthropic by default, or `GRADER_PROVIDER=groq`). Without it you get the rule-based checks only.

**Word pairs** collect themselves from missed fill-in-the-blank gaps, with a quiz. **Weekly scorecard** (Trends) saves itself after every attempt: days completed, dictation accuracy, fast starts, a practice index per skill, biggest win and leak.

Not in the app: full section mocks and multiple-choice tasks. Use the official Pearson practice and your practice platform. Files in `src/content/` are **append only**: IDs are stored in your log, so never reorder or edit existing items.

## Deploy (about 15 minutes)

1. **Supabase**: create a project (or reuse one). SQL Editor → run `supabase/schema.sql`. Authentication → URL Configuration → set Site URL to your Vercel URL and add it to Redirect URLs.
2. **Push** this folder to a new GitHub repo.
3. **Vercel** → New Project → import the repo (framework: Vite). Add environment variables from `.env.example`:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` (copy from FrenchFry's Vercel settings)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same values, used by the token function)
   - `ALLOWED_EMAIL` (your email: nobody else can use your Azure quota)
   - Optional: `GRADER_API_KEY`, `GRADER_PROVIDER` (`anthropic` or `groq`; Groq defaults to `openai/gpt-oss-120b`), `GRADER_MODEL`
4. Deploy, open the site in **Chrome or Edge**, sign in with the email link, go to **Settings → Test my microphone**.
5. Optional: Supabase → Authentication → disable new sign-ups after your first sign-in.

Local run: `npm install`, then `npx vercel dev` (runs the `/api/speech-token` function too). `npm run dev` alone works in local mode with browser speech only. Tests: `npm test`.

## Honest limits

- **Azure scores are not PTE scores.** They are a consistent proxy for content, pronunciation and fluency; watch the trend. The official Pearson Scored Practice Tests remain the real measure.
- Targets in the app (dictation 95%, repeat words 90%, fast starts 90%, Azure 85) are practice targets for a CLB 10 trajectory, not official conversions.
- Azure's native-speaker models can mark an Indian accent lower even when you are perfectly clear. Compare yourself with yourself.
- **Azure F0 free quota**: 5 audio hours of recognition per month, shared with FrenchFry's resource (paused for now, so it is all yours). A full Big Three day uses about 6 minutes; heavy speaking days with Describe Image and Respond to a Situation add a few more. If you exceed it, switch the resource to S0 (about USD 1 per audio hour).
- Content sizes are modest for the reading and writing tasks (15–40 items). At the booklet's volume, R&W Fill in the Blanks repeats after about 3 sessions; use the official AI practice (200+ items) for extra volume. Dictation, Repeat Sentence and Read Aloud start repeating after about 3 weeks. That is intended: these tasks reward repetition. Append items to `src/content/` to extend.
- Recordings are kept in the browser for replay only; they are not uploaded.

## Ask Claude to review your week

Settings → **Copy log for Claude**, or run in Supabase: `select * from daily_scorecard order by day desc limit 14;`
