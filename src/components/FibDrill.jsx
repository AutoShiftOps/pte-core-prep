import { useEffect, useMemo, useState } from 'react';
import { parseBlanks, shuffleFor, chunkAround } from '../lib/derived.js';
import { scoreBlanks } from '../lib/judge.js';
import { Chip, useDoneMap, KIND_LABEL } from './common.jsx';
import { Nav, Timer } from './bits.jsx';
import { PACE, strict } from '../lib/timing.js';

// R&W Fill in the Blanks (dropdown) and Reading Fill in the Blanks (word box).
export default function FibDrill({ task, items, bank, day, dayAttempts, onAttempt, settings, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, task, focus);
  const first = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(first < 0 ? 0 : first);
  const item = items[idx];
  const src = bank[item.id];
  const parts = useMemo(() => parseBlanks(src.text), [src]);
  const blanks = parts.filter((p) => typeof p !== 'string');
  const box = useMemo(() => (task === 'rfib' ? shuffleFor([...blanks.map((b) => b.answer), ...src.extras], src.id) : []), [src, task, blanks]);
  const [chosen, setChosen] = useState([]);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState(null);
  const [t0, setT0] = useState(Date.now());

  useEffect(() => {
    const prev = doneMap[item.id];
    const c = prev ? (prev.meta?.chosen || []) : [];
    setChosen(c);
    setResult(prev ? scoreBlanks(blanks.map((b) => b.answer), c) : null);
    setActive(0);
    setT0(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function place(word) {
    if (result) return;
    const next = [...chosen];
    const existing = next.indexOf(word);
    if (existing >= 0) next[existing] = undefined;
    next[active] = word;
    setChosen(next);
    const empty = blanks.findIndex((_, i) => !next[i]);
    setActive(empty < 0 ? active : empty);
  }

  async function check(timedOut = false) {
    if (result) return;
    const res = { ...scoreBlanks(blanks.map((b) => b.answer), chosen), timedOut };
    setResult(res);
    const missChunks = res.results.map((r, i) => (!r.ok ? { phrase: chunkAround(parts, i), answer: r.answer, chosen: r.chosen } : null)).filter(Boolean);
    await onAttempt({
      day, task, item_id: item.id, focus, response: chosen.map((c) => c || '').join('|'), score: res.score, total: res.total,
      meta: { chosen, timedOut, seconds: Math.round((Date.now() - t0) / 1000), missChunks },
    });
  }

  const used = new Set(chosen.filter(Boolean));
  const doneCount = items.filter((it) => doneMap[it.id]).length;

  return (
    <section className="card">
      <div className="cardhead">
        <h2>{task === 'rwfib' ? 'R&W Fill in the Blanks' : 'Reading Fill in the Blanks'}{focus ? ' · focus drill' : ''}</h2>
        <span className="muted small">Passage {idx + 1} of {items.length} · {doneCount} done</span>
      </div>
      <div className="how">
        {task === 'rwfib'
          ? <><b>Reading + writing.</b> Pick the word that fits both the grammar and the meaning. Read the words on both sides of the gap: most answers are fixed word pairs ("rely on", "pave the way").</>
          : <><b>Reading.</b> Tap a gap, then tap a word from the box. Three words in the box don't belong anywhere. Decide the part of speech first (noun, verb, adjective), then the meaning.</>}
      </div>
      <div className="btnrow">{!result && <Timer start={t0} countdown={PACE[task].secs} stopped={!!result} onExpire={strict(settings, focus) ? () => check(true) : undefined} />}{item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}</div>
      <div className="passage fib">
        {parts.map((p, k) => {
          if (typeof p === 'string') return <span key={k}>{p}</span>;
          const i = p.blank;
          const r = result?.results[i];
          if (task === 'rwfib') {
            return (
              <select key={k} id={`gap-${i}`} aria-label={`Gap ${i + 1}`} className={'gap' + (r ? (r.ok ? ' ok' : ' bad') : '')} value={chosen[i] || ''} disabled={!!result}
                onChange={(e) => { const n = [...chosen]; n[i] = e.target.value; setChosen(n); }}>
                <option value="">▾</option>
                {shuffleFor(p.options, src.id + i).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          }
          return (
            <button key={k} className={'gap slot' + (active === i && !result ? ' active' : '') + (r ? (r.ok ? ' ok' : ' bad') : '')} onClick={() => { if (result) return; if (chosen[i]) { const n = [...chosen]; n[i] = undefined; setChosen(n); } setActive(i); }}>
              {chosen[i] || ' '.repeat(10)}
            </button>
          );
        })}
      </div>
      {task === 'rfib' && !result && (
        <div className="wordbox">{box.map((w) => <button key={w} disabled={used.has(w)} onClick={() => place(w)}>{w}</button>)}</div>
      )}
      {!result
        ? <div className="btnrow"><button className="primary" onClick={() => check()} disabled={chosen.filter(Boolean).length === 0}>Check</button></div>
        : (
          <div className="summary">
            <div className="btnrow"><span className="score">{result.score} / {result.total}</span><span className="muted">{result.score === result.total ? 'All correct.' : 'Missed word pairs go to your Word pairs list.'}</span>{result.timedOut && <Chip tone="warn">Time's up: auto-submitted</Chip>}</div>
            {result.results.filter((r) => !r.ok).map((r, i) => (
              <p key={i} className="small">Gap: <b>{r.answer}</b>{r.chosen ? <> · you chose <s>{r.chosen}</s></> : ' · left empty'} · pair: <span className="mono">{chunkAround(parts, result.results.indexOf(r))}</span></p>
            ))}
          </div>
        )}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} />
    </section>
  );
}
