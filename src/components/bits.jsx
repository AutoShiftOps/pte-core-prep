import { useEffect, useRef, useState } from 'react';
import { fmtClock } from '../lib/timing.js';

export function Nav({ idx, setIdx, n, onFinish, focus, label = 'item' }) {
  return (
    <div className="btnrow">
      <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Previous</button>
      <button className="primary" onClick={() => (idx < n - 1 ? setIdx(idx + 1) : onFinish && onFinish())}>
        {idx < n - 1 ? `Next ${label}` : focus ? 'Finish drill' : 'Back to today\'s plan'}
      </button>
    </div>
  );
}

/**
 * Countdown. With onExpire (exam timing) it calls onExpire once at 0:00 so the drill auto-submits,
 * like the real test. Without it (learning mode) it keeps counting into overtime in amber.
 */
export function Timer({ start, countdown, stopped, onExpire }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;
  useEffect(() => { fired.current = false; setNow(Date.now()); }, [start]);
  useEffect(() => {
    if (stopped) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [stopped]);
  const s = Math.max(0, Math.floor((now - start) / 1000));
  const left = countdown - s;
  useEffect(() => {
    if (stopped || fired.current || !cb.current || left > 0) return;
    fired.current = true;
    cb.current();
  }, [left, stopped]);
  const warnAt = countdown > 120 ? 60 : 10;
  if (left >= 0) {
    return <span className={'timer' + (left <= warnAt ? ' over' : '') + (onExpire ? ' strict' : '')} role="timer">{fmtClock(left)} left{onExpire ? '' : ' · learning mode'}</span>;
  }
  return <span className="timer over" role="timer">+{fmtClock(-left)} over the exam limit</span>;
}

export function Checks({ checks }) {
  return (
    <ul className="checks-list">
      {checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : c.fatal ? 'bad' : 'warn'}><span aria-hidden="true">{c.ok ? '✓' : '✗'}</span> {c.label}</li>)}
    </ul>
  );
}
