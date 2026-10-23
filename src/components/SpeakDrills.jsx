import { useEffect, useRef, useState } from 'react';
import { speak, stopVoice, voiceFor } from '../lib/voice.js';
import { startTake } from '../lib/assess.js';
import { beep } from '../lib/mic.js';
import { judgeDi, judgeRts, judgeAsq } from '../lib/judge.js';
import { gradeAnswer, graderKnownOff } from '../lib/grader.js';
import { Chip, RecBar, useDoneMap, KIND_LABEL, tone } from './common.jsx';
import { Nav, Checks } from './bits.jsx';
import Chart from './Chart.jsx';
import { AiFeedback } from './WriteDrill.jsx';

const micError = (e) => (/Permission|NotAllowed|denied/i.test(String(e)) ? 'Microphone blocked. Allow the microphone for this site, then try again.' : 'Could not start recording: ' + e.message);

function FluencyChips({ take }) {
  const s = take.scores;
  return (
    <div className="tags">
      {take.micClosed ? <Chip tone="bad">Mic closed: no speech within 3 s</Chip>
        : take.latencyMs != null && <Chip tone={take.latencyMs <= 1000 ? 'good' : 'warn'}>Start {(take.latencyMs / 1000).toFixed(1)} s</Chip>}
      {s?.fluency != null && <Chip tone={tone(s.fluency, 85)}>Fluency {s.fluency}</Chip>}
      {s?.accuracy != null && <Chip tone={tone(s.accuracy, 85)}>Pronunciation {s.accuracy}</Chip>}
      {s?.prosody != null && <Chip tone={tone(s.prosody, 80)}>Intonation {s.prosody}</Chip>}
      {!take.micClosed && <Chip tone={take.pauses.length <= 1 ? 'good' : 'warn'}>{take.pauses.length} hesitations</Chip>}
    </div>
  );
}

