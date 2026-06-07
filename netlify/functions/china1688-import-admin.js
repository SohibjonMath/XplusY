/*
 * OrzuMall admin-only 1688 trend product importer.
 * One TMAPI call is used when an admin previews a 1688 URL.
 * Customers read the saved Firestore product and do not consume TMAPI quota.
 */
const {
  admin, cleanText, json, parseBody, tmapiToken, tmapiFetch,
  normalizeDetailResponse, safe1688Url, itemIdFromUrl,
  calculatePrice, pricingConfig, requireAdmin,
} = require('./_china1688Common');

function safeNumber(v, min = 0, max = 1e12, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function safeInt(v, min = 0, max = 1e9, fallback = 0) {
  return Math.round(safeNumber(v, min, max, fallback));
}
function safeUrl(v, max = 1600) {
  const s = cleanText(v, max);
  if (!s) return '';
  try {
    const u = new URL(s);
    return /^https?:$/i.test(u.protocol) ? u.toString() : '';
  } catch (_e) { return ''; }
}
function uniq(list, max = 30) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))].slice(0, max);
}
function sanitizeImages(list) {
  return uniq((Array.isArray(list) ? list : []).map(v => safeUrl(v, 1800)).filter(Boolean), 18);
}
function sanitizeTags(list) {
  const src = Array.isArray(list) ? list : String(list || '').split(',');
  return uniq(src.map(v => cleanText(v, 48)).filter(Boolean), 16);
}
function sanitizeProps(list) {
  return (Array.isArray(list) ? list : []).slice(0, 24).map(row => ({
    name: cleanText(row?.name, 90), value: cleanText(row?.value, 260),
  })).filter(x => x.name || x.value);
}
function sanitizeSourceVariants(list) {
  return (Array.isArray(list) ? list : []).slice(0, 120).map(row => ({
    id: cleanText(row?.id, 120),
    name: cleanText(row?.name, 240),
    image: safeUrl(row?.image, 1800),
    stock: safeInt(row?.stock, 0, 1e9, 0),
    priceCny: safeNumber(row?.priceCny, 0, 1e8, 0),
    priceUzs: safeInt(row?.priceUzs, 0, 1e12, 0),
  })).filter(x => x.name || x.id);
}
function nowIso() { return new Date().toISOString(); }

async function generateAdminProductId(db) {
  const counterRef = db.doc('meta/counters');
  return db.runTransaction(async tx => {
    const snap = await tx.get(counterRef);
    const data = snap.exists ? (snap.data() || {}) : {};
    let n = safeInt(data.aa, 0, 999999999, 0);
    for (let guard = 0; guard < 100; guard += 1) {
      n += 1;
      const id = `aa${String(n).padStart(3, '0')}`.toLowerCase();
      const productRef = db.doc(`products/${id}`);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) {
        tx.set(counterRef, { aa: n }, { merge: true });
        return id;
      }
    }
    throw new Error('PRODUCT_ID_GENERATION_FAILED');
  });
}

function sourceSummary(item = {}) {
  return {
    id: cleanText(item.id, 100),
    url: safe1688Url(item.url),
    title: cleanText(item.title || item.originalTitle, 420),
    image: safeUrl(item.image, 1800),
    images: sanitizeImages(item.images),
    priceCny: safeNumber(item.priceCny, 0, 1e8, 0),
    priceCnyMax: safeNumber(item.priceCnyMax, 0, 1e8, 0),
    priceUzs: safeInt(item.priceUzs, 0, 1e12, 0),
    pricing: item.pricing || calculatePrice(item.priceCny),
    moq: safeInt(item.moq, 1, 1e8, 1),
    stock: safeInt(item.stock, 0, 1e9, 0),
    unit: cleanText(item.unit, 32) || 'dona',
    sellerName: cleanText(item.sellerName, 220),
    sellerLocation: cleanText(item.sellerLocation, 220),
    deliveryFeeCny: safeNumber(item.deliveryFeeCny, 0, 1e8, 0),
    serviceTags: sanitizeTags(item.serviceTags),
    props: sanitizeProps(item.props),
    variants: sanitizeSourceVariants(item.variants),
  };
}

async function previewByUrl(url) {
  const safe = safe1688Url(url);
  if (!safe) throw Object.assign(new Error('1688 havolasi noto‘g‘ri.'), { statusCode: 400 });
  if (!tmapiToken()) throw Object.assign(new Error('TMAPI_API_TOKEN Netlify Environment Variables ichiga kiritilmagan.'), { statusCode: 503, code: 'TMAPI_TOKEN_MISSING' });
  const raw = await tmapiFetch('/1688/item_detail_by_url', {
    method: 'POST', body: { url: safe, language: 'ru' }, timeoutMs: 26000,
  });
  const item = normalizeDetailResponse(raw);
  if (!item.id) item.id = itemIdFromUrl(safe);
  if (!item.url) item.url = safe;
  return sourceSummary(item);
}

