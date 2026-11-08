import { admin, adminUser, json, matchdayNo, weekOf } from '../../../lib/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await adminUser(req);
  if (!me) return json({ error: 'Not allowed.' }, 403);
  const db = admin(), md = matchdayNo();

  const [players, pending, scores] = await Promise.all([
    db.from('players').select('id,username,is_admin').order('username'),
    db.from('pending_scores').select('id,username,matchday,total,keepers')
      .is('claimed_by', null).order('matchday').order('total', { ascending: false }),
    db.from('scores').select('id,player_id,matchday,total,keepers')
      .order('matchday', { ascending: false }).order('total', { ascending: false }),
  ]);

  return json({
    you: me.username, matchday: md, week: weekOf(md),
    players: players.data ?? [], pending: pending.data ?? [], scores: scores.data ?? [],
  });
}
