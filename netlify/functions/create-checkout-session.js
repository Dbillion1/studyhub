const { json, empty, verifyUser, ensureProfile, env } = require('./_supabase');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const stripeKey = env('STRIPE_SECRET_KEY');
    const siteUrl = (process.env.SITE_URL || event.headers.origin || 'http://localhost:8888').replace(/\/$/, '');
    const { user } = await verifyUser(event);
    const profile = await ensureProfile(user);
    const body = JSON.parse(event.body || '{}');
    const plan = String(body.plan || '').toLowerCase();
    const priceId = plan === 'ultimate' ? process.env.STRIPE_ULTIMATE_PRICE_ID : plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : '';
    if (!priceId || (plan !== 'pro' && plan !== 'ultimate')) return json(400, { error: 'Unknown plan or missing Stripe price ID.' });

    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${siteUrl}/?checkout=cancel`);
    params.set('client_reference_id', user.id);
    if (profile.stripe_customer_id) params.set('customer', profile.stripe_customer_id);
    else if (user.email) params.set('customer_email', user.email);
    params.set('metadata[user_id]', user.id);
    params.set('metadata[plan]', plan);
    params.set('subscription_data[metadata][user_id]', user.id);
    params.set('subscription_data[metadata][plan]', plan);
    params.set('allow_promotion_codes', 'true');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch (e) { data = { error: text }; }
    if (!res.ok) return json(res.status, data);
    return json(200, { url: data.url });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Stripe request failed.' });
  }
};
