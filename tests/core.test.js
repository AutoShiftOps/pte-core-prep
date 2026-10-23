import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, categorize, normalizeSpeech } from '../src/lib/score.js';
import { buildDaySet } from '../src/lib/scheduler.js';
import { buildDayReport, pickFocusWfd } from '../src/lib/coach.js';
import { summarizeAzure } from '../src/lib/assess.js';
import WFD from '../src/content/wfd.js';
import RS from '../src/content/rs.js';
import RA from '../src/content/ra.js';

const BANKS = {
  wfd: Object.fromEntries(WFD.map((i) => [i.id, i.text])),
  rs: Object.fromEntries(RS.map((i) => [i.id, i.text])),
  ra: Object.fromEntries(RA.map((i) => [i.id, i.text])),
};

test('content banks: sizes, unique ids and texts', () => {
  assert.equal(WFD.length, 250); assert.equal(RS.length, 180); assert.equal(RA.length, 75);
  for (const bank of [WFD, RS, RA]) {
    assert.equal(new Set(bank.map((i) => i.id)).size, bank.length);
    assert.equal(new Set(bank.map((i) => i.text)).size, bank.length);
  }
});

test('dictation scoring explains spelling and endings', () => {
  const r = compare('The professor emphasized the importance of reliable evidence.', 'the professor emphasised the importence of reliable evidences');
  assert.equal(r.total, 8);
  assert.equal(r.score, 6);
  const byWord = Object.fromEntries(r.out.map((o) => [o.c, categorize(o)]));
  assert.equal(byWord.importance, 'spelling');
  assert.equal(byWord.evidence, 'ending_s');
  assert.equal(byWord.emphasized, null); // British spelling accepted
});

test('missed articles and prepositions are classified', () => {
  const r = compare('Students must submit their assignments before the end of the week.', 'Student must submit assignments before end of week');
  const cats = r.out.filter((o) => o.status !== 'ok').map(categorize);
  assert.ok(cats.includes('ending_s'));
  assert.ok(cats.includes('article'));
});

test('speech numbers are normalized', () => {
  assert.equal(normalizeSpeech('arrive 15 minutes early'), 'arrive fifteen minutes early');
  assert.equal(compare('The essay should be no longer than two thousand words.', normalizeSpeech('the essay should be no longer than 2,000 words')).score, 10);
});

test('day set: weak items come back as reviews first, no duplicates', () => {
  const d1 = buildDaySet({ task: 'wfd', items: WFD, attempts: [], day: '2026-10-23' });
  assert.equal(d1.length, 20);
  assert.ok(d1.every((x) => x.kind === 'new'));
  const attempts = d1.map((x, i) => ({ task: 'wfd', item_id: x.id, day: '2026-10-23', score: i < 5 ? 3 : 8, total: 8, focus: false }));
  const d2 = buildDaySet({ task: 'wfd', items: WFD, attempts, day: '2026-10-24' });
  assert.equal(d2.length, 20);
  assert.equal(new Set(d2.map((x) => x.id)).size, 20);
  assert.deepEqual(d2.slice(0, 5).map((x) => x.kind), Array(5).fill('review'));
  assert.ok(d2.slice(5).every((x) => !d1.some((y) => y.id === x.id)));
});

test('day set recycles oldest items when the bank is exhausted', () => {
  const attempts = RA.map((x) => ({ task: 'ra', item_id: x.id, day: '2026-10-20', score: 10, total: 10 }));
  const s = buildDaySet({ task: 'ra', items: RA, attempts, day: '2026-10-23' });
  assert.equal(s.length, 5);
  assert.ok(s.every((x) => x.kind === 'recycled'));
});

test('coach report names the top weakness and gives examples', () => {
  const day = '2026-10-23';
  const attempts = [
    { task: 'wfd', item_id: 'w001', day, response: 'The library will be closed for maintenance during winter break.', score: 10, total: 11, focus: false },
    { task: 'wfd', item_id: 'w002', day, response: 'Students must submit their assignment before end of the week.', score: 9, total: 11, focus: false },
    { task: 'rs', item_id: 'r001', day, response: 'please remember to bring your card', score: 6, total: 10, focus: false, meta: { latencyMs: 2300, pauses: [900], scores: { fluency: 70 } } },
  ];
  const r = buildDayReport(day, attempts, BANKS);
  assert.equal(r.wfd.done, 2);
  assert.ok(r.wfd.categories.some((c) => c.key === 'article'));
  assert.ok(r.wfd.categories[0].examples.length > 0);
  assert.equal(r.rs.fastPct, 0);
  assert.equal(r.rs.weak.length, 1);
  assert.ok(r.focus.headline.startsWith('Focus next'));
  assert.ok(r.focus.actions.length >= 2);
  const ids = pickFocusWfd('article', WFD, attempts, day);
  assert.equal(ids.length, 5);
  assert.ok(!ids.includes('w001'));
});

test('Azure result summary: latency, pauses, scores, mispronounced words', () => {
  const ref = 'Please remember to bring your student card to the exam.';
  const w = (Word, startMs, durMs, acc, ErrorType = 'None') => ({ Word, Offset: startMs * 10000, Duration: durMs * 10000, PronunciationAssessment: { AccuracyScore: acc, ErrorType } });
  const seg = {
    DisplayText: 'Please remember to bring your student card to the exam.', Duration: 40000000,
    NBest: [{ PronunciationAssessment: { AccuracyScore: 82, FluencyScore: 76, ProsodyScore: 70, PronScore: 78 },
      Words: [w('please', 800, 300, 95), w('remember', 1150, 400, 90), w('to', 1600, 100, 98), w('bring', 1750, 250, 92),
        w('your', 2050, 150, 96), w('student', 3200, 400, 45, 'Mispronunciation'), w('card', 3650, 250, 88), w('to', 3950, 100, 97), w('the', 4100, 100, 98), w('exam', 4250, 400, 90)] }],
  };
  const r = summarizeAzure({ reference: ref, segments: [seg], reason: 'silence', audioUrl: null });
  assert.equal(r.latencyMs, 800);
  assert.equal(r.score, 10);
  assert.equal(r.total, 10);
  assert.deepEqual(r.pauses, [1000]);
  assert.equal(r.scores.fluency, 76);
  assert.equal(r.scores.completeness, 100);
  assert.deepEqual(r.mispronounced.map((m) => m.word), ['student']);
  const none = summarizeAzure({ reference: ref, segments: [], reason: 'no-speech' });
  assert.equal(none.micClosed, true);
  assert.equal(none.score, 0);
});
