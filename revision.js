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
  renderFlashDeck();
  renderQuizPanel();
  renderNotes();
}

/* ---------- subject detail ---------- */
let currentSubjectKey = 'maths';
let subjCards = [];
let currentFlash = 0;

function openSubject(key) {
  if (!SUBJECTS[key]) return;
  currentSubjectKey = key;
  byId('subject-title').textContent = SUBJECTS[key].icon + ' ' + SUBJECTS[key].title;
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
    D.flashcards.unshift({ id: uid(), subject, front, back, reviews: 0 });
    logActivity('flashcard', 'Created a flashcard · ' + SUBJECTS[subject].title);
    awardXP(2, 'create-card');
    showToast('Flashcard saved', 'success');
  }
  closeModal('flashModal');
  if (byId('subject-detail').style.display === 'block') { subjCards = D.flashcards.filter(c => c.subject === currentSubjectKey); loadFlash(); }
  afterChange();
  renderFlashDeck();
  if (currentPage === 'revision') { const g = document.querySelector('#rev-tab-0 .subject-grid'); if (g) renderRevision(); }
}
function deleteFlash(id) {
  confirmAction('Delete flashcard?', 'This card will be permanently removed.', 'Delete', () => {
    D.flashcards = D.flashcards.filter(x => x.id !== id);
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
  else { D.notes.unshift({ id: uid(), subject, title, body, ts: Date.now() }); logActivity('note', 'Added a note · ' + title); showToast('Note saved', 'success'); }
  closeModal('noteModal');
  afterChange();
  renderNotes();
}
function deleteNote(id) {
  confirmAction('Delete note?', 'This note will be permanently removed.', 'Delete', () => {
    D.notes = D.notes.filter(x => x.id !== id);
    closeModal('confirmModal');
    showToast('Note deleted', 'info');
    afterChange();
    renderNotes();
  });
}
