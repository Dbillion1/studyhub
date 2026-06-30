# StudyHub - Phase 5 AI usage limits and Gemini fallback

This phase protects your AI costs. The AI tutor now enforces per-day message
limits on the server, with an optional cheaper backup model (Google Gemini) for
free users, and shows users how many messages they have left.

## How the limits work

Counts reset every day at midnight UTC and are stored per user in the `ai_usage`
table (created in Phase 3, so make sure you have run `SUPABASE_PHASE3.sql`).

- Free plan: a number of primary messages on GPT (default 10), then a number of
  backup messages on Gemini (default 15) if you have configured a Gemini key.
  After both are used up, the tutor asks the user to upgrade or wait for reset.
- Pro plan: a high daily GPT allowance (default 150) for cost safety.
- Ultimate plan: a higher daily GPT allowance (default 400).

Only successful answers count against the limit. If a request fails, it is not
charged to the user's daily total. Limits are enforced on the server, so they
cannot be bypassed from the browser.

## What the user sees

- A line in the AI Tutor sidebar showing how many messages are left today, and a
  note when the backup model is being used.
- When a free user runs out, the tutor shows a friendly message with an Upgrade to
  Pro button and tells them roughly when their limit resets.

## The Gemini fallback (optional but recommended for free users)

If you set a Gemini key, free users who pass the GPT limit keep working on the
cheaper Gemini model instead of being cut off immediately. If you do not set a
Gemini key, free users simply stop at the GPT limit until reset. Paid plans use
GPT only.

To enable it:

1. Get a Google AI Studio API key from https://aistudio.google.com (Get API key).
2. Add it to Netlify as `GEMINI_API_KEY`.

## Environment variables (Netlify, server-side only)

All are optional. Defaults are sensible, so you can set none of these and the free
tier still gets 10 GPT messages a day with no backup.

- `GEMINI_API_KEY`: enables the backup model for free users. Leave unset to disable.
- `GEMINI_MODEL`: defaults to `gemini-1.5-flash`. Set this if you want a different
  Gemini model. Model names change over time, so if Google retires this name, set
  the current flash model here without any code change.
- `AI_FREE_GPT_DAILY`: free primary messages per day (default 10).
- `AI_FREE_GEMINI_DAILY`: free backup messages per day (default 15).
- `AI_PRO_DAILY`: Pro daily messages (default 150).
- `AI_ULTIMATE_DAILY`: Ultimate daily messages (default 400).

These are in addition to the variables from earlier phases (`OPENAI_API_KEY`,
`OPENAI_MODEL`, the Supabase keys, and the Stripe keys).

## How to test quickly

1. Make sure `SUPABASE_PHASE3.sql` has been run, you are logged in, and Supabase is
   configured in `config.js`.
2. Temporarily set `AI_FREE_GPT_DAILY` to `1` in Netlify and redeploy.
3. Send one tutor message (uses GPT), then send another:
   - With `GEMINI_API_KEY` set, the second message comes from the backup model and
     the sidebar shows "using backup model".
   - Without it, the second message shows the limit message and an Upgrade button.
4. Set `AI_FREE_GPT_DAILY` back to `10` (or remove it) when done.

## Notes

- If reading the usage record ever fails (for example a brief Supabase hiccup), the
  tutor still answers rather than locking the user out, since logging in already
  proved the database is reachable. Usage logging failures never block a reply.
- The daily counters are per user per UTC day. A small burst of simultaneous
  requests could in theory slip past the exact count by a message or two; this is
  fine for cost protection and not worth heavier machinery for a study app.
