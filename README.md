# StudyHub

> For full deployment instructions (GitHub, Supabase, Stripe, Netlify, AI keys), see **MASTER_SETUP.md**.
StudyHub is an AI-powered study web app for secondary school students. It includes an AI tutor, revision hub, quizzes, flashcards, study planner, community area, achievements, Free / Pro / Ultimate plan status, affiliate-ready resource links, and secure subscription infrastructure.

This production-ready monetisation version uses:

- **Supabase Auth** for real user login
- **Supabase Postgres** for backend user and subscription records
- **Stripe Checkout** for paid Pro / Ultimate subscriptions
- **Stripe Webhooks** to update plan status automatically
- **Netlify Functions** to protect OpenAI, Stripe and Supabase service-role secrets

## Features

- AI Tutor through a secure authenticated Netlify Function
- Real login/signup powered by Supabase Auth
- Free / Pro / Ultimate subscription status
- Stripe Checkout subscription flow
- Stripe billing portal starter
- Stripe webhook endpoint for automated plan updates
- Revision hub with subject browser, notes, flashcards and quizzes
- Study planner with sessions and goals
- Community feed with posts, comments and likes
- Achievement system based on real app usage
- Prompt Lab and AI tools directory
- Affiliate-link support through `config.js`
- Dark/light theme

## Project structure

```text
.
├── index.html
├── styles.css
├── config.js
├── backend.js
├── store.js
├── data.js
├── engine.js
├── plans.js
├── ui.js
├── auth.js
├── dashboard.js
├── tutor.js
├── revision.js
├── community.js
├── planner.js
├── prompts.js
├── gamification.js
├── favicon.svg
├── SUPABASE_SCHEMA.sql
├── PRODUCTION_SETUP.md
├── netlify.toml
└── netlify/
    └── functions/
        ├── _supabase.js
        ├── ai-tutor.js
        ├── create-checkout-session.js
        ├── create-billing-portal-session.js
        ├── get-account.js
        ├── sync-profile.js
        └── stripe-webhook.js
```

## Security rule

Do **not** put secret keys in browser files.

Never put these in `index.html`, `config.js`, `tutor.js`, or any frontend file:

- OpenAI API key
- Stripe secret key
- Stripe webhook secret
- Supabase service-role key

Only public Supabase values go in `config.js`:

```js
supabaseUrl: 'https://your-project.supabase.co',
supabaseAnonKey: 'your-anon-public-key',
```

All secret values must be added in Netlify environment variables.

## Required services

You need accounts for:

- GitHub
- Netlify
- Supabase
- Stripe
- OpenAI

## Quick setup

### 1. Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `SUPABASE_SCHEMA.sql`.
4. Copy the project URL and anon key into `config.js`.
5. Copy the service-role key into Netlify environment variables only.

### 2. Stripe

1. Create Pro and Ultimate subscription products.
2. Copy their recurring Price IDs.
3. Add them to Netlify as:
   - `STRIPE_PRO_PRICE_ID`
   - `STRIPE_ULTIMATE_PRICE_ID`
4. Add your Stripe secret key as `STRIPE_SECRET_KEY`.
5. Add the webhook endpoint after Netlify deployment.

### 3. Netlify environment variables

Add these in Netlify:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_ULTIMATE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
SITE_URL=
```

### 4. Deploy

Push the project to GitHub, then import the repository into Netlify.

Recommended Netlify settings:

- Build command: leave blank
- Publish directory: `.`
- Functions directory: `netlify/functions`

### 5. Stripe webhook URL

After Netlify deploys your site, add this webhook endpoint in Stripe:

```text
https://your-site-name.netlify.app/.netlify/functions/stripe-webhook
```

Events to select:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret into Netlify as `STRIPE_WEBHOOK_SECRET`, then redeploy.

## Monetisation status

This version is set up for secure automated subscriptions. Users must be logged in before checkout. Stripe webhooks update the user's Supabase profile after payment, cancellation or subscription changes. The app reads the plan from the backend instead of trusting browser-only plan status.

## Remaining improvements

The subscription system is now backend-based. The main remaining production improvements are:

- Store flashcards, planner items, notes and community posts in Supabase.
- Add admin/moderation tools for community posts.
- Add proper password reset UI.
- Add AI usage tracking per plan.
- Add Terms, Privacy Policy, cookie notice and refund policy.
