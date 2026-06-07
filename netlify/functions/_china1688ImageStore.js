/*
 * API-free 1688 image copier for OrzuMall.
 * Downloads explicitly selected remote product images and stores private-token
 * Firebase download URLs so the catalog remains independent from 1688 pages.
 */
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');
const { admin, cleanText } = require('./_china1688Common');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_BATCH = 6;

function safeFilePart(v, fallback = 'item') {
  const s = cleanText(v, 120).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}
function safeHttpUrl(v) {
  const s = cleanText(v, 2200);
  if (!s) return '';
  try {
    const u = new URL(s.startsWith('//') ? `https:${s}` : s);
    if (!/^https?:$/i.test(u.protocol)) return '';
    if (u.protocol === 'http:' && /(?:^|\.)(?:alicdn\.com|1688\.com|tbcdn\.cn|alibabausercontent\.com)$/i.test(u.hostname)) u.protocol = 'https:';
    u.hash = '';
    return u.toString();
  } catch (_e) { return ''; }
}
function isBlockedIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const a = ip.split('.').map(Number);
    return a[0] === 10 || a[0] === 127 || a[0] === 0 ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 192 && a[1] === 168) ||
      (a[0] >= 224);
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80:');
  }
  return true;
}
async function assertPublicRemote(rawUrl) {
  const safe = safeHttpUrl(rawUrl);
  if (!safe) throw new Error('IMAGE_URL_INVALID');
  const u = new URL(safe);
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('IMAGE_HOST_BLOCKED');
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error('IMAGE_HOST_BLOCKED');
  } else {
    const rows = await dns.lookup(host, { all: true, verbatim: true });
    if (!rows.length || rows.some(row => isBlockedIp(row.address))) throw new Error('IMAGE_HOST_BLOCKED');
  }
  return safe;
}
function contentExtension(type, url) {
  const t = String(type || '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('avif')) return 'avif';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  const m = String(url || '').match(/\.(png|webp|gif|avif|jpe?g)(?:[?#]|$)/i);
  return m ? m[1].replace('jpeg', 'jpg').toLowerCase() : 'jpg';
}
function firebaseBucket() {
  const configured = cleanText(process.env.FIREBASE_STORAGE_BUCKET || '', 300);
  return admin.storage().bucket(configured || undefined);
}
async function downloadImage(rawUrl) {
  let url = await assertPublicRemote(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    let res = null;
    for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'referer': 'https://detail.1688.com/',
        },
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const location = res.headers.get('location');
      if (!location || redirectCount === 4) throw new Error('IMAGE_REDIRECT_INVALID');
      url = await assertPublicRemote(new URL(location, url).toString());
    }
    if (!res || !res.ok) throw new Error(`IMAGE_HTTP_${res?.status || 0}`);
    const contentType = cleanText(res.headers.get('content-type') || '', 120).toLowerCase();
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error('IMAGE_EMPTY');
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
    if (!contentType.startsWith('image/') && !/\.(png|webp|gif|avif|jpe?g)(?:[?#]|$)/i.test(url)) throw new Error('NOT_AN_IMAGE');
    return { url, buffer, contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg' };
  } finally { clearTimeout(timer); }
}
async function copyOne(rawUrl, itemId, index) {
  const source = await downloadImage(rawUrl);
  const bucket = firebaseBucket();
  const token = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(source.url).digest('hex').slice(0, 14);
  const ext = contentExtension(source.contentType, source.url);
  const name = `products/china1688/${safeFilePart(itemId)}/${Date.now()}-${index + 1}-${hash}.${ext}`;
  const file = bucket.file(name);
  await file.save(source.buffer, {
    resumable: false,
    metadata: {
      contentType: source.contentType,
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
        sourcePlatform: '1688',
        sourceUrl: source.url,
      },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(name)}?alt=media&token=${encodeURIComponent(token)}`;
  return { sourceUrl: source.url, url, path: name };
}
async function copyImages(rawUrls, itemId) {
  const urls = [...new Set((Array.isArray(rawUrls) ? rawUrls : []).map(safeHttpUrl).filter(Boolean))].slice(0, MAX_IMAGES_PER_BATCH);
  const settled = await Promise.allSettled(urls.map((url, index) => copyOne(url, itemId, index)));
  const copied = [], failed = [];
  settled.forEach((row, index) => {
    if (row.status === 'fulfilled') copied.push(row.value);
    else failed.push({ sourceUrl: urls[index], error: cleanText(row.reason?.message || 'IMAGE_COPY_FAILED', 160) });
  });
  return { copied, failed, requested: urls.length };
}
module.exports = { MAX_IMAGES_PER_BATCH, safeHttpUrl, downloadImage, copyImages };
