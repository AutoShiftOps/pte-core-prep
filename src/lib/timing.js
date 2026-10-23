// Exam timing for every non-speaking task (speaking windows live in each speaking drill).
//
// Real PTE Core (Pearson): Part 1 Speaking & Writing ~50 min, Part 2 Reading ~30 min, Part 3 Listening ~30 min.
// Individually timed in the test: Summarize Written Text 10 min, Write Email 9 min, Summarize Spoken Text 8 min.
// Reading and the short listening tasks share one section clock, so the limits below are per-item pace
// limits that fit inside it. Reading check, assuming about 6 R&W FIB, 2 multiple-choice-multiple, 3 reorder,
// 5 reading FIB and 2 single-answer items: 6×105 + 2×120 + 3×120 + 5×75 + 2×90 s ≈ 30 min.
// afterAudio: the clock starts when the recording finishes, not when the item opens.
export const PACE = {
  swt: { secs: 600, real: true },
  email: { secs: 540, real: true },
  sst: { secs: 480, real: true, afterAudio: true },
  rwfib: { secs: 105 },
  rfib: { secs: 75 },
  ro: { secs: 120 },
  wfd: { secs: 40, afterAudio: true },
  lfib: { secs: 40, afterAudio: true },
  hiw: { secs: 15, afterAudio: true },
};

/** Exam timing on: time limits auto-submit. Off (learning mode): the clock shows, turns amber, never submits. */
export const strict = (settings, focus) => settings?.examTiming !== false && !focus;

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