/** Describe Image and Respond to a Situation: prep timer, then 40 s of unscripted speech. */
export function OpenSpeakDrill({ task, items, bank, day, dayAttempts, onAttempt, onPatch, settings, engine, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, task, focus);
  const first = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(first < 0 ? 0 : first);
  const item = items[idx];
  const src = bank[item.id];
  const PREP = task === 'di' ? 25000 : 20000, MAX = 40000;
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [out, setOut] = useState(null);
  const [ai, setAi] = useState(null);
  const [grading, setGrading] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const runRef = useRef(0), takeRef = useRef(null), prepRef = useRef(null);

  useEffect(() => {
    const prev = doneMap[item.id];
    setPhase(prev ? 'done' : 'idle');
    setOut(prev ? { heard: prev.response, judged: prev.meta?.judged, take: prev.meta?.take || { pauses: [] } } : null);
    setAi(prev?.meta?.ai || null); setError(''); setSaved(prev || null); setGrading(false);
    return () => { runRef.current++; clearInterval(prepRef.current); takeRef.current?.stop(); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function start() {
    const runId = ++runRef.current;
    setOut(null); setAi(null); setError('');
    if (task === 'rts') { setPhase('listening'); await speak(src.text, { engine, voice: voiceFor(item.id, settings), rate: settings.rate }); if (runId !== runRef.current) return; }
    setPhase('prep');
    const t0 = performance.now();
    clearInterval(prepRef.current);
    prepRef.current = setInterval(() => { const t = performance.now() - t0; setElapsed(t); if (t >= PREP) record(runId); }, 100);
  }

  async function record(runId = runRef.current) {
    clearInterval(prepRef.current);
    if (runId !== runRef.current) return;
    if (settings.beep) beep();
    setElapsed(0);
    let take;
    try { take = await startTake({ engine, reference: '', lang: settings.lang, maxMs: MAX, onState: (s) => setElapsed(s.elapsed) }); }
    catch (e) { setPhase('idle'); setError(micError(e)); return; }
    takeRef.current = take; setPhase('recording');
    const t = await take.done; takeRef.current = null;
    if (runId !== runRef.current) return;
    const heard = t.heard || '';
    const judged = task === 'di' ? judgeDi(heard, src, t) : judgeRts(heard, src, t);
    const slim = { latencyMs: t.latencyMs, pauses: t.pauses, micClosed: t.micClosed, durationMs: t.durationMs, scores: t.scores, wpm: t.wpm };
    setOut({ heard, judged, take: { ...slim, audioUrl: t.audioUrl } });
    setPhase('done');
    if (t.error) setError('Speech service: ' + t.error);
    const row = await onAttempt({ day, task, item_id: item.id, focus, response: heard, score: t.micClosed ? 0 : judged.score, total: judged.total,
      meta: { engine: t.engine, take: slim, judged: { checks: judged.checks }, scores: t.scores, pauses: t.pauses, latencyMs: t.latencyMs, micClosed: t.micClosed } });
    setSaved(row || null);
    if (heard && !t.micClosed) await grade(row, heard);
  }

  async function grade(row = saved, heard = out?.heard || '') {
    if (!heard) return;
    setGrading(true); setAi(null);
    const g = await gradeAnswer(task, task === 'di' ? `Describe this chart: ${src.title} (${src.unit}). Labels: ${src.labels.join(', ')}. ${src.values ? 'Values: ' + src.values.join(', ') : src.series.map((s) => s.name + ': ' + s.values.join(', ')).join('; ')}` : src.text, heard);
    setGrading(false);
    if (g) setAi(g);
    if (g && !g.error && row) await onPatch?.(row, { ai: g });
  }

  const label = phase === 'listening' ? 'Listening…' : phase === 'prep' ? 'Prepare · ' + Math.max(0, Math.ceil((PREP - elapsed) / 1000)) + ' s'
    : phase === 'recording' ? 'Recording · speak now · ' + Math.max(0, Math.ceil((MAX - elapsed) / 1000)) + ' s' : phase === 'done' ? 'Recording closed' : 'Waiting';
  const doneCount = items.filter((it) => doneMap[it.id]).length;

  return (
    <section className="card">
      <div className="cardhead"><h2>{task === 'di' ? 'Describe Image' : 'Respond to a Situation'}{focus ? ' · focus drill' : ''}</h2><span className="muted small">Item {idx + 1} of {items.length} · {doneCount} done</span></div>
      <div className="how">
        {task === 'di'
          ? <><b>Speaking.</b> 25 seconds to study the chart, then 40 seconds to speak. Template: what it shows → highest → lowest → one more detail or trend → overall conclusion. Keep talking for the full time.</>
          : <><b>Speaking.</b> Listen, read, then 20 seconds to plan: formal or informal? Then 40 seconds. Cover every part of the situation, be polite, and keep going even if you make a mistake.</>}
      </div>
      {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      {task === 'di' ? (phase === 'idle' && !out ? <div className="passage hidden">Chart appears when you start.</div> : <Chart d={src} />)
        : <div className="passage">{src.text} <Chip>{src.register}</Chip></div>}
      <div className="btnrow">
        {phase === 'idle' || phase === 'done' ? <button className="primary big" onClick={start}>{phase === 'done' ? '↻ Try again' : 'Start'}</button>
          : phase === 'prep' ? <button className="primary" onClick={() => record()}>Start speaking now</button>
          : phase === 'recording' ? <button onClick={() => takeRef.current?.stop()}>Finish early</button> : null}
      </div>
      <RecBar phase={phase === 'listening' ? 'idle' : phase} elapsed={elapsed} maxMs={phase === 'prep' ? PREP : MAX} label={label} />
      {error && <div className="notice">{error}</div>}
      {phase === 'done' && out && (
        <div className="summary">
          {out.take && <FluencyChips take={out.take} />}
          {out.judged?.checks && <Checks checks={out.judged.checks} />}
          <p className="small muted">Heard: “{out.heard || '(nothing)'}”</p>
          {out.take?.audioUrl && <audio controls src={out.take.audioUrl} />}
          {grading && <p className="small muted">AI rater is listening to your answer…</p>}
          {ai && <AiFeedback ai={ai} />}
          {!grading && (!ai || ai.error) && out.heard && !out.take?.micClosed && !graderKnownOff() && <div className="btnrow"><button onClick={() => grade()}>{ai?.error ? '↻ Grade again with AI' : 'Grade with AI'}</button></div>}
        </div>
      )}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} />
    </section>
  );
}

/** Answer Short Question: one play, answer within 3 seconds, one word or a short phrase. */
export function AsqDrill({ items, bank, day, dayAttempts, onAttempt, settings, engine, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, 'asq', focus);
  const first = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(first < 0 ? 0 : first);
  const item = items[idx];
  const src = bank[item.id];
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [out, setOut] = useState(null);
  const [error, setError] = useState('');
  const runRef = useRef(0), takeRef = useRef(null);
  useEffect(() => {
    const prev = doneMap[item.id];
    setPhase(prev ? 'done' : 'idle');
    setOut(prev ? { heard: prev.response, ok: prev.score === 1, latencyMs: prev.meta?.latencyMs, micClosed: prev.meta?.micClosed } : null);
    setError('');
    return () => { runRef.current++; takeRef.current?.stop(); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  async function run() {
    const runId = ++runRef.current;
    setOut(null); setError(''); setPhase('listening');
    await speak(src.text, { engine, voice: voiceFor(item.id, settings), rate: settings.rate });
    if (runId !== runRef.current) return;
    if (settings.beep) beep();
    let take;
    try { take = await startTake({ engine, reference: src.answers[0], lang: settings.lang, maxMs: 10000, onState: (s) => setElapsed(s.elapsed) }); }
    catch (e) { setPhase('idle'); setError(micError(e)); return; }
    takeRef.current = take; setPhase('recording');
    const t = await take.done; takeRef.current = null;
    if (runId !== runRef.current) return;
    const j = judgeAsq(t.heard || '', src, t);
    setOut({ heard: t.heard, ok: j.ok, latencyMs: t.latencyMs, micClosed: t.micClosed });
    setPhase('done');
    await onAttempt({ day, task: 'asq', item_id: item.id, focus, response: t.heard || '', score: j.score, total: 1, meta: { latencyMs: t.latencyMs, micClosed: t.micClosed, engine: t.engine } });
  }
  const doneCount = items.filter((it) => doneMap[it.id]).length;
  return (
    <section className="card">
      <div className="cardhead"><h2>Answer Short Question{focus ? ' · focus drill' : ''}</h2><span className="muted small">Question {idx + 1} of {items.length} · {doneCount} done</span></div>
      <div className="how"><b>Listening + speaking.</b> Answer with one word or a short phrase as soon as the beep sounds. No full sentences.</div>
      <div className="btnrow"><button className="primary big" onClick={run} disabled={phase === 'listening' || phase === 'recording'}>{phase === 'done' ? '↻ Try again' : '▶ Play question'}</button>
        {phase === 'recording' && <button onClick={() => takeRef.current?.stop()}>Done</button>}</div>
      <RecBar phase={phase === 'listening' ? 'idle' : phase} elapsed={elapsed} maxMs={10000} label={phase === 'listening' ? 'Listening…' : phase === 'recording' ? 'Recording · answer now' : phase === 'done' ? 'Recording closed' : 'Waiting'} />
      {error && <div className="notice">{error}</div>}
      {phase === 'done' && out && (
        <div className="summary">
          <div className="tags">
            <Chip tone={out.ok ? 'good' : 'bad'}>{out.ok ? 'Correct' : 'Not accepted'}</Chip>
            {out.micClosed ? <Chip tone="bad">No answer within 3 s</Chip> : out.latencyMs != null && <Chip tone={out.latencyMs <= 1500 ? 'good' : 'warn'}>Answered after {(out.latencyMs / 1000).toFixed(1)} s</Chip>}
          </div>
          <p className="small">Question: {src.text}<br />Accepted: <b>{src.answers.join(' / ')}</b> · Heard: “{out.heard || '(nothing)'}”</p>
        </div>
      )}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} label="question" />
    </section>
  );
}
