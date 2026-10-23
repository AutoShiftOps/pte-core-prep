// Tasks built from existing banks so they share stable IDs:
//   Listening Fill in the Blanks  ← Read Aloud passages (key content words blanked)
//   Highlight Incorrect Words     ← R&W fill-in-the-blank passages (look-alike words swapped in)
//   Reorder Paragraph             ← Read Aloud + Summarize Written Text passages (sentences shuffled)
import RA from '../content/ra.js';
import RWFIB from '../content/rwfib.js';
import SWT from '../content/swt.js';
import { FUNCTION_WORDS, canon, cleanWord } from './score.js';

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// [[a|b|c]] → { plain text with answers, blanks [{ answer, options }] }
export function parseBlanks(text) {
  const parts = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const opts = m[1].split('|');
    parts.push({ blank: parts.filter((p) => typeof p !== 'string').length, answer: opts[0], options: opts });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
export const plainText = (text) => parseBlanks(text).map((p) => (typeof p === 'string' ? p : p.answer)).join('');

/** Deterministic shuffle so an item always shows the same order. */
export function shuffleFor(arr, seed) {
  const a = [...arr];
  let h = hash(seed);
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1103515245) + 12345 >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** The collocation a blank trains: the word before, the answer, the word after. */
export function chunkAround(parts, blankIdx) {
  const pos = parts.findIndex((p) => typeof p !== 'string' && p.blank === blankIdx);
  const before = parts.slice(0, pos).map((p) => (typeof p === 'string' ? p : p.answer)).join('');
  const after = parts.slice(pos + 1).map((p) => (typeof p === 'string' ? p : p.answer)).join('');
  const prev = cleanWord(before.trim().split(/\s+/).pop() || '');
  const next = cleanWord(after.trim().split(/\s+/)[0] || '');
  const ans = parts[pos].answer;
  return [prev, ans, /[.,;:!?]$/.test(after.trim().split(/\s+/)[0] || '') || !next ? null : next].filter(Boolean).join(' ');
}

export const LFIB = RA.map((r) => {
  const tokens = r.text.split(/(\s+)/);
  const candidates = [];
  tokens.forEach((t, i) => {
    const c = canon(t);
    if (/\S/.test(t) && c.length >= 5 && !FUNCTION_WORDS.has(c) && i > 2) candidates.push(i);
  });
  const want = Math.min(6, candidates.length);
  const step = candidates.length / want;
  const chosen = new Set(Array.from({ length: want }, (_, k) => candidates[Math.floor(k * step + step / 2)]));
  return {
    id: 'b' + r.id.slice(1), text: r.text,
    tokens: tokens.map((t, i) => (chosen.has(i) ? { answer: cleanWord(t), punct: t.slice(cleanWord(t).length + t.indexOf(cleanWord(t))) , lead: t.slice(0, t.indexOf(cleanWord(t))) } : t)),
  };
});

export const HIW = RWFIB.map((r) => {
  const parts = parseBlanks(r.text);
  const blanks = parts.filter((p) => typeof p !== 'string');
  const n = blanks.length >= 4 ? 3 : 2;
  const swapIdx = new Set(shuffleFor(blanks.map((b) => b.blank), r.id + 'hiw').slice(0, n));
  // Shown transcript: answers everywhere except swapped blanks, which show a look-alike word.
  const tokens = [];
  for (const p of parts) {
    if (typeof p === 'string') { for (const t of p.split(/(\s+)/)) if (t) tokens.push({ t }); continue; }
    if (swapIdx.has(p.blank)) {
      const wrong = p.options[1 + (hash(r.id + p.blank) % (p.options.length - 1))];
      tokens.push({ t: wrong, wrong: true, said: p.answer });
    } else {
      tokens.push({ t: p.answer });
    }
  }
  return { id: 'h' + r.id.slice(1), audio: plainText(r.text), tokens };
});

function sentences(text) { return (text.match(/[^.!?]+[.!?]+/g) || [text]).map((s) => s.trim()); }
export const REORDER = [
  ...RA.map((r) => ({ id: 'o' + r.id.slice(1), sentences: sentences(r.text).slice(0, 5) })),
  ...SWT.map((s) => ({ id: 'o' + String(100 + Number(s.id.slice(1))).padStart(3, '0'), sentences: sentences(s.text).slice(0, 5) })),
].filter((x) => x.sentences.length >= 3).map((x) => ({ ...x, text: x.sentences.join(' ') }));
