const admin = require('firebase-admin');

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'POST, OPTIONS',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function initAdmin() {
  if (admin.apps.length) return admin;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_B64');
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

function bearer(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

async function requireUser(event) {
  initAdmin();
  const token = bearer(event);
  if (!token) return { ok: false, statusCode: 401, error: 'Firebase login required' };
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { ok: true, decoded, uid: decoded.uid, email: decoded.email || '' };
  } catch (_e) {
    return { ok: false, statusCode: 401, error: 'Invalid or expired Firebase token' };
  }
}

function normEmail(v) { return String(v || '').trim().toLowerCase(); }
function envAdminEmails() {
  const base = ['sohibjonmath@gmail.com'];
  const more = String(process.env.ADMIN_EMAILS || process.env.ORZUMALL_ADMIN_EMAILS || '')
    .split(/[;,\s]+/).map(normEmail).filter(Boolean);
  return [...new Set([...base.map(normEmail), ...more])];
}
async function requireAdmin(event) {
  const user = await requireUser(event);
  if (!user.ok) return user;
  const db = admin.firestore();
  let fromDb = [];
  try {
    const snap = await db.doc('configs/admins').get();
    fromDb = snap.exists && Array.isArray(snap.data()?.emails) ? snap.data().emails.map(normEmail).filter(Boolean) : [];
  } catch (_e) {}
  const allowed = new Set([...envAdminEmails(), ...fromDb]);
  if (!allowed.has(normEmail(user.email))) return { ok: false, statusCode: 403, error: 'Admin access required' };
  return user;
}

const DEFAULT_SUPPORT_CONFIG = Object.freeze({
  enabled: true,
  deepseekEnabled: true,
  assistantName: 'OrzuMall AI yordamchisi',
  model: 'deepseek-v4-flash',
  apiTimeoutMs: 7500,
  minConfidence: 0.78,
  maxRequestsPerMinute: 12,
  welcomeMessage: 'Assalomu alaykum! Men OrzuMall AI yordamchisiman. Buyurtma, yetkazish, to‘lov va mahsulotlar bo‘yicha savollaringizga tezkor javob beraman. Aniq ma’lumot topilmasa operatorga ulayman.',
  contactText: 'Operator bilan bog‘lanish uchun shu chatga savolingizni yozing. Zarur bo‘lsa murojaat operator navbatiga o‘tkaziladi.',
  workHoursText: 'Operator ish vaqti admin panelda ko‘rsatilmagan. Zarur bo‘lsa murojaatingiz navbatga qoldiriladi.',
  deliveryPolicy: 'Aniq yetkazish narxi savatda tanlangan mahsulotlar, vazn va lokatsiya asosida avtomatik hisoblanadi. Buyurtmani tasdiqlashdan oldin yakuniy summa ko‘rsatiladi.',
  paymentPolicy: 'To‘lov turi buyurtma vaqtida tanlanadi. Saytda naqd to‘lov va balansdan to‘lash variantlari mavjud. Ayrim oldindan to‘lov talab qilinadigan mahsulotlarda balansdan to‘lash majburiy bo‘lishi mumkin.',
  returnsPolicy: 'Qaytarish yoki almashtirish shartlari bo‘yicha aniq ma’lumot admin tomonidan hali kiritilmagan. Operatorga murojaat qoldiring.',
  extraKnowledge: '',
  customFaq: [],
});

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function safeText(v, max = 1200) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeConfig(raw = {}) {
  const out = { ...DEFAULT_SUPPORT_CONFIG, ...(raw && typeof raw === 'object' ? raw : {}) };
  out.enabled = out.enabled !== false;
  out.deepseekEnabled = out.deepseekEnabled !== false;
  out.assistantName = safeText(out.assistantName, 80) || DEFAULT_SUPPORT_CONFIG.assistantName;
  out.model = ['deepseek-v4-flash', 'deepseek-v4-pro'].includes(String(out.model)) ? String(out.model) : DEFAULT_SUPPORT_CONFIG.model;
  out.apiTimeoutMs = Math.round(clampNumber(out.apiTimeoutMs, 2500, 12000, DEFAULT_SUPPORT_CONFIG.apiTimeoutMs));
  out.minConfidence = clampNumber(out.minConfidence, 0.55, 0.98, DEFAULT_SUPPORT_CONFIG.minConfidence);
  out.maxRequestsPerMinute = Math.round(clampNumber(out.maxRequestsPerMinute, 3, 60, DEFAULT_SUPPORT_CONFIG.maxRequestsPerMinute));
  ['welcomeMessage','contactText','workHoursText','deliveryPolicy','paymentPolicy','returnsPolicy','extraKnowledge'].forEach(k => out[k] = safeText(out[k], k === 'extraKnowledge' ? 5000 : 1800));
  out.customFaq = Array.isArray(out.customFaq) ? out.customFaq.slice(0, 80).map(x => ({
    keywords: safeText(x?.keywords, 240),
    answer: safeText(x?.answer, 1400),
  })).filter(x => x.keywords && x.answer) : [];
  return out;
}
async function loadConfig(db) {
  try {
    const snap = await db.doc('configs/support_ai').get();
    return normalizeConfig(snap.exists ? snap.data() : {});
  } catch (_e) { return normalizeConfig({}); }
}

function money(v) {
  const n = Number(v || 0) || 0;
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' so‘m';
}
function toMs(v) {
  try { if (!v) return 0; if (typeof v.toMillis === 'function') return v.toMillis(); if (v.seconds) return Number(v.seconds) * 1000; return Number(new Date(v)) || 0; } catch (_e) { return 0; }
}
function statusLabel(v) {
  const k = String(v || '').toLowerCase();
  return ({
    new: 'yangi — buyurtma qabul qilindi',
    packing: 'yig‘ilyapti',
    shipping: 'yetkazib berishda',
    delivered: 'yetkazib berildi',
    cancelled: 'bekor qilindi',
    return_requested: 'qaytarish so‘rovi ko‘rib chiqilmoqda',
    returned: 'qaytarildi',
    return_rejected: 'qaytarish rad etildi',
    pending: 'qabul qilindi', pending_cash: 'naqd to‘lov bilan qabul qilindi', pending_payment: 'to‘lov kutilmoqda',
    paid: 'to‘lov tasdiqlandi', approved: 'tasdiqlandi', processing: 'tayyorlanmoqda', shipped: 'jo‘natildi',
    completed: 'yetkazib berildi', canceled: 'bekor qilindi', rejected: 'rad etildi'
  })[k] || safeText(v, 80) || 'holati aniqlanmagan';
}


module.exports = { admin, json, initAdmin, requireUser, requireAdmin, DEFAULT_SUPPORT_CONFIG, normalizeConfig, loadConfig, safeText, money, toMs, statusLabel };
