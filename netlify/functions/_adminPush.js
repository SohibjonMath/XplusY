// Shared native push helper for OrzuMall admin Android app (v56 unified custom voice)
const admin = require('firebase-admin');
function cleanPublicName(v){const s=String(v==null?'':v).trim().replace(/\s+/g,' ');return !s||s.includes('@')?'':s;}
function publicCustomerName(o={}){const full=[cleanPublicName(o.firstName),cleanPublicName(o.lastName)].filter(Boolean).join(' ').trim();return full||cleanPublicName(o.userName)||cleanPublicName(o.name)||'Mijoz';}
const crypto = require('crypto');

function safeText(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}
function orderTitle(order) {
  const id = safeText(order?.orderId || order?.id || '', 64);
  return id ? `Yangi buyurtma #${id}` : 'Yangi buyurtma';
}
function orderBody(order) {
  const who = safeText(publicCustomerName(order), 90);
  const total = Number(order?.totalUZS || 0);
  const amount = Number.isFinite(total) && total > 0 ? `${Math.round(total).toLocaleString('uz-UZ')} so‘m` : '';
  return [who, amount, 'Yig‘ishga olish kerak'].filter(Boolean).join(' • ');
}
async function activeTokens(db) {
  const snap = await db.collection('adminPushTokens').where('active', '==', true).limit(900).get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })).filter(x => x.token);
}
async function cleanupInvalid(db, docs, response) {
  const batch = db.batch();
  let changed = false;
  (response?.responses || []).forEach((r, i) => {
    if (r?.success) return;
    const code = String(r?.error?.code || '');
    if (!/registration-token-not-registered|invalid-registration-token|invalid-argument/i.test(code)) return;
    const id = docs[i]?.id;
    if (!id) return;
    batch.set(db.doc(`adminPushTokens/${id}`), { active: false, disabledAt: admin.firestore.FieldValue.serverTimestamp(), disabledReason: code }, { merge: true });
    changed = true;
  });
  if (changed) await batch.commit();
}
async function sendToAdmins(db, payload = {}) {
  const docs = await activeTokens(db);
  if (!docs.length) return { sent: 0, failed: 0 };
  const title = safeText(payload.title || 'OrzuMall Admin', 120);
  const body = safeText(payload.body || '', 400);
  const data = Object.fromEntries(Object.entries(payload.data || {}).map(([k, v]) => [String(k), safeText(v, 500)]));
  const chunks = [];
  for (let i = 0; i < docs.length; i += 500) chunks.push(docs.slice(i, i + 500));
  let sent = 0, failed = 0;
  for (const chunk of chunks) {
    const result = await admin.messaging().sendEachForMulticast({
      tokens: chunk.map(x => x.token),
      notification: { title, body },
      data: { ...data, title, body },
      android: {
        priority: 'high',
        ttl: 1000 * 60 * 60 * 24,
        notification: {
          channelId: payload.channelId || 'orders_voice_v3',
          sound: 'orzumall_sizga_yangi_xabar_bor',
          priority: 'high',
          defaultVibrateTimings: true,
          clickAction: 'OPEN_ADMIN_ORDERS'
        }
      }
    });
    sent += Number(result.successCount || 0);
    failed += Number(result.failureCount || 0);
    await cleanupInvalid(db, chunk, result).catch(() => {});
  }
  return { sent, failed };
}
async function pushNewOrder(db, order) {
  return sendToAdmins(db, {
    title: orderTitle(order),
    body: orderBody(order),
    channelId: 'orders_voice_v3',
    data: {
      type: 'new_order',
      orderId: safeText(order?.orderId || order?.id || '', 64),
      url: 'https://orzumall.uz/admin-mobile/',
      newCount: '1',
      packingCount: '0'
    }
  });
}
async function pushOrderStateChanged(db, orderId, status) {
  return sendToAdmins(db, {
    title: 'Buyurtma holati yangilandi',
    body: `#${safeText(orderId, 64)} • ${safeText(status, 80)}`,
    channelId: 'updates_voice_v3',
    data: { type: 'order_state_changed', orderId: safeText(orderId, 64), status: safeText(status, 80), url: 'https://orzumall.uz/admin-mobile/' }
  });
}
module.exports = { tokenHash, sendToAdmins, pushNewOrder, pushOrderStateChanged };
