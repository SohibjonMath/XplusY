/*
 * OrzuMall admin-only external marketplace catalog importer.
 * Sahiy, Uzum, 1688 and Pinduoduo share one dedicated external catalog model.
 * Chrome extension is the primary cross-market extractor; 1688 RapidAPI remains optional.
 */
const {
  admin, cleanText, json, parseBody, safe1688Url, itemIdFromUrl,
  calculatePrice, pricingConfig, requireAdmin, rateLimit,
  rapidApi1688Ready, rapidApi1688Host, fetch1688DetailByUrl, normalizeDetailResponse,
} = require('./_china1688Common');
const { MAX_IMAGES_PER_BATCH, IMAGE_STANDARD, copyImages, normalizeMarketplaceImageUrl } = require('./_china1688ImageStore');
const { calculateChinaLandedPrice, publicPolicy: externalPricingPolicy } = require('./_externalCatalogPricing');

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
    priceUzs: safeInt(row?.priceUzs ?? row?.priceUZS, 0, 1e12, 0),
    priceValue: safeNumber(row?.priceValue ?? row?.sourcePrice ?? row?.priceCny, 0, 1e12, 0),
    priceCurrency: cleanText(row?.priceCurrency || row?.currency, 16),
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
    selections: Object.fromEntries(Object.entries(row?.selections || row?.externalOptions || row?.chinaOptions || {}).slice(0, 12).map(([k, v]) => [cleanText(k, 120), cleanText(v, 160)]).filter(([k, v]) => k && v)),
    image: safeUrl(row?.image, 2200),
    stock: safeInt(row?.stock, 0, 1e9, 0),
    priceCny: safeNumber(row?.priceCny, 0, 1e8, 0),
    priceUzs: safeInt(row?.priceUzs ?? row?.priceUZS, 0, 1e12, 0),
    priceValue: safeNumber(row?.priceValue ?? row?.sourcePrice ?? row?.priceCny, 0, 1e12, 0),
    priceCurrency: cleanText(row?.priceCurrency || row?.currency, 16),
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