function buildDescription(source = {}) {
  const lines = ['Xitoydan buyurtma qilinadigan mahsulot. Yetkazib berish muddati taxminiy.'];
  (source.props || []).slice(0, 10).forEach(p => {
    if (p.name && p.value) lines.push(`${p.name}: ${p.value}`);
  });
  return lines.join('\n');
}

function sanitizeDraft(raw = {}) {
  const sourceUrl = safe1688Url(raw.sourceUrl || raw?.source?.url);
  if (!sourceUrl) throw Object.assign(new Error('1688 mahsulot havolasini kiriting.'), { statusCode: 400 });
  const itemId = cleanText(raw.itemId || raw?.source?.id || itemIdFromUrl(sourceUrl), 100).replace(/[^0-9]/g, '');
  const priceCny = safeNumber(raw.priceCny ?? raw?.source?.priceCny, 0, 1e8, 0);
  const source = sourceSummary({ ...(raw.source || {}), id: itemId, url: sourceUrl, priceCny });
  const images = sanitizeImages(raw.images?.length ? raw.images : source.images);
  const name = cleanText(raw.name || source.title, 320);
  if (!name) throw Object.assign(new Error('Mahsulot nomini kiriting.'), { statusCode: 400 });
  const autoPrice = calculatePrice(priceCny).priceUzs;
  const price = safeInt(raw.price, 0, 1e12, autoPrice);
  if (!price) throw Object.assign(new Error('Mahsulot narxini kiriting.'), { statusCode: 400 });
  return {
    productId: cleanText(raw.productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    sourceUrl, itemId, source, images, name,
    name_ru: cleanText(raw.name_ru || '', 320),
    name_en: cleanText(raw.name_en || '', 320),
    description: cleanText(raw.description || buildDescription(source), 7000),
    description_ru: cleanText(raw.description_ru || '', 7000),
    description_en: cleanText(raw.description_en || '', 7000),
    price, oldPrice: safeInt(raw.oldPrice, 0, 1e12, 0),
    weightKg: safeNumber(raw.weightKg, 0, 100000, 0),
    popularScore: safeInt(raw.popularScore, 0, 1e12, 50),
    tags: sanitizeTags(raw.tags?.length ? raw.tags : ['1688', 'Xitoydan buyurtma', 'trend']),
    deliveryMinDays: safeInt(raw.deliveryMinDays, 1, 365, 15),
    deliveryMaxDays: safeInt(raw.deliveryMaxDays, 1, 365, 30),
    moq: safeInt(raw.moq ?? source.moq, 1, 1e8, 1),
    stock: safeInt(raw.stock ?? source.stock, 0, 1e9, 0),
  };
}

async function saveProduct(db, raw, actor) {
  const draft = sanitizeDraft(raw);
  let productId = draft.productId;
  let created = false;
  if (!productId) { productId = await generateAdminProductId(db); created = true; }
  const ref = db.doc(`products/${productId}`);
  const existing = await ref.get();
  if (existing.exists && !created) {
    const before = existing.data() || {};
    if (before.sourcePlatform && before.sourcePlatform !== '1688') {
      throw Object.assign(new Error('Bu mahsulot 1688 import mahsuloti emas.'), { statusCode: 409 });
    }
  }
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const source = draft.source;
  const payload = {
    name: draft.name,
    name_ru: draft.name_ru,
    name_en: draft.name_en,
    description: draft.description,
    description_ru: draft.description_ru,
    description_en: draft.description_en,
    price: draft.price,
    oldPrice: draft.oldPrice,
    weightKg: draft.weightKg,
    popularScore: draft.popularScore,
    currency: 'UZS',
    images: draft.images,
    tags: draft.tags,
    fulfillmentType: 'cargo',
    deliveryMinDays: Math.min(draft.deliveryMinDays, draft.deliveryMaxDays),
    deliveryMaxDays: Math.max(draft.deliveryMinDays, draft.deliveryMaxDays),
    prepayRequired: true,
    status: 'approved',
    isActive: true,
    ownerType: 'orzumall',
    createdByRole: 'admin',
    isOrzuMallVerified: true,
    sellerId: 'orzumall',
    sellerName: 'OrzuMall',
    sourceType: 'china1688',
    sourcePlatform: '1688',
    sourceUrl: draft.sourceUrl,
    sourceItemId: draft.itemId,
    china1688: {
      itemId: draft.itemId,
      url: draft.sourceUrl,
      originalTitle: source.title,
      priceCny: safeNumber(source.priceCny, 0, 1e8, 0),
      priceCnyMax: safeNumber(source.priceCnyMax, 0, 1e8, 0),
      moq: draft.moq,
      stock: draft.stock,
      unit: cleanText(source.unit, 32),
      sellerName: cleanText(source.sellerName, 220),
      sellerLocation: cleanText(source.sellerLocation, 220),
      deliveryFeeCny: safeNumber(source.deliveryFeeCny, 0, 1e8, 0),
      serviceTags: sanitizeTags(source.serviceTags),
      props: sanitizeProps(source.props),
      variants: sanitizeSourceVariants(source.variants),
      importedBy: actor.email,
      lastSyncedAt: ts,
    },
    updatedAt: ts,
  };
  if (!existing.exists) payload.createdAt = nowIso();
  await ref.set(payload, { merge: true });
  return { id: productId, created: !existing.exists, product: { id: productId, ...payload, updatedAt: nowIso() } };
}

function stampMs(v) {
  try {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (Number.isFinite(Number(v))) return Number(v);
    return Number(v.seconds || v._seconds || 0) * 1000;
  } catch (_e) { return 0; }
}
function publicRow(doc) {
  const p = doc.data() || {};
  const src = p.china1688 || {};
  return {
    id: doc.id, name: cleanText(p.name, 320), name_ru: cleanText(p.name_ru, 320), name_en: cleanText(p.name_en, 320),
    description: cleanText(p.description, 7000), description_ru: cleanText(p.description_ru, 7000), description_en: cleanText(p.description_en, 7000),
    price: safeInt(p.price, 0, 1e12, 0), oldPrice: safeInt(p.oldPrice, 0, 1e12, 0),
    image: sanitizeImages(p.images)[0] || '', images: sanitizeImages(p.images),
    sourceUrl: safe1688Url(p.sourceUrl || src.url), itemId: cleanText(p.sourceItemId || src.itemId, 100),
    priceCny: safeNumber(src.priceCny, 0, 1e8, 0), moq: safeInt(src.moq, 1, 1e8, 1),
    fulfillmentType: cleanText(p.fulfillmentType, 32), isActive: p.isActive !== false,
    deliveryMinDays: safeInt(p.deliveryMinDays, 1, 365, 15), deliveryMaxDays: safeInt(p.deliveryMaxDays, 1, 365, 30),
    tags: sanitizeTags(p.tags), weightKg: safeNumber(p.weightKg, 0, 100000, 0),
    popularScore: safeInt(p.popularScore, 0, 1e12, 0), updatedAtMs: stampMs(p.updatedAt),
    source: sourceSummary({ ...src, id: p.sourceItemId || src.itemId, url: p.sourceUrl || src.url, images: p.images?.length ? p.images : src.images }),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const body = parseBody(event);
  if (body == null) return json(400, { error: 'INVALID_JSON' });
  const actor = await requireAdmin(event);
  if (!actor.ok) return json(actor.statusCode, { error: actor.error });
  const db = admin.firestore();
  const action = cleanText(body.action || '', 50).toLowerCase();
  try {
    if (action === 'preview') {
      const item = await previewByUrl(body.url);
      return json(200, { item, pricing: pricingConfig(), tmapiConfigured: true });
    }
    if (action === 'save') {
      const result = await saveProduct(db, body.product || {}, actor);
      return json(200, result);
    }
    if (action === 'list') {
      const snap = await db.collection('products').where('sourcePlatform', '==', '1688').limit(160).get();
      const products = snap.docs.map(publicRow).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      return json(200, { products, pricing: pricingConfig(), tmapiConfigured: !!tmapiToken() });
    }
    if (action === 'archive') {
      const id = cleanText(body.productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!id) return json(400, { error: 'PRODUCT_ID_REQUIRED' });
      const ref = db.doc(`products/${id}`); const snap = await ref.get();
      if (!snap.exists) return json(404, { error: 'PRODUCT_NOT_FOUND' });
      if ((snap.data() || {}).sourcePlatform !== '1688') return json(409, { error: 'NOT_1688_PRODUCT' });
      await ref.set({ isActive: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return json(200, { ok: true });
    }
    return json(400, { error: 'UNKNOWN_ACTION' });
  } catch (e) {
    return json(e.statusCode || 500, { error: e.code || e.message || 'IMPORT_FAILED', message: e.message || 'IMPORT_FAILED' });
  }
};
