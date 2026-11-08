import { admin, adminUser, json, clean } from '../../../lib/server';

export const dynamic = 'force-dynamic';

/** Adds a score by hand: onto an account, or to the unassigned pile if the
 *  player has not signed up yet. */
export async function POST(req: Request) {
  const me = await adminUser(req);
  if (!me) return json({ error: 'Not allowed.' }, 403);
  const { playerId, username, matchday, total, keepers } = await req.json().catch(() => ({} as any));
  const md = Number(matchday), tot = Number(total), kg = Number(keepers) || 0;
  if (!(md > 0)) return json({ error: 'Which matchday?' }, 400);
  if (!(tot >= 0 && tot <= 700)) return json({ error: 'A score is 0 to 700.' }, 400);

  const db = admin();
  if (playerId) {
    const { error } = await db.from('scores')
      .insert({ player_id: playerId, matchday: md, total: tot, keepers: kg, grid: '' });
    if (error) {
      if ((error as any).code === '23505') return json({ error: 'They already have a score for matchday ' + md + '.' }, 409);
      return json({ error: 'Could not add that.' }, 500);
    }
    return json({ ok: true, where: 'account' });
  }
  const name = clean(username || '');
  if (name.length < 2) return json({ error: 'Pick a player, or type a name.' }, 400);
  const { error } = await db.from('pending_scores')
    .upsert({ username: name, matchday: md, total: tot, keepers: kg }, { onConflict: 'username,matchday' });
  if (error) return json({ error: 'Could not add that.' }, 500);
  return json({ ok: true, where: 'unassigned' });
}
