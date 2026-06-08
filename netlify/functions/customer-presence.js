/* OrzuMall v175 — authenticated customer presence heartbeat.
 * Online status is intentionally approximate: a user is considered online
 * while onlineUntilMs is in the future (heartbeat + 125 seconds).
 */
const admin = require('firebase-admin');

const buckets = global.__omPresenceBuckets || new Map();
global.__omPresenceBuckets = buckets;

function initAdmin(){
  if(admin.apps.length) return;
  const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_B64||'').replace(/\s+/g,'');
  if(!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64_MISSING');
  const serviceAccount=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
  admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
}
function json(statusCode,body){return{statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type, authorization','access-control-allow-methods':'POST, OPTIONS'},body:JSON.stringify(body)}}
function bearer(event){const h=event.headers||{},m=String(h.authorization||h.Authorization||'').match(/^Bearer\s+(.+)$/i);return m?m[1]:''}
function text(v,max=180){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max)}
function deviceFromAgent(v=''){const a=String(v||'').toLowerCase();if(/android|iphone|ipad|mobile/.test(a))return'mobile';if(/tablet/.test(a))return'tablet';return'desktop'}
exports.handler=async(event)=>{try{
  if(event.httpMethod==='OPTIONS')return json(204,{});
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'method_not_allowed'});
  initAdmin();const token=bearer(event);if(!token)return json(401,{ok:false,error:'unauthorized'});
  let decoded;try{decoded=await admin.auth().verifyIdToken(token)}catch(_){return json(401,{ok:false,error:'bad_token'})}
  let body={};try{body=JSON.parse(event.body||'{}')}catch(_){body={}}
  const now=Date.now(),last=Number(buckets.get(decoded.uid)||0);
  // Multiple page events can happen together. Avoid unnecessary writes.
  if(now-last<35000)return json(200,{ok:true,throttled:true,onlineUntilMs:now+125000});
  buckets.set(decoded.uid,now);if(buckets.size>5000){for(const[k,v]of buckets)if(now-v>10*60*1000)buckets.delete(k)}
  const ua=text(event.headers?.['user-agent']||event.headers?.['User-Agent']||'',360);
  const path=text(body.path||'/',240),referrer=text(body.referrer||'',280);
  const patch={lastSeenAt:admin.firestore.FieldValue.serverTimestamp(),lastVisitAt:admin.firestore.FieldValue.serverTimestamp(),presenceUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),onlineUntilMs:now+125000,lastVisitPath:path,lastDevice:deviceFromAgent(ua),lastUserAgent:ua};
  if(referrer)patch.lastReferrer=referrer;
  await admin.firestore().doc(`users/${decoded.uid}`).set(patch,{merge:true});
  return json(200,{ok:true,onlineUntilMs:patch.onlineUntilMs});
}catch(e){console.error('customer-presence',e);return json(500,{ok:false,error:'server_error',detail:String(e?.message||e).slice(0,160)})}}
