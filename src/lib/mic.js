// Microphone helpers: a recorder for playback, and a browser-only fallback take
// (voice activity detection + Web Speech) used when Azure is not configured.

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const browserRecognition = !!SR;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Records the mic to a blob so you can replay yourself. */
export async function startRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const chunks = [];
  let rec;
  try { rec = new MediaRecorder(stream); } catch { stream.getTracks().forEach((t) => t.stop()); return null; }
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  return {
    stream,
    stop: () => new Promise((resolve) => {
      const done = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })) : null);
      };
      if (rec.state === 'inactive') return done();
      rec.onstop = done;
      rec.stop();
    }),
  };
}

let threshold = 0.02;
try { threshold = Number(localStorage.getItem('b3.micThreshold')) || 0.02; } catch {}

function rmsMeter(stream) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  return {
    level() { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); },
    close() { ctx.close().catch(() => {}); },
  };
}

/** Measure background noise for 1.5 s and set the voice threshold (fallback engine only). */
export async function calibrate() {
  const r = await startRecorder();
  if (!r) throw new Error('Microphone not available');
  const m = rmsMeter(r.stream);
  const vals = [];
  for (let i = 0; i < 30; i++) { vals.push(m.level()); await wait(50); }
  m.close(); await r.stop();
  vals.sort((a, b) => a - b);
  const floor = vals[Math.floor(vals.length * 0.8)] || 0.005;
  threshold = Math.min(0.08, Math.max(0.012, floor * 3));
  try { localStorage.setItem('b3.micThreshold', String(threshold)); } catch {}
  return { floor, threshold };
}

export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.07;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {}
}

/**
 * Fallback take: PTE-style rules (mic closes after 3 s of silence) with a level meter
 * for timing and the browser's speech-to-text for the words. No pronunciation scores.
 */
export async function browserTake({ maxMs, lang = 'en-US', onState }) {
  const r = await startRecorder();
  if (!r) throw new Error('Microphone not available');
  const meter = rmsMeter(r.stream);
  const finals = [];
  let interim = '';
  let rec = null;
  let recEnded = Promise.resolve();
  if (SR) {
    try {
      rec = new SR();
      rec.lang = lang; rec.continuous = true; rec.interimResults = true;
      let endRes; recEnded = new Promise((res) => (endRes = res));
      rec.onresult = (e) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const x = e.results[i];
          if (x.isFinal) finals[i] = x[0].transcript; else interim += x[0].transcript;
        }
      };
      rec.onerror = () => {};
      rec.onend = () => endRes();
      rec.start();
    } catch { rec = null; recEnded = Promise.resolve(); }
  }
  const t0 = performance.now();
  let first = null, last = null, stopped = false, resolveDone;
  const pauses = [];
  const done = new Promise((res) => (resolveDone = res));
  const finish = async (reason) => {
    if (stopped) return;
    stopped = true;
    clearInterval(iv);
    meter.close();
    const audioUrl = await r.stop();
    if (rec) { try { rec.stop(); } catch {} await Promise.race([recEnded, wait(2500)]); }
    const transcript = (finals.filter(Boolean).join(' ') + ' ' + interim).replace(/\s+/g, ' ').trim();
    resolveDone({
      engine: 'browser', reason, transcript, audioUrl,
      micClosed: first === null,
      latencyMs: first === null ? null : Math.round(first),
      durationMs: first === null ? 0 : Math.round(last - first),
      pauses, scores: null, mispronounced: [], recognition: !!rec,
    });
  };
  const iv = setInterval(() => {
    const t = performance.now() - t0;
    const voiced = meter.level() > threshold;
    if (voiced) {
      if (first === null) first = t;
      else if (t - last >= 700) pauses.push(Math.round(t - last));
      last = t;
    }
    onState && onState({ elapsed: t, speaking: first !== null });
    if (first === null && t >= 3000) finish('no-speech');
    else if (first !== null && t - last >= 3000) finish('silence');
    else if (t >= maxMs) finish('time');
  }, 50);
  onState && onState({ elapsed: 0, speaking: false });
  return { stop: () => finish('manual'), done };
}
