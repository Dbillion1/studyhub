/* ════════════════════════════════════════════════════════════
   community.js — posts, likes, comments (persisted in K.community)
   Shared feed on this device. No fake seed posts are added; a new
   community starts empty until real users post.
   ════════════════════════════════════════════════════════════ */

const POST_CATS = ['Tips', 'Resources', 'Questions', 'Discussion'];
const CAT_BADGE = { Tips: 'badge-green', Resources: 'badge-blue', Questions: 'badge-cyan', Discussion: 'badge-purple' };

function getPosts() { return Store.getJSON(K.community, []); }
function setPosts(p) { Store.setJSON(K.community, p); }

function removeSeedCommunityPosts() {
  const posts = getPosts();
  const clean = posts.filter(p => !String(p.authorId || '').startsWith('seed:'));
  if (clean.length !== posts.length) setPosts(clean);
  Store.set(K.communitySeeded, '0');
}

function renderCommunity() {
  removeSeedCommunityPosts();
  const wrap = byId('communityFeed'); if (!wrap) return;
  let posts = getPosts().slice().sort((a, b) => b.ts - a.ts);
  const f = (typeof communityFilter !== 'undefined') ? communityFilter : 'All Posts';
  if (f && f !== 'All Posts') posts = posts.filter(p => (p.category || '').toLowerCase() === f.toLowerCase());

  const staffBar = (typeof isStaff === 'function' && isStaff())
    ? `<div class="card card-sm" style="background:var(--surface2);margin-bottom:1rem"><div class="flex items-center justify-between"><span class="fs-sm fw-600">🛡️ Moderator tools</span><button class="btn btn-ghost btn-sm" onclick="openReports()">Reports (${openReportCount()})</button></div></div>`
    : '';

  if (!posts.length) {
    wrap.innerHTML = staffBar + '<div class="empty"><div class="e-icon">💬</div><h3>No posts here yet</h3><p>Be the first to share something with the community.</p><button class="btn btn-primary btn-sm" onclick="openPostModal()">+ New Post</button></div>';
    renderCommunityStats();
    if (typeof renderPlanStatus === 'function') renderPlanStatus('communityPlanStatus');
    return;
  }
  wrap.innerHTML = staffBar + posts.map(p => postHtml(p)).join('');
  renderCommunityStats();
  if (typeof renderPlanStatus === 'function') renderPlanStatus('communityPlanStatus');
}

