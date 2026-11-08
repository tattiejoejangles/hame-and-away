import { json } from '../../lib/server';

export const dynamic = 'force-dynamic';

/** Says which settings arrived, without ever printing their values.
 *  Open /health in a browser to see what the deployment is missing. */
export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  let database = 'not tried';
  if (url && svc) {
    try {
      const { admin } = await import('../../lib/server');
      const { error } = await admin().from('players').select('id').limit(1);
      database = error ? 'FAILED: ' + error.message : 'reachable';
    } catch (e) { database = 'FAILED: ' + (e as Error).message; }
  }

  const missing = [
    !url  && 'NEXT_PUBLIC_SUPABASE_URL',
    !anon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !svc  && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  return json({
    ok: missing.length === 0 && database === 'reachable',
    supabase_url: url ? 'set (' + url + ')' : 'MISSING',
    anon_key: anon ? 'set, ' + anon.length + ' characters' : 'MISSING',
    service_role_key: svc ? 'set, ' + svc.length + ' characters' : 'MISSING',
    database,
    missing,
    advice: missing.length
      ? 'Add the missing ones in Vercel under Settings, Environment Variables, then redeploy.'
      : database === 'reachable'
        ? 'All good. The game should work.'
        : 'Settings are present but the database refused them. The service_role key is probably wrong.',
  });
}
