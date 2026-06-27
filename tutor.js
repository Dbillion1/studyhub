/* ════════════════════════════════════════════════════════════
   tutor.js — the AI Tutor ("Aria")
   • Real LLM calls through a secure serverless proxy
   • Per-user conversation history (persisted)
   • Loading (typing) state, error messages + retry
   ════════════════════════════════════════════════════════════ */

let aiBusy = false;

/* ---------- system prompt personalised from the profile ---------- */
function buildSystemPrompt() {
  const p = (D && D.profile) || {};
  const bits = [];
  bits.push("You are Aria, a warm, encouraging AI study tutor for a UK secondary-school student.");
  if (session) bits.push('The student is called ' + session.name.split(' ')[0] + '.');
  if (p.year) bits.push('Year group: ' + p.year + '.');
  if (p.subjects && p.subjects.length) bits.push('Subjects: ' + p.subjects.join(', ') + '.');
  if (p.grade) bits.push('Target grade: ' + p.grade + '.');
  if (p.strong && p.strong.length) bits.push('Stronger at: ' + p.strong.join(', ') + '.');
  if (p.weak && p.weak.length) bits.push('Needs extra help with: ' + p.weak.join(', ') + '.');
  bits.push("Explain clearly at GCSE level using simple language, short paragraphs, worked examples and the occasional bullet list or code block when useful. Check understanding with a question when it helps. Be supportive and concise. Use British spelling. A welcome message has already been shown, so do not repeat a long greeting.");
  return bits.join(' ');
}

/* ---------- render page + sidebar ---------- */
function renderTutor() {
  renderChat();
  renderTutorSidebar();
}
function renderTutorSidebar() {
  if (!D) return;
  const tip = byId('tutorTip'); if (tip) tip.textContent = tipForToday();
  ensureChallengeDay();
  const asked = D.challenges.ai || 0;
  const qc = byId('tutorQCount'); if (qc) qc.textContent = asked;
  const bar = byId('tutorQBar'); if (bar) bar.style.width = Math.min(100, (asked / 3) * 100) + '%';
  const u = byId('tutorUnderstanding');
  if (u) {
    const lvl = levelFor(D.xp);
    u.textContent = lvl >= 10 ? 'Advanced' : lvl >= 4 ? 'Intermediate' : 'Getting started';
  }
}

function welcomeBubble() {
  const first = session ? session.name.split(' ')[0] : 'there';
  const p = (D && D.profile) || {};
  let line2 = 'Ask me anything about your subjects — I can explain topics, quiz you, plan revision, or check your work.';
  if (p.weak && p.weak.length) line2 = 'I know you want to improve in <strong>' + esc(p.weak.join(' and ')) + '</strong> — want to start there, or is something else on your mind?';
  const yearTxt = p.year ? (" I can see you're in <strong>" + esc(p.year) + '</strong>. ') : ' ';
  return '<div class="chat-msg"><div class="chat-avatar ai-avatar">🤖</div><div class="chat-bubble ai-bubble">👋 <strong>Hi ' + esc(first) + "!</strong> I'm Aria, your personal AI study tutor." + yearTxt + line2 + '</div></div>';
}

function renderChat() {
  const box = byId('chatMessages'); if (!box) return;
  let html = welcomeBubble();
  (D.chat || []).forEach((m, i) => {
    if (m.role === 'user') {
      html += '<div class="chat-msg user"><div class="chat-avatar user-avatar">' + avatarChar(session.name) + '</div><div class="chat-bubble user-bubble">' + esc(m.content) + '</div></div>';
    } else if (m.error) {
      html += '<div class="chat-msg"><div class="chat-avatar ai-avatar">🤖</div><div class="chat-bubble ai-bubble"><div class="chat-error"><div>⚠️ ' + esc(m.content) + '</div>' + (m.canRetry ? '<button class="btn btn-primary btn-sm" onclick="retryLast()">Try again</button>' : '<button class="btn btn-primary btn-sm" onclick="openSettings()">Open settings</button>') + '</div></div></div>';
    } else {
      html += '<div class="chat-msg"><div class="chat-avatar ai-avatar">🤖</div><div class="chat-bubble ai-bubble">' + renderMarkdown(m.content) + '</div></div>';
    }
  });
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
}

/* ---------- send ---------- */
function sendChatFromInput() {
  const inp = byId('chatInput');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  sendChat(msg);
}
function sendChat(msg) {
  if (!session) { openAuth('login'); return; }
  if (aiBusy) return;
  msg = (msg || '').trim();
  if (!msg) return;

  // drop any trailing error bubble before a new turn
  if (D.chat.length && D.chat[D.chat.length - 1].error) D.chat.pop();

  D.chat.push({ role: 'user', content: msg });
  saveData();
  renderChat();
  recordAIQuestion();      // XP + daily challenge
  afterChange();
  runAI();
}
function retryLast() {
  if (aiBusy) return;
  if (D.chat.length && D.chat[D.chat.length - 1].error) D.chat.pop();
  saveData(); renderChat();
  runAI();
}

