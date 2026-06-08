/* OrzuMall v53 — marketplace packing documents and exact 58×40 mm thermal labels */
(function(){
  'use strict';
  const TZ_OFFSET_MS=5*60*60*1000; // Asia/Tashkent is UTC+05:00 year-round.
  const CUTOFF_HOUR=16;
  const C39={
    '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
    'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
    'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
    'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn','Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','$':'nwnwnwnnn','/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn'
  };
  const esc=(v)=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
  const tsMs=(v)=>{try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(typeof v.toDate==='function')return v.toDate().getTime();if(v.seconds)return Number(v.seconds)*1000;return +new Date(v)||0}catch(_){return 0}};
  const money=(v)=>`${Math.round(num(v)).toLocaleString('uz-UZ')} so‘m`;
  const dateTime=(v)=>{const n=tsMs(v);return n?new Date(n).toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'};
  const short=(v,n=40)=>{const s=String(v==null?'':v).trim();return s.length>n?s.slice(0,Math.max(1,n-1))+'…':s};
  const id=(o)=>String(o?.orderId||o?.id||'').trim();
  const status=(o)=>{const s=String(o?.status||'new').trim().toLowerCase();return({pending:'new',pending_cash:'new',pending_payment:'new',processing:'packing',shipped:'shipping',completed:'delivered',canceled:'cancelled'}[s]||s)};
  const statusLabel=(o)=>({new:'Yangi',paid:'To‘langan',packing:'Yig‘ilyapti',shipping:'Yetkazishda',delivered:'Yetkazildi',cancelled:'Bekor qilindi',returned:'Qaytarildi'}[status(o)]||status(o)||'—');
  const owner=(o)=>String(o?.userName||o?.customerName||o?.fullName||o?.name||'Mijoz');
  const phone=(o)=>String(o?.shipping?.phone||o?.userPhone||o?.phone||o?.customerPhone||'—');
  const address=(o)=>String(o?.shipping?.addressText||o?.addressText||o?.address||[o?.shipping?.region||o?.region,o?.shipping?.district||o?.district,o?.shipping?.post||o?.post].filter(Boolean).join(' / ')||'—');
  const delivery=(o)=>String(o?.shipping?.methodLabel||o?.shipping?.serviceLabel||o?.shipping?.provider||o?.shipping?.method||o?.shipping?.type||o?.deliveryType||'Yetkazish');
  const provider=(o)=>{const p=String(o?.provider||o?.paymentType||'—').toLowerCase();if(p.includes('cash'))return'Naqd';if(p.includes('balance'))return'Balans';if(p.includes('click'))return'Click';if(p.includes('payme'))return'Payme';if(p.includes('card'))return'Karta';return p==='—'?'—':p.charAt(0).toUpperCase()+p.slice(1)};
  const qty=(it)=>Math.max(1,Math.round(num(it?.qty??it?.quantity??it?.count??1)||1));
  const itemTitle=(it)=>String(it?.title||it?.name||it?.productTitle||it?.productName||it?.productId||it?.id||'Mahsulot');
  const itemSku=(it)=>String(it?.sku||it?.article||it?.barcode||it?.productId||it?.id||'—');
  const variant=(it)=>{const o=it?.externalOptions||it?.selectedOptions||it?.chinaOptions||{};return String(it?.variantText||Object.values(o).filter(Boolean).join(' / ')||[it?.color,it?.size,it?.variant].filter(Boolean).join(' / ')||'—')};
  const source=(it)=>String(it?.sourceLabel||it?.externalMarket?.label||it?.sourcePlatform||it?.externalMarket?.platform||'').trim();
  const items=(o)=>Array.isArray(o?.items)?o.items:[];
  const itemCount=(o)=>items(o).reduce((s,it)=>s+qty(it),0);
  const subtotal=(o)=>{const direct=num(o?.productsTotalUZS||o?.pricing?.subtotalUZS||o?.subtotalUZS);return direct>0?direct:items(o).reduce((s,it)=>s+qty(it)*num(it?.unitPriceUZS||it?.priceUZS||it?.price),0)};
  const deliveryFee=(o)=>Math.max(0,num(o?.deliveryFeeUZS||o?.shipping?.deliveryFeeUZS||o?.shipping?.feeUZS||o?.pricing?.deliveryFeeUZS));
  const total=(o)=>{const direct=num(o?.totalUZS||o?.pricing?.totalUZS||o?.total||o?.amountUZS||o?.amount);return direct>0?direct:subtotal(o)+deliveryFee(o)};
  const orderBarcodeText=(o)=>{const raw=(id(o)||'ORZUMALL').toUpperCase().replace(/[^0-9A-Z. $/+%\-]/g,'-');return short(raw,32)||'ORZUMALL'};

  function tashkentParts(now=Date.now()){
    const d=new Date(now+TZ_OFFSET_MS);
    return{year:d.getUTCFullYear(),month:d.getUTCMonth(),day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes()};
  }
  function cutoffForParts(p){return Date.UTC(p.year,p.month,p.day,CUTOFF_HOUR-5,0,0,0)}
  function latestCutoffMs(now=Date.now()){
    const p=tashkentParts(now);let c=cutoffForParts(p);
    if(p.hour<CUTOFF_HOUR)c-=24*60*60*1000;
    return c;
  }
  function nextCutoffMs(now=Date.now()){
    const p=tashkentParts(now);let c=cutoffForParts(p);
    if(p.hour>=CUTOFF_HOUR)c+=24*60*60*1000;
    return c;
  }
  function cutoffLabel(ms){return new Date(ms).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  function isFulfillmentOpen(o){return['new','paid','packing'].includes(status(o))}
  function dueBatch(orders,now=Date.now()){
    const cut=latestCutoffMs(now);
    return (Array.isArray(orders)?orders:[]).filter(o=>isFulfillmentOpen(o)&&tsMs(o?.createdAt)<=cut).sort((a,b)=>tsMs(a?.createdAt)-tsMs(b?.createdAt));
  }

  function code39Svg(text,opts={}){
    const value='*'+String(text||'ORZUMALL').toUpperCase().replace(/[^0-9A-Z. $/+%\-]/g,'-')+'*';
    const narrow=Math.max(.7,num(opts.narrow)||1),wide=narrow*2.55,gap=narrow;
    let x=0,bars='';
    for(const ch of value){
      const pattern=C39[ch]||C39['-'];
      for(let i=0;i<pattern.length;i++){
        const w=pattern[i]==='w'?wide:narrow;
        if(i%2===0)bars+=`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="22"/>`;
        x+=w;
      }
      x+=gap;
    }
    return `<svg class="barcode" viewBox="0 0 ${x.toFixed(2)} 22" preserveAspectRatio="none" aria-label="${esc(text)}"><g fill="#000">${bars}</g></svg>`;
  }
  function printShell({title,css,body}){
    return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>${body}<script>setTimeout(function(){window.focus();window.print();},260);<\/script></body></html>`;
  }
  function openPrint(html,title='OrzuMall chop etish'){
    try{
      const bridge=window.OrzuMallNative;
      if(bridge&&typeof bridge.printHtml==='function'){bridge.printHtml(String(html),String(title));return true}
    }catch(_){ }
    const w=window.open('','_blank');
    if(!w)return false;
    w.document.open();w.document.write(html);w.document.close();return true;
  }
  function label58(o){
    const orderId=id(o)||'—';
    return `<section class="label"><header><div><b>OrzuMall</b><small>YIG‘IM ETIKETKASI</small></div><strong>#${esc(orderId)}</strong></header><div class="barcode-wrap">${code39Svg(orderBarcodeText(o))}<span>${esc(orderBarcodeText(o))}</span></div><div class="recipient"><b>${esc(short(owner(o),28))}</b><span>${esc(short(phone(o),22))}</span></div><div class="address">${esc(short(address(o),82))}</div><footer><span>${esc(short(delivery(o),20))}</span><b>${itemCount(o)} ta • ${esc(money(total(o)))}</b></footer></section>`;
  }
  function labels58Html(orders){
    const list=(Array.isArray(orders)?orders:[orders]).filter(Boolean);
    const css=`@page{size:58mm 40mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#000}.label{width:58mm;height:40mm;padding:2mm 2.1mm 1.7mm;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;border:.2mm solid #000}.label:last-child{page-break-after:auto}header{display:flex;align-items:flex-start;justify-content:space-between;gap:1mm;border-bottom:.25mm solid #000;padding-bottom:.7mm}header b{display:block;font-size:11pt;line-height:1;font-weight:900}header small{display:block;margin-top:.5mm;font-size:4.8pt;font-weight:800;letter-spacing:.45mm}header strong{font-size:10pt;line-height:1}.barcode-wrap{margin-top:.8mm;text-align:center}.barcode{display:block;width:100%;height:6.4mm}.barcode-wrap span{display:block;margin-top:.2mm;font:700 5.2pt monospace;letter-spacing:.6mm}.recipient{display:flex;align-items:center;justify-content:space-between;gap:1mm;margin-top:.5mm}.recipient b{font-size:7.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recipient span{font-size:6.3pt;font-weight:700;white-space:nowrap}.address{min-height:6.4mm;margin-top:.6mm;padding-top:.5mm;border-top:.2mm dashed #000;font-size:6.2pt;line-height:1.17;font-weight:700;overflow:hidden}footer{display:flex;align-items:center;justify-content:space-between;gap:1mm;margin-top:auto;padding-top:.5mm;border-top:.2mm solid #000;font-size:5.7pt;font-weight:800}footer span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}footer b{white-space:nowrap}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    return printShell({title:'58x40 etiketka',css,body:list.map(label58).join('')});
  }
  function orderPickBlock(o,index){
    const rows=items(o).map((it,i)=>`<tr><td>${index}.${i+1}</td><td><b>${esc(itemSku(it))}</b></td><td>${esc(itemTitle(it))}<small>${esc(variant(it))}${source(it)?' • Manba: '+esc(source(it)):''}</small></td><td class="qty">${qty(it)}</td><td class="check">□</td><td class="check">□</td></tr>`).join('');
    return `<section class="order"><div class="order-head"><div><h2>#${esc(id(o)||'—')}</h2><p>${esc(owner(o))} • ${esc(phone(o))}</p></div><div class="right"><b>${esc(statusLabel(o))}</b><span>${esc(dateTime(o?.createdAt))}</span></div></div><div class="meta"><div><small>Yetkazish</small><b>${esc(delivery(o))}</b></div><div><small>Manzil</small><b>${esc(address(o))}</b></div><div><small>To‘lov</small><b>${esc(provider(o))}</b></div><div><small>Jami</small><b>${esc(money(total(o)))}</b></div></div><table><thead><tr><th>№</th><th>SKU / ID</th><th>Mahsulot va variant</th><th>Soni</th><th>Oldim</th><th>Qadoq</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Mahsulot ma’lumoti yo‘q</td></tr>'}</tbody></table><div class="sign"><span>Yig‘uvchi: __________________</span><span>Tekshiruvchi: __________________</span><span>Vaqt: ______ : ______</span></div></section>`;
  }
  function pickSheetHtml(orders,meta={}){
    const list=(Array.isArray(orders)?orders:[orders]).filter(Boolean);
    const totalItems=list.reduce((s,o)=>s+itemCount(o),0);
    const title=meta.title|| (list.length>1?'16:00 NAVBATI — YIG‘IM HUJJATI':'BUYURTMA YIG‘IM HUJJATI');
    const subtitle=meta.subtitle||`${list.length} ta buyurtma • ${totalItems} ta tovar birligi`;
    const css=`@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}.doc-head{display:flex;justify-content:space-between;gap:16px;padding-bottom:8px;border-bottom:2px solid #111}.brand{font-size:20pt;font-weight:900}.doc-title{text-align:right}.doc-title h1{margin:0;font-size:15pt}.doc-title p{margin:4px 0 0;font-size:9pt}.summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.summary span{border:1px solid #bbb;border-radius:8px;padding:5px 8px;font-size:8pt;font-weight:700}.order{margin-top:11px;padding:8px;border:1px solid #555;border-radius:8px;break-inside:avoid}.order-head{display:flex;justify-content:space-between;gap:10px}.order h2{margin:0;font-size:13pt}.order p{margin:3px 0 0;font-size:8.5pt}.right{text-align:right}.right b,.right span{display:block;font-size:8pt}.meta{display:grid;grid-template-columns:1fr 2fr 1fr 1fr;gap:5px;margin-top:7px}.meta div{padding:4px 5px;border:1px solid #ddd;border-radius:5px;min-width:0}.meta small,.meta b{display:block;font-size:7pt}.meta b{margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}table{width:100%;margin-top:7px;border-collapse:collapse;font-size:7.5pt}th,td{border:1px solid #aaa;padding:4px;text-align:left}th{background:#f2f2f2}.qty,.check{text-align:center;font-weight:900}.check{font-size:14pt;line-height:1}td small{display:block;margin-top:2px;color:#555}.sign{display:flex;justify-content:space-between;gap:8px;margin-top:7px;font-size:7.5pt;font-weight:700}.doc-foot{margin-top:10px;padding-top:6px;border-top:1px solid #aaa;font-size:7pt;color:#555}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    const head=`<header class="doc-head"><div><div class="brand">OrzuMall</div><small>MARKETPLACE YIG‘IM MARKAZI</small></div><div class="doc-title"><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></header><div class="summary"><span>Kesim: ${esc(meta.cutoffLabel||'—')}</span><span>Buyurtmalar: ${list.length} ta</span><span>Tovar birliklari: ${totalItems} ta</span><span>Chop etildi: ${esc(new Date().toLocaleString('uz-UZ'))}</span></div>`;
    return printShell({title,css,body:head+list.map((o,i)=>orderPickBlock(o,i+1)).join('')+`<div class="doc-foot">Yig‘im tugagach etiketkani qadoqqa yopishtiring va buyurtmani “Yetkazishga berish” bosqichiga o‘tkazing.</div>`});
  }
  function printLabels58(orders){const list=(Array.isArray(orders)?orders:[orders]).filter(Boolean);return list.length?openPrint(labels58Html(list),`58x40 etiketka (${list.length})`):false}
  function printLabel58(order){return printLabels58([order])}
  function printPickSheet(order){return order?openPrint(pickSheetHtml([order],{title:'BUYURTMA YIG‘IM HUJJATI',cutoffLabel:'Individual'}),`Yig‘im hujjati #${id(order)}`):false}
  function printPickBatch(orders,meta={}){const list=(Array.isArray(orders)?orders:[]).filter(Boolean);return list.length?openPrint(pickSheetHtml(list,meta),`Yig‘im hujjati (${list.length})`):false}
  window.OrzuMallOrderPrint={TZ_OFFSET_MS,CUTOFF_HOUR,tsMs,money,dateTime,itemCount,status,latestCutoffMs,nextCutoffMs,cutoffLabel,dueBatch,labels58Html,pickSheetHtml,printLabel58,printLabels58,printPickSheet,printPickBatch};
})();
