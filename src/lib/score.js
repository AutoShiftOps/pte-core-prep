// Word-level scoring shared by dictation (typed) and speaking (speech-to-text).

export const ARTICLES = new Set(['a', 'an', 'the']);
export const PREPOSITIONS = new Set(['in', 'on', 'at', 'of', 'to', 'for', 'from', 'with', 'by', 'about', 'into', 'over', 'under', 'between', 'through', 'during', 'before', 'after', 'across', 'around', 'without', 'within', 'behind', 'until', 'since', 'towards', 'among']);
export const AUXILIARIES = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must']);
export const FUNCTION_WORDS = new Set([...ARTICLES, ...PREPOSITIONS, ...AUXILIARIES, 'and', 'or', 'but', 'that', 'this', 'it', 'its', 'their', 'they', 'them', 'he', 'she', 'his', 'her', 'we', 'our', 'you', 'your', 'i', 'my', 'as', 'than', 'so', 'not', 'no', 'which', 'who', 'what', 'when', 'where', 'how', 'some', 'all', 'any', 'more', 'most', 'such', 'these', 'those', 'there', 'if', 'also', 'only', 'very', 'many', 'much', 'each', 'every', 'one']);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numToWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 1000000) return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  return String(n);
}

// Speech-to-text writes "15%" or "2,000"; targets spell numbers out.
export function normalizeSpeech(text) {
  return (text || '')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/%/g, ' percent')
    .replace(/\d+/g, (m) => ' ' + numToWords(parseInt(m, 10)) + ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Accept British and American spellings as the same word.
export function canon(word) {
  return word
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/isation/g, 'ization')
    .replace(/is(e|ed|es|ing)$/, 'iz$1')
    .replace(/ell(ing|ed)$/, 'el$1')
    .replace(/tre$/, 'ter')
    .replace(/our$/, 'or')
    .replace(/programme/, 'program')
    .replace(/ageing/, 'aging');
}

export function words(s) {
  return (s || '').replace(/[-–—]/g, ' ').split(/\s+/).filter(Boolean);
}

export function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

function isForm(t, y) {
  if (t === y) return false;
  const ends = ['s', 'es', 'd', 'ed', 'ing'];
  if (ends.some((e) => y === t + e || t === y + e)) return true;
  const strip = (w) => w.replace(/(ies|es|s|ed|d|ing)$/, '');
  return strip(t) === strip(y) && strip(t).length > 2;
}

/**
 * Align a response with the target word by word (longest common subsequence),
 * then pair leftover words to explain each miss as spelling or a word ending.
 * Score = target words matched in order, like PTE's Write From Dictation.
 */
export function compare(target, response) {
  const T = words(target), Y = words(response);
  const tc = T.map(canon), yc = Y.map(canon);
  const m = tc.length, n = yc.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      L[i][j] = tc[i] && tc[i] === yc[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const tm = new Array(m).fill(-1), ym = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (tc[i] && tc[i] === yc[j]) { tm[i] = j; ym[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const out = T.map((w, k) => ({ w, c: tc[k], status: tm[k] >= 0 ? 'ok' : 'miss', typed: null }));
  const free = Y.map((w, k) => ({ w, c: yc[k], k })).filter((x) => !ym[x.k] && x.c);
  for (const o of out) {
    if (o.status !== 'miss' || !o.c) continue;
    let best = null, bd = 99;
    for (const f of free) { const d = lev(o.c, f.c); if (d < bd) { bd = d; best = f; } }
    if (!best) continue;
    if (isForm(o.c, best.c)) { o.status = 'form'; o.typed = best.w; free.splice(free.indexOf(best), 1); }
    else if (bd <= Math.max(1, Math.floor(o.c.length / 4))) { o.status = 'spell'; o.typed = best.w; free.splice(free.indexOf(best), 1); }
  }
  const scored = out.filter((o) => o.c);
  return {
    out,
    extra: free.map((f) => f.w),
    score: scored.filter((o) => o.status === 'ok').length,
    total: scored.length,
  };
}

/** Classify one non-matching word from compare() for the coach report. */
export function categorize(o) {
  if (!o || o.status === 'ok') return null;
  if (ARTICLES.has(o.c)) return 'article';
  if (PREPOSITIONS.has(o.c)) return 'preposition';
  if (AUXILIARIES.has(o.c)) return 'auxiliary';
  if (o.status === 'spell') return 'spelling';
  if (o.status === 'form') {
    const t = o.c, y = canon(o.typed || '');
    const endsS = (w) => /s$/.test(w) && !/ss$/.test(w);
    if (endsS(t) !== endsS(y)) return 'ending_s';
    if (/ed$|d$/.test(t) || /ed$|d$/.test(y)) return 'ending_ed';
    if (/ing$/.test(t) || /ing$/.test(y)) return 'ending_ing';
    return 'ending_s';
  }
  return 'content';
}

export const cleanWord = (w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
