// Shared native push helper for OrzuMall customer Android app (v56 unified custom voice)
const admin = require('firebase-admin');
const crypto = require('crypto');

function safeText(v, max = 600) { return String(v == null ? '' : v).trim().slice(0, max); }
function tokenHash(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function normUid(v) { const s = String(v || '').trim(); return s && s.length <= 180 && !s.includes('/') ? s : ''; }

async function tokenDocsForUid(db, uid) {
  uid = normUid(uid); if (!uid) return [];
  const snap = await db.collection('customerPushTokens').where('uid', '==', uid).limit(120).get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })).filter(x => x.token && x.active !== false);
}
async function allActiveTokens(db) {
  const snap = await db.collection('customerPushTokens').where('active', '==', true).limit(1800).get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })).filter(x => x.token);
}
async function cleanupInvalid(db, docs, response) {
  const batch = db.batch(); let changed = false;
  (response?.responses || []).forEach((r, i) => {
    if (r?.success) return;
    const code = String(r?.error?.code || '');
    if (!/registration-token-not-registered|invalid-registration-token|invalid-argument/i.test(code)) return;
    const id = docs[i]?.id; if (!id) return;
    batch.set(db.doc(`customerPushTokens/${id}`), { active:false, disabledAt:admin.firestore.FieldValue.serverTimestamp(), disabledReason:code }, { merge:true }); changed = true;
  });
  if (changed) await batch.commit();
}
async function sendDocs(db, docs, payload = {}) {
  if (!docs.length) return { sent:0, failed:0 };
  const title = safeText(payload.title || 'OrzuMall', 120);
  const body = safeText(payload.body || 'Siz uchun yangi xabar bor.', 500);
  const data = Object.fromEntries(Object.entries(payload.data || {}).map(([k,v]) => [String(k), safeText(v, 700)]));
  const chunks = []; for (let i=0;i<docs.length;i+=500) chunks.push(docs.slice(i,i+500));
  let sent=0, failed=0;
  for (const chunk of chunks) {
    const result = await admin.messaging().sendEachForMulticast({
      tokens: chunk.map(x => x.token),
      notification:{ title, body },
      data:{ ...data, title, body },
      android:{
        priority: payload.priority || 'high', ttl:1000*60*60*24*3,
        notification:{ channelId:payload.channelId || 'orzumall_general_voice_v3', sound:'orzumall_sizga_yangi_xabar_bor', defaultVibrateTimings:true }
      }
    });
    sent += Number(result.successCount || 0); failed += Number(result.failureCount || 0);
    await cleanupInvalid(db, chunk, result).catch(()=>{});
  }
  return { sent, failed };
}
async function pushToCustomer(db, uid, payload={}) { return sendDocs(db, await tokenDocsForUid(db, uid), payload); }
async function tokenDocsForUids(db, uids=[]) {
  const unique=[...new Set((uids||[]).map(normUid).filter(Boolean))];
  if(!unique.length)return [];
  const docs=[];
  for(let i=0;i<unique.length;i+=30){
    const chunk=unique.slice(i,i+30);
    const snap=await db.collection('customerPushTokens').where('uid','in',chunk).get();
    snap.docs.forEach(d=>{const x={id:d.id,...(d.data()||{})};if(x.token&&x.active!==false)docs.push(x)});
  }
  const seen=new Set();
  return docs.filter(x=>{const k=String(x.id||tokenHash(x.token));if(seen.has(k))return false;seen.add(k);return true});
}
async function pushToCustomers(db, uids=[], payload={}) { return sendDocs(db, await tokenDocsForUids(db,uids), payload); }
async function pushToAllCustomers(db, payload={}) { return sendDocs(db, await allActiveTokens(db), payload); }
async function pushOrderUpdate(db, uid, orderId, title, body, extra={}) {
  return pushToCustomer(db, uid, { title, body, channelId:'orzumall_orders_voice_v3', data:{ type:'order', orderId:safeText(orderId,100), url:'https://orzumall.uz/#profile', ...extra } });
}
module.exports={ safeText, tokenHash, pushToCustomer, pushToCustomers, pushToAllCustomers, pushOrderUpdate };
