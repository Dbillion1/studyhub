# StudyHub - Phase 4 subscriptions and plan status

This explains how plans and billing work in the app, and the exact Stripe setup
needed to make the upgrade and billing buttons work. Plan changes are never made
in the browser. They are decided by Stripe and recorded in Supabase.

## How it works

1. A signed-in user clicks Upgrade to Pro or Upgrade to Ultimate (on the pricing
   section, the dashboard plan card, the community page, or in Settings).
2. The `create-checkout-session` function (server-side, using your Stripe secret
   key) creates a Stripe Checkout session for the right price and redirects the
   user to Stripe.
3. After payment, Stripe sends a webhook to `stripe-webhook`. That function
   verifies Stripe's signature and writes the plan, status and Stripe IDs to the
   user's `profiles` row using the service-role key.
4. The browser reads the plan back through `get-account`. The active plan only
   counts when the Stripe status is active, trialing, or just completed.
5. Manage billing opens the Stripe Customer Portal (`create-billing-portal-session`)
   where the user can change card, cancel, or view invoices.

The user's plan is shown in the nav badge and on a plan card in the dashboard,
the community page, and Settings. Each card has Upgrade, Manage billing (when on a
paid plan), and Refresh plan.

## Where plan status appears

- Nav badge next to the account menu.
- Dashboard, in a Plan and billing card (added in this phase).
- Community page.
- Settings, under Plan status.

## Stripe setup checklist (one time)

In the Stripe Dashboard (use Test mode first):

1. Create two products with recurring monthly prices:
   - Pro (for example 7.99/month)
   - Ultimate (for example 14.99/month)
   Copy each price ID (it looks like `price_...`).
2. Get your secret key from Developers, API keys (it looks like `sk_test_...`).
3. Turn on the Customer Portal under Settings, Billing, Customer portal, and save.
4. Create a webhook endpoint under Developers, Webhooks:
   - URL: `https://YOUR-SITE/.netlify/functions/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret (it looks like `whsec_...`).

## Netlify environment variables

Set these in Netlify, Site settings, Environment variables (server-side only,
never in `config.js`):

- `STRIPE_SECRET_KEY` = your `sk_...` key
- `STRIPE_PRO_PRICE_ID` = the Pro price ID
- `STRIPE_ULTIMATE_PRICE_ID` = the Ultimate price ID
- `STRIPE_WEBHOOK_SECRET` = the `whsec_...` signing secret
- `SITE_URL` = your deployed site URL, for example `https://studyhub.example.com`

These are in addition to the Supabase and OpenAI variables you already set.
`SUPABASE_SERVICE_ROLE_KEY` must be present so the webhook can update profiles.

## Important notes

- Keep `enablePlanPreview` set to `false` in `config.js`. It only exists for
  designing the UI offline and shows a notice instead of changing the real plan.
- Use Stripe Test mode and test cards (for example 4242 4242 4242 4242) until you
  are ready, then switch the keys, price IDs and webhook to live mode.
- The success and cancel pages are handled in the app automatically. After paying,
  the app refreshes the plan; if Stripe is still confirming, the user can click
  Refresh plan.

## What to test

- As a signed-in user, click Upgrade to Pro and complete a test payment. You are
  returned to the app and the plan shows Pro.
- The nav badge and the dashboard, community and Settings cards all show Pro.
- Click Manage billing and confirm the Stripe portal opens.
- In the portal, cancel the subscription. After the webhook fires, the plan
  returns to Free (click Refresh plan if needed).
- A signed-out visitor who clicks an upgrade button is asked to sign in first.
