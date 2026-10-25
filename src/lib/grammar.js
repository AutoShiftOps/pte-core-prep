// Grammar gym: daily multiple-choice questions on the ten rules of the master sheet, plus questions
// built from the user's own logged mistakes (dictation errors, missed word pairs, AI-rater corrections).
// A question the user gets wrong comes back until it is answered correctly.
import BANK from '../content/grammar.js';
import { canon } from './score.js';
import { seededOrder } from './scheduler.js';
import { addDays } from './plan.js';

export const RULES = {
  clause: { label: 'Subject + verb', tip: 'After that / which / because / although, a full clause: subject + verb.' },
  to: { label: 'to + verb or -ing', tip: 'to + base verb, unless a noun fits after "to" (look forward to, committed to, in addition to): then -ing. After a preposition: -ing.' },
  agree: { label: 'One -s rule', tip: 'The -s goes on the noun OR the verb, never both: the team helps, the teams help.' },
  article: { label: 'Articles', tip: 'A singular countable noun never stands alone: a / an / the / my. General plural or uncountable: no article.' },
  count: { label: 'Countable or not', tip: 'information, advice, evidence, equipment, research: no -s, no a/an. many / fewer + plural; much / less + uncountable.' },
  prep: { label: 'Prepositions', tip: 'Learn verb + preposition pairs as one word (depend on, contribute to). attend, discuss, suit, request take none.' },
  tense: { label: 'Tense', tip: 'Present simple for texts and charts; present perfect for change with a present result; past simple with a finished time.' },
  passive: { label: 'Passive', tip: 'be + past participle; the form of "be" carries the tense: is done, has been done, must be done.' },
  form: { label: 'Word form', tip: 'After a / the / an adjective → noun; after to / can → verb; before a noun → adjective; describing a verb → adverb (-ly).' },
  plural: { label: 'Plural match', tip: 'many / several / both / one of the + plural noun; plural owners → plural things (restaurants… their prices).' },
  spelling: { label: 'Spelling', tip: 'Type the word three times correctly; it comes back until you get it right.' },
  pair: { label: 'Word pair', tip: 'Read the words on both sides of the gap: most answers are fixed pairs.' },
  writing: { label: 'Your writing', tip: 'A correction the AI rater made to your own writing.' },
};

const BY_ID = Object.fromEntries(BANK.map((q) => [q.id, q]));
const ARTICLES = ['a', 'the', '—', 'an'];
const PREPS = ['of', 'to', 'in', 'for', 'on', 'at', 'with', 'by'];
const AUX_PAIR = { is: 'are', are: 'is', was: 'were', were: 'was', has: 'have', have: 'has', be: 'been', been: 'be', will: 'would', can: 'could' };
const CAT_RULE = { ending_s: 'agree', ending_ed: 'tense', article: 'article', preposition: 'prep', auxiliary: 'passive', spelling: 'spelling' };
const SOURCE = { wfd: 'dictation', rwfib: 'R&W Fill in the Blanks', rfib: 'Reading Fill in the Blanks', swt: 'Summarize Written Text', sst: 'Summarize Spoken Text', email: 'Write Email' };
const strip = (w) => String(w || '').replace(/^[^A-Za-z0-9'’—]+|[^A-Za-z0-9'’—]+$/g, '');

/** Shuffle the options of a question the same way every time. */
export function optionsFor(q) {
  return seededOrder([q.a, ...q.d], 'gram:' + q.id);
}

function blankWord(sentence, word) {
  const toks = sentence.split(' ');
  const i = toks.findIndex((t) => canon(t) === canon(word));
  if (i < 0) return null;
  const m = toks[i].match(/^([^A-Za-z0-9']*)(.*?)([^A-Za-z0-9']*)$/);
  toks[i] = (m?.[1] || '') + '___' + (m?.[3] || '');
  return { q: toks.join(' '), a: m?.[2] || strip(toks[i]) };
}

function fromDictation(a, sentence) {
  const out = [];
  (a.meta?.errors || []).forEach((e, n) => {
    const rule = CAT_RULE[e.cat];
    if (!rule || !e.word) return;
    const b = blankWord(sentence, e.word);
    if (!b) return;
    const ans = b.a, low = ans.toLowerCase(), typed = strip(e.typed);
    let d = [];
    if (rule === 'article') d = ARTICLES.filter((x) => x !== low).slice(0, 2);
    else if (rule === 'prep') d = seededOrder(PREPS.filter((x) => x !== low), a.id + n).slice(0, 2);
    else if (rule === 'passive') d = [AUX_PAIR[low], '—'].filter(Boolean);
    else if (rule === 'agree') d = [low.endsWith('s') ? ans.slice(0, -1) : ans + 's'];
    if (typed && canon(typed) !== canon(ans)) d.unshift(typed);
    d = [...new Set(d.filter((x) => x && canon(x) !== canon(ans)))].slice(0, 2);
    if (!d.length) return;
    out.push({ id: `x-${a.id}-${n}`, rule, q: b.q, a: ans, d,
      why: typed ? `In your dictation you wrote "${typed}".` : 'In your dictation you left it out.',
      own: { task: a.task, day: a.day } });
  });
  return out;
}

