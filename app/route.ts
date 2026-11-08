import { PAGE_B64 } from '../lib/page';

export const dynamic = 'force-dynamic';

/** Serves the game. Same page the Supabase function serves, so there is only
 *  ever one copy of the game to keep right. */
export async function GET() {
  const html = Buffer.from(PAGE_B64, 'base64').toString('utf8')
    .replace('__SB_URL__', process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .replace('__SB_KEY__', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
