
// Detect APK/WebView/TWA/standalone shell so mobile safe-area spacing is corrected
(function(){
  try{
    const ua = (navigator.userAgent || "").toLowerCase();
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
    const webview = /\bwv\b/.test(ua) || /; wv\)/.test(ua) || /version\/\d+\.\d+.*chrome\//.test(ua);
    if(standalone || webview){
      document.documentElement.classList.add("om-app-shell");
      document.body && document.body.classList.add("om-app-shell");
    }
  }catch(e){}
})();

/* OrzuMall v138: console is preserved for diagnostics; critical errors are reported by /om-error-report.js. */

function omI18nRefresh(delay = 0){
  try{
    const run = () => {
      const api = window.OM_I18N;
      if(api && typeof api.notify === "function") api.notify(document.body);
      else if(api && typeof api.apply === "function") api.apply();
    };
    setTimeout(run, delay);
  }catch(_e){}
}


function omLang(){
  try{ return window.OM_I18N?.getLang?.() || "uz"; }catch(_e){ return "uz"; }
}
function omTrText(text){
  try{ return window.OM_I18N?.text?.(text) || String(text == null ? "" : text); }catch(_e){ return String(text == null ? "" : text); }
}
function omCount(n){
  try{ return window.OM_I18N?.countText?.(n) || `${Number(n||0)} ta`; }catch(_e){ return `${Number(n||0)} ta`; }
}
function omCompactMetric(v){
  const n=Math.max(0,Number(v)||0);
  const fmt=(x,s)=>{const d=x>=100?0:1;return `${x.toFixed(d).replace(/\.0$/,"")}${s}`};
  if(n>=1e9)return fmt(n/1e9,"b");
  if(n>=1e6)return fmt(n/1e6,"m");
  if(n>=1e3)return fmt(n/1e3,"k");
  return String(Math.round(n));
}
function omProductText(p, field, fallback=""){
  try{ return window.OM_I18N?.productText?.(p, field, fallback) || String(fallback || ""); }
  catch(_e){ return String(fallback || ""); }
}
function omProductTags(p){
  try{ return window.OM_I18N?.productTags?.(p) || (Array.isArray(p?.tags) ? p.tags : []); }
  catch(_e){ return Array.isArray(p?.tags) ? p.tags : []; }
}
function omI18nProductsReady(){
  try{ window.OM_I18N?.ensureProducts?.(products || []); }catch(_e){}
}
let __omI18nRerenderTimer = null;
window.addEventListener("om-i18n-updated", ()=>{
  clearTimeout(__omI18nRerenderTimer);
  __omI18nRerenderTimer = setTimeout(()=>{
    try{
      buildCategoryTree();
      applyFilterSort();
      if(activeTab === "categories") renderCategoriesPage();
      if(activeTab === "fav") renderFavPage();
      if(activeTab === "cart") renderCartPage();
      if(activeTab === "product") renderProductPage();
    }catch(_e){}
  }, 90);
});


/* ========= TELEGRAM ADMIN NOTIFY (NO FUNCTIONS) =========
   Sends a lightweight notification to admin chat when a new order is created.
   Uses GET (Image beacon) and/or no-cors POST to avoid CORS issues.
   Requires window.TG_ADMIN { botToken, chatId } from telegram-config.js.
*/
function tgAdminEnabled(){
  return typeof window !== "undefined"
    && window.TG_ADMIN
    && window.TG_ADMIN.enabled === true;
}
function tgUserEnabled(){
  return typeof window !== "undefined"
    && window.TG_USER
    && window.TG_USER.enabled === true;
}

async function tgNotifyOrderCreated(orderId){
  try{
    if(!currentUser) return;
    if(!tgAdminEnabled() && !tgUserEnabled()) return;
    const idToken = await currentUser.getIdToken();
    await fetch("/.netlify/functions/telegram", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + idToken
      },
      body: JSON.stringify({ event: "order_created", orderId: String(orderId||"") })
    });
  }catch(e){}
}

function tgOrderCreatedHTML(o){
  const items = Array.isArray(o.items) ? o.items : [];
  const itemLines = items.slice(0, 8).map((it)=>{
    const title = tgEscape(it.title || it.name || it.productTitle || "Mahsulot");
    const qty = Number(it.qty || it.count || 1) || 1;
    const sku = tgEscape(it.sku || it.variantKey || it.key || "");
    const price = Number(it.priceUZS || it.price || 0) || 0;
    const tail = [sku ? `<code>${sku}</code>` : "", price ? `${price.toLocaleString()} so'm` : ""].filter(Boolean).join(" · ");
    return `• ${title} ×${qty}${tail ? ` <i>(${tail})</i>` : ""}`;
  });
  const more = items.length > 8 ? `<i>... yana ${items.length-8} ta</i>` : "";
  const addr = o.shipping?.addressText ? tgEscape(o.shipping.addressText) : "";
  const pay = tgEscape(o.provider || "");
  const sum = Number(o.totalUZS||0).toLocaleString();

  return [
    `<b>🛒 Yangi buyurtma!</b>`,
    `Buyurtma ID: <code>${tgEscape(o.orderId||o.id||"")}</code>`,
    o.uid ? `UID: <code>${tgEscape(o.uid)}</code>` : "",
    o.numericId ? `User ID: <b>${tgEscape(o.numericId)}</b>` : "",
    omOrderPublicName(o,"") ? `Ism: <b>${tgEscape(omOrderPublicName(o,""))}</b>` : "",
    o.userPhone ? `Tel: <b>${tgEscape(o.userPhone)}</b>` : "",
    `To'lov: <b>${pay}</b>`,
    `Summa: <b>${sum}</b> so'm`,
    addr ? `Manzil: ${addr}` : "",
    items.length ? `<b>— Mahsulotlar —</b>` : "",
    ...itemLines,
    more
  ].filter(Boolean).join("\n");
}

function tgOrderStatusHTML(o){
  const st = tgEscape(o.status||"");
  const sum = Number(o.totalUZS||0).toLocaleString();
  return [
    `<b>📦 Buyurtma statusi yangilandi</b>`,
    `Buyurtma ID: <code>${tgEscape(o.orderId||o.id||"")}</code>`,
    o.numericId ? `User ID: <b>${tgEscape(o.numericId)}</b>` : "",
    `Yangi status: <b>${st}</b>`,
    o.provider ? `To'lov: <b>${tgEscape(o.provider)}</b>` : "",
    `Summa: <b>${sum}</b> so'm`
  ].filter(Boolean).join("\n");
}


import { auth, db, storage } from "./firebase-config.js?v=20260606_v139";
import { CARDPAY } from "./cardpay-config.js?v=20260606_v139";
import { CLICK_CONFIG } from "./click-config.js?v=20260606_v139";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  getAggregateFromServer,
  average,
  count,
  addDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

/* =========================
   Toast helper
========================= */
function toast(message, type="info"){
  try{
    const id = "om_toast_host";
    let host = document.getElementById(id);
    if(!host){
      host = document.createElement("div");
      host.id = id;
      host.style.position = "fixed";
      host.style.left = "50%";
      host.style.bottom = "18px";
      host.style.transform = "translateX(-50%)";
      host.style.zIndex = "99999";
      host.style.display = "flex";
      host.style.flexDirection = "column";
      host.style.gap = "8px";
      host.style.pointerEvents = "none";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.textContent = String(message ?? "");
    el.style.maxWidth = "min(92vw, 520px)";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "14px";
    el.style.background = "rgba(15,23,42,.92)";
    el.style.color = "#fff";
    el.style.boxShadow = "0 12px 28px rgba(0,0,0,.22)";
    el.style.fontSize = "14px";
    el.style.lineHeight = "1.25";
    el.style.pointerEvents = "auto";
    el.style.opacity = "0";
    el.style.transition = "opacity .18s ease, transform .18s ease";
    el.style.transform = "translateY(8px)";
    host.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    const ttl = type === "error" ? 3800 : 2600;
    setTimeout(()=>{
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(()=> el.remove(), 220);
    }, ttl);
  }catch(e){
    // fallback
    alert(message);
  }
}

// Backward-compat: some blocks call showToast()
function showToast(message, type="info"){ return toast(message, type); }


let currentUser = null;
let userBalanceUZS = 0;
let unsubUserDoc = null;
let isEditing = false;
let profileCache = null; // /users/{uid} cached

// Normalize price / createdAt for reliable client-side sorting
function parseUZS(value){
  // Accept number or strings like "680,000 so'm" / "680000".
  if(typeof value === "number" && Number.isFinite(value)) return value;
  if(value == null) return 0;
  const s = String(value);
  const digits = s.replace(/[^0-9]/g, "");
  const n = parseInt(digits || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function toMillis(ts){
  try{
    if(!ts) return 0;
    if(typeof ts === "number" && Number.isFinite(ts)) return ts;
    if(ts.toMillis) return ts.toMillis();
    if(ts.toDate) return +ts.toDate();
    const d = new Date(ts);
    return Number.isNaN(+d) ? 0 : +d;
  }catch(e){
    return 0;
  }
}

// Product popularity / interest tracking
// v127: ekranda faqat serverdagi umumiy Firestore qiymati ko‘rsatiladi.
// Brauzer localStorage qiymati endi popularlikka aralashtirilmaydi.
const OM_ANON_LS = "om_anon_id_v1";
const productMetricsCache = new Map(); // productId -> authoritative shared metrics only

function omMetricNum(v){
  const n = Number(v || 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function omAnonId(){
  try{
    let id = localStorage.getItem(OM_ANON_LS);
    if(!id){
      id = (crypto?.randomUUID?.() || ("anon_" + Date.now() + "_" + Math.random().toString(16).slice(2)));
      localStorage.setItem(OM_ANON_LS, id);
    }
    return id;
  }catch(e){ return "anon_local"; }
}
function omEngagementScore(m){
  const views = omMetricNum(m?.views);
  const fav = omMetricNum(m?.favoriteAdds || m?.favorites);
  const cart = omMetricNum(m?.cartAdds);
  const buy = omMetricNum(m?.purchases || m?.soldCount);
  return Math.round(views + fav*4 + cart*7 + buy*25);
}
function omMetricFromProduct(p){
  if(!p) return {views:0, cartAdds:0, favoriteAdds:0, purchases:0, score:0};
  const id = String(p.id || p._docId || "");
  const cached = productMetricsCache.get(id) || {};
  const views = Math.max(omMetricNum(p.views), omMetricNum(p.viewCount), omMetricNum(p.viewsCount), omMetricNum(p.productViews), omMetricNum(p.popularViews), omMetricNum(cached.views));
  const cartAdds = Math.max(omMetricNum(p.cartAdds), omMetricNum(p.cartAddCount), omMetricNum(p.addToCartCount), omMetricNum(cached.cartAdds));
  const favoriteAdds = Math.max(omMetricNum(p.favoriteAdds), omMetricNum(p.favorites), omMetricNum(p.favoriteCount), omMetricNum(p.wishlistAdds), omMetricNum(cached.favoriteAdds));
  const purchases = Math.max(omMetricNum(p.purchases), omMetricNum(p.purchaseCount), omMetricNum(p.soldCount), omMetricNum(p.salesCount), omMetricNum(cached.purchases));
  const calculated = omEngagementScore({views, cartAdds, favoriteAdds, purchases});
  const score = Math.max(calculated, omMetricNum(p.popularScore), omMetricNum(p.metricScore), omMetricNum(p.engagementScore), omMetricNum(cached.score));
  return {views, cartAdds, favoriteAdds, purchases, score};
}
function omGetProductMetrics(pOrId){
  const p = (typeof pOrId === "object" && pOrId) ? pOrId : (products || []).find(x=>String(x.id||x._docId)===String(pOrId));
  return omMetricFromProduct(p || {id:pOrId});
}
function omApplySharedMetrics(productId, raw={}){
  const id=String(productId||"").trim(); if(!id)return null;
  const m={views:omMetricNum(raw.views),cartAdds:omMetricNum(raw.cartAdds),favoriteAdds:omMetricNum(raw.favoriteAdds),purchases:omMetricNum(raw.purchases),score:omMetricNum(raw.score),ts:Date.now()};
  m.score=Math.max(m.score,omEngagementScore(m)); productMetricsCache.set(id,m);
  const prod=(products||[]).find(x=>String(x.id||x._docId)===id);
  if(prod){prod.views=m.views;prod.viewsCount=m.views;prod.cartAdds=m.cartAdds;prod.favoriteAdds=m.favoriteAdds;prod.purchases=m.purchases;prod.soldCount=m.purchases;prod.metricScore=m.score;prod.engagementScore=m.score;prod.popularScore=m.score;}
  return m;
}
async function preloadProductMetrics(productIds,{force=false,rerender=false}={}){
  const ids=[...new Set((productIds||[]).map(String).filter(Boolean))].slice(0,80);if(!ids.length)return;
  const needed=force?ids:ids.filter(id=>{const x=productMetricsCache.get(id);return !x||Date.now()-(x.ts||0)>=120000});
  if(needed.length){
    try{
      const resp=await fetch("/.netlify/functions/product-metrics",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ids:needed})});
      const out=await resp.json().catch(()=>({}));
      if(resp.ok&&out?.ok&&out.metrics){Object.entries(out.metrics).forEach(([id,m])=>omApplySharedMetrics(id,m||{}));}
    }catch(_e){}
  }
  if(rerender){try{applyFilterSort();}catch(_e){}try{if(activeTab==="product")renderProductPage();}catch(_e){}try{omRenderQuickViewPro();}catch(_e){}try{if(activeTab==="store"&&activeStoreId)renderStorePage();}catch(_e){}}
}
async function omLoadProductMetric(productId,force=false){
  const id=String(productId||"").trim();if(!id)return null;
  await preloadProductMetrics([id],{force});
  const cached=productMetricsCache.get(id);if(cached)return cached;
  const p=(products||[]).find(x=>String(x.id||x._docId)===id);const out={...omMetricFromProduct(p||{id}),ts:Date.now()};productMetricsCache.set(id,out);return out;
}
let omSharedMetricsPollTimer=null;
function omStartSharedMetricsPolling(){
  if(omSharedMetricsPollTimer)clearInterval(omSharedMetricsPollTimer);
  omSharedMetricsPollTimer=setInterval(()=>{
    if(document.hidden)return;
    const ids=(products||[]).slice(0,60).map(p=>p.id||p._docId).filter(Boolean);
    preloadProductMetrics(ids,{force:true,rerender:true}).catch(()=>{});
  },90000);
}
setTimeout(omStartSharedMetricsPolling,2500);
async function omRecordProductInteraction(productId,type="view",qty=1){
  const id=String(productId||"").trim();if(!id)return;
  try{
    const headers={"content-type":"application/json"};
    if(currentUser){try{headers.authorization=`Bearer ${await currentUser.getIdToken()}`;}catch(_e){}}
    const resp=await fetch("/.netlify/functions/product-interaction",{method:"POST",headers,body:JSON.stringify({productId:id,type,qty:Math.max(1,Math.round(omMetricNum(qty||1))),anonId:omAnonId()})});
    const out=await resp.json().catch(()=>({}));
    if(resp.ok&&out?.ok&&out.metrics){omApplySharedMetrics(id,out.metrics);try{omRenderQuickViewPro();}catch(_e){}try{if(els?.sort?.value==="popular")applyFilterSort();}catch(_e){}}
  }catch(_e){}
}
// Sotib olish popularligi checkout serverida markaziy hisoblanadi; brauzer qayta oshirmaydi.
function omRecordPurchaseMetrics(_items){}
async function logEvent(type,productId){return omRecordProductInteraction(productId,type,1);}


const els = {
  avatarIcon: document.getElementById("avatarIcon"),
  avatarBtn: document.getElementById("avatarBtn"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  productsCount: document.getElementById("productsCount"),
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),authCard: document.getElementById("authCard"),

  // Search UI (mobile)
  toolsTop: document.getElementById("toolsTop"),
  searchToggleBtn: document.getElementById("searchToggleBtn"),
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  btnLogin: document.getElementById("btnLogin"),
  signupName: document.getElementById("signupName"),
  signupPhone: document.getElementById("signupPhone"),
  signupPass: document.getElementById("signupPass"),
  signupPass2: document.getElementById("signupPass2"),
  btnSignup: document.getElementById("btnSignup"),
  authNotice: document.getElementById("authNotice"),
  authNotice2: document.getElementById("authNotice2"),

  heroAuthJump: document.getElementById("heroAuthJump"),

  // new UI
  favViewBtn: document.getElementById("favViewBtn"),
  cartBtn: document.getElementById("cartBtn"),
  favCount: document.getElementById("favCount"),
  cartCount: document.getElementById("cartCount"),

  overlay: document.getElementById("overlay"),
  sidePanel: document.getElementById("sidePanel"),

  // SPA views
  viewHome: document.getElementById("view-home"),
  viewProduct: document.getElementById("view-product"),
  productPageContent: document.getElementById("productPageContent"),
  productBackBtn: document.getElementById("productBackBtn"),
  productShareBtn: document.getElementById("productShareBtn"),
  viewStore: document.getElementById("view-store"),
  storePageContent: document.getElementById("storePageContent"),
  storeBackBtn: document.getElementById("storeBackBtn"),
  storeShareBtn: document.getElementById("storeShareBtn"),
  notificationsBtn: document.getElementById("notificationsBtn"),
  notificationsCount: document.getElementById("notificationsCount"),
  notificationOverlay: document.getElementById("notificationOverlay"),
  notificationBackdrop: document.getElementById("notificationBackdrop"),
  notificationClose: document.getElementById("notificationClose"),
  notificationReadAll: document.getElementById("notificationReadAll"),
  notificationList: document.getElementById("notificationList"),
  notificationEmpty: document.getElementById("notificationEmpty"),
  storeUpdateStrip: document.getElementById("storeUpdateStrip"),
  storeSearchResults: document.getElementById("storeSearchResults"),
  storeSearchGrid: document.getElementById("storeSearchGrid"),
  storeSearchCount: document.getElementById("storeSearchCount"),
  storeSearchLoading: document.getElementById("storeSearchLoading"),
  viewCategories: document.getElementById("view-categories"),
  viewFav: document.getElementById("view-fav"),
  viewCart: document.getElementById("view-cart"),
  viewProfile: document.getElementById("view-profile"),
  navBar: document.querySelector(".mobile-bottom-bar"),

  // categories page
  catList: document.getElementById("catList"),
  catCrumbs: document.getElementById("catCrumbs"),
  catBackBtn: document.getElementById("catBackBtn"),
  catApplyBtn: document.getElementById("catApplyBtn"),
  catClearBtn: document.getElementById("catClearBtn"),
  catEmpty: document.getElementById("catEmpty"),

  // favorites/cart pages
  favPageList: document.getElementById("favPageList"),
  favPageEmpty: document.getElementById("favPageEmpty"),
  cartPageList: document.getElementById("cartPageList"),
  cartPageEmpty: document.getElementById("cartPageEmpty"),
  cartTotalPage: document.getElementById("cartTotalPage"),
  cartSelectAllPage: document.getElementById("cartSelectAllPage"),
  paymeBtnPage: document.getElementById("paymeBtnPage"),
  tgShareBtnPage: document.getElementById("tgShareBtnPage"),
  clearCartPage: document.getElementById("clearCartPage"),
  orderBtnPage: document.getElementById("orderBtnPage"),
  checkoutOverlay: document.getElementById("checkoutOverlay"),
  checkoutSheet: document.getElementById("checkoutSheet"),
  checkoutClose: document.getElementById("checkoutClose"),
  checkoutSubmit: document.getElementById("checkoutSubmit"),
  checkoutCompactSummary: document.getElementById("checkoutCompactSummary"),
  cartDeliverySummary: document.getElementById("cartDeliverySummary"),
  paymentOverlay: document.getElementById("paymentOverlay"),
  paymentModal: document.getElementById("paymentModal"),
  paymentClose: document.getElementById("paymentClose"),
  paymentSubmit: document.getElementById("paymentSubmit"),
  shipAddress: document.getElementById("shipAddress"),
  shipPhone: document.getElementById("shipPhone"),
  useProfilePhone: document.getElementById("useProfilePhone"),
  useMyLocation: document.getElementById("useMyLocation"),
  shipLiveBtn: document.getElementById("shipLiveBtn"),
  shipFullBtn: document.getElementById("shipFullBtn"),
  shipExitFullBtn: document.getElementById("shipExitFullBtn"),
  shipCoordsText: document.getElementById("shipCoordsText"),

  // profile page

  profileEditBtn: document.getElementById("profileEditBtn"),
  profileSave: document.getElementById("profileSave"),
  profileClose: document.getElementById("profileClose"),
  profileLogout: document.getElementById("profileLogout"),
  profileName: document.getElementById("profileName"),
  profileNumericId: document.getElementById("profileNumericId"),
  profileAvatar: document.getElementById("profileAvatar"),
  pfFirstName: document.getElementById("pfFirstName"),
  pfLastName: document.getElementById("pfLastName"),
  pfPhone: document.getElementById("pfPhone"),

  // orders (profile page)
  ordersReload: document.getElementById("ordersReload"),
  ordersList: document.getElementById("ordersList"),
  ordersEmpty: document.getElementById("ordersEmpty"),
  ordersToggle: document.getElementById("ordersToggle"),
  ordersBody: document.getElementById("ordersBody"),
  ordersChevron: document.getElementById("ordersChevron"),
  orderReceiptModal: document.getElementById("orderReceiptModal"),
  orderReceiptContent: document.getElementById("orderReceiptContent"),
  orderReceiptClose: document.getElementById("orderReceiptClose"),
  orderReceiptPrint: document.getElementById("orderReceiptPrint"),

  // money history (profile page)
  moneyHistoryToggle: document.getElementById("moneyHistoryToggle"),
  moneyHistoryBody: document.getElementById("moneyHistoryBody"),
  moneyHistoryList: document.getElementById("moneyHistoryList"),
  moneyHistoryEmpty: document.getElementById("moneyHistoryEmpty"),
  moneyHistoryCount: document.getElementById("moneyHistoryCount"),
  moneyHistoryChevron: document.getElementById("moneyHistoryChevron"),
  panelTitle: document.getElementById("panelTitle"),
  panelClose: document.getElementById("panelClose"),
  panelList: document.getElementById("panelList"),
  panelEmpty: document.getElementById("panelEmpty"),
  panelBottom: document.getElementById("panelBottom"),
  panelSelectRow: document.getElementById("panelSelectRow"),
  selectAllBox: document.getElementById("selectAllBox"),
  selectAllLabel: document.getElementById("selectAllLabel"),
  totalRow: document.getElementById("totalRow"),
  cartTotal: document.getElementById("cartTotal"),
  paymeBtn: document.getElementById("paymeBtn"),
  tgShareBtn: document.getElementById("tgShareBtn"),
  clearBtn: document.getElementById("clearBtn"),

  // image viewer (gallery)
  imgViewer: document.getElementById("imgViewer"),
  imgViewerBackdrop: document.getElementById("imgViewerBackdrop"),
  // Title is hidden; we show product name in the old description style
  imgViewerTitle: document.getElementById("imgViewerTitle"),
  imgViewerName: document.getElementById("imgViewerName"),
  imgViewerDesc: document.getElementById("imgViewerDesc"),
  qvPrice: document.getElementById("qvPrice"),
  qvOldPrice: document.getElementById("qvOldPrice"),
  qvRating: document.getElementById("qvRating"),
  qvTags: document.getElementById("qvTags"),
  qvBadge: document.getElementById("qvBadge"),
  imgViewerImg: document.getElementById("imgViewerImg"),
  imgViewerClose: document.getElementById("imgViewerClose"),
  imgViewerShell: document.querySelector("#imgViewer .imgViewerShell"),
  qvPanel: document.querySelector("#imgViewer .qvPanel"),

  // mini modal (info/video/reviews)
  miniModal: document.getElementById("miniModal"),
  miniBackdrop: document.getElementById("miniBackdrop"),
  miniClose: document.getElementById("miniClose"),
  miniTitle: document.getElementById("miniTitle"),
  miniBody: document.getElementById("miniBody"),
  imgPrev: document.getElementById("imgPrev"),
  imgNext: document.getElementById("imgNext"),
  imgThumbs: document.getElementById("imgThumbs"),

  // reviews
  revScore: document.getElementById("revScore"),
  revCount: document.getElementById("revCount"),
  revStars: document.getElementById("revStars"),
  revText: document.getElementById("revText"),
  revSend: document.getElementById("revSend"),
  revList: document.getElementById("revList"),
  revFiles: document.getElementById("revFiles"),
  revPreview: document.getElementById("revPreview"),

  // viewer actions
  viewerCart: document.getElementById("viewerCart"),
  viewerBuy: document.getElementById("viewerBuy"),

  // variant modal (add to cart)
  vOverlay: document.getElementById("vOverlay"),
  vClose: document.getElementById("vClose"),
  vCancel: document.getElementById("vCancel"),
  vConfirm: document.getElementById("vConfirm"),
  vImg: document.getElementById("vImg"),
  vName: document.getElementById("vName"),
  vPrice: document.getElementById("vPrice"),
  vColors: document.getElementById("vColors"),
  vColorRow: document.getElementById("vColorRow"),
  vColorHint: document.getElementById("vColorHint"),
  vSizes: document.getElementById("vSizes"),
  vSizeRow: document.getElementById("vSizeRow"),
  vSizeHint: document.getElementById("vSizeHint"),
  vMinus: document.getElementById("vMinus"),
  vPlus: document.getElementById("vPlus"),
  vQty: document.getElementById("vQty")
};

// ---- Modal helpers (world-class, animated, accessibility-friendly) ----
function _anyOverlayOpen(){
  return [ els.vOverlay, els.imgViewer, els.miniModal].some(el=>el && !el.hidden);
}
function _syncModalBody(){
  const open = _anyOverlayOpen();
  if(open){
    document.body.classList.add("modalOpen");
    document.documentElement.classList.add("modalOpen");
  } else {
    document.body.classList.remove("modalOpen");
    document.documentElement.classList.remove("modalOpen");
  }
}
function showOverlay(el){
  if(!el) return;
  el.hidden = false;
  // allow CSS transitions
  requestAnimationFrame(()=>{ el.classList.add("isOpen"); });
  _syncModalBody();
}
function hideOverlay(el){
  if(!el) return;
  el.classList.remove("isOpen");
  // keep in DOM briefly for exit animation
  window.setTimeout(()=>{ el.hidden = true; _syncModalBody(); }, 190);
}

// === Desktop horizontal scroll helpers (PC: wheel + drag) ===
const isFinePointer = () => window.matchMedia && window.matchMedia("(pointer:fine)").matches;

function enhanceHScroll(el){
  if(!el || el.dataset.hscrollInit==="1") return;
  el.dataset.hscrollInit="1";

  // Wheel: use vertical wheel to scroll horizontally when hovering the row (PC)
  el.addEventListener("wheel", (e)=>{
    if(!isFinePointer()) return;
    // If user is already doing horizontal wheel/trackpad, don't override
    if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if(e.deltaY === 0) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, {passive:false});

  // Drag to scroll (mouse) — doesn't break clicks (threshold + cancel-click-after-drag)
  let down = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;
  let pid = null;

  const DRAG_THRESHOLD = 6; // px

  el.addEventListener("pointerdown", (e)=>{
    if(!isFinePointer()) return;
    if(e.pointerType === "touch") return;
    if(e.button != null && e.button !== 0) return; // left click only

    down = true;
    moved = false;
    pid = e.pointerId;
    startX = e.clientX;
    startLeft = el.scrollLeft;
    // NOTE: no pointer capture here — only after threshold, so clicks still work.
  });

  el.addEventListener("pointermove", (e)=>{
    if(!down) return;
    const dx = e.clientX - startX;

    if(!moved){
      if(Math.abs(dx) < DRAG_THRESHOLD) return;
      moved = true;
      el.classList.add("dragging");
      try{ el.setPointerCapture(pid); }catch(_){}
    }
    el.scrollLeft = startLeft - dx;
    e.preventDefault();
  });

  const finish = ()=>{
    if(moved){
      el.dataset.justDragged = "1";
      setTimeout(()=>{ delete el.dataset.justDragged; }, 140);
    }
    down = false;
    moved = false;
    pid = null;
    el.classList.remove("dragging");
  };

  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", finish);

  // If we just dragged, kill the click so options don't accidentally toggle.
  el.addEventListener("click", (e)=>{
    if(el.dataset.justDragged === "1"){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

let products = [];
let tagCounts = new Map();

const LS = {
  favs: "om_favs",
  cart: "om_cart"
};

/* v47: UID-scoped offline-first caches.  Each account gets its own durable
   local snapshot, then Firestore reconciles in the background. */
const OM_USER_SHOP_CACHE_PREFIX = "orzumall_user_shop_cache_v47";
const OM_ORDER_HISTORY_CACHE_PREFIX = "orzumall_order_history_cache_v47";
const OM_TOPUP_HISTORY_CACHE_PREFIX = "orzumall_topup_history_cache_v47";
function omScopedCacheKey(prefix, uid=currentUser?.uid){
  const safeUid=String(uid||"").trim().replace(/[^a-zA-Z0-9_-]/g,"_");
  return safeUid ? `${prefix}_${safeUid}` : "";
}
function omCacheClean(value){
  try{
    if(value instanceof Date) return value.toISOString();
    if(value && typeof value.toDate === "function") return value.toDate().toISOString();
    if(Array.isArray(value)) return value.map(omCacheClean);
    if(value && typeof value === "object"){
      const out={};
      Object.entries(value).forEach(([k,v])=>{ out[k]=omCacheClean(v); });
      return out;
    }
  }catch(_e){}
  return value;
}
function omReadScopedCache(prefix, uid, fallback){
  try{
    const key=omScopedCacheKey(prefix,uid);
    if(!key) return fallback;
    const raw=localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(_e){ return fallback; }
}
function omWriteScopedCache(prefix, uid, value){
  try{
    const key=omScopedCacheKey(prefix,uid);
    if(!key) return;
    localStorage.setItem(key,JSON.stringify(omCacheClean(value)));
  }catch(_e){}
}
function omOrderTimeMsLocal(o){
  const raw=o?.createdAt || o?.updatedAt || null;
  try{
    if(raw?.toDate) return +raw.toDate();
    if(raw && typeof raw === "object" && Number.isFinite(Number(raw.seconds))) return Number(raw.seconds)*1000;
    return raw ? +new Date(raw) : 0;
  }catch(_e){ return 0; }
}
function omSortOrdersNewest(arr){
  return (Array.isArray(arr)?arr.slice():[]).sort((a,b)=>omOrderTimeMsLocal(b)-omOrderTimeMsLocal(a));
}
function omLoadOrdersHistoryCache(uid){ return omSortOrdersNewest(omReadScopedCache(OM_ORDER_HISTORY_CACHE_PREFIX,uid,[])); }
function omSaveOrdersHistoryCache(uid,arr){ omWriteScopedCache(OM_ORDER_HISTORY_CACHE_PREFIX,uid,omSortOrdersNewest(arr)); }
function omLoadTopupHistoryCache(uid){ return Array.isArray(omReadScopedCache(OM_TOPUP_HISTORY_CACHE_PREFIX,uid,[])) ? omReadScopedCache(OM_TOPUP_HISTORY_CACHE_PREFIX,uid,[]) : []; }
function omSaveTopupHistoryCache(uid,arr){ omWriteScopedCache(OM_TOPUP_HISTORY_CACHE_PREFIX,uid,Array.isArray(arr)?arr:[]); }

/* =========================
   Public customer names
   Internal Firebase pseudo-email is never shown as a customer name.
========================= */
function omCleanPublicPersonName(value){
  const s=String(value == null ? "" : value).trim().replace(/\s+/g," ");
  if(!s || s.includes("@")) return "";
  return s;
}
function omPublicNameFromRecord(record={}, fallback="Foydalanuvchi"){
  const first=omCleanPublicPersonName(record?.firstName);
  const last=omCleanPublicPersonName(record?.lastName);
  const full=[first,last].filter(Boolean).join(" ").trim();
  if(full) return full;
  for(const candidate of [record?.name,record?.fullName,record?.displayName,record?.userName,record?.customerName,record?.authorName]){
    const clean=omCleanPublicPersonName(candidate);
    if(clean) return clean;
  }
  return fallback;
}
const omPublicUserCache=new Map();
async function omGetPublicUserRecord(uid,{force=false}={}){
  const id=String(uid||"").trim();
  if(!id) return {};
  if(!force && omPublicUserCache.has(id)) return omPublicUserCache.get(id)||{};
  try{
    const snap=await getDoc(doc(db,"users",id));
    const data=snap.exists() ? (snap.data()||{}) : {};
    omPublicUserCache.set(id,data);
    return data;
  }catch(_e){
    return omPublicUserCache.get(id)||{};
  }
}
async function omResolvePublicReviewAuthor(uid,fallbackName=""){
  const cleanFallback=omCleanPublicPersonName(fallbackName)||"Foydalanuvchi";
  const userRecord=await omGetPublicUserRecord(uid);
  return omPublicNameFromRecord(userRecord,cleanFallback);
}
async function omEnrichReviewAuthors(list){
  return await Promise.all((Array.isArray(list)?list:[]).map(async r=>({
    ...r,
    author:await omResolvePublicReviewAuthor(r?.uid,r?.author)
  })));
}
async function omCurrentPublicIdentity(user=auth.currentUser){
  const uid=String(user?.uid||"").trim();
  let record={};
  try{ record=uid ? await omGetPublicUserRecord(uid,{force:true}) : {}; }catch(_e){}
  if(uid && currentUser?.uid===uid && profileCache && typeof profileCache==="object") record={...record,...profileCache};
  const firstName=omCleanPublicPersonName(record?.firstName);
  const lastName=omCleanPublicPersonName(record?.lastName);
  const authorName=omPublicNameFromRecord(record,omCleanPublicPersonName(user?.displayName)||"Foydalanuvchi");
  return {authorName,firstName,lastName};
}
function omOrderPublicName(order,fallback="Mijoz"){
  return omPublicNameFromRecord({
    ...(order||{}),
    name:order?.userName || order?.name || order?.fullName || order?.customerName || ""
  },fallback);
}

// ---------------- Reviews (Firestore, realtime) ----------------
// Reviews subcollection: products/{productId}/reviews/{uid} -> {uid, authorName, stars, text, createdAt, updatedAt}
// Rating/Count: Firestore Aggregate (real, server-side), statsCache bilan tezlashtiramiz.
const statsCache = new Map(); // productId -> {avg, count, ts}
let unsubReviews = null;
let viewerProductId = null;

function cleanupReviewSubscriptions(){
  try{ unsubReviews && unsubReviews(); }catch{}
  unsubReviews = null;
}

function getStats(productId){
  const d = statsCache.get(productId);
  if(!d) return { avg: 0, count: 0 };
  return { avg: Number(d.avg)||0, count: Number(d.count)||0 };
}

async function refreshStats(productId, force=false){
  const now = Date.now();
  const cached = statsCache.get(productId);
  if(!force && cached && (now - (cached.ts||0) < 20000)) return getStats(productId);

  try{
    const baseRef = query(
      collection(db, "products", productId, "reviews"),
      where("moderationStatus", "==", "approved")
    );
    const agg = await getAggregateFromServer(baseRef, {
      count: count(),
      avg: average("stars")
    });
    const data = agg.data() || {};
    const out = {
      avg: Number(data.avg)||0,
      count: Number(data.count)||0,
      ts: now
    };
    statsCache.set(productId, out);
    return { avg: out.avg, count: out.count };
  }catch(e){
    return getStats(productId);
  }
}

async function omSubmitReviewSecure(productId, stars, text){
  const user=auth.currentUser;
  if(!user) throw new Error("login_required");
  const token=await user.getIdToken();
  const resp=await fetch("/.netlify/functions/review-submit",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer "+token},
    body:JSON.stringify({action:"submit_review",productId:String(productId||""),stars:Number(stars)||5,text:String(text||"")})
  });
  const out=await resp.json().catch(()=>({}));
  if(!resp.ok||!out.ok) throw new Error(out.error||"review_submit_failed");
  return out;
}

async function preloadStats(productIds){
  await Promise.all((productIds||[]).map(id => refreshStats(id, false)));
}

function subscribeReviews(productId){
  cleanupReviewSubscriptions();
  logEvent('view', productId);
  viewerProductId = productId;

  refreshStats(productId, true).then((st)=>{
    if(els.revScore) els.revScore.innerHTML = `<i class="fa-solid fa-star"></i> ${st.avg ? st.avg.toFixed(1) : "0.0"}`;
    if(els.revCount) els.revCount.textContent = `(${st.count} sharh)`;
  });

  const q = query(
    collection(db, "products", productId, "reviews"),
    where("moderationStatus", "==", "approved"),
    limit(60)
  );
  let statsDebounce = null;
  unsubReviews = onSnapshot(q, async (snap)=>{
    const list = [];
    snap.forEach((docu)=>{
      const d = docu.data() || {};
      list.push({
        uid: d.uid || docu.id,
        author: d.authorName || "Foydalanuvchi",
        stars: Number(d.stars)||0,
        text: (d.text||"").toString(),
        adminReply: (d.adminReply?.text || d.adminReplyText || "").toString(),
        ts: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0
      });
    });
    list.sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    renderReviewsList(await omEnrichReviewAuthors(list.slice(0,30)));

    if(statsDebounce) clearTimeout(statsDebounce);
    statsDebounce = setTimeout(async ()=>{
      try{
        const st = await refreshStats(productId, true);
        if(els.revScore) els.revScore.innerHTML = `<i class="fa-solid fa-star"></i> ${st.avg ? st.avg.toFixed(1) : "0.0"}`;
        if(els.revCount) els.revCount.textContent = `(${st.count} sharh)`;
      }catch(e){}
    }, 600);
  }, (err)=>{
    // silent
  });
}

function formatDate(ts){
  try{
    if(!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("uz-UZ", { year:"numeric", month:"2-digit", day:"2-digit" });
  }catch{ return ""; }
}

function renderReviewsList(list){
  if(!els.revList) return;
  els.revList.innerHTML = "";

  if(!list.length){
    const d = document.createElement("div");
    d.className = "revItem";
    d.innerHTML = `<div class="revItemText">Hozircha sharh yo‘q. Birinchi bo‘lib sharh qoldiring 🙂</div>`;
    els.revList.appendChild(d);
    return;
  }

  for(const r of list){
    const item = document.createElement("div");
    item.className = "revItem";
    const stars = "★".repeat(Math.max(0, Math.min(5, r.stars))) + "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, r.stars))));
    const imgs = (r.images||[]).length ? `
      <div class="revItemImgs">
        ${(r.images||[]).map(u=>`
          <div class="revItemImg" data-img="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt="review image" loading="lazy" decoding="async"/></div>
        `).join("")}
      </div>
    ` : "";

    item.innerHTML = `
      <div class="revHead">
        <div class="revAuthor">${escapeHtml(r.author)}</div>
        <div class="revMeta">
          <span class="revStarsMini">${stars}</span>
          <span class="revDate">${escapeHtml(formatDate(r.ts))}</span>
        </div>
      </div>
      ${r.text ? `<div class="revItemText">${escapeHtml(r.text)}</div>` : ""}
      ${imgs}
      ${r.adminReply ? `<div class="revAdminReply"><b>OrzuMall javobi</b><span>${escapeHtml(r.adminReply)}</span></div>` : ""}
    `;
    els.revList.appendChild(item);
  }

  // click any review image to open viewer
  els.revList.querySelectorAll(".revItemImg").forEach(el=>{
    el.addEventListener("click", ()=>{
      const u = el.getAttribute("data-img");
      if(u) openStandaloneImage(u);
    });
  });
}

function openImageZoom(src){
  try{ if(!src) return; }catch(e){ return; }
  // lightweight zoom overlay (no product modal)
  const old = document.querySelector(".imgZoomOverlay");
  if(old) old.remove();
  const overlay = document.createElement("div");
  overlay.className = "imgZoomOverlay";
  overlay.innerHTML = `\
    <div class="imgZoomBackdrop"></div>\
    <div class="imgZoomBox" role="dialog" aria-modal="true">\
      <button class="imgZoomClose" aria-label="Yopish">×</button>\
      <img class="imgZoomImg" src="${src}" alt="Zoom"/>\
    </div>`;
  const close = ()=>{ overlay.remove(); window.removeEventListener("keydown", onKey); };
  const onKey = (ev)=>{ if(ev.key==="Escape") close(); };
  overlay.querySelector(".imgZoomBackdrop").addEventListener("click", close);
  overlay.querySelector(".imgZoomClose").addEventListener("click", close);
  window.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

function openStandaloneImage(url){
  openImageZoom(url);
}


// Variant selections per product (in-memory)

const selected = new Map(); // id -> {color, size, imgIdx}

// Image viewer state
let viewer = { open:false, productId:null, title:"", desc:"", images:[], idx:0, onSelect:null };

function normColors(p){
  const arr = p.colors || p.colorOptions || [];
  return arr.map(c=>{
    if(typeof c === "string") return {name:c, hex:null};
    return {name: c.name || c.label || "Color", hex: c.hex || c.color || null};
  });
}
function normSizes(p){
  const arr = p.sizes || p.sizeOptions || [];
  return arr.map(s=> typeof s === "string" ? s : (s.label||s.name||""));
}
function getDefaultSel(p){
  const colors = normColors(p);
  const sizes = normSizes(p);
  return {
    color: colors[0]?.name || null,
    size: sizes[0] || null,
    imgIdx: 0,
  };
}
function getSel(p){
  if(selected.has(p.id)) return selected.get(p.id);
  const d = getDefaultSel(p);
  selected.set(p.id, d);
  return d;
}

// --- Images (multi-image + variant-dependent) ---
// Supported JSON formats:
// 1) images: [url1, url2, ...]                         (generic)
// 2) images: { "Gold": [...], "Black": [...] }          (per color)
// 3) imagesByColor: { "Gold": [...], ... }               (per color)
// 4) image: "url"                                       (legacy fallback)
function normImages(p, sel){
  const color = sel?.color || "";

  // explicit imagesByColor
  if(p && p.imagesByColor && typeof p.imagesByColor === "object"){
    const arr = p.imagesByColor[color] || p.imagesByColor[color?.toLowerCase?.()] || null;
    if(Array.isArray(arr) && arr.length) return arr;
  }

  // images can be array or map
  if(Array.isArray(p?.images) && p.images.length) return p.images;
  if(p && p.images && typeof p.images === "object"){
    const arr = p.images[color] || p.images[color?.toLowerCase?.()] || null;
    if(Array.isArray(arr) && arr.length) return arr;
    // if object but no matching key, try any first array
    const firstKey = Object.keys(p.images).find(k=>Array.isArray(p.images[k]) && p.images[k].length);
    if(firstKey) return p.images[firstKey];
  }

  // legacy
  if(p?.image) return [p.image];
  return [];
}

function getCurrentImage(p, sel){
  const imgs = normImages(p, sel);
  if(!imgs.length) return "";
  const idx = Math.max(0, Math.min(sel?.imgIdx ?? 0, imgs.length-1));
  return imgs[idx] || imgs[0];
}

function setImageIndex(p, idx){
  const sel = getSel(p);
  const imgs = normImages(p, sel);
  if(!imgs.length) return;
  sel.imgIdx = Math.max(0, Math.min(idx, imgs.length-1));
  selected.set(p.id, sel);
}
function variantKey(id, sel){
  const c = sel?.color || "";
  const s = sel?.size || "";
  return `${id}::${c}::${s}`;
}

function getImagesFor(p, sel){
  // Supports:
  // 1) imagesByColor: {"Gold": [..], "Black": [..]}
  // 2) images: object map (same as above)
  // 3) images: array
  // 4) image: single string
  const color = sel?.color || null;
  const byColor = p.imagesByColor || null;
  if(byColor && color && Array.isArray(byColor[color]) && byColor[color].length){
    return byColor[color].filter(Boolean);
  }
  if(p.images && !Array.isArray(p.images) && typeof p.images === "object"){
    if(color && Array.isArray(p.images[color]) && p.images[color].length) return p.images[color].filter(Boolean);
    // fallback: first key
    const k = Object.keys(p.images)[0];
    if(k && Array.isArray(p.images[k])) return p.images[k].filter(Boolean);
  }
  if(Array.isArray(p.images) && p.images.length) return p.images.filter(Boolean);
  if(p.image) return [p.image];
  return [];
}

function clampIdx(i, n){
  if(!n) return 0;
  const x = i % n;
  return x < 0 ? x + n : x;
}

function setCardImage(imgEl, p, sel){
  const imgs = getImagesFor(p, sel);
  const idx = clampIdx(sel?.imgIdx || 0, imgs.length);
  if(imgs.length){
    imgEl.src = imgs[idx];
  }
}


function loadLS(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch{ return fallback; }
}
function saveLS(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_e){}
  try{
    if(key === LS.favs || key === LS.cart){
      omCacheCurrentShopLocal();
      scheduleUserShopSync();
    }
  }catch(_){}
}

let viewMode = "all"; // all | fav
let selectedTag = null; // chips removed; keep for backward-compat
let favs = new Set(loadLS(LS.favs, []));
let cart = loadLS(LS.cart, []);
// Cart selection (for partial checkout / later buy)
let cartSelected = new Set(); // contains cart item keys
let lastCartKeys = new Set(cart.map(x=>x.key)); // track additions (so deselected items stay deselected)
let cartSelectionInitialized = false; // important: empty selection must remain empty after user unchecks all

function syncCartSelected(autoSelectNew=true){
  const keys = new Set(cart.map(x=>x.key));

  // First run only: default everything selected.
  // After that, cartSelected.size === 0 means the user intentionally unchecked all.
  if(!cartSelectionInitialized){
    cartSelected = new Set(keys);
    lastCartKeys = new Set(keys);
    cartSelectionInitialized = true;
    return;
  }

  // drop removed items
  cartSelected = new Set(Array.from(cartSelected).filter(k=>keys.has(k)));

  // auto-select ONLY newly added items (do not re-select deselected ones)
  if(autoSelectNew){
    for(const k of keys){
      if(!lastCartKeys.has(k)) cartSelected.add(k);
    }
  }

  lastCartKeys = new Set(keys);
}

function allCartSelected(){
  if(cart.length === 0) return false;
  return cart.every(x=>cartSelected.has(x.key));
}

function selectedCartItems(){
  syncCartSelected(true);
  return cart.filter(ci=>cartSelected.has(ci.key));
}

// migrate legacy cart items: {id,qty} -> {key,id,color,size,qty}
cart = (cart||[]).map(x=>{
  if(x && x.key) return x;
  const id = x?.id;
  const qty = x?.qty ?? 1;
  const key = `${id}::::`;
  return {key, id, color:null, size:null, qty, image:null};
}); // [{id, qty}]


/* ===== Cross-device user shop state sync: favorites, cart, saved addresses ===== */
let omUserShopReady = false;
let omUserShopApplying = false;
let omUserShopTimer = null;
let omUserShopUnsub = null;
let omUserShopLastJson = "";

function omNormalizeFavs(arr){
  return Array.from(new Set((Array.isArray(arr) ? arr : []).map(x=>String(x||"").trim()).filter(Boolean)));
}
function omNormalizeCart(arr){
  const map = new Map();
  (Array.isArray(arr) ? arr : []).forEach(x=>{
    if(!x || !x.id) return;
    const item = {...x};
    item.key = item.key || variantKey(item.id, {color:item.color||null, size:item.size||null});
    item.qty = Math.max(1, Number(item.qty||1));
    const old = map.get(item.key);
    if(old){
      old.qty = Math.max(Number(old.qty||1), item.qty);
      if(!old.image && item.image) old.image = item.image;
    }else{
      map.set(item.key, item);
    }
  });
  return Array.from(map.values());
}
function omNormalizeAddresses(arr){
  const map = new Map();
  (Array.isArray(arr) ? arr : []).forEach((a,i)=>{
    if(!a) return;
    const id = String(a.id || `addr_${Date.now()}_${i}`);
    map.set(id, {...a, id});
  });
  return Array.from(map.values()).slice(0, 20);
}
function omMergeCart(a,b){ return omNormalizeCart([...(a||[]), ...(b||[])]); }
function omMergeFavs(a,b){ return omNormalizeFavs([...(a||[]), ...(b||[])]); }
function omMergeAddresses(a,b){ return omNormalizeAddresses([...(a||[]), ...(b||[])]); }

/* v42: delivery addresses must never leak between accounts on the same browser. */
const OM_SAVED_ADDR_KEY_PREFIX = "orzumall_saved_delivery_addresses_v2";
function omSavedAddressStorageKey(uid=currentUser?.uid){
  const safeUid = String(uid || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${OM_SAVED_ADDR_KEY_PREFIX}_${safeUid}`;
}
function omOwnedAddresses(arr, uid=currentUser?.uid){
  const ownerUid = String(uid || "");
  if(!ownerUid) return [];
  return omNormalizeAddresses(arr).filter(a=>String(a?.ownerUid || "") === ownerUid);
}
function omStampOwnedAddresses(arr, uid=currentUser?.uid){
  const ownerUid = String(uid || "");
  if(!ownerUid) return [];
  return omNormalizeAddresses(arr).map(a=>({...a, ownerUid}));
}
function omCurrentSavedAddresses(){
  try{ return omOwnedAddresses(JSON.parse(localStorage.getItem(omSavedAddressStorageKey()) || "[]")); }
  catch(_){ return []; }
}
function omSetSavedAddressesLocal(arr){
  try{ localStorage.setItem(omSavedAddressStorageKey(), JSON.stringify(omStampOwnedAddresses(arr))); }catch(_){}
}
function omUserShopPayload(){
  return {
    favs: omNormalizeFavs(Array.from(favs||[])),
    cart: omNormalizeCart(cart||[]),
    savedAddresses: omCurrentSavedAddresses(),
    deliveryPreference: {
      method: (typeof omReadStoredDeliveryMethod === "function" ? omReadStoredDeliveryMethod() : ""),
      pickupPointId: (typeof omReadSelectedPickupPointId === "function" ? omReadSelectedPickupPointId() : "")
    }
  };
}
function omReadUserShopLocal(uid=currentUser?.uid){
  let raw=omReadScopedCache(OM_USER_SHOP_CACHE_PREFIX,uid,null);
  // One-time safe legacy migration: the first authenticated account on v47 may
  // claim old generic fav/cart storage. Later accounts never inherit it.
  if((!raw || typeof raw!=="object") && uid){
    try{
      const migrationOwnerKey="orzumall_legacy_shop_owner_v47";
      const owner=String(localStorage.getItem(migrationOwnerKey)||"");
      if(!owner || owner===String(uid)){
        if(!owner) localStorage.setItem(migrationOwnerKey,String(uid));
        raw={
          favs:loadLS(LS.favs,[]),
          cart:loadLS(LS.cart,[]),
          savedAddresses:omCurrentSavedAddresses(),
          deliveryPreference:{
            method:(typeof omReadStoredDeliveryMethod==="function"?omReadStoredDeliveryMethod():""),
            pickupPointId:(typeof omReadSelectedPickupPointId==="function"?omReadSelectedPickupPointId():"")
          }
        };
        omWriteScopedCache(OM_USER_SHOP_CACHE_PREFIX,uid,raw);
      }
    }catch(_e){}
  }
  if(!raw || typeof raw!=="object") return null;
  return {
    favs:omNormalizeFavs(raw.favs||[]),
    cart:omNormalizeCart(raw.cart||[]),
    savedAddresses:omOwnedAddresses(raw.savedAddresses||[],uid),
    deliveryPreference:raw.deliveryPreference||{method:""}
  };
}
function omCacheCurrentShopLocal(uid=currentUser?.uid){
  if(!uid) return;
  try{ omWriteScopedCache(OM_USER_SHOP_CACHE_PREFIX,uid,omUserShopPayload()); }catch(_e){}
}
function omHydrateUserShopLocal(user){
  if(!user?.uid) return;
  const cached=omReadUserShopLocal(user.uid) || {favs:[],cart:[],savedAddresses:[],deliveryPreference:{method:""}};
  omApplyUserShopState(cached,{merge:false});
}
function omApplyUserShopState(data, opts={merge:false}){
  if(!data) return;
  omUserShopApplying = true;
  try{
    const serverFavs = data.favs || data.favoriteProducts || data.shop?.favs || [];
    const serverCart = data.cart || data.shop?.cart || [];
    const serverAddresses = omOwnedAddresses(data.savedAddresses || data.deliveryAddresses || data.shop?.savedAddresses || []);
    const serverPreference = data.deliveryPreference || data.shop?.deliveryPreference || {};

    const nextFavs = opts.merge ? omMergeFavs(Array.from(favs||[]), serverFavs) : omNormalizeFavs(serverFavs);
    const nextCart = opts.merge ? omMergeCart(cart||[], serverCart) : omNormalizeCart(serverCart);
    const nextAddresses = opts.merge ? omMergeAddresses(omCurrentSavedAddresses(), serverAddresses) : omOwnedAddresses(serverAddresses);

    favs = new Set(nextFavs);
    cart = nextCart;
    localStorage.setItem(LS.favs, JSON.stringify(nextFavs));
    localStorage.setItem(LS.cart, JSON.stringify(nextCart));
    omSetSavedAddressesLocal(nextAddresses);
    try{
      const prefMethod = String(serverPreference?.method || "");
      if(!omReadStoredDeliveryMethod() && (prefMethod === "pickup" || prefMethod === "pickup_point" || prefMethod === "delivery")) omStoreDeliveryMethod(prefMethod, false);
      const prefPointId = String(serverPreference?.pickupPointId || "");
      if(prefPointId && typeof omReadSelectedPickupPointId === "function" && typeof omWriteSelectedPickupPointId === "function" && !omReadSelectedPickupPointId()) omWriteSelectedPickupPointId(prefPointId, false);
      const methodSelect = document.getElementById("deliveryMethodSelect");
      if(methodSelect && !methodSelect.value){
        const storedMethod = omReadStoredDeliveryMethod();
        if(storedMethod) methodSelect.value = storedMethod;
      }
    }catch(_e){}

    cartSelected = new Set((cart||[]).map(x=>x.key));
    lastCartKeys = new Set((cart||[]).map(x=>x.key));
    cartSelectionInitialized = true;

    updateBadges?.();
    try{ renderSavedAddressesUI?.(); }catch(_){}
    try{ renderFavPage?.(); }catch(_){}
    try{ renderCartPage?.(); }catch(_){}
    try{ if(typeof applyFilterSort === "function") applyFilterSort(); }catch(_){}
    try{ omCacheCurrentShopLocal(); }catch(_e){}
  }finally{
    omUserShopApplying = false;
  }
}
async function loadUserShopState(user){
  if(!user?.uid) return;
  omUserShopReady = false;
  // Instant offline-first render; never hydrate from another account's generic cache.
  try{ omHydrateUserShopLocal(user); }catch(_e){}
  try{
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    // Merge only the UID-scoped local copy with this same UID's Firestore data.
    omApplyUserShopState(data, {merge:true});
    const payload = omUserShopPayload();
    omUserShopLastJson = JSON.stringify(payload);
    omCacheCurrentShopLocal(user.uid);
    await setDoc(ref, {...payload, shopUpdatedAt: serverTimestamp()}, {merge:true});
    omUserShopReady = true;
  }catch(e){
    omUserShopReady = true;
    try{ omCacheCurrentShopLocal(user.uid); }catch(_e){}
    console.warn("User shop sync load failed", e);
  }
}
function subscribeUserShopState(user){
  try{ if(omUserShopUnsub) omUserShopUnsub(); }catch(_){}
  omUserShopUnsub = null;
  if(!user?.uid) return;
  const ref = doc(db, "users", user.uid);
  omUserShopUnsub = onSnapshot(ref, (snap)=>{
    if(!snap.exists() || omUserShopApplying) return;
    const data = snap.data() || {};
    const payload = {
      favs: omNormalizeFavs(data.favs || data.favoriteProducts || data.shop?.favs || []),
      cart: omNormalizeCart(data.cart || data.shop?.cart || []),
      savedAddresses: omOwnedAddresses(data.savedAddresses || data.deliveryAddresses || data.shop?.savedAddresses || []),
      deliveryPreference: data.deliveryPreference || data.shop?.deliveryPreference || {method:""}
    };
    const json = JSON.stringify(payload);
    if(json === omUserShopLastJson) return;
    omUserShopLastJson = json;
    omApplyUserShopState(payload, {merge:false});
  }, (err)=> console.warn("User shop sync snapshot failed", err));
}
function scheduleUserShopSync(){
  try{
    // Persist synchronously first. Network sync is a second layer, not the only layer.
    omCacheCurrentShopLocal();
    if(omUserShopApplying || !omUserShopReady || !currentUser?.uid) return;
    clearTimeout(omUserShopTimer);
    omUserShopTimer = setTimeout(saveUserShopStateNow, 260);
  }catch(_){}
}
async function saveUserShopStateNow(){
  try{
    omCacheCurrentShopLocal();
    if(omUserShopApplying || !omUserShopReady || !currentUser?.uid) return;
    const payload = omUserShopPayload();
    const json = JSON.stringify(payload);
    if(json === omUserShopLastJson) return;
    omUserShopLastJson = json;
    await setDoc(doc(db, "users", currentUser.uid), {...payload, shopUpdatedAt: serverTimestamp()}, {merge:true});
  }catch(e){ console.warn("User shop sync save failed", e); }
}
try{
  window.addEventListener("pagehide",()=>{ try{ omCacheCurrentShopLocal(); saveUserShopStateNow(); }catch(_e){} });
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden"){ try{ omCacheCurrentShopLocal(); saveUserShopStateNow(); }catch(_e){} } });
}catch(_e){}


function showTgNotice(msg){
  if(!els.tgNotice) return;
  els.tgNotice.hidden = !msg;
  els.tgNotice.textContent = msg || "";
}

function moneyUZS(n){
  const x = typeof n === "number" && Number.isFinite(n) ? n : parsePrice(n);
  try { return new Intl.NumberFormat("uz-UZ").format(x) + " so‘m"; }
  catch { return `${x} UZS`; }
}


/* ===== OrzuMall smart delivery engine ===== */
const OM_STORE_LOCATION = Object.freeze({
  lat: 41.11310047928018,
  lng: 71.55482525265317,
  title: "OrzuMall do‘koni"
});

const OM_DELIVERY_SETTINGS_DEFAULT = Object.freeze({
  version: 1,
  courier: {
    enabled: true,
    maxKm: 30,
    zones: [
      { id: "z1", fromKm: 0, maxKm: 3, feeUZS: 10000, freeFromUZS: 99000, etaText: "Bugun / 1 kun" },
      { id: "z2", fromKm: 3, maxKm: 7, feeUZS: 15000, freeFromUZS: 199000, etaText: "Bugun / 1 kun" },
      { id: "z3", fromKm: 7, maxKm: 12, feeUZS: 25000, freeFromUZS: 299000, etaText: "Bugun / 1 kun" },
      { id: "z4", fromKm: 12, maxKm: 20, feeUZS: 35000, freeFromUZS: 499000, etaText: "1–2 kun" },
      { id: "z5", fromKm: 20, maxKm: 30, baseFeeUZS: 35000, perKmUZS: 3000, freeFromUZS: 899000, etaText: "1–2 kun" }
    ]
  },
  uzpost: {
    enabled: true,
    firstKgFeeUZS: 15000,
    extraKgFeeUZS: 3000,
    etaText: "2–5 kun",
    freeRules: [
      { maxKg: 1, freeFromUZS: 249000 },
      { maxKg: 3, freeFromUZS: 399000 },
      { maxKg: 5, freeFromUZS: 599000 },
      { maxKg: 10, freeFromUZS: 999000 }
    ]
  }
});
let omDeliverySettings = (typeof structuredClone === "function") ? structuredClone(OM_DELIVERY_SETTINGS_DEFAULT) : JSON.parse(JSON.stringify(OM_DELIVERY_SETTINGS_DEFAULT));
let omDeliveryQuote = null;

function omDeliveryCloneDefault(){
  try{ return (typeof structuredClone === "function") ? structuredClone(OM_DELIVERY_SETTINGS_DEFAULT) : JSON.parse(JSON.stringify(OM_DELIVERY_SETTINGS_DEFAULT)); }catch(_e){ return JSON.parse(JSON.stringify(OM_DELIVERY_SETTINGS_DEFAULT)); }
}
function omMoneyNum(v, fallback=0){
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function omNormalizeDeliverySettings(raw){
  const d = omDeliveryCloneDefault();
  const src = raw && typeof raw === "object" ? raw : {};
  const courier = src.courier && typeof src.courier === "object" ? src.courier : {};
  d.courier.enabled = courier.enabled !== false;
  d.courier.maxKm = Math.max(1, omMoneyNum(courier.maxKm, d.courier.maxKm));
  if(Array.isArray(courier.zones) && courier.zones.length){
    d.courier.zones = courier.zones.map((z, i)=>({
      id: String(z.id || `z${i+1}`),
      fromKm: Math.max(0, omMoneyNum(z.fromKm, i ? d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.fromKm || 0 : 0)),
      maxKm: Math.max(1, omMoneyNum(z.maxKm, d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.maxKm || 3)),
      feeUZS: Math.max(0, Math.round(omMoneyNum(z.feeUZS, d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.feeUZS || 0))),
      baseFeeUZS: Math.max(0, Math.round(omMoneyNum(z.baseFeeUZS, d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.baseFeeUZS || z.feeUZS || 0))),
      perKmUZS: Math.max(0, Math.round(omMoneyNum(z.perKmUZS, d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.perKmUZS || 0))),
      freeFromUZS: Math.max(0, Math.round(omMoneyNum(z.freeFromUZS, d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.freeFromUZS || 0))),
      etaText: String(z.etaText || d.courier.zones[Math.min(i, d.courier.zones.length-1)]?.etaText || "1–2 kun")
    })).sort((a,b)=>a.maxKm-b.maxKm).slice(0, 12);
  }
  const uzpost = src.uzpost && typeof src.uzpost === "object" ? src.uzpost : {};
  d.uzpost.enabled = uzpost.enabled !== false;
  d.uzpost.firstKgFeeUZS = Math.max(0, Math.round(omMoneyNum(uzpost.firstKgFeeUZS, d.uzpost.firstKgFeeUZS)));
  d.uzpost.extraKgFeeUZS = Math.max(0, Math.round(omMoneyNum(uzpost.extraKgFeeUZS, d.uzpost.extraKgFeeUZS)));
  d.uzpost.etaText = String(uzpost.etaText || d.uzpost.etaText);
  if(Array.isArray(uzpost.freeRules) && uzpost.freeRules.length){
    d.uzpost.freeRules = uzpost.freeRules.map((r, i)=>({
      maxKg: Math.max(1, omMoneyNum(r.maxKg, d.uzpost.freeRules[Math.min(i, d.uzpost.freeRules.length-1)]?.maxKg || 1)),
      freeFromUZS: Math.max(0, Math.round(omMoneyNum(r.freeFromUZS, d.uzpost.freeRules[Math.min(i, d.uzpost.freeRules.length-1)]?.freeFromUZS || 0)))
    })).sort((a,b)=>a.maxKg-b.maxKg).slice(0, 12);
  }
  return d;
}
async function omLoadDeliverySettings(){
  try{
    const cached = localStorage.getItem("orzumall_delivery_settings_v1");
    if(cached) omDeliverySettings = omNormalizeDeliverySettings(JSON.parse(cached));
  }catch(_e){}
  try{
    const snap = await getDoc(doc(db, "configs", "delivery"));
    if(snap.exists()){
      omDeliverySettings = omNormalizeDeliverySettings(snap.data());
      try{ localStorage.setItem("orzumall_delivery_settings_v1", JSON.stringify(omDeliverySettings)); }catch(_e){}
    }
  }catch(_e){ /* Firestore qoidasi ruxsat bermasa default tariflar ishlaydi */ }
  try{ omRenderDeliveryEstimate(); }catch(_e){}
  try{
    const deliverySummary = omRenderCartDeliverySummary();
    if(deliverySummary?.totalWithDeliveryUZS && els.cartTotalPage) els.cartTotalPage.textContent = moneyUZS(deliverySummary.totalWithDeliveryUZS);
    if(deliverySummary?.totalWithDeliveryUZS && els.checkoutCompactSummary){
      els.checkoutCompactSummary.innerHTML = `<span>${selectedCount} ta • ${omFormatKg(selectedWeightKg)} • yetkazish bilan</span><b>${moneyUZS(deliverySummary.totalWithDeliveryUZS)}</b>`;
    }
  }catch(_e){}
  return omDeliverySettings;
}

function omNum(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function omProductWeightKg(p){
  const n = omNum(p?.weightKg ?? p?.weight_kg ?? p?.weight ?? p?.massKg ?? p?.shippingWeightKg, 0);
  return Math.max(0, n);
}
function omFormatKg(kg){
  const n = Math.max(0, omNum(kg, 0));
  if(n <= 0) return "0 kg";
  if(n < 1) return `${Math.round(n * 1000)} g`;
  return `${n.toFixed(n >= 10 ? 1 : 2).replace(/\.00$/, "").replace(/0$/, "")} kg`;
}
function omHaversineKm(lat1, lng1, lat2, lng2){
  const R = 6371;
  const toRad = d => Number(d) * Math.PI / 180;
  const dLat = toRad(lat2-lat1);
  const dLng = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function omCourierQuote(orderTotal, distanceKm){
  const settings = omNormalizeDeliverySettings(omDeliverySettings).courier;
  if(settings.enabled === false) return null;
  const km = Math.ceil(Math.max(0, omNum(distanceKm, 0)));
  if(!Number.isFinite(km) || km > omNum(settings.maxKm, 30)) return null;
  const zone = (settings.zones || []).find(z => km <= omNum(z.maxKm, 0));
  if(!zone) return null;
  let rawFee = 0;
  if(omNum(zone.perKmUZS, 0) > 0){
    rawFee = omNum(zone.baseFeeUZS, omNum(zone.feeUZS, 0)) + Math.max(0, km - omNum(zone.fromKm, 0)) * omNum(zone.perKmUZS, 0);
  }else{
    rawFee = omNum(zone.feeUZS, 0);
  }
  rawFee = Math.max(0, Math.round(rawFee));
  const freeFrom = Math.max(0, Math.round(omNum(zone.freeFromUZS, 0)));
  const isFree = freeFrom > 0 && omNum(orderTotal, 0) >= freeFrom;
  return {
    service: "courier",
    label: "Kuryer",
    distanceKm: Number(distanceKm),
    billedKm: km,
    feeUZS: isFree ? 0 : rawFee,
    rawFeeUZS: rawFee,
    freeFromUZS: freeFrom || null,
    isFree,
    etaText: zone.etaText || (km <= 12 ? "Bugun / 1 kun" : "1–2 kun"),
    note: `${km} km zona`
  };
}
function omUzPostQuote(orderTotal, weightKg){
  const settings = omNormalizeDeliverySettings(omDeliverySettings).uzpost;
  if(settings.enabled === false) return null;
  const kg = Math.max(1, Math.ceil(Math.max(0, omNum(weightKg, 0))));
  const rawFee = Math.max(0, Math.round(omNum(settings.firstKgFeeUZS, 15000) + Math.max(0, kg - 1) * omNum(settings.extraKgFeeUZS, 3000)));
  const rule = (settings.freeRules || []).find(r => kg <= omNum(r.maxKg, 0));
  const freeFrom = rule ? Math.max(0, Math.round(omNum(rule.freeFromUZS, 0))) : null;
  const isFree = !!freeFrom && omNum(orderTotal, 0) >= freeFrom;
  return {
    service: "uzpost",
    label: "UzPost pochta",
    weightKg: Number(weightKg) || 0,
    billedKg: kg,
    feeUZS: isFree ? 0 : rawFee,
    rawFeeUZS: rawFee,
    freeFromUZS: freeFrom,
    isFree,
    etaText: settings.etaText || "2–5 kun",
    note: `${kg} kg bo‘yicha`
  };
}
function omBuildDeliveryQuote(orderTotal, weightKg, location){
  const opts = [];
  let distanceKm = null;
  if(location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))){
    distanceKm = omHaversineKm(OM_STORE_LOCATION.lat, OM_STORE_LOCATION.lng, Number(location.lat), Number(location.lng));
    const cq = omCourierQuote(orderTotal, distanceKm);
    if(cq) opts.push(cq);
  }
  const uq = omUzPostQuote(orderTotal, weightKg);
  if(uq) opts.push(uq);
  opts.sort((a,b)=>{
    if((a.feeUZS||0) !== (b.feeUZS||0)) return (a.feeUZS||0) - (b.feeUZS||0);
    if(a.service === "courier" && b.service !== "courier" && Number(distanceKm) <= 20) return -1;
    if(b.service === "courier" && a.service !== "courier" && Number(distanceKm) <= 20) return 1;
    return 0;
  });
  const recommended = opts[0] || null;
  return {
    store: OM_STORE_LOCATION,
    orderTotalUZS: omNum(orderTotal, 0),
    weightKg: omNum(weightKg, 0),
    distanceKm,
    options: opts,
    recommended,
    deliveryFeeUZS: recommended ? omNum(recommended.feeUZS, 0) : 0,
    totalWithDeliveryUZS: omNum(orderTotal, 0) + (recommended ? omNum(recommended.feeUZS, 0) : 0)
  };
}
function omQuoteLabel(q){
  if(!q) return "Yetkazib berish";
  const rec = q.recommended;
  if(!rec) return "Yetkazib berish";
  return rec.service === "courier" ? "Kuryer orqali yetkazish" : "UzPost orqali yetkazish";
}

function omBestSavedAddress(){
  try{
    const arr = omReadSavedAddresses();
    return arr.find(a=>Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng))) || arr[0] || null;
  }catch(_){ return null; }
}
function omLocationFromSavedAddress(a){
  if(!a) return null;
  const lat = Number(a.lat), lng = Number(a.lng);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat, lng,
    accuracy: Number(a.accuracy || 0),
    mapUrl: a.mapUrl || `https://maps.google.com/?q=${lat},${lng}`,
    savedAddressId: a.id || "",
    savedAddressTitle: omAddressTitle(a)
  };
}
function omGetEffectiveDeliveryLocation(){
  if(omDeliveryLocation && Number.isFinite(Number(omDeliveryLocation.lat)) && Number.isFinite(Number(omDeliveryLocation.lng))) return omDeliveryLocation;
  return omLocationFromSavedAddress(omBestSavedAddress());
}
function omFreeDeliveryInfo(totalUZS, quote, weightKg){
  const total = Number(totalUZS || 0);
  const make = (q)=>{
    if(!q || !Number.isFinite(Number(q.freeFromUZS)) || Number(q.freeFromUZS) <= 0) return null;
    const limit = Number(q.freeFromUZS);
    return {
      freeFromUZS: limit,
      service: q.label || "Yetkazish",
      source: q.service || "delivery",
      distanceKm: Number.isFinite(Number(q.distanceKm)) ? Number(q.distanceKm) : null,
      billedKm: q.billedKm || null,
      weightKg: Number.isFinite(Number(q.weightKg)) ? Number(q.weightKg) : null,
      billedKg: q.billedKg || null,
      remaining: Math.max(0, limit - total),
      reached: total >= limit
    };
  };

  // Muhim: bepul yetkazish limiti faqat real tavsiya qilingan xizmat bo‘yicha olinadi.
  // Masalan mijoz 421 km uzoqda bo‘lsa, 0–3 km kuryer zonasi (99 000 so‘m) hech qachon ishlatilmasin.
  const rec = quote?.recommended || null;
  const fromRecommended = make(rec);
  if(fromRecommended) return fromRecommended;

  // Agar quote bor, lekin recommended limit bermagan bo‘lsa, faqat mavjud real optionlardan qaraymiz.
  if(quote && Array.isArray(quote.options) && quote.options.length){
    const valid = quote.options.map(make).filter(Boolean);
    if(valid.length){
      valid.sort((a,b)=>a.remaining-b.remaining);
      return valid[0];
    }
    return null;
  }

  // Manzil hali yo‘q bo‘lsa, faqat UzPost vazn qoidasi bo‘yicha taxminiy limit ko‘rsatiladi.
  // Kuryer zonalarini manzilsiz aralashtirmaymiz.
  try{
    const uq = omUzPostQuote(total, weightKg || 0);
    return make(uq);
  }catch(_e){ return null; }
}
function omRenderCartDeliverySummary(){
  const el = els.cartDeliverySummary || document.getElementById("cartDeliverySummary");
  if(!el) return;
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;

  const bindCompact = ()=>{
    const wrap = el.querySelector('.cartDeliveryCompact');
    const toggle = el.querySelector('#cartDeliveryToggleBtn');
    const body = el.querySelector('#cartDeliveryCompactBody');
    if(!wrap || !toggle || !body) return;
    const collapsedDefault = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    const setOpen = (open)=>{
      wrap.classList.toggle('isOpen', !!open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.hidden = !open;
    };
    setOpen(!collapsedDefault);
    toggle.addEventListener('click', ()=> setOpen(body.hidden));
    el.querySelector('#cartDeliveryChangeBtn')?.addEventListener('click', openCheckout, {once:true});
  };

  if(!built || !built.ok){
    el.innerHTML = "";
    el.hidden = true;
    try{ updateCartPrimaryCTA(); }catch(_e){}
    return;
  }

  const method = getDeliveryMethod();
  el.hidden = false;

  if(!method){
    el.innerHTML = `
      <div class="cartDeliveryPending compactPending">
        <div class="cartDeliveryPendingIcon"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i></div>
        <div><b>Yetkazib berishni sozlang</b><span>Usul tanlangandan keyin hisoblanadi.</span></div>
      </div>
    `;
    try{ updateCartPrimaryCTA(); }catch(_e){}
    return { ready:false, productsTotalUZS: built.totalUZS };
  }

  const info = getCheckoutDeliveryInfo();
  if(!info.ok){
    el.innerHTML = `
      <div class="cartDeliveryCompact isSetupNeeded">
        <button type="button" class="cartDeliveryCompactTop" id="cartDeliveryToggleBtn" aria-expanded="false">
          <div class="cartDeliveryCompactLeft"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i><span>Yetkazib berish</span></div>
          <div class="cartDeliveryCompactRight"><b>Sozlash kerak</b><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></div>
        </button>
        <div class="cartDeliveryCompactBody" id="cartDeliveryCompactBody" hidden>
          <div class="cartDeliveryGrid compactGrid">
            <div><span>Mahsulotlar</span><b>${moneyUZS(built.totalUZS)}</b></div>
            <div><span>Yetkazish</span><b>—</b></div>
            <div><span>Jami</span><b>—</b></div>
          </div>
          <div class="cartDeliveryFree compactFree"><span>Lokatsiyani aniqlang</span><small>Lokatsiyadan keyin hisoblanadi.</small></div>
          <div class="cartDeliveryCompactActions"><button type="button" id="cartDeliveryChangeBtn">Sozlash</button></div>
        </div>
      </div>
    `;
    bindCompact();
    try{ updateCartPrimaryCTA(); }catch(_e){}
    return { ready:false, productsTotalUZS: built.totalUZS };
  }

  const data = info.data || {};
  const fee = Number(data.deliveryFeeUZS || 0);
  const totalWithDelivery = Number(data.totalWithDeliveryUZS || built.totalUZS + fee);
  const quote = data.deliveryQuote || null;
  const rec = quote?.recommended || null;
  const free = method === "delivery" ? omFreeDeliveryInfo(built.totalUZS, quote, built.totalWeightKg || 0) : null;
  const freeDetail = free ? (free.source === "courier" && free.distanceKm != null ? ` (${Number(free.distanceKm).toFixed(1)} km zona)` : (free.source === "uzpost" ? ` (${free.billedKg || 1} kg UzPost)` : "")) : "";
  const freeText = method === "pickup"
    ? "Do‘kondan olib ketish bepul"
    : (method === "pickup_point"
      ? "Tanlangan topshirish punkti tarifi hisoblandi"
      : (free ? (free.reached ? `${free.service} bepul yetkazish limiti bajarildi${freeDetail}` : `${free.service} bepul yetkazishgacha ${moneyUZS(free.remaining)} qoldi${freeDetail}`) : "Yetkazib berish narxi hisoblandi"));
  const smallText = method === "pickup" ? "Mahsulotni do‘kondan o‘zingiz olib ketasiz." : (method === "pickup_point" ? `${data.pickupPoint?.name || "Topshirish punkti"} • ${data.pickupPoint?.etaText || "muddat ko‘rsatilmagan"}` : `${data.serviceLabel || rec?.label || "Yetkazib berish"}${rec?.etaText ? ` • ${rec.etaText}` : ""}`);

  el.innerHTML = `
    <div class="cartDeliveryCompact isReady">
      <button type="button" class="cartDeliveryCompactTop" id="cartDeliveryToggleBtn" aria-expanded="false">
        <div class="cartDeliveryCompactLeft"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i><span>Yakuniy hisob-kitob</span></div>
        <div class="cartDeliveryCompactRight"><b>${moneyUZS(totalWithDelivery)}</b><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></div>
      </button>
      <div class="cartDeliveryCompactBody" id="cartDeliveryCompactBody" hidden>
        <div class="cartDeliveryGrid compactGrid">
          <div><span>Mahsulotlar</span><b>${moneyUZS(built.totalUZS)}</b></div>
          <div><span>Yetkazish</span><b>${fee ? moneyUZS(fee) : "Bepul"}</b></div>
          <div><span>Jami</span><b>${moneyUZS(totalWithDelivery)}</b></div>
        </div>
        <div class="cartDeliveryFree compactFree ${method === "pickup" || method === "pickup_point" || free?.reached ? "ok" : ""}"><span>${freeText}</span><small>${smallText}</small></div>
        <div class="cartDeliveryCompactActions"><button type="button" id="cartDeliveryChangeBtn">O‘zgartirish</button></div>
      </div>
    </div>
  `;
  bindCompact();
  try{ updateCartPrimaryCTA(); }catch(_e){}
  return { ready:true, productsTotalUZS: built.totalUZS, deliveryFeeUZS: fee, totalWithDeliveryUZS: totalWithDelivery, quote };
}

function omRenderDeliveryEstimate(){
  const box = document.getElementById("deliveryEstimateBox");
  const content = document.getElementById("deliveryEstimateContent");
  if(!box || !content) return;
  const method = typeof getDeliveryMethod === "function" ? getDeliveryMethod() : "pickup";
  if(method !== "delivery"){
    box.hidden = true;
    omDeliveryQuote = null;
    return;
  }
  box.hidden = false;
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  if(!built || !built.ok){
    content.innerHTML = `<div class="omDeliveryWarn">Hisoblash uchun savatda tanlangan mahsulot bo‘lishi kerak.</div>`;
    omDeliveryQuote = null;
    return;
  }
  const weightKg = Number(built.totalWeightKg || 0);
  if(!omDeliveryLocation){
    const saved = omBestSavedAddress();
    const loc = omLocationFromSavedAddress(saved);
    if(loc){
      omDeliveryLocation = loc;
      const sel = document.getElementById("savedDeliveryAddressSelect");
      if(sel && saved?.id) sel.value = String(saved.id);
    }
  }
  if(!omDeliveryLocation){
    const free = omFreeDeliveryInfo(built.totalUZS, null, weightKg);
    content.innerHTML = `
      <div class="omDeliveryCalcGrid">
        <div class="omDeliveryCalcCell"><div class="k">Tanlangan summa</div><div class="v">${moneyUZS(built.totalUZS)}</div></div>
        <div class="omDeliveryCalcCell"><div class="k">Umumiy vazn</div><div class="v">${omFormatKg(weightKg)}</div></div>
      </div>
      <div class="omDeliveryWarn">Aniq kuryer masofasi uchun “Avto aniqlash”ni bosing. ${free ? (free.reached ? `${free.service} bepul yetkazish limiti taxminan bajarilgan.` : `${free.service} bo‘yicha bepul yetkazishgacha taxminan ${moneyUZS(free.remaining)} qoldi.`) : ""}</div>
    `;
    omDeliveryQuote = null;
    return;
  }
  omDeliveryQuote = omBuildDeliveryQuote(built.totalUZS, weightKg, omDeliveryLocation);
  const rec = omDeliveryQuote.recommended;
  const dist = omDeliveryQuote.distanceKm;
  const optHtml = (omDeliveryQuote.options||[]).map(o=>{
    const k = o.service === "courier" ? `${o.billedKm || 0} km` : `${o.billedKg || 1} kg`;
    const free = o.isFree ? "Bepul" : moneyUZS(o.feeUZS);
    return `<div class="omDeliveryCalcCell"><div class="k">${o.label} • ${k}</div><div class="v">${free}</div></div>`;
  }).join("");
  const freeInfo = omFreeDeliveryInfo(built.totalUZS, omDeliveryQuote, weightKg);
  const freeDetail = freeInfo ? (freeInfo.source === "courier" && freeInfo.distanceKm != null ? ` (${Number(freeInfo.distanceKm).toFixed(1)} km zona)` : (freeInfo.source === "uzpost" ? ` (${freeInfo.billedKg || 1} kg UzPost)` : "")) : "";
  const freeText = freeInfo ? (freeInfo.reached ? `${freeInfo.service} bepul yetkazish limiti bajarildi${freeDetail}.` : `${freeInfo.service} bepul yetkazishgacha ${moneyUZS(freeInfo.remaining)} qoldi${freeDetail}.`) : "Bepul limit yo‘q.";
  content.innerHTML = `
    <div class="omDeliveryCalcGrid">
      <div class="omDeliveryCalcCell"><div class="k">Do‘kondan masofa</div><div class="v">${dist == null ? "—" : dist.toFixed(1) + " km"}</div></div>
      <div class="omDeliveryCalcCell"><div class="k">Umumiy vazn</div><div class="v">${omFormatKg(weightKg)}</div></div>
      <div class="omDeliveryCalcCell"><div class="k">Mahsulotlar jami</div><div class="v">${moneyUZS(built.totalUZS)}</div></div>
      <div class="omDeliveryCalcCell"><div class="k">Yetkazish bilan</div><div class="v">${moneyUZS(omDeliveryQuote.totalWithDeliveryUZS)}</div></div>
      ${optHtml}
    </div>
    <div class="omDeliveryRecommend">Tavsiya: ${rec ? rec.label : "Operator bilan kelishiladi"} — ${rec ? (rec.isFree ? "Bepul" : moneyUZS(rec.feeUZS)) : "—"}<small>${rec ? `${rec.etaText}. ${freeText}` : "Manzilni aniqlang."}</small></div>
  `;
}

// Accept numbers or strings like: "349 000", "349,000 so'm", "349000 UZS"
function parsePrice(v){
  if(typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = (v ?? "").toString();
  // Keep digits only
  const digits = s.replace(/[^0-9]/g, "");
  if(!digits) return 0;
  // Guard against extremely large values (accidental)
  const n = parseInt(digits.slice(0, 12), 10);
  return Number.isFinite(n) ? n : 0;
}
function norm(s){ return (s ?? "").toString().toLowerCase().trim(); }

// Variant pricing support
function getVariantPricing(p, sel){
  const color = (sel?.color ?? "").toString() || null;
  const size  = (sel?.size  ?? "").toString() || null;

  const base = {
    price: parsePrice(p.price),
    oldPrice: parsePrice(p.oldPrice),
    installmentText: (p.installmentText ?? "").toString()
  };

  // New optimized format: variants: [{color, size, price, oldPrice?, installmentText?}]
  if(Array.isArray(p.variants) && p.variants.length){
    const pick = (c,s)=> p.variants.find(v=>
      (v?.color ?? null) === (c ?? null) &&
      (v?.size  ?? null) === (s ?? null)
    );
    const v =
      pick(color, size) ||
      pick(color, null) ||
      pick(null, size) ||
      null;

    if(v){
      if(v.price != null) base.price = parsePrice(v.price);
      if(v.oldPrice != null) base.oldPrice = parsePrice(v.oldPrice);
      if(v.installmentText != null) base.installmentText = (v.installmentText||"").toString();
    }
  }

  // Backward compatibility: variantPrices map (old)
  const vp = (p.variantPrices || p.pricesByVariant || p.pricingByVariant || null);
  if(vp && typeof vp === "object"){
    const keys = [
      `${color||""}|${size||""}`,
      `${color||""}|`,
      `|${size||""}`,
      color||"",
      size||""
    ].filter(k=>k && k !== "|");
    for(const k of keys){
      if(Object.prototype.hasOwnProperty.call(vp, k)){
        const v = vp[k];
        if(typeof v === "number" || typeof v === "string"){
          base.price = parsePrice(v);
        } else if(v && typeof v === "object"){
          if(v.price != null) base.price = parsePrice(v.price);
          if(v.oldPrice != null) base.oldPrice = parsePrice(v.oldPrice);
          if(v.installmentText != null) base.installmentText = v.installmentText.toString();
        }
        break;
      }
    }
  }
  return base;
}

function minVariantPrice(p){
  let min = parsePrice(p.price);

  // new optimized
  if(Array.isArray(p.variants) && p.variants.length){
    for(const v of p.variants){
      const n = parsePrice((v && typeof v === "object") ? v.price : v);
      if(n>0) min = Math.min(min||n, n);
    }
  }

  // old map (backward)
  const vp = (p.variantPrices || p.pricesByVariant || p.pricingByVariant || null);
  if(vp && typeof vp === "object"){
    for(const v of Object.values(vp)){
      const n = (v && typeof v === "object") ? parsePrice(v.price) : parsePrice(v);
      if(n>0) min = Math.min(min||n, n);
    }
  }
  return min || 0;
}

function updateCardPricing(cardEl, p, sel){
  const pr = getVariantPricing(p, sel);
  const nowEl = cardEl.querySelector(".ppriceNow");
  const oldEl = cardEl.querySelector(".ppriceOld");
  const instEl = cardEl.querySelector(".pinstall");

  if(nowEl) nowEl.textContent = moneyUZS(pr.price || 0);

  if(oldEl){
    if(pr.oldPrice && pr.oldPrice > (pr.price||0)){
      oldEl.textContent = moneyUZS(pr.oldPrice);
      oldEl.style.display = "";
    } else {
      oldEl.style.display = "none";
    }
  }

  if(instEl){
    if(pr.installmentText){
      instEl.textContent = pr.installmentText;
      instEl.style.display = "";
    } else {
      instEl.style.display = "none";
    }
  }
}


function buildTagCounts(){
  tagCounts = new Map();
  for(const p of products){
    for(const t of (p.tags || [])){
      const key = String(t).toLowerCase();
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    }
  }
}

function titleTag(t){
  // keep original style: capitalize first letter, keep rest
  const s = String(t);
  return s.length ? (s[0].toUpperCase() + s.slice(1)) : s;
}


function setSelectedTag(tag){
  selectedTag = tag || "all";
  if(selectedTag !== "all"){
    activeCatPath = [];
    appliedCatPath = [];
    if(els?.q) els.q.value = "";
  }
  applyFilterSort();
}


/* ===== Professional category catalog (no longer tag-based) ===== */
let OM_CATEGORY_CATALOG = [
  {id:"beauty", name:"Go‘zallik va parvarish", ru:"Красота и уход", icon:"fa-sparkles", keywords:["kosmetik","beauty","go‘zallik","go'zallik","parvarish","bioaqua"], children:[
    {id:"skincare", name:"Yuz parvarishi", ru:"Уход за лицом", icon:"fa-face-smile", keywords:["yuz","face","крем","krem","niqob","mask","маска","aloe","aloe vera","rice","guruch","serum","sovun","soap"]},
    {id:"haircare", name:"Soch parvarishi", ru:"Уход за волосами", icon:"fa-scissors", keywords:["soch","hair","волос","shampun","shampoo","balzam","conditioner","taroq","head","maska dlya volos","raw pulp"]},
    {id:"bodycare", name:"Tana parvarishi", ru:"Уход за телом", icon:"fa-spa", keywords:["tana","body","massaj","massage","cho‘tka","cho'tka","brush","scrub","spong","sponge","gubka"]},
    {id:"depilation", name:"Depilyatsiya", ru:"Депиляция", icon:"fa-wand-magic-sparkles", keywords:["depilyatsiya","депиляция","wax","воск","hot wax","mum","granula","spatula","shugaring"]},
    {id:"perfume", name:"Atirlar", ru:"Парфюмерия", icon:"fa-spray-can-sparkles", keywords:["atir","parfum","perfume","duhi","духи","aroma","fragrance","creed","aventus"]},
    {id:"beauty-tools", name:"Kosmetik aksessuarlar", ru:"Косметические аксессуары", icon:"fa-brush", keywords:["aksessuar","accessory","cho'p","cho‘p","spatula","applikator","brush","щетка","silikon","plastik"]}
  ]},
  {id:"electronics", name:"Elektronika", ru:"Электроника", icon:"fa-mobile-screen", keywords:["telefon","phone","elektron","gadget"], children:[
    {id:"phones", name:"Telefonlar", ru:"Телефоны", icon:"fa-mobile-screen-button", keywords:["telefon","smartfon","iphone","samsung","xiaomi","redmi"]},
    {id:"phone-accessories", name:"Telefon aksessuarlari", ru:"Аксессуары для телефонов", icon:"fa-plug", keywords:["charger","zaryad","quvvatlagich","adapter","case","chexol","kabel","powerbank","usb"]},
    {id:"audio", name:"Audio", ru:"Аудио", icon:"fa-headphones", keywords:["naushnik","tws","bluetooth","earphone","speaker","kolonka","audio"]},
    {id:"smart-devices", name:"Smart qurilmalar", ru:"Смарт-устройства", icon:"fa-watch-smart", keywords:["smart watch","soat","watch","kamera","camera"]}
  ]},
  {id:"home", name:"Uy-ro‘zg‘or", ru:"Дом и быт", icon:"fa-house", keywords:["uy","home","oshxona","kitchen"], children:[
    {id:"kitchen", name:"Oshxona", ru:"Кухня", icon:"fa-kitchen-set", keywords:["oshxona","kitchen","pichoq","idish","termos","blender","choynak"]},
    {id:"cleaning", name:"Tozalash", ru:"Уборка", icon:"fa-broom", keywords:["tozalash","clean","mop","supurgi","salfetka"]},
    {id:"storage", name:"Saqlash va tartib", ru:"Хранение", icon:"fa-box-archive", keywords:["organizer","saqlash","box","quti","polka"]},
    {id:"home-decor", name:"Dekor", ru:"Декор", icon:"fa-couch", keywords:["dekor","lamp","chiroq","gilam","parda"]}
  ]},
  {id:"fashion", name:"Kiyim va aksessuarlar", ru:"Одежда и аксессуары", icon:"fa-shirt", keywords:["kiyim","fashion","clothes"], children:[
    {id:"women-fashion", name:"Ayollar uchun", ru:"Для женщин", icon:"fa-person-dress", keywords:["ayol","women","dress","ko‘ylak","sumka","bijuteriya"]},
    {id:"men-fashion", name:"Erkaklar uchun", ru:"Для мужчин", icon:"fa-user-tie", keywords:["erkak","men","futbolka","shim","remень","soat"]},
    {id:"bags", name:"Sumka va hamyonlar", ru:"Сумки и кошельки", icon:"fa-bag-shopping", keywords:["sumka","bag","hamyon","wallet","ryukzak"]},
    {id:"jewelry", name:"Bijuteriya", ru:"Бижутерия", icon:"fa-gem", keywords:["uzuk","zirak","taqinchoq","jewelry","bijuteriya"]}
  ]},
  {id:"health", name:"Sog‘liq va gigiyena", ru:"Здоровье и гигиена", icon:"fa-heart-pulse", keywords:["sog‘liq","sogliq","health","gigiyena"], children:[
    {id:"hygiene", name:"Gigiyena", ru:"Гигиена", icon:"fa-hands-bubbles", keywords:["gigiyena","hygiene","sovun","soap","antiseptik","tish","tooth"]},
    {id:"wellness", name:"Wellness", ru:"Wellness", icon:"fa-leaf", keywords:["wellness","massaj","relax","vitamin"]}
  ]},
  {id:"kids", name:"Bolalar tovarlari", ru:"Детские товары", icon:"fa-child", keywords:["bola","baby","kids"], children:[
    {id:"kids-care", name:"Bolalar parvarishi", ru:"Уход за детьми", icon:"fa-baby", keywords:["baby","chaqaloq","pampers","bolalar"]},
    {id:"toys", name:"O‘yinchoqlar", ru:"Игрушки", icon:"fa-puzzle-piece", keywords:["toy","o‘yinchoq","oyinchoq","puzzle","lego"]}
  ]},
  {id:"other", name:"Boshqa mahsulotlar", ru:"Другие товары", icon:"fa-box-open", keywords:[], children:[
    {id:"other-products", name:"Turli mahsulotlar", ru:"Разные товары", icon:"fa-layer-group", keywords:[]}
  ]}
];

const OM_CATEGORY_STORAGE_KEY = "orzumall_admin_categories_v13";
let __omCategoryCatalogLoaded = false;
function omNormalizeCategoryTree(tree){
  const clean=(arr)=>{
    if(!Array.isArray(arr)) return [];
    return arr.map((raw,idx)=>{
      const name=String(raw?.name||raw?.ru||`Kategoriya ${idx+1}`).trim();
      const id=String(raw?.id||name).trim().toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,"-").replace(/[^a-z0-9а-яёўғқҳ'\-]+/gi,"-").replace(/^-+|-+$/g,"") || `category-${idx+1}`;
      return {
        id,
        name,
        ru:String(raw?.ru||"").trim(),
        icon:String(raw?.icon||"fa-layer-group").replace(/^fa-solid\s+/,"").trim() || "fa-layer-group",
        iconImage:String(raw?.iconImage || raw?.iconUrl || raw?.image || raw?.svg || "").trim(),
        keywords:Array.isArray(raw?.keywords) ? raw.keywords.map(x=>String(x).trim()).filter(Boolean) : String(raw?.keywords||"").split(",").map(x=>x.trim()).filter(Boolean),
        children: clean(raw?.children||[])
      };
    }).filter(x=>x.name);
  };
  const out=clean(tree);
  return out.length ? out : OM_CATEGORY_CATALOG;
}
function omSetCategoryCatalog(tree){
  OM_CATEGORY_CATALOG = omNormalizeCategoryTree(tree);
  try{ delete window.__omCategoryFlat; }catch(e){ window.__omCategoryFlat = null; }
}
async function omLoadCategoryCatalog(force=false){
  if(__omCategoryCatalogLoaded && !force) return OM_CATEGORY_CATALOG;
  __omCategoryCatalogLoaded = true;
  let loaded = null;
  try{
    const snap = await getDoc(doc(db, "configs", "categories"));
    if(snap.exists()){
      const d=snap.data()||{};
      loaded = Array.isArray(d.tree) ? d.tree : (Array.isArray(d.categories) ? d.categories : null);
    }
  }catch(e){}
  if(!loaded){
    try{ loaded = JSON.parse(localStorage.getItem(OM_CATEGORY_STORAGE_KEY)||"null"); }catch(e){}
  }
  if(loaded) omSetCategoryCatalog(loaded);
  return OM_CATEGORY_CATALOG;
}

function omCatNorm(v){ return String(v||"").trim().toLowerCase().replace(/[’']/g,"'").replace(/\s+/g," "); }
function omCatSlug(v){ return omCatNorm(v).replace(/[^a-z0-9а-яёўғқҳ‘'\-]+/gi,"-").replace(/^-+|-+$/g,""); }
function omCategoryLangName(def){ return omLang()==="ru" ? (def?.ru || def?.name || def?.id || "") : (def?.name || def?.ru || def?.id || ""); }
function omCategoryFlat(){
  if(window.__omCategoryFlat) return window.__omCategoryFlat;
  const flat = new Map();
  const byName = new Map();
  const walk=(arr,parent=null,path=[])=>{
    (arr||[]).forEach(def=>{
      const item={...def,parentId:parent?.id||null,pathIds:[...path,def.id]};
      flat.set(def.id,item);
      [def.id,def.name,def.ru].filter(Boolean).forEach(x=>byName.set(omCatSlug(x), item));
      walk(def.children||[], item, item.pathIds);
    });
  };
  walk(OM_CATEGORY_CATALOG);
  window.__omCategoryFlat={flat,byName};
  return window.__omCategoryFlat;
}
function omGetCategoryDef(idOrName){
  const {flat,byName}=omCategoryFlat();
  const k=String(idOrName||"").trim();
  return flat.get(k) || byName.get(omCatSlug(k)) || null;
}
function omExplicitProductCategoryPath(p){
  if(!p) return [];
  const pathArr = p.categoryPathIds || p.categoryIds || p.categoryPathId;
  if(Array.isArray(pathArr) && pathArr.length){
    const ids = pathArr.map(x=>omGetCategoryDef(x)?.id).filter(Boolean);
    if(ids.length) return ids;
  }
  const catRaw = p.categoryId || p.mainCategoryId || p.categorySlug || p.category;
  const subRaw = p.subcategoryId || p.subCategoryId || p.subcategorySlug || p.subcategory;
  const cat = omGetCategoryDef(catRaw);
  const sub = omGetCategoryDef(subRaw);
  if(cat && sub){
    if(sub.parentId === cat.id) return [cat.id, sub.id];
    if(cat.parentId) return cat.pathIds;
    return [cat.id];
  }
  if(sub) return sub.pathIds;
  if(cat) return cat.pathIds;
  const names = p.categoryPath || p.categories;
  if(Array.isArray(names) && names.length){
    const ids = names.map(x=>omGetCategoryDef(x)?.id).filter(Boolean);
    if(ids.length) return ids;
  }
  return [];
}
function omProductCategoryPathIds(p){ return omInferCategoryPath(p); }
function omProductCategoryLabel(p){
  const ids=omProductCategoryPathIds(p);
  return ids.map(id=>omCategoryLangName(omGetCategoryDef(id))).filter(Boolean).join(" / ") || omTrText("Boshqa mahsulotlar");
}


/* ===== Categories from professional catalog (nested) ===== */
let catTree = null;

function normalizeTag(t){
  return String(t||"").trim().toLowerCase();
}

function buildCategoryTree(){
  const root = { id:"root", name:"root", count:0, children:new Map() };
  const addDef=(def,parent)=>{
    const node = { id:def.id, key:def.id, name:def.name, ru:def.ru, icon:def.icon, iconImage:def.iconImage, count:0, children:new Map(), def };
    parent.children.set(def.id,node);
    (def.children||[]).forEach(ch=>addDef(ch,node));
    return node;
  };
  OM_CATEGORY_CATALOG.forEach(def=>addDef(def,root));
  for(const p of products || []){
    const path = omProductCategoryPathIds(p);
    if(!path.length) continue;
    root.count++;
    let node = root;
    for(const id of path){
      if(!node.children.has(id)) break;
      node = node.children.get(id);
      node.count++;
    }
  }
  catTree = root;
}

function getNodeByPath(path){
  let node = catTree;
  for(const part of (path||[])){
    if(!node || !node.children) return null;
    const def = omGetCategoryDef(part);
    const id = def?.id || String(part||"");
    node = node.children.get(id);
  }
  return node;
}

function productMatchesCategory(p, path){
  const usePath = Array.isArray(path) ? path.map(x=>omGetCategoryDef(x)?.id || String(x||"")) : [];
  if(usePath.length===0) return true;
  const prodPath = omProductCategoryPathIds(p);
  if(prodPath.length < usePath.length) return false;
  for(let i=0;i<usePath.length;i++){
    if(prodPath[i] !== usePath[i]) return false;
  }
  return true;
}



/* ===== v14 frontend category overrides: 4-level tree + PNG/SVG icon support ===== */
function omCategoryIconHtml(def){
  const img=String(def?.iconImage || def?.iconUrl || def?.image || def?.svg || "").trim();
  if(img) return `<img class="catIconImg" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">`;
  return `<i class="fa-solid ${escapeHtml(def?.icon||"fa-layer-group")}" aria-hidden="true"></i>`;
}
function omInferCategoryPath(p){
  const explicit = omExplicitProductCategoryPath(p);
  if(explicit.length) return explicit;
  const hay = [p?.name,p?.name_ru,p?.name_en,p?.description,p?.description_ru,p?.productType,p?.fulfillmentType,...(Array.isArray(p?.tags)?p.tags:[])].filter(Boolean).join(" ").toLowerCase();
  let best=null;
  const scoreDef=(def)=>{ let score=0; for(const kw of (def.keywords||[])){ const k=String(kw).toLowerCase(); if(k && hay.includes(k)) score += k.length>6 ? 3 : 2; } return score; };
  const walk=(arr,path=[],carry=0)=>{ (arr||[]).forEach(def=>{ const next=[...path,def.id]; const sc=carry+scoreDef(def); if(sc && (!best || sc>best.score || (sc===best.score && next.length>best.path.length))) best={score:sc,path:next}; walk(def.children||[], next, sc); }); };
  walk(OM_CATEGORY_CATALOG, [], 0);
  return best?.path || [omGetCategoryDef("other")?.id, omGetCategoryDef("other-products")?.id].filter(Boolean);
}
function renderCategoriesPage(){
  if(!els.catList || !els.catCrumbs) return;
  buildCategoryTree();
  const node = getNodeByPath(activeCatPath) || catTree;
  els.catCrumbs.innerHTML = "";
  const homeCr = document.createElement("button");
  homeCr.className = "crumb"; homeCr.type = "button"; homeCr.textContent = omTrText("Barchasi");
  homeCr.addEventListener("click", ()=>{ activeCatPath = []; renderCategoriesPage(); });
  els.catCrumbs.appendChild(homeCr);
  let acc=[];
  for(const part of (activeCatPath||[])){
    const def=omGetCategoryDef(part); const id=def?.id||part; acc.push(id);
    const b=document.createElement("button"); b.className="crumb"; b.type="button"; b.textContent=omCategoryLangName(def)||omTrText(part);
    const snap=acc.slice(); b.addEventListener("click",()=>{activeCatPath=snap; renderCategoriesPage();}); els.catCrumbs.appendChild(b);
  }
  const children = Array.from((node?.children || new Map()).values()).sort((a,b)=> (b.count||0)-(a.count||0) || String(omCategoryLangName(a)).localeCompare(String(omCategoryLangName(b)), omLang()==="ru"?"ru":"uz"));
  els.catList.innerHTML=""; if(els.catEmpty) els.catEmpty.hidden = children.length !== 0;
  for(const ch of children){
    const item=document.createElement("div");
    item.className="catItem" + ((ch.count||0)===0 ? " catItemEmpty" : "");
    const hasChildren=(ch.children && ch.children.size>0);
    item.innerHTML = `<div class="catName">${omCategoryIconHtml(ch)}<span>${escapeHtml(omCategoryLangName(ch))}</span></div><div class="catMeta"><div class="catCount">${omCount(ch.count||0)}</div><div class="catArrow">${hasChildren?'›':'✓'}</div></div>`;
    item.addEventListener("click",()=>{ activeCatPath=[...(activeCatPath||[]), ch.id]; renderCategoriesPage(); });
    els.catList.appendChild(item);
  }
  omI18nRefresh(80);
}

function applyFilterSort(){
  const query = norm(els.q.value);
  let arr = [...products];

  if(viewMode === "fav"){
    arr = arr.filter(p=>favs.has(p.id));
  }

  // Mobile nested category filter (prefix match)
  if(Array.isArray(appliedCatPath) && appliedCatPath.length>0){
    arr = arr.filter(p=>productMatchesCategory(p, appliedCatPath));
  }

  // Tag filter: teg ustiga bosilganda shu tegdagi barcha mahsulotlar chiqadi.
  if(selectedTag && selectedTag !== "all"){
    const tagKey = norm(selectedTag);
    arr = arr.filter(p=>{
      const tags = [...(Array.isArray(p.tags) ? p.tags : []), ...omProductTags(p)].map(x=>norm(x));
      return tags.includes(tagKey);
    });
  }

  if(query){
    arr = arr.filter(p=>{
      const hay = `${p.name||""} ${p.name_ru||""} ${omProductText(p, "name", p.name||"")} ${p.sku||p.article||""} ${p.sellerName||""} ${omProductCategoryLabel(p)} ${(p.tags||[]).join(" ")} ${omProductTags(p).join(" ")} ${p.description||""} ${p.description_ru||""}`.toLowerCase();
      return hay.includes(query);
    });
  }

  omScheduleStoreSearch(query);
  omScheduleProductSearch(query);

  const sort = els.sort.value;
  if(sort === "price_asc") arr.sort((a,b)=>(a._price||0)-(b._price||0));
  if(sort === "price_desc") arr.sort((a,b)=>(b._price||0)-(a._price||0));
  if(sort === "new") arr.sort((a,b)=> (b._created||0) - (a._created||0));
  if(sort === "popular") arr.sort((a,b)=>omGetProductMetrics(b).score-omGetProductMetrics(a).score);

  render(arr);
}


function renderOptions(p){
  const colors = normColors(p);
  const sizes = normSizes(p);
  if(colors.length===0 && sizes.length===0) return "";
  const sel = getSel(p);

  const sw = colors.length ? `
    <div class="optLine swatchesLine" aria-label="Rang">
      ${colors.map(c=>{
        const active = (sel.color===c.name) ? "active" : "";
        const style = c.hex ? `style="--c:${c.hex}"` : "";
        return `<button class="swatch ${active}" ${style} data-c="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}"></button>`;
      }).join("")}
    </div>` : "";

  const sz = sizes.length ? `
    <div class="optLine sizesLine" aria-label="O'lcham">
      ${sizes.map(s=>{
        const active = (sel.size===s) ? "active" : "";
        return `<button class="sizeChip ${active}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
      }).join("")}
    </div>` : "";

  return `<div class="optStack">${sw}${sz}</div>`;
}

function _normPType(p){
  const t = (p?.pType || p?.fulfillmentType || p?.type || "stock");
  return String(t).toLowerCase() === "cargo" ? "cargo" : "stock";
}
function getDeliveryInfo(p){
  const type = _normPType(p);
  const min = (p?.deliveryMinDays ?? p?.deliveryMin ?? (type==="cargo" ? 7 : 1));
  const max = (p?.deliveryMaxDays ?? p?.deliveryMax ?? (type==="cargo" ? 14 : 7));
  return { type, min, max };
}
function omDeliveryDateRange(p){
  const d=getDeliveryInfo(p),today=new Date(),min=Math.max(0,Number(d.min)||0),max=Math.max(min,Number(d.max)||min);
  const add=n=>{const x=new Date(today);x.setDate(x.getDate()+n);return x};
  const fmt=x=>{try{return new Intl.DateTimeFormat(omLang()==="ru"?"ru-RU":"uz-UZ",{day:"numeric",month:"short"}).format(x)}catch(_){return `${x.getDate()}.${x.getMonth()+1}`}};
  const a=fmt(add(min)),b=fmt(add(max));
  return min===max?a:`${a} – ${b}`;
}
function renderDeliveryBadge(p){
  const d = getDeliveryInfo(p);
  const cls = d.type === "cargo" ? "shipBadge cargo" : "shipBadge stock";
  const flagSrc = d.type === "cargo" ? "assets/flags/cn-48.webp" : "assets/flags/uz-48.webp";
  const flagAlt = d.type === "cargo" ? "CN" : "UZ";
  const dayWord = omLang()==="ru" ? "дн." : (omLang()==="en" ? "days" : "kun");
  return `<span class="${cls}"><img class="omFlag" src="${flagSrc}" alt="${flagAlt}" loading="lazy" decoding="async"><span class="omTruck">🚚</span><span class="cxDeliveryDate">${escapeHtml(omDeliveryDateRange(p))}</span><small>${d.min}–${d.max} ${dayWord}</small></span>`;
}

function getProductType(p){
  const t = String(p?.productType || p?.authType || "").toLowerCase().trim();
  if(!t) return "";
  if(["original","org","brand"].includes(t)) return "original";
  if(["oem","factory"].includes(t)) return "oem";
  if(["replica","copy","nusxa","fake"].includes(t)) return "replica";
  return t;
}
function omProductTypeIconSrc(type){
  const t = String(type || "").toLowerCase().trim();
  if(t === "original") return "./assets/auth-original-96.webp";
  if(t === "oem") return "./assets/auth-oem-96.webp";
  if(t === "replica") return "./assets/auth-copy-96.webp";
  return "";
}
function omProductTypeLabel(type){
  const t = String(type || "").toLowerCase().trim();
  // Customer-friendly labels
  if(t === "original") return "Original";
  if(t === "oem") return "Zavod mahsuloti";
  if(t === "replica") return "Nusxa";
  return omTrText(t || "Mahsulot turi");
}
function renderProductTypeBadge(p){
  const t = getProductType(p);
  if(!t) return "";
  const label = escapeHtml(omProductTypeLabel(t));
  const iconSrc = omProductTypeIconSrc(t);
  const icon = iconSrc ? `<img class="authBadgeImg" src="${iconSrc}" alt="${label}" loading="lazy" decoding="async">` : `<i class="fa-solid fa-tag" aria-hidden="true"></i>`;
  return `<span class="authBadge ${escapeHtml(t)}" title="${label}">${icon}<span>${label}</span></span>`;
}

function omIsOrzuMallVerifiedProduct(p){
  if(p?.isOrzuMallVerified === true) return true;
  if(p?.isOrzuMallVerified === false) return false;
  const ownerType=String(p?.ownerType||"").toLowerCase().trim();
  const createdBy=String(p?.createdByRole||"").toLowerCase().trim();
  const sellerId=String(p?.sellerId||"").toLowerCase().trim();
  if(ownerType==="orzumall" || createdBy==="admin" || sellerId==="orzumall") return true;
  // Legacy admin products did not have ownership fields.
  return !(p?.sellerId || p?.ownerUid || p?.ownerEmail);
}
function renderOrzuMallVerifiedBadge(p,{full=false}={}){
  if(!omIsOrzuMallVerifiedProduct(p)) return "";
  return full
    ? `<span class="omVerifiedFull" title="OrzuMall rasmiy mahsuloti"><i class="fa-solid fa-circle-check"></i><span>OrzuMall Rasmiy</span></span>`
    : `<span class="omVerifiedIcon" title="OrzuMall Rasmiy" aria-label="OrzuMall Rasmiy"><i class="fa-solid fa-circle-check"></i></span>`;
}
function renderSellerMiniLine(p,{page=false}={}){
  if(omIsOrzuMallVerifiedProduct(p)) return page ? renderOrzuMallVerifiedBadge(p,{full:true}) : "";
  const sellerId=String(p?.sellerId||"").trim();
  const name=String(p?.sellerName||"").trim();
  if(!name || !sellerId) return "";
  const logo=String(p?.sellerLogo||"").trim();
  const score=Math.max(0,Math.round(Number(p?.sellerPopularity||0)||0));
  const logoHtml=logo?`<img src="${escapeHtml(logo)}" alt="" loading="lazy" decoding="async">`:`<i class="fa-solid fa-store"></i>`;
  return `<button type="button" class="${page?"ppSellerLine":"pcardSellerLine"}" data-store-id="${escapeHtml(sellerId)}" title="${escapeHtml(name)} do‘konini ochish">${logoHtml}<b>${escapeHtml(name)}</b>${p?.sellerVerified!==false?`<i class="fa-solid fa-circle-check" title="OrzuMall tasdiqlagan do‘kon"></i>`:""}${score?`<em><i class="fa-solid fa-fire"></i>${omCompactMetric(score)}</em>`:""}</button>`;
}

function discountPct(price, oldPrice){
  const p = Number(price||0), o = Number(oldPrice||0);
  if(!o || o <= p) return 0;
  return Math.round((1 - (p/o)) * 100);
}


// Inject minimal CSS for PNG flags (safe even if styles.css differs)
(function(){
  try{
    const id="om_flag_css";
    if(document.getElementById(id)) return;
    const st=document.createElement("style");
    st.id=id;
    st.textContent=`.shipBadge{display:inline-flex;align-items:center;gap:6px}.shipBadge .omFlag{width:16px;height:16px;border-radius:999px;flex:0 0 16px;object-fit:cover;box-shadow:0 0 0 1px rgba(0,0,0,.06) inset}.shipBadge .omTruck{line-height:1}@media(max-width:520px){.shipBadge{gap:5px}.shipBadge .omFlag{width:14px;height:14px;flex-basis:14px}}`;
    document.head.appendChild(st);
  }catch(e){}
})();



/* =========================
   Native Ads (Product list orasida)
   - Asabga tegmaydigan: ehtimollik + session limit
   - Har N ta mahsulotdan keyin 1 ta reklama
========================= */
const NATIVE_ADS = {
  enabled: true,
  every: 4,           // 6 ta mahsulot bo'lsa ham ko'rinsin
  probability: 1.0,   // doim chiqadi
  maxPerSession: 9999, // cheklov yo‘q (deyarli)
};

const ADS_LIST = [
  "ads/ad1-512.webp",
  "ads/ad2-512.webp",
  "ads/ad3-512.webp",
  "ads/ad4-512.webp"
];

let __lastAd = null;
function __nativeAdsShown(){
  return Number(sessionStorage.getItem("nativeAdsShown") || "0") || 0;
}
function __incNativeAdsShown(){
  const n = __nativeAdsShown() + 1;
  sessionStorage.setItem("nativeAdsShown", String(n));
  return n;
}
function canShowNativeAd(){
  try{
    if(!NATIVE_ADS.enabled) return false;
    if(__nativeAdsShown() >= NATIVE_ADS.maxPerSession) return false;
    if(Math.random() >= NATIVE_ADS.probability) return false;
    return true;
  }catch(e){
    return false;
  }
}
function pickAdSrc(){
  try{
    if(!ADS_LIST.length) return null;
    let src = ADS_LIST[Math.floor(Math.random() * ADS_LIST.length)];
    // ketma-ket bir xil chiqmasin
    if(__lastAd && ADS_LIST.length > 1){
      let guard = 0;
      while(src === __lastAd && guard++ < 8){
        src = ADS_LIST[Math.floor(Math.random() * ADS_LIST.length)];
      }
    }
    __lastAd = src;
    return src;
  }catch(e){
    return null;
  }
}
function createNativeAdCard(){
  const src = pickAdSrc();
  if(!src) return null;

  const card = document.createElement("div");
  card.className = "pcard adCard";
  card.setAttribute("data-kind", "native-ad");
  card.innerHTML = `
    <img class="adImg" src="${src}" alt="Reklama" loading="lazy" decoding="async" />
  `;

  card.addEventListener("click", ()=>{
    openImageZoom(src);
  });

  return card;
}


function omProductPowerMiniHtml(p){
  const m = omGetProductMetrics(p);
  const views = omCompactMetric(m.views || 0);
  const score = omCompactMetric(m.score || 0);
  return `<span title="Ko‘rishlar"><i class="fa-regular fa-eye"></i> ${views}</span><span title="Popular ball"><i class="fa-solid fa-fire"></i> ${score}</span>`;
}

function render(arr){
  els.grid.innerHTML = "";
  if (els.productsCount) {
    const n = Array.isArray(arr) ? arr.length : 0;
    els.productsCount.textContent = omCount(n);
  }
  omStoreSearchState.lastProductCount = Array.isArray(arr) ? arr.length : 0;
  omSyncSearchEmptyState();

  let __i = 0;
  for(const p of arr){
    const card = document.createElement("div");
    card.className = "pcard";

    const isFav = favs.has(p.id);

    const sel = getSel(p);
    const currentImg = getCurrentImage(p, sel);

const prCard = getVariantPricing(p, sel);
const dp = discountPct(prCard.price, prCard.oldPrice);
// Admin badges: badges[] (preferred) or badge string (legacy)
const adminBadges = Array.isArray(p.badges) ? p.badges : (p.badge ? [p.badge] : []);
const badgeHtmlParts = [];

if(dp > 0) badgeHtmlParts.push(`<div class="pbadge discount">-${dp}%</div>`);
// show up to 3 admin badges (skip if looks like a percent discount we already show)
for(const b of adminBadges.slice(0,3)){
  const t = String(b||"").trim();
  if(!t) continue;
  if(/^-?\d+\s*%$/.test(t)) continue;
  badgeHtmlParts.push(`<div class="pbadge meta">${escapeHtml(omTrText(t))}</div>`);
}
// Prepay badge moved to cart (not shown on cards)

const badgeHTML = badgeHtmlParts.length ? `<div class="pbadgeStack">${badgeHtmlParts.join("")}</div>` : "";
const authHTML = renderProductTypeBadge(p);
const sellerMiniHTML = renderSellerMiniLine(p);

    const st = getStats(p.id);
    const showAvg = st.count ? st.avg : 0;
    const showCount = st.count ? st.count : 0;

    card.innerHTML = `
      <div class="pmedia">
        <img class="pimg" src="${currentImg || ""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" loading="lazy" decoding="async"/>
        ${badgeHTML}
        ${authHTML?`<div class="authOnImg">${authHTML}</div>`:""}
        <button class="favBtn ${isFav ? "active" : ""}" title="Sevimli" aria-label="Sevimli" aria-pressed="${isFav ? "true" : "false"}"><i class="fa-${isFav ? "solid" : "regular"} fa-heart" aria-hidden="true"></i></button>
      </div>

      <div class="pbody uz">
        <div class="ppriceRow">
          <div class="ppriceNow">${moneyUZS(getVariantPricing(p, sel).price || 0)}</div>
          <div class="ppriceOld" style="display:none"></div>
        </div>

        <div class="pinstall" style="display:none"></div>

        <div class="pname clamp2">${escapeHtml(omProductText(p, "name", p.name || "Nomsiz"))}</div>
        ${sellerMiniHTML}
        ${showCount ? `<div class="pratingInline compact"><i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(showAvg).toFixed(1)} <span>(${showCount})</span></div>` : ""}
        <div class="omPowerRow">${omProductPowerMiniHtml(p)}</div>

        <div class="pcardFoot">
          <div class="pship compact">${renderDeliveryBadge(p)}</div>
          <button class="iconPill primary cartOnly" data-act="cart" title="Savatchaga" aria-label="Savatchaga">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.17 14h9.66c.75 0 1.4-.41 1.74-1.03L21 6H6.21L5.27 4H2v2h2l3.6 7.59-1.35 2.44C5.52 17.37 6.48 19 8 19h12v-2H8l1.17-3Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Apply dynamic pricing for current selection
    updateCardPricing(card, p, sel);

    const favBtn = card.querySelector(".favBtn");
    favBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(favs.has(p.id)) { favs.delete(p.id); } else { favs.add(p.id); logEvent('favorite', p.id); }
      saveLS(LS.favs, Array.from(favs));
      const on = favs.has(p.id);
      favBtn.classList.toggle("active", on);
      favBtn.innerHTML = `<i class="fa-${on ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>`;
      favBtn.setAttribute("aria-pressed", on ? "true" : "false");
      updateBadges();
      if(viewMode === "fav") applyFilterSort();
    });


    card.querySelectorAll("[data-store-id]").forEach(btn=>btn.addEventListener("click",(e)=>{
      e.preventDefault();e.stopPropagation();openStorePage(btn.getAttribute("data-store-id"));
    }));

    const imgEl = card.querySelector(".pimg");

    
const openQuickView = ()=>{
  openProductPage(p.id);
};

    // Open fullscreen viewer on image click
    imgEl.addEventListener("click", (e)=>{
      e.stopPropagation();
      openQuickView();
    });

    // Card click -> open the product quick view, except when tapping controls/buttons
    card.addEventListener("click", (e)=>{
      if(e.target.closest('button, a, input, select, textarea, .iconPill, .favBtn, .cartOnly')) return;
      openQuickView();
    });

    card.querySelector('[data-act="cart"]').addEventListener("click", ()=>{
      handleAddToCart(p, { openCartAfter: false });
    });


    card.querySelector('[data-act="info"]')?.addEventListener("click", (e)=>{
      e.stopPropagation();
      openMini("info", p.id);
    });
    card.querySelector('[data-act="video"]')?.addEventListener("click", (e)=>{
      e.stopPropagation();
      openMini("video", p.id);
    });
    card.querySelector('[data-act="reviews"]')?.addEventListener("click", (e)=>{
      e.stopPropagation();
      openMini("reviews", p.id);
    });

    els.grid.appendChild(card);

// Native banner (reklama): har N ta mahsulotdan keyin (bazan-bazan), session limit bilan
__i++;
if((__i % NATIVE_ADS.every) === 0 && canShowNativeAd()){
  const adCard = createNativeAdCard();
  if(adCard){
    els.grid.appendChild(adCard);
    __incNativeAdsShown();
  }
}

    // (variant selection is now handled in the modal on Add to Cart)

  }
// Agar mahsulot kam bo'lsa ham (N dan kam) — oxirida 1 ta native reklama (bazan-bazan)
try{
  const n = Array.isArray(arr) ? arr.length : 0;
  if(n > 0 && n < NATIVE_ADS.every && canShowNativeAd()){
    const adCard = createNativeAdCard();
    if(adCard){
      els.grid.appendChild(adCard);
      __incNativeAdsShown();
    }
  }
}catch(e){}

  omI18nProductsReady();
  omI18nRefresh(80);
  omI18nRefresh(650);
}


function addToCart(id, qty, sel){
  logEvent('add_to_cart', id);
  const key = variantKey(id, sel || {color:null,size:null});
  const p = products.find(x=>x.id===id);
  const img = p ? getCurrentImage(p, sel || getDefaultSel(p)) : null;
  const item = cart.find(x=>x.key===key);
  if(item){
    item.qty += qty;
    // keep latest selected image for this variant
    if(img) item.image = img;
  } else {
    cart.push({key, id, color: sel?.color || null, size: sel?.size || null, qty, image: img || null});
  }
  cart = cart.filter(x=>x.qty>0);
  saveLS(LS.cart, cart);
  updateBadges();
}

// ---------- World-class variant selection (opened from Add to Cart) ----------
const vState = { open:false, product:null, qty:1, sel:{color:null,size:null}, openCartAfter:false };

function productNeedsVariantModal(p){ return false; }

function normalizeSelectionForProduct(p, baseSel){
  const colors = normColors(p);
  const sizes = normSizes(p);
  const sel = { ...(baseSel || {}) };
  if(!sel.color && colors.length === 1) sel.color = colors[0].name;
  if(!sel.size && sizes.length === 1) sel.size = sizes[0];
  return { color: sel.color || null, size: sel.size || null };
}

function handleAddToCart(p, opts={}){
  // If the product has selectable variants (color/size), open the variant modal first.
  // After confirming, we ONLY show a toast (no extra confirmation/cart modal).
  const colors = normColors(p);
  const sizes = normSizes(p);
  const needsChoice = (colors.length > 1) || (sizes.length > 1);

  if(needsChoice && els.vOverlay){
    openVariantModal(p, { openCartAfter: false });
    return;
  }

  const sel = normalizeSelectionForProduct(p, getSel(p));
  addToCart(p.id, 1, sel);
  updateBadges();
  toast("Savatga qo‘shildi");
}


function openVariantModal(p, opts={}){
  if(!els.vOverlay) return;
  vState.open = true;
  vState.product = p;
  vState.openCartAfter = !!opts.openCartAfter;
  vState.qty = 1;
  vState.sel = normalizeSelectionForProduct(p, getSel(p));
  renderVariantModal();
  showOverlay(els.vOverlay);
}

function closeVariantModal(){
  if(!els.vOverlay) return;
  vState.open = false;
  vState.product = null;
  hideOverlay(els.vOverlay);
}

function renderVariantModal(){
  const p = vState.product;
  if(!p) return;
  const colors = normColors(p);
  const sizes = normSizes(p);
  const sel = vState.sel || {color:null,size:null};

  if(els.vName) els.vName.textContent = omProductText(p, "name", p.name || "—");
  const pricing = getVariantPricing(p, sel);
  if(els.vPrice) els.vPrice.textContent = moneyUZS(pricing.price || 0);
  if(els.vQty) els.vQty.textContent = String(vState.qty || 1);
  if(els.vImg){
    const img = getCurrentImage(p, sel) || getCurrentImage(p, getDefaultSel(p)) || "";
    els.vImg.src = img;
  
    // click to zoom (image only)
    els.vImg.onclick = (e)=>{
      e?.preventDefault?.();
      e?.stopPropagation?.();
      try{ e?.stopImmediatePropagation?.(); }catch(_){ }
      openImageZoom(els.vImg.src || "");
    };
  }

  const showColors = colors.length > 0;
  if(els.vColors) els.vColors.hidden = !showColors;
  if(els.vColorRow) els.vColorRow.innerHTML = showColors ? colors.map(c=>{
    const active = sel.color === c.name ? "active" : "";
    const bg = c.hex ? `style="background:${c.hex};"` : "";
    return `<button class="vSwatch ${active}" ${bg} data-c="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}" aria-label="${escapeHtml(c.name)}"></button>`;
  }).join("") : "";

  const showSizes = sizes.length > 0;
  if(els.vSizes) els.vSizes.hidden = !showSizes;
  if(els.vSizeRow) els.vSizeRow.innerHTML = showSizes ? sizes.map(s=>{
    const active = sel.size === s ? "active" : "";
    return `<button class="vChip ${active}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
  }).join("") : "";

  if(els.vColorHint) els.vColorHint.hidden = true;
  if(els.vSizeHint) els.vSizeHint.hidden = true;

  els.vColorRow?.querySelectorAll(".vSwatch").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      vState.sel.color = btn.getAttribute("data-c");
      // keep selection for future image viewer usage
      const now = getSel(p);
      now.color = vState.sel.color;
      now.imgIdx = 0;
      selected.set(p.id, now);
      renderVariantModal();
    });
  });
  els.vSizeRow?.querySelectorAll(".vChip").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      vState.sel.size = btn.getAttribute("data-s");
      const now = getSel(p);
      now.size = vState.sel.size;
      selected.set(p.id, now);
      renderVariantModal();
    });
  });
  omI18nRefresh(80);
}

function validateVariantSelection(){
  const p = vState.product;
  if(!p) return false;
  const colors = normColors(p);
  const sizes = normSizes(p);
  const sel = normalizeSelectionForProduct(p, vState.sel);
  vState.sel = sel;
  let ok = true;
  if(colors.length > 0 && !sel.color){ ok = false; if(els.vColorHint) els.vColorHint.hidden = false; }
  if(sizes.length > 0 && !sel.size){ ok = false; if(els.vSizeHint) els.vSizeHint.hidden = false; }
  return ok;
}

function cartCount(){
  return cart.reduce((s,x)=>s + (x.qty||0), 0);
}


function updateCartSelectUI(){
  if(!els.panelSelectRow || !els.selectAllBox) return;

  const isCart = (els.panelTitle?.textContent || "").trim() === "Savatcha";
  els.panelSelectRow.hidden = !(isCart && cart.length > 0);

  if(cart.length === 0) return;

  const allSel = allCartSelected();
  els.selectAllBox.checked = allSel;

  if(els.selectAllLabel){
    const selCount = selectedCartItems().length;
    els.selectAllLabel.textContent = (selCount === cart.length)
      ? `Hammasi tanlangan (${selCount})`
      : `Tanlangan: ${selCount} / ${cart.length}`;
  }
}

function updateBadges(){
  if(els.favCount) els.favCount.textContent = String(favs.size);
  if(els.cartCount) els.cartCount.textContent = String(cartCount());
  const nb = document.getElementById("navCartBadge");
  if(nb){ const c = cartCount(); nb.textContent = String(c); nb.hidden = (c<=0); }
  const fb = document.getElementById("navFavBadge");
  if(fb){ const c = favs.size; fb.textContent = String(c); fb.hidden = (c<=0); }
}


/* =========================
   Orders (profile page)
========================= */
let ordersUnsub = null;
let ordersCache = [];

function fmtDate(ts){
  try{
    const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if(!d || Number.isNaN(+d)) return "";
    return d.toLocaleString("uz-UZ", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }catch(e){
    return "";
  }
}


function omOrderStatusKey(s){
  const v = (s||"").toString().toLowerCase().trim();
  const m = {
    "pending":"new",
    "pending_cash":"new",
    "pending_payment":"new",
    "shared_telegram":"new",
    "telegram":"new",
    "processing":"packing",
    "shipped":"shipping",
    "completed":"delivered",
    "canceled":"cancelled",
    "rejected":"cancelled",
    "declined":"cancelled"
  };
  return m[v] || v || "new";
}
function orderStatusLabel(s){
  const v = omOrderStatusKey(s);
  const m = {
    "new":"Yangi",
    "paid":"Yangi • to‘langan",
    "packing":"Yig‘ilyapti",
    "shipping":"Yetkazib berishda",
    "delivered":"Yetkazib berildi",
    "cancelled":"Bekor qilindi",
    "return_requested":"Qaytarish so‘rovi yuborildi",
    "returned":"Qaytarildi",
    "return_rejected":"Qaytarish rad etildi",
    "failed":"Muvaffaqiyatsiz"
  };
  return m[v] || (v ? v : "");
}
function orderStatusClass(s){
  const v = omOrderStatusKey(s);
  return "status-"+v.replace(/[^a-z0-9_\-]/gi,"").toLowerCase();
}
function orderStatusIcon(s){
  const v=omOrderStatusKey(s);
  const m={
    new:"fa-sparkles",
    pending:"fa-clock",
    waiting:"fa-clock",
    pending_payment:"fa-clock",
    pending_click:"fa-clock",
    paid:"fa-circle-check",
    packing:"fa-box-open",
    shipping:"fa-truck-fast",
    delivered:"fa-circle-check",
    cancelled:"fa-ban",
    return_requested:"fa-clock-rotate-left",
    returned:"fa-rotate-left",
    return_rejected:"fa-circle-xmark",
    failed:"fa-triangle-exclamation",
    refunded:"fa-arrow-rotate-left",
    approved:"fa-circle-check",
    success:"fa-circle-check"
  };
  return m[v]||"fa-receipt";
}
function orderStatusCustomerCardClass(s){
  return "customer-order-status-"+omOrderStatusKey(s).replace(/[^a-z0-9_\-]/gi,"").toLowerCase();
}
function orderActorLabel(v){
  const s = String(v||"").toLowerCase();
  if(s === "customer") return "Foydalanuvchi";
  if(s === "orzumall" || s === "admin") return "OrzuMall";
  return "Tizim";
}
function customerVisibleOrderReason(reason,status){
  const raw=String(reason||"").trim();
  if(omOrderStatusKey(status)==="returned" && /^QR skaner orqali qaytarib olindi$/i.test(raw)) return "Buyurtma mijoz tomonidan qaytarildi";
  return raw;
}
function orderStatusNote(order){
  const raw=String(order?.statusNote || order?.cancellation?.reason || order?.returnRequest?.resolutionReason || order?.returnRequest?.reason || "").trim();
  return customerVisibleOrderReason(raw,order?.status);
}
function orderStatusReasonTitle(order){
  return omOrderStatusKey(order?.status)==="returned" ? "Qaytarish sababi" : `${orderActorLabel(order?.statusActor || order?.cancellation?.by || order?.returnRequest?.resolvedBy || "system")} izohi`;
}
function orderTimelineHTML(order){
  const list = Array.isArray(order?.statusHistory) ? order.statusHistory.slice() : [];
  if(!list.length){
    list.push({status: order?.status || "new", actorType: order?.statusActor || "system", reason: orderStatusNote(order), at: order?.updatedAt || order?.createdAt || null});
  }
  list.sort((a,b)=>{
    const ta = a?.at?.toDate ? +a.at.toDate() : (a?.at ? +new Date(a.at) : 0);
    const tb = b?.at?.toDate ? +b.at.toDate() : (b?.at ? +new Date(b.at) : 0);
    return ta - tb;
  });
  return `<div class="orderTimeline"><div class="orderTimelineTitle">Buyurtma harakati</div>${list.map(x=>{
    const when=fmtDate(x?.at)||"";
    const actor=orderActorLabel(x?.actorType);
    const reason=customerVisibleOrderReason(x?.reason||"",x?.status);
    const timelineClass=orderStatusClass(x?.status||"");
    return `<div class="orderTimelineItem ${timelineClass}"><span class="orderTimelineDot"><i class="fa-solid ${escapeHtml(orderStatusIcon(x?.status||''))}" aria-hidden="true"></i></span><div class="orderTimelineText"><b>${escapeHtml(orderStatusLabel(x?.status||""))}</b>${escapeHtml([actor,when].filter(Boolean).join(" • "))}${reason?`<br><span>${omOrderStatusKey(x?.status)==="returned"?"Sabab":"Izoh"}: ${escapeHtml(reason)}</span>`:""}</div></div>`;
  }).join("")}</div>`;
}


function providerLabel(p){
  const v = (p||"").toString().toLowerCase();
  const m = {
    "balance":"Balans",
    "cash":"Naqd",
    "card":"Karta",
    "payme":"Payme",
    "click":"Click"
  };
  return m[v] || (v ? v : "");
}


function receiptItemName(it){
  return String(it?.name || it?.title || it?.productName || "Mahsulot");
}

function buildOrderReceiptHTML(order){
  const oid = String(order?.orderId || order?.id || "");
  const shortId = oid ? oid.slice(-6) : "—";
  const total = Number(order?.totalUZS || 0) || 0;
  const created = fmtDate(order?.createdAt) || "—";
  const status = orderStatusLabel(order?.status || "") || "—";
  const provider = providerLabel(order?.provider || "") || (order?.provider || "—");
  const customer = omOrderPublicName(order,"—");
  const phone = order?.userPhone || order?.shipping?.phone || "—";
  const deliveryLabel = order?.shipping?.methodLabel || (order?.shipping?.method === 'delivery' ? 'Yetkazib berish' : (order?.shipping?.method === 'pickup' ? 'Do‘kondan olib ketish' : '—'));
  const addr = order?.shipping?.addressText || [order?.shipping?.region, order?.shipping?.district, order?.shipping?.post, order?.shipping?.address].filter(Boolean).join(' / ') || [order?.region, order?.district, order?.post].filter(Boolean).join(' / ') || "—";
  const mapUrl = order?.shipping?.mapUrl || (order?.shipping?.lat && order?.shipping?.lng ? `https://maps.google.com/?q=${order.shipping.lat},${order.shipping.lng}` : '');
  const statusReason = orderStatusNote(order);
  const statusActor = orderActorLabel(order?.statusActor || order?.cancellation?.by || order?.returnRequest?.resolvedBy || 'system');
  const statusReasonTitle = orderStatusReasonTitle(order);
  const review = order?.orderReview || null;
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsHtml = items.length ? items.map((it)=>{
    const qty = Number(it?.qty || 1) || 1;
    const price = Number(it?.priceUZS || it?.price || 0) || 0;
    const line = price * qty;
    const variant = [it?.color, it?.size].filter(Boolean).join(' / ');
    return `
      <div class="orderReceiptItem">
        <div>
          <div class="orderReceiptItemName">${escapeHtml(receiptItemName(it))}</div>
          <div class="orderReceiptItemMeta">${escapeHtml([variant, `${qty} ta`].filter(Boolean).join(' • '))}</div>
        </div>
        <div><b>${escapeHtml(moneyUZS(line))}</b></div>
      </div>`;
  }).join('') : `<div class="orderReceiptMuted">Mahsulotlar topilmadi.</div>`;

  return `
    <div class="orderReceiptSheet">
      <div class="orderReceiptHead">
        <div>
          <div class="orderReceiptBrand">OrzuMall</div>
          <div class="orderReceiptMuted">Buyurtma cheki</div>
          <div class="orderReceiptStatus"><span class="orderPill ${orderStatusClass(order?.status || '')}">${escapeHtml(status)}</span></div>
        </div>
        <div style="text-align:right">
          <div><b>#${escapeHtml(shortId)}</b></div>
          <div class="orderReceiptMuted">${escapeHtml(created)}</div>
        </div>
      </div>

      <div class="orderReceiptGrid">
        <div class="orderReceiptBox"><div class="k">Mijoz</div><div class="v">${escapeHtml(customer)}</div></div>
        <div class="orderReceiptBox"><div class="k">Telefon</div><div class="v">${escapeHtml(phone)}</div></div>
        <div class="orderReceiptBox"><div class="k">To‘lov turi</div><div class="v">${escapeHtml(provider)}</div></div>
        <div class="orderReceiptBox"><div class="k">Yetkazish</div><div class="v">${escapeHtml(deliveryLabel)}</div></div>
        <div class="orderReceiptBox"><div class="k">Manzil</div><div class="v">${escapeHtml(addr)}${mapUrl ? `<br><a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">Xaritada ochish</a>` : ''}</div></div>
      </div>

      ${statusReason ? `<div class="orderStatusReason"><b>${escapeHtml(statusReasonTitle)}:</b> ${escapeHtml(statusReason)}</div>` : ''}
      ${orderTimelineHTML(order)}
      ${review ? `<div class="orderReviewSaved"><b>Fikr bildirildi${String(review.moderationStatus||"pending")==="approved" ? "" : " • admin tasdig‘i kutilmoqda"}:</b> ${'★'.repeat(Number(review.stars||0))}${'☆'.repeat(Math.max(0,5-Number(review.stars||0)))}<br>${escapeHtml(review.text||'')}${review.adminReply?.text ? `<div class="revAdminReply"><b>OrzuMall javobi</b><span>${escapeHtml(review.adminReply.text)}</span></div>` : ""}</div>` : ''}

      <div class="orderReceiptItems">${itemsHtml}</div>

      <div class="orderReceiptTotals">
        <div class="row total"><span>Jami</span><span>${escapeHtml(moneyUZS(total))}</span></div>
      </div>

      <div class="orderReceiptFooter">Savolingiz bo‘lsa buyurtma ID sini ko‘rsating: ${escapeHtml(oid || shortId)}</div>
    </div>`;
}

function openOrderReceipt(orderId){
  const order = (ordersCache || []).find(o => String(o?.id || o?.orderId || '') === String(orderId || ''));
  if(!order){ toast("Buyurtma topilmadi.", "error"); return; }
  if(els.orderReceiptContent) els.orderReceiptContent.innerHTML = buildOrderReceiptHTML(order);
  if(els.orderReceiptModal){
    els.orderReceiptModal.hidden = false;
    try{ els.orderReceiptModal.classList.add('isOpen'); }catch(_){ }
    try{ document.body.classList.add('modalOpen'); }catch(_){ }
    document.body.style.overflow = 'hidden';
  }
}

function closeOrderReceipt(){
  if(els.orderReceiptModal){
    try{ els.orderReceiptModal.classList.remove('isOpen'); }catch(_){ }
    els.orderReceiptModal.hidden = true;
  }
  try{ document.body.classList.remove('modalOpen'); }catch(_){ }
  document.body.style.overflow = '';
}

function printOrderReceipt(){
  const html = els.orderReceiptContent?.innerHTML || '';
  if(!html.trim()){ toast("Chek topilmadi.", "error"); return; }
  const w = window.open('', '_blank');
  if(!w){ toast("Brauzer oynani blokladi.", 'error'); return; }
  w.document.open();
  w.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Buyurtma cheki</title><style>
    body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:20px;}
    .orderReceiptSheet{max-width:780px;margin:0 auto;border:1px solid #ddd;border-radius:18px;padding:18px;}
    .orderReceiptHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;}
    .orderReceiptBrand{font-size:22px;font-weight:700}.orderReceiptMuted{color:#666;font-size:12px}
    .orderReceiptGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.orderReceiptBox{border:1px solid #ddd;border-radius:12px;padding:10px 12px}
    .orderReceiptBox .k{color:#666;font-size:12px;margin-bottom:4px}.orderReceiptBox .v{font-weight:700}
    .orderReceiptItems{border-top:1px dashed #bbb;border-bottom:1px dashed #bbb;padding:10px 0;display:flex;flex-direction:column;gap:10px}
    .orderReceiptItem{display:flex;justify-content:space-between;gap:12px}.orderReceiptItemName{font-weight:700}.orderReceiptItemMeta{color:#666;font-size:12px;margin-top:4px}
    .orderReceiptTotals{margin-top:12px}.orderReceiptTotals .row{display:flex;justify-content:space-between}.orderReceiptTotals .total{font-size:20px;font-weight:700}
    .orderPill{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700}
    .orderStatusReason,.orderReviewSaved{margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:12px;line-height:1.5}
    .orderTimeline{margin:12px 0;padding-top:10px;border-top:1px dashed #bbb}.orderTimelineTitle{font-weight:700;margin-bottom:7px}.orderTimelineItem{display:flex;gap:8px;margin:6px 0}.orderTimelineDot{width:8px;height:8px;border-radius:50%;margin-top:5px;background:#222}.orderTimelineText{font-size:12px;line-height:1.45}.orderTimelineText b{display:block}
    @media print{body{padding:0}.orderReceiptSheet{border:none;border-radius:0;padding:0}.orderReceiptGrid{grid-template-columns:1fr 1fr}}
  </style></head><body>${html}<script>setTimeout(()=>{window.focus();window.print();},150)<\/script></body></html>`);
  w.document.close();
}

function orderCustomerActionButtonsHTML(order){
  const oid = escapeHtml(String(order?.id || order?.orderId || ""));
  const st = omOrderStatusKey(order?.status || "new");
  const reviewed = !!order?.orderReview;
  const buttons = [`<button class="orderActionBtn" type="button" data-order-receipt="${oid}">🧾 Chek</button>`];
  if(Array.isArray(order?.items) && order.items.length){ buttons.push(`<button class="orderActionBtn cxRepeatBtn" type="button" data-order-repeat="${oid}"><i class="fa-solid fa-rotate-right"></i> Qayta buyurtma</button>`); }
  if(["new","paid","packing","shipping"].includes(st)){
    buttons.push(`<button class="orderActionBtn isDanger" type="button" data-order-action="cancel" data-order-id="${oid}"><i class="fa-solid fa-ban"></i> Bekor qilish</button>`);
  }
  if(["delivered","returned"].includes(st) && !reviewed){
    buttons.push(`<button class="orderActionBtn isReview" type="button" data-order-action="review" data-order-id="${oid}"><i class="fa-solid fa-star"></i> Fikr bildirish</button>`);
  }
  return buttons.join("");
}

let omOrderActionState = { type:"", orderId:"", stars:0 };

function getOrderFromCache(orderId){
  return (ordersCache || []).find(o=>String(o?.id || o?.orderId || "") === String(orderId || "")) || null;
}
function setReviewStars(stars){
  const n=Math.max(0,Math.min(5,Number(stars)||0));
  omOrderActionState.stars=n;
  document.querySelectorAll('#orderReviewStars [data-review-star]').forEach(btn=>{
    btn.classList.toggle('isActive', Number(btn.getAttribute('data-review-star')||0)<=n);
  });
  const hint=document.getElementById('orderReviewStarsHint');
  if(hint) hint.textContent=n ? `${n} yulduz tanlandi.` : 'Bahoni tanlang.';
}
function closeOrderActionModal(){
  const modal=document.getElementById('orderActionModal');
  if(modal){ modal.classList.remove('isOpen'); modal.hidden=true; }
  try{ document.body.classList.remove('modalOpen'); }catch(_e){}
  document.body.style.overflow='';
  omOrderActionState={type:"",orderId:"",stars:0};
}
function openOrderActionModal(type, orderId){
  if(!["cancel","review"].includes(String(type||""))) return;
  const order=getOrderFromCache(orderId);
  if(!order){ toast('Buyurtma topilmadi.','error'); return; }
  const modal=document.getElementById('orderActionModal');
  if(!modal) return;
  const title=document.getElementById('orderActionTitle');
  const help=document.getElementById('orderActionHelp');
  const summary=document.getElementById('orderActionSummary');
  const reason=document.getElementById('orderActionReason');
  const reasonLabel=document.getElementById('orderActionReasonLabel');
  const cancelReasonWrap=document.getElementById('orderCancelReasonWrap');
  const cancelReasonSelect=document.getElementById('orderCancelReasonSelect');
  const cancelReasonOtherWrap=document.getElementById('orderCancelReasonOtherWrap');
  const cancelReasonOther=document.getElementById('orderCancelReasonOther');
  const starsWrap=document.getElementById('orderReviewStarsWrap');
  const submit=document.getElementById('orderActionSubmit');
  const oid=String(order.id||order.orderId||'');
  omOrderActionState={type,orderId:oid,stars:0};
  if(reason) reason.value='';
  if(cancelReasonSelect) cancelReasonSelect.value='';
  if(cancelReasonOther) cancelReasonOther.value='';
  if(cancelReasonOtherWrap) cancelReasonOtherWrap.hidden=true;
  if(summary) summary.innerHTML=`<b>#${escapeHtml(oid.slice(-6))}</b> • ${escapeHtml(moneyUZS(Number(order.totalUZS||0)))}<br><span>${escapeHtml(orderStatusLabel(order.status||'new'))}</span>`;
  if(starsWrap) starsWrap.hidden = type !== 'review';
  if(cancelReasonWrap) cancelReasonWrap.hidden = type !== 'cancel';
  const reasonWrap=document.getElementById('orderActionReasonWrap');
  if(reasonWrap) reasonWrap.hidden = type === 'cancel';
  setReviewStars(0);
  if(type==='cancel'){
    if(title) title.textContent='Buyurtmani bekor qilish';
    if(help) help.textContent='Eng mos sababni tanlang. Kerak bo‘lsa “Boshqa sabab” orqali o‘zingiz yozishingiz mumkin. Buyurtma balansdan to‘langan bo‘lsa mablag‘ avtomatik qaytariladi.';
    if(reasonLabel) reasonLabel.textContent='Bekor qilish sababi';
    if(reason) reason.placeholder='Masalan: adashib buyurtma berdim';
    if(submit) submit.innerHTML='<i class="fa-solid fa-ban"></i> Bekor qilish';
  }else{
    if(title) title.textContent='Buyurtmaga fikr bildirish';
    if(help) help.textContent='Fikringiz admin tekshiruvidan keyin mahsulot sahifasida ko‘rinadi. OrzuMall javob qaytarishi mumkin.';
    if(reasonLabel) reasonLabel.textContent='Fikringiz';
    if(reason) reason.placeholder='Mahsulot va xizmat haqida fikringizni yozing';
    if(submit) submit.innerHTML='<i class="fa-solid fa-star"></i> Fikrni saqlash';
  }
  modal.hidden=false;
  requestAnimationFrame(()=>modal.classList.add('isOpen'));
  try{ document.body.classList.add('modalOpen'); }catch(_e){}
  document.body.style.overflow='hidden';
}
async function submitOrderAction(){
  const {type,orderId,stars}=omOrderActionState;
  if(!type || !orderId || !currentUser){ toast('Avval tizimga kiring.','error'); return; }
  let reason='';
  if(type==='cancel'){
    const selected=String(document.getElementById('orderCancelReasonSelect')?.value||'').trim();
    if(!selected){ toast('Bekor qilish sababini tanlang.','error'); return; }
    if(selected==='other'){
      reason=String(document.getElementById('orderCancelReasonOther')?.value||'').trim();
      if(reason.length<4){ toast('Boshqa sababni qisqacha yozing.','error'); return; }
    }else{
      reason=selected;
    }
  }else{
    reason=String(document.getElementById('orderActionReason')?.value||'').trim();
  }
  if(reason.length<2){ toast(type==='review'?'Fikringizni yozing.':'Sababni batafsil yozing.','error'); return; }
  if(type==='review' && !(Number(stars)>=1 && Number(stars)<=5)){ toast('Bahoni tanlang.','error'); return; }
  const btn=document.getElementById('orderActionSubmit');
  const old=btn?.innerHTML||'';
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="omBtnSpinner" aria-hidden="true"></span> Yuborilmoqda...'; }
  try{
    const token=await currentUser.getIdToken();
    const action=type==='cancel'?'cancel_order':'submit_review';
    const resp=await fetch('/.netlify/functions/order-lifecycle',{
      method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},
      body:JSON.stringify({action,orderId,reason,text:reason,stars:Number(stars)||0})
    });
    const out=await resp.json().catch(()=>({}));
    if(!resp.ok || !out.ok) throw new Error(out.error||'action_failed');
    closeOrderActionModal();
    if(type==='cancel') toast(out.refund?.refunded?'Buyurtma bekor qilindi va mablag‘ balansga qaytarildi.':'Buyurtma bekor qilindi.','success');
    else toast('Fikringiz yuborildi. Admin tasdiqlagach namoyish qilinadi.','success');
  }catch(e){
    const code=String(e?.message||'');
    const map={cancel_not_allowed:'Yetkazib berilgan buyurtmani bekor qilib bo‘lmaydi. Operatorga yozing.',review_not_allowed:'Fikr faqat yetkazib berilgan buyurtmaga yoziladi.'};
    toast(map[code]||'Amal bajarilmadi. Qayta urinib ko‘ring.','error');
  }finally{
    if(btn){ btn.disabled=false; btn.innerHTML=old; }
  }
}

let currentOrdersFilter = "all";
function filterOrdersByKey(arr, key){
  const list = Array.isArray(arr) ? arr : [];
  const k = String(key || 'all');
  if(k === 'all') return list;
  return list.filter(o=>{
    const s = omOrderStatusKey(o?.status || '');
    if(k === 'active') return ['new','paid','packing','shipping'].includes(s);
    if(k === 'delivered') return s === 'delivered';
    if(k === 'cancelled') return s === 'cancelled' || s === 'failed';
    if(k === 'returns') return ['return_requested','returned','return_rejected','refunded'].includes(s);
    return true;
  });
}
function syncOrderFilterUI(){
  document.querySelectorAll('#orderFilterBar .orderFilterChip').forEach(btn=>{
    const on = btn.dataset.orderFilter === currentOrdersFilter;
    btn.classList.toggle('isActive', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function renderOrders(orders){
  if(!els.ordersList || !els.ordersEmpty) return;
  const arr = Array.isArray(orders) ? orders : [];
  ordersCache = arr;
  const filtered = filterOrdersByKey(arr, currentOrdersFilter);
  syncOrderFilterUI();
  els.ordersList.innerHTML = "";
  els.ordersEmpty.hidden = filtered.length !== 0;
  if(els.ordersEmpty) els.ordersEmpty.textContent = filtered.length ? '' : 'Tanlangan filter bo‘yicha buyurtma topilmadi.';

  for(const o of filtered){
    const id = String(o.id || "").slice(-6);
    const total = moneyUZS(Number(o.totalUZS||0));
    const status = (o.status||"").toString();
    const provider = (o.provider||"").toString();
    const when = fmtDate(o.createdAt);
    const row = document.createElement("div");
    row.className = `orderRow orderPremiumRow customerOrderHistoryCard ${orderStatusCustomerCardClass(status)}`;
    row.innerHTML = `
      <div class="customerOrderStatusHero ${orderStatusClass(status)}">
        <span class="customerOrderStatusIcon"><i class="fa-solid ${escapeHtml(orderStatusIcon(status))}" aria-hidden="true"></i></span>
        <div><small>Buyurtma holati</small><b>${escapeHtml(orderStatusLabel(status))}</b></div>
      </div>
      <div class="orderTop">
        <div class="orderId">#${escapeHtml(id)}</div>
        <div class="orderTotal">${escapeHtml(total)}</div>
      </div>
      <div class="orderMeta">
        ${status ? `<span class="orderPill ${orderStatusClass(status)}">${escapeHtml(orderStatusLabel(status))}</span>` : ""}
        ${provider ? `<span class="orderPill">${escapeHtml(providerLabel(provider))}</span>` : ""}
        ${when ? `<span class="orderPill">${escapeHtml(when)}</span>` : ""}
      </div>
      ${orderStatusNote(o) ? `<div class="orderStatusReason"><b>${escapeHtml(orderStatusReasonTitle(o))}:</b> ${escapeHtml(orderStatusNote(o))}</div>` : ""}
      ${o.orderReview ? `<div class="orderReviewSaved"><b>Fikr bildirildi${String(o.orderReview.moderationStatus||"pending")==="approved" ? "" : " • admin tasdig‘i kutilmoqda"}:</b> ${'★'.repeat(Number(o.orderReview.stars||0))}${'☆'.repeat(Math.max(0,5-Number(o.orderReview.stars||0)))}<br>${escapeHtml(o.orderReview.text||'')}${o.orderReview.adminReply?.text ? `<div class="revAdminReply"><b>OrzuMall javobi</b><span>${escapeHtml(o.orderReview.adminReply.text)}</span></div>` : ""}</div>` : ''}
      <div class="orderActions">${orderCustomerActionButtonsHTML(o)}</div>
    `;
    els.ordersList.appendChild(row);
  }
}


/* =========================
   Money history (profile)
========================= */
let moneyUnsubTopups = null;
let moneyUnsubOrders = null;

function normalizeMoneyItems({ topups=[], orders=[] }){
  const out = [];
  for(const t of topups){
    const ts = t.approvedAt || t.updatedAt || t.createdAt || null;
    const st = (t.status||"pending").toString();
    const amt = Number(t.amountUZS||0) || 0;
    out.push({
      kind: "topup",
      direction: "in",
      amountUZS: amt,
      status: st,
      note: (t.adminNote||""),
      provider: (t.provider||""),
      title: String(t.provider||"").toLowerCase()==="click" ? "Click orqali balans to‘ldirish" : "Balans to‘ldirish",
      ts,
      id: t.id || ""
    });
  }
  for(const o of orders){
    const oid=String(o.orderId || o.id || "");
    const provider=String(o.provider||"").toLowerCase();
    const status=String(o.status||"new");
    const paidFromBalance=provider==="balance";
    out.push({
      kind:"order",
      direction:"out",
      amountUZS:Number(o.totalUZS||0)||0,
      status,
      note:orderStatusNote(o),
      provider,
      title:`Buyurtma #${oid.slice(-6) || "—"}${paidFromBalance ? " • balansdan to‘landi" : " • naqd to‘lov"}`,
      ts:o.createdAt||null,
      id:oid
    });
    if(o?.refund?.status === "refunded" || o?.refund?.processed === true){
      out.push({
        kind:"refund",
        direction:"in",
        amountUZS:Number(o.refund.amountUZS||o.totalUZS||0)||0,
        status:"refunded",
        note:o.refund.reason || orderStatusNote(o),
        provider,
        title:`Buyurtma #${oid.slice(-6) || "—"} uchun qaytarilgan mablag‘`,
        ts:o.refund.refundedAt || o.updatedAt || o.createdAt || null,
        id:`refund_${oid}`
      });
    }
  }
  out.sort((a,b)=>{
    const ta = (a.ts?.toDate ? +a.ts.toDate() : (a.ts ? +new Date(a.ts) : 0));
    const tb = (b.ts?.toDate ? +b.ts.toDate() : (b.ts ? +new Date(b.ts) : 0));
    return tb - ta;
  });
  return out;
}

function renderMoneyHistory(items){
  if(!els.moneyHistoryList || !els.moneyHistoryEmpty) return;
  const arr = Array.isArray(items) ? items : [];
  els.moneyHistoryList.innerHTML = "";
  els.moneyHistoryEmpty.hidden = arr.length !== 0;
  if(els.moneyHistoryCount) els.moneyHistoryCount.textContent = String(arr.length);

  for(const it of arr){
    const isIn = it.direction === "in";
    const amt = moneyUZS(Number(it.amountUZS||0));
    const when = fmtDate(it.ts);
    const st = (it.status||"").toString();

    const title = it.title || (it.provider === 'click' ? "Click orqali balans to‘ldirish" : "Balans to‘ldirish");

    const left = document.createElement("div");
    left.style.minWidth = "0";
    const historyStatusKey=moneyHistoryCanonicalStatus(st,it.kind);
    const historyIconHtml = historyStatusKey === "pending"
      ? `<span class="moneyHistoryPendingGlyph" aria-hidden="true">⏳</span>`
      : `<i class="fa-solid ${escapeHtml(orderStatusIcon(historyStatusKey))}" aria-hidden="true"></i>`;
    left.innerHTML = `
      <div class="moneyHistoryTitleRow"><span class="moneyHistoryStatusIcon">${historyIconHtml}</span><div class="orderId">${escapeHtml(title)}</div></div>
      <div class="orderMeta">${when ? `<span class="orderPill">${when}</span>` : ""}${st ? ` <span class="orderPill ${moneyHistoryStatusClass(st,it.kind)}">${escapeHtml(statusLabel(st, it.kind))}</span>` : ""}</div>
      ${it.note ? `<div class="orderMeta" style="margin-top:6px"><b>Izoh:</b> ${escapeHtml(it.note)}</div>` : ""}
    `.trim();

    const right = document.createElement("div");
    right.className = `orderTotal moneyAmount ${isIn ? "isIn" : "isOut"}`;
    right.textContent = (isIn ? "+ " : "- ") + amt;

    const row = document.createElement("div");
    row.className = `orderItem moneyHistoryEntry ${isIn ? "isIn" : "isOut"} money-history-status-${historyStatusKey}`;
    row.style.display = "flex";
    row.style.alignItems = "flex-start";
    row.style.justifyContent = "space-between";
    row.style.gap = "12px";
    row.appendChild(left);
    row.appendChild(right);

    els.moneyHistoryList.appendChild(row);
  }
}


function moneyHistoryCanonicalStatus(st,kind){
  const raw=String(st||"").toLowerCase().trim();
  if(kind==="refund") return "refunded";
  if(kind==="topup"){
    if(["approved","success","paid"].includes(raw)) return "approved";
    if(["pending","waiting","pending_click","pending_payment"].includes(raw)) return "pending";
    if(["rejected","declined","failed"].includes(raw)) return "failed";
    if(["cancelled","canceled","canceled_by_admin"].includes(raw)) return "cancelled";
    return "new";
  }
  return omOrderStatusKey(raw||"new");
}
function moneyHistoryStatusClass(st,kind){
  return "status-"+moneyHistoryCanonicalStatus(st,kind).replace(/[^a-z0-9_\-]/gi,"");
}

function statusLabel(st, kind){
  const v = (st||"").toString().toLowerCase();

  if(kind === "topup"){
    if(v === "approved" || v === "success") return "Tasdiqlangan";
    if(v === "pending_click") return "Click to‘lovi kutilmoqda";
    if(v === "pending_payment") return "To‘lov kutilmoqda";
    if(v === "pending" || v === "waiting") return "Kutilmoqda";
    if(v === "rejected" || v === "declined") return "Rad etilgan";
    if(v === "canceled" || v === "cancelled" || v === "canceled_by_admin") return "Bekor qilingan";
    return v ? v : "";
  }

  if(kind === "refund") return "Mablag‘ qaytarildi";
  // orders
  return orderStatusLabel(v);
}


function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function subscribeMoneyHistory(uid){
  if(!uid || !db) return;
  try{ moneyUnsubTopups?.(); }catch(e){}
  try{ moneyUnsubOrders?.(); }catch(e){}

  // Render durable local snapshot immediately; Firestore refreshes it afterward.
  let topupsArr = omLoadTopupHistoryCache(uid);
  let ordersArr = omLoadOrdersHistoryCache(uid);

  function merge(){
    const items = normalizeMoneyItems({ topups: topupsArr, orders: ordersArr });
    renderMoneyHistory(items);
  }
  merge();

  // Topups: only this user
  try{
    const qTop = query(collection(db, "topup_requests"), where("uid", "==", uid), limit(80));
    moneyUnsubTopups = onSnapshot(qTop, (snap)=>{
      topupsArr = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      omSaveTopupHistoryCache(uid,topupsArr);
      merge();
    }, (err)=>{
      console.warn("topup history snapshot failed",err);
      // Keep last known local snapshot instead of blanking the UI.
      merge();
    });
  }catch(e){ console.warn("topup history subscribe failed",e); merge(); }

  // Orders are displayed from the very first checkout. Sorting remains client-side,
  // avoiding a composite-index dependency that could make refresh look broken.
  try{
    const qOrders = query(collection(db, "orders"), where("uid", "==", uid), limit(120));
    moneyUnsubOrders = onSnapshot(qOrders, (snap)=>{
      ordersArr = omSortOrdersNewest(snap.docs.map(d=>({ id:d.id, ...d.data() })));
      omSaveOrdersHistoryCache(uid,ordersArr);
      merge();
    }, (err)=>{
      console.warn("money order history snapshot failed",err);
      merge();
    });
  }catch(e){ console.warn("money order history subscribe failed",e); merge(); }
}


function subscribeOrders(uid){
  if(!uid || !currentUser || !db || !els.ordersList) return;
  try{ ordersUnsub?.(); }catch(e){}

  // Immediate local render so a page refresh never flashes an empty history.
  const cached=omLoadOrdersHistoryCache(uid);
  if(cached.length) renderOrders(cached);

  // Client-side sort intentionally avoids requiring a uid + createdAt composite index.
  const qy = query(
    collection(db, "orders"),
    where("uid", "==", uid),
    limit(120)
  );

  ordersUnsub = onSnapshot(qy, (snap)=>{
    const arr = omSortOrdersNewest(snap.docs.map(d=>({ id: d.id, ...d.data() })));
    omSaveOrdersHistoryCache(uid,arr);
    renderOrders(arr);
  }, (err)=>{
    console.warn("orders snapshot failed",err);
    renderOrders(cached.length ? cached : ordersCache);
  });
}

els.ordersReload?.addEventListener("click", (e)=>{
  // avoid collapsing when tapping reload
  try{ e?.stopPropagation?.(); }catch(_){}
  if(!currentUser?.uid){ toast("Avval kirish qiling."); return; }
  try{ subscribeOrders(currentUser.uid); }catch(e){}
  try{ subscribeMoneyHistory(currentUser.uid); }catch(e){}
  toast("Yangilanmoqda...");
});

function setCollapsed(cardEl, bodyEl, on){
  if(!cardEl || !bodyEl) return;
  bodyEl.hidden = !!on;
  cardEl.classList.toggle("collapsed", !!on);
  const top = cardEl.querySelector(".collapsibleTop");
  if(top) top.setAttribute("aria-expanded", String(!on));
}

function toggleCollapsed(cardEl, bodyEl){
  if(!cardEl || !bodyEl) return;
  const now = !!bodyEl.hidden;
  setCollapsed(cardEl, bodyEl, !now ? true : false);
}

// Collapsible cards on profile view
(function(){
  const ordersCard = document.getElementById("ordersHistoryCard");
  const moneyCard = document.getElementById("moneyHistoryCard");

  const ordersTop = document.getElementById("ordersToggle");
  const ordersBody = document.getElementById("ordersBody");
  const moneyTop  = document.getElementById("moneyHistoryToggle");
  const moneyBody = document.getElementById("moneyHistoryBody");

  function bind(topEl, cardEl, bodyEl){
    if(!topEl || !cardEl || !bodyEl) return;
    topEl.addEventListener("click", ()=> toggleCollapsed(cardEl, bodyEl));
    topEl.addEventListener("keydown", (ev)=>{
      if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); toggleCollapsed(cardEl, bodyEl); }
    });
  }

  bind(ordersTop, ordersCard, ordersBody);
  bind(moneyTop,  moneyCard,  moneyBody);
})();



/* ===== v122 Public stores, subscriptions and store notifications ===== */
let activeStoreId = "";
const omStoreCache = new Map();
let omNotifications = [];
let omNotificationsLoading = false;
let omNotificationTimer = null;

async function omStoreApi(action,payload={},opts={}){
  const headers={"content-type":"application/json"};
  if(currentUser?.getIdToken){
    try{ headers.authorization="Bearer "+await currentUser.getIdToken(); }catch(_e){}
  }
  if(opts.authRequired && !headers.authorization) throw new Error("login_required");
  const r=await fetch("/.netlify/functions/seller-store",{method:"POST",headers,body:JSON.stringify({action,...payload})});
  const out=await r.json().catch(()=>({}));
  if(!r.ok||!out.ok) throw new Error(out.error||"server_error");
  return out;
}
function omStoreInitials(v){return String(v||"Do‘kon").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"D"}

/* ===== v129 Home search: public seller stores ===== */
const omStoreSearchState={query:"",items:[],loading:false,timer:null,seq:0,lastProductCount:0};
function omStoreSearchCountText(n){return `${Math.max(0,Number(n)||0)} ta do‘kon`}
function omStoreSearchCardHtml(store={}){
  const id=String(store.id||"").trim(),name=String(store.storeName||"Do‘kon").trim()||"Do‘kon",logo=String(store.logoUrl||"").trim();
  const count=Math.max(0,Math.round(Number(store.productCount||store.popularityProductCount||0)||0));
  const followers=Math.max(0,Math.round(Number(store.followersCount||0)||0));
  const popularity=Math.max(0,Math.round(Number(store.popularity||0)||0));
  const completed=Math.max(0,Math.round(Number(store.completedOrdersCount||0)||0));
  return `<button type="button" class="storeSearchCard" data-store-search-id="${escapeHtml(id)}" title="${escapeHtml(name)} do‘konini ochish"><span class="storeSearchLogo">${logo?`<img src="${escapeHtml(logo)}" alt="" loading="lazy" decoding="async">`:escapeHtml(omStoreInitials(name))}</span><span class="storeSearchBody"><span class="storeSearchName"><b>${escapeHtml(name)}</b>${store.verified!==false?`<i class="fa-solid fa-circle-check storeSearchVerified" title="OrzuMall tasdiqlagan do‘kon"></i>`:""}</span><span class="storeSearchDescription">${escapeHtml(store.description||"OrzuMall marketplace do‘koni")}</span><span class="storeSearchMeta"><span><i class="fa-solid fa-box"></i>${count} mahsulot</span><span><i class="fa-solid fa-circle-check"></i>${completed} buyurtma</span><span><i class="fa-solid fa-user-group"></i>${followers}</span><span><i class="fa-solid fa-fire"></i>${omCompactMetric(popularity)}</span></span></span><span class="storeSearchOpen"><i class="fa-solid fa-chevron-right"></i></span></button>`;
}
function omSyncSearchEmptyState(){
  if(!els.empty)return;
  const hasProducts=Number(omStoreSearchState.lastProductCount||0)>0;
  const hasStores=Array.isArray(omStoreSearchState.items)&&omStoreSearchState.items.length>0;
  els.empty.hidden=hasProducts||hasStores||omStoreSearchState.loading;
}
function omRenderStoreSearch(){
  const root=els.storeSearchResults,grid=els.storeSearchGrid,count=els.storeSearchCount,loading=els.storeSearchLoading;if(!root||!grid)return;
  const q=omStoreSearchState.query,items=Array.isArray(omStoreSearchState.items)?omStoreSearchState.items:[];
  root.hidden=!q||(!omStoreSearchState.loading&&!items.length);
  if(loading)loading.hidden=!omStoreSearchState.loading;
  grid.hidden=omStoreSearchState.loading;
  grid.innerHTML=omStoreSearchState.loading?"":items.map(omStoreSearchCardHtml).join("");
  if(count)count.textContent=omStoreSearchCountText(items.length);
  grid.querySelectorAll("[data-store-search-id]").forEach(btn=>btn.addEventListener("click",()=>openStorePage(btn.getAttribute("data-store-search-id"))));
  omSyncSearchEmptyState();
}
async function omFetchStoreSearch(q,seq){
  try{
    const out=await omStoreApi("search_stores",{query:q,limit:12});
    if(seq!==omStoreSearchState.seq||q!==omStoreSearchState.query)return;
    omStoreSearchState.items=Array.isArray(out.stores)?out.stores:[];
  }catch(_e){
    if(seq!==omStoreSearchState.seq)return;
    omStoreSearchState.items=[];
  }finally{
    if(seq===omStoreSearchState.seq){omStoreSearchState.loading=false;omRenderStoreSearch()}
  }
}
function omScheduleStoreSearch(raw){
  const q=norm(raw);if(q===omStoreSearchState.query)return;
  omStoreSearchState.query=q;omStoreSearchState.items=[];omStoreSearchState.seq+=1;
  clearTimeout(omStoreSearchState.timer);
  if(!q){omStoreSearchState.loading=false;omRenderStoreSearch();return}
  omStoreSearchState.loading=true;omRenderStoreSearch();const seq=omStoreSearchState.seq;
  omStoreSearchState.timer=setTimeout(()=>omFetchStoreSearch(q,seq),180);
}
function omMergeStoreProducts(list){
  for(const raw of (Array.isArray(list)?list:[])){
    const p={...raw,_docId:String(raw._docId||raw.id||""),_price:parseUZS(raw._price??raw.price),_created:toMillis(raw._created??raw.createdAt??raw.updatedAt)};
    const ix=products.findIndex(x=>String(x.id)===String(p.id));
    if(ix>=0) products[ix]={...products[ix],...p}; else products.push(p);
  }
  try{buildTagCounts();buildCategoryTree()}catch(_e){}
}
function openStorePage(sellerId){
  const id=String(sellerId||"").trim();
  if(!id){toast("Do‘kon topilmadi");return}
  activeStoreId=id;
  const target="#store/"+encodeURIComponent(id);
  if(location.hash===target) showView("store"); else location.hash=target;
}
function omStoreProductCardHtml(p){
  const sel=getSel(p),img=getCurrentImage(p,sel)||p.image||p.sellerLogo||"./logo-256.webp",pricing=getVariantPricing(p,sel),isFav=favs.has(p.id),m=omGetProductMetrics(p),dp=discountPct(pricing.price,pricing.oldPrice);
  return `<article class="storeProductCard" data-store-product="${escapeHtml(p.id)}">
    <div class="storeProductMedia"><img src="${escapeHtml(img)}" alt="${escapeHtml(omProductText(p,"name",p.name||"Mahsulot"))}" loading="lazy" decoding="async">${dp?`<span class="storeProductBadge">-${dp}%</span>`:""}<button class="storeFavBtn ${isFav?"active":""}" type="button" data-store-fav="${escapeHtml(p.id)}"><i class="fa-${isFav?"solid":"regular"} fa-heart"></i></button></div>
    <div class="storeProductBody"><div class="storeProductName">${escapeHtml(omProductText(p,"name",p.name||"Nomsiz mahsulot"))}</div><div class="storeProductStats"><span><i class="fa-regular fa-eye"></i> ${omCompactMetric(m.views||0)}</span><span><i class="fa-solid fa-fire"></i> ${omCompactMetric(m.score||0)}</span></div><div class="storeProductBottom"><strong class="storeProductPrice">${moneyUZS(pricing.price||0)}</strong><button class="storeProductCart" type="button" data-store-cart="${escapeHtml(p.id)}" title="Savatchaga"><i class="fa-solid fa-cart-shopping"></i></button></div></div>
  </article>`;
}
function omAverageStorePopularity(list){
  const rows=Array.isArray(list)?list:[];
  return rows.length?Math.round(rows.reduce((sum,p)=>sum+Number(omGetProductMetrics(p).score||0),0)/rows.length):0;
}
function omStorePartnerDuration(ms){
  const started=Number(ms||0);if(!started)return "Yaqinda qo‘shilgan";
  const days=Math.max(1,Math.floor((Date.now()-started)/86400000)+1);
  if(days<30)return `${days} kundan beri`;
  const months=Math.max(1,Math.floor(days/30));if(months<12)return `${months} oydan beri`;
  const years=Math.floor(months/12),rest=months%12;return rest?`${years} yil ${rest} oydan beri`:`${years} yildan beri`;
}
function omStorePartnerDate(ms){const n=Number(ms||0);if(!n)return "Hamkorlik sanasi saqlanmagan";try{return new Intl.DateTimeFormat("uz-UZ",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(n))}catch(_){return ""}}
async function renderStorePage(){
  const root=els.storePageContent;if(!root)return;const id=String(activeStoreId||"").trim();if(!id){root.innerHTML='<div class="storePageEmpty">Do‘kon tanlanmagan.</div>';return}
  const cached=omStoreCache.get(id),showLoader=!cached;if(cached)omDrawStorePage(cached);else root.innerHTML='<div class="storePageLoading"><i class="fa-solid fa-store"></i> Do‘kon tayyorlanmoqda...</div>';
  if(showLoader)try{window.OrzuLoader?.show("Do‘kon ochilmoqda",{sub:"Vitrina va mahsulotlar tayyorlanmoqda..."})}catch(_e){}
  try{const out=await omStoreApi("public_store",{sellerId:id});omMergeStoreProducts(out.products);omStoreCache.set(id,out);if(activeTab==="store"&&activeStoreId===id)omDrawStorePage(out)}catch(e){if(!cached)root.innerHTML=`<div class="storePageEmpty"><i class="fa-solid fa-store-slash"></i> Do‘konni yuklab bo‘lmadi.</div>`;console.warn("store load",e)}finally{if(showLoader)try{window.OrzuLoader?.hide()}catch(_e){}}
}
async function omToggleStoreFollow(sellerId,following){
  if(!currentUser){toast("Obuna bo‘lish uchun akkauntga kiring");goTab("profile");return}
  try{const out=await omStoreApi("toggle_follow",{sellerId,following},{authRequired:true}),data=omStoreCache.get(sellerId);if(data){data.following=!!out.following;data.store.followersCount=Number(out.followersCount||0);omStoreCache.set(sellerId,data);omDrawStorePage(data)}toast(out.following?"Do‘konga obuna bo‘ldingiz":"Do‘kon obunasi bekor qilindi")}catch(e){toast("Obunani o‘zgartirib bo‘lmadi: "+e.message,"error")}
}
function omNotificationTime(v){const n=Number(v||0);if(!n)return "";try{return new Intl.DateTimeFormat("uz-UZ",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(n))}catch(_){return new Date(n).toLocaleString()}}
function omRenderNotificationBadge(){const unread=omNotifications.filter(x=>!x.read).length;if(els.notificationsCount){els.notificationsCount.textContent=String(Math.min(99,unread));els.notificationsCount.hidden=!unread}omRenderStoreUpdateStrip()}
function omRenderStoreUpdateStrip(){const box=els.storeUpdateStrip;if(!box)return;const n=omNotifications.find(x=>!x.read&&x.type==="store_new_product");if(!n){box.hidden=true;box.innerHTML="";return}box.hidden=false;box.innerHTML=`<button type="button"><span class="storeUpdateIcon"><i class="fa-solid fa-bell"></i></span><span class="storeUpdateCopy"><b>${escapeHtml(n.storeName||"Obuna bo‘lgan do‘kon")}</b><span>${escapeHtml(n.productName||n.body||"Yangi mahsulot qo‘shildi")}</span></span><i class="fa-solid fa-chevron-right"></i></button>`;box.querySelector("button")?.addEventListener("click",()=>omOpenNotifications())}
function omRenderNotifications(){const list=els.notificationList,empty=els.notificationEmpty;if(!list||!empty)return;empty.hidden=omNotifications.length>0;list.innerHTML=omNotifications.map(n=>`<button type="button" class="notifyCard ${n.read?"":"isUnread"}" data-notification-id="${escapeHtml(n.id)}"><span>${n.productImage?`<img class="notifyImg" src="${escapeHtml(n.productImage)}" alt="" loading="lazy" decoding="async">`:`<span class="notifyImgFallback"><i class="fa-solid fa-store"></i></span>`}</span><span class="notifyCopy"><b>${escapeHtml(n.title||"Yangi bildirishnoma")}</b><p>${escapeHtml(n.body||"")}</p><time>${escapeHtml(omNotificationTime(n.createdAt))}</time></span><i class="notifyDot"></i></button>`).join("");list.querySelectorAll("[data-notification-id]").forEach(btn=>btn.addEventListener("click",()=>omOpenNotification(btn.dataset.notificationId)))}
async function omLoadNotifications({silent=false}={}){if(!currentUser){omNotifications=[];omRenderNotificationBadge();omRenderNotifications();return}if(omNotificationsLoading)return;omNotificationsLoading=true;try{const out=await omStoreApi("notifications_list",{}, {authRequired:true});omNotifications=Array.isArray(out.notifications)?out.notifications:[];omRenderNotificationBadge();omRenderNotifications()}catch(e){if(!silent)console.warn("notifications",e)}finally{omNotificationsLoading=false}}
function omOpenNotifications(){if(!currentUser){toast("Bildirishnomalarni ko‘rish uchun akkauntga kiring");goTab("profile");return}if(els.notificationOverlay)els.notificationOverlay.hidden=false;omRenderNotifications();omLoadNotifications({silent:true})}
function omCloseNotifications(){if(els.notificationOverlay)els.notificationOverlay.hidden=true}
async function omOpenNotification(id){const n=omNotifications.find(x=>String(x.id)===String(id));if(!n)return;try{if(!n.read){n.read=true;omRenderNotificationBadge();omRenderNotifications();await omStoreApi("notification_read",{id:n.id},{authRequired:true})}}catch(_e){}omCloseNotifications();if(n.url){const h=String(n.url).includes("#")?String(n.url).slice(String(n.url).indexOf("#")):String(n.url);location.hash=h.startsWith("#")?h:"#"+h}}
async function omReadAllNotifications(){try{await omStoreApi("notifications_read_all",{}, {authRequired:true});omNotifications=omNotifications.map(x=>({...x,read:true}));omRenderNotificationBadge();omRenderNotifications();toast("Bildirishnomalar o‘qilgan deb belgilandi")}catch(e){toast("Bildirishnomalarni yangilab bo‘lmadi","error")}}
function omStartNotificationPolling(){if(omNotificationTimer)clearInterval(omNotificationTimer);omNotificationTimer=null;if(!currentUser)return;omLoadNotifications({silent:true});omNotificationTimer=setInterval(()=>{if(!document.hidden)omLoadNotifications({silent:true})},90000)}
els.notificationsBtn?.addEventListener("click",omOpenNotifications);els.notificationClose?.addEventListener("click",omCloseNotifications);els.notificationBackdrop?.addEventListener("click",omCloseNotifications);els.notificationReadAll?.addEventListener("click",omReadAllNotifications);
els.storeBackBtn?.addEventListener("click",()=>{try{history.length>1?history.back():goTab("home")}catch(_){goTab("home")}});
els.storeShareBtn?.addEventListener("click",async()=>{const data=omStoreCache.get(activeStoreId),url=location.origin+location.pathname+"#store/"+encodeURIComponent(activeStoreId||"");try{if(navigator.share)await navigator.share({title:data?.store?.storeName||"OrzuMall do‘koni",url});else{await navigator.clipboard.writeText(url);toast("Do‘kon havolasi nusxalandi")}}catch(_){}});
window.addEventListener("focus",()=>{if(currentUser)omLoadNotifications({silent:true})});


/* ===== Mobile SPA Router (Android-like pages) ===== */
let activeTab = "home";
let activeProductId = "";
let activeCatPath = []; // array of strings
let appliedCatPath = []; // applied category filter (prefix path)

function setActiveNav(tab){
  document.querySelectorAll(".mobile-bottom-bar .nav-btn").forEach(btn=>{
    const on = (btn.dataset.tab === tab);
    btn.classList.toggle("active", on);
  });
}

function showView(tab){
  if(tab !== "product" && activeTab === "product") omProductPageReviews.token += 1;
  const map = {
    home: els.viewHome,
    product: els.viewProduct,
    store: els.viewStore,
    categories: els.viewCategories,
    fav: els.viewFav,
    cart: els.viewCart,
    profile: els.viewProfile
  };
  Object.entries(map).forEach(([k, el])=>{
    if(!el) return;
    el.classList.toggle("active", k===tab);
    el.hidden = (k!==tab);
  });
  activeTab = tab;
  setActiveNav(tab);
  try{
    const cls = ["om-view-home","om-view-product","om-view-store","om-view-categories","om-view-fav","om-view-cart","om-view-profile"];
    document.documentElement.classList.remove(...cls);
    document.body && document.body.classList.remove(...cls);
    const nowCls = "om-view-" + tab;
    document.documentElement.classList.add(nowCls);
    document.body && document.body.classList.add(nowCls);
  }catch(e){}

  // render pages on enter
  if(tab === "product") renderProductPage();
  if(tab === "store") renderStorePage();
  if(tab === "categories") renderCategoriesPage();
  if(tab === "fav") renderFavPage();
  if(tab === "cart") renderCartPage();
  if(tab === "profile") {
    if(currentUser?.uid){
      try{ subscribeOrders(currentUser.uid); }catch(e){}
      try{ subscribeMoneyHistory(currentUser.uid); }catch(e){}
    }
  }

  try{ ensureProfileSocialLinks(); }catch(e){}
}

function goTab(tab){
  const safe = ["home","categories","fav","cart","profile"];
  if(!safe.includes(tab)) tab = "home";
  const target = "#"+tab;
  // If hash is already the same, hashchange will not fire — render immediately.
  if(location.hash === target){
    showView(tab);
    return;
  }
  location.hash = target;
}

function handleHash(){
  const h = (location.hash || "#home").replace("#","");
  if(h.startsWith("product/")){
    activeProductId = decodeURIComponent(h.slice("product/".length) || "");
    showView("product");
    return;
  }
  if(h.startsWith("store/")){
    activeStoreId = decodeURIComponent(h.slice("store/".length) || "");
    showView("store");
    return;
  }
  const tab = h || "home";
  showView(tab);
}


window.addEventListener("hashchange", handleHash);

els.productBackBtn?.addEventListener("click", ()=>{
  try{
    if(history.length > 1) history.back();
    else goTab("home");
  }catch(_e){ goTab("home"); }
});
els.productShareBtn?.addEventListener("click", async ()=>{
  const p = findProductById(activeProductId);
  const url = location.origin + location.pathname + "#product/" + encodeURIComponent(activeProductId || "");
  const title = p ? omProductText(p,"name",p.name||"OrzuMall mahsuloti") : "OrzuMall mahsuloti";
  try{
    if(navigator.share) await navigator.share({title, url});
    else { await navigator.clipboard.writeText(url); toast("Havola nusxalandi"); }
  }catch(_e){}
});


(function(){
  const btn = document.getElementById("pcCatBtn");
  if(btn){
    btn.addEventListener("click", ()=>{
      try{ goTab("categories"); }catch(e){ location.hash="#categories"; }
    });
  }
})();
;

// bottom bar clicks (delegation)
els.navBar?.addEventListener("click", (e)=>{
  const btn = e.target.closest(".nav-btn");
  if(!btn) return;
  e.preventDefault();
  const tab = btn.dataset.tab;
  goTab(tab);
  // Ensure instant navigation even before the first hashchange.
  showView(tab);
});

// categories back
els.catBackBtn?.addEventListener("click", ()=>{
  if(activeCatPath.length>0){
    activeCatPath.pop();
    renderCategoriesPage();
  } else {
    goTab("home");
  }
});
els.catClearBtn?.addEventListener("click", ()=>{
  activeCatPath = [];
  appliedCatPath = [];
  applyFilterSort();
  renderCategoriesPage();
});
els.catApplyBtn?.addEventListener("click", ()=>{
  // apply activeCatPath filter and go home
  appliedCatPath = [...activeCatPath];
  applyFilterSort();
  goTab("home");
});

// cart select all (page)
els.cartSelectAllPage?.addEventListener("change", ()=>{
  syncCartSelected(false);
  const checked = !!els.cartSelectAllPage.checked;
  cartSelected = new Set(checked ? cart.map(x=>x.key) : []);
  updateCartSelectUI();
  renderCartPage();
});

// payme/share/clear page buttons reuse existing handlers when possible
els.clearCartPage?.addEventListener("click", ()=>{
  cart = [];
  cartSelected = new Set();
  saveLS(LS.cart, cart);
  updateBadges();
  renderCartPage();
});

function openPanel(mode){
  if(!els.sidePanel || !els.overlay) return;
  // bottom controls exist for both, but differ
  els.panelBottom.style.display = "";
  const isCart = (mode === "cart");
  if(els.totalRow) els.totalRow.style.display = isCart ? "" : "none";
  if(els.paymeBtn) els.paymeBtn.style.display = isCart ? "" : "none";
  if(els.tgShareBtn) els.tgShareBtn.style.display = isCart ? "" : "none";
  if(els.clearBtn) els.clearBtn.textContent = isCart ? "Tozalash" : "Sevimlilarni tozalash";
  els.panelTitle.textContent = isCart ? "Savatcha" : "Sevimlilar";
  renderPanel(mode);
  updateCartSelectUI();

  // show + animate
  els.overlay.hidden = false;
  els.sidePanel.hidden = false;
  requestAnimationFrame(()=>{
    els.overlay.classList.add("open");
    els.sidePanel.classList.add("open");
  });
}

function closePanel(){
  if(!els.sidePanel || !els.overlay) return;

  els.overlay.classList.remove("open");
  els.sidePanel.classList.remove("open");

  // wait animation then hide
  const t = 240;
  window.setTimeout(()=>{
    els.overlay.hidden = true;
    els.sidePanel.hidden = true;
  }, t);
}





// ---------- Product detail page (separate page instead of modal) ----------
const omProductPageFetches = new Set();
const omProductPageViewed = new Set();

function findProductById(id){
  const key = String(id || "");
  return (products || []).find(x=>String(x?.id)===key || String(x?._docId)===key) || null;
}

function openProductPage(productId){
  const id = String(productId || "").trim();
  if(!id){ toast("Mahsulot topilmadi."); return; }
  activeProductId = id;
  const target = "#product/" + encodeURIComponent(id);
  if(location.hash === target){ showView("product"); }
  else location.hash = target;
}

async function omFetchProductForPage(id){
  const key = String(id || "").trim();
  if(!key || omProductPageFetches.has(key)) return;
  omProductPageFetches.add(key);
  try{ window.OrzuLoader?.show("Mahsulot yuklanmoqda",{sub:"Mahsulot tafsilotlari tayyorlanmoqda..."}); }catch(_e){}
  try{
    const snap = await getDoc(doc(db, "products", key));
    if(snap.exists()){
      const data = snap.data() || {};
      const price = (data.price ?? data.priceUZS ?? data.uzs ?? data.amount);
      const created = (data.createdAt ?? data.created_at ?? data.created ?? data.updatedAt ?? data.updated_at ?? data.updated);
      const prod = {
        id: String(data.id || snap.id),
        weightKg: Number(data.weightKg ?? data.weight_kg ?? data.weight ?? data.massKg ?? 0) || 0,
        fulfillmentType: (data.fulfillmentType || data.fulfillment || (data.isCargo ? 'cargo' : 'stock') || 'stock'),
        deliveryMinDays: (data.deliveryMinDays ?? (data.fulfillmentType==='cargo'||data.fulfillment==='cargo'||data.isCargo ? 15 : 1)),
        deliveryMaxDays: (data.deliveryMaxDays ?? (data.fulfillmentType==='cargo'||data.fulfillment==='cargo'||data.isCargo ? 30 : 7)),
        prepayRequired: (data.prepayRequired ?? ((data.fulfillmentType==='cargo'||data.fulfillment==='cargo'||data.isCargo) ? true : false)),
        ...data,
        _docId: snap.id,
        _price: parseUZS(price),
        _created: toMillis(created),
      };
      const exists = findProductById(prod.id) || findProductById(prod._docId);
      if(!exists) products.push(prod);
      omI18nProductsReady();
      buildTagCounts();
      buildCategoryTree();
      try{ await preloadProductMetrics([prod.id]); }catch(_e){}
    }
  }catch(e){ console.warn("Product page fetch failed", e); }
  finally{
    omProductPageFetches.delete(key);
    try{ window.OrzuLoader?.hide(); }catch(_e){}
    if(activeTab === "product") renderProductPage();
  }
}

function omProductPageTagsHtml(p){
  const raw = omProductTags(p).map(t=>String(t||"").trim()).filter(Boolean);
  const tags = [...new Map(raw.map(t=>[t.toLowerCase(), t])).values()].slice(0,6);
  if(!tags.length) return "";
  return tags.map(t=>{
    const cnt = tagCounts?.get?.(t.toLowerCase()) || 0;
    const count = cnt ? (cnt>99 ? "99+" : String(cnt)) : "";
    return `<button type="button" class="ppTag" data-pp-tag="${escapeHtml(t)}" title="${escapeHtml(t)} tegidagi mahsulotlar"><span>${escapeHtml(t)}</span>${count?`<b>${escapeHtml(count)}</b>`:""}</button>`;
  }).join("");
}

function omProductPageGalleryHtml(p, imgs){
  const main = imgs[0] || "";
  const total = Math.max(1, imgs.length || 1);
  const title = escapeHtml(omProductText(p,"name",p.name||"Mahsulot"));
  return `<section class="ppGallery" aria-label="Mahsulot rasmlari">
    <div class="ppGalleryShell">
      <div class="ppThumbRail" aria-label="Rasmlar ro‘yxati">
        <div class="ppThumbs" id="productPageThumbs">
          ${imgs.map((src,i)=>`<button type="button" class="ppThumb ${i===0?"active":""}" data-pp-index="${i}" data-pp-img="${escapeHtml(src)}" aria-label="${i+1}-rasm" aria-current="${i===0?"true":"false"}"><img src="${escapeHtml(src)}" alt="${title} — ${i+1}-rasm" loading="lazy" decoding="async"><span>${i+1}</span></button>`).join("")}
        </div>
      </div>
      <div class="ppMainStage">
        <div class="ppGalleryTools">
          <div class="ppGalleryCount" id="productPageImgCount"><i class="fa-regular fa-images"></i><span>1 / ${total}</span></div>
          ${total > 1 ? `<div class="ppGalleryNav"><button type="button" class="ppGalleryArrow" id="productPagePrev" aria-label="Oldingi rasm"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="ppGalleryArrow" id="productPageNext" aria-label="Keyingi rasm"><i class="fa-solid fa-chevron-right"></i></button></div>` : ``}
        </div>
        <button type="button" class="ppMainImage ppMainImageBtn" id="productPageMainBtn" aria-label="Rasmni to‘liq ekranda ko‘rish">
          <img id="productPageImg" src="${escapeHtml(main)}" alt="${title}" loading="eager" decoding="async" fetchpriority="high">
        </button>
        <div class="ppGalleryFoot">
          <span><i class="fa-solid fa-expand"></i> Kattalashtirish uchun rasmni bosing</span>
          ${total>1?`<em><i class="fa-solid fa-hand-pointer"></i> Surib ko‘ring</em>`:""}
        </div>
      </div>
    </div>
  </section>`;
}

function omIsChina1688Product(p){
  const source = String(p?.sourcePlatform || p?.source || p?.marketplace || "").toLowerCase();
  const fulfillment = String(p?.fulfillmentType || p?.fulfillment || p?.deliveryType || "").toLowerCase();
  return source.includes("1688") || fulfillment.includes("cargo") || !!p?.source1688Url || !!p?.sourceUrl1688;
}

function omProductPageCargoHtml(p){
  if(!omIsChina1688Product(p)) return "";
  const min = Math.max(1, Number(p?.deliveryMinDays || p?.pMinDays || 15) || 15);
  const max = Math.max(min, Number(p?.deliveryMaxDays || p?.pMaxDays || 30) || 30);
  const prepay = p?.prepayRequired !== false;
  return `<section class="ppCargoCard" aria-label="Xitoydan buyurtma ma’lumoti">
    <div class="ppCargoIcon"><i class="fa-solid fa-plane-arrival"></i></div>
    <div class="ppCargoCopy"><b>Xitoydan buyurtma</b><span>Mahsulot siz uchun olib kelinadi</span></div>
    <div class="ppCargoFacts"><em><i class="fa-regular fa-clock"></i>${min}–${max} kun</em>${prepay?`<em><i class="fa-solid fa-shield-halved"></i>Oldindan to‘lov</em>`:""}</div>
  </section>`;
}

function omProductPageDesktopBuyHtml(pricing){
  return `<section class="ppDesktopBuy" aria-label="Xarid qilish">
    <div><span>Jami narx</span><strong>${moneyUZS(pricing.price||0)}</strong></div>
    <button type="button" data-pp-cart><i class="fa-solid fa-cart-shopping"></i><span>Savatga qo‘shish</span></button>
  </section>`;
}


// ---------- Product detail reviews (always open at the bottom) ----------
// Lightweight by design: reviews are fetched only while the product page is open.
// This replaces the extra Sharhlar popup button and avoids a permanent realtime listener.
const omProductPageReviews = { productId:"", token:0, stars:5, hover:0 };

function omPageReviewStarsHtml(){
  const shown = omProductPageReviews.hover || omProductPageReviews.stars || 5;
  return Array.from({length:5}, (_,idx)=>{
    const n = idx + 1;
    return `<button type="button" class="ppReviewStar ${n<=shown?"active":""}" data-pp-review-star="${n}" aria-label="${n} yulduz" title="${n} / 5">★</button>`;
  }).join("");
}

function omProductPageReviewsSectionHtml(){
  return `
    <section class="ppReviewsCard" id="ppReviewsCard" aria-label="Mahsulot sharhlari">
      <div class="ppReviewsHead">
        <div>
          <span class="ppReviewsEyebrow"><i class="fa-solid fa-comments"></i> Xaridorlar fikri</span>
          <h2>Sharhlar</h2>
          <p>Faqat admin tasdiqlagan sharhlar ko‘rinadi. Fikringiz tekshiruvdan keyin chiqadi.</p>
        </div>
        <div class="ppReviewSummary" id="ppReviewStats">
          <strong>—</strong><span>Yuklanmoqda...</span>
        </div>
      </div>
      <div class="ppReviewComposer">
        <div class="ppReviewComposerTop">
          <div>
            <b>Mahsulotni baholang</b>
            <span>1 dan 5 gacha yulduz tanlang</span>
          </div>
          <div class="ppReviewStars" id="ppReviewStars">${omPageReviewStarsHtml()}</div>
        </div>
        <textarea id="ppReviewText" maxlength="400" rows="3" placeholder="Fikringizni qisqa va aniq yozing..."></textarea>
        <div class="ppReviewComposerBottom">
          <span id="ppReviewChar">0/400 • admin tekshiruvi</span>
          <button type="button" id="ppReviewSend"><i class="fa-solid fa-paper-plane"></i> Sharh yuborish</button>
        </div>
      </div>
      <div class="ppReviewsList" id="ppReviewsList">
        <div class="ppReviewsLoading"><i class="fa-solid fa-spinner fa-spin"></i> Sharhlar yuklanmoqda...</div>
      </div>
    </section>`;
}

function omProductPageReviewListHtml(list){
  if(!Array.isArray(list) || !list.length){
    return `<div class="ppReviewEmpty"><i class="fa-regular fa-message"></i><b>Hozircha sharh yo‘q</b><span>Birinchi bo‘lib fikr qoldiring.</span></div>`;
  }
  return list.map((r)=>{
    const score = Math.max(0, Math.min(5, Number(r.stars)||0));
    const stars = "★".repeat(score) + "☆".repeat(5-score);
    return `<article class="ppReviewItem">
      <div class="ppReviewItemTop">
        <div class="ppReviewAvatar"><i class="fa-solid fa-user"></i></div>
        <div class="ppReviewAuthor"><b>${escapeHtml(r.author||"Foydalanuvchi")}</b><span>${escapeHtml(formatDate(r.ts)||"Yaqinda")}</span></div>
        <div class="ppReviewItemStars" aria-label="${score} yulduz">${stars}</div>
      </div>
      ${r.text ? `<p>${escapeHtml(r.text)}</p>` : `<p class="muted">Baho qoldirilgan.</p>`}
      ${r.adminReply ? `<div class="revAdminReply"><b>OrzuMall javobi</b><span>${escapeHtml(r.adminReply)}</span></div>` : ""}
    </article>`;
  }).join("");
}

function omSyncPageReviewStars(){
  const wrap = els.productPageContent?.querySelector("#ppReviewStars");
  if(wrap) wrap.innerHTML = omPageReviewStarsHtml();
}

async function omLoadProductPageReviews(productId, {force=false}={}){
  const id = String(productId||"").trim();
  if(!id) return;
  omProductPageReviews.productId = id;
  const token = ++omProductPageReviews.token;
  const pageRoot = els.productPageContent;
  const listEl = pageRoot?.querySelector("#ppReviewsList");
  const statsEl = pageRoot?.querySelector("#ppReviewStats");
  if(!listEl || !statsEl) return;

  const cached = getStats(id);
  if(cached.count){
    statsEl.innerHTML = `<strong><i class="fa-solid fa-star"></i> ${Number(cached.avg||0).toFixed(1)}</strong><span>${cached.count} ta sharh</span>`;
  }

  try{
    const reviewsQ = query(
      collection(db, "products", id, "reviews"),
      where("moderationStatus", "==", "approved"),
      limit(60)
    );
    const [snap, st] = await Promise.all([
      getDocs(reviewsQ),
      refreshStats(id, !!force)
    ]);
    if(token !== omProductPageReviews.token || activeTab !== "product" || String(activeProductId||"") !== id) return;

    const list=[];
    snap.forEach((docu)=>{
      const d=docu.data()||{};
      list.push({
        uid:d.uid||docu.id,
        author:d.authorName||"Foydalanuvchi",
        stars:Number(d.stars)||0,
        text:String(d.text||""),
        adminReply:String(d.adminReply?.text||d.adminReplyText||""),
        ts:d.createdAt?.toMillis ? d.createdAt.toMillis() : 0
      });
    });
    list.sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    const currentRoot = els.productPageContent;
    const currentList = currentRoot?.querySelector("#ppReviewsList");
    const currentStats = currentRoot?.querySelector("#ppReviewStats");
    const enrichedList=await omEnrichReviewAuthors(list.slice(0,30));
    if(currentList) currentList.innerHTML = omProductPageReviewListHtml(enrichedList);
    if(currentStats) currentStats.innerHTML = `<strong><i class="fa-solid fa-star"></i> ${Number(st.avg||0).toFixed(1)}</strong><span>${Number(st.count||0)} ta sharh</span>`;
  }catch(_e){
    if(token !== omProductPageReviews.token) return;
    const currentList = els.productPageContent?.querySelector("#ppReviewsList");
    if(currentList) currentList.innerHTML = `<div class="ppReviewEmpty"><i class="fa-solid fa-triangle-exclamation"></i><b>Sharhlarni yuklab bo‘lmadi</b><span>Internetni tekshirib, sahifani qayta oching.</span></div>`;
  }
}

async function omSubmitProductPageReview(p){
  const id = String(p?.id||"").trim();
  if(!id) return;
  const user = auth.currentUser;
  if(!user){ toast("Sharh qoldirish uchun avval tizimga kiring.", "error"); return; }
  const textEl = els.productPageContent?.querySelector("#ppReviewText");
  const sendEl = els.productPageContent?.querySelector("#ppReviewSend");
  const text = String(textEl?.value||"").trim().slice(0,400);
  if(text && text.length < 2){ toast("Sharh matni kamida 2 ta belgidan iborat bo‘lsin.", "error"); return; }
  const stars = Math.max(1, Math.min(5, Number(omProductPageReviews.stars)||5));
  if(sendEl){ sendEl.disabled=true; sendEl.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...'; }
  try{
    const token=await user.getIdToken();
    const resp=await fetch("/.netlify/functions/review-submit",{
      method:"POST",
      headers:{"content-type":"application/json","authorization":"Bearer "+token},
      body:JSON.stringify({action:"submit_review",productId:id,stars,text})
    });
    const out=await resp.json().catch(()=>({}));
    if(!resp.ok || !out.ok) throw new Error(out.error||"review_submit_failed");
    if(textEl) textEl.value="";
    const charEl=els.productPageContent?.querySelector("#ppReviewChar"); if(charEl) charEl.textContent="0/400";
    toast("Sharhingiz yuborildi. Admin tasdiqlagach saytda ko‘rinadi.");
  }catch(_e){
    toast("Sharh yuborilmadi. Qayta urinib ko‘ring.", "error");
  }finally{
    const btn=els.productPageContent?.querySelector("#ppReviewSend");
    if(btn){ btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Sharh yuborish'; }
  }
}

function omBindProductPageReviews(p){
  const root = els.productPageContent;
  if(!root || !p) return;
  omProductPageReviews.stars = 5;
  omProductPageReviews.hover = 0;
  root.querySelector("#ppReviewStars")?.addEventListener("click", (e)=>{
    const btn=e.target.closest("[data-pp-review-star]");
    if(!btn) return;
    omProductPageReviews.stars=Math.max(1,Math.min(5,Number(btn.dataset.ppReviewStar)||5));
    omProductPageReviews.hover=0;
    omSyncPageReviewStars();
  });
  root.querySelector("#ppReviewText")?.addEventListener("input", (e)=>{
    const out=root.querySelector("#ppReviewChar");
    if(out) out.textContent=`${Math.min(400,String(e.target.value||"").length)}/400`;
  });
  root.querySelector("#ppReviewSend")?.addEventListener("click", ()=>omSubmitProductPageReview(p));
  omLoadProductPageReviews(p.id);
}

function renderProductPage(){
  const root = els.productPageContent;
  if(!root) return;
  const id = String(activeProductId || "").trim();
  if(!id){ root.innerHTML = `<div class="productPageEmpty">Mahsulot tanlanmagan.</div>`; return; }
  const p = findProductById(id);
  if(!p){
    root.innerHTML = `<div class="productPageLoading"><i class="fa-solid fa-spinner fa-spin"></i> Mahsulot yuklanmoqda...</div>`;
    omFetchProductForPage(id);
    return;
  }
  omRememberViewedProduct(p);
  if(!omProductPageViewed.has(String(p.id))){
    omProductPageViewed.add(String(p.id));
    try{ omRecordProductInteraction(p.id, "view", 1); }catch(_e){}
  }
  const sel = getSel(p);
  const imgs = getImagesFor(p, sel);
  const pricing = getVariantPricing(p, sel);
  const desc = omProductText(p, "description", p.description || p.desc || "");
  const favOn = favs.has(p.id);
  const catTrail = omQVCatTrailHtml(p);
  const catCard = omQVCatCardHtml(p);
  const tagsHtml = omProductPageTagsHtml(p);
  const isChina1688 = omIsChina1688Product(p);
  root.innerHTML = `
    <div class="ppShell ${isChina1688?"ppShellChina":"ppShellStock"}">
      <div class="ppGrid">
        ${omProductPageGalleryHtml(p, imgs)}
        <article class="ppInfo">
          <div class="ppHeadCard">
            <div class="ppCatTrail">${catTrail}</div>
            ${tagsHtml?`<div class="ppTags">${tagsHtml}</div>`:""}
            ${renderProductTypeBadge(p)?`<div class="ppAuthRow">${renderProductTypeBadge(p)}</div>`:""}
            ${renderSellerMiniLine(p,{page:true})?`<div class="ppSellerRow">${renderSellerMiniLine(p,{page:true})}</div>`:""}
            <h1>${escapeHtml(omProductText(p,"name",p.name||"Nomsiz mahsulot"))}</h1>
            <div class="ppPriceLine"><strong>${moneyUZS(pricing.price||0)}</strong>${pricing.oldPrice?`<del>${moneyUZS(pricing.oldPrice)}</del>`:""}</div>
          </div>
          ${omProductPageCargoHtml(p)}
          <div class="ppVariantCard">${omQVVariantHtml(p)}</div>
          <div class="ppTrustGrid">${omQVTrustHtml(p)}</div>
          ${omProductPageDesktopBuyHtml(pricing)}
          <div class="ppMetrics">${omQVMetricHtml(p)}</div>
          <div class="ppActionGrid">
            <button type="button" class="ppAction" data-pp-info><i class="fa-solid fa-circle-info"></i><span>Tavsif</span></button>
            <button type="button" class="ppAction" data-pp-video><i class="fa-brands fa-youtube"></i><span>Video</span></button>
            <button type="button" class="ppAction ${favOn?"active":""}" data-pp-fav><i class="fa-${favOn?"solid":"regular"} fa-heart"></i><span>Sevimli</span></button>
          </div>
          <div class="cxAlertPanel" data-cx-alert-panel>
            <div class="cxAlertHead"><div><b>Mahsulotni kuzatish</b><br><span>Muhim o‘zgarishlardan xabardor bo‘ling</span></div><i class="fa-regular fa-bell"></i></div>
            <div class="cxAlertGrid">
              <button type="button" class="cxAlertBtn" data-cx-alert="price_drop"><i class="fa-solid fa-tags"></i><span>Narx tushganda xabar</span></button>
              <button type="button" class="cxAlertBtn" data-cx-alert="back_in_stock"><i class="fa-solid fa-box-open"></i><span>Omborga qaytganda xabar</span></button>
            </div>
          </div>
          ${catCard?`<div class="ppCategoryCard">${catCard}</div>`:""}
          ${desc?`<details class="ppDesc"><summary>Tavsifni ko‘rish</summary><p>${escapeHtml(desc)}</p></details>`:""}
        </article>
      </div>
      <div class="ppStickyBuy">
        <div><span>Jami</span><strong>${moneyUZS(pricing.price||0)}</strong></div>
        <button type="button" id="productPageCartBtn"><i class="fa-solid fa-cart-shopping"></i> Savatga qo‘shish</button>
      </div>
      ${omProductPageReviewsSectionHtml()}
    </div>`;
  bindProductPage(p);
  try{ omI18nRefresh(40); }catch(_e){}
}

function bindProductPage(p){
  const root = els.productPageContent;
  if(!root || !p) return;
  root.querySelectorAll("[data-qv-cat-path]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      omOpenCategoryFromQuickView(omCatPathFromAttr(btn.getAttribute("data-qv-cat-path")));
    });
  });
  root.querySelectorAll("[data-pp-tag]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      omOpenTagFromQuickView(btn.getAttribute("data-pp-tag") || btn.textContent || "");
    });
  });
  root.querySelectorAll("[data-store-id]").forEach(btn=>btn.addEventListener("click",(e)=>{
    e.preventDefault();e.stopPropagation();openStorePage(btn.getAttribute("data-store-id"));
  }));
  const galleryThumbs = Array.from(root.querySelectorAll(".ppThumb"));
  const galleryImages = galleryThumbs.map(btn=>btn.getAttribute("data-pp-img") || "").filter(Boolean);
  const galleryMainImg = root.querySelector("#productPageImg");
  const galleryMainBtn = root.querySelector("#productPageMainBtn");
  const galleryCount = root.querySelector("#productPageImgCount");
  let galleryIndex = Math.max(0, galleryThumbs.findIndex(btn=>btn.classList.contains("active")));

  // v152: historical gallery CSS layers can compete on small screens.
  // Lock the real product image to a non-cropping layout at runtime as well.
  const forceGalleryContain = ()=>{
    if(galleryMainBtn){
      galleryMainBtn.style.setProperty("display", "flex", "important");
      galleryMainBtn.style.setProperty("align-items", "center", "important");
      galleryMainBtn.style.setProperty("justify-content", "center", "important");
      galleryMainBtn.style.setProperty("overflow", "hidden", "important");
      galleryMainBtn.style.setProperty("padding", "0", "important");
    }
    if(galleryMainImg){
      galleryMainImg.style.setProperty("display", "block", "important");
      galleryMainImg.style.setProperty("width", "auto", "important");
      galleryMainImg.style.setProperty("height", "auto", "important");
      galleryMainImg.style.setProperty("min-width", "0", "important");
      galleryMainImg.style.setProperty("min-height", "0", "important");
      galleryMainImg.style.setProperty("max-width", "100%", "important");
      galleryMainImg.style.setProperty("max-height", "100%", "important");
      galleryMainImg.style.setProperty("object-fit", "contain", "important");
      galleryMainImg.style.setProperty("object-position", "center center", "important");
      galleryMainImg.style.setProperty("transform", "none", "important");
      galleryMainImg.style.setProperty("filter", "none", "important");
      galleryMainImg.style.setProperty("margin", "auto", "important");
    }
  };
  galleryMainImg?.addEventListener("load", forceGalleryContain);
  forceGalleryContain();

  const syncGallery = (nextIndex, opts={})=>{
    const total = galleryImages.length || 1;
    galleryIndex = Math.max(0, Math.min(total - 1, Number(nextIndex) || 0));
    const src = galleryImages[galleryIndex] || galleryImages[0] || "";
    if(galleryMainImg){
      galleryMainImg.src = src;
      forceGalleryContain();
      requestAnimationFrame(forceGalleryContain);
    }
    if(galleryCount){
      const label = galleryCount.querySelector("span");
      if(label) label.textContent = `${galleryIndex + 1} / ${total}`;
      else galleryCount.textContent = `${galleryIndex + 1} / ${total}`;
    }
    galleryThumbs.forEach((thumb, idx)=>{
      const active = idx === galleryIndex;
      thumb.classList.toggle("active", active);
      thumb.setAttribute("aria-current", active ? "true" : "false");
      if(active && opts.scroll !== false){
        try{ thumb.scrollIntoView({ behavior:"smooth", block:"nearest", inline:"center" }); }catch(_e){}
      }
    });
  };

  galleryThumbs.forEach((btn, idx)=>{
    btn.addEventListener("click", ()=> syncGallery(idx));
  });
  const shiftGallery = (step)=>{
    const total = galleryImages.length || 1;
    syncGallery((galleryIndex + step + total) % total);
  };
  root.querySelector("#productPagePrev")?.addEventListener("click", ()=> shiftGallery(-1));
  root.querySelector("#productPageNext")?.addEventListener("click", ()=> shiftGallery(1));
  let swipeStartX = null;
  let galleryDidSwipe = false;
  galleryMainBtn?.addEventListener("touchstart", (e)=>{ swipeStartX = e.touches?.[0]?.clientX ?? null; galleryDidSwipe = false; }, {passive:true});
  galleryMainBtn?.addEventListener("touchend", (e)=>{
    if(swipeStartX == null) return;
    const endX = e.changedTouches?.[0]?.clientX ?? swipeStartX;
    const delta = endX - swipeStartX;
    swipeStartX = null;
    if(Math.abs(delta) > 42 && galleryImages.length > 1){ galleryDidSwipe = true; shiftGallery(delta < 0 ? 1 : -1); }
  }, {passive:true});
  galleryMainBtn?.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowLeft"){ e.preventDefault(); shiftGallery(-1); }
    if(e.key === "ArrowRight"){ e.preventDefault(); shiftGallery(1); }
  });
  galleryMainBtn?.addEventListener("click", ()=>{
    if(galleryDidSwipe){ galleryDidSwipe = false; return; }
    openImageViewer({
      productId: p.id,
      title: omProductText(p,"name",p.name||"Mahsulot"),
      pricing: getVariantPricing(p, getSel(p)),
      rating: Number(p?.rating || 0),
      reviewsCount: Number(p?.reviewsCount || p?.reviews || 0),
      tags: omProductTags(p),
      images: galleryImages,
      startIndex: galleryIndex,
      onSelect: (i)=>syncGallery(i, {scroll:false}),
      imageOnly: true
    });
  });
  syncGallery(galleryIndex, {scroll:false});
  root.querySelectorAll("#productPageCartBtn,[data-pp-cart]").forEach(btn=>btn.addEventListener("click", ()=> handleAddToCart(p, { openCartAfter:false })));
  root.querySelector("[data-pp-info]")?.addEventListener("click", ()=> openMini("info", p.id));
  root.querySelector("[data-pp-video]")?.addEventListener("click", ()=> openMini("video", p.id));
  omBindProductPageReviews(p);
  root.querySelector("[data-pp-fav]")?.addEventListener("click", (e)=>{
    e.preventDefault();
    if(favs.has(p.id)) favs.delete(p.id); else { favs.add(p.id); logEvent('favorite', p.id); }
    saveLS(LS.favs, Array.from(favs));
    updateBadges();
    renderProductPage();
  });
  root.querySelectorAll("[data-cx-alert]").forEach(btn=>btn.addEventListener("click",()=>omToggleProductAlert(p.id,btn.getAttribute("data-cx-alert"))));
  omRefreshProductAlertButtons(p.id);
}

// ---------- Premium product quick view helpers ----------
function omQVProduct(){
  try{ return (viewer && viewer.product) || (products || []).find(x=>String(x.id)===String(viewer?.productId)); }catch(e){ return null; }
}
function omCatPathAttr(ids){ return encodeURIComponent(JSON.stringify(ids || [])); }
function omCatPathFromAttr(v){ try{ return JSON.parse(decodeURIComponent(String(v||"%5B%5D"))) || []; }catch(e){ return []; } }
function omQVCatTrailHtml(p){
  const ids = omProductCategoryPathIds(p);
  if(!ids.length) return `<span class="qvCrumb muted">Kategoriya tanlanmagan</span>`;
  return ids.map((id,idx)=>{
    const def=omGetCategoryDef(id);
    const icon = idx===0 ? omCategoryIconHtml(def) : "";
    const name=escapeHtml(omCategoryLangName(def)||id);
    const pathAttr = omCatPathAttr(ids.slice(0, idx+1));
    return `<button type="button" class="qvCrumb qvCrumbBtn" data-qv-cat-path="${pathAttr}" title="Shu kategoriyadagi mahsulotlarni ko‘rish">${icon}<span>${name}</span></button>${idx<ids.length-1?`<span class="qvCrumbSep">›</span>`:""}`;
  }).join("");
}
function omQVCatCardHtml(p){
  const ids = omProductCategoryPathIds(p);
  if(!ids.length) return "";
  const leaf = omGetCategoryDef(ids[ids.length-1]);
  const root = omGetCategoryDef(ids[0]);
  const path = ids.map(id=>escapeHtml(omCategoryLangName(omGetCategoryDef(id))||id)).join(" <b>›</b> ");
  return `<button type="button" class="qvCatCardBtn" data-qv-cat-path="${omCatPathAttr(ids)}" title="Shu kategoriyadagi mahsulotlarni ochish"><div class="qvCatHeroIcon">${omCategoryIconHtml(leaf||root)}</div><div class="qvCatHeroText"><span>Kategoriya yo‘li</span><strong>${path}</strong><em>${ids.length} darajali katalog • bosib oching</em></div><i class="fa-solid fa-arrow-right qvCatArrow"></i></button>`;
}
function omOpenCategoryFromQuickView(path){
  const ids = (Array.isArray(path) ? path : []).map(x=>omGetCategoryDef(x)?.id || String(x||"")).filter(Boolean);
  if(!ids.length) return;
  activeCatPath = [...ids];
  appliedCatPath = [...ids];
  if(els?.q) els.q.value = "";
  applyFilterSort();
  closeImageViewer();
  goTab("home");
  const label = ids.map(id=>omCategoryLangName(omGetCategoryDef(id))||id).filter(Boolean).join(" › ");
  toast(`${label} kategoriyasi ochildi`);
}
function omBindQvCategoryClicks(){
  const root = document.getElementById("imgViewer");
  if(!root) return;
  root.querySelectorAll("[data-qv-cat-path]").forEach(btn=>{
    if(btn.dataset.boundCat === "1") return;
    btn.dataset.boundCat = "1";
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      omOpenCategoryFromQuickView(omCatPathFromAttr(btn.getAttribute("data-qv-cat-path")));
    });
  });
}

function omOpenTagFromQuickView(tag){
  const clean = String(tag || "").trim();
  if(!clean) return;
  selectedTag = clean;
  activeCatPath = [];
  appliedCatPath = [];
  if(els?.q) els.q.value = "";
  applyFilterSort();
  closeImageViewer();
  goTab("home");
  toast(`#${clean} tegi bo‘yicha mahsulotlar ochildi`);
}
function omBindQvTagClicks(){
  const root = document.getElementById("imgViewer");
  if(!root) return;
  root.querySelectorAll("[data-qv-tag]").forEach(btn=>{
    if(btn.dataset.boundTag === "1") return;
    btn.dataset.boundTag = "1";
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      omOpenTagFromQuickView(btn.getAttribute("data-qv-tag") || btn.textContent || "");
    });
  });
}
function omQVVariantHtml(p){
  const colors = normColors(p||{});
  const sizes = normSizes(p||{});
  const parts=[];
  if(colors.length){
    parts.push(`<div class="qvVarGroup"><span>Ranglar</span><div class="qvSwatches">${colors.slice(0,12).map(c=>`<i class="qvSwatch" title="${escapeHtml(c.name)}" style="${c.hex?`--qvc:${escapeHtml(c.hex)}`:""}"></i>`).join("")}${colors.length>12?`<b>+${colors.length-12}</b>`:""}</div></div>`);
  }
  if(sizes.length){
    parts.push(`<div class="qvVarGroup"><span>O‘lchamlar</span><div class="qvSizeList">${sizes.slice(0,10).map(s=>`<b>${escapeHtml(s)}</b>`).join("")}${sizes.length>10?`<b>+${sizes.length-10}</b>`:""}</div></div>`);
  }
  return parts.length ? parts.join("") : `<div class="qvVarEmpty"><i class="fa-solid fa-check"></i> Variant tanlash shart emas</div>`;
}
function omQVTrustHtml(p){
  const t = String(p?.fulfillmentType || p?.pType || p?.deliveryType || "stock").toLowerCase();
  const weight = Number(p?.weightKg ?? p?.weight ?? p?.massKg ?? 0) || 0;
  const min = Number(p?.deliveryMinDays || p?.pMinDays || 0) || 0;
  const max = Number(p?.deliveryMaxDays || p?.pMaxDays || 0) || 0;
  const eta = max ? `${omDeliveryDateRange(p)} • ${min||1}–${max} kun` : (t.includes("cargo") ? omDeliveryDateRange({...p,deliveryMinDays:15,deliveryMaxDays:30}) : "Tez yetkazish");
  return `
    <div class="qvTrustItem"><i class="fa-solid fa-truck-fast"></i><span>Yetkazish</span><b>${eta}</b></div>
    <div class="qvTrustItem"><i class="fa-solid fa-box"></i><span>Holati</span><b>${t.includes("cargo") ? "Keltirib beramiz" : "O‘zimizda"}</b></div>
    <div class="qvTrustItem"><i class="fa-solid fa-weight-hanging"></i><span>Vazn</span><b>${weight ? `${weight} kg` : "—"}</b></div>`;
}
function omQVMetricHtml(p){
  const type = String(p?.productType || p?.authType || "").trim();
  const id = String(p?.id || p?._docId || "").trim();
  const m = omGetProductMetrics(p);
  const arr=[];
  if(type) arr.push(`<span class="qvMetricType"><i class="fa-solid fa-certificate"></i><b>${escapeHtml(type.toUpperCase())}</b><small>turi</small></span>`);
  if(id) arr.push(`<span class="qvMetricId"><i class="fa-solid fa-barcode"></i><b>${escapeHtml(id)}</b><small>ID</small></span>`);
  arr.push(`<span class="qvMetricViews"><i class="fa-regular fa-eye"></i><b>${omCount(m.views||0)}</b><small>ko‘rish</small></span>`);
  arr.push(`<span class="qvMetricCart"><i class="fa-solid fa-cart-shopping"></i><b>${omCount(m.cartAdds||0)}</b><small>savat</small></span>`);
  arr.push(`<span class="qvMetricFav"><i class="fa-solid fa-heart"></i><b>${omCount(m.favoriteAdds||0)}</b><small>sevimli</small></span>`);
  arr.push(`<span class="qvMetricBuy"><i class="fa-solid fa-bag-shopping"></i><b>${omCount(m.purchases||0)}</b><small>sotuv</small></span>`);
  arr.push(`<span class="qvMetricScore"><i class="fa-solid fa-fire"></i><b>${omCompactMetric(m.score||0)}</b><small>ball</small></span>`);
  return arr.join("");
}
function omRenderQuickViewPro(){
  const p = omQVProduct();
  const byId=(id)=>document.getElementById(id);
  const trail=byId("qvCategoryTrail"); if(trail) trail.innerHTML = p ? omQVCatTrailHtml(p) : "";
  const catCard=byId("qvCategoryCard"); if(catCard){ catCard.innerHTML = p ? omQVCatCardHtml(p) : ""; catCard.style.display = p ? "" : "none"; }
  const variant=byId("qvVariantBox"); if(variant){ variant.innerHTML = p ? omQVVariantHtml(p) : ""; }
  const trust=byId("qvTrustGrid"); if(trust){ trust.innerHTML = p ? omQVTrustHtml(p) : ""; }
  const metrics=byId("qvProMetrics"); if(metrics){ metrics.innerHTML = p ? omQVMetricHtml(p) : ""; metrics.style.display = p ? "" : "none"; }
  omBindQvCategoryClicks();
}

// ---------- Image viewer (fullscreen gallery) ----------
function renderViewer(){
  if(!els.imgViewer || !els.imgViewerImg || !els.imgThumbs) return;
  const imgs = viewer.images || [];
  const idx = clampIdx(viewer.idx || 0, imgs.length);
  viewer.idx = idx;
  // Header title
  if(els.imgViewerName) els.imgViewerName.textContent = viewer.title || "Rasm";

  // Price + meta (optional)
  const pr = viewer.pricing || null;
  if(els.qvPrice) els.qvPrice.textContent = pr ? moneyUZS(pr.price||0) : "";
  if(els.qvOldPrice){
    const op = pr ? (pr.oldPrice||0) : 0;
    els.qvOldPrice.textContent = op ? moneyUZS(op) : "";
    els.qvOldPrice.style.display = op ? "" : "none";
  }
  if(els.qvRating){
    const r = Number(viewer.rating||0);
    const c = Number(viewer.reviewsCount||0);
    els.qvRating.textContent = (r||c) ? `${r ? r.toFixed(1) : "0.0"} (${c||0})` : "";
    els.qvRating.style.display = (r||c) ? "" : "none";
  }
  if(els.qvBadge){
    const b = (viewer.badge||"").toString().trim();
    els.qvBadge.textContent = b;
    els.qvBadge.style.display = b ? "" : "none";
  }
  if(els.qvTags){
    const rawTags = (Array.isArray(viewer.tags) ? viewer.tags : []).map(t=>String(t||"").trim()).filter(Boolean);
    const tagsArr = [...new Map(rawTags.map(t=>[t.toLowerCase(), t])).values()];
    const shownTags = tagsArr.slice(0,4);
    const countLabel = (n)=>{
      const v = Number(n || 0);
      if(!v) return "";
      return v > 99 ? "99+" : String(v);
    };
    els.qvTags.innerHTML = shownTags.map(t=>{
      const label = String(t || "").trim();
      const cnt = tagCounts?.get?.(label.toLowerCase()) || 0;
      const c = countLabel(cnt);
      return `<button type="button" class="qvTag" data-qv-tag="${escapeHtml(label)}" title="${escapeHtml(label)} tegidagi mahsulotlarni ko‘rish"><span>${escapeHtml(label)}</span>${c?`<b class="qvTagCount">${escapeHtml(c)}</b>`:""}</button>`;
    }).join("") + (tagsArr.length > shownTags.length ? `<span class="qvMoreTags" title="Yana ${tagsArr.length-shownTags.length} ta teg bor">+${tagsArr.length-shownTags.length}</span>` : "");
    els.qvTags.style.display = tagsArr.length ? "" : "none";
  }

  // Premium quick-view category/product system
  omRenderQuickViewPro();
  omBindQvTagClicks();

  // Description is opened from the Tavsif/Tasnif button; keep inline quick-view compact.
  if(els.imgViewerDesc) els.imgViewerDesc.textContent = "";

  els.imgViewerImg.src = imgs[idx] || "";

  // thumbs
  els.imgThumbs.innerHTML = "";
  imgs.forEach((src, i)=>{
    const b = document.createElement("button");
    b.className = "thumb" + (i===idx ? " active" : "");
    b.innerHTML = `<img src="${src}" alt="thumb" loading="lazy" decoding="async" />`;
    b.addEventListener("click", ()=>{
      viewer.idx = i;
      renderViewer();
      viewer.onSelect?.(i);
    });
    els.imgThumbs.appendChild(b);
  });

  const hasNav = imgs.length > 1;
  if(els.imgPrev) els.imgPrev.style.display = hasNav ? "" : "none";
  if(els.imgNext) els.imgNext.style.display = hasNav ? "" : "none";
  // Legacy inline viewer reviews were removed. Product-page reviews load only at the page bottom.
  omI18nRefresh(80);
}

function openImageViewer({productId, title, desc, pricing, rating, reviewsCount, tags, badge, images, startIndex=0, onSelect, imageOnly=false}){
  if(!els.imgViewer) return;
  viewer = {
    open: true,
    productId: productId || null,
    title: title || "Rasm",
    desc: desc || "",
    pricing: pricing || null,
    rating: Number.isFinite(+rating) ? +rating : 0,
    reviewsCount: Number.isFinite(+reviewsCount) ? +reviewsCount : 0,
    tags: Array.isArray(tags) ? tags : [],
    badge: badge || "",
    product: (products || []).find(x=>String(x.id)===String(productId)) || null,
    images: (images||[]).filter(Boolean),
    idx: startIndex || 0,
    onSelect: onSelect || null,
    imageOnly: !!imageOnly
  };
  if(els.imgViewerShell) els.imgViewerShell.classList.toggle("imageOnly", !!imageOnly);
  try{ els.imgViewer?.classList.toggle("imageOnly", !!imageOnly); }catch(e){}
  showOverlay(els.imgViewer);
  renderViewer();
  if(productId) omRecordProductInteraction(productId, "view", 1);

  // Make scroll stable across devices (some browsers need an explicit reset)
  try{
    const panel = els.imgViewer.querySelector('.qvProductPane') || els.imgViewer.querySelector('.qvPanel');
    if(panel){
      panel.scrollTop = 0;
      panel.style.webkitOverflowScrolling = 'touch';
    }
  }catch(e){}
}


// Compatibility helper: cards and old buttons now open the product detail page.
function openViewer(productId){
  openProductPage(productId);
}

function closeImageViewer(){
  if(!els.imgViewer) return;
  viewer.open = false;
  if(els.imgViewerShell) els.imgViewerShell.classList.remove("imageOnly");
  try{ els.imgViewer?.classList.remove("imageOnly"); }catch(e){}
  cleanupReviewSubscriptions();
  hideOverlay(els.imgViewer);
}

function closeImgViewer(){
  // backward compatible alias (some handlers still call this)
  return closeImageViewer();
}
window.closeImgViewer = closeImgViewer;
window.closeImageViewer = closeImageViewer;


// ---------- Mini modal (Info / Video / Sharh) ----------
const miniState = { open:false, kind:null, productId:null, unsub:null };

// mini reviews composer
let miniDraftStars = 5;
let miniHoverStars = 0;
function renderMiniStarSelector(container){
  if(!container) return;
  container.innerHTML = "";
  const shown = miniHoverStars || miniDraftStars;
  for(let i=1;i<=5;i++){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "starBtn" + (i<=shown ? " active" : "");
    b.title = `${i} / 5`;
    b.setAttribute("aria-label", `${i} yulduz`);
    b.innerHTML = `<img src="${omStarIconSrc(i<=shown)}" alt="${i} yulduz" loading="lazy" decoding="async">`;
    b.addEventListener("mouseenter", ()=>{ miniHoverStars=i; renderMiniStarSelector(container); });
    b.addEventListener("focus", ()=>{ miniHoverStars=i; renderMiniStarSelector(container); });
    b.addEventListener("mouseleave", ()=>{ miniHoverStars=0; renderMiniStarSelector(container); });
    b.addEventListener("blur", ()=>{ miniHoverStars=0; renderMiniStarSelector(container); });
    b.addEventListener("click", ()=>{ miniDraftStars=i; miniHoverStars=0; renderMiniStarSelector(container); });
    container.appendChild(b);
  }
}


function cleanupMiniSubs(){
  try{ if(typeof miniState.unsub === "function") miniState.unsub(); }catch(e){}
  miniState.unsub = null;
}

function parseYouTubeEmbed(url){
  const u = String(url||"").trim();
  if(!u) return "";
  try{
    // youtu.be/<id>
    let m = u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
    if(m && m[1]) return `https://www.youtube.com/embed/${m[1]}`;
    // youtube.com/watch?v=<id>
    m = u.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
    if(m && m[1]) return `https://www.youtube.com/embed/${m[1]}`;
    // youtube.com/shorts/<id>
    m = u.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
    if(m && m[1]) return `https://www.youtube.com/embed/${m[1]}`;
    // already embed
    if(/youtube\.com\/embed\//i.test(u)) return u;
  }catch(e){}
  return u; // fallback: try as-is
}

function omStarIconSrc(active){
  return active ? "./assets/review-star-filled-64.webp" : "./assets/review-star-empty-64.webp";
}
function omRenderStarIcons(score, extraClass=""){
  const s = Math.max(0, Math.min(5, Number(score)||0));
  return `<span class="starIcons ${extraClass}">${Array.from({length:5}, (_,i)=>`<img src="${omStarIconSrc(i<s)}" alt="" loading="lazy" decoding="async">`).join("")}</span>`;
}

function renderMiniReviewsList(list){
  if(!els.miniBody) return;
  const wrap = document.createElement("div");
  if(!list.length){
    wrap.innerHTML = `<div class="revItem"><div class="revItemText">Hozircha sharh yo‘q.</div></div>`;
    return wrap;
  }
  for(const r of list){
    const item = document.createElement("div");
    item.className = "revItem";
    const s = Math.max(0, Math.min(5, Number(r.stars)||0));
    item.innerHTML = `
      <div class="revItemTop">
        <div class="revItemName">${escapeHtml(r.author||"Foydalanuvchi")}</div>
        <div class="revItemStars">${omRenderStarIcons(s,'small')}</div>
      </div>
      <div class="revItemText">${escapeHtml(r.text||"")}</div>
      ${r.adminReply ? `<div class="revAdminReply"><b>OrzuMall javobi</b><span>${escapeHtml(r.adminReply)}</span></div>` : ""}
    `;
    wrap.appendChild(item);
  }
  return wrap;
}

async function openMini(kind, productId){
  const p = (products || []).find(x=>String(x.id)===String(productId));
  if(!p){ toast("Mahsulot topilmadi."); return; }

  cleanupMiniSubs();
  miniState.open = true;
  miniState.kind = kind;
  miniState.productId = String(productId);

  if(!els.miniModal || !els.miniTitle || !els.miniBody) return;

  const titleMap = { info:"Tavsif", video:"Video", reviews:"Sharhlar" };
  els.miniTitle.textContent = titleMap[kind] || "Ma'lumot";
  els.miniBody.innerHTML = "";

  // content
  if(kind === "info"){
    const desc = omProductText(p, "description", p.description || p.desc || "").toString().trim();
    els.miniBody.innerHTML = `
      <div class="miniDesc">${desc ? escapeHtml(desc) : `<span class="muted">Tavsif kiritilmagan.</span>`}</div>
    `;
  } else if(kind === "video"){
    const y = (p.youtubeUrl || p.videoUrl || p.youtube || "").toString().trim();
    if(!y){
      els.miniBody.innerHTML = `<div class="muted">Bu mahsulot uchun video link qo‘shilmagan.</div>`;
    } else {
      const emb = parseYouTubeEmbed(y);
      els.miniBody.innerHTML = `
        <div class="miniVideo"><iframe src="${escapeHtml(emb)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
        <div class="muted" style="margin-top:10px; font-size:12px;">Agar video ochilmasa, link noto‘g‘ri bo‘lishi mumkin.</div>
      `;
    }
  } else if(kind === "reviews"){
    // header stats
    try{
      const st = await refreshStats(p.id, true);
      const meta = document.createElement("div");
      meta.className = "miniMeta miniReviewMeta";
      meta.innerHTML = `
        <div class="miniStatCard">
          <div class="miniStatLabel">Umumiy baho</div>
          <div class="miniStatValue">${omRenderStarIcons(Math.round(st.avg || 0),'hero')}<b>${st.avg ? st.avg.toFixed(1) : "0.0"}</b></div>
        </div>
        <div class="miniStatCard">
          <div class="miniStatLabel">Sharhlar soni</div>
          <div class="miniStatValue"><i class="fa-solid fa-message"></i><b>${st.count}</b></div>
        </div>
      `;
      els.miniBody.appendChild(meta);
    }catch(e){}


    // composer (stars + text)
    const composer = document.createElement("div");
    composer.className = "miniComposer";
    composer.innerHTML = `
      <div class="revLabelRow">
        <div class="revLabel">Baholang</div>
        <div class="revHint">Belgilang</div>
      </div>
      <div class="revStars" id="miniRevStars"></div>
      <div class="revLabelRow">
        <div class="revLabel">Sharh</div>
        <div class="revHint"><span id="miniChar">0</span>/400</div>
      </div>
      <textarea class="revText" id="miniRevText" rows="3" placeholder="Qisqa va aniq yozing (masalan: sifat zo‘r, yetkazish tez)…"></textarea>
      <button class="revBtn" id="miniRevSend"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Sharh yuborish</button>
      <div class="muted miniRevNote">Sharh qoldirish uchun kirish talab qilinadi.</div>
    `;
    els.miniBody.appendChild(composer);

    const miniStarsEl = composer.querySelector("#miniRevStars");
    const miniTextEl = composer.querySelector("#miniRevText");
    const miniCharEl = composer.querySelector("#miniChar");
    const miniSendEl = composer.querySelector("#miniRevSend");
    miniDraftStars = 5; miniHoverStars = 0;
    renderMiniStarSelector(miniStarsEl);

    // char counter
    const syncMiniChar = ()=>{
      if(!miniCharEl) return;
      const n = Math.min(400, (miniTextEl?.value || "").length);
      miniCharEl.textContent = String(n);
    };
    miniTextEl?.addEventListener("input", syncMiniChar);
    syncMiniChar();

    miniSendEl.addEventListener("click", async ()=>{
      const user = auth.currentUser;
      if(!user){ alert("Sharh qoldirish uchun avval kirish qiling."); return; }
      const stars = Math.max(1, Math.min(5, Number(miniDraftStars)||5));
      const text = (miniTextEl.value || "").trim().slice(0, 400);

      // allow stars-only; if text is present it should be at least 2 chars
      if(text && text.length < 2){
        alert("Sharh matni kamida 2 ta belgidan iborat bo‘lsin.");
        return;
      }

      miniSendEl.disabled = true;
      const oldLabel = miniSendEl.textContent;
      miniSendEl.textContent = "Yuborilmoqda...";

      try{
        await omSubmitReviewSecure(String(p.id), stars, text);

        miniTextEl.value = "";
        await refreshStats(String(p.id), true);
        applyFilterSort();
      }catch(err){
        alert("Sharh yuborishda xatolik. Keyinroq urinib ko‘ring.");
      }finally{
        miniSendEl.disabled = false;
        miniSendEl.textContent = oldLabel;
      }
    });


    const listWrap = document.createElement("div");
    listWrap.innerHTML = `<div class="muted">Yuklanmoqda...</div>`;
    els.miniBody.appendChild(listWrap);

    const q = query(
      collection(db, "products", String(p.id), "reviews"),
      where("moderationStatus", "==", "approved"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    miniState.unsub = onSnapshot(q, async (snap)=>{
      const list = [];
      snap.forEach((docu)=>{
        const d = docu.data() || {};
        list.push({
          uid: d.uid || docu.id,
          author: d.authorName || "Foydalanuvchi",
          stars: Number(d.stars)||0,
          text: (d.text||"").toString(),
          adminReply: (d.adminReply?.text || d.adminReplyText || "").toString(),
          ts: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0
        });
      });
      const enrichedList=await omEnrichReviewAuthors(list);
      listWrap.innerHTML = "";
      listWrap.appendChild(renderMiniReviewsList(enrichedList));
    }, ()=>{});
  }

  showOverlay(els.miniModal);
}

function closeMini(){
  // Stop any playing media (YouTube iframe) to prevent audio after close
  try{
    const ifr = els?.miniBody ? els.miniBody.querySelector("iframe") : null;
    if(ifr){
      ifr.src = "about:blank";
      ifr.remove();
    }
  }catch(e){}
  miniState.open = false;
  cleanupMiniSubs();
  hideOverlay(els.miniModal);
}


window.openMini = openMini;
window.closeMini = closeMini;



function stepViewer(dir){
  const n = viewer.images?.length || 0;
  if(n <= 1) return;
  viewer.idx = clampIdx((viewer.idx||0) + dir, n);
  renderViewer();
  viewer.onSelect?.(viewer.idx);
}

// ---------- Reviews UI (in fullscreen viewer) ----------
let draftStars = 5;
let hoverStars = 0;

function renderStarSelector(){
  if(!els.revStars) return;
  els.revStars.innerHTML = "";
  const shown = hoverStars || draftStars;
  for(let i=1;i<=5;i++){
    const b = document.createElement("button");
    b.className = "starBtn" + (i<=shown ? " active" : "");
    b.type = "button";
    b.title = `${i} / 5`;
    b.textContent = "★";
    b.addEventListener("mouseenter", ()=>{ hoverStars = i; renderStarSelector(); });
    b.addEventListener("focus", ()=>{ hoverStars = i; renderStarSelector(); });
    b.addEventListener("mouseleave", ()=>{ hoverStars = 0; renderStarSelector(); });
    b.addEventListener("blur", ()=>{ hoverStars = 0; renderStarSelector(); });
    b.addEventListener("click", ()=>{
      draftStars = i;
      hoverStars = 0;
      renderStarSelector();
    });
    els.revStars.appendChild(b);
  }
}


// --- Review images (selection + preview) ---
function renderReviewsUI(productId){
  if(!productId) return;
  renderStarSelector();
  // Firestore realtime updates (subscribe once per opened product)
  if(viewerProductId !== productId) subscribeReviews(productId);
}


function renderVariantLine(ci){
  if(!ci) return "";
  const parts = [];
  if(ci.color) parts.push(ci.color);
  if(ci.size) parts.push(ci.size);
  if(parts.length===0) return "";
  return `<div class="ptags">${parts.map(x=>`#${escapeHtml(x)}`).join(" ")}</div>`;
}

function renderPanel(mode){

  els.panelList.innerHTML = "";
  const list = [];
  if(mode === "cart") syncCartSelected(true);

  if(mode === "fav"){
    for(const id of favs){
      const p = products.find(x=>x.id===id);
      if(p) list.push({p, qty:0});
    }
  } else {
    for(const ci of cart){
      const p = products.find(x=>x.id===ci.id);
      if(p) list.push({p, qty: ci.qty || 1, ci});
    }
  }

  els.panelEmpty.hidden = list.length !== 0;

  let total = 0;

  for(const row of list){
    const {p, qty} = row;
    if(mode === "cart" && cartSelected.has(row.ci?.key)) total += (getVariantPricing(p, {color: row.ci?.color || null, size: row.ci?.size || null}).price||0) * qty;

    const imgSrc = (mode === "cart")
      ? (row.ci?.image || getCurrentImage(p, {color: row.ci?.color || null, size: row.ci?.size || null, imgIdx: 0}))
      : getCurrentImage(p, getSel(p));

    const item = document.createElement("div");
    item.className = "cartItem cartPremiumItem";
    item.innerHTML = `
      <img class="cartImg" src="${imgSrc||""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" loading="lazy" decoding="async" />
      <div class="cartMeta">
        ${mode==="cart" ? `<label class="cartPick"><input type="checkbox" class="cartPickBox" data-pick="${escapeHtml(row.ci.key)}" ${cartSelected.has(row.ci.key) ? "checked" : ""} /><span></span></label>` : ""}
        <div class="cartTitle">${escapeHtml(omProductText(p, "name", p.name || "Nomsiz"))}</div>
        ${mode==="cart" ? (renderVariantLine(row.ci) + (((_normPType(p)==="cargo" || p.prepayRequired===true)) ? `<div class="cartPrepay"><span class="prepayPill"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Oldindan to‘lov</span></div>` : ``)) : ""}
        <div class="cartRow">
          <div class="price">${moneyUZS(getVariantPricing(p, {color: row.ci?.color || null, size: row.ci?.size || null}).price||0)}</div>
          <button class="removeBtn" title="O‘chirish"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
        ${mode==="cart" ? `
        <div class="cartRow">
          <div class="qty">
            <button data-q="-">−</button>
            <span>${qty}</span>
            <button data-q="+">+</button>
          </div>
          <div class="badge">${moneyUZS((getVariantPricing(p, {color: row.ci?.color || null, size: row.ci?.size || null}).price||0)*qty)}</div>
        </div>` : `
        <div class="cartRow">
          <button class="pBtn iconOnly" title="Savatchaga" data-add><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i></button>
          <div class="badge"><i class="fa-solid fa-heart" aria-hidden="true"></i></div>
        </div>`}
      </div>
    `;

    
    // Click image -> open large viewer
    const cartImgEl = item.querySelector(".cartImg");
    if(cartImgEl){
      cartImgEl.addEventListener("click", (e)=>{
        e?.preventDefault?.();
        e?.stopPropagation?.();
        try{ e?.stopImmediatePropagation?.(); }catch(_){ }
        openImageZoom(imgSrc);
      });
    }

const pickBox = item.querySelector(".cartPickBox");
    if(pickBox){
      pickBox.addEventListener("change", ()=>{
        const k = pickBox.getAttribute("data-pick");
        if(pickBox.checked) cartSelected.add(k); else cartSelected.delete(k);
        updateCartSelectUI();
        renderPanel("cart");
      });
    }

const removeBtn = item.querySelector(".removeBtn");
    removeBtn.addEventListener("click", ()=>{
      if(mode==="fav"){
        favs.delete(p.id);
        saveLS(LS.favs, Array.from(favs));
        updateBadges();
        renderPanel("fav");
        if(viewMode==="fav") applyFilterSort();
      } else {
        cart = cart.filter(x=>x.key!==row.ci.key);
        saveLS(LS.cart, cart);
        updateBadges();
        renderPanel("cart");
      }
    });

    if(mode==="cart"){
      item.querySelector('[data-q="-"]').addEventListener("click", ()=>{
        addToCart(p.id, -1, row.ci);
        renderPanel("cart");
      });
      item.querySelector('[data-q="+"]').addEventListener("click", ()=>{
        addToCart(p.id, +1, row.ci);
        renderPanel("cart");
      });
    } else {
      const addBtn = item.querySelector("[data-add]");
      addBtn.addEventListener("click", ()=>{
        addToCart(p.id, 1, getSel(p));
        openPanel("cart");
      });
    }

    els.panelList.appendChild(item);
  }

  if(els.cartTotal) els.cartTotal.textContent = moneyUZS(total);
  omI18nRefresh(80);
}




/* ===== Page renderers for SPA (Fav/Cart) ===== */
function renderFavPage(){
  if(!els.favPageList || !els.favPageEmpty) return;
  els.favPageList.innerHTML = "";
  const countEl = document.getElementById("favCountPillPage");
  const list = [];
  for(const id of favs){
    const p = products.find(x=>x.id===id);
    if(p) list.push({p});
  }
  if(countEl) countEl.textContent = String(list.length);
  els.favPageEmpty.hidden = list.length !== 0;

  for(const row of list){
    const p = row.p;
    const sel = getSel(p);
    const imgSrc = getCurrentImage(p, sel);
    const priceObj = getVariantPricing(p, sel);
    const st = getStats(p.id);
    const ratingHtml = st.count ? `<span class="favRating"><i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(st.avg||0).toFixed(1)} <small>(${st.count})</small></span>` : `<span class="favRating muted"><i class="fa-regular fa-heart" aria-hidden="true"></i> Sevimli</span>`;
    const item = document.createElement("article");
    item.className = "favPremiumCard";
    item.innerHTML = `
      <div class="favImgWrap">
        <img class="favCardImg" src="${imgSrc||""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" loading="lazy" decoding="async" />
      </div>
      <div class="favContent">
        <div class="favTopRow">
          ${ratingHtml}
          <span class="favMiniBadge">Sevimli</span>
          <button class="favRemoveBtn" title="Sevimlidan olib tashlash" aria-label="Sevimlidan olib tashlash"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div class="favTitle">${escapeHtml(omProductText(p, "name", p.name || "Nomsiz"))}</div>
        <div class="favPriceRow">
          <div class="favPrice">${moneyUZS(priceObj.price||0)}</div>
          <div class="favShip">${renderDeliveryBadge(p)}</div>
        </div>
        <div class="favActions">
          <button class="favGhostBtn" data-open><i class="fa-regular fa-eye" aria-hidden="true"></i><span>Ko‘rish</span></button>
          <button class="favPrimaryBtn" data-add><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i><span>Savatga</span></button>
        </div>
      </div>
    `;

    item.addEventListener("click", (e)=>{
      if(e.target.closest('button')) return;
      openViewer(p.id);
    });
    item.querySelector(".favCardImg")?.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      openViewer(p.id);
    });

    item.querySelector("[data-open]")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      openViewer(p.id);
    });

    item.querySelector("[data-add]")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      addToCart(p.id, 1, sel);
      updateBadges();
      toast("Savatga qo‘shildi");
    });

    item.querySelector(".favRemoveBtn")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      favs.delete(p.id);
      saveLS(LS.favs, Array.from(favs));
      updateBadges();
      renderFavPage();
      applyFilterSort();
    });

    els.favPageList.appendChild(item);
  }
  omI18nRefresh(80);
}

function renderCartPage(){
  if(!els.cartPageList || !els.cartPageEmpty) return;
  els.cartPageList.innerHTML = "";
  syncCartSelected(true);

  const list = [];
  for(const ci of cart){
    const p = products.find(x=>x.id===ci.id);
    if(p) list.push({p, qty: ci.qty||1, ci});
  }
  const countEl = document.getElementById("cartCountPillPage");
  const selectedInfoEl = document.getElementById("cartSelectedInfo");
  const summaryNoteEl = document.getElementById("cartSummaryNote");
  if(countEl) countEl.textContent = String(list.length);
  const toolbarHintEl = document.getElementById("cartToolbarHint");
  if(toolbarHintEl) toolbarHintEl.textContent = list.length ? `${list.length} ta mahsulot` : "Savat bo‘sh";
  els.cartPageEmpty.hidden = list.length !== 0;

  let total = 0;
  let selectedCount = 0;
  let selectedWeightKg = 0;

  for(const row of list){
    const {p, qty, ci} = row;
    const vp = getVariantPricing(p, {color: ci?.color||null, size: ci?.size||null});
    if(cartSelected.has(ci.key)) { total += (vp.price||0) * qty; selectedCount += qty; selectedWeightKg += omProductWeightKg(p) * qty; }

    const imgSrc = ci?.image || getCurrentImage(p, {color: ci?.color||null, size: ci?.size||null, imgIdx:0});

    const item = document.createElement("div");
    item.className = `cartItem premiumCartItem ${cartSelected.has(ci.key) ? "isSelected" : ""}`;
    item.innerHTML = `
      <img class="cartImg" src="${imgSrc||""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" loading="lazy" decoding="async" />
      <div class="cartMeta">
        <div class="cartTitle">${escapeHtml(omProductText(p, "name", p.name || "Nomsiz"))}</div>
        <div class="cartWeightMini"><i class="fa-solid fa-weight-hanging" aria-hidden="true"></i> ${omFormatKg(omProductWeightKg(p))} × ${qty} = ${omFormatKg(omProductWeightKg(p) * qty)}</div>
        ${renderVariantLine(ci)}
        <div class="cartShip">${renderDeliveryBadge(p)}</div>
        ${(_normPType(p)==="cargo" || p.prepayRequired===true) ? `<div class="cartPrepay"><span class="prepayPill"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Oldindan to‘lov</span></div>` : ``}
        <div class="cartBottomLine">
          <div class="cartPriceStack">
            <div class="price">${moneyUZS(vp.price||0)}</div>
            <div class="cartUnitNote">1 dona narxi</div>
          </div>
          <div class="cartActionsMini">
            <div class="qty">
              <button data-q="-" aria-label="Kamaytirish">−</button>
              <span>${qty}</span>
              <button data-q="+" aria-label="Ko‘paytirish">+</button>
            </div>
            <div class="badge">${moneyUZS((vp.price||0)*qty)}</div>
            <div class="cartTinyActions cartTinyActionsSolo">
              <label class="cartPick cartPickInline" title="Tanlash" aria-label="Tanlash">
                <input type="checkbox" class="cartPickBox" data-pick="${escapeHtml(ci.key)}" ${cartSelected.has(ci.key) ? "checked" : ""} />
                <span><i class="fa-solid fa-check" aria-hidden="true"></i></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    item.querySelector(".cartImg")?.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      openImageZoom(imgSrc);
    });

    item.querySelector(".cartPickBox")?.addEventListener("change", (e)=>{
      const k = e.target.getAttribute("data-pick");
      if(e.target.checked) cartSelected.add(k); else cartSelected.delete(k);
      updateCartSelectUI();
      renderCartPage();
    });

    item.querySelector(".removeBtn")?.addEventListener("click", ()=>{
      cart = cart.filter(x=>x.key!==ci.key);
      saveLS(LS.cart, cart);
      updateBadges();
      renderCartPage();
    });

    item.querySelector('[data-q="-"]')?.addEventListener("click", ()=>{
      addToCart(p.id, -1, ci);
      updateBadges();
      renderCartPage();
    });
    item.querySelector('[data-q="+"]')?.addEventListener("click", ()=>{
      addToCart(p.id, +1, ci);
      updateBadges();
      renderCartPage();
    });

    els.cartPageList.appendChild(item);
  }

  if(els.cartTotalPage) els.cartTotalPage.textContent = moneyUZS(total);
  if(selectedInfoEl) selectedInfoEl.textContent = `${selectedCount} ta mahsulot`;
  if(summaryNoteEl) summaryNoteEl.textContent = list.length ? `Savatchada ${list.length} ta mahsulot bor. Tanlangan vazn: ${omFormatKg(selectedWeightKg)}.` : "Savatcha bo‘sh.";
  if(els.checkoutCompactSummary){
    els.checkoutCompactSummary.innerHTML = `<span>${selectedCount} ta tanlangan • ${omFormatKg(selectedWeightKg)}</span><b>${moneyUZS(total)}</b>`;
  }
  try{ omRenderDeliveryEstimate(); }catch(_e){}
  try{ omRenderCartDeliverySummary(); }catch(_e){}
  try{ updateCartPrimaryCTA(); }catch(_e){}

  // select all checkbox state
  if(els.cartSelectAllPage){
    const all = cart.length>0 && cart.every(x=>cartSelected.has(x.key));
    els.cartSelectAllPage.checked = all;
    els.cartSelectAllPage.indeterminate = !all && cartSelected.size>0;
  }
  // apply payment option rules based on cart items
  if(typeof applyPayTypeRules==='function') applyPayTypeRules();
  omI18nRefresh(80);
}




/* ===== OrzuMall pickup-point delivery module v115 ===== */
const OM_PICKUP_POINTS_CACHE_KEY = "orzumall_pickup_points_v3";
const OM_PICKUP_POINT_SELECTED_PREFIX = "orzumall_pickup_point_selected_v3";
const OM_PICKUP_POINTS_DEFAULT_URL = "./pickup-points-default.json?v=20260602_v115";
let omPickupPoints = [];
let omPickupPointsLoaded = false;
let omPickupUserLocation = null;
let omPickupPointTypeFilter = "all";
let omPickupRegionFilter = "all";
let omPickupSearchQuery = "";
let omPickupPreviewMap = null, omPickupPreviewMarker = null, omPickupPreviewUserMarker = null;
let omPickupExplorerMap = null, omPickupExplorerMarker = null, omPickupExplorerUserMarker = null;
let omPickupExplorerPointsLayer = null;

function omPickupStorageKey(uid=currentUser?.uid){
  const safeUid=String(uid||"guest").replace(/[^a-zA-Z0-9_-]/g,"_");
  return `${OM_PICKUP_POINT_SELECTED_PREFIX}_${safeUid}`;
}
function omPickupNum(v,fallback=0){ const n=Number(v); return Number.isFinite(n)?n:fallback; }
function omPickupEsc(v){ return escapeHtml(String(v==null?"":v)); }
function omPickupHasCoords(p){
  const lat=Number(p?.lat),lng=Number(p?.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
}
function omPickupPointType(p){ return String(p?.pointType||p?.type||"").toLowerCase()==="bir_qadam" ? "bir_qadam" : "orzumall"; }
function omNormalizePickupPoint(p,index=0){
  if(!p || typeof p!=="object") return null;
  const rawLat=p.lat ?? p.latitude, rawLng=p.lng ?? p.longitude;
  const lat=rawLat==null||rawLat===""?null:Number(rawLat),lng=rawLng==null||rawLng===""?null:Number(rawLng);
  const hasCoords=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
  const minDays=Math.max(1,Math.round(omPickupNum(p.minDays ?? p.deliveryMinDays,2)));
  const maxDays=Math.max(minDays,Math.round(omPickupNum(p.maxDays ?? p.deliveryMaxDays,minDays)));
  const name=String(p.name||p.title||`Topshirish punkti ${index+1}`).trim();
  const address=String(p.address||p.addressText||"").trim();
  const postalCode=String(p.postalCode??p.postalIndex??p.postIndex??"").trim().slice(0,40);
  const workingHours=String(p.workingHours??p.workHours??p.openingHours??"").trim().slice(0,180);
  const id=String(p.id||`point_${index+1}`).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80)||`point_${index+1}`;
  const pointType=omPickupPointType(p);
  const tariffConfigured=p.tariffConfigured!==false;
  return {
    id,name,address,postalCode,workingHours,lat:hasCoords?lat:null,lng:hasCoords?lng:null,
    pointType,sourceType:String(p.sourceType||p.source||"").trim(),regionGroup:String(p.regionGroup||"").trim(),region:String(p.region||"").trim(),district:String(p.district||"").trim(),
    firstKgFeeUZS:Math.max(0,Math.round(omPickupNum(p.firstKgFeeUZS ?? p.firstKgFee,pointType==="bir_qadam"?15000:0))),
    extraKgFeeUZS:Math.max(0,Math.round(omPickupNum(p.extraKgFeeUZS ?? p.extraKgFee,pointType==="bir_qadam"?3000:0))),
    minDays,maxDays,etaText:String(p.etaText||`${minDays}–${maxDays} kun`).trim(),
    active:p.active!==false,setupRequired:p.setupRequired===true,tariffConfigured,isBuiltIn:p.isBuiltIn===true
  };
}
function omNormalizePickupPoints(raw,{activeOnly=true}={}){
  const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.points)?raw.points:[]);
  const points=arr.map(omNormalizePickupPoint).filter(Boolean);
  return activeOnly?points.filter(p=>p.active!==false):points;
}
function omMergePickupPointArrays(baseRaw,overrideRaw){
  const base=Array.isArray(baseRaw)?baseRaw:(Array.isArray(baseRaw?.points)?baseRaw.points:[]);
  const overrides=Array.isArray(overrideRaw)?overrideRaw:(Array.isArray(overrideRaw?.points)?overrideRaw.points:[]);
  const map=new Map();
  base.forEach((p,i)=>{const n=omNormalizePickupPoint(p,i);if(n)map.set(String(n.id),n);});
  overrides.forEach((p,i)=>{const n=omNormalizePickupPoint(p,i);if(n)map.set(String(n.id),{...(map.get(String(n.id))||{}),...n});});
  return [...map.values()];
}
async function omFetchPickupPointDefaults(){
  try{const res=await fetch(OM_PICKUP_POINTS_DEFAULT_URL,{cache:"no-store"});if(!res.ok)throw new Error("defaults_fetch_failed");return await res.json();}catch(_e){return {points:[]};}
}
function omReadSelectedPickupPointId(){ try{return String(localStorage.getItem(omPickupStorageKey())||"");}catch(_e){return "";} }
function omWriteSelectedPickupPointId(id,sync=true){
  try{if(id)localStorage.setItem(omPickupStorageKey(),String(id));else localStorage.removeItem(omPickupStorageKey());}catch(_e){}
  if(sync){try{scheduleUserShopSync();}catch(_e){}}
}
function omGetPickupPointById(id=omReadSelectedPickupPointId()){return omPickupPoints.find(p=>String(p.id)===String(id))||null;}
function omPickupPointQuote(point,weightKg){
  if(!point)return null;
  const billedKg=Math.max(1,Math.ceil(Math.max(0,omPickupNum(weightKg,0))));
  const first=Math.max(0,Math.round(omPickupNum(point.firstKgFeeUZS,0)));
  const extra=Math.max(0,Math.round(omPickupNum(point.extraKgFeeUZS,0)));
  const feeUZS=first+Math.max(0,billedKg-1)*extra;
  return {billedKg,feeUZS,rawFeeUZS:feeUZS,firstKgFeeUZS:first,extraKgFeeUZS:extra};
}
function omPickupPointDistance(point,loc=omPickupUserLocation){
  if(!point||!loc||!omPickupHasCoords(point))return null;
  const lat=Number(loc.lat),lng=Number(loc.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  return omHaversineKm(lat,lng,Number(point.lat),Number(point.lng));
}
function omPickupMapUrl(p){return omPickupHasCoords(p)?`https://maps.google.com/?q=${encodeURIComponent(`${Number(p.lat)},${Number(p.lng)}`)}`:"";}
function omPickupPointSnapshot(point,weightKg){
  const quote=omPickupPointQuote(point,weightKg);const distanceKm=omPickupPointDistance(point);const mapUrl=omPickupMapUrl(point);
  return {id:point.id,name:point.name,address:point.address,postalCode:point.postalCode||"",workingHours:point.workingHours||"",lat:point.lat,lng:point.lng,pointType:point.pointType,sourceType:point.sourceType||"",region:point.region||"",district:point.district||"",firstKgFeeUZS:quote.firstKgFeeUZS,extraKgFeeUZS:quote.extraKgFeeUZS,billedKg:quote.billedKg,feeUZS:quote.feeUZS,minDays:point.minDays,maxDays:point.maxDays,etaText:point.etaText,distanceKm:Number.isFinite(Number(distanceKm))?Number(distanceKm):null,mapUrl};
}
async function omLoadPickupPoints(){
  let cached=[];try{const raw=localStorage.getItem(OM_PICKUP_POINTS_CACHE_KEY);if(raw)cached=omNormalizePickupPoints(JSON.parse(raw));}catch(_e){}
  if(cached.length)omPickupPoints=cached;
  const defaults=await omFetchPickupPointDefaults();
  let remote={points:[]};
  try{const snap=await getDoc(doc(db,"configs","pickupPoints"));if(snap.exists())remote=snap.data()||{points:[]};}catch(_e){}
  const merged=omMergePickupPointArrays(defaults,remote);
  if(merged.length)omPickupPoints=omNormalizePickupPoints(merged);
  try{localStorage.setItem(OM_PICKUP_POINTS_CACHE_KEY,JSON.stringify({points:omPickupPoints,updatedAt:Date.now()}));}catch(_e){}
  omPickupPointsLoaded=true;
  if(!omGetPickupPointById()&&omReadSelectedPickupPointId())omWriteSelectedPickupPointId("");
  try{omRenderPickupPointsUI();}catch(_e){}
  try{updateCheckoutCompactSummary();updateCheckoutSubmitVisibility();omRenderCartDeliverySummary();updateCartPrimaryCTA();}catch(_e){}
  return omPickupPoints;
}
function omPickupPointSearchText(){return String(omPickupSearchQuery||"").trim().toLowerCase();}
function omSetPickupSearchQuery(v){
  omPickupSearchQuery=String(v||"");
  ["pickupPointSearchInput","pickupExplorerSearchInput"].forEach(id=>{const el=document.getElementById(id);if(el&&el.value!==omPickupSearchQuery)el.value=omPickupSearchQuery;});
}
function omPickupTypeLabel(p){return p.pointType==="bir_qadam"?"Bir Qadam":"OrzuMall punkti";}
function omPickupRegionLabel(p){
  return String(p?.region||p?.regionGroup||p?.district||"Hudud ko‘rsatilmagan").trim() || "Hudud ko‘rsatilmagan";
}
function omPickupPointBaseFilteredList(){
  const q=omPickupPointSearchText();
  return omPickupPoints.filter(p=>(omPickupPointTypeFilter==="all"||p.pointType===omPickupPointTypeFilter)&&(!q||`${p.name} ${p.address} ${p.postalCode||""} ${p.workingHours||""} ${p.region||""} ${p.district||""} ${p.regionGroup||""}`.toLowerCase().includes(q)));
}
function omPickupRegionOptions(){
  const map=new Map();
  omPickupPointBaseFilteredList().forEach(p=>{const k=omPickupRegionLabel(p); map.set(k,(map.get(k)||0)+1);});
  return [...map.entries()].map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label,'uz'));
}
function omPickupComparator(a,b){
  const da=omPickupPointDistance(a),dbb=omPickupPointDistance(b);
  if(Number.isFinite(da)&&Number.isFinite(dbb)&&da!==dbb)return da-dbb;
  if(Number.isFinite(da))return -1;if(Number.isFinite(dbb))return 1;
  if(a.pointType!==b.pointType)return a.pointType==="bir_qadam"?-1:1;
  return a.name.localeCompare(b.name,"uz");
}
function omPickupPointSortedList(){
  return omPickupPointBaseFilteredList().slice().sort(omPickupComparator);
}
function omSetPickupPointFilter(v){
  omPickupPointTypeFilter=(v==="bir_qadam"||v==="orzumall")?v:"all";
  document.querySelectorAll("[data-pickup-filter]").forEach(btn=>btn.classList.toggle("isActive",String(btn.getAttribute("data-pickup-filter")||"all")===omPickupPointTypeFilter));
  const regionOptions=omPickupRegionOptions();
  if(omPickupRegionFilter!=="all"&&!regionOptions.some(x=>x.label===omPickupRegionFilter)) omPickupRegionFilter="all";
}
function omSetPickupRegionFilter(v){
  omPickupRegionFilter=(v&&v!=="all")?String(v):"all";
  document.querySelectorAll("[data-pickup-region]").forEach(btn=>btn.classList.toggle("isActive",String(btn.getAttribute("data-pickup-region")||"all")===omPickupRegionFilter));
}
function omPickupRecommendedPoints(points,limit=3,excludeId=""){
  const arr=(Array.isArray(points)?points:[]).filter(p=>String(p.id)!==String(excludeId));
  if(!arr.length) return [];
  const copy=arr.slice().sort(omPickupComparator);
  return copy.slice(0,limit);
}
function omPickupBuildCard(p,selectedId){
  const quote=omPickupPointQuote(p,((typeof buildSelectedItems==="function"&&buildSelectedItems()?.totalWeightKg)||0));
  const dist=omPickupPointDistance(p),distText=Number.isFinite(dist)?`${dist.toFixed(dist>=10?0:1)} km`:"";
  const checked=String(p.id)===String(selectedId),isBq=p.pointType==="bir_qadam";
  return `<label class="pickupPointCard ${checked?'isSelected':''} ${isBq?'isBirQadam':'isOrzuMall'}" data-pickup-point-card="${omPickupEsc(p.id)}"><input class="pickupPointRadio" type="radio" name="pickupPointRadio" value="${omPickupEsc(p.id)}" ${checked?'checked':''}><div class="pickupPointCardMain"><div class="pickupPointCardTitleRow"><b>${omPickupEsc(p.name)}</b><span class="pickupPointTypeBadge ${isBq?'birQadam':'orzuMall'}"><i class="fa-solid ${isBq?'fa-bolt':'fa-store'}"></i>${isBq?'Bir Qadam':'OrzuMall'}</span></div><span class="pickupPointAddress">${omPickupEsc(p.address||'Manzil ko‘rsatilmagan')}</span><div class="pickupPointMeta"><span><i class="fa-solid fa-envelopes-bulk"></i>${omPickupEsc(p.postalCode||'Indeks yo‘q')}</span><span><i class="fa-solid fa-truck-fast"></i>${omPickupEsc(p.etaText||'Muddat yo‘q')}</span>${distText?`<span><i class="fa-solid fa-route"></i>${omPickupEsc(distText)}</span>`:''}</div></div><div class="pickupPointCardPrice"><small>Yetkazish</small><b>${moneyUZS(quote.feeUZS)}</b><span>${checked?'Tanlandi':'Tanlash'}</span></div></label>`;
}
function omPickupBuildGroupedCards(points,selectedId){
  if(!points.length) return '<div class="pickupPointEmpty"><i class="fa-solid fa-magnifying-glass-location"></i><b>Mos topshirish punkti topilmadi</b><span>Qidiruvni tozalang yoki boshqa filtrni tanlang.</span></div>';
  const groups=new Map();
  points.forEach(p=>{const key=omPickupRegionLabel(p); if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(p);});
  return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'uz')).map(([label,items])=>`<div class="pickupRegionGroup"><div class="pickupRegionGroupHead"><span><i class="fa-solid fa-location-dot"></i> ${omPickupEsc(label)}</span><b>${items.length} ta punkt</b></div><div class="pickupRegionGroupBody">${items.map(p=>omPickupBuildCard(p,selectedId)).join('')}</div></div>`).join('');
}
function omRenderPickupRegionRows(){
  const rows=[document.getElementById('pickupRegionRow'),document.getElementById('pickupExplorerRegionRow')];
  const options=omPickupRegionOptions();
  if(omPickupRegionFilter!=="all"&&!options.some(o=>o.label===omPickupRegionFilter)) omPickupRegionFilter="all";
  const html=`<button class="pickupRegionChip ${omPickupRegionFilter==='all'?'isActive':''}" type="button" data-pickup-region="all">Barcha hududlar</button>${options.map(o=>`<button class="pickupRegionChip ${omPickupRegionFilter===o.label?'isActive':''}" type="button" data-pickup-region="${omPickupEsc(o.label)}">${omPickupEsc(o.label)} <span>${o.count}</span></button>`).join('')}`;
  rows.forEach(row=>{if(row) row.innerHTML=html;});
}
// Leaflet is loaded only when the customer opens a map.
// This removes the map library from the initial homepage critical path.
const OM_LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const OM_LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
let omLeafletPromise = null;
function omLoadStyleOnce(href,id){
  const found=document.getElementById(id);
  if(found)return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href=href;
    link.onload=()=>resolve(true);link.onerror=()=>{try{link.remove()}catch(_e){}reject(new Error("leaflet_css_failed"))};document.head.appendChild(link);
  });
}
function omLoadScriptOnce(src,id){
  if(window.L)return Promise.resolve(true);
  const found=document.getElementById(id);
  if(found)return new Promise(resolve=>{
    if(window.L)return resolve(true);
    found.addEventListener("load",()=>resolve(!!window.L),{once:true});
    found.addEventListener("error",()=>resolve(false),{once:true});
  });
  return new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.id=id;script.src=src;script.defer=true;
    script.onload=()=>resolve(!!window.L);script.onerror=()=>{try{script.remove()}catch(_e){}reject(new Error("leaflet_js_failed"))};document.head.appendChild(script);
  });
}
function omEnsureLeaflet(){
  if(window.L)return Promise.resolve(true);
  if(!omLeafletPromise)omLeafletPromise=Promise.all([omLoadStyleOnce(OM_LEAFLET_CSS,"omLeafletCss"),omLoadScriptOnce(OM_LEAFLET_JS,"omLeafletJs")]).then(()=>!!window.L).then(ok=>{if(!ok)omLeafletPromise=null;return ok}).catch(()=>{omLeafletPromise=null;return false});
  return omLeafletPromise;
}

function omPickupRenderMap(elId,point,mode="preview",points=[]){
  const el=document.getElementById(elId);
  if(!el)return;
  const isExplorer=mode==="explorer";
  let map=isExplorer?omPickupExplorerMap:omPickupPreviewMap;
  let marker=isExplorer?omPickupExplorerMarker:omPickupPreviewMarker;
  let userMarker=isExplorer?omPickupExplorerUserMarker:omPickupPreviewUserMarker;
  const user=omPickupUserLocation&&Number.isFinite(Number(omPickupUserLocation.lat))&&Number.isFinite(Number(omPickupUserLocation.lng))?{lat:Number(omPickupUserLocation.lat),lng:Number(omPickupUserLocation.lng)}:null;
  const setRefs=(m,mainMarker,uMarker)=>{ if(isExplorer){ omPickupExplorerMap=m; omPickupExplorerMarker=mainMarker; omPickupExplorerUserMarker=uMarker; } else { omPickupPreviewMap=m; omPickupPreviewMarker=mainMarker; omPickupPreviewUserMarker=uMarker; } };
  if(typeof window==="undefined"||!window.L){ el.innerHTML='<div class="pickupMapEmpty"><i class="fa-solid fa-map-location-dot"></i><b>Xarita tayyorlanmoqda</b><span>Xarita faqat kerak bo‘lganda yuklanadi.</span></div>'; omEnsureLeaflet().then(ok=>{if(ok)omPickupRenderMap(elId,point,mode,points);else el.innerHTML='<div class="pickupMapEmpty"><i class="fa-solid fa-satellite-dish"></i><b>Xarita yuklanmadi</b><span>Internet aloqasini tekshiring.</span></div>';}); return; }
  if(!point||!omPickupHasCoords(point)){ el.innerHTML='<div class="pickupMapEmpty"><i class="fa-solid fa-map-location-dot"></i><b>Xarita tayyor emas</b><span>Bu punkt uchun koordinata kiritilgach mini xarita ko‘rinadi.</span></div>'; try{ if(map){ map.remove(); } }catch(_e){} if(isExplorer){omPickupExplorerPointsLayer=null;} setRefs(null,null,null); return; }
  const lat=Number(point.lat),lng=Number(point.lng);
  if(!map||map._container!==el){ try{ if(map) map.remove(); }catch(_e){} el.innerHTML=''; map=window.L.map(el,{zoomControl:true,attributionControl:false}).setView([lat,lng],user?12:14); window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map); marker=null; userMarker=null; if(isExplorer) omPickupExplorerPointsLayer=null; }
  if(isExplorer){
    try{ if(omPickupExplorerPointsLayer){ omPickupExplorerPointsLayer.remove(); } }catch(_e){}
    const group=window.L.layerGroup();
    const validPoints=(Array.isArray(points)?points:[]).filter(omPickupHasCoords);
    validPoints.forEach(p=>{
      const selected=String(p.id)===String(point.id);
      const isBq=p.pointType==="bir_qadam";
      const layer=window.L.circleMarker([Number(p.lat),Number(p.lng)],{radius:selected?10:7,weight:selected?3:2,color:selected?'#0f172a':(isBq?'#ea580c':'#15803d'),fillColor:isBq?'#fb923c':'#22c55e',fillOpacity:selected?1:.92});
      try{ layer.bindPopup(`<b>${omPickupEsc(p.name)}</b><br>${omPickupEsc(omPickupRegionLabel(p))}<br>${omPickupEsc(p.address||'')}`); }catch(_e){}
      layer.on('click',()=>omSelectPickupPoint(p.id));
      group.addLayer(layer);
      if(selected) marker=layer;
    });
    group.addTo(map);
    omPickupExplorerPointsLayer=group;
  }else{
    if(marker&&marker.setLatLng) marker.setLatLng([lat,lng]);
    else marker=window.L.marker([lat,lng]).addTo(map);
    try{ marker?.bindPopup(`<b>${omPickupEsc(point.name||'Topshirish punkti')}</b><br>${omPickupEsc(point.address||'')}`); }catch(_e){}
  }
  if(user){
    if(userMarker&&userMarker.setLatLng) userMarker.setLatLng([user.lat,user.lng]);
    else userMarker=window.L.circleMarker([user.lat,user.lng],{radius:7,weight:3,color:'#2563eb',fillColor:'#60a5fa',fillOpacity:.95}).addTo(map);
    try{ userMarker.bindPopup('Sizning lokatsiyangiz'); }catch(_e){}
  }else if(userMarker){ try{ map.removeLayer(userMarker); }catch(_e){} userMarker=null; }
  try{
    const boundsPoints=[];
    if(isExplorer){ (Array.isArray(points)?points:[]).filter(omPickupHasCoords).forEach(p=>boundsPoints.push([Number(p.lat),Number(p.lng)])); }
    else boundsPoints.push([lat,lng]);
    if(user) boundsPoints.push([user.lat,user.lng]);
    const bounds=window.L.latLngBounds(boundsPoints.length?boundsPoints:[[lat,lng]]);
    map.fitBounds(bounds.pad(isExplorer?0.18:0.28));
  }catch(_e){ map.setView([lat,lng],isExplorer?11:13); }
  setRefs(map,marker,userMarker);
  setTimeout(()=>{ try{ map?.invalidateSize(); }catch(_e){} },50);
}
function omRenderPickupHeroPreview(points){
  const hero=document.getElementById("pickupPointHeroPreview");
  if(!hero)return;
  const point=omGetPickupPointById(omReadSelectedPickupPointId())||points?.[0]||null;
  if(!point){ hero.innerHTML='<div class="pickupHeroEmpty"><i class="fa-solid fa-box-open"></i><b>Punkt tanlang</b><span>Quyidagi ro‘yxatdan topshirish punktini tanlaganingizda premium preview shu yerda chiqadi.</span></div>'; return; }
  const isBq=point.pointType==="bir_qadam";
  const quote=omPickupPointQuote(point,((typeof buildSelectedItems==="function"&&buildSelectedItems()?.totalWeightKg)||0));
  const dist=omPickupPointDistance(point),distText=Number.isFinite(dist)?`${dist.toFixed(dist>=10?0:1)} km`:"GPS orqali aniqlanadi";
  const mapUrl=omPickupMapUrl(point);
  const recs=omPickupRecommendedPoints(points,3,point.id);
  hero.innerHTML=`<div class="pickupHeroCard ${isBq?'isBirQadam':'isOrzuMall'}"><div class="pickupHeroInfo"><div class="pickupHeroIcon"><i class="fa-solid ${isBq?'fa-bolt':'fa-store'}"></i></div><div class="pickupHeroText"><div class="pickupHeroBadges"><span class="pickupPointTypeBadge ${isBq?'birQadam':'orzuMall'}"><i class="fa-solid ${isBq?'fa-bolt':'fa-store'}"></i> ${omPickupEsc(omPickupTypeLabel(point))}</span>${isBq?'<span class="pickupPointOfficialBadge">UzPost</span>':'<span class="pickupPointOfficialBadge pickupPointOfficialBadgeOrzu">OrzuMall</span>'}<span class="pickupPointOfficialBadge pickupPointRegionBadge">${omPickupEsc(omPickupRegionLabel(point))}</span></div><b>${omPickupEsc(point.name)}</b><span>${omPickupEsc(point.address||'Manzil ko‘rsatilmagan')}</span><div class="pickupHeroChipRow"><span><i class="fa-solid fa-route"></i> ${omPickupEsc(distText)}</span><span><i class="fa-solid fa-truck-fast"></i> ${omPickupEsc(point.etaText||'Muddat ko‘rsatilmagan')}</span><span><i class="fa-solid fa-wallet"></i> ${moneyUZS(quote.feeUZS)}</span></div></div></div><div class="pickupHeroMapWrap"><div class="pickupHeroMap" id="pickupPointPreviewMap"></div></div><div class="pickupHeroFooter"><div class="pickupHeroStats"><div><small>1 kg</small><strong>${moneyUZS(point.firstKgFeeUZS)}</strong></div><div><small>+1 kg</small><strong>${moneyUZS(point.extraKgFeeUZS)}</strong></div><div><small>Pochta indeksi</small><strong>${omPickupEsc(point.postalCode||'—')}</strong></div></div><div class="pickupHeroActions">${mapUrl?`<a href="${omPickupEsc(mapUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i> Xaritada</a>`:''}<button type="button" class="pickupHeroOpenBtn" id="pickupExplorerOpenBtnInline"><i class="fa-solid fa-expand"></i> To‘liq ekran</button></div></div>${recs.length?`<div class="pickupRecommendBlock"><div class="pickupRecommendHead"><b><i class="fa-solid fa-star"></i> Tavsiya etilgan eng yaqin 3 ta punkt</b><span>${omPickupUserLocation?'Sizga yaqin punktlar bo‘yicha saralandi.':'Lokatsiya berilganda yanada aniq tavsiya qiladi.'}</span></div><div class="pickupRecommendGrid">${recs.map(p=>{const d=omPickupPointDistance(p),dt=Number.isFinite(d)?`${d.toFixed(d>=10?0:1)} km`:'GPS';const q=omPickupPointQuote(p,((typeof buildSelectedItems==='function'&&buildSelectedItems()?.totalWeightKg)||0));return `<button type="button" class="pickupRecommendCard ${p.pointType==='bir_qadam'?'isBirQadam':'isOrzuMall'}" data-pickup-recommend="${omPickupEsc(p.id)}"><div class="pickupRecommendTop"><b>${omPickupEsc(p.name)}</b><span>${omPickupEsc(omPickupRegionLabel(p))}</span></div><div class="pickupRecommendMeta"><span><i class="fa-solid ${p.pointType==='bir_qadam'?'fa-bolt':'fa-store'}"></i> ${omPickupEsc(omPickupTypeLabel(p))}</span><span><i class="fa-solid fa-route"></i> ${omPickupEsc(dt)}</span></div><strong>${moneyUZS(q.feeUZS)}</strong></button>`;}).join('')}</div></div>`:''}</div>`;
  omPickupRenderMap("pickupPointPreviewMap",point,"preview");
  document.getElementById("pickupExplorerOpenBtnInline")?.addEventListener("click",openPickupExplorerModal,{once:true});
  hero.querySelectorAll('[data-pickup-recommend]').forEach(btn=>btn.addEventListener('click',()=>omSelectPickupPoint(btn.getAttribute('data-pickup-recommend'))));
}
function omRenderPickupExplorerPreview(points){
  const infoEl=document.getElementById("pickupExplorerFeatured");
  const selectedEl=document.getElementById("pickupExplorerSelected");
  if(!infoEl||!selectedEl)return;
  const point=omGetPickupPointById(omReadSelectedPickupPointId())||points?.[0]||null;
  if(!point){ infoEl.innerHTML='<div class="pickupExplorerEmpty"><i class="fa-solid fa-box-open"></i><b>Punkt tanlanmagan</b><span>Chap tomondagi ro‘yxatdan punkt tanlang.</span></div>'; selectedEl.innerHTML=''; return; }
  const isBq=point.pointType==="bir_qadam";
  const quote=omPickupPointQuote(point,((typeof buildSelectedItems==="function"&&buildSelectedItems()?.totalWeightKg)||0));
  const dist=omPickupPointDistance(point),distText=Number.isFinite(dist)?`${dist.toFixed(dist>=10?0:1)} km`:"GPS bilan aniqlanadi";
  const mapUrl=omPickupMapUrl(point);
  const recs=omPickupRecommendedPoints(points,3,point.id);
  infoEl.innerHTML=`<div class="pickupExplorerFeatureCard ${isBq?'isBirQadam':'isOrzuMall'}"><div class="pickupExplorerFeatureTop"><div><div class="pickupHeroBadges"><span class="pickupPointTypeBadge ${isBq?'birQadam':'orzuMall'}"><i class="fa-solid ${isBq?'fa-bolt':'fa-store'}"></i> ${omPickupEsc(omPickupTypeLabel(point))}</span>${isBq?'<span class="pickupPointOfficialBadge">UzPost</span>':'<span class="pickupPointOfficialBadge pickupPointOfficialBadgeOrzu">OrzuMall</span>'}<span class="pickupPointOfficialBadge pickupPointRegionBadge">${omPickupEsc(omPickupRegionLabel(point))}</span></div><b>${omPickupEsc(point.name)}</b><span>${omPickupEsc(point.address||'Manzil ko‘rsatilmagan')}</span></div><div class="pickupExplorerMiniPrice"><small>Hozir</small><strong>${moneyUZS(quote.feeUZS)}</strong></div></div><div class="pickupExplorerFeatureMeta"><span><i class="fa-solid fa-route"></i> ${omPickupEsc(distText)}</span><span><i class="fa-regular fa-clock"></i> ${omPickupEsc(point.workingHours||'Ish vaqti ko‘rsatilmagan')}</span><span><i class="fa-solid fa-truck-fast"></i> ${omPickupEsc(point.etaText||'Muddat ko‘rsatilmagan')}</span></div><div class="pickupExplorerMarkerLegend"><span class="isBirQadam"><i></i> Bir Qadam marker</span><span class="isOrzu"><i></i> OrzuMall marker</span><span class="isSelected"><i></i> Tanlangan punkt</span></div></div>`;
  selectedEl.innerHTML=`<div class="pickupExplorerSelectedGrid"><div><small>1 kg</small><strong>${moneyUZS(point.firstKgFeeUZS)}</strong></div><div><small>+1 kg</small><strong>${moneyUZS(point.extraKgFeeUZS)}</strong></div><div><small>Indeks</small><strong>${omPickupEsc(point.postalCode||'—')}</strong></div><div><small>Hisoblangan vazn</small><strong>${quote.billedKg} kg</strong></div></div>${recs.length?`<div class="pickupExplorerRecommend"><div class="pickupExplorerRecommendHead">Tavsiya etilgan yaqin punktlar</div><div class="pickupExplorerRecommendGrid">${recs.map(p=>{const d=omPickupPointDistance(p),dt=Number.isFinite(d)?`${d.toFixed(d>=10?0:1)} km`:'GPS';return `<button type="button" class="pickupExplorerRecommendCard" data-pickup-recommend="${omPickupEsc(p.id)}"><b>${omPickupEsc(p.name)}</b><span>${omPickupEsc(omPickupRegionLabel(p))}</span><small>${omPickupEsc(dt)}</small></button>`;}).join('')}</div></div>`:''}${mapUrl?`<div class="pickupExplorerMapActions"><a href="${omPickupEsc(mapUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i> Xaritada ochish</a></div>`:''}`;
  selectedEl.querySelectorAll('[data-pickup-recommend]').forEach(btn=>btn.addEventListener('click',()=>omSelectPickupPoint(btn.getAttribute('data-pickup-recommend'))));
  omPickupRenderMap("pickupExplorerMap",point,"explorer",points);
}
function omRenderPickupPointsUI(){
  const listEl=document.getElementById("pickupPointList"),status=document.getElementById("pickupPointStatus"),selectedEl=document.getElementById("pickupPointSelected");
  if(!listEl||!status||!selectedEl)return;
  const selectedId=omReadSelectedPickupPointId(),points=omPickupPointSortedList();
  if(!omPickupPointsLoaded&&!omPickupPoints.length){
    status.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Punktlar yuklanmoqda...';
    listEl.innerHTML='<div class="pickupPointEmpty"><i class="fa-solid fa-box-open"></i><span>Iltimos, biroz kuting.</span></div>';
    selectedEl.hidden=true;
    return;
  }
  const typeText=omPickupPointTypeFilter==="bir_qadam"?"Bir Qadam":(omPickupPointTypeFilter==="orzumall"?"OrzuMall":"barcha");
  status.innerHTML=`<i class="fa-solid fa-location-dot"></i> ${points.length} ta ${omPickupEsc(typeText)} punkt topildi${omPickupUserLocation?' • eng yaqinlari tepada':''}`;
  listEl.innerHTML=points.length?points.map(p=>omPickupBuildCard(p,selectedId)).join(''):'<div class="pickupPointEmpty"><i class="fa-solid fa-magnifying-glass-location"></i><b>Punkt topilmadi</b><span>Qidiruv matnini yoki filtrni o‘zgartiring.</span></div>';
  const selected=omGetPickupPointById(selectedId);
  if(!selected){selectedEl.hidden=true;return;}
  const built=(typeof buildSelectedItems==="function")?buildSelectedItems():null;
  const quote=omPickupPointQuote(selected,built?.totalWeightKg||0),dist=omPickupPointDistance(selected),mapUrl=omPickupMapUrl(selected);
  selectedEl.hidden=false;
  selectedEl.innerHTML=`<div class="pickupSelectedIcon"><i class="fa-solid fa-circle-check"></i></div><div class="pickupSelectedContent"><div class="pickupSelectedTop"><b>${omPickupEsc(selected.name)}</b><span>${omPickupEsc(omPickupTypeLabel(selected))}</span></div><p>${omPickupEsc(selected.address||'Manzil ko‘rsatilmagan')}</p><div class="pickupSelectedMeta"><span><i class="fa-solid fa-envelopes-bulk"></i>${omPickupEsc(selected.postalCode||'Indeks yo‘q')}</span><span><i class="fa-solid fa-wallet"></i>${moneyUZS(quote.feeUZS)}</span><span><i class="fa-solid fa-truck-fast"></i>${omPickupEsc(selected.etaText||'Muddat yo‘q')}</span>${Number.isFinite(dist)?`<span><i class="fa-solid fa-route"></i>${dist.toFixed(dist>=10?0:1)} km</span>`:''}${mapUrl?`<a href="${omPickupEsc(mapUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i>Xaritada</a>`:''}</div></div>`;
}
function omSelectPickupPoint(id){const point=omGetPickupPointById(id);if(!point)return;omWriteSelectedPickupPointId(point.id);omRenderPickupPointsUI();try{updateCheckoutCompactSummary();updateCheckoutSubmitVisibility();omRenderCartDeliverySummary();updateCartPrimaryCTA();}catch(_e){}}
async function omDetectPickupNearest(){
  const buttons=[...document.querySelectorAll('[data-pickup-locate-btn]')];
  const olds=buttons.map(btn=>btn.innerHTML);
  buttons.forEach(btn=>{btn.disabled=true;btn.innerHTML='<span class="omBtnSpinner"></span> Aniqlanmoqda...';});
  try{const pos=await omGetGeoPosition();omPickupUserLocation={lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy||0)};omRenderPickupPointsUI();toast("Eng yaqin topshirish punktlari saralandi.");}catch(_e){toast("Lokatsiya olinmadi. GPS va ruxsatni tekshiring.");}finally{buttons.forEach((btn,idx)=>{btn.disabled=false;btn.innerHTML=olds[idx];});}
}
function openPickupExplorerModal(){
  const overlay=document.getElementById('pickupExplorerOverlay');
  if(!overlay)return;
  overlay.hidden=false;
  requestAnimationFrame(()=>overlay.classList.add('isOpen'));
  try{omSyncModalOpenState();}catch(_e){}
  omRenderPickupPointsUI();
  setTimeout(()=>{try{omPickupExplorerMap?.invalidateSize();}catch(_e){}},60);
}
function closePickupExplorerModal(){
  const overlay=document.getElementById('pickupExplorerOverlay');
  if(!overlay)return;
  overlay.classList.remove('isOpen');
  setTimeout(()=>{overlay.hidden=true;try{omSyncModalOpenState();}catch(_e){}},190);
}
function initPickupPointUI(){
  const list=document.getElementById("pickupPointList");
  list?.addEventListener("change",e=>{const radio=e.target.closest('input[name="pickupPointRadio"]');if(radio)omSelectPickupPoint(radio.value);});
  list?.addEventListener("click",e=>{const card=e.target.closest('[data-pickup-point-card]');if(card&&!e.target.closest('a'))omSelectPickupPoint(card.getAttribute('data-pickup-point-card'));});
  document.getElementById("pickupPointSearchInput")?.addEventListener("input",e=>{omSetPickupSearchQuery(e.target.value);omRenderPickupPointsUI();});
  document.getElementById("pickupPointLocateBtn")?.addEventListener("click",omDetectPickupNearest);
  document.querySelectorAll('[data-pickup-filter]').forEach(btn=>btn.addEventListener('click',()=>{omSetPickupPointFilter(String(btn.getAttribute('data-pickup-filter')||'all'));omRenderPickupPointsUI();}));
  try{const saved=omLocationFromSavedAddress(omBestSavedAddress());if(saved)omPickupUserLocation={lat:Number(saved.lat),lng:Number(saved.lng)};}catch(_e){}
  omPickupRegionFilter="all";
  omSetPickupSearchQuery(omPickupSearchQuery);
  omSetPickupPointFilter(omPickupPointTypeFilter);
  omRenderPickupPointsUI();
}

/* =========================
   Checkout (Cart -> Order)
========================= */
const OM_DELIVERY_METHOD_KEY_PREFIX = "orzumall_checkout_delivery_method_v2";

function omDeliveryMethodStorageKey(uid=currentUser?.uid){
  const safeUid = String(uid || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${OM_DELIVERY_METHOD_KEY_PREFIX}_${safeUid}`;
}
function omReadStoredDeliveryMethod(){
  try{
    const v = String(localStorage.getItem(omDeliveryMethodStorageKey()) || "");
    return (v === "pickup" || v === "pickup_point" || v === "delivery") ? v : "";
  }catch(_e){ return ""; }
}
function omStoreDeliveryMethod(v, sync=true){
  try{
    const key = omDeliveryMethodStorageKey();
    if(v === "pickup" || v === "pickup_point" || v === "delivery") localStorage.setItem(key, v);
    else localStorage.removeItem(key);
    if(sync) scheduleUserShopSync();
  }catch(_e){}
}

function openCheckout(){
  if(!els.checkoutSheet) return;
  const overlay = els.checkoutOverlay || document.getElementById("checkoutOverlay");
  if(overlay){
    overlay.hidden = false;
    requestAnimationFrame(()=> overlay.classList.add("isOpen"));
  }
  els.checkoutSheet.hidden = false;
  try{ els.checkoutSheet.classList.add("isOpen"); }catch(_e){}
  try{ document.documentElement.classList.add("modalOpen"); document.body.classList.add("modalOpen"); }catch(_e){}

  try{
    const methodSelect = document.getElementById("deliveryMethodSelect");
    if(methodSelect && !methodSelect.value){
      const stored = omReadStoredDeliveryMethod();
      if(stored) methodSelect.value = stored;
    }
    renderSavedAddressesUI();
    const saved = omBestSavedAddress();
    const sel = document.getElementById("savedDeliveryAddressSelect");
    if(saved && sel && !sel.value) sel.value = String(saved.id || "");
    if(getDeliveryMethod() === "delivery" && saved && !omDeliveryLocation) applySavedAddressToCheckout(saved.id);
  }catch(_e){}
  try{ if(!omPickupPointsLoaded) omLoadPickupPoints(); }catch(_e){}
  try{ updateDeliveryMethodUI(); }catch(_e){}
  try{ applyPayTypeRules(); }catch(_e){}

  // Require completed profile before checkout
  try{
    if(window.__omProfile && window.__omProfile.isProfileComplete && !window.__omProfile.isProfileComplete()){
      toast("Avval profilni to‘liq to‘ldiring (Ism, Familiya, Telefon).");
      closeCheckout();
      goTab("profile");
      try{ setTimeout(()=>{ document.getElementById("profileEditBtn")?.click(); }, 120); }catch(_){}
      return;
    }
  }catch(_){}
}

function omSyncModalOpenState(){
  const checkoutOpen = !!(els.checkoutOverlay && !els.checkoutOverlay.hidden);
  const paymentOpen = !!(els.paymentOverlay && !els.paymentOverlay.hidden);
  const pickupExplorerOpen = !!(!document.getElementById('pickupExplorerOverlay')?.hidden);
  const hasOpenModal = checkoutOpen || paymentOpen || pickupExplorerOpen;
  try{ document.documentElement.classList.toggle("modalOpen", hasOpenModal); }catch(_e){}
  try{ document.body.classList.toggle("modalOpen", hasOpenModal); }catch(_e){}
}

function closeCheckout(){
  if(!els.checkoutSheet) return;
  const overlay = els.checkoutOverlay || document.getElementById("checkoutOverlay");
  try{ els.checkoutSheet.classList.remove("isOpen"); }catch(_e){}
  try{ overlay?.classList.remove("isOpen"); }catch(_e){}
  els.checkoutSheet.hidden = true;
  if(overlay) overlay.hidden = true;
  try{ omSyncModalOpenState(); }catch(_e){}
}

const omPromoState={code:'',discountUZS:0,valid:false,subtotalUZS:0,busy:false};
function omPromoInputCode(){return String(document.getElementById('promoCodeInput')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]+/g,'').slice(0,40)}
function omPromoHint(text,state=''){const el=document.getElementById('promoHint');if(!el)return;el.textContent=String(text||'');el.classList.remove('isOk','isError','isBusy');if(state)el.classList.add(state)}
function omPromoErrorText(code){const k=String(code||'').trim().toUpperCase();const map={PROMO_CODE_REQUIRED:'Promokodni kiriting.',PROMO_NOT_FOUND:'Bunday promokod topilmadi.',PROMO_INACTIVE:'Promokod hozir faol emas.',PROMO_NOT_STARTED:'Promokod hali faollashmagan.',PROMO_EXPIRED:'Promokod muddati tugagan.',PROMO_MIN_ORDER:'Buyurtma summasi promokod uchun yetarli emas.',PROMO_LIMIT_REACHED:'Promokoddan foydalanish limiti tugagan.',PROMO_USER_LIMIT:'Bu promokoddan avval foydalangansiz.',PROMO_INVALID:'Promokod chegirmasi noto‘g‘ri.'};return map[k]||'Promokodni qo‘llab bo‘lmadi.'}
function omInvalidatePromo(silent=false){omPromoState.code='';omPromoState.discountUZS=0;omPromoState.valid=false;omPromoState.subtotalUZS=0;if(!silent)omPromoHint('Promokodingiz bo‘lsa kiriting.');}
async function omApplyPromoCode(){
  if(omPromoState.busy)return;
  const input=document.getElementById('promoCodeInput'),btn=document.getElementById('promoApplyBtn');const code=omPromoInputCode();if(input)input.value=code;
  if(!code){omInvalidatePromo();try{updatePaymentModalSummary()}catch(_e){}return}
  if(!currentUser?.getIdToken){omPromoHint('Promokoddan foydalanish uchun akkauntga kiring.','isError');return}
  const built=typeof buildSelectedItems==='function'?buildSelectedItems():null;if(!built?.ok){omPromoHint(built?.reason||'Mahsulot tanlang.','isError');return}
  omPromoState.busy=true;if(btn){btn.disabled=true;btn.textContent='Tekshirilmoqda...'}omPromoHint('Promokod tekshirilmoqda...','isBusy');
  try{const token=await currentUser.getIdToken();const resp=await fetch('/.netlify/functions/promo-validate',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify({code,subtotalUZS:Number(built.totalUZS||0)})});const out=await resp.json().catch(()=>({}));if(!resp.ok||!out.ok)throw new Error(out?.error||'PROMO_INVALID');omPromoState.code=String(out.code||code);omPromoState.discountUZS=Math.max(0,Number(out.discountUZS||0));omPromoState.subtotalUZS=Number(built.totalUZS||0);omPromoState.valid=true;omPromoHint(`${omPromoState.code} qo‘llandi: ${moneyUZS(omPromoState.discountUZS)} chegirma.`,'isOk');updatePaymentModalSummary()}catch(e){omInvalidatePromo(true);omPromoHint(omPromoErrorText(e?.message),'isError');try{updatePaymentModalSummary()}catch(_e){}}finally{omPromoState.busy=false;if(btn){btn.disabled=false;btn.textContent='Qo‘llash'}}
}

function updatePaymentModalSummary(){
  const totalEl = document.getElementById("paymentFinalTotal");
  const productsEl = document.getElementById("paymentProductsInfo");
  const deliveryEl = document.getElementById("paymentDeliveryPreview");
  if(!totalEl || !productsEl || !deliveryEl) return false;
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  const info = built?.ok ? getCheckoutDeliveryInfo() : {ok:false, reason: built?.reason || "Mahsulot tanlang."};
  if(!built?.ok || !info.ok){
    totalEl.textContent = "0 so‘m";
    productsEl.textContent = info.reason || "Yetkazib berishni sozlang.";
    deliveryEl.innerHTML = `<div class="paymentDeliveryWarn"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>${escapeHtml(info.reason || "Yetkazib berishni sozlang.")}</span></div>`;
    return false;
  }
  const deliveryFee = Number(info.data?.deliveryFeeUZS || 0);
  const promoCode = omPromoInputCode();
  if(omPromoState.valid && (promoCode !== omPromoState.code || Number(omPromoState.subtotalUZS||0) !== Number(built.totalUZS||0))){
    omInvalidatePromo(true);
    omPromoHint('Savat o‘zgardi. Promokodni qayta qo‘llang.');
  }
  const discount = omPromoState.valid ? Math.min(Number(built.totalUZS||0), Math.max(0,Number(omPromoState.discountUZS||0))) : 0;
  const beforeDiscount = Number(info.data?.totalWithDeliveryUZS || built.totalUZS + deliveryFee);
  const total = Math.max(0, beforeDiscount - discount);
  const qty = built.items.reduce((s,x)=>s + Number(x.qty||0), 0);
  totalEl.textContent = moneyUZS(total);
  productsEl.textContent = `${qty} ta mahsulot: ${moneyUZS(built.totalUZS)} + yetkazish: ${deliveryFee ? moneyUZS(deliveryFee) : "Bepul"}${discount ? ` − promokod: ${moneyUZS(discount)}` : ''}.`;
  const methodText = info.data?.method === "pickup" ? "Do‘kondan olib ketish" : (info.data?.method === "pickup_point" ? "Topshirish punktidan olib ketish" : (info.data?.serviceLabel || "Yetkazib berish"));
  const addrText = info.data?.method === "pickup" ? "Mahsulotni do‘kondan o‘zingiz olib ketasiz." : (info.data?.addressText || "Lokatsiya saqlandi.");
  deliveryEl.innerHTML = `
    <div class="paymentDeliveryIcon"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i></div>
    <div class="paymentDeliveryText"><b>${escapeHtml(methodText)}</b><span>${escapeHtml(addrText)}</span></div>
    <div class="paymentDeliveryFee">${deliveryFee ? moneyUZS(deliveryFee) : "Bepul"}</div>
  `;
  return true;
}

function openPaymentConfirm(){
  if(!currentUser){ toast("Avval kirish qiling."); return; }
  if(cart.length === 0){ toast("Savatcha bo‘sh."); return; }
  try{
    if(window.__omProfile && window.__omProfile.isProfileComplete && !window.__omProfile.isProfileComplete()){
      toast("Avval profilni to‘liq to‘ldiring.");
      goTab("profile");
      return;
    }
  }catch(_e){}
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  if(!built?.ok){ toast(built?.reason || "Mahsulot tanlang."); return; }
  const deliveryInfo = getCheckoutDeliveryInfo();
  if(!deliveryInfo.ok){
    openCheckout();
    toast(deliveryInfo.reason || "Avval yetkazib berishni sozlang.");
    return;
  }
  const paySel = document.getElementById("payTypeSelect");
  if(paySel) paySel.value = "cash"; // payment choice is intentionally requested for every order
  try{ applyPayTypeRules(); }catch(_e){}
  try{ updatePaymentModalSummary(); }catch(_e){}
  const overlay = els.paymentOverlay || document.getElementById("paymentOverlay");
  const modal = els.paymentModal || document.getElementById("paymentModal");
  if(!overlay || !modal) return;
  overlay.hidden = false;
  modal.hidden = false;
  requestAnimationFrame(()=>{
    try{ overlay.classList.add("isOpen"); modal.classList.add("isOpen"); }catch(_e){}
  });
  try{ omSyncModalOpenState(); }catch(_e){}
}

function closePaymentModal(){
  const overlay = els.paymentOverlay || document.getElementById("paymentOverlay");
  const modal = els.paymentModal || document.getElementById("paymentModal");
  try{ overlay?.classList.remove("isOpen"); modal?.classList.remove("isOpen"); }catch(_e){}
  if(modal) modal.hidden = true;
  if(overlay) overlay.hidden = true;
  try{ omSyncModalOpenState(); }catch(_e){}
}

function continueFromDeliverySetup(){
  const info = getCheckoutDeliveryInfo();
  if(!info.ok){ toast(info.reason || "Yetkazib berishni sozlang."); return; }
  try{ scheduleUserShopSync(); }catch(_e){}
  closeCheckout();
  setTimeout(openPaymentConfirm, 40);
}

function openOrderFlow(){
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  if(!built?.ok){ toast(built?.reason || "Mahsulot tanlang."); return; }
  const info = getCheckoutDeliveryInfo();
  if(info.ok) openPaymentConfirm();
  else openCheckout();
}

function getPayType(){
  const sel = document.getElementById("payTypeSelect");
  if(sel) return sel.value || "cash";
  const r = document.querySelector('input[name="paytype"]:checked');
  return r ? r.value : "cash";
}

let omDeliveryLocation = null;

function omResetDeliverySessionForUser(){
  omDeliveryLocation = null;
  try{ omDeliveryMapDraft = null; }catch(_e){}
  try{ omHideInlineDeliveryMap(); }catch(_e){}
  try{
    const methodSelect = document.getElementById("deliveryMethodSelect");
    if(methodSelect) methodSelect.value = omReadStoredDeliveryMethod();
  }catch(_e){}
  try{ renderSavedAddressesUI(); }catch(_e){}
  try{ setDeliveryLocationStatus('Lokatsiya aniqlanmagan.'); }catch(_e){}
  try{ updateDeliveryMethodUI(); }catch(_e){}
  try{ omRenderPickupPointsUI(); }catch(_e){}
}

function getDeliveryMethod(){
  const sel = document.getElementById("deliveryMethodSelect");
  if(sel) return (sel.value === "pickup" || sel.value === "pickup_point" || sel.value === "delivery") ? sel.value : "";
  const r = document.querySelector('input[name="deliveryMethod"]:checked');
  return r ? r.value : "";
}

function updateCheckoutCompactSummary(){
  if(!els.checkoutCompactSummary) return;
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  if(!built || !built.ok){
    els.checkoutCompactSummary.innerHTML = `<span>Mahsulot tanlanmagan</span><b>0 so‘m</b>`;
    try{ updateCheckoutFinalSummary(); }catch(_e){}
    return;
  }
  const info = getCheckoutDeliveryInfo();
  const total = info.ok ? Number(info.data?.totalWithDeliveryUZS || built.totalUZS) : Number(built.totalUZS || 0);
  els.checkoutCompactSummary.innerHTML = `<span>${built.items.reduce((s,x)=>s + Number(x.qty||0),0)} ta tanlangan</span><b>${moneyUZS(total)}</b>`;
  try{ updateCheckoutFinalSummary(built, info); }catch(_e){}
}

function updateCheckoutFinalSummary(prebuilt=null, preinfo=null){
  const box = document.getElementById("checkoutFinalTotal");
  if(!box) return;
  const built = prebuilt || ((typeof buildSelectedItems === "function") ? buildSelectedItems() : null);
  const labelEl = box.querySelector('.checkoutFinalTotalLabel');
  const valueEl = box.querySelector('.checkoutFinalTotalValue');
  const subEl = box.querySelector('.checkoutFinalTotalSub');
  if(!labelEl || !valueEl || !subEl) return;
  if(!built || !built.ok){
    labelEl.textContent = 'Yakuniy summa';
    valueEl.textContent = '0 so‘m';
    subEl.textContent = 'Avval mahsulot tanlang.';
    return;
  }
  const info = preinfo || getCheckoutDeliveryInfo();
  const qty = built.items.reduce((s,x)=>s + Number(x.qty||0),0);
  if(info.ok){
    const productsTotal = Number(info.data?.productsTotalUZS || built.totalUZS || 0);
    const deliveryFee = Number(info.data?.deliveryFeeUZS || 0);
    const total = Number(info.data?.totalWithDeliveryUZS || productsTotal + deliveryFee);
    labelEl.textContent = 'Yakuniy summa';
    valueEl.textContent = moneyUZS(total);
    const methodText = info.data?.method === 'pickup'
      ? `Do‘kondan olib ketish • ${qty} ta mahsulot`
      : (info.data?.method === 'pickup_point'
        ? `Topshirish punkti • ${qty} ta mahsulot`
        : `${info.data?.serviceLabel || 'Yetkazib berish'} • ${qty} ta mahsulot`);
    subEl.textContent = `${methodText}. Mahsulotlar ${moneyUZS(productsTotal)} + yetkazish ${deliveryFee ? moneyUZS(deliveryFee) : 'Bepul'}.`;
    return;
  }
  labelEl.textContent = 'Mahsulotlar summasi';
  valueEl.textContent = moneyUZS(Number(built.totalUZS || 0));
  subEl.textContent = 'Yetkazish usulini tanlang — yakuniy summa avtomatik hisoblanadi.';
}

function updateCheckoutSubmitVisibility(){
  const btn = els.checkoutSubmit || document.getElementById("checkoutSubmit");
  const hint = document.getElementById("checkoutSubmitHint");
  if(!btn) return false;
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  const info = built?.ok ? getCheckoutDeliveryInfo() : {ok:false, reason: built?.reason || "Mahsulot tanlang."};
  btn.hidden = !info.ok;
  if(hint){
    hint.hidden = !!info.ok;
    hint.textContent = info.reason || "Yetkazish usulini tanlang.";
  }
  return !!info.ok;
}

function updateCartPrimaryCTA(){
  const btn = els.orderBtnPage || document.getElementById("orderBtnPage");
  if(!btn) return;
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  if(!built || !built.ok){
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Mahsulot tanlang`;
    return;
  }
  const info = getCheckoutDeliveryInfo();
  btn.disabled = false;
  if(info.ok){
    const total = Number(info.data?.totalWithDeliveryUZS || built.totalUZS || 0);
    btn.innerHTML = `<i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> Buyurtma berish • ${moneyUZS(total)}`;
  }else{
    btn.innerHTML = `<i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Yetkazib berishni sozlash`;
  }
}

function updateDeliveryMethodUI(){
  const method = getDeliveryMethod();
  omStoreDeliveryMethod(method);
  const box = document.getElementById("deliveryAddressBox");
  if(box) box.hidden = method !== "delivery";
  const pickupBox = document.getElementById("pickupPointCheckoutBox");
  if(pickupBox) pickupBox.hidden = method !== "pickup_point";
  if(method === "pickup" || method === "pickup_point") omDeliveryQuote = null;
  if(method === "pickup_point") { try{ omRenderPickupPointsUI(); }catch(_e){} }
  try{ omRenderDeliveryEstimate(); }catch(_e){}
  try{ updateCheckoutCompactSummary(); }catch(_e){}
  try{ updateCheckoutSubmitVisibility(); }catch(_e){}
  try{ omRenderCartDeliverySummary(); }catch(_e){}
  try{ updateCartPrimaryCTA(); }catch(_e){}
  try{ updateDeliveryLocationMeta(); }catch(_e){}
  try{ if(els.paymentOverlay && !els.paymentOverlay.hidden) updatePaymentModalSummary(); }catch(_e){}
}

let omDeliveryInlineMap = null;
let omDeliveryInlineMapMarker = null;
let omDeliveryStoreMarker = null;
let omDeliveryMapDraft = null;

function omDeliveryMapCoords(loc=null){
  const x = loc || omDeliveryLocation || omDeliveryMapDraft || OM_STORE_LOCATION;
  const lat = Number(x?.lat), lng = Number(x?.lng);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat:Number(OM_STORE_LOCATION.lat), lng:Number(OM_STORE_LOCATION.lng) };
  return { lat, lng };
}

function omGoogleMapsUrl(lat, lng){
  return `https://www.google.com/maps?q=${encodeURIComponent(`${Number(lat)},${Number(lng)}`)}`;
}

function omYandexMapsUrl(lat, lng){
  return `https://yandex.com/maps/?ll=${encodeURIComponent(`${Number(lng)},${Number(lat)}`)}&z=17&pt=${encodeURIComponent(`${Number(lng)},${Number(lat)},pm2rdm`)}`;
}

function omSetMapDraft(lat, lng, showApply=true){
  lat = Number(lat); lng = Number(lng);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  omDeliveryMapDraft = { lat, lng };
  const draftText = document.getElementById('deliveryMapDraftText');
  const applyBtn = document.getElementById('deliveryMapApplyBtn');
  if(draftText) draftText.textContent = `Tanlangan nuqta: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  if(applyBtn) applyBtn.hidden = !showApply;
  if(omDeliveryInlineMapMarker){
    omDeliveryInlineMapMarker.setLatLng([lat, lng]);
  }
}

function omRenderInlineDeliveryMap({open=false, centerCurrent=true}={}){
  const panel = document.getElementById('deliveryInlineMapPanel');
  const mapEl = document.getElementById('deliveryInlineMap');
  const toggleBtn = document.getElementById('deliveryMapToggleBtn');
  if(!panel || !mapEl) return false;
  if(open) panel.hidden = false;
  if(panel.hidden){
    if(toggleBtn){
      const hasLoc = !!(omDeliveryLocation && Number.isFinite(Number(omDeliveryLocation.lat)) && Number.isFinite(Number(omDeliveryLocation.lng)));
      toggleBtn.innerHTML = `<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i><span>${hasLoc ? 'Xaritani ochish' : 'Xaritadan tanlash'}</span>`;
    }
    return false;
  }
  if(toggleBtn) toggleBtn.innerHTML = `<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i><span>Xaritani yopish</span>`;
  if(!window.L){
    mapEl.innerHTML = `<div style="padding:16px;font-size:12px;font-weight:800;color:#475569">Xarita tayyorlanmoqda...</div>`;
    omEnsureLeaflet().then(ok=>{
      if(ok)omRenderInlineDeliveryMap({open:true,centerCurrent});
      else mapEl.innerHTML=`<div style="padding:16px;font-size:12px;font-weight:800;color:#475569">Xarita yuklanmadi. Internet aloqasini tekshiring.</div>`;
    });
    return false;
  }
  const center = omDeliveryMapCoords(centerCurrent ? (omDeliveryLocation || omDeliveryMapDraft) : (omDeliveryMapDraft || omDeliveryLocation));
  if(!omDeliveryInlineMap){
    omDeliveryInlineMap = window.L.map(mapEl, { zoomControl:true, attributionControl:true }).setView([center.lat, center.lng], omDeliveryLocation ? 17 : 14);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; OpenStreetMap'
    }).addTo(omDeliveryInlineMap);
    omDeliveryStoreMarker = window.L.circleMarker([Number(OM_STORE_LOCATION.lat), Number(OM_STORE_LOCATION.lng)], {
      radius:7,
      color:'#dc2626',
      fillColor:'#dc2626',
      fillOpacity:.9,
      weight:2
    }).addTo(omDeliveryInlineMap).bindTooltip('OrzuMall do‘koni');
    omDeliveryInlineMapMarker = window.L.marker([center.lat, center.lng], { draggable:true }).addTo(omDeliveryInlineMap);
    omDeliveryInlineMapMarker.on('dragend', (e)=>{
      const p = e.target.getLatLng();
      omSetMapDraft(p.lat, p.lng, true);
    });
    omDeliveryInlineMap.on('click', (e)=> omSetMapDraft(e.latlng.lat, e.latlng.lng, true));
  }else{
    omDeliveryInlineMap.setView([center.lat, center.lng], omDeliveryLocation ? 17 : 14);
    if(omDeliveryInlineMapMarker) omDeliveryInlineMapMarker.setLatLng([center.lat, center.lng]);
  }
  const draftText = document.getElementById('deliveryMapDraftText');
  const applyBtn = document.getElementById('deliveryMapApplyBtn');
  if(omDeliveryLocation){
    omDeliveryMapDraft = { lat:Number(omDeliveryLocation.lat), lng:Number(omDeliveryLocation.lng) };
    if(draftText) draftText.textContent = `Amaldagi nuqta: ${Number(omDeliveryLocation.lat).toFixed(6)}, ${Number(omDeliveryLocation.lng).toFixed(6)}. O‘zgartirish uchun xaritani bosing.`;
    if(applyBtn) applyBtn.hidden = true;
  }else if(draftText){
    draftText.textContent = 'Yetkazib berish nuqtasini xaritadan bosing.';
  }
  setTimeout(()=>{ try{ omDeliveryInlineMap?.invalidateSize(); }catch(_e){} }, 60);
  return true;
}

function omHideInlineDeliveryMap(){
  const panel = document.getElementById('deliveryInlineMapPanel');
  if(panel) panel.hidden = true;
  try{ omRenderInlineDeliveryMap(); }catch(_e){}
}

function omToggleInlineDeliveryMap(){
  const panel = document.getElementById('deliveryInlineMapPanel');
  if(!panel) return;
  if(panel.hidden) omRenderInlineDeliveryMap({open:true});
  else omHideInlineDeliveryMap();
}

function omShowInlineDeliveryPreview(){
  try{ omRenderInlineDeliveryMap({open:true, centerCurrent:true}); }catch(_e){}
}

function omApplyInlineMapDraft(){
  if(!omDeliveryMapDraft || !Number.isFinite(Number(omDeliveryMapDraft.lat)) || !Number.isFinite(Number(omDeliveryMapDraft.lng))){
    toast('Avval xaritadan nuqtani tanlang.');
    return;
  }
  const lat = Number(omDeliveryMapDraft.lat), lng = Number(omDeliveryMapDraft.lng);
  omDeliveryLocation = {
    lat,
    lng,
    accuracy:0,
    mapUrl:omGoogleMapsUrl(lat, lng),
    savedAddressTitle:'Xaritadan belgilangan manzil',
    source:'map_picker'
  };
  const saved = omSaveDeliveryLocationOnce(omDeliveryLocation, 'Xaritadan belgilangan manzil');
  if(saved){
    omDeliveryLocation.savedAddressId = saved.id;
    omDeliveryLocation.savedAddressTitle = omAddressTitle(saved);
    const sel = document.getElementById('savedDeliveryAddressSelect');
    if(sel) sel.value = String(saved.id || '');
  }
  setDeliveryLocationStatus(`Xaritadan nuqta belgilandi: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, true);
  const applyBtn = document.getElementById('deliveryMapApplyBtn');
  if(applyBtn) applyBtn.hidden = true;
  try{ omRenderDeliveryEstimate(); }catch(_e){}
  try{ updateCheckoutCompactSummary(); }catch(_e){}
  try{ updateCheckoutSubmitVisibility(); }catch(_e){}
  try{ omRenderCartDeliverySummary(); }catch(_e){}
  try{ updateCartPrimaryCTA(); }catch(_e){}
  try{ omShowInlineDeliveryPreview(); }catch(_e){}
  toast('Xaritadagi manzil qo‘llandi va summa yangilandi.');
}

function updateDeliveryLocationMeta(){
  const wrap = document.getElementById('deliveryLocationActions');
  const copyBtn = document.getElementById('copyDeliveryCoordsBtn');
  const mapBtn = document.getElementById('openDeliveryMapBtn');
  const yandexBtn = document.getElementById('openDeliveryYandexBtn');
  const toggleBtn = document.getElementById('deliveryMapToggleBtn');
  const panel = document.getElementById('deliveryInlineMapPanel');
  const hasLoc = !!(omDeliveryLocation && Number.isFinite(Number(omDeliveryLocation.lat)) && Number.isFinite(Number(omDeliveryLocation.lng)));
  const lat = hasLoc ? Number(omDeliveryLocation.lat) : null;
  const lng = hasLoc ? Number(omDeliveryLocation.lng) : null;
  if(copyBtn){
    copyBtn.dataset.coords = hasLoc ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '';
    copyBtn.disabled = !hasLoc;
  }
  if(mapBtn){
    mapBtn.href = hasLoc ? omGoogleMapsUrl(lat, lng) : '#';
    mapBtn.setAttribute('aria-disabled', hasLoc ? 'false' : 'true');
    mapBtn.classList.toggle('isDisabled', !hasLoc);
  }
  if(yandexBtn){
    yandexBtn.href = hasLoc ? omYandexMapsUrl(lat, lng) : '#';
    yandexBtn.setAttribute('aria-disabled', hasLoc ? 'false' : 'true');
    yandexBtn.classList.toggle('isDisabled', !hasLoc);
  }
  if(wrap) wrap.hidden = !hasLoc;
  if(toggleBtn){
    const isOpen = !!panel && !panel.hidden;
    toggleBtn.innerHTML = `<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i><span>${isOpen ? 'Xaritani yopish' : (hasLoc ? 'Xaritani ochish' : 'Xaritadan tanlash')}</span>`;
  }
  if(panel && !panel.hidden){
    try{ omRenderInlineDeliveryMap({centerCurrent:true}); }catch(_e){}
  }
}

function setDeliveryLocationStatus(text, ok=false){
  const el = document.getElementById('deliveryLocationStatus');
  if(!el) return;
  const safeText = escapeHtml(String(text || '').trim() || 'Lokatsiya aniqlanmagan.');
  let html = safeText;
  if(omDeliveryLocation && Number.isFinite(Number(omDeliveryLocation.lat)) && Number.isFinite(Number(omDeliveryLocation.lng))){
    const coords = `${Number(omDeliveryLocation.lat).toFixed(6)}, ${Number(omDeliveryLocation.lng).toFixed(6)}`;
    const safeCoords = escapeHtml(coords);
    if(safeText.includes(safeCoords)){
      html = safeText.replace(safeCoords, `<span class="deliveryCoordInline">${safeCoords}</span>`);
    }else{
      html = `${safeText} <span class="deliveryCoordInline">${safeCoords}</span>`;
    }
  }
  el.innerHTML = html;
  el.classList.toggle('ok', !!ok);
  try{ updateDeliveryLocationMeta(); }catch(_e){}
}


function omSaveDeliveryLocationOnce(loc, title="Asosiy manzil"){
  try{
    if(!loc || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng))) return null;
    const lat = Number(loc.lat), lng = Number(loc.lng);
    const arr = omReadSavedAddresses();
    const near = arr.find(a=>Math.abs(Number(a.lat)-lat)<0.00003 && Math.abs(Number(a.lng)-lng)<0.00003);
    if(near) return near;
    const item = {
      id: "addr_" + Date.now(),
      title,
      address: loc.address || "Avto aniqlangan manzil",
      lat, lng,
      accuracy: Number(loc.accuracy || 0),
      mapUrl: loc.mapUrl || `https://maps.google.com/?q=${lat},${lng}`,
      createdAt: new Date().toISOString(),
      source: "checkout"
    };
    arr.unshift(item);
    omWriteSavedAddresses(arr.slice(0, 10));
    renderSavedAddressesUI();
    return item;
  }catch(_e){ return null; }
}

async function detectDeliveryLocation(){
  if(!navigator.geolocation){
    toast('Bu qurilmada joylashuvni aniqlash qo‘llab-quvvatlanmaydi.');
    return;
  }
  const btn = document.getElementById('deliveryLocateBtn');
  const old = btn ? btn.innerHTML : '';
  if(btn){
    btn.disabled = true;
    btn.innerHTML = `<span class="omBtnSpinner" aria-hidden="true"></span> Aniqlanmoqda...`;
  }
  setDeliveryLocationStatus('Joylashuv olinmoqda, ruxsat bering...');
  try{
    const pos = await new Promise((resolve, reject)=>{
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      });
    });
    const lat = Number(pos.coords.latitude);
    const lng = Number(pos.coords.longitude);
    const accuracy = Math.round(Number(pos.coords.accuracy || 0));
    omDeliveryLocation = {
      lat,
      lng,
      accuracy,
      mapUrl: `https://maps.google.com/?q=${lat},${lng}`
    };
    const saved = omSaveDeliveryLocationOnce(omDeliveryLocation, "Asosiy manzil");
    if(saved){
      omDeliveryLocation.savedAddressId = saved.id;
      omDeliveryLocation.savedAddressTitle = omAddressTitle(saved);
      const sel = document.getElementById("savedDeliveryAddressSelect");
      if(sel) sel.value = String(saved.id || "");
    }
    setDeliveryLocationStatus(`Joylashuv olindi: ${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy ? ` • ±${accuracy} m` : ''}`, true);
    try{ omShowInlineDeliveryPreview(); }catch(_e){}
    try{ omRenderDeliveryEstimate(); }catch(_e){}
    try{ updateCheckoutCompactSummary(); }catch(_e){}
    try{ updateCheckoutSubmitVisibility(); }catch(_e){}
    try{ omRenderCartDeliverySummary(); }catch(_e){}
    toast(saved ? 'Manzil saqlandi va yakuniy summa hisoblandi.' : 'Joylashuv qo‘shildi.');
  }catch(e){
    omDeliveryLocation = null;
    try{ omRenderDeliveryEstimate(); }catch(_e){}
    try{ omRenderCartDeliverySummary(); }catch(_e){}
    setDeliveryLocationStatus('Joylashuv olinmadi. Brauzer/telefon lokatsiyasiga ruxsat bering va qayta urinib ko‘ring.');
    toast('Joylashuv olinmadi. Lokatsiyaga ruxsat bering.');
  }finally{
    if(btn){
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }
}

function getCheckoutDeliveryInfo(){
  const method = getDeliveryMethod();
  const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
  if(method !== 'pickup' && method !== 'pickup_point' && method !== 'delivery'){
    return { ok:false, reason:'Yetkazish usulini tanlang.' };
  }
  if(method === 'pickup'){
    omDeliveryQuote = null;
    return {
      ok: true,
      data: {
        method: 'pickup',
        methodLabel: 'Do‘kondan olib ketish',
        addressText: 'Do‘kondan olib ketish',
        deliveryFeeUZS: 0,
        service: 'pickup',
        totalWithDeliveryUZS: built?.totalUZS || 0
      }
    };
  }
  if(method === 'pickup_point'){
    if(!built || !built.ok) return {ok:false,reason:'Tanlangan mahsulotlar topilmadi.'};
    if(!omPickupPointsLoaded && !omPickupPoints.length) return {ok:false,reason:'Topshirish punktlari yuklanmoqda. Bir ozdan so‘ng qayta tanlang.'};
    const point=omGetPickupPointById();
    if(!point) return {ok:false,reason:'Davom etish uchun topshirish punktini tanlang.'};
    const quote=omPickupPointQuote(point,Number(built.totalWeightKg||0));
    const snap=omPickupPointSnapshot(point,Number(built.totalWeightKg||0));
    return {ok:true,data:{
      method:'pickup_point',methodLabel:'Topshirish punktidan olib ketish',
      service:'pickup_point',serviceLabel:`Topshirish punkti — ${point.name}`,
      addressText:`${point.name}${point.address?' — '+point.address:''}${point.postalCode?' • Indeks: '+point.postalCode:''}${point.workingHours?' • Ish vaqti: '+point.workingHours:''}`,
      address:point.address,postalCode:point.postalCode||'',workingHours:point.workingHours||'',note:'',lat:point.lat,lng:point.lng,mapUrl:omPickupMapUrl(point)||'',pointType:point.pointType,
      pickupPointId:point.id,pickupPoint:snap,
      distanceKm:snap.distanceKm,totalWeightKg:Number(built.totalWeightKg||0),billedKg:quote.billedKg,
      deliveryFeeUZS:quote.feeUZS,deliveryRawFeeUZS:quote.rawFeeUZS,
      productsTotalUZS:built.totalUZS,totalWithDeliveryUZS:Number(built.totalUZS||0)+quote.feeUZS
    }};
  }
  if(!omDeliveryLocation){
    const saved = omBestSavedAddress();
    const loc = omLocationFromSavedAddress(saved);
    if(loc){ omDeliveryLocation = loc; }
  }
  if(!omDeliveryLocation){
    return { ok:false, reason:'Lokatsiyani aniqlang yoki xaritadan tanlang.' };
  }
  if(!built || !built.ok){
    return { ok:false, reason:'Tanlangan mahsulotlar topilmadi.' };
  }
  const weightKg = Number(built.totalWeightKg || 0);
  const quote = omBuildDeliveryQuote(built.totalUZS, weightKg, omDeliveryLocation || null);
  omDeliveryQuote = quote;
  const rec = quote.recommended || null;
  const mapUrl = omDeliveryLocation?.mapUrl || '';
  const coordText = omDeliveryLocation ? `${omDeliveryLocation.lat.toFixed(6)}, ${omDeliveryLocation.lng.toFixed(6)}` : '';
  const savedTitle = omDeliveryLocation?.savedAddressTitle || "";
  const addressText = coordText ? `${savedTitle ? savedTitle + ": " : "Avto lokatsiya: "}${coordText}` : (savedTitle || "");
  return {
    ok: true,
    data: {
      method: 'delivery',
      methodLabel: omQuoteLabel(quote),
      service: rec?.service || 'uzpost',
      serviceLabel: rec?.label || 'UzPost pochta',
      address: '',
      note: '',
      addressText: addressText,
      lat: omDeliveryLocation?.lat ?? null,
      lng: omDeliveryLocation?.lng ?? null,
      accuracy: omDeliveryLocation?.accuracy ?? null,
      mapUrl: mapUrl,
      savedAddressId: omDeliveryLocation?.savedAddressId || "",
      savedAddressTitle: omDeliveryLocation?.savedAddressTitle || "",
      location: omDeliveryLocation ? { ...omDeliveryLocation } : null,
      storeLocation: { ...OM_STORE_LOCATION },
      distanceKm: quote.distanceKm,
      totalWeightKg: quote.weightKg,
      billedKg: rec?.billedKg || null,
      billedKm: rec?.billedKm || null,
      deliveryFeeUZS: quote.deliveryFeeUZS,
      deliveryRawFeeUZS: rec?.rawFeeUZS || quote.deliveryFeeUZS,
      deliveryFreeFromUZS: rec?.freeFromUZS || null,
      deliveryIsFree: !!rec?.isFree,
      productsTotalUZS: built.totalUZS,
      totalWithDeliveryUZS: quote.totalWithDeliveryUZS,
      deliveryQuote: quote
    }
  };
}


function omReadSavedAddresses(){
  try{
    const arr = JSON.parse(localStorage.getItem(omSavedAddressStorageKey()) || "[]");
    return omOwnedAddresses(arr);
  }catch(_){ return []; }
}

function omWriteSavedAddresses(arr){
  try{ localStorage.setItem(omSavedAddressStorageKey(), JSON.stringify(omStampOwnedAddresses(Array.isArray(arr) ? arr : []))); }catch(_){}
  try{ scheduleUserShopSync(); }catch(_){}
}

function omAddressTitle(a, i=0){
  return (a?.title || a?.name || `Manzil ${i+1}`).toString().trim();
}

function omAddressLine(a){
  const parts = [];
  if(a?.address) parts.push(String(a.address).trim());
  if(a?.lat && a?.lng) parts.push(`${Number(a.lat).toFixed(6)}, ${Number(a.lng).toFixed(6)}`);
  return parts.filter(Boolean).join(" • ");
}

function omGetGeoPosition(){
  return new Promise((resolve, reject)=>{
    if(!navigator.geolocation) return reject(new Error("geo_not_supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    });
  });
}

function renderSavedAddressesUI(){
  const arr = omReadSavedAddresses();

  const list = document.getElementById("savedAddressList");
  const status = document.getElementById("savedAddressStatus");
  if(list){
    list.innerHTML = "";
    if(!arr.length){
      list.innerHTML = `<div class="savedAddressEmpty">Hali manzil saqlanmagan.</div>`;
    }else{
      arr.forEach((a, i)=>{
        const row = document.createElement("div");
        row.className = "savedAddressItem";
        row.innerHTML = `
          <div class="savedAddressItemIcon"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></div>
          <div class="savedAddressItemText">
            <div class="savedAddressItemTop"><b>${escapeHtml(omAddressTitle(a, i))}</b><span class="savedAddressMiniPill">${i===0 ? 'Asosiy' : 'Saqlangan'}</span></div>
            <span>${escapeHtml(omAddressLine(a) || "Manzil ma’lumoti yo‘q")}</span>
          </div>
          <button type="button" class="savedAddressDelete" data-del="${escapeHtml(String(a.id || ""))}" title="O‘chirish" aria-label="O‘chirish"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        `;
        list.appendChild(row);
      });
    }
  }
  if(status){
    status.textContent = arr.length ? `${arr.length} ta manzil saqlandi.` : "Kuryer uchun nuqta qo‘lda yozilmaydi, faqat avto lokatsiya saqlanadi.";
  }
  const countPill = document.getElementById("savedAddressCountPill");
  if(countPill) countPill.textContent = String(arr.length || 0);

  const wrap = document.getElementById("savedAddressCheckoutWrap");
  const sel = document.getElementById("savedDeliveryAddressSelect");
  if(wrap && sel){
    wrap.hidden = arr.length === 0;
    const current = sel.value || "";
    sel.innerHTML = `<option value="">Saqlangan manzilni tanlang</option>` + arr.map((a,i)=>{
      const id = String(a.id || "");
      const txt = `${omAddressTitle(a,i)} — ${omAddressLine(a) || ""}`.trim();
      return `<option value="${escapeHtml(id)}">${escapeHtml(txt)}</option>`;
    }).join("");
    if(current && arr.some(a=>String(a.id)===current)) sel.value = current;
    else if(!current && arr[0]?.id) sel.value = String(arr[0].id);
  }
}

function applySavedAddressToCheckout(id){
  const arr = omReadSavedAddresses();
  const a = arr.find(x=>String(x.id)===String(id));
  if(!a) return;

  const deliverySelect = document.getElementById("deliveryMethodSelect");
  if(deliverySelect) deliverySelect.value = "delivery";
  updateDeliveryMethodUI();

  const addrInput = document.getElementById("deliveryAddressInput");
  const noteInput = document.getElementById("deliveryNoteInput");
  if(addrInput) addrInput.value = a.address || omAddressTitle(a);
  if(noteInput && !noteInput.value) noteInput.value = a.note || "";

  if(a.lat && a.lng){
    omDeliveryLocation = {
      lat: Number(a.lat),
      lng: Number(a.lng),
      accuracy: Number(a.accuracy || 0),
      mapUrl: a.mapUrl || `https://maps.google.com/?q=${Number(a.lat)},${Number(a.lng)}`,
      savedAddressId: a.id,
      savedAddressTitle: omAddressTitle(a)
    };
    setDeliveryLocationStatus(`Saqlangan manzil tanlandi: ${omAddressTitle(a)} • ${Number(a.lat).toFixed(6)}, ${Number(a.lng).toFixed(6)}`, true);
  }else{
    setDeliveryLocationStatus(`Saqlangan manzil tanlandi: ${omAddressTitle(a)}`, true);
  }
  try{ omShowInlineDeliveryPreview(); }catch(_e){}
  try{ omRenderDeliveryEstimate(); }catch(_e){}
  try{ updateCheckoutCompactSummary(); }catch(_e){}
  try{ updateCheckoutSubmitVisibility(); }catch(_e){}
  try{ omRenderCartDeliverySummary(); }catch(_e){}
}

async function saveCurrentAddressFromProfile(){
  const btn = document.getElementById("savedAddressDetectSave");
  const titleInput = document.getElementById("savedAddressName");
  const addressInput = document.getElementById("savedAddressText");
  const status = document.getElementById("savedAddressStatus");
  const old = btn ? btn.innerHTML : "";
  if(btn){
    btn.disabled = true;
    btn.innerHTML = `<span class="omBtnSpinner" aria-hidden="true"></span> Aniqlanmoqda...`;
  }
  if(status) status.textContent = "Joylashuv olinmoqda, ruxsat bering...";
  try{
    const pos = await omGetGeoPosition();
    const lat = Number(pos.coords.latitude);
    const lng = Number(pos.coords.longitude);
    const accuracy = Math.round(Number(pos.coords.accuracy || 0));
    const title = (titleInput?.value || "").trim() || "Uyim";
    const address = (addressInput?.value || "").trim();
    const item = {
      id: "addr_" + Date.now(),
      title,
      address,
      lat,
      lng,
      accuracy,
      mapUrl: `https://maps.google.com/?q=${lat},${lng}`,
      createdAt: new Date().toISOString()
    };
    const arr = omReadSavedAddresses();
    arr.unshift(item);
    omWriteSavedAddresses(arr.slice(0, 10));
    if(titleInput) titleInput.value = "";
    if(addressInput) addressInput.value = "";
    if(status) status.textContent = `${title} saqlandi. Endi buyurtmada tanlashingiz mumkin.`;
    renderSavedAddressesUI();
    toast("Manzil saqlandi.");
  }catch(e){
    if(status) status.textContent = "Joylashuv olinmadi. Ruxsat bering yoki GPSni yoqing.";
    toast("Joylashuv olinmadi.");
  }finally{
    if(btn){
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }
}

function initSavedAddressUI(){
  document.getElementById("savedAddressDetectSave")?.addEventListener("click", saveCurrentAddressFromProfile);
  document.getElementById("savedAddressList")?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-del]");
    if(!btn) return;
    const id = btn.getAttribute("data-del");
    const arr = omReadSavedAddresses().filter(a=>String(a.id)!==String(id));
    omWriteSavedAddresses(arr);
    renderSavedAddressesUI();
    toast("Manzil o‘chirildi.");
  });
  document.getElementById("savedDeliveryAddressSelect")?.addEventListener("change", (e)=>{
    if(e.target.value) applySavedAddressToCheckout(e.target.value);
  });
  renderSavedAddressesUI();
}


function initCheckoutDeliveryUI(){
  document.getElementById("deliveryMethodSelect")?.addEventListener("change", updateDeliveryMethodUI);
  document.getElementById("payTypeSelect")?.addEventListener("change", ()=>{
    try{ updateCheckoutCompactSummary(); }catch(_e){}
  });
  document.getElementById('deliveryLocateBtn')?.addEventListener('click', detectDeliveryLocation);
  document.getElementById('deliveryUseNewLocation')?.addEventListener('click', detectDeliveryLocation);
  document.getElementById('copyDeliveryCoordsBtn')?.addEventListener('click', async (e)=>{
    const coords = String(e.currentTarget?.dataset?.coords || '').trim();
    if(!coords) return;
    try{
      await navigator.clipboard.writeText(coords);
      toast('Koordinata nusxalandi.');
    }catch(_e){
      try{
        const ta = document.createElement('textarea');
        ta.value = coords;
        ta.setAttribute('readonly','readonly');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast('Koordinata nusxalandi.');
      }catch(_ee){
        toast('Nusxalash amalga oshmadi.');
      }
    }
  });
  document.getElementById('deliveryMapToggleBtn')?.addEventListener('click', omToggleInlineDeliveryMap);
  document.getElementById('deliveryMapCloseBtn')?.addEventListener('click', omHideInlineDeliveryMap);
  document.getElementById('deliveryMapApplyBtn')?.addEventListener('click', omApplyInlineMapDraft);
  const sel = document.getElementById("deliveryMethodSelect");
  if(sel && !sel.value){
    const stored = omReadStoredDeliveryMethod();
    if(stored) sel.value = stored;
  }
  updateDeliveryMethodUI();
  try{ initPickupPointUI(); }catch(_e){}
  try{ renderSavedAddressesUI(); }catch(_){ }
  try{ updateDeliveryLocationMeta(); }catch(_e){}
  try{ updateCheckoutFinalSummary(); }catch(_e){}
}
initCheckoutDeliveryUI();
initSavedAddressUI();
omLoadDeliverySettings().catch(()=>{});
omLoadPickupPoints().catch(()=>{});


function applyPayTypeRules(){
  try{
    const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
    const items = built && built.ok ? built.items : [];
    const hasPrepay = items.some(it=>it.prepayRequired) || cart.some(ci=>{
      const p = products.find(x=>x.id===ci.id);
      return p && (_normPType(p)==="cargo" || p.prepayRequired===true);
    });

    const sel = document.getElementById("payTypeSelect");
    const cashOpt = sel?.querySelector('option[value="cash"]');
    const balOpt = sel?.querySelector('option[value="balance"]');
    if(cashOpt) cashOpt.disabled = !!hasPrepay;
    if(balOpt) balOpt.disabled = false;
    if(hasPrepay && sel) sel.value = "balance";

    const note = document.getElementById("payRuleNote");
    if(note){
      note.textContent = hasPrepay
        ? "⚠️ Keltirib berish mahsulotlari uchun faqat balansdan oldindan to‘lov mavjud."
        : "";
    }
    try{ updateCheckoutCompactSummary(); }catch(_e){}
    try{ if(els.paymentOverlay && !els.paymentOverlay.hidden) updatePaymentModalSummary(); }catch(_e){}
  }catch(e){
    console.warn("applyPayTypeRules failed:", e);
  }
}
window.applyPayTypeRules = applyPayTypeRules;



let __omOrderSubmitting = false;

function showOrderWaitOverlay(){
  // v140: do not block the screen. Only the pressed action buttons show a compact busy state.
  try{ document.getElementById("omOrderWaitOverlay")?.remove(); }catch(_e){}
  const btns = [els?.checkoutSubmit, els?.paymentSubmit, els?.orderBtnPage].filter(Boolean);
  btns.forEach(btn=>{if(!btn.dataset.omOldHtml)btn.dataset.omOldHtml=btn.innerHTML;btn.disabled=true;btn.classList.add("isLoading")});
  if(els?.checkoutSubmit)els.checkoutSubmit.innerHTML=`<span class="omBtnSpinner" aria-hidden="true"></span> Kuting...`;
  if(els?.paymentSubmit)els.paymentSubmit.innerHTML=`<span class="omBtnSpinner" aria-hidden="true"></span> Yuborilmoqda...`;
}

function hideOrderWaitOverlay(){
  try{ document.getElementById("omOrderWaitOverlay")?.remove(); }catch(_e){}
  document.documentElement.classList.remove("om-order-waiting");document.body.classList.remove("om-order-waiting");
  const btns=[els?.checkoutSubmit,els?.paymentSubmit,els?.orderBtnPage].filter(Boolean);
  btns.forEach(btn=>{btn.disabled=false;btn.classList.remove("isLoading");if(btn.dataset.omOldHtml){btn.innerHTML=btn.dataset.omOldHtml;delete btn.dataset.omOldHtml}});
}


async function createOrderFromCheckout(){
  if(__omOrderSubmitting) return;
  if(!currentUser){
    toast("Avval kirish qiling (Telefon raqam + parol).");
    document.getElementById('authCard')?.scrollIntoView({behavior:'smooth'});
    return;
  }
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }

  const built = buildSelectedItems();
  if(!built.ok){ toast(built.reason); return; }

  const hasPrepay = built.items.some(it=>it.prepayRequired);
  const note = document.getElementById("payRuleNote");
  if(note){
    note.textContent = hasPrepay ? "⚠️ Keltirib berish mahsulotlari uchun oldindan to‘lov: BALANS." : "";
  }


  const deliveryInfo = getCheckoutDeliveryInfo();
  if(!deliveryInfo.ok){
    toast(deliveryInfo.reason || 'Yetkazish ma’lumotlarini to‘ldiring.');
    return;
  }

  let payType = getPayType(); // cash | balance
  if(hasPrepay && payType !== "balance"){
    toast("Keltirib berish mahsulotlari: faqat BALANS orqali to‘lanadi.");
    const paySel = document.getElementById("payTypeSelect");
    if(paySel) paySel.value = "balance";
    payType = "balance";
  }
  __omOrderSubmitting = true;
  showOrderWaitOverlay();

  const deliveryFeeUZS = Number(deliveryInfo.data?.deliveryFeeUZS || 0);
  const grandTotalUZS = Number(deliveryInfo.data?.totalWithDeliveryUZS || (built.totalUZS + deliveryFeeUZS));
  const orderId = null; // server will allocate unique short id
  const amountTiyin = Math.round(grandTotalUZS * 100);

  // Yetkazish ma’lumoti faqat buyurtma vaqtida tanlangan usuldan olinadi.
  // Profil ichida majburiy yashash manzili saqlanmaydi.
  const shippingSnap = { ...(deliveryInfo.data || {}) };

  const payload = {
    orderId,
    provider: payType === 'balance' ? 'balance' : 'cash',
    status: 'new',
    paymentStatus: payType === 'balance' ? 'paid' : 'cash_on_delivery',
    items: built.items,
    totalUZS: grandTotalUZS,
    productsTotalUZS: built.totalUZS,
    deliveryFeeUZS,
    amountTiyin: null,
    shipping: shippingSnap
  };

    try{
    if(payload.provider === "balance"){
      // Secure balance payment via Netlify Function (admin SDK)
      const token = await currentUser.getIdToken();
      const resp = await fetch("/.netlify/functions/balancePay", {
        method: "POST",
        headers: {
          "content-type":"application/json",
          "authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: payload.orderId,
          items: payload.items,
          totalUZS: payload.totalUZS,
          promoCode: omPromoInputCode(),
          shipping: payload.shipping || null
        })
      });
      const out = await resp.json().catch(()=>({}));
      if(out && out.orderId) payload.orderId = String(out.orderId);
      if(!resp.ok || !out.ok){
        if(out && (out.error === "insufficient_balance" || out.error === "Balans yetarli emas")){
          toast("Balans yetarli emas.");
          hideOrderWaitOverlay();
          __omOrderSubmitting = false;
          return;
        }
        throw new Error(out?.error || out?.detail || "balance_pay_failed");
      }
      try{ tgNotifyOrderCreated(payload.orderId); }catch(_e){}
    } else {
      // Cash checkout: create order via Netlify Function (avoids Firestore permission issues)
      const token = await currentUser.getIdToken();
      const resp = await fetch("/.netlify/functions/createOrderCash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          items: payload.items,
          totalUZS: payload.totalUZS,
          promoCode: omPromoInputCode(),
          shipping: payload.shipping || null
        })
      });
      const out = await resp.json().catch(()=>({}));
      if(!resp.ok || !out.ok || !out.orderId){
        throw new Error(out?.error || "cash_order_failed");
      }
      payload.orderId = String(out.orderId);
      try{ tgNotifyOrderCreated(payload.orderId); }catch(_e){}
    }

    if(payload.shipping?.method === "delivery" && payload.shipping?.lat && payload.shipping?.lng){
      try{ omSaveDeliveryLocationOnce(payload.shipping, payload.shipping.savedAddressTitle || "Asosiy manzil"); }catch(_e){}
    }
    omRecordPurchaseMetrics(built.items);
    removePurchasedFromCart(built.sel);
    updateBadges();
    renderCartPage();
    closeCheckout();
    closePaymentModal();
  }catch(e){
    console.warn("checkout order create failed", e);
    const msg = (e && e.message) ? String(e.message) : "";
    const upperMsg = msg.toUpperCase();
    const friendly = msg === "out_of_stock" || msg.startsWith("OUT_OF_STOCK:")
      ? "Mahsulot qoldig‘i yetarli emas. Savatni yangilang."
      : (msg === "PRODUCT_INACTIVE" || msg.startsWith("PRODUCT_INACTIVE:"))
        ? "Mahsulot sotuvi vaqtincha to‘xtatilgan."
        : upperMsg.startsWith("PROMO_")
          ? omPromoErrorText(upperMsg)
          : (msg ? ("Buyurtma yaratilmadi: " + msg) : "Buyurtma yaratilmadi. Qayta urinib ko‘ring.");
    toast(friendly);
    hideOrderWaitOverlay();
    __omOrderSubmitting = false;
    return; // IMPORTANT: don't show success message on failure
  }

  hideOrderWaitOverlay();
  __omOrderSubmitting = false;
  try{ const promoInput=document.getElementById('promoCodeInput'); if(promoInput)promoInput.value=''; omInvalidatePromo(); }catch(_e){}
  toast("Buyurtmangiz qabul qilindi");
  goTab("profile");
}

/* =========================
   Products: pagination (Load more + infinite scroll)
========================= */
let unsubProducts = null; // legacy; kept to avoid reference errors
const PRODUCTS_PAGE_SIZE = 24;
let productsLast = null;
let productsLoading = false;
let productsDone = false;

function resetProductsPaging(){
  productsLast = null;
  productsLoading = false;
  productsDone = false;
  products = [];
  // UI
  try{
    const btn = document.getElementById("loadMoreBtn");
    const pager = document.getElementById("productsPager");
    if(pager) pager.hidden = false;
    if(btn){
      btn.disabled = false;
      btn.textContent = omTrText("Yana yuklash");
      btn.style.display = "";
    }
  }catch(e){}
}

/**
 * Loads next page from Firestore and appends into `products`.
 * Uses createdAt desc if possible; falls back gracefully.
 */
async function loadProductsPage(){
  if(productsLoading || productsDone) return;
  productsLoading = true;

  const btn = document.getElementById("loadMoreBtn");
  if(btn){
    btn.disabled = true;
    btn.textContent = omTrText("Yuklanmoqda...");
  }

  try{
    const colRef = collection(db, "products");

		// IMPORTANT: Public catalog must only query documents that the user can read.
		// If a query could include even 1 unreadable doc (e.g., status != "approved"),
		// Firestore rejects the *entire* query with permission-denied.
		// So we always filter to approved here.
		const approvedOnly = where("status", "==", "approved");

    // Query modes (avoid composite indexes by default).
    // Primary: updatedAt desc (most docs already have updatedAt).
    const modes = [
      {
        name: "updatedAt",
        build: (after)=> after
					? query(colRef, approvedOnly, orderBy("updatedAt","desc"), startAfter(after), limit(PRODUCTS_PAGE_SIZE))
					: query(colRef, approvedOnly, orderBy("updatedAt","desc"), limit(PRODUCTS_PAGE_SIZE))
      },
      {
        name: "createdAt",
        build: (after)=> after
					? query(colRef, approvedOnly, orderBy("createdAt","desc"), startAfter(after), limit(PRODUCTS_PAGE_SIZE))
					: query(colRef, approvedOnly, orderBy("createdAt","desc"), limit(PRODUCTS_PAGE_SIZE))
      },
      {
        name: "popularScore",
        build: (after)=> after
					? query(colRef, approvedOnly, orderBy("popularScore","desc"), startAfter(after), limit(PRODUCTS_PAGE_SIZE))
					: query(colRef, approvedOnly, orderBy("popularScore","desc"), limit(PRODUCTS_PAGE_SIZE))
      },
    ];

    let snap = null;
    let lastErr = null;

    for(const mode of modes){
      try{
        const qy = mode.build(productsLast);
        snap = await getDocs(qy);
        lastErr = null;
        break;
      }catch(e){
        lastErr = e;
        // If permission denied, don't keep retrying.
        if(String(e?.code||"") === "permission-denied") break;
        // If index required for a given mode, we'll try the next mode.
      }
    }

    if(lastErr) throw lastErr;

    
    if(snap.empty){
      productsDone = true;
      if(btn){
        btn.textContent = omTrText("Hammasi yuklandi");
        btn.style.display = "none";
      }
      return;
    }

    productsLast = snap.docs[snap.docs.length - 1];

    const arr = snap.docs.map(d=> {
      const data = d.data() || {};
      // Client-side active filters (avoid composite indexes): hidden product or blocked seller must not appear.
      if(("isActive" in data) && data.isActive === false) return null;
      if(("sellerActive" in data) && data.sellerActive === false) return null;
      const price = (data.price ?? data.priceUZS ?? data.uzs ?? data.amount);
      const created = (data.createdAt ?? data.created_at ?? data.created ?? data.updatedAt ?? data.updated_at ?? data.updated);
      return {
        id: String(data.id || d.id),
        weightKg: Number(data.weightKg ?? data.weight_kg ?? data.weight ?? data.massKg ?? 0) || 0,
        fulfillmentType: (data.fulfillmentType || data.fulfillment || (data.isCargo ? 'cargo' : 'stock') || 'stock'),
        deliveryMinDays: (data.deliveryMinDays ?? (data.fulfillmentType==='cargo'||data.fulfillment==='cargo'||data.isCargo ? 15 : 1)),
        deliveryMaxDays: (data.deliveryMaxDays ?? (data.fulfillmentType==='cargo'||data.fulfillment==='cargo'||data.isCargo ? 30 : 7)),
        prepayRequired: (data.prepayRequired ?? ((data.fulfillmentType==='cargo'||data.fulfillment==='cargo'||data.isCargo) ? true : false)),
        ...data,
        _docId: d.id,
        _price: parseUZS(price),
        _created: toMillis(created),
      };
    }).filter(Boolean);

    // Append (avoid duplicates by _docId/id)
    const seen = new Set(products.map(p=>String(p._docId || p.id)));
    for(const p of arr){
      const key = String(p._docId || p.id);
      if(!seen.has(key)){
        products.push(p);
        seen.add(key);
      }
    }

    omI18nProductsReady();
    buildTagCounts();
    buildCategoryTree();
    applyFilterSort();
    omRefreshCustomerExperience();
    if(activeTab==="product") renderProductPage();
    // Warm only a few metrics while the browser is idle. Product docs already contain mirrored counters,
    // so a 24-request burst and a second full grid rebuild are unnecessary.
    const metricIds = arr.slice(0, 8).map(p=>p.id);
    const warmMetrics = ()=>preloadProductMetrics(metricIds).catch(()=>{});
    if("requestIdleCallback" in window) window.requestIdleCallback(warmMetrics, {timeout:1800});
    else window.setTimeout(warmMetrics, 900);
    if(activeTab==="categories") renderCategoriesPage();

    // If fewer than page size, we reached the end
    if(arr.length < PRODUCTS_PAGE_SIZE){
      productsDone = true;
      if(btn) btn.style.display = "none";
    }
  }catch(err){
    console.warn("Firestore products error", err);
    showToast("Mahsulotlarni yuklab bo'lmadi (Firestore). Rules/Index tekshiring.", "warn");
  }finally{
    productsLoading = false;
    if(btn && !productsDone){
      btn.disabled = false;
      btn.textContent = omTrText("Yana yuklash");
    }
  }
}

async function loadProducts(){
  // Reset + first page
  resetProductsPaging();
  await loadProductsPage();
}

// Wire up pager button + infinite scroll sentinel
(function initProductsPager(){
  try{
    const btn = document.getElementById("loadMoreBtn");
    if(btn){
      btn.addEventListener("click", ()=> loadProductsPage());
    }
    const sentinel = document.getElementById("loadMoreSentinel");
    if(sentinel && "IntersectionObserver" in window){
      const io = new IntersectionObserver((entries)=>{
        const e = entries[0];
        if(e && e.isIntersecting){
          loadProductsPage();
        }
      }, { root: null, rootMargin: "420px 0px", threshold: 0.01 });
      io.observe(sentinel);
    }
  }catch(e){}
})();

/* ================== PHONE + PASSWORD AUTH ================== */
function normPhone(raw){
  const s = String(raw||"").trim().replace(/[\s\-\(\)]/g,"");
  if(!s) return "";
  let p = s;
  if(p.startsWith("00")) p = "+" + p.slice(2);
  if(!p.startsWith("+")) p = "+" + p;
  // allow only + and digits
  p = "+" + p.replace(/[^0-9]/g,"");
  // Uzbekistan typical length +998XXXXXXXXX (13 chars)
  if(!/^\+\d{7,15}$/.test(p)) return "";
  return p;
}
function phoneToEmail(phone){
  // deterministic pseudo-email for Firebase Auth email/password
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return `p${digits}@orzumall.phone`;
}
function showAuthNotice(el, msg, kind="info"){
  if(!el) return;
  el.style.display = "";
  el.textContent = String(msg||"");
  el.classList.remove("isError","isOk");
  if(kind==="error") el.classList.add("isError");
  if(kind==="ok") el.classList.add("isOk");
}
function clearAuthNotices(){
  if(els.authNotice){ els.authNotice.style.display="none"; els.authNotice.textContent=""; els.authNotice.classList.remove("isError","isOk"); }
  if(els.authNotice2){ els.authNotice2.style.display="none"; els.authNotice2.textContent=""; els.authNotice2.classList.remove("isError","isOk"); }
}
function setAuthTab(tab){
  const isLogin = tab === "login";
  if(els.tabLogin) els.tabLogin.classList.toggle("isActive", isLogin);
  if(els.tabSignup) els.tabSignup.classList.toggle("isActive", !isLogin);
  if(els.tabLogin) els.tabLogin.setAttribute("aria-selected", isLogin ? "true":"false");
  if(els.tabSignup) els.tabSignup.setAttribute("aria-selected", !isLogin ? "true":"false");
  if(els.loginForm) els.loginForm.style.display = isLogin ? "" : "none";
  if(els.signupForm) els.signupForm.style.display = !isLogin ? "" : "none";
  clearAuthNotices();
}
function wireEyeButtons(){
  document.querySelectorAll("[data-eye]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-eye");
      const inp = document.getElementById(id);
      if(!inp) return;
      inp.type = (inp.type === "password") ? "text" : "password";
    });
  });
}
/* ================== /PHONE + PASSWORD AUTH ================== */

function setUserUI(user){
  const prevUid = String(currentUser?.uid || "");
  currentUser = user || null;
  const nextUid = String(currentUser?.uid || "");
  if(prevUid !== nextUid){
    try{ omResetDeliverySessionForUser(); }catch(_e){}
  }
  const authCard = els.authCard || document.getElementById("authCard");

  document.body.classList.toggle("signed-in", !!user);

  if(!user){
    // Require login: redirect to dedicated login page
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace(`/login.html?next=${next}`);
    return;
  }

  if(authCard) authCard.style.display = "none";

  // Avatar: always use Font Awesome profile icon (no image / initials)
  if(els.avatarIcon) els.avatarIcon.style.display = "grid";
  if(els.avatarBtn) els.avatarBtn.disabled = false;

  // keep profile modal header in sync
  if(window.__omProfile) window.__omProfile.syncUser(user);
}

els.profileLogout?.addEventListener("click", async ()=>{ await signOut(auth); });


els.q.addEventListener("input", applyFilterSort);
els.sort.addEventListener("change", applyFilterSort);



// panel & views
// Favorites should open like cart (drawer), not just filter the grid.
els.favViewBtn?.addEventListener("click", ()=> goTab("fav"));
els.cartBtn?.addEventListener("click", ()=> goTab("cart"));
els.panelClose?.addEventListener("click", closePanel);
els.overlay?.addEventListener("click", closePanel);
// cart select all
els.selectAllBox?.addEventListener("change", ()=>{
  if((els.panelTitle?.textContent || "").trim() !== "Savatcha") return;
  if(els.selectAllBox.checked){
    cartSelected = new Set(cart.map(x=>x.key));
  } else {
    cartSelected = new Set();
  }
  updateCartSelectUI();
  renderPanel("cart");
});


// variant modal events
els.vClose?.addEventListener("click", closeVariantModal);
els.vCancel?.addEventListener("click", closeVariantModal);
els.vOverlay?.addEventListener("click", (e)=>{
  // click on the dim area closes; click inside card does not
  if(e.target === els.vOverlay) closeVariantModal();
});
els.vMinus?.addEventListener("click", ()=>{
  vState.qty = Math.max(1, (vState.qty||1) - 1);
  if(els.vQty) els.vQty.textContent = String(vState.qty);
});
els.vPlus?.addEventListener("click", ()=>{
  vState.qty = Math.min(99, (vState.qty||1) + 1);
  if(els.vQty) els.vQty.textContent = String(vState.qty);
});
els.vConfirm?.addEventListener("click", ()=>{
  const p = vState.product;
  if(!p) return;
  if(!validateVariantSelection()) return;
  const sel = normalizeSelectionForProduct(p, vState.sel);
  addToCart(p.id, vState.qty || 1, sel);
  updateBadges();
  closeVariantModal();
  if(vState.openCartAfter) openPanel("cart");
});

// image viewer events
els.miniClose?.addEventListener("click", closeMini);
els.miniBackdrop?.addEventListener("click", closeMini);

els.imgViewerClose?.addEventListener("click", closeImageViewer);
els.imgViewerBackdrop?.addEventListener("click", closeImageViewer);
els.imgPrev?.addEventListener("click", ()=>stepViewer(-1));
els.imgNext?.addEventListener("click", ()=>stepViewer(+1));

// Product card action buttons moved into image viewer.
// Cart remains on the product card; info/video/reviews open from this quick-view footer.
document.getElementById("qvInfoBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  if(viewer?.productId) openMini("info", viewer.productId);
});
document.getElementById("qvVideoBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  if(viewer?.productId) openMini("video", viewer.productId);
});

// swipe (mobile) for image viewer
(() => {
  const stage = document.querySelector('#imgViewer .qvStage');
  if(!stage) return;
  let sx = 0, sy = 0, active = false;
  const TH = 42;
  stage.addEventListener('touchstart', (e)=>{
    if(!viewer.open) return;
    const t = e.touches && e.touches[0];
    if(!t) return;
    active = true;
    sx = t.clientX;
    sy = t.clientY;
  }, {passive:true});
  stage.addEventListener('touchend', (e)=>{
    if(!viewer.open || !active) return;
    active = false;
    const t = e.changedTouches && e.changedTouches[0];
    if(!t) return;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if(Math.abs(dx) < TH) return;
    // ignore mostly-vertical gestures
    if(Math.abs(dy) > Math.abs(dx) * 0.8) return;
    if(dx < 0) stepViewer(+1);
    else stepViewer(-1);
  }, {passive:true});
})();

// reviews (viewer)
els.revSend?.addEventListener("click", async ()=>{
  const productId = viewer.productId;
  if(!productId) return;

  const user = auth.currentUser;
  if(!user){
    alert("Sharh qoldirish uchun avval kirish qiling.");
    return;
  }

  const stars = Math.max(1, Math.min(5, Number(draftStars)||5));
  const text = (els.revText?.value || "").trim().slice(0, 400);

  // Rasm yuklash olib tashlandi
  if(text && text.length < 2){
    alert("Sharh matni kamida 2 ta belgidan iborat bo‘lsin.");
    return;
  }

  els.revSend.disabled = true;
  const oldLabel = els.revSend.textContent;
  els.revSend.textContent = "Yuborilmoqda...";

  try{
    await omSubmitReviewSecure(productId, stars, text);

    if(els.revText) els.revText.value = "";

    // Real stats: Firestore aggregate orqali yangilab qo‘yamiz
    await refreshStats(productId, true);

    applyFilterSort();
  }catch(err){
    
    alert("Sharh yuborishda xatolik. Keyinroq urinib ko‘ring.");
  }finally{
    els.revSend.disabled = false;
    els.revSend.textContent = oldLabel;
  }
});

// viewer actions
els.viewerCart?.addEventListener("click", ()=>{
  const p = products.find(x=>x.id===viewer.productId);
  if(!p) return;
  handleAddToCart(p, { openCartAfter: false });
});
els.viewerBuy?.addEventListener("click", ()=>{
  const p = products.find(x=>x.id===viewer.productId);
  if(!p) return;
  handleAddToCart(p, { openCartAfter: false });
});
window.addEventListener("keydown", (e)=>{
  if(vState.open && e.key === "Escape"){
    closeVariantModal();
    return;
  }
  if(!viewer.open) return;
  if(e.key === "Escape") closeImageViewer();
  if(e.key === "ArrowLeft") stepViewer(-1);
  if(e.key === "ArrowRight") stepViewer(+1);
});
els.clearBtn?.addEventListener("click", ()=>{
  if(els.panelTitle.textContent.includes("Sevimli")){
    favs = new Set();
    saveLS(LS.favs, []);
  } else {
    const sel = new Set(selectedCartItems().map(x=>x.key));
    if(sel.size === 0){
      toast("Hech narsa tanlanmagan.");
      return;
    }
    cart = cart.filter(x=>!sel.has(x.key));
    saveLS(LS.cart, cart);
    cartSelected = new Set(cart.map(x=>x.key));
  }
  updateBadges();
  renderPanel(els.panelTitle.textContent.includes("Sevimli") ? "fav" : "cart");
  updateCartSelectUI();
  if(viewMode === "fav") applyFilterSort();
});
function buildSelectedItems(){
  const _selCart = selectedCartItems();
  if(_selCart.length === 0) return { ok:false, reason:"Hech narsa tanlanmagan.", sel:[], items:[], totalUZS:0, totalWeightKg:0 };
  let totalWeightKg = 0;
  const items = _selCart.map(ci=>{
    const p = products.find(x=>x.id===ci.id);
    const pr = p ? getVariantPricing(p, {color: ci.color||null, size: ci.size||null}) : {price:0};
    const qty = Number(ci.qty||1);
    const weightKg = omProductWeightKg(p);
    const lineWeightKg = weightKg * qty;
    totalWeightKg += lineWeightKg;
    return {
      productId: ci.id,
      name: p?.name || "",
      color: ci.color || null,
      size: ci.size || null,
      qty,
      priceUZS: Number(pr.price||0),
      weightKg,
      lineWeightKg,
      fulfillmentType: (p?.fulfillmentType || "stock"),
      deliveryMinDays: Number(p?.deliveryMinDays ?? (p?.fulfillmentType==="cargo"?15:1)),
      deliveryMaxDays: Number(p?.deliveryMaxDays ?? (p?.fulfillmentType==="cargo"?30:7)),
      prepayRequired: !!(p?.prepayRequired ?? (p?.fulfillmentType==="cargo")),
    };
  });
  const totalUZS = items.reduce((s,it)=> s + (it.priceUZS||0) * (it.qty||0), 0);
  if(!Number.isFinite(totalUZS) || totalUZS <= 0) return { ok:false, reason:"Jami summa noto‘g‘ri.", sel:_selCart, items, totalUZS:0, totalWeightKg };
  return { ok:true, reason:"", sel:_selCart, items, totalUZS, totalWeightKg };
}

// Legacy client-side order creation removed in v138.
// Checkout orders are created only through secure Netlify Functions.

function removePurchasedFromCart(sel){
  const purchased = new Set((sel||[]).map(x=>x.key));
  cart = cart.filter(x=>!purchased.has(x.key));
  saveLS(LS.cart, cart);
  cartSelected = new Set(cart.map(x=>x.key));
  updateBadges();
  renderCartPage?.();
  renderPanel?.("cart");
  updateCartSelectUI();
}



/* =========================
   Balance (Wallet) + TopUp
========================= */
function setBalanceUI(n){
  userBalanceUZS = Number(n||0) || 0;
  const fmt = userBalanceUZS.toLocaleString();
  const b1 = document.getElementById('balInline');
  if(b1) b1.textContent = fmt;
  const payBalanceOption = document.getElementById('payTypeBalanceOption');
  if(payBalanceOption) payBalanceOption.textContent = `Balansdan to‘lash (${fmt} so‘m)`;
  const b2 = document.getElementById('balProfile');
  if(b2) b2.textContent = fmt + " so'm";
  const b3 = document.getElementById('balHeader');
  if(b3) b3.textContent = fmt;
  // pulse header chip on update
  try{
    const chip = document.getElementById('balHeaderBtn');
    if(chip){ chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse'); }
  }catch(_){ }

}

async function watchUserDoc(uid){
  if(!uid || !currentUser){ try{ setBalanceUI(0); }catch(_){}; return; }

  try{
    unsubUserDoc && unsubUserDoc();
    const uref = doc(db,'users',uid);
    unsubUserDoc = onSnapshot(uref, (snap)=>{
      const u = snap.exists() ? (snap.data()||{}) : {};
      profileCache = u;
      // ensure balance exists
      const bal = Number(u.balanceUZS||0) || 0;
      setBalanceUI(bal);
      // autofill phone from profile
      try{
        const ph = (u.phone || u.phoneNumber || u.tel || '').toString();
        if(els.useProfilePhone?.checked && els.shipPhone){
          if(ph) els.shipPhone.value = ph;
        }
      }catch(e){}
    }, (err)=>{
      // Prevent noisy console errors when logged out or rules deny
      setBalanceUI(0);
    });
}catch(e){}
}


async function startClickTopup(prefillAmount){
  if(!currentUser){ toast("Avval kirish qiling."); return; }
  if(!CLICK_CONFIG || CLICK_CONFIG.enabled !== true){
    toast("Click integratsiyasi sozlanmagan.", "error");
    return;
  }
  const amtEl = document.getElementById('topupAmount');
  const rawAmount = prefillAmount != null ? prefillAmount : Number(String(amtEl?.value||'').replace(/[^0-9]/g,''));
  const amountUZS = Math.round(Number(rawAmount||0));
  const minAmount = Number(CLICK_CONFIG.minAmountUZS || 1000) || 1000;
  if(!amountUZS || amountUZS < minAmount){
    toast(`Minimal: ${minAmount.toLocaleString('uz-UZ')} so'm`);
    amtEl?.focus();
    return;
  }

  try{
    const token = await currentUser.getIdToken();
    const returnUrl = window.location.origin + (CLICK_CONFIG.returnPath || '/index.html#profile');
    const clickStartEndpoint = (CLICK_CONFIG && CLICK_CONFIG.startEndpoint) || '/.netlify/functions/click-start';
    const resp = await fetch(clickStartEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amountUZS, returnUrl })
    });
    const out = await resp.json().catch(()=>({}));
    if(!resp.ok || !out.ok || !out.payment_url){
      throw new Error(out?.error || 'click_start_failed');
    }
    toast("Click sahifasi ochilmoqda...");
    window.location.href = out.payment_url;
  }catch(e){
    toast("Click to'lovini boshlashda xatolik.", 'error');
  }
}

// ===== Manual Card Topup (Admin approve) =====
function syncTopupStepper(step){
  const n = Number(step || 1) === 2 ? 2 : 1;
  document.querySelectorAll('#topupStepper [data-topup-mark]').forEach(mark=>{
    const active = Number(mark.getAttribute('data-topup-mark')) <= n;
    const current = Number(mark.getAttribute('data-topup-mark')) === n;
    mark.classList.toggle('isActive', active);
    mark.classList.toggle('isCurrent', current);
  });
  document.getElementById('topupStepper')?.classList.toggle('isStep2', n === 2);
}
function openTopupModal(prefillAmount){
  const modal = document.getElementById('topupModal');
  if(!modal) return;
  if(!document.body.classList.contains('signed-in')){ toast("Avval kirish qiling."); return; }

  const step1 = document.getElementById('topupStep1');
  const step2 = document.getElementById('topupStep2');
  if(step1) step1.hidden = false;
  if(step2) step2.hidden = true;
  syncTopupStepper(1);

  const amtIn = document.getElementById('payerAmount');
  const tAmt = document.getElementById('topupAmount');
  const v = prefillAmount != null ? prefillAmount : (tAmt ? Number(tAmt.value||0) : 0);
  if(amtIn) amtIn.value = v ? String(v) : "";

  // prefill from profile
  try{
    const full = (profileCache?.name || "").trim();
    if(full && (!document.getElementById('payerFirst')?.value && !document.getElementById('payerLast')?.value)){
      const parts = full.split(/\s+/).filter(Boolean);
      if(parts.length>=1) document.getElementById('payerFirst').value = parts[0];
      if(parts.length>=2) document.getElementById('payerLast').value = parts.slice(1).join(' ');
    }
  }catch(_){ }

  modal.hidden = false;
  // Use the global modal styles (.modalOverlay/.modalCard)
  try{ modal.classList.add('isOpen'); }catch(_){ }
  try{ document.body.classList.add('modalOpen'); }catch(_){ }
  document.body.style.overflow = 'hidden';
}

function closeTopupModal(){
  const modal = document.getElementById('topupModal');
  if(!modal) return;
  try{ modal.classList.remove('isOpen'); }catch(_){ }
  try{ document.body.classList.remove('modalOpen'); }catch(_){ }
  modal.hidden = true;
  document.body.style.overflow = '';
}

function normCard(s){
  return String(s||'').replace(/[^0-9]/g,'').trim();
}

// Convert file to base64 (for Telegram upload via Netlify Function)
async function fileToBase64(file){
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode(...bytes.subarray(i, i+chunk));
  }
  return btoa(binary);
}

async function goTopupStep2(){
  const hint = document.getElementById('topupHint2');
  if(hint) hint.textContent = "Chekni yuklang va yuboring.";

  const card = normCard(document.getElementById('payerCard')?.value);
  const amt = Number(String(document.getElementById('payerAmount')?.value||'').replace(/[^0-9]/g,''));
  const first = (document.getElementById('payerFirst')?.value||'').trim();
  const last  = (document.getElementById('payerLast')?.value||'').trim();

  if(!card || card.length < 12){ toast("Karta raqamini to'g'ri kiriting."); return; }
  if(!amt || amt < 1000){ toast("Minimal: 1000 so'm"); return; }
  if(!first || !last){ toast("Ism va familiyani kiriting."); return; }

  // show admin card info
  const nEl = document.getElementById('adminCardNumber');
  const hEl = document.getElementById('adminCardHolder');
  const noteEl = document.getElementById('cardpayNote');
  const cAmt = document.getElementById('confirmAmount');
  if(noteEl) noteEl.textContent = (CARDPAY?.note || "");
  if(hEl) hEl.textContent = CARDPAY?.adminCardHolder || "Karta egasi";
  if(nEl) nEl.textContent = CARDPAY?.adminCardNumber || "Karta raqami";
  if(cAmt) cAmt.textContent = amt.toLocaleString() + " so'm";

  const step1 = document.getElementById('topupStep1');
  const step2 = document.getElementById('topupStep2');
  if(step1) step1.hidden = true;
  if(step2) step2.hidden = false;
  syncTopupStepper(2);
}

async function submitTopupRequest(){
  if(!currentUser) throw new Error('no_user');
  if(!CARDPAY || CARDPAY.enabled !== true){ toast("CardPay sozlanmagan."); return; }
  if(String(CARDPAY.adminCardNumber||'').includes('YOUR_')){ toast("Admin karta raqami sozlanmagan (public/cardpay-config.js).", 'error'); return; }

  const hint = document.getElementById('topupHint2');
  const file = document.getElementById('receiptFile')?.files?.[0] || null;
  if(!file){ toast("Chek faylini yuklang."); return; }

  const payerCard = normCard(document.getElementById('payerCard')?.value);
  const amountUZS = Number(String(document.getElementById('payerAmount')?.value||'').replace(/[^0-9]/g,''));
  const payerFirst = (document.getElementById('payerFirst')?.value||'').trim();
  const payerLast  = (document.getElementById('payerLast')?.value||'').trim();

  if(!payerCard || payerCard.length < 12) { toast("Karta raqamini to'g'ri kiriting."); return; }
  if(!amountUZS || amountUZS < 1000) { toast("Minimal: 1000 so'm"); return; }
  if(!payerFirst || !payerLast) { toast("Ism va familiyani kiriting."); return; }

  // numericId for admin convenience
  let numericId = profileCache?.numericId ?? null;
  if(!numericId){
    try{
      const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const u = uSnap.exists() ? (uSnap.data()||{}) : {};
      numericId = u.numericId ?? null;
      profileCache = u;
    }catch(_e){}
  }

  const reqId = String(Date.now()) + "_" + Math.random().toString(16).slice(2);

  // No Firebase Storage: send file directly to Telegram via Netlify Function
  const maxBytes = 18 * 1024 * 1024; // keep payload safe for Netlify
  if(file.size > maxBytes){
    toast("Fayl juda katta. 18MB dan kichik fayl yuklang.", 'error');
    return;
  }

  try{
    if(hint) hint.textContent = "Chek Telegram'ga yuborilmoqda...";

    const fileB64 = await fileToBase64(file);
    const idToken = await currentUser.getIdToken();

    const resp = await fetch('/api/receipt', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + idToken
      },
      body: JSON.stringify({
        kind: 'topup_request',
        reqId,
        amountUZS,
        payerFirst,
        payerLast,
        payerCardLast4: payerCard.slice(-4),
        payerCardMasked: payerCard.length >= 12 ? (payerCard.slice(0,4) + " **** **** " + payerCard.slice(-4)) : payerCard,
        adminCardNumber: String(CARDPAY.adminCardNumber||'').replace(/\s+/g,' ').trim(),
        adminCardHolder: String(CARDPAY.adminCardHolder||'').trim(),
        numericId: (numericId != null ? String(numericId) : null),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileB64
      })
    });

    const rj = await resp.json().catch(()=>({}));
    if(!resp.ok || !rj.ok){
      throw new Error(rj.error || 'telegram_send_failed');
    }

    if(hint) hint.textContent = "So'rov Firebase'ga yozilmoqda...";

    await setDoc(doc(db, 'topup_requests', reqId), {
      uid: currentUser.uid,
      numericId: (numericId != null ? String(numericId) : null),
      payerFirst,
      payerLast,
      payerCardLast4: payerCard.slice(-4),
      payerCardMasked: payerCard.length >= 12 ? (payerCard.slice(0,4) + " **** **** " + payerCard.slice(-4)) : payerCard,
      amountUZS: amountUZS,
      status: 'pending',
      adminCardNumber: String(CARDPAY.adminCardNumber||'').replace(/\s+/g,' ').trim(),
      adminCardHolder: String(CARDPAY.adminCardHolder||'').trim(),
      receiptTelegram: {
        ok: true,
        messageId: rj.messageId || null,
        fileName: file.name,
        mimeType: file.type || null,
        sentAt: serverTimestamp()
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'web'
    }, { merge: true });

    toast("So'rov yuborildi. Admin tasdiqlasa balansingiz yangilanadi.");
    closeTopupModal();
    // clear
    try{ document.getElementById('receiptFile').value = ""; }catch(_){ }
  }catch(e){
    console.warn('topup submit failed', e);
    toast("Xatolik. Qayta urinib ko'ring.", 'error');
    if(hint) hint.textContent = "Xatolik. Qayta urinib ko'ring.";
  }
}


// Legacy client-side balance checkout removed in v138.
// Balance deduction and order creation are atomic server-side operations.
// (Payme removed) Cart button now opens standard checkout modal

async function shareOrderTelegram(){
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  const built = buildSelectedItems();
  if(!built.ok){ toast(built.reason); return; }

  const hasPrepay = built.items.some(it=>it.prepayRequired);
  const note = document.getElementById("payRuleNote");
  if(note){
    note.textContent = hasPrepay ? "⚠️ Keltirib berish mahsulotlari uchun oldindan to‘lov: BALANS." : "";
  }

  // Telegram ulashish real buyurtma emas: Firestore'ga yozilmaydi.
  // Haqiqiy buyurtma faqat checkout server funksiyalari orqali yaratiladi.
  const orderId = `TG-${Date.now().toString(36).slice(-5).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`;

  const lines = built.items.map(it=>{
    const variant = [it.color, it.size].filter(Boolean).join(" / ");
    return `${it.name}${variant?` (${variant})`:``} x${it.qty} = ${moneyUZS((it.priceUZS||0)*(it.qty||0))}`;
  });
  const msg = `OrzuMall buyurtma (ID: ${orderId}):%0A${encodeURIComponent(lines.join("\n"))}%0A%0AJami: ${encodeURIComponent(moneyUZS(built.totalUZS))}`;
  window.open(`https://t.me/share/url?url=&text=${msg}`, "_blank");
}

els.paymeBtn?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  try{ closePanel(); }catch(_e){}
  try{ goTab("cart"); }catch(_e){}
  setTimeout(openOrderFlow, 120);
});
els.paymeBtnPage?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  openOrderFlow();
});
els.tgShareBtn?.addEventListener("click", shareOrderTelegram);
els.tgShareBtnPage?.addEventListener("click", shareOrderTelegram);

// Cart -> first order asks delivery setup; later orders open only payment selection.
els.orderBtnPage?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  openOrderFlow();
});
els.checkoutClose?.addEventListener("click", closeCheckout);
els.checkoutOverlay?.addEventListener("click", (e)=>{ if(e.target === els.checkoutOverlay) closeCheckout(); });
els.checkoutSubmit?.addEventListener("click", continueFromDeliverySetup);
els.paymentClose?.addEventListener("click", closePaymentModal);
els.paymentOverlay?.addEventListener("click", (e)=>{ if(e.target === els.paymentOverlay) closePaymentModal(); });
els.paymentSubmit?.addEventListener("click", createOrderFromCheckout);
document.getElementById("paymentDeliveryChangeBtn")?.addEventListener("click", ()=>{
  closePaymentModal();
  setTimeout(openCheckout, 40);
});
document.addEventListener("keydown", (e)=>{
  if(e.key !== "Escape") return;
  if(els.paymentOverlay && !els.paymentOverlay.hidden) closePaymentModal();
  else if(els.checkoutOverlay && !els.checkoutOverlay.hidden) closeCheckout();
});

/* =========================
   Profile modal (one-time fill + pencil edit)
========================= */
function profileStorageKey(uid){ return `om_profile_v1_${uid}`; }

function safeJSONParse(s){
  try{ return JSON.parse(s); } catch(e){ return null; }
}


function setFieldsDisabled(disabled){
  if(els.pfFirstName) els.pfFirstName.disabled = disabled;
  if(els.pfLastName) els.pfLastName.disabled = disabled;
  if(els.pfPhone) els.pfPhone.disabled = disabled;
}


function setEditing(on){
  isEditing = !!on;
  // when editing => enable fields; otherwise lock fields
  setFieldsDisabled(!isEditing);
  if(els.profileSave) els.profileSave.hidden = !isEditing;
  const vp = document.getElementById("view-profile");
  if(vp) vp.classList.toggle("editing", isEditing);
}

function openProfile(){ goTab("profile"); }
function closeProfile(){ if(window.__omProfile && window.__omProfile.isProfileComplete && !window.__omProfile.isProfileComplete()){ toast('Avval profilni to‘ldiring.'); return; } goTab("home"); }

function openTopupFocus(){
  try{ openProfile(); }catch(_){ try{ goTab("profile"); }catch(__){} }
  // wait for view render then scroll+focus
  setTimeout(()=>{
    try{
      const inp = document.getElementById("topupAmount");
      if(inp){
        inp.scrollIntoView({behavior:"smooth", block:"center"});
        inp.focus();
      }
    }catch(_){}
  }, 220);
}



window.__omProfile = (function(){
  let currentUser = null;
let userBalanceUZS = 0;
let unsubUserDoc = null;
  let isEditing = false;
  let isCompleted = false;

  function readProfile(uid){
    const raw = localStorage.getItem(profileStorageKey(uid));
    const obj = raw ? safeJSONParse(raw) : null;
    return obj && typeof obj === "object" ? obj : null;
  }

  function writeProfile(uid, data){
    localStorage.setItem(profileStorageKey(uid), JSON.stringify(data));
  }

  function computePhone(user){
    const p1 = user?.phoneNumber || "";
    const p2 = (user?.providerData || []).map(x=>x?.phoneNumber).find(Boolean) || "";
    return p1 || p2 || "";
  }

  function renderHeader(user, meta){
    const name = omPublicNameFromRecord(meta||{},omCleanPublicPersonName(user?.displayName)||"Foydalanuvchi");
    const numericId = (meta?.numericId || "").toString();
    const initial = (name || "U").trim().slice(0,1).toUpperCase();

    if(els.profileName) els.profileName.textContent = name;
    if(els.profileNumericId) els.profileNumericId.textContent = numericId ? `ID: OM${numericId}` : "—";

    const quick = document.getElementById('profileQuickRow');
    if(quick){
      const chips = [];
      const phone = String(meta?.phone || '').trim();
      if(phone) chips.push(`<span class="profileQuickChip"><i class="fa-solid fa-phone"></i>${escapeHtml(phone)}</span>`);
      quick.innerHTML = chips.join('');
      quick.hidden = !chips.length;
    }

    if(els.profileAvatar){
      const photo = user.photoURL;
      if(photo){
        els.profileAvatar.innerHTML = `<img src="${photo}" alt="avatar" />`;
      } else {
        els.profileAvatar.textContent = initial;
      }
    }
  }


  // Assign a stable numericId derived from UID (no extra collections, no transactions).
  // This prevents permission errors and keeps console clean.
  function uidToNumericId(uid){
    // Take first 10 hex chars -> number, map to 6 digits (100000..999999)
    const hex = (uid || "").replace(/[^0-9a-f]/gi,"").padEnd(10,"0").slice(0,10);
    let n = 0;
    try{ n = parseInt(hex, 16); }catch(e){ n = Date.now(); }
    const mapped = (n % 900000) + 100000;
    return mapped;
  }

  async function ensureNumericId(user, userRef, existing){
    const ex = existing?.numericId;
    if(typeof ex === "number" && Number.isFinite(ex) && ex >= 100000) return ex;
    if(typeof ex === "string" && /^\d+$/.test(ex) && parseInt(ex,10) >= 100000) return parseInt(ex,10);

    const assigned = uidToNumericId(user.uid);

    // Set only once (merge) – rules that allow "set if missing" will pass.
    try{
      await setDoc(userRef, { numericId: assigned }, { merge: true });
    }catch(e){
      // If rules block, keep local assigned but do not spam console.
    }
    return assigned;
  }

async function syncUser(user){
    currentUser = user || null;
    if(!user) return;

    // Yashash manzili profilda majburiy emas.

    // Ensure user has sequential numericId (1000+) and store basic user doc in Firestore
    const userRef = doc(db, "users", user.uid);
    let u = {};
    let uSnap = null;
    try{
      uSnap = await getDoc(userRef);
      u = uSnap.exists() ? (uSnap.data() || {}) : {};
    }catch(e){
      // If rules temporarily block, keep UI working without console errors.
      u = {};
    }

    const displayName = (user.displayName || "").toString();
    const fallbackName = omCleanPublicPersonName(user.displayName) || "Foydalanuvchi";

    const firstFromDoc = (u.firstName || "").toString().trim();
    const lastFromDoc = (u.lastName || "").toString().trim();

    const nameFromDoc = (u.name || "").toString().trim();
    const baseName = nameFromDoc || displayName || fallbackName;

    // If we have "First Last" in displayName, split it
    const parts = String(displayName || nameFromDoc || "").trim().split(/\s+/).filter(Boolean);
    const firstGuess = parts[0] || firstFromDoc || "";
    const lastGuess = parts.slice(1).join(" ") || lastFromDoc || "";

    const phone = (u.phone || user.phoneNumber || "").toString();

    let numericId = null;
    try{
      numericId = await ensureNumericId(user, userRef, u);
    }catch(_e){
      // keep console clean
      numericId = u?.numericId ?? null;
    }

    // Write only if something actually changed (Firestore writes = money)
    const updates = {};
    if(!uSnap || !uSnap.exists()){
      updates.createdAt = serverTimestamp();
    }
    if(numericId != null && ((u.numericId == null) || Number(u.numericId) !== Number(numericId))){
      updates.numericId = numericId;
    }
    if(!u.phone && phone){
      updates.phone = phone;
    }
    // name fields
    if(!firstFromDoc && firstGuess) updates.firstName = firstGuess;
    if(!lastFromDoc && lastGuess) updates.lastName = lastGuess;
    const fullName = ((firstFromDoc||firstGuess) + " " + (lastFromDoc||lastGuess)).trim() || baseName;
    if(!nameFromDoc && fullName) updates.name = fullName;

    // init balance once
    if(u.balanceUZS == null) updates.balanceUZS = 0;

    if(Object.keys(updates).length){
      updates.updatedAt = serverTimestamp();
      try{ await setDoc(userRef, updates, { merge:true }); }catch(e){ /* ignore to keep console clean */ }
    }

    const meta = { name: fullName, numericId, phone };


    renderHeader(user, meta);

    // realtime balance updates
    watchUserDoc(user.uid);

    const saved = readProfile(user.uid);
    // IMPORTANT: do NOT trust profileCompleted flag alone.
    // Consider the profile completed only when required fields actually exist.
    const fsDone = !!(u.phone && (u.firstName||u.name) && (u.lastName||u.name));
    isCompleted = fsDone || !!saved?.profileCompleted || !!saved?.completedAt;

    // name fields
    if(els.pfFirstName){
      els.pfFirstName.value = saved?.firstName || u.firstName || (u.name ? String(u.name).split(" ")[0] : "") || "";
    }
    if(els.pfLastName){
      const fromU = u.lastName || (u.name ? String(u.name).split(" ").slice(1).join(" ") : "");
      els.pfLastName.value = saved?.lastName || fromU || "";
    }

    // phone: auto fill from auth only if empty or first time
    const autoPhone = computePhone(user);
    if(els.pfPhone){
      els.pfPhone.value = saved?.phone || u.phone || autoPhone || "";
      // If saved exists but phone empty, still keep autoPhone visible (user can edit only via pencil)
    }

    renderHeader(user, meta);

    // start in view mode; editing only via ✏️
    setEditing(false);

    // Enforce mandatory profile completion
    if(!isCompleted){
      // open profile and force edit mode
      openProfile();
      setEditing(true);
      toast && toast("Profil ma'lumotlarini to‘ldiring (majburiy)");      
      // hide close/back actions while incomplete
      try{
        if(els.profileEditBtn) els.profileEditBtn.hidden = true;
        if(els.profileClose) els.profileClose.hidden = true;
      }catch(e){}
    }else{
      try{
        if(els.profileEditBtn) els.profileEditBtn.hidden = false;
        if(els.profileClose) els.profileClose.hidden = false;
      }catch(e){}
    }
  }

  async function open(){
    if(!currentUser) return;
    await syncUser(currentUser);
    openProfile();
  }

  function enableEdit(){
    // allow editing only when completed; if not completed, already editable
    setEditing(true);
  }

  function save(){
    if(!currentUser) return;
    const firstName = (els.pfFirstName?.value || "").trim();
    const lastName = (els.pfLastName?.value || "").trim();
    const phone = (els.pfPhone?.value || "").trim();

    // Profil uchun faqat shaxsiy aloqa ma’lumotlari majburiy
    if(!firstName || !lastName){
      alert("Iltimos, ism va familiyangizni kiriting.");
      return;
    }
    if(!phone){
      alert("Iltimos, telefon raqamingizni kiriting.");
      return;
    }

    const payload = {
      firstName,
      lastName,
      name: (firstName + " " + lastName).trim(),
      phone,
      profileCompleted: true,
      updatedAt: new Date().toISOString()
    };

    // Local cache
    writeProfile(currentUser.uid, payload);

    // Firestore'ga yozish (users/{uid})
    (async ()=>{
      try{
        await setDoc(doc(db, "users", currentUser.uid), payload, { merge: true });
        omPublicUserCache.set(currentUser.uid,{...(omPublicUserCache.get(currentUser.uid)||{}),...payload});
        profileCache = { ...(profileCache||{}), ...payload };
      }catch(err){
        console.warn("save profile firestore error", err);
        // offline bo'lsa ham localda qoladi
      }
    })();

    isCompleted = true;
    setEditing(false);
    closeProfile();
  }

  // wire events
  if(els.avatarBtn){
    els.avatarBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      // Always route to Profile tab (works on PC + mobile)
      try{ goTab("profile"); }catch(_){ window.location.hash = "#profile"; }
      try{ window.scrollTo({ top: 0, behavior: "smooth" }); }catch(_){}
    });
  }

const __balPlus = document.getElementById("balTopupQuick");
  if(__balPlus){
    __balPlus.addEventListener("click", (e)=>{
      e.preventDefault();
      if(!document.body.classList.contains("signed-in")){ toast("Avval kirish qiling."); return; }
      openTopupFocus();
    });
  }

if(document.getElementById("balHeaderBtn")){
    document.getElementById("balHeaderBtn").addEventListener("click", (e)=>{
      e.preventDefault();
      // open profile modal to show wallet/topup area
      try{ if(document.body.classList.contains("signed-in")) open(); }catch(_){}
      try{ toast("Balans: " + userBalanceUZS.toLocaleString() + " so'm"); }catch(_){}
    });
  }
  if(els.heroAuthJump){
    els.heroAuthJump.addEventListener("click", ()=>{
      if(document.body.classList.contains("signed-in")){
        try{ open(); }catch(e){ openProfile(); }
      } else {
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        location.href = `/login.html?next=${next}`;
      }
    });
  }
document.addEventListener("keydown", (e)=>{
    if(e.key==="Escape"){
      if(els.notificationOverlay && !els.notificationOverlay.hidden) omCloseNotifications();
      else if(els.vOverlay && !els.vOverlay.hidden) closeVariantModal();
      else if(null && !null.hidden) closeProfile();
      else if(els.imgViewer && !els.imgViewer.hidden) closeImgViewer();
    }
  });

  if(els.profileEditBtn) els.profileEditBtn.addEventListener("click", ()=>{
    enableEdit();
  });

  if(els.profileSave) els.profileSave.addEventListener("click", save);


  return { open, syncUser, isProfileComplete: ()=>!!isCompleted };
})();

let __appStarted = false;
onAuthStateChanged(auth, async (user)=>{
  setUserUI(user);
  if(!user){
    try{ if(omUserShopUnsub) omUserShopUnsub(); }catch(_){}
    omUserShopUnsub = null;
    omUserShopReady = false;
    if(omNotificationTimer) clearInterval(omNotificationTimer);
    omNotificationTimer = null;
    omNotifications = [];
    omRenderNotificationBadge();
    return; // setUserUI redirects to /login.html
  }

  // Render this account's UID-scoped local snapshot immediately, before any network wait.
  try{ omHydrateUserShopLocal(user); }catch(_e){}
  if(window.__omProfile?.syncUser) await window.__omProfile.syncUser(user);
  await loadUserShopState(user);
  subscribeUserShopState(user);
  // Keep order and wallet history warm across refreshes, not only after Profile is opened.
  try{ subscribeOrders(user.uid); }catch(_e){}
  try{ subscribeMoneyHistory(user.uid); }catch(_e){}
  try{ omStartNotificationPolling(); }catch(_e){}
  try{ if(activeTab==="store" && activeStoreId) renderStorePage(); }catch(_e){}

  if(__appStarted) { updateBadges(); return; }
  __appStarted = true;

  await omLoadCategoryCatalog();
  await omLoadDeliverySettings();
  await loadProducts();
  updateBadges();
});


/* ===== Inline rating near cart (compact) ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".pcard").forEach(card=>{
    const actions = card.querySelector(".pactions");
    if(!actions) return;
    if(actions.querySelector(".pratingInline")) return;

    const rating = card.querySelector(".prating");
    if(!rating) return;

    const inline = document.createElement("div");
    inline.className = "pratingInline";
    inline.innerHTML = rating.innerHTML;
    actions.prepend(inline);
  });
});

/* =========================
   Mobile Bottom Bar (App-like)
========================= */
function initMobileBottomBar(){
  // Start SPA routing on first load
  handleHash();
}

// Run immediately if app.js loads after DOMContentLoaded (common in WebView/module scripts),
// otherwise the home search class is not set until the first navigation.
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", initMobileBottomBar);
} else {
  initMobileBottomBar();
}

/* =========================
   Mobile search toggle (icon -> input)
========================= */

// ==== Search toggle (robust: works after re-render / route changes) ====
(function(){
  function getEls(){
    return {
      toolsTop: document.getElementById("toolsTop"),
      btn: document.getElementById("searchToggleBtn"),
      q: document.getElementById("q"),
      sort: document.getElementById("sort")
    };
  }

  function closeIfEmpty(toolsTop, q){
    if(!toolsTop || !q) return;
    if(String(q.value||"").trim()==="") toolsTop.classList.remove("open");
  }

  // Click delegation so it works even if the DOM is re-rendered later
  document.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest("#searchToggleBtn") : null;
    if(!btn) return;
    const {toolsTop, q} = getEls();
    if(!toolsTop || !q) return;
    e.preventDefault();
    toolsTop.classList.toggle("open");
    if(toolsTop.classList.contains("open")){
      try{ q.focus(); q.select(); }catch(_e){}
    } else {
      closeIfEmpty(toolsTop, q);
    }
  });

  // Close on blur (focusout bubbles, so delegation works)
  document.addEventListener("focusout", (e)=>{
    if(!(e.target && e.target.id==="q")) return;
    const {toolsTop, q, sort} = getEls();
    if(!toolsTop || !q) return;
    setTimeout(()=>{
      if(sort && document.activeElement === sort) return;
      closeIfEmpty(toolsTop, q);
    }, 120);
  });
})();



// Wallet topup button
document.addEventListener('click', (e)=>{
  const t = e.target;
  if(t && (t.id==='topupBtn' || t.closest('#topupBtn'))){
    e.preventDefault();
    startClickTopup();
  }
});

// Topup modal actions
document.addEventListener('click', (e)=>{
  const x = e.target;
  if(!x) return;
  if(x.id==='topupClose' || x.id==='topupCancel1') return void closeTopupModal();
  if(x.id==='topupNext') return void goTopupStep2();
  if(x.id==='topupBack'){
    const s1 = document.getElementById('topupStep1');
    const s2 = document.getElementById('topupStep2');
    if(s1) s1.hidden = false;
    if(s2) s2.hidden = true;
    syncTopupStepper(1);
    return;
  }
  if(x.id==='topupSubmit') return void submitTopupRequest();
});

// Close modal on overlay click
document.addEventListener('click', (e)=>{
  const modal = document.getElementById('topupModal');
  if(!modal || modal.hidden) return;
  if(e.target === modal) closeTopupModal();
});


/* === Not Found modal wiring === */
(function initNotFoundRequest(){
  const modal = document.getElementById("nfModal");
  const openBtn = document.getElementById("nfOpenBtn");
  const closeBtn = document.getElementById("nfCloseBtn");
  const botLink = document.getElementById("nfBotLink");
  const openBotBtn = document.getElementById("nfOpenBotBtn");
  const nameEl = document.getElementById("nfName");
  const catEl = document.getElementById("nfCat");
  const budgetEl = document.getElementById("nfBudget");
  const imgEl = document.getElementById("nfImg");
  const descEl = document.getElementById("nfDesc");
  const tplBox = document.getElementById("nfTemplateBox");
  const copyBtn = document.getElementById("nfCopyBtn");
  const prevWrap = document.getElementById("nfPreviewWrap");
  const prevImg = document.getElementById("nfPreview");

  if(!modal || !openBtn || !closeBtn || !tplBox) return;

  const BOT_URL = (botLink && botLink.getAttribute("href")) ? botLink.getAttribute("href") : "https://t.me/OrzuMallUZ_bot";
  if(openBotBtn) openBotBtn.href = BOT_URL;

  function buildTemplate(){
    const name = (nameEl?.value || "").trim();
    const cat = (catEl?.value || "").trim();
    const budget = (budgetEl?.value || "").trim();
    const desc = (descEl?.value || "").trim();

    const lines = [];
    lines.push("🧾 *ORZUMALL — Topib berish so‘rovi*");
    if(name) lines.push("🔎 Nomi: " + name);
    if(cat) lines.push("🗂 Kategoriya: " + cat);
    if(budget) lines.push("💰 Byudjet: " + budget);
    if(desc) lines.push("📝 Izoh: " + desc);
    lines.push("📍 Yetkazish manzili: (shahar/tuman yozing)");
    lines.push("☎️ Aloqa: (telefon raqam)");
    lines.push("");
    lines.push("📸 Rasmni ham shu xabardan keyin alohida yuboring.");
    return lines.join("\n");
  }

  function refresh(){
    tplBox.textContent = buildTemplate();
  }

  function open(){
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    refresh();
    setTimeout(()=> nameEl?.focus?.(), 50);
  }
  function close(){
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e)=>{
    if(e.target === modal) close();
  });
  window.addEventListener("keydown", (e)=>{
    if(!modal.hidden && e.key === "Escape") close();
  });

  [nameEl, catEl, budgetEl, descEl].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", refresh);
  });

  if(imgEl && prevWrap && prevImg){
    imgEl.addEventListener("change", ()=>{
      const f = imgEl.files && imgEl.files[0];
      if(!f){ prevWrap.hidden = true; prevImg.src = ""; return; }
      const url = URL.createObjectURL(f);
      prevImg.src = url;
      prevWrap.hidden = false;
    });
  }

  if(copyBtn){
    copyBtn.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(buildTemplate());
        toast && toast("Matn nusxa olindi ✅");
      }catch(e){
        // fallback
        const ta = document.createElement("textarea");
        ta.value = buildTemplate();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast && toast("Matn nusxa olindi ✅");
      }
    });
  }
})();


// Checkout phone: use profile phone toggle
els.useProfilePhone?.addEventListener("change", ()=>{
  const ph = (profileCache?.phone || profileCache?.phoneNumber || profileCache?.tel || "").toString();
  if(els.useProfilePhone.checked){
    if(els.shipPhone) els.shipPhone.value = ph || "";
  }
});

/* ===== Profile: Social links card (injected via JS to avoid template overwrites) ===== */
function removeProfileSocialLinks(){const el=document.getElementById('socialCard');if(el) el.remove();}

function ensureProfileSocialLinks(){
  try{
    if(!(location.pathname.includes('/profile') || location.hash.includes('profile'))){ removeProfileSocialLinks(); return; }
    // This app is hash-SPA. Only show on #profile tab.
    const isProfile = ((location.hash || "#home") === "#profile");
    const existing = document.getElementById("socialCard");

    // If not on profile, never leave it hanging in DOM.
    if(!isProfile){
      if(existing) existing.remove();
      return;
    }

    // Insert inside the profile page body and keep it at the very bottom.
    const profileView = (els && els.viewProfile) ? els.viewProfile : document.getElementById("view-profile");
    if(!profileView) return;
    const profileContainer = profileView.querySelector('.profilePage') || profileView.querySelector('.viewBody') || profileView;

    if(existing){
      if(!profileContainer.contains(existing)) profileContainer.appendChild(existing);
      else if(profileContainer.lastElementChild !== existing) profileContainer.appendChild(existing);
      return;
    }

    const card = document.createElement("div");
    card.id = "socialCard";
    card.className = "card softCard socialCard";
    card.innerHTML = `
      <div class="socialTop">
        <div class="title">
          <i class="fa-solid fa-share-nodes"></i>
          <span>Ijtimoiy tarmoqlar</span>
        </div>
        <div class="hint">
          <i class="fa-solid fa-circle-info"></i>
          <span>Rasm + izoh yuboring — topib beramiz</span>
        </div>
      </div>

      <div class="socialGrid">
        <a class="sBtn tg" href="https://t.me/OrzuMallSearch_bot" target="_blank" rel="noopener">
          <span class="ico"><i class="fa-brands fa-telegram"></i></span>
          <span class="txt"><span class="name">OrzuMall Search</span><span class="sub">@OrzuMallSearch_bot</span></span>
          <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
        </a>

        <a class="sBtn tg" href="https://t.me/OrzuMallUZ_bot" target="_blank" rel="noopener">
          <span class="ico"><i class="fa-brands fa-telegram"></i></span>
          <span class="txt"><span class="name">OrzuMall Bot</span><span class="sub">@OrzuMallUZ_bot</span></span>
          <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
        </a>

        <a class="sBtn ig" href="https://instagram.com/" target="_blank" rel="noopener">
          <span class="ico"><i class="fa-brands fa-instagram"></i></span>
          <span class="txt"><span class="name">Instagram</span><span class="sub">@OrzuMall.uz</span></span>
          <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
        </a>

        <a class="sBtn tt" href="https://tiktok.com/" target="_blank" rel="noopener">
          <span class="ico"><i class="fa-brands fa-tiktok"></i></span>
          <span class="txt"><span class="name">TikTok</span><span class="sub">@OrzuMall.uz</span></span>
          <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
        </a>

        <a class="sBtn yt" href="https://youtube.com/" target="_blank" rel="noopener">
          <span class="ico"><i class="fa-brands fa-youtube"></i></span>
          <span class="txt"><span class="name">YouTube</span><span class="sub">OrzuMall</span></span>
          <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
        </a>

        <a class="sBtn web" href="https://orzumall.uz/" target="_blank" rel="noopener">
          <span class="ico"><i class="fa-solid fa-globe"></i></span>
          <span class="txt"><span class="name">Sayt</span><span class="sub">OrzuMall.uz</span></span>
          <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
        </a>
      </div>

    `;

    // Put right after profile header block if exists, otherwise top of profile view.
    const anchor = profileView.querySelector(".profileHeader, .profileHero, h2, h1");
    if(anchor && anchor.parentElement === profileView){
      anchor.insertAdjacentElement("afterend", card);
    }else{
      profileContainer.appendChild(card);
    }
  }catch(e){}
}


window.addEventListener('popstate', ensureProfileSocialLinks);
window.addEventListener('hashchange', ensureProfileSocialLinks);


/* === _OM_SOCIAL_INJECT_V2: robust social links injection on profile route === */
(function(){
  function isProfile(){
    const p=(location.pathname||"").toLowerCase();
    const h=(location.hash||"").toLowerCase();
    return p.includes("/profile") || h.includes("profile");
  }
  function inject(){
    try{
      if(!isProfile()) return;
      if(document.getElementById("socialCard")) return;

      const balanceCard = document.getElementById("balanceCard") || document.querySelector('[data-card="balance"], .balanceCard, #balance');
      const wrap = (balanceCard && balanceCard.parentElement) || document.querySelector(".pageWrap") || document.querySelector("main") || document.body;
      if(!wrap) return;

      const card = document.createElement("div");
      card.className = "card softCard socialCard";
      card.id = "socialCard";
      card.innerHTML = `
        <div class="cardHead">
          <div class="cardTitle">
            <i class="fa-solid fa-share-nodes"></i>
            <span>Ijtimoiy tarmoqlar</span>
          </div>
        </div>
        <div class="socialGrid">
          <a class="socialBtn tg" href="https://t.me/OrzuMallSearch_bot" target="_blank" rel="noopener">
            <span class="ico"><i class="fa-brands fa-telegram"></i></span>
            <span class="txt"><span class="name">OrzuMall Search</span><span class="sub">@OrzuMallSearch_bot</span></span>
            <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
          </a>
          <a class="socialBtn tg2" href="https://t.me/OrzuMallUZ_bot" target="_blank" rel="noopener">
            <span class="ico"><i class="fa-brands fa-telegram"></i></span>
            <span class="txt"><span class="name">OrzuMall Bot</span><span class="sub">@OrzuMallUZ_bot</span></span>
            <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
          </a>
          <a class="socialBtn ig" href="https://instagram.com/" target="_blank" rel="noopener">
            <span class="ico"><i class="fa-brands fa-instagram"></i></span>
            <span class="txt"><span class="name">Instagram</span><span class="sub">@OrzuMall.uz</span></span>
            <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
          </a>
          <a class="socialBtn tt" href="https://tiktok.com/" target="_blank" rel="noopener">
            <span class="ico"><i class="fa-brands fa-tiktok"></i></span>
            <span class="txt"><span class="name">TikTok</span><span class="sub">@OrzuMall.uz</span></span>
            <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
          </a>
          <a class="socialBtn yt" href="https://youtube.com/" target="_blank" rel="noopener">
            <span class="ico"><i class="fa-brands fa-youtube"></i></span>
            <span class="txt"><span class="name">YouTube</span><span class="sub">OrzuMall</span></span>
            <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
          </a>
          <a class="socialBtn web" href="https://orzumall.uz/" target="_blank" rel="noopener">
            <span class="ico"><i class="fa-solid fa-globe"></i></span>
            <span class="txt"><span class="name">Sayt</span><span class="sub">OrzuMall.uz</span></span>
            <i class="fa-solid fa-arrow-up-right-from-square ext"></i>
          </a>
        </div>
        <div class="mutedTip"><i class="fa-solid fa-circle-info"></i><span>Botga mahsulot rasmi + qisqa izoh yuborsangiz, topib beramiz.</span></div>
      `;

      if(balanceCard && balanceCard.parentElement){
        balanceCard.parentElement.insertBefore(card, balanceCard);
      }else{
        const profileGrid = document.querySelector(".profileGrid") || document.querySelector("#profileForm");
        if(profileGrid && profileGrid.parentElement){
          profileGrid.parentElement.insertBefore(card, profileGrid.nextSibling);
        }else{
          wrap.insertBefore(card, wrap.firstChild);
        }
      }
    }catch(e){}
  }

  function run(){
    if(!isProfile()) return;
    let tries=0;
    const t=setInterval(()=>{
      tries++; inject();
      if(document.getElementById("socialCard") || tries>40) clearInterval(t);
    }, 120);

    try{
      const mo=new MutationObserver(()=>inject());
      mo.observe(document.body,{childList:true,subtree:true});
      setTimeout(()=>{try{mo.disconnect()}catch(e){}},10000);
    }catch(e){}
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("hashchange", run);
  window.addEventListener("popstate", run);
  // in case SPA calls history.pushState
  const _ps = history.pushState;
  history.pushState = function(){
    _ps.apply(this, arguments);
    setTimeout(run, 0);
  };
  // initial
  setTimeout(run, 0);
})();


setInterval(ensureProfileSocialLinks, 1200);

// Copy helper for buttons like: <button class="copyBtn" data-copy="#someId">
document.addEventListener("click", async (e)=>{
  const btn = e.target && e.target.closest ? e.target.closest(".copyBtn[data-copy]") : null;
  if(!btn) return;
  const sel = btn.getAttribute("data-copy");
  const el = sel ? document.querySelector(sel) : null;
  const text = (el && (el.value ?? el.textContent) ? String(el.value ?? el.textContent).trim() : "");
  if(!text) return;
  try{
    await navigator.clipboard.writeText(text);
    toast && toast("Nusxa olindi ✅", "success");
  }catch(err){
    try{
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast && toast("Nusxa olindi ✅", "success");
    }catch(e2){
      toast && toast("Nusxa olishda xatolik", "error");
    }
  }
});


/* === Buyurtma holati: bekor qilish, qaytarish va fikr bildirish === */
document.addEventListener("click", (e)=>{
  const actionBtn=e.target?.closest?.("[data-order-action][data-order-id]");
  if(actionBtn){
    e.preventDefault();
    openOrderActionModal(actionBtn.getAttribute("data-order-action")||"",actionBtn.getAttribute("data-order-id")||"");
    return;
  }
  const star=e.target?.closest?.("#orderReviewStars [data-review-star]");
  if(star){ e.preventDefault(); setReviewStars(Number(star.getAttribute("data-review-star")||0)); return; }
  if(e.target?.closest?.("#orderActionClose,#orderActionCancel")){ e.preventDefault(); closeOrderActionModal(); return; }
  if(e.target?.closest?.("#orderActionSubmit")){ e.preventDefault(); submitOrderAction(); return; }
  const overlay=e.target?.closest?.("#orderActionModal");
  if(overlay && e.target===overlay) closeOrderActionModal();
});

document.addEventListener("change", (e)=>{
  if(e.target?.id!=="orderCancelReasonSelect") return;
  const isOther=String(e.target.value||"")==="other";
  const wrap=document.getElementById("orderCancelReasonOtherWrap");
  if(wrap) wrap.hidden=!isOther;
  if(isOther) setTimeout(()=>document.getElementById("orderCancelReasonOther")?.focus(),0);
});

document.addEventListener("keydown", (e)=>{
  if(e.key==="Escape" && !document.getElementById("orderActionModal")?.hidden) closeOrderActionModal();
});

/* === Buyurtma cheki tugmalari === */
document.addEventListener("click", (e)=>{
  const receiptBtn = e.target && e.target.closest ? e.target.closest("[data-order-receipt]") : null;
  if(receiptBtn){
    e.preventDefault();
    const orderId = receiptBtn.getAttribute("data-order-receipt") || "";
    openOrderReceipt(orderId);
    return;
  }

  const closeBtn = e.target && e.target.closest ? e.target.closest("#orderReceiptClose") : null;
  if(closeBtn){
    e.preventDefault();
    closeOrderReceipt();
    return;
  }

  const printBtn = e.target && e.target.closest ? e.target.closest("#orderReceiptPrint") : null;
  if(printBtn){
    e.preventDefault();
    printOrderReceipt();
    return;
  }

  const overlay = e.target && e.target.closest ? e.target.closest("#orderReceiptModal") : null;
  if(overlay && e.target === overlay){
    closeOrderReceipt();
  }
});

document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape" && els.orderReceiptModal && !els.orderReceiptModal.hidden){
    closeOrderReceipt();
  }
});


/* === v4 profile organizer === */
function orzuMoveProfileSocialToBottom(){
  try{
    const profileContainer = document.querySelector('#view-profile .profilePage') || document.querySelector('#view-profile .viewBody');
    const socialCard = document.getElementById('socialCard');
    if(profileContainer && socialCard && profileContainer.lastElementChild !== socialCard){
      profileContainer.appendChild(socialCard);
    }
  }catch(e){}
}
window.addEventListener('hashchange', ()=>setTimeout(orzuMoveProfileSocialToBottom, 40));
window.addEventListener('load', ()=>setTimeout(orzuMoveProfileSocialToBottom, 120));


// Mobile header search sync
(function(){
  const q = document.getElementById('q');
  const mh = document.getElementById('mobileHeadSearch');
  if(!q || !mh) return;
  const syncToMain = ()=>{
    if(q.value !== mh.value){
      q.value = mh.value;
      q.dispatchEvent(new Event('input', {bubbles:true}));
    }
  };
  const syncToHead = ()=>{ if(mh.value !== q.value) mh.value = q.value; };
  mh.addEventListener('input', syncToMain);
  q.addEventListener('input', syncToHead);
  syncToHead();
})();


// Compact/collapsible profile sections
(function(){
  const KEY = 'om_profile_section_state_v91';
  function readState(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(_){ return {}; }
  }
  function writeState(next){
    try{ localStorage.setItem(KEY, JSON.stringify(next || {})); }catch(_){ }
  }
  function wrapSectionBody(card, head, selectors){
    if(!card || !head) return null;
    let body = card.querySelector(':scope > .omCompactSectionBody');
    if(body) return body;
    body = document.createElement('div');
    body.className = 'omCompactSectionBody';
    head.insertAdjacentElement('afterend', body);
    (selectors || []).forEach(sel=>{
      card.querySelectorAll(sel).forEach(node=>{ if(node !== head) body.appendChild(node); });
    });
    return body;
  }
  function addControls(head, opts){
    if(!head || head.querySelector('.omSectionToggle')) return head.querySelector('.omSectionToggle');
    let right = head.querySelector('.omSectionHeadRight');
    if(!right){
      right = document.createElement('div');
      right.className = 'omSectionHeadRight';
      head.appendChild(right);
    }
    if(opts.countId && !document.getElementById(opts.countId)){
      const pill = document.createElement('span');
      pill.className = 'countPill omSectionCount';
      pill.id = opts.countId;
      pill.textContent = String(opts.countValue || 0);
      right.prepend(pill);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'iconPill omSectionToggle';
    btn.setAttribute('aria-label', 'Yig‘ish / ochish');
    btn.innerHTML = '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    right.appendChild(btn);
    return btn;
  }
  function bindSection(key, cardSel, headSel, bodySelectors, collapsedDefault){
    const card = document.querySelector(cardSel);
    const head = card?.querySelector(headSel);
    if(!card || !head) return;
    const body = wrapSectionBody(card, head, bodySelectors);
    if(!body) return;
    card.classList.add('omCompactSection');
    head.classList.add('omSectionHead');
    const countId = key === 'savedAddress' ? 'savedAddressCountPill' : '';
    const toggleBtn = addControls(head, {countId, countValue:0});
    const state = readState();
    const collapsed = typeof state[key] === 'boolean' ? state[key] : !!collapsedDefault;
    setCollapsed(card, body, collapsed);
    const applyIcon = ()=>{
      const on = !body.hidden;
      card.classList.toggle('omOpen', on);
      toggleBtn?.setAttribute('aria-expanded', String(on));
    };
    applyIcon();
    const doToggle = ()=>{
      toggleCollapsed(card, body);
      applyIcon();
      const next = readState();
      next[key] = !!body.hidden;
      writeState(next);
    };
    if(!head.dataset.omBound){
      head.dataset.omBound = '1';
      head.tabIndex = 0;
      head.addEventListener('click', (e)=>{
        if(e.target.closest('button, a, input, select, textarea, label')) return;
        doToggle();
      });
      head.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); doToggle(); }
      });
      toggleBtn?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); doToggle(); });
    }
  }
  bindSection('wallet', '#walletCard', '.walletHero', ['.walletGrid'], false);
  bindSection('savedAddress', '#savedAddressCard', '.savedAddressHead', ['.savedAddressGuide', '.savedAddressForm', '.savedAddressStatus', '.savedAddressList'], true);
  bindSection('activity', '#activityCard', '.activityCardTop', ['.activityBody'], true);
})();

// Compact profile activity tabs (money/orders in one card)
(function(){
  const tabMoney = document.getElementById('activityTabMoney');
  const tabOrders = document.getElementById('activityTabOrders');
  const panelMoney = document.getElementById('activityMoneyPanel');
  const panelOrders = document.getElementById('activityOrdersPanel');
  if(!tabMoney || !tabOrders || !panelMoney || !panelOrders) return;

  function setProfileActivityTab(name){
    const money = name !== 'orders';
    tabMoney.classList.toggle('isActive', money);
    tabOrders.classList.toggle('isActive', !money);
    tabMoney.setAttribute('aria-selected', money ? 'true' : 'false');
    tabOrders.setAttribute('aria-selected', money ? 'false' : 'true');
    panelMoney.hidden = !money;
    panelOrders.hidden = money;
  }
  tabMoney.addEventListener('click', ()=> setProfileActivityTab('money'));
  tabOrders.addEventListener('click', ()=> setProfileActivityTab('orders'));
  setProfileActivityTab('money');
})();

(function(){
  document.querySelectorAll('#orderFilterBar .orderFilterChip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      currentOrdersFilter = btn.dataset.orderFilter || 'all';
      syncOrderFilterUI();
      renderOrders(ordersCache || []);
    });
  });
  syncOrderFilterUI();
})();

try{ window.openProductPage = openProductPage; }catch(_e){}


// ===== v57 premium compact buttons enhancer =====
(function(){
  const cfg = [
    ['#catApplyBtn','fa-solid fa-filter','Ko‘rish'],
    ['#catClearBtn','fa-solid fa-rotate-left','Tozalash'],
    ['#deliveryUseNewLocation','fa-solid fa-location-dot','Boshqa manzil'],
    ['#deliveryLocateBtn','fa-solid fa-location-crosshairs','Lokatsiyani aniqlash'],
    ['#deliveryMapToggleBtn','fa-solid fa-map-location-dot','Xaritadan tanlash'],
    ['#copyDeliveryCoordsBtn','fa-regular fa-copy','Nusxalash'],
    ['#deliveryMapApplyBtn','fa-solid fa-circle-check','Qo‘llash'],
    ['#checkoutSubmit','fa-solid fa-arrow-right','Davom etish'],
    ['#paymentSubmit','fa-solid fa-circle-check','Tasdiqlash'],
    ['#paymentDeliveryChangeBtn','fa-solid fa-truck-fast','Yetkazib berishni o‘zgartirish'],
    ['#profileSave','fa-solid fa-floppy-disk','Saqlash'],
    ['#savedAddressDetectSave','fa-solid fa-location-crosshairs','Lokatsiyani aniqlash va saqlash'],
    ['#topupBtn','fa-solid fa-wallet','Balansni to‘ldirish'],
    ['#topupCancel1','fa-solid fa-xmark','Bekor'],
    ['#topupNext','fa-solid fa-arrow-right','Davom'],
    ['#topupBack','fa-solid fa-arrow-left','Orqaga'],
    ['#topupSubmit','fa-solid fa-paper-plane','Yuborish'],
    ['#orderActionCancel','fa-solid fa-xmark','Yopish'],
    ['#orderActionSubmit','fa-solid fa-paper-plane','Yuborish'],
    ['#orderReceiptPrint','fa-solid fa-print','Chop'],
    ['#paymeBtn','fa-solid fa-bag-shopping','Rasmiylashtirish'],
    ['#tgShareBtn','fa-brands fa-telegram','Telegram'],
    ['#clearBtn','fa-solid fa-trash','Tozalash'],
    ['#vCancel','fa-solid fa-xmark','Bekor'],
    ['#vConfirm','fa-solid fa-cart-plus','Qo‘shish'],
    ['#productPageCartBtn','fa-solid fa-cart-plus','Savatga qo‘shish'],
    ['#ppReviewSend','fa-solid fa-paper-plane','Sharh yuborish'],
    ['#orderBtnPage','fa-solid fa-truck-fast','Yetkazib berish'],
    ['#loadMoreBtn','fa-solid fa-angles-down','Yana']
  ];

  function apply(){
    const compact = window.innerWidth <= 768;
    cfg.forEach(([sel, icon, label])=>{
      document.querySelectorAll(sel).forEach(el=>{
        if(!el) return;
        if(!el.dataset.pmInit){
          el.dataset.pmInit = '1';
          const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g,' ').trim();
          if(text) el.dataset.pmLabel = text;
        }
        const lbl = label || el.dataset.pmLabel || 'Tugma';
        el.classList.add('omHasIcon');
        el.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span class="btnLabel">${lbl}</span>`;
        el.setAttribute('title', lbl);
        if(!el.getAttribute('aria-label')) el.setAttribute('aria-label', lbl);
        const iconOnlyMobile = !['#productPageCartBtn','#paymentSubmit','#checkoutSubmit','#paymeBtn','#ppReviewSend','#orderBtnPage','#paymentDeliveryChangeBtn','#savedAddressDetectSave','#topupBtn','#deliveryLocateBtn','#deliveryMapToggleBtn','#deliveryUseNewLocation'].includes(sel);
        el.classList.toggle('omIconOnlyMobile', compact && iconOnlyMobile);
      });
    });
  }

  window.addEventListener('load', apply);
  window.addEventListener('resize', apply);
  document.addEventListener('click', ()=> setTimeout(apply, 50), true);
  setTimeout(apply, 0);
})();

/* =========================================================
   OrzuMall Customer Experience v140
   Global catalog search, recently viewed, recommendations,
   product alerts, store catalog tools and repeat order.
   ========================================================= */
const OM_CX_RECENT_KEY='om_recent_products_v140';
const omCxSearchState={query:'',timer:null,seq:0,cache:new Map(),loading:false};
const omCxAlertState=new Map();
let omCxRecommendations=[];
let omCxRecommendationBusy=false;
function omCxSafeJSON(raw,fallback){try{return JSON.parse(raw)||fallback}catch(_){return fallback}}
function omCxReadRecent(){try{return (omCxSafeJSON(localStorage.getItem(OM_CX_RECENT_KEY)||'[]',[])||[]).filter(x=>x&&x.id).slice(0,18)}catch(_){return[]}}
function omCxWriteRecent(list){try{localStorage.setItem(OM_CX_RECENT_KEY,JSON.stringify((list||[]).slice(0,18)))}catch(_){}}
async function omCxApi(action,payload={},opts={}){
  const headers={'content-type':'application/json'};
  if(currentUser?.getIdToken){try{headers.authorization='Bearer '+await currentUser.getIdToken()}catch(_){}}
  if(opts.authRequired&&!headers.authorization)throw new Error('login_required');
  const r=await fetch('/.netlify/functions/customer-experience',{method:'POST',headers,body:JSON.stringify({action,...payload})});
  const out=await r.json().catch(()=>({}));if(!r.ok||!out.ok)throw new Error(out.error||'server_error');return out;
}
function omCxNormalizeProduct(raw={}){return{...raw,_docId:String(raw._docId||raw.id||''),_price:parseUZS(raw._price??raw.price),_created:toMillis(raw._created??raw.createdAt??raw.updatedAt)}}
function omCxMergeProducts(list=[]){let changed=false;for(const raw of Array.isArray(list)?list:[]){const p=omCxNormalizeProduct(raw),ix=products.findIndex(x=>String(x.id||x._docId)===String(p.id||p._docId));if(ix>=0)products[ix]={...products[ix],...p};else{products.push(p);changed=true}}try{buildTagCounts();buildCategoryTree()}catch(_){}return changed}
function omCxSearchStatus(message='',done=false){const el=document.getElementById('cxSearchStatus');if(!el)return;el.hidden=!message;el.classList.toggle('isDone',!!done);el.innerHTML=message?`<i class="fa-solid ${done?'fa-circle-check':'fa-magnifying-glass'}"></i><span>${escapeHtml(message)}</span>`:''}
async function omCxRunProductSearch(q,seq){try{let rows=omCxSearchState.cache.get(q);if(!rows){const out=await omCxApi('search_products',{query:q,limit:28});rows=Array.isArray(out.products)?out.products:[];omCxSearchState.cache.set(q,rows)}if(seq!==omCxSearchState.seq||q!==omCxSearchState.query)return;omCxMergeProducts(rows);omCxSearchStatus(`${rows.length} ta mos mahsulot katalog bo‘yicha tekshirildi.`,true);applyFilterSort()}catch(_){if(seq===omCxSearchState.seq)omCxSearchStatus('Katalog qidiruvini yakunlab bo‘lmadi.',false)}finally{if(seq===omCxSearchState.seq){omCxSearchState.loading=false;setTimeout(()=>{if(omCxSearchState.query===q)omCxSearchStatus('',false)},2200)}}}
function omScheduleProductSearch(raw){const q=norm(raw);if(q===omCxSearchState.query)return;omCxSearchState.query=q;omCxSearchState.seq+=1;clearTimeout(omCxSearchState.timer);if(q.length<2){omCxSearchState.loading=false;omCxSearchStatus('',false);return}omCxSearchState.loading=true;omCxSearchStatus('Butun katalog bo‘yicha qidirilmoqda...');const seq=omCxSearchState.seq;omCxSearchState.timer=setTimeout(()=>omCxRunProductSearch(q,seq),220)}
function omRememberViewedProduct(p){if(!p?.id)return;const sel=getSel(p),pricing=getVariantPricing(p,sel);const snap={id:String(p.id),name:omProductText(p,'name',p.name||'Mahsulot'),image:getCurrentImage(p,sel)||p.images?.[0]||p.image||'',price:Number(pricing.price||p.price||0),deliveryMinDays:Number(p.deliveryMinDays||1),deliveryMaxDays:Number(p.deliveryMaxDays||7),fulfillmentType:String(p.fulfillmentType||'stock'),viewedAt:Date.now()};const next=[snap,...omCxReadRecent().filter(x=>String(x.id)!==snap.id)].slice(0,18);omCxWriteRecent(next);setTimeout(()=>omRenderRecentShelf(),0);omCxRecommendations=[];setTimeout(()=>omRefreshRecommendations(true),250)}
function omCxDeliveryText(p={}){try{return omDeliveryDateRange(p)}catch(_){return `${Number(p.deliveryMinDays||1)}–${Number(p.deliveryMaxDays||7)} kun`}}
function omCxMiniCardHtml(p={},badge=''){const id=String(p.id||''),name=omProductText(p,'name',p.name||'Mahsulot'),sel=getSel(p),price=Number(getVariantPricing(p,sel)?.price||p.price||0),img=getCurrentImage(p,sel)||p.images?.[0]||p.image||'./logo-256.webp';return `<article class="cxMiniCard" data-cx-product="${escapeHtml(id)}"><div class="cxMiniImg"><img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">${badge?`<span class="cxMiniBadge">${escapeHtml(badge)}</span>`:''}</div><div class="cxMiniBody"><div class="cxMiniName">${escapeHtml(name)}</div><div class="cxMiniPrice">${moneyUZS(price)}</div><div class="cxMiniDelivery"><i class="fa-solid fa-truck-fast"></i> ${escapeHtml(omCxDeliveryText(p))}</div></div></article>`}
function omCxBindShelf(root){root?.querySelectorAll('[data-cx-product]').forEach(card=>card.addEventListener('click',()=>openProductPage(card.getAttribute('data-cx-product'))))}
function omRenderRecentShelf(){const section=document.getElementById('cxRecentSection'),rail=document.getElementById('cxRecentRail');if(!section||!rail)return;const rows=omCxReadRecent();section.hidden=!rows.length;rail.innerHTML=rows.map(x=>omCxMiniCardHtml(x,'Ko‘rilgan')).join('');omCxBindShelf(rail)}
function omCxContext(){const recent=omCxReadRecent(),ids=[...new Set([...recent.map(x=>x.id),...Array.from(favs||[]),...(cart||[]).map(x=>x.id)].map(String).filter(Boolean))];const selected=ids.map(findProductById).filter(Boolean);return{excludeIds:ids.slice(0,100),categoryIds:[...new Set(selected.flatMap(p=>[...(p.categoryPathIds||[]),p.categoryId,p.subcategoryId]).filter(Boolean))],tags:[...new Set(selected.flatMap(p=>Array.isArray(p.tags)?p.tags:[]).filter(Boolean))],sellerIds:[...new Set(selected.map(p=>p.sellerId).filter(Boolean))]}}
async function omRefreshRecommendations(force=false){const section=document.getElementById('cxRecommendSection'),rail=document.getElementById('cxRecommendRail');if(!section||!rail||omCxRecommendationBusy)return;const ctx=omCxContext();if(!force&&omCxRecommendations.length){omRenderRecommendationShelf();return}omCxRecommendationBusy=true;try{const out=await omCxApi('recommendations',{...ctx,limit:12});omCxRecommendations=Array.isArray(out.products)?out.products:[];omCxMergeProducts(omCxRecommendations);omRenderRecommendationShelf()}catch(_){const fallback=[...products].filter(p=>!new Set(ctx.excludeIds).has(String(p.id))).sort((a,b)=>omGetProductMetrics(b).score-omGetProductMetrics(a).score).slice(0,12);omCxRecommendations=fallback;omRenderRecommendationShelf()}finally{omCxRecommendationBusy=false}}
function omRenderRecommendationShelf(){const section=document.getElementById('cxRecommendSection'),rail=document.getElementById('cxRecommendRail');if(!section||!rail)return;section.hidden=!omCxRecommendations.length;rail.innerHTML=omCxRecommendations.map(x=>omCxMiniCardHtml(x,'Tavsiya')).join('');omCxBindShelf(rail)}
function omRefreshCustomerExperience(){omRenderRecentShelf();omRefreshRecommendations().catch(()=>{})}
async function omRefreshProductAlertButtons(productId){const id=String(productId||'');if(!id||activeTab!=='product')return;let state=omCxAlertState.get(id);if(!state&&currentUser){try{const out=await omCxApi('alert_status',{productId:id},{authRequired:true});state=out.alert||{};omCxAlertState.set(id,state)}catch(_){state={}}}document.querySelectorAll('[data-cx-alert]').forEach(btn=>{const type=btn.getAttribute('data-cx-alert'),on=type==='price_drop'?state?.priceDrop===true:state?.backInStock===true;btn.classList.toggle('active',!!on);btn.setAttribute('aria-pressed',on?'true':'false');const label=btn.querySelector('span');if(label){const base=type==='price_drop'?'Narx tushganda xabar':'Omborga qaytganda xabar';label.textContent=on?`${base} • yoqilgan`:base}})}
async function omToggleProductAlert(productId,type){if(!currentUser){toast('Xabar olish uchun akkauntga kiring.');goTab('profile');return}const id=String(productId||''),old=omCxAlertState.get(id)||{},key=type==='price_drop'?'priceDrop':'backInStock',enabled=old[key]!==true;try{await omCxApi('toggle_alert',{productId:id,type,enabled},{authRequired:true});omCxAlertState.set(id,{...old,[key]:enabled});omRefreshProductAlertButtons(id);toast(enabled?'Xabarnoma yoqildi.':'Xabarnoma o‘chirildi.')}catch(_){toast('Xabarnomani o‘zgartirib bo‘lmadi.','error')}}
async function omRepeatOrder(orderId){const order=getOrderFromCache(orderId);if(!order||!Array.isArray(order.items)||!order.items.length){toast('Buyurtma mahsulotlari topilmadi.','error');return}const ids=[...new Set(order.items.map(x=>String(x.productId||x.id||'')).filter(Boolean))];try{const out=await omCxApi('products_by_ids',{ids});omCxMergeProducts(out.products||[])}catch(_){}let added=0,missing=0;for(const it of order.items){const id=String(it.productId||it.id||''),p=findProductById(id);if(!p||p.isActive===false||p.sellerActive===false){missing++;continue}addToCart(id,Math.max(1,Number(it.qty||1)),{color:it.color||null,size:it.size||null});added+=Math.max(1,Number(it.qty||1))}updateBadges();if(added){toast(`${added} ta mahsulot savatga qayta qo‘shildi.${missing?` ${missing} ta mahsulot hozir mavjud emas.`:''}`);goTab('cart')}else toast('Mahsulotlar hozir sotuvda mavjud emas.','error')}
document.addEventListener('click',e=>{const btn=e.target?.closest?.('[data-order-repeat]');if(btn){e.preventDefault();omRepeatOrder(btn.getAttribute('data-order-repeat')||'')}});
document.getElementById('cxRecentClear')?.addEventListener('click',()=>{omCxWriteRecent([]);omRenderRecentShelf();toast('Ko‘rilganlar tarixi tozalandi.')});
document.getElementById('cxRecommendRefresh')?.addEventListener('click',()=>{omCxRecommendations=[];omRefreshRecommendations(true)});
setTimeout(()=>omRefreshCustomerExperience(),1200);

/* v140: store catalog search and sorting */
function omCxStoreBindProducts(root,list){root.querySelectorAll('[data-store-product]').forEach(card=>card.addEventListener('click',e=>{if(e.target.closest('button'))return;openProductPage(card.dataset.storeProduct)}));root.querySelectorAll('[data-store-cart]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const p=findProductById(btn.dataset.storeCart);if(p)handleAddToCart(p,{openCartAfter:false})}));root.querySelectorAll('[data-store-fav]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const id=btn.dataset.storeFav;if(favs.has(id))favs.delete(id);else{favs.add(id);logEvent('favorite',id)}saveLS(LS.favs,Array.from(favs));updateBadges();btn.classList.toggle('active',favs.has(id));btn.innerHTML=`<i class="fa-${favs.has(id)?'solid':'regular'} fa-heart"></i>`}))}
function omDrawStorePage(data){
  const root=els.storePageContent;if(!root)return;const store=data?.store||{},all=Array.isArray(data?.products)?data.products:[],logo=String(store.logoUrl||''),banner=String(store.bannerUrl||''),following=!!data?.following,displayedPopularity=omAverageStorePopularity(all),completed=Math.max(0,Math.round(Number(store.completedOrdersCount||0)||0)),partnerDuration=omStorePartnerDuration(store.partnerSinceMs),partnerDate=omStorePartnerDate(store.partnerSinceMs),sellerRating=Number(store.sellerRating||0)||0,slaRate=Math.max(0,Math.round(Number(store.slaOnTimeRate||0)||0));
  root.innerHTML=`<section class="storeHero"><div class="storeHeroBanner">${banner?`<img src="${escapeHtml(banner)}" alt="" decoding="async">`:''}</div><div class="storeHeroBody"><div class="storeLogoBig">${logo?`<img src="${escapeHtml(logo)}" alt="" loading="lazy" decoding="async">`:escapeHtml(omStoreInitials(store.storeName))}</div><div class="storeIdentity"><h1>${escapeHtml(store.storeName||'Do‘kon')}${store.verified!==false?`<i class="fa-solid fa-circle-check storeVerified" title="OrzuMall tasdiqlagan do‘kon"></i>`:''}</h1><p>${escapeHtml(store.description||'OrzuMall marketplace do‘koni')}</p></div><button type="button" class="storeFollowBtn ${following?'isFollowing':''}" id="storeFollowBtn"><i class="fa-solid ${following?'fa-check':'fa-plus'}"></i>${following?' Obuna bo‘lingan':' Obuna bo‘lish'}</button></div><div class="storeMeta"><span><i class="fa-solid fa-box"></i>${Number(store.productCount||all.length)} ta mahsulot</span><span><i class="fa-solid fa-user-group"></i>${Number(store.followersCount||0)} obunachi</span><span><i class="fa-solid fa-fire"></i>${omCompactMetric(displayedPopularity)} o‘rtacha popularlik</span>${store.workingHours?`<span><i class="fa-regular fa-clock"></i>${escapeHtml(store.workingHours)}</span>`:''}</div><div class="storeTrustGrid"><div class="storeTrustCard"><span class="storeTrustIcon"><i class="fa-solid fa-handshake"></i></span><span class="storeTrustCopy"><small>OrzuMall hamkori</small><b>${escapeHtml(partnerDuration)}</b><em>${escapeHtml(partnerDate)}</em></span></div><div class="storeTrustCard"><span class="storeTrustIcon success"><i class="fa-solid fa-circle-check"></i></span><span class="storeTrustCopy"><small>Bajarilgan buyurtmalar</small><b>${completed} ta</b><em>Muvaffaqiyatli yetkazilgan</em></span></div><div class="storeTrustCard"><span class="storeTrustIcon verified"><i class="fa-solid fa-shield-halved"></i></span><span class="storeTrustCopy"><small>Do‘kon holati</small><b>${store.verified!==false?'Tasdiqlangan':'Tekshirilmoqda'}</b><em>${store.verified!==false?'OrzuMall tomonidan tekshirilgan':'Tasdiqlash jarayonida'}</em></span></div><div class="storeTrustCard"><span class="storeTrustIcon rating"><i class="fa-solid fa-star"></i></span><span class="storeTrustCopy"><small>Seller reytingi</small><b>${sellerRating?sellerRating.toFixed(1)+' / 5':'Yangi seller'}</b><em>${slaRate?slaRate+'% vaqtida topshirish':'SLA tarixi yig‘ilmoqda'}</em></span></div></div></section><div class="storeCatalogHead"><h2>Do‘kon mahsulotlari</h2><span class="storeCatalogCount" id="storeCatalogCount">${all.length} ta tasdiqlangan mahsulot</span></div><div class="storeCatalogTools"><input id="storeCatalogSearch" type="search" placeholder="Do‘kon ichida qidirish"><select id="storeCatalogSort"><option value="popular">Ommabop</option><option value="new">Yangi</option><option value="price_asc">Narx ↑</option><option value="price_desc">Narx ↓</option></select></div><div id="storeCatalogGrid"></div>`;
  const draw=()=>{const q=norm(root.querySelector('#storeCatalogSearch')?.value||''),sort=root.querySelector('#storeCatalogSort')?.value||'popular';let list=[...all].filter(p=>!q||norm(`${p.name||''} ${p.name_ru||''} ${p.sku||''} ${(p.tags||[]).join(' ')}`).includes(q));if(sort==='popular')list.sort((a,b)=>omGetProductMetrics(b).score-omGetProductMetrics(a).score);if(sort==='new')list.sort((a,b)=>(b._created||0)-(a._created||0));if(sort==='price_asc')list.sort((a,b)=>(a._price||a.price||0)-(b._price||b.price||0));if(sort==='price_desc')list.sort((a,b)=>(b._price||b.price||0)-(a._price||a.price||0));const box=root.querySelector('#storeCatalogGrid');if(box)box.innerHTML=list.length?`<div class="storeProductGrid">${list.map(omStoreProductCardHtml).join('')}</div>`:`<div class="storePageEmpty"><i class="fa-solid fa-box-open"></i> Mos mahsulot topilmadi.</div>`;const count=root.querySelector('#storeCatalogCount');if(count)count.textContent=`${list.length} ta mahsulot`;omCxStoreBindProducts(root,list)};
  root.querySelector('#storeFollowBtn')?.addEventListener('click',()=>omToggleStoreFollow(store.id,!following));root.querySelector('#storeCatalogSearch')?.addEventListener('input',draw);root.querySelector('#storeCatalogSort')?.addEventListener('change',draw);draw();
}


/* v140: checkout promo controls */
(function(){
  const input=document.getElementById('promoCodeInput'),btn=document.getElementById('promoApplyBtn');
  btn?.addEventListener('click',omApplyPromoCode);
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();omApplyPromoCode()}});
  input?.addEventListener('input',()=>{const normalized=omPromoInputCode();if(omPromoState.valid&&normalized!==omPromoState.code){omInvalidatePromo(true);omPromoHint('Kod o‘zgardi. Qayta qo‘llang.')}try{updatePaymentModalSummary()}catch(_e){}});
})();
