const crypto = require('crypto');
const { json, empty, env, updateProfile, planFromPriceId } = require('./_supabase');

function rawBody(event) {
  return event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
}

function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(signature.split(',').map(p => {
    const i = p.indexOf('='); return i === -1 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
  }));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch (e) { return false; }
}

function unixToIso(seconds) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function applySubscription({ userId, customerId, subscriptionId, plan, status, currentPeriodEnd }) {
  if (!userId) return;
  const active = status === 'active' || status === 'trialing' || status === 'checkout_completed';
  await updateProfile(userId, {
    plan: active ? plan : 'free',
    subscription_status: status || 'unknown',
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    current_period_end: currentPeriodEnd || null
  });
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = env('STRIPE_WEBHOOK_SECRET');
  const payload = rawBody(event);
  const sig = (event.headers || {})['stripe-signature'] || (event.headers || {})['Stripe-Signature'];
  if (!verifyStripeSignature(payload, sig, secret)) return json(400, { error: 'Invalid Stripe webhook signature.' });

  let stripeEvent;
  try { stripeEvent = JSON.parse(payload); } catch (e) { return json(400, { error: 'Invalid JSON payload.' }); }

  const obj = stripeEvent.data && stripeEvent.data.object ? stripeEvent.data.object : {};
  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const userId = (obj.metadata && obj.metadata.user_id) || obj.client_reference_id;
      const plan = (obj.metadata && obj.metadata.plan) || 'free';
      await applySubscription({
        userId,
        customerId: obj.customer,
        subscriptionId: obj.subscription,
        plan,
        status: 'checkout_completed',
        currentPeriodEnd: null
      });
    }

    if (stripeEvent.type === 'customer.subscription.created' || stripeEvent.type === 'customer.subscription.updated' || stripeEvent.type === 'customer.subscription.deleted') {
      const userId = obj.metadata && obj.metadata.user_id;
      const firstItem = obj.items && obj.items.data && obj.items.data[0];
      const priceId = firstItem && firstItem.price && firstItem.price.id;
      const plan = (obj.metadata && obj.metadata.plan) || planFromPriceId(priceId);
      const status = stripeEvent.type === 'customer.subscription.deleted' ? 'canceled' : obj.status;
      await applySubscription({
        userId,
        customerId: obj.customer,
        subscriptionId: obj.id,
        plan,
        status,
        currentPeriodEnd: unixToIso(obj.current_period_end)
      });
    }

    return json(200, { received: true });
  } catch (err) {
    return json(500, { error: err.message || 'Webhook processing failed.' });
  }
};
