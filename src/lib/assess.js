// Scores a spoken response against reference text.
// Azure pronunciation assessment: accuracy, fluency, completeness, prosody (en-US) per word.
// Recording rules follow PTE: the mic closes if you are silent for 3 s.
import { getSpeechToken, loadSdk } from './azure.js';
import { startRecorder, browserTake } from './mic.js';
import { compare, normalizeSpeech, cleanWord } from './score.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TICKS_PER_MS = 10000;

export function summarizeAzure({ reference, segments, reason, audioUrl, error }) {
  const words = [];
  const segScores = [];
  const text = [];
  for (const s of segments) {
    const nb = s?.NBest?.[0];
    if (!nb) continue;
    text.push(s.DisplayText || nb.Display || '');
    segScores.push({ ...(nb.PronunciationAssessment || {}), dur: s.Duration || 1 });
    for (const w of nb.Words || []) words.push(w);
  }
  const transcript = text.join(' ').replace(/\s+/g, ' ').trim();
  const heard = normalizeSpeech(transcript);
  const cmp = compare(reference, heard);
  const spoken = words.filter((w) => w.PronunciationAssessment?.ErrorType !== 'Omission' && typeof w.Offset === 'number');

  const pauses = [];
  for (let i = 1; i < spoken.length; i++) {
    const gap = (spoken[i].Offset - (spoken[i - 1].Offset + spoken[i - 1].Duration)) / TICKS_PER_MS;
    if (gap >= 700) pauses.push(Math.round(gap));
  }
  const first = spoken[0], last = spoken[spoken.length - 1];
  const durationMs = spoken.length ? Math.round((last.Offset + last.Duration - first.Offset) / TICKS_PER_MS) : 0;
  const micClosed = reason === 'no-speech' || (!spoken.length && reason !== 'error');

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const weighted = (key) => {
    const xs = segScores.filter((s) => typeof s[key] === 'number');
    if (!xs.length) return null;
    const tot = xs.reduce((a, s) => a + s.dur, 0);
    return xs.reduce((a, s) => a + s[key] * s.dur, 0) / tot;
  };
  const accuracy = mean(spoken.map((w) => w.PronunciationAssessment?.AccuracyScore).filter((x) => typeof x === 'number'));
  const round = (x) => (x == null ? null : Math.round(x));
  const scores = spoken.length ? {
    accuracy: round(accuracy),
    fluency: round(weighted('FluencyScore')),
    prosody: round(weighted('ProsodyScore')),
    completeness: cmp.total ? Math.round((cmp.score / cmp.total) * 100) : null,
    pron: segScores.length === 1 ? round(segScores[0].PronScore) : null,
  } : null;

  const mispronounced = spoken
    .filter((w) => w.PronunciationAssessment?.ErrorType === 'Mispronunciation' || (w.PronunciationAssessment?.AccuracyScore ?? 100) < 60)
    .map((w) => ({ word: cleanWord(w.Word), accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0) }))
    .filter((w) => w.word.length > 1)
    .slice(0, 12);

  return {
    engine: 'azure', reason, error, transcript, heard, audioUrl, micClosed,
    latencyMs: first ? Math.round(first.Offset / TICKS_PER_MS) : null,
    durationMs, pauses, scores, mispronounced,
    wpm: durationMs > 2000 ? Math.round(spoken.length / (durationMs / 60000)) : null,
    cmp, score: micClosed ? 0 : cmp.score, total: cmp.total,
  };
}

async function azureTake({ reference, lang, maxMs, onState }) {
  const sdk = await loadSdk();
  const { token, region } = await getSpeechToken();
  const cfg = sdk.SpeechConfig.fromAuthorizationToken(token, region);
  cfg.speechRecognitionLanguage = lang;
  cfg.outputFormat = sdk.OutputFormat.Detailed;
  cfg.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '3000');
  cfg.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, '3000');
  const rec = new sdk.SpeechRecognizer(cfg, sdk.AudioConfig.fromDefaultMicrophoneInput());
  const pa = new sdk.PronunciationAssessmentConfig(
    reference,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Word,
    !!reference // miscue (omitted/inserted words) only when there is a script; empty reference = unscripted speech
  );
  if (lang === 'en-US') pa.enableProsodyAssessment = true;
  pa.applyTo(rec);

  const playback = await startRecorder().catch(() => null);
  const segments = [];
  let heardAny = false, finished = false, endTimer = null, error = '';
  let resolveDone, resolveStopped;
  const done = new Promise((r) => (resolveDone = r));
  const stoppedP = new Promise((r) => (resolveStopped = r));
  let t0 = performance.now();
  let tick = null;

  const finish = async (reason) => {
    if (finished) return;
    finished = true;
    clearInterval(tick); clearTimeout(endTimer);
    await new Promise((r) => rec.stopContinuousRecognitionAsync(r, r));
    await Promise.race([stoppedP, wait(2500)]);
    try { rec.close(); } catch {}
    const audioUrl = playback ? await playback.stop() : null;
    resolveDone(summarizeAzure({ reference, segments, reason, audioUrl, error }));
  };

  rec.recognizing = () => {
    heardAny = true;
    if (endTimer) { clearTimeout(endTimer); endTimer = null; }
  };
  rec.recognized = (_s, e) => {
    const r = e.result;
    if (r.reason === sdk.ResultReason.RecognizedSpeech && r.text) {
      heardAny = true;
      try { segments.push(JSON.parse(r.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult))); } catch {}
      // A segment ends after 3 s of silence. Wait briefly in case it was only a length split.
      if (!finished) { clearTimeout(endTimer); endTimer = setTimeout(() => finish('silence'), 600); }
    } else if (r.reason === sdk.ResultReason.NoMatch && !heardAny) {
      finish('no-speech');
    }
  };
  rec.canceled = (_s, e) => {
    if (e.reason === sdk.CancellationReason.Error) error = e.errorDetails || 'Speech service error';
    finish('error');
  };
  rec.sessionStopped = () => resolveStopped();

  await new Promise((res, rej) => rec.startContinuousRecognitionAsync(res, (e) => rej(new Error(String(e)))));
  t0 = performance.now();
  tick = setInterval(() => {
    const t = performance.now() - t0;
    onState && onState({ elapsed: t, speaking: heardAny });
    if (t >= maxMs) finish('time');
    else if (!heardAny && t >= 3600) finish('no-speech');
  }, 100);
  onState && onState({ elapsed: 0, speaking: false });
  return { stop: () => finish('manual'), done };
}

/** Start a scored recording. Returns { stop(), done } where done resolves to the result. */
export async function startTake({ engine, reference, lang = 'en-US', maxMs, onState }) {
  if (engine === 'azure') return azureTake({ reference, lang, maxMs, onState });
  const t = await browserTake({ maxMs, lang, onState });
  return {
    stop: t.stop,
    done: t.done.then((res) => {
      const heard = normalizeSpeech(res.transcript);
      const cmp = compare(reference, heard);
      return {
        ...res, heard, cmp,
        score: res.micClosed ? 0 : cmp.score, total: cmp.total,
        wpm: res.durationMs > 2000 ? Math.round(heard.split(/\s+/).filter(Boolean).length / (res.durationMs / 60000)) : null,
      };
    }),
  };
}