function customerGroupType(name = '', hint = '') {
  const raw = `${hint} ${name}`.toLowerCase();
  if (/(?:color|colour|rang|颜色|顏色|色彩)/i.test(raw)) return 'color';
  if (/(?:size|razmer|o['‘’]?lcham|尺码|尺寸|大小)/i.test(raw)) return 'size';
  if (/(?:规格|規格|型号|型號|款式|model|variant|spec)/i.test(raw)) return 'spec';
  return 'other';
}
function customerSlug(value = '', fallback = 'g') {
  const out = cleanText(value, 140).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
  return out || fallback;
}
function customerOption(value = {}, index = 0) {
  const row = typeof value === 'string' ? { name: value } : (value || {});
  const name = cleanVariantValue(row.name || row.label || row.value || row.text || '');
  if (!usableVariantValue(name)) return null;
  return {
    id: cleanText(row.id || `o${index + 1}`, 140),
    name,
    image: safeUrl(row.image || row.img || row.imageUrl || '', 2200),
    disabled: row.disabled === true,
  };
}
function dedupeCustomerOptions(rows = []) {
  const map = new Map();
  rows.forEach((row, index) => {
    const opt = customerOption(row, index);
    if (!opt) return;
    const key = opt.name.toLowerCase();
    const prev = map.get(key) || {};
    map.set(key, { ...prev, ...opt, image: opt.image || prev.image || '' });
  });
  return [...map.values()].slice(0, 96);
}
function customerGroup(value = {}, index = 0) {
  const row = value || {};
  const name = cleanText(row.name || row.label || `Variant ${index + 1}`, 160);
  const type = customerGroupType(name, row.type);
  const options = dedupeCustomerOptions(row.options || row.values || []);
  if (!options.length) return null;
  return {
    id: cleanText(row.id || customerSlug(name, `g${index + 1}`), 140),
    name,
    type,
    required: row.required !== false,
    options,
  };
}
function customerAttrValue(attributes = {}, group = {}) {
  const entries = Object.entries(attributes || {});
  const exact = entries.find(([key]) => cleanText(key, 160).toLowerCase() === cleanText(group.name, 160).toLowerCase());
  if (exact) return cleanVariantValue(exact[1]);
  const re = group.type === 'color'
    ? /(?:颜色|顏色|色彩|color|colour|rang)/i
    : group.type === 'size'
      ? /(?:尺码|尺寸|大小|size|razmer|o['‘’]?lcham)/i
      : group.type === 'spec'
        ? /(?:规格|規格|型号|型號|款式|model|variant|spec)/i
        : null;
  const hit = re ? entries.find(([key]) => re.test(cleanText(key, 160))) : null;
  return cleanVariantValue(hit?.[1] || '');
}
function upsertCustomerGroup(groupMap, raw = {}, fallbackIndex = 0) {
  const group = customerGroup(raw, fallbackIndex);
  if (!group) return;
  const key = `${group.type}::${group.name.toLowerCase()}`;
  const byType = [...groupMap.values()].find(x => ['color', 'size'].includes(group.type) && x.type === group.type);
  const existing = groupMap.get(key) || byType;
  if (existing) {
    existing.options = dedupeCustomerOptions([...(existing.options || []), ...(group.options || [])]);
    return;
  }
  groupMap.set(key, group);
}
function buildExternalCustomerCatalog(source = {}, fallbackPrice = 0) {
  const sourceGroups = sanitizeVariantGroups(source.variantGroups);
  const skuRows = sanitizeSkuVariants(source.skuVariants?.length ? source.skuVariants : source.variants);
  const groupMap = new Map();
  sourceGroups.forEach((group, idx) => upsertCustomerGroup(groupMap, group, idx));

  const colors = sourceColors(source);
  if (colors.length) upsertCustomerGroup(groupMap, { id: 'color', name: 'Rang', type: 'color', options: colors }, groupMap.size);
  const sizes = sourceSizes(source);
  if (sizes.length) upsertCustomerGroup(groupMap, { id: 'size', name: source.genericSpecName || 'O‘lcham / model', type: 'size', options: sizes.map(name => ({ name })) }, groupMap.size);

  skuRows.forEach(row => {
    Object.entries(row.attributes || {}).forEach(([name, value]) => {
      const option = customerOption({ name: value }, 0);
      if (!option) return;
      upsertCustomerGroup(groupMap, { id: customerSlug(name, `g${groupMap.size + 1}`), name, type: customerGroupType(name), options: [option] }, groupMap.size);
    });
    if (row.color) upsertCustomerGroup(groupMap, { id: 'color', name: 'Rang', type: 'color', options: [{ name: row.color, image: row.image }] }, groupMap.size);
    if (row.size) upsertCustomerGroup(groupMap, { id: 'size', name: source.genericSpecName || 'O‘lcham / model', type: 'size', options: [{ name: row.size }] }, groupMap.size);
  });

  let optionGroups = [...groupMap.values()].map((group, idx) => ({ ...group, id: cleanText(group.id || `g${idx + 1}`, 140) })).filter(group => group.options.length).slice(0, 8);

  if (!optionGroups.length && skuRows.length) {
    const fallbackRows = dedupeCustomerOptions(skuRows.map(row => ({ name: row.name || row.id, image: row.image })));
    if (fallbackRows.length) optionGroups = [{ id: 'variant', name: 'Variant', type: 'spec', required: true, options: fallbackRows }];
  }

  const ensureGroupOption = (group, value, image = '') => {
    const name = cleanVariantValue(value);
    if (!usableVariantValue(name)) return '';
    const hit = group.options.find(opt => opt.name.toLowerCase() === name.toLowerCase());
    if (hit) {
      if (!hit.image && image) hit.image = safeUrl(image, 2200);
      return hit.name;
    }
    group.options.push({ id: `o${group.options.length + 1}`, name, image: safeUrl(image, 2200), disabled: false });
    return name;
  };

  const rows = [];
  skuRows.forEach((row, idx) => {
    const selections = {};
    optionGroups.forEach(group => {
      let value = cleanVariantValue(row.selections?.[group.id] || '') || customerAttrValue(row.attributes, group);
      if (!value && group.type === 'color') value = row.color;
      if (!value && ['size', 'spec'].includes(group.type)) value = row.size;
      if (!value && optionGroups.length === 1) value = row.name;
      const normalized = ensureGroupOption(group, value, row.image);
      if (normalized) selections[group.id] = normalized;
    });
    if (!Object.keys(selections).length) return;
    const price = row.priceUzs || calculatePrice(row.priceCny).priceUzs || safeInt(fallbackPrice, 0, 1e12, 0);
    rows.push({
      id: cleanText(row.id || `sku${idx + 1}`, 160),
      skuId: cleanText(row.id || `sku${idx + 1}`, 160),
      name: cleanText(row.name || Object.values(selections).join(' / '), 300),
      selections,
      price,
      priceCny: safeNumber(row.priceCny, 0, 1e8, 0),
      stock: safeInt(row.stock, 0, 1e9, 0),
      image: safeUrl(row.image, 2200),
      disabled: false,
    });
  });

  const maxGenerated = 240;
  if (rows.length && optionGroups.length && rows.some(row => optionGroups.some(group => !row.selections?.[group.id]))) {
    const expanded = [];
    rows.forEach((row, rowIndex) => {
      let partial = [{ ...row, selections: { ...(row.selections || {}) } }];
      optionGroups.forEach(group => {
        if (partial.every(item => item.selections?.[group.id])) return;
        const next = [];
        partial.forEach(item => {
          if (item.selections?.[group.id]) { next.push(item); return; }
          group.options.forEach(option => {
            if (next.length + expanded.length >= maxGenerated) return;
            next.push({ ...item, id: `${item.id || `sku${rowIndex + 1}`}-${group.id}-${option.id}`, skuId: `${item.skuId || item.id || `sku${rowIndex + 1}`}-${group.id}-${option.id}`, name: cleanText(`${item.name || ''} / ${option.name}`, 300), selections: { ...(item.selections || {}), [group.id]: option.name }, image: item.image || option.image || '' });
          });
        });
        partial = next;
      });
      expanded.push(...partial.slice(0, Math.max(0, maxGenerated - expanded.length)));
    });
    rows.splice(0, rows.length, ...expanded.slice(0, maxGenerated));
  }
  if (!rows.length && optionGroups.length) {
    let combos = [{}];
    optionGroups.forEach(group => {
      const next = [];
      combos.forEach(combo => group.options.forEach(opt => {
        if (next.length < maxGenerated) next.push({ ...combo, [group.id]: opt.name });
      }));
      combos = next;
    });
    combos.slice(0, maxGenerated).forEach((selections, idx) => {
      const colorGroup = optionGroups.find(g => g.type === 'color');
      const colorValue = colorGroup ? selections[colorGroup.id] : '';
      const image = colorGroup?.options.find(opt => opt.name === colorValue)?.image || '';
      rows.push({
        id: `generated-${idx + 1}`,
        skuId: `generated-${idx + 1}`,
        name: Object.values(selections).join(' / '),
        selections,
        price: safeInt(fallbackPrice, 0, 1e12, 0),
        priceCny: safeNumber(source.priceCny, 0, 1e8, 0),
        stock: safeInt(source.stock, 0, 1e9, 0),
        image,
        disabled: false,
      });
    });
  }

  optionGroups = optionGroups.map(group => ({ ...group, options: dedupeCustomerOptions(group.options) }));
  const skuMap = new Map();
  rows.forEach(row => {
    const key = optionGroups.map(group => `${group.id}:${row.selections?.[group.id] || ''}`).join('|') || row.id;
    if (!skuMap.has(key)) skuMap.set(key, row);
  });
  const skus = [...skuMap.values()].slice(0, maxGenerated);
  return {
    version: 1,
    kind: 'external-market-catalog',
    optionGroups,
    skus,
    optionGroupCount: optionGroups.length,
    skuCount: skus.length,
    hasVariants: optionGroups.length > 0,
    sourceMode: source?.diagnostics?.mode || (skuRows.length ? 'source-sku' : 'admin-generated'),
  };
}
function catalogToLegacyVariants(catalog = {}) {
  const groups = Array.isArray(catalog.optionGroups) ? catalog.optionGroups : [];
  const colorGroup = groups.find(g => g.type === 'color');
  const sizeGroup = groups.find(g => ['size', 'spec'].includes(g.type));
  return (Array.isArray(catalog.skus) ? catalog.skus : []).map(row => ({
    color: colorGroup ? row.selections?.[colorGroup.id] || null : null,
    size: sizeGroup ? row.selections?.[sizeGroup.id] || null : null,
    price: safeInt(row.price, 0, 1e12, 0),
    stock: safeInt(row.stock, 0, 1e9, 0),
    stockQty: safeInt(row.stock, 0, 1e9, 0),
    sku: cleanText(row.skuId || row.id, 160),
    skuId: cleanText(row.skuId || row.id, 160),
    image: safeUrl(row.image, 2200),
    attributes: row.selections || {},
    chinaOptions: row.selections || {},
    externalOptions: row.selections || {},
  }));
}


function nowIso() { return new Date().toISOString(); }
function isStorageUrl(v) { return /^https:\/\/firebasestorage\.googleapis\.com\//i.test(String(v || '')); }
function isNormalizedStorageUrl(v) { return isStorageUrl(v) && /square-1200/i.test(String(v || '')); }

const EXTERNAL_SOURCES = {
  sahiy: { key: 'sahiy', label: 'Sahiy Market', shortLabel: 'Sahiy', currency: 'UZS', originCountry: 'CN', customerOrigin: 'Xitoydan', minDays: 20, maxDays: 20, hosts: ['sahiy.uz'] },
  uzum: { key: 'uzum', label: 'Uzum Market', shortLabel: 'Uzum', currency: 'UZS', originCountry: 'UZ', customerOrigin: 'O‘zbekistondan', minDays: 1, maxDays: 3, hosts: ['uzum.uz'] },
  '1688': { key: '1688', label: '1688', shortLabel: '1688', currency: 'CNY', originCountry: 'CN', customerOrigin: 'Xitoydan', minDays: 20, maxDays: 20, hosts: ['1688.com'] },
  pinduoduo: { key: 'pinduoduo', label: 'Pinduoduo', shortLabel: 'Pinduoduo', currency: 'CNY', originCountry: 'CN', customerOrigin: 'Xitoydan', minDays: 20, maxDays: 20, hosts: ['yangkeduo.com', 'pinduoduo.com'] },
};
function sourceSpec(key = '') { return EXTERNAL_SOURCES[cleanText(key, 40).toLowerCase()] || null; }
function hostMatches(host = '', root = '') { const h = String(host || '').toLowerCase(); return h === root || h.endsWith(`.${root}`); }
function detectExternalSource(rawUrl = '') {
  const s = cleanText(rawUrl, 2400); if (!s) return null;
  const candidates = [s, ...(s.match(/https?:\/\/[^\s<>"']+/gi) || [])];
  for (const raw of candidates) {
    try {
      const url = new URL(raw.replace(/[),.;]+$/, ''));
      if (!/^https?:$/i.test(url.protocol)) continue;
      for (const spec of Object.values(EXTERNAL_SOURCES)) {
        if (spec.hosts.some(root => hostMatches(url.hostname, root))) return { ...spec, url: url.toString() };
      }
    } catch (_e) {}
  }
  return null;
}
function safeSourceUrl(rawUrl = '') { return detectExternalSource(rawUrl)?.url || ''; }
function decodeRepeated(value = '') {
  let out = String(value || '');
  for (let i = 0; i < 4; i += 1) { try { const next = decodeURIComponent(out); if (next === out) break; out = next; } catch (_e) { break; } }
  return out;
}
function nestedExternalUrl(rawUrl = '') {
  const direct = safeSourceUrl(rawUrl); if (direct) return direct;
  const decoded = decodeRepeated(rawUrl); return safeSourceUrl(decoded);
}
function upstreamSourceUrl(rawUrl = '', explicit = '') {
  const direct = nestedExternalUrl(explicit); if (direct) return direct;
  const url = safeSourceUrl(rawUrl); if (!url) return '';
  try { const u = new URL(url); return nestedExternalUrl(u.searchParams.get('u') || ''); } catch (_e) { return ''; }
}
function sourceItemIdFromUrl(rawUrl = '', platform = '') {
  const url = safeSourceUrl(rawUrl); if (!url) return '';
  try {
    const u = new URL(url); const key = platform || detectExternalSource(url)?.key || '';
    if (key === 'sahiy') {
      const localSku = u.searchParams.get('sku') || u.searchParams.get('productId') || u.searchParams.get('id');
      if (localSku) return cleanText(localSku, 120).replace(/[^0-9A-Za-z_-]/g, '');
      const upstream = upstreamSourceUrl(url); if (upstream) return sourceItemIdFromUrl(upstream, detectExternalSource(upstream)?.key || '1688');
    }
    const path = `${u.pathname}${u.search}`;
    const patterns = key === '1688'
      ? [/(?:offer\/|offerId=|itemId=|id=)(\d{6,})/i, /\b(\d{8,})\b/]
      : key === 'pinduoduo'
        ? [/(?:goods_id|goodsId|id)=([0-9]{5,})/i, /(?:goods|product)[\/-]([0-9]{5,})/i]
        : key === 'uzum'
          ? [/(?:product|products)[\/-][^/?#]*?-([0-9]{4,})(?:[/?#]|$)/i, /(?:product|products)[\/-]([0-9]{4,})/i, /(?:id|productId)=([0-9]{4,})/i]
          : [/(?:products?|goods?|item)[\/-]([0-9A-Za-z_-]{4,})/i, /(?:id|productId|itemId)=([0-9A-Za-z_-]{4,})/i];
    for (const re of patterns) { const m = path.match(re); if (m) return cleanText(m[1], 120); }
    return cleanText(u.pathname.split('/').filter(Boolean).pop() || '', 120).replace(/[^0-9A-Za-z_-]/g, '');
  } catch (_e) { return ''; }
}
function externalMetaFromProduct(p = {}) {
  const legacy = p.china1688 || {};
  const ext = p.externalMarket || {};
  const url = safeSourceUrl(p.sourceUrl || ext.url || legacy.url || '');
  const detected = detectExternalSource(url || '') || sourceSpec(p.sourcePlatform) || sourceSpec(ext.platform) || sourceSpec('1688');
  return {
    ...ext,
    platform: cleanText(p.sourcePlatform || ext.platform || detected?.key || '1688', 40).toLowerCase(),
    sourceLabel: cleanText(p.sourceLabel || ext.sourceLabel || detected?.label || 'External Market', 80),
    originCountry: cleanText(p.originCountry || ext.originCountry || detected?.originCountry || 'CN', 4).toUpperCase(),
    customerOrigin: cleanText(p.customerOrigin || ext.customerOrigin || detected?.customerOrigin || 'Xitoydan', 40),
    url,
    upstreamUrl: upstreamSourceUrl(url, ext.upstreamUrl || legacy.upstreamUrl || ''),
    itemId: cleanText(p.sourceItemId || ext.itemId || legacy.itemId || sourceItemIdFromUrl(url, detected?.key), 120),
  };
}
function isExternalProduct(p = {}) {
  if (p.externalCatalog || p.externalMarket || p.sourceType === 'external-market-import') return true;
  const platform = cleanText(p.sourcePlatform, 40).toLowerCase();
  return !!sourceSpec(platform) || !!p.china1688 || !!p.china1688Catalog;
}
async function generateAdminProductId(db) {
  const counterRef = db.doc('meta/counters');
  return db.runTransaction(async tx => {
    const snap = await tx.get(counterRef); const data = snap.exists ? (snap.data() || {}) : {};
    let n = safeInt(data.aa, 0, 999999999, 0);
    for (let guard = 0; guard < 100; guard += 1) {
      n += 1; const id = `aa${String(n).padStart(3, '0')}`.toLowerCase(); const productRef = db.doc(`products/${id}`); const productSnap = await tx.get(productRef);
      if (!productSnap.exists) { tx.set(counterRef, { aa: n }, { merge: true }); return id; }
    }
    throw new Error('PRODUCT_ID_GENERATION_FAILED');
  });
}
async function findExistingExternal(db, platform, itemId, sourceUrl) {
  const cleanId = cleanText(itemId, 120); const cleanPlatform = cleanText(platform, 40).toLowerCase();
  if (cleanId) {
    const snap = await db.collection('products').where('sourceItemId', '==', cleanId).limit(16).get();
    const hit = snap.docs.find(doc => { const d = doc.data() || {}; return isExternalProduct(d) && cleanText(d.sourcePlatform, 40).toLowerCase() === cleanPlatform; });
    if (hit) return hit.id;
  }
  if (sourceUrl) {
    const snap = await db.collection('products').where('sourceUrl', '==', sourceUrl).limit(8).get();
    const hit = snap.docs.find(doc => isExternalProduct(doc.data() || {})); if (hit) return hit.id;
  }
  return '';
}
function sourceSummary(item = {}) {
  const sourceUrl = safeSourceUrl(item.url || item.sourceUrl || '');
  const detected = detectExternalSource(sourceUrl) || sourceSpec(item.sourcePlatform || item.platform) || sourceSpec('1688');
  const images = sanitizeImages(item.images);
  const priceValue = safeNumber(item.priceValue ?? item.sourcePrice ?? item.priceCny ?? item.priceUzs, 0, 1e12, 0);
  const priceCurrency = cleanText(item.priceCurrency || item.currency || detected.currency, 16).toUpperCase();
  return {
    id: cleanText(item.id || item.itemId || sourceItemIdFromUrl(sourceUrl, detected.key), 120), url: sourceUrl,
    upstreamUrl: upstreamSourceUrl(sourceUrl, item.upstreamUrl || item.originalUrl || ''),
    sourcePlatform: detected.key, sourceLabel: detected.label, originCountry: detected.originCountry, customerOrigin: detected.customerOrigin, priceCurrency, priceValue,
    title: cleanText(item.title || item.originalTitle, 520), image: safeUrl(item.image || images[0], 2200), images,
    priceCny: safeNumber(item.priceCny ?? (priceCurrency === 'CNY' ? priceValue : 0), 0, 1e8, 0),
    priceUzs: safeInt(item.priceUzs ?? item.priceUZS ?? (priceCurrency === 'UZS' ? priceValue : 0), 0, 1e12, 0),
    priceCnyMax: safeNumber(item.priceCnyMax, 0, 1e8, 0), pricing: item.pricing || calculatePrice(item.priceCny),
    moq: safeInt(item.moq, 1, 1e8, 1), stock: safeInt(item.stock, 0, 1e9, 0), unit: cleanText(item.unit, 32) || 'dona',
    sellerName: cleanText(item.sellerName, 220), sellerLocation: cleanText(item.sellerLocation, 220), deliveryFeeCny: safeNumber(item.deliveryFeeCny, 0, 1e8, 0),
    chinaDomesticFeeUzs: safeInt(item.chinaDomesticFeeUzs ?? item.domesticDeliveryFeeUzs ?? item.chinaDeliveryFeeUzs, 0, 1e12, 0),
    chinaFreeWeightKg: safeNumber(item.chinaFreeWeightKg ?? item.freeWeightKg, 0, 100000, 7),
    chinaExtraKgRateUzs: safeInt(item.chinaExtraKgRateUzs ?? item.extraKgRateUzs, 0, 1e12, 77777),
    serviceTags: sanitizeTags(item.serviceTags), props: sanitizeProps(item.props), variants: sanitizeSourceVariants(item.variants),
    galleryImages: sanitizeImages(item.galleryImages?.length ? item.galleryImages : images), variantImages: sanitizeImages(item.variantImages),
    colorOptions: sanitizeVariantOptions(item.colorOptions), sizeOptions: sanitizeVariantOptions(item.sizeOptions), variantGroups: sanitizeVariantGroups(item.variantGroups),
    skuVariants: sanitizeSkuVariants(item.skuVariants?.length ? item.skuVariants : item.variants), imagesByColor: sanitizeImagesByColor(item.imagesByColor),
    genericSpecName: cleanText(item.genericSpecName, 120),
    diagnostics: { ...(item.diagnostics || {}), mode: cleanText(item?.diagnostics?.mode, 50), sourcePlatform: detected.key },
    extractedAt: cleanText(item.extractedAt, 80), extractorVersion: cleanText(item.extractorVersion, 40),
  };
}
function buildDescription(source = {}) {
  const spec = sourceSpec(source.sourcePlatform) || sourceSpec('1688');
  const isChina = spec?.originCountry === 'CN';
  const lines = [isChina ? 'Xitoydan buyurtma asosida olib kelinadigan mahsulot. Yetkazib berish muddati taxminan 20 kun.' : 'O‘zbekiston ichidan yetkazib beriladigan mahsulot. Aniq yetkazish muddati savatda manzil tanlangandan keyin hisoblanadi.'];
  (source.props || []).slice(0, 12).forEach(p => { if (p.name && p.value) lines.push(`${p.name}: ${p.value}`); });
  return lines.join('\n');
}
function sanitizeDraft(raw = {}) {
  const sourceUrl = safeSourceUrl(raw.sourceUrl || raw?.source?.url); const detected = detectExternalSource(sourceUrl);
  if (!sourceUrl || !detected) throw Object.assign(new Error('Sahiy, Uzum Market, 1688 yoki Pinduoduo mahsulot havolasini kiriting.'), { statusCode: 400 });
  const itemId = cleanText(raw.itemId || raw?.source?.id || sourceItemIdFromUrl(sourceUrl, detected.key), 120);
  const source = sourceSummary({ ...(raw.source || {}), id: itemId, url: sourceUrl, sourcePlatform: detected.key });
  const images = sanitizeImages(raw.images?.length ? raw.images : source.images); const externalImages = sanitizeImages(raw.externalImages?.length ? raw.externalImages : source.images);
  const name = cleanText(raw.name || source.title, 360); if (!name) throw Object.assign(new Error('Mahsulot nomini kiriting.'), { statusCode: 400 });
  const weightKg = safeNumber(raw.weightKg, 0, 100000, 0);
  const sourcePriceUzs = safeInt(raw.sourcePriceUzs ?? source.priceUzs ?? (source.priceCny ? source.priceCny * pricingConfig().cnyToUzs : source.priceValue), 0, 1e12, 0);
  const chinaDomesticFeeUzs = safeInt(raw.chinaDomesticFeeUzs ?? source.chinaDomesticFeeUzs ?? (source.deliveryFeeCny ? source.deliveryFeeCny * pricingConfig().cnyToUzs : 0), 0, 1e12, 0);
  const isChina = detected.originCountry === 'CN';
  if (isChina && !sourcePriceUzs) throw Object.assign(new Error('Xitoy mahsuloti uchun manba narxini kiriting.'), { statusCode: 400 });
  if (isChina && !weightKg) throw Object.assign(new Error('Xitoy mahsuloti uchun taxminiy vaznni kg da kiriting.'), { statusCode: 400 });
  const chinaPricing = isChina ? calculateChinaLandedPrice({ sourcePriceUzs, sourcePriceCny: source.priceCny, chinaDomesticFeeUzs, weightKg, cnyToUzs: pricingConfig().cnyToUzs }) : null;
  const localAuto = source.priceUzs || 0;
  const price = isChina ? chinaPricing.finalPriceUzs : safeInt(raw.price, 0, 1e12, localAuto);
  if (!price) throw Object.assign(new Error('OrzuMall sotuv narxini kiriting.'), { statusCode: 400 });
  return {
    productId: cleanText(raw.productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, ''), sourceUrl, itemId, detected, source, images, externalImages, name,
    name_ru: cleanText(raw.name_ru || '', 360), description: cleanText(raw.description || buildDescription(source), 7000), price, oldPrice: safeInt(raw.oldPrice, 0, 1e12, 0),
    weightKg, sourcePriceUzs, chinaDomesticFeeUzs, chinaPricing, popularScore: safeInt(raw.popularScore, 0, 1e12, 50), tags: sanitizeTags(raw.tags?.length ? raw.tags : [detected.customerOrigin, 'Tashqi katalog', 'Buyurtma asosida']),
    deliveryMinDays: safeInt(raw.deliveryMinDays, 1, 365, detected.minDays), deliveryMaxDays: safeInt(raw.deliveryMaxDays, 1, 365, detected.maxDays), moq: safeInt(raw.moq ?? source.moq, 1, 1e8, 1), stock: safeInt(raw.stock ?? source.stock, 0, 1e9, 0),
    prepayRequired: isChina ? raw.prepayRequired !== false : raw.prepayRequired === true,
  };
}
function applyExternalCatalogPricing(catalog = {}, draft = {}) {
  if (!catalog || !Array.isArray(catalog.skus)) return catalog;
  const isChina = draft?.detected?.originCountry === 'CN';
  catalog.skus = catalog.skus.map(row => {
    if (!isChina) return { ...row, price: safeInt(row.price || draft.price, 0, 1e12, draft.price) };
    const sourcePriceUzs = row.priceCny ? Math.round(row.priceCny * pricingConfig().cnyToUzs) : draft.sourcePriceUzs;
    const pricing = calculateChinaLandedPrice({ sourcePriceUzs, sourcePriceCny: row.priceCny || 0, chinaDomesticFeeUzs: draft.chinaDomesticFeeUzs, weightKg: draft.weightKg, cnyToUzs: pricingConfig().cnyToUzs });
    return { ...row, price: pricing.finalPriceUzs, pricingSnapshot: pricing };
  });
  return catalog;
}
async function saveProduct(db, raw, actor) {
  const draft = sanitizeDraft(raw); let productId = draft.productId || await findExistingExternal(db, draft.detected.key, draft.itemId, draft.sourceUrl); if (!productId) productId = await generateAdminProductId(db);
  const ref = db.doc(`products/${productId}`); const existing = await ref.get(); if (existing.exists && !isExternalProduct(existing.data() || {})) throw Object.assign(new Error('Bu ID oddiy OrzuMall mahsulotiga tegishli.'), { statusCode: 409 });
  const ts = admin.firestore.FieldValue.serverTimestamp(); const source = draft.source;
  const catalog = applyExternalCatalogPricing({ ...buildExternalCustomerCatalog(source, draft.price), sourcePlatform: draft.detected.key, sourceLabel: draft.detected.label, originCountry: draft.detected.originCountry, customerOrigin: draft.detected.customerOrigin, sourceUrl: draft.sourceUrl, sourceUpstreamUrl: source.upstreamUrl || '', sourceItemId: draft.itemId }, draft);
  const legacyVariants = catalogToLegacyVariants(catalog); const storedCount = draft.images.filter(isStorageUrl).length; const normalizedCount = draft.images.filter(isNormalizedStorageUrl).length;
  const externalMarket = {
    platform: draft.detected.key, sourceLabel: draft.detected.label, originCountry: draft.detected.originCountry, customerOrigin: draft.detected.customerOrigin, itemId: draft.itemId, url: draft.sourceUrl, upstreamUrl: source.upstreamUrl || '', originalTitle: source.title, priceCurrency: source.priceCurrency, priceValue: source.priceValue,
    priceCny: source.priceCny, priceUzs: source.priceUzs, sourcePriceUzs: draft.sourcePriceUzs, chinaDomesticFeeUzs: draft.chinaDomesticFeeUzs, chinaPricing: draft.chinaPricing, moq: draft.moq, stock: draft.stock, unit: source.unit, sellerName: source.sellerName, sellerLocation: source.sellerLocation,
    props: source.props, galleryImages: sanitizeImages(source.galleryImages?.length ? source.galleryImages : draft.externalImages), variantImages: source.variantImages, colorOptions: source.colorOptions, sizeOptions: source.sizeOptions,
    variantGroups: source.variantGroups, skuVariants: source.skuVariants, imagesByColor: source.imagesByColor, diagnostics: source.diagnostics || {}, customerCatalog: catalog, externalImages: draft.externalImages,
    localImageCount: storedCount, normalizedImageCount: normalizedCount, imageStandard: draft.images.length && normalizedCount === draft.images.length ? IMAGE_STANDARD : '', importer: cleanText(source?.diagnostics?.importer || 'chrome-extension', 60), extractorVersion: source.extractorVersion, importedBy: actor.email, lastSyncedAt: ts,
  };
  const payload = {
    name: draft.name, name_ru: draft.name_ru, description: draft.description, price: draft.price, oldPrice: draft.oldPrice, weightKg: draft.weightKg, sourcePriceUzs: draft.sourcePriceUzs, chinaDomesticFeeUzs: draft.chinaDomesticFeeUzs, chinaPricing: draft.chinaPricing, popularScore: draft.popularScore, currency: 'UZS', images: draft.images,
    colors: sourceColors(source), sizes: sourceSizes(source), imagesByColor: source.imagesByColor, variants: legacyVariants.length ? legacyVariants : marketplaceVariants(source, draft.price), externalCatalog: catalog, externalMarket,
    tags: draft.tags, originCountry: draft.detected.originCountry, customerOrigin: draft.detected.customerOrigin, fulfillmentType: 'external_catalog', deliveryMinDays: Math.min(draft.deliveryMinDays, draft.deliveryMaxDays), deliveryMaxDays: Math.max(draft.deliveryMinDays, draft.deliveryMaxDays), prepayRequired: draft.prepayRequired,
    status: 'approved', isActive: true, ownerType: 'orzumall', createdByRole: 'admin', isOrzuMallVerified: true, sellerId: 'orzumall', sellerName: 'OrzuMall', sourceType: 'external-market-import', sourcePlatform: draft.detected.key, sourceLabel: draft.detected.label, sourceUrl: draft.sourceUrl, sourceItemId: draft.itemId, updatedAt: ts,
  };
  if (draft.detected.key === '1688') { payload.china1688Catalog = catalog; payload.china1688 = externalMarket; }
  if (!existing.exists) payload.createdAt = nowIso(); await ref.set(payload, { merge: true }); return { id: productId, created: !existing.exists, platform: draft.detected.key, sourceLabel: draft.detected.label, localImageCount: storedCount };
}
function stampMs(v) { try { if (!v) return 0; if (typeof v.toMillis === 'function') return v.toMillis(); if (typeof v.toDate === 'function') return v.toDate().getTime(); if (Number.isFinite(Number(v))) return Number(v); return Number(v.seconds || v._seconds || 0) * 1000; } catch (_e) { return 0; } }
function publicRow(doc) {
  const p = doc.data() || {}; const ext = externalMetaFromProduct(p); const images = sanitizeImages(p.images); const catalog = p.externalCatalog || p.china1688Catalog || ext.customerCatalog || {};
  return { id: doc.id, name: cleanText(p.name, 360), name_ru: cleanText(p.name_ru, 360), description: cleanText(p.description, 7000), price: safeInt(p.price, 0, 1e12, 0), oldPrice: safeInt(p.oldPrice, 0, 1e12, 0), image: images[0] || '', images,
    sourceUrl: ext.url, sourceUpstreamUrl: ext.upstreamUrl || '', sourcePlatform: ext.platform, sourceLabel: ext.sourceLabel, originCountry: ext.originCountry, customerOrigin: ext.customerOrigin, itemId: ext.itemId, priceValue: safeNumber(ext.priceValue, 0, 1e12, 0), priceCurrency: cleanText(ext.priceCurrency, 16), moq: safeInt(ext.moq, 1, 1e8, 1),
    fulfillmentType: cleanText(p.fulfillmentType, 32), isActive: p.isActive !== false, deliveryMinDays: safeInt(p.deliveryMinDays, 1, 365, sourceSpec(ext.platform)?.minDays || 20), deliveryMaxDays: safeInt(p.deliveryMaxDays, 1, 365, sourceSpec(ext.platform)?.maxDays || 20), tags: sanitizeTags(p.tags), weightKg: safeNumber(p.weightKg, 0, 100000, 0), sourcePriceUzs: safeInt(p.sourcePriceUzs ?? ext.sourcePriceUzs, 0, 1e12, 0), chinaDomesticFeeUzs: safeInt(p.chinaDomesticFeeUzs ?? ext.chinaDomesticFeeUzs, 0, 1e12, 0), chinaPricing: p.chinaPricing || ext.chinaPricing || null, popularScore: safeInt(p.popularScore, 0, 1e12, 0),
    colors: Array.isArray(p.colors) ? p.colors : [], sizes: Array.isArray(p.sizes) ? p.sizes : [], variants: Array.isArray(p.variants) ? p.variants : [], imagesByColor: p.imagesByColor || {}, externalCatalog: catalog, updatedAtMs: stampMs(p.updatedAt), localImageCount: safeInt(ext.localImageCount, 0, 1000, images.filter(isStorageUrl).length), imageStandard: cleanText(ext.imageStandard, 80), normalizedImageCount: safeInt(ext.normalizedImageCount, 0, 1000, images.filter(isNormalizedStorageUrl).length),
    source: sourceSummary({ ...ext, id: ext.itemId, url: ext.url, images: ext.externalImages?.length ? ext.externalImages : p.images }),
  };
}
async function requireExternalProduct(db, productId) { const id = cleanText(productId, 100).toLowerCase().replace(/[^a-z0-9_-]/g, ''); if (!id) throw Object.assign(new Error('PRODUCT_ID_REQUIRED'), { statusCode: 400 }); const ref = db.doc(`products/${id}`); const snap = await ref.get(); if (!snap.exists) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { statusCode: 404 }); const before = snap.data() || {}; if (!isExternalProduct(before)) throw Object.assign(new Error('NOT_EXTERNAL_PRODUCT'), { statusCode: 409 }); return { id, ref, before, ext: externalMetaFromProduct(before) }; }
async function applyNormalizedImages(db, raw = {}, actor) { const { id, ref, before, ext } = await requireExternalProduct(db, raw.productId); const images = sanitizeImages(raw.images); if (!images.length) throw Object.assign(new Error('PRODUCT_IMAGES_NOT_FOUND'), { statusCode: 400 }); const externalImages = sanitizeImages(raw.externalImages?.length ? raw.externalImages : ext.externalImages); const storedCount = images.filter(isStorageUrl).length; const normalizedCount = images.filter(isNormalizedStorageUrl).length; const ts = admin.firestore.FieldValue.serverTimestamp(); await ref.set({ images, externalMarket: { externalImages, localImageCount: storedCount, normalizedImageCount: normalizedCount, imageStandard: normalizedCount ? IMAGE_STANDARD : '', imageNormalizedBy: actor.email, imageNormalizedAt: ts }, updatedAt: ts }, { merge: true }); return { id, images, copied: storedCount, normalized: normalizedCount, failed: Math.max(0, images.length - storedCount), standard: normalizedCount ? IMAGE_STANDARD : '' }; }
async function normalizeStoredProductImages(db, productId, actor) { const { id, ref, before, ext } = await requireExternalProduct(db, productId); const rawUrls = sanitizeImages(ext.externalImages?.length ? ext.externalImages : before.images); if (!rawUrls.length) throw Object.assign(new Error('PRODUCT_IMAGES_NOT_FOUND'), { statusCode: 400 }); const copied = [], failed = []; for (let i = 0; i < rawUrls.length; i += MAX_IMAGES_PER_BATCH) { const result = await copyImages(rawUrls.slice(i, i + MAX_IMAGES_PER_BATCH), `${id}-normalized`, { normalize: true }); copied.push(...(result.copied || [])); failed.push(...(result.failed || [])); } if (!copied.length) throw Object.assign(new Error('IMAGE_NORMALIZATION_FAILED'), { statusCode: 502 }); const finalImages = [...copied.map(x => x.url), ...failed.map(x => x.sourceUrl)].slice(0, 18); const ts = admin.firestore.FieldValue.serverTimestamp(); await ref.set({ images: finalImages, externalMarket: { externalImages: rawUrls, localImageCount: copied.length, normalizedImageCount: copied.filter(x => x.normalized).length, imageStandard: IMAGE_STANDARD, imageNormalizedBy: actor.email, imageNormalizedAt: ts }, updatedAt: ts }, { merge: true }); return { id, images: finalImages, copied: copied.length, normalized: copied.filter(x => x.normalized).length, failed: failed.length, standard: IMAGE_STANDARD }; }
async function rebuildStoredCustomerCatalog(db, productId, actor) { const { id, ref, before, ext } = await requireExternalProduct(db, productId); const source = sourceSummary({ ...ext, id: ext.itemId, url: ext.url, title: ext.originalTitle || before.name, images: ext.externalImages?.length ? ext.externalImages : before.images, galleryImages: ext.galleryImages?.length ? ext.galleryImages : (ext.externalImages?.length ? ext.externalImages : before.images), variantGroups: ext.variantGroups?.length ? ext.variantGroups : before.variantGroups, skuVariants: ext.skuVariants?.length ? ext.skuVariants : before.variants, variants: ext.variants?.length ? ext.variants : before.variants, colorOptions: ext.colorOptions?.length ? ext.colorOptions : before.colors, sizeOptions: ext.sizeOptions?.length ? ext.sizeOptions : before.sizes, imagesByColor: ext.imagesByColor && Object.keys(ext.imagesByColor).length ? ext.imagesByColor : before.imagesByColor }); const catalog = { ...buildExternalCustomerCatalog(source, safeInt(before.price, 0, 1e12, 0)), sourcePlatform: ext.platform, sourceLabel: ext.sourceLabel, originCountry: ext.originCountry, customerOrigin: ext.customerOrigin, sourceUrl: ext.url, sourceUpstreamUrl: ext.upstreamUrl || source.upstreamUrl || '', sourceItemId: ext.itemId }; const variants = catalogToLegacyVariants(catalog); const ts = admin.firestore.FieldValue.serverTimestamp(); await ref.set({ externalCatalog: catalog, ...(ext.platform === '1688' ? { china1688Catalog: catalog } : {}), colors: sourceColors(source), sizes: sourceSizes(source), ...(variants.length ? { variants } : {}), externalMarket: { customerCatalog: catalog, catalogRebuiltBy: actor.email, catalogRebuiltAt: ts }, updatedAt: ts }, { merge: true }); return { id, optionGroupCount: catalog.optionGroupCount || 0, skuCount: catalog.skuCount || 0, hasVariants: catalog.hasVariants === true }; }
exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {}); if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }); const body = parseBody(event); if (body == null) return json(400, { error: 'INVALID_JSON' }); const limited = rateLimit(event, 'external-catalog-admin', 120, 10 * 60 * 1000); if (!limited.ok) return json(429, { error: 'TOO_MANY_REQUESTS', retryAfterSec: limited.retryAfterSec }); const actor = await requireAdmin(event); if (!actor.ok) return json(actor.statusCode, { error: actor.error }); const db = admin.firestore(); const action = cleanText(body.action || '', 50).toLowerCase();
  try {
    if (action === 'apipreview') { const detected = detectExternalSource(body.sourceUrl || body.url); if (!detected) return json(400, { error: 'SOURCE_URL_REQUIRED', message: 'Sahiy, Uzum Market, 1688 yoki Pinduoduo mahsulot havolasini kiriting.' }); if (detected.key !== '1688') return json(200, { item: sourceSummary({ url: detected.url, sourcePlatform: detected.key }), platform: detected.key, sourceLabel: detected.label, manualRequired: true, message: `${detected.label} uchun sahifani Chrome importer orqali yuboring yoki ma’lumotlarni qo‘lda to‘ldiring.` }); const fetched = await fetch1688DetailByUrl(detected.url, { force: body.force === true }); const item = normalizeDetailResponse(fetched.raw); item.url = detected.url; item.id = item.id || itemIdFromUrl(detected.url); item.sourcePlatform = '1688'; item.sourceLabel = '1688'; item.diagnostics = { ...(item.diagnostics || {}), provider: fetched.provider, cached: fetched.cached === true }; return json(200, { item, provider: fetched.provider, cached: fetched.cached === true, pricing: pricingConfig() }); }
    if (action === 'copyimages') { const itemId = cleanText(body.itemId || 'draft', 100).replace(/[^a-z0-9_-]/gi, '') || 'draft'; const result = await copyImages(body.urls, itemId, { normalize: body.normalize !== false, strictNormalize: body.strictNormalize === true }); return json(200, { ...result, maxPerBatch: MAX_IMAGES_PER_BATCH, imageStandard: IMAGE_STANDARD }); }
    if (action === 'save') return json(200, await saveProduct(db, body.product || {}, actor));
    if (action === 'list') { const snap = await db.collection('products').limit(600).get(); const products = snap.docs.filter(doc => isExternalProduct(doc.data() || {})).map(publicRow).sort((a, b) => b.updatedAtMs - a.updatedAtMs); return json(200, { products, pricing: pricingConfig(), chinaPricingPolicy: externalPricingPolicy(), supportedPlatforms: Object.values(EXTERNAL_SOURCES).map(x => ({ key: x.key, label: x.label })), rapidApiReady: rapidApi1688Ready(), rapidApiHost: rapidApi1688Ready() ? rapidApi1688Host() : '' }); }
    if (action === 'applynormalizedimages') return json(200, await applyNormalizedImages(db, body, actor));
    if (action === 'normalizeproductimages') return json(200, await normalizeStoredProductImages(db, body.productId, actor));
    if (action === 'rebuildcustomercatalog') return json(200, await rebuildStoredCustomerCatalog(db, body.productId, actor));
    if (action === 'archive') { const { ref } = await requireExternalProduct(db, body.productId); await ref.set({ isActive: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); return json(200, { ok: true }); }
    return json(400, { error: 'UNKNOWN_ACTION' });
  } catch (e) { return json(e.statusCode || 500, { error: e.code || e.message || 'IMPORT_FAILED', message: e.message || 'IMPORT_FAILED' }); }
};
