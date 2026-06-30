/* ════════════════════════════════════════════════════════════
   revision.js — subject browser, flashcards (CRUD), quizzes, notes
   ════════════════════════════════════════════════════════════ */

function fillSubjectSelect(id, selected) {
  const el = byId(id); if (!el) return;
  el.innerHTML = SUBJECT_KEYS.map(k => `<option value="${k}"${k === selected ? ' selected' : ''}>${SUBJECTS[k].title}</option>`).join('');
}

function renderRevision() {
  // subject catalogue with real progress
  const grid = document.querySelector('#rev-tab-0 .subject-grid');
  if (grid) {
    const grads = { maths: 'var(--grad1)', english: 'var(--grad2)', science: 'var(--grad3)', geography: 'var(--grad4)', history: 'var(--grad1)', cs: 'var(--grad2)', french: 'var(--grad3)', german: 'var(--grad4)' };
    grid.innerHTML = SUBJECT_KEYS.map(k => {
      const st = (D.subjectStats || {})[k];
      const pct = st && st.total ? Math.round((st.correct / st.total) * 100) : 0;
      const cards = D.flashcards.filter(c => c.subject === k).length;
      return `<div class="subject-card" onclick="openSubject('${k}')">
        <span class="subj-icon">${SUBJECTS[k].icon}</span>
        <h3>${SUBJECTS[k].title}</h3>
        <p>${cards} card${cards === 1 ? '' : 's'} · ${SUBJECTS[k].topics.length} topics</p>
        <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${grads[k]}"></div></div>
        <div class="fs-xs text-muted mt-1">${pct}% quiz mastery</div>
      </div>`;
    }).join('');
  }
  if (typeof migrateRevisionIds === 'function') migrateRevisionIds();
  renderFlashDeck();
  renderQuizPanel();
  renderNotes();
  if (typeof renderUploadedNotes === 'function') renderUploadedNotes();
  if (typeof renderDiagnosticStart === 'function') renderDiagnosticStart();
}

/* ---------- subject detail ---------- */
let currentSubjectKey = 'maths';
let subjCards = [];
let currentFlash = 0;

