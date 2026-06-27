# StudyHub setup summary

This folder is the secure monetisation version of StudyHub.

Use `PRODUCTION_SETUP.md` for the full setup steps.

The short version:

1. Push this folder to GitHub.
2. Create a Supabase project and run `SUPABASE_SCHEMA.sql`.
3. Put Supabase public URL/anon key into `config.js`.
4. Deploy from GitHub to Netlify.
5. Add OpenAI, Supabase service-role and Stripe secrets in Netlify environment variables.
6. Create Stripe Pro/Ultimate subscription prices.
7. Add the Stripe webhook endpoint:
   `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
8. Redeploy.

Never put secret keys in frontend files.
