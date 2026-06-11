/*
 * Apify API-first 1688 detail bridge for OrzuMall.
 * Keeps APIFY_API_TOKEN on the server, starts the community Actor asynchronously,
 * polls short requests from the admin UI, and caches normalized product details.
 */
const { cleanText } = require('./_china1688Common');

const DEFAULT_ACTOR_ID = 'piotrv1001~1688-listings-scraper';
const DEFAULT_CACHE_HOURS = 24;
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

function apifyToken() { return cleanText(process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || '', 600); }
function apifyActorId() { return cleanText(process.env.APIFY_1688_ACTOR_ID || DEFAULT_ACTOR_ID, 180).replace(/\//g, '~'); }
function apifyReady() { return !!apifyToken(); }
function cacheHours() { const n = Number(process.env.APIFY_1688_CACHE_HOURS || DEFAULT_CACHE_HOURS); return Number.isFinite(n) ? Math.max(1, Math.min(720, n)) : DEFAULT_CACHE_HOURS; }
function safeId(v = '') { return cleanText(v, 140).replace(/[^0-9A-Za-z_-]/g, ''); }
function splitValues(v = '') { return [...new Set(cleanText(v, 6000).split(/[,，;；|\n]+/).map(x => cleanText(x, 160)).filter(Boolean))].slice(0, 120); }
function attrRows(raw = {}) { return (Array.isArray(raw.attributes) ? raw.attributes : []).slice(0, 80).map(row => ({ name: cleanText(row?.name, 140), value: cleanText(row?.value, 900) })).filter(x => x.name || x.value); }
function attrValue(rows = [], re) { return cleanText(rows.find(row => re.test(row.name))?.value || '', 6000); }
function singleUnitPrice(raw = {}) {
  const tiers = (Array.isArray(raw.tierPrices) ? raw.tierPrices : []).map(row => ({ price: Number(row?.price), beginAmount: Number(row?.beginAmount) })).filter(row => Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.beginAmount) && row.beginAmount >= 0).sort((a, b) => a.beginAmount - b.beginAmount);
  const exact = tiers.find(row => row.beginAmount <= 1) || tiers[0];
  const fallback = Number(raw.priceTo || raw.priceFrom || 0);
  return { priceCny: exact?.price || (Number.isFinite(fallback) ? fallback : 0), tiers };
}
function normalizeApify1688Item(raw = {}) {
  const props = attrRows(raw);
  const colors = splitValues(attrValue(props, /^(?:颜色|顏色|色彩|color|colour)$/i));
  const sizes = splitValues(attrValue(props, /^(?:尺码|尺寸|大小|规格|規格|size|razmer)$/i));
  const { priceCny, tiers } = singleUnitPrice(raw);
  const images = [...new Set((Array.isArray(raw.images) ? raw.images : [raw.image]).map(v => cleanText(v, 2400)).filter(Boolean))].slice(0, 80);
  const variantGroups = [
    ...(colors.length ? [{ id: 'color', name: 'Rang', type: 'color', options: colors.map((name, index) => ({ id: `color-${index + 1}`, name })) }] : []),
    ...(sizes.length ? [{ id: 'size', name: 'O‘lcham / model', type: 'size', options: sizes.map((name, index) => ({ id: `size-${index + 1}`, name })) }] : []),
  ];
  const offerId = safeId(raw.offerId);
  const unitWeight = Number(raw?.logistics?.unitWeight || 0);
  return {
    id: offerId,
    itemId: offerId,
    upstreamOfferId: offerId,
    url: cleanText(raw.url || (offerId ? `https://m.1688.com/offer/${offerId}.html` : ''), 2400),
    upstreamUrl: cleanText(raw.url || (offerId ? `https://m.1688.com/offer/${offerId}.html` : ''), 2400),
    sourcePlatform: '1688', sourceLabel: '1688', originCountry: 'CN', customerOrigin: 'Xitoydan',
    title: cleanText(raw.title, 520),
    image: cleanText(raw.image || images[0], 2400), images, galleryImages: images,
    priceCurrency: 'CNY', priceValue: priceCny, priceCny, priceCnyMax: Number(raw.priceTo || 0),
    tierPrices: tiers, moq: Math.max(1, Number(raw.minOrderQuantity || 1)), unit: cleanText(raw.unit, 40) || 'dona',
    weightKg: Number.isFinite(unitWeight) && unitWeight > 0 ? unitWeight : 0,
    props,
    serviceTags: (Array.isArray(raw.services) ? raw.services : []).map(v => cleanText(v, 120)).filter(Boolean).slice(0, 16),
    sellerName: cleanText(raw.sellerCompany || raw.sellerLoginId, 240), sellerLocation: cleanText(raw.location || raw?.logistics?.location, 180),
    variantGroups, colorOptions: variantGroups.find(g => g.type === 'color')?.options || [], sizeOptions: variantGroups.find(g => g.type === 'size')?.options || [],
    skuVariants: [], variants: [], stockKnown: false,
    diagnostics: {
      mode: 'apify-api-first', provider: 'apify', actorId: apifyActorId(), rawImageCount: images.length,
      galleryCount: images.length, groupCount: variantGroups.length, colorCount: colors.length, sizeCount: sizes.length,
      expectedSkuCount: Math.max(1, colors.length || 1) * Math.max(1, sizes.length || 1),
      hasWeight: Number.isFinite(unitWeight) && unitWeight > 0, hasTierPrices: tiers.length > 0,
      scrapedAt: cleanText(raw.scrapedAt, 100),
    },
  };
}
function cacheRef(db, offerId) { return db.doc(`externalImportCache/apify1688_${safeId(offerId)}`); }
async function cachedItem(db, offerId) {
  if (!db || !safeId(offerId)) return null;
  const snap = await cacheRef(db, offerId).get(); if (!snap.exists) return null;
  const row = snap.data() || {}; const expiresAt = Number(row.expiresAtMs || 0);
  if (!expiresAt || expiresAt < Date.now() || !row.item) return null;
  return row.item;
}
async function storeCache(db, offerId, item) {
  if (!db || !safeId(offerId) || !item) return;
  await cacheRef(db, offerId).set({ offerId: safeId(offerId), item, provider: 'apify', actorId: apifyActorId(), cachedAtMs: Date.now(), expiresAtMs: Date.now() + cacheHours() * 3600 * 1000 }, { merge: true });
}
async function apifyFetch(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const err = new Error(body?.error?.message || body?.message || `APIFY_HTTP_${response.status}`); err.statusCode = response.status >= 500 ? 502 : 400; throw err; }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') { const err = new Error('APIFY_TIMEOUT'); err.statusCode = 504; throw err; }
    throw error;
  } finally { clearTimeout(timer); }
}
function actorInput(offerId) {
  return { keywords: [], offerIds: [safeId(offerId)], maxItems: 1, maxPagesPerKeyword: 1, includeDetails: true, proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], apifyProxyCountry: 'CN' } };
}
async function startApify1688(db, offerId, options = {}) {
  const id = safeId(offerId); if (!id) throw Object.assign(new Error('1688 Offer ID topilmadi.'), { statusCode: 400 });
  if (!apifyReady()) throw Object.assign(new Error('APIFY_API_TOKEN_MISSING'), { statusCode: 503 });
  if (!options.force) { const hit = await cachedItem(db, id); if (hit) return { status: 'SUCCEEDED', cached: true, item: hit, offerId: id }; }
  const token = encodeURIComponent(apifyToken()); const actor = encodeURIComponent(apifyActorId());
  const body = await apifyFetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${token}`, { method: 'POST', body: JSON.stringify(actorInput(id)) });
  const run = body?.data || body; const runId = safeId(run?.id); if (!runId) throw Object.assign(new Error('APIFY_RUN_ID_MISSING'), { statusCode: 502 });
  return { status: cleanText(run.status || 'READY', 40).toUpperCase(), cached: false, runId, datasetId: safeId(run.defaultDatasetId), offerId: id };
}
async function pollApify1688(db, runId, offerId = '') {
  if (!apifyReady()) throw Object.assign(new Error('APIFY_API_TOKEN_MISSING'), { statusCode: 503 });
  const id = safeId(runId); if (!id) throw Object.assign(new Error('APIFY_RUN_ID_REQUIRED'), { statusCode: 400 });
  const token = encodeURIComponent(apifyToken());
  const runBody = await apifyFetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(id)}?token=${token}`, { method: 'GET' });
  const run = runBody?.data || runBody; const status = cleanText(run?.status, 40).toUpperCase();
  if (!TERMINAL.has(status)) return { status: status || 'RUNNING', runId: id, offerId: safeId(offerId) };
  if (status !== 'SUCCEEDED') throw Object.assign(new Error(`APIFY_RUN_${status || 'FAILED'}`), { statusCode: 502 });
  const datasetId = safeId(run.defaultDatasetId); if (!datasetId) throw Object.assign(new Error('APIFY_DATASET_ID_MISSING'), { statusCode: 502 });
  const items = await apifyFetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${token}&format=json&clean=true&limit=1`, { method: 'GET' });
  const raw = Array.isArray(items) ? items[0] : null; if (!raw) throw Object.assign(new Error('APIFY_PRODUCT_NOT_FOUND'), { statusCode: 404 });
  const item = normalizeApify1688Item(raw); await storeCache(db, item.id || offerId, item);
  return { status: 'SUCCEEDED', cached: false, runId: id, offerId: item.id || safeId(offerId), item };
}
module.exports = { apifyReady, apifyActorId, normalizeApify1688Item, startApify1688, pollApify1688 };
