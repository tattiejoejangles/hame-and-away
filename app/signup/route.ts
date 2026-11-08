import { admin, json, clean } from '../../lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({} as any));
  const name = clean(username || '');
  if (name.length < 2) return json({ error: 'Give us a name.' }, 400);
  if (!password || password.length < 6) return json({ error: 'Password needs six characters or more.' }, 400);

  const db = admin();
  const { data: taken } = await db.from('players').select('id').ilike('username', name).maybeSingle();
  if (taken) return json({ error: 'That name is taken. Try signing in instead.' }, 409);

  const email = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '@hameandaway.invalid';
  // created already confirmed, so nobody waits on an email that cannot arrive
  const { data: made, error: ce } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username: name },
  });
  if (ce || !made?.user) {
    const msg = (ce?.message || '').toLowerCase();
    return json({ error: msg.includes('already') ? 'That name is taken. Try signing in instead.' : 'Could not sign you up.' }, 400);
  }
  const { error: pe } = await db.from('players').insert({ id: made.user.id, username: name });
  if (pe) { await db.auth.admin.deleteUser(made.user.id); return json({ error: 'That name is taken.' }, 409); }

  // Rounds played before accounts existed come across on their own, but only to
  // the name they were posted under. Nobody gets to pick someone else's score.
  const key = (n: string) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const { data: waiting } = await db.from('pending_scores')
    .select('id,username,matchday,total,keepers').is('claimed_by', null);
  const mine = (waiting || []).filter(r => key(r.username) === key(name));
  let claimed = 0;
  for (const row of mine) {
    const { error: se } = await db.from('scores').insert({
      player_id: made.user.id, matchday: row.matchday,
      total: row.total, keepers: row.keepers, grid: '',
    });
    if (!se || (se as any).code === '23505') {
      await db.from('pending_scores')
        .update({ claimed_by: made.user.id, claimed_at: new Date().toISOString() })
        .eq('id', row.id);
      claimed++;
    }
  }
  return json({ ok: true, claimed });
}
