/* ════════════════════════════════════════════════════════════
   backend.js — Supabase Auth + secure Netlify Function helpers
   Public Supabase URL/anon key belong in config.js. Secret keys stay
   in Netlify environment variables and are only used by functions.
   ════════════════════════════════════════════════════════════ */

let studyhubSupabase = null;

function backendConfigured() {
  const cfg = window.STUDYHUB_CONFIG || {};
  return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
}

function initBackend() {
  if (studyhubSupabase || !backendConfigured()) return studyhubSupabase;
  const cfg = window.STUDYHUB_CONFIG || {};
  studyhubSupabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return studyhubSupabase;
}

async function getAccessToken() {
  const sb = initBackend();
  if (!sb) return '';
  const { data, error } = await sb.auth.getSession();
  if (error || !data || !data.session) return '';
  return data.session.access_token || '';
}

async function authHeaders(extra) {
  const token = await getAccessToken();
  return Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}, extra || {});
}

async function backendFetch(path, options) {
  const headers = await authHeaders((options && options.headers) || {});
  const res = await fetch(path, Object.assign({}, options || {}, { headers }));
  let data = null, text = '';
  try { text = await res.text(); data = text ? JSON.parse(text) : null; } catch (e) { data = text ? { error: text } : null; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || ('Request failed: HTTP ' + res.status);
    const err = new Error(msg); err.status = res.status; err.body = data; throw err;
  }
  return data;
}

async function backendGetAccount() {
  if (!backendConfigured()) return null;
  const data = await backendFetch('/.netlify/functions/get-account', { method: 'GET' });
  applyBackendAccount(data);
  return data;
}

function applyBackendAccount(data) {
  if (!data || !D) return;
  D.plan = normalisePlan(data.plan || 'free');
  D.subscription = Object.assign({}, D.subscription || {}, data.subscription || {}, {
    plan: D.plan,
    source: 'supabase-stripe',
    updatedAt: Date.now()
  });
  if (data.profile && typeof data.profile === 'object') {
    D.profile = Object.assign({}, D.profile || {}, data.profile);
  }
  saveData();
  if (typeof applyAuthUI === 'function') applyAuthUI();
}

async function backendSyncProfile() {
  if (!backendConfigured() || !session || !D) return null;
  const data = await backendFetch('/.netlify/functions/sync-profile', {
    method: 'POST',
    body: JSON.stringify({ name: session.name, profile: D.profile || {} })
  });
  applyBackendAccount(data);
  return data;
}

async function backendStartCheckout(plan) {
  return backendFetch('/.netlify/functions/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ plan })
  });
}

async function backendOpenBillingPortal() {
  return backendFetch('/.netlify/functions/create-billing-portal-session', { method: 'POST', body: '{}' });
}

async function backendUpdateDisplayName(name) {
  const sb = initBackend();
  if (sb && name) await sb.auth.updateUser({ data: { full_name: name } });
  return backendSyncProfile();
}

async function backendChangePassword(newPassword) {
  const sb = initBackend();
  if (!sb) throw new Error('Online account backend is not configured.');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message || 'Could not update password.');
  return true;
}

async function backendDeleteAccount() {
  if (!backendConfigured()) return false;
  await backendFetch('/.netlify/functions/delete-account', { method: 'POST', body: '{}' });
  try { await initBackend().auth.signOut(); } catch (e) {}
  return true;
}

/* ════════════════════════════════════════════════════════════
   Phase 6 — planner persistence (best-effort, RLS-protected).
   Uses the Supabase client directly; every write is scoped to the
   signed-in user, and RLS enforces user_id = auth.uid().
   ════════════════════════════════════════════════════════════ */
function plannerClient() {
  return (typeof backendConfigured === 'function' && backendConfigured()) ? initBackend() : null;
}

async function backendSavePlannerOnboarding(data) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('planner_onboarding').upsert(
    { user_id: session.id, data: data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

async function backendSyncPlannerTasks(weekStart, tasks) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('planner_tasks').delete().eq('user_id', session.id).eq('week_start', weekStart);
  if (tasks && tasks.length) {
    await sb.from('planner_tasks').insert(tasks.map(t => ({
      id: t.id, user_id: session.id, week_start: t.weekStart, title: t.title, subject: t.subject,
      due_date: t.dueDate || null, task_type: t.type || 'revision', status: t.status || 'todo',
      evidence_required: !!t.evidenceRequired
    })));
  }
}

async function backendAddEvidence(ev, task) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('task_evidence').insert({
    id: ev.id, task_id: ev.taskId, user_id: session.id, kind: ev.kind,
    detail: ev.detail || {}, confirmed: ev.kind === 'self'
  });
  await sb.from('planner_tasks').update({ status: 'done' }).eq('id', task.id).eq('user_id', session.id);
}

