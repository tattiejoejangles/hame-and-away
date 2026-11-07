# Hame & Away

The daily quiz for the Hame Bakery Premiership, built from the All Stats workbook
(Seasons 1 to 3). Seven questions a day, 25 seconds each, 700 yards on offer.
The rarer your answer, the further out you score. Each question hides one
keeper's goal: the rarest valid answer, worth the full 100.

## Getting it live

1. **Push this folder to a new GitHub repo.**

   ```bash
   git init && git add -A && git commit -m "Hame & Away"
   git branch -M main
   git remote add origin https://github.com/<you>/hame-and-away.git
   git push -u origin main
   ```

2. **Import the repo at vercel.com/new.** Framework is detected as Next.js; leave
   the build settings alone.

3. **Add three environment variables** in Vercel (Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://feclvuthtoigugbeivvl.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_U8vPjCyO2A2ckiVXAC4ufg_-KylLX9E` |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Project Settings → API keys → `service_role` |

   The service role key is a secret. It stays on the server and never reaches a browser.

4. **Turn off email confirmation** in Supabase → Authentication → Sign In / Up →
   Email → switch **Confirm email** off. Sign-ups are a name and a password only;
   the app makes up an address nobody sees, so confirmation would block everyone.

5. Deploy, open the URL, send it to the group.

## How it hangs together

- `app/page.tsx` — the whole game: sign-up, the round, the reveal, the table.
- `lib/scoring.ts` — picks the day's seven questions and turns answers into yards.
  Runs in the browser *and* on the server.
- `app/api/submit` — recalculates the score from the answers before saving, so a
  made-up 700 posted straight at the API gets thrown out.
- `app/api/claim` — moves a score played before sign-ups existed onto an account.
- `lib/fx.ts` — sounds, the shot animation, the pitch map, the share card.
- `public/questions.json` — 74 questions built from the workbook.

Database tables live in Supabase: `players`, `scores` (one row per player per
matchday, enforced by a unique constraint) and `pending_scores`. Row level
security lets signed-in players read everything and write nothing; scores are
only ever written by the server.

## Matchdays

Matchday 1 is Saturday 7 November 2026. A week is seven matchdays, so week 1
runs to Friday 13 November.
