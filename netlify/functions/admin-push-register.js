// Register Android FCM token for authenticated OrzuMall admins.
const admin = require('firebase-admin');
const { tokenHash } = require('./_adminPush');
function initAdmin(){
  if(admin.apps.length) return;
  const b64=process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if(!b64) throw new Error('Missing env FIREBASE_SERVICE_ACCOUNT_B64');
  const serviceAccount=JSON.parse(Buffer.from(b64,'base64').toString('utf8'));
  admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
}
function json(statusCode,body){return{statusCode,headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify(body)}}
function bearer(event){const h=event.headers?.authorization||event.headers?.Authorization||'';const m=h.match(/^Bearer\s+(.+)$/i);return m?m[1]:''}
function normEmail(v){return String(v||'').trim().toLowerCase()}
async function isAdmin(decoded,db){
  const email=normEmail(decoded?.email); if(!email) return false;
  const env=String(process.env.ADMIN_EMAILS||'').split(',').map(normEmail).filter(Boolean);
  if(new Set(['sohibjonmath@gmail.com',...env]).has(email)) return true;
  try{const s=await db.doc('configs/admins').get();return s.exists&&Array.isArray(s.data()?.emails)&&s.data().emails.map(normEmail).includes(email)}catch(_){return false}
}
exports.handler=async(event)=>{
  try{
    initAdmin(); if(event.httpMethod!=='POST') return json(405,{ok:false,error:'method_not_allowed'});
    const token=bearer(event); if(!token) return json(401,{ok:false,error:'unauthorized'});
    let decoded; try{decoded=await admin.auth().verifyIdToken(token)}catch(_){return json(401,{ok:false,error:'bad_token'})}
    const db=admin.firestore(); if(!(await isAdmin(decoded,db))) return json(403,{ok:false,error:'admin_required'});
    let body={}; try{body=event.body?JSON.parse(event.body):{}}catch(_){return json(400,{ok:false,error:'invalid_json'})}
    const fcmToken=String(body.token||'').trim(); if(fcmToken.length<40||fcmToken.length>4096) return json(400,{ok:false,error:'invalid_fcm_token'});
    const id=tokenHash(fcmToken);
    await db.doc(`adminPushTokens/${id}`).set({
      token:fcmToken, uid:decoded.uid, email:normEmail(decoded.email), platform:'android', appId:String(body.appId||'uz.orzumall.admin').slice(0,120),
      deviceName:String(body.deviceName||'').slice(0,160), active:true,
      createdAt:admin.firestore.FieldValue.serverTimestamp(), updatedAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    return json(200,{ok:true,id});
  }catch(e){return json(500,{ok:false,error:'server_error',detail:String(e?.message||e).slice(0,240)})}
};
