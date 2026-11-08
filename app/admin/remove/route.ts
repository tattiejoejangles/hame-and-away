import { admin, adminUser, json } from '../../../lib/server';

export const dynamic = 'force-dynamic';

/** Takes a score back off an account and returns it to the unassigned pile. */
export async function POST(req: Request) {
  const me = await adminUser(req);
  if (!me) return json({ error: 'Not allowed.' }, 403);
  const { scoreId } = await req.json().catch(() => ({} as any));
  if (!scoreId) return json({ error: 'Which score?' }, 400);

  const db = admin();
  const { data: row } = await db.from('scores')
    .select('id,player_id,matchday,total,keepers').eq('id', scoreId).maybeSingle();
  if (!row) return json({ error: 'That score has gone.' }, 404);

  const { data: p } = await db.from('players').select('username').eq('id', row.player_id).maybeSingle();
  await db.from('scores').delete().eq('id', scoreId);
  await db.from('pending_scores').upsert({
    username: p?.username || 'unknown', matchday: row.matchday,
    total: row.total, keepers: row.keepers, claimed_by: null, claimed_at: null,
  }, { onConflict: 'username,matchday' });
  return json({ ok: true });
}
