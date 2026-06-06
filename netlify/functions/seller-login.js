// OrzuMall v138 — seller login with brute-force protection
const crypto=require('crypto');
const C=require('./_sellerCommon');
const MAX_FAILURES=5;
const BLOCK_MS=15*60*1000;
function ipOf(event){return String(event.headers?.['x-forwarded-for']||event.headers?.['client-ip']||event.headers?.['x-nf-client-connection-ip']||'unknown').split(',')[0].trim().slice(0,180)}
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function attemptRef(db,login,event){return db.doc(`sellerLoginAttempts/${C.loginKey(login)}_${hash(ipOf(event)).slice(0,24)}`)}
async function state(ref){const s=await ref.get();return s.exists?(s.data()||{}):{}}
async function fail(ref,login,event){
  const now=Date.now();let result={blocked:false,retryAfterSec:0,failures:1};
  await ref.firestore.runTransaction(async tx=>{
    const snap=await tx.get(ref),d=snap.exists?(snap.data()||{}):{},prior=Number(d.failures||0)||0,blockedUntilMs=Number(d.blockedUntilMs||0)||0;
    if(blockedUntilMs>now){result={blocked:true,retryAfterSec:Math.max(1,Math.ceil((blockedUntilMs-now)/1000)),failures:prior};return}
    const failures=prior+1,nextBlock=failures>=MAX_FAILURES?now+BLOCK_MS:0;
    result={blocked:nextBlock>now,retryAfterSec:nextBlock>now?Math.ceil(BLOCK_MS/1000):0,failures};
    tx.set(ref,{loginHash:C.loginKey(login),ipHash:hash(ipOf(event)).slice(0,40),failures,blockedUntilMs:nextBlock,lastFailureAt:C.admin.firestore.FieldValue.serverTimestamp(),updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  });
  return result;
}
async function clear(ref){try{await ref.delete()}catch(_){}}
exports.handler=async(event)=>{
  try{
    C.initAdmin();if(event.httpMethod!=="POST")return C.json(405,{ok:false,error:"method_not_allowed"});
    let body={};try{body=JSON.parse(event.body||"{}")}catch(_){return C.json(400,{ok:false,error:"invalid_json"})}
    const login=C.normLogin(body.login),password=String(body.password||"");if(!login||!password)return C.json(400,{ok:false,error:"login_password_required"});
    const db=C.admin.firestore(),ref=attemptRef(db,login,event),a=await state(ref),now=Date.now(),blockedUntilMs=Number(a.blockedUntilMs||0)||0;
    if(blockedUntilMs>now)return C.json(429,{ok:false,error:"too_many_attempts",retryAfterSec:Math.max(1,Math.ceil((blockedUntilMs-now)/1000))});
    const reg=await db.doc(`sellerLogins/${C.loginKey(login)}`).get();
    if(!reg.exists){const r=await fail(ref,login,event);return C.json(r.blocked?429:401,{ok:false,error:r.blocked?"too_many_attempts":"invalid_login",retryAfterSec:r.retryAfterSec||undefined})}
    const sellerId=C.safeId(reg.data()?.sellerId),snap=await db.doc(`sellers/${sellerId}`).get();
    if(!snap.exists){const r=await fail(ref,login,event);return C.json(r.blocked?429:401,{ok:false,error:r.blocked?"too_many_attempts":"invalid_login",retryAfterSec:r.retryAfterSec||undefined})}
    const seller={id:snap.id,...snap.data()};if(seller.active===false||reg.data()?.active===false)return C.json(403,{ok:false,error:"seller_disabled"});
    if(!C.verifyPassword(password,seller.passwordSalt,seller.passwordHash)){const r=await fail(ref,login,event);return C.json(r.blocked?429:401,{ok:false,error:r.blocked?"too_many_attempts":"invalid_login",retryAfterSec:r.retryAfterSec||undefined})}
    await clear(ref);const customToken=await C.admin.auth().createCustomToken(C.sellerUid(sellerId),{sellerPortal:true,sellerId});
    await snap.ref.set({lastLoginAt:C.admin.firestore.FieldValue.serverTimestamp(),lastLoginIpHash:hash(ipOf(event)).slice(0,40),loginFailures:0},{merge:true});
    return C.json(200,{ok:true,customToken,seller:C.publicSeller(seller)});
  }catch(e){console.error("seller-login",e);return C.json(500,{ok:false,error:"server_error"})}
};
