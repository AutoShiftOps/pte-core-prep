import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TASKS, BANKS, BY_ID } from '../src/lib/tasks.js';
import { parseBlanks, chunkAround, LFIB, HIW, REORDER } from '../src/lib/derived.js';
import { scoreBlanks, scoreReorder, scoreHiw, judgeSwt, judgeEmail, judgeSst, judgeDi, judgeRts, judgeAsq } from '../src/lib/judge.js';
import { planFor } from '../src/lib/booklet.js';
import { buildDaySet } from '../src/lib/scheduler.js';
import { buildWeekScorecard, buildDayReport } from '../src/lib/coach.js';

test('every task has content with unique ids', () => {
  for (const k of Object.keys(TASKS)) {
    assert.ok(ITEMS[k].length >= 15, `${k} has ${ITEMS[k].length} items`);
    assert.equal(new Set(ITEMS[k].map((i) => i.id)).size, ITEMS[k].length, k);
    assert.ok(Object.keys(BANKS[k]).length === ITEMS[k].length);
  }
});

test('fill-in-the-blank passages parse, with one correct option per gap', () => {
  for (const it of ITEMS.rwfib) {
    const blanks = parseBlanks(it.text).filter((p) => typeof p !== 'string');
    assert.ok(blanks.length >= 3, it.id);
    for (const b of blanks) assert.equal(new Set(b.options).size, b.options.length, it.id + ' duplicate options');
  }
  for (const it of ITEMS.rfib) {
    const answers = parseBlanks(it.text).filter((p) => typeof p !== 'string').map((b) => b.answer);
    assert.ok(answers.length >= 3);
    for (const x of it.extras) assert.ok(!answers.includes(x), it.id + ' extra duplicates an answer');
  }
  const parts = parseBlanks(ITEMS.rwfib[10].text);
  assert.equal(chunkAround(parts, 0), 'humans rely on');
});

test('derived tasks are well formed', () => {
  assert.ok(LFIB.every((x) => x.tokens.filter((t) => typeof t !== 'string').length >= 4));
  assert.ok(HIW.every((x) => x.tokens.filter((t) => t.wrong).length >= 2));
  assert.ok(REORDER.every((x) => x.sentences.length >= 3 && x.sentences.length <= 5));
});

test('objective scoring', () => {
  assert.equal(scoreBlanks(['rely', 'declined'], ['rely', 'decided']).score, 1);
  assert.deepEqual(scoreReorder([0, 1, 3, 2]), { score: 1, total: 3 });
  const toks = [{ t: 'a' }, { t: 'b', wrong: true }, { t: 'c', wrong: true }, { t: 'd' }];
  assert.equal(scoreHiw(toks, new Set([1, 3])).score, 0);
  assert.equal(scoreHiw(toks, new Set([1, 2])).score, 2);
});

test('writing checks enforce PTE form rules', () => {
  const swt = ITEMS.swt[0];
  const good = judgeSwt(swt.model, swt);
  assert.ok(good.score >= 4, 'model answer covers the key points');
  assert.equal(judgeSwt('Remote work is good. It is flexible.', swt).score, 0);
  const em = ITEMS.email[0];
  const email = `Dear Customer Service Team,\n\nI am writing about the coffee machine I bought from your store last month. Unfortunately, it stopped working after only one week, and it no longer heats water at all.\n\nI have already tried to reset the machine and checked every step in the manual, but the problem continues.\n\nI would be grateful if you could arrange a replacement or a full refund as soon as possible. I can send my receipt if needed.\n\nKind regards,\nSajja`;
  const j = judgeEmail(email, em);
  assert.equal(j.score, 3);
  assert.ok(j.checks.every((c) => c.ok), JSON.stringify(j.checks));
  assert.ok(judgeSst(ITEMS.sst[0].model, ITEMS.sst[0]).score >= 3);
});

test('speaking checks', () => {
  const d = ITEMS.di[0];
  const r = judgeDi('The bar chart shows average daily screen time by age group. The highest is 13 to 17 at seven point four hours, while 55+ is the lowest at three hours. Overall, screen time falls with age.', d, { durationMs: 36000 });
  assert.ok(r.score >= 4, JSON.stringify(r.checks));
  const rts = judgeRts('Hello, I booked a table for six on Saturday but now we are four. Could you please change my booking? Thank you.', ITEMS.rts[0], { durationMs: 32000 });
  assert.equal(rts.score, rts.total);
  assert.equal(judgeAsq('it is the heart', ITEMS.asq[1], { micClosed: false }).score, 1);
  assert.equal(judgeAsq('liver', ITEMS.asq[1], { micClosed: false }).score, 0);
});

