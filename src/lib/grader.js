// Client for the optional AI grader (/api/grade). Returns null when it is not configured.
let jwtProvider = async () => null;
let available = null; // null = unknown, true/false after first call

export function setGraderJwt(fn) { jwtProvider = fn; }
export const graderKnownOff = () => available === false;

export async function gradeAnswer(task, prompt, answer) {
  if (available === false) return null;
  const jwt = await jwtProvider();
  const r = await fetch('/api/grade', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) },
    body: JSON.stringify({ task, prompt, answer }),
  }).catch(() => null);
  if (!r || r.status === 501 || r.status === 404) { available = false; return null; }
  available = true;
  const j = await r.json().catch(() => ({ error: 'Unreadable response' }));
  if (!r.ok) return { error: j.error || 'Grading failed' };
  return j;
}
