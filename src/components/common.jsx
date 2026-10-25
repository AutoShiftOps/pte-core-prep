import { useMemo } from 'react';

export function Diff({ res, heardLabel }) {
  if (!res) return null;
  return (
    <div className="target">
      {res.out.map((o, i) =>
        o.status === 'ok' ? <span key={i} className="w ok">{o.w}</span>
        : o.status === 'miss' ? <span key={i} className="w miss" title="Missed">{o.w}</span>
        : <span key={i} className={'w ' + o.status} title={(heardLabel || 'You wrote') + ': ' + o.typed}>{o.w}<sub>{o.typed}</sub></span>
      )}
    </div>
  );
}

export function Chip({ tone = '', children, title }) {
  return <span className={'tag ' + tone} title={title}>{children}</span>;
}

export const tone = (value, target, higherIsBetter = true) => {
  if (value == null) return '';
  const ok = higherIsBetter ? value >= target : value <= target;
  const near = higherIsBetter ? value >= target * 0.85 : value <= target * 1.5;
  return ok ? 'good' : near ? 'warn' : 'bad';
};

export function RecBar({ phase, elapsed, maxMs, label }) {
  const pctDone = Math.min(100, (elapsed / maxMs) * 100);
  const cls = phase === 'recording' ? 'rec live' : phase === 'prep' ? 'rec prep' : 'rec';
  return (
    <div className={cls} aria-live="polite">
      <div className="recstate"><span className="dot" /><span>{label}</span></div>
      <div className="progress"><i style={{ width: (phase === 'recording' || phase === 'prep' ? pctDone : phase === 'done' ? 100 : 0) + '%' }} /></div>
    </div>
  );
}

export function SpeechScores({ r, showWpm }) {
  const s = r.scores;
  return (
    <div className="tags">
      <Chip tone={r.micClosed ? 'bad' : tone(r.total ? Math.round((r.score / r.total) * 100) : 0, 90)}>Words {r.score}/{r.total}</Chip>
      {r.micClosed ? <Chip tone="bad">Mic closed: no speech within 3 s</Chip>
        : r.latencyMs != null && <Chip tone={r.latencyMs <= 1000 ? 'good' : r.latencyMs <= 2000 ? 'warn' : 'bad'}>Start {(r.latencyMs / 1000).toFixed(1)} s</Chip>}
      {s?.accuracy != null && <Chip tone={tone(s.accuracy, 85)} title="Azure pronunciation accuracy">Pronunciation {s.accuracy}</Chip>}
      {s?.fluency != null && <Chip tone={tone(s.fluency, 85)} title="Azure fluency">Fluency {s.fluency}</Chip>}
      {s?.prosody != null && <Chip tone={tone(s.prosody, 80)} title="Azure prosody: stress and intonation">Intonation {s.prosody}</Chip>}
      {showWpm && r.wpm != null && <Chip tone={r.wpm >= 120 && r.wpm <= 165 ? 'good' : 'warn'}>{r.wpm} words/min</Chip>}
      {!r.micClosed && <Chip tone={r.pauses.length === 0 ? 'good' : r.pauses.length <= 1 ? 'warn' : 'bad'}>{r.pauses.length} hesitation{r.pauses.length === 1 ? '' : 's'}</Chip>}
      {r.engine === 'browser' && <Chip>Browser scoring: words and timing only</Chip>}
    </div>
  );
}

export function useDoneMap(dayAttempts, task, focus) {
  return useMemo(() => {
    const m = {};
    for (const a of dayAttempts) if (a.task === task && !!a.focus === !!focus) m[a.item_id] = a;
    return m;
  }, [dayAttempts, task, focus]);
}

/**
 * In the exam each speaking item gets one take. When an item already has a regular attempt today, say so:
 * the first try is the one the coach report counts, and retakes are practice only.
 */
export function FirstTryNote({ dayAttempts, task, itemId, focus }) {
  if (focus) return null;
  const tries = dayAttempts.filter((a) => a.task === task && a.item_id === itemId && !a.focus);
  if (!tries.length) return null;
  const first = tries[0];
  const pct = first.total ? Math.round((first.score / first.total) * 100) : null;
  return (
    <div className={'firsttry' + (tries.length > 1 ? ' warn' : '')}>
      <b>{tries.length > 1 ? `Retake ${tries.length - 1}` : 'Done'}:</b> your first try{pct != null ? ` (${pct}% of words)` : ''} is the one that counts.
      {' '}{tries.length > 1 ? 'In the exam you get one take, so move on to the next item.' : 'A retake is practice only. In the exam you get one take.'}
    </div>
  );
}

export const KIND_LABEL = { review: 'Review: you missed this before', recycled: 'Seen before', new: 'New' };