function openSubject(key) {
  if (!SUBJECTS[key]) return;
  currentSubjectKey = key;
  byId('subject-title').textContent = SUBJECTS[key].icon + ' ' + SUBJECTS[key].title;
  if (typeof renderSubjectContent === 'function') renderSubjectContent(key);
  byId('topicList').innerHTML = SUBJECTS[key].topics.map(t => `
    <div class="card card-sm card-hover" onclick="openFlashModal('${key}', ${JSON.stringify(t).replace(/"/g, '&quot;')})">
      <div class="flex items-center gap-md"><span>📌</span><span class="fs-sm fw-500 flex-1">${esc(t)}</span><span class="badge badge-purple">+ Card</span></div>
    </div>`).join('');
  subjCards = D.flashcards.filter(c => c.subject === key);
  currentFlash = 0;
  loadFlash();
  initQuiz();
  byId('subject-detail').style.display = 'block';
  byId('subject-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function loadFlash() {
  const front = byId('flashFront'), back = byId('flashBack'), card = byId('flashcard');
  if (card) card.classList.remove('flipped');
  if (!subjCards.length) {
    if (front) front.textContent = 'No flashcards in ' + SUBJECTS[currentSubjectKey].title + ' yet';
    if (back) back.textContent = 'Use “+ New card” in the Flashcards tab to add one.';
    return;
  }
  const f = subjCards[currentFlash % subjCards.length];
  if (front) front.textContent = f.front;
  if (back) back.textContent = f.back;
}
function prevFlash() { if (!subjCards.length) return; currentFlash = (currentFlash - 1 + subjCards.length) % subjCards.length; loadFlash(); }
function nextFlash() {
  if (!subjCards.length) return;
  const f = subjCards[currentFlash % subjCards.length];
  if (f) recordFlashReview(f.id);
  currentFlash = (currentFlash + 1) % subjCards.length;
  loadFlash();
}

/* ---------- subject-detail mini quiz ---------- */
let miniQuizIdx = 0;
function initQuiz() { miniQuizIdx = 0; loadQuiz(); }
function loadQuiz() {
  const bank = QUIZ_BANK[currentSubjectKey] || QUIZ_BANK.maths;
  const q = bank[miniQuizIdx % bank.length];
  byId('quizQuestion').textContent = q.q;
  byId('quizOptions').innerHTML = q.opts.map((o, i) => `<div class="quiz-opt" onclick="answerQuiz(this,${i},${q.ans})" data-idx="${i}"><div class="opt-letter">${'ABCD'[i]}</div>${esc(o)}</div>`).join('');
  const fb = byId('quizFeedback'); fb.style.display = 'none'; fb.className = '';
}
function answerQuiz(el, idx, ans) {
  document.querySelectorAll('#quizOptions .quiz-opt').forEach(o => {
    o.style.pointerEvents = 'none';
    if (+o.dataset.idx === ans) o.classList.add('correct');
    else if (o === el && idx !== ans) o.classList.add('wrong');
  });
  const correct = idx === ans;
  recordQuizAnswer(currentSubjectKey, correct);
  if (correct) awardXP(10, 'quiz-correct');
  const fb = byId('quizFeedback');
  fb.style.display = 'block';
  fb.className = 'fb ' + (correct ? 'fb-correct' : 'fb-wrong');
  fb.textContent = correct ? '✅ Correct! +10 XP' : '❌ Not quite — the right answer is highlighted.';
  afterChange();
}
function nextQuiz() { const bank = QUIZ_BANK[currentSubjectKey] || QUIZ_BANK.maths; miniQuizIdx = (miniQuizIdx + 1) % bank.length; loadQuiz(); }

/* ---------- flashcards CRUD ---------- */
let flashFilter = 'all';
function setFlashFilter(k) { flashFilter = k; renderFlashDeck(); }
function renderFlashDeck() {
  const wrap = byId('flashDeck'); if (!wrap) return;
  const cards = D.flashcards;
  byId('flashCount').textContent = cards.length + ' card' + (cards.length === 1 ? '' : 's');
  const dueN = (typeof dueCards === 'function') ? dueCards().length : 0;
  const bar = byId('flashReviewBar');
  if (bar) bar.innerHTML = dueN
    ? '<button class="btn btn-primary btn-sm" onclick="startReview()">🔁 Review ' + dueN + ' due card' + (dueN === 1 ? '' : 's') + '</button>'
    : (cards.length ? '<span class="fs-xs text-muted">All caught up - no cards due for review.</span>' : '');

  // filter chips: All + subjects that have cards
  const present = SUBJECT_KEYS.filter(k => cards.some(c => c.subject === k));
  byId('flashFilters').innerHTML =
    `<span class="chip ${flashFilter === 'all' ? 'active' : ''}" onclick="setFlashFilter('all')">All</span>` +
    present.map(k => `<span class="chip ${flashFilter === k ? 'active' : ''}" onclick="setFlashFilter('${k}')">${SUBJECTS[k].icon} ${SUBJECTS[k].title}</span>`).join('');

  const shown = flashFilter === 'all' ? cards : cards.filter(c => c.subject === flashFilter);
  if (!shown.length) {
    wrap.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="e-icon">🃏</div><h3>${cards.length ? 'No cards in this subject' : 'No flashcards yet'}</h3><p>${cards.length ? 'Pick another subject or add a card here.' : 'Create your first flashcard and it\'ll be saved to your account.'}</p><button class="btn btn-primary btn-sm" onclick="openFlashModal('${flashFilter === 'all' ? '' : flashFilter}')">+ New card</button></div>`;
    return;
  }
  wrap.innerHTML = shown.map(c => `
    <div class="card" style="display:flex;flex-direction:column;gap:0.6rem">
      <div class="flex items-center justify-between"><span class="badge badge-purple">${SUBJECTS[c.subject] ? SUBJECTS[c.subject].title : c.subject}</span>
        <div class="row-actions"><button class="icon-btn" title="Edit" onclick="editFlash('${c.id}')">✏️</button><button class="icon-btn danger" title="Delete" onclick="deleteFlash('${c.id}')">🗑️</button></div>
      </div>
      <div class="flashcard-wrap" onclick="this.querySelector('.flashcard').classList.toggle('flipped')">
        <div class="flashcard" style="min-height:150px">
          <div class="flashcard-face flashcard-front" style="font-size:0.95rem;padding:1.25rem"><div><div class="fs-xs text-muted mb-1">Tap to flip</div>${esc(c.front)}</div></div>
          <div class="flashcard-face flashcard-back" style="font-size:0.9rem;padding:1.25rem"><div>${esc(c.back)}</div></div>
        </div>
      </div>
    </div>`).join('');
}
function openFlashModal(subject, prefillFront) {
  if (!session) { openAuth('login'); return; }
  fillSubjectSelect('flash-subject', subject || currentSubjectKey || 'maths');
  byId('flash-id').value = '';
  byId('flashModalTitle').textContent = 'New flashcard';
  byId('flash-front').value = prefillFront || '';
  byId('flash-back').value = '';
  fieldErr('flash-front', ''); fieldErr('flash-back', '');
  openModal('flashModal');
  setTimeout(() => byId('flash-front').focus(), 50);
}
function editFlash(id) {
  const c = D.flashcards.find(x => x.id === id); if (!c) return;
  fillSubjectSelect('flash-subject', c.subject);
  byId('flash-id').value = c.id;
  byId('flashModalTitle').textContent = 'Edit flashcard';
  byId('flash-front').value = c.front;
  byId('flash-back').value = c.back;
  fieldErr('flash-front', ''); fieldErr('flash-back', '');
  openModal('flashModal');
}
function saveFlashcard() {
  const front = byId('flash-front').value.trim();
  const back = byId('flash-back').value.trim();
  let bad = false;
  if (!front) { fieldErr('flash-front', 'Add a question or term'); bad = true; } else fieldErr('flash-front', '');
  if (!back) { fieldErr('flash-back', 'Add an answer'); bad = true; } else fieldErr('flash-back', '');
  if (bad) return;
  const id = byId('flash-id').value;
  const subject = byId('flash-subject').value;
  if (id) {
    const c = D.flashcards.find(x => x.id === id);
    if (c) { c.subject = subject; c.front = front; c.back = back; }
    showToast('Flashcard updated', 'success');
  } else {
    D.flashcards.unshift({ id: newUUID(), subject, front, back, reviews: 0, box: 0, nextReview: 0, lastReviewed: 0, correctCount: 0, incorrectCount: 0 });
    logActivity('flashcard', 'Created a flashcard · ' + SUBJECTS[subject].title);
    awardXP(2, 'create-card');
    showToast('Flashcard saved', 'success');
  }
  if (typeof syncCardToBackend === 'function') syncCardToBackend(id || (D.flashcards[0] && D.flashcards[0].id));
  closeModal('flashModal');
  if (byId('subject-detail').style.display === 'block') { subjCards = D.flashcards.filter(c => c.subject === currentSubjectKey); loadFlash(); }
  afterChange();
  renderFlashDeck();
  if (currentPage === 'revision') { const g = document.querySelector('#rev-tab-0 .subject-grid'); if (g) renderRevision(); }
}
function deleteFlash(id) {
  confirmAction('Delete flashcard?', 'This card will be permanently removed.', 'Delete', () => {
    D.flashcards = D.flashcards.filter(x => x.id !== id);
    if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendDeleteFlashcard === 'function') backendDeleteFlashcard(id).catch(() => {});
    closeModal('confirmModal');
    showToast('Flashcard deleted', 'info');
    if (byId('subject-detail').style.display === 'block') { subjCards = D.flashcards.filter(c => c.subject === currentSubjectKey); currentFlash = 0; loadFlash(); }
    afterChange();
    renderFlashDeck();
  });
}

/* ---------- full quiz runner ---------- */
let qr = null;
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function renderQuizPanel() {
  const el = byId('quizPanel'); if (!el) return;
  if (!qr) {
    el.innerHTML = `
      <div class="card">
        <h3 style="font-weight:700;margin-bottom:0.25rem">Test yourself</h3>
        <p class="fs-sm text-muted mb-3">Pick a subject for a quick 5-question quiz. Correct answers earn XP and feed your dashboard.</p>
        <div class="field"><label for="qrSubject">Subject</label><select class="select" id="qrSubject">${SUBJECT_KEYS.map(k => `<option value="${k}">${SUBJECTS[k].title}</option>`).join('')}</select></div>
        <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="startQuiz()">Start quiz →</button>
      </div>`;
    return;
  }
  const q = qr.qs[qr.idx];
  const pct = Math.round(((qr.idx) / qr.qs.length) * 100);
  el.innerHTML = `
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <div><h3 style="font-weight:700">${SUBJECTS[qr.key].title} quiz</h3><p class="fs-xs text-muted">Question ${qr.idx + 1} of ${qr.qs.length}</p></div>
        <div class="badge badge-green">Score: ${qr.correct}/${qr.idx + (qr.answered ? 1 : 0)}</div>
      </div>
      <div class="progress" style="margin-bottom:1.25rem"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
      <h4 style="font-weight:600;margin-bottom:1rem;font-size:1rem">${esc(q.q)}</h4>
      <div class="quiz-options" id="qrOptions">
        ${q.opts.map((o, i) => `<div class="quiz-opt" data-idx="${i}" onclick="qrAnswer(${i})"><div class="opt-letter">${'ABCD'[i]}</div>${esc(o)}</div>`).join('')}
      </div>
      <div id="qrFeedback" style="display:none" class="mb-2"></div>
      <button class="btn btn-primary" id="qrNext" style="width:100%;justify-content:center;display:none" onclick="qrAdvance()">Next →</button>
    </div>`;
}
function startQuiz() {
  const sel = byId('qrSubject');
  const key = (sel && sel.value && QUIZ_BANK[sel.value]) ? sel.value : 'maths';
  qr = { key, qs: shuffle(QUIZ_BANK[key]), idx: 0, correct: 0, answered: false };
  renderQuizPanel();
}
function qrAnswer(idx) {
  if (qr.answered) return;
  const q = qr.qs[qr.idx];
  qr.answered = true;
  const correct = idx === q.ans;
  if (correct) { qr.correct++; awardXP(10, 'quiz'); }
  recordQuizAnswer(qr.key, correct);
  document.querySelectorAll('#qrOptions .quiz-opt').forEach(o => {
    o.style.pointerEvents = 'none';
    if (+o.dataset.idx === q.ans) o.classList.add('correct');
    else if (+o.dataset.idx === idx) o.classList.add('wrong');
  });
  const fb = byId('qrFeedback');
  fb.style.display = 'block';
  fb.className = 'fb ' + (correct ? 'fb-correct' : 'fb-wrong') + ' mb-2';
  fb.textContent = correct ? '✅ Correct! +10 XP' : '❌ The correct answer is ' + 'ABCD'[q.ans] + '.';
  byId('qrNext').style.display = 'inline-flex';
  byId('qrNext').textContent = qr.idx + 1 >= qr.qs.length ? 'See results →' : 'Next →';
  saveData();
}
function qrAdvance() {
  if (qr.idx + 1 >= qr.qs.length) { qrFinish(); return; }
  qr.idx++; qr.answered = false;
  renderQuizPanel();
}
function qrFinish() {
  const pct = Math.round((qr.correct / qr.qs.length) * 100);
  recordQuizComplete(pct);
  const key = qr.key, total = qr.qs.length, correct = qr.correct;
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendInsertQuizAttempt === 'function') backendInsertQuizAttempt({ id: newUUID(), subject: key, topic: '', score: correct, total: total, percent: pct }).catch(() => {});
  qr = null;
  const el = byId('quizPanel');
  el.innerHTML = `
    <div class="card center" style="padding:2.5rem">
      <div style="font-size:3rem;margin-bottom:0.5rem">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}</div>
      <h3 style="font-weight:800;font-size:1.3rem;margin-bottom:0.25rem">${pct}%</h3>
      <p class="text-muted mb-3">You got ${correct} of ${total} right on ${SUBJECTS[key].title}.</p>
      <div class="flex gap-sm" style="justify-content:center">
        <button class="btn btn-ghost btn-sm" onclick="renderQuizPanel()">Choose subject</button>
        <button class="btn btn-primary btn-sm" onclick="(function(){qr={key:'${key}',qs:shuffle(QUIZ_BANK['${key}']),idx:0,correct:0,answered:false};renderQuizPanel();})()">Retry</button>
      </div>
    </div>`;
}

/* ---------- notes CRUD ---------- */
function renderNotes() {
  const wrap = byId('notesList'); if (!wrap) return;
  byId('notesCount').textContent = D.notes.length + ' note' + (D.notes.length === 1 ? '' : 's');
  let html = D.notes.map(n => `
    <div class="card">
      <div class="flex items-center justify-between mb-2"><h4 style="font-weight:700">${esc(n.title)}</h4><span class="badge badge-purple">${SUBJECTS[n.subject] ? SUBJECTS[n.subject].title : esc(n.subject)}</span></div>
      <p class="fs-sm text-muted" style="line-height:1.7;white-space:pre-wrap;word-break:break-word">${esc(n.body).slice(0, 400)}${n.body.length > 400 ? '…' : ''}</p>
      <div class="separator"></div>
      <div class="row-actions"><button class="icon-btn" title="Edit" onclick="editNote('${n.id}')">✏️</button><button class="icon-btn danger" title="Delete" onclick="deleteNote('${n.id}')">🗑️</button></div>
    </div>`).join('');
  html += `<div class="card" style="border:2px dashed var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:120px" onclick="openNoteModal()"><div style="text-align:center"><div style="font-size:2rem;margin-bottom:0.25rem">+</div><div class="fw-600">Add new note</div></div></div>`;
  wrap.innerHTML = html;
}
function openNoteModal() {
  if (!session) { openAuth('login'); return; }
  fillSubjectSelect('note-subject', currentSubjectKey || 'maths');
  byId('note-id').value = '';
  byId('noteModalTitle').textContent = 'New note';
  byId('note-title').value = ''; byId('note-body').value = '';
  fieldErr('note-title', ''); fieldErr('note-body', '');
  openModal('noteModal');
  setTimeout(() => byId('note-title').focus(), 50);
}
function editNote(id) {
  const n = D.notes.find(x => x.id === id); if (!n) return;
  fillSubjectSelect('note-subject', n.subject);
  byId('note-id').value = n.id;
  byId('noteModalTitle').textContent = 'Edit note';
  byId('note-title').value = n.title; byId('note-body').value = n.body;
  fieldErr('note-title', ''); fieldErr('note-body', '');
  openModal('noteModal');
}
function saveNote() {
  const title = byId('note-title').value.trim();
  const body = byId('note-body').value.trim();
  let bad = false;
  if (!title) { fieldErr('note-title', 'Add a title'); bad = true; } else fieldErr('note-title', '');
  if (!body) { fieldErr('note-body', 'Write something'); bad = true; } else fieldErr('note-body', '');
  if (bad) return;
  const id = byId('note-id').value;
  const subject = byId('note-subject').value;
  if (id) { const n = D.notes.find(x => x.id === id); if (n) { n.subject = subject; n.title = title; n.body = body; } showToast('Note updated', 'success'); }
  else { D.notes.unshift({ id: newUUID(), subject, title, body, ts: Date.now() }); logActivity('note', 'Added a note · ' + title); showToast('Note saved', 'success'); }
  closeModal('noteModal');
  if (typeof syncNoteToBackend === 'function') syncNoteToBackend(id || (D.notes[0] && D.notes[0].id));
  afterChange();
  renderNotes();
}
function deleteNote(id) {
  confirmAction('Delete note?', 'This note will be permanently removed.', 'Delete', () => {
    D.notes = D.notes.filter(x => x.id !== id);
    if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendDeleteNote === 'function') backendDeleteNote(id).catch(() => {});
    closeModal('confirmModal');
    showToast('Note deleted', 'info');
    afterChange();
    renderNotes();
  });
}

/* ════════════════════════════════════════════════════════════
   PHASE 7 — spaced repetition, backend sync, Pro note upload
   ════════════════════════════════════════════════════════════ */
const SR_INTERVALS = [0, 1, 3, 7]; // box index -> days until the card is due again

function isUuid(id) { return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

// Give older cards/notes UUID ids and default spaced-repetition fields so they
// match the Supabase schema and can sync. Safe to run repeatedly.
function migrateRevisionIds() {
  if (!D) return; let changed = false;
  (D.flashcards || []).forEach(c => {
    if (!isUuid(c.id)) { c.id = newUUID(); changed = true; }
    if (c.box === undefined) c.box = 0;
    if (c.nextReview === undefined) c.nextReview = 0;
    if (c.correctCount === undefined) c.correctCount = 0;
    if (c.incorrectCount === undefined) c.incorrectCount = 0;
    if (c.lastReviewed === undefined) c.lastReviewed = 0;
  });
  (D.notes || []).forEach(n => { if (!isUuid(n.id)) { n.id = newUUID(); changed = true; } });
  if (changed && typeof saveData === 'function') saveData();
}

function syncCardToBackend(id) {
  if (!id) return;
  const c = (D.flashcards || []).find(x => x.id === id); if (!c) return;
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendSyncFlashcard === 'function') backendSyncFlashcard(c).catch(() => {});
}
function syncNoteToBackend(id) {
  if (!id) return;
  const n = (D.notes || []).find(x => x.id === id); if (!n) return;
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendSyncNote === 'function') backendSyncNote(n).catch(() => {});
}

function dueCards() { const now = Date.now(); return (D.flashcards || []).filter(c => !c.nextReview || c.nextReview <= now); }

function scheduleCard(c, got) {
  const box = got ? Math.min((c.box || 0) + 1, SR_INTERVALS.length - 1) : 0;
  c.box = box;
  c.nextReview = Date.now() + SR_INTERVALS[box] * 86400000;
  c.lastReviewed = Date.now();
  if (got) c.correctCount = (c.correctCount || 0) + 1; else c.incorrectCount = (c.incorrectCount || 0) + 1;
}

let reviewQueue = [], reviewPos = 0, reviewDone = 0;
function startReview() {
  reviewQueue = dueCards().slice();
  if (!reviewQueue.length) { showToast('No cards are due right now', 'info'); return; }
  reviewPos = 0; reviewDone = 0;
  openModal('reviewModal');
  showReviewCard();
}
function showReviewCard() {
  const c = reviewQueue[reviewPos];
  const fc = byId('reviewCard'); if (fc) fc.classList.remove('flipped');
  if (!c) { endReview(); return; }
  byId('reviewFront').textContent = c.front;
  byId('reviewBack').textContent = c.back;
  byId('reviewProgress').textContent = 'Card ' + (reviewPos + 1) + ' of ' + reviewQueue.length;
  byId('reviewRate').style.display = 'none';
  byId('reviewFlipBtn').style.display = 'inline-flex';
}
function flipReview() {
  const fc = byId('reviewCard'); if (fc) fc.classList.add('flipped');
  byId('reviewFlipBtn').style.display = 'none';
  byId('reviewRate').style.display = 'flex';
}
function rateReview(got) {
  const c = reviewQueue[reviewPos]; if (!c) return;
  scheduleCard(c, got);
  reviewDone++;
  if (typeof recordFlashReview === 'function') recordFlashReview(c.id); // reviews++, challenge, XP, persist
  syncCardToBackend(c.id);
  reviewPos++;
  if (reviewPos >= reviewQueue.length) { endReview(); return; }
  showReviewCard();
}
function endReview() {
  closeModal('reviewModal');
  renderFlashDeck();
  showToast('Review complete. ' + reviewDone + ' card' + (reviewDone === 1 ? '' : 's') + ' reviewed.', 'success');
}

/* ---------- Pro note upload (Supabase Storage) ---------- */
function uploadNotePrompt() {
  if (!session) { openAuth('login'); return; }
  if (typeof hasPlan === 'function' && !hasPlan('pro')) {
    if (typeof showUpgrade === 'function') showUpgrade('pro', 'Note upload'); else showToast('Note upload is a Pro feature', 'info');
    return;
  }
  if (!(typeof backendConfigured === 'function' && backendConfigured())) { showToast('Note upload needs Supabase to be configured.', 'info'); return; }
  const inp = byId('note-upload-file'); if (inp) inp.click();
}
async function onUploadNoteFile(input) {
  const file = input && input.files && input.files[0]; if (!file) return;
  input.value = '';
  if (file.size > 10 * 1024 * 1024) { showToast('File is too large (max 10MB)', 'error'); return; }
  showToast('Uploading file...', 'info');
  try {
    if (typeof backendUploadNote === 'function') { await backendUploadNote(file); showToast('Note uploaded', 'success'); renderUploadedNotes(); }
  } catch (e) { showToast(e.message || 'Upload failed. Check the storage bucket is set up.', 'error'); }
}
async function renderUploadedNotes() {
  const wrap = byId('uploadedNotesList'); if (!wrap) return;
  if (!(typeof backendConfigured === 'function' && backendConfigured()) || typeof backendListUploadedNotes !== 'function') { wrap.innerHTML = ''; return; }
  try {
    const rows = await backendListUploadedNotes();
    if (!rows || !rows.length) { wrap.innerHTML = '<p class="fs-xs text-muted">No uploaded files yet.</p>'; return; }
    wrap.innerHTML = rows.map(r => {
      const path = (r.storage_path || '').replace(/'/g, '');
      return '<div class="card card-sm flex items-center justify-between"><div class="fs-sm fw-600 flex-1">' + esc(r.title || 'Note') + '</div>'
        + '<div class="row-actions"><button class="icon-btn" title="Open" onclick="viewUploadedNote(\'' + path + '\')">🔗</button>'
        + '<button class="icon-btn danger" title="Delete" onclick="deleteUploadedNote(\'' + r.id + '\',\'' + path + '\')">🗑️</button></div></div>';
    }).join('');
  } catch (e) { wrap.innerHTML = '<p class="fs-xs text-muted">Could not load uploads.</p>'; }
}
async function viewUploadedNote(path) {
  try { const url = await backendSignedNoteUrl(path); if (url) window.open(url, '_blank'); else showToast('Could not open file', 'error'); }
  catch (e) { showToast('Could not open file', 'error'); }
}
function deleteUploadedNote(id, path) {
  confirmAction('Delete uploaded file?', 'This removes the file and its record. This cannot be undone.', 'Delete', async () => {
    closeModal('confirmModal');
    try { if (typeof backendDeleteUploadedNote === 'function') await backendDeleteUploadedNote(id, path); showToast('File deleted', 'info'); renderUploadedNotes(); }
    catch (e) { showToast('Could not delete file', 'error'); }
  });
}

/* ════════════════════════════════════════════════════════════
   PHASE 8 — general GCSE content panel + sample cards
   Preset content is clearly labelled and exam-board-neutral.
   Sample cards stay separate until the student adds them, at which
   point they become the student's own editable cards.
   ════════════════════════════════════════════════════════════ */
function renderSubjectContent(key) {
  const el = byId('subjectContent'); if (!el) return;
  const c = (typeof GCSE_CONTENT !== 'undefined') ? GCSE_CONTENT[key] : null;
  if (!c) { el.innerHTML = ''; return; }
  const moves = (c.moves || []).map(m => '<li>' + esc(m) + '</li>').join('');
  const samples = (c.samples || []).map((s, i) =>
    '<div class="card card-sm"><div class="flex items-center justify-between mb-1">'
    + '<span class="badge badge-yellow">Sample</span>'
    + '<button class="btn btn-ghost btn-sm" onclick="addSampleCard(\'' + key + '\',' + i + ')">+ Add to my cards</button></div>'
    + '<div class="fs-sm fw-600">' + esc(s.front) + '</div>'
    + '<div class="fs-xs text-muted mt-1">' + esc(s.back) + '</div></div>'
  ).join('');
  el.innerHTML =
    '<div class="card" style="background:var(--surface2)">'
    + '<div class="flex items-center gap-sm mb-2"><span class="badge badge-green">General GCSE revision</span></div>'
    + '<p class="fs-sm" style="line-height:1.6">' + esc(c.focus) + '</p>'
    + (moves ? '<div class="fs-xs text-muted" style="margin-top:0.5rem"><strong>How to revise this:</strong><ul style="margin:0.35rem 0 0 1.1rem;padding:0">' + moves + '</ul></div>' : '')
    + (samples
      ? '<div class="separator"></div><div class="fs-sm fw-600 mb-2">Sample flashcards</div>'
        + '<div style="display:flex;flex-direction:column;gap:0.5rem">' + samples + '</div>'
        + '<p class="fs-xs text-muted" style="margin-top:0.5rem">Examples to get you started. Add one to make it your own card, then edit it freely. Not exam-board specific.</p>'
      : '')
    + '</div>';
}

function addSampleCard(key, idx) {
  if (!session) { openAuth('login'); return; }
  const c = (typeof GCSE_CONTENT !== 'undefined') ? GCSE_CONTENT[key] : null;
  if (!c || !c.samples || !c.samples[idx]) return;
  const s = c.samples[idx];
  D.flashcards.unshift({ id: newUUID(), subject: key, front: s.front, back: s.back, reviews: 0, box: 0, nextReview: 0, lastReviewed: 0, correctCount: 0, incorrectCount: 0 });
  if (typeof syncCardToBackend === 'function') syncCardToBackend(D.flashcards[0].id);
  if (typeof awardXP === 'function') awardXP(2, 'create-card');
  logActivity('flashcard', 'Added a sample card · ' + SUBJECTS[key].title);
  afterChange();
  renderFlashDeck();
  showToast('Added to your flashcards', 'success');
}

/* ════════════════════════════════════════════════════════════
   PHASE 9 — diagnostic assessment (quiz-based, no AI cost) and
   AI marking of written answers (GCSE-style practice, not an
   official examiner). AI marking uses the same secure, usage-limited
   endpoint as the tutor.
   ════════════════════════════════════════════════════════════ */

function profileSubjectKeys() {
  const profSubs = ((D && D.profile && D.profile.subjects) || []).map(s => String(s).toLowerCase());
  const keys = SUBJECT_KEYS.filter(k => profSubs.some(s => s.indexOf(SUBJECTS[k].title.toLowerCase().split(' ')[0]) !== -1));
  return keys.length ? keys : SUBJECT_KEYS.slice(0, 4);
}
function levelLabel(pct) {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Strong';
  if (pct >= 60) return 'Secure';
  if (pct >= 40) return 'Developing';
  return 'Building foundations';
}

/* ---------- diagnostic ---------- */
let dg = null;
function renderDiagnosticStart() {
  const el = byId('diagnosticPanel'); if (!el) return;
  if (dg) { renderDiagnostic(); return; }
  const last = (D && D.diagnostics && D.diagnostics.length) ? D.diagnostics[D.diagnostics.length - 1] : null;
  el.innerHTML =
    '<div class="card">'
    + '<div class="flex items-center gap-sm mb-1"><span class="badge badge-green">Diagnostic</span></div>'
    + '<h3 style="font-weight:800;margin-bottom:0.25rem">Not sure where to start?</h3>'
    + '<p class="fs-sm text-muted mb-3">Take a short check across your subjects. It is general practice, not an official assessment, and it suggests what to focus on.</p>'
    + '<div class="field"><label for="dg-scope">Scope</label><select class="select" id="dg-scope">'
    + '<option value="mine">My subjects</option>'
    + SUBJECT_KEYS.map(k => '<option value="' + k + '">' + SUBJECTS[k].title + ' only</option>').join('')
    + '</select></div>'
    + '<div class="flex gap-sm flex-wrap"><button class="btn btn-primary" onclick="startDiagnostic()">Start diagnostic</button>'
    + '<button class="btn btn-ghost" onclick="openMarkModal()">✍️ Mark a written answer</button></div>'
    + (last ? '<p class="fs-xs text-muted" style="margin-top:0.75rem">Last diagnostic: ' + last.overall + '% (' + esc(last.level) + ').</p>' : '')
    + '</div>';
}
function startDiagnostic() {
  const sel = byId('dg-scope');
  const scope = sel ? sel.value : 'mine';
  const keys = (scope === 'mine') ? profileSubjectKeys() : (SUBJECTS[scope] ? [scope] : profileSubjectKeys());
  let qs = [];
  keys.forEach(k => {
    const bank = QUIZ_BANK[k] || [];
    shuffle(bank).slice(0, scope === 'mine' ? 3 : 5).forEach(q => qs.push({ key: k, q }));
  });
  qs = shuffle(qs);
  if (!qs.length) { showToast('No questions available for that scope', 'info'); return; }
  dg = { scope, keys, qs, idx: 0, answered: false, correctByKey: {}, totalByKey: {} };
  renderDiagnostic();
}
function renderDiagnostic() {
  const el = byId('diagnosticPanel'); if (!el || !dg) return;
  const item = dg.qs[dg.idx]; const q = item.q;
  const pct = Math.round((dg.idx / dg.qs.length) * 100);
  el.innerHTML =
    '<div class="card">'
    + '<div class="flex items-center justify-between mb-2"><div><span class="badge badge-green">Diagnostic</span> '
    + '<span class="fs-xs text-muted">' + SUBJECTS[item.key].title + '</span></div>'
    + '<span class="fs-xs text-muted">Question ' + (dg.idx + 1) + ' of ' + dg.qs.length + '</span></div>'
    + '<div class="progress" style="margin-bottom:1rem"><div class="progress-fill" style="width:' + pct + '%;background:var(--accent)"></div></div>'
    + '<h4 style="font-weight:600;margin-bottom:1rem">' + esc(q.q) + '</h4>'
    + '<div class="quiz-options" id="dgOptions">'
    + q.opts.map((o, i) => '<div class="quiz-opt" data-idx="' + i + '" onclick="dgAnswer(' + i + ')"><div class="opt-letter">' + 'ABCD'[i] + '</div>' + esc(o) + '</div>').join('')
    + '</div>'
    + '<button class="btn btn-primary" id="dgNext" style="width:100%;justify-content:center;display:none" onclick="dgAdvance()">Next</button>'
    + '</div>';
}
function dgAnswer(idx) {
  if (!dg || dg.answered) return;
  const item = dg.qs[dg.idx]; const q = item.q;
  dg.answered = true;
  dg.totalByKey[item.key] = (dg.totalByKey[item.key] || 0) + 1;
  const correct = idx === q.ans;
  if (correct) dg.correctByKey[item.key] = (dg.correctByKey[item.key] || 0) + 1;
  document.querySelectorAll('#dgOptions .quiz-opt').forEach(o => {
    o.style.pointerEvents = 'none';
    if (+o.dataset.idx === q.ans) o.classList.add('correct');
    else if (+o.dataset.idx === idx) o.classList.add('wrong');
  });
  if (typeof recordQuizAnswer === 'function') recordQuizAnswer(item.key, correct);
  const nx = byId('dgNext'); if (nx) { nx.style.display = 'inline-flex'; nx.textContent = (dg.idx + 1 >= dg.qs.length) ? 'See results' : 'Next'; }
}
function dgAdvance() {
  if (!dg) return;
  if (dg.idx + 1 >= dg.qs.length) { dgFinish(); return; }
  dg.idx++; dg.answered = false;
  renderDiagnostic();
}
function dgFinish() {
  const perSubject = {};
  let totC = 0, totT = 0;
  dg.keys.forEach(k => {
    const c = dg.correctByKey[k] || 0, t = dg.totalByKey[k] || 0;
    if (t) { perSubject[k] = Math.round((c / t) * 100); totC += c; totT += t; }
  });
  const overall = totT ? Math.round((totC / totT) * 100) : 0;
  const level = levelLabel(overall);
  const result = { ts: Date.now(), scope: dg.scope, overall, perSubject, level };
  D.diagnostics = (D.diagnostics || []).concat(result);
  logActivity('quiz', 'Completed a diagnostic · ' + overall + '%');
  if (typeof awardXP === 'function') awardXP(15, 'diagnostic');
  afterChange();
  // weakest subjects (lowest %)
  const ranked = Object.keys(perSubject).sort((a, b) => perSubject[a] - perSubject[b]);
  const weakest = ranked.slice(0, Math.min(2, ranked.length)).filter(k => perSubject[k] < 75);
  const rows = ranked.map(k =>
    '<div class="flex items-center justify-between" style="gap:0.75rem"><span class="fs-sm">' + SUBJECTS[k].icon + ' ' + SUBJECTS[k].title + '</span>'
    + '<div style="flex:1;max-width:160px"><div class="progress"><div class="progress-fill" style="width:' + perSubject[k] + '%;background:' + (SUBJECT_COLORS[k] || 'var(--accent)') + '"></div></div></div>'
    + '<span class="fs-xs text-muted">' + perSubject[k] + '%</span></div>'
  ).join('');
  const el = byId('diagnosticPanel');
  dg = null;
  el.innerHTML =
    '<div class="card">'
    + '<div style="text-align:center;margin-bottom:0.75rem"><div style="font-size:2.5rem">' + (overall >= 75 ? '🏆' : overall >= 50 ? '👍' : '📚') + '</div>'
    + '<h3 style="font-weight:800;font-size:1.3rem">' + overall + '%</h3>'
    + '<p class="text-muted fs-sm">' + esc(level) + '</p></div>'
    + '<div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1rem">' + rows + '</div>'
    + (weakest.length
      ? '<div class="card card-sm" style="background:var(--surface2)"><div class="fs-sm fw-600 mb-1">Suggested focus</div>'
        + '<p class="fs-xs text-muted mb-2">Based on this check, spend more time on: ' + weakest.map(k => SUBJECTS[k].title).join(', ') + '.</p>'
        + '<button class="btn btn-primary btn-sm" onclick="applyDiagnosticFocus([' + weakest.map(k => "'" + k + "'").join(',') + '])">Set as my focus</button></div>'
      : '<p class="fs-sm text-muted">Nicely balanced across these subjects. Keep it up.</p>')
    + '<p class="fs-xs text-muted" style="margin-top:0.75rem">General practice only, not an official assessment or grade.</p>'
    + '<div class="flex gap-sm" style="margin-top:0.75rem"><button class="btn btn-ghost btn-sm" onclick="renderDiagnosticStart()">Done</button>'
    + '<button class="btn btn-ghost btn-sm" onclick="startDiagnostic()">Retry</button></div>'
    + '</div>';
}
function applyDiagnosticFocus(keys) {
  if (!D || !keys || !keys.length) return;
  D.profile = D.profile || {};
  D.profile.weak = keys.map(k => SUBJECTS[k] ? SUBJECTS[k].title : k);
  if (typeof backendConfigured === 'function' && backendConfigured() && typeof backendSyncProfile === 'function') backendSyncProfile().catch(() => {});
  if (D.plannerOnboarding && typeof generateWeekTasks === 'function') { generateWeekTasks(true); if (typeof renderPlanner === 'function') renderPlanner(); }
  afterChange();
  showToast('Focus updated. Your planner will prioritise these.', 'success');
}

/* ---------- AI marking ---------- */
const MARK_SYSTEM = 'You are a supportive GCSE practice marker, not an official examiner. Mark the student answer at GCSE standard for the named subject. Reply with: an estimated mark (out of the total if one is given, otherwise a rough band like "around a grade 5/6"), then "What you did well" with 2-3 points, then "How to improve" with 2-3 specific points, then "Key points a top answer includes". Be encouraging, concise, and use British spelling. End with one short line reminding the student this is practice guidance, not an official mark, and to check their exam board mark scheme.';

function openMarkModal(prefillSubject) {
  if (!session) { openAuth('login'); return; }
  fillSubjectSelect('mark-subject', prefillSubject || currentSubjectKey || 'maths');
  byId('mark-question').value = '';
  byId('mark-answer').value = '';
  byId('mark-marks').value = '';
  byId('mark-result').innerHTML = '';
  openModal('markModal');
}
async function markAnswer() {
  const subjectKey = byId('mark-subject').value;
  const question = byId('mark-question').value.trim();
  const answer = byId('mark-answer').value.trim();
  const marks = byId('mark-marks').value.trim();
  if (!question) { showToast('Add the question first', 'error'); return; }
  if (!answer) { showToast('Write your answer to mark', 'error'); return; }
  const res = byId('mark-result'); const btn = byId('mark-go');
  if (res) res.innerHTML = '<div class="fs-sm text-muted">Marking your answer...</div>';
  if (btn) btn.disabled = true;
  const subjTitle = SUBJECTS[subjectKey] ? SUBJECTS[subjectKey].title : subjectKey;
  const prompt = 'Subject: ' + subjTitle + '\nQuestion' + (marks ? ' (' + marks + ' marks)' : '') + ': ' + question + '\n\nStudent answer:\n' + answer + '\n\nMark this answer at GCSE standard.';
  try {
    const out = await callAI([{ role: 'user', content: prompt }], MARK_SYSTEM);
    if (res) res.innerHTML = '<div class="fs-sm" style="white-space:pre-wrap;line-height:1.6">' + esc(out) + '</div>'
      + '<p class="fs-xs text-muted" style="margin-top:0.5rem">Practice guidance, not an official mark. Always check your exam board mark scheme.</p>';
  } catch (e) {
    let msg = 'Could not mark this right now. Please try again.';
    let upgrade = false;
    if (e && e.code === 'LIMIT') {
      const free = (e.plan || 'free') === 'free';
      msg = free
        ? "You've reached today's free AI limit (resets in about " + (e.resetsInHours || 24) + "h). Tip: turn this topic into flashcards to keep revising for free, or upgrade for more marking."
        : "You've reached today's AI limit for your plan (resets in about " + (e.resetsInHours || 24) + "h).";
      upgrade = free;
    } else if (e && e.code === 'AUTH') msg = 'Please sign in to use AI marking.';
    else if (e && e.code === 'NO_KEY') msg = 'The AI backend is not configured yet.';
    if (res) res.innerHTML = '<div class="fb fb-wrong">' + esc(msg) + '</div>'
      + (upgrade ? '<button class="btn btn-primary btn-sm" style="margin-top:0.5rem" onclick="startCheckout(\'pro\')">Upgrade to Pro</button>' : '');
  } finally { if (btn) btn.disabled = false; }
}
