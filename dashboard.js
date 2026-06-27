/* ════════════════════════════════════════════════════════════
   dashboard.js — renders the dashboard entirely from real state.
   A brand-new account shows 0 XP / 0 quizzes / 0h / 0 streak.
   ════════════════════════════════════════════════════════════ */

const NAME_TO_KEY = {
  'mathematics': 'maths', 'maths': 'maths',
  'english': 'english', 'english language': 'english', 'english literature': 'english',
  'science': 'science', 'biology': 'science', 'chemistry': 'science', 'physics': 'science',
  'geography': 'geography', 'history': 'history',
  'computer science': 'cs', 'french': 'french', 'german': 'german'
};
function nameToKey(n) { return NAME_TO_KEY[(n || '').toLowerCase()] || null; }

function fmtStudy(mins) {
  if (!mins) return '0h';
  if (mins < 60) return mins + 'm';
  const h = mins / 60;
  return (h % 1 === 0 ? h : h.toFixed(1)) + 'h';
}
function greetingWord() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function renderDashboard() {
  if (!session || !D) return;
  const first = session.name.split(' ')[0];
  const streak = currentStreak();
  const lvl = levelFor(D.xp);
  const avg = avgQuizScore(D);

  byId('dashGreeting').textContent = greetingWord() + ', ' + first + ' 👋';
  const recCount = buildRecs().length;
  byId('dashSubtitle').textContent = D.activity.length <= 1
    ? "Welcome aboard — here's where to start."
    : (recCount ? (recCount + ' thing' + (recCount > 1 ? 's' : '') + ' recommended for you today.') : 'Keep up the great work.');
  byId('dashStreakBadge').textContent = '🔥 ' + streak + ' day' + (streak === 1 ? '' : 's') + ' streak';

  // tip of the day
  byId('dashTip').style.display = 'flex';
  byId('dashTipText').textContent = tipForToday();

  // stat cards
  byId('statXP').textContent = D.xp.toLocaleString();
  byId('statXPchg').textContent = D.xp > 0 ? ('Level ' + lvl + ' — ' + levelTitle(lvl)) : 'Start earning XP';
  const sessionsDone = D.sessions.filter(s => s.done).length;
  byId('statQuiz').textContent = D.quizScores.length;
  byId('statQuizchg').textContent = D.quizScores.length ? ('Best ' + Math.max.apply(null, D.quizScores.map(s => s.pct !== undefined ? s.pct : s)) + '%') : 'No quizzes yet';
  byId('statTime').textContent = fmtStudy(D.studyMins);
  byId('statTimechg').textContent = sessionsDone ? (sessionsDone + ' session' + (sessionsDone > 1 ? 's' : '') + ' done') : 'No sessions yet';
  byId('statScore').textContent = avg === null ? '—' : avg + '%';
  byId('statScorechg').textContent = avg === null ? 'Take a quiz' : (avg >= 70 ? 'Going strong' : 'Room to grow');

  // level progress
  byId('dashLevelBadge').textContent = '⭐ Lv. ' + lvl;
  const floor = levelFloor(D.xp), ceil = levelCeil(D.xp);
  const pct = Math.max(0, Math.min(100, Math.round(((D.xp - floor) / (ceil - floor)) * 100)));
  byId('dashXPfill').style.width = pct + '%';
  byId('dashXPnow').textContent = D.xp.toLocaleString() + ' XP';
  byId('dashXPnext').textContent = (ceil - D.xp) + ' XP to Lv. ' + (lvl + 1);

  // subject performance
  renderDashSubjects();

  // recommendations
  const recs = buildRecs();
  byId('dashRecs').innerHTML = recs.length ? recs.map(r => `
    <div class="card card-sm card-hover" style="${r.accent ? 'border-color:rgba(124,58,237,0.3)' : ''}" onclick="${r.action}">
      <div class="flex items-center gap-md">
        <div style="font-size:1.25rem">${r.icon}</div>
        <div><div style="font-weight:600;font-size:0.875rem">${esc(r.title)}</div><div class="fs-xs text-muted">${esc(r.sub)}</div></div>
        <div class="badge ${r.badgeClass}" style="margin-left:auto">${esc(r.badge)}</div>
      </div>
    </div>`).join('') : '<div class="empty" style="padding:1.5rem"><p>All caught up. Explore the Revision Hub or ask your AI tutor anything.</p></div>';

  // recent activity
  const acts = D.activity.slice(0, 6);
  byId('dashActivity').innerHTML = acts.length ? acts.map(a => {
    const icon = { quiz: '📝', study: '⏱️', review: '🃏', ai: '🤖', post: '👥', login: '👋', account: '🎒', onboard: '✅', flashcard: '🃏', goal: '🎯', note: '📓' }[a.type] || '•';
    return `<div class="flex items-center gap-md" style="padding:0.5rem 0;border-bottom:1px solid var(--border)"><span>${icon}</span><div class="flex-1"><div class="fs-sm fw-500">${esc(a.label)}</div><div class="fs-xs text-muted">${relTime(a.ts)}</div></div></div>`;
  }).join('') : '<div class="empty" style="padding:1.5rem"><div class="e-icon">📊</div><p>No activity yet. Take a quiz, review a flashcard or ask your tutor to get started.</p></div>';

  // leaderboard (top 5 + you)
  renderLeaderboardInto('dashLeaderboard', 5);

  updateSidebarUser();
}

