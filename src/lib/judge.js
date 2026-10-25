// Automatic checks for the non-dictation tasks. Objective tasks are scored exactly like PTE;
// open tasks (summaries, email, spoken answers) get rule-based checks on form and key points.
import { canon, words, cleanWord } from './score.js';

const lower = (s) => (s || '').toLowerCase();

export function coverage(text, groups) {
  const t = ' ' + lower(text).replace(/[^a-z0-9'\- ]+/g, ' ') + ' ';
  return groups.map((g) => g.some((kw) => t.includes(kw.toLowerCase())));
}

export const wordCount = (s) => words(s).filter((w) => /[A-Za-z0-9]/.test(w)).length;

// ---------- Reading / listening objective tasks ----------

export function scoreBlanks(answers, chosen) {
  const results = answers.map((a, i) => ({ answer: a, chosen: chosen[i] || '', ok: canon(chosen[i] || '') === canon(a) }));
  return { results, score: results.filter((r) => r.ok).length, total: answers.length };
}

/** Reorder Paragraph: one point per correct adjacent pair, like PTE. */
export function scoreReorder(order) {
  let score = 0;
  for (let i = 0; i < order.length - 1; i++) if (order[i + 1] === order[i] + 1) score++;
  return { score, total: order.length - 1 };
}

/** Highlight Incorrect Words: +1 per correct click, −1 per wrong click, never below 0. */
export function scoreHiw(tokens, clicked) {
  let good = 0, bad = 0;
  tokens.forEach((t, i) => { if (clicked.has(i)) { if (t.wrong) good++; else bad++; } });
  const total = tokens.filter((t) => t.wrong).length;
  return { score: Math.max(0, good - bad), total, good, bad, missed: total - good };
}

// ---------- Writing ----------

export function judgeSwt(text, item) {
  const n = wordCount(text);
  const trimmed = text.trim();
  const sentenceEnds = (trimmed.match(/[.!?](\s|$)/g) || []).length;
  const form = n >= 25 && n <= 50 && sentenceEnds <= 1;
  const cov = coverage(text, item.points);
  const checks = [
    { ok: n >= 25 && n <= 50, label: `Word count ${n} (must be 25–50)`, fatal: true },
    { ok: sentenceEnds <= 1, label: sentenceEnds <= 1 ? 'One sentence' : `${sentenceEnds} sentences: PTE expects one`, fatal: true },
    { ok: /^[A-Z]/.test(trimmed) && /\.$/.test(trimmed), label: 'Starts with a capital letter and ends with a full stop' },
    { ok: /\b(and|but|while|which|so|because|although|whereas)\b/i.test(text), label: 'Uses connectors to join ideas' },
  ];
  const pointsHit = cov.filter(Boolean).length;
  const score = form ? pointsHit : 0;
  return { kind: 'swt', n, form, cov, checks, score, total: item.points.length };
}

export function judgeSst(text, item) {
  const n = wordCount(text);
  const cov = coverage(text, item.points);
  const form = n >= 20 && n <= 30 ? 'good' : n >= 5 && n <= 40 ? 'weak' : 'zero';
  const checks = [
    { ok: form === 'good', label: `Word count ${n} (aim for 20–30; under 5 or over 40 scores zero)`, fatal: form === 'zero' },
    { ok: /^[A-Z]/.test(text.trim()) && /[.]$/.test(text.trim()), label: 'Capital letter and full stop' },
  ];
  const pointsHit = cov.filter(Boolean).length;
  return { kind: 'sst', n, cov, checks, score: form === 'zero' ? 0 : pointsHit, total: item.points.length };
}

const INFORMAL_IN_FORMAL = /\b(hey|gonna|wanna|gotta|yeah|cheers|lol|btw|kinda)\b/i;
export function judgeEmail(text, item) {
  const n = wordCount(text);
  const lines = text.trim().split(/\n/).map((l) => l.trim());
  const firstLine = lines[0] || '';
  const paragraphs = text.trim().split(/\n\s*\n/).filter((p) => p.trim()).length;
  const cov = coverage(text, item.bullets.map((b) => b.kw));
  const contractions = (text.match(/\b\w+'(t|re|ll|ve|m|d)\b/gi) || []).length;
  const checks = [
    { ok: n >= 80 && n <= 120, label: `Word count ${n} (aim for 100–110; Pearson gives full form marks for 50–120)`, fatal: n < 50 || n > 140 },
    { ok: /^(dear|hi|hello)\b/i.test(firstLine), label: 'Opens with a greeting (Dear… / Hi…)' },
    { ok: /(regards|sincerely|best wishes|best,|cheers|take care|yours|thanks|thank you)/i.test(lines.slice(-3).join(' ')), label: 'Closes with a sign-off' },
    { ok: paragraphs >= 3, label: `${paragraphs} paragraph${paragraphs === 1 ? '' : 's'} (aim for 3 or more, separated by a blank line)` },
    item.register === 'formal'
      ? { ok: !INFORMAL_IN_FORMAL.test(text) && contractions <= 1, label: contractions > 1 ? `Formal email: ${contractions} contractions (write "I am", "cannot")` : 'Formal register' }
      : { ok: true, label: 'Informal register' },
  ];
  const fatal = checks.some((c) => c.fatal && !c.ok);
  return { kind: 'email', n, cov, checks, score: fatal ? 0 : cov.filter(Boolean).length, total: item.bullets.length };
}

// ---------- Open speaking ----------

export function diFacts(d) {
  const facts = [];
  const titleWords = d.title.toLowerCase().split(/\s+/).filter((w) => w.length >= 5 && !/^(average|number|share|between|versus|during|annual|monthly)$/.test(w));
  facts.push({ label: 'Says what the image shows', kw: [...titleWords.slice(0, 4), 'chart', 'graph', 'shows', 'illustrates'] });
  if (d.type === 'group') {
    facts.push({ label: `Names both groups (${d.series.map((s) => s.name).join(', ')})`, kw: d.series.map((s) => s.name.toLowerCase()), all: true });
    const flat = d.series.flatMap((s) => s.values.map((v, i) => ({ v, label: d.labels[i], s: s.name })));
    const max = flat.reduce((a, b) => (b.v > a.v ? b : a));
    facts.push({ label: `Mentions the highest point (${max.s}, ${max.label})`, kw: [max.label.toLowerCase()] });
  } else {
    const vals = d.values;
    const iMax = vals.indexOf(Math.max(...vals));
    const iMin = vals.indexOf(Math.min(...vals));
    facts.push({ label: `Mentions the highest (${d.labels[iMax]})`, kw: [d.labels[iMax].toLowerCase()] });
    facts.push({ label: `Mentions the lowest (${d.labels[iMin]})`, kw: [d.labels[iMin].toLowerCase()] });
    if (d.type === 'line') facts.push({ label: 'Describes the trend', kw: ['increase', 'rose', 'rise', 'grew', 'growth', 'peak', 'decline', 'fell', 'drop', 'decrease', 'steady', 'fluctuat'] });
  }
  facts.push({ label: 'Uses at least one number', kw: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'percent'] });
  facts.push({ label: 'Gives an overall conclusion', kw: ['overall', 'in conclusion', 'in summary', 'to sum up', 'clearly'] });
  return facts;
}

function hits(text, fact) {
  const t = ' ' + lower(text) + ' ';
  return fact.all ? fact.kw.every((k) => t.includes(k)) : fact.kw.some((k) => t.includes(k.replace(/–/g, ' to ')) || t.includes(k));
}

export function judgeDi(heard, d, take) {
  const facts = diFacts(d).map((f) => ({ ...f, ok: hits(heard, f) }));
  const dur = take.durationMs / 1000;
  const checks = [
    ...facts.map((f) => ({ ok: f.ok, label: f.label })),
    { ok: dur >= 30, label: `Spoke for ${dur.toFixed(0)} s (aim for 35–40 s)` },
  ];
  return { kind: 'di', checks, score: facts.filter((f) => f.ok).length, total: facts.length };
}

const POLITE = ['please', 'could', 'would', 'thank', 'appreciate', 'sorry', 'apolog', 'grateful'];
export function judgeRts(heard, item, take) {
  const cov = coverage(heard, item.points);
  const t = lower(heard);
  const politeOk = item.register === 'formal' ? POLITE.some((p) => t.includes(p)) : /\b(hey|hi|hello|thanks|thank)\b/.test(t);
  const dur = take.durationMs / 1000;
  const checks = [
    ...item.points.map((g, i) => ({ ok: cov[i], label: `Covers: ${g.slice(0, 3).join(' / ')}` })),
    { ok: politeOk, label: item.register === 'formal' ? 'Polite formal language (please, could you, thank you)' : 'Friendly greeting or thanks' },
    { ok: dur >= 30, label: `Spoke for ${dur.toFixed(0)} s (aim for the full 40 s)` },
  ];
  return { kind: 'rts', checks, score: cov.filter(Boolean).length + (politeOk ? 1 : 0), total: item.points.length + 1 };
}

export function judgeAsq(heard, item, take) {
  const hw = words(heard).map(canon).filter(Boolean);
  const h = ' ' + hw.join(' ') + ' ';
  const ok = !take.micClosed && item.answers.some((a) => h.includes(' ' + words(a).map(canon).join(' ') + ' '));
  // Near miss: a word from the same family as a one-word answer (hear / hearing, decide / decision).
  let near = null;
  if (!ok && !take.micClosed) {
    for (const a of item.answers) {
      const ac = canon(a);
      if (!ac || /\s/.test(a.trim())) continue;
      const stem = ac.slice(0, Math.max(4, Math.min(ac.length - 2, 5)));
      const w = hw.find((x) => x !== ac && x.length >= 3 && (ac.startsWith(x) || x.startsWith(stem)));
      if (w) { near = { said: w, answer: a }; break; }
    }
  }
  return { kind: 'asq', ok, near, score: ok ? 1 : 0, total: 1 };
}

export const cleanAnswer = (s) => cleanWord(s || '');
