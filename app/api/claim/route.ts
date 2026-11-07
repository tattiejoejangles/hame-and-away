import { NextResponse } from 'next/server';
import { admin, userFromRequest } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/** Moves a score played before sign-ups existed onto the account that claims it. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: 'No score given.' }, { status: 400 });

  const db = admin();
  const { data: row } = await db.from('pending_scores')
    .select('*').eq('id', id).is('claimed_by', null).maybeSingle();
  if (!row) return NextResponse.json({ error: 'That score has gone already.' }, { status: 404 });

  const { error } = await db.from('scores').insert({
    player_id: user.id, matchday: row.matchday,
    total: row.total, keepers: row.keepers, grid: '',
  });
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not claim that.' }, { status: 500 });
  }
  await db.from('pending_scores')
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
