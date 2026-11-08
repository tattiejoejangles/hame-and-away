import { json } from '../../lib/server';

export const dynamic = 'force-dynamic';

/** Says which settings arrived, without ever printing their values.
 *  Open /health in a browser to see what the deployment is missing. */
export async function GET() {
  const raw = (k: string) => process.env[k] || '';
  const url  = raw('NEXT_PUBLIC_SUPABASE_URL').trim();
  const anon = raw('NEXT_PUBLIC_SUPABASE_ANON_KEY').trim();
  const svc  = raw('SUPABASE_SERVICE_ROLE_KEY').trim();
  const untrimmed = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']
    .filter(k => raw(k) !== raw(k).trim());

  // Reading a table proves nothing: row level security lets the wrong key read
  // nothing without complaining. Only the service role can list accounts.
  let database = 'not tried', service_role_works = 'not tried';
  if (url && svc) {
    try {
      const { admin } = await import('../../lib/server');
      const db = admin();
      const { error } = await db.from('players').select('id').limit(1);
      database = error ? 'FAILED: ' + error.message : 'reachable';
      const { error: ae } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
      service_role_works = ae ? 'NO: ' + ae.message + ' (wrong key?)' : 'yes';
    } catch (e) { database = 'FAILED: ' + (e as Error).message; }
  }

  const missing = [
    !url  && 'NEXT_PUBLIC_SUPABASE_URL',
    !anon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !svc  && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  return json({
    ok: missing.length === 0 && database === 'reachable' && service_role_works === 'yes',
    supabase_url: url ? 'set (' + url + ')' : 'MISSING',
    anon_key: anon ? 'set, ' + anon.length + ' characters' : 'MISSING',
    service_role_key: svc ? 'set, ' + svc.length + ' characters' : 'MISSING',
    database,
    service_role_works,
    values_had_stray_whitespace: untrimmed.length ? untrimmed : 'no',
    missing,
    advice: missing.length
      ? 'Add the missing ones in Vercel under Settings, Environment Variables, then redeploy.'
      : service_role_works !== 'yes'
        ? 'The service_role key is not the service_role key. Copy the secret one, not the publishable one.'
        : 'All good. The game should work.',
  });
}
