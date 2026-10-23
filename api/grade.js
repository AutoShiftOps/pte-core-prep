// Optional AI grader for open answers (summaries, email, spoken responses).
// Enabled only when GRADER_API_KEY is set. Providers:
//   GRADER_PROVIDER=anthropic  (default model claude-haiku-5-5)
//   GRADER_PROVIDER=groq       (OpenAI-compatible; default model openai/gpt-oss-120b —
//                               llama-3.3-70b-versatile was retired by Groq on 2026-08-16)
// Same sign-in check as /api/speech-token.

// Official PTE Core scoring descriptors (PTE Core Score Guide, Jan 2024). Countable traits (form, spelling)
// are computed here, not by the model: language models can't count words reliably.
const band = (n, two, one) => (two(n) ? 2 : one(n) ? 1 : 0);
const RUBRIC = {
  email: {
    max: { content: 3, 'email conventions': 2, form: 2, organization: 2, grammar: 2, vocabulary: 2, spelling: 2 },
    form: (n) => band(n, (x) => x >= 50 && x <= 120, (x) => (x >= 30 && x <= 49) || (x >= 121 && x <= 140)),
    spelling: (k) => (k <= 2 ? 2 : k <= 4 ? 1 : 0),
    text: `PTE Core Write Email. Official descriptors:
content 3: addresses the requirements of the task sufficiently and appropriately (all three bullet points, right purpose) | 2: addresses the task with some success | 1: attempts the task but is not successful | 0: does not properly deal with the task, or relies on large amounts of pre-prepared material instead of the prompt.
email conventions 2: obvious, appropriate and correct for the prompt (greeting, purpose, closing, sign-off, register) | 1: inconsistent, elements missing or ineffective, too brief or wrong register | 0: limited or missing.
organization 2: clear structure, ideas logically organised, transitions used effectively | 1: generally acceptable, somewhat clear, transitions mostly basic | 0: missing or inappropriate.
vocabulary 2: good command of lexis appropriate to the situation | 1: limited range, some imprecision | 0: mainly basic vocabulary, insufficient.
grammar 2: generally consistent control with only occasional errors | 1: fair control, errors evident but no undue effort for the reader | 0: mainly simple structures and/or frequent mistakes.`,
  },
  swt: {
    max: { content: 2, form: 2, grammar: 2, vocabulary: 2 },
    form: (n) => band(n, (x) => x >= 25 && x <= 50, (x) => (x >= 5 && x <= 24) || (x >= 51 && x <= 60)),
    text: `PTE Core Summarize Written Text. Official descriptors:
content 2: good summary, all relevant aspects mentioned | 1: fair summary, misses one or two aspects | 0: omits or misrepresents the main aspects.
"Aspects" means the MAIN aspects: the main idea, the key supporting points and the conclusion. A summary is meant to leave out examples, lists, figures and minor details; leaving them out must never lower content.
grammar 2: correct grammatical structure | 1: errors but no hindrance to communication | 0: defective structure that could hinder communication.
vocabulary 2: appropriate choice of words | 1: lexical errors but no hindrance | 0: defective word choice that could hinder communication.`,
  },
  sst: {
    max: { content: 2, form: 2, grammar: 2, vocabulary: 2, spelling: 2 },
    form: (n) => band(n, (x) => x >= 20 && x <= 30, (x) => (x >= 5 && x <= 19) || (x >= 31 && x <= 40)),
    spelling: (k) => (k <= 1 ? 2 : k <= 3 ? 1 : 0),
    text: `PTE Core Summarize Spoken Text (a lecture summary). Official descriptors:
content 2: good summary, all relevant aspects mentioned | 1: fair summary, one or two aspects missing | 0: omits or misrepresents the main aspects.
"Aspects" means the MAIN aspects of the lecture: topic, key points and conclusion. Leaving out examples, figures and minor details is correct summarising and must never lower content.
grammar 2: correct structures | 1: errors with no hindrance to communication | 0: defective structure that could hinder communication.
vocabulary 2: appropriate choice of words | 1: some lexical errors, no hindrance | 0: defective word choice.`,
  },
  rts: {
    max: { appropriacy: 6 },
    text: 'PTE Core Respond to a Situation (spoken, transcribed by speech recognition, so ignore punctuation and minor transcription errors). appropriacy 0-6: addresses every part of the situation, right register, natural and polite.',
  },
  di: {
    max: { content: 6 },
    text: 'PTE Core Describe Image (spoken, transcribed by speech recognition, so ignore punctuation). content 0-6: main feature, key details with numbers, comparison or trend, conclusion.',
  },
};

