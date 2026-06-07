(() => {
  const $ = id => document.getElementById(id);
  const state = { items: [], page: 1, q: '', sort: 'default', hasMore: false, active: null };
  const fmt = n => Math.round(Number(n || 0)).toLocaleString('ru-RU');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const status = (text = '', type = 'info') => { const el = $('status'); el.className = `status ${text ? 'show' : ''} ${type}`; el.innerHTML = text; };
  async function api(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.message || data.error || `HTTP_${res.status}`); e.data = data; throw e; }
    return data;
  }
  function loading(btn, on, label = '') { if (!btn) return; if (!btn.dataset.original) btn.dataset.original = btn.innerHTML; btn.disabled = !!on; btn.innerHTML = on ? `<i class="fa-solid fa-spinner fa-spin"></i> ${label || 'Yuklanmoqda'}` : btn.dataset.original; }
  function image(item) { return item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" decoding="async">` : '<span class="photoFallback"><i class="fa-solid fa-image"></i></span>'; }
  function card(item) {
    return `<article class="product"><div class="photo">${image(item)}</div><div class="productBody"><div class="productTitle">${esc(item.title)}</div><div class="price">${item.priceUzs ? fmt(item.priceUzs) + ' so‘m' : 'Narxni tekshirish'}</div><div class="cny">${item.priceCny ? esc(item.priceCny) + ' yuan dan' : '1688 narxi'}</div><div class="meta"><span>MOQ: ${esc(item.moq || 1)}</span>${item.sales ? `<span>Sotuv: ${esc(item.sales)}</span>` : ''}</div><button class="cardBtn" data-open="${esc(item.id || item.url)}">Batafsil</button></div></article>`;
  }
  function render(append = false) {
    const grid = $('grid');
    if (!append) grid.innerHTML = '';
    grid.insertAdjacentHTML('beforeend', state.items.map(card).join(''));
    $('empty').classList.toggle('show', !state.items.length);
    $('loadMore').classList.toggle('show', !!state.hasMore && !!state.items.length);
    $('resultSub').textContent = state.items.length ? `${state.items.length} ta mahsulot ko‘rsatildi` : 'Mahsulot qidiring yoki havola kiriting';
  }
  async function search({ reset = true } = {}) {
    const q = $('searchInput').value.trim();
    if (q.length < 2) return status('Qidirish uchun kamida 2 ta belgi yozing.', 'warn');
    if (reset) { state.page = 1; state.items = []; }
    state.q = q; state.sort = $('sort').value;
    loading($('searchBtn'), true, 'Qidirilmoqda'); status('1688 katalogidan mahsulotlar olinmoqda...', 'info');
    try {
      const out = await api(`/.netlify/functions/china1688-search?q=${encodeURIComponent(q)}&page=${state.page}&sort=${encodeURIComponent(state.sort)}`);
      const rows = Array.isArray(out.items) ? out.items : [];
      state.items = reset ? rows : state.items.concat(rows);
      state.hasMore = !!out.hasMore; render();
      status(rows.length ? `Natijalar tayyor. Narxlar <b>${esc(out.pricingConfig?.cnyToUzs || '')}</b> so‘mlik yuan kursi asosida taxminiy hisoblandi.` : 'Mahsulot topilmadi. Xitoycha kalit so‘z yoki 1688 havolasidan foydalaning.', rows.length ? 'ok' : 'warn');
    } catch (e) {
      render();
      if (e.data?.setupRequired) status('<b>1688 API kaliti hali kiritilmagan.</b><br>Netlify Environment Variables bo‘limiga <code>TMAPI_API_TOKEN</code> qo‘shilgach ushbu sahifa jonli ishlaydi.', 'warn');
      else status(esc(e.message), 'error');
    } finally { loading($('searchBtn'), false); }
  }
  async function importLink() {
    const url = $('linkInput').value.trim();
    if (!url) return status('1688 mahsulot havolasini kiriting.', 'warn');
    loading($('importBtn'), true, 'Ochilmoqda'); status('Mahsulot ma’lumoti olinmoqda...', 'info');
    try { const out = await api('/.netlify/functions/china1688-item', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({url}) }); openDetail(out.item); status('Mahsulot muvaffaqiyatli ochildi.', 'ok'); }
    catch(e){ if(e.data?.setupRequired) status('<b>1688 API kaliti hali kiritilmagan.</b><br>Netlify Environment Variables bo‘limiga <code>TMAPI_API_TOKEN</code> qo‘shing.', 'warn'); else status(esc(e.message),'error'); }
    finally { loading($('importBtn'), false); }
  }
  async function openByKey(key) {
    const row = state.items.find(x => String(x.id || x.url) === String(key));
    if (!row) return;
    status('Mahsulot tafsilotlari yuklanmoqda...', 'info');
    try { const out = await api('/.netlify/functions/china1688-item', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ itemId: row.id, url: row.url }) }); openDetail({ ...row, ...(out.item || {}) }); status('', 'info'); }
    catch (e) { status(esc(e.message), 'error'); }
  }
  function openModal(id) { $(id).classList.add('open'); $(id).setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closeModal(id) { $(id).classList.remove('open'); $(id).setAttribute('aria-hidden','true'); if(!document.querySelector('.modal.open')) document.body.style.overflow=''; }
  function openDetail(item) {
    state.active = item;
    const imgs = (Array.isArray(item.images) ? item.images : []).filter(Boolean);
    const firstImg = imgs[0] || item.image || '';
    const props = (item.props || []).slice(0,12).map(p=>`<div class="prop"><b>${esc(p.name||'Xususiyat')}</b><span>${esc(p.value||'—')}</span></div>`).join('');
    const tags = (item.serviceTags || []).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
    $('detailBody').innerHTML = `<div class="detail"><div>${firstImg?`<img class="detailMainImg" id="detailMainImg" src="${esc(firstImg)}" alt="">`:'<div class="detailMainImg"></div>'}${imgs.length?`<div class="thumbs">${imgs.map(x=>`<img data-thumb="${esc(x)}" src="${esc(x)}" alt="">`).join('')}</div>`:''}</div><div><h2>${esc(item.title)}</h2><div class="detailPrice">${item.priceUzs?fmt(item.priceUzs)+' so‘m':'Narx operator tomonidan tekshiriladi'}</div><div class="detailLine">1688 narxi: <b>${esc(item.priceCny||'—')} yuan</b>${item.priceCnyMax&&item.priceCnyMax!==item.priceCny?` – ${esc(item.priceCnyMax)} yuan`:''} · Minimal buyurtma: <b>${esc(item.moq||1)} ${esc(item.unit||'dona')}</b></div>${item.sellerName?`<div class="detailLine"><i class="fa-solid fa-store"></i> ${esc(item.sellerName)}${item.sellerLocation?` · ${esc(item.sellerLocation)}`:''}</div>`:''}<div>${tags}</div>${props?`<div class="props">${props}</div>`:''}<div class="detailActions"><button class="btn" id="requestBtn"><i class="fa-solid fa-cart-shopping"></i> Buyurtma so‘rovi</button>${item.url?`<a class="btn btnGhost" href="${esc(item.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 1688 sahifasi</a>`:''}</div><p class="small">Cargo narxi mahsulot Xitoy omboriga kelib, aniq og‘irligi o‘lchangandan keyin hisoblanadi.</p></div></div>`;
    $('detailBody').querySelectorAll('[data-thumb]').forEach(el=>el.addEventListener('click',()=>{ const main=$('detailMainImg'); if(main) main.src=el.dataset.thumb; }));
    $('requestBtn')?.addEventListener('click', openRequest);
    openModal('detailModal');
  }
  function openRequest() {
    closeModal('detailModal'); const p = state.active || {};
    const variants = Array.isArray(p.variants) ? p.variants : [];
    $('requestBody').innerHTML = `<div class="requestProduct">${p.image?`<img src="${esc(p.image)}" alt="">`:''}<div><b>${esc(p.title||'1688 mahsuloti')}</b><small>${p.priceUzs?fmt(p.priceUzs)+' so‘m dan':'Narx tekshiriladi'} · MOQ ${esc(p.moq||1)}</small></div></div><div class="requestGrid"><label class="field"><span>Ismingiz</span><input class="input" id="reqName" placeholder="Ism familiya"></label><label class="field"><span>Telefon raqam</span><input class="input" id="reqPhone" placeholder="+998901234567" inputmode="tel"></label><label class="field"><span>Miqdor</span><input class="input" id="reqQty" type="number" min="1" value="${esc(p.moq||1)}"></label><label class="field"><span>Rang / o‘lcham / variant</span>${variants.length?`<select class="select" id="reqVariant"><option value="">Variantni tanlang</option>${variants.slice(0,100).map(v=>`<option value="${esc(v.name)}">${esc(v.name)}${v.priceUzs?' · '+fmt(v.priceUzs)+' so‘m':''}</option>`).join('')}</select>`:`<input class="input" id="reqVariant" placeholder="Masalan: qora, XL">`}</label><label class="field full"><span>Qo‘shimcha izoh</span><textarea class="textarea" id="reqNote" rows="3" placeholder="Operatorga kerakli ma’lumot"></textarea></label></div><div class="requestFoot"><button class="btn btnGhost" data-close="requestModal">Bekor qilish</button><button class="btn" id="sendReq"><i class="fa-solid fa-paper-plane"></i> So‘rov yuborish</button></div>`;
    $('requestBody').querySelector('[data-close]')?.addEventListener('click',()=>closeModal('requestModal'));
    $('sendReq')?.addEventListener('click', sendRequest); openModal('requestModal');
  }
  async function sendRequest() {
    const btn=$('sendReq'); loading(btn,true,'Yuborilmoqda');
    try {
      const out=await api('/.netlify/functions/china1688-request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:$('reqName').value,phone:$('reqPhone').value,qty:$('reqQty').value,variant:$('reqVariant').value,note:$('reqNote').value,product:state.active})});
      $('requestBody').innerHTML=`<div class="success"><i class="fa-solid fa-circle-check"></i><h3>So‘rov qabul qilindi</h3><p>Operator mahsulot narxi, mavjudligi va cargo shartlarini tekshiradi. So‘rov ID: <b>${esc(out.requestId)}</b></p><div class="requestFoot"><button class="btn" data-close="requestModal">Yopish</button></div></div>`;
      $('requestBody').querySelector('[data-close]')?.addEventListener('click',()=>closeModal('requestModal'));
    } catch(e){ alert(e.message); loading(btn,false); }
  }
  $('searchBtn').addEventListener('click',()=>search({reset:true})); $('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')search({reset:true})});
  $('importBtn').addEventListener('click',importLink); $('linkInput').addEventListener('keydown',e=>{if(e.key==='Enter')importLink()});
  $('chips').addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(!b)return;$('searchInput').value=b.dataset.q;search({reset:true})});
  $('grid').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openByKey(b.dataset.open)});
  $('loadMore').addEventListener('click',async()=>{state.page+=1;await search({reset:false})});
  document.addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c)closeModal(c.dataset.close)});
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
})();