test('booklet plan drives the day: Oct 23 is Day 7 with reading tasks', () => {
  const p = planFor('2026-10-23');
  assert.equal(p.n, 7);
  assert.deepEqual(p.counts, { wfd: 20, rs: 10, ra: 5, rwfib: 15, rfib: 10 });
  assert.deepEqual(planFor('2026-10-24').counts, { ra: 15, rs: 20, di: 6, rts: 6, sst: 5 });
  assert.equal(Object.keys(planFor('2026-11-21').counts).length, 0);
  const set = buildDaySet({ task: 'rwfib', items: ITEMS.rwfib, attempts: [], day: '2026-10-23', perDay: 15 });
  assert.equal(set.length, 15);
});

test('weekly scorecard aggregates skills, wins and leaks', () => {
  const day = '2026-10-23';
  const atts = [];
  for (const it of ITEMS.wfd.slice(0, 20)) atts.push({ task: 'wfd', item_id: it.id, day, score: 9, total: 10, response: it.text });
  for (const it of ITEMS.rwfib.slice(0, 4)) atts.push({ task: 'rwfib', item_id: it.id, day, score: 2, total: 4, response: '' });
  for (const it of ITEMS.ro.slice(0, 3)) atts.push({ task: 'ro', item_id: it.id, day, score: 3, total: 3, response: '' });
  const w = buildWeekScorecard(atts, BANKS, 1);
  assert.equal(w.from, '2026-10-17');
  assert.equal(w.wfdAccuracy, 90);
  assert.equal(w.activeDays, 1);
  assert.ok(w.skills.Reading != null && w.skills.Speaking == null);
  assert.match(w.biggestWin, /Reorder/);
  assert.match(w.biggestLeak, /R&W/);
  const r = buildDayReport(day, atts, BANKS);
  assert.equal(r.others.find((t) => t.task === 'rwfib').weak.length, 4);
  assert.equal(r.focus.key, 'rwfib');
});

test('exam timing: limits exist for every non-speaking task and reading fits a 30-minute section', async () => {
  const { PACE, strict } = await import('../src/lib/timing.js');
  for (const k of ['swt', 'email', 'sst', 'rwfib', 'rfib', 'ro', 'wfd', 'lfib', 'hiw']) assert.ok(PACE[k]?.secs > 0, k);
  assert.equal(PACE.swt.secs, 600); assert.equal(PACE.email.secs, 540); assert.equal(PACE.sst.secs, 480);
  const reading = 6 * PACE.rwfib.secs + 3 * PACE.ro.secs + 5 * PACE.rfib.secs + 2 * 120 + 2 * 90;
  assert.ok(reading <= 30 * 60, `reading pace ${reading}s`);
  assert.equal(strict({ examTiming: true }, false), true);
  assert.equal(strict({}, false), true);
  assert.equal(strict({ examTiming: false }, false), false);
  assert.equal(strict({ examTiming: true }, true), false);
});

test('auto-submitted empty answers score zero without crashing, and timeouts reach the coach report', async () => {
  const { timeoutsFor } = await import('../src/lib/coach.js');
  assert.equal(judgeSwt('', ITEMS.swt[0]).score, 0);
  assert.equal(judgeSst('', ITEMS.sst[0]).score, 0);
  assert.equal(judgeEmail('', ITEMS.email[0]).score, 0);
  const day = '2026-10-23';
  const attempts = [
    { day, task: 'wfd', item_id: ITEMS.wfd[0].id, score: 0, total: 8, meta: { timedOut: true } },
    { day, task: 'rwfib', item_id: ITEMS.rwfib[0].id, score: 2, total: 5, meta: { timedOut: true } },
    { day, task: 'rwfib', item_id: ITEMS.rwfib[1].id, score: 3, total: 5, meta: { timedOut: true } },
    { day, task: 'rfib', item_id: ITEMS.rfib[0].id, score: 4, total: 4, meta: {} },
  ];
  const t = timeoutsFor(attempts, day);
  assert.equal(t.total, 3); assert.equal(t.byTask[0].task, 'rwfib');
  const r = buildDayReport(day, attempts, BANKS);
  assert.equal(r.timeouts.total, 3);
  assert.ok(r.focus.actions.some((a) => a.includes('clock ran out')));
});

