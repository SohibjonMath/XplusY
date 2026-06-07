(() => {
  const VERSION = '1.10.0';
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
  // Galereya faqat mahsulotning chap media blokidan olinadi. Sharhlar, UGC va tavsif ichidagi rasmlar kiritilmaydi.
  const galleryRejectContextHint = /(?:review|comment|feedback|buyer|ugc|upload|evaluate|evaluation|rate|rating|showcase|晒图|晒单|评价|评论|买家|用户上传|追评|attribute|parameter|detail-desc|description|商品详情|商品评价|包装信息|参数)/i;
  const rectOf = node => { try { return node?.getBoundingClientRect?.() || null; } catch (_e) { return null; } };
  const isRejectedGalleryContext = node => galleryRejectContextHint.test(contextText(node));

  const attrRows = node => {
    if (!node) return [];
    const rows = [node.currentSrc];
    ['src', 'poster', 'data-poster', 'data-src', 'data-lazy-src', 'data-lazyload-src', 'data-original', 'data-origin-src', 'data-zoom-image', 'data-image', 'data-ks-lazyload', 'data-url', 'data-img', 'data-pic', 'data-bg', 'data-background-image'].forEach(a => rows.push(node.getAttribute?.(a)));
    const srcset = node.getAttribute?.('srcset');
    if (srcset) srcset.split(',').forEach(part => rows.push(part.trim().split(/\s+/)[0]));
    node.querySelectorAll?.('source[srcset],source[data-srcset]').forEach(source => {
      const raw = source.getAttribute('srcset') || source.getAttribute('data-srcset') || '';
      raw.split(',').forEach(part => rows.push(part.trim().split(/\s+/)[0]));
    });
    const pushBg = value => {
      String(value || '').replace(/url\(["']?(.+?)["']?\)/g, (_m, url) => { rows.push(url); return _m; });
    };
    pushBg(node.style?.backgroundImage);
    try { pushBg(getComputedStyle(node)?.backgroundImage); } catch (_e) {}
    return compact(rows.map(absUrl).filter(u => u && isImageUrl(u) && !badImageHint.test(u)), 18);
  };
  const firstNodeImage = node => {
    if (!node) return '';
    const own = attrRows(node)[0]; if (own) return own;
    const visual = node.matches?.('img') ? node : node.querySelector?.('img,picture,[style*="background"],[class*="image"],[class*="Image"],[class*="pic"],[class*="Pic"]');
    return attrRows(visual)[0] || '';
  };
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
      .replace(/(?:登录查看全部规格|登錄查看全部規格|查看全部规格|查看全部規格|全部规格|全部規格)/gi, '')
      .replace(/(?:库存|庫存|stock|qoldiq|остаток)\s*[:：]?\s*\d+[\s\S]*$/i, '')
      .replace(/(?:¥|￥)\s*\d+(?:[.,]\d+)?[\s\S]*$/i, '')
      .replace(/^[\s:：/_-]+|[\s:：/_-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }
  const badVariantText = /(?:主面料|面料|材质|成分|工艺|品牌|货号|库存|庫存|起批|价格|运费|评价|参数|商品属性|包装|详情|登录|登錄|查看全部|¥|￥|stock|qoldiq|material|fabric|brand|price|delivery)/i;
  const uiNoiseVariant = /(?:登录|登錄|查看全部|全部规格|全部規格|库存|庫存|起批|运费|评价|参数|商品详情|联系客服|加入购物车|立即铺货)/i;
  const sizeToken = /^(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|[2-9]xl|均码|free|one\s*size|(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|[2-9]xl)码|\d{2,3}(?:\s*(?:cm|码))?)$/i;
  function looksLikeSize(value = '') { const v = cleanOptionLabel(value); return !!v && v.length <= 18 && sizeToken.test(v); }
  function usableVariantName(value = '', type = 'other', image = '') {
    const v = cleanOptionLabel(value);
    if (!v || v.length > 72 || badVariantText.test(v) || uiNoiseVariant.test(v)) return false;
    if (type === 'size') return looksLikeSize(v);
    if (type === 'spec') return v.length <= 64;
    if (type === 'color') return !!image || (v.length <= 28 && !/^(?:s|m|l|xl|xxl|xxxl|[2-9]xl|\d{2,3})$/i.test(v));
    return v.length <= 42;
  }

  function classifyGroup(label = '', index = 0) {
    const s = text(label).toLowerCase();
    if (/(?:颜色|顏色|颜色分类|色彩|colour|color|rang)/i.test(s)) return 'color';
    if (/(?:尺码|尺寸|大小|规格尺寸|size|razmer|o['‘’]?lcham)/i.test(s)) return 'size';
    if (/(?:^|\s)(?:规格|規格|规格型号|規格型號|型号|型號|款式|specification|variant)(?:\s|$)/i.test(s) || /^(?:规格|規格|型号|型號|款式)$/i.test(s)) return 'spec';
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
  function visibleBox(node) {
    try {
      const box = node?.getBoundingClientRect?.();
      if (!box) return null;
      if (box.width < 10 || box.height < 10 || box.bottom < -20 || box.top > innerHeight + 1200) return null;
      return box;
    } catch (_e) { return null; }
  }
  function domCandidateName(node) {
    const rows = [
      node?.getAttribute?.('title'), node?.getAttribute?.('aria-label'), node?.getAttribute?.('data-title'),
      node?.getAttribute?.('data-name'), node?.getAttribute?.('data-value'), node?.getAttribute?.('data-text'),
      ownLabel(node), node?.innerText, node?.textContent,
    ];
    for (const raw of rows) {
      const value = cleanOptionLabel(raw);
      if (value && value.length <= 72 && !uiNoiseVariant.test(value)) return value;
    }
    return '';
  }
  const variantGroupLabel = /^(?:颜色|顏色|颜色分类|顏色分類|色彩|尺码|尺碼|尺寸|大小|规格|規格|规格型号|規格型號|款式|型号|型號|color|colour|size|specification|variant)[:：]?$/i;
  const variantGroupStop = /^(?:颜色|顏色|颜色分类|顏色分類|色彩|尺码|尺碼|尺寸|大小|规格|規格|规格型号|規格型號|款式|型号|型號|登录查看全部规格|登錄查看全部規格|查看全部规格|查看全部規格|分销代发|密文代发|商品评价|商品属性|包装信息|商品详情|热门推荐|搭配组货|立即铺货|加入铺货单|color|colour|size|specification|variant)[:：]?$/i;
  const skuNodeSelector = ['button','li','a','[role="option"]','[role="button"]','[data-sku-id]','[data-prop-value-id]','[data-value-id]','[data-value]','[data-title]','[class*="sku-item"]','[class*="skuItem"]','[class*="spec-item"]','[class*="specItem"]','[class*="prop-item"]','[class*="propItem"]','[class*="value-item"]','[class*="valueItem"]','[class*="sku"]','[class*="spec"]'].join(',');
  function isStrongSkuNode(node) {
    if (!node?.matches) return false;
    return node.matches(skuNodeSelector) || !!firstNodeImage(node) || /pointer/i.test(getComputedStyle(node)?.cursor || '');
  }
  function closeToLabel(labelBox, box) {
    if (!labelBox || !box) return true;
    const closeVertical = box.top >= labelBox.top - 40 && box.top <= labelBox.bottom + 520;
    const plausibleHorizontal = box.left >= labelBox.left - 42 || box.top >= labelBox.bottom - 12;
    return closeVertical && plausibleHorizontal;
  }
  function domOptionNodes(container, labelNode, type = 'other') {
    const labelBox = visibleBox(labelNode);
    const selectors = type === 'spec' ? `${skuNodeSelector},div,span` : skuNodeSelector;
    const map = new Map();
    [...container.querySelectorAll(selectors)].forEach((node, index) => {
      if (node === labelNode || node.contains(labelNode)) return;
      if (node.closest('table,[class*="parameter"],[class*="attribute-table"],[class*="detail-attribute"],[class*="product-attribute"]')) return;
      const box = visibleBox(node); if (!box || !closeToLabel(labelBox, box)) return;
      if (box.width > 680 || box.height > 190) return;
      const image = firstNodeImage(node);
      const name = domCandidateName(node);
      if (!usableVariantName(name, type, image) || variantGroupLabel.test(name)) return;
      const nestedStrong = [...node.querySelectorAll(skuNodeSelector)].filter(x => x !== node).length;
      if (nestedStrong > 1 && !image) return; // wrapper emas, haqiqiy option kerak
      const strong = isStrongSkuNode(node) || node.children.length === 0;
      if (!strong) return;
      const distance = labelBox ? Math.max(0, box.top - labelBox.bottom) + Math.max(0, labelBox.left - box.left) : 0;
      const score = (image ? 80 : 0) + (node.matches(skuNodeSelector) ? 55 : 0) + (node.children.length === 0 ? 12 : 0) + (box.width <= 420 ? 8 : 0) - Math.min(distance / 16, 35) - Math.min(nestedStrong * 4, 20);
      const row = { node, score, name, image, index };
      const old = map.get(name); if (!old || score > old.score) map.set(name, row);
    });
    return [...map.values()].sort((a,b)=>b.score-a.score || a.index-b.index).slice(0, MAX_OPTIONS).map(x=>x.node);
  }
  function groupFromLabel(labelNode, gi = 0) {
    const name = text(labelNode.textContent).replace(/[:：]/g, '');
    const type = classifyGroup(name, gi);
    let container = labelNode.parentElement; let best = null;
    for (let hop = 0; container && hop < 5; hop += 1, container = container.parentElement) {
      const rawText = text(container.innerText || container.textContent);
      if (rawText.length > 2600) break; // butun sahifa textini variant deb olishga yo‘l qo‘ymaymiz
      const nodes = domOptionNodes(container, labelNode, type);
      const options = [];
      nodes.forEach((node, index) => {
        const host = node.closest?.('[data-sku-id],[data-prop-value-id],[data-value-id],[data-value],[class*=\"sku-item\"],[class*=\"skuItem\"],[class*=\"spec-item\"],[class*=\"specItem\"]') || node;
        const image = firstNodeImage(host) || firstNodeImage(node);
        const option = domCandidateName(node) || domCandidateName(host);
        if (!usableVariantName(option, type, image)) return;
        if (!options.some(o => o.name === option)) options.push({ id: text(host.getAttribute('data-sku-id') || host.getAttribute('data-prop-value-id') || host.getAttribute('data-value-id') || host.getAttribute('data-value') || `d${gi + 1}_${index + 1}`), name: option, image, disabled: /disabled|soldout|sold-out/i.test(`${host.className || ''} ${host.getAttribute('aria-disabled') || ''}`) });
      });
      if (options.length >= 2 && options.length <= MAX_OPTIONS) {
        const score = options.length * 14 + options.filter(o=>o.image).length * 22 - hop * 18 - Math.max(0, rawText.length - 900) / 80;
        if (!best || score > best.score) best = { score, options };
      }
    }
    return best ? { id:`dom${gi+1}`, name, type, options:best.options, origin:'visible-dom' } : null;
  }
  function readGroupsFromDom() {
    const labels = [...document.querySelectorAll('span,div,label,dt,th,p,strong')].filter(n => variantGroupLabel.test(text(n.textContent)));
    const groups = labels.map((node,idx)=>groupFromLabel(node,idx)).filter(Boolean);
    const merged=[];
    groups.forEach(g=>{
      const old=merged.find(x=>x.type===g.type && text(x.name)===text(g.name));
      if(!old) merged.push(g);
      else g.options.forEach(o=>{ if(!old.options.some(x=>x.name===o.name)) old.options.push(o); });
    });
    return merged.slice(0, MAX_VARIANT_GROUPS);
  }
  function scopedTextOptions(labelNode, type='spec', gi=0) {
    let container=labelNode.parentElement;
    for(let hop=0; container && hop<4; hop+=1, container=container.parentElement){
      const raw=String(container.innerText||container.textContent||'');
      if(raw.length>1500) break;
      const lines=raw.split(/\n+/).map(text).filter(Boolean);
      const start=lines.findIndex(line=>variantGroupLabel.test(line) && classifyGroup(line)===type);
      if(start<0) continue;
      const options=[];
      for(let i=start+1;i<Math.min(lines.length,start+18);i+=1){
        const row=lines[i];
        if(i>start+1 && variantGroupStop.test(row)) break;
        const name=cleanOptionLabel(row);
        if(!usableVariantName(name,type)) continue;
        if(type==='spec' && !/(?:\d|米|cm|厘米|层|層|色|款|号|號|蓝|藍|白|黑|红|紅|绿|綠|橙|灰|粉|紫|黄|黃|充气|充氣|泵)/i.test(name)) continue;
        if(!options.some(x=>x.name===name)) options.push({id:`scoped-${gi+1}-${options.length+1}`,name,image:'',disabled:false});
      }
      if(options.length>=2 && options.length<=24) return options;
    }
    return [];
  }
  function readScopedSpecGroups() {
    const labels=[...document.querySelectorAll('span,div,label,dt,th,p,strong')].filter(n=>/^(?:规格|規格|规格型号|規格型號|型号|型號|款式)[:：]?$/.test(text(n.textContent)));
    const groups=[];
    labels.forEach((node,idx)=>{
      const options=scopedTextOptions(node,'spec',idx);
      if(options.length>=2) groups.push({id:`scoped-spec-${idx+1}`,name:text(node.textContent).replace(/[:：]/g,''),type:'spec',options,origin:'visible-text'});
    });
    return groups.slice(0,2);
  }
  function scriptGroupScore(groups=[]) {
    return groups.reduce((sum,g,idx)=>{
      const type=inferGroupType(g,idx); const n=(g.options||[]).length;
      return sum + (type==='other'?0:220) + Math.min(n,24)*7 - Math.max(0,n-48)*12;
    },0);
  }
  function readGroupsFromScripts() {
    const candidates = [];
    const keys = /(?:skuProps|sku_props|saleProps|sale_props|skuProperties|sku_properties|specProps|spec_props|productSKUProps|skuPropList|sku_prop_list|skuAttributes|sku_attributes)/i;
    parsedScriptRoots().forEach(root => walk(root, (v, path) => {
      const key = path[path.length - 1] || '';
      if (!keys.test(key) || !Array.isArray(v)) return;
      const groups = v.slice(0, MAX_VARIANT_GROUPS).map(normalizeGroup).filter(Boolean).map((g,i)=>({...g,type:inferGroupType(g,i),origin:'structured'}));
      if(groups.some(g=>g.type!=='other')) candidates.push(groups);
    }));
    return candidates.sort((a,b)=>scriptGroupScore(b)-scriptGroupScore(a))[0] || [];
  }
  function sanitizeMergedGroup(g,i=0){
    const type=inferGroupType(g,i);
    const seen=new Set();
    const options=(g.options||[]).map(o=>({...o,name:cleanOptionLabel(o.name)})).filter(o=>{
      if(!usableVariantName(o.name,type,o.image) || seen.has(o.name)) return false;
      seen.add(o.name); return true;
    }).slice(0,MAX_OPTIONS);
    return {...g,type,options};
  }
  function mergeGroups(visibleGroups=[], scriptGroups=[]) {
    const result=(safeJsonClone(visibleGroups)||[]).map(sanitizeMergedGroup).filter(g=>g.options.length>=2);
    (safeJsonClone(scriptGroups)||[]).map(sanitizeMergedGroup).filter(g=>g.options.length>=2).forEach(group=>{
      const target=result.find(x=>x.type===group.type) || result.find(x=>text(x.name)===text(group.name));
      if(!target){ if(group.type!=='other') result.push(group); return; }
      // DOM sahifada ko‘rinib turgan variantlar source of truth. Structured ma’lumot faqat rasm/id bilan boyitadi.
      group.options.forEach(o=>{
        const same=target.options.find(x=>x.name===o.name);
        if(same){ if(!same.image && o.image) same.image=o.image; if(!same.id && o.id) same.id=o.id; }
      });
    });
    return result.slice(0,MAX_VARIANT_GROUPS).map(sanitizeMergedGroup).filter(g=>g.options.length>=2);
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
    const re = kind === 'color' ? /(?:颜色|顏色|色彩|color|colour|rang)/i : /(?:尺码|尺寸|大小|规格|規格|型号|型號|款式|specification|variant|size|razmer|o['‘’]?lcham)/i;
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
    const sizeGroup = groups.find(g => g.type === 'size') || groups.find(g => g.type === 'spec');
    const color = cleanOptionLabel(attrByKind(attrs, 'color') || (colorGroup ? attrs[colorGroup.name] || values.find(bit => colorGroup.options.some(o => cleanOptionLabel(o.name) === bit)) || '' : ''));
    const size = cleanOptionLabel(attrByKind(attrs, 'size') || (sizeGroup ? attrs[sizeGroup.name] || values.find(bit => sizeGroup.options.some(o => cleanOptionLabel(o.name) === bit)) || '' : ''));
    const image = absUrl(v?.image ?? v?.imageUrl ?? v?.image_url ?? v?.picUrl ?? v?.pic_url ?? v?.thumbnail) || colorGroup?.options.find(o => o.name === color)?.image || '';
    return { id: text(v?.skuId ?? v?.sku_id ?? v?.id ?? v?.specId ?? v?.spec_id ?? `sku${index + 1}`), name: directName || values.join(' / ') || `SKU ${index + 1}`, color, size, attributes: attrs, image, stock: skuStock(v), priceCny: skuPrice(v) };
  }
  function cartesianSkuFallback(groups, basePrice) {
    if (!groups.length) return [];
    const relevant = groups.filter(g => ['color', 'size', 'spec'].includes(g.type)).slice(0, 2);
    if (!relevant.length) return [];
    let rows = [{ attributes: {} }];
    relevant.forEach(group => {
      rows = rows.flatMap(row => group.options.map(o => ({ attributes: { ...row.attributes, [group.name]: o.name } }))).slice(0, MAX_SKUS);
    });
    const colorGroup = relevant.find(g => g.type === 'color'); const sizeGroup = relevant.find(g => g.type === 'size') || relevant.find(g => g.type === 'spec');
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
      if (node && isRejectedGalleryContext(node)) return;
      const box = rectOf(node); const w = Number(node?.naturalWidth || box?.width || 0); const h = Number(node?.naturalHeight || box?.height || 0);
      if (w && h && w < 46 && h < 46) return;
      if (variants.has(url) && origin !== 'main' && origin !== 'trusted-strip') return; // SKU ikonkalari umumiy galereyaga aralashmasin; chap media lentasi bundan mustasno
      const total = score + (isProductCdnUrl(url) ? 48 : 0) + ((w >= 220 || h >= 220) ? 20 : 0);
      const old = found.get(url); if (!old || total > old.score) found.set(url, { url, score: total, order: order++ });
    };
    const visualNodes = [...document.querySelectorAll('img,picture,video[poster],[style*="background-image"],[data-bg],[data-background-image]')];
    const rows = visualNodes.map(node => ({ node, box: rectOf(node), urls: attrRows(node) })).filter(row => {
      const { node, box, urls } = row;
      if (!box || !urls.length || isRejectedGalleryContext(node)) return false;
      if (box.width < 30 || box.height < 30 || box.bottom < -24 || box.top > Math.max(1350, innerHeight + 420)) return false;
      return true;
    });
    // 1) Eng ishonchli urinish: galereya nomli kontekst va mahsulot CDN rasmlari.
    let primaryPool = rows.filter(({node, box, urls}) => {
      if ((isVariantContext(node) && !isGalleryContext(node)) || !urls.some(isProductCdnUrl)) return false;
      return box.left < Math.min(innerWidth * .64, 880) && box.width >= 180 && box.height >= 180;
    });
    // 2) Yangi 1688 shablonlari class nomlarini yashirishi mumkin. Katta chap rasmni fazoviy usulda topamiz.
    if (!primaryPool.length) primaryPool = rows.filter(({box}) => box.left < Math.min(innerWidth * .66, 900) && box.width >= 180 && box.height >= 180);
    const primary = primaryPool.map(row => {
      const b = row.box; const area = Math.min(b.width, 960) * Math.min(b.height, 960);
      const leftBonus = b.left < innerWidth * .58 ? 250000 : -320000;
      const topBonus = b.top >= -80 && b.top < 920 ? 170000 : -150000;
      const largeBonus = b.width >= 300 && b.height >= 260 ? 270000 : 0;
      const galleryBonus = isGalleryContext(row.node) ? 145000 : 0;
      const cdnBonus = row.urls.some(isProductCdnUrl) ? 65000 : 0;
      return { ...row, score: area + leftBonus + topBonus + largeBonus + galleryBonus + cdnBonus };
    }).sort((a,b)=>b.score-a.score)[0];
    if (primary) {
      primary.urls.forEach(url => add(url, 620, primary.node, 'main'));
      const mainBox = primary.box;
      // Asosiy rasmni o‘rab turgan eng kichik media blokni topamiz.
      let media = primary.node.parentElement; let selectedMedia = null;
      for (let hop=0; media && hop<8; hop+=1, media=media.parentElement) {
        const box=rectOf(media); if(!box) continue;
        const imgs=[...media.querySelectorAll('img,picture,video[poster],[style*="background-image"],[data-bg],[data-background-image]')].filter(node=>!isRejectedGalleryContext(node) && attrRows(node).length);
        const spatialOk = box.width <= Math.min(innerWidth*.78, 980) && box.height <= 1180;
        if(imgs.length>=2 && imgs.length<=42 && spatialOk) selectedMedia=media;
      }
      if(selectedMedia){
        [...selectedMedia.querySelectorAll('img,picture,video[poster],[style*="background-image"],[data-bg],[data-background-image]')].forEach(node=>{
          if(isRejectedGalleryContext(node)) return;
          const b=rectOf(node); if(!b || b.width<30 || b.height<30) return;
          const near = b.left <= mainBox.right + 190 && b.right >= mainBox.left - 190 && b.top <= mainBox.bottom + 290 && b.bottom >= mainBox.top - 100;
          if(!near) return;
          attrRows(node).forEach(url=>add(url, node===primary.node?590:285, node, node===primary.node?'main':'media'));
        });
      }
      // Classsiz shablonlar uchun: faqat asosiy rasm atrofidagi miniatyuralar olinadi.
      rows.forEach(({node,box,urls})=>{
        const below = box.top >= mainBox.bottom - 40 && box.top <= mainBox.bottom + 280 && box.left >= mainBox.left - 140 && box.left <= mainBox.right + 180;
        const side = box.left >= mainBox.left - 190 && box.right <= mainBox.left + 110 && box.top >= mainBox.top - 80 && box.top <= mainBox.bottom + 110;
        if(!(below || side)) return;
        urls.forEach(url=>add(url, 270, node, 'thumb'));
      });
    }
    // 3) Video faol bo'lgan yangi 1688 shablonlari: katta rasm DOM'da bo'lmasligi mumkin.
    // Bunday holatda faqat chap media panelidagi bir qatorda turgan miniatyuralarni olamiz.
    // Bu review/UGC rasmlariga tushib ketmaslik uchun fazoviy jihatdan juda tor scope bilan ishlaydi.
    if(!found.size){
      const leftLimit = Math.min(innerWidth * .58, 720);
      const stripRows = rows.filter(({node,box,urls})=>{
        if(!box || !urls.some(isProductCdnUrl) || isRejectedGalleryContext(node) || isVariantContext(node)) return false;
        const smallEnough = box.width >= 42 && box.width <= 145 && box.height >= 42 && box.height <= 145;
        const visibleLeftMedia = box.left >= -8 && box.right <= leftLimit && box.top >= 170 && box.top <= Math.min(1180, innerHeight + 360);
        return smallEnough && visibleLeftMedia;
      });
      const bands = new Map();
      stripRows.forEach(row=>{
        const key=Math.round(row.box.top/34);
        if(!bands.has(key)) bands.set(key,[]);
        bands.get(key).push(row);
      });
      const best=[...bands.values()].map(group=>{
        const rowsSorted=group.sort((a,b)=>a.box.left-b.box.left);
        const unique=uniq(rowsSorted.flatMap(x=>x.urls.filter(isProductCdnUrl)));
        const span=rowsSorted.length ? rowsSorted[rowsSorted.length-1].box.right-rowsSorted[0].box.left : 0;
        const top=rowsSorted[0]?.box.top || 9999;
        return { rows:rowsSorted, unique, score:unique.length*100 + Math.min(span,720) - Math.abs(top-760)*.08 };
      }).filter(x=>x.unique.length>=2).sort((a,b)=>b.score-a.score)[0];
      if(best){
        best.rows.forEach(({node,urls})=>urls.forEach(url=>add(url,430,node,'trusted-strip')));
      }
    }
    // 4) Xavfsiz zaxira: mahsulot metadata rasmi. Sharh va foydalanuvchi rasmlariga tushmaydi.
    if(!found.size) document.querySelectorAll('meta[property="og:image"],meta[name="og:image"],meta[itemprop="image"],link[rel="image_src"]')
      .forEach(n=>add(n.content || n.href, 360, null, 'main'));
    return [...found.values()].sort((a,b)=>b.score-a.score || a.order-b.order).map(x=>x.url).slice(0,12);
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

  function optionSet(group) { return new Set((group?.options || []).map(o=>cleanOptionLabel(o.name)).filter(Boolean)); }
  function rowMapsToDetectedGroups(row, groups=[]) {
    const colorGroup=groups.find(g=>g.type==='color'); const sizeGroup=groups.find(g=>g.type==='size') || groups.find(g=>g.type==='spec');
    const colors=optionSet(colorGroup), sizes=optionSet(sizeGroup);
    const color=cleanOptionLabel(row?.color || attrByKind(row?.attributes,'color'));
    const size=cleanOptionLabel(row?.size || attrByKind(row?.attributes,'size'));
    if(colorGroup && (!color || !colors.has(color))) return false;
    if(sizeGroup && (!size || !sizes.has(size))) return false;
    return !!(color || size);
  }
  function cleanSkuRows(rows=[], groups=[], basePrice=0) {
    const mapped=(rows||[]).filter(row=>rowMapsToDetectedGroups(row,groups));
    const source=mapped.length ? mapped : cartesianSkuFallback(groups,basePrice);
    const seen=new Set();
    return source.filter(row=>{
      const key=`${cleanOptionLabel(row.color)}|||${cleanOptionLabel(row.size)}`;
      if(!key.replace(/\|/g,'') || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0,MAX_SKUS);
  }

  function extract() {
    const prices = priceRange();
    const visibleGroups = readGroupsFromDom();
    const scopedSpecs = visibleGroups.some(g => g.type === 'spec') ? [] : readScopedSpecGroups();
    const groups = mergeGroups([...visibleGroups, ...scopedSpecs], readGroupsFromScripts());
    const colorGroup = groups.find(g => g.type === 'color'); const sizeGroup = groups.find(g => g.type === 'size') || groups.find(g => g.type === 'spec');
    const colorOptions = (colorGroup?.options || []).slice(0, MAX_OPTIONS);
    const sizeOptions = (sizeGroup?.options || []).slice(0, MAX_OPTIONS);
    const variantImages = compact(groups.flatMap(g => g.options.map(o => absUrl(o.image))).filter(Boolean), MAX_OPTIONS);
    const images = galleryImages(variantImages);
    const structuredSkuRows = readSkuRowsFromScripts().map((v, i) => skuRecord(v, i, groups));
    // Strukturali JSON ichida reklama yoki yordamchi yozuvlar uchrasa ishlatilmaydi.
    // Ko‘rinadigan variant guruhlaridan xavfsiz SKU kombinatsiyasi qayta yaratiladi.
    const skuVariants = cleanSkuRows(structuredSkuRows, groups, prices.min);
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
      genericSpecName: sizeGroup?.type === 'spec' ? sizeGroup.name : '',
      skuVariants, variants: skuVariants,
      diagnostics: { galleryCount: images.length, variantImageCount: variantImages.length, groupCount: groups.length, skuCount: skuVariants.length, mode: skuVariants.some(x => /^fallback/.test(x.id)) ? 'dom-fallback' : 'structured' },
      extractedAt: new Date().toISOString(), extractorVersion: VERSION,
    };
  }

  window.__ORZUMALL_1688_EXTRACT__ = extract;
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
