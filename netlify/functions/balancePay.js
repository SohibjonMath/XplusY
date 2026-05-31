// netlify/functions/balancePay.js
// Robust balance checkout for OrzuMall
const admin = require("firebase-admin");
const { pushNewOrder } = require('./_adminPush');
const { pushOrderUpdate } = require('./_customerPush');

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
  return typeof id === "string" && id.length >= 1 && id.length <= 128 && !id.includes("/");
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isInteger(x)) return null;
  if (x < min || x > max) return null;
  return x;
}

function parsePrice(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null) return 0;
  const digits = String(v).replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits.slice(0, 12), 10);
  return Number.isFinite(n) ? n : 0;
}

function firstPrice(...vals) {
  for (const v of vals) {
    const n = parsePrice(v);
    if (n > 0) return n;
  }
  return 0;
}

function pickVariantPrice(product, item) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return 0;
  const color = (item?.color ?? "").toString() || null;
  const size = (item?.size ?? "").toString() || null;
  const same = (a, b) => (a ?? null) === (b ?? null);
  const candidates = [
    variants.find(v => same(v?.color, color) && same(v?.size, size)),
    variants.find(v => same(v?.color, color)),
    variants.find(v => same(v?.size, size)),
    variants[0]
  ].filter(Boolean);
  for (const v of candidates) {
    const n = firstPrice(v?.priceUZS, v?.currentPriceUZS, v?.price, v?.salePrice, v?.newPrice);
    if (n > 0) return n;
  }
  return 0;
}

function buildShortOrderId(len = 6) {
  const max = 10 ** len;
  const n = Math.floor(Math.random() * (max - 1)) + 1;
  return String(n).padStart(len, "0");
}

