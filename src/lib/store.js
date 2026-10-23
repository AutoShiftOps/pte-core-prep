// Persistence. With Supabase env vars: your account's tables (RLS, magic-link sign-in).
// Without them: this browser's localStorage, so the app still runs locally.
// Failed cloud writes go to an outbox and sync on the next successful load or save.
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

function localStore() {
  return {
    mode: 'local',
    async getUser() { return { id: 'local', email: 'this browser' }; },
    onAuth() { return () => {}; },
    async accessToken() { return null; },
    async signIn() {},
    async signOut() {},
    async listAttempts() { return lsGet('b3.attempts', []); },
    async addAttempt(a) {
      const row = { ...a, id: uid(), created_at: new Date().toISOString() };
      const all = lsGet('b3.attempts', []); all.push(row); lsSet('b3.attempts', all);
      return row;
    },
    async getDailySet(day) { return lsGet('b3.sets', {})[day] || null; },
    async saveDailySet(day, sets) { const m = lsGet('b3.sets', {}); m[day] = sets; lsSet('b3.sets', m); },
    async saveSummary(day, summary) { const m = lsGet('b3.summaries', {}); m[day] = summary; lsSet('b3.summaries', m); },
    async patchAttempt(id, metaPatch) {
      const all = lsGet('b3.attempts', []); const a = all.find((x) => x.id === id);
      if (a) { a.meta = { ...(a.meta || {}), ...metaPatch }; lsSet('b3.attempts', all); }
    },
    async listPairs() { return lsGet('b3.pairs', []); },
    async savePair(row) {
      const all = lsGet('b3.pairs', []); const i = all.findIndex((x) => x.phrase === row.phrase);
      const saved = { id: row.id || uid(), created_at: new Date().toISOString(), ...(i >= 0 ? all[i] : {}), ...row, updated_at: new Date().toISOString() };
      if (i >= 0) all[i] = saved; else all.push(saved);
      lsSet('b3.pairs', all); return saved;
    },
    async saveWeek(week, data) { const m = lsGet('b3.weeks', {}); m[week] = data; lsSet('b3.weeks', m); },
    pending() { return 0; },
  };
}

function cloudStore() {
  const sb = createClient(SB_URL, SB_KEY);
  const OUT = 'b3.outbox';
  const toRow = (a) => ({ day: a.day, task: a.task, item_id: a.item_id, focus: !!a.focus, response: a.response || '', score: a.score, total: a.total, meta: a.meta || {}, created_at: a.created_at });
  async function flush() {
    const box = lsGet(OUT, []);
    if (!box.length) return;
    const { error } = await sb.from('attempts').insert(box.map(toRow));
    if (!error) lsSet(OUT, []);
  }
  return {
    mode: 'cloud',
    async getUser() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
    onAuth(cb) { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user || null)); return () => data.subscription.unsubscribe(); },
    async accessToken() { const { data } = await sb.auth.getSession(); return data.session?.access_token || null; },
    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); },
    async listAttempts() {
      await flush().catch(() => {});
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('attempts')
          .select('id,day,task,item_id,focus,response,score,total,meta,created_at')
          .order('created_at', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return [...rows, ...lsGet(OUT, []).map((b) => ({ ...b, pending: true }))];
    },
    async addAttempt(a) {
      const row = { ...a, created_at: new Date().toISOString() };
      const { data, error } = await sb.from('attempts').insert(toRow(row)).select().single();
      if (error) {
        const box = lsGet(OUT, []); box.push(row); lsSet(OUT, box);
        return { ...row, id: 'pending-' + uid(), pending: true };
      }
      flush().catch(() => {});
      return data;
    },
    async getDailySet(day) {
      const { data, error } = await sb.from('daily_sets').select('sets').eq('day', day).maybeSingle();
      if (error) throw error;
      return data?.sets || null;
    },
    async saveDailySet(day, sets) {
      const { error } = await sb.from('daily_sets').upsert({ day, sets }, { onConflict: 'user_id,day' });
      if (error) throw error;
    },
    async saveSummary(day, summary) {
      await sb.from('daily_summaries').upsert({ day, summary, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
    },
    async patchAttempt(id, metaPatch, meta) {
      if (!id || String(id).startsWith('pending')) return;
      await sb.from('attempts').update({ meta: { ...(meta || {}), ...metaPatch } }).eq('id', id);
    },
    async listPairs() {
      const { data, error } = await sb.from('collocations').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    async savePair(row) {
      const { id, ...rest } = row;
      const { data, error } = await sb.from('collocations').upsert({ ...rest, updated_at: new Date().toISOString() }, { onConflict: 'user_id,phrase' }).select().single();
      if (error) throw error;
      return data;
    },
    async saveWeek(week, data) {
      await sb.from('weekly_scorecards').upsert({ week, starts: data.from, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,week' });
    },
    pending() { return lsGet(OUT, []).length; },
  };
}

export const store = SB_URL && SB_KEY ? cloudStore() : localStore();
