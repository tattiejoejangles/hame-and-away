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
  const { count } = await db.from('players').select('id', { count: 'exact', head: true });
  const first = (count ?? 0) === 0;   // whoever sets it up runs it
  const { error: pe } = await db.from('players')
    .insert({ id: made.user.id, username: name, is_admin: first });
  if (pe) { await db.auth.admin.deleteUser(made.user.id); return json({ error: 'That name is taken.' }, 409); }

  // Old scores are assigned by hand from the admin page, never picked up
  // automatically: a nickname is not proof of whose round it was.
  return json({ ok: true });
}
