
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

/* OrzuMall: silence noisy console in production */
try{ if(typeof console!=="undefined"){ console.warn=()=>{}; console.error=()=>{}; } }catch(e){}

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
    o.userName ? `Ism: <b>${tgEscape(o.userName)}</b>` : "",
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


import { auth, db, storage } from "./firebase-config.js";
import { CARDPAY } from "./cardpay-config.js";
import { CLICK_CONFIG } from "./click-config.js";
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
  runTransaction,
  serverTimestamp,
  getAggregateFromServer,
  average,
  count,
  addDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { generateShortOrderId } from "./utils/shortOrderId.js";

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
// Popular endi qo'lda beriladigan ball emas: ko'rish + savat + sevimli + sotib olishdan hisoblanadi.
const OM_METRICS_LS = "om_product_metrics_v2";
const OM_ANON_LS = "om_anon_id_v1";
const productMetricsCache = new Map(); // productId -> {views, cartAdds, favoriteAdds, purchases, score, ts}

function omMetricNum(v){
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
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
function omReadLocalMetrics(){
  try{ return JSON.parse(localStorage.getItem(OM_METRICS_LS) || "{}"); }catch(e){ return {}; }
}
function omWriteLocalMetrics(obj){
  try{ localStorage.setItem(OM_METRICS_LS, JSON.stringify(obj || {})); }catch(e){}
}
function omEngagementScore(m){
  const views = omMetricNum(m?.views);
  const fav = omMetricNum(m?.favoriteAdds || m?.favorites);
  const cart = omMetricNum(m?.cartAdds);
  const buy = omMetricNum(m?.purchases || m?.soldCount);
  // E-commerce weight: view=1, favorite=4, cart=7, purchase=25
  return Math.round(views + fav*4 + cart*7 + buy*25);
}
function omMetricFromProduct(p){
  if(!p) return {views:0, cartAdds:0, favoriteAdds:0, purchases:0, score:0};
  const id = String(p.id || p._docId || "");
  const cached = productMetricsCache.get(id) || {};
  const local = (omReadLocalMetrics()[id] || {});
  const views = Math.max(
    omMetricNum(p.views), omMetricNum(p.viewCount), omMetricNum(p.viewsCount), omMetricNum(p.productViews), omMetricNum(p.popularViews),
    omMetricNum(cached.views), omMetricNum(local.views)
  );
  const cartAdds = Math.max(
    omMetricNum(p.cartAdds), omMetricNum(p.cartAddCount), omMetricNum(p.addToCartCount),
    omMetricNum(cached.cartAdds), omMetricNum(local.cartAdds)
  );
  const favoriteAdds = Math.max(
    omMetricNum(p.favoriteAdds), omMetricNum(p.favorites), omMetricNum(p.favoriteCount), omMetricNum(p.wishlistAdds),
    omMetricNum(cached.favoriteAdds), omMetricNum(local.favoriteAdds)
  );
  const purchases = Math.max(
    omMetricNum(p.purchases), omMetricNum(p.purchaseCount), omMetricNum(p.soldCount), omMetricNum(p.salesCount),
    omMetricNum(cached.purchases), omMetricNum(local.purchases)
  );
  const calculated = omEngagementScore({views, cartAdds, favoriteAdds, purchases});
  const score = Math.max(calculated, omMetricNum(p.metricScore), omMetricNum(p.engagementScore), omMetricNum(cached.score), omMetricNum(local.score));
  return {views, cartAdds, favoriteAdds, purchases, score};
}
function omGetProductMetrics(pOrId){
  const p = (typeof pOrId === "object" && pOrId) ? pOrId : (products || []).find(x=>String(x.id||x._docId)===String(pOrId));
  return omMetricFromProduct(p || {id:pOrId});
}
function omMetricFieldForType(type){
  const t = String(type||"").toLowerCase();
  if(t === "view" || t === "views" || t === "open") return {field:"views", weight:1, event:"view"};
  if(t === "favorite" || t === "fav" || t === "wishlist") return {field:"favoriteAdds", weight:4, event:"favorite"};
  if(t === "add_to_cart" || t === "cart" || t === "cart_add") return {field:"cartAdds", weight:7, event:"add_to_cart"};
  if(t === "purchase" || t === "buy" || t === "order") return {field:"purchases", weight:25, event:"purchase"};
  return {field:"views", weight:1, event:t || "view"};
}
function omUpdateLocalMetric(productId, field, qty=1){
  const id = String(productId || "").trim();
  if(!id) return;
  const all = omReadLocalMetrics();
  const cur = all[id] || {};
  cur[field] = omMetricNum(cur[field]) + omMetricNum(qty || 1);
  cur.score = omEngagementScore(cur);
  cur.updatedAt = Date.now();
  all[id] = cur;
  omWriteLocalMetrics(all);
  productMetricsCache.set(id, {...(productMetricsCache.get(id)||{}), ...cur, ts: Date.now()});
  const prod = (products || []).find(x=>String(x.id||x._docId)===id);
  if(prod){
    prod[field] = Math.max(omMetricNum(prod[field]), omMetricNum(cur[field]));
    prod.metricScore = Math.max(omMetricNum(prod.metricScore), omMetricNum(cur.score));
  }
}
async function omLoadProductMetric(productId, force=false){
  const id = String(productId || "").trim();
  if(!id) return null;
  const cached = productMetricsCache.get(id);
  if(!force && cached && Date.now() - (cached.ts || 0) < 120000) return cached;
  try{
    const snap = await getDoc(doc(db, "productMetrics", id));
    if(snap.exists()){
      const d = snap.data() || {};
      const out = {
        views: omMetricNum(d.views),
        cartAdds: omMetricNum(d.cartAdds),
        favoriteAdds: omMetricNum(d.favoriteAdds),
        purchases: omMetricNum(d.purchases),
        score: omMetricNum(d.score) || omEngagementScore(d),
        ts: Date.now()
      };
      productMetricsCache.set(id, out);
      return out;
    }
  }catch(e){ /* rules may block reads; local metrics still work */ }
  const local = (omReadLocalMetrics()[id] || {});
  const out = {...local, score: omMetricNum(local.score) || omEngagementScore(local), ts: Date.now()};
  productMetricsCache.set(id, out);
  return out;
}
async function preloadProductMetrics(productIds){
  const ids = [...new Set((productIds||[]).map(String).filter(Boolean))].slice(0, 80);
  if(!ids.length) return;
  await Promise.all(ids.map(id=>omLoadProductMetric(id, false)));
}
async function omRecordProductInteraction(productId, type="view", qty=1){
  const id = String(productId || "").trim();
  if(!id) return;
  const meta = omMetricFieldForType(type);
  const n = Math.max(1, Math.round(omMetricNum(qty || 1)));

  // Immediate UI/local update, so numbers change without waiting for Firestore.
  omUpdateLocalMetric(id, meta.field, n);
  try{ omRenderQuickViewPro(); }catch(e){}
  try{
    if(els?.sort?.value === "popular") applyFilterSort();
  }catch(e){}

  // Event log. Works for logged users, tries anon too; silently ignores if rules block.
  try{
    await addDoc(collection(db, "events"), {
      uid: currentUser?.uid || null,
      anonId: currentUser?.uid ? null : omAnonId(),
      type: meta.event,
      productId: id,
      qty: n,
      weight: meta.weight,
      createdAt: serverTimestamp(),
      ua: navigator.userAgent || "",
    });
  }catch(e){}

  // Aggregated public metrics. If rules allow, this becomes site-wide real popularity.
  try{
    await setDoc(doc(db, "productMetrics", id), {
      [meta.field]: increment(n),
      score: increment(meta.weight * n),
      updatedAt: serverTimestamp()
    }, { merge:true });
  }catch(e){}

  // Optional mirror fields on product document for sorting/indexing; ignored if rules deny.
  try{
    await setDoc(doc(db, "products", id), {
      [meta.field]: increment(n),
      metricScore: increment(meta.weight * n),
      popularScore: increment(meta.weight * n),
      updatedAt: serverTimestamp()
    }, { merge:true });
  }catch(e){}
}
function omRecordPurchaseMetrics(items){
  try{
    (items || []).forEach(it=>{
      const id = it.productId || it.id;
      const qty = Number(it.qty || it.quantity || 1) || 1;
      omRecordProductInteraction(id, "purchase", qty);
    });
  }catch(e){}
}

// Backward compatible event API used by older buttons.
async function logEvent(type, productId){
  return omRecordProductInteraction(productId, type, 1);
}


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
  checkoutSheet: document.getElementById("checkoutSheet"),
  checkoutClose: document.getElementById("checkoutClose"),
  checkoutSubmit: document.getElementById("checkoutSubmit"),
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
  pfRegion: document.getElementById("pfRegion"),
  pfDistrict: document.getElementById("pfDistrict"),
  pfPost: document.getElementById("pfPost"),

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
    const baseRef = collection(db, "products", productId, "reviews");
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
    orderBy("createdAt", "desc"),
    limit(30)
  );
  let statsDebounce = null;
  unsubReviews = onSnapshot(q, (snap)=>{
    const list = [];
    snap.forEach((docu)=>{
      const d = docu.data() || {};
      list.push({
        uid: d.uid || docu.id,
        author: d.authorName || "Foydalanuvchi",
        stars: Number(d.stars)||0,
        text: (d.text||"").toString(),
        ts: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0
      });
    });
    renderReviewsList(list);

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
          <div class="revItemImg" data-img="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt="review image" loading="lazy"/></div>
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
  localStorage.setItem(key, JSON.stringify(value));
  try{
    if(key === LS.favs || key === LS.cart) scheduleUserShopSync();
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
function omCurrentSavedAddresses(){
  try{ return omNormalizeAddresses(JSON.parse(localStorage.getItem("orzumall_saved_delivery_addresses_v1") || "[]")); }
  catch(_){ return []; }
}
function omSetSavedAddressesLocal(arr){
  try{ localStorage.setItem("orzumall_saved_delivery_addresses_v1", JSON.stringify(omNormalizeAddresses(arr))); }catch(_){}
}
function omUserShopPayload(){
  return {
    favs: omNormalizeFavs(Array.from(favs||[])),
    cart: omNormalizeCart(cart||[]),
    savedAddresses: omCurrentSavedAddresses()
  };
}
function omApplyUserShopState(data, opts={merge:false}){
  if(!data) return;
  omUserShopApplying = true;
  try{
    const serverFavs = data.favs || data.favoriteProducts || data.shop?.favs || [];
    const serverCart = data.cart || data.shop?.cart || [];
    const serverAddresses = data.savedAddresses || data.deliveryAddresses || data.shop?.savedAddresses || [];

    const nextFavs = opts.merge ? omMergeFavs(Array.from(favs||[]), serverFavs) : omNormalizeFavs(serverFavs);
    const nextCart = opts.merge ? omMergeCart(cart||[], serverCart) : omNormalizeCart(serverCart);
    const nextAddresses = opts.merge ? omMergeAddresses(omCurrentSavedAddresses(), serverAddresses) : omNormalizeAddresses(serverAddresses);

    favs = new Set(nextFavs);
    cart = nextCart;
    localStorage.setItem(LS.favs, JSON.stringify(nextFavs));
    localStorage.setItem(LS.cart, JSON.stringify(nextCart));
    omSetSavedAddressesLocal(nextAddresses);

    cartSelected = new Set((cart||[]).map(x=>x.key));
    lastCartKeys = new Set((cart||[]).map(x=>x.key));
    cartSelectionInitialized = true;

    updateBadges?.();
    try{ renderSavedAddressesUI?.(); }catch(_){}
    try{ renderFavPage?.(); }catch(_){}
    try{ renderCartPage?.(); }catch(_){}
    try{ if(typeof applyFilterSort === "function") applyFilterSort(); }catch(_){}
  }finally{
    omUserShopApplying = false;
  }
}
async function loadUserShopState(user){
  if(!user?.uid) return;
  omUserShopReady = false;
  try{
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    omApplyUserShopState(data, {merge:true});
    const payload = omUserShopPayload();
    omUserShopLastJson = JSON.stringify(payload);
    await setDoc(ref, {...payload, shopUpdatedAt: serverTimestamp()}, {merge:true});
    omUserShopReady = true;
  }catch(e){
    omUserShopReady = true;
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
      savedAddresses: omNormalizeAddresses(data.savedAddresses || data.deliveryAddresses || data.shop?.savedAddresses || [])
    };
    const json = JSON.stringify(payload);
    if(!payload.favs.length && !payload.cart.length && !payload.savedAddresses.length) return;
    if(json === omUserShopLastJson) return;
    omUserShopLastJson = json;
    omApplyUserShopState(payload, {merge:false});
  }, (err)=> console.warn("User shop sync snapshot failed", err));
}
function scheduleUserShopSync(){
  try{
    if(omUserShopApplying || !omUserShopReady || !currentUser?.uid) return;
    clearTimeout(omUserShopTimer);
    omUserShopTimer = setTimeout(saveUserShopStateNow, 450);
  }catch(_){}
}
async function saveUserShopStateNow(){
  try{
    if(omUserShopApplying || !omUserShopReady || !currentUser?.uid) return;
    const payload = omUserShopPayload();
    const json = JSON.stringify(payload);
    if(json === omUserShopLastJson) return;
    omUserShopLastJson = json;
    await setDoc(doc(db, "users", currentUser.uid), {...payload, shopUpdatedAt: serverTimestamp()}, {merge:true});
  }catch(e){ console.warn("User shop sync save failed", e); }
}


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
    content.innerHTML = `
      <div class="omDeliveryCalcGrid">
        <div class="omDeliveryCalcCell"><div class="k">Tanlangan summa</div><div class="v">${moneyUZS(built.totalUZS)}</div></div>
        <div class="omDeliveryCalcCell"><div class="k">Umumiy vazn</div><div class="v">${omFormatKg(weightKg)}</div></div>
      </div>
      <div class="omDeliveryWarn">Yetkazib berish narxini hisoblash uchun “Avto aniqlash” tugmasini bosing. Qo‘lda manzil kiritish o‘chirildi.</div>
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
  content.innerHTML = `
    <div class="omDeliveryCalcGrid">
      <div class="omDeliveryCalcCell"><div class="k">Do‘kondan masofa</div><div class="v">${dist == null ? "—" : dist.toFixed(1) + " km"}</div></div>
      <div class="omDeliveryCalcCell"><div class="k">Umumiy vazn</div><div class="v">${omFormatKg(weightKg)}</div></div>
      <div class="omDeliveryCalcCell"><div class="k">Mahsulotlar jami</div><div class="v">${moneyUZS(built.totalUZS)}</div></div>
      <div class="omDeliveryCalcCell"><div class="k">Yetkazish bilan</div><div class="v">${moneyUZS(omDeliveryQuote.totalWithDeliveryUZS)}</div></div>
      ${optHtml}
    </div>
    <div class="omDeliveryRecommend">Tavsiya: ${rec ? rec.label : "Operator bilan kelishiladi"} — ${rec ? (rec.isFree ? "Bepul" : moneyUZS(rec.feeUZS)) : "—"}<small>${rec ? `${rec.etaText}. ${rec.freeFromUZS ? moneyUZS(rec.freeFromUZS) + " dan bepul limit." : "Bepul limit yo‘q."}` : "Manzilni aniqlang."}</small></div>
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
  if(img) return `<img class="catIconImg" src="${escapeHtml(img)}" alt="" loading="lazy">`;
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
      const hay = `${p.name} ${omProductText(p, "name", p.name||"")} ${omProductCategoryLabel(p)} ${(p.tags||[]).join(" ")} ${omProductTags(p).join(" ")}`.toLowerCase();
      return hay.includes(query);
    });
  }

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
function renderDeliveryBadge(p){
  const d = getDeliveryInfo(p);
  const cls = d.type === "cargo" ? "shipBadge cargo" : "shipBadge stock";
  const flagSrc = d.type === "cargo" ? "assets/flags/cn.png" : "assets/flags/uz.png";
  const flagAlt = d.type === "cargo" ? "CN" : "UZ";
  const dayWord = omLang()==="ru" ? "дн." : (omLang()==="en" ? "days" : "kun");
  // Use local PNG flags to avoid emoji font issues (UZ/CN text fallback).
  return `<span class="${cls}"><img class="omFlag" src="${flagSrc}" alt="${flagAlt}" loading="lazy"> <span class="omTruck">🚚</span> (${d.min}–${d.max} ${dayWord})</span>`;
}

