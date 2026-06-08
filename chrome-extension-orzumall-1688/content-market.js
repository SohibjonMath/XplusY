(() => {
  const VERSION = '3.1.0';
  const BUTTON_ID = 'orzumall-market-import-btn';
  const MAX_IMAGES = 18;
  const MAX_GROUPS = 8;
  const MAX_OPTIONS = 48;
  const MAX_SKUS = 220;
  const txt = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const uniq = rows => [...new Set((rows || []).filter(Boolean))];
  const host = location.hostname.toLowerCase();
  const platform = host === 'sahiy.uz' || host.endsWith('.sahiy.uz')
    ? 'sahiy'
    : host === 'uzum.uz' || host.endsWith('.uzum.uz')
      ? 'uzum'
      : host === 'yangkeduo.com' || host.endsWith('.yangkeduo.com') || host === 'pinduoduo.com' || host.endsWith('.pinduoduo.com')
        ? 'pinduoduo'
        : '';
  if (!platform) return;

  const specs = {
    sahiy: { label: 'Sahiy Market', currency: 'UZS' },
    uzum: { label: 'Uzum Market', currency: 'UZS' },
    pinduoduo: { label: 'Pinduoduo', currency: 'CNY' },
  };
  const spec = specs[platform];
  const MARKETPLACE_IMAGE_HOST = /(?:^|\.)(?:alicdn\.com|1688\.com|tbcdn\.cn|alibabausercontent\.com)$/i;
  const BAD_IMAGE = /(?:icon|logo|sprite|avatar|qrcode|qr-code|favicon|loading|placeholder|default|emoji|badge|cart|chat|video-play|payment|payme|uzcard|humo|visa|mastercard|review|comment|feedback|user|seller|brand|flag|banner|coupon|delivery|guarantee|warranty|shield)/i;
  const BAD_OPTION = /(?:savat|savatcha|sotib olish|xarid|buyurtma|yetkaz|kafolat|tavsif|sharh|narx|price|delivery|review|comment|login|kirish|ro['‘’]?yxat|register|savol|rating|sotilgan|minimal|maksimal|¥|￥|so['‘’]?m|库存|注册|登录|评价|详情)/i;

  function rect(node) {
    try { return node?.getBoundingClientRect?.() || null; } catch (_e) { return null; }
  }
  function visible(node, minW = 1, minH = 1) {
    const r = rect(node); if (!r) return false;
    return r.width >= minW && r.height >= minH && r.bottom >= -20 && r.top <= innerHeight + 600 && r.right >= -20 && r.left <= innerWidth + 300;
  }
  function marketplaceImageHost(name = '') { return MARKETPLACE_IMAGE_HOST.test(String(name || '').toLowerCase()); }
  function stripMarketplaceImageSuffix(pathname = '') {
    let out = String(pathname || '');
    for (let i = 0; i < 6; i += 1) {
      const next = out.replace(/(\.(?:png|webp|gif|avif|jpe?g))(?:_[^/?#]+)+$/i, '$1');
      if (next === out) break;
      out = next;
    }
    return out;
  }
  function abs(value) {
    let raw = txt(value)
      .replace(/&amp;/g, '&')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/^url\(["']?|["']?\)$/g, '');
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
    try {
      const u = new URL(raw.startsWith('//') ? `https:${raw}` : raw, location.href);
      if (!/^https?:$/i.test(u.protocol)) return '';
      const looksLikeImage = /\.(?:png|webp|gif|avif|jpe?g)(?:$|[_?#])/i.test(u.pathname) || /(?:\/img\/ibank\/|alicdn\.com\/imgextra\/)/i.test(u.toString());
      if (u.protocol === 'http:' && marketplaceImageHost(u.hostname)) u.protocol = 'https:';
      if (marketplaceImageHost(u.hostname) && looksLikeImage) {
        const before = u.pathname;
        u.pathname = stripMarketplaceImageSuffix(before);
        if (u.search || before !== u.pathname) u.search = '';
      }
      u.hash = '';
      return u.toString();
    } catch (_e) { return ''; }
  }
  function isImage(url) { return /\.(?:jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.test(String(url || '')) || /(?:\/img\/ibank\/|alicdn\.com\/imgextra\/)/i.test(String(url || '')); }
  function attrUrls(node) {
    if (!node) return [];
    const out = [];
    ['currentSrc', 'src', 'data-src', 'data-lazy-src', 'data-lazyload-src', 'data-original', 'data-origin-src', 'data-image', 'data-img', 'data-url', 'data-zoom-image', 'poster', 'data-poster', 'data-bg', 'data-background-image'].forEach(key => out.push(key === 'currentSrc' ? node.currentSrc : node.getAttribute?.(key)));
    const srcset = node.getAttribute?.('srcset') || node.getAttribute?.('data-srcset') || '';
    srcset.split(',').forEach(x => out.push(x.trim().split(/\s+/)[0]));
    const pushBg = value => String(value || '').replace(/url\(["']?(.+?)["']?\)/g, (_m, url) => { out.push(url); return _m; });
    pushBg(node.style?.backgroundImage);
    try { pushBg(getComputedStyle(node)?.backgroundImage); } catch (_e) {}
    return uniq(out.map(abs).filter(url => url && isImage(url) && !BAD_IMAGE.test(url)));
  }
  function meta(name) { return document.querySelector(`meta[property="${name}"],meta[name="${name}"],meta[itemprop="${name}"]`)?.content || ''; }
  function title() { return txt(document.querySelector('h1')?.textContent || meta('og:title') || meta('twitter:title') || document.title).slice(0, 520); }
  function cleanLabel(value) { return txt(value).replace(/^[\s:：/_-]+|[\s:：/_-]+$/g, '').slice(0, 140); }
  function goodLabel(value) { const s = cleanLabel(value); return !!s && s.length <= 110 && !BAD_OPTION.test(s); }
  function optionImage(node) { const visual = node?.matches?.('img') ? node : node?.querySelector?.('img,picture source,[style*="background-image"]'); return attrUrls(visual || node)[0] || ''; }
  function optionId(node, fallback) { return txt(node?.getAttribute?.('data-sku') || node?.getAttribute?.('data-id') || node?.getAttribute?.('data-value') || node?.getAttribute?.('value') || node?.getAttribute?.('data-key') || fallback).slice(0, 140); }
  function groupType(name = '') { const raw = String(name || ''); if (/(?:rang|color|colour|颜色|顏色|色彩)/i.test(raw)) return 'color'; if (/(?:size|razmer|o['‘’]?lcham|尺码|尺寸|大小)/i.test(raw)) return 'size'; if (/(?:规格|規格|型号|型號|款式|model|variant|spec|texnik)/i.test(raw)) return 'spec'; return 'other'; }
  function uniqueOptions(rows = []) {
    const map = new Map();
    rows.forEach((row, index) => {
      const name = cleanLabel(row?.name || row?.label || row?.value || '');
      if (!goodLabel(name)) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { id: txt(row?.id || `o${index + 1}`), name, ...(row?.image ? { image: abs(row.image) } : {}) });
    });
    return [...map.values()].slice(0, MAX_OPTIONS);
  }

  function sahiyMainImage() {
    const rows = [...document.querySelectorAll('img')].map(node => ({ node, box: rect(node), urls: attrUrls(node) })).filter(row => row.urls.length && row.box && row.box.width >= 180 && row.box.height >= 180 && row.box.left < innerWidth * 0.56 && row.box.top >= 120 && row.box.top < 920);
    return rows.map(row => {
      const area = Math.min(row.box.width, 900) * Math.min(row.box.height, 900);
      const leftBonus = row.box.left < innerWidth * 0.48 ? 320000 : 0;
      const topBonus = row.box.top < 720 ? 140000 : 0;
      const squareBonus = Math.abs(row.box.width - row.box.height) < Math.max(row.box.width, row.box.height) * 0.35 ? 80000 : 0;
      return { ...row, score: area + leftBonus + topBonus + squareBonus };
    }).sort((a, b) => b.score - a.score)[0] || null;
  }
  function sahiyGalleryImages() {
    const main = sahiyMainImage();
    if (!main) return genericImages();
    const out = [];
    const add = url => { url = abs(url); if (url && isImage(url) && !BAD_IMAGE.test(url) && !out.includes(url)) out.push(url); };
    main.urls.forEach(add);
    const mainBox = main.box;
    const thumbs = [...document.querySelectorAll('img')].map(node => ({ node, box: rect(node), urls: attrUrls(node) })).filter(row => {
      const b = row.box; if (!b || !row.urls.length) return false;
      const thumbSize = b.width >= 34 && b.width <= 155 && b.height >= 34 && b.height <= 155;
      const below = b.top >= mainBox.bottom - 50 && b.top <= mainBox.bottom + 190 && b.left >= mainBox.left - 55 && b.left <= mainBox.right + 100;
      return thumbSize && below;
    });
    thumbs.forEach(row => row.urls.forEach(add));
    const stripSeed = thumbs[0]?.node;
    if (stripSeed) {
      let parent = stripSeed.parentElement;
      for (let hop = 0; parent && hop < 5; hop += 1, parent = parent.parentElement) {
        const b = rect(parent); if (!b) continue;
        const nearStrip = b.top >= mainBox.bottom - 100 && b.top <= mainBox.bottom + 220 && b.left >= mainBox.left - 100 && b.right <= mainBox.right + 260;
        const imgs = [...parent.querySelectorAll('img')];
        if (nearStrip && imgs.length >= 2 && imgs.length <= 42) imgs.forEach(img => attrUrls(img).forEach(add));
      }
    }
    if (!out.length) [meta('og:image'), meta('twitter:image')].forEach(add);
    return out.slice(0, MAX_IMAGES);
  }
  function nearbySahiyGroupLabel(parent, optionNames = []) {
    const box = rect(parent); if (!box) return 'Variantlar';
    const names = new Set(optionNames.map(x => x.toLowerCase()));
    const rows = [...document.querySelectorAll('h2,h3,h4,h5,h6,strong,b,label,span,p,div')].map(node => ({ node, box: rect(node), text: cleanLabel(node.textContent) })).filter(row => {
      const b = row.box; const textValue = row.text;
      if (!b || !textValue || textValue.length > 70 || names.has(textValue.toLowerCase()) || BAD_OPTION.test(textValue)) return false;
      const above = b.bottom <= box.top + 8 && b.bottom >= box.top - 100;
      const aligned = b.left <= box.right && b.right >= box.left - 30;
      return above && aligned;
    });
    const best = rows.sort((a, b) => b.box.bottom - a.box.bottom || a.text.length - b.text.length)[0];
    return best?.text || 'Variantlar';
  }
  function sahiyCardOption(node, zone) {
    const b = rect(node); if (!b) return null;
    if (b.width < 52 || b.width > 420 || b.height < 28 || b.height > 175) return null;
    if (b.left < zone.left || b.right > zone.right || b.top < zone.top || b.bottom > zone.bottom) return null;
    const rawText = node.getAttribute?.('aria-label') || node.getAttribute?.('data-value') || node.textContent || node.querySelector?.('img')?.alt || '';
    const name = cleanLabel(rawText);
    if (!goodLabel(name) || name.length < 2) return null;
    const image = optionImage(node);
    let pointer = false;
    try { pointer = getComputedStyle(node).cursor === 'pointer'; } catch (_e) {}
    const semantic = node.matches?.('button,label,li,[role="option"],[role="button"],[data-value],[data-sku]');
    if (!image && !pointer && !semantic) return null;
    return { id: optionId(node, `o-${Math.round(b.left)}-${Math.round(b.top)}`), name, image, node, box: b };
  }
  function sahiyVariantGroups() {
    const main = sahiyMainImage(); if (!main) return [];
    const zone = { left: main.box.right + 18, right: Math.min(innerWidth * 0.84, main.box.right + 760), top: Math.max(170, main.box.top + 65), bottom: Math.min(innerHeight + 180, main.box.bottom + 180) };
    const parents = [...document.querySelectorAll('div,section,article,ul,ol')];
    const rows = [];
    parents.forEach(parent => {
      const children = [...parent.children].map(node => sahiyCardOption(node, zone)).filter(Boolean);
      const options = uniqueOptions(children);
      if (options.length < 2 || options.length > 18) return;
      const boxes = children.map(x => x.box);
      const sameBand = Math.max(...boxes.map(b => b.top)) - Math.min(...boxes.map(b => b.top)) <= 170;
      if (!sameBand) return;
      const label = nearbySahiyGroupLabel(parent, options.map(x => x.name));
      const imageCount = options.filter(x => x.image).length;
      const area = boxes.reduce((sum, b) => sum + Math.min(60000, b.width * b.height), 0);
      rows.push({ parent, label, options, score: options.length * 1000 + imageCount * 220 + Math.min(area / 100, 900) });
    });
    const final = [];
    const seen = new Set();
    rows.sort((a, b) => b.score - a.score).forEach(row => {
      const key = row.options.map(x => x.name.toLowerCase()).sort().join('|');
      if (!key || seen.has(key)) return;
      if (final.some(old => row.parent.contains(old.parent) || old.parent.contains(row.parent))) return;
      seen.add(key);
      final.push({ id: `g${final.length + 1}`, name: row.label || `Variant ${final.length + 1}`, type: groupType(row.label), options: row.options, parent: row.parent });
    });
    return final.slice(0, MAX_GROUPS).map(({ parent: _parent, ...group }) => group);
  }

  function genericImages() {
    const scored = [];
    const add = (url, score) => { url = abs(url); if (url && isImage(url) && !BAD_IMAGE.test(url)) scored.push({ url, score }); };
    add(meta('og:image'), 900); add(meta('twitter:image'), 820);
    document.querySelectorAll('img,picture source,[style*="background-image"]').forEach(node => {
      const r = rect(node) || {}; const w = Number(node.naturalWidth || r.width || 0), h = Number(node.naturalHeight || r.height || 0);
      const isVisible = (r.width || w) >= 42 && (r.height || h) >= 42; const top = Number(r.top || 0);
      let score = Math.min(900, w * h / 1000) + (top < 950 ? 180 : 0) + ((r.left || 0) < innerWidth * 0.75 ? 100 : 0);
      if (!isVisible) score -= 400;
      attrUrls(node).forEach(url => add(url, score));
    });
    const map = new Map(); scored.sort((a, b) => b.score - a.score).forEach(row => { if (!map.has(row.url)) map.set(row.url, row); });
    return [...map.values()].slice(0, MAX_IMAGES).map(x => x.url);
  }
  function images() { return platform === 'sahiy' ? sahiyGalleryImages() : genericImages(); }

  function genericGroups() {
    const scopes = [...document.querySelectorAll('[class*="sku"],[class*="Sku"],[class*="variant"],[class*="Variant"],[class*="option"],[class*="Option"],[data-sku],[data-testid*="variant"],[aria-label*="variant"],[class*="color"],[class*="size"]')].slice(0, 260);
    const out = []; const seen = new Set();
    for (const scope of scopes) {
      if (out.length >= MAX_GROUPS) break;
      const nodes = [...scope.querySelectorAll('button,label,li,[role="option"],[data-value],[class*="item"],[class*="Item"]')].slice(0, 100);
      const options = uniqueOptions(nodes.map((node, idx) => ({ id: optionId(node, `o${idx + 1}`), name: node.getAttribute?.('data-value') || node.getAttribute?.('aria-label') || node.textContent || node.querySelector?.('img')?.alt || '', image: optionImage(node) })));
      if (options.length < 2 || options.length > MAX_OPTIONS) continue;
      const own = scope.getAttribute?.('data-name') || scope.getAttribute?.('aria-label') || scope.querySelector?.('h2,h3,h4,h5,strong,b,label')?.textContent || scope.previousElementSibling?.textContent || '';
      const name = goodLabel(own) && cleanLabel(own).length < 55 ? cleanLabel(own) : `Variant ${out.length + 1}`;
      const key = name.toLowerCase() + '::' + options.map(x => x.name.toLowerCase()).join('|'); if (seen.has(key)) continue;
      seen.add(key); out.push({ id: `g${out.length + 1}`, name, type: groupType(name), options });
    }
    return out;
  }
  function groups() {
    if (platform === 'sahiy') {
      const sahiy = sahiyVariantGroups();
      if (sahiy.length) return sahiy;
    }
    return genericGroups();
  }

  function parseDigits(value) { const digits = String(value || '').replace(/[^0-9]/g, ''); return digits ? Number(digits) : 0; }
  function sahiyPrice() {
    const main = sahiyMainImage(); const rows = [];
    document.querySelectorAll('body *').forEach(node => {
      const textValue = txt(node.textContent); if (!textValue || textValue.length > 85 || !/(?:so['‘’]?m|UZS)/i.test(textValue)) return;
      const amount = parseDigits((textValue.match(/\d[\d\s.,]{1,24}/) || [])[0]); if (!amount) return;
      const b = rect(node); if (!b) return;
      let font = 0; try { font = parseFloat(getComputedStyle(node).fontSize) || 0; } catch (_e) {}
      const nearPricePanel = main ? b.left > main.box.right + 120 && b.top >= main.box.top - 80 && b.top <= main.box.bottom + 170 : b.top < 760;
      const score = (nearPricePanel ? 1200 : 0) + font * 18 - Math.max(0, b.top - 160) * 0.25 + Math.min(amount / 10000, 150);
      rows.push({ amount, score });
    });
    const best = rows.sort((a, b) => b.score - a.score)[0];
    if (best?.amount) return { priceValue: best.amount, priceUzs: best.amount, priceCurrency: 'UZS' };
    const fallback = [...txt(document.body?.innerText).matchAll(/(\d[\d\s.,]{1,24})\s*(?:so['‘’]?m|UZS)/gi)].map(row => parseDigits(row[1])).filter(Boolean).sort((a, b) => b - a)[0] || 0;
    return { priceValue: fallback, priceUzs: fallback, priceCurrency: 'UZS' };
  }
  function genericPrice() {
    const candidates = [meta('product:price:amount'), meta('price'), ...Array.from(document.querySelectorAll('[itemprop="price"],[data-price],[class*="price"],[class*="Price"]')).slice(0, 70).map(x => x.getAttribute('content') || x.getAttribute('data-price') || x.textContent)];
    for (const raw of candidates) {
      const match = String(raw || '').replace(/[\s,]/g, '').match(/\d+(?:\.\d+)?/); if (!match) continue;
      const n = Number(match[0]); if (!Number.isFinite(n) || n <= 0) continue;
      return spec.currency === 'UZS' ? { priceValue: n, priceUzs: Math.round(n), priceCurrency: 'UZS' } : { priceValue: n, priceCny: n, priceCurrency: 'CNY' };
    }
    return { priceValue: 0, priceCurrency: spec.currency };
  }
  function parsePrice() { return platform === 'sahiy' ? sahiyPrice() : genericPrice(); }

  function decodeRepeated(value = '') {
    let out = String(value || '');
    for (let i = 0; i < 4; i += 1) { try { const next = decodeURIComponent(out); if (next === out) break; out = next; } catch (_e) { break; } }
    return out;
  }
  function upstreamUrl() {
    if (platform !== 'sahiy') return '';
    try {
      const raw = new URL(location.href).searchParams.get('u') || '';
      const decoded = decodeRepeated(raw);
      const u = new URL(decoded);
      return /^https?:$/i.test(u.protocol) ? u.toString() : '';
    } catch (_e) { return ''; }
  }
  function itemId() {
    const current = new URL(location.href);
    if (platform === 'sahiy') {
      const sku = current.searchParams.get('sku') || current.searchParams.get('productId') || current.searchParams.get('id');
      if (sku) return txt(sku).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 140);
      const nested = upstreamUrl(); const offer = nested.match(/(?:offer\/|offerId=|itemId=|id=)(\d{6,})/i)?.[1]; if (offer) return offer;
    }
    const source = location.href;
    const patterns = platform === 'pinduoduo'
      ? [/(?:goods_id|goodsId|id)=([0-9]{5,})/i, /(?:goods|product)[\/-]([0-9]{5,})/i]
      : platform === 'uzum'
        ? [/(?:product|products)[\/-][^/?#]*?-([0-9]{4,})(?:[/?#]|$)/i, /(?:product|products)[\/-]([0-9]{4,})/i, /(?:id|productId)=([0-9]{4,})/i]
        : [/(?:products?|goods?|item)[\/-]([0-9A-Za-z_-]{4,})/i, /(?:id|productId|itemId)=([0-9A-Za-z_-]{4,})/i];
    for (const re of patterns) { const match = source.match(re); if (match) return match[1]; }
    return location.pathname.split('/').filter(Boolean).pop()?.replace(/[^0-9A-Za-z_-]/g, '') || '';
  }
  function combinations(optionGroups) {
    if (!optionGroups.length) return [];
    let rows = [{ selections: {} }];
    for (const group of optionGroups) rows = rows.flatMap(row => group.options.slice(0, 30).map(opt => ({ selections: { ...row.selections, [group.id]: opt.name } }))).slice(0, MAX_SKUS);
    return rows.map((row, index) => ({ id: `generated-${index + 1}`, skuId: `generated-${index + 1}`, name: Object.values(row.selections).join(' / '), selections: row.selections, attributes: row.selections, stock: 0, stockKnown: false }));
  }
  function extract() {
    const galleryImages = images();
    const variantGroups = groups();
    const skuVariants = combinations(variantGroups);
    const variantImages = uniq(variantGroups.flatMap(group => group.options.map(option => option.image)).filter(Boolean)).slice(0, MAX_OPTIONS);
    const colorGroup = variantGroups.find(group => group.type === 'color');
    const sizeGroup = variantGroups.find(group => group.type === 'size') || variantGroups.find(group => group.type === 'spec');
    const colorOptions = (colorGroup?.options || []).slice(0, MAX_OPTIONS);
    const sizeOptions = (sizeGroup?.options || []).slice(0, MAX_OPTIONS);
    const imagesByColor = {}; colorOptions.forEach(option => { if (option.image) imagesByColor[option.name] = [option.image]; });
    return {
      id: itemId(), url: location.href, upstreamUrl: upstreamUrl(), sourcePlatform: platform, sourceLabel: spec.label,
      title: title(), image: galleryImages[0] || '', images: galleryImages, galleryImages,
      variantGroups, skuVariants, variants: skuVariants, variantImages, colorOptions, sizeOptions, imagesByColor,
      genericSpecName: sizeGroup?.type === 'spec' ? sizeGroup.name : '',
      ...parsePrice(), moq: 1, stock: 0, stockKnown: false,
      diagnostics: { importer: 'chrome-extension', mode: platform === 'sahiy' ? 'sahiy-spatial-v2' : 'page-dom', galleryCount: galleryImages.length, variantImageCount: variantImages.length, groupCount: variantGroups.length, skuCount: skuVariants.length, upstreamUrl: upstreamUrl() },
      extractedAt: new Date().toISOString(), extractorVersion: VERSION,
    };
  }
  async function send() {
    const payload = extract();
    if (!payload.title && !payload.images.length) throw new Error('Mahsulot ma’lumoti topilmadi. Mahsulot sahifasini to‘liq oching.');
    if (!payload.images.length) throw new Error('Mahsulot galereyasi topilmadi. Sahifani yangilab qayta urinib ko‘ring.');
    return chrome.runtime.sendMessage({ type: 'IMPORT_TO_ORZUMALL', payload });
  }
  function feedback(button, textValue, ok = true) {
    button.textContent = textValue; button.style.background = ok ? '#067647' : '#b42318';
    setTimeout(() => { button.disabled = false; button.textContent = 'OrzuMall’ga import'; button.style.background = '#e91d35'; }, 2800);
  }
  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button'); button.id = BUTTON_ID; button.type = 'button'; button.textContent = 'OrzuMall’ga import';
    button.style.cssText = 'position:fixed;right:18px;bottom:86px;z-index:2147483647;border:0;border-radius:999px;background:#e91d35;color:#fff;padding:13px 17px;font:700 14px Arial;box-shadow:0 10px 30px rgba(15,23,42,.24);cursor:pointer';
    button.addEventListener('click', async () => { button.disabled = true; button.textContent = 'Yig‘ilmoqda...'; try { const payload = extract(); await chrome.runtime.sendMessage({ type: 'IMPORT_TO_ORZUMALL', payload }); feedback(button, `Tayyor: ${payload.images.length} rasm · ${payload.skuVariants.length} SKU`, true); } catch (error) { feedback(button, error.message || 'Import xatosi', false); } });
    document.body.appendChild(button);
  }
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type !== 'EXTRACT_AND_IMPORT') return false;
    send().then(() => reply({ ok: true })).catch(error => reply({ ok: false, error: error.message || 'IMPORT_FAILED' })); return true;
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();
  setTimeout(addButton, 1800);
})();
