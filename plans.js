/* ════════════════════════════════════════════════════════════
   plans.js — secure plan status + Stripe checkout helpers
   In production, plan status comes from Supabase via Netlify Functions.
   Local plan preview is disabled unless config.enablePlanPreview=true.
   ════════════════════════════════════════════════════════════ */

const PLAN_ORDER = ['free', 'pro', 'ultimate'];
const PLAN_DEFINITIONS = {
  free: {
    name: 'Free', price: '£0', badge: 'badge-blue', icon: '🌱',
    summary: 'Everything needed to learn without annoying message limits.',
    features: ['AI tutor access', 'Flashcard maker', 'Quizzes', 'Revision notes', 'Prompt Lab', 'Study planner', 'Community posting and comments']
  },
  pro: {
    name: 'Pro', price: '£7.99/month', badge: 'badge-purple', icon: '🚀',
    summary: 'Better learning workflows for students who want structure and progress insight.',
    features: ['Everything in Free', 'Advanced AI revision plans', 'Exam-mode quiz coaching', 'Weak-area analysis', 'Progress analytics', 'Priority model when enabled']
  },
  ultimate: {
    name: 'Ultimate', price: '£14.99/month', badge: 'badge-yellow', icon: '🌟',
    summary: 'Premium support, reporting and advanced tutoring experiences.',
    features: ['Everything in Pro', 'Parent progress reports', 'Essay marking rubrics', 'Multiple AI tutor modes', 'Early access features', 'Priority support']
  }
};

function normalisePlan(plan) { plan = String(plan || 'free').toLowerCase(); return PLAN_DEFINITIONS[plan] ? plan : 'free'; }
function getPlan() { if (!D) return 'free'; D.plan = normalisePlan(D.plan || (D.subscription && D.subscription.plan) || 'free'); return D.plan; }
function getPlanDef(plan) { return PLAN_DEFINITIONS[normalisePlan(plan)]; }
function planRank(plan) { return PLAN_ORDER.indexOf(normalisePlan(plan)); }
function hasPlan(required) { return planRank(getPlan()) >= planRank(required || 'free'); }

function setLocalPlan(plan, reason) {
  const cfg = window.STUDYHUB_CONFIG || {};
  if (!cfg.enablePlanPreview) {
    showToast('Plan changes are handled securely by Stripe checkout. Use the upgrade button instead.', 'info');
    return;
  }
  if (!D) return;
  D.plan = normalisePlan(plan);
  D.subscription = D.subscription || {};
  D.subscription.plan = D.plan;
  D.subscription.updatedAt = Date.now();
  D.subscription.source = reason || 'local-preview';
  saveData(); applyAuthUI();
  showToast('Preview plan: ' + getPlanDef(D.plan).name, 'success');
}

function planBadgeHtml(plan) {
  const p = getPlanDef(plan || getPlan());
  return `<span class="badge ${p.badge}" title="${esc(p.summary)}">${p.icon} ${p.name}</span>`;
}

