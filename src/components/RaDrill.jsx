import { useEffect, useRef, useState } from 'react';
import { compare } from '../lib/score.js';
import { speak, stopVoice, voiceFor } from '../lib/voice.js';
import { startTake } from '../lib/assess.js';
import { beep } from '../lib/mic.js';
import { Diff, Chip, RecBar, SpeechScores, useDoneMap, KIND_LABEL } from './common.jsx';

const PREP_MS = 35000;
const MAX_MS = 40000;

function withCuts(text) {
  return text.split(/(\s+)/).map((tok, i) => {
    if (/\.$/.test(tok)) return <span key={i}>{tok}<span className="cut">//</span></span>;
    if (/[,;:]$/.test(tok)) return <span key={i}>{tok}<span className="cut">/</span></span>;
    return tok;
  });
}

function fromAttempt(a, target) {
  const m = a.meta || {};
  return {
    engine: m.engine || 'browser', heard: a.response, cmp: compare(target, a.response), score: a.score, total: a.total,
    latencyMs: m.latencyMs ?? null, pauses: m.pauses || [], micClosed: !!m.micClosed, scores: m.scores || null,
    mispronounced: m.mispronounced || [], wpm: m.wpm ?? null, audioUrl: null,
  };
}

export default function RaDrill({ items, bank, day, dayAttempts, onAttempt, settings, engine, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, 'ra', focus);
  const firstOpen = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const item = items[idx];
  const target = bank[item.id];
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [cuts, setCuts] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const runRef = useRef(0);
  const takeRef = useRef(null);
  const prepRef = useRef(null);

  useEffect(() => {
    const prev = doneMap[item.id];
    setPhase(prev ? 'done' : 'idle');
    setResult(prev ? fromAttempt(prev, target) : null);
    setError('');
    return () => { runRef.current++; clearInterval(prepRef.current); takeRef.current?.stop(); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function startPrep() {
    const runId = ++runRef.current;
    setResult(null); setError(''); setPhase('prep'); setElapsed(0);
    const t0 = performance.now();
    clearInterval(prepRef.current);
    prepRef.current = setInterval(() => {
      const t = performance.now() - t0;
      setElapsed(t);
      if (t >= PREP_MS) { clearInterval(prepRef.current); record(runId); }
    }, 100);
  }

  async function record(runId = runRef.current) {
    clearInterval(prepRef.current);
    if (runId !== runRef.current) return;
    if (settings.beep) beep();
    setElapsed(0);
    let take;
    try {
      take = await startTake({ engine, reference: target, lang: settings.lang, maxMs: MAX_MS, onState: (s) => setElapsed(s.elapsed) });
    } catch (e) {
      setPhase('idle');
      setError(/Permission|NotAllowed|denied/i.test(String(e)) ? 'Microphone blocked. Allow the microphone for this site, then try again.' : 'Could not start recording: ' + e.message);
      return;
    }
    takeRef.current = take;
    setPhase('recording');
    const out = await take.done;
    takeRef.current = null;
    if (runId !== runRef.current) return;
    if (out.error) setError('Speech service: ' + out.error);
    setResult(out);
    setPhase('done');
    if (out.engine === 'azure' || out.recognition) {
      await onAttempt({
        day, task: 'ra', item_id: item.id, focus, response: out.heard || '', score: out.score, total: out.total,
        meta: {
          engine: out.engine, latencyMs: out.latencyMs, pauses: out.pauses, micClosed: out.micClosed, durationMs: out.durationMs,
          wpm: out.wpm, reason: out.reason, scores: out.scores, mispronounced: out.mispronounced,
        },
      });
    }
  }

  function next() {
    if (idx < items.length - 1) setIdx(idx + 1);
    else onFinish && onFinish();
  }

  const hidden = phase === 'idle' && !result;
  const label = phase === 'prep' ? 'Prep · read silently · ' + Math.max(0, Math.ceil((PREP_MS - elapsed) / 1000)) + ' s'
    : phase === 'recording' ? 'Recording · read aloud · ' + Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000)) + ' s'
    : phase === 'done' ? 'Recording closed' : 'Waiting';
  const doneCount = items.filter((it) => doneMap[it.id]).length;
  const modelVoice = voiceFor(item.id, settings);

  return (
    <section className="card">
      <div className="cardhead">
        <h2>Read Aloud{focus ? ' · focus drill' : ''}</h2>
        <span className="muted small">Passage {idx + 1} of {items.length} · {target.split(/\s+/).length} words · {doneCount} done</span>
      </div>
      <div className="how"><b>Reading + speaking.</b> Press Start: 35 seconds to read silently, then the beep and 40 seconds to read aloud. Steady news-reader pace, short pause at commas, longer at full stops. Stumble? Keep going.</div>
      <div className={'passage' + (hidden ? ' hidden' : '')}>{cuts ? withCuts(target) : target}</div>
      <div className="btnrow">
        {phase === 'idle' || phase === 'done'
          ? <button className="primary big" onClick={startPrep}>{phase === 'done' ? '↻ Read it again' : 'Start (35 s prep)'}</button>
          : phase === 'prep' ? <button className="primary" onClick={() => record()}>Skip to speaking</button>
          : <button onClick={() => takeRef.current?.stop()}>Finish early</button>}
        <label className="small"><input type="checkbox" checked={cuts} onChange={(e) => setCuts(e.target.checked)} /> Show pause marks</label>
        {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      </div>
      <RecBar phase={phase} elapsed={elapsed} maxMs={phase === 'prep' ? PREP_MS : MAX_MS} label={label} />
      {error && <div className="notice">{error}</div>}
      {phase === 'done' && result && (
        <div className="summary">
          <SpeechScores r={result} showWpm />
          <Diff res={result.cmp} heardLabel="Heard" />
          {result.mispronounced?.length > 0 && <p className="small">Unclear words: {result.mispronounced.map((w) => `${w.word} (${w.accuracy})`).join(', ')}</p>}
          {result.pauses?.filter((p) => p >= 1000).length > 0 && (
            <p className="small">Pauses of 1 s or more: {result.pauses.filter((p) => p >= 1000).map((p) => (p / 1000).toFixed(1) + ' s').join(', ')}</p>
          )}
          <div className="btnrow">
            {result.audioUrl && <audio controls src={result.audioUrl} />}
            <button onClick={() => speak(target, { engine, voice: modelVoice, rate: settings.rate })}>▶ Hear model reading</button>
          </div>
          <div className="btnrow">
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Previous</button>
            <button className="primary" onClick={next}>{idx === items.length - 1 ? (focus ? 'Finish drill' : 'See today\'s coach report') : 'Next passage'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