function getProductType(p){
  const t = String(p?.productType || p?.authType || "").toLowerCase().trim();
  if(!t) return "";
  if(["original","org","brand"].includes(t)) return "original";
  if(["oem","factory"].includes(t)) return "oem";
  if(["replica","copy","nusxa","fake"].includes(t)) return "replica";
  return t;
}
function renderProductTypeBadge(p){
  const t = getProductType(p);
  if(!t) return "";
  if(t==="original") return `<span class="authBadge original" title="Original"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${escapeHtml(omTrText("Asl mahsulot"))}</span>`;
  if(t==="oem") return `<span class="authBadge oem" title="OEM"><i class="fa-solid fa-industry" aria-hidden="true"></i> OEM</span>`;
  if(t==="replica") return `<span class="authBadge replica" title="Copy"><i class="fa-solid fa-copy" aria-hidden="true"></i> Copy</span>`;
  return `<span class="authBadge other" title="${escapeHtml(omTrText("Mahsulot turi"))}"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${escapeHtml(omTrText(t))}</span>`;
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
  "ads/ad1.webp",
  "ads/ad2.webp",
  "ads/ad3.webp",
  "ads/ad4.webp"
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
    <img class="adImg" src="${src}" alt="Reklama" loading="lazy" />
  `;

  card.addEventListener("click", ()=>{
    openImageZoom(src);
  });

  return card;
}


function omProductPowerMiniHtml(p){
  const m = omGetProductMetrics(p);
  const views = omCount(m.views || 0);
  const score = omCount(m.score || 0);
  return `<span title="Ko‘rishlar"><i class="fa-regular fa-eye"></i> ${views}</span><span title="Popular ball"><i class="fa-solid fa-fire"></i> ${score}</span>`;
}

function render(arr){
  els.grid.innerHTML = "";
  if (els.productsCount) {
    const n = Array.isArray(arr) ? arr.length : 0;
    els.productsCount.textContent = omCount(n);
  }
  els.empty.hidden = arr.length !== 0;

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

    const st = getStats(p.id);
    const showAvg = st.count ? st.avg : 0;
    const showCount = st.count ? st.count : 0;

    card.innerHTML = `
      <div class="pmedia">
        <img class="pimg" src="${currentImg || ""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" loading="lazy"/>
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


    const imgEl = card.querySelector(".pimg");

    
const openQuickView = ()=>{
  const selNow = getSel(p);
  const imgs = getImagesFor(p, selNow);
  if(!imgs.length) return;

  const stQV = getStats(p.id);

  openImageViewer({
    imageOnly: true,
    productId: p.id,
    title: omProductText(p, "name", p.name || "Rasm"),
    desc: omProductText(p, "description", p.description || p.desc || ""),
    pricing: getVariantPricing(p, selNow),
    rating: Number(stQV.avg || 0),
    reviewsCount: Number(stQV.count || 0),
    tags: omProductTags(p),
    badge: omProductText(p, "badge", p.badge || ""),
    images: imgs,
    startIndex: selNow.imgIdx || 0,
    onSelect: (i)=>{
      setImageIndex(p, i);
      setCardImage(imgEl, p, getSel(p));
    }
  });
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


function orderStatusLabel(s){
  const v = (s||"").toString().toLowerCase();
  const m = {
    // common order statuses
    "pending":"Kutilmoqda",
    "pending_cash":"Kutilmoqda (naqd)",
    "pending_payment":"To‘lov kutilmoqda",
    "processing":"Jarayonda",
    "paid":"To‘langan",
    "completed":"Yakunlangan",
    "delivered":"Yetkazildi",
    "shipped":"Jo‘natildi",
    "rejected":"Rad etilgan",
    "declined":"Rad etilgan",
    "canceled":"Bekor qilindi",
    "cancelled":"Bekor qilindi",
    "failed":"Muvaffaqiyatsiz"
  };
  return m[v] || (v ? v : "");
}
function orderStatusClass(s){
  const v = (s||"").toString();
  if(!v) return "";
  return "status-"+v.replace(/[^a-z0-9_\-]/gi,"").toLowerCase();
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
  const customer = order?.userName || [order?.firstName, order?.lastName].filter(Boolean).join(" ") || "—";
  const phone = order?.userPhone || order?.shipping?.phone || "—";
  const deliveryLabel = order?.shipping?.methodLabel || (order?.shipping?.method === 'delivery' ? 'Yetkazib berish' : (order?.shipping?.method === 'pickup' ? 'Do‘kondan olib ketish' : '—'));
  const addr = order?.shipping?.addressText || [order?.shipping?.region, order?.shipping?.district, order?.shipping?.post, order?.shipping?.address].filter(Boolean).join(' / ') || [order?.region, order?.district, order?.post].filter(Boolean).join(' / ') || "—";
  const mapUrl = order?.shipping?.mapUrl || (order?.shipping?.lat && order?.shipping?.lng ? `https://maps.google.com/?q=${order.shipping.lat},${order.shipping.lng}` : '');
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
    @media print{body{padding:0}.orderReceiptSheet{border:none;border-radius:0;padding:0}.orderReceiptGrid{grid-template-columns:1fr 1fr}}
  </style></head><body>${html}<script>setTimeout(()=>{window.focus();window.print();},150)<\/script></body></html>`);
  w.document.close();
}

function renderOrders(orders){
  if(!els.ordersList || !els.ordersEmpty) return;
  const arr = Array.isArray(orders) ? orders : [];
  ordersCache = arr;
  els.ordersList.innerHTML = "";
  els.ordersEmpty.hidden = arr.length !== 0;

  for(const o of arr){
    const id = String(o.id || "").slice(-6);
    const total = moneyUZS(Number(o.totalUZS||0));
    const status = (o.status||"").toString();
    const provider = (o.provider||"").toString();
    const when = fmtDate(o.createdAt);
    const row = document.createElement("div");
    row.className = "orderRow orderPremiumRow";
    row.innerHTML = `
      <div class="orderTop">
        <div class="orderId">#${escapeHtml(id)}</div>
        <div class="orderTotal">${escapeHtml(total)}</div>
      </div>
      <div class="orderMeta">
        ${status ? `<span class="orderPill ${orderStatusClass(status)}">${escapeHtml(orderStatusLabel(status))}</span>` : ""}
        ${provider ? `<span class="orderPill">${escapeHtml(providerLabel(provider))}</span>` : ""}
        ${when ? `<span class="orderPill">${escapeHtml(when)}</span>` : ""}
      </div>
      <div class="orderActions">
        <button class="orderActionBtn" type="button" data-order-receipt="${escapeHtml(String(o.id || o.orderId || ''))}">🧾 Chek</button>
      </div>
    `;
    els.ordersList.appendChild(row);
  }
}


/* =========================
   Money history (profile)
========================= */
let moneyUnsubTopups = null;

function normalizeMoneyItems({ topups=[] }){
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
      ts,
      id: t.id || ""
    });
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

    const title = it.provider === 'click' ? "Click orqali balans to‘ldirish" : "Balans to‘ldirish";

    const left = document.createElement("div");
    left.style.minWidth = "0";
    left.innerHTML = `
      <div class="orderId">${title}</div>
      <div class="orderMeta">${when ? `<span class="orderPill">${when}</span>` : ""}${st ? ` <span class="orderPill ${moneyHistoryStatusClass(st)}">${statusLabel(st, it.kind)}</span>` : ""}</div>
      ${it.note ? `<div class="orderMeta" style="margin-top:6px"><b>Izoh:</b> ${escapeHtml(it.note)}</div>` : ""}
    `.trim();

    const right = document.createElement("div");
    right.className = `orderTotal moneyAmount ${isIn ? "isIn" : "isOut"}`;
    right.textContent = (isIn ? "+ " : "- ") + amt;

    const row = document.createElement("div");
    row.className = `orderItem moneyHistoryEntry ${isIn ? "isIn" : "isOut"}`;
    row.style.display = "flex";
    row.style.alignItems = "flex-start";
    row.style.justifyContent = "space-between";
    row.style.gap = "12px";
    row.appendChild(left);
    row.appendChild(right);

    els.moneyHistoryList.appendChild(row);
  }
}


function moneyHistoryStatusClass(st){
  const v = (st||"").toString().toLowerCase();
  return (v === "approved" || v === "success") ? "status-approved" : "status-rejected";
}

function statusLabel(st, kind){
  const v = (st||"").toString().toLowerCase();

  if(kind === "topup"){
    if(v === "approved" || v === "success") return "Tasdiqlangan";
    if(v === "pending" || v === "waiting") return "Kutilmoqda";
    if(v === "rejected" || v === "declined") return "Rad etilgan";
    if(v === "canceled" || v === "cancelled" || v === "canceled_by_admin") return "Bekor qilingan";
    return v ? v : "";
  }

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

  let topupsArr = [];

  function merge(){
    const items = normalizeMoneyItems({ topups: topupsArr });
    renderMoneyHistory(items);
  }

  // Topups: only this user
  try{
    const qTop = query(
      collection(db, "topup_requests"),
      where("uid", "==", uid),
      limit(50)
    );
    moneyUnsubTopups = onSnapshot(qTop, (snap)=>{
      topupsArr = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      // client-side sort to avoid composite index requirement
      topupsArr.sort((a,b)=>{
        const ta = (a.createdAt?.toDate ? +a.createdAt.toDate() : (a.createdAt ? +new Date(a.createdAt) : 0));
        const tb = (b.createdAt?.toDate ? +b.createdAt.toDate() : (b.createdAt ? +new Date(b.createdAt) : 0));
        return tb - ta;
      });
      merge();
    }, (err)=>{
      
      topupsArr = [];
      merge();
    });
  }catch(e){
    console.error(e);
  }



}


function subscribeOrders(uid){
  if(!uid) return;
  if(!currentUser) return;

  if(!uid || !db || !els.ordersList) return;
  try{ ordersUnsub?.(); }catch(e){}

  // Read from top-level orders (rules allow user to read only own orders)
  // NOTE: This query may require a composite index (uid + createdAt). If missing, Firestore will show a link to create it.
  const qy = query(
    collection(db, "orders"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  ordersUnsub = onSnapshot(qy, (snap)=>{
    const arr = snap.docs.map(d=>({ id: d.id, ...d.data() }));
    renderOrders(arr);
  }, (err)=>{
    
    // Fallback to cache if any
    renderOrders(ordersCache);
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



/* ===== Mobile SPA Router (Android-like pages) ===== */
let activeTab = "home";
let activeCatPath = []; // array of strings
let appliedCatPath = []; // applied category filter (prefix path)

function setActiveNav(tab){
  document.querySelectorAll(".mobile-bottom-bar .nav-btn").forEach(btn=>{
    const on = (btn.dataset.tab === tab);
    btn.classList.toggle("active", on);
  });
}

function showView(tab){
  const map = {
    home: els.viewHome,
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
    const cls = ["om-view-home","om-view-categories","om-view-fav","om-view-cart","om-view-profile"];
    document.documentElement.classList.remove(...cls);
    document.body && document.body.classList.remove(...cls);
    const nowCls = "om-view-" + tab;
    document.documentElement.classList.add(nowCls);
    document.body && document.body.classList.add(nowCls);
  }catch(e){}

  // render pages on enter
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
  const tab = h || "home";
  showView(tab);
}


window.addEventListener("hashchange", handleHash);

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
  const eta = max ? `${min||1}–${max} kun` : (t.includes("cargo") ? "15–30 kun" : "Tez yetkazish");
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
  if(type) arr.push(`<span><i class="fa-solid fa-certificate"></i>${escapeHtml(type.toUpperCase())}</span>`);
  if(id) arr.push(`<span><i class="fa-solid fa-barcode"></i>${escapeHtml(id)}</span>`);
  arr.push(`<span class="qvMetricViews"><i class="fa-regular fa-eye"></i><b>${omCount(m.views||0)}</b><small>ko‘rish</small></span>`);
  arr.push(`<span><i class="fa-solid fa-cart-shopping"></i><b>${omCount(m.cartAdds||0)}</b><small>savat</small></span>`);
  arr.push(`<span><i class="fa-solid fa-heart"></i><b>${omCount(m.favoriteAdds||0)}</b><small>sevimli</small></span>`);
  arr.push(`<span><i class="fa-solid fa-bag-shopping"></i><b>${omCount(m.purchases||0)}</b><small>sotuv</small></span>`);
  arr.push(`<span class="qvMetricScore"><i class="fa-solid fa-fire"></i><b>${omCount(m.score||0)}</b><small>ball</small></span>`);
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
    b.innerHTML = `<img src="${src}" alt="thumb" loading="lazy" />`;
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
  if(!viewer.imageOnly) renderReviewsUI(viewer.productId);
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
    const panel = els.imgViewer.querySelector('.qvPanel');
    if(panel){
      panel.scrollTop = 0;
      panel.style.webkitOverflowScrolling = 'touch';
    }
  }catch(e){}
}


// Compatibility helper: some cards call openViewer(productId)
function openViewer(productId){
  const p = (products || []).find(x=>String(x.id)===String(productId));
  if(!p){ toast("Mahsulot topilmadi."); return; }
  const images = (p.images && p.images.length ? p.images : (p.imagesByColor?.[0]?.images || [])).filter(Boolean);
  openImageViewer({
    imageOnly: true,
    productId: p.id,
    title: omProductText(p, "name", p.name || "Mahsulot"),
    desc: omProductText(p, "description", p.description || ""),
    pricing: { price: p.price, oldPrice: p.oldPrice, currency: p.currency || "UZS" },
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    tags: omProductTags(p),
    badge: omProductText(p, "badge", p.badge || ""),
    images,
    startIndex: 0,
  });
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
    b.textContent = "★";
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
    const stars = "★".repeat(s) + "☆".repeat(5-s);
    item.innerHTML = `
      <div class="revItemTop">
        <div class="revItemName">${escapeHtml(r.author||"Foydalanuvchi")}</div>
        <div class="revItemStars">${stars}</div>
      </div>
      <div class="revItemText">${escapeHtml(r.text||"")}</div>
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

  const titleMap = { info:"Tavsif", video:"Video", reviews:"Sharh" };
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
      meta.className = "miniMeta";
      meta.innerHTML = `
        <div class="pill"><i class="fa-solid fa-star" aria-hidden="true"></i> ${st.avg ? st.avg.toFixed(1) : "0.0"}</div>
        <div class="pill"><i class="fa-solid fa-message" aria-hidden="true"></i> ${st.count} ta sharh</div>
      `;
      els.miniBody.appendChild(meta);
    }catch(e){}


    // composer (stars + text)
    const composer = document.createElement("div");
    composer.className = "miniComposer";
    composer.innerHTML = `
      <div class="revLabelRow">
        <div class="revLabel">Reyting</div>
        <div class="revHint">1–5 yulduz</div>
      </div>
      <div class="revStars" id="miniRevStars"></div>
      <div class="revLabelRow">
        <div class="revLabel">Sharh</div>
        <div class="revHint"><span id="miniChar">0</span>/400</div>
      </div>
      <textarea class="revText" id="miniRevText" rows="3" placeholder="Qisqa va aniq yozing (masalan: sifat zo‘r, yetkazish tez)…"></textarea>
      <button class="revBtn" id="miniRevSend"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Yuborish</button>
      <div class="muted miniRevNote" style="margin-top:8px; font-size:12px;">Sharh qoldirish uchun kirish talab qilinadi.</div>
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
        const authorName = (user.displayName || user.email || "Foydalanuvchi").toString();
        const revRef = doc(db, "products", String(p.id), "reviews", user.uid);

        await runTransaction(db, async (tx) => {
          const revSnap = await tx.get(revRef);
          const prev = revSnap.exists() ? (revSnap.data() || {}) : {};
          const createdAt = prev.createdAt ? prev.createdAt : serverTimestamp();

          tx.set(revRef, {
            uid: user.uid,
            authorName,
            stars,
            text,
            updatedAt: serverTimestamp(),
            createdAt
          }, { merge: true });
        });

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
      orderBy("createdAt", "desc"),
      limit(30)
    );
    miniState.unsub = onSnapshot(q, (snap)=>{
      const list = [];
      snap.forEach((docu)=>{
        const d = docu.data() || {};
        list.push({
          uid: d.uid || docu.id,
          author: d.authorName || "Foydalanuvchi",
          stars: Number(d.stars)||0,
          text: (d.text||"").toString(),
          ts: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0
        });
      });
      listWrap.innerHTML = "";
      listWrap.appendChild(renderMiniReviewsList(list));
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
      <img class="cartImg" src="${imgSrc||""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" />
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
        <img class="favCardImg" src="${imgSrc||""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" />
        <button class="favRemoveBtn" title="Sevimlidan olib tashlash" aria-label="Sevimlidan olib tashlash"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="favContent">
        <div class="favTopRow">
          ${ratingHtml}
          <span class="favMiniBadge">Sevimli</span>
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
    item.className = "cartItem";
    item.innerHTML = `
      <img class="cartImg" src="${imgSrc||""}" alt="${escapeHtml(omProductText(p, "name", p.name || "product"))}" />
      <div class="cartMeta">
        <label class="cartPick">
          <input type="checkbox" class="cartPickBox" data-pick="${escapeHtml(ci.key)}" ${cartSelected.has(ci.key) ? "checked" : ""} />
          <span></span>
        </label>
        <div class="cartTitle">${escapeHtml(omProductText(p, "name", p.name || "Nomsiz"))}</div>
        <div class="cartWeightMini"><i class="fa-solid fa-weight-hanging" aria-hidden="true"></i> ${omFormatKg(omProductWeightKg(p))} × ${qty} = ${omFormatKg(omProductWeightKg(p) * qty)}</div>
        ${renderVariantLine(ci)}
        <div class="cartShip">${renderDeliveryBadge(p)}</div>
        ${(_normPType(p)==="cargo" || p.prepayRequired===true) ? `<div class="cartPrepay"><span class="prepayPill"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Oldindan to‘lov</span></div>` : ``}
        <div class="cartRow">
          <div class="price">${moneyUZS(vp.price||0)}</div>
          <button class="removeBtn" title="O‘chirish"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
        <div class="cartRow">
          <div class="qty">
            <button data-q="-">−</button>
            <span>${qty}</span>
            <button data-q="+">+</button>
          </div>
          <div class="badge">${moneyUZS((vp.price||0)*qty)}</div>
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
  if(selectedInfoEl) selectedInfoEl.textContent = `${selectedCount} ta tanlangan`;
  if(summaryNoteEl) summaryNoteEl.textContent = list.length ? `Savatchada ${list.length} ta mahsulot bor. Tanlangan vazn: ${omFormatKg(selectedWeightKg)}.` : "Savatcha bo‘sh.";
  try{ omRenderDeliveryEstimate(); }catch(_e){}

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



/* =========================
   Checkout (Cart -> Order)
========================= */
function openCheckout(){
  if(!els.checkoutSheet) return;
  els.checkoutSheet.hidden = false;
  try{ updateDeliveryMethodUI(); }catch(_e){}

  // Require completed profile before checkout
  try{
    if(window.__omProfile && window.__omProfile.isProfileComplete && !window.__omProfile.isProfileComplete()){
      toast("Avval profilni to‘liq to‘ldiring (Ism, Familiya, Telefon, Viloyat, Tuman, Pochta).");
      closeCheckout();
      goTab("profile");
      // auto-open edit mode
      try{ setTimeout(()=>{ document.getElementById("profileEditBtn")?.click(); }, 120); }catch(_){ }
      return;
    }
  }catch(_){}


  // Scroll sheet into view
  els.checkoutSheet.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeCheckout(){
  if(!els.checkoutSheet) return;
  els.checkoutSheet.hidden = true;
}

function getPayType(){
  const r = document.querySelector('input[name="paytype"]:checked');
  return r ? r.value : "cash";
}

let omDeliveryLocation = null;

function getDeliveryMethod(){
  const r = document.querySelector('input[name="deliveryMethod"]:checked');
  return r ? r.value : "pickup";
}

function updateDeliveryMethodUI(){
  const method = getDeliveryMethod();
  document.querySelectorAll('.deliveryOption').forEach(label=>{
    const inp = label.querySelector('input[name="deliveryMethod"]');
    label.classList.toggle('active', !!inp && inp.checked);
  });
  const box = document.getElementById('deliveryAddressBox');
  if(box) box.hidden = method !== 'delivery';
  try{ omRenderDeliveryEstimate(); }catch(_e){}
}

function setDeliveryLocationStatus(text, ok=false){
  const el = document.getElementById('deliveryLocationStatus');
  if(!el) return;
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
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
    setDeliveryLocationStatus(`Joylashuv olindi: ${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy ? ` • ±${accuracy} m` : ''}`, true);
    try{ omRenderDeliveryEstimate(); }catch(_e){}
    toast('Joylashuv qo‘shildi.');
  }catch(e){
    omDeliveryLocation = null;
    try{ omRenderDeliveryEstimate(); }catch(_e){}
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
  if(!omDeliveryLocation){
    return { ok:false, reason:'Yetkazib berish uchun “Avto aniqlash” tugmasini bosing va lokatsiyaga ruxsat bering.' };
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
  const addressText = coordText ? `Avto lokatsiya: ${coordText}` : '';
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


const OM_SAVED_ADDR_KEY = "orzumall_saved_delivery_addresses_v1";

function omReadSavedAddresses(){
  try{
    const arr = JSON.parse(localStorage.getItem(OM_SAVED_ADDR_KEY) || "[]");
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }catch(_){ return []; }
}

function omWriteSavedAddresses(arr){
  try{ localStorage.setItem(OM_SAVED_ADDR_KEY, JSON.stringify(Array.isArray(arr) ? arr : [])); }catch(_){}
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
            <b>${escapeHtml(omAddressTitle(a, i))}</b>
            <span>${escapeHtml(omAddressLine(a) || "Manzil ma’lumoti yo‘q")}</span>
          </div>
          <button type="button" class="savedAddressDelete" data-del="${escapeHtml(String(a.id || ""))}" title="O‘chirish" aria-label="O‘chirish"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        `;
        list.appendChild(row);
      });
    }
  }
  if(status){
    status.textContent = arr.length ? `${arr.length} ta manzil saqlandi.` : "Manzil qo‘lda yozilmaydi, faqat avto lokatsiya saqlanadi.";
  }

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
  }
}

function applySavedAddressToCheckout(id){
  const arr = omReadSavedAddresses();
  const a = arr.find(x=>String(x.id)===String(id));
  if(!a) return;

  const deliveryRadio = document.querySelector('input[name="deliveryMethod"][value="delivery"]');
  if(deliveryRadio) deliveryRadio.checked = true;
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
  try{ omRenderDeliveryEstimate(); }catch(_e){}
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
  document.querySelectorAll('input[name="deliveryMethod"]').forEach(inp=>{
    inp.addEventListener('change', updateDeliveryMethodUI);
  });
  document.getElementById('deliveryLocateBtn')?.addEventListener('click', detectDeliveryLocation);
  updateDeliveryMethodUI();
  try{ renderSavedAddressesUI(); }catch(_){}
}
initCheckoutDeliveryUI();
initSavedAddressUI();
omLoadDeliverySettings().catch(()=>{});


function applyPayTypeRules(){
  try{
    // determine if any selected item requires prepay (cargo)
    const built = (typeof buildSelectedItems === "function") ? buildSelectedItems() : null;
    const items = built && built.ok ? built.items : [];
    const hasPrepay = items.some(it=>it.prepayRequired) || cart.some(ci=>{
      const p = products.find(x=>x.id===ci.id);
      return p && (_normPType(p)==="cargo" || p.prepayRequired===true);
    });

    // helper to hide the whole option row
    const hideOpt = (rb, hide)=>{
      if(!rb) return;
      const row = rb.closest("label") || rb.closest(".payOption") || rb.parentElement;
      if(row) row.style.display = hide ? "none" : "";
      rb.disabled = !!hide;
    };

    const cashRb = document.querySelector('input[name="paytype"][value="cash"]');
    const balRb  = document.querySelector('input[name="paytype"][value="balance"]');

    // Payme removed -> hide payme option if exists in markup
    const paymeRb = document.querySelector('input[name="paytype"][value="payme"]');
    hideOpt(paymeRb, true);

    // For cargo/prepay: only BALANCE allowed
    hideOpt(cashRb, hasPrepay);
    hideOpt(balRb, false);

    const note = document.getElementById("payRuleNote");
    if(hasPrepay){
      if(balRb) balRb.checked = true;
      if(note) note.textContent = "⚠️ Keltirib berish mahsulotlari uchun naqd to‘lov yo‘q. Oldindan to‘lov: BALANS.";
    } else {
      if(note) note.textContent = "";
    }
  }catch(e){
    // never break page
    console.warn("applyPayTypeRules failed:", e);
  }
}
window.applyPayTypeRules = applyPayTypeRules;



let __omOrderSubmitting = false;

function ensureOrderWaitOverlay(){
  let el = document.getElementById("omOrderWaitOverlay");
  if(el) return el;

  el = document.createElement("div");
  el.id = "omOrderWaitOverlay";
  el.className = "omOrderWaitOverlay";
  el.hidden = true;
  el.innerHTML = `
    <div class="omOrderWaitCard" role="status" aria-live="polite">
      <div class="omOrderWaitLogoWrap">
        <img src="./logo.webp" alt="OrzuMall" class="omOrderWaitLogo">
      </div>
      <div class="omOrderWaitTitle">Buyurtma yuborilmoqda</div>
      <div class="omOrderWaitText">Iltimos, kuting. Ma’lumotlar tekshirilmoqda...</div>
      <div class="omOrderWaitProgress"><span></span></div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

function showOrderWaitOverlay(){
  const el = ensureOrderWaitOverlay();
  el.hidden = false;
  requestAnimationFrame(()=> el.classList.add("open"));
  document.documentElement.classList.add("om-order-waiting");
  document.body.classList.add("om-order-waiting");

  const btns = [els?.checkoutSubmit, els?.orderBtnPage].filter(Boolean);
  btns.forEach(btn=>{
    if(!btn.dataset.omOldHtml) btn.dataset.omOldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add("isLoading");
  });
  if(els?.checkoutSubmit){
    els.checkoutSubmit.innerHTML = `<span class="omBtnSpinner" aria-hidden="true"></span> Kuting...`;
  }
}

function hideOrderWaitOverlay(){
  const el = document.getElementById("omOrderWaitOverlay");
  if(el){
    el.classList.remove("open");
    setTimeout(()=>{ if(!el.classList.contains("open")) el.hidden = true; }, 180);
  }
  document.documentElement.classList.remove("om-order-waiting");
  document.body.classList.remove("om-order-waiting");

  const btns = [els?.checkoutSubmit, els?.orderBtnPage].filter(Boolean);
  btns.forEach(btn=>{
    btn.disabled = false;
    btn.classList.remove("isLoading");
    if(btn.dataset.omOldHtml){
      btn.innerHTML = btn.dataset.omOldHtml;
      delete btn.dataset.omOldHtml;
    }
  });
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
    const rb = document.querySelector("input[name=paytype][value=balance]");
    if(rb) rb.checked = true;
    payType = "balance";
  }
  __omOrderSubmitting = true;
  showOrderWaitOverlay();

  const deliveryFeeUZS = Number(deliveryInfo.data?.deliveryFeeUZS || 0);
  const grandTotalUZS = Number(deliveryInfo.data?.totalWithDeliveryUZS || (built.totalUZS + deliveryFeeUZS));
  const orderId = null; // server will allocate unique short id
  const amountTiyin = Math.round(grandTotalUZS * 100);

  // Shipping/profile snapshot (viloyat/tuman/pochta) for order + Telegram
  let shippingSnap = null;
  try{
    const uSnap = await getDoc(doc(db, "users", currentUser.uid));
    const u = uSnap.exists() ? (uSnap.data() || {}) : {};
    const region = (u.region || "").toString();
    const district = (u.district || "").toString();
    const post = (u.post || "").toString();
    shippingSnap = {
      region, district, post,
      addressText: [region, district, post].filter(Boolean).join(" / ")
    };
  }catch(_e){}

  shippingSnap = {
    ...(shippingSnap || {}),
    ...(deliveryInfo.data || {}),
    profileAddressText: shippingSnap?.addressText || ""
  };
  if(deliveryInfo.data?.method === 'delivery'){
    const parts = [shippingSnap.profileAddressText, deliveryInfo.data.addressText].filter(Boolean);
    shippingSnap.addressText = parts.join(' / ');
  }

  const payload = {
    orderId,
    provider: payType === 'balance' ? 'balance' : 'cash',
    status: payType === 'balance' ? 'paid' : 'pending_cash',
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

    omRecordPurchaseMetrics(built.items);
    removePurchasedFromCart(built.sel);
    updateBadges();
    renderCartPage();
    closeCheckout();
  }catch(e){
    console.warn("checkout order create failed", e);
    const msg = (e && e.message) ? String(e.message) : "";
    toast(msg ? ("Buyurtma yaratilmadi: " + msg) : "Buyurtma yaratilmadi. Qayta urinib ko‘ring.");
    hideOrderWaitOverlay();
    __omOrderSubmitting = false;
    return; // IMPORTANT: don't show success message on failure
  }

  hideOrderWaitOverlay();
  __omOrderSubmitting = false;
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
      // Client-side active filter (avoid composite index): if isActive is explicitly false, skip.
      if(("isActive" in data) && data.isActive === false) return null;
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
    preloadProductMetrics(arr.map(p=>p.id)).then(()=>{ try{ applyFilterSort(); if(activeTab==="categories") renderCategoriesPage(); }catch(e){} });
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
      }, { root: null, rootMargin: "1200px 0px", threshold: 0.01 });
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
  currentUser = user || null;
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
document.getElementById("qvReviewsBtn")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  if(viewer?.productId) openMini("reviews", viewer.productId);
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
    const authorName = (user.displayName || user.email || "Foydalanuvchi").toString();
    const revRef = doc(db, "products", productId, "reviews", user.uid);

    await runTransaction(db, async (tx) => {
      const revSnap = await tx.get(revRef);
      const prev = revSnap.exists() ? (revSnap.data() || {}) : {};
      const createdAt = prev.createdAt ? prev.createdAt : serverTimestamp();

      tx.set(revRef, {
        uid: user.uid,
        authorName,
        stars,
        text,
        updatedAt: serverTimestamp(),
        createdAt
      }, { merge: true });
    });

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

async function createOrderDoc({orderId, provider, status, items, totalUZS, amountTiyin, shipping, orderType="checkout"}){
  if(!currentUser) throw new Error("no_user");

  // pull richer user fields for order + telegram
  const userRef = doc(db, "users", currentUser.uid);
  let userName = null, userPhone = null, numericId = null, userTgChatId = null;
  let firstName = null, lastName = null, region = null, district = null, post = null;
  try{
    const uSnap = await getDoc(userRef);
    const u = uSnap.exists() ? (uSnap.data() || {}) : {};
    profileCache = u;
    userName = (u.name || currentUser.displayName || currentUser.email || "User").toString();
    userPhone = (u.phone || "").toString();
    numericId = (u.numericId != null ? String(u.numericId) : null);
    userTgChatId = (u.telegramChatId || u.tgChatId || "").toString().trim() || null;
    firstName = (u.firstName || "").toString() || null;
    lastName = (u.lastName || "").toString() || null;
    region = (u.region || "").toString() || null;
    district = (u.district || "").toString() || null;
    post = (u.post || "").toString() || null;
  }catch(_e){
    userName = (currentUser.displayName || currentUser.email || "User").toString();
    userPhone = "";
    numericId = null;
    userTgChatId = null;
    firstName = null; lastName = null; region = null; district = null; post = null;
  }

  const orderRef = doc(db, "orders", orderId);

  const baseOrder = {
    orderId,
    uid: currentUser.uid,
    numericId,
    userName,
    userPhone,
    userTgChatId,
    firstName,
    lastName,
    region,
    district,
    post,
    status,
    items,
    totalUZS,
    amountTiyin: amountTiyin ?? null,
    provider,
    shipping: shipping || null,
    orderType,
    createdAt: serverTimestamp(),
    source: "web",
  };

  // ensure shipping has full profile snapshot (viloyat/tuman/pochta)
  if(!baseOrder.shipping){
    const addrText = [region, district, post].filter(Boolean).join(" / ");
    baseOrder.shipping = { region, district, post, addressText: addrText };
  } else if(!baseOrder.shipping.addressText){
    const r = baseOrder.shipping.region || region;
    const d = baseOrder.shipping.district || district;
    const p = baseOrder.shipping.post || post;
    baseOrder.shipping.addressText = [r,d,p].filter(Boolean).join(" / ");
  }

  // BALANCE checkout: atomically deduct balance and mark as paid
  if (provider === "balance" && orderType === "checkout") {
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userRef);
      const u = uSnap.exists() ? (uSnap.data() || {}) : {};
      const bal = Number(u.balanceUZS || 0);
      const need = Number(totalUZS || 0);

      if (!Number.isFinite(bal) || bal < need) {
        throw new Error("insufficient_balance");
      }

      tx.set(userRef, { balanceUZS: bal - need, updatedAt: serverTimestamp() }, { merge: true });

      const paidOrder = { ...baseOrder, status: "paid", provider: "balance", amountTiyin: null };
      tx.set(orderRef, paidOrder, { merge: true });
    });
  } else {
    // cash checkout or topup/payme orders
    await setDoc(orderRef, baseOrder, { merge: true });
  }
  // notify (create) — client-side dedupe (no extra Firestore writes; avoids permission-denied)
  try{
    window.__tgSentOrders = window.__tgSentOrders || new Set();
    if(!window.__tgSentOrders.has(orderId)){
      window.__tgSentOrders.add(orderId);
      // server-side Telegram notify (secure: no bot token in client)
      tgNotifyOrderCreated(orderId);
    }
  }catch(_e){}
}

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
function openTopupModal(prefillAmount){
  const modal = document.getElementById('topupModal');
  if(!modal) return;
  if(!document.body.classList.contains('signed-in')){ toast("Avval kirish qiling."); return; }

  const step1 = document.getElementById('topupStep1');
  const step2 = document.getElementById('topupStep2');
  if(step1) step1.hidden = false;
  if(step2) step2.hidden = true;

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


async function payWithBalance(built, shipping){
  if(!currentUser) throw new Error('no_user');
  const total = Number(built.totalUZS||0);
  const uid = currentUser.uid;
  const orderId = await generateShortOrderId(db);
  await runTransaction(db, async (t)=>{
    const uref = doc(db,'users',uid);
    const us = await t.get(uref);
    const u = us.exists() ? (us.data()||{}) : {};
    const bal = Number(u.balanceUZS||0) || 0;
    if(bal < total) throw new Error('no_balance');

    // deduct balance
    t.set(uref, { balanceUZS: bal - total, updatedAt: serverTimestamp() }, {merge:true});

    // order doc
    const oref = doc(db,'orders',orderId);
    const base = {
      orderId,
      uid,
      numericId: (u.numericId != null ? String(u.numericId) : null),
      userName: u.name || null,
      userPhone: u.phone || null,
      userTgChatId: (u.telegramChatId||u.tgChatId||null),
      status: 'paid',
      provider: 'balance',
      items: built.items,
      totalUZS: total,
      shipping: shipping || null,
      createdAt: serverTimestamp(),
      paidAt: serverTimestamp(),
      source: 'web',
      payFromBalance: true
    };
    // only one order document (global collection) — no per-user subcollection writes
    t.set(oref, base, {merge:true});
  });

  return orderId;
}
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

  const orderId = await generateShortOrderId(db);
  try{
    if(currentUser){
      await createOrderDoc({
        orderId,
        provider: "telegram",
        status: "shared_telegram",
        items: built.items,
        totalUZS: built.totalUZS,
        amountTiyin: null,
      });
    }
  }catch(e){
    console.warn("telegram order create failed", e);
  }

  const lines = built.items.map(it=>{
    const variant = [it.color, it.size].filter(Boolean).join(" / ");
    return `${it.name}${variant?` (${variant})`:``} x${it.qty} = ${moneyUZS((it.priceUZS||0)*(it.qty||0))}`;
  });
  const msg = `OrzuMall buyurtma (ID: ${orderId}):%0A${encodeURIComponent(lines.join("\n"))}%0A%0AJami: ${encodeURIComponent(moneyUZS(built.totalUZS))}`;
  window.open(`https://t.me/share/url?url=&text=${msg}`, "_blank");
}

els.paymeBtn?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  openCheckout();
});
els.paymeBtnPage?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  openCheckout();
});
els.tgShareBtn?.addEventListener("click", shareOrderTelegram);
els.tgShareBtnPage?.addEventListener("click", shareOrderTelegram);

