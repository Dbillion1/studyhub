/* ════════════════════════════════════════════════════════════
   backend.js — Supabase Auth + secure Netlify Function helpers
   Public Supabase URL/anon key belong in config.js. Secret keys stay
   in Netlify environment variables and are only used by functions.
   ════════════════════════════════════════════════════════════ */

let studyhubSupabase = null;

function backendConfigured() {
  const cfg = window.STUDYHUB_CONFIG || {};
  return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
}

function initBackend() {
  if (studyhubSupabase || !backendConfigured()) return studyhubSupabase;
  const cfg = window.STUDYHUB_CONFIG || {};
  studyhubSupabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return studyhubSupabase;
}

async function getAccessToken() {
  const sb = initBackend();
  if (!sb) return '';
  const { data, error } = await sb.auth.getSession();
  if (error || !data || !data.session) return '';
  return data.session.access_token || '';
}

async function authHeaders(extra) {
  const token = await getAccessToken();
  return Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}, extra || {});
}

async function backendFetch(path, options) {
  const headers = await authHeaders((options && options.headers) || {});
  const res = await fetch(path, Object.assign({}, options || {}, { headers }));
  let data = null, text = '';
  try { text = await res.text(); data = text ? JSON.parse(text) : null; } catch (e) { data = text ? { error: text } : null; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || ('Request failed: HTTP ' + res.status);
    const err = new Error(msg); err.status = res.status; err.body = data; throw err;
  }
  return data;
}

async function backendGetAccount() {
  if (!backendConfigured()) return null;
  const data = await backendFetch('/.netlify/functions/get-account', { method: 'GET' });
  applyBackendAccount(data);
  return data;
}

function applyBackendAccount(data) {
  if (!data || !D) return;
  D.plan = normalisePlan(data.plan || 'free');
  D.subscription = Object.assign({}, D.subscription || {}, data.subscription || {}, {
    plan: D.plan,
    source: 'supabase-stripe',
    updatedAt: Date.now()
  });
  if (data.profile && typeof data.profile === 'object') {
    D.profile = Object.assign({}, D.profile || {}, data.profile);
  }
  saveData();
  if (typeof applyAuthUI === 'function') applyAuthUI();
}

async function backendSyncProfile() {
  if (!backendConfigured() || !session || !D) return null;
  const data = await backendFetch('/.netlify/functions/sync-profile', {
    method: 'POST',
    body: JSON.stringify({ name: session.name, profile: D.profile || {} })
  });
  applyBackendAccount(data);
  return data;
}

async function backendStartCheckout(plan) {
  return backendFetch('/.netlify/functions/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ plan })
  });
}

async function backendOpenBillingPortal() {
  return backendFetch('/.netlify/functions/create-billing-portal-session', { method: 'POST', body: '{}' });
}

async function backendUpdateDisplayName(name) {
  const sb = initBackend();
  if (sb && name) await sb.auth.updateUser({ data: { full_name: name } });
  return backendSyncProfile();
}
