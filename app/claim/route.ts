import { admin, userFrom, json } from '../../lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return json({ error: 'Not signed in.' }, 401);
  const { id } = await req.json().catch(() => ({} as any));
  if (!id) return json({ error: 'No score given.' }, 400);

  const db = admin();
  const { data: row } = await db.from('pending_scores')
    .select('*').eq('id', id).is('claimed_by', null).maybeSingle();
  if (!row) return json({ error: 'That score has gone already.' }, 404);

  const { error } = await db.from('scores').insert({
    player_id: user.id, matchday: row.matchday, total: row.total, keepers: row.keepers, grid: '',
  });
  if (error && (error as any).code !== '23505') return json({ error: 'Could not claim that.' }, 500);
  await db.from('pending_scores')
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq('id', id);
  return json({ ok: true });
}
