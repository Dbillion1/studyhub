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

  if (!posts.length) {
    wrap.innerHTML = '<div class="empty"><div class="e-icon">💬</div><h3>No posts here yet</h3><p>Be the first to share something with the community.</p><button class="btn btn-primary btn-sm" onclick="openPostModal()">+ New Post</button></div>';
    renderCommunityStats();
    if (typeof renderPlanStatus === 'function') renderPlanStatus('communityPlanStatus');
    return;
  }
  wrap.innerHTML = posts.map(p => postHtml(p)).join('');
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
      ${mine ? `<span style="margin-left:auto" class="row-actions"><button class="icon-btn" title="Edit" onclick="editPost('${p.id}')">✏️</button><button class="icon-btn danger" title="Delete" onclick="deletePost('${p.id}')">🗑️</button></span>` : ''}
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
  const cat = byId('post-category').value;
  const tags = byId('post-tags').value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 6);
  const id = byId('post-id').value;
  const posts = getPosts();
  if (id) {
    const p = posts.find(x => x.id === id);
    if (p && p.authorId === session.id) { p.body = body; p.category = cat; p.tags = tags; }
    setPosts(posts);
    showToast('Post updated', 'success');
  } else {
    posts.unshift({ id: uid(), authorId: session.id, author: session.name, av: 'grad4', ts: Date.now(), category: cat, tags, body, likedBy: [], comments: [] });
    setPosts(posts);
    logActivity('post', 'Posted in the community');
    awardXP(10, 'post');
    showToast('Posted to the community 🎉', 'success');
  }
  closeModal('postModal');
  afterChange();
  renderCommunity();
}
function deletePost(id) {
  const p = getPosts().find(x => x.id === id);
  if (!p || !session || p.authorId !== session.id) { showToast('You can only delete your own posts', 'error'); return; }
  confirmAction('Delete post?', 'Your post and its comments will be permanently removed.', 'Delete', () => {
    setPosts(getPosts().filter(x => x.id !== id));
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
  if (i >= 0) { p.likedBy.splice(i, 1); showToast('Like removed', 'info'); }
  else { p.likedBy.push(session.id); showToast('Post liked', 'success'); }
  setPosts(posts);
  renderCommunity();
}
function addComment(id) {
  if (!session) { openAuth('login'); return; }
  const inp = byId('cmt-' + id); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  const posts = getPosts();
  const p = posts.find(x => x.id === id); if (!p) return;
  p.comments = p.comments || [];
  p.comments.push({ id: uid(), authorId: session.id, author: session.name, ts: Date.now(), text });
  setPosts(posts);
  logActivity('comment', 'Commented on a post');
  awardXP(3, 'comment');
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
