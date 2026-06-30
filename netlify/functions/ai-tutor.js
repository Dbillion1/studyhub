// Netlify Function: authenticated, secure AI proxy for StudyHub.
// Adds per-day usage limits (cost protection) and an optional Gemini fallback
// for free users. Secret keys (OPENAI_API_KEY, GEMINI_API_KEY) live only in
// Netlify environment variables. Login is required (Supabase token).
const { json, empty, verifyUser, ensureProfile, activePlan, supabaseRest } = require('./_supabase');

function intEnv(name, def) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

// Daily message allowances. Free users get a primary (GPT) allowance and then a
// backup (Gemini) allowance. Paid plans get a high GPT allowance for cost safety.
function limitsFor(plan, geminiAvailable) {
  if (plan === 'ultimate') return { gpt: intEnv('AI_ULTIMATE_DAILY', 400), gemini: 0 };
  if (plan === 'pro') return { gpt: intEnv('AI_PRO_DAILY', 150), gemini: 0 };
  return { gpt: intEnv('AI_FREE_GPT_DAILY', 10), gemini: geminiAvailable ? intEnv('AI_FREE_GEMINI_DAILY', 15) : 0 };
}

function todayUtc() { return new Date().toISOString().slice(0, 10); }
function hoursUntilUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 3600000));
}

async function readUsage(userId, date) {
  try {
    const rows = await supabaseRest(`ai_usage?user_id=eq.${encodeURIComponent(userId)}&usage_date=eq.${date}&select=*`, { method: 'GET' });
    return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  } catch (e) {
    // Fail open on read: availability over strict counting (login already proved Supabase works).
    return null;
  }
}

async function writeUsage(userId, date, plan, gpt, gemini, tokens, blocked) {
  await supabaseRest('ai_usage?on_conflict=user_id,usage_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: userId, usage_date: date, plan, gpt_count: gpt, gemini_count: gemini, tokens_est: tokens, blocked }
  });
}

function buildMessages(system, history) {
  return [{ role: 'system', content: system || 'You are a helpful study tutor.' }].concat(
    history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }))
  );
}

async function callOpenAI(apiKey, model, messages, maxTokens) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.35, messages })
  });
  const text = await res.text();
  if (!res.ok) { const e = new Error(text || ('OpenAI HTTP ' + res.status)); e.statusCode = res.status; throw e; }
  const data = JSON.parse(text);
  const reply = (((data.choices || [])[0] || {}).message || {}).content || '';
  const tokens = (data.usage && data.usage.total_tokens) || 0;
  return { reply: reply.trim(), tokens };
}

async function callGemini(apiKey, model, system, history, maxTokens) {
  const contents = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 6000) }] }));
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.35 } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) { const e = new Error(text || ('Gemini HTTP ' + res.status)); e.statusCode = res.status; throw e; }
  const data = JSON.parse(text);
  const cand = (data.candidates || [])[0] || {};
  const parts = (cand.content && cand.content.parts) || [];
  const reply = parts.map(p => p.text || '').join('').trim();
  const tokens = (data.usageMetadata && data.usageMetadata.totalTokenCount) || 0;
  return { reply, tokens };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const openaiKey = process.env.OPENAI_API_KEY || '';
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const geminiAvailable = !!geminiKey;
    if (!openaiKey && !geminiKey) return json(500, { error: 'OPENAI_API_KEY is not configured on the server.' });

    const { user } = await verifyUser(event);
    const profile = await ensureProfile(user);
    const plan = activePlan(profile);

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch (e) { return json(400, { error: 'Invalid JSON body.' }); }

    const system = String(payload.system || '').slice(0, 8000);
    const history = Array.isArray(payload.messages) ? payload.messages.slice(-24) : [];
    const maxTokens = plan === 'ultimate' ? 1600 : plan === 'pro' ? 1300 : 900;

    const limits = limitsFor(plan, geminiAvailable);
    const date = todayUtc();
    const usage = await readUsage(user.id, date);
    let gpt = usage ? (usage.gpt_count || 0) : 0;
    let gem = usage ? (usage.gemini_count || 0) : 0;
    let tokensEst = usage ? (usage.tokens_est || 0) : 0;

    // Pick a provider based on remaining quota for the day.
    let useProvider = null;
    if (openaiKey && gpt < limits.gpt) useProvider = 'gpt';
    else if (geminiAvailable && gem < limits.gemini) useProvider = 'gemini';

    if (!useProvider) {
      return json(429, {
        error: 'Daily AI message limit reached.',
        code: 'DAILY_LIMIT',
        blocked: true,
        plan,
        usage: { gpt, gemini: gem },
        limits,
        resetsInHours: hoursUntilUtcMidnight()
      });
    }

    let result, modelUsed;
    if (useProvider === 'gpt') {
      result = await callOpenAI(openaiKey, openaiModel, buildMessages(system, history), maxTokens);
      modelUsed = 'gpt';
      gpt += 1;
    } else {
      result = await callGemini(geminiKey, geminiModel, system, history, maxTokens);
      modelUsed = 'gemini';
      gem += 1;
    }
    tokensEst += result.tokens || (Math.ceil((result.reply || '').length / 4) + 200);

    const nowBlocked = (gpt >= limits.gpt) && (!geminiAvailable || gem >= limits.gemini);
    try { await writeUsage(user.id, date, plan, gpt, gem, tokensEst, nowBlocked); } catch (e) { /* never fail a reply over logging */ }

    return json(200, {
      reply: (result.reply || '').trim(),
      plan,
      modelUsed,
      usage: { gpt, gemini: gem },
      limits,
      remaining: { gpt: Math.max(0, limits.gpt - gpt), gemini: Math.max(0, limits.gemini - gem) }
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'AI request failed.' });
  }
};