test('AI grader: form and spelling come from Pearson bands, not the model', async () => {
  const { finalize, measure } = await import('../api/grade.js');
  const email = 'Dear John,\n\nThe purpose my email today is request to attending professional training course. I am planning to attend Forward Deployment Engineer course which strengthens the value of team infront of customer by exposing out strength in AI and ML operations that the course would teach.\n\nI would take like to split the work and training, and request our team to distribute my assigned tasks half. I truly appreciate your support on the request and I look forward to hearing from you.\n\nRegards,\nSudhakar Sajja';
  assert.equal(measure('email', email).form, 2);
  const out = finalize('email', { traits: { content: 1, form: 0, grammar: 0, vocabulary: 5, 'email conventions': 1, organization: 1 }, spellingErrors: [{ wrong: 'infront', right: 'in front' }] }, email);
  assert.equal(out.traits.form, 2, 'model said 0, measured 50-120 words = 2');
  assert.equal(out.traits.vocabulary, 2, 'clamped to max');
  assert.equal(out.traits.spelling, 2, '1 error = 2 for email');
  assert.equal(out.outOf, 15);
  assert.equal(measure('swt', 'a b c d e').form, 0, 'no punctuation');
  assert.equal(measure('sst', 'The speaker discussed climate change, explaining that sea levels rise and that cities must adapt quickly, which shows urgent planning is needed now.').form, 2);
  assert.equal(finalize('sst', { spellingErrors: [1, 2] }, 'x.').traits.spelling, 1);
});

test('AI grader: improved email is checked against the booklet template and corrected once', async () => {
  const { templateProblems, default: handler } = await import('../api/grade.js');
  const prompt = 'Write to your manager.\nRegister: formal\nBullets: Explain which course; Explain the benefit; Suggest how your work will be covered';
  const good = 'Dear John,\n\nI am writing to request your permission to attend a training course.\n\nFirstly, I would like to attend the two-week Forward Deployed Engineer course next month. Secondly, the course would strengthen our team\'s value to customers, because it teaches the AI and ML skills our clients need. Finally, to cover my work, I will finish my urgent tasks beforehand, and our team has agreed to share half of my assigned tasks while I am away.\n\nI would be grateful if you could approve my request. Please feel free to contact me if you need any further information. Thank you for your time and consideration.\n\nKind regards,\nSudhakar Sajja';
  const bad = 'Dear John,\n\nI am writing to request attendance at the course.\n\nFirstly, it helps. Secondly, it improves. Additionally, it trains others. Finally, I will split work.\n\nI would be grateful if you could approve my attendance. Please let me know if you need further information. Thank you for your consideration.\n\nKind regards,\nSudhakar Sajja';
  assert.deepEqual(templateProblems('email', good, prompt), []);
  assert.ok(templateProblems('email', bad, prompt).length >= 3);
  process.env.GRADER_API_KEY = 'test'; process.env.GRADER_PROVIDER = 'groq';
  const saved = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, opt) => {
    const body = JSON.parse(opt.body); sent.push(body);
    const content = sent.length === 1 ? JSON.stringify({ traits: { content: 3 }, improved: bad }) : JSON.stringify({ improved: good });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  const res = { status(c) { this.c = c; return this; }, json(j) { this.j = j; return this; } };
  await handler({ method: 'POST', headers: {}, body: { task: 'email', prompt, answer: 'Hi John, I want to attend a course.' } }, res);
  globalThis.fetch = saved; delete process.env.GRADER_API_KEY; delete process.env.GRADER_PROVIDER;
  assert.equal(res.c, 200);
  assert.equal(sent.length, 2, 'one correction round');
  assert.ok(sent[1].messages.at(-1).content.includes('Additionally') || sent[1].messages.at(-1).content.includes('extra point'));
  assert.equal(res.j.improved, good);
  assert.equal(res.j.templateOk, true);
  assert.equal(res.j.traits.content, 3, 'scores from the first pass stand');
});

test('AI grader: same word count as the app, and content cannot be 0 when every main point is covered', async () => {
  const { finalize, countWords } = await import('../api/grade.js');
  const { wordCount } = await import('../src/lib/judge.js');
  const swt = 'The passage explains that companies trialled a four-day working week for the same pay, highlighting that it improved wellbeing, productivity and reduced burnout, and that it does not suit sectors needing continuous coverage, which suggests that it works best where output is measurable and teams can redesign their work.';
  assert.equal(countWords(swt), wordCount(swt));
  assert.equal(countWords(swt), 50);
  const out = finalize('swt', { traits: { content: 0, grammar: 2, vocabulary: 2 } }, swt, { coverage: { hit: 5, total: 5 } });
  assert.equal(out.traits.content, 1);
  assert.equal(out.measured.keyPoints, '5/5');
  assert.equal(finalize('swt', { traits: { content: 0 } }, swt, { coverage: { hit: 3, total: 5 } }).traits.content, 0, 'no floor when points are missing');
});