function setTyping(on) {
  const box = byId('chatMessages');
  const send = byId('chatSendBtn');
  if (send) { send.disabled = on; send.style.opacity = on ? '0.5' : '1'; }
  const existing = byId('typingBubble');
  if (on) {
    if (!existing && box) {
      const div = document.createElement('div');
      div.className = 'chat-msg'; div.id = 'typingBubble';
      div.innerHTML = '<div class="chat-avatar ai-avatar">🤖</div><div class="chat-bubble ai-bubble"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
      box.appendChild(div); box.scrollTop = box.scrollHeight;
    }
  } else if (existing) existing.remove();
}

async function runAI() {
  aiBusy = true;
  setTyping(true);
  // build history for the API from stored messages (exclude error placeholders)
  const history = D.chat.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));
  try {
    const reply = await callAI(history);
    D.chat.push({ role: 'assistant', content: reply });
    saveData();
  } catch (err) {
    let msg, canRetry = true;
    if (err && err.code === 'NO_KEY') { msg = "The AI backend is not configured yet. The site owner needs to set OPENAI_API_KEY on the server."; canRetry = false; }
    else if (err && err.code === 'AUTH') { msg = 'Please sign in again. The secure AI backend needs a valid StudyHub login session.'; canRetry = false; }
    else if (err && err.code === 'RATE') { msg = "The AI service is busy or you've hit a rate limit. Please wait a moment and try again."; }
    else msg = 'The AI service is unavailable right now (' + ((err && err.message) ? err.message : 'unknown error') + '). Please try again.';
    D.chat.push({ role: 'assistant', error: true, canRetry, content: msg });
    saveData();
  } finally {
    aiBusy = false;
    setTyping(false);
    renderChat();
  }
}

/* ---------- provider routing ---------- */
async function callAI(history) {
  const cfg = window.STUDYHUB_CONFIG || {};
  const endpoint = cfg.aiEndpoint || '/.netlify/functions/ai-tutor';
  const provider = cfg.aiProvider || 'openai';
  const model = cfg.aiModel || 'gpt-4o-mini';
  const system = buildSystemPrompt();

  const headers = (typeof authHeaders === 'function') ? await authHeaders() : { 'Content-Type': 'application/json' };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider, model, system, messages: history, plan: (typeof getPlan === 'function' ? getPlan() : 'free') })
  });

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch (e) {}
    throw classifyHttp(res.status, body);
  }
  const data = await res.json();
  const text = (data.reply || data.text || '').trim();
  return text || "I'm not sure how to answer that — could you rephrase?";
}

function classifyHttp(status, body) {
  if (status === 401 || status === 403) { const e = new Error('auth'); e.code = 'AUTH'; return e; }
  if (status === 429 || status >= 500) {
    const e = new Error(status === 500 && String(body || '').includes('OPENAI_API_KEY') ? 'AI key missing' : 'busy');
    e.code = status === 500 && String(body || '').includes('OPENAI_API_KEY') ? 'NO_KEY' : 'RATE';
    return e;
  }
  const e = new Error('HTTP ' + status); return e;
}

/* ---------- minimal, safe markdown ---------- */
function renderMarkdown(src) {
  src = src == null ? '' : String(src);
  // 1. pull out fenced code blocks
  const blocks = [];
  src = src.replace(/```([\s\S]*?)```/g, (m, code) => { blocks.push(code.replace(/^\n/, '')); return '\u0000B' + (blocks.length - 1) + '\u0000'; });
  // 2. escape everything
  let h = esc(src);
  // 3. inline code
  h = h.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  // 4. bold / italic
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // 5. block-level: headings, lists, paragraphs
  const lines = h.split('\n');
  let out = '', listType = null, para = [];
  const flushPara = () => { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } };
  const closeList = () => { if (listType) { out += '</' + listType + '>'; listType = null; } };
  for (let raw of lines) {
    const line = raw.trim();
    if (line === '') { flushPara(); closeList(); continue; }
    let m;
    if ((m = line.match(/^#{1,3}\s+(.*)$/))) { flushPara(); closeList(); out += '<p><strong>' + m[1] + '</strong></p>'; continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { flushPara(); if (listType !== 'ul') { closeList(); out += '<ul>'; listType = 'ul'; } out += '<li>' + m[1] + '</li>'; continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (listType !== 'ol') { closeList(); out += '<ol>'; listType = 'ol'; } out += '<li>' + m[1] + '</li>'; continue; }
    closeList(); para.push(line);
  }
  flushPara(); closeList();
  // 6. restore code blocks
  out = out.replace(/\u0000B(\d+)\u0000/g, (m, i) => '<pre><code>' + esc(blocks[+i]) + '</code></pre>');
  return out;
}
