/* ════════════════════════════════════════════════════════════
   gamification.js — XP profile, daily challenges, achievements,
   and real-account leaderboard. All from real user data.
   ════════════════════════════════════════════════════════════ */

function renderGamification() {
  if (!session || !D) return;
  const lvl = levelFor(D.xp);
  const floor = levelFloor(D.xp), ceil = levelCeil(D.xp);
  const pct = Math.max(0, Math.min(100, Math.round(((D.xp - floor) / (ceil - floor)) * 100)));
  const unlocked = D.achievements.length;

  byId('gamProfile').innerHTML = `
    <div class="flex items-center gap-md mb-3">
      <div class="avatar" style="width:64px;height:64px;font-size:1.5rem;background:var(--grad1)">${avatarChar(session.name)}</div>
      <div>
        <h2 style="font-weight:800;font-size:1.4rem">${esc(session.name)}</h2>
        <div class="text-muted fs-sm">Level ${lvl} · ${levelTitle(lvl)}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:1.6rem;font-weight:900;color:var(--accent)">${D.xp.toLocaleString()}</div>
        <div class="fs-xs text-muted">total XP</div>
      </div>
    </div>
    <div class="flex justify-between fs-xs mb-1"><span>Level ${lvl}</span><span>${ceil - D.xp} XP to Level ${lvl + 1}</span></div>
    <div class="progress" style="height:12px"><div class="progress-fill" style="width:${pct}%;background:var(--grad1)"></div></div>
    <div class="grid-3 mt-3" style="gap:0.75rem;text-align:center">
      <div class="card card-sm"><div style="font-size:1.4rem;font-weight:800">🔥 ${currentStreak()}</div><div class="fs-xs text-muted">day streak</div></div>
      <div class="card card-sm"><div style="font-size:1.4rem;font-weight:800">📝 ${D.quizScores.length}</div><div class="fs-xs text-muted">quizzes</div></div>
      <div class="card card-sm"><div style="font-size:1.4rem;font-weight:800">🏅 ${unlocked}/${ACHIEVEMENTS.length}</div><div class="fs-xs text-muted">badges</div></div>
    </div>`;

  // daily challenges
  ensureChallengeDay();
  const c = D.challenges;
  byId('gamChallenges').innerHTML = CHALLENGES.map(ch => {
    const val = ch.get(c);
    const done = c.claimed.includes(ch.id);
    const prog = Math.min(100, Math.round((val / ch.goal) * 100));
    return `<div class="card card-sm">
      <div class="flex items-center gap-md mb-1"><span style="font-size:1.25rem">${ch.icon}</span><div class="flex-1"><div class="fw-600 fs-sm">${ch.label}</div><div class="fs-xs text-muted">${done ? 'Completed today' : (ch.pct ? 'Best today: ' + val + '%' : val + ' / ' + ch.goal)}</div></div><span class="badge ${done ? 'badge-green' : 'badge-purple'}">${done ? '✓ +' + ch.xp : '+' + ch.xp + ' XP'}</span></div>
      <div class="progress"><div class="progress-fill" style="width:${prog}%;background:${done ? 'var(--green)' : 'var(--accent)'}"></div></div>
    </div>`;
  }).join('');

  // achievements with progress towards locked badges
  byId('gamAchievements').innerHTML = ACHIEVEMENTS.map(a => {
    const got = D.achievements.includes(a.id);
    const raw = typeof a.progress === 'function' ? Number(a.progress(D) || 0) : (got ? (a.goal || 1) : 0);
    const goal = Number(a.goal || 1);
    const prog = Math.max(0, Math.min(100, Math.round((raw / goal) * 100)));
    return `<div class="achievement ${got ? 'unlocked' : 'locked'}" title="${esc(a.desc)}">
      <div class="ach-icon">${got ? a.icon : '🔒'}</div>
      <div class="ach-name">${esc(a.name)}</div>
      <div class="ach-desc fs-xs text-muted">${esc(a.desc)}</div>
      <div class="progress" style="height:7px;margin-top:0.5rem"><div class="progress-fill" style="width:${got ? 100 : prog}%;background:${got ? 'var(--green)' : 'var(--accent)'}"></div></div>
      <div class="fs-xs text-muted" style="margin-top:0.25rem">${got ? 'Unlocked' : Math.min(raw, goal) + ' / ' + goal}</div>
    </div>`;
  }).join('');

  // leaderboard
  renderLeaderboardInto('gamLeaderboard', 8);
}