test('stale build after a deploy: reload once, never loop', async () => {
  const store = {}; let reloads = 0;
  globalThis.sessionStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  globalThis.window = { location: { reload: () => { reloads++; } } };
  const { isStaleChunk, reloadOnce } = await import('../src/lib/stale.js');
  assert.ok(isStaleChunk(new TypeError('Failed to fetch dynamically imported module: https://x/assets/microsoft.cognitiveservices.speech.sdk-DeWGopdm.js')));
  assert.ok(!isStaleChunk(new Error('Microphone permission denied')));
  assert.equal(reloadOnce(), true);
  assert.equal(reloadOnce(), false, 'second failure within a minute does not reload again');
  assert.equal(reloads, 1);
  delete globalThis.sessionStorage; delete globalThis.window;
});

test('weekly scorecard: the leak is never the win, and only below target', async () => {
  const { leakText } = await import('../src/lib/coach.js');
  assert.equal(leakText(['ra'], { ra: { pct: 100 } }), null, 'one task: no leak');
  assert.equal(leakText(['ra', 'rfib'], { ra: { pct: 100 }, rfib: { pct: 97 } }), 'None: every task at target');
  assert.equal(leakText(['ra', 'rfib', 'lfib'], { ra: { pct: 100 }, rfib: { pct: 97 }, lfib: { pct: 60 } }), 'Listening Fill in the Blanks 60%');
  assert.match(leakText(['ra', 'wfd'], { ra: { pct: 100 }, wfd: { pct: 72 } }, ['Whole words missed', 28]), /Write From Dictation 72% · whole words missed \(28\)/);
});

test('Answer Short Question: "hear" is not "hearing", and the near miss is explained', () => {
  const item = { text: 'Which sense do you use when you listen to music?', answers: ['hearing'] };
  const r = judgeAsq('Hear.', item, { micClosed: false });
  assert.equal(r.ok, false);
  assert.deepEqual(r.near, { said: 'hear', answer: 'hearing' });
  assert.equal(judgeAsq('Hearing.', item, { micClosed: false }).ok, true);
  assert.equal(judgeAsq('Sight.', item, { micClosed: false }).near, null);
  const ant = { text: 'Which continent is covered by the largest ice sheet?', answers: ['Antarctica'] };
  assert.equal(judgeAsq('Arctic', ant, { micClosed: false }).ok, false);
});

test('template model answers: every summary has one, in the booklet template, with every key point', async () => {
  const { TEMPLATE_MODELS } = await import('../src/content/templateModels.js');
  const { templateProblems } = await import('../api/grade.js');
  for (const t of ['swt', 'sst']) {
    for (const it of ITEMS[t]) {
      const m = TEMPLATE_MODELS[it.id];
      assert.ok(m, `${it.id} has a template model`);
      const j = t === 'swt' ? judgeSwt(m, BY_ID[t][it.id]) : judgeSst(m, BY_ID[t][it.id]);
      const [lo, hi] = t === 'swt' ? [30, 45] : [20, 30];
      assert.ok(j.n >= lo && j.n <= hi, `${it.id}: ${j.n} words`);
      assert.ok(j.cov.every(Boolean), `${it.id} covers every key point`);
      assert.deepEqual(templateProblems(t, m, ''), [], `${it.id} follows the template`);
    }
  }
});

test('Grammar gym: bank questions are valid and every rule has questions', async () => {
  const { RULES, optionsFor } = await import('../src/lib/grammar.js');
  const bank = ITEMS.gram;
  assert.ok(bank.length >= 90);
  for (const q of bank) {
    assert.ok(q.q.includes('___'), q.id);
    assert.ok(RULES[q.rule], q.id + ' rule');
    assert.ok(!q.d.includes(q.a), q.id + ' answer not among wrong options');
    assert.equal(new Set(optionsFor(q)).size, q.d.length + 1, q.id + ' options unique');
  }
  for (const r of ['clause', 'to', 'agree', 'article', 'count', 'prep', 'tense', 'passive', 'form', 'plural']) assert.ok(bank.filter((q) => q.rule === r).length >= 6, r);
});

