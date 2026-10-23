import { useEffect, useMemo, useState } from 'react';
import { speak, stopVoice, voiceFor, voiceLabel } from '../lib/voice.js';
import { scoreBlanks, scoreHiw } from '../lib/judge.js';
import { canon } from '../lib/score.js';
import { Chip, useDoneMap, KIND_LABEL } from './common.jsx';
import { Nav, Timer } from './bits.jsx';
import { PACE, strict } from '../lib/timing.js';

function useItem(items, dayAttempts, task, focus) {
  const doneMap = useDoneMap(dayAttempts, task, focus);
  const first = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(first < 0 ? 0 : first);
  return { doneMap, idx, setIdx, item: items[idx], doneCount: items.filter((it) => doneMap[it.id]).length };
}

function PlayOnce({ text, id, settings, engine, onEnd, label = '▶ Play recording' }) {
  const [state, setState] = useState('idle');
  useEffect(() => () => stopVoice(), []);
  const once = settings.examRules;
  return (
    <div className="btnrow">
      <button className="primary big" disabled={state === 'playing' || (once && state === 'done')} onClick={async () => {
        setState('playing');
        await speak(text, { engine, voice: voiceFor(id, settings), rate: settings.rate });
        setState('done'); onEnd && onEnd();
      }}>{state === 'playing' ? 'Playing…' : label}</button>
      <span className="muted small">{once ? 'Plays once, like the test.' : 'Practice mode: replay as needed.'}{engine === 'azure' ? ' · ' + voiceLabel(voiceFor(id, settings)) : ''}</span>
    </div>
  );
}

