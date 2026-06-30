/* ════════════════════════════════════════════════════════════
   admin.js — owner admin and content management (Phase 12).
   Owner-only. The UI is gated on the owner role, but the real gate
   is the Phase 3 row-level security: only an owner can read all
   profiles/roles, change roles, and delete any post. Everything
   here is best-effort against Supabase and requires the backend.
   ════════════════════════════════════════════════════════════ */

function isOwner() { return !!(session && session.role === 'owner'); }
const ADMIN_ROLES = ['student', 'parent', 'moderator', 'developer', 'owner'];

// Settings entry: only show the Owner admin section to an owner.
function renderOwnerEntry() {
  const sec = byId('ownerSection');
  const entry = byId('ownerAdminEntry');
  if (!sec) return;
  if (!isOwner()) { sec.style.display = 'none'; if (entry) entry.innerHTML = ''; return; }
  sec.style.display = 'block';
  if (entry) entry.innerHTML = '<p class="fs-sm text-muted mb-2">Manage users, roles, reported content and the moderation log.</p>'
    + '<button class="btn btn-primary btn-sm" onclick="openAdmin()">Open admin console</button>';
}

function openAdmin() {
  if (!isOwner()) { showToast('Owner access only', 'error'); return; }
  if (!(typeof backendConfigured === 'function' && backendConfigured())) { showToast('Admin needs the online backend', 'info'); return; }
  openModal('adminModal');
  renderAdmin();
}

async function renderAdmin() {
  renderAdminStats();
  renderAdminUsers();
  renderAdminPosts();
  renderAdminModLog();
}

async function renderAdminStats() {
  const el = byId('adminStats'); if (!el) return;
  el.innerHTML = '<div class="fs-sm text-muted">Loading...</div>';
  try {
    const s = (typeof backendAdminStats === 'function') ? await backendAdminStats() : { users: 0, posts: 0, reports: 0 };
    el.innerHTML = '<div class="grid-3" style="gap:0.5rem">'
      + '<div class="card card-sm" style="text-align:center"><div style="font-weight:900;font-size:1.2rem">' + s.users + '</div><div class="fs-xs text-muted">users</div></div>'
      + '<div class="card card-sm" style="text-align:center"><div style="font-weight:900;font-size:1.2rem">' + s.posts + '</div><div class="fs-xs text-muted">posts</div></div>'
      + '<div class="card card-sm" style="text-align:center"><div style="font-weight:900;font-size:1.2rem">' + s.reports + '</div><div class="fs-xs text-muted">open reports</div></div>'
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" style="margin-top:0.5rem" onclick="openReports()">Open reports</button>';
  } catch (e) { el.innerHTML = '<p class="fs-xs text-muted">Could not load stats.</p>'; }
}

async function renderAdminUsers() {
  const el = byId('adminUsers'); if (!el) return;
  el.innerHTML = '<div class="fs-sm text-muted">Loading users...</div>';
  try {
    const users = (typeof backendListUsers === 'function') ? await backendListUsers() : [];
    if (!users.length) { el.innerHTML = '<p class="fs-xs text-muted">No users found.</p>'; return; }
    el.innerHTML = users.map(u => {
      const opts = ADMIN_ROLES.map(r => '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>').join('');
      const planBadge = u.plan === 'ultimate' ? 'badge-purple' : u.plan === 'pro' ? 'badge-green' : 'badge-blue';
      return '<div class="card card-sm" style="margin-bottom:0.4rem"><div class="flex items-center justify-between" style="gap:0.5rem;flex-wrap:wrap">'
        + '<div style="min-width:0"><div class="fs-sm fw-600" style="word-break:break-word">' + esc(u.name || u.email || u.id) + '</div>'
        + '<div class="fs-xs text-muted">' + esc(u.email || '') + ' · <span class="badge ' + planBadge + '">' + esc(u.plan || 'free') + '</span></div></div>'
        + '<select class="select" style="max-width:140px" onchange="adminSetRole(\'' + u.id + '\', this.value)">' + opts + '</select>'
        + '</div></div>';
    }).join('');
  } catch (e) { el.innerHTML = '<p class="fs-xs text-muted">Could not load users.</p>'; }
}

