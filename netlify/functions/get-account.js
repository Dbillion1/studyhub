const { json, empty, verifyUser, ensureProfile, publicAccount } = require('./_supabase');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await verifyUser(event);
    const profile = await ensureProfile(user);
    return json(200, publicAccount(profile));
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Could not load account.' });
  }
};