// Same rule as the app's checklist: hyphenated words count as two ("four-day" = 2). That is the safe
// side of Pearson's upper limits: an answer that passes here cannot be over the limit in the test.
export const countWords = (s) => String(s || '').replace(/[-–—]/g, ' ').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** Form score as Pearson defines it, plus the capital-letters / no-punctuation rule. */
export function measure(task, answer) {
  const r = RUBRIC[task];
  const words = countWords(answer);
  if (!r?.form) return { words };
  const letters = answer.replace(/[^A-Za-z]/g, '');
  const shouting = letters.length > 10 && letters === letters.toUpperCase();
  const noPunct = !/[.,!?;:]/.test(answer);
  return { words, form: shouting || noPunct ? 0 : r.form(words) };
}

/** Clamp the model's scores to the official maxima and replace countable traits with measured ones. */
export function finalize(task, raw, answer, opts = {}) {
  const r = RUBRIC[task];
  const m = measure(task, answer);
  const traits = {};
  for (const [k, mx] of Object.entries(r.max)) {
    const v = Number(raw?.traits?.[k]);
    traits[k] = Number.isFinite(v) ? Math.max(0, Math.min(mx, Math.round(v))) : 0;
  }
  if ('form' in r.max) traits.form = m.form;
  // Pearson's content 0 = "omits or misrepresents the main aspects". If the app's key-point check found every
  // main point, 0 contradicts the descriptor: floor it at 1 (the model may still give the full mark).
  const cov = opts.coverage;
  const allPoints = cov && cov.total > 0 && cov.hit >= cov.total;
  if (allPoints && 'content' in traits && traits.content === 0) traits.content = 1;
  const spellingErrors = Array.isArray(raw?.spellingErrors) ? raw.spellingErrors.slice(0, 20) : [];
  if (r.spelling) traits.spelling = r.spelling(spellingErrors.length);
  const total = Object.values(traits).reduce((a, b) => a + b, 0);
  const max = Object.values(r.max).reduce((a, b) => a + b, 0);
  return {
    traits, max: r.max, total, outOf: max,
    reasons: raw?.reasons || {},
    measured: { words: m.words, ...(r.spelling ? { spellingErrors: spellingErrors.length } : {}), ...(opts.coverage?.total ? { keyPoints: `${opts.coverage.hit}/${opts.coverage.total}` } : {}) },
    errors: Array.isArray(raw?.errors) ? raw.errors.slice(0, 8) : [],
    improved: typeof raw?.improved === 'string' ? raw.improved : '',
    tip: typeof raw?.tip === 'string' ? raw.tip : '',
  };
}

// The booklet's templates. The "improved" version must use them, so the model answer is the one Sajja memorises.
const TEMPLATES = {
  swt: 'One sentence: "The passage explains that [main idea], highlighting that [point 1] and [point 2], which suggests that [conclusion]." 30-45 words.',
  sst: 'One sentence: "The speaker discussed [topic], explaining that [point 1] and that [point 2], which shows [conclusion]." About 25 words.',
  email: `Use the FORMAL template when the register is formal, the INFORMAL one otherwise. 100-110 words. Separate paragraphs with a blank line.
FORMAL:
Dear [Name / Sir or Madam],

I am writing to [purpose taken from the prompt].

Firstly, [point 1 + one detail]. Secondly, [point 2 + one detail]. Finally, [point 3 + one detail].

I would be grateful if you could [action]. Please feel free to contact me if you need any further information. Thank you for your time and consideration.

Kind regards,
[Candidate's name]
INFORMAL:
Hi [Name],

I hope you're doing well. I'm writing to [purpose].

First of all, [point 1]. Also, [point 2]. On top of that, [point 3].

Let me know what you think. Can't wait to hear from you!

Best wishes,
[Candidate's name]`,
  di: '"The chart shows [topic]. The highest is [item] at [number]. The lowest is [item] at [number]. [One more detail or trend]. Overall, [conclusion]."',
};

