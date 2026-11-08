import { admin, userFrom, json, matchdayNo, scoreRound } from '../../lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return json({ error: 'Not signed in.' }, 401);
  const body = await req.json().catch(() => ({} as any));
  const given = Array.isArray(body.answers) ? body.answers : [];
  if (given.length !== 7) return json({ error: 'That round looks wrong.' }, 400);

  // worked out here from the answers, so a made-up total gets thrown away
  const md = matchdayNo();
  const { total, keepers, grid, shots } = scoreRound(md, given);
  const { error } = await admin().from('scores')
    .insert({ player_id: user.id, matchday: md, total, keepers, grid, shots });
  if (error) {
    if ((error as any).code === '23505') return json({ error: 'You have already played today.' }, 409);
    return json({ error: 'Could not save that round.' }, 500);
  }
  return json({ ok: true, total, keepers, grid });
}