function fromPairs(a) {
  return (a.meta?.missChunks || []).map((c, n) => {
    if (!c.phrase || !c.answer || !c.chosen) return null;
    const b = blankWord(c.phrase, c.answer);
    if (!b) return null;
    return { id: `x-${a.id}-p${n}`, rule: 'pair', q: b.q, a: c.answer, d: [c.chosen], why: `Word pair: "${c.phrase}". You chose "${c.chosen}".`, own: { task: a.task, day: a.day } };
  }).filter(Boolean);
}

function fromWriting(a) {
  return (a.meta?.ai?.errors || []).map((e, n) => {
    const o = String(e.original || '').trim(), f = String(e.fix || '').trim();
    if (!o || !f || o === f || o.length > 140 || f.length > 140) return null;
    return { id: `x-${a.id}-w${n}`, rule: 'writing', q: 'Which version is correct? ___', a: f, d: [o], why: e.why ? `${e.why}.` : 'The AI rater corrected this in your answer.', own: { task: a.task, day: a.day } };
  }).filter(Boolean);
}

/** Questions built from the user's own mistakes in the last 14 days, keyed by id. */
export function ownItems(attempts, banks, today) {
  const since = today ? addDays(today, -14) : '0000';
  const map = {};
  for (const a of attempts) {
    if (!a.id || String(a.id).startsWith('pending') || a.day < since) continue;
    let qs = [];
    if (a.task === 'wfd' && banks.wfd?.[a.item_id]) qs = fromDictation(a, banks.wfd[a.item_id]);
    else if (a.task === 'rwfib' || a.task === 'rfib') qs = fromPairs(a);
    else if (['swt', 'sst', 'email'].includes(a.task)) qs = fromWriting(a);
    for (const q of qs) map[q.id] = q;
  }
  return map;
}

/** Latest grammar-gym result per question id. */
function results(attempts) {
  const r = {};
  for (const a of attempts) if (a.task === 'gram') r[a.item_id] = { ok: a.score >= 1, day: a.day };
  return r;
}

/**
 * Today's set: up to 8 of your own unresolved mistakes (newest first), then bank questions:
 * the ones you got wrong first, then unseen ones, weighted towards the rules you miss most.
 */
export function buildGramSet({ attempts, banks, day, perDay = 15 }) {
  const prior = attempts.filter((a) => a.day < day);
  const res = results(prior);
  const own = Object.values(ownItems(prior, banks, day))
    .filter((q) => !res[q.id]?.ok)
    .sort((x, y) => y.own.day.localeCompare(x.own.day))
    .slice(0, Math.min(8, perDay));

  // How often each rule tripped you up: dictation error types in the last 7 days + gym misses.
  const weight = Object.fromEntries(Object.keys(RULES).map((k) => [k, 1]));
  const week = addDays(day, -7);
  for (const a of prior) {
    if (a.day < week) continue;
    if (a.task === 'wfd') for (const e of a.meta?.errors || []) { const r = CAT_RULE[e.cat]; if (r && weight[r] != null) weight[r] += 1; }
    if (a.task === 'gram' && a.score < 1 && a.meta?.rule && weight[a.meta.rule] != null) weight[a.meta.rule] += 2;
  }

  const slots = perDay - own.length;
  const order = seededOrder(BANK.map((q) => q.id), 'gram:' + day);
  const wrongFirst = order.filter((id) => res[id] && !res[id].ok);
  const unseen = order.filter((id) => !res[id]);
  const seenOk = order.filter((id) => res[id]?.ok).sort((x, y) => res[x].day.localeCompare(res[y].day));
  const queue = [...wrongFirst, ...unseen, ...seenOk];
  // Spread the slots over rules in proportion to their weight, at least one per weighted rule.
  const rules = Object.keys(weight).filter((k) => BANK.some((q) => q.rule === k)).sort((x, y) => weight[y] - weight[x]);
  const total = rules.reduce((s, k) => s + weight[k], 0);
  const want = Object.fromEntries(rules.map((k) => [k, Math.max(0, Math.round((weight[k] / total) * slots))]));
  const picked = [];
  for (const k of rules) for (const id of queue) {
    if (picked.length >= slots || want[k] <= 0) break;
    if (BY_ID[id].rule === k && !picked.includes(id)) { picked.push(id); want[k]--; }
  }
  for (const id of queue) { if (picked.length >= slots) break; if (!picked.includes(id)) picked.push(id); }

  return [
    ...own.map((q) => ({ id: q.id, kind: 'own', q })),
    ...picked.map((id) => ({ id, kind: res[id] && !res[id].ok ? 'review' : res[id] ? 'recycled' : 'new' })),
  ];
}

export const ownSourceLabel = (own) => (own ? `From your ${SOURCE[own.task] || own.task}, ${own.day}` : '');
