const env = import.meta.env || {};

export const PLAN_START = env.VITE_PLAN_START || '2026-10-17'; // Day 1 of Mission CLB 10
export const EXAM_DATE = env.VITE_EXAM_DATE || '2026-11-21';   // PTE Core attempt 1

export function toISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const todayISO = () => toISO(new Date());
export function addDays(s, n) {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
export const dayNumber = (s) => diffDays(PLAN_START, s) + 1;
export const fmtLong = (s) => fromISO(s).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
export const fmtShort = (s) => fromISO(s).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
export function dayRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
