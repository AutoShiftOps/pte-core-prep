import { useEffect, useState } from 'react';

export const DEFAULT_SETTINGS = {
  engine: 'auto',        // auto: Azure when the token endpoint works, else browser
  voiceMode: 'mix',      // mix: rotate British/American/Australian/Canadian voices like the real test
  voice: 'en-GB-SoniaNeural',
  rate: 1,               // 1 = natural exam speed
  examRules: true,       // dictation plays once
  examTiming: true,      // time limits auto-submit, like the test; off = learning mode (clock shows, never submits)
  beep: true,            // short tone when the mic opens
  lang: 'en-US',         // en-US also returns a prosody (intonation) score
};

export function useSettings() {
  const [s, setS] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('b3.settings') || '{}') }; }
    catch { return DEFAULT_SETTINGS; }
  });
  useEffect(() => { try { localStorage.setItem('b3.settings', JSON.stringify(s)); } catch {} }, [s]);
  return [s, (patch) => setS((p) => ({ ...p, ...patch }))];
}
