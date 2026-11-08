import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/** Serves the game page. It is the same file the Supabase function serves, so
 *  there is only ever one copy of the game to keep right. */
export async function GET() {
  const file = path.join(process.cwd(), 'public', 'play.html');
  const html = (await readFile(file, 'utf8'))
    .replace('__SB_URL__', process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .replace('__SB_KEY__', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
