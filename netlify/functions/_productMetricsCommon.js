const admin = require('firebase-admin');
const crypto = require('crypto');

function text(v, max = 180) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function safeId(v) {
  return text(v, 128).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}
function metricNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function maxMetric(...values) {
  return values.reduce((m, v) => Math.max(m, metricNum(v)), 0);
}
function calculatedScore(m = {}) {
  return metricNum(m.views) + metricNum(m.favoriteAdds) * 4 + metricNum(m.cartAdds) * 7 + metricNum(m.purchases) * 25;
}
function metricsFrom(product = {}, metric = {}) {
  const out = {
    views: maxMetric(product.views, product.viewCount, product.viewsCount, product.productViews, product.popularViews, metric.views),
    cartAdds: maxMetric(product.cartAdds, product.cartAddCount, product.addToCartCount, metric.cartAdds),
    favoriteAdds: maxMetric(product.favoriteAdds, product.favorites, product.favoriteCount, product.wishlistAdds, metric.favoriteAdds),
    purchases: maxMetric(product.purchases, product.purchaseCount, product.soldCount, product.salesCount, metric.purchases),
  };
  out.score = Math.max(
    calculatedScore(out),
    maxMetric(product.popularScore, product.metricScore, product.engagementScore, product.score, metric.score)
  );
  return out;
}
function metaFor(type) {
  const t = text(type, 40).toLowerCase();
  if (t === 'view' || t === 'views' || t === 'open') return { type: 'view', field: 'views', weight: 1, bucketMs: 30 * 60 * 1000 };
  if (t === 'favorite' || t === 'fav' || t === 'wishlist') return { type: 'favorite', field: 'favoriteAdds', weight: 4, bucketMs: 3650 * 24 * 60 * 60 * 1000 };
  if (t === 'add_to_cart' || t === 'cart' || t === 'cart_add') return { type: 'add_to_cart', field: 'cartAdds', weight: 7, bucketMs: 5 * 60 * 1000 };
  if (t === 'purchase' || t === 'buy' || t === 'order') return { type: 'purchase', field: 'purchases', weight: 25, bucketMs: 0 };
  return null;
}
function hash(v) {
  return crypto.createHash('sha256').update(String(v || '')).digest('hex');
}
function metricEventId({ productId, type, actorKey, orderId = '', now = Date.now() }) {
  const meta = metaFor(type);
  if (!meta) return '';
  let bucket = '';
  if (meta.type === 'purchase') bucket = `order:${text(orderId, 160)}`;
  else if (meta.type === 'favorite') bucket = 'ever';
  else bucket = String(Math.floor(now / meta.bucketMs));
  return hash(`${safeId(productId)}|${meta.type}|${hash(actorKey)}|${bucket}`).slice(0, 56);
}
function publicMetrics(m = {}) {
  const out = {
    views: metricNum(m.views),
    cartAdds: metricNum(m.cartAdds),
    favoriteAdds: metricNum(m.favoriteAdds),
    purchases: metricNum(m.purchases),
  };
  out.score = Math.max(metricNum(m.score), calculatedScore(out));
  return out;
}
async function recordInteraction(db, { productId, type, qty = 1, actorKey = '', orderId = '', source = 'web' } = {}) {
  const id = safeId(productId);
  const meta = metaFor(type);
  const n = Math.max(1, Math.min(99, Math.round(Number(qty) || 1)));
  if (!id || !meta) throw new Error('interaction_invalid');
  if (meta.type === 'purchase' && !text(orderId, 160)) throw new Error('purchase_order_required');
  const actor = text(actorKey, 500) || 'anonymous';
  const eventId = metricEventId({ productId: id, type: meta.type, actorKey: actor, orderId });
  const productRef = db.doc(`products/${id}`);
  const metricRef = db.doc(`productMetrics/${id}`);
  const eventRef = db.doc(`productMetricEvents/${eventId}`);
  return db.runTransaction(async tx => {
    const [productSnap, metricSnap, eventSnap] = await Promise.all([
      tx.get(productRef), tx.get(metricRef), tx.get(eventRef)
    ]);
    if (!productSnap.exists) throw new Error('product_not_found');
    const product = productSnap.data() || {};
    if (String(product.status || 'approved').toLowerCase() !== 'approved') throw new Error('product_not_approved');
    if (product.isActive === false || product.sellerActive === false) throw new Error('product_inactive');
    const current = metricsFrom(product, metricSnap.exists ? (metricSnap.data() || {}) : {});
    if (eventSnap.exists) return { ok: true, accepted: false, productId: id, metrics: publicMetrics(current), sellerId: safeId(product.sellerId) };
    const next = { ...current };
    next[meta.field] = metricNum(next[meta.field]) + n;
    next.score = Math.max(metricNum(current.score) + meta.weight * n, calculatedScore(next));
    const now = admin.firestore.FieldValue.serverTimestamp();
    const mirror = {
      views: next.views,
      viewsCount: next.views,
      cartAdds: next.cartAdds,
      favoriteAdds: next.favoriteAdds,
      purchases: next.purchases,
      soldCount: next.purchases,
      metricScore: next.score,
      engagementScore: next.score,
      popularScore: next.score,
      popularityUpdatedAt: now,
    };
    // Product updatedAt is intentionally untouched: popularity events must not reorder the catalog.
    tx.set(metricRef, { ...mirror, productId: id, updatedAt: now }, { merge: true });
    tx.set(productRef, mirror, { merge: true });
    tx.create(eventRef, {
      productId: id,
      type: meta.type,
      qty: n,
      weight: meta.weight,
      actorHash: hash(actor).slice(0, 40),
      orderId: text(orderId, 160) || null,
      source: text(source, 80),
      createdAt: now,
    });
    return { ok: true, accepted: true, productId: id, metrics: publicMetrics(next), sellerId: safeId(product.sellerId) };
  });
}
async function syncSellerStores(db, sellerIds = []) {
  const ids = [...new Set((sellerIds || []).map(safeId).filter(Boolean))];
  if (!ids.length) return;
  const C = require('./_sellerCommon');
  for (const id of ids) {
    await C.syncSellerPopularity(db, id, { syncProducts: true }).catch(() => {});
  }
}
async function recordPurchaseMetrics(db, lines = [], orderId = '') {
  const grouped = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    const productId = safeId(line?.productId || line?.id);
    if (!productId) continue;
    grouped.set(productId, (grouped.get(productId) || 0) + Math.max(1, Math.round(Number(line?.qty || line?.count || 1) || 1)));
  }
  const sellers = new Set();
  for (const [productId, qty] of grouped.entries()) {
    const out = await recordInteraction(db, {
      productId,
      type: 'purchase',
      qty,
      actorKey: `order:${text(orderId, 160)}`,
      orderId,
      source: 'server_checkout',
    }).catch(() => null);
    if (out?.sellerId) sellers.add(out.sellerId);
  }
  await syncSellerStores(db, [...sellers]);
}

module.exports = { text, safeId, metricNum, maxMetric, calculatedScore, metricsFrom, metaFor, publicMetrics, recordInteraction, recordPurchaseMetrics, syncSellerStores };
