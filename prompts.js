/* ════════════════════════════════════════════════════════════
   prompts.js — prompt library, saved prompts (CRUD + favourites),
   generator, improver, and the AI tools directory.
   ════════════════════════════════════════════════════════════ */

const PROMPT_CAT_LABEL = { all: 'All', homework: 'Homework', revision: 'Revision', exam: 'Exam prep', writing: 'Writing', coding: 'Coding', research: 'Research', productivity: 'Productivity', planner: 'Study planner', business: 'AI business' };
let activePromptCat = 'all';

function renderPrompts() {
  renderPromptList();
  renderTrending();
}

function setPromptCat(el, cat) {
  activePromptCat = cat;
  if (el && el.parentElement) {
    [...el.parentElement.children].forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
    el.classList.remove('btn-ghost'); el.classList.add('btn-primary');
  }
  renderPromptList();
}

function isSaved(srcId) { return !!(D && D.savedPrompts.find(p => p.srcId === srcId)); }

function renderPromptList() {
  const wrap = byId('promptList'); if (!wrap) return;
  const items = activePromptCat === 'all' ? PROMPTS : PROMPTS.filter(p => p.cat === activePromptCat);
  wrap.innerHTML = `<div class="fs-xs text-muted" style="grid-column:1/-1;margin-bottom:0.25rem">${items.length} prompts${activePromptCat === 'all' ? ' across all categories' : ' · ' + PROMPT_CAT_LABEL[activePromptCat]}</div>` +
    items.map(p => {
      const saved = isSaved(p.id);
      return `<div class="card" style="display:flex;flex-direction:column;gap:0.6rem">
        <div class="flex items-center justify-between"><span class="badge badge-purple">${PROMPT_CAT_LABEL[p.cat] || p.cat}</span><span class="fs-xs text-muted">Template</span></div>
        <div class="fw-600 fs-sm">${esc(p.title)}</div>
        <div class="prompt-preview" style="font-family:var(--mono);font-size:0.74rem;line-height:1.6;max-height:140px;overflow:auto">${esc(p.text)}</div>
        <div class="flex gap-sm" style="margin-top:auto">
          <button class="btn btn-ghost btn-sm" onclick='copyPromptText(${p.id})'>📋 Copy</button>
          <button class="btn ${saved ? 'btn-ghost' : 'btn-primary'} btn-sm" id="savebtn-${p.id}" onclick="savePromptFromLib(${p.id})">${saved ? '✓ Saved' : '＋ Save'}</button>
        </div>
      </div>`;
    }).join('');
}

function copyPromptText(id) {
  const p = PROMPTS.find(x => x.id === id); if (!p) return;
  copyToClipboard(p.text);
  showToast('Prompt copied to clipboard', 'success');
}
function savePromptFromLib(id) {
  if (!session) { openAuth('login'); return; }
  const p = PROMPTS.find(x => x.id === id); if (!p) return;
  if (isSaved(id)) { showToast('Already in your saved prompts', 'info'); return; }
  D.savedPrompts.unshift({ id: uid(), srcId: id, title: p.title, text: p.text, cat: p.cat, fav: false, ts: Date.now() });
  saveData();
  showToast('Saved to your prompts', 'success');
  const btn = byId('savebtn-' + id);
  if (btn) { btn.textContent = '✓ Saved'; btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); }
  if (currentPage === 'prompts') { const t3 = byId('prompt-tab-3'); if (t3 && t3.classList.contains('active')) renderSavedPrompts(); }
}

/* ---------- generator ---------- */
let lastGenerated = '';
function generatePrompt() {
  const root = byId('prompt-tab-1');
  const sel = root.querySelector('select');
  const ta = root.querySelector('textarea');
  const subject = sel ? sel.value : 'your subject';
  const topic = (ta && ta.value.trim()) || '[your topic]';
  lastGenerated = `You are an expert ${subject} tutor for a GCSE student. Help me understand ${topic}.\n\nPlease:\n- Explain it step by step in simple, clear language\n- Give 2 worked examples\n- Point out the most common mistakes students make\n- Finish with 3 short practice questions and their answers\n\nKeep it concise and check my understanding at the end.`;
  byId('promptOutput').textContent = lastGenerated;
  byId('generatedPrompt').style.display = 'block';
}
function copyPrompt() {
  copyToClipboard(byId('promptOutput').textContent || lastGenerated);
  showToast('Prompt copied to clipboard', 'success');
}

