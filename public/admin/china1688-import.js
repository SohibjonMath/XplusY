import { auth } from '/firebase-config.js';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';

const $ = id => document.getElementById(id);
const provider = new GoogleAuthProvider();
const state = {
  source: null,
  products: [],
  editingId: '',
  pricing: { cnyToUzs: 1850, servicePercent: 12, reservePercent: 3, minServiceUzs: 15000 },
  externalImages: [],
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Math.round(Number(n || 0)).toLocaleString('ru-RU') + ' so‘m';
const cny = n => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ¥';
const uniq = rows => [...new Set((rows || []).filter(Boolean))];
let toastTimer;

function toast(text) { $('toast').textContent = String(text || ''); $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3400); }
function notice(text, type = 'info') { $('notice').hidden = !text; $('notice').className = 'notice ' + type; $('notice').textContent = text || ''; }
function copyNotice(text, type = 'info') { $('copyStatus').hidden = !text; $('copyStatus').className = 'copy-status ' + type; $('copyStatus').textContent = text || ''; }
function safeLines(v) { return String(v || '').split(/\n+/).map(x => x.trim()).filter(Boolean); }
function isStorageUrl(v) { return /^https:\/\/firebasestorage\.googleapis\.com\//i.test(String(v || '')); }
function normalizeImageUrl(v) {
  let s = String(v || '').trim().replace(/&amp;/g, '&').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return '';
  try { const u = new URL(s.startsWith('//') ? 'https:' + s : s, location.href); if (u.protocol === 'http:' && /(?:^|\.)(?:alicdn\.com|1688\.com|tbcdn\.cn|alibabausercontent\.com)$/i.test(u.hostname)) u.protocol = 'https:'; u.hash = ''; return u.toString(); } catch { return ''; }
}
function imageProxyUrl(v) { const u = normalizeImageUrl(v); if (!u || isStorageUrl(u)) return u; return '/.netlify/functions/china1688-image-proxy?url=' + encodeURIComponent(u); }
function previewImg(u, extra = '') { const original = normalizeImageUrl(u); if (!original) return ''; return `<img src="${esc(imageProxyUrl(original))}" data-original-src="${esc(original)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" ${extra}>`; }
function armPreviewFallbacks(root = document) { root.querySelectorAll('img[data-original-src]').forEach(img => { if (img.dataset.fallbackReady) return; img.dataset.fallbackReady = '1'; img.addEventListener('error', () => { if (img.dataset.directTried !== '1') { img.dataset.directTried = '1'; img.src = img.dataset.originalSrc; img.referrerPolicy = 'no-referrer'; } else { img.classList.add('broken-preview'); img.alt = 'Preview ochilmadi'; } }); }); }
function calcAutoPrice(v) { const p = state.pricing || {}, base = Number(v || 0) * Number(p.cnyToUzs || 1850), service = Math.max(Number(p.minServiceUzs || 15000), base * Number(p.servicePercent || 0) / 100), reserve = base * Number(p.reservePercent || 0) / 100; return Math.ceil((base + service + reserve) / 500) * 500; }
function setBusy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + label; } else { btn.disabled = false; btn.innerHTML = btn.dataset.old || label; } }
async function api(body) { const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error('Admin akkaunti bilan kiring'); const r = await fetch('/.netlify/functions/china1688-import-admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || d.error || 'Server xatosi'); return d; }
function extract1688Url(v) { const s = String(v || '').trim(), urls = [s, ...(s.match(/https?:\/\/[^\s<>"']+/gi) || [])]; for (const raw of urls) { try { const u = new URL(raw.replace(/[),.;]+$/, '')); if (u.hostname === '1688.com' || u.hostname.endsWith('.1688.com')) return u.toString(); } catch {} } return ''; }
function parseItemId(url) { return String(url || '').match(/(?:offer\/|offerId=|itemId=|id=)(\d{6,})/i)?.[1] || ''; }
function defaultDescription(src) { const rows = ['Xitoydan buyurtma qilinadigan mahsulot. Yetkazib berish muddati taxminiy.']; (src?.props || []).slice(0, 14).forEach(p => { if (p.name && p.value) rows.push(`${p.name}: ${p.value}`); }); return rows.join('\n'); }
function imageUrls() { const checked = [...document.querySelectorAll('#imagesGrid input:checked')].map(x => normalizeImageUrl(x.value)).filter(Boolean); return uniq([...checked, ...safeLines($('imagesText').value).map(normalizeImageUrl).filter(Boolean)]).slice(0, 18); }
function sourceGallery(src = {}) { return uniq((src.galleryImages?.length ? src.galleryImages : src.images || []).map(normalizeImageUrl).filter(Boolean)).slice(0, 18); }
function variantMedia(src = {}) {
  const rows = [...(src.variantImages || [])];
  (src.colorOptions || []).forEach(x => rows.push(x.image));
  (src.variantGroups || []).forEach(g => (g.options || []).forEach(x => rows.push(x.image)));
  (src.skuVariants || src.variants || []).forEach(x => rows.push(x.image));
  Object.values(src.imagesByColor || {}).flat().forEach(x => rows.push(x));
  return uniq(rows.map(normalizeImageUrl).filter(Boolean)).slice(0, 80);
}
function renderImages(images = []) { const rows = uniq(images.map(normalizeImageUrl).filter(Boolean)); $('imagesGrid').innerHTML = rows.length ? rows.map((u, idx) => `<label class="image-choice${isStorageUrl(u) ? ' local' : ''}">${previewImg(u, 'alt=""')}<input type="checkbox" value="${esc(u)}" checked><b>${idx + 1}</b>${isStorageUrl(u) ? '<small>Storage</small>' : ''}</label>`).join('') : '<div class="empty-mini">Asosiy galereya topilmadi. URL’larni qo‘lda kiriting.</div>'; armPreviewFallbacks($('imagesGrid')); }
function optionCards(rows = [], kind = '') { return rows.length ? rows.slice(0, 48).map(x => `<span class="variant-option ${kind}">${x.image ? previewImg(x.image, 'alt=""') : ''}<b>${esc(x.name || '—')}</b>${x.disabled ? '<i>mavjud emas</i>' : ''}</span>`).join('') : '<em class="empty-variant">topilmadi</em>'; }
function renderVariants(src = {}) {
  const groups = src.variantGroups || [];
  const colors = src.colorOptions?.length ? src.colorOptions : (groups.find(g => g.type === 'color')?.options || []);
  const sizes = src.sizeOptions?.length ? src.sizeOptions : (groups.find(g => g.type === 'size')?.options || []);
  const skus = src.skuVariants?.length ? src.skuVariants : (src.variants || []);
  const diagnostics = src.diagnostics || {};
  $('variantList').innerHTML = `
    <div class="variant-summary">
      <span><i class="fa-solid fa-palette"></i><b>${colors.length}</b> rang</span>
      <span><i class="fa-solid fa-ruler"></i><b>${sizes.length}</b> razmer</span>
      <span><i class="fa-solid fa-cubes-stacked"></i><b>${skus.length}</b> SKU</span>
      <span class="${diagnostics.mode === 'structured' ? 'ok' : 'warn'}"><i class="fa-solid fa-microchip"></i>${esc(diagnostics.mode === 'structured' ? 'strukturali' : 'DOM fallback')}</span>
    </div>
    <div class="variant-group"><h5>Rang variantlari</h5><div class="variant-options">${optionCards(colors, 'color')}</div></div>
    <div class="variant-group"><h5>Razmerlar</h5><div class="variant-options">${optionCards(sizes, 'size')}</div></div>
    ${groups.filter(g => !['color', 'size'].includes(g.type)).map(g => `<div class="variant-group"><h5>${esc(g.name)}</h5><div class="variant-options">${optionCards(g.options || [], 'other')}</div></div>`).join('')}
    <div class="sku-preview"><h5>SKU kombinatsiyalari</h5><div>${skus.length ? skus.slice(0, 24).map(v => `<span>${esc([v.color, v.size, v.name && ![v.color, v.size].filter(Boolean).includes(v.name) ? v.name : ''].filter(Boolean).join(' / ') || 'SKU')}${v.priceCny ? ` · ${esc(cny(v.priceCny))}` : ''}${v.stock ? ` · ${esc(v.stock)} ta` : ''}</span>`).join('') : '<em class="empty-variant">SKU aniqlanmadi</em>'}</div></div>`;
  armPreviewFallbacks($('variantList'));
}
function markExistingBySource() { if (!state.source?.id || state.editingId) return; const old = state.products.find(x => String(x.itemId || '') === String(state.source.id)); if (old) { state.editingId = old.id; $('editState').textContent = 'Yangilash: ' + old.id; notice('Bu 1688 mahsuloti oldin import qilingan. Saqlasangiz mavjud karta yangilanadi.', 'info'); } }
function applySource(src = {}, opts = {}) {
  state.source = src; state.externalImages = sourceGallery(src); const images = state.externalImages;
  $('editor').hidden = false; $('open1688').href = src.url || $('sourceUrl').value || '#'; $('sourceUrl').value = src.url || $('sourceUrl').value || '';
  $('sourceTitle').textContent = src.title || 'Qo‘lda kiritiladigan 1688 mahsuloti';
  const d = src.diagnostics || {};
  $('sourceMeta').textContent = [src.id ? '1688 ID: ' + src.id : '', src.sellerName || '', src.sellerLocation || '', src.extractorVersion ? 'Importer v' + src.extractorVersion : '', d.galleryCount != null ? `${d.galleryCount} galereya · ${d.variantImageCount || 0} rang rasmi · ${d.skuCount || 0} SKU` : ''].filter(Boolean).join(' · ') || 'Manba ma’lumoti qo‘lda to‘ldiriladi';
  $('sourceCover').innerHTML = src.image ? previewImg(src.image, 'alt=""') : '<i class="fa-solid fa-image"></i>'; armPreviewFallbacks($('sourceCover'));
  $('sourceChips').innerHTML = (src.serviceTags || []).map(x => `<span>${esc(x)}</span>`).join(''); $('cnyLabel').textContent = src.priceCny ? cny(src.priceCny) : '—'; $('autoPriceLabel').textContent = src.priceUzs ? money(src.priceUzs) : money(calcAutoPrice(src.priceCny)); $('moqLabel').textContent = String(src.moq || 1) + ' ta'; $('stockLabel').textContent = src.stock ? Number(src.stock).toLocaleString('ru-RU') + ' ta' : '—';
  renderImages(images); renderVariants(src);
  if (!opts.keepForm) { $('name').value = src.title || ''; $('nameRu').value = src.title || ''; $('priceCny').value = src.priceCny || ''; $('price').value = src.priceUzs || calcAutoPrice(src.priceCny) || ''; $('moq').value = src.moq || 1; $('stock').value = src.stock || 0; $('description').value = defaultDescription(src); $('imagesText').value = ''; }
  markExistingBySource(); window.scrollTo({ top: $('editor').offsetTop - 86, behavior: 'smooth' });
}
function resetEditor() { state.source = null; state.externalImages = []; state.editingId = ''; $('editState').textContent = 'Yangi mahsulot'; $('editor').hidden = true; copyNotice(''); ['name', 'nameRu', 'price', 'oldPrice', 'priceCny', 'weightKg', 'description', 'imagesText'].forEach(id => $(id).value = ''); $('minDays').value = 15; $('maxDays').value = 30; $('moq').value = 1; $('stock').value = 0; $('popularScore').value = 50; $('tags').value = '1688, Xitoydan buyurtma, trend'; }
function manual() { const url = extract1688Url($('sourceUrl').value); if (!url) return notice('Qo‘lda import qilish uchun haqiqiy 1688 havolasini kiriting.', 'error'); state.editingId = ''; $('editState').textContent = 'Qo‘lda yangi mahsulot'; applySource({ id: parseItemId(url), url, title: '', images: [], galleryImages: [], priceCny: 0, moq: 1, stock: 0, props: [], variantGroups: [], skuVariants: [] }); notice('Qo‘lda kiritish rejimi ochildi.', 'info'); }
async function copyUrlsToStorage(urls, itemId, label = 'Rasm') {
  const originals = uniq((urls || []).map(normalizeImageUrl).filter(Boolean)); const urlMap = new Map(); const existing = originals.filter(isStorageUrl); existing.forEach(u => urlMap.set(u, u)); const remote = originals.filter(x => !isStorageUrl(x)); let copied = 0, normalized = 0, failed = 0;
  for (let i = 0; i < remote.length; i += 6) { const part = remote.slice(i, i + 6); copyNotice(`${label}: ${Math.min(i + part.length, remote.length)} / ${remote.length}`, 'info'); const d = await api({ action: 'copyImages', itemId: itemId || 'draft', urls: part, normalize: true }); (d.copied || []).forEach(row => { urlMap.set(normalizeImageUrl(row.sourceUrl), row.url); copied += 1; if (row.normalized) normalized += 1; }); (d.failed || []).forEach(row => { const u = normalizeImageUrl(row.sourceUrl); urlMap.set(u, u); failed += 1; }); part.forEach(u => { if (!urlMap.has(u)) urlMap.set(u, u); }); }
  return { urlMap, copied, normalized, failed };
}
function remapUrl(value, map) { const u = normalizeImageUrl(value); return u ? (map.get(u) || u) : ''; }
function remapSourceMedia(raw, map, finalGallery) {
  const src = JSON.parse(JSON.stringify(raw || {}));
  src.galleryImages = finalGallery; src.images = finalGallery; src.image = finalGallery[0] || '';
  src.variantImages = uniq((src.variantImages || []).map(x => remapUrl(x, map)).filter(Boolean));
  (src.colorOptions || []).forEach(x => { if (x.image) x.image = remapUrl(x.image, map); });
  (src.sizeOptions || []).forEach(x => { if (x.image) x.image = remapUrl(x.image, map); });
  (src.variantGroups || []).forEach(g => (g.options || []).forEach(x => { if (x.image) x.image = remapUrl(x.image, map); }));
  (src.skuVariants || []).forEach(x => { if (x.image) x.image = remapUrl(x.image, map); if (!x.priceUzs && x.priceCny) x.priceUzs = calcAutoPrice(x.priceCny); });
  (src.variants || []).forEach(x => { if (x.image) x.image = remapUrl(x.image, map); if (!x.priceUzs && x.priceCny) x.priceUzs = calcAutoPrice(x.priceCny); });
  src.imagesByColor = src.imagesByColor || {};
  Object.entries(src.imagesByColor).forEach(([key, rows]) => { src.imagesByColor[key] = uniq([...(Array.isArray(rows) ? rows : [rows]).map(x => remapUrl(x, map)).filter(Boolean), ...finalGallery]); });
  (src.colorOptions || []).forEach(option => { if (option.name && option.image && !src.imagesByColor[option.name]) src.imagesByColor[option.name] = uniq([option.image, ...finalGallery]); });
  return src;
}
function productPayload(finalImages = imageUrls(), mappedSource = state.source || {}) { const src = { ...mappedSource, url: extract1688Url($('sourceUrl').value), id: (mappedSource?.id || parseItemId($('sourceUrl').value)), priceCny: Number($('priceCny').value || 0), moq: Number($('moq').value || 1), stock: Number($('stock').value || 0), images: finalImages, galleryImages: finalImages }; return { productId: state.editingId, sourceUrl: src.url, itemId: src.id, source: src, name: $('name').value.trim(), name_ru: $('nameRu').value.trim(), price: Number($('price').value || 0), oldPrice: Number($('oldPrice').value || 0), priceCny: Number($('priceCny').value || 0), weightKg: Number($('weightKg').value || 0), deliveryMinDays: Number($('minDays').value || 15), deliveryMaxDays: Number($('maxDays').value || 30), moq: Number($('moq').value || 1), stock: Number($('stock').value || 0), popularScore: Number($('popularScore').value || 50), tags: $('tags').value.split(',').map(x => x.trim()).filter(Boolean), images: finalImages, externalImages: state.externalImages, description: $('description').value.trim() }; }
async function save() {
  const btn = $('saveBtn'); if (!$('name').value.trim() || !Number($('price').value)) return toast('Mahsulot nomi va sotuv narxini kiriting'); const originalGallery = imageUrls(); if (!originalGallery.length && !confirm('Rasmsiz mahsulot saqlansinmi?')) return; setBusy(btn, true, 'Saqlanmoqda...');
  try { let finalGallery = originalGallery; let mappedSource = state.source || {}; if ($('copyImages').checked) { const item = state.source?.id || parseItemId($('sourceUrl').value) || 'draft'; const galleryResult = await copyUrlsToStorage(originalGallery, item + '-gallery', 'Asosiy galereya standartlanmoqda'); finalGallery = originalGallery.map(x => galleryResult.urlMap.get(normalizeImageUrl(x)) || x); const variants = variantMedia(mappedSource); const variantResult = await copyUrlsToStorage(variants, item + '-variants', 'Variant rasmlari alohida saqlanmoqda'); mappedSource = remapSourceMedia(mappedSource, variantResult.urlMap, finalGallery); copyNotice(`${galleryResult.normalized} ta galereya rasmi va ${variantResult.normalized} ta variant rasmi Storage’ga alohida saqlandi.${galleryResult.failed + variantResult.failed ? ' Ayrim rasmlarni tekshiring.' : ''}`, galleryResult.failed + variantResult.failed ? 'warning' : 'success'); }
    const d = await api({ action: 'save', product: productPayload(finalGallery, mappedSource) }); toast(d.created ? 'Mahsulot katalogga qo‘shildi' : 'Mahsulot yangilandi'); notice(`Mahsulot ${d.id} ID bilan saqlandi. Galereya va variantlar alohida boshqariladi.`, 'success'); resetEditor(); await loadList();
  } catch (e) { toast(e.message); copyNotice(e.message, 'error'); } finally { setBusy(btn, false, 'Katalogga saqlash'); }
}
function savedCard(p) { const normalized = String(p.imageStandard || '').startsWith('square-1200'); const src = p.source || {}; return `<article class="saved-card"><div>${p.image ? previewImg(p.image, 'alt=""') : '<div class="placeholder"><i class="fa-solid fa-image"></i></div>'}</div><div><h3>${esc(p.name || 'Mahsulot')}</h3><p><b class="amount">${esc(money(p.price))}</b> · ID: ${esc(p.id)}</p><p>${esc(p.itemId ? '1688: ' + p.itemId : '1688 havola')} · ${p.isActive ? 'Faol' : 'Arxiv'}</p><p><i class="fa-solid fa-images"></i> ${esc(src.galleryImages?.length || p.images?.length || 0)} galereya · <i class="fa-solid fa-palette"></i> ${esc(src.colorOptions?.length || 0)} rang · <i class="fa-solid fa-ruler"></i> ${esc(src.sizeOptions?.length || 0)} razmer · <b class="image-standard ${normalized ? 'ready' : 'pending'}">${normalized ? '1:1 tayyor' : 'standartlash kerak'}</b></p><div class="saved-actions"><button class="tiny-btn" data-edit="${esc(p.id)}"><i class="fa-solid fa-pen"></i> Tahrir</button><button class="tiny-btn normalize" data-normalize="${esc(p.id)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Rasmlarni standartlash</button>${p.sourceUrl ? `<a class="tiny-btn" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 1688’da ochish</a>` : ''}${p.isActive ? `<button class="tiny-btn danger" data-archive="${esc(p.id)}"><i class="fa-solid fa-box-archive"></i> Arxiv</button>` : ''}</div></div></article>`; }
function renderList() { const rows = state.products; $('savedCount').textContent = rows.length + ' ta'; $('savedGrid').innerHTML = rows.map(savedCard).join(''); $('empty').hidden = !!rows.length; armPreviewFallbacks($('savedGrid')); markExistingBySource(); }
async function loadList() { if (!auth.currentUser) return; try { const d = await api({ action: 'list' }); state.products = d.products || []; state.pricing = d.pricing || state.pricing; renderList(); } catch (e) { toast(e.message); } }
function editRow(id) { const p = state.products.find(x => x.id === id); if (!p) return; state.editingId = id; $('editState').textContent = 'Tahrirlash: ' + id; $('sourceUrl').value = p.sourceUrl || ''; applySource(p.source || { url: p.sourceUrl, id: p.itemId, images: p.images }, { keepForm: true }); state.externalImages = sourceGallery(p.source || p); $('name').value = p.name || ''; $('nameRu').value = p.name_ru || ''; $('price').value = p.price || ''; $('oldPrice').value = p.oldPrice || 0; $('priceCny').value = p.priceCny || p.source?.priceCny || ''; $('weightKg').value = p.weightKg || ''; $('minDays').value = p.deliveryMinDays || 15; $('maxDays').value = p.deliveryMaxDays || 30; $('moq').value = p.moq || 1; $('stock').value = p.source?.stock || 0; $('popularScore').value = p.popularScore || 50; $('tags').value = (p.tags || []).join(', '); $('description').value = p.description || ''; }
async function normalizeAnyImagesToStorage(urls, itemId) { const original = uniq((urls || []).map(normalizeImageUrl).filter(Boolean)).slice(0, 18); const result = await copyUrlsToStorage(original, (itemId || 'draft') + '-standard', 'Eski rasmlar qayta standartlanmoqda'); return { urls: original.map(x => result.urlMap.get(x) || x), externalImages: original, ...result }; }
async function normalizeRow(id, btn) { if (!confirm('Ushbu mahsulotning asosiy galereyasi yagona 1200×1200 px formatga qayta tayyorlansinmi?')) return; const p = state.products.find(x => x.id === id); const urls = (p?.source?.galleryImages?.length ? p.source.galleryImages : p?.source?.images?.length ? p.source.images : p?.images) || []; if (!urls.length) return toast('Qayta ishlash uchun rasm topilmadi'); setBusy(btn, true, 'Tayyorlanmoqda...'); try { const batch = await normalizeAnyImagesToStorage(urls, p?.itemId || id); const d = await api({ action: 'applyNormalizedImages', productId: id, images: batch.urls, externalImages: batch.externalImages }); copyNotice(`${d.normalized || batch.normalized || 0} ta galereya rasmi yagona standartga tayyorlandi.`, batch.failed ? 'warning' : 'success'); toast('Galereya standartlashtirildi'); await loadList(); } catch (e) { toast(e.message); copyNotice(e.message, 'error'); } finally { setBusy(btn, false, 'Rasmlarni standartlash'); } }
async function archiveRow(id) { if (!confirm('Mahsulot katalogdan yashirilsinmi?')) return; try { await api({ action: 'archive', productId: id }); toast('Mahsulot arxivlandi'); await loadList(); } catch (e) { toast(e.message); } }
function decodeBase64Url(v) { const pad = '='.repeat((4 - v.length % 4) % 4), raw = atob(String(v).replace(/-/g, '+').replace(/_/g, '/') + pad), bytes = Uint8Array.from(raw, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function acceptExtensionImport() { const match = location.hash.match(/(?:^#|&)om1688=([^&]+)/); if (!match) return; try { const packet = JSON.parse(decodeBase64Url(match[1])); const src = packet?.item; if (!src?.url || !extract1688Url(src.url)) throw new Error('Importer ma’lumoti noto‘g‘ri'); history.replaceState(null, '', location.pathname + location.search); state.editingId = ''; $('editState').textContent = 'Kengaytmadan yangi qoralama'; $('extensionReady').classList.add('received'); $('extensionReady').innerHTML = '<i class="fa-solid fa-circle-check"></i><div><b>Professional importer ma’lumoti olindi</b><p>Asosiy galereya, ranglar, razmerlar va SKU kombinatsiyalarini tekshirib saqlang.</p></div>'; $('sourceUrl').value = src.url; applySource(src); notice('Galereya va variantlar alohida olindi. Saqlashdan oldin tekshiring.', 'success'); } catch (e) { notice('Kengaytmadan kelgan qoralama ochilmadi: ' + e.message, 'error'); } }
$('manualBtn').addEventListener('click', manual); $('saveBtn').addEventListener('click', save); $('refreshBtn').addEventListener('click', loadList); $('loginBtn').addEventListener('click', () => signInWithPopup(auth, provider).catch(e => toast(e.message))); $('authBtn').addEventListener('click', () => auth.currentUser ? signOut(auth) : signInWithPopup(auth, provider).catch(e => toast(e.message))); $('priceCny').addEventListener('input', () => { $('autoPriceLabel').textContent = money(calcAutoPrice($('priceCny').value)); }); $('savedGrid').addEventListener('click', e => { const edit = e.target.closest('[data-edit]'), normalize = e.target.closest('[data-normalize]'), archive = e.target.closest('[data-archive]'); if (edit) editRow(edit.dataset.edit); if (normalize) normalizeRow(normalize.dataset.normalize, normalize); if (archive) archiveRow(archive.dataset.archive); });
onAuthStateChanged(auth, u => { $('loginBox').hidden = !!u; $('authBtn').innerHTML = u ? '<i class="fa-solid fa-right-from-bracket"></i><span>Chiqish</span>' : '<i class="fa-brands fa-google"></i><span>Kirish</span>'; if (u) loadList(); else { state.products = []; renderList(); } });
renderList(); acceptExtensionImport();
