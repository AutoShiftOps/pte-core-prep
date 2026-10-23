import { useMemo, useState } from 'react';
import { buildDayReport, pickFocusWfd, TARGETS } from '../lib/coach.js';
import { canon } from '../lib/score.js';
import { speak } from '../lib/voice.js';
import { startTake } from '../lib/assess.js';
import { Chip, tone } from './common.jsx';
import { fmtLong } from '../lib/plan.js';
import { TASKS } from '../lib/tasks.js';

function Metric({ label, value, unit = '%', target, higher = true }) {
  return (
    <div className="kpi">
      <div className="eyebrow">{label}</div>
      <div className={'n ' + tone(value, target, higher)}>{value == null ? '–' : value + unit}</div>
      <div className="small muted">Target {higher ? '' : '≤ '}{target}{unit}</div>
    </div>
  );
}

function SpellingSprint({ words, engine, settings }) {
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [score, setScore] = useState(0);
  if (!words.length) return <p className="muted small">No spelling or word-ending errors today.</p>;
  if (i >= words.length) return <p><b>Sprint done:</b> {score} / {words.length} correct. Run it again tomorrow morning before your set.</p>;
  const word = words[i];
  const check = () => {
    const ok = canon(val) === canon(word);
    setVerdict(ok ? 'ok' : 'no');
    if (ok) setScore((s) => s + 1);
  };
  return (
    <div className="sprint">
      <div className="btnrow">
        <button onClick={() => speak(word, { engine, voice: 'en-GB-SoniaNeural', rate: 0.85 * settings.rate })}>▶ Hear word {i + 1} of {words.length}</button>
        <input type="text" id="sprintInput" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (verdict) { setI(i + 1); setVal(''); setVerdict(null); } else check(); } }} placeholder="Type the word" autoComplete="off" spellCheck={false} />
        {!verdict ? <button className="primary" onClick={check}>Check</button> : <button className="primary" onClick={() => { setI(i + 1); setVal(''); setVerdict(null); }}>Next</button>}
      </div>
      {verdict === 'ok' && <Chip tone="good">Correct</Chip>}
      {verdict === 'no' && <p className="small"><Chip tone="bad">Not quite</Chip> The spelling is <b className="mono">{word}</b>. Type it three times before moving on.</p>}
    </div>
  );
}

function WordWorkout({ words, engine, settings }) {
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState('');
  if (!words.length) return <p className="muted small">No unclear or skipped words today.</p>;
  async function tryWord(w) {
    setBusy(w);
    try {
      const t = await startTake({ engine, reference: w, lang: settings.lang, maxMs: 5000 });
      const out = await t.done;
      setResults((r) => ({ ...r, [w]: out.micClosed ? 'no speech' : out.scores?.accuracy != null ? out.scores.accuracy : out.score === out.total ? 'heard' : 'not heard' }));
    } catch (e) { setResults((r) => ({ ...r, [w]: 'mic error' })); }
    setBusy('');
  }
  return (
    <div className="workout">
      {words.map((w) => (
        <div key={w} className="wordrow">
          <span className="mono">{w}</span>
          <button onClick={() => speak(w, { engine, voice: 'en-US-JennyNeural', rate: 0.85 })}>Hear</button>
          <button onClick={() => tryWord(w)} disabled={!!busy}>{busy === w ? 'Listening…' : 'Say it'}</button>
          {results[w] != null && <Chip tone={typeof results[w] === 'number' ? tone(results[w], 85) : results[w] === 'heard' ? 'good' : 'bad'}>{typeof results[w] === 'number' ? 'Accuracy ' + results[w] : results[w]}</Chip>}
        </div>
      ))}
      <p className="small muted">Hear it, say it three times slowly, then press Say it. Aim for 85 or more{engine !== 'azure' ? ' (pronunciation scores need Azure)' : ''}.</p>
    </div>
  );
}

