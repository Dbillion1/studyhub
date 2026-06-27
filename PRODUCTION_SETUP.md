# StudyHub secure monetisation setup

This version uses:

- Supabase Auth for real login
- Supabase Postgres for secure user/plan records
- Stripe Checkout for Pro/Ultimate subscriptions
- Stripe webhooks to update user plans automatically
- Netlify Functions so secret keys never appear in browser files

## 1. Supabase setup

1. Create a Supabase project.
2. Go to **SQL Editor**.
3. Paste and run everything in `SUPABASE_SCHEMA.sql`.
4. Go to **Project Settings → API**.
5. Copy:
   - Project URL
   - anon public key
   - service_role key

In `config.js`, paste only the public values:

```js
supabaseUrl: 'https://your-project.supabase.co',
supabaseAnonKey: 'your-anon-public-key',
```

Never put the service-role key in `config.js`.

## 2. Stripe setup

1. Create a Stripe account.
2. Create two subscription products:
   - StudyHub Pro
   - StudyHub Ultimate
3. Copy the monthly recurring Price IDs. They usually start with `price_`.
4. In Stripe, enable Customer Portal if you want users to manage/cancel billing.

## 3. Netlify environment variables

Go to:

**Netlify → Your site → Site configuration → Environment variables**

Add:

```text
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

STRIPE_SECRET_KEY=sk_test_or_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ULTIMATE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

SITE_URL=https://your-site-name.netlify.app
```

Then redeploy the site.

## 4. Stripe webhook

After deploying to Netlify, your webhook endpoint will be:

```text
https://your-site-name.netlify.app/.netlify/functions/stripe-webhook
```

In Stripe:

1. Go to **Developers → Webhooks**.
2. Add endpoint using the URL above.
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret that starts with `whsec_`.
5. Put it in Netlify as `STRIPE_WEBHOOK_SECRET`.
6. Redeploy again.

## 5. Test flow

1. Create a new StudyHub account.
2. Sign in.
3. Click Upgrade to Pro.
4. Use Stripe test card `4242 4242 4242 4242` with any future expiry and any CVC.
5. After payment, Stripe sends a webhook to Netlify.
6. Netlify updates the user's Supabase profile.
7. StudyHub refreshes the plan and shows Pro/Ultimate.

## 6. What is now secure

- Login is handled by Supabase Auth.
- Checkout requires a valid Supabase login token.
- Paid plan updates happen through Stripe webhooks.
- Plan status is read from Supabase, not trusted from localStorage.
- OpenAI, Stripe secret key, Stripe webhook secret, and Supabase service-role key are server-side only.

## 7. Remaining production improvements

This version secures login and subscription access. For a more complete SaaS product, the next improvements are:

- Store flashcards, notes, planner items and community posts in Supabase instead of localStorage.
- Add admin moderation for community posts.
- Add proper email templates and password reset screens.
- Add AI usage limits and monthly usage tracking by plan.
- Add Terms, Privacy Policy, refund policy, and age/parental consent wording.
