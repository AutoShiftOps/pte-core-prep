import { useEffect, useMemo, useState } from 'react';
import { RULES, optionsFor, ownSourceLabel } from '../lib/grammar.js';
import { fmtShort } from '../lib/plan.js';
import { Chip, useDoneMap, KIND_LABEL } from './common.jsx';
import { Nav } from './bits.jsx';

// Grammar gym: one question at a time. Tap (or press 1–3) to answer; the rule and the reason show at once.
export default function GramDrill({ items, bank, day, dayAttempts, onAttempt, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, 'gram', focus);
  const first = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(first < 0 ? 0 : first);
  const item = items[idx];
  const q = item.q || bank[item.id];
  const opts = useMemo(() => (q ? optionsFor(q) : []), [q]);
  const [chosen, setChosen] = useState(null);

  useEffect(() => { setChosen(doneMap[item.id]?.meta?.chosen ?? null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [idx]);

  async function pick(o) {
    if (chosen != null || !q) return;
    setChosen(o);
    await onAttempt({ day, task: 'gram', item_id: item.id, focus, response: o, score: o === q.a ? 1 : 0, total: 1,
      meta: { rule: q.rule, chosen: o, answer: q.a, own: q.own || null } });
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= opts.length) pick(opts[n - 1]);
      else if (e.key === 'Enter' && chosen != null) (idx < items.length - 1 ? setIdx(idx + 1) : onFinish && onFinish());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const doneCount = items.filter((it) => doneMap[it.id]).length;
  const right = items.filter((it) => doneMap[it.id]?.score >= 1).length;
  if (!q) return <section className="card"><p className="muted">This question is no longer available. <button onClick={() => setIdx(Math.min(items.length - 1, idx + 1))}>Next</button></p></section>;
  const ok = chosen != null && chosen === q.a;
  const parts = q.q.split('___');

  return (
    <section className="card">
      <div className="cardhead"><h2>Grammar gym{focus ? ' · redo' : ''}</h2><span className="muted small">Question {idx + 1} of {items.length} · {doneCount} done{doneCount ? ` · ${right} right` : ''}</span></div>
      <div className="how"><b>Grammar.</b> Pick the word that makes the sentence correct (tap, or press 1–{opts.length}). "—" means no word. Your own mistakes come first and return until you get them right.</div>
      <div className="tags">
        <Chip>{RULES[q.rule]?.label || q.rule}</Chip>
        {q.own ? <Chip tone="warn">{ownSourceLabel({ ...q.own, day: fmtShort(q.own.day) })}</Chip> : item.kind && item.kind !== 'new' ? <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind] || item.kind}</Chip> : null}
      </div>
      <p className="gramq">{parts[0]}<span className={'gap' + (chosen != null ? (ok ? ' ok' : ' bad') : '')}>{chosen != null ? q.a : '      '}</span>{parts.slice(1).join('___')}</p>
      <div className="gramopts">
        {opts.map((o, i) => (
          <button key={o} className={chosen == null ? '' : o === q.a ? 'ok' : o === chosen ? 'bad' : 'dim'} onClick={() => pick(o)} disabled={chosen != null}>
            <span className="k">{i + 1}</span> {o}
          </button>
        ))}
      </div>
      {chosen != null && (
        <div className={'summary gramwhy ' + (ok ? 'okc' : 'warnc')}>
          <p><b>{ok ? 'Correct.' : `Not quite: the answer is "${q.a}".`}</b> {q.why}</p>
          {RULES[q.rule] && <p className="small muted">Rule: {RULES[q.rule].tip}</p>}
        </div>
      )}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} label="question" />
    </section>
  );
}
