import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { store } from './lib/store.js';
import { setJwtProvider, checkAzure } from './lib/azure.js';
import { useSettings } from './lib/settings.js';
import { todayISO, addDays, fmtLong, dayNumber, diffDays, PLAN_START, EXAM_DATE } from './lib/plan.js';
import { buildDaySet } from './lib/scheduler.js';
import { buildDayReport, buildWeekScorecard, weekOf } from './lib/coach.js';
import { TASKS, ITEMS, BANKS, BY_ID } from './lib/tasks.js';
import { planFor } from './lib/booklet.js';
import { setGraderJwt } from './lib/grader.js';
import { stopVoice } from './lib/voice.js';
import WfdDrill from './components/WfdDrill.jsx';
import RsDrill from './components/RsDrill.jsx';
import RaDrill from './components/RaDrill.jsx';
import Report from './components/Report.jsx';
import Trends from './components/Trends.jsx';
import Settings from './components/Settings.jsx';
import Today from './components/Today.jsx';
import WordPairs from './components/WordPairs.jsx';
import FibDrill from './components/FibDrill.jsx';
import WriteDrill from './components/WriteDrill.jsx';
import { LfibDrill, HiwDrill, ReorderDrill } from './components/ListenDrills.jsx';
import { OpenSpeakDrill, AsqDrill } from './components/SpeakDrills.jsx';


setJwtProvider(() => store.accessToken());
setGraderJwt(() => store.accessToken());

const DRILLS = {
  wfd: WfdDrill, rs: RsDrill, ra: RaDrill, rwfib: FibDrill, rfib: FibDrill, lfib: LfibDrill, hiw: HiwDrill, ro: ReorderDrill,
  di: OpenSpeakDrill, rts: OpenSpeakDrill, asq: AsqDrill, swt: WriteDrill, email: WriteDrill, sst: WriteDrill,
};
const bankFor = (task) => (['wfd', 'rs', 'ra'].includes(task) ? BANKS[task] : BY_ID[task]);

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    store.getUser().then(setUser);
    return store.onAuth(setUser);
  }, []);
  if (user === undefined) return <Shell><p className="muted">Loading…</p></Shell>;
  if (!user) return <SignIn />;
  return <Trainer user={user} />;
}

function Shell({ children }) {
  return <div className="wrap">{children}</div>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('');
  async function submit(e) {
    e.preventDefault();
    setState('sending');
    try { await store.signIn(email.trim()); setState('sent'); }
    catch (err) { setState('Error: ' + err.message); }
  }
  return (
    <Shell>
      <section className="card signin">
        <div className="eyebrow">Mission CLB 10 · PTE Core</div>
        <h1>Big Three Trainer</h1>
        <p>Sign in with your email. Supabase sends a one-time link; your practice log is private to your account.</p>
        <form onSubmit={submit} className="btnrow">
          <input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="primary" disabled={state === 'sending'}>Email me a sign-in link</button>
        </form>
        {state === 'sent' && <p className="small">Check your inbox and open the link on this device.</p>}
        {state.startsWith('Error') && <div className="notice">{state}</div>}
      </section>
    </Shell>
  );
}


