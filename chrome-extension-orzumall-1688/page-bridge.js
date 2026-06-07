(() => {
  const MESSAGE = '__ORZUMALL_1688_PAGE_STATE__';
  const REQUEST = '__ORZUMALL_1688_SNAPSHOT_REQUEST__';
  const KEY_RE = /(?:sku|offer|detail|product|item|spec|saleprop|sale_prop|props|initial|init|state|data)/i;
  const KNOWN = ['__INIT_DATA__','__INITIAL_STATE__','__NEXT_DATA__','__APOLLO_STATE__','INIT_DATA','INITIAL_STATE','pageData','offerData','detailData','productData','__GLOBAL_DATA__','__INITIAL_PROPS__'];
  function clone(value, depth = 0, seen = new WeakSet()) {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object' || depth > 7 || seen.has(value)) return undefined;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 260).map(v => clone(v, depth + 1, seen)).filter(v => v !== undefined);
    const out = {}; let count = 0;
    for (const [key, val] of Object.entries(value)) {
      if (count >= 260) break;
      const next = clone(val, depth + 1, seen);
      if (next !== undefined) { out[key] = next; count += 1; }
    }
    return out;
  }
  function capture() {
    const roots = []; const used = new Set();
    const push = (key, value) => {
      if (!value || typeof value !== 'object' || used.has(value)) return;
      used.add(value);
      try {
        const copy = clone(value);
        if (!copy || typeof copy !== 'object') return;
        const packed = JSON.stringify(copy);
        if (packed.length < 40 || packed.length > 1200000) return;
        roots.push({ __globalKey: key, value: copy });
      } catch (_e) {}
    };
    KNOWN.forEach(key => { try { push(key, window[key]); } catch (_e) {} });
    Object.keys(window).filter(key => KEY_RE.test(key)).slice(0, 120).forEach(key => { try { push(key, window[key]); } catch (_e) {} });
    window.postMessage({ type: MESSAGE, roots: roots.slice(0, 24) }, '*');
  }
  window.addEventListener('message', event => { if (event.source === window && event.data?.type === REQUEST) capture(); });
  setTimeout(capture, 0); setTimeout(capture, 1200); setTimeout(capture, 3200);
})();
