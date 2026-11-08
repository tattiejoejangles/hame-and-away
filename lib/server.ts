import { createClient } from '@supabase/supabase-js';

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Server-only. The service role key bypasses row level security, which is why
 *  scores can only ever be written here and never from a browser. */
export const admin = () =>
  createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

export async function userFrom(req: Request) {
  const a = req.headers.get('authorization') || '';
  const t = a.startsWith('Bearer ') ? a.slice(7) : '';
  if (!t) return null;
  const { data, error } = await admin().auth.getUser(t);
  return error ? null : data.user;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const clean = (s: string) =>
  (s || '').replace(/[^A-Za-z0-9 .'-]/g, '').trim().slice(0, 16).toUpperCase();

/* ---------- the same question pick and scoring the browser runs ---------- */
import QUESTIONS from '../public/questions.json';
type Q = { id: string; fam: string; prompt: string; kind: string; answers: { name: string; yds: number }[] };
const QS = (QUESTIONS as any).questions as Q[];

const PER = 7;
const EPOCH = Date.UTC(2026, 10, 7);           // matchday 1 = Sat 7 Nov 2026
export const matchdayNo = () => Math.max(1, Math.floor((Date.now() - EPOCH) / 86400000) + 1);
export const weekOf = (md: number) => Math.floor((md - 1) / 7) + 1;

function hash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 20; i++) f();
  return f;
}
const CAP: Record<string, number> = { md: 2, roster: 1, goals: 2, apps: 1, gk: 1, misc: 2 };

function dayKeyFor(md: number) {
  const d = new Date(EPOCH + (md - 1) * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function questionsFor(md: number) {
  const r = rng(hash(dayKeyFor(md)));
  const pool = QS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: Q[] = [], used: Record<string, number> = {};
  for (const q of pool) {
    if (out.length === PER) break;
    const f = q.fam || 'misc';
    if ((used[f] || 0) >= (CAP[f] || 2)) continue;
    used[f] = (used[f] || 0) + 1; out.push(q);
  }
  for (const q of pool) { if (out.length === PER) break; if (!out.includes(q)) out.push(q); }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function scoreRound(md: number, given: (string | null)[]) {
  const qs = questionsFor(md);
  const shots = qs.map((q, i) => {
    const name = given[i];
    const hit = name ? q.answers.find(a => a.name === name) : undefined;
    return { q: q.prompt, given: hit ? hit.name : null, yds: hit ? hit.yds : 0, kg: !!(hit && hit.yds === 100) };
  });
  const total = shots.reduce((a, s) => a + s.yds, 0);
  const keepers = shots.filter(s => s.kg).length;
  const grid = shots.map(s =>
    s.yds === 0 ? '⬛' : s.yds === 100 ? '🧤' :
    s.yds >= 80 ? '🟩' : s.yds >= 60 ? '🟨' :
    s.yds >= 40 ? '🟧' : '🟥').join('');
  return { shots, total, keepers, grid };
}