test('Grammar gym: your own mistakes become questions, first, until you get them right', async () => {
  const { ownItems, buildGramSet } = await import('../src/lib/grammar.js');
  const d7 = '2026-10-23', d9 = '2026-10-25';
  const attempts = [
    { id: 'a1', day: d7, task: 'wfd', item_id: 'w175', score: 6, total: 8, meta: { errors: [{ cat: 'ending_s', kind: 'form', word: 'help', typed: 'helps' }, { cat: 'content', kind: 'miss', word: 'workplace.', typed: null }] } },
    { id: 'a2', day: d7, task: 'rwfib', item_id: 'f019', score: 3, total: 4, meta: { missChunks: [{ answer: 'surfaces', chosen: 'sources', phrase: 'road surfaces' }] } },
    { id: 'a3', day: d7, task: 'email', item_id: 'e001', score: 5, total: 8, meta: { ai: { errors: [{ original: 'request to attending', fix: 'request permission to attend', why: 'to + base verb' }] } } },
  ];
  const own = ownItems(attempts, BANKS, d9);
  const ids = Object.keys(own);
  assert.equal(ids.length, 3, 'content misses are not grammar questions');
  const s = own['x-a1-0'];
  assert.equal(s.rule, 'agree'); assert.equal(s.a, 'help'); assert.ok(s.d.includes('helps')); assert.ok(s.q.includes('___'));
  assert.equal(own['x-a2-p0'].q, 'road ___');
  assert.equal(own['x-a3-w0'].a, 'request permission to attend');

  const set = buildGramSet({ attempts, banks: BANKS, day: d9, perDay: 15 });
  assert.equal(set.length, 15);
  assert.deepEqual(set.slice(0, 3).map((x) => x.kind), ['own', 'own', 'own']);
  assert.equal(new Set(set.map((x) => x.id)).size, 15, 'no duplicates');

  // Answer one of your own mistakes correctly: it leaves the next day's set; a wrong bank answer returns first.
  const later = [...attempts,
    { id: 'g1', day: d9, task: 'gram', item_id: 'x-a1-0', score: 1, total: 1, meta: { rule: 'agree' } },
    { id: 'g2', day: d9, task: 'gram', item_id: 'm012', score: 0, total: 1, meta: { rule: 'to' } }];
  const next = buildGramSet({ attempts: later, banks: BANKS, day: '2026-10-26', perDay: 15 });
  assert.ok(!next.some((x) => x.id === 'x-a1-0'));
  assert.equal(next.find((x) => x.id === 'm012')?.kind, 'review');
});

test('AI grader: spoken answers are not marked for number words, spelling or hyphens', async () => {
  const { spokenErrors } = await import('../api/grade.js');
  const raw = [
    { original: 'two thousand eighteen', fix: '2018', why: 'Use numeric year format' },
    { original: 'has Rosen', fix: 'has risen', why: 'Spelling error' },
    { original: 'in store', fix: 'in-store', why: 'Missing hyphen' },
    { original: 'has been declined', fix: 'has declined', why: 'Incorrect verb form' },
    { original: 'online sales has picked up', fix: 'online sales have picked up', why: 'Subject-verb agreement' },
    { original: 'Rosen', fix: 'risen', why: 'Possibly pronounced unclearly' },
  ];
  assert.deepEqual(spokenErrors(raw).map((e) => e.fix), ['has declined', 'online sales have picked up', 'risen']);
});

test('Describe Image checker: spoken years, number words and "in store" count as correct', () => {
  const d = { type: 'group', title: 'Share of retail sales: online versus in-store', unit: '%', labels: ['2018', '2020', '2022', '2024'],
    series: [{ name: 'Online', values: [18, 31, 29, 35] }, { name: 'In-store', values: [82, 69, 71, 65] }] };
  const heard = 'The bar chart shows the share of retail sales online and in store from two thousand eighteen to two thousand twenty four. The highest is in store sales in two thousand eighteen at eighty two percent. Overall shopping is moving online.';
  const r = judgeDi(heard, d, { durationMs: 34000 });
  assert.ok(r.checks.every((c) => c.ok), JSON.stringify(r.checks.filter((c) => !c.ok)));
  assert.ok(judgeDi('The highest is in store in twenty eighteen. Online too.', d, { durationMs: 34000 }).checks.find((c) => /highest/.test(c.label)).ok);
  const late = judgeDi(heard, d, { durationMs: 39000 }).checks.at(-1);
  assert.equal(late.ok, false); assert.match(late.label, /cut-off/);
});
