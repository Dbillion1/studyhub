/* ════════════════════════════════════════════════════════════
   auth.js — Supabase Auth for production, local fallback for dev
   Production login/signup is handled by Supabase Auth. LocalStorage
   fallback only runs if Supabase config is not filled in.
   ════════════════════════════════════════════════════════════ */

let authMode = 'signup';

function openAuth(mode) {
  authMode = mode || 'signup';
  showAuthView(authMode);
  openModal('authModal');
  byId('authCloseBtn').classList.remove('hidden');
}
function closeAuth() { closeModal('authModal'); }
function showAuthView(view) {
  ['login', 'signup', 'verify', 'onboard'].forEach(v => byId('view-' + v).classList.toggle('hidden', v !== view));
  if (view === 'onboard') buildOnboarding();
}

function setVerifyButton(label, handler) {
  const btn = document.querySelector('#view-verify .btn');
  if (!btn) return;
  btn.textContent = label || 'Continue to setup →';
  btn.onclick = handler || function () { showAuthView('onboard'); };
}

/* ---------- field error helpers ---------- */
function fieldErr(id, msg) {
  const el = byId(id + '-err'); const inp = byId(id);
  if (!el) return;
  if (msg) { el.textContent = msg; el.classList.add('show'); if (inp) inp.classList.add('invalid'); }
  else { el.textContent = ''; el.classList.remove('show'); if (inp) inp.classList.remove('invalid'); }
}
function clearErrs(ids) { ids.forEach(i => fieldErr(i, '')); }

async function initialiseLoggedInUser(user) {
  const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || 'StudyHub user').split('@')[0];
  session = { id: user.id, name, email: user.email || '', backend: backendConfigured() ? 'supabase' : 'local' };
  Store.setJSON(K.session, session);
  D = loadUserData(session.id);
  try { if (backendConfigured()) await backendGetAccount(); } catch (e) { console.warn(e); }
  try { if (backendConfigured() && typeof loadPlannerFromBackend === 'function') await loadPlannerFromBackend(); } catch (e) { console.warn(e); }
  try { if (backendConfigured() && typeof loadRevisionFromBackend === 'function') await loadRevisionFromBackend(); } catch (e) { console.warn(e); }
  try { if (backendConfigured() && typeof backendGetMyRole === 'function') session.role = await backendGetMyRole(); } catch (e) { console.warn(e); }
  try { if (backendConfigured() && typeof loadCommunityFromBackend === 'function') await loadCommunityFromBackend(); } catch (e) { console.warn(e); }
  applyAuthUI();
}

/* ---------- signup ---------- */
async function doSignup() {
  clearErrs(['su-name', 'su-email', 'su-pass', 'su-pass2']);
  const name = byId('su-name').value.trim();
  const email = byId('su-email').value.trim().toLowerCase();
  const pass = byId('su-pass').value;
  const pass2 = byId('su-pass2').value;
  let bad = false;
  if (!name) { fieldErr('su-name', 'Please enter your name'); bad = true; }
  if (!email) { fieldErr('su-email', 'Please enter your email'); bad = true; }
  else if (!isEmail(email)) { fieldErr('su-email', "That doesn't look like a valid email"); bad = true; }
  if (!pass || pass.length < 6) { fieldErr('su-pass', 'Use at least 6 characters'); bad = true; }
  if (pass2 !== pass) { fieldErr('su-pass2', 'Passwords do not match'); bad = true; }
  if (bad) return;

  if (backendConfigured()) {
    const sb = initBackend();
    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name } }
      });
      if (error) { fieldErr('su-email', error.message); return; }
      ['su-name', 'su-email', 'su-pass', 'su-pass2'].forEach(i => byId(i).value = '');
      byId('verifyName').textContent = name.split(' ')[0];
      if (data && data.session && data.user) {
        await initialiseLoggedInUser(data.user);
        D.profile = D.profile || newUserData().profile;
        await backendSyncProfile().catch(() => null);
        setVerifyButton('Continue to setup →', function () { showAuthView('onboard'); });
        showAuthView('verify');
      } else {
        setVerifyButton('Go to sign in →', function () { showAuthView('login'); });
        showAuthView('verify');
        showToast('Account created. Check your email to confirm it, then sign in.', 'success');
      }
    } catch (err) {
      fieldErr('su-email', err.message || 'Signup failed');
    }
    return;
  }

  // Local fallback for offline/design testing only.
  const users = Store.getJSON(K.users, {});
  if (email && users[email]) { fieldErr('su-email', 'An account with this email already exists'); return; }
  const id = uid();
  users[email] = { id, name, email, passHash: hashPass(pass), createdAt: Date.now() };
  Store.setJSON(K.users, users);
  session = { id, name, email, backend: 'local' };
  Store.setJSON(K.session, session);
  D = newUserData();
  logActivity('account', 'Created account');
  saveData();
  applyAuthUI();
  byId('verifyName').textContent = name.split(' ')[0];
  ['su-name', 'su-email', 'su-pass', 'su-pass2'].forEach(i => byId(i).value = '');
  setVerifyButton('Continue to setup →', function () { showAuthView('onboard'); });
  showAuthView('verify');
}

