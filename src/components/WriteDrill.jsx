import { useEffect, useState } from 'react';
import { speak, stopVoice, voiceFor } from '../lib/voice.js';
import { judgeSwt, judgeSst, judgeEmail, wordCount } from '../lib/judge.js';
import { gradeAnswer, graderKnownOff } from '../lib/grader.js';
import { Chip, useDoneMap, KIND_LABEL } from './common.jsx';
import { Nav, Timer, Checks } from './bits.jsx';
import { PACE, strict } from '../lib/timing.js';

export function AiFeedback({ ai }) {
  if (ai.error) return <div className="notice">AI grading: {ai.error}</div>;
  return (
    <div className="aibox">
      <div className="eyebrow">AI rater (grammar, vocabulary, appropriacy)</div>
      {ai.traits && <div className="tags">{ai.total != null && <Chip tone={ai.total >= ai.outOf ? 'good' : 'warn'}>Total {ai.total}/{ai.outOf}</Chip>}{Object.entries(ai.traits).map(([k, v]) => <Chip key={k} tone={ai.max?.[k] && v >= ai.max[k] ? 'good' : 'warn'}>{k}: {v}{ai.max?.[k] ? '/' + ai.max[k] : ''}</Chip>)}</div>}
      {ai.measured && <p className="small muted">Measured by the app: {ai.measured.words} words{ai.measured.spellingErrors != null ? ` · ${ai.measured.spellingErrors} spelling error${ai.measured.spellingErrors === 1 ? '' : 's'} found` : ''}. Form{ai.measured.spellingErrors != null ? ' and spelling are' : ' is'} scored with Pearson's published bands.</p>}
      {ai.reasons && Object.keys(ai.reasons).length > 0 && <ul className="small reasons">{Object.entries(ai.reasons).map(([k, v]) => <li key={k}><b>{k}</b> ({ai.traits?.[k]}/{ai.max?.[k]}): {v}</li>)}</ul>}
      {ai.tip && <p className="small"><b>Most useful change:</b> {ai.tip}</p>}
      {ai.errors?.length > 0 && <ul className="small">{ai.errors.map((e, i) => <li key={i}><s>{e.original}</s> → <b>{e.fix}</b>{e.why ? ` (${e.why})` : ''}</li>)}</ul>}
      {ai.improved && <details open><summary className="small">Improved version (booklet template)</summary><p className="mono small improved">{ai.improved}</p>{ai.templateOk === false && <p className="small muted">The rater couldn't fully match the template ({ai.templateIssues.join('; ')}). Use the booklet template for the parts that differ.</p>}</details>}
    </div>
  );
}

const CONF = {
  swt: { title: 'Summarize Written Text', how: <><b>Reading + writing.</b> One sentence, 25–50 words (aim for 30–45). Template: “The passage explains that [main idea], highlighting that [point 1] and [point 2], which suggests that [conclusion].”</> },
  email: { title: 'Write Email', how: <><b>Writing.</b> 80–120 words (aim for 100–110). Greeting, purpose line, one paragraph per bullet point, polite close, sign-off. Leave a blank line between paragraphs.</> },
  sst: { title: 'Summarize Spoken Text', how: <><b>Listening + writing.</b> The lecture plays once. Note nouns and numbers, then write 20–30 words. Template: “The speaker discussed [topic], explaining that [point 1] and that [point 2], which shows [conclusion].”</> },
};

export default function WriteDrill({ task, items, bank, day, dayAttempts, onAttempt, onPatch, settings, engine, focus = false, onFinish }) {
  const doneMap = useDoneMap(dayAttempts, task, focus);
  const first = items.findIndex((it) => !doneMap[it.id]);
  const [idx, setIdx] = useState(first < 0 ? 0 : first);
  const item = items[idx];
  const src = bank[item.id];
  const conf = CONF[task];
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [ai, setAi] = useState(null);
  const [grading, setGrading] = useState(false);
  const [saved, setSaved] = useState(null); // the logged attempt, so AI feedback can be attached to it
  const [rewriting, setRewriting] = useState(false); // editing after feedback: untimed, logged as a rewrite
  const [started, setStarted] = useState(task !== 'sst');
  const [t0, setT0] = useState(Date.now());

  useEffect(() => {
    const prev = doneMap[item.id];
    setText(prev ? prev.response : '');
    setRes(prev ? prev.meta?.judged || null : null);
    setAi(prev?.meta?.ai || null);
    setSaved(prev || null);
    setGrading(false);
    setRewriting(false);
    setStarted(task !== 'sst' || !!prev);
    setT0(Date.now());
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function playLecture() {
    setStarted('playing');
    await speak(src.text, { engine, voice: voiceFor(item.id, settings), rate: settings.rate });
    setStarted(true); setT0(Date.now());
  }

  async function submit(timedOut = false) {
    if (res || (!text.trim() && !timedOut)) return;
    const j = task === 'swt' ? judgeSwt(text, src) : task === 'sst' ? judgeSst(text, src) : judgeEmail(text, src);
    const judged = { checks: j.checks, cov: j.cov, n: j.n, timedOut, rewrite: rewriting };
    setRes(judged);
    const row = await onAttempt({ day, task, item_id: item.id, focus, response: text, score: j.score, total: j.total,
      meta: { judged, timedOut, rewrite: rewriting, seconds: Math.round((Date.now() - t0) / 1000) } });
    setSaved(row || null);
    if (text.trim() && !graderKnownOff()) await grade(row, text);
  }

  async function grade(row = saved, answer = text) {
    if (!answer.trim() || grading) return;
    setGrading(true); setAi(null);
    const prompt = task === 'email' ? `${src.text}\nRegister: ${src.register}\nBullets: ${src.bullets.map((b) => b.label).join('; ')}` : src.text;
    const g = await gradeAnswer(task, prompt, answer);
    setGrading(false);
    if (g) { setAi(g); if (!g.error && row) await onPatch?.(row, { ai: g }); }
  }

  const n = wordCount(text);
  const hard = strict(settings, focus);
  const clock = rewriting
    ? <span className="small muted">Rewrite: no time limit. Your first answer stays as the scored one.</span>
    : <Timer start={t0} countdown={PACE[task].secs} stopped={!!res} onExpire={hard ? () => submit(true) : undefined} />;

  function rewrite() {
    setRes(null); setAi(null); setSaved(null); setRewriting(true); setT0(Date.now());
  }
  const limits = task === 'swt' ? [25, 50] : task === 'sst' ? [20, 30] : [80, 120];
  const doneCount = items.filter((it) => doneMap[it.id]).length;
  const labels = task === 'email' ? src.bullets.map((b) => b.label) : src.points.map((p) => p.slice(0, 3).join(' / '));

  return (
    <section className="card">
      <div className="cardhead"><h2>{conf.title}{focus ? ' · focus drill' : ''}</h2><span className="muted small">Item {idx + 1} of {items.length} · {doneCount} done</span></div>
      <div className="how">{conf.how}</div>
      {item.kind && item.kind !== 'new' && <Chip tone={item.kind === 'review' ? 'warn' : ''}>{KIND_LABEL[item.kind]}</Chip>}
      {task === 'sst' ? (
        <div className="btnrow">
          <button className="primary big" onClick={playLecture} disabled={started === 'playing' || (settings.examRules && started === true && !res)}>{started === 'playing' ? 'Playing lecture…' : '▶ Play lecture'}</button>
          {started === true && !res && clock}
        </div>
      ) : (
        <>
          {task === 'email'
            ? <div className="passage"><p>{src.text}</p><ul>{src.bullets.map((b) => <li key={b.label}>{b.label}</li>)}</ul><Chip>{src.register}</Chip></div>
            : <div className="passage small-passage">{src.text}</div>}
          {!res && <div className="btnrow">{clock}</div>}
        </>
      )}
      <textarea id={`w-${task}`} rows={task === 'email' ? 10 : 4} value={text} disabled={!!res || started !== true} onChange={(e) => setText(e.target.value)}
        placeholder={started === true ? 'Type your answer' : 'Play the lecture first'} spellCheck={false} autoCorrect="off" autoCapitalize="sentences" />
      <div className="btnrow">
        <span className={'small ' + (n >= limits[0] && n <= limits[1] ? 'okc' : 'warnc')}>{n} words · target {limits[0]}–{limits[1]}</span>
        {!res && <button className="primary" onClick={() => submit()} disabled={!text.trim()}>Submit</button>}
      </div>
      {res && (
        <div className="summary">
          {res.rewrite && <Chip>Rewrite</Chip>}
          {res.timedOut && <div className="notice">Time's up: your answer was submitted automatically, as in the test.</div>}
          <Checks checks={[...res.checks, ...labels.map((l, i) => ({ ok: res.cov?.[i], label: (task === 'email' ? 'Covers: ' : 'Key point: ') + l }))]} />
          {src.model && <p className="small"><b>Model answer:</b> <span className="mono">{src.model}</span></p>}
          {task === 'sst' && <details><summary className="small">Show the lecture text</summary><p className="small">{src.text}</p></details>}
          {grading && <p className="small muted">AI rater is reading your answer…</p>}
          {ai && <AiFeedback ai={ai} />}
          {!grading && text.trim() && !graderKnownOff() && <div className="btnrow"><button onClick={() => grade()}>{ai ? '↻ Grade again with AI' : 'Grade with AI'}</button></div>}
          {!ai && !grading && graderKnownOff() && <p className="small muted">Grammar and vocabulary marking needs the optional AI rater (see README).</p>}
          {!grading && <div className="btnrow"><button onClick={rewrite}>✎ Edit and resubmit</button><span className="small muted">Fix the errors above, then submit again for a fresh check.</span></div>}
        </div>
      )}
      <Nav idx={idx} setIdx={setIdx} n={items.length} onFinish={onFinish} focus={focus} />
    </section>
  );
}
