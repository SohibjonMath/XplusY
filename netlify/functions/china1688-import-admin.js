/*
 * OrzuMall admin-only hybrid 1688 trend importer.
 * RapidAPI link import is the recommended path for structured SKU variants.
 * Chrome extension and manual form remain fallback modes.
 */
const {
  admin, cleanText, json, parseBody, safe1688Url, itemIdFromUrl,
  calculatePrice, pricingConfig, requireAdmin, rateLimit,
  rapidApi1688Ready, rapidApi1688Host, fetch1688DetailByUrl, normalizeDetailResponse,
} = require('./_china1688Common');
const { MAX_IMAGES_PER_BATCH, IMAGE_STANDARD, copyImages, normalizeMarketplaceImageUrl } = require('./_china1688ImageStore');

function safeNumber(v, min = 0, max = 1e12, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function safeInt(v, min = 0, max = 1e9, fallback = 0) {
  return Math.round(safeNumber(v, min, max, fallback));
}
function safeUrl(v, max = 2200) {
  return normalizeMarketplaceImageUrl(v, max);
}
function uniq(list, max = 30) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))].slice(0, max);
}
function sanitizeImages(list) {
  return uniq((Array.isArray(list) ? list : []).map(v => safeUrl(v, 2200)).filter(Boolean), 18);
}
function sanitizeTags(list) {
  const src = Array.isArray(list) ? list : String(list || '').split(',');
  return uniq(src.map(v => cleanText(v, 48)).filter(Boolean), 16);
}
function sanitizeProps(list) {
  return (Array.isArray(list) ? list : []).slice(0, 30).map(row => ({
    name: cleanText(row?.name, 90), value: cleanText(row?.value, 300),
  })).filter(x => x.name || x.value);
}
function sanitizeSourceVariants(list) {
  return (Array.isArray(list) ? list : []).slice(0, 160).map(row => ({
    id: cleanText(row?.id, 140),
    name: cleanText(row?.name, 260),
    image: safeUrl(row?.image, 2200),
    stock: safeInt(row?.stock, 0, 1e9, 0),
    priceCny: safeNumber(row?.priceCny, 0, 1e8, 0),
    priceUzs: safeInt(row?.priceUzs, 0, 1e12, 0),
  })).filter(x => x.name || x.id);
}