/* ---------- login ---------- */
async function doLogin() {
  clearErrs(['li-email', 'li-pass']);
  const email = byId('li-email').value.trim().toLowerCase();
  const pass = byId('li-pass').value;
  let bad = false;
  if (!email) { fieldErr('li-email', 'Please enter your email'); bad = true; }
  if (!pass) { fieldErr('li-pass', 'Please enter your password'); bad = true; }
  if (bad) return;

  if (backendConfigured()) {
    const sb = initBackend();
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) { fieldErr('li-pass', error.message || 'Incorrect email or password'); return; }
      await initialiseLoggedInUser(data.user);
      logActivity('login', 'Signed in');
      saveData();
      byId('li-email').value = ''; byId('li-pass').value = '';
      closeAuth();
      showToast('Welcome back, ' + session.name.split(' ')[0] + '!', 'success');
      showPage('dashboard');
    } catch (err) {
      fieldErr('li-pass', err.message || 'Login failed');
    }
    return;
  }

  // Local fallback only.
  const users = Store.getJSON(K.users, {});
  const u = users[email];
  if (!u || u.passHash !== hashPass(pass)) { fieldErr('li-pass', 'Incorrect email or password'); return; }
  session = { id: u.id, name: u.name, email: u.email, backend: 'local' };
  Store.setJSON(K.session, session);
  D = loadUserData(u.id);
  logActivity('login', 'Signed in');
  saveData();
  applyAuthUI();
  byId('li-email').value = ''; byId('li-pass').value = '';
  closeAuth();
  showToast('Welcome back, ' + u.name.split(' ')[0] + '!', 'success');
  showPage('dashboard');
}

/* ---------- logout ---------- */
async function logout() {
  closeUserMenu();
  try { if (backendConfigured()) await initBackend().auth.signOut(); } catch (e) {}
  Store.del(K.session);
  session = null; D = null;
  applyAuthUI();
  showPage('landing');
  showToast('Signed out', 'info');
}

/* ════════════════════════════════════════════════════════════
   ONBOARDING
   ════════════════════════════════════════════════════════════ */
let obStep = 0;
let selectedYear = null, selectedGrade = null;
let selectedSubjects = [], selectedStrong = [], selectedWeak = [];

function buildOnboarding() {
  obStep = 0;
  const p = (D && D.profile) ? D.profile : {};
  selectedYear = p.year || null;
  selectedGrade = p.grade || null;
  selectedSubjects = Array.isArray(p.subjects) ? p.subjects.slice() : [];
  selectedStrong = Array.isArray(p.strong) ? p.strong.slice() : [];
  selectedWeak = Array.isArray(p.weak) ? p.weak.slice() : [];
  const on = (cond) => cond ? ' selected' : '';

  const years = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'];
  byId('yearGroup').innerHTML = years.map(y => `<div class="ob-option${on(y === selectedYear)}" onclick="selectYear(this,'${y}')">${y}</div>`).join('');

  const subs = ['Mathematics', 'English Language', 'English Literature', 'Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Computer Science', 'French', 'German', 'Art', 'Music', 'Drama'];
  byId('subjectPicker').innerHTML = subs.map(s => `<div class="ob-option${on(selectedSubjects.includes(s))}" onclick="toggleOb(this,'sub')" style="display:inline-flex;margin:0.25rem">${s}</div>`).join('');

  const grades = ['Grade 9 (A**)', 'Grade 8 (A*)', 'Grade 7 (A)', 'Grade 6 (B+)', 'Grade 5 (B)', 'Grade 4 (C)'];
  byId('gradePicker').innerHTML = grades.map(g => `<div class="ob-option${on(g === selectedGrade)}" onclick="selectGrade(this,'${g.replace(/'/g, "\\'")}')">${g}</div>`).join('');

  const core = ['Mathematics', 'English', 'Science', 'Geography', 'History', 'Computer Science', 'French', 'German'];
  byId('strongPicker').innerHTML = core.map(s => `<div class="ob-option${on(selectedStrong.includes(s))}" onclick="toggleOb(this,'strong')" style="display:inline-flex;margin:0.25rem">${s}</div>`).join('');
  byId('weakPicker').innerHTML = core.map(s => `<div class="ob-option${on(selectedWeak.includes(s))}" onclick="toggleOb(this,'weak')" style="display:inline-flex;margin:0.25rem">${s}</div>`).join('');

  document.querySelectorAll('#view-onboard .onboarding-step').forEach((s, i) => s.classList.toggle('active', i === 0));
  document.querySelectorAll('#obDots .step-dot').forEach((d, i) => { d.classList.toggle('active', i === 0); d.classList.remove('done'); });
}
function selectYear(el, y) { document.querySelectorAll('#yearGroup .ob-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); selectedYear = y; }
function selectGrade(el, g) { document.querySelectorAll('#gradePicker .ob-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); selectedGrade = g; }
function toggleOb(el, type) {
  el.classList.toggle('selected');
  const sel = id => [...document.querySelectorAll('#' + id + ' .ob-option.selected')].map(e => e.textContent);
  if (type === 'sub') selectedSubjects = sel('subjectPicker');
  else if (type === 'strong') selectedStrong = sel('strongPicker');
  else selectedWeak = sel('weakPicker');
}
function obNext() {
  const steps = document.querySelectorAll('#view-onboard .onboarding-step');
  const dots = document.querySelectorAll('#obDots .step-dot');
  if (obStep < steps.length - 1) {
    steps[obStep].classList.remove('active');
    dots[obStep].classList.remove('active'); dots[obStep].classList.add('done');
    obStep++;
    steps[obStep].classList.add('active');
    dots[obStep].classList.add('active');
  }
}
async function finishOnboarding() {
  if (!session || !D) { closeAuth(); return; }
  D.profile = Object.assign({}, D.profile || {}, {
    year: selectedYear || '',
    subjects: selectedSubjects.slice(),
    grade: selectedGrade || '',
    strong: selectedStrong.slice(),
    weak: selectedWeak.slice(),
    onboarded: true
  });
  logActivity('onboard', 'Completed profile setup');
  saveData();
  try { if (backendConfigured()) await backendSyncProfile(); } catch (e) { console.warn(e); }
  closeAuth();
  showToast('🎉 Welcome to StudyHub, ' + session.name.split(' ')[0] + '! Your dashboard is ready.', 'success');
  showPage('dashboard');
}