/* ---------- improver ---------- */
function improvePrompt() {
  const input = (byId('improveInput').value || '').trim();
  if (!input) { showToast('Paste a prompt to improve first', 'error'); return; }
  const improved = `You are an expert, encouraging tutor for a GCSE student.\n\nTask: ${input}\n\nWhen answering, please:\n- Assume I'm studying at GCSE level\n- Explain step by step in simple language\n- Include at least one worked example\n- Use bullet points or a short table where it helps\n- Define any key terms\n- End by asking me one question to check I've understood`;
  byId('improvedOutput').textContent = improved;
  byId('improvedResult').style.display = 'block';
}

/* ---------- copy helpers ---------- */
function copyText(id) { const el = byId(id); if (!el) return; copyToClipboard(el.textContent); showToast('Copied to clipboard', 'success'); }
function copyText2(text) { copyToClipboard(text); showToast('Prompt copied to clipboard', 'success'); }

/* ---------- trending removed: no fake usage counts ---------- */
function renderTrending() { /* intentionally empty */ }

/* ---------- saved prompts CRUD ---------- */
function renderSavedPrompts() {
  const wrap = byId('savedPromptsList'); if (!wrap) return;
  if (!session) { wrap.innerHTML = '<div class="empty"><div class="e-icon">🔒</div><h3>Sign in to save prompts</h3><p>Your saved prompts sync to your account.</p><button class="btn btn-primary btn-sm" onclick="openAuth(\'login\')">Sign in</button></div>'; return; }
  const list = D.savedPrompts.slice().sort((a, b) => (b.fav - a.fav) || (b.ts - a.ts));
  if (!list.length) {
    wrap.innerHTML = '<div class="empty"><div class="e-icon">📌</div><h3>No saved prompts yet</h3><p>Browse the Library tab and tap “＋ Save” on any prompt to keep it here.</p><button class="btn btn-primary btn-sm" onclick="switchToLibrary()">Browse library</button></div>';
    return;
  }
  wrap.innerHTML = list.map(p => `
    <div class="card" style="display:flex;flex-direction:column;gap:0.6rem">
      <div class="flex items-center justify-between">
        <span class="badge badge-purple">${PROMPT_CAT_LABEL[p.cat] || p.cat || 'Saved'}</span>
        <button class="fav-star ${p.fav ? 'on' : ''}" title="Favourite" onclick="favPrompt('${p.id}')">${p.fav ? '★' : '☆'}</button>
      </div>
      <div class="fw-600 fs-sm">${esc(p.title)}</div>
      <div class="prompt-preview" style="font-family:var(--mono);font-size:0.74rem;line-height:1.6;max-height:130px;overflow:auto">${esc(p.text)}</div>
      <div class="flex gap-sm" style="margin-top:auto">
        <button class="btn btn-ghost btn-sm" onclick="copyText2(${JSON.stringify(p.text).replace(/"/g, '&quot;')})">📋 Copy</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditPrompt('${p.id}')">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteSavedPrompt('${p.id}')">🗑️</button>
      </div>
    </div>`).join('');
}
function switchToLibrary() {
  const tabs = document.querySelectorAll('#page-prompts .tabs .tab');
  if (tabs[0]) switchTab(tabs[0], 'prompt');
}
function favPrompt(id) {
  const p = D.savedPrompts.find(x => x.id === id); if (!p) return;
  p.fav = !p.fav; saveData(); renderSavedPrompts();
}
function openEditPrompt(id) {
  const p = D.savedPrompts.find(x => x.id === id); if (!p) return;
  byId('pe-id').value = p.id;
  byId('promptEditTitle').textContent = 'Edit prompt';
  byId('pe-title').value = p.title;
  byId('pe-text').value = p.text;
  fieldErr('pe-title', ''); fieldErr('pe-text', '');
  openModal('promptEditModal');
}
function saveEditedPrompt() {
  const id = byId('pe-id').value;
  const title = byId('pe-title').value.trim();
  const text = byId('pe-text').value.trim();
  let bad = false;
  if (!title) { fieldErr('pe-title', 'Add a title'); bad = true; } else fieldErr('pe-title', '');
  if (!text) { fieldErr('pe-text', 'Add the prompt text'); bad = true; } else fieldErr('pe-text', '');
  if (bad) return;
  const p = D.savedPrompts.find(x => x.id === id);
  if (p) { p.title = title; p.text = text; }
  saveData();
  closeModal('promptEditModal');
  showToast('Prompt updated', 'success');
  renderSavedPrompts();
}
function deleteSavedPrompt(id) {
  confirmAction('Delete saved prompt?', 'This prompt will be removed from your saved list.', 'Delete', () => {
    D.savedPrompts = D.savedPrompts.filter(x => x.id !== id);
    saveData();
    closeModal('confirmModal');
    showToast('Prompt deleted', 'info');
    renderSavedPrompts();
    if (currentPage === 'prompts') renderPromptList();
  });
}

