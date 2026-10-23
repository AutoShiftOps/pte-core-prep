// The Mission CLB 10 booklet, day by day, as practice counts the app can load.
// bt: 'full' = Big Three (20 dictation, 10 repeat, 5 read aloud), 'light' = taper, false = none.
// extra: additional items on top of the Big Three. note: anything that happens outside the app.
import { dayNumber } from './plan.js';

const FULL = { wfd: 20, rs: 10, ra: 5 };
const LIGHT = { wfd: 10, rs: 5, ra: 3 };

export const BOOKLET = {
  1: { bt: false, note: 'Official PTE Core Scored Practice Test 1 at 9:00 a.m. Log the four scores; nothing else today.' },
  2: { bt: 'full', note: 'Book attempt 1 for Nov 21. Say the Personal Introduction aloud 10 times.' },
  3: { bt: 'full', extra: { ra: 10, asq: 10 } },
  4: { bt: 'full', extra: { rs: 20, di: 5 } },
  5: { bt: 'full', extra: { di: 5, rts: 5 } },
  6: { bt: 'full', extra: { swt: 2, email: 1 } },
  7: { bt: 'full', extra: { rwfib: 15, rfib: 10 }, note: 'Weekly review: your scorecard and word-pair list fill themselves. Check them in Trends and Word pairs.' },
  8: { bt: false, extra: { ra: 15, rs: 20, di: 6, rts: 6, sst: 5 }, note: 'Coach session 1: bring 3 Read Aloud, 3 Repeat Sentence and 2 Describe Image recordings.' },
  9: { bt: 'full', extra: { ro: 10, hiw: 10, lfib: 10 }, note: 'Reading section mock on your practice platform at 9:00 a.m.' },
  10: { bt: 'full', extra: { di: 5, asq: 10 } },
  11: { bt: 'full', extra: { email: 2 } },
  12: { bt: 'full', extra: { sst: 3, hiw: 10, lfib: 10 } },
  13: { bt: 'full', extra: { rts: 3 }, note: 'MBA assignment window starts: 45 minutes is enough.' },
  14: { bt: 'full', extra: { rwfib: 10 } },
  15: { bt: false, note: 'Speaking & Writing section mock on your practice platform, then redo the 3 weakest items.' },
  16: { bt: 'full', note: 'Clocks go back. Reading + Listening section mocks on your practice platform.' },
  17: { bt: 'full', extra: { di: 3 } },
  18: { bt: 'full', extra: { swt: 1 }, note: 'Express Entry recalculation starts today.' },
  19: { bt: 'full', extra: { rts: 3 } },
  20: { bt: 'full', extra: { sst: 2 } },
  21: { bt: 'full', extra: { ro: 5, hiw: 5 } },
  22: { bt: false, note: 'Full 2-hour mock on your practice platform at 9:00 a.m., then coach session 2.' },
  23: { bt: 'full', note: 'Targeted drills on your two most expensive error types: use the focus drills in the Coach report.' },
  24: { bt: 'full', note: 'Add 15 minutes on your weakest task (see Trends).' },
  25: { bt: 'full', extra: { email: 1 } },
  26: { bt: 'full', note: 'MBA assignment due: Big Three only.' },
  27: { bt: 'full', extra: { rs: 20, asq: 10, di: 5 } },
  28: { bt: 'full', extra: { swt: 2, sst: 2 }, note: 'Check your Express Entry score includes the high-wage points.' },
  29: { bt: false, note: 'Official Scored Practice Test 2 at 9:00 a.m. Decide: keep Nov 21 or move to Dec 19.' },
  30: { bt: 'full', note: '90 minutes on your bottom two task types from yesterday\'s official test.' },
  31: { bt: 'full', extra: { di: 5, rts: 5, asq: 10 }, note: 'Full speaking run without stopping.' },
  32: { bt: 'full', note: 'Coach session 3: ask for the one habit to change before Saturday.' },
  33: { bt: false, extra: { wfd: 10 }, note: 'Speaking & Writing section mock at your exam time.' },
  34: { bt: 'light', note: 'Taper: no new material. Plan your route to the test centre.' },
  35: { bt: false, extra: { di: 1, rts: 1 }, note: 'Rest. Personal Introduction 3 times. Pack passport and booking confirmation. Lights out by 10:30 p.m.' },
  36: { bt: false, note: 'Exam day. Follow the exam-day protocol in your booklet.' },
};

/** Counts per task for a date: the booklet's plan, or the Big Three after the plan ends. */
export function planFor(day) {
  const n = dayNumber(day);
  const p = BOOKLET[n] || (n > 36 ? { bt: 'full', note: 'After attempt 1: Big Three daily, plus your weakest task (see Trends).' } : { bt: false, note: 'Before the plan starts.' });
  const counts = { ...(p.bt === 'full' ? FULL : p.bt === 'light' ? LIGHT : {}) };
  for (const [k, v] of Object.entries(p.extra || {})) counts[k] = (counts[k] || 0) + v;
  return { n, counts, note: p.note || '', bt: p.bt };
}
