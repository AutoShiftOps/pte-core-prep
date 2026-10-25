import { useEffect, useRef, useState } from 'react';
import { compare } from '../lib/score.js';
import { speak, stopVoice, voiceFor, voiceLabel } from '../lib/voice.js';
import { startTake } from '../lib/assess.js';
import { beep } from '../lib/mic.js';
import { Diff, Chip, RecBar, SpeechScores, useDoneMap, KIND_LABEL, FirstTryNote } from './common.jsx';

const MAX_MS = 15000;

function fromAttempt(a, target) {
  const m = a.meta || {};
  return {
    engine: m.engine || 'browser', heard: a.response, cmp: compare(target, a.response),
    score: a.score, total: a.total, latencyMs: m.latencyMs ?? null, pauses: m.pauses || [],
    micClosed: !!m.micClosed, scores: m.scores || null, mispronounced: m.mispronounced || [], audioUrl: null, selfRated: m.selfRated,
  };
}

export default function RsDrill({ items, bank, day, dayAttempts, onAttempt, settings, engine, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, 'rs', focus);
  const firstOpen = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const item = items[idx];
  const target = bank[item.id];
  const voice = voiceFor(item.id, settings);
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const runRef = useRef(0);
  const takeRef = useRef(null);

  useEffect(() => {
    const prev = doneMap[item.id];
    setPhase(prev ? 'done' : 'idle');
    setResult(prev ? fromAttempt(prev, target) : null);
    setError('');
    return () => { runRef.current++; takeRef.current?.stop(); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function run() {
    const runId = ++runRef.current;
    setError(''); setResult(null); setElapsed(0); setSpeaking(false);
    setPhase('listening');
    await speak(target, { engine, voice, rate: settings.rate });
    if (runId !== runRef.current) return;
    if (settings.beep) beep();
    let take;
    try {
      take = await startTake({
        engine, reference: target, lang: settings.lang, maxMs: MAX_MS,
        onState: (s) => { setElapsed(s.elapsed); setSpeaking(s.speaking); },
      });
    } catch (e) {
      setPhase('idle');
      setError(/Permission|NotAllowed|denied/i.test(String(e)) ? 'Microphone blocked. Allow the microphone for this site (lock icon in the address bar), then try again.' : 'Could not start recording: ' + e.message);
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
        day, task: 'rs', item_id: item.id, focus, response: out.heard || '', score: out.score, total: out.total,
        meta: {
          engine: out.engine, voice: engine === 'azure' ? voice : 'browser', latencyMs: out.latencyMs, pauses: out.pauses,
          micClosed: out.micClosed, durationMs: out.durationMs, reason: out.reason, scores: out.scores, mispronounced: out.mispronounced,
        },
      });
    }
  }

  async function selfRate(ratio) {
    const total = compare(target, '').total;
    const score = Math.round(total * ratio);
    setResult((r) => ({ ...r, score, total, selfRated: true }));
    await onAttempt({ day, task: 'rs', item_id: item.id, focus, response: '', score, total, meta: { engine: 'self', selfRated: true } });
  }

  function next() {
    if (idx < items.length - 1) setIdx(idx + 1);
    else onFinish && onFinish();
  }

  const label = phase === 'listening' ? 'Listening…'
    : phase === 'recording' ? (speaking ? 'Recording' : 'Recording · speak now') + ' · ' + Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000)) + ' s'
    : phase === 'done' ? 'Recording closed' : 'Waiting';
  const needsSelfRate = phase === 'done' && result && result.engine === 'browser' && !result.recognition && !result.selfRated && !doneMap[item.id];
  const doneCount = items.filter((it) => doneMap[it.id]).length;

  return (
    <section className="card">
      <div className="cardhead">
        <h2>Repeat Sentence{focus ? ' · focus drill' : ''}</h2>
        <span className="muted small">Sentence {idx + 1} of {items.length} · {doneCount} done</span>
      </div>
      <div className="how"><b>Listening + speaking.</b> Press Play. After the beep the mic is open: start within 1 second and repeat the sentence exactly. Like the real test, the mic closes after 3 seconds of silence, so never stop to correct yourself.</div>
      <div className="btnrow">
        <button className="primary big" onClick={run} disabled={phase === 'listening' || phase === 'recording'}>{phase === 'done' ? '↻ Try again' : '▶ Play sentence'}</button>
        {phase === 'recording' && <button onClick={() => takeRef.current?.stop()}>I've finished</button>}
        {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      </div>
      <FirstTryNote dayAttempts={dayAttempts} task="rs" itemId={item.id} focus={focus} />
      <RecBar phase={phase} elapsed={elapsed} maxMs={MAX_MS} label={label} />
      {error && <div className="notice">{error}</div>}
      {phase === 'done' && result && (
        <div className="summary">
          <div className="sentence">{target}</div>
          {result.selfRated ? <Chip>Self-rated: {result.score}/{result.total}</Chip> : <SpeechScores r={result} />}
          {!result.selfRated && result.heard != null && (
            <>
              <Diff res={result.cmp} heardLabel="Heard" />
              <p className="small muted">Heard: “{result.heard || '(nothing)'}”</p>
            </>
          )}
          {result.mispronounced?.length > 0 && (
            <p className="small">Unclear words: {result.mispronounced.map((w) => `${w.word} (${w.accuracy})`).join(', ')}</p>
          )}
          {needsSelfRate && (
            <div className="field"><label>Your browser can't transcribe. How much did you say correctly?</label>
              <div className="btnrow"><button onClick={() => selfRate(1)}>All</button><button onClick={() => selfRate(0.75)}>Most</button><button onClick={() => selfRate(0.4)}>Half or less</button></div>
            </div>
          )}
          <div className="btnrow">
            {result.audioUrl && <audio controls src={result.audioUrl} />}
            <button onClick={() => speak(target, { engine, voice, rate: settings.rate })}>Hear model{engine === 'azure' ? ' · ' + voiceLabel(voice) : ''}</button>
          </div>
          <div className="btnrow">
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Previous</button>
            <button className="primary" onClick={next}>{idx === items.length - 1 ? (focus ? 'Finish drill' : 'Go to Read Aloud') : 'Next sentence'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
