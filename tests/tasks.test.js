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
