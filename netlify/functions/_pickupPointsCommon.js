// Shared pickup-point tariff validation for checkout Netlify functions.
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeText(v, max = 220) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

function normalizePickupPoint(p, index = 0) {
  if (!p || typeof p !== "object") return null;
  const lat = Number(p.lat ?? p.latitude);
  const lng = Number(p.lng ?? p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const minDays = Math.max(1, Math.round(num(p.minDays ?? p.deliveryMinDays, 2)));
  const maxDays = Math.max(minDays, Math.round(num(p.maxDays ?? p.deliveryMaxDays, minDays)));
  const id = safeText(p.id || `point_${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    id,
    name: safeText(p.name || p.title || `Topshirish punkti ${index + 1}`, 160),
    address: safeText(p.address || p.addressText || "", 320),
    lat,
    lng,
    firstKgFeeUZS: Math.max(0, Math.round(num(p.firstKgFeeUZS ?? p.firstKgFee, 0))),
    extraKgFeeUZS: Math.max(0, Math.round(num(p.extraKgFeeUZS ?? p.extraKgFee, 0))),
    minDays,
    maxDays,
    etaText: safeText(p.etaText || `${minDays}–${maxDays} kun`, 80),
    active: p.active !== false,
  };
}

function calculatePickupQuote(point, totalWeightKg = 0) {
  const billedKg = Math.max(1, Math.ceil(Math.max(0, num(totalWeightKg, 0))));
  const firstKgFeeUZS = Math.max(0, Math.round(num(point?.firstKgFeeUZS, 0)));
  const extraKgFeeUZS = Math.max(0, Math.round(num(point?.extraKgFeeUZS, 0)));
  const feeUZS = firstKgFeeUZS + Math.max(0, billedKg - 1) * extraKgFeeUZS;
  return { billedKg, firstKgFeeUZS, extraKgFeeUZS, feeUZS };
}

function lineWeightKg(item) {
  const line = Number(item?.lineWeightKg);
  if (Number.isFinite(line) && line >= 0) return line;
  const qty = Math.max(1, Number(item?.qty ?? item?.count ?? 1) || 1);
  const kg = Math.max(0, Number(item?.weightKg ?? item?.weight ?? 0) || 0);
  return kg * qty;
}

function sumWeightKg(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + lineWeightKg(item), 0);
}

async function calculateCatalogWeightKg(db, items = []) {
  let total = 0;
  const cache = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const productId = String(item?.productId || item?.id || "");
    const qty = Math.max(1, Number(item?.qty ?? item?.count ?? 1) || 1);
    let product = null;
    if (productId) {
      if (!cache.has(productId)) {
        try {
          const snap = await db.doc(`products/${productId}`).get();
          cache.set(productId, snap.exists ? (snap.data() || {}) : null);
        } catch (_) {
          cache.set(productId, null);
        }
      }
      product = cache.get(productId);
    }
    const serverKg = Number(product?.weightKg ?? product?.weight_kg ?? product?.weight ?? product?.shippingWeightKg);
    const clientKg = Number(item?.weightKg ?? item?.weight ?? 0);
    total += Math.max(0, Number.isFinite(serverKg) ? serverKg : (Number.isFinite(clientKg) ? clientKg : 0)) * qty;
  }
  return total;
}

async function normalizePickupShipping(db, shipping, totalWeightKg = 0) {
  if (!shipping || typeof shipping !== "object") return shipping;
  const method = String(shipping.method || shipping.service || "").toLowerCase();
  if (method !== "pickup_point") return shipping;

  const pickupPointId = safeText(shipping.pickupPointId || shipping.pickupPoint?.id || "", 80);
  if (!pickupPointId) throw new Error("pickup_point_required");

  const snap = await db.doc("configs/pickupPoints").get();
  const raw = snap.exists ? (snap.data()?.points || []) : [];
  const points = (Array.isArray(raw) ? raw : []).map(normalizePickupPoint).filter(Boolean);
  const point = points.find((p) => p.active !== false && String(p.id) === pickupPointId);
  if (!point) throw new Error("pickup_point_not_found");

  const quote = calculatePickupQuote(point, totalWeightKg);
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
  return {
    ...shipping,
    method: "pickup_point",
    methodLabel: "Topshirish punktidan olib ketish",
    service: "pickup_point",
    serviceLabel: `Topshirish punkti — ${point.name}`,
    pickupPointId: point.id,
    pickupPoint: {
      ...point,
      billedKg: quote.billedKg,
      feeUZS: quote.feeUZS,
      mapUrl,
    },
    address: point.address,
    addressText: `${point.name}${point.address ? ` — ${point.address}` : ""}`,
    lat: point.lat,
    lng: point.lng,
    mapUrl,
    totalWeightKg: Math.max(0, num(totalWeightKg, 0)),
    billedKg: quote.billedKg,
    deliveryFeeUZS: quote.feeUZS,
    deliveryRawFeeUZS: quote.feeUZS,
  };
}

module.exports = {
  calculateCatalogWeightKg,
  calculatePickupQuote,
  normalizePickupShipping,
  sumWeightKg,
};
