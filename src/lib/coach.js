// Turns a day's logged attempts into a coach report: what you missed, why, and
// exactly what to practise next. Rule-based so it is consistent day to day.
import { compare, categorize, FUNCTION_WORDS, cleanWord } from './score.js';
import { addDays, dayRange, PLAN_START, diffDays } from './plan.js';
import { TASKS, TASK_KEYS } from './tasks.js';

// Practice targets I set for a CLB 10 trajectory. They are not official PTE conversions.
export const TARGETS = {
  wfd: 95,          // dictation words correct, %
  rsContent: 90,    // repeat sentence words said, %
  rsFast: 90,       // % of repeats started within 1 s
  rsFluency: 85,    // Azure fluency (0-100)
  raContent: 90,    // read aloud words said, %
  raAccuracy: 85,   // Azure pronunciation accuracy (0-100)
  raFluency: 85,    // Azure fluency (0-100)
  wpmLow: 120, wpmHigh: 165,
  raPauses: 1,      // pauses of 1 s or longer per passage
};

export const CAT = {
  spelling: { label: 'Spelling', tip: 'You heard the word but spelt it wrong. After typing, scan every long word letter by letter. The spelling sprint below drills exactly these words.' },
  ending_s: { label: 'Plural and -s endings', tip: 'The final -s is quiet in fast speech. Ask of every noun: one or many? Check the verb agrees too ("data suggests", "students must").' },
  ending_ed: { label: 'Past tense -ed', tip: 'Past -ed often sounds like a soft /t/ or /d/. If the sentence is about the past (was, last year, after), the verb needs -ed.' },
  ending_ing: { label: '-ing endings', tip: 'Listen for "-in" at the end of verbs. After "is/are/was" or "by/for/before", the verb usually takes -ing.' },
  article: { label: 'a / an / the', tip: 'Articles are unstressed and easy to lose. Rebuild them with grammar: a singular countable noun almost always needs a, an or the.' },
  preposition: { label: 'Prepositions', tip: 'Learn prepositions in chunks, not alone: "at the end of", "in the morning", "on Monday", "access to", "focus on".' },
  auxiliary: { label: 'Helping verbs (has, been, will…)', tip: 'Helping verbs shrink in fast speech ("has been" sounds like "zbin"). Check the tense: "has ___ed", "will be ___ed", "have been".' },
  content: { label: 'Whole words missed', tip: 'The sentence was too long to hold. While it plays, jot the first letter of every word ("t s m b c"), then rebuild from the letters.' },
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

/** First non-focus attempt per item: the honest first try counts. */
export function firstAttempts(attempts, day, task) {
  const m = new Map();
  for (const a of attempts) if (a.day === day && a.task === task && !a.focus && !m.has(a.item_id)) m.set(a.item_id, a);
  return [...m.values()];
}

function wfdSection(attempts, day, bank) {
  const list = firstAttempts(attempts, day, 'wfd');
  let score = 0, total = 0, missedSentences = 0;
  const cats = {};
  const practice = new Map();
  for (const a of list) {
    const target = bank[a.item_id];
    if (!target) continue;
    const r = compare(target, a.response);
    score += r.score; total += r.total;
    if (r.score < r.total) missedSentences++;
    for (const o of r.out) {
      if (o.status === 'ok' || !o.c) continue;
      const cat = categorize(o);
      cats[cat] = cats[cat] || { count: 0, examples: [] };
      cats[cat].count++;
      if (cats[cat].examples.length < 3) cats[cat].examples.push({ target, word: cleanWord(o.w), typed: o.typed ? cleanWord(o.typed) : '' });
      if (['spelling', 'ending_s', 'ending_ed', 'ending_ing'].includes(cat) || (cat === 'content' && o.c.length >= 6)) practice.set(o.c, cleanWord(o.w));
    }
  }
  const categories = Object.entries(cats)
    .map(([key, v]) => ({ key, ...CAT[key], ...v }))
    .sort((a, b) => b.count - a.count);
  return { done: list.length, score, total, accuracy: pct(score, total), categories, practiceWords: [...practice.values()], missedSentences };
}

function rsSection(attempts, day, bank) {
  const list = firstAttempts(attempts, day, 'rs');
  const ratios = [], fast = [], fluency = [], weak = [];
  let micClosed = 0, hes = 0, hesN = 0;
  for (const a of list) {
    const m = a.meta || {};
    const ratio = a.total ? a.score / a.total : 0;
    ratios.push(ratio * 100);
    if (m.micClosed) micClosed++;
    if (!m.selfRated) {
      fast.push(!m.micClosed && m.latencyMs != null && m.latencyMs <= 1000);
      hes += (m.pauses || []).length; hesN++;
    }
    if (m.scores?.fluency != null) fluency.push(m.scores.fluency);
    if (ratio < 0.8 || m.micClosed) weak.push({ id: a.item_id, target: bank[a.item_id], heard: a.response, ratio, latencyMs: m.latencyMs, micClosed: !!m.micClosed });
  }
  return {
    done: list.length,
    contentAvg: avg(ratios),
    fastPct: pct(fast.filter(Boolean).length, fast.length),
    fluencyAvg: avg(fluency),
    micClosed,
    hesitationsAvg: hesN ? +(hes / hesN).toFixed(1) : null,
    weak: weak.sort((a, b) => a.ratio - b.ratio),
  };
}

function raSection(attempts, day, bank) {
  const list = firstAttempts(attempts, day, 'ra');
  const ratios = [], wpms = [], pauseCounts = [], acc = [], flu = [], pros = [];
  const words = new Map();
  let longest = 0, weakest = null;
  for (const a of list) {
    const m = a.meta || {};
    const ratio = a.total ? a.score / a.total : 0;
    ratios.push(ratio * 100);
    if (m.wpm) wpms.push(m.wpm);
    const longP = (m.pauses || []).filter((p) => p >= 1000);
    pauseCounts.push(longP.length);
    longest = Math.max(longest, ...longP, 0);
    if (m.scores) { acc.push(m.scores.accuracy); flu.push(m.scores.fluency); pros.push(m.scores.prosody); }
    for (const w of m.mispronounced || []) if (!words.has(w.word.toLowerCase())) words.set(w.word.toLowerCase(), w.word);
    const target = bank[a.item_id];
    if (target) for (const o of compare(target, a.response).out) {
      if (o.status !== 'ok' && o.c && !FUNCTION_WORDS.has(o.c) && o.c.length >= 4 && !words.has(o.c)) words.set(o.c, cleanWord(o.w));
    }
    if (!weakest || ratio < weakest.ratio) weakest = { id: a.item_id, ratio };
  }
  return {
    done: list.length,
    contentAvg: avg(ratios),
    wpmAvg: avg(wpms),
    pausesAvg: pauseCounts.length ? +(pauseCounts.reduce((a, b) => a + b, 0) / pauseCounts.length).toFixed(1) : null,
    longestPause: longest,
    accuracyAvg: avg(acc), fluencyAvg: avg(flu), prosodyAvg: avg(pros),
    words: [...words.values()].slice(0, 15),
    weakestId: weakest?.id || null,
  };
}

function focusFor(wfd, rs, ra) {
  const gaps = [];
  const gap = (key, value, target, label) => { if (value != null && value < target) gaps.push({ key, label, value, target, size: (target - value) / target }); };
  gap('wfd', wfd.accuracy, TARGETS.wfd, 'Dictation accuracy');
  gap('rsFast', rs.fastPct, TARGETS.rsFast, 'Fast starts in Repeat Sentence');
  gap('rsContent', rs.contentAvg, TARGETS.rsContent, 'Words repeated');
  gap('rsFluency', rs.fluencyAvg, TARGETS.rsFluency, 'Repeat Sentence fluency');
  gap('raContent', ra.contentAvg, TARGETS.raContent, 'Read Aloud words said');
  gap('raAccuracy', ra.accuracyAvg, TARGETS.raAccuracy, 'Pronunciation accuracy');
  gap('raFluency', ra.fluencyAvg, TARGETS.raFluency, 'Read Aloud fluency');
  if (ra.wpmAvg != null && (ra.wpmAvg < TARGETS.wpmLow || ra.wpmAvg > TARGETS.wpmHigh)) {
    const t = ra.wpmAvg < TARGETS.wpmLow ? TARGETS.wpmLow : TARGETS.wpmHigh;
    gaps.push({ key: 'raPace', label: 'Reading pace', value: ra.wpmAvg, target: t, size: Math.abs(t - ra.wpmAvg) / t });
  }
  if (ra.pausesAvg != null && ra.pausesAvg > TARGETS.raPauses) gaps.push({ key: 'raPauses', label: 'Long pauses per passage', value: ra.pausesAvg, target: TARGETS.raPauses, size: (ra.pausesAvg - TARGETS.raPauses) / 4 });
  gaps.sort((a, b) => b.size - a.size);
  const top = gaps[0];
  const topCat = wfd.categories[0];
  const ACTIONS = {
    wfd: () => [
      topCat ? `Your biggest dictation leak was ${topCat.label.toLowerCase()} (${topCat.count}). ${topCat.tip}` : 'Re-type each missed sentence from memory, then check it.',
      `Run the ${topCat ? topCat.label.toLowerCase() : 'focus'} drill below: 5 extra sentences chosen for that weakness.`,
      wfd.practiceWords.length ? `Spelling sprint: ${wfd.practiceWords.slice(0, 6).join(', ')}.` : 'Tomorrow starts with your missed sentences as reviews.',
    ],
    rsFast: () => [
      'Start speaking within 1 second of the beep, even if you only remember the first word. Silence for 3 seconds closes the mic and scores zero.',
      'Re-run your weak sentences below and say the first two words immediately.',
      'Shadow one Rachel\'s English clip for 10 minutes before tomorrow\'s session.',
    ],
    rsContent: () => [
      'Listen in chunks of 3 to 4 words ("The library / will be closed / for maintenance"). Repeat chunk by chunk with the same rhythm.',
      'Re-run the weak sentences below until each scores 90% or more.',
      'If you lose words, keep the rhythm and finish the sentence; never stop mid-way.',
    ],
    rsFluency: () => [
      'Fluency drops when you pause between words. Keep a steady rhythm and link words ("want‿to", "part‿of").',
      'Re-run the weak sentences below without stopping, even if a word is wrong.',
      'Shadow each sentence 3 times at the speaker\'s speed.',
    ],
    raContent: () => [
      'You skipped or changed words. Use the 35 seconds of prep to read the passage silently and mark the hard words.',
      'Re-read your weakest passage below.',
      ra.words.length ? `Word workout: ${ra.words.slice(0, 6).join(', ')}.` : 'Read one extra passage slowly, then at normal pace.',
    ],
    raAccuracy: () => [
      ra.words.length ? `Pronunciation slipped on: ${ra.words.slice(0, 6).join(', ')}. Use the word workout below: hear, say, check.` : 'Use the word workout below.',
      'Say long words slowly in syllables first (con-sol-i-date), then at normal speed.',
      'Re-read your weakest passage below.',
    ],
    raFluency: () => [
      'Read at an even pace, phrase by phrase. Pause only at commas and full stops.',
      'Never go back to repeat a word. A small error costs less than a restart.',
      'Re-read your weakest passage below.',
    ],
    raPace: () => ra.wpmAvg < TARGETS.wpmLow
      ? ['You read too slowly. Aim for a news-reader pace: about 2.5 words per second.', 'Re-read your weakest passage below and finish with 10 seconds to spare.', 'Shadow a model reading once before your own attempt.']
      : ['You rushed. Slow down slightly and give each key word its stress.', 'Pause briefly at commas, a little longer at full stops.', 'Re-read your weakest passage below.'],
    raPauses: () => [
      `You paused for 1 second or more about ${ra.pausesAvg} times per passage. The longest was ${(ra.longestPause / 1000).toFixed(1)} s.`,
      'Turn on pause marks and only pause where they appear.',
      'Re-read your weakest passage below without stopping.',
    ],
  };
  if (!top) {
    const any = wfd.done + rs.done + ra.done;
    return any
      ? { headline: 'All practice targets met today.', actions: ['Keep the streak tomorrow. Your set will include recycled and harder items.', 'Spend 10 minutes on the booklet\'s writing templates instead.'] }
      : { headline: 'Nothing logged yet for this day.', actions: ['Start with Write From Dictation in Practice.'] };
  }
  return { key: top.key, headline: `Focus next: ${top.label} (${top.value}${top.key === 'raPace' ? ' wpm' : top.key === 'raPauses' ? '' : '%'} vs target ${top.target}${top.key === 'raPace' ? ' wpm' : top.key === 'raPauses' ? '' : '%'})`, actions: ACTIONS[top.key]() };
}

export function buildDayReport(day, attempts, banks) {
  const wfd = wfdSection(attempts, day, banks.wfd);
  const rs = rsSection(attempts, day, banks.rs);
  const ra = raSection(attempts, day, banks.ra);
  const others = TASK_KEYS.filter((k) => !['wfd', 'rs', 'ra'].includes(k)).map((k) => taskDay(attempts, day, k)).filter((t) => t.done > 0);
  const extra = attempts.filter((a) => a.day === day && a.focus).length;
  let focus = focusFor(wfd, rs, ra);
  const worst = others.filter((t) => t.done >= 2 && t.pct != null && t.pct < 75).sort((a, b) => a.pct - b.pct)[0];
  if (worst && (!focus.key || worst.pct < 60)) {
    focus = { key: worst.task, headline: `Focus next: ${TASKS[worst.task].label} (${worst.pct}% today)`, actions: [
      `Redo your ${worst.weak.length} weak ${TASKS[worst.task].label} items from the list below.`,
      TIPS[worst.task] || 'Read the task tip at the top of the drill and follow the template exactly.',
      ...(focus.key ? [focus.headline] : []),
    ] };
  }
  const timeouts = timeoutsFor(attempts, day);
  if (timeouts.total > 0) {
    const worstT = timeouts.byTask[0];
    focus = { ...focus, actions: [...focus.actions, `The clock ran out on ${timeouts.total} item${timeouts.total > 1 ? 's' : ''} (${timeouts.byTask.map((t) => `${t.n} ${TASKS[t.task].label}`).join(', ')}). ${TIME_TIPS[worstT.task] || 'Answer first, polish second: an empty answer scores zero.'}`] };
  }
  return { day, wfd, rs, ra, others, extra, focus, timeouts, generatedAt: new Date().toISOString() };
}

/** Items auto-submitted by the exam clock on a given day (first attempts, not focus drills). */
export function timeoutsFor(attempts, day) {
  const counts = {};
  for (const a of attempts) if (a.day === day && !a.focus && a.meta?.timedOut) counts[a.task] = (counts[a.task] || 0) + 1;
  const byTask = Object.entries(counts).map(([task, n]) => ({ task, n })).sort((a, b) => b.n - a.n);
  return { total: byTask.reduce((a, t) => a + t.n, 0), byTask };
}

const TIME_TIPS = {
  wfd: 'Type during the audio: first letters of each word, then expand. Never leave it blank at 0:00.',
  lfib: 'Type the gaps while the audio plays, even half-spelt; fix the spelling in the seconds after it ends.',
  hiw: 'Click while the audio plays. After it ends you only have seconds; don\'t re-read the whole text.',
  rwfib: 'First pass: pick by the word pair next to each gap in under 10 seconds. Second pass only for the doubtful ones.',
  rfib: 'Place the words you are sure of in the first 30 seconds; the leftovers narrow the rest.',
  ro: 'Spend 20 seconds finding the opener, then link pairs. Don\'t reread every sentence each time.',
  swt: 'Write the template skeleton first (main idea + two points), then fill it. Stop editing at 1:00 left.',
  email: 'Write one paragraph per bullet in order. At 1:00 left, add the sign-off even if a paragraph is short.',
  sst: 'Start writing at once from your noun-and-number notes. Aim to finish with 2 minutes left to check.',
};

const TIPS = {
  rwfib: 'Read three words before and after each gap: most answers are fixed pairs. Your misses are in Word pairs; review them before tomorrow.',
  rfib: 'Decide the part of speech first, then meaning. Place the words you are sure of first; the leftovers narrow the hard gaps.',
  ro: 'Opener first (needs nothing before it), then the tests: pronoun right after its noun, time order (before → once → now), claim before evidence, solution last.',
  lfib: 'Read the text before the audio starts and guess each gap\'s part of speech. Check plural -s and spelling before submitting.',
  hiw: 'Keep your cursor under the word being spoken. Only click when the word clearly differs; wrong clicks cost a point.',
  sst: 'Note nouns and numbers only, then use the template. Stay within 20–30 words.',
  swt: 'One sentence, 30–45 words, joined with "and", "while", "which". Mention the main idea and two supporting points.',
  email: 'Greeting, purpose line, one paragraph per bullet, close, sign-off. 100–110 words.',
  di: 'Use the template: shows → highest → lowest → trend → overall. Say at least two numbers.',
  rts: 'Decide formal or informal in the first seconds, cover every part of the situation, and use the full 40 seconds.',
  asq: 'Answer with one word, immediately. If unsure, still say your best guess before 3 seconds.',
};

export function computeTrend(attempts, banks, from, to) {
  return dayRange(from, to).map((day) => {
    const r = buildDayReport(day, attempts, banks);
    return {
      day,
      done: r.wfd.done + r.rs.done + r.ra.done + r.others.reduce((a, t) => a + t.done, 0),
      wfd: r.wfd.accuracy, rsContent: r.rs.contentAvg, rsFast: r.rs.fastPct, rsFluency: r.rs.fluencyAvg,
      raContent: r.ra.contentAvg, raAccuracy: r.ra.accuracyAvg, raFluency: r.ra.fluencyAvg, wpm: r.ra.wpmAvg,
    };
  });
}

// Extra dictation sentences that exercise one weakness.
const FEATURE = {
  article: (t) => (t.match(/\b(a|an|the)\b/gi) || []).length >= 3,
  preposition: (t) => (t.match(/\b(in|on|at|of|to|for|from|with|by|about|into|during|before|after)\b/gi) || []).length >= 3,
  auxiliary: (t) => /\b(has|have|had|been|will|would|should|must|were)\b/i.test(t),
  ending_s: (t) => t.split(/\s+/).filter((w) => /[a-z]{3,}s\b/i.test(w) && !/(ss|us|is|was|this|has|his)\b/i.test(w)).length >= 3,
  ending_ed: (t) => /\b\w{3,}ed\b/i.test(t),
  ending_ing: (t) => /\b\w{3,}ing\b/i.test(t),
  spelling: (t) => t.split(/\s+/).filter((w) => w.replace(/[^a-z]/gi, '').length >= 9).length >= 2,
  content: (t) => t.split(/\s+/).length >= 11,
};
export function pickFocusWfd(category, items, attempts, day, n = 5) {
  const test = FEATURE[category] || FEATURE.content;
  const today = new Set(attempts.filter((a) => a.day === day && a.task === 'wfd').map((a) => a.item_id));
  const lastSeen = {};
  for (const a of attempts) if (a.task === 'wfd') lastSeen[a.item_id] = a.day;
  return items
    .filter((i) => test(i.text) && !today.has(i.id))
    .sort((a, b) => (lastSeen[a.id] || '0000').localeCompare(lastSeen[b.id] || '0000'))
    .slice(0, n)
    .map((i) => i.id);
}

export const yesterday = (day) => addDays(day, -1);

// ---------- All tasks: daily stats and the weekly scorecard ----------

export function taskDay(attempts, day, task) {
  const list = firstAttempts(attempts, day, task);
  const score = list.reduce((a, x) => a + x.score, 0), total = list.reduce((a, x) => a + x.total, 0);
  const weak = list.filter((x) => x.total && x.score / x.total < TASKS[task].threshold).map((x) => x.item_id);
  return { task, done: list.length, pct: pct(score, total), weak };
}

export const weekOf = (day) => Math.floor(diffDays(PLAN_START, day) / 7) + 1;
export const weekStart = (week) => addDays(PLAN_START, (week - 1) * 7);

const SKILL = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };

