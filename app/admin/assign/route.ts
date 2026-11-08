import { admin, adminUser, json } from '../../../lib/server';

export const dynamic = 'force-dynamic';

/** Moves one unclaimed score onto a chosen account. */
export async function POST(req: Request) {
  const me = await adminUser(req);
  if (!me) return json({ error: 'Not allowed.' }, 403);
  const { pendingId, playerId } = await req.json().catch(() => ({} as any));
  if (!pendingId || !playerId) return json({ error: 'Pick a score and a player.' }, 400);

  const db = admin();
  const { data: row } = await db.from('pending_scores')
    .select('*').eq('id', pendingId).is('claimed_by', null).maybeSingle();
  if (!row) return json({ error: 'That score is already assigned.' }, 404);

  const { error } = await db.from('scores').insert({
    player_id: playerId, matchday: row.matchday,
    total: row.total, keepers: row.keepers, grid: '',
  });
  if (error) {
    if ((error as any).code === '23505') {
      return json({ error: 'That player already has a score for matchday ' + row.matchday + '.' }, 409);
    }
    return json({ error: 'Could not assign that.' }, 500);
  }
  await db.from('pending_scores')
    .update({ claimed_by: playerId, claimed_at: new Date().toISOString() })
    .eq('id', pendingId);
  return json({ ok: true });
}
