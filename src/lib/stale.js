// After a new deployment, a tab that is still open runs the old build and asks for old, hashed chunk
// files that no longer exist ("Failed to fetch dynamically imported module"). Reloading picks up the
// new build. Guarded so a real network outage can't cause a reload loop.
const KEY = 'b3.staleReloadAt';
const STALE = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

export const isStaleChunk = (err) => STALE.test(String(err?.message || err || ''));

export function reloadOnce() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch {}
  if (Date.now() - last < 60000) return false; // already tried in the last minute
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
  window.location.reload();
  return true;
}
