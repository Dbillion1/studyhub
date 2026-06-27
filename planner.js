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
