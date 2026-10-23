// Optional AI grader for open answers (summaries, email, spoken responses).
// Enabled only when GRADER_API_KEY is set. Providers:
//   GRADER_PROVIDER=anthropic  (default model claude-haiku-5-5)
//   GRADER_PROVIDER=groq       (OpenAI-compatible; default model llama-3.3-70b-versatile)
// Same sign-in check as /api/speech-token.

const TASK_RULES = {
  swt: 'PTE Core Summarize Written Text: one sentence, 25-50 words. Traits: content (0-2), form (0-1), grammar (0-2), vocabulary (0-2).',
  sst: 'PTE Core Summarize Spoken Text: 20-30 words summary of a lecture. Traits: content (0-2), form (0-2), grammar (0-2), vocabulary (0-2), spelling (0-2).',
  email: 'PTE Core Write Email: 80-120 words covering all three bullet points in the right register. Traits: content (0-3), email conventions (0-2), form (0-2), organization (0-2), grammar (0-2), vocabulary (0-2), spelling (0-2).',
  rts: 'PTE Core Respond to a Situation (spoken, transcribed by speech recognition, so ignore punctuation and minor transcription errors). Trait: appropriacy (0-6): does it address the situation, use the right register, and sound natural.',
  di: 'PTE Core Describe Image (spoken, transcribed by speech recognition, so ignore punctuation). Trait: content (0-6): main feature, key details with numbers, comparison or trend, conclusion.',
};

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

  const { task, prompt, answer } = req.body || {};
  if (!TASK_RULES[task] || typeof answer !== 'string' || answer.length > 4000) return res.status(400).json({ error: 'Bad request' });

  const system = `You are a strict, fair PTE Core rater. ${TASK_RULES[task]}
Return ONLY JSON: {"traits":{"<trait>":<number>,...},"max":{"<trait>":<number>,...},"errors":[{"original":"...","fix":"...","why":"..."}],"improved":"<a corrected version of the answer, same length limits>","tip":"<one sentence on the single most useful change>"}.
List at most 5 errors (grammar, spelling, word choice). Use Canadian or British spelling for "improved".`;
  const user = `TASK PROMPT:\n${String(prompt || '').slice(0, 3000)}\n\nCANDIDATE ANSWER:\n${answer}`;

  const provider = (process.env.GRADER_PROVIDER || 'anthropic').toLowerCase();
  let text;
  try {
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.GRADER_MODEL || 'claude-haiku-5-5', max_tokens: 900, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!r.ok) return res.status(502).json({ error: `Grader error (${r.status})` });
      const j = await r.json();
      text = j.content?.map((c) => c.text || '').join('') || '';
    } else {
      const base = process.env.GRADER_BASE_URL || 'https://api.groq.com/openai/v1';
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.GRADER_MODEL || 'llama-3.3-70b-versatile', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!r.ok) return res.status(502).json({ error: `Grader error (${r.status})` });
      const j = await r.json();
      text = j.choices?.[0]?.message?.content || '';
    }
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return res.status(200).json(json);
  } catch (e) {
    return res.status(502).json({ error: 'Grader returned an unreadable answer. Try again.' });
  }
}
