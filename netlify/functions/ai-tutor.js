// Netlify Function: authenticated secure AI proxy for StudyHub.
// Requires Supabase login token. Secret OPENAI_API_KEY stays in Netlify env vars.
const { json, empty, verifyUser, ensureProfile, activePlan } = require('./_supabase');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = process.env.OPENAI_API_KEY || '';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!apiKey) return json(500, { error: 'OPENAI_API_KEY is not configured on the server.' });

    const { user } = await verifyUser(event);
    const profile = await ensureProfile(user);
    const plan = activePlan(profile);

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch (e) { return json(400, { error: 'Invalid JSON body.' }); }

    const system = String(payload.system || '').slice(0, 8000);
    const history = Array.isArray(payload.messages) ? payload.messages.slice(-24) : [];
    const maxTokens = plan === 'ultimate' ? 1600 : plan === 'pro' ? 1300 : 900;
    const messages = [{ role: 'system', content: system || 'You are a helpful study tutor.' }].concat(
      history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }))
    );

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.35, messages })
    });
    const text = await res.text();
    if (!res.ok) return json(res.status, { error: text });
    const data = JSON.parse(text);
    const reply = (((data.choices || [])[0] || {}).message || {}).content || '';
    return json(200, { reply: reply.trim(), plan });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'AI request failed.' });
  }
};
