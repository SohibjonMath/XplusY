const {
  cleanText, json, parseBody, rateLimit, cacheGet, cacheSet, tmapiToken,
  tmapiFetch, normalizeDetailResponse, itemIdFromUrl, safe1688Url,
} = require('./_china1688Common');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const rl = rateLimit(event, 'china1688-item', 45);
  if (!rl.ok) return json(429, { error: 'TOO_MANY_REQUESTS', retryAfterSec: rl.retryAfterSec });
  if (!tmapiToken()) return json(503, { error: 'TMAPI_TOKEN_MISSING', setupRequired: true, message: 'Netlify Environment Variables ichiga TMAPI_API_TOKEN kiriting.' });
  const body = event.httpMethod === 'POST' ? parseBody(event) : {};
  if (body == null) return json(400, { error: 'INVALID_JSON' });
  const p = event.queryStringParameters || {};
  const rawUrl = cleanText(body.url || p.url || '', 1500);
  const url = safe1688Url(rawUrl);
  const itemId = cleanText(body.itemId || body.item_id || p.itemId || p.item_id || itemIdFromUrl(rawUrl), 100).replace(/[^0-9]/g, '');
  if (!url && !itemId) return json(400, { error: 'ITEM_REQUIRED', message: '1688 mahsulot havolasi yoki mahsulot ID sini kiriting.' });
  const key = `item:${itemId || url}`;
  const cached = cacheGet(key);
  if (cached) return json(200, { item: cached, cached: true });
  try {
    let raw;
    if (url) {
      raw = await tmapiFetch('/1688/item_detail_by_url', { method: 'POST', body: { url, language: 'ru', optimize_title: true } });
    } else {
      raw = await tmapiFetch('/1688/item_detail', { query: { item_id: itemId, language: 'ru', optimize_title: true } });
    }
    const item = normalizeDetailResponse(raw);
    if (!item.id && itemId) item.id = itemId;
    if (!item.url && itemId) item.url = `https://detail.1688.com/offer/${itemId}.html`;
    cacheSet(key, item, 12 * 60 * 60 * 1000);
    return json(200, { item, cached: false });
  } catch (e) {
    return json(e.statusCode || 502, { error: e.message || 'TMAPI_FAILED', message: 'Mahsulot ma’lumotini olib bo‘lmadi. Havola yoki API tarifini tekshiring.' });
  }
};
