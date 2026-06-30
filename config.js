/* ════════════════════════════════════════════════════════════
   config.js — public site-owner configuration
   Safe to expose: Supabase URL + anon key, public links, function URLs.
   Never put OpenAI, Stripe secret, Supabase service-role or webhook
   secrets in this file. Put those in Netlify environment variables.
   ════════════════════════════════════════════════════════════ */

window.STUDYHUB_CONFIG = {
  // Required for production login/subscriptions. Get these from:
  // Supabase Dashboard → Project Settings → API
  supabaseUrl: 'PASTE_YOUR_SUPABASE_PROJECT_URL_HERE',
  supabaseAnonKey: 'PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE',

  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiEndpoint: '/.netlify/functions/ai-tutor',

  checkoutEndpoint: '/.netlify/functions/create-checkout-session',
  billingPortalEndpoint: '/.netlify/functions/create-billing-portal-session',

  // Optional: paste approved affiliate links here after joining each programme.
  // Example: affiliateLinks: { 'Grammarly': 'https://your-affiliate-link.example' }
  affiliateLinks: {},

  // Keep false for real monetisation. True only if you temporarily want
  // buttons that fake plan changes locally while designing the UI.
  enablePlanPreview: false
};