async function backendClearEvidence(taskId, task) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('task_evidence').delete().eq('task_id', taskId).eq('user_id', session.id);
  await sb.from('planner_tasks').update({ status: 'todo' }).eq('id', taskId).eq('user_id', session.id);
}

async function loadPlannerFromBackend() {
  const sb = plannerClient(); if (!sb || !session || !D) return;
  try {
    const ob = await sb.from('planner_onboarding').select('data').eq('user_id', session.id).maybeSingle();
    if (ob && ob.data && ob.data.data) D.plannerOnboarding = ob.data.data;
    const tk = await sb.from('planner_tasks').select('*').eq('user_id', session.id);
    if (tk && Array.isArray(tk.data)) {
      D.plannerTasks = tk.data.map(r => ({
        id: r.id, weekStart: r.week_start, title: r.title, subject: r.subject, dueDate: r.due_date,
        type: r.task_type, status: r.status, evidenceRequired: r.evidence_required, createdAt: Date.parse(r.created_at) || Date.now()
      }));
    }
    const evq = await sb.from('task_evidence').select('*').eq('user_id', session.id);
    if (evq && Array.isArray(evq.data)) {
      D.taskEvidence = evq.data.map(r => ({ id: r.id, taskId: r.task_id, kind: r.kind, detail: r.detail || {}, createdAt: Date.parse(r.created_at) || Date.now() }));
    }
    if (typeof saveData === 'function') saveData();
  } catch (e) { console.warn('planner load failed', e); }
}

/* ════════════════════════════════════════════════════════════
   Phase 7 — revision persistence (notes, flashcards, quizzes) and
   Pro note uploads via Supabase Storage. Best-effort, RLS-protected.
   ════════════════════════════════════════════════════════════ */
function tsToIso(ms) { return ms ? new Date(ms).toISOString() : null; }

async function backendSyncNote(n) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('notes').upsert({ id: n.id, user_id: session.id, subject: n.subject || null, title: n.title || '', body: n.body || '' }, { onConflict: 'id' });
}
async function backendDeleteNote(id) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('notes').delete().eq('id', id).eq('user_id', session.id);
}
async function backendSyncFlashcard(c) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('flashcards').upsert({
    id: c.id, user_id: session.id, subject: c.subject || null, front: c.front || '', back: c.back || '',
    confidence: c.box || 0, last_reviewed: tsToIso(c.lastReviewed), next_review: tsToIso(c.nextReview),
    correct_count: c.correctCount || 0, incorrect_count: c.incorrectCount || 0
  }, { onConflict: 'id' });
}
async function backendDeleteFlashcard(id) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('flashcards').delete().eq('id', id).eq('user_id', session.id);
}
async function backendInsertQuizAttempt(a) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('quiz_attempts').insert({ id: a.id, user_id: session.id, subject: a.subject || null, topic: a.topic || null, score: a.score, total: a.total, percent: a.percent, details: a.details || {} });
}
async function loadRevisionFromBackend() {
  const sb = plannerClient(); if (!sb || !session || !D) return;
  try {
    const nq = await sb.from('notes').select('*').eq('user_id', session.id);
    if (nq && Array.isArray(nq.data) && nq.data.length) {
      D.notes = nq.data.map(r => ({ id: r.id, subject: r.subject, title: r.title, body: r.body, ts: Date.parse(r.created_at) || Date.now() }));
    }
    const fq = await sb.from('flashcards').select('*').eq('user_id', session.id);
    if (fq && Array.isArray(fq.data) && fq.data.length) {
      D.flashcards = fq.data.map(r => ({
        id: r.id, subject: r.subject, front: r.front, back: r.back, box: r.confidence || 0,
        nextReview: Date.parse(r.next_review) || 0, lastReviewed: Date.parse(r.last_reviewed) || 0,
        correctCount: r.correct_count || 0, incorrectCount: r.incorrect_count || 0,
        reviews: (r.correct_count || 0) + (r.incorrect_count || 0)
      }));
    }
    if (typeof saveData === 'function') saveData();
  } catch (e) { console.warn('revision load failed', e); }
}

