// Netlify Function: securely delete the signed-in user's own account.
// Requires a valid Supabase login token. The user can only delete themselves;
// the service-role key is used server-side to remove their profile row and
// auth user. Never trust a user id from the request body.
const { json, empty, verifyUser, supabaseRest, deleteAuthUser } = require('./_supabase');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return empty();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { user } = await verifyUser(event);
    // Remove the profile row first (best effort), then the auth user.
    try {
      await supabaseRest(`profiles?id=eq.${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
    } catch (e) { /* continue even if the row is already gone */ }
    await deleteAuthUser(user.id);
    return json(200, { ok: true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Could not delete account.' });
  }
};
