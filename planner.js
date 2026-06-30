/* ════════════════════════════════════════════════════════════
   planner.js — real calendar, study sessions (CRUD), goals
   ════════════════════════════════════════════════════════════ */

let calYear, calMonth;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ensureCal() { if (calYear === undefined) { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); } }
function calPrev() { ensureCal(); calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderPlanner(); }
function calNext() { ensureCal(); calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderPlanner(); }
function calToday() { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); renderPlanner(); }

function sessionsOn(dateStr) { return D.sessions.filter(s => s.date === dateStr).sort((a, b) => (a.time || '').localeCompare(b.time || '')); }

function renderPlanner() {
  if (!session || !D) return;
  if (typeof renderSmartPlan === 'function') renderSmartPlan();
  ensureCal();
  byId('calMonthLabel').textContent = MONTHS[calMonth] + ' ' + calYear;

  const first = new Date(calYear, calMonth, 1);
  let startDow = first.getDay(); startDow = (startDow + 6) % 7; // Monday-first
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayS = todayStr();

  let cells = WD.map(d => `<div class="cal-head">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell empty-cell"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const list = sessionsOn(ds);
    const isToday = ds === todayS;
    const dot = list.length ? `<span class="cal-dot">${list.length}</span>` : '';
    cells += `<div class="cal-cell${isToday ? ' today' : ''}${list.length ? ' has' : ''}" onclick="openDayModal('${ds}')"><span class="cal-num">${d}</span>${dot}</div>`;
  }
  byId('calendarGrid').innerHTML = cells;

  // today
  const today = sessionsOn(todayS);
  byId('plannerToday').innerHTML = today.length
    ? today.map(s => sessionRow(s)).join('')
    : '<div class="empty" style="padding:1.25rem"><p>Nothing scheduled today. <a style="color:var(--accent);cursor:pointer" onclick="openSessionModal(\'' + todayS + '\')">Add a session</a>.</p></div>';

  // upcoming (future, not done)
  const up = D.sessions.filter(s => s.date > todayS).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 6);
  byId('plannerUpcoming').innerHTML = up.length
    ? up.map(s => sessionRow(s, true)).join('')
    : '<div class="empty" style="padding:1.25rem"><div class="e-icon">📅</div><p>No upcoming sessions. Plan ahead to stay on track.</p></div>';

  // goals
  renderGoals();
}

function sessionRow(s, showDate) {
  const subj = SUBJECTS[s.subject] ? SUBJECTS[s.subject] : { icon: '📘', title: s.subject };
  const when = (showDate ? niceDate(s.date) + ' · ' : '') + (s.time ? s.time : '') + (s.dur ? ' · ' + s.dur + ' min' : '');
  return `<div class="session-row ${s.done ? 'done' : ''}">
    <div class="session-ico" style="background:${SUBJECT_COLORS[s.subject] || 'var(--accent)'}">${subj.icon}</div>
    <div class="flex-1">
      <div class="fw-600 fs-sm">${esc(s.topic || subj.title)}</div>
      <div class="fs-xs text-muted">${subj.title}${when ? ' · ' + when : ''}</div>
    </div>
    <div class="row-actions">
      ${s.done ? '<span class="badge badge-green">Done</span>' : `<button class="icon-btn" title="Mark complete" onclick="completeSession('${s.id}')">✅</button>`}
      <button class="icon-btn" title="Edit" onclick="editSession('${s.id}')">✏️</button>
      <button class="icon-btn danger" title="Delete" onclick="deleteSession('${s.id}')">🗑️</button>
    </div>
  </div>`;
}
function niceDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1].slice(0, 3);
}

/* ---------- day modal ---------- */
function openDayModal(ds) {
  if (!session) { openAuth('login'); return; }
  byId('dayModalTitle').textContent = niceDateLong(ds);
  const list = sessionsOn(ds);
  byId('dayModalList').innerHTML = list.length ? list.map(s => sessionRow(s)).join('')
    : '<div class="empty" style="padding:1rem"><p>No sessions on this day yet.</p></div>';
  const add = byId('dayAddBtn');
  add.onclick = () => { closeModal('dayModal'); openSessionModal(ds); };
  openModal('dayModal');
}
function niceDateLong(ds) { const [y, m, d] = ds.split('-').map(Number); return d + ' ' + MONTHS[m - 1] + ' ' + y; }

/* ---------- session CRUD ---------- */
function openSessionModal(prefillDate) {
  if (!session) { openAuth('login'); return; }
  fillSubjectSelect('session-subject', 'maths');
  byId('session-id').value = '';
  byId('sessionModalTitle').textContent = 'New study session';
  byId('session-date').value = prefillDate || todayStr();
  byId('session-topic').value = '';
  byId('session-time').value = '16:00';
  byId('session-dur').value = '45';
  byId('session-del').style.display = 'none';
  fieldErr('session-date', ''); fieldErr('session-topic', '');
  openModal('sessionModal');
}
function editSession(id) {
  const s = D.sessions.find(x => x.id === id); if (!s) return;
  fillSubjectSelect('session-subject', s.subject);
  byId('session-id').value = s.id;
  byId('sessionModalTitle').textContent = 'Edit study session';
  byId('session-date').value = s.date;
  byId('session-topic').value = s.topic || '';
  byId('session-time').value = s.time || '';
  byId('session-dur').value = s.dur || '';
  byId('session-del').style.display = 'inline-flex';
  fieldErr('session-date', ''); fieldErr('session-topic', '');
  openModal('sessionModal');
}
function saveSession() {
  const date = byId('session-date').value;
  const topic = byId('session-topic').value.trim();
  let bad = false;
  if (!date) { fieldErr('session-date', 'Pick a date'); bad = true; } else fieldErr('session-date', '');
  if (!topic) { fieldErr('session-topic', 'What will you study?'); bad = true; } else fieldErr('session-topic', '');
  if (bad) return;
  const id = byId('session-id').value;
  const subject = byId('session-subject').value;
  const time = byId('session-time').value;
  const dur = parseInt(byId('session-dur').value, 10) || 0;
  if (id) {
    const s = D.sessions.find(x => x.id === id);
    if (s) { s.date = date; s.subject = subject; s.topic = topic; s.time = time; s.dur = dur; }
    showToast('Session updated', 'success');
  } else {
    D.sessions.push({ id: uid(), date, subject, topic, time, dur, done: false });
    logActivity('study', 'Scheduled: ' + topic);
    showToast('Study session added', 'success');
  }
  closeModal('sessionModal');
  afterChange();
  renderPlanner();
}
function deleteSessionFromModal() {
  const id = byId('session-id').value; if (!id) return;
  closeModal('sessionModal');
  deleteSession(id);
}
function deleteSession(id) {
  confirmAction('Delete session?', 'This study session will be removed from your planner.', 'Delete', () => {
    D.sessions = D.sessions.filter(x => x.id !== id);
    closeModal('confirmModal');
    showToast('Session deleted', 'info');
    afterChange();
    renderPlanner();
  });
}
function completeSession(id) {
  const s = D.sessions.find(x => x.id === id); if (!s || s.done) return;
  s.done = true;
  awardXP(25, 'session');
  recordStudyMins(s.dur || 0, 'Completed: ' + (s.topic || 'study session'));
  showToast('Nice work! +25 XP', 'success');
  renderPlanner();
}

/* ---------- goals CRUD ---------- */
function renderGoals() {
  const wrap = byId('plannerGoals'); if (!wrap) return;
  if (!D.goals.length) {
    wrap.innerHTML = '<div class="empty" style="padding:1.25rem"><div class="e-icon">🎯</div><p>No goals yet. Set a target to work towards.</p><button class="btn btn-primary btn-sm" onclick="openGoalModal()">+ Add goal</button></div>';
    return;
  }
  wrap.innerHTML = D.goals.map(g => `
    <div class="card card-sm">
      <div class="flex items-center justify-between mb-1"><div class="fw-600 fs-sm">${esc(g.title)}</div>
        <div class="row-actions"><button class="icon-btn" onclick="editGoal('${g.id}')">✏️</button><button class="icon-btn danger" onclick="deleteGoal('${g.id}')">🗑️</button></div>
      </div>
      ${g.due ? `<div class="fs-xs text-muted mb-1">Due ${niceDateLong(g.due)}</div>` : ''}
      <div class="progress"><div class="progress-fill" style="width:${g.progress || 0}%;background:var(--grad1)"></div></div>
      <div class="fs-xs text-muted mt-1">${g.progress || 0}% complete</div>
    </div>`).join('');
}
function openGoalModal() {
  if (!session) { openAuth('login'); return; }
  byId('goal-id').value = '';
  byId('goalModalTitle').textContent = 'New goal';
  byId('goal-title').value = '';
  byId('goal-due').value = '';
  byId('goal-progress').value = '0';
  fieldErr('goal-title', '');
  openModal('goalModal');
}
function editGoal(id) {
  const g = D.goals.find(x => x.id === id); if (!g) return;
  byId('goal-id').value = g.id;
  byId('goalModalTitle').textContent = 'Edit goal';
  byId('goal-title').value = g.title;
  byId('goal-due').value = g.due || '';
  byId('goal-progress').value = g.progress || 0;
  fieldErr('goal-title', '');
  openModal('goalModal');
}
function saveGoal() {
  const title = byId('goal-title').value.trim();
  if (!title) { fieldErr('goal-title', 'Give your goal a name'); return; }
  const due = byId('goal-due').value;
  let progress = parseInt(byId('goal-progress').value, 10); if (isNaN(progress)) progress = 0;
  progress = Math.max(0, Math.min(100, progress));
  const id = byId('goal-id').value;
  if (id) { const g = D.goals.find(x => x.id === id); if (g) { g.title = title; g.due = due; g.progress = progress; } showToast('Goal updated', 'success'); }
  else { D.goals.push({ id: uid(), title, due, progress }); logActivity('goal', 'Set a goal: ' + title); showToast('Goal added', 'success'); }
  closeModal('goalModal');
  afterChange();
  renderPlanner();
}
function deleteGoal(id) {
  confirmAction('Delete goal?', 'This goal will be permanently removed.', 'Delete', () => {
    D.goals = D.goals.filter(x => x.id !== id);
    closeModal('confirmModal');
    showToast('Goal deleted', 'info');
    afterChange();
    renderPlanner();
  });
}

/* ════════════════════════════════════════════════════════════
   PHASE 6 — smart study plan: onboarding, generated weekly tasks,
   and evidence-based completion. Stored locally and mirrored to the
   Supabase planner tables (best-effort) when configured.
   ════════════════════════════════════════════════════════════ */

const EVIDENCE_LABELS = {
  self: 'Self-confirmed', flashcards: 'Flashcards reviewed', quiz_score: 'Quiz taken',
  note: 'Made notes', written: 'Wrote answers', ai_marked: 'AI checked'
};
const STYLE_ACTION = { mix: 'Revise', flashcards: 'Flashcards:', practice: 'Practice questions:', reading: 'Read and note:' };

function weekStartStr(d) {
  const x = d ? new Date(d) : new Date();
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return todayStr(x);
}
function dateForWeekday(weekStart, weekdayIndex) {
  const [y, m, d] = weekStart.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + weekdayIndex));
}
function thisWeekTasks() {
  const ws = weekStartStr();
  return (D.plannerTasks || []).filter(t => t.weekStart === ws);
}

function renderSmartPlan() {
  const el = byId('plannerSmart'); if (!el) return;
  if (!D.plannerOnboarding) {
    el.innerHTML = '<div class="card"><div class="flex items-center justify-between" style="gap:1rem;flex-wrap:wrap">'
      + '<div><h3 style="font-weight:800">🧭 Smart study plan</h3>'
      + '<p class="fs-sm text-muted" style="max-width:48ch;margin-top:0.25rem">Answer a few quick questions and StudyHub builds a weekly revision plan, then tracks real progress using evidence, not just ticked boxes.</p></div>'
      + '<button class="btn btn-primary" onclick="openPlannerOnboarding()">Set up my plan</button></div></div>';
    return;
  }
  const tasks = thisWeekTasks();
  const done = tasks.filter(t => t.status === 'done').length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const rows = tasks.slice().sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).map(t => {
    const subj = SUBJECTS[t.subject] || { icon: '📘', title: t.subject };
    const ev = (D.taskEvidence || []).filter(e => e.taskId === t.id);
    const evLabel = ev.length ? (EVIDENCE_LABELS[ev[ev.length - 1].kind] || 'Evidence') : '';
    return '<div class="session-row ' + (t.status === 'done' ? 'done' : '') + '">'
      + '<div class="session-ico" style="background:' + (SUBJECT_COLORS[t.subject] || 'var(--accent)') + '">' + subj.icon + '</div>'
      + '<div class="flex-1"><div class="fw-600 fs-sm">' + esc(t.title) + '</div>'
      + '<div class="fs-xs text-muted">' + esc(subj.title) + ' · ' + niceDate(t.dueDate) + (t.status === 'done' && evLabel ? ' · ✓ ' + esc(evLabel) : '') + '</div></div>'
      + '<div class="row-actions">' + (t.status === 'done'
        ? '<button class="icon-btn" title="Mark not done" onclick="undoTaskEvidence(\'' + t.id + '\')">↩️</button>'
        : '<button class="btn btn-primary btn-sm" onclick="openEvidence(\'' + t.id + '\')">Complete</button>') + '</div></div>';
  }).join('');
  el.innerHTML = '<div class="card">'
    + '<div class="flex items-center justify-between mb-2" style="gap:1rem;flex-wrap:wrap">'
    + '<div><h3 style="font-weight:800">🧭 This week\'s study plan</h3>'
    + '<div class="fs-xs text-muted">' + done + ' of ' + tasks.length + ' done · evidence-based progress</div></div>'
    + '<div class="flex gap-sm flex-wrap"><button class="btn btn-ghost btn-sm" onclick="openPlannerOnboarding()">Edit settings</button>'
    + '<button class="btn btn-ghost btn-sm" onclick="regenerateWeek()">Regenerate week</button></div></div>'
    + '<div class="progress mb-2"><div class="progress-fill" style="width:' + pct + '%;background:var(--grad1)"></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:0.5rem">'
    + (rows || '<div class="empty" style="padding:1rem"><p>No tasks this week yet. <a style="color:var(--accent);cursor:pointer" onclick="regenerateWeek()">Generate them</a>.</p></div>')
    + '</div></div>';
}

function openPlannerOnboarding() {
  if (!session) { openAuth('login'); return; }
  const ob = D.plannerOnboarding || {};
  const profSubs = ((D.profile && D.profile.subjects) || []).map(s => String(s).toLowerCase());
  const guess = SUBJECT_KEYS.filter(k => profSubs.some(s => s.indexOf(SUBJECTS[k].title.toLowerCase().split(' ')[0]) !== -1));
  const chosen = new Set((ob.subjects && ob.subjects.length) ? ob.subjects : (guess.length ? guess : ['maths', 'english', 'science']));
  byId('po-subjects').innerHTML = SUBJECT_KEYS.map(k =>
    '<label class="chk"><input type="checkbox" value="' + k + '"' + (chosen.has(k) ? ' checked' : '') + '/> ' + SUBJECTS[k].icon + ' ' + SUBJECTS[k].title + '</label>').join('');
  const grades = ['Grade 9', 'Grade 8', 'Grade 7', 'Grade 6', 'Grade 5', 'Grade 4'];
  byId('po-grade').innerHTML = grades.map(g => '<option' + ((ob.targetGrade || '') === g ? ' selected' : '') + '>' + g + '</option>').join('');
  byId('po-exam').value = ob.examDate || '';
  const dset = new Set(ob.days || [0, 1, 2, 3, 4]);
  const WDS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  byId('po-days').innerHTML = WDS.map((d, i) => '<label class="chk"><input type="checkbox" value="' + i + '"' + (dset.has(i) ? ' checked' : '') + '/> ' + d + '</label>').join('');
  byId('po-mins').value = ob.minutesPerDay || 45;
  byId('po-style').value = ob.style || 'mix';
  byId('po-weak').checked = ob.focusWeak !== false;
  openModal('plannerOnboardModal');
}

function savePlannerOnboarding() {
  const subjects = [].slice.call(document.querySelectorAll('#po-subjects input:checked')).map(i => i.value);
  const days = [].slice.call(document.querySelectorAll('#po-days input:checked')).map(i => parseInt(i.value, 10)).sort((a, b) => a - b);
  if (!subjects.length) { showToast('Pick at least one subject', 'error'); return; }
  if (!days.length) { showToast('Pick at least one study day', 'error'); return; }
  const ob = {
    subjects, days,
    targetGrade: byId('po-grade').value,
    examDate: byId('po-exam').value || '',
    minutesPerDay: Math.max(10, Math.min(240, parseInt(byId('po-mins').value, 10) || 45)),
    style: byId('po-style').value || 'mix',
    focusWeak: !!byId('po-weak').checked,
    createdAt: Date.now()
  };
  D.plannerOnboarding = ob;
  generateWeekTasks(true);
  closeModal('plannerOnboardModal');
  logActivity('planner', 'Set up a study plan');
  afterChange();
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendSavePlannerOnboarding === 'function') backendSavePlannerOnboarding(ob).catch(() => {});
  renderPlanner();
  showToast('Your study plan is ready', 'success');
}

function generateWeekTasks(replace) {
  const ob = D.plannerOnboarding; if (!ob) return;
  const ws = weekStartStr();
  if (replace) {
    const removed = (D.plannerTasks || []).filter(t => t.weekStart === ws).map(t => t.id);
    D.plannerTasks = (D.plannerTasks || []).filter(t => t.weekStart !== ws);
    D.taskEvidence = (D.taskEvidence || []).filter(e => removed.indexOf(e.taskId) === -1);
  }
  const profWeak = ((D.profile && D.profile.weak) || []).map(s => String(s).toLowerCase());
  let pool = [];
  ob.subjects.forEach(k => {
    pool.push(k);
    if (ob.focusWeak && profWeak.some(w => SUBJECTS[k].title.toLowerCase().indexOf(w.split(' ')[0]) !== -1)) pool.push(k);
  });
  if (!pool.length) pool = ob.subjects.slice();
  const action = STYLE_ACTION[ob.style] || 'Revise';
  const topicIdx = {};
  const tasks = ob.days.map((dayIdx, n) => {
    const k = pool[n % pool.length];
    const topics = SUBJECTS[k].topics;
    const ti = (topicIdx[k] || 0) % topics.length; topicIdx[k] = (topicIdx[k] || 0) + 1;
    return {
      id: newUUID(), weekStart: ws, title: action + ' ' + topics[ti], subject: k,
      dueDate: dateForWeekday(ws, dayIdx), type: 'revision', status: 'todo', evidenceRequired: true, createdAt: Date.now()
    };
  });
  D.plannerTasks = (D.plannerTasks || []).concat(tasks);
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendSyncPlannerTasks === 'function') backendSyncPlannerTasks(ws, tasks).catch(() => {});
}

function regenerateWeek() {
  if (!D.plannerOnboarding) { openPlannerOnboarding(); return; }
  confirmAction('Regenerate this week?', "This replaces this week's generated tasks with a fresh set. Evidence logged for this week will be cleared.", 'Regenerate', () => {
    generateWeekTasks(true);
    closeModal('confirmModal');
    afterChange();
    renderPlanner();
    showToast("This week's plan refreshed", 'success');
  });
}

let evidenceTaskId = null;
function openEvidence(taskId) {
  const t = (D.plannerTasks || []).find(x => x.id === taskId); if (!t) return;
  evidenceTaskId = taskId;
  byId('evidenceTaskTitle').textContent = t.title;
  byId('ev-kind').value = 'self';
  byId('ev-note').value = '';
  openModal('evidenceModal');
}
function saveEvidence() {
  const t = (D.plannerTasks || []).find(x => x.id === evidenceTaskId);
  if (!t) { closeModal('evidenceModal'); return; }
  const kind = byId('ev-kind').value || 'self';
  const note = byId('ev-note').value.trim().slice(0, 500);
  const ev = { id: newUUID(), taskId: t.id, kind, detail: { note }, createdAt: Date.now() };
  D.taskEvidence = (D.taskEvidence || []).concat(ev);
  t.status = 'done';
  if (typeof awardXP === 'function') awardXP(20, 'task');
  logActivity('task', 'Completed: ' + t.title);
  closeModal('evidenceModal');
  afterChange();
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendAddEvidence === 'function') backendAddEvidence(ev, t).catch(() => {});
  renderPlanner();
  showToast('Logged with evidence. +20 XP', 'success');
}
function undoTaskEvidence(taskId) {
  const t = (D.plannerTasks || []).find(x => x.id === taskId); if (!t) return;
  t.status = 'todo';
  D.taskEvidence = (D.taskEvidence || []).filter(e => e.taskId !== taskId);
  afterChange();
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendClearEvidence === 'function') backendClearEvidence(taskId, t).catch(() => {});
  renderPlanner();
  showToast('Marked as not done', 'info');
}
