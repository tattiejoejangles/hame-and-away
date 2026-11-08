import { admin, userFrom, json, matchdayNo, weekOf } from '../../lib/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await userFrom(req);
  if (!user) return json({ error: 'Not signed in.' }, 401);
  const db = admin(), md = matchdayNo(), wk = weekOf(md);

  const [me, today, week, dayRows, pending] = await Promise.all([
    db.from('players').select('username').eq('id', user.id).maybeSingle(),
    db.from('scores').select('total,keepers,grid').eq('player_id', user.id).eq('matchday', md).maybeSingle(),
    db.from('weekly_table').select('*').eq('week', wk).order('total', { ascending: false }),
    db.from('daily_table').select('username,total,keepers').eq('matchday', md).order('total', { ascending: false }),
    db.from('pending_scores').select('id,username,matchday,total').is('claimed_by', null).order('total', { ascending: false }),
  ]);
  return json({
    username: me.data?.username ?? null,
    matchday: md,
    playedToday: today.data ?? null,
    week: week.data ?? [],
    today: dayRows.data ?? [],
    pending: pending.data ?? [],
  });
}
