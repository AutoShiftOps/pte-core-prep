# Big Three Trainer: product notes and backlog

Kept by Claude as Sajja reports bugs, confusion and ideas during PTE Core prep (Oct 17 to Nov 21, 2026). Goal after the exam: open it to the public (free + paid) under a non-Pearson brand, e.g. almostbecome.com.

Live copy: the "PTE Core" Claude project (`claude/product-backlog.md`). This repo copy is synced when code changes ship.

Status: **Fixed** (shipped) · **Open** (to do) · **Idea** (product thinking)

## Bugs and friction found while using it

| Date | Area | What happened | Status |
|---|---|---|---|
| Oct 23 | Timing | Only speaking was exam-timed; writing, reading, listening could run over | Fixed: exam timing with auto-submit, learning mode in Settings |
| Oct 23 | AI rater | Groq retired the default model, so every grade failed with 404 | Fixed: openai/gpt-oss-120b; error names the model. Open: alert when a provider retires a model |
| Oct 23 | AI rater | No way to re-grade after a failure | Fixed: Grade with AI / Grade again buttons |
| Oct 23 | Writing | Submitted answer locked; no way to learn by rewriting | Fixed: Edit and resubmit (untimed, first answer stays scored) |
| Oct 23 | AI rater | "Improved version" ignored the booklet template and invented facts | Fixed: template validation + one correction round |
| Oct 23 | AI rater | Scored form 0/2 for an 85-word email (models can't count) | Fixed: form and spelling computed from Pearson's published bands |
| Oct 23 | AI rater | Content 0/2 for a summary that covered every main point | Fixed: reference summary + main-aspects rule + floor when all key points found |
| Oct 23 | Writing | Checklist said 50 words, rater said 49 (hyphens counted differently) | Fixed: one count everywhere, hyphenated = 2 (safe side) |
| Oct 23 | Deploy | Open tab after a deploy failed to load the speech engine | Fixed: auto-reload once on stale build |
| Oct 23 | Coach report | Morning routine needs yesterday's report, but the app opens on today (empty) | Fixed (Oct 25): "Start here: your last coach report" card on the Today tab |
| Oct 23 | Coach report | Spelling sprint and word workout results are not saved | Open: log them as practice so progress shows |
| Oct 23 | Content | Stored model answers use a different style from the booklet templates | Fixed (Oct 25): 30 template-style model answers (src/content/templateModels.js), tested for length, key points and template |
| Oct 23 | Speaking | Free retakes of Repeat Sentence / Read Aloud hide that only the first try counts | Fixed (Oct 25): first-try note on Repeat Sentence and Read Aloud; retakes flagged as practice only |
| Oct 23 | Focus drill | Drill attempts are filed under the day on screen, not today | Fixed (Oct 25): focus drills log under today |
| Oct 23 | Reorder Paragraph | Tip was too thin: user lost marks on opener, pronoun and the two meanings of "once" | Fixed: 6-test checklist + "name the link" drill in the drill tip, Coach report tip and booklet |
| Oct 24 | Trends | Weekly scorecard showed the same task as biggest win AND biggest leak (Read Aloud 100%) early in a week | Fixed: leak = weakest task still below target, never the win; "None: every task at target" otherwise |
| Oct 25 | Answer Short Question | Azure got the expected answer as a script and biased recognition towards it: "hear" came back as "hearing", "architic" as "Antarctica", so wrong answers were marked correct | Fixed: free (unscripted) recognition; near-miss note for the wrong word form. Watch: Repeat Sentence / Read Aloud stay scripted (needed for pronunciation scores); Day 7 logs show omissions are still caught |
| Oct 25 | AI rater (speaking) | Describe Image feedback "corrected" the transcript: "two thousand eighteen → 2018 (numeric format)", "Rosen → risen (spelling)", hyphens | Fixed: speaking rater told it reads a speech transcript; formatting-only corrections filtered out; misheard words reported as pronunciation |
| Oct 28 | Describe Image | Checker marked "names both groups" and "highest point" wrong because speech gives "in store" and "two thousand eighteen" while labels say "In-store" and "2018"; 39 s was shown as fine though the conclusion was cut off | Fixed: spoken-form matching (number words, spoken years, hyphens); timing check flags over 38 s; 7-line template + axis rule in the drill tip |
| Oct 28 | Summarize Written Text | App treated more than one sentence as a fatal error (an Academic rule); PTE Core's Score Guide only requires 25–50 words | Fixed: one sentence is now advice, not a rule; scoring follows the Core form band |

## Feature ideas

| Date | Idea | Why |
|---|---|---|
| Oct 23 | Grammar gym generated from the user's own logged errors | **Shipped Oct 25:** 98-question bank on the 10 master-sheet rules + questions built from own dictation errors, missed word pairs and AI-rater corrections; wrong answers return; 15 a day in the plan |
| Oct 23 | Printable master sheet with the user's own mistakes in it | Built manually today; could be generated per user |
| Oct 23 | Progress certificate / case-study export | Evidence for marketing and for users' own motivation |

## Product thinking (after Nov 21)

- **Hook:** personal coach report built from the user's own mistakes, not just scores. Paid tier = coaching (reviews, word pairs, template-matched AI rater, daily report). Free tier = practice items.
- **Unit costs:** Azure Speech (pronunciation assessment) and the AI rater cost per user; price paid plans to cover audio minutes and grading calls.
- **Brand:** keep "PTE" out of the product name and logo (Pearson trademark); describe it as practice for PTE Core; all content original. Get legal advice before launch.
- **Proof:** Sajja's own journey (below) is the launch case study.

## Evidence log for marketing

Baseline: 4 CELPIP attempts, latest L9 R7 W7 S8 (CLB 8 overall, inconsistent under pressure). Target: CLB 10 in all four on PTE Core, Nov 21, 2026.

| Date | Day | Milestone |
|---|---|---|
| Oct 23 | 7 | Dictation 72% → 84% the same day after switching to type-while-listening |
| Oct 23 | 7 | Write Email 9/15 → 13/15 in one session using the booklet template |
| Oct 23 | 7 | Repeat Sentence 93.5% words, every start under 1 s; Read Aloud 100% words, pronunciation 92 |
| Oct 23 | 7 | R&W Fill in the Blanks 95%, Reading Fill in the Blanks 97%, all well inside exam pace |

Where the raw evidence lives: Supabase tables `attempts` (every answer, timestamped by the server), `daily_summaries` (coach report per day), `weekly_scorecards`, and the `daily_scorecard` view. Export: app Settings → Download my log (JSON), weekly.
