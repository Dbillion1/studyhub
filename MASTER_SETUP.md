# StudyHub - Master setup guide

This is the single, complete guide to taking StudyHub from the source code to a live,
fully working site. Do the steps in order. Where a value comes from your own account,
it is marked **(your value)**. Anything marked **(public, safe to commit)** can live in
the code; everything else is a secret and must only go in Netlify environment variables.

If you only want the app to run as an offline, single-device demo, you can open
`index.html` as a static site and skip Supabase, Stripe and the AI backend. The steps
below are for the full online product.

---

## 1. How StudyHub is put together

- Front end: plain HTML, CSS and JavaScript (no build step). The browser loads
  `index.html` and the scripts listed at the bottom of it.
- Serverless functions: in `netlify/functions`. They hold all the secrets (AI keys,
  Stripe keys, the Supabase service role key) so the browser never sees them.
- Database and auth: Supabase (Postgres with row-level security, plus Supabase Auth and
  Storage).
- Payments: Stripe (Checkout, the customer portal, and a webhook).
- AI tutor and marking: OpenAI, with an optional Gemini fallback for free users.

`netlify.toml` already sets the deploy config:

```toml
[build]
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
```

There is no build command. Netlify serves the folder as-is and bundles the functions.

---

## 2. Accounts you need

- GitHub (to hold the code and trigger deploys)
- Netlify (hosting and serverless functions)
- Supabase (database, auth, storage)
- Stripe (payments) - only if you want paid plans
- OpenAI (the AI tutor and marking) - optional but recommended
- Google AI Studio for a Gemini key (optional, gives free users a fallback)

---

## 3. GitHub

1. Create a new repository.
2. Push the project so that `index.html` and `netlify.toml` are at the repository root.
3. You will connect this repo to Netlify in step 7.

---

## 4. Supabase (database, security, storage)

1. Create a new Supabase project. Choose a strong database password and a region close
   to your users.
2. Open the SQL Editor and run the two SQL files from this project, in this order:
   1. `SUPABASE_PHASE3.sql` - creates all tables, row-level security, helper functions
      and the signup trigger.
   2. `SUPABASE_PHASE10.sql` - adds the reports table, the moderation log and staff
      delete policies.
   Both are safe to run more than once.
3. Create the file-upload storage bucket (used by Pro note uploads):
   - In Storage, create a bucket named exactly `notes`. Keep it private.
   - In the SQL Editor, run the storage policies so each student can only touch their
     own files:

   ```sql
   insert into storage.buckets (id, name, public)
   values ('notes', 'notes', false)
   on conflict (id) do nothing;

   create policy "notes_insert_own" on storage.objects
     for insert to authenticated
     with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

   create policy "notes_select_own" on storage.objects
     for select to authenticated
     using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

   create policy "notes_delete_own" on storage.objects
     for delete to authenticated
     using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
   ```

4. Make yourself the owner (gives you the admin console). Sign up in the app first so
   your account exists, then run, with your email:

   ```sql
   update public.user_roles
   set role = 'owner'
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```

   To make someone a moderator later, use the same query with `role = 'moderator'`.
5. Collect three values from Project Settings -> API:
   - Project URL **(your value, public, safe to commit)**
   - anon public key **(your value, public, safe to commit)**
   - service_role key **(your value, secret - Netlify only, never commit)**

---

## 5. config.js (public front-end values)

Open `config.js` and paste your two public Supabase values:

```js
supabaseUrl: 'https://YOUR-PROJECT.supabase.co',      // (your value)
supabaseAnonKey: 'YOUR-ANON-PUBLIC-KEY',              // (your value)
```

Leave `aiEndpoint` as the default and keep `enablePlanPreview: false`. Commit and push.
These two values are designed to be public; the anon key is safe in the browser because
the database is protected by row-level security.

---

## 6. Stripe (only if you want paid plans)

1. In the Stripe Dashboard, create one product with two recurring prices: one for Pro
   and one for Ultimate. Copy each price id (looks like `price_...`). **(your values)**
2. Create a webhook endpoint pointing at your site:
   `https://YOUR-SITE/.netlify/functions/stripe-webhook`. Subscribe to the checkout and
   subscription events. Copy the signing secret (`whsec_...`). **(your value, secret)**
3. Turn on the customer portal in Stripe billing settings (lets users manage or cancel).
4. Use test keys while setting up, then swap to live keys when you go live. The price ids
   differ between test and live mode, so update them when you switch.

---

## 7. Netlify (hosting, functions, environment variables)

