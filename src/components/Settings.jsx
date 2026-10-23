import { useState } from 'react';
import { AZURE_VOICES, speak } from '../lib/voice.js';
import { calibrate } from '../lib/mic.js';
import { startTake } from '../lib/assess.js';
import { store } from '../lib/store.js';
import { Chip, SpeechScores } from './common.jsx';

const TEST = 'The library will be closed for maintenance during the winter break.';

export default function Settings({ settings, set, engine, azure, user, attempts }) {
  const [mic, setMic] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  async function micTest() {
    setBusy(true); setMic(null);
    try {
      if (engine === 'browser') await calibrate();
      await speak('Read this sentence after the beep.', { engine, voice: settings.voice, rate: settings.rate });
      const t = await startTake({ engine, reference: TEST, lang: settings.lang, maxMs: 10000 });
      setMic(await t.done);
    } catch (e) { setMic({ error: e.message }); }
    setBusy(false);
  }

  async function copyJson() {
    const text = JSON.stringify(attempts, null, 1);
    try { await navigator.clipboard.writeText(text); setCopied('Copied ' + attempts.length + ' attempts.'); }
    catch { setCopied('Copy failed. Use Download instead.'); }
  }
  function download() {
    const blob = new Blob([JSON.stringify(attempts, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'big-three-log.json'; a.click();
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="cardhead"><h2>Speech engine</h2>
          <Chip tone={engine === 'azure' ? 'good' : 'warn'}>{engine === 'azure' ? 'Azure Speech' : 'Browser fallback'}</Chip></div>
        <p className="small">{azure.ok ? 'Azure is connected: neural voices and pronunciation assessment are on.' : `Azure is not available${azure.reason ? ': ' + azure.reason : ''}. Using browser voices and transcription (words and timing only).`}</p>
        <div className="settings">
          <label>Engine <select id="engineSel" value={settings.engine} onChange={(e) => set({ engine: e.target.value })}>
            <option value="auto">Azure when available</option><option value="browser">Browser only</option></select></label>
          <label>Voices <select id="voiceMode" value={settings.voiceMode} onChange={(e) => set({ voiceMode: e.target.value })}>
            <option value="mix">Rotate accents (like the test)</option><option value="fixed">One voice</option></select></label>
          {settings.voiceMode === 'fixed' && <label>Voice <select id="voiceSel" value={settings.voice} onChange={(e) => set({ voice: e.target.value })}>
            {AZURE_VOICES.map((v) => <option key={v.name} value={v.name}>{v.label}</option>)}</select></label>}
          <label>Speed <select id="rateSel" value={settings.rate} onChange={(e) => set({ rate: Number(e.target.value) })}>
            <option value={0.9}>Slower</option><option value={1}>Natural (exam)</option><option value={1.1}>Faster</option></select></label>
          <label>Scoring accent <select id="langSel" value={settings.lang} onChange={(e) => set({ lang: e.target.value })}>
            <option value="en-US">American (adds intonation score)</option><option value="en-GB">British</option><option value="en-CA">Canadian</option></select></label>
          <label><input type="checkbox" checked={settings.examRules} onChange={(e) => set({ examRules: e.target.checked })} /> Dictation plays once</label>
          <label><input type="checkbox" id="examTiming" checked={settings.examTiming !== false} onChange={(e) => set({ examTiming: e.target.checked })} /> Exam timing: answers auto-submit when time runs out</label>
          <label><input type="checkbox" checked={settings.beep} onChange={(e) => set({ beep: e.target.checked })} /> Beep when the mic opens</label>
        </div>
      </section>
      <section className="card">
        <div className="cardhead"><h2>Microphone check</h2></div>
        <p className="small">Use a headset with a boom mic, as at the test centre. Press the button, wait for the beep, then read: <i>{TEST}</i></p>
        <div className="btnrow"><button className="primary" onClick={micTest} disabled={busy}>{busy ? 'Listening…' : 'Test my microphone'}</button></div>
        {mic?.error && <div className="notice">{mic.error}</div>}
        {mic && !mic.error && <div className="stack"><SpeechScores r={mic} /><p className="small muted">Heard: “{mic.heard}”</p>{mic.audioUrl && <audio controls src={mic.audioUrl} />}</div>}
      </section>
      <section className="card">
        <div className="cardhead"><h2>Your data</h2><Chip>{store.mode === 'cloud' ? 'Supabase' : 'This browser only'}</Chip></div>
        <p className="small">{store.mode === 'cloud' ? `Signed in as ${user.email}. Every attempt and daily report is saved to your Supabase project.` : 'Local mode: data stays in this browser. Add the Supabase variables to sync across devices.'} {store.pending() > 0 && <b>{store.pending()} attempts waiting to sync.</b>}</p>
        <div className="btnrow">
          <button onClick={download}>Download my log (JSON)</button>
          <button onClick={copyJson}>Copy log for Claude</button>
          {store.mode === 'cloud' && <button onClick={() => store.signOut()}>Sign out</button>}
        </div>
        {copied && <p className="small">{copied}</p>}
      </section>
    </div>
  );
}