export default function Report({ day, attempts, banks, items, settings, engine, startFocus }) {
  const r = useMemo(() => buildDayReport(day, attempts, banks), [day, attempts, banks]);
  const { wfd, rs, ra, focus } = r;
  const topCat = wfd.categories[0]?.key;

  return (
    <div className="stack">
      <section className="card">
        <div className="cardhead"><h2>Coach report</h2><span className="muted small">{fmtLong(day)} · saved automatically</span></div>
        <div className="focusbox">
          <div className="eyebrow">Today's verdict</div>
          <h3>{focus.headline}</h3>
          <ol>{focus.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </div>
        {r.extra > 0 && <p className="small muted">Plus {r.extra} extra focus-drill items today.</p>}
        {r.timeouts?.total > 0 && <p className="small"><Chip tone="warn">Clock ran out on {r.timeouts.total}</Chip> {r.timeouts.byTask.map((t) => `${TASKS[t.task].label} ${t.n}`).join(' · ')}</p>}
      </section>

      {r.others.length > 0 && (
        <section className="card">
          <div className="cardhead"><h2>Other tasks today</h2></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Task</th><th>Done</th><th>Score</th><th>Weak items</th><th></th></tr></thead>
              <tbody>
                {r.others.map((t) => (
                  <tr key={t.task}>
                    <td>{TASKS[t.task].label}</td><td className="num">{t.done}</td>
                    <td className={'num ' + tone(t.pct, 90)}>{t.pct ?? '–'}%</td><td className="num">{t.weak.length}</td>
                    <td>{t.weak.length > 0 && <button onClick={() => startFocus({ task: t.task, ids: t.weak.slice(0, 5), title: TASKS[t.task].label + ' redo' })}>Redo weak</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="cardhead"><h2>Write From Dictation</h2><span className="muted small">{wfd.done}/20 done · {wfd.score}/{wfd.total} words</span></div>
        <div className="kpis"><Metric label="Accuracy" value={wfd.accuracy} target={TARGETS.wfd} /><div className="kpi"><div className="eyebrow">Sentences back tomorrow</div><div className="n">{Math.min(wfd.missedSentences, 8)}</div><div className="small muted">Missed today, queued as reviews</div></div></div>
        {wfd.categories.length > 0 ? wfd.categories.map((c) => (
          <div key={c.key} className="cat">
            <div className="cardhead"><h3>{c.label}</h3><Chip tone={c.count >= 3 ? 'bad' : 'warn'}>{c.count}</Chip></div>
            <p className="small">{c.tip}</p>
            <ul className="examples">
              {c.examples.map((e, i) => (
                <li key={i}><span className="mono">{e.target}</span><br /><span className="small">Missed <b>{e.word}</b>{e.typed ? <> · you wrote <b>{e.typed}</b></> : ''}</span></li>
              ))}
            </ul>
          </div>
        )) : <p className="muted">{wfd.done ? 'No errors. Excellent.' : 'No dictation logged yet.'}</p>}
        {wfd.done > 0 && (
          <div className="stack">
            <h3>Exercise 1 · Spelling sprint</h3>
            <SpellingSprint words={wfd.practiceWords} engine={engine} settings={settings} />
            <h3>Exercise 2 · Focus drill</h3>
            <p className="small">Five more sentences chosen to train {topCat ? <b>{wfd.categories[0].label.toLowerCase()}</b> : 'long sentences'}. Logged as extra practice.</p>
            <div className="btnrow"><button className="primary" onClick={() => startFocus({ task: 'wfd', ids: pickFocusWfd(topCat || 'content', items.wfd, attempts, day), title: 'Dictation focus drill' })}>Start dictation focus drill</button></div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="cardhead"><h2>Repeat Sentence</h2><span className="muted small">{rs.done}/10 done</span></div>
        <div className="kpis">
          <Metric label="Words repeated" value={rs.contentAvg} target={TARGETS.rsContent} />
          <Metric label="Started within 1 s" value={rs.fastPct} target={TARGETS.rsFast} />
          <Metric label="Fluency (Azure)" value={rs.fluencyAvg} unit="" target={TARGETS.rsFluency} />
          <div className="kpi"><div className="eyebrow">Mic closed / hesitations</div><div className="n">{rs.micClosed} / {rs.hesitationsAvg ?? '–'}</div><div className="small muted">Hesitations are gaps of 0.7 s or more</div></div>
        </div>
        {rs.weak.length > 0 && (
          <>
            <h3>Sentences to redo</h3>
            <ul className="examples">
              {rs.weak.slice(0, 5).map((w) => (
                <li key={w.id}><span className="mono">{w.target}</span><br /><span className="small">{w.micClosed ? 'Mic closed before you started.' : <>Heard: “{w.heard}” · {Math.round(w.ratio * 100)}% of words{w.latencyMs != null ? ` · start ${(w.latencyMs / 1000).toFixed(1)} s` : ''}</>}</span></li>
              ))}
            </ul>
            <div className="btnrow"><button className="primary" onClick={() => startFocus({ task: 'rs', ids: rs.weak.slice(0, 5).map((w) => w.id), title: 'Repeat Sentence redo' })}>Redo these now</button></div>
          </>
        )}
      </section>

      <section className="card">
        <div className="cardhead"><h2>Read Aloud</h2><span className="muted small">{ra.done}/5 done</span></div>
        <div className="kpis">
          <Metric label="Words read correctly" value={ra.contentAvg} target={TARGETS.raContent} />
          <Metric label="Pronunciation (Azure)" value={ra.accuracyAvg} unit="" target={TARGETS.raAccuracy} />
          <Metric label="Fluency (Azure)" value={ra.fluencyAvg} unit="" target={TARGETS.raFluency} />
          <div className="kpi"><div className="eyebrow">Pace · long pauses</div><div className={'n ' + (ra.wpmAvg == null ? '' : ra.wpmAvg >= TARGETS.wpmLow && ra.wpmAvg <= TARGETS.wpmHigh ? 'good' : 'warn')}>{ra.wpmAvg ?? '–'} wpm · {ra.pausesAvg ?? '–'}</div><div className="small muted">Target {TARGETS.wpmLow}–{TARGETS.wpmHigh} wpm, ≤ {TARGETS.raPauses} pause</div></div>
        </div>
        {ra.prosodyAvg != null && <p className="small">Intonation (Azure prosody): <b>{ra.prosodyAvg}</b>. Below 80 usually means flat stress: lift key nouns and numbers.</p>}
        {ra.done > 0 && (
          <div className="stack">
            <h3>Exercise 3 · Word workout</h3>
            <WordWorkout words={ra.words} engine={engine} settings={settings} />
            {ra.weakestId && <div className="btnrow"><button className="primary" onClick={() => startFocus({ task: 'ra', ids: [ra.weakestId], title: 'Read Aloud redo' })}>Re-read your weakest passage</button></div>}
          </div>
        )}
      </section>
      <p className="small muted">Targets are practice targets for a CLB 10 trajectory, not official PTE score conversions. Azure scores are a consistent proxy for pronunciation and fluency; your official PTE Scored Practice Tests remain the real measure.</p>
    </div>
  );
}