1. Connect your GitHub repo. Netlify reads `netlify.toml`, so leave the build command
   empty; publish directory is `.` and functions are in `netlify/functions`.
2. Add the environment variables below (Site settings -> Environment variables), then
   trigger a deploy.
3. After the first deploy you know your site URL. Set `SITE_URL` to it and redeploy so
   Stripe redirects and links are correct.

### Environment variables

| Variable | Required | Where it comes from | Notes |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | for AI | OpenAI dashboard **(your value)** | Powers tutor and marking |
| `OPENAI_MODEL` | optional | you choose | Defaults to `gpt-4o-mini` |
| `SUPABASE_URL` | yes | Supabase API settings **(your value)** | Same URL as in config.js |
| `SUPABASE_ANON_KEY` | yes | Supabase API settings **(your value)** | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase API settings **(your value, secret)** | Server only, never commit |
| `STRIPE_SECRET_KEY` | for payments | Stripe **(your value, secret)** | Test or live |
| `STRIPE_PRO_PRICE_ID` | for payments | Stripe **(your value)** | Pro price id |
| `STRIPE_ULTIMATE_PRICE_ID` | for payments | Stripe **(your value)** | Ultimate price id |
| `STRIPE_WEBHOOK_SECRET` | for payments | Stripe webhook **(your value, secret)** | `whsec_...` |
| `SITE_URL` | yes | your Netlify URL | Used for redirects and links |
| `GEMINI_API_KEY` | optional | Google AI Studio **(your value)** | Free-user fallback |
| `GEMINI_MODEL` | optional | you choose | Defaults to `gemini-1.5-flash` |
| `AI_FREE_GPT_DAILY` | optional | you choose | Free daily GPT messages |
| `AI_FREE_GEMINI_DAILY` | optional | you choose | Free daily Gemini fallback messages |
| `AI_PRO_DAILY` | optional | you choose | Pro daily messages |
| `AI_ULTIMATE_DAILY` | optional | you choose | Ultimate daily messages |

The four `AI_..._DAILY` values let you tune the daily AI limits without touching code.
Raising them increases your OpenAI bill, which is why the limits exist.

---

## 8. End-to-end test checklist

Work through this on the live site once deployed.

- Sign up, then sign in. Complete onboarding (year, subjects, target grade).
- Create a flashcard and a note; confirm they persist after a refresh.
- Run a flashcard review and confirm cards become due again on schedule.
- Take a quiz and a diagnostic; confirm results show and the diagnostic can set a focus.
- Ask the AI tutor a question; confirm a reply. Keep asking to confirm the daily limit
  message appears for a free user and suggests flashcards.
- Use "Mark my answer" and confirm GCSE-style feedback.
- Make a community post; try posting an email address or an abusive word and confirm it
  is blocked. Report another account's post.
- As your owner account, open Settings -> Owner admin, confirm the console loads, change
  a test user's role, resolve a report, and delete a test post.
- Upgrade with a Stripe test card (`4242 4242 4242 4242`), confirm the plan updates, then
  open the billing portal.
- On Ultimate, share a family code from one account and follow it from another; approve
  and confirm the parent sees the weekly report; then revoke.
- In Settings -> Your data, download the JSON and the flashcards CSV.

---

## 9. Troubleshooting

- AI says the backend is not configured: `OPENAI_API_KEY` is missing on Netlify, or the
  site has not been redeployed since you added it.
- Login works but nothing saves to the server: check `SUPABASE_URL` and
  `SUPABASE_ANON_KEY` match in both `config.js` and Netlify, and that you ran both SQL
  files.
- Payments do nothing or plans do not update: check the Stripe webhook URL, that
  `STRIPE_WEBHOOK_SECRET` matches the endpoint, and that the price ids are for the same
  mode (test vs live) as your secret key.
- Note uploads fail: the `notes` storage bucket or its policies are missing (step 4.3).
- Admin console is empty or refuses actions: make sure your account's role is `owner`
  (step 4.4) and that you have redeployed.
- Family features missing: they need the online backend and an Ultimate plan to follow a
  child; any plan can share a code and approve.

---

## 10. Good to know

- The browser only ever holds public values (the Supabase URL and anon key). Every secret
  lives in Netlify environment variables and is used only by the serverless functions.
- Security is enforced by Supabase row-level security, not by the interface. Hiding a
  button never grants access; the database policies are the real gate.
- The app works offline on one device using local storage. Online features (sync,
  community, payments, AI, family) switch on automatically once Supabase is configured.
- Phase notes `PHASE3` through `PHASE14` in this folder explain each area in more depth if
  you need it.
