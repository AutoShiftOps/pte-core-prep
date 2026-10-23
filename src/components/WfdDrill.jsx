import { useEffect, useRef, useState } from 'react';
import { compare, categorize } from '../lib/score.js';
import { speak, stopVoice, voiceFor, voiceLabel } from '../lib/voice.js';
import { Diff, Chip, useDoneMap, KIND_LABEL } from './common.jsx';
import { Timer } from './bits.jsx';
import { PACE, strict } from '../lib/timing.js';

export default function WfdDrill({ items, bank, day, dayAttempts, onAttempt, settings, engine, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, 'wfd', focus);
  const firstOpen = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const item = items[idx];
  const target = bank[item.id];
  const [plays, setPlays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(null); // { typed, res, timedOut }
  const [heardAt, setHeardAt] = useState(0); // audio finished: the answer clock starts
  const inputRef = useRef(null);
  const voice = voiceFor(item.id, settings);

  useEffect(() => {
    const prev = doneMap[item.id];
    setPlays(0);
    setHeardAt(0);
    setInput(prev ? prev.response : '');
    setChecked(prev ? { typed: prev.response, res: compare(target, prev.response) } : null);
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function play() {
    setPlays((p) => p + 1);
    setLoading(true);
    const p = speak(target, { engine, voice, rate: settings.rate });
    setTimeout(() => setLoading(false), 400);
    await p;
    setHeardAt((h) => h || Date.now());
    inputRef.current?.focus();
  }

  async function check(timedOut = false) {
    if (checked && checked.typed === input.trim()) return;
    const typed = input.trim();
    if (!typed && !timedOut) { inputRef.current?.focus(); return; }
    const res = compare(target, typed);
    setChecked({ typed, res, timedOut });
    await onAttempt({
      day, task: 'wfd', item_id: item.id, focus, response: typed, score: res.score, total: res.total,
      meta: {
        plays, timedOut, voice: engine === 'azure' ? voice : 'browser',
        errors: res.out.filter((o) => o.status !== 'ok' && o.c).map((o) => ({ word: o.w, typed: o.typed, kind: o.status, cat: categorize(o) })),
      },
    });
  }

  function next() {
    if (idx < items.length - 1) setIdx(idx + 1);
    else onFinish && onFinish();
  }

  const onceOnly = settings.examRules && !focus;
  const res = checked?.res;
  const doneCount = items.filter((it) => doneMap[it.id]).length;

  return (
    <section className="card">
      <div className="cardhead">
        <h2>Write From Dictation{focus ? ' · focus drill' : ''}</h2>
        <span className="muted small">Sentence {idx + 1} of {items.length} · {doneCount} done</span>
      </div>
      <div className="how"><b>Listening + writing.</b> Play once, type exactly what you heard, press Enter. In exam timing you get {PACE.wfd.secs} seconds after the audio ends, then it submits itself. Each correctly spelt word in order scores a point. Before you press Enter, check plural -s, a/the, past -ed, capital letter, full stop.</div>
      <div className="btnrow">
        <button className="primary big" onClick={play} disabled={(onceOnly && plays > 0) || loading}>{loading ? 'Loading audio…' : '▶ Play sentence'}</button>
        <span className="muted small">
          {onceOnly ? (plays ? 'Played. Type it now.' : 'Plays once, like the test.') : 'Practice mode: replay as needed.'}
          {engine === 'azure' && plays > 0 ? ` · ${voiceLabel(voice)}` : ''}
        </span>
        {heardAt > 0 && !checked && <Timer start={heardAt} countdown={PACE.wfd.secs} onExpire={strict(settings, focus) ? () => check(true) : undefined} />}
        {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      </div>
      <input
        ref={inputRef} type="text" id="wfdInput" value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (checked && input.trim() === checked.typed) next(); else check();
        }}
        placeholder="Type the sentence, then press Enter"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      />
      <div className="btnrow">
        <button className="primary" onClick={() => check()}>Check</button>
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Previous</button>
        <button onClick={next}>{idx === items.length - 1 ? (focus ? 'Finish drill' : 'Go to Repeat Sentence') : 'Next sentence'}</button>
      </div>
      {res && (
        <div className="summary">
          <div className="btnrow">
            <span className="score">{res.score} / {res.total}</span>
            <span className="muted">{res.score === res.total ? 'Perfect.' : Math.round((res.score / res.total) * 100) + '% of words'}</span>
          </div>
          <Diff res={res} />
          <div className="tags">
            {['spell', 'form'].map((k) => { const n = res.out.filter((o) => o.status === k).length; return n ? <Chip key={k} tone="warn">{n} {k === 'spell' ? 'spelling' : 'word ending (-s, -ed, -ing)'}</Chip> : null; })}
            {(() => { const n = res.out.filter((o) => o.status === 'miss' && o.c).length; return n ? <Chip tone="bad">{n} missed</Chip> : null; })()}
            {res.extra.length > 0 && <Chip>Extra: {res.extra.join(' ')}</Chip>}
            {res.score === res.total && <Chip tone="good">All words correct</Chip>}
            {checked.timedOut && <Chip tone="warn">Time's up: auto-submitted after {PACE.wfd.secs} s</Chip>}
          </div>
          <div className="btnrow"><button onClick={() => speak(target, { engine, voice, rate: settings.rate })}>Hear it again and compare</button></div>
        </div>
      )}
    </section>
  );
}
