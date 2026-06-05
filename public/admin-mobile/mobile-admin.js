import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithPopup, signInWithRedirect, signInWithCustomToken, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, collectionGroup, doc, getDoc, onSnapshot, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const cfg={apiKey:"AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",authDomain:"xplusy-760fa.firebaseapp.com",projectId:"xplusy-760fa",storageBucket:"xplusy-760fa.firebasestorage.app",appId:"1:992512966017:web:5e919dbc9b8d8abcb43c80"};
const app=initializeApp(cfg), auth=getAuth(app), db=getFirestore(app);
setPersistence(auth,browserLocalPersistence).catch(()=>{});

const $=(id)=>document.getElementById(id);
const S={user:null,view:"orders",orderFilter:"new",reviewFilter:"pending",orders:[],topups:[],turnoverPeriod:7,threads:[],notes:[],reviews:[],products:new Map(),activeThread:null,messages:[],unsubs:[],msgUnsub:null,reviewTimer:null,alertsEnabled:localStorage.getItem("orzumall_mobile_admin_alerts_v1")==="1",alertSnoozeUntil:Number(localStorage.getItem("orzumall_mobile_admin_alert_snooze_until_v1")||0)||0,alertKnownIds:new Set(),alertInitialLoaded:false,alertTimer:null,audioCtx:null};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
const money=(v)=>`${Math.round(num(v)).toLocaleString("uz-UZ")} so‘m`;
const tsMs=(v)=>{try{if(!v)return 0;if(v.toMillis)return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;if(v._seconds)return Number(v._seconds)*1000;return +new Date(v)||0}catch(_){return 0}};
const dateFmt=(v,full=false)=>{const n=tsMs(v);if(!n)return "—";return new Date(n).toLocaleString("uz-UZ",full?{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})};
const initials=(v)=>String(v||"M").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"M";
const normEmail=(v)=>String(v||"").trim().toLowerCase();
const productName=(p)=>String(p?.nameUz||p?.titleUz||p?.name||p?.title||p?.productName||"Mahsulot");
const cleanPublicName=(v)=>{const s=String(v||"").trim().replace(/\s+/g," ");return !s||s.includes("@")?"":s};
const personName=(o={},fallback="Mijoz")=>{const full=[cleanPublicName(o?.firstName),cleanPublicName(o?.lastName)].filter(Boolean).join(" ").trim();return full||cleanPublicName(o?.name)||cleanPublicName(o?.fullName)||cleanPublicName(o?.displayName)||cleanPublicName(o?.userName)||cleanPublicName(o?.authorName)||fallback};
const userProfileCache=new Map();
async function loadUserProfile(uid){const id=String(uid||"").trim();if(!id)return{};if(userProfileCache.has(id))return userProfileCache.get(id)||{};try{const s=await getDoc(doc(db,"users",id)),u=s.exists()?(s.data()||{}):{};userProfileCache.set(id,u);return u}catch(_){return{}}}
async function enrichPublicNames(arr,kind="order"){return await Promise.all((Array.isArray(arr)?arr:[]).map(async item=>{const u=await loadUserProfile(item?.uid);const name=personName(u,personName(item,"Mijoz"));return kind==="review"?{...item,authorName:name}:{...item,userName:name,firstName:cleanPublicName(u.firstName||item.firstName)||null,lastName:cleanPublicName(u.lastName||item.lastName)||null}}))}
const reviewOwner=(r)=>personName({...r,name:r?.authorName},"Mijoz");
function normalizeStatus(v){const s=String(v||"").trim().toLowerCase();return({pending:"new",pending_cash:"new",pending_payment:"new",shared_telegram:"new",telegram:"new",processing:"packing",shipped:"shipping",completed:"delivered",canceled:"cancelled",rejected:"cancelled",declined:"cancelled"}[s]||s||"new")}
const META={new:{label:"Yangi",icon:"fa-cart-plus"},paid:{label:"To‘langan",icon:"fa-credit-card"},packing:{label:"Yig‘ilyapti",icon:"fa-box-open"},shipping:{label:"Yetkazib berishda",icon:"fa-truck-fast"},delivered:{label:"Yetkazib berildi",icon:"fa-circle-check"},cancelled:{label:"Bekor qilindi",icon:"fa-circle-xmark"},returned:{label:"Qaytarildi",icon:"fa-rotate-left"},return_requested:{label:"Qaytarish so‘rovi",icon:"fa-clock-rotate-left"},return_rejected:{label:"Qaytarish rad etildi",icon:"fa-ban"}};
const meta=(s)=>META[normalizeStatus(s)]||{label:String(s||"—"),icon:"fa-circle"};
const statusPill=(s)=>{const st=normalizeStatus(s),m=meta(st);return `<span class="status-pill"><i class="fa-solid ${m.icon}"></i>${esc(m.label)}</span>`};
function toast(text,type=""){const e=document.createElement("div");e.className=`toast ${type}`;e.textContent=text;$("toastHost").appendChild(e);setTimeout(()=>e.remove(),3000)}
function badge(id,n){const e=$(id);if(!e)return;e.hidden=!n;e.textContent=n>99?"99+":String(n)}
function empty(icon,text){return `<div class="empty"><i class="fa-solid ${icon}"></i>${esc(text)}</div>`}
async function isAdmin(user){const email=normEmail(user?.email);if(email==="sohibjonmath@gmail.com")return true;try{const s=await getDoc(doc(db,"configs","admins"));return s.exists()&&Array.isArray(s.data()?.emails)&&s.data().emails.map(normEmail).includes(email)}catch(_){return false}}
async function api(endpoint,action,payload={}){if(!S.user)throw new Error("Kirish talab qilinadi");const token=await S.user.getIdToken();const r=await fetch(`/.netlify/functions/${endpoint}`,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${token}`},body:JSON.stringify({action,...payload})});const out=await r.json().catch(()=>({}));if(!r.ok||!out.ok)throw new Error(out.error||"server_error");return out}
async function repairCustomerNamesOnce(){const key="orzumall_customer_name_repair_v96",last=Number(localStorage.getItem(key)||0)||0;if(Date.now()-last<24*60*60*1000)return;try{const out=await api("mobile-admin","repair_customer_names",{});localStorage.setItem(key,String(Date.now()));if(num(out.ordersUpdated)+num(out.reviewsUpdated)>0){startSubscriptions();toast(`Ismlar yangilandi: ${num(out.ordersUpdated)+num(out.reviewsUpdated)}`,"success")}}catch(_){}}

/* ===== v52: Android native bridge integration ===== */
function nativeBridge(){try{return window.OrzuMallNative||null}catch(_){return null}}
function nativeSyncOrderAlerts(){try{const c=orderAlertCounts();nativeBridge()?.syncOrderAlerts?.(Number(c.news.length||0),Number(c.packing.length||0),Number(c.urgent||0))}catch(_){}}
function nativeRequestPushToken(){try{nativeBridge()?.requestPushToken?.()}catch(_){}}
function nativeAskNotificationPermission(){try{nativeBridge()?.requestNotificationPermission?.()}catch(_){}}
async function consumeNativeCustomToken(raw){const customToken=String(raw||"").trim();if(!customToken)return;try{await signInWithCustomToken(auth,customToken);window.__orzumallNativeCustomToken=""}catch(err){console.warn("native auth failed",err)}}
window.addEventListener("orzumall-native-auth",e=>consumeNativeCustomToken(e?.detail?.customToken));
window.addEventListener("orzumall-native-ready",()=>{try{nativeRequestPushToken();nativeSyncOrderAlerts()}catch(_){}});
if(window.__orzumallNativeCustomToken)consumeNativeCustomToken(window.__orzumallNativeCustomToken);
async function nativeAnnounceAdminReady(user){try{const idToken=await user.getIdToken();nativeBridge()?.webAdminReady?.(String(user.email||""),String(idToken||""))}catch(_){}}

function openDrawer(){$("drawer").classList.add("open");$("drawerOverlay").hidden=false}
function closeDrawer(){$("drawer").classList.remove("open");$("drawerOverlay").hidden=true}
function setView(view){S.view=view;document.querySelectorAll(".view").forEach(e=>e.classList.toggle("active",e.id===`view-${view}`));document.querySelectorAll("[data-view]").forEach(e=>e.classList.toggle("active",e.dataset.view===view));closeDrawer();if(view!=="support")closeChat();renderCurrent();window.scrollTo({top:0,behavior:"smooth"})}
function renderCurrent(){({orders:renderOrders,balance:renderBalance,turnover:renderTurnover,support:renderSupport,notifications:renderNotifications,reviews:renderReviews}[S.view]||(()=>{}))();updateBadges()}
function updateBadges(){const action=orderAlertCounts().action;badge("badgeOrders",action);badge("bottomOrdersBadge",action);badge("badgeBalance",S.topups.filter(x=>topupStatus(x)==="pending").length);const sup=S.threads.reduce((a,t)=>a+Math.max(num(t.adminUnreadCount),t.needsHuman?1:0),0);badge("badgeSupport",sup);badge("bottomSupportBadge",sup);badge("badgeReviews",S.reviews.filter(r=>reviewModerationKey(r)==="pending").length);try{if("setAppBadge" in navigator){action?navigator.setAppBadge(action):navigator.clearAppBadge()}}catch(_){ }try{nativeSyncOrderAlerts()}catch(_){}}

/* ===== v51: repeating, action-based order reminders ===== */
const ORDER_ALERT_REPEAT_MS=60000;
const ORDER_ALERT_NEW_URGENT_MS=10*60*1000;
const ORDER_ALERT_PACKING_URGENT_MS=20*60*1000;
function orderAgeMs(o){return Math.max(0,Date.now()-tsMs(o.updatedAt||o.createdAt||o.statusUpdatedAt))}
function orderAlertCounts(){
  const news=S.orders.filter(o=>["new","paid"].includes(normalizeStatus(o.status)));
  const packing=S.orders.filter(o=>normalizeStatus(o.status)==="packing");
  const urgentNew=news.filter(o=>orderAgeMs(o)>=ORDER_ALERT_NEW_URGENT_MS);
  const urgentPacking=packing.filter(o=>orderAgeMs(o)>=ORDER_ALERT_PACKING_URGENT_MS);
  // Signal faqat yangi buyurtmalar uchun ishlaydi; yig‘ishdagi signal olib tashlangan.
  return {news,packing,urgentNew,urgentPacking,action:news.length,urgent:urgentNew.length};
}
function alertSnoozed(){return S.alertSnoozeUntil>Date.now()}
function alertTimeLeft(){const m=Math.max(0,Math.ceil((S.alertSnoozeUntil-Date.now())/60000));return m?`${m} daqiqa`:""}
function ensureAudioCtx(){
  try{if(!S.audioCtx){const C=window.AudioContext||window.webkitAudioContext;if(C)S.audioCtx=new C()}if(S.audioCtx?.state==="suspended")S.audioCtx.resume().catch(()=>{})}catch(_){ }
}
function playOrderBeep(strong=false){
  if(!S.alertsEnabled||alertSnoozed())return;
  try{ensureAudioCtx();const c=S.audioCtx;if(!c)return;const now=c.currentTime;const tones=strong?[880,660,880]:[740,880];tones.forEach((freq,i)=>{const o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.value=freq;g.gain.setValueAtTime(.0001,now+i*.18);g.gain.exponentialRampToValueAtTime(.16,now+i*.18+.025);g.gain.exponentialRampToValueAtTime(.0001,now+i*.18+.15);o.connect(g);g.connect(c.destination);o.start(now+i*.18);o.stop(now+i*.18+.17)})}catch(_){ }
}
function vibrateOrderAlert(strong=false){try{if(S.alertsEnabled&&!alertSnoozed()&&navigator.vibrate)navigator.vibrate(strong?[180,90,180,90,260]:[160,80,160])}catch(_){ }}
function notifyOrderAlert(counts,reason="repeat"){
  if(!S.alertsEnabled||alertSnoozed()||!counts.action)return;
  const title=counts.urgent?"⚠️ OrzuMall: kechikayotgan buyurtmalar bor":"🔔 OrzuMall: buyurtmalar kutmoqda";
  const body=`Yangi buyurtmalar: ${counts.news.length} ta.${counts.urgent?` Kechikayotgan: ${counts.urgent} ta.`:""}`;
  playOrderBeep(!!counts.urgent);vibrateOrderAlert(!!counts.urgent);
  if(reason!=="silent")toast(body,counts.urgent?"error":"");
  try{if("Notification" in window&&Notification.permission==="granted"&&(document.hidden||reason==="repeat"||reason==="new")){const n=new Notification(title,{body,tag:"orzumall-order-action-reminder",renotify:true,requireInteraction:!!counts.urgent,icon:"/favicon.webp",badge:"/favicon.webp"});n.onclick=()=>{window.focus();setView("orders");n.close()}}}catch(_){ }
}
function renderOrderAlertCenter(){
  const root=$("orderAlertCenter");if(!root)return;
  const c=orderAlertCounts();root.hidden=false;
  root.classList.toggle("has-pending",!!c.action&&!alertSnoozed());root.classList.toggle("is-urgent",!!c.urgent);root.classList.toggle("is-clear",!c.action);root.classList.toggle("is-snoozed",alertSnoozed());
  $("alertNewCount").textContent=String(c.news.length);$("alertPackingCount").textContent=String(c.packing.length);
  $("alertNewHint").textContent=c.urgentNew.length?`${c.urgentNew.length} ta kechikyapti`:"Qabul qiling";
  $("alertPackingHint").textContent="Yetkazishga tayyor";
  root.querySelector(".alert-new")?.classList.toggle("urgent",!!c.urgentNew.length);root.querySelector(".alert-packing")?.classList.remove("urgent");
  const accept=$("orderAcceptAllNew");if(accept){accept.hidden=!c.news.length;accept.querySelector("span").textContent=`Hammasini qabul (${c.news.length})`;}
  const msg=$("orderAlertMessage");if(msg){const span=msg.querySelector("span");if(!c.news.length)span.textContent="Yangi buyurtma yo‘q.";else if(c.urgent)span.textContent=`Diqqat: ${c.urgent} ta yangi buyurtma kutilmoqda.`;else span.textContent=`${c.news.length} ta yangi buyurtma qabul kutmoqda.`}
  document.title=c.action?`(${c.action}) OrzuMall Admin`:"OrzuMall Admin";
}
function scheduleOrderAlertTimer(){
  if(S.alertTimer)clearInterval(S.alertTimer);
  S.alertTimer=setInterval(()=>{renderOrderAlertCenter();const c=orderAlertCounts();if(c.action&&!alertSnoozed())notifyOrderAlert(c,"repeat")},ORDER_ALERT_REPEAT_MS);
}
function onOrdersSnapshot(orders){
  const prev=S.alertKnownIds;S.orders=orders;
  const active=orders.filter(o=>["new","paid"].includes(normalizeStatus(o.status)));
  const added=active.filter(o=>!prev.has(String(o.id)));
  S.alertKnownIds=new Set(active.map(o=>String(o.id)));
  renderCurrent();renderOrderAlertCenter();
  if(S.alertInitialLoaded&&added.length&&S.alertsEnabled&&!alertSnoozed())notifyOrderAlert(orderAlertCounts(),"new");
  if(!S.alertInitialLoaded){S.alertInitialLoaded=true;setTimeout(()=>{const c=orderAlertCounts();if(c.action&&S.alertsEnabled&&!alertSnoozed())notifyOrderAlert(c,"silent")},1600)}
}
async function enableOrderAlerts(){
  S.alertsEnabled=true;localStorage.setItem("orzumall_mobile_admin_alerts_v1","1");S.alertSnoozeUntil=0;localStorage.removeItem("orzumall_mobile_admin_alert_snooze_until_v1");ensureAudioCtx();
  try{nativeAskNotificationPermission()}catch(_){ }
  try{if("Notification" in window&&Notification.permission==="default")await Notification.requestPermission()}catch(_){ }
  renderOrderAlertCenter();nativeSyncOrderAlerts();const c=orderAlertCounts();if(c.action)notifyOrderAlert(c,"new");else toast("Buyurtma signali yoqildi","success")
}
function snoozeOrderAlerts(){S.alertSnoozeUntil=Date.now()+5*60*1000;localStorage.setItem("orzumall_mobile_admin_alert_snooze_until_v1",String(S.alertSnoozeUntil));renderOrderAlertCenter();toast("Signal 5 daqiqaga tinchitildi")}

function clearSubs(){S.unsubs.splice(0).forEach(fn=>{try{fn()}catch(_){}});try{S.msgUnsub?.()}catch(_){ }S.msgUnsub=null;if(S.reviewTimer){clearInterval(S.reviewTimer);S.reviewTimer=null}}
function subWithFallback(make,onData,label){let fallback=false,unsub=()=>{};const start=()=>{unsub=onSnapshot(make(fallback),snap=>onData(snap),err=>{console.warn(label,err);if(!fallback){fallback=true;try{unsub()}catch(_){ }start()}else toast(`${label}: ma’lumot olinmadi`,"error")})};start();S.unsubs.push(()=>{try{unsub()}catch(_){}})}
async function loadReviewsFromApi({silent=false}={}){try{const out=await api("mobile-admin","reviews_list",{});const reviews=Array.isArray(out.reviews)?out.reviews:[];S.reviews=reviews.sort((a,b)=>tsMs(b.updatedAt||b.createdAt)-tsMs(a.updatedAt||a.createdAt));renderCurrent();return true}catch(err){console.warn("Sharhlar API",err);if(!silent)toast("Sharhlar: serverdan ma’lumot olinmadi","error");return false}}
function startSubscriptions(){clearSubs();subWithFallback(f=>f?query(collection(db,"orders"),limit(250)):query(collection(db,"orders"),orderBy("createdAt","desc"),limit(250)),async snap=>{const orders=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt));onOrdersSnapshot(await enrichPublicNames(orders,"order"))},"Buyurtmalar");subWithFallback(f=>f?query(collection(db,"topup_requests"),limit(250)):query(collection(db,"topup_requests"),orderBy("createdAt","desc"),limit(250)),snap=>{S.topups=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt));renderCurrent()},"Balans");subWithFallback(f=>f?query(collection(db,"support_threads"),limit(250)):query(collection(db,"support_threads"),orderBy("updatedAt","desc"),limit(250)),snap=>{S.threads=snap.docs.map(d=>({uid:d.id,...d.data()})).sort((a,b)=>tsMs(b.updatedAt)-tsMs(a.updatedAt));renderCurrent()},"Qo‘llab-quvvatlash");subWithFallback(f=>f?query(collection(db,"notifications"),limit(250)):query(collection(db,"notifications"),orderBy("createdAt","desc"),limit(250)),snap=>{S.notes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt));renderCurrent()},"Bildirishnomalar");subWithFallback(f=>f?query(collection(db,"products"),limit(500)):query(collection(db,"products"),orderBy("updatedAt","desc"),limit(500)),snap=>{S.products=new Map(snap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));renderCurrent()},"Mahsulotlar");loadReviewsFromApi();S.reviewTimer=setInterval(()=>loadReviewsFromApi({silent:true}),30000)}

function orderOwner(o){return personName(o,"Mijoz")}
function orderPhone(o){return o.userPhone||o.phone||o.customerPhone||"—"}
function orderAddress(o){
  return String(o.shipping?.addressText||o.shipping?.address||o.deliveryAddress||o.addressText||o.address||o.customerAddress||"Manzil ko‘rsatilmagan").trim();
}
function orderLabelNo(o){return String(o.numericId||o.orderNo||o.orderNumber||o.id||"").trim();}
function orderTotal(o){return num(o.totalUZS||o.amountUZS||o.total||o.amount)}
function buildQrData(o){
  // Keep QR payload intentionally minimal so the QR uses the largest possible modules.
  // The printed text already contains customer details; the QR only needs the order number.
  return String(orderLabelNo(o)||"").trim();
}
function openOrderLabelPrint(id){
  const o=S.orders.find(x=>String(x.id)===String(id));if(!o)return toast("Buyurtma topilmadi","error");
  const no=orderLabelNo(o);
  const qrData=encodeURIComponent(buildQrData(o));
  const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=360x360&ecc=L&qzone=1&data=${qrData}`;
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Yorliq ${esc(no)}</title><style>
    @page{size:58mm 40mm;margin:0}
    *{box-sizing:border-box}
    html,body{width:58mm;height:40mm;margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}
    .label{width:58mm;height:40mm;padding:1.6mm 1.8mm 1.5mm;display:grid;grid-template-rows:auto 1fr;gap:.8mm;overflow:hidden}
    .top{display:flex;align-items:flex-start;justify-content:space-between;gap:1.4mm;border-bottom:.24mm solid #000;padding-bottom:.65mm}
    .brand{font-size:8.6pt;font-weight:900;line-height:1}
    .sub{font-size:4.7pt;font-weight:900;letter-spacing:.23mm;margin-top:.33mm;line-height:1}
    .ord{font-size:9.2pt;font-weight:900;line-height:1;white-space:nowrap}
    .body{display:grid;grid-template-columns:minmax(0,1fr) 18.5mm;gap:1.15mm;min-height:0}
    .left{min-width:0;min-height:0;display:flex;flex-direction:column}
    .name{font-size:7pt;font-weight:900;line-height:1.05;max-height:4.1mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .phone{font-size:6pt;font-weight:900;line-height:1.05;margin-top:.35mm;white-space:nowrap}
    .addrLabel{font-size:5.25pt;font-weight:900;line-height:1;margin-top:.8mm}
    .addr{margin-top:.35mm;font-size:5.45pt;line-height:1.13;max-height:13.4mm;overflow:hidden;word-break:break-word}
    .orderFoot{margin-top:auto;border-top:.2mm solid #000;padding-top:.55mm;text-align:center}
    .code{font-size:8.1pt;font-weight:900;letter-spacing:.42mm;line-height:1}
    .hint{font-size:4.25pt;font-weight:900;line-height:1.05;margin-top:.35mm}
    .qrSide{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:.2mm dashed #000;padding-left:.9mm}
    .qr{width:17.2mm;height:17.2mm;border:.23mm solid #000;border-radius:.9mm;overflow:hidden;background:#fff}
    .qr img{display:block;width:100%;height:100%;object-fit:cover}
    .qrCap{font-size:4.5pt;font-weight:900;line-height:1;text-align:center;margin-top:.6mm}
  </style></head><body><div class="label">
    <div class="top"><div><div class="brand">OrzuMall</div><div class="sub">BUYURTMA YORLIG‘I</div></div><div class="ord">№ ${esc(no)}</div></div>
    <div class="body">
      <div class="left">
        <div class="name">${esc(orderOwner(o))}</div>
        <div class="phone">Tel: ${esc(orderPhone(o))}</div>
        <div class="addrLabel">Yetkazib berish manzili:</div>
        <div class="addr">${esc(orderAddress(o))}</div>
        <div class="orderFoot"><div class="code">${esc(no)}</div><div class="hint">Buyurtma raqamini tekshirib yopishtiring</div></div>
      </div>
      <div class="qrSide"><div class="qr"><img id="labelQr" alt="QR" src="${qrUrl}"></div><div class="qrCap">Buyurtma QR</div></div>
    </div>
  </div><script>
    const doPrint=()=>setTimeout(()=>window.print(),120);
    const qr=document.getElementById("labelQr");
    if(qr&&qr.complete) doPrint(); else if(qr) qr.onload=doPrint;
    setTimeout(doPrint,1200);
  <\/script></body></html>`;
  const w=window.open("","_blank","width=420,height=340");
  if(!w){toast("Pop-up bloklangan. Brauzerda ruxsat bering.","error");return}
  w.document.open();w.document.write(html);w.document.close();
}

function activeCancel(st){return ["new","paid","packing","shipping"].includes(normalizeStatus(st))}
function orderActionButtons(o){const st=normalizeStatus(o.status),id=esc(o.id);let a=[];if(["new","paid"].includes(st))a.push(["packing","fa-box-open","Yig‘ishga olish","btn-next"]);if(st==="packing")a.push(["shipping","fa-truck-fast","Yetkazishga berish","btn-next"]);if(st==="shipping"){a.push(["delivered","fa-circle-check","Yetkazib berildi","btn-success"]);a.push(["returned","fa-rotate-left","Qaytarildi","btn-return"])}if(st==="delivered")a.push(["returned","fa-rotate-left","Qaytarildi","btn-return"]);if(activeCancel(st))a.push(["cancelled","fa-ban","Bekor qilish","btn-danger"]);let html=a.map(x=>`<button class="btn ${x[3]}" data-order-action="${id}" data-next="${x[0]}" type="button"><i class="fa-solid ${x[1]}"></i>${x[2]}</button>`).join("");if(st==="packing")html+=`<button class="btn btn-label" data-order-label="${id}" type="button"><i class="fa-solid fa-qrcode"></i>QR yorliq 58×40</button>`;return html}
function matchesOrderFilter(o,filter){const st=normalizeStatus(o.status);return filter==="new"?["new","paid"].includes(st):st===filter}
let orderQrScanner=null;
let orderQrBusy=false;
function orderQrModeConfig(mode){
  const m=String(mode||"");
  if(m==="packing")return {mode:m,title:"Yig‘ishdagi QR skaner",next:"shipping",accept:["packing"],done:"Buyurtma yetkazib berishga o‘tkazildi",hint:"Yig‘ilgan buyurtma QR kodini skanerlang",reason:"QR skaner orqali yetkazib berishga topshirildi"};
  if(m==="shipping")return {mode:m,title:"Yetkazishdagi QR skaner",next:"delivered",accept:["shipping"],done:"Buyurtma yetkazildi holatiga o‘tkazildi",hint:"Yetkazilgan buyurtma QR kodini skanerlang",reason:"QR skaner orqali yetkazib berildi"};
  if(m==="returned")return {mode:m,title:"Qaytarilgan QR skaner",next:"returned",accept:["shipping","delivered"],done:"Buyurtma qaytarilganlar ro‘yxatiga qo‘shildi",hint:"Qaytgan buyurtma QR kodini skanerlang",reason:"Buyurtma mijoz tomonidan qaytarildi"};
  return null;
}
function orderScanButton(mode){
  const c=orderQrModeConfig(mode);if(!c)return "";
  return `<button class="status-scan-btn" data-order-scan="${esc(mode)}" type="button"><i class="fa-solid fa-qrcode"></i><span>QR skaner</span></button>`;
}
function openOrderScanChooser(){
  const items=["packing","shipping","returned"].map(mode=>{
    const c=orderQrModeConfig(mode);const next=meta(c.next).label;
    const icon=mode==="packing"?"fa-box-open":mode==="shipping"?"fa-truck-fast":"fa-rotate-left";
    const tone=mode;
    return `<button class="scan-mode-card tone-${tone}" data-order-scan-choice="${esc(mode)}" type="button"><i class="fa-solid ${icon}"></i><div><b>${esc(c.title)}</b><span>${esc(c.hint)}. Skanerdan keyin <strong>${esc(next)}</strong> holatiga o‘tadi.</span></div><u><i class="fa-solid fa-arrow-right"></i></u></button>`;
  }).join("");
  openModal("QR skaner turini tanlang",`<div class="scan-mode-picker"><div class="scan-mode-intro"><i class="fa-solid fa-qrcode"></i><div><b>Qaysi jarayon uchun skaner ochilsin?</b><span>Birini tanlang — keyin mos QR kamera darhol ochiladi.</span></div></div><div class="scan-mode-list">${items}</div></div>`,()=>{
    document.querySelectorAll('[data-order-scan-choice]').forEach(btn=>btn.addEventListener('click',()=>{
      const mode=btn.dataset.orderScanChoice;closeModal();setTimeout(()=>openOrderQrScanner(mode),70);
    }));
  });
}
function cleanOrderQrValue(raw){
  let v=String(raw||"").trim();
  try{const j=JSON.parse(v);v=String(j.orderNo||j.orderId||j.id||v).trim()}catch(_e){}
  try{const u=new URL(v);v=String(u.searchParams.get("order")||u.searchParams.get("orderNo")||u.searchParams.get("id")||v).trim()}catch(_e){}
  return v.replace(/^#/,"").replace(/^№\s*/,"").trim();
}
function comparableOrderCode(v){return String(v||"").trim().replace(/^#/,"").replace(/^№\s*/,"").replace(/\s+/g,"").toUpperCase()}
function findOrderByQr(raw){
  const code=comparableOrderCode(cleanOrderQrValue(raw));if(!code)return null;
  return S.orders.find(o=>[o.id,o.numericId,o.orderNo,o.orderNumber,orderLabelNo(o)].some(v=>comparableOrderCode(v)===code))||null;
}
async function stopOrderQrScanner(){
  const scanner=orderQrScanner;orderQrScanner=null;
  if(scanner){try{await scanner.stop()}catch(_e){}try{await scanner.clear()}catch(_e){}}
}
const RETURN_REASON_OPTIONS=[
  "Buyurtma mijoz tomonidan qaytarildi",
  "Puli to‘lanmadi",
  "Manzilda mijoz mavjud emas",
  "Mijoz buyurtmani olishdan bosh tortdi",
  "Mahsulot mijozga mos kelmadi",
  "__other__"
];
function returnReasonOptionsHtml(selected=""){
  return RETURN_REASON_OPTIONS.map(x=>{
    const label=x==="__other__"?"Boshqa sabab":x;
    return `<option value="${esc(x)}" ${x===selected?"selected":""}>${esc(label)}</option>`;
  }).join("");
}
function bindReturnReasonCustom(){
  const sel=$("returnReasonSelect"),wrap=$("returnReasonCustomWrap");
  const sync=()=>{if(wrap)wrap.hidden=sel?.value!=="__other__"};
  sel?.addEventListener("change",sync);sync();
}
function getSelectedReturnReason(){
  const sel=$("returnReasonSelect");
  const custom=String($("returnReasonCustom")?.value||"").trim();
  return sel?.value==="__other__"?custom:String(sel?.value||"").trim();
}
async function finalizeOrderQrTransition(o,cfg,reason){
  if(orderQrBusy)return;
  orderQrBusy=true;
  try{
    await api("order-lifecycle","admin_update_status",{orderId:o.id,status:cfg.next,reason:String(reason||cfg.reason||"").trim()});
    o.status=cfg.next;
    try{navigator.vibrate?.([90,45,90])}catch(_e){}
    await stopOrderQrScanner();
    closeModal();
    S.orderFilter=cfg.next;
    renderOrders();
    toast(cfg.done,"success");
  }catch(err){
    const statusEl=$("orderQrStatus");
    if(statusEl)statusEl.innerHTML=`<i class="fa-solid fa-circle-xmark"></i> ${esc(err.message||"Xatolik")}`;
    toast("Xatolik: "+err.message,"error");
  }finally{orderQrBusy=false}
}
function openReturnedQrReason(o,cfg){
  openModal("Qaytarish sababini tanlang",`
    <div class="return-reason-card">
      <i class="fa-solid fa-rotate-left"></i>
      <div><b>#${esc(o.id)}</b><span>${esc(orderOwner(o))}</span></div>
    </div>
    <label class="field">
      <span>Qaytarish sababi</span>
      <select id="returnReasonSelect">${returnReasonOptionsHtml("Buyurtma mijoz tomonidan qaytarildi")}</select>
    </label>
    <label class="field" id="returnReasonCustomWrap" hidden>
      <span>Boshqa sabab</span>
      <textarea id="returnReasonCustom" placeholder="Mijozga ko‘rinadigan sabab"></textarea>
    </label>
    <div class="modal-actions">
      <button class="btn btn-soft" data-modal-close type="button">Ortga</button>
      <button class="btn btn-return" id="returnQrReasonSave" type="button">Qaytarildi deb belgilash</button>
    </div>`,()=>{
      bindReturnReasonCustom();
      $("returnQrReasonSave")?.addEventListener("click",async e=>{
        const reason=getSelectedReturnReason();
        if(reason.length<4)return toast("Sababni tanlang yoki yozing","error");
        e.currentTarget.disabled=true;
        await finalizeOrderQrTransition(o,cfg,reason);
      });
    });
}
async function processOrderQrScan(raw,mode){
  if(orderQrBusy)return;
  const cfg=orderQrModeConfig(mode);if(!cfg)return;
  const statusEl=$("orderQrStatus");
  const o=findOrderByQr(raw);
  if(!o){if(statusEl)statusEl.innerHTML='<i class="fa-solid fa-circle-xmark"></i> Buyurtma topilmadi. QR kodni qayta skanerlang.';toast("Buyurtma topilmadi","error");return}
  const current=normalizeStatus(o.status);
  if(current===cfg.next){if(statusEl)statusEl.innerHTML='<i class="fa-solid fa-circle-info"></i> Bu buyurtma avvalroq kerakli bo‘limga o‘tkazilgan.';toast("Buyurtma allaqachon shu bo‘limda","success");return}
  if(!cfg.accept.includes(current)){
    const msg=`Bu QR ${meta(current).label} bo‘limidagi buyurtmaga tegishli.`;
    if(statusEl)statusEl.innerHTML=`<i class="fa-solid fa-triangle-exclamation"></i> ${esc(msg)}`;
    toast(msg,"error");return;
  }
  if(cfg.mode==="returned"){
    orderQrBusy=true;
    await stopOrderQrScanner();
    closeModal();
    orderQrBusy=false;
    setTimeout(()=>openReturnedQrReason(o,cfg),70);
    return;
  }
  await finalizeOrderQrTransition(o,cfg,cfg.reason);
}
async function startOrderQrCamera(mode){
  const statusEl=$("orderQrStatus"),reader=$("orderQrReader");
  if(!reader)return;
  if(!window.Html5Qrcode){if(statusEl)statusEl.innerHTML='<i class="fa-solid fa-circle-xmark"></i> QR skaner kutubxonasi yuklanmadi. Pastdagi qo‘lda kiritish maydonidan foydalaning.';return}
  await stopOrderQrScanner();
  if(statusEl)statusEl.innerHTML='<i class="fa-solid fa-camera"></i> Kamera ishga tushirilmoqda...';
  try{
    const scanner=new window.Html5Qrcode("orderQrReader");orderQrScanner=scanner;
    await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230},aspectRatio:1},decoded=>processOrderQrScan(decoded,mode),()=>{});
    if(statusEl)statusEl.innerHTML='<i class="fa-solid fa-qrcode"></i> QR kodni kamera ichiga joylang.';
  }catch(err){
    if(statusEl)statusEl.innerHTML='<i class="fa-solid fa-circle-exclamation"></i> Kamera ochilmadi. Ruxsatni tekshiring yoki kodni qo‘lda kiriting.';
  }
}
function openOrderQrScanner(mode){
  const cfg=orderQrModeConfig(mode);if(!cfg)return;
  openModal(cfg.title,`<div class="qr-scan-shell"><div class="qr-scan-hero"><i class="fa-solid fa-qrcode"></i><div><b>${esc(cfg.hint)}</b><span>Skanerlangan buyurtma avtomatik ravishda <strong>${esc(meta(cfg.next).label)}</strong> holatiga o‘tadi.</span></div></div><div class="qr-reader-wrap"><div id="orderQrReader"></div></div><div class="qr-scan-status" id="orderQrStatus"><i class="fa-solid fa-camera"></i> Kamera tayyorlanmoqda...</div><button class="btn btn-primary btn-block" id="orderQrRetry" type="button"><i class="fa-solid fa-camera-rotate"></i>Kamerani qayta yoqish</button><div class="qr-manual-sep"><span>yoki</span></div><div class="qr-manual-row"><input id="orderQrManual" inputmode="numeric" autocomplete="off" placeholder="Buyurtma raqamini kiriting"><button class="btn btn-soft" id="orderQrManualGo" type="button"><i class="fa-solid fa-arrow-right"></i></button></div></div>`,()=>{
    $("orderQrRetry")?.addEventListener("click",()=>startOrderQrCamera(mode));
    const go=()=>processOrderQrScan($("orderQrManual")?.value||"",mode);
    $("orderQrManualGo")?.addEventListener("click",go);
    $("orderQrManual")?.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
    setTimeout(()=>startOrderQrCamera(mode),80);
  });
}
function renderOrderChips(){const root=$("orderFilterChips");if(!root)return;const keys=["new","packing","shipping","delivered","cancelled","returned"];root.innerHTML=keys.map(k=>`<button class="chip ${S.orderFilter===k?"active":""}" data-order-filter="${k}" type="button">${meta(k).label} <b>${S.orders.filter(o=>matchesOrderFilter(o,k)).length}</b></button>`).join("")}
function renderOrders(){
  const q=String($("ordersSearch")?.value||"").toLowerCase().trim();renderOrderChips();renderOrderAlertCenter();
  const filter=S.orderFilter||"new";if(!S.orderFilter)S.orderFilter=filter;
  const arr=S.orders.filter(o=>matchesOrderFilter(o,filter)&&(!q||`${o.id} ${orderOwner(o)} ${orderPhone(o)} ${o.numericId||""}`.toLowerCase().includes(q)));
  const newCount=S.orders.filter(o=>matchesOrderFilter(o,"new")).length,packingCount=S.orders.filter(o=>matchesOrderFilter(o,"packing")).length,shippingCount=S.orders.filter(o=>matchesOrderFilter(o,"shipping")).length;
  $("orderStats").innerHTML=`<div class="stat-card tint-brand"><div class="k">Yangi</div><div class="v">${newCount}</div></div><div class="stat-card"><div class="k">Yig‘ishda</div><div class="v">${packingCount}</div></div><div class="stat-card"><div class="k">Yetkazishda</div><div class="v">${shippingCount}</div></div>`;
  const sm=meta(filter);const head=`<div class="status-section-head status-${esc(filter)}"><span><i class="fa-solid ${sm.icon}"></i>${esc(sm.label)} buyurtmalar <b>${arr.length}</b></span>${orderScanButton(filter)}</div>`;
  const cards=arr.length?arr.map(o=>{const st=normalizeStatus(o.status),note=o.statusNote||o.cancellation?.reason||o.returnRequest?.resolutionReason||"",age=orderAgeMs(o),aging=(["new","paid"].includes(st)&&age>=ORDER_ALERT_NEW_URGENT_MS)||(st==="packing"&&age>=ORDER_ALERT_PACKING_URGENT_MS),ageMin=Math.max(1,Math.floor(age/60000));return `<article class="order-card status-${esc(st)} ${aging?"is-aging":""}" data-order-detail="${esc(o.id)}"><div class="card-top"><div><div class="order-code">BUYURTMA • <span class="mono">#${esc(o.id)}</span></div><div class="card-title">${esc(orderOwner(o))}</div>${aging?`<span class="aging-tag"><i class="fa-solid fa-triangle-exclamation"></i>${ageMin} daqiqadan beri kutmoqda</span>`:""}</div>${statusPill(st)}</div><div class="card-grid"><div class="mini-info"><span>Telefon</span><b>${esc(orderPhone(o))}</b></div><div class="mini-info"><span>Summa</span><b>${esc(money(orderTotal(o)))}</b></div><div class="mini-info"><span>To‘lov</span><b>${esc(o.provider||o.paymentType||"—")}</b></div><div class="mini-info"><span>Vaqt</span><b>${esc(dateFmt(o.createdAt))}</b></div></div>${note?`<div class="order-note">${esc(note)}</div>`:""}<div class="card-actions">${orderActionButtons(o)}<button class="btn btn-soft" data-order-detail-btn="${esc(o.id)}" type="button"><i class="fa-solid fa-eye"></i>Batafsil</button></div></article>`}).join(""):empty("fa-box-open",`${sm.label} buyurtma yo‘q.`);
  $("ordersList").innerHTML=head+cards;
}
function orderDetails(o){const hist=Array.isArray(o.statusHistory)?o.statusHistory:[],st0=normalizeStatus(o.status);return `<div class="detail-row"><div class="mini-info"><span>Mijoz</span><b>${esc(orderOwner(o))}</b></div><div class="mini-info"><span>Telefon</span><b>${esc(orderPhone(o))}</b></div><div class="mini-info"><span>Jami</span><b>${esc(money(orderTotal(o)))}</b></div><div class="mini-info"><span>To‘lov</span><b>${esc(o.provider||"—")}</b></div></div><div class="mini-info"><span>Yetkazish</span><b>${esc(o.shipping?.methodLabel||o.shipping?.serviceLabel||"—")}</b></div>${orderAddress(o)?`<div class="order-note">${esc(orderAddress(o))}</div>`:""}${st0==="packing"?`<button class="btn btn-label label-wide" data-order-label="${esc(o.id)}" type="button"><i class="fa-solid fa-qrcode"></i>58×40 QR yorliq chiqarish</button>`:""}<div class="section-title"><span>Status tarixi</span></div><div class="timeline">${hist.length?hist.slice().reverse().map(h=>{const st=normalizeStatus(h.status);return `<div class="timeline-item status-${esc(st)}"><b>${esc(meta(st).label)} • ${esc(h.actorName||h.actorType||"Tizim")}</b><span>${esc(dateFmt(h.at,true))}${h.reason?`<br>${esc(h.reason)}`:""}</span></div>`}).join(""):`<div class="empty">Tarix hali yozilmagan.</div>`}</div><div class="card-actions">${orderActionButtons(o)}</div>`}
function openOrderDetails(id){const o=S.orders.find(x=>String(x.id)===String(id));if(!o)return;openModal("Buyurtma #"+o.id,orderDetails(o))}
function openOrderAction(id,next){
  const o=S.orders.find(x=>String(x.id)===String(id));if(!o)return;
  const required=["cancelled","returned","return_rejected"].includes(next),label=meta(next).label;
  const returned=next==="returned";
  const reasonField=returned?`
    <label class="field">
      <span>Qaytarish sababi</span>
      <select id="returnReasonSelect">${returnReasonOptionsHtml("Buyurtma mijoz tomonidan qaytarildi")}</select>
    </label>
    <label class="field" id="returnReasonCustomWrap" hidden>
      <span>Boshqa sabab</span>
      <textarea id="returnReasonCustom" placeholder="Mijozga ko‘rinadigan sabab"></textarea>
    </label>`:`
    <label class="field">
      <span>Izoh ${required?"(majburiy)":"(ixtiyoriy)"}</span>
      <textarea id="orderActionReason" placeholder="Mijozga ko‘rinadigan izoh"></textarea>
    </label>`;
  openModal(label,`
    <p class="muted">#${esc(o.id)} buyurtmani <b>${esc(label)}</b> holatiga o‘tkazasiz.</p>
    ${reasonField}
    <div class="modal-actions">
      <button class="btn btn-soft" data-modal-close type="button">Ortga</button>
      <button class="btn ${next==="cancelled"?"btn-danger":next==="returned"?"btn-return":"btn-primary"}" id="orderActionSave" type="button">Tasdiqlash</button>
    </div>`,()=>{
      if(returned)bindReturnReasonCustom();
      $("orderActionSave")?.addEventListener("click",async e=>{
        const reason=returned?getSelectedReturnReason():String($("orderActionReason")?.value||"").trim();
        if(required&&reason.length<4)return toast("Sabab yozing","error");
        const b=e.currentTarget;b.disabled=true;
        try{
          const out=await api("order-lifecycle","admin_update_status",{orderId:o.id,status:next,reason});
          closeModal();
          toast(out.refund?.refunded?"Status yangilandi va mablag‘ qaytarildi":"Status yangilandi","success");
        }catch(err){toast("Xatolik: "+err.message,"error")}
        finally{b.disabled=false}
      });
    });
}
async function acceptAllNewOrders(){
  const orders=S.orders.filter(o=>matchesOrderFilter(o,"new"));
  if(!orders.length)return toast("Yangi buyurtma yo‘q");
  openModal("Hammasini qabul qilish",`<p class="muted"><b>${orders.length} ta</b> yangi buyurtma birdaniga <b>Yig‘ilyapti</b> holatiga o‘tadi.</p><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Bekor</button><button class="btn btn-primary" id="bulkAcceptSave" type="button">Hammasini qabul qilish</button></div>`,()=>{$("bulkAcceptSave")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;let ok=0,fail=0;for(const o of orders){try{await api("order-lifecycle","admin_update_status",{orderId:o.id,status:"packing",reason:"Admin tomonidan ommaviy qabul qilindi"});ok++;}catch(_){fail++;}}
    closeModal();
    if(ok&&fail) toast(`${ok} ta qabul qilindi, ${fail} ta o'tmadi`,`error`);
    else if(ok) toast(`${ok} ta buyurtma qabul qilindi`,`success`);
    else toast("Buyurtmalar qabul qilinmadi","error");
  })})
}

function topupStatus(x){const s=String(x.status||"pending").toLowerCase();return s==="pending_click"||s==="pending_payment"||s==="waiting"?"pending":s}
function renderBalanceChips(){const root=$("balanceFilterChips");if(!root)return;const active=root.dataset.active||"";root.innerHTML=["","pending","approved","rejected"].map(k=>`<button class="chip ${active===k?"active":""}" data-balance-filter="${k}" type="button">${k?({pending:"Kutilmoqda",approved:"Tasdiqlangan",rejected:"Rad etilgan"}[k]):"Barchasi"} <b>${S.topups.filter(x=>!k||topupStatus(x)===k).length}</b></button>`).join("")}
function renderBalance(){renderBalanceChips();const active=$("balanceFilterChips")?.dataset.active||"",q=String($("balanceSearch")?.value||"").toLowerCase().trim(),arr=S.topups.filter(x=>(!active||topupStatus(x)===active)&&(!q||`${x.id} ${x.uid||""} ${x.userPhone||x.phone||""} ${x.payerCardMasked||""}`.toLowerCase().includes(q)));const pending=S.topups.filter(x=>topupStatus(x)==="pending");$("balanceStats").innerHTML=`<div class="stat-card tint-brand"><div class="k">Kutilmoqda</div><div class="v">${pending.length}</div></div><div class="stat-card"><div class="k">Summa</div><div class="v">${money(pending.reduce((s,x)=>s+num(x.amountUZS),0))}</div></div><div class="stat-card"><div class="k">Tasdiqlangan</div><div class="v">${S.topups.filter(x=>topupStatus(x)==="approved").length}</div></div>`;$("balanceList").innerHTML=arr.length?arr.map(x=>{const st=topupStatus(x),label={pending:"Kutilmoqda",approved:"Tasdiqlangan",rejected:"Rad etilgan"}[st]||st,amt=num(x.amountUZS||x.amount);return `<article class="topup-card status-${st==="approved"?"delivered":st==="rejected"?"cancelled":"new"}"><div class="card-top"><div><div class="order-code">BALANS • <span class="mono">#${esc(x.id)}</span></div><div class="card-title">${esc(money(amt))}</div></div><span class="status-pill">${esc(label)}</span></div><div class="card-grid"><div class="mini-info"><span>Telefon</span><b>${esc(x.userPhone||x.phone||"—")}</b></div><div class="mini-info"><span>Karta</span><b>${esc(x.payerCardMasked||"—")}</b></div><div class="mini-info"><span>UID</span><b>${esc(x.uid||x.numericId||"—")}</b></div><div class="mini-info"><span>Vaqt</span><b>${esc(dateFmt(x.createdAt))}</b></div></div>${x.adminNote?`<div class="order-note">${esc(x.adminNote)}</div>`:""}${st==="pending"?`<div class="card-actions"><button class="btn btn-success" data-topup-approve="${esc(x.id)}" type="button"><i class="fa-solid fa-check"></i>Tasdiqlash</button><button class="btn btn-danger" data-topup-reject="${esc(x.id)}" type="button"><i class="fa-solid fa-xmark"></i>Rad etish</button></div>`:""}</article>`}).join(""):empty("fa-wallet","Balans so‘rovi topilmadi.")}
function openTopupApprove(id){const x=S.topups.find(v=>v.id===id);if(!x)return;const amt=num(x.amountUZS||x.amount);openModal("Balansni tasdiqlash",`<label class="field"><span>Balansga qo‘shiladigan summa</span><input id="topupFinalAmount" type="number" min="1" value="${Math.round(amt)}"></label><label class="field"><span>Izoh (ixtiyoriy)</span><textarea id="topupNote" placeholder="Masalan: Click to‘lovi tasdiqlandi"></textarea></label><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Ortga</button><button class="btn btn-success" id="topupApproveSave" type="button">Tasdiqlash</button></div>`,()=>{$("topupApproveSave")?.addEventListener("click",async e=>{const finalAmountUZS=num($("topupFinalAmount")?.value),note=String($("topupNote")?.value||"").trim();if(finalAmountUZS<=0)return toast("Summa noto‘g‘ri","error");e.currentTarget.disabled=true;try{await api("mobile-admin","topup_approve",{requestId:id,finalAmountUZS,note});closeModal();toast("Balans to‘ldirildi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{e.currentTarget.disabled=false}})})}
function openTopupReject(id){openModal("Balans so‘rovini rad etish",`<label class="field"><span>Sabab</span><textarea id="topupRejectReason" placeholder="Mijozga ko‘rinadigan izoh"></textarea></label><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Ortga</button><button class="btn btn-danger" id="topupRejectSave" type="button">Rad etish</button></div>`,()=>{$("topupRejectSave")?.addEventListener("click",async e=>{const reason=String($("topupRejectReason")?.value||"").trim();if(reason.length<4)return toast("Sabab yozing","error");e.currentTarget.disabled=true;try{await api("mobile-admin","topup_reject",{requestId:id,reason});closeModal();toast("So‘rov rad etildi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{e.currentTarget.disabled=false}})})}

function periodStart(){return S.turnoverPeriod?Date.now()-S.turnoverPeriod*86400000:0}
function renderTurnover(){const from=periodStart(),orders=S.orders.filter(x=>tsMs(x.createdAt)>=from),topups=S.topups.filter(x=>tsMs(x.createdAt)>=from),delivered=orders.filter(x=>normalizeStatus(x.status)==="delivered"),returned=orders.filter(x=>normalizeStatus(x.status)==="returned"),approved=topups.filter(x=>topupStatus(x)==="approved"),rev=delivered.reduce((s,x)=>s+orderTotal(x),0),refund=returned.reduce((s,x)=>s+num(x.refund?.amountUZS||orderTotal(x)),0),credit=approved.reduce((s,x)=>s+num(x.finalAmountUZS||x.amountUZS),0);$("turnoverStats").innerHTML=`<div class="analytic primary"><span>Sof buyurtma tushumi</span><b>${money(Math.max(0,rev-refund))}</b></div><div class="analytic"><span>Yetkazilgan</span><b>${money(rev)}</b></div><div class="analytic"><span>Qaytarilgan</span><b>${money(refund)}</b></div><div class="analytic"><span>Balans tushumi</span><b>${money(credit)}</b></div>`;const rows=[...orders.map(o=>({at:o.createdAt,title:`Buyurtma #${o.id}`,text:`${orderOwner(o)} • ${meta(o.status).label}`,amount:orderTotal(o),kind:normalizeStatus(o.status)==="returned"?"minus":"order"})),...approved.map(x=>({at:x.approvedAt||x.createdAt,title:"Balans to‘ldirildi",text:x.userPhone||x.uid||"Mijoz",amount:num(x.finalAmountUZS||x.amountUZS),kind:"plus"}))].sort((a,b)=>tsMs(b.at)-tsMs(a.at)).slice(0,100);$("turnoverState").textContent=`${rows.length} ta yozuv`;$("turnoverList").innerHTML=rows.length?rows.map(r=>`<article class="txn-card"><div class="card-top"><div><div class="card-title">${esc(r.title)}</div><div class="order-code">${esc(r.text)} • ${esc(dateFmt(r.at))}</div></div><b style="color:${r.kind==="minus"?"#ef4444":r.kind==="plus"?"#047857":"#182133"}">${r.kind==="minus"?"−":r.kind==="plus"?"+":""}${esc(money(r.amount))}</b></div></article>`).join(""):empty("fa-chart-line","Aylanma yozuvi topilmadi.")}

function renderSupport(){const q=String($("supportSearch")?.value||"").toLowerCase().trim(),arr=S.threads.filter(t=>!q||`${t.uid} ${t.userName||t.name||""} ${t.userPhone||t.phone||""}`.toLowerCase().includes(q));$("supportList").innerHTML=arr.length?arr.map(t=>{const name=t.userName||t.name||"Mijoz",un=num(t.adminUnreadCount);return `<article class="thread-card" data-thread="${esc(t.uid)}"><div class="avatar">${esc(initials(name))}</div><div class="thread-main"><b>${esc(name)}</b><p>${esc(t.lastMessage||"Yangi murojaat")}</p></div><div class="thread-side">${un?`<span class="unread">${un}</span>`:""}${t.needsHuman?`<span class="needs-human">Operator kerak</span>`:""}<div class="order-code">${esc(dateFmt(t.updatedAt))}</div></div></article>`}).join(""):empty("fa-headset","Hozircha murojaat yo‘q.")}
function openChat(uid){const t=S.threads.find(x=>String(x.uid)===String(uid));S.activeThread=t||{uid};$("chatName").textContent=t?.userName||t?.name||"Mijoz";$("chatMeta").textContent=`UID: ${uid} • ${t?.status==="closed"?"Yopilgan":"Faol"}`;$("supportChatScreen").hidden=false;try{S.msgUnsub?.()}catch(_){ }S.msgUnsub=onSnapshot(query(collection(db,"support_threads",uid,"messages"),orderBy("createdAt","asc"),limit(250)),snap=>{S.messages=snap.docs.map(d=>({id:d.id,...d.data()}));renderMessages()},()=>{S.msgUnsub=onSnapshot(query(collection(db,"support_threads",uid,"messages"),limit(250)),snap=>{S.messages=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>tsMs(a.createdAt)-tsMs(b.createdAt));renderMessages()})})}
function closeChat(){$("supportChatScreen")&&( $("supportChatScreen").hidden=true);try{S.msgUnsub?.()}catch(_){ }S.msgUnsub=null;S.activeThread=null;S.messages=[]}
function renderMessages(){const root=$("chatMessages");root.innerHTML=S.messages.length?S.messages.map(m=>`<div class="bubble ${m.sender==="admin"?"admin":m.sender==="user"?"user":"system"}">${esc(m.text||"")}<small>${esc(m.sender==="admin"?"OrzuMall":m.sender==="user"?"Mijoz":"AI yordamchi")} • ${esc(dateFmt(m.createdAt))}</small></div>`).join(""):empty("fa-comments","Xabar yo‘q.");setTimeout(()=>{root.scrollTop=root.scrollHeight},40)}

function renderNotifications(){$("notificationsList").innerHTML=S.notes.length?S.notes.map(n=>`<article class="note-card ${n.active===false?"off":""}"><div class="card-top"><div><h3>${esc(n.title||"Bildirishnoma")}</h3><p>${esc(n.body||n.text||"")}</p></div><span class="status-pill">${n.targetType==="all"?"Barchaga":"Shaxsiy"}</span></div><footer><span>${esc(dateFmt(n.createdAt))}</span><span class="card-actions" style="margin:0"><button class="btn btn-soft" data-note-toggle="${esc(n.id)}" data-active="${n.active!==false}" type="button">${n.active===false?"Yoqish":"O‘chirish"}</button><button class="btn btn-danger" data-note-delete="${esc(n.id)}" type="button"><i class="fa-solid fa-trash"></i></button></span></footer></article>`).join(""):empty("fa-bell-slash","Bildirishnoma yo‘q.")}
function openNewNotification(){openModal("Bildirishnoma yuborish",`<label class="field"><span>Qabul qiluvchi</span><select id="noteTarget"><option value="all">Barcha mijozlar</option><option value="uid">Bitta mijoz UID</option></select></label><label class="field" id="noteUidWrap" hidden><span>Mijoz UID</span><input id="noteUid" placeholder="Firebase UID"></label><label class="field"><span>Turi</span><select id="noteType"><option value="info">Oddiy xabar</option><option value="promo">Aksiya</option><option value="warning">Muhim ogohlantirish</option></select></label><label class="field"><span>Sarlavha</span><input id="noteTitle" placeholder="Masalan: Yangi aksiya"></label><label class="field"><span>Xabar</span><textarea id="noteText" placeholder="Mijozga yuboriladigan xabar"></textarea></label><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Ortga</button><button class="btn btn-primary" id="noteSend" type="button">Yuborish</button></div>`,()=>{$("noteTarget")?.addEventListener("change",e=>$("noteUidWrap").hidden=e.target.value!=="uid");$("noteSend")?.addEventListener("click",async e=>{const targetType=$("noteTarget").value,targetUid=$("noteUid")?.value||"",type=$("noteType").value,title=$("noteTitle").value.trim(),text=$("noteText").value.trim();if(!title||!text)return toast("Sarlavha va xabarni yozing","error");if(targetType==="uid"&&!targetUid.trim())return toast("UID kiriting","error");e.currentTarget.disabled=true;try{await api("mobile-admin","notification_send",{targetType,targetUid,type,title,text});closeModal();toast("Bildirishnoma yuborildi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{e.currentTarget.disabled=false}})})}

function reviewModerationKey(r){
  const s=String(r?.moderationStatus||"").toLowerCase();
  return ["approved","rejected","pending"].includes(s)?s:"approved";
}
function reviewSourceLabel(r){
  return r?.orderId||r?.source==="order_feedback"?"Buyurtma fikri":"Mahsulot sharhi";
}
function reviewSentiment(r){
  const n=num(r?.stars);
  return n>=4?"positive":(n>=3?"neutral":"negative");
}
function reviewFilterMatch(r,key){
  const k=String(key||"pending");
  if(k==="all")return true;
  if(k==="unanswered")return !r.adminReplyText&&!r.adminReply?.text;
  if(k==="order_feedback")return !!(r.orderId||r.source==="order_feedback");
  if(k==="negative")return num(r.stars)<=2;
  return reviewModerationKey(r)===k;
}
function renderReviewFilterChips(){
  const root=$("reviewFilterChips");if(!root)return;
  const cfg=[
    ["pending","Tasdiqlash",S.reviews.filter(r=>reviewModerationKey(r)==="pending").length],
    ["approved","Namoyishda",S.reviews.filter(r=>reviewModerationKey(r)==="approved").length],
    ["rejected","Rad etilgan",S.reviews.filter(r=>reviewModerationKey(r)==="rejected").length],
    ["order_feedback","Buyurtma fikri",S.reviews.filter(r=>r.orderId||r.source==="order_feedback").length],
    ["unanswered","Javobsiz",S.reviews.filter(r=>!r.adminReplyText&&!r.adminReply?.text).length],
    ["negative","Salbiy",S.reviews.filter(r=>num(r.stars)<=2).length],
    ["all","Barchasi",S.reviews.length]
  ];
  root.innerHTML=cfg.map(([key,label,count])=>`<button class="chip ${S.reviewFilter===key?"active":""}" data-review-filter="${key}" type="button">${label} <b>${count}</b></button>`).join("");
}
function uniqueOrderFeedbackRows(){
  const map=new Map();
  for(const r of S.reviews){
    if(!(r.orderId||r.source==="order_feedback")) continue;
    const key=String(r.orderId||`${r.uid||r.id}:${r.text||""}`);
    const prev=map.get(key);
    if(!prev || tsMs(r.updatedAt||r.createdAt)>tsMs(prev.updatedAt||prev.createdAt)) map.set(key,r);
  }
  return [...map.values()];
}
function renderReviewAnalysis(){
  const root=$("reviewAnalysis");if(!root)return;
  const feedback=uniqueOrderFeedbackRows();
  const positive=feedback.filter(r=>reviewSentiment(r)==="positive").length;
  const neutral=feedback.filter(r=>reviewSentiment(r)==="neutral").length;
  const negative=feedback.filter(r=>reviewSentiment(r)==="negative").length;
  const total=Math.max(1,feedback.length);
  const pct=n=>Math.round(n*100/total);
  root.innerHTML=`<div class="review-analysis-head"><div><b>Buyurtma fikrlari tahlili</b><span>${feedback.length} ta buyurtma fikri kuzatilmoqda</span></div><i class="fa-solid fa-chart-simple"></i></div><div class="review-analysis-bars"><div><span><b>Ijobiy</b><em>${positive}</em></span><i><u style="width:${pct(positive)}%"></u></i></div><div><span><b>O‘rtacha</b><em>${neutral}</em></span><i><u style="width:${pct(neutral)}%"></u></i></div><div><span><b>Salbiy</b><em>${negative}</em></span><i><u style="width:${pct(negative)}%"></u></i></div></div>`;
}
function reviewStatusPill(r){
  const st=reviewModerationKey(r),cfg={pending:["Kutilmoqda","fa-clock"],approved:["Namoyishda","fa-circle-check"],rejected:["Rad etilgan","fa-circle-xmark"]}[st];
  return `<span class="review-status ${st}"><i class="fa-solid ${cfg[1]}"></i>${cfg[0]}</span>`;
}
function renderReviews(){
  const q=String($("reviewsSearch")?.value||"").toLowerCase().trim();
  renderReviewFilterChips();renderReviewAnalysis();
  const arr=S.reviews.filter(r=>reviewFilterMatch(r,S.reviewFilter)&&(()=>{const pn=productName(S.products.get(r.productId));return !q||`${pn} ${r.authorName||""} ${r.text||""} ${r.orderId||""}`.toLowerCase().includes(q)})());
  const pending=S.reviews.filter(r=>reviewModerationKey(r)==="pending").length;
  const approved=S.reviews.filter(r=>reviewModerationKey(r)==="approved").length;
  const negative=S.reviews.filter(r=>num(r.stars)<=2).length;
  const approvedRows=S.reviews.filter(r=>reviewModerationKey(r)==="approved");
  const avg=approvedRows.length?(approvedRows.reduce((s,r)=>s+num(r.stars),0)/approvedRows.length).toFixed(1):"0";
  $("reviewsStats").innerHTML=`<div class="stat-card tint-brand"><div class="k">Tasdiqlash</div><div class="v">${pending}</div></div><div class="stat-card"><div class="k">Namoyishda</div><div class="v">${approved}</div></div><div class="stat-card"><div class="k">Salbiy / o‘rtacha</div><div class="v">${negative} • ${avg} ★</div></div>`;
  $("reviewsList").innerHTML=arr.length?arr.map(r=>{
    const pn=productName(S.products.get(r.productId)),reply=r.adminReply?.text||r.adminReplyText||"",st=reviewModerationKey(r);
    return `<article class="review-card review-${st}"><div class="card-top"><div><div class="review-meta-line">${reviewStatusPill(r)}<span class="review-source">${esc(reviewSourceLabel(r))}</span></div><div class="order-code">${esc(pn)}</div><h3>${esc(reviewOwner(r))}</h3>${r.orderId?`<small class="review-order-id">Buyurtma: #${esc(r.orderId)}</small>`:""}</div><b class="stars">${"★".repeat(Math.max(0,Math.min(5,num(r.stars))))}${"☆".repeat(Math.max(0,5-num(r.stars)))}</b></div><p>${esc(r.text||"")}</p>${r.moderationReason?`<div class="review-reason"><b>Moderator izohi</b>${esc(r.moderationReason)}</div>`:""}${reply?`<div class="reply-box"><b>OrzuMall javobi</b>${esc(reply)}</div>`:""}<footer><span>${r.verifiedPurchase?"✓ Tasdiqlangan xarid":"Sharh"} • ${esc(dateFmt(r.updatedAt||r.createdAt))}</span><div class="review-actions">${st!=="approved"?`<button class="btn btn-success" data-review-approve="${esc(r.productId)}" data-review-id="${esc(r.id)}" type="button"><i class="fa-solid fa-check"></i>Tasdiqlash</button>`:""}${st!=="rejected"?`<button class="btn btn-danger" data-review-reject="${esc(r.productId)}" data-review-id="${esc(r.id)}" type="button"><i class="fa-solid fa-ban"></i>Rad etish</button>`:""}<button class="btn ${reply?"btn-soft":"btn-primary"}" data-review-reply="${esc(r.productId)}" data-review-id="${esc(r.id)}" type="button"><i class="fa-solid fa-reply"></i>${reply?"Javobni tahrirlash":"Javob yozish"}</button><button class="btn btn-danger" data-review-delete="${esc(r.productId)}" data-review-id="${esc(r.id)}" type="button"><i class="fa-solid fa-trash"></i>O‘chirish</button></div></footer></article>`;
  }).join(""):empty("fa-star","Bu filter bo‘yicha sharh topilmadi.");
}
function reviewModerate(productId,reviewId,status,reason=""){
  return api("mobile-admin","review_moderate",{productId,reviewId,status,reason});
}
function openReviewReject(productId,reviewId){
  const r=S.reviews.find(x=>String(x.productId)===String(productId)&&String(x.id)===String(reviewId));if(!r)return;
  openModal("Sharhni rad etish",`<div class="reply-box"><b>${esc(reviewOwner(r))}</b>${esc(r.text||"")}</div><label class="field"><span>Rad etish sababi</span><textarea id="reviewRejectReason" placeholder="Mijozga tushunarli sabab yozing"></textarea></label><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Ortga</button><button class="btn btn-danger" id="reviewRejectSave" type="button"><i class="fa-solid fa-ban"></i> Rad etish</button></div>`,()=>{$("reviewRejectSave")?.addEventListener("click",async e=>{const reason=String($("reviewRejectReason")?.value||"").trim();if(reason.length<2)return toast("Sabab yozing","error");e.currentTarget.disabled=true;try{await reviewModerate(productId,reviewId,"rejected",reason);closeModal();await loadReviewsFromApi({silent:true});toast("Sharh rad etildi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{e.currentTarget.disabled=false}})});
}
function openReviewReply(productId,reviewId){const r=S.reviews.find(x=>String(x.productId)===String(productId)&&String(x.id)===String(reviewId));if(!r)return;openModal("OrzuMall nomidan javob",`<div class="reply-box"><b>${esc(reviewOwner(r))}</b>${esc(r.text||"")}</div><label class="field"><span>OrzuMall javobi</span><textarea id="reviewReplyText" placeholder="Muloyim va foydali javob yozing">${esc(r.adminReply?.text||r.adminReplyText||"")}</textarea></label><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Ortga</button><button class="btn btn-primary" id="reviewReplySave" type="button">Javobni yuborish</button></div>`,()=>{$("reviewReplySave")?.addEventListener("click",async e=>{const text=String($("reviewReplyText")?.value||"").trim();if(text.length<2)return toast("Javob yozing","error");e.currentTarget.disabled=true;try{await api("mobile-admin","review_reply",{productId,reviewId,text});closeModal();await loadReviewsFromApi({silent:true});toast("OrzuMall javobi saqlandi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{e.currentTarget.disabled=false}})})}
function openReviewDelete(productId,reviewId){const r=S.reviews.find(x=>String(x.productId)===String(productId)&&String(x.id)===String(reviewId));if(!r)return;const linked=!!(r.orderId||r.source==="order_feedback");openModal("Sharhni butunlay o‘chirish",`<div class="reply-box"><b>${esc(reviewOwner(r))}</b>${esc(r.text||"")}</div><div class="review-delete-warning"><i class="fa-solid fa-triangle-exclamation"></i><div><b>Bu amalni ortga qaytarib bo‘lmaydi.</b><span>${linked?"Buyurtmaga yozilgan fikr va unga bog‘langan mahsulot sharhlari ham o‘chadi.":"Mahsulot sharhi butunlay o‘chadi."}</span></div></div><div class="modal-actions"><button class="btn btn-soft" data-modal-close type="button">Ortga</button><button class="btn btn-danger" id="reviewDeleteConfirm" type="button"><i class="fa-solid fa-trash"></i> O‘chirish</button></div>`,()=>{$("reviewDeleteConfirm")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;try{await api("mobile-admin","review_delete",{productId,reviewId});closeModal();await loadReviewsFromApi({silent:true});toast("Sharh o‘chirildi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{e.currentTarget.disabled=false}})})}

function openModal(title,body,onReady){$("modalHost").innerHTML=`<div class="modal-wrap"><div class="modal"><div class="modal-drag"></div><div class="modal-head"><b>${esc(title)}</b><button class="modal-close" data-modal-close type="button"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body">${body}</div></div></div>`;$("modalHost").querySelector(".modal-wrap")?.addEventListener("click",e=>{if(e.target.classList.contains("modal-wrap"))closeModal()});$("modalHost").querySelectorAll("[data-modal-close]").forEach(b=>b.addEventListener("click",closeModal));onReady?.()}
function closeModal(){stopOrderQrScanner();$("modalHost").innerHTML=""}

// Main navigation and delegated actions
document.addEventListener("click",async e=>{const v=e.target.closest("[data-view]");if(v)return setView(v.dataset.view);const f=e.target.closest("[data-order-filter]");if(f){S.orderFilter=f.dataset.orderFilter;return renderOrders()}const bf=e.target.closest("[data-balance-filter]");if(bf){$("balanceFilterChips").dataset.active=bf.dataset.balanceFilter;return renderBalance()}const os=e.target.closest("[data-order-scan]");if(os){e.stopPropagation();return openOrderQrScanner(os.dataset.orderScan)}const ol=e.target.closest("[data-order-label]");if(ol){e.stopPropagation();return openOrderLabelPrint(ol.dataset.orderLabel)}const oa=e.target.closest("[data-order-action]");if(oa){e.stopPropagation();return openOrderAction(oa.dataset.orderAction,oa.dataset.next)}const od=e.target.closest("[data-order-detail-btn],[data-order-detail]");if(od){const id=od.dataset.orderDetailBtn||od.dataset.orderDetail;if(id)return openOrderDetails(id)}const ta=e.target.closest("[data-topup-approve]");if(ta)return openTopupApprove(ta.dataset.topupApprove);const tr=e.target.closest("[data-topup-reject]");if(tr)return openTopupReject(tr.dataset.topupReject);const th=e.target.closest("[data-thread]");if(th)return openChat(th.dataset.thread);const nt=e.target.closest("[data-note-toggle]");if(nt){try{await api("mobile-admin","notification_toggle",{id:nt.dataset.noteToggle,active:nt.dataset.active!=="true"});toast("Yangilandi","success")}catch(err){toast(err.message,"error")}return}const nd=e.target.closest("[data-note-delete]");if(nd){if(!confirm("Bildirishnomani o‘chirasizmi?"))return;try{await api("mobile-admin","notification_delete",{id:nd.dataset.noteDelete});toast("O‘chirildi","success")}catch(err){toast(err.message,"error")}return}const rf=e.target.closest("[data-review-filter]");if(rf){S.reviewFilter=rf.dataset.reviewFilter||"pending";return renderReviews()}const ra=e.target.closest("[data-review-approve]");if(ra){ra.disabled=true;try{await reviewModerate(ra.dataset.reviewApprove,ra.dataset.reviewId,"approved","");await loadReviewsFromApi({silent:true});toast("Sharh tasdiqlandi","success")}catch(err){toast("Xatolik: "+err.message,"error")}finally{ra.disabled=false}return}const rj=e.target.closest("[data-review-reject]");if(rj)return openReviewReject(rj.dataset.reviewReject,rj.dataset.reviewId);const rr=e.target.closest("[data-review-reply]");if(rr)return openReviewReply(rr.dataset.reviewReply,rr.dataset.reviewId);const rd=e.target.closest("[data-review-delete]");if(rd)return openReviewDelete(rd.dataset.reviewDelete,rd.dataset.reviewId);const pp=e.target.closest("[data-period]");if(pp){S.turnoverPeriod=num(pp.dataset.period);document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("active",x===pp));return renderTurnover()}});
$("ordersSearch").addEventListener("input",renderOrders);$("balanceSearch").addEventListener("input",renderBalance);$("supportSearch").addEventListener("input",renderSupport);$("reviewsSearch").addEventListener("input",renderReviews);$("drawerOpen").addEventListener("click",openDrawer);$("bottomQrLauncher")?.addEventListener("click",openOrderScanChooser);$("bottomMenu").addEventListener("click",openDrawer);$("drawerOverlay").addEventListener("click",closeDrawer);$("newNotification").addEventListener("click",openNewNotification);$("testNativePush")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;try{nativeRequestPushToken();await new Promise(r=>setTimeout(r,1600));const out=await api("admin-push-test","test",{});if(Number(out.sent||0)>0)toast(`Test push ${out.sent} ta qurilmaga yuborildi`,"success");else toast("FCM token hali serverda ro‘yxatdan o‘tmagan. Ilovani qayta ochib, bildirishnoma ruxsatini yoqing.","error")}catch(err){toast("Test push yuborilmadi: "+err.message,"error")}finally{b.disabled=false}});$("supportBack").addEventListener("click",closeChat);$("refreshView").addEventListener("click",()=>{startSubscriptions();toast("Ma’lumotlar yangilanmoqda")});$("ordersReload").addEventListener("click",()=>{startSubscriptions();toast("Buyurtmalar yangilanmoqda")});$("orderAcceptAllNew")?.addEventListener("click",acceptAllNewOrders);$("chatForm").addEventListener("submit",async e=>{e.preventDefault();const text=String($("chatInput").value||"").trim(),uid=S.activeThread?.uid;if(!text||!uid)return;const b=e.currentTarget.querySelector("button");b.disabled=true;try{await api("mobile-admin","support_reply",{uid,text});$("chatInput").value=""}catch(err){toast("Javob yuborilmadi: "+err.message,"error")}finally{b.disabled=false}});$("chatToggle").addEventListener("click",async()=>{const uid=S.activeThread?.uid;if(!uid)return;const next=S.activeThread?.status==="closed"?"open":"closed";try{await api("mobile-admin","support_toggle",{uid,status:next});toast(next==="closed"?"Suhbat yopildi":"Suhbat qayta ochildi","success");closeChat()}catch(err){toast(err.message,"error")}});$("logoutBtn").addEventListener("click",async()=>{if(S.alertTimer)clearInterval(S.alertTimer);await signOut(auth);location.reload()});

const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
$("loginBtn").addEventListener("click",async()=>{const b=$("loginBtn"),err=$("loginError");b.disabled=true;err.hidden=true;try{await signInWithPopup(auth,provider)}catch(e){console.warn("popup login fallback",e);try{await signInWithRedirect(auth,provider)}catch(e2){err.hidden=false;err.textContent="Kirish amalga oshmadi: "+(e2?.message||e?.message||e2);b.disabled=false}}});
getRedirectResult(auth).catch(e=>console.warn("redirect result",e));
onAuthStateChanged(auth,async user=>{if(!user){clearSubs();S.user=null;$("loginScreen").hidden=false;$("appShell").hidden=true;return}const ok=await isAdmin(user);if(!ok){$("loginError").hidden=false;$("loginError").textContent="Bu Gmail akkauntda admin huquqi yo‘q.";await signOut(auth);return}S.user=user;$("adminEmail").textContent=user.email||"Admin";$("loginScreen").hidden=true;$("appShell").hidden=false;nativeAnnounceAdminReady(user);startSubscriptions();scheduleOrderAlertTimer();renderOrderAlertCenter();setView("orders");setTimeout(()=>{nativeRequestPushToken();nativeSyncOrderAlerts();repairCustomerNamesOnce()},250)});
