import { useMemo } from 'react';
import { computeTrend, TARGETS, buildWeekScorecard, weekOf } from '../lib/coach.js';
import { fmtShort as fs } from '../lib/plan.js';
import { unseenCount } from '../lib/scheduler.js';
import { PLAN_START, fmtShort, dayNumber } from '../lib/plan.js';
import { tone } from './common.jsx';

const cell = (v, target, unit = '%') => <td className={'num ' + tone(v, target)}>{v == null ? '–' : v + unit}</td>;

export default function Trends({ attempts, banks, items, today }) {
  const rows = useMemo(() => computeTrend(attempts, banks, PLAN_START, today).reverse(), [attempts, banks, today]);
  const active = rows.filter((r) => r.done > 0);
  const last7 = active.slice(0, 7);
  const avg = (k) => { const v = last7.map((r) => r[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const ready = ['wfd', 'rsContent', 'rsFast'].every((k) => avg(k) != null) && avg('wfd') >= TARGETS.wfd && avg('rsContent') >= TARGETS.rsContent && avg('rsFast') >= TARGETS.rsFast;

  const weeks = useMemo(() => Array.from({ length: Math.max(1, weekOf(today)) }, (_, i) => buildWeekScorecard(attempts, banks, i + 1)).reverse(), [attempts, banks, today]);

  return (
    <div className="stack">
      <section className="card">
        <div className="cardhead"><h2>Weekly scorecard</h2><span className="muted small">Fills itself and saves after every attempt</span></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Week</th><th>Days done</th><th>Dictation</th><th>Fast starts</th><th>Listening</th><th>Reading</th><th>Writing</th><th>Speaking</th><th>Biggest win</th><th>Biggest leak</th></tr></thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td>{w.week} <span className="small muted">({fs(w.from)}–{fs(w.to)})</span></td>
                  <td className="num">{w.fullDays}/7 <span className="small muted">({w.activeDays} active)</span></td>
                  {cell(w.wfdAccuracy, TARGETS.wfd)}{cell(w.rsFastPct, TARGETS.rsFast)}
                  {cell(w.skills.Listening, 90)}{cell(w.skills.Reading, 90)}{cell(w.skills.Writing, 90)}{cell(w.skills.Speaking, 90)}
                  <td className="small">{w.biggestWin || '–'}</td><td className="small">{w.biggestLeak || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Days done = days with the full Big Three. Skill columns are a practice index (average score of the tasks that feed each PTE skill), not a PTE score.</p>
      </section>
      <section className="card">
        <div className="cardhead"><h2>Last 7 practice days</h2><span className="muted small">{active.length} days logged in total</span></div>
        <div className="kpis four">
          <div className="kpi"><div className="eyebrow">Dictation</div><div className={'n ' + tone(avg('wfd'), TARGETS.wfd)}>{avg('wfd') ?? '–'}%</div></div>
          <div className="kpi"><div className="eyebrow">Repeat: words</div><div className={'n ' + tone(avg('rsContent'), TARGETS.rsContent)}>{avg('rsContent') ?? '–'}%</div></div>
          <div className="kpi"><div className="eyebrow">Repeat: fast starts</div><div className={'n ' + tone(avg('rsFast'), TARGETS.rsFast)}>{avg('rsFast') ?? '–'}%</div></div>
          <div className="kpi"><div className="eyebrow">Read Aloud: pronunciation</div><div className={'n ' + tone(avg('raAccuracy'), TARGETS.raAccuracy)}>{avg('raAccuracy') ?? '–'}</div></div>
        </div>
        <p className="small">{ready ? 'Your last 7 days meet the dictation and repeat-sentence targets. Confirm with an official Scored Practice Test.' : 'Readiness signal: dictation 95%+, repeat words 90%+ and fast starts 90%+ held across 7 practice days.'}</p>
      </section>
      <section className="card">
        <div className="cardhead"><h2>Day by day</h2></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Day</th><th>Date</th><th>Items</th><th>Dictation</th><th>Repeat words</th><th>Fast starts</th><th>Repeat fluency</th><th>Read words</th><th>Pronun.</th><th>Fluency</th><th>Pace</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <td className="num">{dayNumber(r.day)}</td><td>{fmtShort(r.day)}</td><td className="num">{r.done}</td>
                  {cell(r.wfd, TARGETS.wfd)}{cell(r.rsContent, TARGETS.rsContent)}{cell(r.rsFast, TARGETS.rsFast)}{cell(r.rsFluency, TARGETS.rsFluency, '')}
                  {cell(r.raContent, TARGETS.raContent)}{cell(r.raAccuracy, TARGETS.raAccuracy, '')}{cell(r.raFluency, TARGETS.raFluency, '')}
                  <td className="num">{r.wpm ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="cardhead"><h2>Content left</h2></div>
        <p className="small">Unseen items: dictation <b>{unseenCount(items.wfd, attempts, 'wfd')}</b> of {items.wfd.length}, repeat sentence <b>{unseenCount(items.rs, attempts, 'rs')}</b> of {items.rs.length}, read aloud <b>{unseenCount(items.ra, attempts, 'ra')}</b> of {items.ra.length}. When an area runs out, the oldest items come back. Repetition is useful for these tasks; to add items, append to <span className="mono">src/content/</span>.</p>
      </section>
    </div>
  );
}
