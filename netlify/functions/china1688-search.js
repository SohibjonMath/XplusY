const {
  cleanText, json, rateLimit, cacheGet, cacheSet, tmapiToken, pricingConfig,
  tmapiFetch, normalizeSearchResponse,
} = require('./_china1688Common');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const rl = rateLimit(event, 'china1688-search', 30);
  if (!rl.ok) return json(429, { error: 'TOO_MANY_REQUESTS', retryAfterSec: rl.retryAfterSec });
  if (!tmapiToken()) return json(503, { error: 'TMAPI_TOKEN_MISSING', setupRequired: true, message: 'Netlify Environment Variables ichiga TMAPI_API_TOKEN kiriting.' });
  const p = event.queryStringParameters || {};
  const keyword = cleanText(p.q || p.keyword || '', 100);
  if (keyword.length < 2) return json(400, { error: 'KEYWORD_TOO_SHORT', message: 'Kamida 2 ta belgi yozing.' });
  const page = Math.max(1, Math.min(50, Number(p.page || 1) || 1));
  const allowedSort = new Set(['default', 'sales', 'price_up', 'price_down']);
  const sort = allowedSort.has(String(p.sort)) ? String(p.sort) : 'default';
  const key = `search:${keyword.toLowerCase()}:${page}:${sort}`;
  const cached = cacheGet(key);
  if (cached) return json(200, { ...cached, cached: true, pricingConfig: pricingConfig() });
  try {
    const raw = await tmapiFetch('/1688/search/items', { query: { keyword, page, page_size: 20, sort } });
    const out = normalizeSearchResponse(raw, page);
    cacheSet(key, out, 3 * 60 * 60 * 1000);
    return json(200, { ...out, cached: false, pricingConfig: pricingConfig() });
  } catch (e) {
    return json(e.statusCode || 502, { error: e.message || 'TMAPI_FAILED', message: '1688 katalogini yuklab bo‘lmadi. API kaliti va tarifini tekshiring.' });
  }
};
