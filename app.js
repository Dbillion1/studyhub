/* ════════════════════════════════════════════════════════════
   app.js — boot sequence and global event wiring
   Load order: config → supabase CDN → backend → store → data → engine →
   plans → ui → auth → dashboard → tutor → revision → community → planner →
   prompts → gamification → app
   ════════════════════════════════════════════════════════════ */

async function restoreSession() {
  // Production: Supabase Auth session.
  if (backendConfigured()) {
    initBackend();
    const { data, error } = await studyhubSupabase.auth.getSession();
    if (error || !data || !data.session || !data.session.user) {
      Store.del(K.session);
      return false;
    }
    await initialiseLoggedInUser(data.session.user);
    return true;
  }

  // Local fallback for design/offline testing only.
  const s = Store.getJSON(K.session, null);
  if (!s || !s.id) return false;
  const users = Store.getJSON(K.users, {});
  const exists = Object.values(users).some(u => u.id === s.id);
  if (!exists) { Store.del(K.session); return false; }
  session = s;
  D = loadUserData(s.id);
  return true;
}

function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    const suffix = el.getAttribute('data-suffix') || '';
    const dur = 1100, start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = (Number.isInteger(target) ? Math.round(val).toLocaleString() : val.toFixed(1)) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function wireGlobalEvents() {
  document.addEventListener('click', e => {
    const menu = byId('userMenu');
    if (menu && menu.classList.contains('open')) {
      if (!e.target.closest('#userMenu') && !e.target.closest('.user-chip')) menu.classList.remove('open');
    }
    if (e.target.classList && e.target.classList.contains('modal-wrap')) e.target.classList.remove('open');
    const nav = byId('navLinks');
    if (nav && nav.classList.contains('open')) {
      if (!e.target.closest('#navLinks') && !e.target.closest('#navToggle')) { if (typeof closeNav === 'function') closeNav(); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal-wrap.open')];
      if (open.length) open[open.length - 1].classList.remove('open');
      closeUserMenu();
      if (typeof closeNav === 'function') closeNav();
    }
  });

  const ok = byId('confirmOkBtn');
  if (ok) ok.addEventListener('click', () => { if (typeof confirmCb === 'function') { const cb = confirmCb; confirmCb = null; cb(); } });

  const ts = byId('toolSearch');
  if (ts) ts.addEventListener('input', () => filterTools());
}

async function boot() {
  applyTheme(Store.get(K.theme) || 'dark');
  initBackend();
  const loggedIn = await restoreSession();
  if (typeof handleCheckoutReturn === 'function') await handleCheckoutReturn();
  applyAuthUI();
  wireGlobalEvents();
  if (typeof a11yEnhance === 'function') a11yEnhance();
  animateCounters();
  showPage(loggedIn ? 'dashboard' : 'landing');

  if (backendConfigured() && studyhubSupabase) {
    studyhubSupabase.auth.onAuthStateChange(async (_event, sbSession) => {
      if (sbSession && sbSession.user && (!session || session.id !== sbSession.user.id)) {
        await initialiseLoggedInUser(sbSession.user);
        applyAuthUI();
      }
    });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