// Pro note uploads. Requires a Supabase Storage bucket named "notes" (see PHASE7 doc).
async function backendUploadNote(file) {
  const sb = plannerClient(); if (!sb || !session) throw new Error('Not signed in');
  const safe = (file.name || 'note').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = session.id + '/' + newUUID() + '_' + safe;
  const up = await sb.storage.from('notes').upload(path, file, { upsert: false });
  if (up && up.error) throw new Error(up.error.message || 'Upload failed');
  await sb.from('uploaded_notes').insert({ id: newUUID(), user_id: session.id, title: file.name || 'Note', storage_path: path });
  return true;
}
async function backendListUploadedNotes() {
  const sb = plannerClient(); if (!sb || !session) return [];
  const q = await sb.from('uploaded_notes').select('*').eq('user_id', session.id).order('created_at', { ascending: false });
  return (q && q.data) || [];
}
async function backendDeleteUploadedNote(id, path) {
  const sb = plannerClient(); if (!sb || !session) return;
  if (path) await sb.storage.from('notes').remove([path]);
  await sb.from('uploaded_notes').delete().eq('id', id).eq('user_id', session.id);
}
async function backendSignedNoteUrl(path) {
  const sb = plannerClient(); if (!sb || !path) return '';
  const q = await sb.storage.from('notes').createSignedUrl(path, 120);
  return (q && q.data && q.data.signedUrl) || '';
}

/* ════════════════════════════════════════════════════════════
   Phase 10 — community persistence, role, reporting, moderation.
   All best-effort and RLS-protected (Phase 3 + Phase 10 SQL).
   ════════════════════════════════════════════════════════════ */
async function backendGetMyRole() {
  const sb = plannerClient(); if (!sb || !session) return 'student';
  try {
    const q = await sb.from('user_roles').select('role').eq('user_id', session.id).maybeSingle();
    return (q && q.data && q.data.role) || 'student';
  } catch (e) { return 'student'; }
}
async function backendUpsertPost(p) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('posts').upsert({ id: p.id, user_id: session.id, author_name: p.author || '', category: p.category || null, body: p.body || '', tags: p.tags || [] }, { onConflict: 'id' });
}
async function backendDeletePost(id) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('posts').delete().eq('id', id); // RLS allows author, moderator or owner
}
async function backendToggleLike(postId, liked) {
  const sb = plannerClient(); if (!sb || !session) return;
  if (liked) await sb.from('post_likes').upsert({ post_id: postId, user_id: session.id }, { onConflict: 'post_id,user_id' });
  else await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', session.id);
}
async function backendAddComment(postId, c) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('post_comments').insert({ id: c.id, post_id: postId, user_id: session.id, author_name: c.author || '', body: c.text || '' });
}
async function backendReportPost(r) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('post_reports').insert({ id: r.id, post_id: r.postId, reporter_id: session.id, reason: r.reason || 'Other', note: r.note || null });
}
async function backendListReports() {
  const sb = plannerClient(); if (!sb || !session) return [];
  const q = await sb.from('post_reports').select('*').eq('status', 'open').order('created_at', { ascending: false });
  return (q && q.data) || [];
}
async function backendResolveReport(id) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('post_reports').update({ status: 'resolved', resolved_by: session.id, resolved_at: new Date().toISOString() }).eq('id', id);
}
async function backendModLog(action, targetType, targetId, detail) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('moderation_log').insert({ id: newUUID(), actor_id: session.id, action: action, target_type: targetType, target_id: targetId || null, detail: detail || {} });
}
// Load the shared community feed from Supabase and merge it into the local
// store (remote authoritative, local-only posts preserved). Not realtime:
// it refreshes on login and when the community page is opened.
async function loadCommunityFromBackend() {
  const sb = plannerClient(); if (!sb || !session) return;
  try {
    const pq = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100);
    if (!pq || !Array.isArray(pq.data)) return;
    const ids = pq.data.map(r => r.id);
    let likes = [], comments = [];
    if (ids.length) {
      const lq = await sb.from('post_likes').select('post_id,user_id').in('post_id', ids);
      likes = (lq && lq.data) || [];
      const cq = await sb.from('post_comments').select('*').in('post_id', ids).order('created_at', { ascending: true });
      comments = (cq && cq.data) || [];
    }
    const mapped = pq.data.map(r => ({
      id: r.id, authorId: r.user_id, author: r.author_name || 'Student', av: 'grad4',
      ts: Date.parse(r.created_at) || Date.now(), category: r.category || 'Discussion', tags: r.tags || [],
      likedBy: likes.filter(l => l.post_id === r.id).map(l => l.user_id),
      comments: comments.filter(c => c.post_id === r.id).map(c => ({ id: c.id, authorId: c.user_id, author: c.author_name || 'Student', ts: Date.parse(c.created_at) || Date.now(), text: c.body })),
      body: r.body || ''
    }));
    // merge: remote authoritative, keep any local-only posts (e.g. created offline)
    const remoteIds = new Set(mapped.map(p => p.id));
    const localOnly = (typeof getPosts === 'function' ? getPosts() : []).filter(p => !remoteIds.has(p.id));
    if (typeof setPosts === 'function') setPosts(mapped.concat(localOnly));
  } catch (e) { console.warn('community load failed', e); }
}