function Trainer({ user }) {
  const [settings, setSettings] = useSettings();
  const [azure, setAzure] = useState({ checked: false, ok: false, reason: '' });
  const [attempts, setAttempts] = useState(null);
  const attemptsRef = useRef([]);
  const [pairs, setPairs] = useState([]);
  const pairsRef = useRef([]);
  const [error, setError] = useState('');
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [tab, setTab] = useState('today');
  const [ptab, setPtab] = useState('wfd');
  const [sets, setSets] = useState(null);
  const setsRef = useRef(null);
  const [focusRun, setFocusRun] = useState(null);

  useEffect(() => { checkAzure().then(setAzure); }, []);
  const engine = settings.engine === 'browser' ? 'browser' : azure.ok ? 'azure' : 'browser';
  const plan = useMemo(() => planFor(day), [day]);

  useEffect(() => {
    store.listAttempts()
      .then((rows) => { attemptsRef.current = rows; setAttempts(rows); })
      .catch((e) => { setError('Could not load your log: ' + e.message); attemptsRef.current = []; setAttempts([]); });
    store.listPairs().then((p) => { pairsRef.current = p; setPairs(p); }).catch(() => {});
  }, []);

  const loaded = attempts !== null;
  const buildMissing = useCallback(async (base, tasks) => {
    const s = { ...(base || {}) };
    let changed = false;
    for (const t of tasks) {
      if (s[t]) continue;
      s[t] = buildDaySet({ task: t, items: ITEMS[t], attempts: attemptsRef.current, day, perDay: plan.counts[t] || TASKS[t].per });
      changed = true;
    }
    if (changed) { try { await store.saveDailySet(day, s); } catch {} }
    return s;
  }, [day, plan]);

  useEffect(() => {
    if (!loaded) return;
    let live = true;
    setSets(null);
    (async () => {
      if (day > today) { if (live) { setSets('future'); setsRef.current = 'future'; } return; }
      let s = null;
      try { s = await store.getDailySet(day); } catch (e) { setError('Could not load the day\'s set: ' + e.message); }
      s = await buildMissing(s, Object.keys(plan.counts));
      if (live) { setSets(s); setsRef.current = s; }
    })();
    return () => { live = false; };
  }, [day, loaded, today, plan, buildMissing]);

  async function openTask(task) {
    stopVoice();
    setFocusRun(null);
    if (sets && sets !== 'future' && !sets[task]) {
      const s = await buildMissing(sets, [task]);
      setSets(s); setsRef.current = s;
    }
    setPtab(task);
    setTab('practice');
  }

  const savePair = useCallback(async (row) => {
    try {
      const saved = await store.savePair(row);
      const next = [...pairsRef.current.filter((p) => p.phrase !== saved.phrase), saved];
      pairsRef.current = next; setPairs(next);
    } catch (e) { setError('Could not save the word pair: ' + e.message); }
  }, []);

  const onAttempt = useCallback(async (a) => {
    const saved = await store.addAttempt(a);
    const next = [...attemptsRef.current, saved];
    attemptsRef.current = next;
    setAttempts(next);
    store.saveSummary(a.day, buildDayReport(a.day, next, BANKS)).catch(() => {});
    store.saveWeek(weekOf(a.day), buildWeekScorecard(next, BANKS, weekOf(a.day))).catch(() => {});
    for (const c of a.meta?.missChunks || []) {
      if (!c.phrase) continue;
      const prev = pairsRef.current.find((p) => p.phrase === c.phrase.toLowerCase());
      savePair({ phrase: c.phrase.toLowerCase(), answer: c.answer, source: `${TASKS[a.task].label} ${a.item_id}`, misses: (prev?.misses || 0) + 1, mastered: false });
    }
    if (saved.pending) setError('Saved on this device. It will sync to Supabase when the connection works again.');
    return saved;
  }, [savePair]);

  const onPatch = useCallback(async (saved, patch) => {
    const meta = { ...(saved.meta || {}), ...patch };
    await store.patchAttempt(saved.id, patch, saved.meta).catch(() => {});
    const next = attemptsRef.current.map((x) => (x === saved || (x.id && x.id === saved.id) ? { ...x, meta } : x));
    attemptsRef.current = next; setAttempts(next);
  }, []);

  const dayAttempts = useMemo(() => (attempts || []).filter((a) => a.day === day), [attempts, day]);
  const doneCounts = useMemo(() => {
    const c = {};
    for (const k of Object.keys(TASKS)) c[k] = new Set(dayAttempts.filter((a) => a.task === k && !a.focus).map((a) => a.item_id)).size;
    return c;
  }, [dayAttempts]);

  const lastDay = today > EXAM_DATE ? today : EXAM_DATE;
  function go(d) { stopVoice(); setFocusRun(null); setDay(d < PLAN_START ? PLAN_START : d > lastDay ? lastDay : d); }
  const toExam = diffDays(day, EXAM_DATE);

  if (!loaded) return <Shell><p className="muted">Loading your log…</p></Shell>;

  const planned = Object.entries(plan.counts);
  const plannedTotal = planned.reduce((a, [, n]) => a + n, 0);
  const plannedDone = planned.reduce((a, [k, n]) => a + Math.min(n, doneCounts[k] || 0), 0);
  const common = { day, dayAttempts, onAttempt, onPatch, settings, engine };

  function renderDrill(task, items, focus, onFinish, key) {
    const C = DRILLS[task];
    return <C key={key} task={task} {...common} bank={bankFor(task)} items={items} focus={focus} onFinish={onFinish} />;
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">Mission CLB 10 · PTE Core trainer</div>
          <h1>{day === EXAM_DATE ? 'Exam day' : 'Day ' + plan.n}</h1>
          <div className="muted">{fmtLong(day)}{day === today ? ' · today' : ''}{toExam > 0 ? ` · ${toExam} days to PTE Core` : ''}{plannedTotal ? ` · ${plannedDone}/${plannedTotal} planned items done` : ''}</div>
        </div>
        <div className="daynav">
          <button aria-label="Previous day" onClick={() => go(addDays(day, -1))} disabled={day <= PLAN_START}>‹</button>
          <button onClick={() => go(today)}>Today</button>
          <button aria-label="Next day" onClick={() => go(addDays(day, 1))} disabled={day >= lastDay}>›</button>
        </div>
      </header>

      {error && <div className="notice" role="status">{error} <button className="linkish" onClick={() => setError('')}>Dismiss</button></div>}
      {engine === 'browser' && azure.checked && settings.engine !== 'browser' && (
        <div className="notice">Azure Speech isn't connected, so speaking is scored on words and timing only. See Settings.</div>
      )}

      <nav className="tabs" role="tablist">
        {[['today', 'Today'], ['practice', 'Practice'], ['report', 'Coach report'], ['trends', 'Trends'], ['pairs', 'Word pairs'], ['settings', 'Settings']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { stopVoice(); setTab(k); }}>{l}</button>
        ))}
      </nav>

      {tab === 'today' && (sets === 'future'
        ? <section className="card"><h2>Opens on {fmtLong(day)}</h2>{plan.note && <p>{plan.note}</p>}<p className="muted">Each day's set is built from your earlier results, so it opens on the day.</p></section>
        : <Today plan={plan} sets={sets} doneCounts={doneCounts} open={openTask} />)}

      {tab === 'practice' && (
        sets === null ? <p className="muted">Preparing the day's set…</p>
        : sets === 'future' ? <section className="card"><h2>Opens on {fmtLong(day)}</h2></section>
        : !sets[ptab] ? <p className="muted">Preparing {TASKS[ptab].label}…</p>
        : (
          <div className="stack">
            <div className="btnrow">
              <select id="taskSel" value={ptab} onChange={(e) => openTask(e.target.value)} aria-label="Task">
                {Object.entries(TASKS).map(([k, t]) => <option key={k} value={k}>{t.section} · {t.label}{plan.counts[k] ? ` (${Math.min(doneCounts[k], plan.counts[k])}/${plan.counts[k]} today)` : ''}</option>)}
              </select>
              <button onClick={() => setTab('today')}>← Today's plan</button>
            </div>
            {renderDrill(ptab, sets[ptab], false, () => setTab('today'), day + ptab)}
          </div>
        )
      )}

      {tab === 'report' && (
        focusRun ? (
          <div className="stack">
            <div className="btnrow"><button onClick={() => { stopVoice(); setFocusRun(null); }}>← Back to report</button><span className="muted small">{focusRun.title}</span></div>
            {focusRun.ids.length ? renderDrill(focusRun.task, focusRun.ids.map((id) => ({ id, kind: 'new' })), true, () => setFocusRun(null), JSON.stringify(focusRun))
              : <p className="muted">No fresh items left for this drill today.</p>}
          </div>
        ) : <Report day={day} attempts={attempts} banks={BANKS} items={ITEMS} settings={settings} engine={engine} startFocus={(f) => setFocusRun(f)} />
      )}

      {tab === 'trends' && <Trends attempts={attempts} banks={BANKS} items={ITEMS} today={today} />}
      {tab === 'pairs' && <WordPairs pairs={pairs} savePair={savePair} />}
      {tab === 'settings' && <Settings settings={settings} set={setSettings} engine={engine} azure={azure} user={user} attempts={attempts} />}
    </div>
  );
}
