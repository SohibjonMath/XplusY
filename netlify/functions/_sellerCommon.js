const admin=require("firebase-admin");
const crypto=require("crypto");

function initAdmin(){
  if(admin.apps.length)return;
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_B64||"";
  if(!raw)throw new Error("missing_service_account");
  admin.initializeApp({credential:admin.credential.cert(JSON.parse(Buffer.from(raw,"base64").toString("utf8")))});
}
function json(statusCode,body){return{statusCode,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"},body:JSON.stringify(body)}}
function bearer(event){const h=event.headers?.authorization||event.headers?.Authorization||"";const m=String(h).match(/^Bearer\s+(.+)$/i);return m?m[1]:""}
function safeText(v,max=500){return String(v==null?"":v).trim().slice(0,max)}
function safeId(v){const s=String(v||"").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);return s}
function normLogin(v){return safeText(v,80).toLowerCase().replace(/\s+/g,"")}
function loginKey(v){return crypto.createHash("sha256").update(normLogin(v)).digest("hex").slice(0,48)}
function randomId(){return crypto.randomBytes(6).toString("hex")}
function sellerUid(id){return `seller_${safeId(id)}`}
function num(v,min=0,max=100){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min}
function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){
  const pass=String(password||"");
  if(pass.length<6)throw new Error("password_min_6");
  const hash=crypto.scryptSync(pass,salt,64).toString("hex");
  return {salt,hash};
}
function verifyPassword(password,salt,expected){
  try{
    const actual=crypto.scryptSync(String(password||""),String(salt||""),64);
    const exp=Buffer.from(String(expected||""),"hex");
    return exp.length===actual.length&&crypto.timingSafeEqual(exp,actual);
  }catch(_){return false}
}
async function verifyToken(event){
  const token=bearer(event);if(!token)throw new Error("unauthorized");
  return admin.auth().verifyIdToken(token,true);
}
async function isAdmin(decoded,db){
  const email=String(decoded?.email||"").trim().toLowerCase();
  if(email==="sohibjonmath@gmail.com")return true;
  try{
    const snap=await db.doc("configs/admins").get();
    const emails=snap.exists&&Array.isArray(snap.data()?.emails)?snap.data().emails:[];
    return emails.map(x=>String(x||"").trim().toLowerCase()).includes(email);
  }catch(_){return false}
}
function publicSeller(d={}){
  return{
    id:String(d.id||""),
    uid:String(d.uid||""),
    login:String(d.login||""),
    storeName:String(d.storeName||d.name||""),
    logoUrl:String(d.logoUrl||""),
    phone:String(d.phone||""),
    lat:Number(d.lat||0)||0,
    lng:Number(d.lng||0)||0,
    popularity:num(d.popularity,0,100),
    active:d.active!==false,
    createdAt:d.createdAt||null,
    updatedAt:d.updatedAt||null
  }
}
async function sellerStats(db,sellerId){
  const snap=await db.collection("products").where("sellerId","==",String(sellerId)).get();
  const products=snap.docs.map(d=>({id:d.id,...d.data()}));
  const avg=products.length?Math.round(products.reduce((s,p)=>s+num(p.popularScore,0,100),0)/products.length):0;
  const pending=products.filter(p=>String(p.status||"pending").toLowerCase()==="pending").length;
  const approved=products.filter(p=>String(p.status||"pending").toLowerCase()==="approved").length;
  return{products,productCount:products.length,avgProductPopularity:avg,pendingCount:pending,approvedCount:approved};
}
async function getSellerByDecoded(db,decoded){
  const sellerId=safeId(decoded?.sellerId||"");
  if(!decoded?.sellerPortal||!sellerId)throw new Error("seller_required");
  const snap=await db.doc(`sellers/${sellerId}`).get();
  if(!snap.exists)throw new Error("seller_not_found");
  const data={id:snap.id,...snap.data()};
  if(data.active===false)throw new Error("seller_disabled");
  return data;
}
module.exports={admin,initAdmin,json,bearer,safeText,safeId,normLogin,loginKey,randomId,sellerUid,num,hashPassword,verifyPassword,verifyToken,isAdmin,publicSeller,sellerStats,getSellerByDecoded};
