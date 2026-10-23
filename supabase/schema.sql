-- Big Three Trainer: run once in Supabase → SQL Editor.
-- Every row belongs to the signed-in user; Row Level Security blocks everyone else.

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,                                   -- local practice day
  task text not null,                                  -- wfd rs ra di rts asq swt email rwfib rfib ro sst lfib hiw
  item_id text not null,                               -- e.g. w017, r102, a045
  focus boolean not null default false,                -- true = extra drill from the coach report
  response text not null default '',                   -- what you typed / what was heard
  score int not null,                                  -- words correct
  total int not null,                                  -- words in the item
  meta jsonb not null default '{}'::jsonb,             -- errors, latency, pauses, Azure scores
  created_at timestamptz not null default now()
);
create index if not exists attempts_user_day on public.attempts (user_id, day);
create index if not exists attempts_user_created on public.attempts (user_id, created_at);

create table if not exists public.daily_sets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  sets jsonb not null,                                 -- { wfd: [{id, kind}], rs: [...], ra: [...] }
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.daily_summaries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  summary jsonb not null,                              -- the coach report, refreshed after every attempt
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.attempts enable row level security;
alter table public.daily_sets enable row level security;
alter table public.daily_summaries enable row level security;

drop policy if exists "own attempts" on public.attempts;
create policy "own attempts" on public.attempts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own sets" on public.daily_sets;
create policy "own sets" on public.daily_sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own summaries" on public.daily_summaries;
create policy "own summaries" on public.daily_summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Re-running on an earlier version: allow every task type.
alter table public.attempts drop constraint if exists attempts_task_check;
alter table public.attempts add constraint attempts_task_check
  check (task in ('wfd','rs','ra','di','rts','asq','swt','email','rwfib','rfib','ro','sst','lfib','hiw'));

-- Word pairs (collocations) collected automatically from missed fill-in-the-blank gaps.
create table if not exists public.collocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phrase text not null,                                -- e.g. "rely on", "pave the way"
  answer text not null default '',                     -- the word you missed
  source text not null default '',                     -- task and item, e.g. rwfib f003
  misses int not null default 1,
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phrase)
);
alter table public.collocations enable row level security;
drop policy if exists "own pairs" on public.collocations;
create policy "own pairs" on public.collocations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weekly scorecard, refreshed automatically after every attempt.
create table if not exists public.weekly_scorecards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week int not null,                                   -- plan week 1 = Oct 17–23
  starts date not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.weekly_scorecards enable row level security;
drop policy if exists "own weeks" on public.weekly_scorecards;
create policy "own weeks" on public.weekly_scorecards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Handy for asking Claude to review your week: paste this query's output.
create or replace view public.daily_scorecard as
select
  user_id, day,
  count(*) filter (where task = 'wfd' and not focus) as wfd_done,
  round(100.0 * sum(score) filter (where task = 'wfd' and not focus) / nullif(sum(total) filter (where task = 'wfd' and not focus), 0)) as wfd_accuracy,
  count(*) filter (where task = 'rs' and not focus) as rs_done,
  round(100.0 * sum(score) filter (where task = 'rs' and not focus) / nullif(sum(total) filter (where task = 'rs' and not focus), 0)) as rs_content,
  round(avg((meta -> 'scores' ->> 'fluency')::numeric) filter (where task = 'rs' and not focus)) as rs_fluency,
  count(*) filter (where task = 'ra' and not focus) as ra_done,
  round(avg((meta -> 'scores' ->> 'accuracy')::numeric) filter (where task = 'ra' and not focus)) as ra_accuracy,
  round(avg((meta ->> 'wpm')::numeric) filter (where task = 'ra' and not focus)) as ra_wpm
from public.attempts
group by user_id, day;
alter view public.daily_scorecard set (security_invoker = on);
