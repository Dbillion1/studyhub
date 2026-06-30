const { json, empty, verifyUser, ensureProfile, updateProfile, publicAccount } = require('./_supabase');

function cleanProfile(p) {
  p = p && typeof p === 'object' ? p : {};
  const avatar = typeof p.avatar === 'string' ? p.avatar.slice(0, 200000) : '';
  return {
    year: String(p.year || '').slice(0, 80),
    subjects: Array.isArray(p.subjects) ? p.subjects.slice(0, 30).map(String) : [],
    grade: String(p.grade || '').slice(0, 80),
    strong: Array.isArray(p.strong) ? p.strong.slice(0, 30).map(String) : [],
    weak: Array.isArray(p.weak) ? p.weak.slice(0, 30).map(String) : [],
    onboarded: !!p.onboarded,
    avatar
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await verifyUser(event);
    await ensureProfile(user);
    const body = JSON.parse(event.body || '{}');
    const name = String(body.name || '').trim().slice(0, 120) || (user.email || 'StudyHub user');
    const row = await updateProfile(user.id, {
      email: user.email || '',
      full_name: name,
      profile: cleanProfile(body.profile)
    });
    return json(200, publicAccount(row));
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Could not save profile.' });
  }
};