function adminSetRole(userId, role) {
  const apply = async () => {
    try {
      if (typeof backendSetUserRole === 'function') await backendSetUserRole(userId, role);
      if (typeof backendModLog === 'function') backendModLog('set_role', 'user', userId, { role: role }).catch(() => {});
      showToast('Role updated to ' + role, 'success');
      if (userId === session.id) session.role = role;
      renderAdminUsers();
    } catch (e) { showToast('Could not update role', 'error'); renderAdminUsers(); }
  };
  if (userId === session.id && role !== 'owner') {
    confirmAction('Change your own role?', 'You may lose owner access by doing this. Continue?', 'Change', () => { closeModal('confirmModal'); apply(); });
    return;
  }
  apply();
}

async function renderAdminPosts() {
  const el = byId('adminPosts'); if (!el) return;
  el.innerHTML = '<div class="fs-sm text-muted">Loading posts...</div>';
  try {
    const posts = (typeof backendListRecentPosts === 'function') ? await backendListRecentPosts() : [];
    if (!posts.length) { el.innerHTML = '<p class="fs-xs text-muted">No posts.</p>'; return; }
    el.innerHTML = posts.map(p =>
      '<div class="card card-sm" style="margin-bottom:0.4rem"><div class="flex items-center justify-between" style="gap:0.5rem">'
      + '<div style="min-width:0"><div class="fs-xs text-muted">' + esc(p.author_name || 'Student') + '</div>'
      + '<div class="fs-sm" style="word-break:break-word">' + esc((p.body || '').slice(0, 140)) + '</div></div>'
      + '<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="adminDeletePost(\'' + p.id + '\')">Delete</button>'
      + '</div></div>').join('');
  } catch (e) { el.innerHTML = '<p class="fs-xs text-muted">Could not load posts.</p>'; }
}

function adminDeletePost(id) {
  confirmAction('Delete this post?', 'This permanently removes the post for everyone. This cannot be undone.', 'Delete', async () => {
    closeModal('confirmModal');
    try {
      if (typeof backendDeletePost === 'function') await backendDeletePost(id);
      if (typeof backendModLog === 'function') backendModLog('delete_post', 'post', id, { via: 'admin' }).catch(() => {});
      // keep local feed in sync if present
      if (typeof getPosts === 'function' && typeof setPosts === 'function') setPosts(getPosts().filter(x => x.id !== id));
      showToast('Post deleted', 'info');
      renderAdminPosts(); renderAdminStats();
      if (typeof renderCommunity === 'function') renderCommunity();
    } catch (e) { showToast('Could not delete post', 'error'); }
  });
}

async function renderAdminModLog() {
  const el = byId('adminModLog'); if (!el) return;
  el.innerHTML = '<div class="fs-sm text-muted">Loading log...</div>';
  try {
    let rows = (typeof backendListModLog === 'function') ? await backendListModLog() : [];
    if ((!rows || !rows.length) && typeof getModLog === 'function') {
      rows = getModLog().map(m => ({ action: m.action, target_type: m.targetType, created_at: new Date(m.ts).toISOString(), actor_name: m.actor }));
    }
    if (!rows || !rows.length) { el.innerHTML = '<p class="fs-xs text-muted">No moderation actions yet.</p>'; return; }
    el.innerHTML = rows.slice(0, 30).map(r =>
      '<div class="fs-xs" style="padding:0.3rem 0;border-bottom:1px solid var(--border)"><span class="fw-600">' + esc(r.action) + '</span>'
      + ' · ' + esc(r.target_type || '') + ' · ' + esc((r.created_at || '').slice(0, 16).replace('T', ' ')) + '</div>').join('');
  } catch (e) { el.innerHTML = '<p class="fs-xs text-muted">Could not load the log.</p>'; }
}
