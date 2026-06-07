/*
 * API-free 1688 image copier for OrzuMall.
 * Downloads explicitly selected remote product images, normalizes them into a
 * consistent marketplace-ready square canvas, and stores private-token Firebase
 * download URLs so the catalog remains independent from 1688 pages.
 */
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');
const { admin, cleanText, normalizeRemoteImageUrl } = require('./_china1688Common');

let sharp = null;
try { sharp = require('sharp'); } catch (_e) { sharp = null; }

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_BATCH = 6;
const IMAGE_STANDARD = 'square-1200-visual-fill-v2';
const CANVAS_SIZE = 1200;
const CONTENT_SIZE = 1176;

function safeFilePart(v, fallback = 'item') {
  const s = cleanText(v, 120).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}
function safeHttpUrl(v) {
  // Always download the original Alibaba CDN file, never a 60×60/220×220 thumbnail.
  return normalizeRemoteImageUrl(v, 2200);
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

async function normalizeMarketplaceImage(source) {
  if (!sharp) {
    return {
      buffer: source.buffer,
      contentType: source.contentType,
      ext: contentExtension(source.contentType, source.url),
      normalized: false,
      standard: 'raw-fallback',
      reason: 'SHARP_NOT_AVAILABLE',
    };
  }
  try {
    // Important: trim runs before the fixed canvas resize. This removes common
    // white/transparent source borders from supplier images so products do not
    // look randomly tiny next to each other. The final 40px frame is identical
    // for every photo.
    const result = await sharp(source.buffer, { failOn: 'none', animated: false })
      .rotate()
      .flatten({ background: '#ffffff' })
      .trim({ background: '#ffffff', threshold: 18 })
      .resize(CONTENT_SIZE, CONTENT_SIZE, {
        fit: 'contain',
        position: 'centre',
        background: '#ffffff',
        withoutEnlargement: false,
      })
      .extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#ffffff' })
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: result.data,
      contentType: 'image/jpeg',
      ext: 'jpg',
      normalized: true,
      standard: IMAGE_STANDARD,
      width: Number(result.info?.width || CANVAS_SIZE),
      height: Number(result.info?.height || CANVAS_SIZE),
    };
  } catch (e) {
    // A corrupt supplier photo must not block the whole import. Store the raw
    // source as a safe fallback and report the reason to the admin endpoint.
    return {
      buffer: source.buffer,
      contentType: source.contentType,
      ext: contentExtension(source.contentType, source.url),
      normalized: false,
      standard: 'raw-fallback',
      reason: cleanText(e?.message || 'IMAGE_NORMALIZE_FAILED', 160),
    };
  }
}

async function copyOne(rawUrl, itemId, index, options = {}) {
  const source = await downloadImage(rawUrl);
  const shouldNormalize = options.normalize !== false;
  const prepared = shouldNormalize ? await normalizeMarketplaceImage(source) : {
    buffer: source.buffer,
    contentType: source.contentType,
    ext: contentExtension(source.contentType, source.url),
    normalized: false,
    standard: 'raw-copy',
  };
  if (shouldNormalize && options.strictNormalize === true && !prepared.normalized) throw new Error(prepared.reason || 'IMAGE_NORMALIZE_REQUIRED');
  const bucket = firebaseBucket();
  const token = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(source.url).digest('hex').slice(0, 14);
  const stamp = Date.now();
  const name = `products/china1688/${safeFilePart(itemId)}/${stamp}-${index + 1}-${hash}-${prepared.standard}.${prepared.ext}`;
  const file = bucket.file(name);
  await file.save(prepared.buffer, {
    resumable: false,
    metadata: {
      contentType: prepared.contentType,
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
        sourcePlatform: '1688',
        sourceUrl: source.url,
        imageStandard: prepared.standard,
        normalized: prepared.normalized ? 'true' : 'false',
      },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(name)}?alt=media&token=${encodeURIComponent(token)}`;
  return {
    sourceUrl: source.url,
    url,
    path: name,
    normalized: !!prepared.normalized,
    standard: prepared.standard,
    normalizationReason: prepared.reason || '',
  };
}
async function copyImages(rawUrls, itemId, options = {}) {
  const urls = [...new Set((Array.isArray(rawUrls) ? rawUrls : []).map(safeHttpUrl).filter(Boolean))].slice(0, MAX_IMAGES_PER_BATCH);
  const settled = await Promise.allSettled(urls.map((url, index) => copyOne(url, itemId, index, options)));
  const copied = [], failed = [];
  settled.forEach((row, index) => {
    if (row.status === 'fulfilled') copied.push(row.value);
    else failed.push({ sourceUrl: urls[index], error: cleanText(row.reason?.message || 'IMAGE_COPY_FAILED', 160) });
  });
  return {
    copied,
    failed,
    requested: urls.length,
    normalized: copied.filter(x => x.normalized).length,
    standard: options.normalize === false ? 'raw-copy' : IMAGE_STANDARD,
    sharpAvailable: !!sharp,
  };
}
module.exports = {
  MAX_IMAGES_PER_BATCH,
  IMAGE_STANDARD,
  safeHttpUrl,
  downloadImage,
  normalizeMarketplaceImage,
  copyImages,
};
