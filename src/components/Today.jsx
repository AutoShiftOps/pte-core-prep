import { TASKS, SECTIONS } from '../lib/tasks.js';
import { Chip } from './common.jsx';

/** Today's booklet plan with live progress; every row opens its drill. */
export default function Today({ plan, sets, doneCounts, open, last }) {
  const planned = Object.entries(plan.counts);
  const totalPlanned = planned.reduce((a, [, n]) => a + n, 0);
  const totalDone = planned.reduce((a, [k, n]) => a + Math.min(n, doneCounts[k] || 0), 0);
  return (
    <div className="stack">
      {last && (
        <section className="card start">
          <div className="cardhead"><h2>Start here: your last coach report</h2><span className="muted small">{last.label}</span></div>
          {last.headline && <p><b>{last.headline}</b></p>}
          <p className="small muted">About 15 minutes: spelling sprint, a focus drill on your top mistake, then the word workout. Drills you run there count as today's extra practice.</p>
          <div className="btnrow"><button className="primary" onClick={last.open}>Open the report</button></div>
        </section>
      )}
      <section className="card">
        <div className="cardhead"><h2>Today's plan</h2><span className="muted small">{totalDone}/{totalPlanned} items · booklet Day {plan.n}</span></div>
        {plan.note && <div className="focusbox"><div className="eyebrow">From your booklet</div><p>{plan.note}</p></div>}
        {planned.length === 0 && <p className="muted">No app drills today. Use the Practice tab if you want extra work.</p>}
        <div className="planlist">
          {planned.map(([k, n]) => {
            const d = Math.min(n, doneCounts[k] || 0);
            return (
              <button key={k} className={'planrow' + (d >= n ? ' done' : '')} onClick={() => open(k)}>
                <span className="pr-name"><b>{TASKS[k].label}</b><span className="small muted">{TASKS[k].section} · feeds {TASKS[k].skills.map((s) => ({ L: 'listening', R: 'reading', W: 'writing', S: 'speaking' }[s])).join(' + ')}</span></span>
                <span className="pr-n">{d}/{n}</span>
                <span className="bar"><i style={{ width: (d / n) * 100 + '%' }} /></span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="card">
        <div className="cardhead"><h2>All tasks</h2><span className="muted small">Extra practice beyond the plan</span></div>
        {SECTIONS.map((sec) => (
          <div key={sec} className="secrow">
            <div className="eyebrow">{sec}</div>
            <div className="btnrow">
              {Object.entries(TASKS).filter(([, t]) => t.section === sec).map(([k, t]) => (
                <button key={k} onClick={() => open(k)}>{t.label} {doneCounts[k] ? <Chip>{doneCounts[k]}</Chip> : null}</button>
              ))}
            </div>
          </div>
        ))}
        <p className="small muted">Not in the app: full section mocks and multiple-choice tasks. Use the official Pearson practice and your practice platform for those, as the booklet says.</p>
      </section>
    </div>
  );
}