// Fixed phrases the improved version must contain, word for word (the booklet's templates).
const FIXED = {
  formal: ['I am writing to', 'Firstly,', 'Secondly,', 'Finally,', 'I would be grateful if you could', 'Please feel free to contact me if you need any further information.', 'Thank you for your time and consideration.', 'Kind regards,'],
  informal: ["I hope you're doing well.", "I'm writing to", 'First of all,', 'Also,', 'On top of that,', 'Let me know what you think.', "Can't wait to hear from you!", 'Best wishes,'],
  swt: ['The passage explains that', 'highlighting that', 'which suggests that'],
  sst: ['The speaker discussed', 'explaining that', 'which shows'],
};
const norm = (t) => String(t || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
export const registerOf = (prompt) => (/Register:\s*informal/i.test(prompt || '') ? 'informal' : 'formal');

/** Template rules the improved version breaks (empty list = it follows the template). */
export function templateProblems(task, improved, prompt) {
  const key = task === 'email' ? registerOf(prompt) : task;
  if (!FIXED[key]) return [];
  const t = norm(improved);
  const out = FIXED[key].filter((ph) => !t.includes(norm(ph))).map((ph) => `missing the fixed phrase "${ph}"`);
  if (task === 'email') {
    if (/\b(Additionally|Moreover|Furthermore|Thirdly|Lastly)\b/.test(t)) out.push('adds an extra point or linker; use exactly three points (Firstly/Secondly/Finally or First of all/Also/On top of that)');
    const n = countWords(improved);
    if (n < 90 || n > 120) out.push(`is ${n} words; it must be 100-110`);
  }
  if ((task === 'swt' || task === 'sst') && (t.match(/[.!?](\s|$)/g) || []).length > 1) out.push('must be one sentence');
  return out;
}

async function authorized(req) {
  const sbUrl = process.env.SUPABASE_URL, sbKey = process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) return true;
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return false;
  const u = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: sbKey, Authorization: `Bearer ${jwt}` } });
  if (!u.ok) return false;
  const user = await u.json();
  const allowed = (process.env.ALLOWED_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return !allowed.length || allowed.includes((user.email || '').toLowerCase());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = process.env.GRADER_API_KEY;
  if (!key) return res.status(501).json({ error: 'AI grading is not configured' });
  if (!(await authorized(req))) return res.status(401).json({ error: 'Sign in first' });

  const { task, prompt, answer, reference, coverage } = req.body || {};
  const cov = coverage && Number.isFinite(coverage.hit) && Number.isFinite(coverage.total) ? { hit: coverage.hit, total: coverage.total } : null;
  if (!RUBRIC[task] || typeof answer !== 'string' || answer.length > 4000) return res.status(400).json({ error: 'Bad request' });

  const r = RUBRIC[task];
  const m = measure(task, answer);
  const judged = Object.keys(r.max).filter((k) => k !== 'form' && k !== 'spelling');
  const register = task === 'email' ? registerOf(prompt) : null;
  const bullets = task === 'email' ? (String(prompt || '').match(/Bullets:\s*(.*)/)?.[1] || '').split(';').map((b) => b.trim()).filter(Boolean) : [];
  const shape = task === 'email'
    ? `\nUse the ${register.toUpperCase()} template. ${register === 'formal' ? 'Firstly' : 'First of all'} = bullet 1${bullets[0] ? ` (${bullets[0]})` : ''}, ${register === 'formal' ? 'Secondly' : 'Also'} = bullet 2${bullets[1] ? ` (${bullets[1]})` : ''}, ${register === 'formal' ? 'Finally' : 'On top of that'} = bullet 3${bullets[2] ? ` (${bullets[2]})` : ''}. Exactly three points: no "Additionally" and no extra points. The purpose line states the request only. Do not add ideas the candidate did not write; if a bullet is missing, add one short sentence for it based on the prompt.`
    : '';
  const template = TEMPLATES[task]
    ? `\nFor "improved": rewrite the CANDIDATE'S OWN answer into this template. Keep their ideas, facts, names and any correct wording; fix the grammar. Do not invent dates, numbers or other facts. Copy the template's fixed phrases word for word, including the closing lines.${shape}\nTEMPLATE:\n${TEMPLATES[task]}`
    : '\nFor "improved": a corrected version of the candidate\'s own answer, keeping their ideas.';
  const system = `You are an experienced, strict but fair PTE Core rater. Score exactly as Pearson's descriptors say, no harsher and no kinder.
${r.text}
MEASURED BY SOFTWARE (correct, do not re-count): ${m.words} words${'form' in m ? `; form = ${m.form}/2 (already scored)` : ''}${cov ? `; the app's key-point check found ${cov.hit} of ${cov.total} main points` : ''}.${reference && task !== 'email' ? `\nREFERENCE SUMMARY (an expert answer that earns full content marks; an answer covering the same main aspects also earns 2, whatever its wording): ${String(reference).slice(0, 600)}` : ''}${r.spelling ? '\nList EVERY spelling or typing error (a misspelt or mistyped word, not a grammar error) in "spellingErrors"; spelling is scored from that count.' : ''}
Fixed template phrases (greetings, "I am writing to", "Firstly/Secondly/Finally", closing lines) are acceptable; only penalise memorised material when it replaces content about this prompt.
For each trait you score, first write a reason of at most 15 words that quotes evidence from the answer, then the score.
Return ONLY JSON in this order: {"reasons":{${judged.map((k) => `"${k}":"..."`).join(',')}},"traits":{${judged.map((k) => `"${k}":<0-${r.max[k]}>`).join(',')}},${r.spelling ? '"spellingErrors":[{"wrong":"...","right":"..."}],' : ''}"errors":[{"original":"...","fix":"...","why":"..."}],"improved":"<use \\n for line breaks>","tip":"<one sentence on the single most useful change>"}.
"errors": at most 8, the most important first (grammar, word choice, spelling). Use Canadian or British spelling for "improved".${template}`;
  const user = `TASK PROMPT:\n${String(prompt || '').slice(0, 3000)}\n\nCANDIDATE ANSWER:\n${answer}`;

  const provider = (process.env.GRADER_PROVIDER || 'anthropic').toLowerCase();
  const model = process.env.GRADER_MODEL || (provider === 'anthropic' ? 'claude-haiku-5-5' : 'openai/gpt-oss-120b');

  // One model call over a conversation; returns the text, or throws {status, error} for the client.
  async function ask(messages) {
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1800, system, messages }),
      });
      if (r.status === 404) throw { error: `Grader model "${model}" not found (404). Set GRADER_MODEL to a current model.` };
      if (!r.ok) throw { error: `Grader error (${r.status})` };
      const j = await r.json();
      return j.content?.map((c) => c.text || '').join('') || '';
    }
    const base = process.env.GRADER_BASE_URL || 'https://api.groq.com/openai/v1';
    const call = (jsonMode) => fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'system', content: system }, ...messages] }),
    });
    let r = await call(true);
    if (r.status === 400) r = await call(false); // some models reject JSON mode; the prompt already asks for JSON
    if (r.status === 404) throw { error: `Grader model "${model}" not found (404). Set GRADER_MODEL to a current model.` };
    if (!r.ok) throw { error: `Grader error (${r.status})` };
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  }
  const parse = (text) => JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

  try {
    const messages = [{ role: 'user', content: user }];
    const first = await ask(messages);
    let json = parse(first);
    let problems = templateProblems(task, json.improved, prompt);
    if (problems.length) {
      // One correction round: the model rewrites only "improved"; the scores from the first pass stand.
      try {
        const again = parse(await ask([...messages, { role: 'assistant', content: first },
          { role: 'user', content: `Your "improved" version does not follow the template: it ${problems.join('; it ')}. Rewrite ONLY "improved" so it follows the template exactly. Return ONLY JSON: {"improved":"..."}` }]));
        if (typeof again.improved === 'string') {
          const still = templateProblems(task, again.improved, prompt);
          if (still.length <= problems.length) { json.improved = again.improved; problems = still; }
        }
      } catch { /* keep the first version */ }
    }
    return res.status(200).json({ ...finalize(task, json, answer, { coverage: cov }), ...(TEMPLATES[task] ? { templateOk: problems.length === 0, templateIssues: problems } : {}) });
  } catch (e) {
    if (e && e.error) return res.status(502).json({ error: e.error });
    return res.status(502).json({ error: 'Grader returned an unreadable answer. Try again.' });
  }
}