async function allocateUniqueOrderId(db) {
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

function cleanPublicName(v) {
  const s = String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  return !s || s.includes("@") ? "" : s;
}
function publicCustomerName(user = {}, decoded = {}) {
  const full = [cleanPublicName(user.firstName), cleanPublicName(user.lastName)].filter(Boolean).join(" ").trim();
  return full || cleanPublicName(user.name) || cleanPublicName(user.fullName) || cleanPublicName(decoded.name) || "Mijoz";
}

function getBalance(u) {
  return firstPrice(u?.balanceUZS, u?.balance, u?.walletUZS, u?.wallet, 0);
}

function parseDeliveryFee(shipping) {
  if (!shipping || typeof shipping !== "object") return 0;
  const n = parsePrice(shipping.deliveryFeeUZS ?? shipping.feeUZS ?? shipping.delivery?.feeUZS ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 500000);
}

exports.handler = async (event) => {
  try {
    initAdmin();
    const db = admin.firestore();

    if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

    const token = getBearerToken(event);
    if (!token) return json(401, { ok: false, error: "Unauthorized (no token)" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return json(401, { ok: false, error: "Unauthorized (bad token)" });
    }

    const uid = decoded.uid;
    const email = decoded.email || null;

    let body = {};
    try { body = event.body ? JSON.parse(event.body) : {}; }
    catch { return json(400, { ok: false, error: "Invalid JSON" }); }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length < 1 || rawItems.length > 80) {
      return json(400, { ok: false, error: "items: 1..80 bo‘lishi kerak" });
    }

    const normalized = [];
    for (const it of rawItems) {
      const productId = (it?.productId || it?.id || "").toString();
      const qty = clampInt(it?.qty ?? it?.count ?? 1, 1, 999);
      if (!isSafeId(productId) || qty == null) {
        return json(400, { ok: false, error: "items format xato (productId/qty)", debug: { productId, qty: it?.qty } });
      }
      normalized.push({ ...it, productId, qty });
    }

    const productCache = new Map();
    const lines = [];
    let subtotalUZS = 0;

    for (const item of normalized) {
      let product = null;
      try {
        if (!productCache.has(item.productId)) {
          const snap = await db.doc(`products/${item.productId}`).get();
          productCache.set(item.productId, snap.exists ? (snap.data() || {}) : null);
        }
        product = productCache.get(item.productId);
      } catch (_) {
        product = null;
      }

      if (product && ["rejected", "deleted", "inactive", "blocked"].includes(String(product.status || "").toLowerCase())) {
        return json(403, { ok: false, error: `Mahsulot faol emas: ${item.productId}` });
      }

      const variantPrice = product ? pickVariantPrice(product, item) : 0;
      const serverPrice = product ? firstPrice(
        variantPrice,
        product.priceUZS,
        product.currentPriceUZS,
        product.price,
        product.salePrice,
        product.newPrice,
        product.basePrice,
        product.amount
      ) : 0;
      const clientPrice = firstPrice(item.priceUZS, item.price, item.unitPriceUZS, item.currentPriceUZS);
      const unitPriceUZS = serverPrice || clientPrice;

      if (!Number.isFinite(unitPriceUZS) || unitPriceUZS <= 0) {
        return json(400, { ok: false, error: `Narx topilmadi: ${item.productId}`, debug: { clientPrice, hasProduct: !!product } });
      }

      const lineTotal = unitPriceUZS * item.qty;
      subtotalUZS += lineTotal;
      const weightKg = Number(product?.weightKg ?? product?.weight ?? item.weightKg ?? 0) || 0;

      lines.push({
        productId: item.productId,
        id: item.productId,
        name: String(product?.name || product?.title || item.name || item.title || "Mahsulot").slice(0, 160),
        title: String(product?.title || product?.name || item.name || item.title || "Mahsulot").slice(0, 160),
        color: item.color || null,
        size: item.size || null,
        qty: item.qty,
        priceUZS: unitPriceUZS,
        unitPriceUZS,
        lineTotalUZS: lineTotal,
        weightKg,
        lineWeightKg: weightKg * item.qty,
        image: item.image || product?.image || product?.imageUrl || null,
        fulfillmentType: item.fulfillmentType || product?.fulfillmentType || "stock",
        deliveryMinDays: item.deliveryMinDays ?? product?.deliveryMinDays ?? null,
        deliveryMaxDays: item.deliveryMaxDays ?? product?.deliveryMaxDays ?? null,
        prepayRequired: item.prepayRequired ?? product?.prepayRequired ?? false,
      });
    }

    const shipping = body.shipping && typeof body.shipping === "object" ? body.shipping : null;
    const deliveryFeeUZS = parseDeliveryFee(shipping);
    let totalUZS = subtotalUZS + deliveryFeeUZS;
    const clientTotal = parsePrice(body.totalUZS);
    // Keep client total only when it matches subtotal + delivery fee reasonably.
    if (clientTotal > 0 && Math.abs(clientTotal - totalUZS) <= Math.max(3000, totalUZS * 0.08)) {
      totalUZS = clientTotal;
    }
    if (!Number.isFinite(totalUZS) || totalUZS <= 0) {
      return json(400, { ok: false, error: "totalUZS xato" });
    }

    const note = (typeof body.note === "string" && body.note.length <= 500) ? body.note.trim() : "";

    const userRef = db.doc(`users/${uid}`);
    const orderId = await allocateUniqueOrderId(db);
    const orderRef = db.doc(`orders/${orderId}`);

    const result = await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new Error("USER_NOT_FOUND");
      const u = uSnap.data() || {};
      const balance = getBalance(u);

      if (balance < totalUZS) {
        return { ok: false, code: "INSUFFICIENT_BALANCE", balance, need: totalUZS - balance };
      }

      const newBalance = balance - totalUZS;
      const now = admin.firestore.FieldValue.serverTimestamp();

      const userName = publicCustomerName(u, decoded);
      const userPhone = (u.phone || u.phoneNumber || u.tel || "").toString();
      const numericId = (u.numericId != null ? String(u.numericId) : null);
      let shippingFinal = shipping;
      if (!shippingFinal) {
        const region = (u.region || "").toString();
        const district = (u.district || "").toString();
        const post = (u.post || "").toString();
        shippingFinal = { region, district, post, addressText: [region, district, post].filter(Boolean).join(" / ") };
      }

      tx.set(userRef, {
        balanceUZS: newBalance,
        balance: newBalance,
        updatedAt: now,
      }, { merge: true });

      tx.set(orderRef, {
        id: orderId,
        orderId,
        uid,
        email,
        numericId,
        userName,
        userPhone,
        userTgChatId: (u.telegramChatId || u.tgChatId || "").toString().trim() || null,
        firstName: (u.firstName || "").toString() || null,
        lastName: (u.lastName || "").toString() || null,
        region: (u.region || "").toString() || null,
        district: (u.district || "").toString() || null,
        post: (u.post || "").toString() || null,
        provider: "balance",
        status: "new",
        paymentStatus: "paid",
        statusActor: "system",
        statusUpdatedAt: now,
        statusHistory: [{ status: "new", action: "created", actorType: "system", actorName: "OrzuMall", reason: "Buyurtma qabul qilindi va balansdan to‘landi", at: admin.firestore.Timestamp.now() }],
        currency: "UZS",
        totalUZS,
        productsTotalUZS: subtotalUZS,
        deliveryFeeUZS,
        amountTiyin: null,
        shipping: shippingFinal,
        orderType: "checkout",
        items: lines,
        pricing: {
          subtotalUZS,
          deliveryFeeUZS,
          discountUZS: 0,
          totalUZS,
        },
        note,
        source: "web",
        createdAt: now,
        paidAt: now,
        client: {
          ua: event.headers?.["user-agent"] || event.headers?.["User-Agent"] || null,
          ip: event.headers?.["x-nf-client-connection-ip"] || event.headers?.["x-forwarded-for"] || null,
        },
      }, { merge: true });

      return { ok: true, balance: newBalance, userName };
    });

    if (!result.ok && result.code === "INSUFFICIENT_BALANCE") {
      return json(402, { ok: false, error: "insufficient_balance", balanceUZS: result.balance, needUZS: result.need });
    }

    // Native Android admin push. Payment success must not depend on push delivery.
    await pushNewOrder(db, { id: orderId, orderId, totalUZS, userName: result.userName || 'Mijoz' }).catch(err => console.warn('admin push skipped:', err?.message || err));
    await pushOrderUpdate(db, decoded.uid, orderId, 'Buyurtmangiz qabul qilindi', `#${orderId} buyurtma balans orqali qabul qilindi. Holati: Yangi.`).catch(err => console.warn('customer push skipped:', err?.message || err));
    return json(200, { ok: true, orderId, totalUZS, balanceUZS: result.balance });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg === "USER_NOT_FOUND") return json(404, { ok: false, error: "User topilmadi" });
    console.error("balancePay fatal:", e);
    return json(500, { ok: false, error: "Server xatosi", detail: msg.slice(0, 200) });
  }
};
