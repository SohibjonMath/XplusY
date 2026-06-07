/*
 * OrzuMall 1688 integration common helpers.
 * Third-party TMAPI token stays server-side only.
 * ENV:
 *   TMAPI_API_TOKEN or TMAPI_TOKEN       required for live catalog
 *   TMAPI_BASE_URL                       optional; default https://api.tmapi.top
 *   CHINA1688_CNY_TO_UZS                 optional; default 1850
 *   CHINA1688_SERVICE_PERCENT            optional; default 12
 *   CHINA1688_RESERVE_PERCENT            optional; default 3
 *   CHINA1688_MIN_SERVICE_UZS            optional; default 15000
 *   FIREBASE_SERVICE_ACCOUNT_B64         required for request saving/admin
 *   ORDER_BOT_TOKEN / TELEGRAM_BOT_TOKEN optional Telegram notification
 *   TELEGRAM_ADMIN_CHAT_ID               optional Telegram notification
 */
const admin = require('firebase-admin');

const memCache = global.__omChina1688Cache || new Map();
global.__omChina1688Cache = memCache;
const rateBuckets = global.__omChina1688RateBuckets || new Map();
global.__omChina1688RateBuckets = rateBuckets;

function cleanText(v, max = 500) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function clamp(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function asArray(v) { return Array.isArray(v) ? v : []; }
function first(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}
function firstArray(...vals) {
  for (const v of vals) if (Array.isArray(v) && v.length) return v;
  return [];
}
function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}
function parseBody(event) {
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (event.body || '');
    return raw ? JSON.parse(raw) : {};
  } catch (_e) { return null; }
}
function getIp(event) {
  const h = event.headers || {};
  return cleanText((h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || h['client-ip'] || 'unknown').split(',')[0], 100);
}
function rateLimit(event, scope, max = 35, windowMs = 10 * 60 * 1000) {
  const key = `${scope}:${getIp(event)}`;
  const now = Date.now();
  let row = rateBuckets.get(key);
  if (!row || now - row.startedAt > windowMs) row = { startedAt: now, count: 0 };
  row.count += 1;
  rateBuckets.set(key, row);
  if (rateBuckets.size > 2000) {
    for (const [k, v] of rateBuckets.entries()) if (now - v.startedAt > windowMs * 2) rateBuckets.delete(k);
  }
  return { ok: row.count <= max, remaining: Math.max(0, max - row.count), retryAfterSec: Math.ceil((windowMs - (now - row.startedAt)) / 1000) };
}
function cacheGet(key) {
  const row = memCache.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) { memCache.delete(key); return null; }
  return row.value;
}
function cacheSet(key, value, ttlMs) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (memCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of memCache.entries()) if (now > v.expiresAt) memCache.delete(k);
    while (memCache.size > 500) memCache.delete(memCache.keys().next().value);
  }
}
function tmapiToken() { return cleanText(process.env.TMAPI_API_TOKEN || process.env.TMAPI_TOKEN || '', 300); }
function tmapiBase() { return cleanText(process.env.TMAPI_BASE_URL || 'https://api.tmapi.top', 300).replace(/\/$/, ''); }
function pricingConfig() {
  return {
    cnyToUzs: clamp(process.env.CHINA1688_CNY_TO_UZS, 1, 100000, 1850),
    servicePercent: clamp(process.env.CHINA1688_SERVICE_PERCENT, 0, 100, 12),
    reservePercent: clamp(process.env.CHINA1688_RESERVE_PERCENT, 0, 100, 3),
    minServiceUzs: Math.round(clamp(process.env.CHINA1688_MIN_SERVICE_UZS, 0, 10000000, 15000)),
  };
}
function parseNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const m = String(v == null ? '' : v).replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
function parseRange(v) {
  if (Array.isArray(v)) {
    const nums = v.map(parseNumber).filter(n => Number.isFinite(n) && n > 0);
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 };
  }
  const nums = String(v == null ? '' : v).replace(/,/g, '.').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(n => n > 0) || [];
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 };
}
function calculatePrice(priceCny) {
  const cfg = pricingConfig();
  const cny = Math.max(0, Number(priceCny) || 0);
  const base = cny * cfg.cnyToUzs;
  const service = Math.max(cfg.minServiceUzs, base * cfg.servicePercent / 100);
  const reserve = base * cfg.reservePercent / 100;
  const total = Math.ceil((base + service + reserve) / 500) * 500;
  return { priceCny: cny, priceUzs: total, baseUzs: Math.round(base), serviceUzs: Math.round(service), reserveUzs: Math.round(reserve), ...cfg };
}
function deepGet(o, path) {
  return String(path).split('.').reduce((acc, k) => acc == null ? undefined : acc[k], o);
}
function getAny(o, paths) {
  for (const p of paths) {
    const v = deepGet(o, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}
function collectImages(...sources) {
  const out = [];
  const push = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(push);
    if (typeof v === 'object') {
      const url = first(v.url, v.image, v.image_url, v.pic_url, v.original, v.src);
      if (url) push(url);
      return;
    }
    const s = cleanText(v, 1200);
    if (/^https?:\/\//i.test(s) && !out.includes(s)) out.push(s);
  };
  sources.forEach(push);
  return out.slice(0, 18);
}
function unwrap(raw) {
  let cur = raw;
  for (let i = 0; i < 4; i += 1) {
    if (!cur || typeof cur !== 'object') break;
    if (cur.data && typeof cur.data === 'object' && !Array.isArray(cur.data)) { cur = cur.data; continue; }
    if (cur.result && typeof cur.result === 'object' && !Array.isArray(cur.result)) { cur = cur.result; continue; }
    break;
  }
  return cur || {};
}
function itemIdFromUrl(url) {
  const s = cleanText(url, 1500);
  const m = s.match(/(?:offer\/|offerId=|itemId=|id=)(\d{6,})/i) || s.match(/\b(\d{8,})\b/);
  return m ? m[1] : '';
}
function safe1688Url(url) {
  const s = cleanText(url, 1500);
  if (!s) return '';
  const candidates = [s, ...(s.match(/https?:\/\/[^\s<>"']+/gi) || [])];
  for (const raw of candidates) {
    try {
      const u = new URL(raw.replace(/[),.;]+$/, ''));
      const h = u.hostname.toLowerCase();
      if (h === '1688.com' || h.endsWith('.1688.com')) return u.toString();
    } catch (_e) {}
  }
  return '';
}
function normalizedUrl(id, rawUrl = '') {
  return safe1688Url(rawUrl) || (id ? `https://detail.1688.com/offer/${encodeURIComponent(id)}.html` : '');
}
function normalizeSearchRow(row = {}) {
  const id = cleanText(first(row.item_id, row.offer_id, row.id, row.product_id, row.offerId, row.itemId), 80);
  const title = cleanText(first(row.title, row.subject, row.name, row.item_title, row.offer_title, row.product_title), 260) || '1688 mahsuloti';
  const imgs = collectImages(row.image, row.img, row.pic_url, row.image_url, row.main_image, row.main_img, row.pic, row.images, row.main_images);
  const range = parseRange(first(row.sku_price_scale, row.price_range, row.price, row.price_min, row.min_price, row.sale_price, row.promotion_price));
  const p = calculatePrice(range.min || parseNumber(first(row.price, row.min_price, row.price_min)));
  const moq = Math.max(1, Math.round(parseNumber(first(row.moq, row.min_order, row.begin_num, row.minOrder, row.sale_quantity)) || 1));
  const url = normalizedUrl(id, first(row.product_url, row.detail_url, row.url, row.item_url));
  return {
    id, url, title,
    image: imgs[0] || '', images: imgs,
    priceCny: p.priceCny, priceUzs: p.priceUzs,
    priceCnyMax: range.max || p.priceCny,
    moq,
    sales: cleanText(first(row.sales, row.sales_count, row.sold, row.sale_num, row.month_sales, ''), 50),
    sellerName: cleanText(first(row.shop_name, row.seller_name, row.company_name, row.seller_login_id, row.member_id, ''), 160),
  };
}
function findRows(payload) {
  const candidates = [
    payload?.items, payload?.item_list, payload?.products, payload?.offers, payload?.offer_list,
    payload?.list, payload?.result?.items, payload?.data?.items, payload?.page?.items,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  if (Array.isArray(payload)) return payload;
  return [];
}
function normalizeSearchResponse(raw, page = 1) {
  const payload = unwrap(raw);
  const rows = findRows(payload);
  return {
    items: rows.map(normalizeSearchRow).filter(x => x.id || x.url),
    page: Math.max(1, Number(first(payload.page, payload.page_no, payload.current_page, page)) || page),
    total: Math.max(0, Number(first(payload.total, payload.total_count, payload.count, rows.length)) || rows.length),
    hasMore: Boolean(first(payload.has_more, payload.hasMore, payload.next_page)) || rows.length >= 20,
  };
}
function stringifyVariantName(v = {}) {
  const attrs = firstArray(v.specs, v.attributes, v.props, v.sku_props, v.sale_attributes);
  const bits = [];
  attrs.forEach(a => {
    if (typeof a === 'string') bits.push(a);
    else if (a && typeof a === 'object') bits.push(cleanText(first(a.value, a.name, a.value_name, a.prop_value, a.text), 80));
  });
  const direct = cleanText(first(v.name, v.title, v.spec, v.sku_name, v.properties_name, v.props_names), 180);
  return direct || bits.filter(Boolean).join(' / ') || 'Variant';
}
function normalizeVariants(payload = {}) {
  let rows = firstArray(payload.skus, payload.sku_list, payload.skuList, payload.variants, payload.sku_info?.skus, payload.sku_info?.sku_list, payload.sku_infos);
  if (!rows.length && payload.sku_map && typeof payload.sku_map === 'object') rows = Object.entries(payload.sku_map).map(([key, v]) => ({ ...(v || {}), name: key }));
  return rows.slice(0, 120).map((v, idx) => {
    const range = parseRange(first(v.price, v.sale_price, v.discount_price, v.sku_price, v.price_cny));
    const p = calculatePrice(range.min || parseNumber(first(v.price, v.sale_price, v.sku_price)));
    return {
      id: cleanText(first(v.sku_id, v.skuid, v.id, v.spec_id, v.specid, v.specId, idx + 1), 120),
      name: stringifyVariantName(v),
      image: collectImages(v.image, v.image_url, v.pic_url, v.thumbnail)[0] || '',
      stock: Math.max(0, Math.round(parseNumber(first(v.stock, v.stock_qty, v.amount_on_sale, v.quantity, 0)) || 0)),
      priceCny: p.priceCny,
      priceUzs: p.priceUzs,
    };
  });
}
function normalizeProps(payload = {}) {
  const src = firstArray(payload.product_props, payload.props, payload.attributes, payload.product_properties);
  return src.slice(0, 24).map(row => {
    if (typeof row === 'string') return { name: '', value: cleanText(row, 180) };
    const entries = Object.entries(row || {});
    if (entries.length === 1 && !['name', 'value'].includes(entries[0][0])) return { name: cleanText(entries[0][0], 80), value: cleanText(entries[0][1], 180) };
    return { name: cleanText(first(row.name, row.key, row.attr_name, row.property_name), 80), value: cleanText(first(row.value, row.val, row.attr_value, row.property_value), 180) };
  }).filter(x => x.name || x.value);
}
function normalizeDetailResponse(raw) {
  const payload = unwrap(raw);
  const id = cleanText(first(payload.item_id, payload.offer_id, payload.id, payload.product_id, payload.offerId), 80);
  const title = cleanText(first(payload.title, payload.subject, payload.name, payload.item_title, payload.offer_title), 320) || '1688 mahsuloti';
  const images = collectImages(payload.images, payload.main_images, payload.main_imgs, payload.image_list, payload.item_imgs, payload.image, payload.pic_url, payload.main_image);
  const range = parseRange(first(payload.sku_price_scale, payload.price_range, payload.price, payload.min_price, payload.price_min));
  const p = calculatePrice(range.min || parseNumber(first(payload.price, payload.min_price, payload.price_min)));
  const delivery = payload.delivery_info || payload.shipping || {};
  const shop = payload.shop_info || payload.shop || payload.seller || {};
  const variants = normalizeVariants(payload);
  return {
    id,
    url: normalizedUrl(id, first(payload.product_url, payload.url, payload.detail_url, payload.item_url)),
    title,
    image: images[0] || '', images,
    priceCny: p.priceCny, priceCnyMax: range.max || p.priceCny, priceUzs: p.priceUzs,
    pricing: p,
    moq: Math.max(1, Math.round(parseNumber(first(payload.moq, payload.begin_num, payload.sku_price_range?.begin_num, payload.min_order, payload.minOrder, 1)) || 1)),
    stock: Math.max(0, Math.round(parseNumber(first(payload.stock, payload.total_stock, payload.sku_price_range?.stock, payload.amount_on_sale, 0)) || 0)),
    unit: cleanText(first(payload.offer_unit, payload.unit, payload.sku_price_range?.sell_unit, 'dona'), 30),
    sellerName: cleanText(first(shop.shop_name, payload.shop_name, payload.seller_login_id, shop.seller_login_id, shop.company_name, payload.member_id), 180),
    sellerLocation: cleanText(first(delivery.location, shop.address, payload.location), 180),
    deliveryFeeCny: parseNumber(first(delivery.delivery_fee, payload.shipping_fee, 0)),
    serviceTags: firstArray(payload.service_tags, payload.services).map(v => cleanText(typeof v === 'string' ? v : first(v.name, v.title, v.value), 80)).filter(Boolean).slice(0, 10),
    props: normalizeProps(payload),
    variants,
  };
}
async function tmapiFetch(path, { method = 'GET', query = {}, body = null, timeoutMs = 18000 } = {}) {
  const token = tmapiToken();
  if (!token) {
    const e = new Error('TMAPI_TOKEN_MISSING');
    e.code = 'TMAPI_TOKEN_MISSING';
    throw e;
  }
  const url = new URL(`${tmapiBase()}${path}`);
  url.searchParams.set('apiToken', token);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_e) { data = { raw: text.slice(0, 1000) }; }
    if (!res.ok) {
      const e = new Error(`TMAPI_HTTP_${res.status}`);
      e.statusCode = res.status;
      e.details = data;
      throw e;
    }
    const code = Number(data?.code);
    if (Number.isFinite(code) && code !== 200) {
      const e = new Error(cleanText(data?.msg || `TMAPI_CODE_${code}`, 300));
      e.statusCode = code >= 400 && code < 600 ? code : 502;
      e.details = data;
      throw e;
    }
    return data;
  } finally { clearTimeout(timer); }
}
function initFirebaseAdmin() {
  if (admin.apps.length) return admin;
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '').replace(/\s+/g, '');
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64_MISSING');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}
function bearer(event) {
  const h = event.headers || {};
  const m = String(h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}
function adminEmails() {
  return Array.from(new Set(['sohibjonmath@gmail.com', ...String(process.env.ADMIN_EMAILS || process.env.ORZUMALL_ADMIN_EMAILS || '').split(/[\s,;]+/)]
    .map(v => cleanText(v, 180).toLowerCase()).filter(Boolean)));
}
async function requireAdmin(event) {
  try { initFirebaseAdmin(); } catch (e) { return { ok: false, statusCode: 500, error: e.message || 'FIREBASE_ADMIN_NOT_CONFIGURED' }; }
  const token = bearer(event);
  if (!token) return { ok: false, statusCode: 401, error: 'ADMIN_LOGIN_REQUIRED' };
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = cleanText(decoded.email, 180).toLowerCase();
    if (!email || !adminEmails().includes(email)) return { ok: false, statusCode: 403, error: 'ADMIN_ONLY' };
    return { ok: true, uid: decoded.uid, email };
  } catch (_e) { return { ok: false, statusCode: 401, error: 'ADMIN_TOKEN_INVALID' }; }
}
function tgEscape(s) { return String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); }
async function notifyTelegram(lines) {
  const bot = cleanText(process.env.ORDER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '', 300);
  const chat = cleanText(process.env.TELEGRAM_ADMIN_CHAT_ID || '', 100);
  if (!bot || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, parse_mode: 'HTML', text: lines.filter(Boolean).join('\n') }),
    });
    return res.ok;
  } catch (_e) { return false; }
}
module.exports = {
  admin, cleanText, clamp, json, parseBody, rateLimit, cacheGet, cacheSet, tmapiToken, pricingConfig,
  calculatePrice, tmapiFetch, normalizeSearchResponse, normalizeDetailResponse, itemIdFromUrl, safe1688Url,
  initFirebaseAdmin, requireAdmin, tgEscape, notifyTelegram,
};
