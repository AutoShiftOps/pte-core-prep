import { isStaleChunk, reloadOnce } from './stale.js';
// Azure Speech: the key stays on the server; the browser gets a 10-minute token
// from /api/speech-token (Vercel function), same pattern as FrenchFry.

let jwtProvider = async () => null;
let token = null;
let status = { checked: false, ok: false, reason: '' };
let sdkPromise = null;

export function setJwtProvider(fn) { jwtProvider = fn; }

export async function getSpeechToken(force = false) {
  if (!force && token && token.exp > Date.now()) return token;
  const jwt = await jwtProvider();
  const r = await fetch('/api/speech-token', {
    method: 'POST',
    headers: jwt ? { Authorization: 'Bearer ' + jwt } : {},
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Speech token request failed (${r.status}). ${body.slice(0, 160)}`);
  }
  const j = await r.json();
  token = { token: j.token, region: j.region, exp: Date.now() + 8 * 60 * 1000 };
  return token;
}

export async function checkAzure() {
  try {
    await getSpeechToken(true);
    status = { checked: true, ok: true, reason: '' };
  } catch (e) {
    status = { checked: true, ok: false, reason: e.message };
  }
  return status;
}
export const azureStatus = () => status;

export function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import('microsoft-cognitiveservices-speech-sdk').catch((e) => {
      sdkPromise = null; // let the next attempt retry
      if (isStaleChunk(e) && reloadOnce()) return new Promise(() => {}); // page is reloading onto the new build
      throw e;
    });
  }
  return sdkPromise;
}
