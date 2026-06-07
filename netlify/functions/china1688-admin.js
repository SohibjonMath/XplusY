const {
  admin, cleanText, json, parseBody, requireAdmin,
} = require('./_china1688Common');

const allowedStatuses = new Set(['new', 'checking', 'payment_waiting', 'purchased', 'warehouse_cn', 'sent_uz', 'arrived', 'completed', 'cancelled']);
function serialize(doc) {
  const d = doc.data() || {};
  const ts = d.createdAt?.toDate?.() || null;
  const up = d.updatedAt?.toDate?.() || null;
  return { id: doc.id, ...d, createdAt: ts ? ts.toISOString() : null, updatedAt: up ? up.toISOString() : null };
}
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const auth = await requireAdmin(event);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });
  const b = parseBody(event);
  if (!b) return json(400, { error: 'INVALID_JSON' });
  const action = cleanText(b.action, 40);
  const db = admin.firestore();
  try {
    if (action === 'list') {
      const snap = await db.collection('china1688Requests').orderBy('createdAt', 'desc').limit(150).get();
      return json(200, { requests: snap.docs.map(serialize) });
    }
    if (action === 'update') {
      const id = cleanText(b.id, 150);
      const status = cleanText(b.status, 50);
      if (!id || !allowedStatuses.has(status)) return json(400, { error: 'INVALID_UPDATE' });
      await db.collection('china1688Requests').doc(id).set({
        status, adminNote: cleanText(b.adminNote, 700), updatedAt: admin.firestore.Timestamp.now(), updatedBy: auth.email,
      }, { merge: true });
      return json(200, { ok: true });
    }
    return json(400, { error: 'UNKNOWN_ACTION' });
  } catch (e) {
    return json(500, { error: e.message || 'ADMIN_FAILED' });
  }
};
