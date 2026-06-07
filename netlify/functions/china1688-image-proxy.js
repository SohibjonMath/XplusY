/*
 * Admin-only-use preview proxy for 1688 product images.
 * Public GET is intentionally limited to Alibaba image CDN hosts and rate-limited.
 * Imported catalog images are copied to Firebase Storage; this proxy is not used
 * for customer-facing product cards after save.
 */
const { cleanText, json, rateLimit } = require('./_china1688Common');
const { safeHttpUrl, downloadImage } = require('./_china1688ImageStore');

function allowedHost(host) {
  const h = String(host || '').toLowerCase();
  return h === 'alicdn.com' || h.endsWith('.alicdn.com') ||
    h === 'tbcdn.cn' || h.endsWith('.tbcdn.cn') ||
    h === 'alibabausercontent.com' || h.endsWith('.alibabausercontent.com') ||
    h === '1688.com' || h.endsWith('.1688.com');
}
function requestedUrl(event) {
  const raw = cleanText(event.queryStringParameters?.url || '', 2400);
  const safe = safeHttpUrl(raw);
  if (!safe) return '';
  try { const u = new URL(safe); return allowedHost(u.hostname) ? u.toString() : ''; }
  catch (_e) { return ''; }
}
exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const limited = rateLimit(event, 'china1688-image-preview', 420, 10 * 60 * 1000);
  if (!limited.ok) return json(429, { error: 'TOO_MANY_REQUESTS' });
  const url = requestedUrl(event);
  if (!url) return json(400, { error: 'IMAGE_URL_INVALID' });
  try {
    const row = await downloadImage(url);
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'content-type': row.contentType || 'image/jpeg',
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'x-content-type-options': 'nosniff',
      },
      body: row.buffer.toString('base64'),
    };
  } catch (error) {
    return json(404, { error: cleanText(error?.message || 'IMAGE_PREVIEW_FAILED', 160) });
  }
};
