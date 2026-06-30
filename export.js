/* ════════════════════════════════════════════════════════════
   export.js — data export and account control (Phase 14).
   Lets a student download their own data (good practice and good
   for trust). Pure client-side: it reads the local data model D.
   ════════════════════════════════════════════════════════════ */

function downloadFile(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 0);
    return true;
  } catch (e) { showToast('Download failed in this browser', 'error'); return false; }
}

function exportMyData() {
  if (!session || !D) { showToast('Sign in first', 'info'); return; }
  const payload = {
    app: 'StudyHub',
    exportedAt: new Date().toISOString(),
    account: { name: session.name, email: session.email },
    profile: D.profile,
    progress: { xp: D.xp, studyMins: D.studyMins, achievements: D.achievements, quizScores: D.quizScores, subjectStats: D.subjectStats },
    flashcards: D.flashcards,
    notes: D.notes,
    sessions: D.sessions,
    goals: D.goals,
    savedPrompts: D.savedPrompts,
    planner: { onboarding: D.plannerOnboarding, tasks: D.plannerTasks, evidence: D.taskEvidence },
    diagnostics: D.diagnostics,
    activity: D.activity,
    chat: D.chat
  };
  const ok = downloadFile('studyhub-data-' + todayStr() + '.json', JSON.stringify(payload, null, 2), 'application/json');
  if (ok) showToast('Your data is downloading', 'success');
}

function csvEscape(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportFlashcardsCsv() {
  if (!session || !D) { showToast('Sign in first', 'info'); return; }
  const cards = D.flashcards || [];
  if (!cards.length) { showToast('No flashcards to export yet', 'info'); return; }
  const rows = [['front', 'back', 'subject']].concat(cards.map(c => [c.front, c.back, (SUBJECTS[c.subject] && SUBJECTS[c.subject].title) || c.subject || '']));
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const ok = downloadFile('studyhub-flashcards-' + todayStr() + '.csv', csv, 'text/csv');
  if (ok) showToast(cards.length + ' flashcards exported', 'success');
}

// Account control: reset learning progress while keeping notes, flashcards and plans.
function resetProgress() {
  if (!session || !D) return;
  confirmAction('Reset your progress?', 'This clears XP, levels, badges, streak and quiz history. Your flashcards, notes and study plan are kept. This cannot be undone.', 'Reset', () => {
    D.xp = 0;
    D.studyMins = 0;
    D.achievements = [];
    D.quizScores = [];
    D.subjectStats = {};
    D.activity = [];
    if (D.challenges) D.challenges = { day: '', flash: 0, quizBest: 0, ai: 0, claimed: [] };
    closeModal('confirmModal');
    showToast('Progress reset', 'info');
    if (typeof afterChange === 'function') afterChange();
    if (typeof renderGamification === 'function' && currentPage === 'gamification') renderGamification();
    if (typeof renderDashboard === 'function' && currentPage === 'dashboard') renderDashboard();
  });
}
