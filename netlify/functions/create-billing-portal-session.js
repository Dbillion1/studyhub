const { json, empty, verifyUser, ensureProfile, env } = require('./_supabase');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const stripeKey = env('STRIPE_SECRET_KEY');
    const siteUrl = (process.env.SITE_URL || event.headers.origin || 'http://localhost:8888').replace(/\/$/, '');
    const { user } = await verifyUser(event);
    const profile = await ensureProfile(user);
    if (!profile.stripe_customer_id) return json(400, { error: 'No Stripe customer is linked to this account yet.' });

    const params = new URLSearchParams();
    params.set('customer', profile.stripe_customer_id);
    params.set('return_url', `${siteUrl}/?billing=return`);

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch (e) { data = { error: text }; }
    if (!res.ok) return json(res.status, data);
    return json(200, { url: data.url });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Could not open billing portal.' });
  }
};