/* ════════════════════════════════════════════════════════════
   Phase 11 — weekly reports + parent/child family links.
   Best-effort and protected by the Phase 3 RLS (approved-parent).
   ════════════════════════════════════════════════════════════ */
async function backendSaveWeeklyReport(r) {
  const sb = plannerClient(); if (!sb || !session || !r) return;
  await sb.from('weekly_reports').upsert({ user_id: session.id, week_start: r.weekStart, data: r }, { onConflict: 'user_id,week_start' });
}
async function backendListFamilyLinks() {
  const sb = plannerClient(); if (!sb || !session) return [];
  const q = await sb.from('parent_child_links').select('*').or('parent_id.eq.' + session.id + ',child_id.eq.' + session.id);
  const links = (q && q.data) || [];
  // best-effort: enrich approved children with their profile name (allowed by RLS once approved)
  const childIds = links.filter(l => l.parent_id === session.id && l.status === 'approved').map(l => l.child_id);
  if (childIds.length) {
    try {
      const pq = await sb.from('profiles').select('id,full_name,email').in('id', childIds);
      const names = {}; ((pq && pq.data) || []).forEach(p => { names[p.id] = p.full_name || p.email; });
      links.forEach(l => { if (names[l.child_id]) l.child_name = names[l.child_id]; });
    } catch (e) { /* names are optional */ }
  }
  return links;
}
async function backendRequestChildLink(childId) {
  const sb = plannerClient(); if (!sb || !session) throw new Error('Not signed in');
  const res = await sb.from('parent_child_links').insert({ parent_id: session.id, child_id: childId, status: 'pending' });
  if (res && res.error) throw new Error(res.error.message || 'Request failed');
  return true;
}
async function backendRespondLink(id, approve) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('parent_child_links').update({ status: approve ? 'approved' : 'revoked' }).eq('id', id).eq('child_id', session.id);
}
async function backendRevokeLink(id) {
  const sb = plannerClient(); if (!sb || !session) return;
  await sb.from('parent_child_links').delete().eq('id', id);
}
async function backendGetChildReport(childId) {
  const sb = plannerClient(); if (!sb || !session) return null;
  const q = await sb.from('weekly_reports').select('data,week_start').eq('user_id', childId).order('week_start', { ascending: false }).limit(1).maybeSingle();
  return (q && q.data && q.data.data) || null;
}

/* ════════════════════════════════════════════════════════════
   Phase 12 — owner admin and content management. Owner-only via
   the Phase 3 RLS (is_owner). Best-effort.
   ════════════════════════════════════════════════════════════ */
async function backendAdminStats() {
  const sb = plannerClient(); if (!sb || !session) return { users: 0, posts: 0, reports: 0 };
  let users = 0, posts = 0, reports = 0;
  try { const u = await sb.from('profiles').select('id', { count: 'exact', head: true }); users = (u && u.count) || 0; } catch (e) {}
  try { const p = await sb.from('posts').select('id', { count: 'exact', head: true }); posts = (p && p.count) || 0; } catch (e) {}
  try { const r = await sb.from('post_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'); reports = (r && r.count) || 0; } catch (e) {}
  return { users, posts, reports };
}
async function backendListUsers() {
  const sb = plannerClient(); if (!sb || !session) return [];
  const pq = await sb.from('profiles').select('id,email,full_name,plan').limit(500);
  const rq = await sb.from('user_roles').select('user_id,role').limit(500);
  const roles = {}; (((rq && rq.data) || [])).forEach(r => { roles[r.user_id] = r.role; });
  return (((pq && pq.data) || [])).map(p => ({ id: p.id, email: p.email, name: p.full_name, plan: p.plan || 'free', role: roles[p.id] || 'student' }));
}
async function backendSetUserRole(userId, role) {
  const sb = plannerClient(); if (!sb || !session) throw new Error('Not signed in');
  const res = await sb.from('user_roles').upsert({ user_id: userId, role: role }, { onConflict: 'user_id' });
  if (res && res.error) throw new Error(res.error.message || 'Role update failed');
  return true;
}
async function backendListRecentPosts() {
  const sb = plannerClient(); if (!sb || !session) return [];
  const q = await sb.from('posts').select('id,author_name,body,created_at').order('created_at', { ascending: false }).limit(20);
  return (q && q.data) || [];
}
async function backendListModLog() {
  const sb = plannerClient(); if (!sb || !session) return [];
  const q = await sb.from('moderation_log').select('*').order('created_at', { ascending: false }).limit(30);
  return (q && q.data) || [];
}
