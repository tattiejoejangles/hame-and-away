import { createBrowserClient } from '@supabase/ssr';

export const supabase = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

/** Sign-ups are username only. Supabase wants an email, so we make one up that
 *  nobody ever sees or has to confirm. */
export const emailFor = (username: string) =>
  `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@hameandaway.invalid`;
