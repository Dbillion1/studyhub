/* ════════════════════════════════════════════════════════════
   ui.js — navigation, auth gating, theme, menus, modals, tabs
   ════════════════════════════════════════════════════════════ */

let currentPage = 'landing';
const AUTH_PAGES = ['dashboard', 'tutor', 'revision', 'planner', 'community', 'gamification'];
const NAV_INDEX = { landing: 0, dashboard: 1, revision: 2, tutor: 3, tools: 4, prompts: 5, planner: 6, community: 7 };

/* ---------- toast ---------- */
function showToast(msg, type = 'info') {
  const c = byId('toastContainer'); if (!c) return;
  const t = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.className = 'toast toast-' + type;
  t.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + esc(msg) + '</span>';
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all 0.3s ease'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------- theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const b = document.querySelector('.theme-btn');
  if (b) b.textContent = theme === 'dark' ? '🌙' : '☀️';
  Store.set(K.theme, theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

/* ---------- navigation ---------- */
function showPage(page) {
  if (AUTH_PAGES.includes(page) && !session) { openAuth('login'); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const el = byId('page-' + page);
  if (el) el.classList.add('active');
  currentPage = page;
  if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  const links = document.querySelectorAll('.nav-link');
  if (NAV_INDEX[page] !== undefined && links[NAV_INDEX[page]]) links[NAV_INDEX[page]].classList.add('active');
  closeUserMenu();
  // page init hooks
  if (page === 'dashboard') renderDashboard();
  if (page === 'tutor') renderTutor();
  if (page === 'revision') renderRevision();
  if (page === 'planner') renderPlanner();
  if (page === 'community') renderCommunity();
  if (page === 'gamification') renderGamification();
  if (page === 'tools') renderTools();
  if (page === 'prompts') renderPrompts();
}
function navTo(page) {
  if (AUTH_PAGES.includes(page) && !session) { openAuth('signup'); return; }
  showPage(page);
}

/* ---------- user menu ---------- */
function toggleUserMenu(e) { if (e) e.stopPropagation(); byId('userMenu').classList.toggle('open'); }
function closeUserMenu() { const m = byId('userMenu'); if (m) m.classList.remove('open'); }

/* ---------- auth UI state ---------- */
function avatarChar(name) { return (name || '?').trim().charAt(0).toUpperCase() || '?'; }
function applyAuthUI() {
  const inEl = byId('authIn'), outEl = byId('authOut');
  if (session) {
    outEl.classList.add('hidden'); inEl.classList.remove('hidden');
    byId('navName').textContent = session.name.split(' ')[0];
    byId('navAvatar').textContent = avatarChar(session.name);
    byId('umName').textContent = session.name;
    byId('umEmail').textContent = session.email;
    const pc = byId('planChip'); if (pc && typeof planBadgeHtml === 'function') pc.innerHTML = planBadgeHtml(getPlan());
  } else {
    inEl.classList.remove('hidden'); outEl.classList.remove('hidden');
    inEl.classList.add('hidden');
  }
  updateSidebarUser();
  if (typeof syncPlanUI === 'function') syncPlanUI();
  updateAuthDependentMarketing();
}

function updateAuthDependentMarketing() {
  document.querySelectorAll('[data-logged-out-only]').forEach(el => el.classList.toggle('hidden', !!session));
  document.querySelectorAll('[data-logged-in-only]').forEach(el => el.classList.toggle('hidden', !session));
}

function updateSidebarUser() {
  if (!session || !D) return;
  const n = byId('sbName'), l = byId('sbLevel'), a = byId('sbAvatar');
  if (n) n.textContent = session.name;
  if (l) l.textContent = '⭐ Level ' + levelFor(D.xp);
  if (a) a.textContent = avatarChar(session.name);
}

/* ---------- modals ---------- */
function openModal(id) { const m = byId(id); if (m) m.classList.add('open'); }
function closeModal(id) { const m = byId(id); if (m) m.classList.remove('open'); }
function closeAllModals() { document.querySelectorAll('.modal-wrap').forEach(m => m.classList.remove('open')); }

let confirmCb = null;
function confirmAction(title, body, okLabel, onOk) {
  byId('confirmTitle').textContent = title;
  byId('confirmBody').textContent = body;
  const btn = byId('confirmOkBtn');
  btn.textContent = okLabel || 'Confirm';
  confirmCb = onOk;
  openModal('confirmModal');
}

/* ---------- settings ---------- */
function openSettings() {
  if (!session) { openAuth('login'); return; }
  const nameEl = byId('set-name'); if (nameEl) nameEl.value = session.name;
  const providerEl = byId('set-provider'); if (providerEl) providerEl.value = (D.settings && D.settings.provider) || 'openai';
  if (typeof renderPlanStatus === 'function') renderPlanStatus('settingsPlanStatus');
  openModal('settingsModal');
}
async function saveSettings() {
  const nameEl = byId('set-name');
  const name = nameEl ? nameEl.value.trim() : '';
  const providerEl = byId('set-provider');
  if (name && session) {
    session.name = name;
    if (!backendConfigured()) {
      const users = Store.getJSON(K.users, {});
      if (users[session.email]) { users[session.email].name = name; Store.setJSON(K.users, users); }
    } else {
      try { await backendUpdateDisplayName(name); } catch (e) { console.warn(e); showToast('Name saved locally, but backend sync failed.', 'info'); }
    }
    Store.setJSON(K.session, session);
  }
  D.settings = D.settings || {};
  if (providerEl) D.settings.provider = providerEl.value;
  saveData();
  applyAuthUI();
  closeModal('settingsModal');
  showToast('Settings saved', 'success');
  if (currentPage === 'tutor') renderTutor();
}
function confirmClearData() {
  confirmAction('Clear your data?', 'This permanently deletes your flashcards, notes, study plan, posts, XP and chat history on this device. Your account login will remain.', 'Clear everything', () => {
    D = newUserData();
    saveData();
    closeModal('confirmModal');
    closeModal('settingsModal');
    showToast('Your data has been cleared', 'info');
    showPage('dashboard');
  });
}

/* ---------- tabs (with per-context render hooks) ---------- */
let communityFilter = 'All Posts';
function switchTab(el, ctx) {
  const parent = el.parentElement;
  const tabs = [...parent.children];
  const idx = tabs.indexOf(el);
  tabs.forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  if (ctx === 'community') {
    // single feed, filtered by tab label — keep tab-0 visible
    communityFilter = el.textContent.trim();
    document.querySelectorAll('[id^="community-tab-"]').forEach((c, i) => c.classList.toggle('active', i === 0));
    renderCommunity();
    return;
  }

  const prefix = ctx + '-tab-';
  document.querySelectorAll('[id^="' + prefix + '"]').forEach((c, i) => c.classList.toggle('active', i === idx));

  if (ctx === 'revision') {
    if (idx === 1) renderFlashDeck();
    if (idx === 2) renderQuizPanel();
    if (idx === 3) renderNotes();
  }
  if (ctx === 'prompt') {
    if (idx === 3) renderSavedPrompts();
  }
}

function toggleFaq(el) { el.classList.toggle('open'); }
function showDashTab(tab) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');
}
