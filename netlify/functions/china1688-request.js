const {
  admin, cleanText, json, parseBody, rateLimit, initFirebaseAdmin, safe1688Url, tgEscape, notifyTelegram,
} = require('./_china1688Common');

function phone(v) { return cleanText(v, 40).replace(/[^0-9+]/g, ''); }
function safeQty(v) { return Math.max(1, Math.min(999, Math.round(Number(v) || 1))); }

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const rl = rateLimit(event, 'china1688-request', 12, 60 * 60 * 1000);
  if (!rl.ok) return json(429, { error: 'TOO_MANY_REQUESTS', retryAfterSec: rl.retryAfterSec });
  const b = parseBody(event);
  if (!b) return json(400, { error: 'INVALID_JSON' });
  const name = cleanText(b.name, 100);
  const customerPhone = phone(b.phone);
  const product = b.product && typeof b.product === 'object' ? b.product : {};
  const productIdRaw = cleanText(product.id, 100);
  const productId = /^\d{6,}$/.test(productIdRaw) ? productIdRaw : '';
  const sourceUrl = safe1688Url(product.url);
  const title = cleanText(product.title, 320) || '1688 mahsuloti';
  const qty = safeQty(b.qty);
  const variant = cleanText(b.variant, 240);
  const note = cleanText(b.note, 700);
  if (name.length < 2) return json(400, { error: 'NAME_REQUIRED', message: 'Ismingizni kiriting.' });
  if (!/^\+?[0-9]{9,15}$/.test(customerPhone)) return json(400, { error: 'PHONE_INVALID', message: 'Telefon raqamini to‘g‘ri kiriting.' });
  if (!productId && !sourceUrl) return json(400, { error: 'PRODUCT_REQUIRED' });
  try {
    initFirebaseAdmin();
    const createdAt = admin.firestore.Timestamp.now();
    const row = {
      type: 'china1688', status: 'new', name, phone: customerPhone,
      qty, variant, note,
      product: {
        id: productId, url: sourceUrl, title,
        image: cleanText(product.image, 1500),
        priceCny: Number(product.priceCny || 0) || 0,
        priceUzs: Number(product.priceUzs || 0) || 0,
        moq: Number(product.moq || 1) || 1,
        sellerName: cleanText(product.sellerName, 180),
      },
      source: 'orzumall-china1688-page', createdAt, updatedAt: createdAt,
    };
    const ref = await admin.firestore().collection('china1688Requests').add(row);
    const fmt = n => Math.round(Number(n || 0)).toLocaleString('ru-RU');
    await notifyTelegram([
      '<b>🇨🇳 Yangi 1688 buyurtma so‘rovi</b>',
      `ID: <code>${tgEscape(ref.id)}</code>`,
      `Mijoz: <b>${tgEscape(name)}</b>`,
      `Tel: <b>${tgEscape(customerPhone)}</b>`,
      `Mahsulot: <b>${tgEscape(title)}</b>`,
      productId ? `1688 ID: <code>${tgEscape(productId)}</code>` : '',
      sourceUrl ? `<a href="${tgEscape(sourceUrl)}">1688 sahifasini ochish</a>` : '',
      `Miqdor: <b>${qty}</b>`,
      variant ? `Variant: ${tgEscape(variant)}` : '',
      row.product.priceCny ? `1688 narxi: <b>${tgEscape(row.product.priceCny)} yuan</b>` : '',
      row.product.priceUzs ? `Taxminiy OrzuMall narxi: <b>${tgEscape(fmt(row.product.priceUzs))} so‘m</b>` : '',
      note ? `Izoh: ${tgEscape(note)}` : '',
    ]);
    return json(200, { ok: true, requestId: ref.id, status: 'new' });
  } catch (e) {
    return json(500, { error: e.message || 'SAVE_FAILED', message: 'So‘rovni saqlab bo‘lmadi. Firebase server sozlamasini tekshiring.' });
  }
};