function renderDashSubjects() {
  const stats = D.subjectStats || {};
  const keys = Object.keys(stats).filter(k => stats[k].total > 0);
  const grads = ['var(--grad1)', 'var(--grad2)', 'var(--grad3)', 'var(--grad4)'];
  if (keys.length) {
    byId('dashSubjects').innerHTML = keys.map((k, i) => {
      const p = Math.round((stats[k].correct / stats[k].total) * 100);
      return `<div><div class="flex justify-between fs-xs mb-1"><span>${esc(subjName(k))}</span><span class="text-accent">${p}%</span></div><div class="progress"><div class="progress-fill" style="width:${p}%;background:${grads[i % 4]}"></div></div></div>`;
    }).join('');
  } else {
    byId('dashSubjects').innerHTML = '<div class="fs-sm text-muted">Take some quizzes and your subject performance will appear here.</div>';
  }
}

function buildRecs() {
  const recs = [];
  const weakKeys = (D.profile.weak || []).map(nameToKey).filter(Boolean);
  weakKeys.slice(0, 2).forEach(k => {
    const topics = SUBJECTS[k].topics;
    const topic = topics[Math.floor(Math.random() * topics.length)];
    recs.push({ icon: SUBJECTS[k].icon, title: 'Revise: ' + topic, sub: SUBJECTS[k].title + ' · your focus area', badge: 'Weak area', badgeClass: 'badge-red', accent: true, action: "showPage('revision')" });
  });
  if (D.flashcards.length < 3) recs.push({ icon: '🃏', title: 'Create your first flashcards', sub: 'Build a deck you can revise anytime', badge: 'Start', badgeClass: 'badge-purple', action: "showPage('revision')" });
  if (typeof hasPlan === 'function' && !hasPlan('pro')) recs.push({ icon: '🚀', title: 'Unlock Pro study workflows', sub: 'Advanced plans, exam coaching and analytics', badge: 'Pro', badgeClass: 'badge-purple', action: "startCheckout('pro')" });
  if (D.sessions.length === 0) recs.push({ icon: '📅', title: 'Plan a study session', sub: 'Schedule your first revision block', badge: 'Plan', badgeClass: 'badge-purple', action: "showPage('planner')" });
  if (recs.length === 0) recs.push({ icon: '🧠', title: 'Quiz yourself', sub: 'Test a subject and earn XP', badge: 'Quiz', badgeClass: 'badge-blue', action: "showPage('revision')" });
  return recs.slice(0, 3);
}

function avatarBg(av) { return av && av.indexOf('grad') === 0 ? 'var(--' + av + ')' : 'var(--surface3)'; }
function renderLeaderboardInto(elId, limit) {
  const rows = leaderboardRows();
  if (!rows.length) { byId(elId).innerHTML = '<div class="empty" style="padding:1rem"><p>No leaderboard data yet.</p></div>'; return; }
  const myRank = rows.findIndex(r => r.me) + 1;
  let shown = rows.slice(0, limit);
  if (myRank > limit) shown = rows.slice(0, limit - 1).concat(rows[myRank - 1]);
  const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1);
  byId(elId).innerHTML = shown.map(r => {
    const rank = rows.indexOf(r);
    const rc = rank === 0 ? 'rank-1' : rank === 1 ? 'rank-2' : rank === 2 ? 'rank-3' : '';
    return `<div class="leaderboard-item" style="${r.me ? 'background:rgba(124,58,237,0.08);border-color:var(--accent)' : ''}">
      <span class="rank ${rc}" ${r.me ? 'style="color:var(--accent)"' : ''}>${medal(rank)}</span>
      <div class="avatar" style="background:${avatarBg(r.av)};width:28px;height:28px;font-size:0.7rem">${avatarChar(r.name)}</div>
      <span class="lb-name">${esc(r.name)}</span>
      <span class="lb-xp">${r.xp.toLocaleString()} XP</span>
    </div>`;
  }).join('');
}
