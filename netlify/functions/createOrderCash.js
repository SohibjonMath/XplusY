// netlify/functions/createOrderCash.js
const admin = require("firebase-admin");
const { pushNewOrder } = require('./_adminPush');
const { pushOrderUpdate } = require('./_customerPush');
const { calculateCatalogWeightKg, normalizePickupShipping } = require('./_pickupPointsCommon');

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_B64");
  const json = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(json);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function getBearerToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isSafeId(id) {
  return typeof id === "string" && id.length >= 2 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isInteger(x)) return null;
  if (x < min || x > max) return null;
  return x;
}


function cleanPublicName(v) {
  const s = String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  return !s || s.includes("@") ? "" : s;
}
function publicCustomerName(user = {}, decoded = {}) {
  const full = [cleanPublicName(user.firstName), cleanPublicName(user.lastName)].filter(Boolean).join(" ").trim();
  return full || cleanPublicName(user.name) || cleanPublicName(user.fullName) || cleanPublicName(decoded.name) || "Mijoz";
}

function buildShortOrderId(len = 6) {
  const max = 10 ** len;
  const n = Math.floor(Math.random() * (max - 1)) + 1;
  return String(n).padStart(len, "0");
}

async function allocateUniqueOrderId(db) {
  // try 6-digit first, then expand
  let len = 6;
  for (;;) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const id = buildShortOrderId(len);
      const ref = db.doc(`orders/${id}`);
      const snap = await ref.get();
      if (!snap.exists) return id;
    }
    len++;
  }
}

exports.handler = async (event) => {
  try {
    initAdmin();
    const db = admin.firestore();

    if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

    // --- Auth ---
    const token = getBearerToken(event);
    if (!token) return json(401, { ok: false, error: "Unauthorized (no token)" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return json(401, { ok: false, error: "Unauthorized (bad token)" });
    }

    const uid = decoded.uid;

    // --- Parse body ---
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON" });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length < 1 || items.length > 80) {
      return json(400, { ok: false, error: "items: 1..80 bo‘lishi kerak" });
    }

    // Minimal item validation (client already builds snapshot; we accept it but sanitize qty)
    const normItems = [];
    for (const it of items) {
      const productId = (it?.productId || it?.id || "").toString();
      const qty = clampInt(it?.qty ?? it?.count ?? 1, 1, 999);
      if (!isSafeId(productId) || qty == null) {
        return json(400, { ok: false, error: "items format xato (productId/qty)" });
      }
      normItems.push({ ...it, productId, qty });
    }

    let totalUZS = Number(body.totalUZS || 0);
    if (!Number.isFinite(totalUZS) || totalUZS <= 0) {
      return json(400, { ok: false, error: "totalUZS xato" });
    }

    let shipping = body.shipping && typeof body.shipping === "object" ? body.shipping : null;
    const clientDeliveryFeeUZS = Math.max(0, Math.min(500000, Number(shipping?.deliveryFeeUZS || body.deliveryFeeUZS || 0) || 0));
    const productsTotalUZS = Math.max(0, Number(body.productsTotalUZS || shipping?.productsTotalUZS || (totalUZS - clientDeliveryFeeUZS)) || 0);
    if (String(shipping?.method || shipping?.service || "").toLowerCase() === "pickup_point") {
      const totalWeightKg = await calculateCatalogWeightKg(db, normItems);
      shipping = await normalizePickupShipping(db, shipping, totalWeightKg);
      totalUZS = productsTotalUZS + Number(shipping?.deliveryFeeUZS || 0);
    }
    const deliveryFeeUZS = Math.max(0, Math.min(500000, Number(shipping?.deliveryFeeUZS || body.deliveryFeeUZS || 0) || 0));

    // --- Pull user fields for nice order record ---
    let userName = publicCustomerName({}, decoded);
    let userPhone = "";
    let numericId = null;
    let userTgChatId = null;
    let firstName = null, lastName = null;

    try {
      const uSnap = await db.doc(`users/${uid}`).get();
      if (uSnap.exists) {
        const u = uSnap.data() || {};
        userName = publicCustomerName(u, decoded);
        userPhone = (u.phone || "").toString();
        numericId = (u.numericId != null ? String(u.numericId) : null);
        userTgChatId = (u.telegramChatId || u.tgChatId || "").toString().trim() || null;
        firstName = (u.firstName || "").toString() || null;
        lastName = (u.lastName || "").toString() || null;
      }
    } catch (_) {}

    const orderId = await allocateUniqueOrderId(db);
    const orderRef = db.doc(`orders/${orderId}`);

    // Profil manzili ishlatilmaydi: mijoz punkt yoki kuryer lokatsiyasini buyurtma paytida tanlaydi.
    const shippingFinal = shipping || { method:"pickup", methodLabel:"Do‘kondan olib ketish", addressText:"Do‘kondan olib ketish", deliveryFeeUZS:0 };

    const now = admin.firestore.FieldValue.serverTimestamp();

    const orderDoc = {
      orderId,
      uid,
      numericId,
      userName,
      userPhone,
      userTgChatId,
      firstName,
      lastName,
      status: "new",
      paymentStatus: "cash_on_delivery",
      statusActor: "system",
      statusUpdatedAt: now,
      statusHistory: [{ status: "new", action: "created", actorType: "system", actorName: "OrzuMall", reason: "Buyurtma qabul qilindi", at: admin.firestore.Timestamp.now() }],
      items: normItems,
      totalUZS,
      productsTotalUZS,
      deliveryFeeUZS,
      amountTiyin: null,
      provider: "cash",
      pricing: { subtotalUZS: productsTotalUZS || Math.max(0, totalUZS - deliveryFeeUZS), deliveryFeeUZS, discountUZS: 0, totalUZS },
      shipping: shippingFinal,
      orderType: "checkout",
      createdAt: now,
      source: "web",
    };

    await orderRef.set(orderDoc, { merge: false });
    // Native Android admin push. Order creation must not fail when push delivery fails.
    await pushNewOrder(db, { id: orderId, ...orderDoc }).catch(err => console.warn('admin push skipped:', err?.message || err));
    await pushOrderUpdate(db, uid, orderId, 'Buyurtmangiz qabul qilindi', `#${orderId} buyurtma qabul qilindi. Holati: Yangi.`).catch(err => console.warn('customer push skipped:', err?.message || err));

    return json(200, { ok: true, orderId });
  } catch (e) {
    return json(500, { ok: false, error: "server_error", detail: String(e && e.message ? e.message : e) });
  }
};
