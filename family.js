/* ════════════════════════════════════════════════════════════
   family.js — weekly progress reports + parent/child linking
   (Phase 11). Family features are Ultimate-gated and require the
   Supabase backend (cross-account linking cannot work offline).

   Linking model (fits the Phase 3 row-level security exactly):
   - A student shares their family code (their account id).
   - A parent enters that code to create a PENDING request.
   - The student approves; only then can the parent read the
     student's profile and weekly reports. The student can revoke
     at any time. Guessing a code only creates a request that the
     student must approve, so it grants no access on its own.
   ════════════════════════════════════════════════════════════ */

/* ---------- weekly report (computed locally from the student's data) ---------- */
function buildWeeklyReport(d) {
  d = d || (typeof D !== 'undefined' ? D : null); if (!d) return null;
  const ws = (typeof weekStartStr === 'function') ? weekStartStr() : new Date().toISOString().slice(0, 10);
  const wsMs = new Date(ws + 'T00:00:00').getTime();
  const acts = (d.activity || []).filter(a => a && a.ts >= wsMs);
  const countType = t => acts.filter(a => a.type === t).length;
  const tasks = (d.plannerTasks || []).filter(t => t.weekStart === ws);
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const quizzesAll = d.quizScores || [];
  const avgQuiz = quizzesAll.length ? Math.round(quizzesAll.reduce((a, b) => a + b, 0) / quizzesAll.length) : 0;
  return {
    weekStart: ws,
    studyMins: d.studyMins || 0,
    xp: d.xp || 0,
    streak: (typeof currentStreak === 'function') ? currentStreak() : 0,
    quizzesThisWeek: countType('quiz'),
    cardsMadeThisWeek: countType('flashcard'),
    notesThisWeek: countType('note'),
    postsThisWeek: countType('post'),
    aiThisWeek: countType('ai'),
    tasksPlanned: tasks.length,
    tasksDone: tasksDone,
    avgQuizScore: avgQuiz,
    weak: (d.profile && d.profile.weak) || [],
    subjects: (d.profile && d.profile.subjects) || []
  };
}

function statBox(num, label) {
  return '<div class="card card-sm" style="text-align:center"><div style="font-weight:900;font-size:1.15rem">' + num + '</div><div class="fs-xs text-muted">' + esc(label) + '</div></div>';
}
function weeklyReportHtml(r, opts) {
  opts = opts || {};
  if (!r) return '';
  return '<div class="card" style="background:var(--surface2)">'
    + '<div class="flex items-center justify-between mb-2"><h4 style="font-weight:800">📈 ' + esc(opts.title || 'This week') + '</h4>'
    + '<span class="fs-xs text-muted">week of ' + esc(r.weekStart) + '</span></div>'
    + '<div class="grid-3" style="gap:0.5rem">'
    + statBox(r.quizzesThisWeek, 'quizzes') + statBox(r.cardsMadeThisWeek, 'cards made') + statBox(r.tasksDone + '/' + r.tasksPlanned, 'tasks done')
    + statBox(r.postsThisWeek, 'posts') + statBox(r.streak, 'day streak') + statBox(r.xp, 'total XP')
    + '</div>'
    + (r.weak && r.weak.length ? '<p class="fs-xs text-muted" style="margin-top:0.6rem">Focus areas: ' + esc(r.weak.join(', ')) + '.</p>' : '')
    + '</div>';
}
function childReportSummary(data) {
  if (!data) return 'No report yet this week.';
  return 'Week of ' + esc(data.weekStart) + ': ' + (data.quizzesThisWeek || 0) + ' quizzes, '
    + (data.tasksDone || 0) + '/' + (data.tasksPlanned || 0) + ' tasks done, '
    + (data.streak || 0) + ' day streak, ' + (data.cardsMadeThisWeek || 0) + ' cards made.';
}

/* ---------- family settings section ---------- */
async function renderFamilySection() {
  const el = byId('familySection'); if (!el) return;
  if (!(typeof backendConfigured === 'function' && backendConfigured())) {
    el.innerHTML = '<p class="fs-sm text-muted">Family accounts need you to be signed in online. They are not available in offline mode.</p>';
    return;
  }
  const ultimate = (typeof hasPlan === 'function') ? hasPlan('ultimate') : false;
  const r = buildWeeklyReport(D);
  if (typeof backendSaveWeeklyReport === 'function') backendSaveWeeklyReport(r).catch(() => {});
  let html = weeklyReportHtml(r, { title: 'Your week' });
  html += '<div class="card card-sm" style="margin-top:0.75rem"><div class="fs-sm fw-600 mb-1">Your family code</div>'
    + '<p class="fs-xs text-muted mb-2">Give this to a parent or guardian so they can request to follow your progress. You approve every request and can revoke access anytime.</p>'
    + '<div class="flex gap-sm items-center" style="flex-wrap:wrap"><code style="background:var(--surface3);padding:0.35rem 0.5rem;border-radius:6px;font-size:0.8rem;word-break:break-all">' + esc(session.id) + '</code>'
    + '<button class="btn btn-ghost btn-sm" onclick="copyFamilyCode()">Copy</button></div></div>';
  if (ultimate) {
    html += '<div class="card card-sm" style="margin-top:0.75rem"><div class="fs-sm fw-600 mb-1">Follow a child\u2019s progress</div>'
      + '<p class="fs-xs text-muted mb-2">Enter the family code your child shows in their StudyHub settings. They will need to approve the request.</p>'
      + '<div class="flex gap-sm"><input class="input" id="family-child-code" placeholder="Child family code"/><button class="btn btn-primary btn-sm" onclick="requestChildLink()">Send request</button></div></div>';
  } else {
    html += '<div class="card card-sm" style="margin-top:0.75rem"><div class="fs-sm fw-600 mb-1">Follow a child\u2019s progress</div>'
      + '<p class="fs-xs text-muted mb-2">Following a child\u2019s progress and weekly reports is an Ultimate feature. You can still share your own family code above and approve requests.</p>'
      + '<button class="btn btn-primary btn-sm" onclick="startCheckout(\'ultimate\')">Upgrade to Ultimate</button></div>';
  }
  html += '<div id="familyLinks" style="margin-top:0.75rem"></div>';
  el.innerHTML = html;
  renderFamilyLinks();
}