function renderPlanStatus(elId) {
  const el = byId(elId); if (!el) return;
  const plan = getPlan();
  const def = getPlanDef(plan);
  const status = (D && D.subscription && D.subscription.status) ? D.subscription.status : 'free';
  const features = def.features.slice(0, 7).map(f => `<li><span class="check">✓</span> ${esc(f)}</li>`).join('');
  const manage = plan !== 'free' ? '<button class="btn btn-ghost btn-sm" onclick="openBillingPortal()">Manage billing</button>' : '';
  el.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div>
        <div class="fs-xs text-muted">Current plan</div>
        <div style="font-size:1.25rem;font-weight:900">${def.icon} ${def.name}</div>
        <div class="fs-xs text-muted">Subscription status: ${esc(status)}</div>
      </div>
      ${planBadgeHtml(plan)}
    </div>
    <p class="fs-sm text-muted" style="line-height:1.55;margin-bottom:0.75rem">${esc(def.summary)}</p>
    <ul class="pricing-features" style="margin-bottom:0.875rem">${features}</ul>
    <div class="flex gap-sm flex-wrap">
      ${plan === 'ultimate' ? '<div class="badge badge-green">All features unlocked</div>' : `<button class="btn btn-primary btn-sm" onclick="startCheckout('${plan === 'free' ? 'pro' : 'ultimate'}')">Upgrade to ${plan === 'free' ? 'Pro' : 'Ultimate'}</button>`}
      ${manage}
      <button class="btn btn-ghost btn-sm" onclick="refreshPlanFromBackend()">Refresh plan</button>
    </div>`;
}

function syncPlanUI() {
  if (!session || !D) return;
  const chip = byId('planChip'); if (chip) chip.innerHTML = planBadgeHtml(getPlan());
  renderPlanStatus('settingsPlanStatus');
  renderPlanStatus('communityPlanStatus');
  renderPlanStatus('dashboardPlanStatus');
}

function showUpgrade(requiredPlan, featureName) {
  const p = getPlanDef(requiredPlan);
  showToast((featureName || 'This feature') + ' is included in ' + p.name + '.', 'info');
  startCheckout(requiredPlan);
}
function guardFeature(requiredPlan, featureName, cb) {
  if (hasPlan(requiredPlan)) { if (typeof cb === 'function') cb(); return true; }
  showUpgrade(requiredPlan, featureName); return false;
}

async function refreshPlanFromBackend() {
  if (!session) { openAuth('login'); return; }
  if (!backendConfigured()) { showToast('Supabase is not configured yet, so secure plan refresh is unavailable.', 'info'); return; }
  try {
    await backendGetAccount();
    syncPlanUI();
    showToast('Plan refreshed: ' + getPlanDef(getPlan()).name, 'success');
  } catch (e) {
    showToast(e.message || 'Could not refresh plan', 'error');
  }
}

async function startCheckout(plan) {
  plan = normalisePlan(plan);
  if (!session) { openAuth('signup'); return; }
  if (plan === 'free') return;
  if (!backendConfigured()) { showToast('Supabase must be configured before paid checkout can work securely.', 'error'); return; }
  try {
    const data = await backendStartCheckout(plan);
    if (data && data.url) { window.location.href = data.url; return; }
    showToast('Stripe did not return a checkout URL.', 'error');
  } catch (err) {
    showToast(err.message || 'Stripe checkout failed.', 'error');
  }
}

async function openBillingPortal() {
  if (!session) { openAuth('login'); return; }
  if (!backendConfigured()) { showToast('Supabase is not configured yet.', 'error'); return; }
  try {
    const data = await backendOpenBillingPortal();
    if (data && data.url) { window.location.href = data.url; return; }
    showToast('Stripe did not return a billing portal URL.', 'error');
  } catch (e) {
    showToast(e.message || 'Could not open billing portal.', 'error');
  }
}

async function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search || '');
  if (params.get('checkout') === 'success') {
    if (session && backendConfigured()) {
      try { await backendGetAccount(); showToast('Payment complete. Your subscription status has been refreshed.', 'success'); }
      catch (e) { showToast('Payment complete. Stripe may take a moment to confirm the subscription. Try Refresh plan.', 'info'); }
    }
    params.delete('checkout'); params.delete('session_id');
    const qs = params.toString(); history.replaceState({}, document.title, location.pathname + (qs ? '?' + qs : '') + location.hash);
  } else if (params.get('checkout') === 'cancel') {
    showToast('Checkout cancelled. Your plan has not changed.', 'info');
    params.delete('checkout');
    const qs = params.toString(); history.replaceState({}, document.title, location.pathname + (qs ? '?' + qs : '') + location.hash);
  } else if (params.get('billing') === 'return') {
    if (session && backendConfigured()) await backendGetAccount().catch(() => null);
    params.delete('billing');
    const qs = params.toString(); history.replaceState({}, document.title, location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
}
