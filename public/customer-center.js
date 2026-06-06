function cleanSupportName(v){const s=String(v||'').trim().replace(/\s+/g,' ');return !s||s.includes('@')?'':s}
import { auth, db } from './firebase-config.js?v=20260606_v139';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import {
  collection, doc, getDoc, setDoc, addDoc, onSnapshot, query, orderBy, limit, where,
  serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const S = {
  user:null, profile:{}, notifications:[], globalNotes:[], userNotes:[], readIds:new Set(), messages:[], thread:null,
  activeTab:'notifications', open:false, unsub:[], aiPending:false, nativeToken:'', nativeRegisteredToken:'', nativeRegistering:false
};
const $ = (id)=>document.getElementById(id);
const esc = (v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const tsMs = (v)=>{ try{ if(!v)return 0; if(v.toMillis)return v.toMillis(); if(v.seconds)return Number(v.seconds)*1000; return +new Date(v)||0; }catch(_){return 0;} };
const fmt = (v)=>{ const n=tsMs(v); return n ? new Date(n).toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'hozir'; };
function toast(msg){
  try{
    let host=$('omccToastHost');
    if(!host){host=document.createElement('div');host.id='omccToastHost';host.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:15000;display:flex;flex-direction:column;gap:8px;pointer-events:none';document.body.appendChild(host)}
    const el=document.createElement('div');el.textContent=String(msg||'');el.style.cssText='max-width:min(92vw,520px);padding:11px 13px;border-radius:13px;background:rgba(15,23,42,.94);color:#fff;box-shadow:0 12px 26px rgba(0,0,0,.2);font-size:13px;font-weight:750;opacity:0;transform:translateY(8px);transition:.18s ease';host.appendChild(el);requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='none'});setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(8px)';setTimeout(()=>el.remove(),210)},2400);
  }catch(_){ }
}

function mount(){
  if($('omccOverlay')) return;
  const actions=document.querySelector('.actions.actionsRight');
  if(actions){
    actions.insertAdjacentHTML('afterbegin',`
      <button class="iconBtn badgeBtn omcc-icon-btn" id="omccBellBtn" type="button" title="Bildirishnomalar" aria-label="Bildirishnomalar">
        <i class="fa-solid fa-bell" aria-hidden="true"></i><span class="omcc-badge" id="omccBellBadge" hidden>0</span>
      </button>
      <button class="iconBtn badgeBtn omcc-icon-btn" id="omccChatHeadBtn" type="button" title="Qo‘llab-quvvatlash" aria-label="Qo‘llab-quvvatlash">
        <i class="fa-solid fa-headset" aria-hidden="true"></i><span class="omcc-badge" id="omccChatHeadBadge" hidden>0</span>
      </button>`);
  }
  const mobileHead=document.querySelector('.mobileSearchHead');
  if(mobileHead && !$('omccMobileHeadActions')){
    const mobileActions=document.createElement('div');
    mobileActions.className='omcc-mobile-head-actions';
    mobileActions.id='omccMobileHeadActions';
    mobileActions.innerHTML=`
      <button class="omcc-mobile-head-btn" id="omccBellMobileBtn" type="button" title="Bildirishnomalar" aria-label="Bildirishnomalar">
        <i class="fa-solid fa-bell" aria-hidden="true"></i><span class="omcc-badge" id="omccBellMobileBadge" hidden>0</span>
      </button>
      <button class="omcc-mobile-head-btn" id="omccChatMobileBtn" type="button" title="Qo‘llab-quvvatlash" aria-label="Qo‘llab-quvvatlash">
        <i class="fa-solid fa-headset" aria-hidden="true"></i><span class="omcc-badge" id="omccChatMobileBadge" hidden>0</span>
      </button>`;
    mobileHead.appendChild(mobileActions);
  }
  document.body.insertAdjacentHTML('beforeend',`
    <div class="omcc-overlay" id="omccOverlay" hidden>
      <aside class="omcc-drawer" role="dialog" aria-modal="true" aria-label="Mijozlar markazi">
        <div class="omcc-head"><div class="omcc-title"><i class="fa-solid fa-shield-heart"></i> OrzuMall yordam markazi</div><button class="omcc-close" id="omccClose" type="button" aria-label="Yopish"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="omcc-tabs">
          <button class="omcc-tab active" type="button" data-omcc-tab="notifications"><i class="fa-solid fa-bell"></i> Bildirishnomalar <span class="omcc-badge" id="omccTabNotifBadge" hidden>0</span></button>
          <button class="omcc-tab" type="button" data-omcc-tab="chat"><i class="fa-solid fa-headset"></i> Qo‘llab-quvvatlash <span class="omcc-badge" id="omccTabChatBadge" hidden>0</span></button>
        </div>
        <section class="omcc-pane" id="omccNotificationsPane">
          <div class="omcc-native-push" id="omccNativePush" hidden>
            <span class="omcc-native-push-icon"><i class="fa-solid fa-mobile-screen-button"></i></span>
            <div><b>Android native push</b><small id="omccNativePushText">Ilova bildirishnomasi ulanmoqda...</small></div>
            <button class="omcc-native-test" id="omccNativePushTest" type="button">Test push</button>
          </div>
          <div class="omcc-pane-head"><b>So‘nggi xabarlar</b><button class="omcc-link-btn" id="omccMarkAll" type="button">Barchasini o‘qilgan qilish</button></div>
          <div class="omcc-list" id="omccNotifList"></div>
        </section>
        <section class="omcc-pane" id="omccChatPane" hidden>
          <div class="omcc-chat-intro"><b><i class="fa-solid fa-robot"></i> OrzuMall AI yordamchisi + operator</b><br>Avval tekshirilgan ma’lumotlardan tezkor javob beraman. Aniq ma’lumot topilmasa savol operatorga avtomatik yuboriladi.</div>
          <div class="omcc-quick" id="omccQuick">
            <button type="button" data-omcc-quick="Oxirgi buyurtmam holati qanday?">Buyurtmam qayerda?</button>
            <button type="button" data-omcc-quick="Yetkazib berish narxi qanday hisoblanadi?">Yetkazish narxi</button>
            <button type="button" data-omcc-quick="Qanday to‘lov turlari mavjud?">To‘lov turlari</button>
            <button type="button" data-omcc-quick="Mahsulotni qaytarish yoki almashtirish mumkinmi?">Qaytarish</button>
            <button type="button" data-omcc-quick="Operator bilan bog‘lanmoqchiman">Operator</button>
          </div>
          <div class="omcc-messages" id="omccMessages"></div>
          <form class="omcc-chat-compose" id="omccChatForm"><textarea class="omcc-chat-input" id="omccChatInput" maxlength="1000" placeholder="Savolingizni yozing..." required></textarea><button class="omcc-send" id="omccSend" type="submit" aria-label="Yuborish"><i class="fa-solid fa-paper-plane"></i></button></form>
        </section>
      </aside>
    </div>`);
  $('omccBellBtn')?.addEventListener('click',()=>openCenter('notifications'));
  $('omccChatHeadBtn')?.addEventListener('click',()=>openCenter('chat'));
  $('omccBellMobileBtn')?.addEventListener('click',()=>openCenter('notifications'));
  $('omccChatMobileBtn')?.addEventListener('click',()=>openCenter('chat'));
  $('omccClose')?.addEventListener('click',closeCenter);
  $('omccOverlay')?.addEventListener('click',(e)=>{ if(e.target===$('omccOverlay')) closeCenter(); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'&&S.open) closeCenter(); });
  document.querySelectorAll('[data-omcc-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.omccTab)));
  $('omccMarkAll')?.addEventListener('click',markAllNotificationsRead);
  $('omccNativePushTest')?.addEventListener('click',testNativePush);
  $('omccChatForm')?.addEventListener('submit',sendMessage);
  document.querySelectorAll('[data-omcc-quick]').forEach(b=>b.addEventListener('click',()=>sendQuickMessage(b.dataset.omccQuick)));
}

function nativeBridge(){try{return window.OrzuMallNative||null}catch(_){return null}}
function nativeTokenFromBridge(){try{return String(nativeBridge()?.getPushToken?.()||'').trim()}catch(_){return ''}}
function renderNativePush(){const card=$('omccNativePush'),txt=$('omccNativePushText'),btn=$('omccNativePushTest');if(!card)return;const native=!!nativeBridge()||window.OrzuMallNativeApp===true;card.hidden=!native;if(!native)return;const ready=!!(S.nativeRegisteredToken&&S.nativeRegisteredToken===S.nativeToken);if(txt)txt.textContent=ready?'Native bildirishnoma tayyor. Ilova yopiq turganda ham xabar keladi.':(S.nativeToken?'Token serverga ulanmoqda...':'Bildirishnoma tokeni olinmoqda...');if(btn)btn.disabled=!S.user||S.nativeRegistering||!S.nativeToken;}
async function registerNativePush(token){token=String(token||nativeTokenFromBridge()||'').trim();if(!S.user||!token||token.length<40)return false;if(S.nativeRegistering)return false;if(S.nativeRegisteredToken===token){renderNativePush();return true}S.nativeToken=token;S.nativeRegistering=true;renderNativePush();try{const idToken=await S.user.getIdToken();const res=await fetch('/.netlify/functions/customer-push-register',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${idToken}`},body:JSON.stringify({token,appId:'uz.orzumall.customer',deviceName:navigator.userAgent.slice(0,170)})});const out=await res.json().catch(()=>({}));if(!res.ok)throw new Error(out.error||'push_register_failed');S.nativeRegisteredToken=token;renderNativePush();return true}catch(_){scheduleNativePushRetry(2600);renderNativePush();return false}finally{S.nativeRegistering=false;renderNativePush()}}
function requestNativePush(){const b=nativeBridge();try{b?.requestPushToken?.()}catch(_){}const token=nativeTokenFromBridge();if(token)registerNativePush(token);renderNativePush();}
let omNativePushRetryTimer=0;
function scheduleNativePushRetry(delay=2200){if(omNativePushRetryTimer)clearTimeout(omNativePushRetryTimer);omNativePushRetryTimer=setTimeout(()=>{omNativePushRetryTimer=0;if(S.user&&!S.nativeRegisteredToken)requestNativePush();},delay);}
async function testNativePush(){const btn=$('omccNativePushTest');if(btn)btn.disabled=true;try{requestNativePush();await new Promise(r=>setTimeout(r,850));const token=nativeTokenFromBridge()||S.nativeToken;if(token)await registerNativePush(token);if(!S.user)throw new Error('login_required');const idToken=await S.user.getIdToken();const res=await fetch('/.netlify/functions/customer-push-test',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${idToken}`},body:'{}'});const out=await res.json().catch(()=>({}));if(!res.ok)throw new Error(out.error||'test_failed');toast(Number(out.sent||0)>0?'Test push yuborildi. Telefon bildirishnomasini tekshiring.':'Push token hali ulanmagan. Bildirishnomaga ruxsat bering va qayta urinib ko‘ring.')}catch(_){toast('Test push yuborilmadi. Internet va bildirishnoma ruxsatini tekshiring.')}finally{if(btn)btn.disabled=false;renderNativePush()}}
window.addEventListener('orzumall-native-ready',e=>{const token=String(e?.detail?.pushToken||nativeTokenFromBridge()||'').trim();if(token)registerNativePush(token);renderNativePush()});
window.addEventListener('orzumall-native-push-token',e=>{const token=String(e?.detail?.token||nativeTokenFromBridge()||'').trim();if(token)registerNativePush(token);renderNativePush()});

function cleanup(){ S.unsub.splice(0).forEach(fn=>{try{fn?.();}catch(_){}}); S.notifications=[];S.globalNotes=[];S.userNotes=[];S.readIds=new Set();S.messages=[];S.thread=null;S.aiPending=false; renderAll(); }
function setBadge(id,n){ const e=$(id); if(!e)return; const x=Math.max(0,Number(n||0)); e.textContent=x>99?'99+':String(x); e.hidden=!x; }
function unreadNotifications(){ return S.notifications.filter(n=>!S.readIds.has(n.id)).length; }
function unreadChat(){ return Math.max(0,Number(S.thread?.userUnreadCount||0)); }
function updateBadges(){ const nn=unreadNotifications(), cc=unreadChat(); setBadge('omccBellBadge',nn);setBadge('omccBellMobileBadge',nn);setBadge('omccTabNotifBadge',nn);setBadge('omccChatHeadBadge',cc);setBadge('omccChatMobileBadge',cc);setBadge('omccTabChatBadge',cc); }
function noteIcon(t){ return ({order:'fa-box',support:'fa-headset',promo:'fa-gift',warning:'fa-triangle-exclamation'}[String(t||'info')]||'fa-bell'); }
function visibleNotifications(all){ const uid=S.user?.uid||''; return (all||[]).filter(n=>n&&n.active!==false&&(n.targetType==='all'||n.target==='all'||String(n.targetUid||'')===uid)).sort((a,b)=>tsMs(b.createdAt)-tsMs(a.createdAt)); }
function rebuildNotifications(){ const map=new Map(); [...S.globalNotes,...S.userNotes].forEach(n=>{if(n?.id)map.set(n.id,n)}); S.notifications=visibleNotifications([...map.values()]); renderNotifications(); updateBadges(); }
function renderNotifications(){ const box=$('omccNotifList'); if(!box)return; if(!S.notifications.length){box.innerHTML='<div class="omcc-empty"><i class="fa-regular fa-bell"></i>Hozircha yangi bildirishnoma yo‘q.</div>';return;} box.innerHTML=S.notifications.map(n=>{ const unread=!S.readIds.has(n.id); return `<article class="omcc-note ${unread?'unread':''}" data-note-id="${esc(n.id)}"><span class="omcc-note-icon"><i class="fa-solid ${noteIcon(n.type)}"></i></span><div class="omcc-note-title">${esc(n.title||'Bildirishnoma')}</div>${unread?'<span class="omcc-new">Yangi</span>':''}<div class="omcc-note-body">${esc(n.body||n.message||'')}</div><div class="omcc-note-time">${esc(fmt(n.createdAt))}</div></article>`;}).join(''); box.querySelectorAll('[data-note-id]').forEach(el=>el.addEventListener('click',()=>markNotificationRead(el.dataset.noteId))); }
function renderMessages(){
  const box=$('omccMessages'); if(!box)return;
  if(!S.messages.length&&!S.aiPending){ box.innerHTML='<div class="omcc-empty"><i class="fa-solid fa-robot"></i>Assalomu alaykum! Savolingizni yozing. Oddiy savollarga AI yordamchi tezkor javob beradi, zarur bo‘lsa operator davom ettiradi.</div>'; return; }
  const html=S.messages.map(m=>{const cls=m.sender==='admin'?'admin':(m.sender==='ai'?'ai':(m.sender==='system'?'system':'user'));const who=m.sender==='ai'?'<b class="omcc-ai-label"><i class="fa-solid fa-robot"></i> AI yordamchi</b>':'';return `<div class="omcc-msg ${cls}">${who}${esc(m.text||'')}<span class="omcc-msg-time">${esc(fmt(m.createdAt))}</span></div>`}).join('');
  box.innerHTML=html+(S.aiPending?'<div class="omcc-msg ai omcc-typing"><b class="omcc-ai-label"><i class="fa-solid fa-robot"></i> AI yordamchi</b><span></span><span></span><span></span><em>Tekshirilmoqda...</em></div>':'');
  requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
}
function renderAll(){ renderNotifications();renderMessages();updateBadges(); }
async function loadProfile(){ if(!S.user)return; try{ const x=await getDoc(doc(db,'users',S.user.uid)); S.profile=x.exists()?x.data()||{}:{}; }catch(_){S.profile={};} }
function bind(u){ cleanup();S.user=u||null;renderNativePush();if(!u)return; loadProfile();setTimeout(requestNativePush,180);scheduleNativePushRetry(1800);setTimeout(()=>{if(S.user&&!S.nativeRegisteredToken)requestNativePush();},5200);
  S.unsub.push(onSnapshot(query(collection(db,'notifications'),where('targetType','==','all'),limit(80)),snap=>{S.globalNotes=snap.docs.map(d=>({id:d.id,...d.data()}));rebuildNotifications();},()=>{}));
  S.unsub.push(onSnapshot(query(collection(db,'notifications'),where('targetUid','==',u.uid),limit(80)),snap=>{S.userNotes=snap.docs.map(d=>({id:d.id,...d.data()}));rebuildNotifications();},()=>{}));
  S.unsub.push(onSnapshot(collection(db,'users',u.uid,'notification_reads'),snap=>{S.readIds=new Set(snap.docs.map(d=>d.id));renderNotifications();updateBadges();},()=>{}));
  S.unsub.push(onSnapshot(doc(db,'support_threads',u.uid),snap=>{S.thread=snap.exists()?{id:snap.id,...snap.data()}:null;updateBadges();},()=>{}));
  S.unsub.push(onSnapshot(query(collection(db,'support_threads',u.uid,'messages'),orderBy('createdAt','asc'),limit(180)),snap=>{S.messages=snap.docs.map(d=>({id:d.id,...d.data()}));renderMessages();},()=>{}));
}
function setTab(tab){S.activeTab=tab==='chat'?'chat':'notifications';document.querySelectorAll('[data-omcc-tab]').forEach(b=>b.classList.toggle('active',b.dataset.omccTab===S.activeTab));$('omccNotificationsPane').hidden=S.activeTab!=='notifications';$('omccChatPane').hidden=S.activeTab!=='chat';if(S.activeTab==='notifications')markAllNotificationsRead();else markChatRead();}
function openCenter(tab){ if(!S.user){ location.href='/login.html';return;} S.open=true;$('omccOverlay').hidden=false;requestAnimationFrame(()=>$('omccOverlay').classList.add('is-open'));document.body.classList.add('omcc-open');setTab(tab); }
function closeCenter(){S.open=false;$('omccOverlay')?.classList.remove('is-open');document.body.classList.remove('omcc-open');setTimeout(()=>{if(!S.open&&$('omccOverlay'))$('omccOverlay').hidden=true;},210);}
async function markNotificationRead(id){ if(!S.user||!id||S.readIds.has(id))return;S.readIds.add(id);renderNotifications();updateBadges();try{await setDoc(doc(db,'users',S.user.uid,'notification_reads',id),{readAt:serverTimestamp()},{merge:true});}catch(_){}}
async function markAllNotificationsRead(){ if(!S.user)return;const unread=S.notifications.filter(n=>!S.readIds.has(n.id));if(!unread.length)return;unread.forEach(n=>S.readIds.add(n.id));renderNotifications();updateBadges();await Promise.allSettled(unread.map(n=>setDoc(doc(db,'users',S.user.uid,'notification_reads',n.id),{readAt:serverTimestamp()},{merge:true})));}
async function markChatRead(){if(!S.user||!Number(S.thread?.userUnreadCount||0))return;try{await setDoc(doc(db,'support_threads',S.user.uid),{userUnreadCount:0,userLastReadAt:serverTimestamp()},{merge:true});}catch(_){}}
async function askSupportAi(messageId,text){
  if(!S.user||!messageId)return;
  S.aiPending=true;renderMessages();
  try{
    const token=await S.user.getIdToken();
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),14500);
    const res=await fetch('/.netlify/functions/support-ai',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify({messageId,text})});
    clearTimeout(timer);
    const out=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(out.error||'support_ai_failed');
  }catch(_e){
    toast('AI javobi kechikdi. Xabaringiz operator navbatida qoldi.');
  }finally{S.aiPending=false;renderMessages();}
}
async function sendQuickMessage(text){const input=$('omccChatInput');if(!input)return;input.value=String(text||'');$('omccChatForm')?.requestSubmit();}
async function sendMessage(e){
  e.preventDefault();const input=$('omccChatInput'),btn=$('omccSend');const text=String(input?.value||'').trim();if(!S.user||!text)return;btn.disabled=true;
  try{await loadProfile();const uid=S.user.uid;const p=S.profile||{};const name=[cleanSupportName(p.firstName),cleanSupportName(p.lastName)].filter(Boolean).join(' ').trim()||cleanSupportName(p.name)||cleanSupportName(S.user.displayName)||'Mijoz';const phone=p.phone||p.userPhone||'';const ref=await addDoc(collection(db,'support_threads',uid,'messages'),{text,sender:'user',uid,createdAt:serverTimestamp()});await setDoc(doc(db,'support_threads',uid),{uid,userName:name,userPhone:phone,userEmail:S.user.email||'',numericId:p.numericId||p.userPublicId||'',status:'open',needsHuman:true,aiState:'queued',lastMessage:text,lastSender:'user',updatedAt:serverTimestamp(),adminUnreadCount:increment(1),pendingAiCount:increment(1),userUnreadCount:0},{merge:true});input.value='';askSupportAi(ref.id,text);}
  catch(err){toast('Xabar yuborilmadi. Internet yoki Firestore qoidalarini tekshiring.');}
  finally{btn.disabled=false;input?.focus();}
}

mount();
renderNativePush();
setTimeout(requestNativePush,350);
onAuthStateChanged(auth,bind);
