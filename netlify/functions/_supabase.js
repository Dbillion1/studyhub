const DEFAULT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(statusCode, body, headers = {}) {
  return { statusCode, headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body || {}) };
}

function empty(statusCode = 204) { return { statusCode, headers: DEFAULT_HEADERS, body: '' }; }

function env(name, required = true) {
  const v = process.env[name] || '';
  if (required && !v) throw new Error(`${name} is not configured.`);
  return v;
}

function getBearer(event) {
  const h = event.headers || {};
  const raw = h.authorization || h.Authorization || '';
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

async function verifyUser(event) {
  const token = getBearer(event);
  if (!token) {
    const e = new Error('You must be signed in.'); e.statusCode = 401; throw e;
  }
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const anon = env('SUPABASE_ANON_KEY');
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const e = new Error('Invalid or expired login session.'); e.statusCode = 401; throw e;
  }
  const user = await res.json();
  if (!user || !user.id) {
    const e = new Error('Invalid login session.'); e.statusCode = 401; throw e;
  }
  return { user, token };
}

async function supabaseRest(path, options = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const err = new Error(typeof data === 'string' ? data : (data && (data.message || data.error)) || `Supabase REST error ${res.status}`);
    err.statusCode = res.status; err.body = data; throw err;
  }
  return data;
}

function displayNameFromUser(user) {
  return (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email || 'StudyHub user';
}

async function getProfile(userId) {
  const rows = await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}&select=*`, { method: 'GET' });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function ensureProfile(user) {
  const existing = await getProfile(user.id);
  if (existing) return existing;
  const row = {
    id: user.id,
    email: user.email || '',
    full_name: displayNameFromUser(user),
    plan: 'free',
    subscription_status: 'free',
    profile: {},
    updated_at: new Date().toISOString()
  };
  const created = await supabaseRest('profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: row
  });
  return Array.isArray(created) && created.length ? created[0] : row;
}

function activePlan(row) {
  const status = row && row.subscription_status;
  const plan = row && row.plan;
  if ((status === 'active' || status === 'trialing' || status === 'checkout_completed') && (plan === 'pro' || plan === 'ultimate')) return plan;
  return 'free';
}

function publicAccount(row) {
  const plan = activePlan(row);
  return {
    plan,
    profile: row && row.profile ? row.profile : {},
    subscription: {
      plan,
      rawPlan: row && row.plan ? row.plan : 'free',
      status: row && row.subscription_status ? row.subscription_status : 'free',
      stripeCustomerId: row && row.stripe_customer_id ? row.stripe_customer_id : '',
      stripeSubscriptionId: row && row.stripe_subscription_id ? row.stripe_subscription_id : '',
      currentPeriodEnd: row && row.current_period_end ? row.current_period_end : null,
      source: 'supabase-stripe'
    }
  };
}

async function updateProfile(userId, patch) {
  const rows = await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { ...patch, updated_at: new Date().toISOString() }
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function planFromPriceId(priceId) {
  if (priceId && priceId === process.env.STRIPE_ULTIMATE_PRICE_ID) return 'ultimate';
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  return 'free';
}

// Admin-only: permanently delete an auth user. Requires the service-role key
// and is only ever called from a function after verifying the caller's own JWT.
async function deleteAuthUser(userId) {
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { apikey: service, Authorization: `Bearer ${service}` }
  });
  if (!res.ok && res.status !== 404) {
    let t = ''; try { t = await res.text(); } catch (e) {}
    const err = new Error('Failed to delete account: ' + (t || ('HTTP ' + res.status)));
    err.statusCode = res.status; throw err;
  }
  return true;
}

module.exports = { DEFAULT_HEADERS, json, empty, env, verifyUser, supabaseRest, ensureProfile, getProfile, updateProfile, publicAccount, activePlan, planFromPriceId, deleteAuthUser };
