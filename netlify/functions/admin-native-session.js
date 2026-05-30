// Exchange a verified native Firebase ID token for a short-lived Firebase custom token.
// WebView uses the custom token to establish its own Firebase JS session safely.
const admin = require('firebase-admin');
function initAdmin(){
  if(admin.apps.length) return;
  const b64=process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if(!b64) throw new Error('Missing env FIREBASE_SERVICE_ACCOUNT_B64');
  const serviceAccount=JSON.parse(Buffer.from(b64,'base64').toString('utf8'));
  admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
}
function json(statusCode,body){return{statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)}}
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
    let decoded; try{decoded=await admin.auth().verifyIdToken(token,true)}catch(_){return json(401,{ok:false,error:'bad_token'})}
    const db=admin.firestore(); if(!(await isAdmin(decoded,db))) return json(403,{ok:false,error:'admin_required'});
    const customToken=await admin.auth().createCustomToken(decoded.uid,{orzumallAdmin:true,email:normEmail(decoded.email)});
    return json(200,{ok:true,customToken,email:normEmail(decoded.email)});
  }catch(e){return json(500,{ok:false,error:'server_error',detail:String(e?.message||e).slice(0,240)})}
};