async function renderFamilyLinks() {
  const el = byId('familyLinks'); if (!el) return;
  if (!(typeof backendConfigured === 'function' && backendConfigured()) || typeof backendListFamilyLinks !== 'function') { el.innerHTML = ''; return; }
  let links = [];
  try { links = await backendListFamilyLinks(); } catch (e) { el.innerHTML = '<p class="fs-xs text-muted">Could not load family links.</p>'; return; }
  links = links || [];
  const meId = session.id;
  const asChild = links.filter(l => l.child_id === meId);
  const asParent = links.filter(l => l.parent_id === meId);
  let html = '';
  const pendingForMe = asChild.filter(l => l.status === 'pending');
  if (pendingForMe.length) {
    html += '<div class="fs-sm fw-600 mb-1">Requests to follow your progress</div>'
      + pendingForMe.map(l => '<div class="card card-sm flex items-center justify-between" style="margin-bottom:0.4rem"><span class="fs-sm">' + esc(l.parent_name || 'A parent or guardian') + '</span>'
        + '<span class="row-actions"><button class="btn btn-ghost btn-sm" onclick="respondLink(\'' + l.id + '\',true)">Approve</button>'
        + '<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="respondLink(\'' + l.id + '\',false)">Decline</button></span></div>').join('');
  }
  const myFollowers = asChild.filter(l => l.status === 'approved');
  if (myFollowers.length) {
    html += '<div class="fs-sm fw-600 mb-1" style="margin-top:0.6rem">Following your progress</div>'
      + myFollowers.map(l => '<div class="card card-sm flex items-center justify-between" style="margin-bottom:0.4rem"><span class="fs-sm">' + esc(l.parent_name || 'Parent') + '</span>'
        + '<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="revokeLink(\'' + l.id + '\')">Revoke</button></div>').join('');
  }
  if (asParent.length) {
    html += '<div class="fs-sm fw-600 mb-1" style="margin-top:0.6rem">Children you follow</div>';
    asParent.forEach(l => {
      const status = l.status;
      const badge = status === 'approved' ? 'badge-green' : status === 'pending' ? 'badge-yellow' : 'badge-red';
      html += '<div class="card card-sm" style="margin-bottom:0.4rem"><div class="flex items-center justify-between"><span class="fs-sm">' + esc(l.child_name || l.child_id) + '</span>'
        + '<span class="badge ' + badge + '">' + esc(status) + '</span></div>'
        + (status === 'approved' ? '<div id="childReport-' + l.child_id + '" class="fs-xs text-muted" style="margin-top:0.4rem">Loading report...</div>' : '')
        + '<div style="margin-top:0.4rem"><button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="revokeLink(\'' + l.id + '\')">Remove</button></div></div>';
    });
  }
  el.innerHTML = html || '<p class="fs-xs text-muted">No family links yet.</p>';
  asParent.filter(l => l.status === 'approved').forEach(async l => {
    try {
      const rep = (typeof backendGetChildReport === 'function') ? await backendGetChildReport(l.child_id) : null;
      const t = byId('childReport-' + l.child_id);
      if (t) t.innerHTML = rep ? esc(childReportSummary(rep)) : 'No report yet this week.';
    } catch (e) { /* ignore */ }
  });
}

function copyFamilyCode() {
  const code = session && session.id ? session.id : '';
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => showToast('Family code copied', 'success'), () => showToast('Copy failed - select it manually', 'info'));
  } else { showToast('Select the code and copy it manually', 'info'); }
}
function isUuidLike(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim()); }
async function requestChildLink() {
  const inp = byId('family-child-code'); const code = inp ? inp.value.trim() : '';
  if (!isUuidLike(code)) { showToast('Enter a valid family code', 'error'); return; }
  if (code === session.id) { showToast('That is your own code', 'info'); return; }
  try {
    if (typeof backendRequestChildLink === 'function') await backendRequestChildLink(code);
    showToast('Request sent. Your child needs to approve it.', 'success');
    if (inp) inp.value = '';
    renderFamilyLinks();
  } catch (e) { showToast('Could not send request. Check the code and try again.', 'error'); }
}
async function respondLink(id, approve) {
  try {
    if (typeof backendRespondLink === 'function') await backendRespondLink(id, approve);
    showToast(approve ? 'Approved' : 'Declined', approve ? 'success' : 'info');
    renderFamilyLinks();
  } catch (e) { showToast('Could not update the request', 'error'); }
}
function revokeLink(id) {
  confirmAction('Remove this family link?', 'Access to progress will be removed for both sides.', 'Remove', async () => {
    closeModal('confirmModal');
    try { if (typeof backendRevokeLink === 'function') await backendRevokeLink(id); showToast('Link removed', 'info'); renderFamilyLinks(); }
    catch (e) { showToast('Could not remove the link', 'error'); }
  });
}
