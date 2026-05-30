// Send an authenticated test push to registered OrzuMall admin Android devices.
const admin = require('firebase-admin');
const { sendToAdmins } = require('./_adminPush');
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
    const result=await sendToAdmins(db,{
      title:'OrzuMall Admin — test push',
      body:'Native push muvaffaqiyatli ishlayapti. Endi yangi buyurtma kelsa signal olasiz.',
      channelId:'updates_default',
      data:{type:'test_push',url:'https://orzumall.uz/admin-mobile/'}
    });
    return json(200,{ok:true,...result});
  }catch(e){return json(500,{ok:false,error:'server_error',detail:String(e?.message||e).slice(0,240)})}
};
