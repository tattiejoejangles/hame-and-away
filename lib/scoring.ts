import questions from '../public/questions.json';

export type Question = {
  id: string; fam: string; prompt: string; hint: string; kind: string;
  answers: { name: string; yds: number }[];
};
export const QS = (questions as any).questions as Question[];
export const KEYS = (questions as any).keys as Record<string, string[]>;

export const PER = 7;
export const SECS = 25;
export const MAXY = 700;

/** Matchday 1 is Saturday 7 November 2026. */
const EPOCH = Date.UTC(2026, 10, 7);
export const matchdayNo = () =>
  Math.max(1, Math.floor((Date.now() - EPOCH) / 86400000) + 1);
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

/** The same seven questions for everyone, worked out from the matchday alone.
 *  The server runs this too, which is how a submitted score gets checked. */
export function questionsFor(md: number): Question[] {
  const r = rng(hash('md:' + md));
  const pool = QS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: Question[] = [], used: Record<string, number> = {};
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

/** Turn a list of answers into yards. Used by the browser to show a score and by
 *  the server to work it out again before saving, so a made-up 700 gets rejected. */
export function scoreRound(md: number, given: (string | null)[]) {
  const qs = questionsFor(md);
  const shots = qs.map((q, i) => {
    const name = given[i];
    const hit = name ? q.answers.find(a => a.name === name) : undefined;
    return { q: q.prompt, given: hit ? hit.name : null, yds: hit ? hit.yds : 0, kg: !!(hit && hit.yds === 100), top: q.answers[0].name };
  });
  const total = shots.reduce((a, s) => a + s.yds, 0);
  const keepers = shots.filter(s => s.kg).length;
  const grid = shots.map(s =>
    s.yds === 0 ? '⬛' : s.yds === 100 ? '🧤' :
    s.yds >= 80 ? '🟩' : s.yds >= 60 ? '🟨' :
    s.yds >= 40 ? '🟧' : '🟥').join('');
  return { shots, total, keepers, grid };
}

export const TIERS: [number, string, string][] = [
  [0, 'Hoofed It', 'Straight into the car park. Someone fetch the ball.'],
  [120, 'Sunday League', 'Plenty of shooting practice to do.'],
  [230, 'Squad Player', 'You know the regulars. The deep cuts are getting away.'],
  [340, 'Solid Starter', 'A respectable afternoon. Nothing in the top corner.'],
  [450, 'Key Player', 'You have read the spreadsheet. Possibly twice.'],
  [550, 'Worldie', 'From distance, into the top bin. Show someone this.'],
  [640, 'Cheat Code', 'Nicolson-from-centre-back territory. Deeply suspicious.'],
];
export const tierFor = (t: number) => { let o = TIERS[0]; for (const r of TIERS) if (t >= r[0]) o = r; return o; };
