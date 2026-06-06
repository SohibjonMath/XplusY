// OrzuMall v138 — rate-limited client-side error collector
const admin=require('firebase-admin');
const crypto=require('crypto');
function initAdmin(){if(admin.apps.length)return;const b64=process.env.FIREBASE_SERVICE_ACCOUNT_B64;if(!b64)throw new Error('Missing env FIREBASE_SERVICE_ACCOUNT_B64');admin.initializeApp({credential:admin.credential.cert(JSON.parse(Buffer.from(b64,'base64').toString('utf8')))})}
function json(statusCode,body){return{statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'https://orzumall.uz','vary':'Origin'},body:JSON.stringify(body)}}
function safe(v,n=800){return String(v==null?'':v).trim().slice(0,n)}
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function ipOf(e){return safe(e.headers?.['x-forwarded-for']||e.headers?.['client-ip']||e.headers?.['x-nf-client-connection-ip']||'unknown',180).split(',')[0].trim()}
function originAllowed(e){const o=safe(e.headers?.origin,300);return !o||['https://orzumall.uz','https://www.orzumall.uz'].includes(o)}
function bearer(e){const m=safe(e.headers?.authorization||e.headers?.Authorization,5000).match(/^Bearer\s+(.+)$/i);return m?m[1]:''}
exports.handler=async event=>{try{
  if(event.httpMethod==='OPTIONS')return json(204,{ok:true});
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'method_not_allowed'});
  if(!originAllowed(event))return json(403,{ok:false,error:'origin_forbidden'});
  if(String(event.body||'').length>12000)return json(413,{ok:false,error:'payload_too_large'});
  initAdmin();let b={};try{b=JSON.parse(event.body||'{}')}catch(_){return json(400,{ok:false,error:'invalid_json'})}
  const message=safe(b.message,1200);if(!message)return json(400,{ok:false,error:'message_required'});
  const db=admin.firestore(),day=new Date().toISOString().slice(0,10),ipHash=hash(ipOf(event)).slice(0,32),rateRef=db.doc(`clientErrorRates/${day}_${ipHash}`);let accepted=true;
  await db.runTransaction(async tx=>{const s=await tx.get(rateRef),d=s.exists?(s.data()||{}):{},count=Math.max(0,Number(d.count||0)||0);if(count>=60){accepted=false;return}tx.set(rateRef,{day,ipHash,count:count+1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true})});
  if(!accepted)return json(429,{ok:false,error:'rate_limited'});
  let uid='',email='';const t=bearer(event);if(t){try{const d=await admin.auth().verifyIdToken(t);uid=safe(d.uid,160);email=safe(d.email,180)}catch(_){}}
  await db.collection('clientErrors').add({message,stack:safe(b.stack,3500),source:safe(b.source,500),line:Math.max(0,Number(b.line||0)||0),column:Math.max(0,Number(b.column||0)||0),page:safe(b.page,700),userAgent:safe(event.headers?.['user-agent'],700),uid,email,ipHash,createdAt:admin.firestore.FieldValue.serverTimestamp(),version:'v138'});
  return json(200,{ok:true});
}catch(e){console.error('client-error',e);return json(500,{ok:false,error:'server_error'})}};