function postHtml(p) {
  const mine = session && p.authorId === session.id;
  const liked = session && (p.likedBy || []).includes(session.id);
  const avBg = p.av ? 'var(--' + p.av + ')' : 'var(--grad4)';
  const comments = (p.comments || []).slice().sort((a, b) => a.ts - b.ts);
  return `<div class="post-card">
    <div class="post-header">
      <div class="avatar" style="background:${avBg};width:32px;height:32px;font-size:0.8rem">${avatarChar(p.author)}</div>
      <div class="post-author">${esc(p.author)}</div>
      ${p.category ? `<span class="badge ${CAT_BADGE[p.category] || 'badge-purple'}" style="margin-left:0.5rem">${esc(p.category)}</span>` : ''}
      <span class="post-time">${relTime(p.ts)}</span>
      <span style="margin-left:auto" class="row-actions">
        ${mine ? `<button class="icon-btn" title="Edit" onclick="editPost('${p.id}')">✏️</button>` : ''}
        ${(session && !mine) ? `<button class="icon-btn" title="Report" onclick="reportPost('${p.id}')">🚩</button>` : ''}
        ${(mine || isStaff()) ? `<button class="icon-btn danger" title="Delete" onclick="deletePost('${p.id}')">🗑️</button>` : ''}
      </span>
    </div>
    <div class="post-content" style="white-space:pre-wrap;word-break:break-word">${esc(p.body)}</div>
    ${(p.tags && p.tags.length) ? `<div class="flex flex-wrap gap-sm mb-2" style="margin-top:0.6rem">${p.tags.map(t => `<span class="badge badge-blue">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="post-actions">
      <span class="post-action ${liked ? 'liked' : ''}" onclick="likePost('${p.id}')">${liked ? '❤️' : '🤍'} <span>${(p.likedBy || []).length}</span> like${(p.likedBy || []).length === 1 ? '' : 's'}</span>
      <span class="post-action" onclick="toggleComments('${p.id}')">💬 <span>${comments.length}</span> comment${comments.length === 1 ? '' : 's'}</span>
    </div>
    <div class="comments" id="comments-${p.id}" style="display:none">
      ${comments.map(c => `<div class="comment"><div class="avatar" style="width:24px;height:24px;font-size:0.65rem;background:var(--surface3)">${avatarChar(c.author)}</div><div class="comment-body"><div><span class="comment-author">${esc(c.author)}</span> <span class="comment-time">${relTime(c.ts)}</span></div><div class="comment-text">${esc(c.text)}</div></div></div>`).join('')}
      ${session ? `<div class="comment-form"><input class="input" id="cmt-${p.id}" placeholder="Add a comment…" onkeydown="if(event.key==='Enter'){addComment('${p.id}')}"><button class="btn btn-primary btn-sm" onclick="addComment('${p.id}')">Post</button></div>` : `<div class="fs-xs text-muted" style="padding:0.5rem 0">Sign in to join the conversation.</div>`}
    </div>
  </div>`;
}

function toggleComments(id) {
  const el = byId('comments-' + id); if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function openPostModal() {
  if (!session) { openAuth('login'); return; }
  byId('post-id').value = '';
  byId('postModalTitle').textContent = 'New post';
  byId('post-category').innerHTML = POST_CATS.map(c => `<option value="${c}">${c}</option>`).join('');
  byId('post-content').value = '';
  byId('post-tags').value = '';
  fieldErr('post-content', '');
  openModal('postModal');
  setTimeout(() => byId('post-content').focus(), 50);
}
function editPost(id) {
  const p = getPosts().find(x => x.id === id); if (!p) return;
  if (!session || p.authorId !== session.id) { showToast('You can only edit your own posts', 'error'); return; }
  byId('post-id').value = id;
  byId('postModalTitle').textContent = 'Edit post';
  byId('post-category').innerHTML = POST_CATS.map(c => `<option value="${c}"${c === p.category ? ' selected' : ''}>${c}</option>`).join('');
  byId('post-content').value = p.body;
  byId('post-tags').value = (p.tags || []).join(', ');
  fieldErr('post-content', '');
  openModal('postModal');
}
function savePost() {
  if (!session) { openAuth('login'); return; }
  const body = byId('post-content').value.trim();
  if (!body) { fieldErr('post-content', 'Write something to share'); return; }
  const chk = checkPostText(body);
  if (chk.blocked) { fieldErr('post-content', chk.reason); return; }
  const cat = byId('post-category').value;
  const tags = byId('post-tags').value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 6);
  const id = byId('post-id').value;
  const posts = getPosts();
  let saved = null;
  if (id) {
    const p = posts.find(x => x.id === id);
    if (p && p.authorId === session.id) { p.body = body; p.category = cat; p.tags = tags; saved = p; }
    setPosts(posts);
    showToast('Post updated', 'success');
  } else {
    saved = { id: newUUID(), authorId: session.id, author: session.name, av: 'grad4', ts: Date.now(), category: cat, tags, body, likedBy: [], comments: [] };
    posts.unshift(saved);
    setPosts(posts);
    logActivity('post', 'Posted in the community');
    awardXP(10, 'post');
    showToast('Posted to the community 🎉', 'success');
  }
  if (saved && typeof backendConfigured === 'function' && backendConfigured() && typeof backendUpsertPost === 'function') backendUpsertPost(saved).catch(() => {});
  closeModal('postModal');
  afterChange();
  renderCommunity();
}
function deletePost(id) {
  const p = getPosts().find(x => x.id === id);
  if (!p || !session) { showToast('You can only delete your own posts', 'error'); return; }
  const mine = p.authorId === session.id;
  if (!mine && !isStaff()) { showToast('You can only delete your own posts', 'error'); return; }
  confirmAction('Delete post?', mine ? 'Your post and its comments will be permanently removed.' : 'Remove this post as a moderator? This cannot be undone.', 'Delete', () => {
    setPosts(getPosts().filter(x => x.id !== id));
    if (!mine) addModLog('delete_post', 'post', id, { author: p.author });
    if (typeof backendConfigured === 'function' && backendConfigured()) {
      if (typeof backendDeletePost === 'function') backendDeletePost(id).catch(() => {});
      if (!mine && typeof backendModLog === 'function') backendModLog('delete_post', 'post', id, { author: p.author }).catch(() => {});
    }
    closeModal('confirmModal');
    showToast('Post deleted', 'info');
    afterChange();
    renderCommunity();
  });
}
function likePost(id) {
  if (!session) { openAuth('login'); return; }
  const posts = getPosts();
  const p = posts.find(x => x.id === id); if (!p) return;
  p.likedBy = p.likedBy || [];
  const i = p.likedBy.indexOf(session.id);
  let liked;
  if (i >= 0) { p.likedBy.splice(i, 1); liked = false; showToast('Like removed', 'info'); }
  else { p.likedBy.push(session.id); liked = true; showToast('Post liked', 'success'); }
  setPosts(posts);
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendToggleLike === 'function') backendToggleLike(id, liked).catch(() => {});
  renderCommunity();
}
function addComment(id) {
  if (!session) { openAuth('login'); return; }
  const inp = byId('cmt-' + id); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  const chk = checkPostText(text);
  if (chk.blocked) { showToast(chk.reason, 'error'); return; }
  const posts = getPosts();
  const p = posts.find(x => x.id === id); if (!p) return;
  p.comments = p.comments || [];
  const c = { id: newUUID(), authorId: session.id, author: session.name, ts: Date.now(), text };
  p.comments.push(c);
  setPosts(posts);
  logActivity('comment', 'Commented on a post');
  awardXP(3, 'comment');
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendAddComment === 'function') backendAddComment(id, c).catch(() => {});
  afterChange();
  renderCommunity();
  const box = byId('comments-' + id); if (box) box.style.display = 'block';
}


