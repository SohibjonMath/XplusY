(() => {
  const VERSION = '1.0.0';
  const BUTTON_ID = 'orzumall-1688-import-btn';
  const MAX_IMAGES = 18;
  const MAX_VARIANTS = 100;
  const MAX_PROPS = 30;
  const text = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const uniq = rows => [...new Set(rows.filter(Boolean))];
  const absUrl = value => {
    const raw = text(value).replace(/&amp;/g, '&');
    if (!raw || raw.startsWith('data:')) return '';
    try { return new URL(raw.startsWith('//') ? `https:${raw}` : raw, location.href).toString(); } catch (_e) { return ''; }
  };
  const itemId = () => (location.href.match(/(?:offer\/|offerId=|itemId=|id=)(\d{6,})/i) || location.href.match(/\b(\d{8,})\b/))?.[1] || '';
  const firstText = selectors => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = text(node?.content || node?.getAttribute?.('content') || node?.innerText || node?.textContent);
      if (value) return value;
    }
    return '';
  };
  const readJsonScripts = () => [...document.scripts].map(s => s.textContent || '').filter(s => s.length > 40 && s.length < 1800000).slice(0, 80).join('\n');
  const visibleText = () => text(document.body?.innerText || '').slice(0, 300000);
  const imageCandidates = () => {
    const values = [];
    document.querySelectorAll('meta[property="og:image"],meta[name="og:image"],meta[itemprop="image"]').forEach(n => values.push(n.content));
    document.querySelectorAll('img').forEach(img => {
      ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-image', 'data-ks-lazyload'].forEach(a => values.push(img.getAttribute(a)));
      const srcset = img.getAttribute('srcset');
      if (srcset) srcset.split(',').forEach(part => values.push(part.trim().split(/\s+/)[0]));
    });
    const json = readJsonScripts();
    const matches = json.match(/(?:https?:)?\\?\/\\?\/[\w.-]+\.(?:alicdn|tbcdn|1688img)\.com\\?\/[\w\-./%?=&]+/gi) || [];
    matches.forEach(v => values.push(v.replace(/\\\//g, '/')));
    return uniq(values.map(absUrl).filter(u => /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(u) || /alicdn|tbcdn|1688img/i.test(u))).slice(0, MAX_IMAGES);
  };
  const numberFrom = value => {
    const n = String(value || '').replace(/,/g, '.').match(/\d+(?:\.\d+)?/);
    return n ? Number(n[0]) : 0;
  };
  const rangeFrom = value => {
    const nums = (String(value || '').replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n < 100000000);
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 0 };
  };
  const priceRange = () => {
    const nodes = [...document.querySelectorAll('[class*="price"],[class*="Price"],[data-price],meta[itemprop="price"]')].slice(0, 100);
    const candidates = [];
    nodes.forEach(n => candidates.push(n.getAttribute?.('data-price'), n.getAttribute?.('content'), n.innerText, n.textContent));
    const body = visibleText();
    (body.match(/[¥￥]\s*\d+(?:[.,]\d+)?(?:\s*[-~至]\s*[¥￥]?\s*\d+(?:[.,]\d+)?)?/g) || []).slice(0, 30).forEach(v => candidates.push(v));
    for (const row of candidates) {
      const r = rangeFrom(row);
      if (r.min > 0 && r.min < 10000000) return r;
    }
    return { min: 0, max: 0 };
  };
  const readMoq = () => {
    const body = visibleText();
    const match = body.match(/(?:起批|最小起订|最低起订|MOQ|minimum)[^\d]{0,18}(\d{1,8})/i) || body.match(/(\d{1,8})\s*(?:件|个|盒|套|pcs?)\s*起批/i);
    return Math.max(1, Number(match?.[1] || 1));
  };
  const readStock = () => {
    const body = visibleText();
    const match = body.match(/(?:库存|可售|stock)[^\d]{0,18}(\d{1,12})/i);
    return Math.max(0, Number(match?.[1] || 0));
  };
  const readProps = () => {
    const rows = [];
    document.querySelectorAll('table tr, [class*="attribute"] li, [class*="property"] li, [class*="prop"] li').forEach(node => {
      if (rows.length >= MAX_PROPS) return;
      const cells = [...node.querySelectorAll('th,td,span,div')].map(x => text(x.innerText || x.textContent)).filter(Boolean);
      let name = '', value = '';
      if (cells.length >= 2) [name, value] = [cells[0], cells.slice(1).join(' ')];
      else {
        const raw = text(node.innerText || node.textContent);
        const parts = raw.split(/[:：]/);
        if (parts.length >= 2) [name, value] = [parts.shift(), parts.join(':')];
      }
      name = text(name).slice(0, 90); value = text(value).slice(0, 300);
      if (name && value && !rows.some(x => x.name === name && x.value === value)) rows.push({ name, value });
    });
    return rows;
  };
  const readVariants = () => {
    const rows = [];
    const selectors = '[class*="sku"] li,[class*="spec"] li,[class*="prop"] li,[class*="sku"] button,[class*="spec"] button,[data-sku-id]';
    document.querySelectorAll(selectors).forEach((node, index) => {
      if (rows.length >= MAX_VARIANTS) return;
      const name = text(node.getAttribute('title') || node.getAttribute('aria-label') || node.innerText || node.textContent).slice(0, 260);
      const image = absUrl(node.querySelector('img')?.getAttribute('src') || node.querySelector('img')?.getAttribute('data-src') || node.style.backgroundImage?.match(/url\(["']?(.+?)["']?\)/)?.[1]);
      if (!name || name.length > 260) return;
      if (!rows.some(row => row.name === name && row.image === image)) rows.push({ id: text(node.getAttribute('data-sku-id') || `v${index + 1}`), name, image, stock: 0, priceCny: 0 });
    });
    return rows;
  };
  const extract = () => {
    const prices = priceRange();
    const images = imageCandidates();
    const title = firstText(['h1', '[class*="title"] h1', '[class*="Title"]', 'meta[property="og:title"]', 'title']).replace(/[-_]?阿里巴巴.*$/i, '').slice(0, 520);
    return {
      id: itemId(),
      url: location.href,
      title,
      image: images[0] || '', images,
      priceCny: prices.min,
      priceCnyMax: prices.max,
      moq: readMoq(), stock: readStock(), unit: 'dona',
      sellerName: firstText(['[class*="company"]', '[class*="shop-name"]', '[class*="seller"] [class*="name"]']).slice(0, 220),
      sellerLocation: firstText(['[class*="location"]', '[class*="address"]']).slice(0, 220),
      props: readProps(), variants: readVariants(), serviceTags: [],
      extractedAt: new Date().toISOString(), extractorVersion: VERSION,
    };
  };
  const feedback = (label, ok = true) => {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    button.textContent = label;
    button.style.background = ok ? '#067647' : '#b42318';
    setTimeout(() => { button.textContent = 'OrzuMall’ga import'; button.style.background = '#e91d35'; }, 2200);
  };
  const importNow = async () => {
    try {
      feedback('Yig‘ilmoqda...');
      const payload = extract();
      if (!payload.id && !/detail\.1688\.com\/offer/i.test(location.href)) throw new Error('Mahsulot sahifasi topilmadi');
      const response = await chrome.runtime.sendMessage({ type: 'IMPORT_TO_ORZUMALL', payload });
      if (!response?.ok) throw new Error(response?.error || 'Admin sahifasi ochilmadi');
      feedback('Admin oynasi ochildi');
    } catch (error) { feedback(error.message || 'Import xatosi', false); throw error; }
  };
  function mountButton() {
    if (document.getElementById(BUTTON_ID)) return;
    if (!/1688\.com$/i.test(location.hostname) && !/\.1688\.com$/i.test(location.hostname)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'OrzuMall’ga import';
    Object.assign(button.style, {
      position: 'fixed', right: '18px', bottom: '22px', zIndex: '2147483647',
      border: '0', borderRadius: '999px', padding: '14px 18px', background: '#e91d35',
      color: '#fff', font: '700 14px Arial,sans-serif', boxShadow: '0 12px 30px rgba(0,0,0,.2)', cursor: 'pointer',
    });
    button.addEventListener('click', () => importNow().catch(() => {}));
    document.documentElement.appendChild(button);
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXTRACT_AND_IMPORT') return false;
    importNow().then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  });
  mountButton();
})();
