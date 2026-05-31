// OrzuMall v53 — native Android reminder for the 16:00 marketplace packing cutoff.
// Runs on a Netlify schedule. It reads only open fulfillment statuses to avoid scanning historical orders and custom composite indexes.
const admin = require('firebase-admin');
const { sendToAdmins } = require('./_adminPush');

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent UTC+05:00
const CUTOFF_HOUR = 16;
const OPEN_FULFILLMENT_STATUSES = ['new','paid','packing','processing','pending','pending_cash','pending_payment','shared_telegram','telegram'];

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('Missing env FIREBASE_SERVICE_ACCOUNT_B64');
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
function response(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) };
}
function statusKey(v) {
  const s = String(v || 'new').trim().toLowerCase();
  return ({ pending:'new', pending_cash:'new', pending_payment:'new', shared_telegram:'new', telegram:'new', paid:'new', processing:'packing', shipped:'shipping', completed:'delivered', canceled:'cancelled' }[s] || s || 'new');
}
function latestCutoffMs(now = Date.now()) {
  const d = new Date(now + TZ_OFFSET_MS);
  let cutoff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), CUTOFF_HOUR - 5, 0, 0, 0);
  if (d.getUTCHours() < CUTOFF_HOUR) cutoff -= 24 * 60 * 60 * 1000;
  return cutoff;
}
function cutoffLabel(ms) {
  return new Date(ms).toLocaleString('uz-UZ', { timeZone:'Asia/Tashkent', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function createdAtMs(value) {
  try {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value.seconds) return Number(value.seconds) * 1000;
    return Number(new Date(value)) || 0;
  } catch (_) { return 0; }
}
function itemCount(order) {
  return (Array.isArray(order?.items) ? order.items : []).reduce((sum, item) => sum + Math.max(1, Number(item?.qty ?? item?.quantity ?? item?.count ?? 1) || 1), 0);
}

exports.handler = async () => {
  try {
    initAdmin();
    const db = admin.firestore();
    const cutoffMs = latestCutoffMs();
    const snap = await db.collection('orders').where('status', 'in', OPEN_FULFILLMENT_STATUSES).get();
    const due = snap.docs
      .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(order => ['new','packing'].includes(statusKey(order.status)))
      .filter(order => createdAtMs(order.createdAt) <= cutoffMs);
    if (!due.length) return response(200, { ok:true, sent:0, due:0, cutoff:cutoffLabel(cutoffMs) });

    const newCount = due.filter(order => statusKey(order.status) === 'new').length;
    const packingCount = due.filter(order => statusKey(order.status) === 'packing').length;
    const goods = due.reduce((sum, order) => sum + itemCount(order), 0);
    const result = await sendToAdmins(db, {
      title: '⚠️ 16:00 yig‘im navbati kutmoqda',
      body: `${cutoffLabel(cutoffMs)} gacha tushgan ${due.length} ta buyurtma: yangi ${newCount} ta, yig‘ishda ${packingCount} ta. ${goods} ta tovarni yig‘ib yetkazishga bering.`,
      channelId: 'orders_high',
      data: {
        type: 'packing_cutoff_reminder',
        url: 'https://orzumall.uz/admin-mobile/',
        cutoffMs: String(cutoffMs),
        cutoffLabel: cutoffLabel(cutoffMs),
        dueCount: String(due.length),
        newCount: String(newCount),
        packingCount: String(packingCount),
        itemCount: String(goods)
      }
    });
    return response(200, { ok:true, cutoff:cutoffLabel(cutoffMs), due:due.length, newCount, packingCount, itemCount:goods, ...result });
  } catch (error) {
    console.error('packing-cutoff-reminder failed:', error);
    return response(500, { ok:false, error:String(error?.message || error) });
  }
};
