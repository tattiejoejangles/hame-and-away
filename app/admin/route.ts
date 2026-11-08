import { ADMIN_B64 } from '../../lib/adminpage';
import { env } from '../../lib/server';

export const dynamic = 'force-dynamic';

/** The admin page. It loads for anyone, but every route behind it checks that
 *  the signed-in account is the one that runs the league. */
export async function GET() {
  const html = Buffer.from(ADMIN_B64, 'base64').toString('utf8')
    .replace('__SB_URL__', env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, ''))
    .replace('__SB_KEY__', env('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
