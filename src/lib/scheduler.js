// Builds each day's set: yesterday's weak items come back first, then unseen items,
// then the items you have not seen for longest. A set is saved the first time a day
// is opened, so reloading never changes it.

import { TASKS, REVIEW_SHARE } from './tasks.js';

export const PER = Object.fromEntries(Object.entries(TASKS).map(([k, t]) => [k, t.per]));
// An item counts as "weak" when its latest score ratio is below this.
export const THRESHOLD = Object.fromEntries(Object.entries(TASKS).map(([k, t]) => [k, t.threshold]));
const reviewCapFor = (n) => Math.max(1, Math.floor(n * REVIEW_SHARE));

function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededOrder(ids, seedStr) {
  const r = mulberry(hash(seedStr)), a = [...ids];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Latest result per item from attempts (focus drills included: they show improvement). */
export function itemStats(attempts, task) {
  const s = {};
  for (const a of attempts) {
    if (a.task !== task) continue;
    const ratio = a.total ? a.score / a.total : 0;
    const prev = s[a.item_id] || { seen: 0, fails: 0 };
    s[a.item_id] = { lastDay: a.day, lastRatio: ratio, seen: prev.seen + 1, fails: prev.fails + (ratio < THRESHOLD[task] ? 1 : 0) };
  }
  return s;
}

export function buildDaySet({ task, items, attempts, day, perDay = PER[task], reviewCap = reviewCapFor(perDay), threshold = THRESHOLD[task] }) {
  const prior = attempts.filter((a) => a.task === task && a.day < day);
  const stats = itemStats(prior, task);
  const valid = new Set(items.map((i) => i.id));

  const reviews = Object.entries(stats)
    .filter(([id, s]) => valid.has(id) && s.lastRatio < threshold)
    .sort((a, b) => a[1].lastRatio - b[1].lastRatio || a[1].lastDay.localeCompare(b[1].lastDay))
    .slice(0, reviewCap)
    .map(([id]) => id);

  const chosen = new Set(reviews);
  const order = seededOrder(items.map((i) => i.id), 'big-three:' + task);
  const fresh = [];
  for (const id of order) {
    if (fresh.length + reviews.length >= perDay) break;
    if (!stats[id] && !chosen.has(id)) { fresh.push(id); chosen.add(id); }
  }
  const recycle = [];
  if (reviews.length + fresh.length < perDay) {
    const old = Object.entries(stats)
      .filter(([id]) => valid.has(id) && !chosen.has(id))
      .sort((a, b) => a[1].lastDay.localeCompare(b[1].lastDay) || a[1].lastRatio - b[1].lastRatio);
    for (const [id] of old) {
      if (reviews.length + fresh.length + recycle.length >= perDay) break;
      recycle.push(id);
    }
  }
  return [
    ...reviews.map((id) => ({ id, kind: 'review' })),
    ...fresh.map((id) => ({ id, kind: 'new' })),
    ...recycle.map((id) => ({ id, kind: 'recycled' })),
  ];
}

/** How many unseen items remain, so the app can say honestly when content starts repeating. */
export function unseenCount(items, attempts, task) {
  const seen = new Set(attempts.filter((a) => a.task === task).map((a) => a.item_id));
  return items.filter((i) => !seen.has(i.id)).length;
}
