import { KEYS, Question } from './scoring';

export const norm = (s: string) =>
  (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export type Resolved =
  | { status: 'ok'; name: string }
  | { status: 'ambiguous'; options: string[] }
  | { status: 'short' } | { status: 'unknown' };

export function resolvePlayer(raw: string): Resolved {
  const q = norm(raw);
  if (q.length < 2) return { status: 'short' };
  if (KEYS[q]) return KEYS[q].length === 1 ? { status: 'ok', name: KEYS[q][0] } : { status: 'ambiguous', options: KEYS[q] };
  const ks = Object.keys(KEYS);
  const st = ks.filter(k => k.startsWith(q) && q.length >= 4);
  if (st.length) {
    const names = Array.from(new Set(st.flatMap(k => KEYS[k])));
    return names.length === 1 ? { status: 'ok', name: names[0] } : { status: 'ambiguous', options: names };
  }
  let best: string | null = null, bd = 9;
  for (const k of ks) { const tol = k.length <= 6 ? 1 : 2, d = lev(q, k); if (d <= tol && d < bd) { bd = d; best = k; } }
  if (best) { const names = KEYS[best]; return names.length === 1 ? { status: 'ok', name: names[0] } : { status: 'ambiguous', options: names }; }
  return { status: 'unknown' };
}

export function resolveTeam(raw: string, q: Question): Resolved {
  const n = norm(raw);
  if (n.length < 3) return { status: 'short' };
  const hit = q.answers.find(a => norm(a.name) === n)
    || (n.length >= 4 ? q.answers.find(a => norm(a.name).startsWith(n)) : undefined)
    || q.answers.find(a => lev(n, norm(a.name)) <= 2);
  return hit ? { status: 'ok', name: hit.name } : { status: 'unknown' };
}
