# Hame & Away

The daily quiz for the Hame Bakery Premiership, built from the All Stats workbook
(Seasons 1 to 3). Seven questions a day, 25 seconds each, 700 yards on offer.
The rarer your answer, the further out you score. Each question hides one
keeper's goal: the rarest valid answer, worth the full 100.

Already live on Supabase at `/functions/v1/play`. This repo is the same game
served from Vercel instead, against the same database.

## Putting it on Vercel

1. **vercel.com/new → Import** this repo. Framework detects as Next.js; leave the
   build settings alone.

2. **Add three environment variables** before deploying:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://feclvuthtoigugbeivvl.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_U8vPjCyO2A2ckiVXAC4ufg_-KylLX9E` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` |

   The service role key is secret and stays on the server. Without it, sign-ups
   and saved scores will fail.

3. **Deploy.** Nothing to configure in Supabase: sign-ups are created already
   confirmed, so the "Confirm email" setting does not matter.

If the project already exists and shows "No Production Deployment", the repo is
not connected to it: **Settings → Git → Connect** `tattiejoejangles/hame-and-away`,
then **Deployments → Redeploy**.

## How it hangs together

- `public/play.html` — the whole game in one file: sign-up, the round, the
  reveal, the table, the sounds and the share card. The Supabase function serves
  this same file, so there is only one copy of the game to keep right.
- `app/route.ts` — serves that page, filling in the two public Supabase values.
- `app/signup` — makes the account, already confirmed, so no email is needed.
- `app/submit` — recalculates the score from the answers before saving, so a
  made-up 700 posted straight at the API gets thrown out.
- `app/claim` — moves a score played before sign-ups existed onto an account.
- `app/me` — who you are, whether today is done, the tables, unclaimed scores.
- `lib/server.ts` — the shared server half: database client, question pick, scoring.
- `public/questions.json` — 74 questions built from the workbook.

Database tables live in Supabase: `players`, `scores` (one row per player per
matchday, enforced by a unique constraint) and `pending_scores`. Row level
security lets signed-in players read everything and write nothing; scores are
only ever written by the server.

## Matchdays

Matchday 1 is Saturday 7 November 2026. A week is seven matchdays, so week 1
runs to Friday 13 November.
