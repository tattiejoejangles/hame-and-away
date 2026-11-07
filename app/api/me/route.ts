import { NextResponse } from 'next/server';
import { admin, userFromRequest } from '../../../lib/admin';
import { matchdayNo } from '../../../lib/scoring';

export const dynamic = 'force-dynamic';

/** Everything the page needs on load: who you are, whether today's round is done,
 *  the week's table, and any unclaimed scores. */
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const db = admin();
  const md = matchdayNo();

  const [{ data: me }, { data: today }, { data: week }, { data: pending }] = await Promise.all([
    db.from('players').select('username').eq('id', user.id).maybeSingle(),
    db.from('scores').select('total,keepers,grid').eq('player_id', user.id).eq('matchday', md).maybeSingle(),
    db.from('weekly_table').select('*').eq('week', Math.floor((md - 1) / 7) + 1).order('total', { ascending: false }),
    db.from('pending_scores').select('id,username,matchday,total').is('claimed_by', null).order('total', { ascending: false }),
  ]);

  return NextResponse.json({
    username: me?.username ?? null,
    matchday: md,
    playedToday: today ?? null,
    week: week ?? [],
    pending: pending ?? [],
  });
}
