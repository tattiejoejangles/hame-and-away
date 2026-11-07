import { NextResponse } from 'next/server';
import { admin, userFromRequest } from '../../../lib/admin';
import { matchdayNo, scoreRound } from '../../../lib/scoring';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const given: (string | null)[] = Array.isArray(body?.answers) ? body.answers : [];
  if (given.length !== 7) return NextResponse.json({ error: 'That round looks wrong.' }, { status: 400 });

  // The score is worked out here, from the answers. Whatever the browser claims is ignored.
  const md = matchdayNo();
  const { total, keepers, grid, shots } = scoreRound(md, given);

  const db = admin();
  const { error } = await db.from('scores').insert({
    player_id: user.id, matchday: md, total, keepers, grid, shots,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already played today.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not save that round.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, total, keepers, grid, matchday: md });
}