// Cart -> single order flow
els.orderBtnPage?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  openCheckout();
});
els.checkoutClose?.addEventListener("click", closeCheckout);
els.checkoutSubmit?.addEventListener("click", createOrderFromCheckout);

/* =========================
   Profile modal (one-time fill + pencil edit)
========================= */
function profileStorageKey(uid){ return `om_profile_v1_${uid}`; }

function safeJSONParse(s){
  try{ return JSON.parse(s); } catch(e){ return null; }
}

async function loadRegionData(){
  try{
    const resp = await fetch("./region.json?v=1", { cache: "no-store" });
    if(!resp.ok) throw new Error("region.json fetch failed");
    return await resp.json();
  }catch(e){
    console.warn("region.json load error", e);
    return { regions: [] };
  }
}

function setSelectOptions(sel, items, placeholder){
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  sel.appendChild(ph);
  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it;
    opt.textContent = it;
    sel.appendChild(opt);
  }
}

function setFieldsDisabled(disabled){
  if(els.pfFirstName) els.pfFirstName.disabled = disabled;
  if(els.pfLastName) els.pfLastName.disabled = disabled;
  if(els.pfPhone) els.pfPhone.disabled = disabled;
  if(els.pfRegion) els.pfRegion.disabled = disabled;
  if(els.pfDistrict) els.pfDistrict.disabled = disabled;
  if(els.pfPost) els.pfPost.disabled = disabled;
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
  let regionData = null;
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
    const name = (meta?.name || user?.displayName || user?.email || user?.phoneNumber || "User").toString();
    const numericId = (meta?.numericId || "").toString();
    const initial = (name || "U").trim().slice(0,1).toUpperCase();

    if(els.profileName) els.profileName.textContent = name;
    if(els.profileNumericId) els.profileNumericId.textContent = numericId ? `ID: OM${numericId}` : "—";

    if(els.profileAvatar){
      const photo = user.photoURL;
      if(photo){
        els.profileAvatar.innerHTML = `<img src="${photo}" alt="avatar" />`;
      } else {
        els.profileAvatar.textContent = initial;
      }
    }
  }

  function populateDistricts(regionName, selectedDistrict){
    const region = (regionData?.regions || []).find(r=>r.name===regionName);
    const districts = region ? region.districts.map(d=>d.name) : [];
    setSelectOptions(els.pfDistrict, districts, "Tumanni tanlang");
    if(selectedDistrict) els.pfDistrict.value = selectedDistrict;
    populatePosts(regionName, selectedDistrict, null);
  }

  function populatePosts(regionName, districtName, selectedPost){
    const region = (regionData?.regions || []).find(r=>r.name===regionName);
    const district = region ? region.districts.find(d=>d.name===districtName) : null;
    const posts = district ? (district.posts || []) : [];
    setSelectOptions(els.pfPost, posts, "Pochta indeks");
    if(selectedPost) els.pfPost.value = selectedPost;
  }

  async function ensureRegionLoaded(){
    if(regionData) return regionData;
    regionData = await loadRegionData();
    const regions = (regionData.regions || []).map(r=>r.name);
    setSelectOptions(els.pfRegion, regions, "Viloyatni tanlang");
    setSelectOptions(els.pfDistrict, [], "Tumanni tanlang");
    setSelectOptions(els.pfPost, [], "Pochta indeks");
    return regionData;
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

    await ensureRegionLoaded();

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
    const fallbackName = (user.email || user.phoneNumber || "User").toString();

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
    const fsDone = !!(u.phone && u.region && u.district && u.post && (u.firstName||u.name) && (u.lastName||u.name));
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

    if(els.pfRegion){
      const rg = saved?.region || u.region || "";
      const ds = saved?.district || u.district || "";
      let ps = (saved?.post || u.post || "");
      els.pfRegion.value = rg;
      populateDistricts(rg, ds);

      // post may be like "160306 (Ko‘kumbo‘y)" — normalize to digits if needed
      if(ps && els.pfPost){
        const direct = ps;
        els.pfPost.value = direct;
        if(!els.pfPost.value){
          const digits = String(ps).replace(/[^0-9]/g,"");
          if(digits) els.pfPost.value = digits;
        }
      }
    }

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
    const region = els.pfRegion?.value || "";
    const district = els.pfDistrict?.value || "";
    const post = els.pfPost?.value || "";

    // Profile ma'lumotlari majburiy
    if(!firstName || !lastName){
      alert("Iltimos, ism va familiyangizni kiriting.");
      return;
    }
    if(!phone){
      alert("Iltimos, telefon raqamingizni kiriting.");
      return;
    }
    if(!region || !district || !post){
      alert("Iltimos, viloyat, tuman va pochta indeksini tanlang.");
      return;
    }

    const payload = {
      firstName,
      lastName,
      name: (firstName + " " + lastName).trim(),
      phone,
      region,
      district,
      post,
      profileCompleted: true,
      updatedAt: new Date().toISOString()
    };

    // Local cache
    writeProfile(currentUser.uid, payload);

    // Firestore'ga yozish (users/{uid})
    (async ()=>{
      try{
        await setDoc(doc(db, "users", currentUser.uid), payload, { merge: true });
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
      if(els.vOverlay && !els.vOverlay.hidden) closeVariantModal();
      else if(null && !null.hidden) closeProfile();
      else if(els.imgViewer && !els.imgViewer.hidden) closeImgViewer();
    }
  });

  if(els.profileEditBtn) els.profileEditBtn.addEventListener("click", ()=>{
    enableEdit();
  });

  if(els.profileSave) els.profileSave.addEventListener("click", save);

  // region change
  if(els.pfRegion) els.pfRegion.addEventListener("change", ()=>{
    populateDistricts(els.pfRegion.value, "");
  });
  if(els.pfDistrict) els.pfDistrict.addEventListener("change", ()=>{
    populatePosts(els.pfRegion.value, els.pfDistrict.value, "");
  });

  return { open, syncUser, isProfileComplete: ()=>!!isCompleted };
})();

let __appStarted = false;
onAuthStateChanged(auth, async (user)=>{
  setUserUI(user);
  if(!user){
    try{ if(omUserShopUnsub) omUserShopUnsub(); }catch(_){}
    omUserShopUnsub = null;
    omUserShopReady = false;
    return; // setUserUI redirects to /login.html
  }

  if(window.__omProfile?.syncUser) await window.__omProfile.syncUser(user);
  await loadUserShopState(user);
  subscribeUserShopState(user);

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

        <a class="sBtn web" href="https://xplusy.netlify.app/" target="_blank" rel="noopener">
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
          <a class="socialBtn web" href="https://xplusy.netlify.app/" target="_blank" rel="noopener">
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