function sanitizeVariantOptions(list) {
  return (Array.isArray(list) ? list : []).slice(0, 64).map((row, idx) => ({
    id: cleanText(row?.id || `o${idx + 1}`, 140),
    name: cleanText(row?.name || row?.label || row?.value, 160),
    image: safeUrl(row?.image, 2200),
    disabled: row?.disabled === true,
  })).filter(x => x.name);
}
function sanitizeVariantGroups(list) {
  return (Array.isArray(list) ? list : []).slice(0, 10).map((row, idx) => ({
    id: cleanText(row?.id || `g${idx + 1}`, 140),
    name: cleanText(row?.name || `Variant ${idx + 1}`, 160),
    type: ['color', 'size', 'spec', 'other'].includes(cleanText(row?.type, 20).toLowerCase()) ? cleanText(row?.type, 20).toLowerCase() : 'other',
    options: sanitizeVariantOptions(row?.options),
  })).filter(x => x.options.length);
}
function sanitizeSkuVariants(list) {
  return (Array.isArray(list) ? list : []).slice(0, 220).map((row, idx) => ({
    id: cleanText(row?.id || `sku${idx + 1}`, 160),
    name: cleanText(row?.name, 300),
    color: cleanText(row?.color, 160),
    size: cleanText(row?.size, 160),
    attributes: Object.fromEntries(Object.entries(row?.attributes || {}).slice(0, 12).map(([k, v]) => [cleanText(k, 120), cleanText(v, 160)]).filter(([k, v]) => k && v)),
    image: safeUrl(row?.image, 2200),
    stock: safeInt(row?.stock, 0, 1e9, 0),
    priceCny: safeNumber(row?.priceCny, 0, 1e8, 0),
    priceUzs: safeInt(row?.priceUzs, 0, 1e12, 0),
  })).filter(x => x.name || x.color || x.size || x.id);
}
function sanitizeImagesByColor(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).slice(0, 64).forEach(([key, rows]) => {
    const name = cleanText(key, 160);
    const images = sanitizeImages(Array.isArray(rows) ? rows : [rows]);
    if (name && images.length) out[name] = images;
  });
  return out;
}
function cleanVariantValue(value) {
  return cleanText(value, 180)
    .replace(/(?:库存|庫存|stock|qoldiq|остаток)\s*[:：]?\s*\d+[\s\S]*$/i, '')
    .replace(/(?:¥|￥)\s*\d+(?:[.,]\d+)?[\s\S]*$/i, '')
    .replace(/^[\s:：/_-]+|[\s:：/_-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const noisyVariantValue = /(?:主面料|面料|材质|成分|品牌|货号|运费|评价|参数|商品属性|包装|详情|登录|登錄|查看全部|好评|已购|起批|¥|￥|库存|庫存|stock|qoldiq|material|fabric|brand|price|delivery)/i;
function usableVariantValue(value) { const v=cleanVariantValue(value); return !!v && v.length<=90 && !noisyVariantValue.test(v); }
function attributeByKind(attributes = {}, kind = '') {
  const re = kind === 'color'
    ? /(?:颜色|顏色|色彩|color|colour|rang)/i
    : /(?:尺码|尺寸|大小|规格|規格|型号|型號|款式|specification|variant|size|razmer|o['‘’]?lcham)/i;
  const hit = Object.entries(attributes || {}).find(([key]) => re.test(cleanText(key, 160)));
  return cleanVariantValue(hit?.[1] || '');
}
function sourceColors(source = {}) {
  const explicit = sanitizeVariantOptions(source.colorOptions);
  const group = sanitizeVariantGroups(source.variantGroups).find(x => x.type === 'color');
  const skuRows = sanitizeSkuVariants(source.skuVariants?.length ? source.skuVariants : source.variants);
  const rows = [...explicit, ...(group?.options || [])];
  skuRows.forEach(row => {
    const name = cleanVariantValue(row.color || attributeByKind(row.attributes, 'color'));
    if (usableVariantValue(name)) rows.push({ id: row.id, name, image: row.image || '' });
  });
  const map = new Map();
  rows.forEach(row => {
    const name = cleanVariantValue(row.name);
    if (!usableVariantValue(name)) return;
    const prev = map.get(name) || {};
    map.set(name, { name, ...((row.image || prev.image) ? { image: row.image || prev.image } : {}) });
  });
  return [...map.values()].slice(0, 64);
}
function sourceSizes(source = {}) {
  const explicit = sanitizeVariantOptions(source.sizeOptions);
  const group = sanitizeVariantGroups(source.variantGroups).find(x => x.type === 'size') || sanitizeVariantGroups(source.variantGroups).find(x => x.type === 'spec');
  const skuRows = sanitizeSkuVariants(source.skuVariants?.length ? source.skuVariants : source.variants);
  const rows = [...explicit, ...(group?.options || [])].map(row => row.name);
  skuRows.forEach(row => rows.push(row.size || attributeByKind(row.attributes, 'size')));
  return [...new Set(rows.map(cleanVariantValue).filter(usableVariantValue))].slice(0, 80);
}
function marketplaceVariants(source = {}, fallbackPrice = 0) {
  const toMarketplace = row => {
    const stockQty = safeInt(row.stock, 0, 1e9, 0);
    const colorRaw = row.color || attributeByKind(row.attributes, 'color');
    const sizeRaw = row.size || attributeByKind(row.attributes, 'size');
    return {
      color: usableVariantValue(colorRaw) ? cleanVariantValue(colorRaw) : null,
      size: usableVariantValue(sizeRaw) ? cleanVariantValue(sizeRaw) : null,
      price: row.priceUzs || calculatePrice(row.priceCny).priceUzs || safeInt(fallbackPrice, 0, 1e12, 0),
      stock: stockQty,
      stockQty,
      sku: row.id,
      skuId: row.id,
      attributes: row.attributes,
      ...(row.image ? { image: row.image } : {}),
    };
  };
  const cleanRows = sanitizeSkuVariants(source.skuVariants?.length ? source.skuVariants : source.variants).map(toMarketplace).filter(row => row.color || row.size);
  if (cleanRows.length) return cleanRows.slice(0, 220);
  // Kengaytma strukturali SKU topa olmagan holatda admin tasdiqlagan variantlardan xavfsiz SKU yaratiladi.
  const colors=sourceColors(source), sizes=sourceSizes(source);
  let rows=[];
  if(colors.length && sizes.length) rows=colors.flatMap(c=>sizes.map((z,i)=>({id:`generated-${c.name}-${i+1}`,name:`${c.name} / ${z}`,color:c.name,size:z,image:c.image||'',stock:safeInt(source.stock,0,1e9,0),priceUzs:safeInt(fallbackPrice,0,1e12,0),attributes:{颜色:c.name,规格:z}})));
  else if(colors.length) rows=colors.map((c,i)=>({id:`generated-color-${i+1}`,name:c.name,color:c.name,image:c.image||'',stock:safeInt(source.stock,0,1e9,0),priceUzs:safeInt(fallbackPrice,0,1e12,0),attributes:{颜色:c.name}}));
  else if(sizes.length) rows=sizes.map((z,i)=>({id:`generated-spec-${i+1}`,name:z,size:z,stock:safeInt(source.stock,0,1e9,0),priceUzs:safeInt(fallbackPrice,0,1e12,0),attributes:{规格:z}}));
  return rows.map(toMarketplace).filter(row=>row.color || row.size).slice(0,220);
}

function nowIso() { return new Date().toISOString(); }
function isStorageUrl(v) { return /^https:\/\/firebasestorage\.googleapis\.com\//i.test(String(v || '')); }
function isNormalizedStorageUrl(v) { return isStorageUrl(v) && /square-1200/i.test(String(v || '')); }

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
async function findExistingByItemId(db, itemId) {
  const id = cleanText(itemId, 100).replace(/[^0-9]/g, '');
  if (!id) return '';
  const snap = await db.collection('products').where('sourceItemId', '==', id).limit(8).get();
  const hit = snap.docs.find(doc => (doc.data() || {}).sourcePlatform === '1688');
  return hit?.id || '';
}
function sourceSummary(item = {}) {
  const images = sanitizeImages(item.images);
  return {
    id: cleanText(item.id, 100).replace(/[^0-9]/g, ''),
    url: safe1688Url(item.url),
    title: cleanText(item.title || item.originalTitle, 520),
    image: safeUrl(item.image || images[0], 2200),
    images,
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
    galleryImages: sanitizeImages(item.galleryImages?.length ? item.galleryImages : images),
    variantImages: sanitizeImages(item.variantImages),
    colorOptions: sanitizeVariantOptions(item.colorOptions),
    sizeOptions: sanitizeVariantOptions(item.sizeOptions),
    variantGroups: sanitizeVariantGroups(item.variantGroups),
    skuVariants: sanitizeSkuVariants(item.skuVariants?.length ? item.skuVariants : item.variants),
    imagesByColor: sanitizeImagesByColor(item.imagesByColor),
    genericSpecName: cleanText(item.genericSpecName, 120),
    diagnostics: {
      galleryCount: safeInt(item?.diagnostics?.galleryCount, 0, 1000, images.length),
      variantImageCount: safeInt(item?.diagnostics?.variantImageCount, 0, 1000, 0),
      groupCount: safeInt(item?.diagnostics?.groupCount, 0, 100, 0),
      skuCount: safeInt(item?.diagnostics?.skuCount, 0, 1000, 0),
      mode: cleanText(item?.diagnostics?.mode, 50),
      loginRequired: item?.diagnostics?.loginRequired === true,
      variantsMayBePartial: item?.diagnostics?.variantsMayBePartial === true,
      bridgeRootCount: safeInt(item?.diagnostics?.bridgeRootCount, 0, 100, 0),
      visibleVariantLabelCount: safeInt(item?.diagnostics?.visibleVariantLabelCount, 0, 500, 0),
      groupNames: (Array.isArray(item?.diagnostics?.groupNames) ? item.diagnostics.groupNames : []).slice(0, 12).map(v => cleanText(v, 120)).filter(Boolean),
    },
    extractedAt: cleanText(item.extractedAt, 80),
    extractorVersion: cleanText(item.extractorVersion, 40),
  };
}
function buildDescription(source = {}) {
  const lines = ['Xitoydan buyurtma qilinadigan mahsulot. Yetkazib berish muddati taxminiy.'];
  (source.props || []).slice(0, 12).forEach(p => {
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
  const externalImages = sanitizeImages(raw.externalImages?.length ? raw.externalImages : source.images);
  const name = cleanText(raw.name || source.title, 360);
  if (!name) throw Object.assign(new Error('Mahsulot nomini kiriting.'), { statusCode: 400 });
  const autoPrice = calculatePrice(priceCny).priceUzs;
  const price = safeInt(raw.price, 0, 1e12, autoPrice);
  if (!price) throw Object.assign(new Error('Mahsulot narxini kiriting.'), { statusCode: 400 });
  return {
    productId: cleanText(raw.productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    sourceUrl, itemId, source, images, externalImages, name,
    name_ru: cleanText(raw.name_ru || '', 360),
    name_en: cleanText(raw.name_en || '', 360),
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
  let productId = draft.productId || await findExistingByItemId(db, draft.itemId);
  if (!productId) productId = await generateAdminProductId(db);
  const ref = db.doc(`products/${productId}`);
  const existing = await ref.get();
  if (existing.exists) {
    const before = existing.data() || {};
    if (before.sourcePlatform && before.sourcePlatform !== '1688') {
      throw Object.assign(new Error('Bu mahsulot 1688 import mahsuloti emas.'), { statusCode: 409 });
    }
  }
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const source = draft.source;
  const storedCount = draft.images.filter(isStorageUrl).length;
  const normalizedCount = draft.images.filter(isNormalizedStorageUrl).length;
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
    colors: sourceColors(source),
    sizes: sourceSizes(source),
    imagesByColor: sanitizeImagesByColor(source.imagesByColor),
    variants: marketplaceVariants(source, draft.price),
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
    sourceType: 'china1688-extension',
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
      galleryImages: sanitizeImages(source.galleryImages?.length ? source.galleryImages : draft.externalImages),
      variantImages: sanitizeImages(source.variantImages),
      colorOptions: sanitizeVariantOptions(source.colorOptions),
      sizeOptions: sanitizeVariantOptions(source.sizeOptions),
      variantGroups: sanitizeVariantGroups(source.variantGroups),
      skuVariants: sanitizeSkuVariants(source.skuVariants?.length ? source.skuVariants : source.variants),
      imagesByColor: sanitizeImagesByColor(source.imagesByColor),
      genericSpecName: cleanText(source.genericSpecName, 120),
      diagnostics: source.diagnostics || {},
      externalImages: draft.externalImages,
      localImageCount: storedCount,
      imageStandard: draft.images.length && normalizedCount === draft.images.length ? IMAGE_STANDARD : cleanText(source.imageStandard, 80),
      normalizedImageCount: normalizedCount,
      importer: 'chrome-extension',
      extractorVersion: cleanText(source.extractorVersion, 40),
      importedBy: actor.email,
      lastSyncedAt: ts,
    },
    updatedAt: ts,
  };
  if (!existing.exists) payload.createdAt = nowIso();
  await ref.set(payload, { merge: true });
  return { id: productId, created: !existing.exists, localImageCount: storedCount };
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
  const images = sanitizeImages(p.images);
  return {
    id: doc.id, name: cleanText(p.name, 360), name_ru: cleanText(p.name_ru, 360), name_en: cleanText(p.name_en, 360),
    description: cleanText(p.description, 7000), description_ru: cleanText(p.description_ru, 7000), description_en: cleanText(p.description_en, 7000),
    price: safeInt(p.price, 0, 1e12, 0), oldPrice: safeInt(p.oldPrice, 0, 1e12, 0),
    image: images[0] || '', images,
    sourceUrl: safe1688Url(p.sourceUrl || src.url), itemId: cleanText(p.sourceItemId || src.itemId, 100),
    priceCny: safeNumber(src.priceCny, 0, 1e8, 0), moq: safeInt(src.moq, 1, 1e8, 1),
    fulfillmentType: cleanText(p.fulfillmentType, 32), isActive: p.isActive !== false,
    deliveryMinDays: safeInt(p.deliveryMinDays, 1, 365, 15), deliveryMaxDays: safeInt(p.deliveryMaxDays, 1, 365, 30),
    tags: sanitizeTags(p.tags), weightKg: safeNumber(p.weightKg, 0, 100000, 0),
    popularScore: safeInt(p.popularScore, 0, 1e12, 0), colors: Array.isArray(p.colors) ? p.colors : [], sizes: Array.isArray(p.sizes) ? p.sizes : [], variants: Array.isArray(p.variants) ? p.variants : [], imagesByColor: p.imagesByColor || {}, updatedAtMs: stampMs(p.updatedAt),
    localImageCount: safeInt(src.localImageCount, 0, 1000, images.filter(isStorageUrl).length),
    imageStandard: cleanText(src.imageStandard, 80), normalizedImageCount: safeInt(src.normalizedImageCount, 0, 1000, images.filter(isNormalizedStorageUrl).length),
    source: sourceSummary({ ...src, id: p.sourceItemId || src.itemId, url: p.sourceUrl || src.url, images: src.externalImages?.length ? src.externalImages : p.images }),
  };
}


async function applyNormalizedImages(db, raw = {}, actor) {
  const id = cleanText(raw.productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!id) throw Object.assign(new Error('PRODUCT_ID_REQUIRED'), { statusCode: 400 });
  const ref = db.doc(`products/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { statusCode: 404 });
  const before = snap.data() || {};
  if (before.sourcePlatform !== '1688') throw Object.assign(new Error('NOT_1688_PRODUCT'), { statusCode: 409 });
  const images = sanitizeImages(raw.images);
  if (!images.length) throw Object.assign(new Error('PRODUCT_IMAGES_NOT_FOUND'), { statusCode: 400 });
  const externalImages = sanitizeImages(raw.externalImages?.length ? raw.externalImages : (before.china1688 || {}).externalImages);
  const storedCount = images.filter(isStorageUrl).length;
  const normalizedCount = images.filter(isNormalizedStorageUrl).length;
  const ts = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    images,
    china1688: {
      externalImages,
      localImageCount: storedCount,
      normalizedImageCount: normalizedCount,
      imageStandard: normalizedCount ? IMAGE_STANDARD : '',
      imageNormalizedBy: actor.email,
      imageNormalizedAt: ts,
    },
    updatedAt: ts,
  }, { merge: true });
  return { id, images, copied: storedCount, normalized: normalizedCount, failed: Math.max(0, images.length - storedCount), standard: normalizedCount ? IMAGE_STANDARD : '' };
}

async function normalizeStoredProductImages(db, productId, actor) {
  const id = cleanText(productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!id) throw Object.assign(new Error('PRODUCT_ID_REQUIRED'), { statusCode: 400 });
  const ref = db.doc(`products/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { statusCode: 404 });
  const before = snap.data() || {};
  if (before.sourcePlatform !== '1688') throw Object.assign(new Error('NOT_1688_PRODUCT'), { statusCode: 409 });
  const src = before.china1688 || {};
  const rawUrls = sanitizeImages(src.externalImages?.length ? src.externalImages : before.images);
  if (!rawUrls.length) throw Object.assign(new Error('PRODUCT_IMAGES_NOT_FOUND'), { statusCode: 400 });
  const copied = [], failed = [];
  for (let i = 0; i < rawUrls.length; i += MAX_IMAGES_PER_BATCH) {
    const part = rawUrls.slice(i, i + MAX_IMAGES_PER_BATCH);
    const result = await copyImages(part, `${id}-normalized`, { normalize: true });
    copied.push(...(result.copied || []));
    failed.push(...(result.failed || []));
  }
  if (!copied.length) throw Object.assign(new Error('IMAGE_NORMALIZATION_FAILED'), { statusCode: 502 });
  const finalImages = [...copied.map(x => x.url), ...failed.map(x => x.sourceUrl)].slice(0, 18);
  const ts = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    images: finalImages,
    china1688: {
      externalImages: rawUrls,
      localImageCount: copied.length,
      normalizedImageCount: copied.filter(x => x.normalized).length,
      imageStandard: IMAGE_STANDARD,
      imageNormalizedBy: actor.email,
      imageNormalizedAt: ts,
    },
    updatedAt: ts,
  }, { merge: true });
  return {
    id,
    images: finalImages,
    copied: copied.length,
    normalized: copied.filter(x => x.normalized).length,
    failed: failed.length,
    standard: IMAGE_STANDARD,
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const body = parseBody(event);
  if (body == null) return json(400, { error: 'INVALID_JSON' });
  const limited = rateLimit(event, 'china1688-admin', 90, 10 * 60 * 1000);
  if (!limited.ok) return json(429, { error: 'TOO_MANY_REQUESTS', retryAfterSec: limited.retryAfterSec });
  const actor = await requireAdmin(event);
  if (!actor.ok) return json(actor.statusCode, { error: actor.error });
  const db = admin.firestore();
  const action = cleanText(body.action || '', 50).toLowerCase();
  try {
    if (action === 'apipreview') {
      const sourceUrl = safe1688Url(body.sourceUrl || body.url);
      if (!sourceUrl) return json(400, { error: 'SOURCE_URL_REQUIRED', message: 'Haqiqiy 1688 mahsulot havolasini kiriting.' });
      const fetched = await fetch1688DetailByUrl(sourceUrl, { force: body.force === true });
      const item = normalizeDetailResponse(fetched.raw);
      item.url = sourceUrl; item.id = item.id || itemIdFromUrl(sourceUrl);
      item.diagnostics = { ...(item.diagnostics || {}), provider: fetched.provider, cached: fetched.cached === true };
      return json(200, { item, provider: fetched.provider, cached: fetched.cached === true, pricing: pricingConfig() });
    }
    if (action === 'copyimages') {
      const itemId = cleanText(body.itemId || 'draft', 100).replace(/[^a-z0-9_-]/gi, '') || 'draft';
      const result = await copyImages(body.urls, itemId, { normalize: body.normalize !== false, strictNormalize: body.strictNormalize === true });
      return json(200, { ...result, maxPerBatch: MAX_IMAGES_PER_BATCH, imageStandard: IMAGE_STANDARD });
    }
    if (action === 'save') {
      const result = await saveProduct(db, body.product || {}, actor);
      return json(200, result);
    }
    if (action === 'list') {
      const snap = await db.collection('products').where('sourcePlatform', '==', '1688').limit(200).get();
      const products = snap.docs.map(publicRow).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      return json(200, { products, pricing: pricingConfig(), importerMode: rapidApi1688Ready() ? 'rapidapi-hybrid' : 'extension-fallback', rapidApiReady: rapidApi1688Ready(), rapidApiHost: rapidApi1688Ready() ? rapidApi1688Host() : '' });
    }
    if (action === 'applynormalizedimages') {
      const result = await applyNormalizedImages(db, body, actor);
      return json(200, result);
    }
    if (action === 'normalizeproductimages') {
      const result = await normalizeStoredProductImages(db, body.productId, actor);
      return json(200, result);
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
