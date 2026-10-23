// Reads prompts aloud. Azure neural voices first (accents rotate like the real test),
// browser voices as a fallback.
import { getSpeechToken, loadSdk } from './azure.js';

export const AZURE_VOICES = [
  { name: 'en-GB-SoniaNeural', label: 'British · Sonia' },
  { name: 'en-GB-RyanNeural', label: 'British · Ryan' },
  { name: 'en-US-JennyNeural', label: 'American · Jenny' },
  { name: 'en-US-GuyNeural', label: 'American · Guy' },
  { name: 'en-AU-NatashaNeural', label: 'Australian · Natasha' },
  { name: 'en-AU-WilliamNeural', label: 'Australian · William' },
  { name: 'en-CA-ClaraNeural', label: 'Canadian · Clara' },
  { name: 'en-CA-LiamNeural', label: 'Canadian · Liam' },
];

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

/** Voice for an item: rotating accents by item, or the one fixed voice from settings. */
export function voiceFor(itemId, settings) {
  if (settings.voiceMode === 'fixed') return settings.voice || AZURE_VOICES[0].name;
  return AZURE_VOICES[hash(itemId || 'x') % AZURE_VOICES.length].name;
}
export const voiceLabel = (name) => AZURE_VOICES.find((v) => v.name === name)?.label || name;

const cache = new Map();
let current = null; // { audio, resolve }

const escXml = (s) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

async function azureAudioUrl(text, voice, rate) {
  const key = `${voice}|${rate}|${text}`;
  if (cache.has(key)) return cache.get(key);
  const sdk = await loadSdk();
  const { token, region } = await getSpeechToken();
  const cfg = sdk.SpeechConfig.fromAuthorizationToken(token, region);
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  const synth = new sdk.SpeechSynthesizer(cfg, null);
  const pct = Math.round((rate - 1) * 100);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.slice(0, 5)}"><voice name="${voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${escXml(text)}</prosody></voice></speak>`;
  const data = await new Promise((resolve, reject) => {
    synth.speakSsmlAsync(
      ssml,
      (r) => {
        synth.close();
        if (r.reason === sdk.ResultReason.SynthesizingAudioCompleted) resolve(r.audioData);
        else reject(new Error(r.errorDetails || 'Speech synthesis failed'));
      },
      (e) => { synth.close(); reject(new Error(String(e))); }
    );
  });
  const url = URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
  cache.set(key, url);
  return url;
}

export function stopVoice() {
  if (current) { current.audio.pause(); current.resolve(); current = null; }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function browserSpeak(text, rate) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const synth = window.speechSynthesis;
    const voices = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
    const v = voices.find((x) => /en-GB/i.test(x.lang) && /Google|Natural|Online/i.test(x.name)) || voices.find((x) => /en-(GB|US|CA|AU)/i.test(x.lang)) || voices[0];
    const parts = text.match(/[^.!?]+[.!?]*/g) || [text]; // long utterances can stall in Chrome
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = rate;
      if (i === parts.length - 1) { u.onend = resolve; u.onerror = resolve; }
      synth.speak(u);
    });
  });
}

/** Speak text and resolve when playback ends (or is stopped). */
export async function speak(text, { engine = 'azure', voice = AZURE_VOICES[0].name, rate = 1 } = {}) {
  stopVoice();
  if (engine === 'azure') {
    try {
      const url = await azureAudioUrl(text, voice, rate);
      const audio = new Audio(url);
      await new Promise((resolve) => {
        current = { audio, resolve };
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
      if (current?.audio === audio) current = null;
      return;
    } catch (e) {
      console.warn('Azure voice failed, using browser voice', e);
    }
  }
  return browserSpeak(text, rate);
}
