/* ════════════════════════════════════════════════════════════
   store.js — persistence, utilities, session & per-user data
   localStorage with an in-memory fallback so the app never crashes,
   even in a sandboxed/file:// context. Real persistence kicks in
   wherever localStorage is available (e.g. when hosted).
   ════════════════════════════════════════════════════════════ */

const Store = (() => {
  let ok = false;
  const mem = {};
  try {
    const k = '__sa_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    ok = true;
  } catch (e) { ok = false; }
  return {
    persistent: ok,
    get(key) {
      try { return ok ? localStorage.getItem(key) : (key in mem ? mem[key] : null); }
      catch (e) { return key in mem ? mem[key] : null; }
    },
    set(key, val) {
      try { if (ok) localStorage.setItem(key, val); else mem[key] = val; }
      catch (e) { mem[key] = val; }
    },
    del(key) {
      try { if (ok) localStorage.removeItem(key); else delete mem[key]; }
      catch (e) { delete mem[key]; }
    },
    getJSON(key, fallback) {
      const raw = this.get(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    setJSON(key, val) { this.set(key, JSON.stringify(val)); }
  };
})();

const K = {
  users: 'studyhub:users',
  session: 'studyhub:session',
  theme: 'studyhub:theme',
  community: 'studyhub:community',
  communitySeeded: 'studyhub:community_seeded',
  reports: 'studyhub:community_reports',
  modLog: 'studyhub:moderation_log',
  data: id => 'studyhub:data:' + id
};

/* ---------- small utilities ---------- */
const byId = id => document.getElementById(id);
const esc = t => { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const newUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
const todayStr = (d = new Date()) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function hashPass(s) {
  let h = 0xdeadbeef ^ s.length;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
  return ((h ^ (h >>> 15)) >>> 0).toString(16);
}

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
  const h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const d = Math.floor(h / 24); if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
  return new Date(ts).toLocaleDateString();
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

/* ---------- session & current-user data ---------- */
let session = null;   // { id, name, email }
let D = null;         // current user's data object (see newUserData)

function newUserData() {
  return {
    profile: { year: '', subjects: [], grade: '', strong: [], weak: [], onboarded: false, avatar: '' },
    xp: 0,
    quizScores: [],      // percent scores of completed quizzes (numbers)
    subjectStats: {},    // { subjectKey: { correct, total } }
    studyMins: 0,
    activity: [],        // { ts, type, label }
    flashcards: [],      // { id, subject, front, back, reviews }
    notes: [],           // { id, subject, title, body, ts }
    sessions: [],        // { id, date 'YYYY-MM-DD', subject, topic, time, dur, done }
    goals: [],           // { id, title, due, progress }
    plannerOnboarding: null, // { subjects:[keys], days:[0..6], targetGrade, examDate, minutesPerDay, style, focusWeak, createdAt }
    plannerTasks: [],    // { id(uuid), weekStart, title, subject, dueDate, type, status, evidenceRequired, createdAt }
    taskEvidence: [],    // { id(uuid), taskId, kind, detail, createdAt }
    diagnostics: [],     // { ts, scope, overall, perSubject:{key:pct}, level }
    savedPrompts: [],    // { id, title, text, fav, ts }
    favTools: [],        // tool names
    achievements: [],    // unlocked achievement ids
    challenges: {},      // { date, flash, quizPass, ai, claimed:[] }
    settings: { provider: 'openai' },
    plan: 'free',
    subscription: { plan: 'free', status: 'free', source: 'supabase-stripe', updatedAt: Date.now() },
    chat: []             // { role:'user'|'assistant', content, error? }
  };
}

function loadUserData(id) {
  const d = Store.getJSON(K.data(id), null) || newUserData();
  const base = newUserData();
  for (const k in base) if (!(k in d)) d[k] = base[k];
  if (!d.settings) d.settings = base.settings;
  if (!d.profile) d.profile = base.profile;
  d.plan = (typeof normalisePlan === 'function') ? normalisePlan(d.plan || (d.subscription && d.subscription.plan) || 'free') : (d.plan || 'free');
  if (!d.subscription) d.subscription = { plan: d.plan, status: 'free', source: 'supabase-stripe', updatedAt: Date.now() };
  return d;
}
function saveData() { if (session && D) Store.setJSON(K.data(session.id), D); }
