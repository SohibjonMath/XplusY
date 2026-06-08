const admin = require('firebase-admin');
const { getReviewStatsForProducts } = require('./_reviewStatsCommon');

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('Missing env FIREBASE_SERVICE_ACCOUNT_B64');
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=25, s-maxage=45, stale-while-revalidate=120',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
function idsFrom(event) {
  let rows = [];
  if (event.httpMethod === 'GET') rows = String(event.queryStringParameters?.ids || '').split(',');
  else {
    try { rows = JSON.parse(event.body || '{}').productIds || []; } catch (_e) { rows = []; }
  }
  return Array.isArray(rows) ? rows : [];
}
exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { ok: false, error: 'method_not_allowed' });
  try {
    initAdmin();
    const stats = await getReviewStatsForProducts(admin.firestore(), idsFrom(event), { refreshMissing: true });
    return json(200, { ok: true, stats });
  } catch (e) {
    console.error('product-review-stats', e);
    return json(500, { ok: false, error: String(e?.message || e).slice(0, 180) });
  }
};
