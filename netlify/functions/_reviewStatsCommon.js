const admin = require('firebase-admin');

function safeId(value) {
  const id = String(value || '').trim();
  return id && id.length <= 180 && !id.includes('/') ? id : '';
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function publicStats(raw = {}) {
  const count = Math.max(0, Math.round(num(raw.count ?? raw.reviewsCount ?? raw.ratingCount ?? raw.ratingsCount)));
  const avg = Math.max(0, Math.min(5, num(raw.avg ?? raw.avgRating ?? raw.ratingAvg ?? raw.rating)));
  return { count, avg: count ? Number(avg.toFixed(2)) : 0 };
}
function productStoredStats(product = {}) {
  const stats = publicStats(product.reviewStats || product);
  const hasMaterialized = !!product.reviewStats && Number(product.reviewStats.version) >= 2 && Number.isFinite(Number(product.reviewStats.count));
  return { ...stats, hasMaterialized };
}
async function computeApprovedReviewStats(db, productId, { persist = true } = {}) {
  const id = safeId(productId);
  if (!id) return { productId: '', avg: 0, count: 0 };
  const snap = await db.collection(`products/${id}/reviews`)
    .where('moderationStatus', '==', 'approved')
    .limit(600)
    .get();
  let total = 0;
  let count = 0;
  snap.docs.forEach(doc => {
    const stars = Math.max(0, Math.min(5, num((doc.data() || {}).stars)));
    if (stars > 0) { total += stars; count += 1; }
  });
  const avg = count ? Number((total / count).toFixed(2)) : 0;
  if (persist) {
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.doc(`products/${id}`).set({
      reviewStats: { avg, count, version: 2, updatedAt },
      avgRating: avg,
      ratingAvg: avg,
      ratingCount: count,
      ratingsCount: count,
      reviewsCount: count,
      reviewStatsUpdatedAt: updatedAt,
    }, { merge: true });
  }
  return { productId: id, avg, count };
}
async function runPool(items, worker, concurrency = 8) {
  const list = Array.isArray(items) ? items : [];
  const out = new Array(list.length);
  let cursor = 0;
  async function next() {
    for (;;) {
      const index = cursor++;
      if (index >= list.length) return;
      try { out[index] = await worker(list[index], index); }
      catch (_e) { out[index] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length || 1) }, next));
  return out;
}
async function getReviewStatsForProducts(db, productIds, { refreshMissing = true } = {}) {
  const ids = [...new Set((productIds || []).map(safeId).filter(Boolean))].slice(0, 100);
  if (!ids.length) return [];
  const docs = await db.getAll(...ids.map(id => db.doc(`products/${id}`)));
  const results = new Map();
  const missing = [];
  docs.forEach((snap, index) => {
    const id = ids[index];
    const stored = productStoredStats(snap.exists ? (snap.data() || {}) : {});
    if (!snap.exists) results.set(id, { productId: id, avg: 0, count: 0 });
    else if (stored.hasMaterialized) results.set(id, { productId: id, avg: stored.avg, count: stored.count });
    else if (refreshMissing) missing.push(id);
    else results.set(id, { productId: id, avg: stored.avg, count: stored.count });
  });
  const computed = await runPool(missing, id => computeApprovedReviewStats(db, id, { persist: true }), 8);
  computed.filter(Boolean).forEach(row => results.set(row.productId, row));
  return ids.map(id => results.get(id) || { productId: id, avg: 0, count: 0 });
}
async function refreshReviewStatsForProducts(db, productIds) {
  const ids = [...new Set((productIds || []).map(safeId).filter(Boolean))].slice(0, 180);
  return (await runPool(ids, id => computeApprovedReviewStats(db, id, { persist: true }), 8)).filter(Boolean);
}
module.exports = {
  safeId,
  publicStats,
  productStoredStats,
  computeApprovedReviewStats,
  getReviewStatsForProducts,
  refreshReviewStatsForProducts,
};
