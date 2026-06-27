/* ════════════════════════════════════════════════════════════
   engine.js — XP / levels / streaks / achievements / challenges
   Central place that mutates D, persists, and refreshes the UI.
   ════════════════════════════════════════════════════════════ */

/* ---------- levels ---------- */
const XP_PER_LEVEL = 500;
const levelFor = xp => Math.floor((xp || 0) / XP_PER_LEVEL) + 1;
const levelFloor = xp => (levelFor(xp) - 1) * XP_PER_LEVEL;
const levelCeil = xp => levelFor(xp) * XP_PER_LEVEL;
const levelTitle = lvl => lvl >= 15 ? 'Legend' : lvl >= 10 ? 'Master' : lvl >= 6 ? 'Scholar' : lvl >= 3 ? 'Learner' : 'Beginner';

/* ---------- derived stats ---------- */
function totalReviews(d) { return (d.flashcards || []).reduce((a, c) => a + (c.reviews || 0), 0); }
function aiQuestionsTotal(d) { return (d.chat || []).filter(m => m.role === 'user').length; }
function avgQuizScore(d) { const s = d.quizScores || []; return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; }

function activeDays(d) {
  const set = new Set();
  (d.activity || []).forEach(a => set.add(todayStr(new Date(a.ts))));
  return set;
}
function currentStreak() {
  if (!D) return 0;
  const days = activeDays(D);
  if (days.size === 0) return 0;
  // walk back from today; allow the streak to "end yesterday" if nothing yet today
  let streak = 0;
  let cursor = new Date();
  if (!days.has(todayStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(todayStr(cursor))) return 0;
  }
  while (days.has(todayStr(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

/* ---------- leaderboard (real accounts on this device only) */
function leaderboardRows() {
  const users = Store.getJSON(K.users, {});
  const rows = Object.values(users).map(u => {
    const d = loadUserData(u.id);
    return { name: u.id === (session && session.id) ? 'You (' + session.name.split(' ')[0] + ')' : u.name, xp: d.xp || 0, av: 'grad4', me: session && u.id === session.id };
  });
  rows.sort((a, b) => b.xp - a.xp);
  return rows;
}
function leaderboardRank() {
  const rows = leaderboardRows();
  const i = rows.findIndex(r => r.me);
  return i < 0 ? 0 : i + 1;
}
function communityPostsByMe() {
  const posts = Store.getJSON(K.community, []);
  return posts.filter(p => session && p.authorId === session.id).length;
}

/* ---------- activity + XP ---------- */
function logActivity(type, label) {
  if (!D) return;
  D.activity.unshift({ ts: Date.now(), type, label });
  if (D.activity.length > 60) D.activity.length = 60;
}
function awardXP(n, reason) {
  if (!D || !n) return;
  const before = levelFor(D.xp);
  D.xp += n;
  const after = levelFor(D.xp);
  if (after > before) {
    setTimeout(() => showToast('🎉 Level up! You reached Level ' + after + ' — ' + levelTitle(after), 'success'), 250);
  }
}

/* ---------- daily challenges ---------- */
function ensureChallengeDay() {
  if (!D) return;
  const t = todayStr();
  if (!D.challenges || D.challenges.date !== t) {
    D.challenges = { date: t, flash: 0, quizBest: 0, ai: 0, claimed: [] };
  }
}
const CHALLENGES = [
  { id: 'flash', icon: '🃏', label: 'Review 5 flashcards', xp: 50, goal: 5, get: c => c.flash },
  { id: 'quiz', icon: '🎯', label: 'Score 80%+ on a quiz', xp: 100, goal: 80, get: c => c.quizBest, pct: true },
  { id: 'ai', icon: '💬', label: 'Ask the AI tutor 3 questions', xp: 75, goal: 3, get: c => c.ai }
];
function checkChallenges() {
  if (!D) return;
  ensureChallengeDay();
  CHALLENGES.forEach(ch => {
    if (D.challenges.claimed.includes(ch.id)) return;
    const val = ch.get(D.challenges);
    if (val >= ch.goal) {
      D.challenges.claimed.push(ch.id);
      awardXP(ch.xp, 'challenge');
      setTimeout(() => showToast('✅ Challenge complete: ' + ch.label + ' (+' + ch.xp + ' XP)', 'success'), 120);
    }
  });
}

/* ---------- achievements ---------- */
function checkAchievements() {
  if (!D) return;
  ACHIEVEMENTS.forEach(a => {
    if (!D.achievements.includes(a.id)) {
      let unlocked = false;
      try { unlocked = a.test(D); } catch (e) { unlocked = false; }
      if (unlocked) {
        D.achievements.push(a.id);
        setTimeout(() => showToast('🏅 Achievement unlocked: ' + a.name, 'success'), 200);
      }
    }
  });
}

/* ---------- recorders (called by features) ---------- */
function recordFlashReview(cardId) {
  if (!D) return;
  const c = D.flashcards.find(f => f.id === cardId);
  if (c) c.reviews = (c.reviews || 0) + 1;
  ensureChallengeDay();
  D.challenges.flash += 1;
  awardXP(2, 'review');
  afterChange();
}
function recordQuizComplete(pct) {
  if (!D) return;
  D.quizScores.push(pct);
  logActivity('quiz', 'Completed a quiz · ' + pct + '%');
  ensureChallengeDay();
  D.challenges.quizBest = Math.max(D.challenges.quizBest, pct);
  afterChange();
}
function recordStudyMins(mins, label) {
  if (!D) return;
  D.studyMins += mins;
  logActivity('study', label || ('Studied ' + mins + ' mins'));
  afterChange();
}
function recordAIQuestion() {
  if (!D) return;
  ensureChallengeDay();
  D.challenges.ai += 1;
  awardXP(5, 'ai');
}

/* ---------- after any change: persist + refresh visible UI ---------- */
function afterChange() {
  checkChallenges();
  checkAchievements();
  saveData();
  refreshUI();
}
function refreshUI() {
  if (typeof currentPage === 'undefined') return;
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'gamification') renderGamification();
  if (currentPage === 'tutor') renderTutorSidebar();
  updateSidebarUser();
}

function recordQuizAnswer(subjectKey, correct) {
  if (!D || !subjectKey) return;
  if (!D.subjectStats) D.subjectStats = {};
  const s = D.subjectStats[subjectKey] || { correct: 0, total: 0 };
  s.total += 1;
  if (correct) s.correct += 1;
  D.subjectStats[subjectKey] = s;
}