/* ════════════════════════════════════════════════════════════
   AI TOOLS DIRECTORY
   ════════════════════════════════════════════════════════════ */
let activeToolFilter = 'all';
function setToolFilter(el, cat) {
  activeToolFilter = cat;
  if (el && el.parentElement) {
    [...el.parentElement.children].forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
    el.classList.remove('btn-ghost'); el.classList.add('btn-primary');
  }
  renderTools();
}
function filterTools() { renderTools(); }
function renderTools() {
  const grid = byId('toolGrid'); if (!grid) return;
  const q = (byId('toolSearch') && byId('toolSearch').value.trim().toLowerCase()) || '';
  let items = tools.slice();
  if (activeToolFilter !== 'all') items = items.filter(t => t.cat === activeToolFilter || (t.tags || []).includes(activeToolFilter));
  if (q) items = items.filter(t => (t.name + ' ' + t.desc + ' ' + (t.tags || []).join(' ')).toLowerCase().includes(q));
  if (!items.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="e-icon">🔍</div><h3>No tools found</h3><p>Try a different search or filter.</p></div>'; return; }
  grid.innerHTML = items.map(t => {
    const fav = D && D.favTools.includes(t.name);
    return `<div class="tool-card">
      <div class="flex items-center justify-between mb-2">
        <div class="tool-logo">${t.logo}</div>
        <button class="fav-star ${fav ? 'on' : ''}" title="Save tool" onclick="favTool(${JSON.stringify(t.name).replace(/"/g, '&quot;')})">${fav ? '★' : '☆'}</button>
      </div>
      <h3 style="font-weight:700;margin-bottom:0.25rem">${esc(t.name)}</h3>
      <p class="fs-sm text-muted" style="line-height:1.6;min-height:42px">${esc(t.desc)}</p>
      <div class="flex items-center justify-between mt-2">
        <span class="fs-xs text-muted">External resource</span>
        <button class="btn btn-primary btn-sm" onclick="visitTool(${JSON.stringify(t.name).replace(/"/g, '&quot;')}, ${JSON.stringify(t.url).replace(/"/g, '&quot;')})">Visit ↗</button>
      </div>
    </div>`;
  }).join('');
}
function visitTool(name, url) {
  const links = (window.STUDYHUB_CONFIG && window.STUDYHUB_CONFIG.affiliateLinks) || {};
  const finalUrl = links[name] || url;
  window.open(finalUrl, '_blank', 'noopener,noreferrer');
}
function favTool(name) {
  if (!session) { openAuth('login'); return; }
  const i = D.favTools.indexOf(name);
  if (i >= 0) D.favTools.splice(i, 1); else D.favTools.push(name);
  saveData(); renderTools();
}
