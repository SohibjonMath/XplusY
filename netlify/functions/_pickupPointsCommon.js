// Shared pickup-point tariff validation for checkout Netlify functions.
const STARTER_PICKUP_POINTS = require('./_pickupPointsDefaults');
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function safeText(v, max = 220) { return String(v == null ? "" : v).trim().slice(0, max); }
function safeCoords(p){
  const rawLat=p?.lat ?? p?.latitude,rawLng=p?.lng ?? p?.longitude;
  if(rawLat==null||rawLat===""||rawLng==null||rawLng==="") return {lat:null,lng:null};
  const lat=Number(rawLat),lng=Number(rawLng);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180 ? {lat,lng}:{lat:null,lng:null};
}
function normalizePickupPoint(p, index = 0) {
  if (!p || typeof p !== "object") return null;
  const {lat,lng}=safeCoords(p);
  const minDays = Math.max(1, Math.round(num(p.minDays ?? p.deliveryMinDays, 2)));
  const maxDays = Math.max(minDays, Math.round(num(p.maxDays ?? p.deliveryMaxDays, minDays)));
  const id = safeText(p.id || `point_${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, "_");
  const pointType=String(p.pointType||p.type||"").toLowerCase()==="bir_qadam"?"bir_qadam":"orzumall";
  return { id, name:safeText(p.name || p.title || `Topshirish punkti ${index + 1}`,160), address:safeText(p.address || p.addressText || "",320), postalCode:safeText(p.postalCode ?? p.postalIndex ?? p.postIndex ?? "",40), workingHours:safeText(p.workingHours ?? p.workHours ?? p.openingHours ?? "",180), lat,lng, pointType, sourceType:safeText(p.sourceType||p.source||"",80), region:safeText(p.region||"",100), district:safeText(p.district||"",100), firstKgFeeUZS:Math.max(0,Math.round(num(p.firstKgFeeUZS ?? p.firstKgFee,pointType==="bir_qadam"?15000:0))), extraKgFeeUZS:Math.max(0,Math.round(num(p.extraKgFeeUZS ?? p.extraKgFee,pointType==="bir_qadam"?3000:0))), minDays,maxDays,etaText:safeText(p.etaText || `${minDays}–${maxDays} kun`,80), active:p.active !== false, tariffConfigured:p.tariffConfigured!==false };
}
function rawPoints(raw){ return Array.isArray(raw)?raw:(Array.isArray(raw?.points)?raw.points:[]); }
function mergePickupPoints(baseRaw, overrideRaw){
  const map=new Map();
  rawPoints(baseRaw).forEach((p,i)=>{const n=normalizePickupPoint(p,i);if(n)map.set(String(n.id),n);});
  rawPoints(overrideRaw).forEach((p,i)=>{const n=normalizePickupPoint(p,i);if(n)map.set(String(n.id),{...(map.get(String(n.id))||{}),...n});});
  return [...map.values()];
}
function calculatePickupQuote(point, totalWeightKg = 0) { const billedKg=Math.max(1,Math.ceil(Math.max(0,num(totalWeightKg,0))));const firstKgFeeUZS=Math.max(0,Math.round(num(point?.firstKgFeeUZS,0)));const extraKgFeeUZS=Math.max(0,Math.round(num(point?.extraKgFeeUZS,0)));const feeUZS=firstKgFeeUZS+Math.max(0,billedKg-1)*extraKgFeeUZS;return {billedKg,firstKgFeeUZS,extraKgFeeUZS,feeUZS}; }
function lineWeightKg(item) { const line=Number(item?.lineWeightKg);if(Number.isFinite(line)&&line>=0)return line;const qty=Math.max(1,Number(item?.qty??item?.count??1)||1);const kg=Math.max(0,Number(item?.weightKg??item?.weight??0)||0);return kg*qty; }
function sumWeightKg(items = []) { return (Array.isArray(items)?items:[]).reduce((sum,item)=>sum+lineWeightKg(item),0); }
async function calculateCatalogWeightKg(db, items = []) { let total=0;const cache=new Map();for(const item of Array.isArray(items)?items:[]){const productId=String(item?.productId||item?.id||"");const qty=Math.max(1,Number(item?.qty??item?.count??1)||1);let product=null;if(productId){if(!cache.has(productId)){try{const snap=await db.doc(`products/${productId}`).get();cache.set(productId,snap.exists?(snap.data()||{}):null);}catch(_){cache.set(productId,null);}}product=cache.get(productId);}const serverKg=Number(product?.weightKg??product?.weight_kg??product?.weight??product?.shippingWeightKg);const clientKg=Number(item?.weightKg??item?.weight??0);total+=Math.max(0,Number.isFinite(serverKg)?serverKg:(Number.isFinite(clientKg)?clientKg:0))*qty;}return total; }
async function normalizePickupShipping(db, shipping, totalWeightKg = 0) {
  if(!shipping||typeof shipping!=="object")return shipping;
  const method=String(shipping.method||shipping.service||"").toLowerCase();if(method!=="pickup_point")return shipping;
  const pickupPointId=safeText(shipping.pickupPointId||shipping.pickupPoint?.id||"",80);if(!pickupPointId)throw new Error("pickup_point_required");
  let remote={points:[]};try{const snap=await db.doc("configs/pickupPoints").get();remote=snap.exists?(snap.data()||{}):{points:[]};}catch(_){}
  const points=mergePickupPoints(STARTER_PICKUP_POINTS,remote);
  const point=points.find(p=>p.active!==false&&String(p.id)===pickupPointId);if(!point)throw new Error("pickup_point_not_found");if(point.tariffConfigured===false)throw new Error("pickup_point_tariff_not_configured");
  const quote=calculatePickupQuote(point,totalWeightKg);const mapUrl=point.lat!=null&&point.lng!=null?`https://maps.google.com/?q=${encodeURIComponent(`${point.lat},${point.lng}`)}`:"";
  return {...shipping,method:"pickup_point",methodLabel:"Topshirish punktidan olib ketish",service:"pickup_point",serviceLabel:`Topshirish punkti — ${point.name}`,pickupPointId:point.id,pickupPoint:{...point,billedKg:quote.billedKg,feeUZS:quote.feeUZS,mapUrl},address:point.address,postalCode:point.postalCode||"",workingHours:point.workingHours||"",addressText:`${point.name}${point.address?` — ${point.address}`:""}${point.postalCode?` • Indeks: ${point.postalCode}`:""}${point.workingHours?` • Ish vaqti: ${point.workingHours}`:""}`,lat:point.lat,lng:point.lng,mapUrl,totalWeightKg:Math.max(0,num(totalWeightKg,0)),billedKg:quote.billedKg,deliveryFeeUZS:quote.feeUZS,deliveryRawFeeUZS:quote.feeUZS};
}
module.exports={calculateCatalogWeightKg,calculatePickupQuote,normalizePickupShipping,sumWeightKg,normalizePickupPoint,mergePickupPoints};