// ---------- Listening: Fill in the Blanks ----------
export function LfibDrill({ items, bank, day, dayAttempts, onAttempt, settings, engine, focus = false, onFinish }) {
  const { doneMap, idx, setIdx, item, doneCount } = useItem(items, dayAttempts, 'lfib', focus);
  const src = bank[item.id];
  const gaps = src.tokens.filter((t) => typeof t !== 'string');
  const [vals, setVals] = useState([]);
  const [res, setRes] = useState(null);
  const [heardAt, setHeardAt] = useState(0);
  useEffect(() => {
    const prev = doneMap[item.id];
    setHeardAt(0);
    const v = prev?.meta?.typed || [];
    setVals(v); setRes(prev ? scoreBlanks(gaps.map((g) => g.answer), v) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  async function check(timedOut = false) {
    if (res) return;
    const r = { ...scoreBlanks(gaps.map((g) => g.answer), vals.map((v) => (v || '').trim())), timedOut };
    setRes(r);
    await onAttempt({ day, task: 'lfib', item_id: item.id, focus, response: vals.join('|'), score: r.score, total: r.total,
      meta: { typed: vals, timedOut, errors: r.results.filter((x) => !x.ok).map((x) => ({ word: x.answer, typed: x.chosen })) } });
  }
  let g = -1;
  return (
    <section className="card">
      <div className="cardhead"><h2>Listening Fill in the Blanks{focus ? ' · focus drill' : ''}</h2><span className="muted small">Passage {idx + 1} of {items.length} · {doneCount} done</span></div>
      <div className="how"><b>Listening + writing.</b> Skim the text first, then play. Type each missing word exactly as you hear it. Spelling must be perfect: a misspelt word scores zero.</div>
      {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      <PlayOnce key={item.id} text={src.text} id={item.id} settings={settings} engine={engine} onEnd={() => setHeardAt((h) => h || Date.now())} />
      {heardAt > 0 && !res && <div className="btnrow"><Timer start={heardAt} countdown={PACE.lfib.secs} onExpire={strict(settings, focus) ? () => check(true) : undefined} /></div>}
      <div className="passage fib">
        {src.tokens.map((t, k) => {
          if (typeof t === 'string') return <span key={k}>{t}</span>;
          g += 1; const i = g; const r = res?.results[i];
          return (
            <span key={k}>{t.lead}
              <input type="text" id={`lf-${i}`} aria-label={`Gap ${i + 1}`} className={'gapin' + (r ? (r.ok ? ' ok' : ' bad') : '')} value={vals[i] || ''} disabled={!!res}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                onChange={(e) => { const n = [...vals]; n[i] = e.target.value; setVals(n); }} />
              {r && !r.ok && <sub className="fix">{r.answer}</sub>}{t.punct}
            </span>
          );
        })}
      </div>
      {!res ? <div className="btnrow"><button className="primary" onClick={() => check()}>Check</button></div>
        : <div className="btnrow"><span className="score">{res.score} / {res.total}</span>{res.timedOut && <Chip tone="warn">Time's up: auto-submitted</Chip>}<button onClick={() => speak(src.text, { engine, voice: voiceFor(item.id, settings), rate: settings.rate })}>Hear it again</button></div>}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} label="passage" />
    </section>
  );
}

// ---------- Highlight Incorrect Words ----------
export function HiwDrill({ items, bank, day, dayAttempts, onAttempt, settings, engine, focus = false, onFinish }) {
  const { doneMap, idx, setIdx, item, doneCount } = useItem(items, dayAttempts, 'hiw', focus);
  const src = bank[item.id];
  const [clicked, setClicked] = useState(new Set());
  const [res, setRes] = useState(null);
  const [heardAt, setHeardAt] = useState(0);
  useEffect(() => {
    const prev = doneMap[item.id];
    setHeardAt(0);
    const c = new Set(prev?.meta?.clicked || []);
    setClicked(c); setRes(prev ? scoreHiw(src.tokens, c) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  async function check(timedOut = false) {
    if (res) return;
    const r = { ...scoreHiw(src.tokens, clicked), timedOut };
    setRes(r);
    await onAttempt({ day, task: 'hiw', item_id: item.id, focus, response: [...clicked].join(','), score: r.score, total: r.total,
      meta: { clicked: [...clicked], timedOut, wrongClicks: r.bad, missed: r.missed, pairs: src.tokens.filter((t) => t.wrong).map((t) => ({ shown: t.t, said: t.said })) } });
  }
  return (
    <section className="card">
      <div className="cardhead"><h2>Highlight Incorrect Words{focus ? ' · focus drill' : ''}</h2><span className="muted small">Passage {idx + 1} of {items.length} · {doneCount} done</span></div>
      <div className="how"><b>Listening + reading.</b> Follow the text while the audio plays and click each word that is different from what you hear. Each wrong click takes a point away, so only click when you are sure. Click while the audio plays: you get {PACE.hiw.secs} seconds after it ends.</div>
      {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      <PlayOnce key={item.id} text={src.audio} id={item.id} settings={settings} engine={engine} onEnd={() => setHeardAt((h) => h || Date.now())} />
      {heardAt > 0 && !res && <div className="btnrow"><Timer start={heardAt} countdown={PACE.hiw.secs} onExpire={strict(settings, focus) ? () => check(true) : undefined} /></div>}
      <div className="passage hiw">
        {src.tokens.map((t, i) => {
          if (!/\S/.test(t.t)) return <span key={i}>{t.t}</span>;
          const on = clicked.has(i);
          const cls = res ? (t.wrong ? (on ? 'hit' : 'missed') : on ? 'false' : '') : on ? 'on' : '';
          return (
            <span key={i} role="button" tabIndex={0} className={'hw ' + cls}
              onClick={() => { if (res) return; const n = new Set(clicked); n.has(i) ? n.delete(i) : n.add(i); setClicked(n); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}>
              {t.t}{res && t.wrong && <sub className="fix">{t.said}</sub>}
            </span>
          );
        })}
      </div>
      {!res ? <div className="btnrow"><button className="primary" onClick={() => check()}>Check</button></div>
        : <div className="btnrow"><span className="score">{res.score} / {res.total}</span><span className="muted small">{res.good} found · {res.missed} missed · {res.bad} wrong clicks</span>{res.timedOut && <Chip tone="warn">Time's up: auto-submitted</Chip>}</div>}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} label="passage" />
    </section>
  );
}

// ---------- Reorder Paragraph ----------
export function ReorderDrill({ items, bank, day, dayAttempts, onAttempt, settings, focus = false, onFinish }) {
  const { doneMap, idx, setIdx, item, doneCount } = useItem(items, dayAttempts, 'ro', focus);
  const src = bank[item.id];
  const shuffled = useMemo(() => {
    let order = src.sentences.map((_, i) => i);
    for (let k = 0; k < 6; k++) {
      order = order.map((v) => ({ v, r: canon(src.sentences[v]).length * 7919 % (13 + k) + Math.sin(v * 12.9898 + k + src.id.length) })).sort((a, b) => a.r - b.r).map((x) => x.v);
      if (order.some((v, i) => v !== i)) break;
    }
    if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]];
    return order;
  }, [src]);
  const [answer, setAnswer] = useState([]);
  const [res, setRes] = useState(null);
  const [t0, setT0] = useState(Date.now());
  useEffect(() => {
    const prev = doneMap[item.id];
    setT0(Date.now());
    setAnswer(prev?.meta?.order || []);
    setRes(prev ? { score: prev.score, total: prev.total } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  async function check(timedOut = false) {
    if (res) return;
    let score = 0;
    for (let i = 0; i < answer.length - 1; i++) if (answer[i + 1] === answer[i] + 1) score++;
    const r = { score, total: src.sentences.length - 1, timedOut };
    setRes(r);
    await onAttempt({ day, task: 'ro', item_id: item.id, focus, response: answer.join(','), score: r.score, total: r.total,
      meta: { order: answer, firstOk: answer[0] === 0, timedOut, seconds: Math.round((Date.now() - t0) / 1000) } });
  }
  const left = shuffled.filter((v) => !answer.includes(v));
  return (
    <section className="card">
      <div className="cardhead"><h2>Reorder Paragraph{focus ? ' · focus drill' : ''}</h2><span className="muted small">Item {idx + 1} of {items.length} · {doneCount} done</span></div>
      <div className="how">
        <b>Reading.</b> Tap the sentences in the right order (tap a placed sentence to remove it). Points come from correct neighbouring pairs, so one misplaced sentence can cost every point.
        <details className="tips"><summary>How to find the order: 5 tests</summary>
          <ol>
            <li><b>Opener</b> (first 20 s): it needs nothing before it. Reject sentences with <i>however, this, these, such, they, it</i>, <i>the + a noun already mentioned</i> ("the decline") or <i>causes / effects</i> of something unnamed. An opener often names the topic in full ("Pollinators such as bees…") or gives an old view ("Wetlands were <b>once</b> considered…").</li>
            <li><b>Pronouns</b>: a sentence with <i>it, they, them, this, these</i> goes right after the sentence that names that noun. "Before <b>it</b> existed" comes straight after "the printing press".</li>
            <li><b>Time</b>: before → when / once → after / since then → now / today. "Once" has two meanings: <i>as soon as</i> (after a change, later) or <i>in the past</i> (the old view, early). Swap in "as soon as" or "in the past" to tell them apart.</li>
            <li><b>Claim → evidence</b>: the claim (<i>most valuable, essential, a major problem</i>) comes before the sentence listing what something does or examples that prove it.</li>
            <li><b>Problem → causes → effects → solution</b>: <i>Encouragingly, Therefore, Overall, As a result</i> usually come last. A mid-sentence "however" still contrasts with the sentence just before it.</li>
          </ol>
        </details>
      </div>
      {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      {!res && <div className="btnrow"><Timer start={t0} countdown={PACE.ro.secs} onExpire={strict(settings, focus) ? () => check(true) : undefined} /></div>}
      <div className="reorder">
        <div className="col"><div className="eyebrow">Source</div>{left.map((v) => <button key={v} className="sent" disabled={!!res} onClick={() => setAnswer([...answer, v])}>{src.sentences[v]}</button>)}</div>
        <div className="col"><div className="eyebrow">Your order</div>{answer.map((v, i) => (
          <button key={v} className={'sent placed' + (res ? (i === 0 ? (v === 0 ? ' ok' : ' bad') : answer[i - 1] + 1 === v ? ' ok' : ' bad') : '')} disabled={!!res} onClick={() => setAnswer(answer.filter((x) => x !== v))}>
            <b>{i + 1}.</b> {src.sentences[v]}
          </button>))}
        </div>
      </div>
      {!res ? <div className="btnrow"><button className="primary" onClick={() => check()} disabled={answer.length !== src.sentences.length}>Check</button></div>
        : (
          <div className="summary">
            <div className="btnrow"><span className="score">{res.score} / {res.total}</span><span className="muted small">One point per correct adjacent pair</span>{res.timedOut && <Chip tone="warn">Time's up: scored what you had placed</Chip>}</div>
            <ol className="small">{src.sentences.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        )}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} />
    </section>
  );
}
