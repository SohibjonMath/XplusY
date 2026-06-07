(() => {
  const VERSION = '1.5.0';
  const BUTTON_ID = 'orzumall-1688-import-btn';
  const MAX_GALLERY = 18;
  const MAX_VARIANT_GROUPS = 8;
  const MAX_OPTIONS = 48;
  const MAX_SKUS = 180;
  const MAX_PROPS = 36;

  const text = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const uniq = rows => [...new Set((rows || []).filter(Boolean))];
  const compact = (arr, max) => uniq(arr).slice(0, max);
  const safeJsonClone = value => { try { return JSON.parse(JSON.stringify(value)); } catch (_e) { return null; } };
  const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

  const absUrl = value => {
    let raw = text(value)
      .replace(/&amp;/g, '&')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/^url\(["']?|["']?\)$/g, '');
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
    try {
      const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw, location.href);
      if (url.protocol === 'http:' && /(?:^|\.)(?:alicdn\.com|1688\.com|tbcdn\.cn|alibabausercontent\.com)$/i.test(url.hostname)) url.protocol = 'https:';
      url.hash = '';
      return url.toString();
    } catch (_e) { return ''; }
  };
  const itemId = () => (location.href.match(/(?:offer\/|offerId=|itemId=|id=)(\d{6,})/i) || location.href.match(/\b(\d{8,})\b/))?.[1] || '';
  const isProductCdnUrl = url => /(?:\/img\/ibank\/|cbu\d*\.alicdn\.com\/img\/ibank\/|alicdn\.com\/imgextra\/)/i.test(url);
  const isImageUrl = url => /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url) || isProductCdnUrl(url);
  const badImageHint = /(?:icon|logo|sprite|avatar|qrcode|qr-code|qr_|service|shield|truck|delivery|warranty|loading|placeholder|default|emoji|favicon|coupon|guarantee|protect|cart|chat|tip|blank|badge|security|safe|wangwang|ww-online|video-play|parameter)/i;
  const variantContextHint = /(?:sku|spec|variant|saleprop|sale-prop|color|colour|颜色|尺码|尺寸|规格|款式|型号|属性)/i;
  const galleryContextHint = /(?:gallery|detail-gallery|main-image|mainimage|main-img|preview|thumbnail|thumb|carousel|album|image-list|imagelist|pic-list|piclist)/i;

  const attrRows = node => {
    if (!node) return [];
    const rows = [node.currentSrc];
    ['src', 'data-src', 'data-lazy-src', 'data-lazyload-src', 'data-original', 'data-origin-src', 'data-zoom-image', 'data-image', 'data-ks-lazyload', 'data-url', 'data-img', 'data-pic'].forEach(a => rows.push(node.getAttribute?.(a)));
    const srcset = node.getAttribute?.('srcset');
    if (srcset) srcset.split(',').forEach(part => rows.push(part.trim().split(/\s+/)[0]));
    const styleBg = node.style?.backgroundImage?.match(/url\(["']?(.+?)["']?\)/)?.[1];
    if (styleBg) rows.push(styleBg);
    return compact(rows.map(absUrl).filter(u => u && isImageUrl(u) && !badImageHint.test(u)), 12);
  };
  const firstNodeImage = node => attrRows(node?.matches?.('img') ? node : node?.querySelector?.('img'))[0] || '';
  const contextText = node => {
    let cur = node; const parts = [];
    for (let i = 0; cur && i < 4; i += 1, cur = cur.parentElement) parts.push(`${cur.tagName || ''} ${cur.id || ''} ${cur.className || ''} ${cur.getAttribute?.('data-testid') || ''}`);
    return parts.join(' ');
  };
  const isVariantContext = node => variantContextHint.test(contextText(node));
  const isGalleryContext = node => galleryContextHint.test(contextText(node));

  const scriptTexts = () => [...document.scripts].map(s => s.textContent || '').filter(s => s.length > 20 && s.length < 2800000).slice(0, 120);
  const parsedScriptRoots = () => {
    const roots = [];
    document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]').forEach(s => {
      try { const v = JSON.parse(s.textContent || ''); if (v) roots.push(v); } catch (_e) {}
    });
    for (const raw of scriptTexts()) {
      const t = raw.trim();
      if (!t) continue;
      if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try { const v = JSON.parse(t); if (v) roots.push(v); } catch (_e) {}
      }
      const assign = t.match(/(?:window\.)?(?:__\w+__|INIT_DATA|INITIAL_STATE|pageData|offerData|detailData)\s*=\s*({[\s\S]*}|\[[\s\S]*\])\s*;?\s*$/i);
      if (assign) { try { const v = JSON.parse(assign[1]); if (v) roots.push(v); } catch (_e) {} }
    }
    return roots.slice(0, 30);
  };
  const walk = (root, visitor, path = [], depth = 0, seen = new Set()) => {
    if (root == null || depth > 11 || seen.has(root)) return;
    if (typeof root === 'object') seen.add(root);
    visitor(root, path);
    if (Array.isArray(root)) root.slice(0, 800).forEach((v, i) => walk(v, visitor, [...path, String(i)], depth + 1, seen));
    else if (isPlainObject(root)) Object.entries(root).slice(0, 1000).forEach(([k, v]) => walk(v, visitor, [...path, k], depth + 1, seen));
  };

  const numberFrom = value => {
    const n = String(value || '').replace(/,/g, '.').match(/\d+(?:\.\d+)?/);
    return n ? Number(n[0]) : 0;
  };
  const rangeFrom = value => {
    const nums = (String(value || '').replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n < 100000000);
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 };
  };
  const visibleText = () => text(document.body?.innerText || '').slice(0, 400000);

  function cleanOptionLabel(value = '') {
    return text(value)
      .replace(/(?:库存|庫存|stock|qoldiq|остаток)\s*[:：]?\s*\d+[\s\S]*$/i, '')
      .replace(/(?:¥|￥)\s*\d+(?:[.,]\d+)?[\s\S]*$/i, '')
      .replace(/^[\s:：/_-]+|[\s:：/_-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }
  const badVariantText = /(?:主面料|面料|材质|成分|工艺|品牌|货号|库存|庫存|起批|价格|运费|评价|参数|商品属性|包装|详情|¥|￥|stock|qoldiq|material|fabric|brand|price|delivery)/i;
  const sizeToken = /^(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|[2-9]xl|均码|free|one\s*size|(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|[2-9]xl)码|\d{2,3}(?:\s*(?:cm|码))?)$/i;
  function looksLikeSize(value = '') { const v = cleanOptionLabel(value); return !!v && v.length <= 18 && sizeToken.test(v); }
  function usableVariantName(value = '', type = 'other', image = '') {
    const v = cleanOptionLabel(value);
    if (!v || v.length > 48 || badVariantText.test(v)) return false;
    if (type === 'size') return looksLikeSize(v);
    if (type === 'color') return !!image || (v.length <= 28 && !/^(?:s|m|l|xl|xxl|xxxl|[2-9]xl|\d{2,3})$/i.test(v));
    return v.length <= 36;
  }

  function classifyGroup(label = '', index = 0) {
    const s = text(label).toLowerCase();
    if (/(?:颜色|顏色|颜色分类|色彩|colour|color|rang)/i.test(s)) return 'color';
    if (/(?:尺码|尺寸|大小|规格尺寸|size|razmer|o['‘’]?lcham)/i.test(s)) return 'size';
    return 'other';
  }
  function inferGroupType(group = {}, index = 0) {
    const direct = classifyGroup(group.name, index);
    if (direct !== 'other') return direct;
    const names = (group.options || []).map(o => cleanOptionLabel(o?.name)).filter(Boolean);
    if (names.length >= 2 && names.every(v => /^(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|[2-8]xl|\d{2,3}(?:cm)?)$/i.test(v))) return 'size';
    const withImages = (group.options || []).filter(o => !!o?.image).length;
    if (names.length >= 2 && withImages >= Math.ceil(names.length / 2) && !/(?:面料|材质|成分|工艺|brand|material|fabric)/i.test(text(group.name))) return 'color';
    return 'other';
  }
  function optionName(v) {
    if (typeof v === 'string' || typeof v === 'number') return text(v);
    return text(v?.name ?? v?.value ?? v?.label ?? v?.text ?? v?.valueName ?? v?.value_name ?? v?.propValue ?? v?.prop_value ?? v?.skuValue ?? v?.specName ?? v?.title);
  }
  function optionId(v, fallback = '') {
    if (!isPlainObject(v)) return text(fallback);
    return text(v.id ?? v.valueId ?? v.value_id ?? v.vid ?? v.propValueId ?? v.prop_value_id ?? v.specId ?? v.spec_id ?? v.skuValueId ?? fallback);
  }
  function optionImage(v) {
    if (!isPlainObject(v)) return '';
    const raw = v.image ?? v.imageUrl ?? v.image_url ?? v.picUrl ?? v.pic_url ?? v.thumbnail ?? v.imgUrl ?? v.img_url ?? v.picture;
    if (Array.isArray(raw)) return raw.map(absUrl).find(Boolean) || '';
    return absUrl(raw);
  }
  function normalizeOption(v, index = 0) {
    const name = cleanOptionLabel(optionName(v));
    if (!name) return null;
    return { id: optionId(v, `o${index + 1}`), name: name.slice(0, 120), image: optionImage(v), disabled: Boolean(v?.disabled || v?.soldOut || v?.sold_out) };
  }
  function normalizeGroup(v, index = 0) {
    if (!isPlainObject(v)) return null;
    const name = text(v.name ?? v.label ?? v.title ?? v.propName ?? v.prop_name ?? v.attributeName ?? v.attribute_name ?? v.specName ?? v.spec_name ?? v.key);
    const values = v.values ?? v.options ?? v.children ?? v.valueList ?? v.value_list ?? v.propValues ?? v.prop_values ?? v.specs ?? v.items ?? v.list;
    if (!Array.isArray(values) || !values.length) return null;
    const options = values.slice(0, MAX_OPTIONS).map(normalizeOption).filter(Boolean);
    if (!options.length) return null;
    return { id: text(v.id ?? v.pid ?? v.propId ?? v.prop_id ?? v.specId ?? v.spec_id ?? `g${index + 1}`), name: name || `Variant ${index + 1}`, type: classifyGroup(name, index), options };
  }

  function readGroupsFromScripts() {
    const candidates = [];
    const keys = /(?:skuProps|sku_props|saleProps|sale_props|skuProperties|sku_properties|specProps|spec_props|productSKUProps|skuPropList|sku_prop_list|skuAttributes|sku_attributes)/i;
    parsedScriptRoots().forEach(root => walk(root, (v, path) => {
      const key = path[path.length - 1] || '';
      if (!keys.test(key) || !Array.isArray(v)) return;
      const groups = v.slice(0, MAX_VARIANT_GROUPS).map(normalizeGroup).filter(Boolean);
      if (groups.length) candidates.push(groups);
    }));
    return candidates.sort((a, b) => b.reduce((n, g) => n + g.options.length, 0) - a.reduce((n, g) => n + g.options.length, 0))[0] || [];
  }

  function ownLabel(el) {
    return text([...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(' '));
  }
  function domOptionNodes(container, labelNode, type = 'other') {
    const selectors = ['button','li','[role="option"]','[data-sku-id]','[data-prop-value-id]','[data-value-id]','[class*="sku-item"]','[class*="skuItem"]','[class*="spec-item"]','[class*="specItem"]','[class*="prop-item"]','[class*="propItem"]','[class*="value-item"]','[class*="valueItem"]'];
    return [...container.querySelectorAll(selectors.join(','))]
      .filter(n => n !== labelNode && !n.contains(labelNode))
      .filter(n => !n.closest('table,[class*="parameter"],[class*="attribute-table"],[class*="detail-attribute"]'))
      .filter(n => {
        const image = firstNodeImage(n);
        const name = cleanOptionLabel(n.getAttribute('title') || n.getAttribute('aria-label') || ownLabel(n) || n.innerText || n.textContent);
        const box = n.getBoundingClientRect?.();
        return usableVariantName(name, type, image) && (!box || box.width >= 14 || box.height >= 14);
      });
  }
  function readGroupsFromDom() {
    const labels = /^(?:颜色|顏色|颜色分类|色彩|尺码|尺寸|大小|规格|款式|型号|color|size)[:：]?$/i;
    const exactNodes = [...document.querySelectorAll('span,div,label,dt,th,p')].filter(n => labels.test(text(n.textContent)));
    const groups = [];
    exactNodes.forEach((labelNode, gi) => {
      if (labelNode.closest('table,[class*="parameter"],[class*="attribute-table"],[class*="detail-attribute"]')) return;
      const name = text(labelNode.textContent).replace(/[:：]/g, '');
      const type = classifyGroup(name, groups.length);
      let container = labelNode.parentElement;
      for (let hop = 0; container && hop < 3; hop += 1, container = container.parentElement) {
        const nodes = domOptionNodes(container, labelNode, type);
        const options = [];
        nodes.forEach((node, index) => {
          const image = firstNodeImage(node);
          const option = cleanOptionLabel(node.getAttribute('title') || node.getAttribute('aria-label') || ownLabel(node) || node.innerText || node.textContent);
          if (!usableVariantName(option, type, image)) return;
          if (!options.some(o => o.name === option)) options.push({ id: text(node.getAttribute('data-sku-id') || node.getAttribute('data-prop-value-id') || node.getAttribute('data-value-id') || `d${gi + 1}_${index + 1}`), name: option, image, disabled: /disabled|soldout|sold-out/i.test(`${node.className || ''} ${node.getAttribute('aria-disabled') || ''}`) });
        });
        if (options.length >= 2 && options.length <= MAX_OPTIONS) { groups.push({ id: `dom${gi + 1}`, name, type, options }); break; }
      }
    });
    const merged = [];
    groups.forEach(g => {
      const existing = merged.find(x => x.type === g.type && x.name === g.name);
      if (!existing) merged.push(g);
      else g.options.forEach(o => { if (!existing.options.some(x => x.name === o.name)) existing.options.push(o); });
    });
    return merged.slice(0, MAX_VARIANT_GROUPS);
  }
  function mergeGroups(scriptGroups, domGroups) {

    const result = safeJsonClone(scriptGroups) || [];
    domGroups.forEach(group => {
      let target = result.find(g => g.type === group.type) || result.find(g => text(g.name) === text(group.name));
      if (!target) { result.push(group); return; }
      group.options.forEach(o => {
        const old = target.options.find(x => x.name === o.name);
        if (!old) target.options.push(o);
        else if (!old.image && o.image) old.image = o.image;
      });
    });
    return result.slice(0, MAX_VARIANT_GROUPS).map((g, i) => {
      const type = inferGroupType(g, i);
      const options = compact(g.options.map(o => JSON.stringify({ ...o, name: cleanOptionLabel(o.name) })).filter(Boolean), MAX_OPTIONS).map(s => JSON.parse(s)).filter(o => usableVariantName(o.name, type, o.image));
      return { ...g, type, options };
    }).filter(g => g.options.length >= 2);
  }

  function readSkuRowsFromScripts() {
    const arrays = [];
    const maps = [];
    const arrayKey = /(?:skuList|sku_list|skus|skuInfos|sku_infos|skuInfoList|sku_info_list|skuItems|sku_items)/i;
    const mapKey = /(?:skuMap|sku_map|skuInfoMap|sku_info_map|skuMapInfo|skuCore)/i;
    parsedScriptRoots().forEach(root => walk(root, (v, path) => {
      const key = path[path.length - 1] || '';
      if (arrayKey.test(key) && Array.isArray(v) && v.length && v.length <= 2000) arrays.push(v);
      if (mapKey.test(key) && isPlainObject(v) && Object.keys(v).length && Object.keys(v).length <= 2000) maps.push(v);
    }));
    const rows = [];
    arrays.forEach(arr => arr.forEach(v => { if (isPlainObject(v)) rows.push(v); }));
    maps.forEach(map => Object.entries(map).forEach(([key, v]) => rows.push({ ...(isPlainObject(v) ? v : {}), __key: key })));
    return rows.slice(0, 1000);
  }
  function splitSkuName(raw = '') {
    return text(raw).replace(/[;；]/g, ';').split(/[;|,，/]/).map(v => cleanOptionLabel(v.replace(/^\d+[:：]/, '').replace(/^[-_:：]+/, ''))).filter(Boolean);
  }
  function skuAttributePairs(raw = '') {
    const attrs = {};
    text(raw).replace(/[;；|]/g, ';').split(';').forEach(part => {
      const m = text(part).match(/^(.{1,80}?)[：:](.{1,140})$/);
      if (!m) return;
      const key = cleanOptionLabel(m[1]); const value = cleanOptionLabel(m[2]);
      if (key && value) attrs[key] = value;
    });
    return attrs;
  }
  function attrByKind(attrs = {}, kind = '') {
    const re = kind === 'color' ? /(?:颜色|顏色|色彩|color|colour|rang)/i : /(?:尺码|尺寸|大小|size|razmer|o['‘’]?lcham)/i;
    const hit = Object.entries(attrs).find(([key]) => re.test(key));
    return cleanOptionLabel(hit?.[1] || '');
  }
  function skuPrice(v) { return numberFrom(v?.price ?? v?.salePrice ?? v?.sale_price ?? v?.skuPrice ?? v?.sku_price ?? v?.discountPrice ?? v?.discount_price ?? v?.priceRange ?? v?.price_range); }
  function skuStock(v) { return Math.max(0, Number(v?.stock ?? v?.stockQty ?? v?.stock_qty ?? v?.quantity ?? v?.amountOnSale ?? v?.amount_on_sale ?? v?.canBookCount ?? 0) || 0); }
  function skuRecord(v, index, groups) {
    const directName = text(v?.name ?? v?.title ?? v?.spec ?? v?.skuName ?? v?.sku_name ?? v?.propertiesName ?? v?.properties_name ?? v?.propsNames ?? v?.props_names ?? v?.__key);
    const values = Array.isArray(v?.attributes) ? v.attributes.map(optionName).map(cleanOptionLabel).filter(Boolean) : splitSkuName(directName);
    const attrs = { ...skuAttributePairs(directName) };
    if (isPlainObject(v?.attributes)) Object.entries(v.attributes).forEach(([k, val]) => { const key = cleanOptionLabel(k), value = cleanOptionLabel(optionName(val) || val); if (key && value) attrs[key] = value; });
    groups.forEach(group => {
      const found = values.find(bit => group.options.some(o => cleanOptionLabel(o.name) === bit)) || '';
      if (found) attrs[group.name] = found;
    });
    const colorGroup = groups.find(g => g.type === 'color');
    const sizeGroup = groups.find(g => g.type === 'size');
    const color = cleanOptionLabel(attrByKind(attrs, 'color') || (colorGroup ? attrs[colorGroup.name] || values.find(bit => colorGroup.options.some(o => cleanOptionLabel(o.name) === bit)) || '' : ''));
    const size = cleanOptionLabel(attrByKind(attrs, 'size') || (sizeGroup ? attrs[sizeGroup.name] || values.find(bit => sizeGroup.options.some(o => cleanOptionLabel(o.name) === bit)) || '' : ''));
    const image = absUrl(v?.image ?? v?.imageUrl ?? v?.image_url ?? v?.picUrl ?? v?.pic_url ?? v?.thumbnail) || colorGroup?.options.find(o => o.name === color)?.image || '';
    return { id: text(v?.skuId ?? v?.sku_id ?? v?.id ?? v?.specId ?? v?.spec_id ?? `sku${index + 1}`), name: directName || values.join(' / ') || `SKU ${index + 1}`, color, size, attributes: attrs, image, stock: skuStock(v), priceCny: skuPrice(v) };
  }
  function cartesianSkuFallback(groups, basePrice) {
    if (!groups.length) return [];
    const relevant = groups.filter(g => ['color', 'size'].includes(g.type)).slice(0, 2);
    if (!relevant.length) return [];
    let rows = [{ attributes: {} }];
    relevant.forEach(group => {
      rows = rows.flatMap(row => group.options.map(o => ({ attributes: { ...row.attributes, [group.name]: o.name } }))).slice(0, MAX_SKUS);
    });
    const colorGroup = relevant.find(g => g.type === 'color'); const sizeGroup = relevant.find(g => g.type === 'size');
    return rows.map((row, i) => {
      const color = colorGroup ? row.attributes[colorGroup.name] || '' : '';
      const size = sizeGroup ? row.attributes[sizeGroup.name] || '' : '';
      return { id: `fallback${i + 1}`, name: [color, size].filter(Boolean).join(' / '), color, size, attributes: row.attributes, image: colorGroup?.options.find(o => o.name === color)?.image || '', stock: 0, priceCny: basePrice };
    });
  }

  function galleryImages(variantImages = []) {
    const found = new Map(); let order = 0;
    const variants = new Set(variantImages.map(absUrl).filter(Boolean));
    const add = (raw, score = 0, node = null, origin = '') => {
      const url = absUrl(raw); if (!url || !isImageUrl(url) || badImageHint.test(url)) return;
      const box = node?.getBoundingClientRect?.(); const w = Number(node?.naturalWidth || box?.width || 0); const h = Number(node?.naturalHeight || box?.height || 0);
      if (w && h && w < 70 && h < 70) return;
      if (variants.has(url) && origin !== 'cover' && origin !== 'main') return;
      let total = score + (isProductCdnUrl(url) ? 70 : 0) + ((w >= 260 || h >= 260) ? 20 : 0);
      const old = found.get(url); if (!old || total > old.score) found.set(url, { url, score: total, order: order++ });
    };
    document.querySelectorAll('meta[property="og:image"],meta[name="og:image"],meta[itemprop="image"]').forEach(n => add(n.content, 300, null, 'cover'));
    const selectors = [
      '[class*="detail-gallery"] img','[class*="detailGallery"] img','[class*="main-image"] img','[class*="mainImage"] img','[class*="main-img"] img',
      '[class*="gallery"] img','[class*="preview"] img','[class*="thumbnail"] img','[class*="thumb"] img','[class*="carousel"] img','[class*="album"] img','[class*="pic-list"] img'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(img => {
      if (isVariantContext(img) && !isGalleryContext(img)) return;
      attrRows(img).forEach(url => add(url, isGalleryContext(img) ? 180 : 115, img, 'gallery'));
    });
    // Modern detail page often places the product thumbnails in a compact strip without stable class names.
    document.querySelectorAll('img').forEach(img => {
      const box = img.getBoundingClientRect?.(); if (!box) return;
      if (box.top < 0 || box.top > 1250 || box.width < 46 || box.height < 46 || box.width > 760 || box.height > 760) return;
      if (isVariantContext(img) && !isGalleryContext(img)) return;
      if (!isProductCdnUrl(attrRows(img)[0] || '')) return;
      attrRows(img).forEach(url => add(url, box.width >= 180 || box.height >= 180 ? 155 : 115, img, box.width >= 180 ? 'main' : 'thumb'));
    });
    return [...found.values()].sort((a, b) => b.score - a.score || a.order - b.order).map(x => x.url).slice(0, MAX_GALLERY);
  }

  function readProps() {
    const rows = [];
    document.querySelectorAll('table tr, [class*="attribute"] li, [class*="property"] li, [class*="prop"] li, [class*="parameter"] li').forEach(node => {
      if (rows.length >= MAX_PROPS) return;
      const cells = [...node.querySelectorAll('th,td,span,div')].map(x => text(x.innerText || x.textContent)).filter(Boolean);
      let name = '', value = '';
      if (cells.length >= 2) [name, value] = [cells[0], cells.slice(1).join(' ')];
      else { const parts = text(node.innerText || node.textContent).split(/[:：]/); if (parts.length >= 2) [name, value] = [parts.shift(), parts.join(':')]; }
      name = text(name).slice(0, 90); value = text(value).slice(0, 300);
      if (name && value && name !== value && !rows.some(x => x.name === name && x.value === value)) rows.push({ name, value });
    });
    return rows;
  }
  function priceRange() {
    const candidates = [];
    document.querySelectorAll('[class*="price"],[class*="Price"],[data-price],meta[itemprop="price"]').forEach(n => candidates.push(n.getAttribute?.('data-price'), n.getAttribute?.('content'), n.innerText, n.textContent));
    (visibleText().match(/[¥￥]\s*\d+(?:[.,]\d+)?(?:\s*[-~至]\s*[¥￥]?\s*\d+(?:[.,]\d+)?)?/g) || []).slice(0, 30).forEach(v => candidates.push(v));
    for (const row of candidates) { const r = rangeFrom(row); if (r.min > 0 && r.min < 10000000) return r; }
    return { min: 0, max: 0 };
  }
  function readMoq() { const match = visibleText().match(/(?:起批|最小起订|最低起订|MOQ|minimum)[^\d]{0,18}(\d{1,8})/i) || visibleText().match(/(\d{1,8})\s*(?:件|个|盒|套|pcs?)\s*起批/i); return Math.max(1, Number(match?.[1] || 1)); }
  function readStock() { const match = visibleText().match(/(?:库存|可售|stock)[^\d]{0,18}(\d{1,12})/i); return Math.max(0, Number(match?.[1] || 0)); }
  function titleCandidate() {
    const selectors = ['h1', '[class*="offer-title"]', '[class*="product-title"]', '[class*="title"] h1', 'meta[property="og:title"]', 'meta[name="title"]', 'title'];
    const rows = [];
    selectors.forEach((selector, rank) => document.querySelectorAll(selector).forEach(n => {
      const value = text(n.content || n.getAttribute?.('content') || n.innerText || n.textContent).replace(/[-_]?阿里巴巴.*$/i, '');
      const ctx = contextText(n);
      if (value.length >= 6 && value.length <= 520 && !/(?:shop|seller|company|店铺|商行|有限公司)/i.test(ctx)) rows.push({ value, score: 200 - rank * 12 + Math.min(value.length, 120) });
    }));
    return rows.sort((a, b) => b.score - a.score)[0]?.value || '';
  }

  function extract() {
    const prices = priceRange();
    const groups = mergeGroups(readGroupsFromScripts(), readGroupsFromDom());
    const colorGroup = groups.find(g => g.type === 'color'); const sizeGroup = groups.find(g => g.type === 'size');
    const colorOptions = (colorGroup?.options || []).slice(0, MAX_OPTIONS);
    const sizeOptions = (sizeGroup?.options || []).slice(0, MAX_OPTIONS);
    const variantImages = compact(groups.flatMap(g => g.options.map(o => absUrl(o.image))).filter(Boolean), MAX_OPTIONS);
    const images = galleryImages(variantImages);
    let skuVariants = readSkuRowsFromScripts().map((v, i) => skuRecord(v, i, groups)).filter(v => v.name || v.color || v.size).slice(0, MAX_SKUS);
    const dedup = new Map(); skuVariants.forEach(v => { const key = `${v.id}|${v.color}|${v.size}|${v.name}`; if (!dedup.has(key)) dedup.set(key, v); }); skuVariants = [...dedup.values()];
    if (!skuVariants.length) skuVariants = cartesianSkuFallback(groups, prices.min);
    const imagesByColor = {};
    colorOptions.forEach(o => { if (o.image) imagesByColor[o.name] = [o.image]; });
    skuVariants.forEach(v => { if (v.color && v.image && !imagesByColor[v.color]) imagesByColor[v.color] = [v.image]; });
    return {
      id: itemId(), url: location.href, title: titleCandidate(),
      image: images[0] || '', images, galleryImages: images,
      priceCny: prices.min, priceCnyMax: prices.max,
      moq: readMoq(), stock: readStock(), unit: 'dona',
      sellerName: '', sellerLocation: '', props: readProps(), serviceTags: [],
      variantGroups: groups, colorOptions, sizeOptions, variantImages, imagesByColor,
      skuVariants, variants: skuVariants,
      diagnostics: { galleryCount: images.length, variantImageCount: variantImages.length, groupCount: groups.length, skuCount: skuVariants.length, mode: skuVariants.some(x => /^fallback/.test(x.id)) ? 'dom-fallback' : 'structured' },
      extractedAt: new Date().toISOString(), extractorVersion: VERSION,
    };
  }

  const feedback = (label, ok = true) => {
    const button = document.getElementById(BUTTON_ID); if (!button) return;
    button.textContent = label; button.style.background = ok ? '#067647' : '#b42318';
    setTimeout(() => { button.textContent = 'OrzuMall’ga import'; button.style.background = '#e91d35'; }, 2600);
  };
  const importNow = async () => {
    try {
      feedback('Professional import...');
      const payload = extract();
      if (!payload.id && !/detail\.1688\.com\/offer/i.test(location.href)) throw new Error('Mahsulot sahifasi topilmadi');
      if (!payload.images.length) throw new Error('Asosiy galereya topilmadi. Sahifani to‘liq yuklab qayta urinib ko‘ring.');
      const response = await chrome.runtime.sendMessage({ type: 'IMPORT_TO_ORZUMALL', payload });
      if (!response?.ok) throw new Error(response?.error || 'Admin sahifasi ochilmadi');
      feedback(`Tayyor: ${payload.images.length} rasm, ${payload.skuVariants.length} SKU`);
    } catch (error) { feedback(error.message || 'Import xatosi', false); throw error; }
  };
  function mountButton() {
    if (document.getElementById(BUTTON_ID)) return;
    if (!/(?:^|\.)1688\.com$/i.test(location.hostname)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID; button.type = 'button'; button.textContent = 'OrzuMall’ga import';
    Object.assign(button.style, { position: 'fixed', right: '18px', bottom: '22px', zIndex: '2147483647', border: '0', borderRadius: '999px', padding: '14px 18px', background: '#e91d35', color: '#fff', font: '700 14px Arial,sans-serif', boxShadow: '0 12px 30px rgba(0,0,0,.2)', cursor: 'pointer' });
    button.addEventListener('click', () => importNow().catch(() => {})); document.documentElement.appendChild(button);
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXTRACT_AND_IMPORT') return false;
    importNow().then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message })); return true;
  });
  mountButton();
})();
