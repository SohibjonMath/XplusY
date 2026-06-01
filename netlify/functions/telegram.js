/**
 * Secure Telegram notifications (Netlify Function)
 *
 * ENV:
 *  - ORDER_BOT_TOKEN (preferred) or TELEGRAM_BOT_TOKEN or TG_BOT_TOKEN
 *  - TELEGRAM_ADMIN_CHAT_ID
 *  - FIREBASE_SERVICE_ACCOUNT_B64
 */
const admin = require("firebase-admin");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || "";
  if (!rawB64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");
  const b64 = String(rawB64).replace(/\s+/g, "");
  const jsonString = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(jsonString);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

function parseBody(event) {
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getBearer(event) {
  const h = event.headers || {};
  const a = h.authorization || h.Authorization || "";
  const m = String(a).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function tgEscape(s){ return String(s ?? "").replace(/[<>&]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }

function cleanPublicName(v){const s=String(v==null?"":v).trim().replace(/\s+/g," ");return !s||s.includes("@")?"":s;}
function publicCustomerName(o={}){const full=[cleanPublicName(o.firstName),cleanPublicName(o.lastName)].filter(Boolean).join(" ").trim();return full||cleanPublicName(o.userName)||cleanPublicName(o.name)||cleanPublicName(o.fullName)||"";}
function fmtUZS(n){
  const x = Number(n||0);
  if(!Number.isFinite(x)) return "0";
  try { return x.toLocaleString("ru-RU"); } catch { return String(Math.round(x)); }
}


function fmtMoneyLine(n){
  const x = Number(n || 0);
  return `${fmtUZS(x)} so'm`;
}

function fmtKm(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return "—";
  return `${n.toFixed(n >= 10 ? 1 : 2).replace(/\.00$/, "").replace(/0$/, "")} km`;
}

function fmtKg(v){
  const n = Math.max(0, Number(v || 0));
  if(!Number.isFinite(n) || n <= 0) return "—";
  if(n < 1) return `${Math.round(n * 1000)} g`;
  return `${n.toFixed(n >= 10 ? 1 : 2).replace(/\.00$/, "").replace(/0$/, "")} kg`;
}

function serviceName(service, fallback=""){
  const s = String(service || "").toLowerCase();
  if(s === "courier") return "Kuryer";
  if(s === "uzpost") return "UzPost pochta";
  if(s === "pickup") return "Do‘kondan olib ketish";
  return fallback || "Yetkazib berish";
}

function getOrderWeightKg(o){
  const sh = o && o.shipping ? o.shipping : {};
  const direct = Number(sh.totalWeightKg ?? sh.weightKg ?? o.totalWeightKg ?? o.weightKg);
  if(Number.isFinite(direct) && direct > 0) return direct;
  const items = Array.isArray(o?.items) ? o.items : [];
  return items.reduce((sum, it)=>{
    const lw = Number(it?.lineWeightKg);
    if(Number.isFinite(lw) && lw > 0) return sum + lw;
    const w = Number(it?.weightKg || 0);
    const q = Number(it?.qty || it?.count || 1) || 1;
    return sum + Math.max(0, w) * Math.max(1, q);
  }, 0);
}

function getShippingQuote(o){
  const sh = o && o.shipping ? o.shipping : {};
  const q = sh.deliveryQuote && typeof sh.deliveryQuote === "object" ? sh.deliveryQuote : {};
  const rec = q.recommended && typeof q.recommended === "object" ? q.recommended : {};
  return { sh, q, rec };
}

function fmtDeliveryOption(opt){
  if(!opt || typeof opt !== "object") return "";
  const svc = serviceName(opt.service, opt.label || "Xizmat");
  const k = opt.service === "courier"
    ? `masofa: ${fmtKm(opt.distanceKm)}${opt.billedKm ? `, hisob: ${opt.billedKm} km` : ""}`
    : `vazn: ${fmtKg(opt.weightKg)}${opt.billedKg ? `, hisob: ${opt.billedKg} kg` : ""}`;
  const fee = opt.isFree ? `Bepul (asl narx: ${fmtMoneyLine(opt.rawFeeUZS || opt.feeUZS || 0)})` : fmtMoneyLine(opt.feeUZS || 0);
  const free = opt.freeFromUZS ? `, bepul limit: ${fmtMoneyLine(opt.freeFromUZS)}` : "";
  const eta = opt.etaText ? `, muddat: ${tgEscape(opt.etaText)}` : "";
  return `• ${tgEscape(svc)} — ${tgEscape(k)}, narx: <b>${tgEscape(fee)}</b>${tgEscape(free)}${eta}`;
}

function buildDeliveryDetailsHTML(o){
  const { sh, q, rec } = getShippingQuote(o);
  const method = String(sh.method || "delivery").toLowerCase();
  if(method === "pickup"){
    return [
      `<b>🚚 Yetkazib berish:</b>`,
      `Usul: <b>Do‘kondan olib ketish</b>`,
      `Narx: <b>0 so'm</b>`
    ];
  }

  const service = sh.service || rec.service || "";
  const label = sh.serviceLabel || sh.methodLabel || rec.label || serviceName(service);
  const distanceKm = sh.distanceKm ?? q.distanceKm ?? rec.distanceKm ?? null;
  const billedKm = sh.billedKm ?? rec.billedKm ?? null;
  const weightKg = getOrderWeightKg(o);
  const billedKg = sh.billedKg ?? rec.billedKg ?? null;
  const deliveryFee = Number(o.deliveryFeeUZS ?? o.pricing?.deliveryFeeUZS ?? sh.deliveryFeeUZS ?? q.deliveryFeeUZS ?? rec.feeUZS ?? 0) || 0;
  const rawFee = Number(sh.deliveryRawFeeUZS ?? rec.rawFeeUZS ?? deliveryFee) || 0;
  const isFree = Boolean(sh.deliveryIsFree ?? rec.isFree ?? (deliveryFee === 0 && rawFee > 0));
  const freeFrom = sh.deliveryFreeFromUZS ?? rec.freeFromUZS ?? null;
  const productsTotal = Number(o.productsTotalUZS ?? o.pricing?.subtotalUZS ?? sh.productsTotalUZS ?? q.orderTotalUZS ?? 0) || 0;
  const total = Number(o.totalUZS ?? o.pricing?.totalUZS ?? q.totalWithDeliveryUZS ?? 0) || 0;
  const eta = sh.etaText || rec.etaText || "";
  const pickupPoint = sh.pickupPoint && typeof sh.pickupPoint === "object" ? sh.pickupPoint : {};
  const postalCode = sh.postalCode || pickupPoint.postalCode || "";
  const workingHours = sh.workingHours || pickupPoint.workingHours || "";

  const feeText = isFree ? `Bepul${rawFee ? ` (asl narx: ${fmtMoneyLine(rawFee)})` : ""}` : fmtMoneyLine(deliveryFee);
  const lines = [
    `<b>🚚 Yetkazib berish:</b>`,
    `Tanlangan xizmat: <b>${tgEscape(label)}</b>`,
    service ? `Xizmat turi: <b>${tgEscape(serviceName(service, service))}</b>` : "",
    distanceKm != null ? `Do‘kondan masofa: <b>${tgEscape(fmtKm(distanceKm))}</b>${billedKm ? ` (hisob: ${tgEscape(String(billedKm))} km)` : ""}` : "",
    weightKg > 0 ? `Umumiy og‘irlik: <b>${tgEscape(fmtKg(weightKg))}</b>${billedKg ? ` (pochta hisobi: ${tgEscape(String(billedKg))} kg)` : ""}` : "",
    `Yetkazish narxi: <b>${tgEscape(feeText)}</b>`,
    freeFrom ? `Bepul yetkazish limiti: <b>${fmtMoneyLine(freeFrom)}</b>` : "",
    eta ? `Taxminiy muddat: <b>${tgEscape(eta)}</b>` : "",
    postalCode ? `Pochta indeksi: <b>${tgEscape(postalCode)}</b>` : "",
    workingHours ? `Punkt ishlash vaqti: <b>${tgEscape(workingHours)}</b>` : "",
    productsTotal ? `Mahsulotlar summasi: <b>${fmtMoneyLine(productsTotal)}</b>` : "",
    total ? `Yetkazish bilan jami: <b>${fmtMoneyLine(total)}</b>` : "",
  ].filter(Boolean);

  const opts = Array.isArray(q.options) ? q.options : [];
  if(opts.length){
    lines.push(`<b>Variantlar solishtiruvi:</b>`);
    opts.slice(0, 4).forEach(opt=>{
      const t = fmtDeliveryOption(opt);
      if(t) lines.push(t);
    });
  }
  return lines;
}

function getOrderCoords(o){
  const sh = o && o.shipping ? o.shipping : {};
  const latRaw = sh.lat ?? sh.latitude ?? o.lat ?? o.latitude;
  const lngRaw = sh.lng ?? sh.lon ?? sh.longitude ?? o.lng ?? o.lon ?? o.longitude;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const mapUrl = sh.mapUrl || `https://maps.google.com/?q=${lat},${lng}`;
  return { lat, lng, text, mapUrl };
}

function buildOrderInlineKeyboard(o, opts={}){
  const c = getOrderCoords(o);
  const includeAdminActions = opts.includeAdminActions === true;
  const orderId = String(opts.orderId || o.orderId || o.id || "").trim();
  const isDelivered = String(o.status || "").toLowerCase() === "delivered" || String(o.status || "").toLowerCase() === "completed";
  const legacyNoCopy = opts.legacyNoCopy === true;

  const keyboard = [];

  if(includeAdminActions && orderId){
    keyboard.push([{
      text: isDelivered ? "🟢 YETKAZILDI" : "🔴 YANGI",
      callback_data: isDelivered ? `om_done:${orderId}` : `om_delivered:${orderId}`
    }]);
  }

  if(c){
    // copy_text is very convenient, but older Telegram gateways may reject it on editMessageReplyMarkup.
    // In fallback mode we remove this row so the status button can still update reliably.
    if(!legacyNoCopy){
      keyboard.push([{ text: "📋 Koordinatani copy qilish", copy_text: { text: c.text } }]);
    }
    if(c.mapUrl){
      keyboard.push([{ text: "🗺 Xaritada ochish", url: c.mapUrl }]);
    }
  }

  return keyboard.length ? { inline_keyboard: keyboard } : null;
}

async function tgApi(botToken, method, payload){
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || data.ok !== true){
    const err = data && data.description ? data.description : `telegram_http_${res.status}`;
    throw new Error(err);
  }
  return data;
}


function getRequestOrigin(event){
  const h = event.headers || {};
  const host = h["x-forwarded-host"] || h["X-Forwarded-Host"] || h.host || h.Host || "";
  const proto = h["x-forwarded-proto"] || h["X-Forwarded-Proto"] || "https";
  if(!host) return "";
  return `${proto}://${host}`;
}

async function ensureTelegramWebhook(botToken, event){
  // Telegram callback buttons work only when the bot has a webhook (or a polling backend).
  // This project is Netlify-only, so we auto-connect the bot webhook to this function
  // whenever a new admin order notification is sent.
  const origin = getRequestOrigin(event);
  if(!origin) return false;
  const url = `${origin.replace(/\/$/, "")}/.netlify/functions/telegram`;
  try{
    await tgApi(botToken, "setWebhook", {
      url,
      allowed_updates: ["callback_query"],
      drop_pending_updates: false,
    });
    return true;
  }catch(_e){
    // Do not block order notification if webhook registration fails.
    return false;
  }
}

function getCallbackAction(data){
  const s = String(data || "");
  let m = s.match(/^om_delivered:(.+)$/);
  if(m) return { action:"deliver", orderId:m[1] };
  m = s.match(/^om_done:(.+)$/);
  if(m) return { action:"done", orderId:m[1] };
  return { action:"", orderId:"" };
}
function getCallbackOrderId(data){
  return getCallbackAction(data).orderId || "";
}

async function handleTelegramCallback(event, body){
  const botToken = (process.env.ORDER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "").trim();
  const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
  if(botToken.length < 10 || adminChatId.length < 3){
    return json(500, { ok:false, error:"telegram_env_missing" });
  }

  const q = body.callback_query || {};
  const data = String(q.data || "");
  const cb = getCallbackAction(data);
  const orderId = cb.orderId || "";
  const callbackId = String(q.id || "");
  const message = q.message || {};
  const chatId = message.chat && message.chat.id != null ? String(message.chat.id) : "";

  if(chatId !== String(adminChatId)){
    if(callbackId){
      try{ await tgApi(botToken, "answerCallbackQuery", { callback_query_id: callbackId, text: "Bu amal faqat admin uchun.", show_alert: true }); }catch(_e){}
    }
    return json(403, { ok:false, error:"forbidden_chat" });
  }

  if(!orderId){
    if(callbackId){
      try{ await tgApi(botToken, "answerCallbackQuery", { callback_query_id: callbackId, text: "Bu tugma hozir faol emas.", show_alert: false }); }catch(_e){}
    }
    return json(200, { ok:true, ignored:true });
  }

  if(cb.action === "done"){
    if(callbackId){
      try{ await tgApi(botToken, "answerCallbackQuery", { callback_query_id: callbackId, text: "🟢 Bu buyurtma allaqachon YETKAZILDI", show_alert: false }); }catch(_e){}
    }
    return json(200, { ok:true, done:true, orderId });
  }

  initFirebase();
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if(!snap.exists){
    if(callbackId){
      try{ await tgApi(botToken, "answerCallbackQuery", { callback_query_id: callbackId, text: "Buyurtma topilmadi.", show_alert: true }); }catch(_e){}
    }
    return json(404, { ok:false, error:"order_not_found" });
  }

  await orderRef.set({
    status: "delivered",
    deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    telegramDeliveredBy: {
      id: q.from && q.from.id ? String(q.from.id) : "",
      username: q.from && q.from.username ? String(q.from.username) : "",
      firstName: q.from && q.from.first_name ? String(q.from.first_name) : "",
    }
  }, { merge:true });

  const updated = { ...(snap.data() || {}), id: orderId, orderId, status:"delivered" };
  const replyMarkup = buildOrderInlineKeyboard(updated, { includeAdminActions:true, orderId });

  if(callbackId){
    await tgApi(botToken, "answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "🟢 Buyurtma YETKAZILDI",
      show_alert: false
    });
  }

  if(message.message_id){
    try{
      await tgApi(botToken, "editMessageReplyMarkup", {
        chat_id: adminChatId,
        message_id: message.message_id,
        reply_markup: replyMarkup
      });
    }catch(_e){
      // If Telegram rejects copy_text while editing, retry with a legacy keyboard.
      try{
        const legacyMarkup = buildOrderInlineKeyboard(updated, { includeAdminActions:true, orderId, legacyNoCopy:true });
        await tgApi(botToken, "editMessageReplyMarkup", {
          chat_id: adminChatId,
          message_id: message.message_id,
          reply_markup: legacyMarkup
        });
      }catch(_e2){}
    }
  }

  return json(200, { ok:true, orderId, status:"delivered" });
}

function buildOrderCreatedHTML(o){
  const items = Array.isArray(o.items) ? o.items : [];
  const itemLines = items.slice(0, 8).map((it)=>{
    const title = tgEscape(it.title || it.name || it.productTitle || "Mahsulot");
    const qty = Number(it.qty || it.count || 1) || 1;
    const sku = tgEscape(it.sku || it.variantKey || it.key || "");
    const price = Number(it.priceUZS || it.price || it.unitPriceUZS || 0) || 0;
    const lineTotal = Number(it.lineTotalUZS || (price * qty) || 0) || 0;
    const w = Number(it.lineWeightKg || 0) || (Number(it.weightKg || 0) * qty);
    const variant = [it.color, it.size].filter(Boolean).map(tgEscape).join(" / ");
    const tailParts = [
      sku ? `<code>${sku}</code>` : "",
      variant ? `variant: ${variant}` : "",
      price ? `${fmtUZS(price)} so'm` : "",
      lineTotal ? `jami: ${fmtUZS(lineTotal)} so'm` : "",
      w ? `vazn: ${tgEscape(fmtKg(w))}` : ""
    ].filter(Boolean);
    return `• ${title} ×${qty}${tailParts.length ? ` <i>(${tailParts.join(" · ")})</i>` : ""}`;
  });
  const more = items.length > 8 ? `<i>... yana ${items.length-8} ta</i>` : "";
  const addr = o.shipping && o.shipping.addressText ? tgEscape(o.shipping.addressText) : "";
  const coords = getOrderCoords(o);
  const pay = tgEscape(o.provider || "");
  const sum = fmtUZS(o.totalUZS || o.pricing?.totalUZS || 0);
  const deliveryLines = buildDeliveryDetailsHTML(o);

  return [
    `<b>🛒 Yangi buyurtma!</b>`,
    `Buyurtma ID: <code>${tgEscape(o.orderId || o.id || "")}</code>`,
    o.uid ? `UID: <code>${tgEscape(o.uid)}</code>` : "",
    o.numericId ? `User ID: <b>${tgEscape(o.numericId)}</b>` : "",
    publicCustomerName(o) ? `Ism: <b>${tgEscape(publicCustomerName(o))}</b>` : "",
    o.userPhone ? `Tel: <b>${tgEscape(o.userPhone)}</b>` : "",
    (o.region || o.shipping?.region) ? `Viloyat: <b>${tgEscape(o.region || o.shipping?.region)}</b>` : "",
    (o.district || o.shipping?.district) ? `Tuman: <b>${tgEscape(o.district || o.shipping?.district)}</b>` : "",
    (o.post || o.shipping?.post) ? `Pochta: <b>${tgEscape(o.post || o.shipping?.post)}</b>` : "",
    pay ? `To'lov: <b>${pay}</b>` : "",
    `Umumiy summa: <b>${sum} so'm</b>`,
    addr ? `Manzil: <i>${addr}</i>` : "",
    coords ? `Koordinata: <code>${tgEscape(coords.text)}</code>` : "",
    "",
    ...deliveryLines,
    "",
    `<b>📦 Mahsulotlar:</b>`,
    ...itemLines,
    more,
  ].filter(Boolean).join("\n");
}

async function sendTelegram(botToken, chatId, html, replyMarkup=null){
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if(replyMarkup) payload.reply_markup = replyMarkup;

  let res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = await res.json().catch(()=>null);

  // Fallback for older Telegram Bot API gateways that may not support copy_text yet.
  if((!res.ok || !data || data.ok !== true) && replyMarkup){
    delete payload.reply_markup;
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    data = await res.json().catch(()=>null);
  }

  if(!res.ok || !data || data.ok !== true){
    const err = data && data.description ? data.description : `telegram_http_${res.status}`;
    throw new Error(err);
  }
  return data.result || true;
}

exports.handler = async (event) => {
  try{
    if ((event.httpMethod || "").toUpperCase() !== "POST") {
      return json(405, { ok:false, error:"Method Not Allowed" });
    }

    const body = parseBody(event) || {};
    if(body && body.callback_query){
      return await handleTelegramCallback(event, body);
    }
    const ev = String(body.event || "");
    const orderId = String(body.orderId || "").trim();
    if (ev !== "order_created" || orderId.length < 3) {
      return json(400, { ok:false, error:"bad_request" });
    }

    const token = getBearer(event);
    if(!token) return json(401, { ok:false, error:"missing_token" });

    initFirebase();
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded && decoded.uid ? String(decoded.uid) : "";
    if(!uid) return json(401, { ok:false, error:"invalid_token" });

    const botToken = (process.env.ORDER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "").trim();
    const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
    if(botToken.length < 10 || adminChatId.length < 3){
      return json(500, { ok:false, error:"telegram_env_missing" });
    }

    // Auto-enable Telegram inline button callbacks for this Netlify deployment.
    await ensureTelegramWebhook(botToken, event);

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if(!orderSnap.exists) return json(404, { ok:false, error:"order_not_found" });
    const o = orderSnap.data() || {};

    // Only allow caller to notify about THEIR order
    if(String(o.uid||"") !== uid) return json(403, { ok:false, error:"forbidden" });

    // Deduplicate: one message per uid+orderId+event
    const logRef = db.collection("telegram_logs").doc(`${uid}_${orderId}_${ev}`);
    let already = false;
    await db.runTransaction(async (t)=>{
      const s = await t.get(logRef);
      if(s.exists){ already = true; return; }
      t.set(logRef, { uid, orderId, event: ev, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    if(already){
      return json(200, { ok:true, dedup:true });
    }

    // Build html server-side (ignore any client-provided html)
    const orderForMessage = { ...o, orderId };
    const html = buildOrderCreatedHTML(orderForMessage);
    const replyMarkup = buildOrderInlineKeyboard(orderForMessage, { includeAdminActions:true, orderId });

    // Send admin notification
    await sendTelegram(botToken, adminChatId.trim(), html, replyMarkup);

    // Optional: send user notification if their chat id exists in profile/order
    const userChatId = String(o.userTgChatId || o.telegramChatId || o.tgChatId || "").trim();
    if(userChatId.length >= 3){
      try{ await sendTelegram(botToken, userChatId, html, buildOrderInlineKeyboard(orderForMessage, { includeAdminActions:false, orderId })); }catch(_e){}
    }

    return json(200, { ok:true });
  }catch(e){
    return json(500, { ok:false, error: String(e && e.message ? e.message : e) });
  }
};