function renderCommunityStats() {
  const el = byId('communityStats'); if (!el) return;
  const posts = getPosts().filter(p => !String(p.authorId || '').startsWith('seed:'));
  const mine = posts.filter(p => session && p.authorId === session.id);
  const likes = mine.reduce((a, p) => a + ((p.likedBy || []).length), 0);
  const comments = mine.reduce((a, p) => a + ((p.comments || []).length), 0);
  el.innerHTML = `
    <h3 style="font-weight:700;margin-bottom:0.75rem">📊 Your community stats</h3>
    <div class="grid-3" style="gap:0.5rem;text-align:center">
      <div class="card card-sm"><div style="font-weight:900;font-size:1.25rem">${mine.length}</div><div class="fs-xs text-muted">posts</div></div>
      <div class="card card-sm"><div style="font-weight:900;font-size:1.25rem">${likes}</div><div class="fs-xs text-muted">likes</div></div>
      <div class="card card-sm"><div style="font-weight:900;font-size:1.25rem">${comments}</div><div class="fs-xs text-muted">comments</div></div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════
   PHASE 10 — safeguarding, reporting and moderation
   Client-side filtering is a first line of defence only. Real
   safety relies on the database RLS policies (Phase 3 + Phase 10)
   and human moderators reviewing reports.
   ════════════════════════════════════════════════════════════ */

function isStaff() {
  const r = session && session.role;
  return r === 'owner' || r === 'moderator';
}

/* ---------- safeguarding word / personal-data filter ---------- */
// Deliberately short and not exhaustive. Matching is case-insensitive.
// The block message never reveals which term triggered it.
const BANNED_WORDS = ['fuck', 'shit', 'bitch', 'bastard', 'slut', 'whore', 'retard', 'faggot', 'nigger', 'cunt', 'kys'];
function checkPostText(text) {
  const raw = String(text || '');
  // personal contact details (safeguarding)
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) return { blocked: true, reason: 'Please do not share email addresses. Keep personal contact details private.' };
  if (/(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,}\d/.test(raw)) return { blocked: true, reason: 'Please do not share phone numbers or other personal contact details.' };
  const t = ' ' + raw.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (let i = 0; i < BANNED_WORDS.length; i++) {
    if (t.indexOf(' ' + BANNED_WORDS[i] + ' ') !== -1) return { blocked: true, reason: 'That message looks like it breaks our community rules (be kind, no abuse). Please rephrase and try again.' };
  }
  return { blocked: false };
}

/* ---------- reports (local store + best-effort Supabase) ---------- */
function getReports() { return Store.getJSON(K.reports, []); }
function setReports(r) { Store.setJSON(K.reports, r); }
function openReportCount() { return getReports().filter(r => r.status === 'open').length; }

function reportPost(id) {
  if (!session) { openAuth('login'); return; }
  const p = getPosts().find(x => x.id === id); if (!p) return;
  if (p.authorId === session.id) { showToast('You cannot report your own post', 'info'); return; }
  byId('report-post-id').value = id;
  byId('report-reason').value = 'Spam';
  byId('report-note').value = '';
  openModal('reportModal');
}
function submitReport() {
  const postId = byId('report-post-id').value;
  const reason = byId('report-reason').value;
  const note = byId('report-note').value.trim().slice(0, 500);
  if (!postId) { closeModal('reportModal'); return; }
  const report = { id: newUUID(), postId, reporterId: session.id, reporter: session.name, reason, note, status: 'open', ts: Date.now() };
  setReports(getReports().concat(report));
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendReportPost === 'function') backendReportPost(report).catch(() => {});
  closeModal('reportModal');
  showToast('Thanks for reporting. A moderator will review this.', 'success');
}

/* ---------- moderation log (local + best-effort Supabase) ---------- */
function getModLog() { return Store.getJSON(K.modLog, []); }
function addModLog(action, targetType, targetId, detail) {
  const log = getModLog();
  log.unshift({ id: newUUID(), actorId: session ? session.id : null, actor: session ? session.name : 'system', action, targetType, targetId, detail: detail || {}, ts: Date.now() });
  Store.setJSON(K.modLog, log.slice(0, 500));
}

/* ---------- staff reports view ---------- */
async function openReports() {
  if (!isStaff()) { showToast('Moderator access only', 'error'); return; }
  openModal('reportsModal');
  // try to refresh from backend (best-effort); fall back to local
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendListReports === 'function') {
    try {
      const rows = await backendListReports();
      if (Array.isArray(rows)) {
        const local = getReports();
        rows.forEach(r => {
          if (!local.some(x => x.id === r.id)) local.push({ id: r.id, postId: r.post_id, reporterId: r.reporter_id, reporter: r.reporter_name || 'Student', reason: r.reason, note: r.note, status: r.status || 'open', ts: Date.parse(r.created_at) || Date.now() });
        });
        setReports(local);
      }
    } catch (e) { /* keep local */ }
  }
  renderReports();
}
function renderReports() {
  const el = byId('reportsList'); if (!el) return;
  const open = getReports().filter(r => r.status === 'open').sort((a, b) => b.ts - a.ts);
  if (!open.length) { el.innerHTML = '<p class="fs-sm text-muted">No open reports. Nice and quiet.</p>'; return; }
  const posts = getPosts();
  el.innerHTML = open.map(r => {
    const p = posts.find(x => x.id === r.postId);
    const snippet = p ? esc((p.body || '').slice(0, 160)) : '<span class="text-muted">(post not found on this device)</span>';
    const author = p ? esc(p.author) : 'unknown';
    return `<div class="card card-sm" style="margin-bottom:0.6rem">
      <div class="flex items-center justify-between mb-1"><span class="badge badge-red">${esc(r.reason)}</span><span class="fs-xs text-muted">${relTime(r.ts)}</span></div>
      <div class="fs-xs text-muted mb-1">Reported by ${esc(r.reporter)} · post by ${author}</div>
      <div class="fs-sm" style="white-space:pre-wrap;word-break:break-word;margin-bottom:0.4rem">${snippet}</div>
      ${r.note ? `<div class="fs-xs text-muted" style="margin-bottom:0.5rem">Note: ${esc(r.note)}</div>` : ''}
      <div class="flex gap-sm">
        <button class="btn btn-ghost btn-sm" onclick="resolveReport('${r.id}')">Mark resolved</button>
        ${p ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteReportedPost('${r.postId}','${r.id}')">Delete post</button>` : ''}
      </div>
    </div>`;
  }).join('');
}
function resolveReport(id) {
  const reports = getReports();
  const r = reports.find(x => x.id === id); if (!r) return;
  r.status = 'resolved'; r.resolvedBy = session.id; r.resolvedAt = Date.now();
  setReports(reports);
  addModLog('resolve_report', 'report', id, { postId: r.postId });
  if (typeof backendConfigured === 'function' && backendConfigured()) {
    if (typeof backendResolveReport === 'function') backendResolveReport(id).catch(() => {});
    if (typeof backendModLog === 'function') backendModLog('resolve_report', 'report', id, { postId: r.postId }).catch(() => {});
  }
  showToast('Report resolved', 'success');
  renderReports();
  renderCommunity();
}
function deleteReportedPost(postId, reportId) {
  const p = getPosts().find(x => x.id === postId);
  setPosts(getPosts().filter(x => x.id !== postId));
  const reports = getReports();
  const r = reports.find(x => x.id === reportId);
  if (r) { r.status = 'resolved'; r.resolvedBy = session.id; r.resolvedAt = Date.now(); setReports(reports); }
  addModLog('delete_post', 'post', postId, { via: 'report', author: p ? p.author : null });
  if (typeof backendConfigured === 'function' && backendConfigured()) {
    if (typeof backendDeletePost === 'function') backendDeletePost(postId).catch(() => {});
    if (typeof backendResolveReport === 'function' && reportId) backendResolveReport(reportId).catch(() => {});
    if (typeof backendModLog === 'function') backendModLog('delete_post', 'post', postId, { via: 'report' }).catch(() => {});
  }
  showToast('Post removed and report resolved', 'info');
  renderReports();
  renderCommunity();
}