export function buildWeekScorecard(attempts, banks, week) {
  const from = weekStart(week), to = addDays(from, 6);
  const days = dayRange(from, to);
  const inWeek = attempts.filter((a) => a.day >= from && a.day <= to && !a.focus);
  const perTask = {};
  for (const k of TASK_KEYS) {
    const list = inWeek.filter((a) => a.task === k);
    const s = list.reduce((a, x) => a + x.score, 0), t = list.reduce((a, x) => a + x.total, 0);
    perTask[k] = { done: list.length, pct: pct(s, t) };
  }
  const reports = days.map((d) => buildDayReport(d, attempts, banks));
  const fullDays = reports.filter((r) => r.wfd.done >= 20 && r.rs.done >= 10 && r.ra.done >= 5).length;
  const activeDays = days.filter((d) => inWeek.some((a) => a.day === d)).length;
  const rsAll = inWeek.filter((a) => a.task === 'rs' && !a.meta?.selfRated);
  const fast = rsAll.filter((a) => !a.meta?.micClosed && a.meta?.latencyMs != null && a.meta.latencyMs <= 1000).length;
  const skills = {};
  for (const [code, name] of Object.entries(SKILL)) {
    const feeding = TASK_KEYS.filter((k) => TASKS[k].skills.includes(code) && perTask[k].pct != null);
    const w = feeding.reduce((a, k) => a + perTask[k].done, 0);
    skills[name] = w ? Math.round(feeding.reduce((a, k) => a + perTask[k].pct * perTask[k].done, 0) / w) : null;
  }
  const ranked = TASK_KEYS.filter((k) => perTask[k].done >= 3 && perTask[k].pct != null).sort((a, b) => perTask[b].pct - perTask[a].pct);
  const cats = {};
  for (const r of reports) for (const c of r.wfd.categories) cats[c.label] = (cats[c.label] || 0) + c.count;
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  return {
    week, from, to, activeDays, fullDays,
    wfdAccuracy: perTask.wfd.pct, rsFastPct: pct(fast, rsAll.length), skills, perTask,
    biggestWin: ranked.length ? `${TASKS[ranked[0]].label} ${perTask[ranked[0]].pct}%` : null,
    biggestLeak: ranked.length ? `${TASKS[ranked[ranked.length - 1]].label} ${perTask[ranked[ranked.length - 1]].pct}%${topCat ? ` · dictation: ${topCat[0].toLowerCase()} (${topCat[1]})` : ''}` : null,
    updatedAt: new Date().toISOString(),
  };
}
