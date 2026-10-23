// Vercel serverless function: exchanges the Azure Speech key (server-side only)
// for a 10-minute token. Only your signed-in Supabase user can get one.
//
// Env (Vercel → Project → Settings → Environment Variables):
//   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION      — reuse FrenchFry's values
//   SUPABASE_URL, SUPABASE_ANON_KEY            — same values as the VITE_ ones
//   ALLOWED_EMAIL                              — your email; everyone else is refused

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return res.status(500).json({ error: 'AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not set' });

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY;
  if (sbUrl && sbKey) {
    const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return res.status(401).json({ error: 'Sign in first' });
    const u = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: sbKey, Authorization: `Bearer ${jwt}` } });
    if (!u.ok) return res.status(401).json({ error: 'Session expired. Sign in again.' });
    const user = await u.json();
    const allowed = (process.env.ALLOWED_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes((user.email || '').toLowerCase())) return res.status(403).json({ error: 'This account is not allowed' });
  }

  const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
  });
  if (!r.ok) return res.status(502).json({ error: `Azure token request failed (${r.status})` });
  const token = await r.text();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ token, region });
}
