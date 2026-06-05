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
function metricNum(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0}
function metricMax(...values){return values.reduce((m,v)=>Math.max(m,metricNum(v)),0)}
function storePopularityNum(v){return Math.max(0,Math.round(metricNum(v)))}
function productPopularity(p={}){
  const views=metricMax(p.views,p.viewCount,p.viewsCount,p.productViews,p.popularViews);
  const cartAdds=metricMax(p.cartAdds,p.cartAddCount,p.addToCartCount);
  const favoriteAdds=metricMax(p.favoriteAdds,p.favorites,p.favoriteCount,p.wishlistAdds);
  const purchases=metricMax(p.purchases,p.purchaseCount,p.soldCount,p.salesCount);
  const calculated=Math.round(views+favoriteAdds*4+cartAdds*7+purchases*25);
  return storePopularityNum(Math.max(calculated,metricNum(p.popularScore),metricNum(p.metricScore),metricNum(p.engagementScore),metricNum(p.score)));
}
function mergeProductMetrics(product={},metric={}){
  const out={...product};
  out.views=metricMax(product.views,product.viewCount,product.viewsCount,product.productViews,product.popularViews,metric.views);
  out.viewsCount=out.views;
  out.cartAdds=metricMax(product.cartAdds,product.cartAddCount,product.addToCartCount,metric.cartAdds);
  out.favoriteAdds=metricMax(product.favoriteAdds,product.favorites,product.favoriteCount,product.wishlistAdds,metric.favoriteAdds);
  out.purchases=metricMax(product.purchases,product.purchaseCount,product.soldCount,product.salesCount,metric.purchases);
  out.soldCount=metricMax(product.soldCount,out.purchases);
  out.metricScore=metricMax(product.metricScore,product.engagementScore,metric.score);
  out.engagementScore=metricMax(product.engagementScore,out.metricScore);
  out.popularScore=metricMax(product.popularScore,out.metricScore);
  return out;
}
async function withProductMetrics(db,productDocs=[]){
  const rows=(Array.isArray(productDocs)?productDocs:[]).map(d=>({id:d.id,...(typeof d.data==="function"?d.data():d)}));
  if(!rows.length)return rows;
  let metricSnaps=[];
  try{metricSnaps=await db.getAll(...rows.map(x=>db.doc(`productMetrics/${x.id}`)))}catch(_){metricSnaps=[]}
  const metricById=new Map(metricSnaps.filter(x=>x&&x.exists).map(x=>[x.id,x.data()||{}]));
  return rows.map(x=>mergeProductMetrics(x,metricById.get(x.id)||{}));
}
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
    bannerUrl:String(d.bannerUrl||""),
    description:String(d.description||""),
    workingHours:String(d.workingHours||""),
    phone:String(d.phone||""),
    lat:Number(d.lat||0)||0,
    lng:Number(d.lng||0)||0,
    popularity:storePopularityNum(d.popularity),
    popularityAuto:d.popularityAuto!==false,
    popularityProductCount:Math.max(0,Math.round(Number(d.popularityProductCount||0)||0)),
    commissionPercent:num(d.commissionPercent??10,0,100),
    followersCount:Math.max(0,Math.round(Number(d.followersCount||0)||0)),
    verified:d.verified!==false,
    active:d.active!==false,
    createdAt:d.createdAt||null,
    updatedAt:d.updatedAt||null
  }
}
function isVisibleSellerProduct(p={}){
  return String(p.status||"").toLowerCase()==="approved"&&p.sellerActive!==false&&p.isActive!==false;
}
function averageProductPopularity(products=[]){
  const rows=(Array.isArray(products)?products:[]).filter(isVisibleSellerProduct);
  return rows.length?Math.round(rows.reduce((sum,p)=>sum+productPopularity(p),0)/rows.length):0;
}
function buildSellerStats(productDocs=[]){
  const products=productDocs.map(d=>({id:d.id,...(typeof d.data==="function"?d.data():d)})).filter(p=>String(p.status||"").toLowerCase()!=="deleted");
  const visibleProducts=products.filter(isVisibleSellerProduct);
  const avgAll=products.length?Math.round(products.reduce((sum,p)=>sum+productPopularity(p),0)/products.length):0;
  const popularity=visibleProducts.length?Math.round(visibleProducts.reduce((sum,p)=>sum+productPopularity(p),0)/visibleProducts.length):0;
  const pending=products.filter(p=>String(p.status||"pending").toLowerCase()==="pending").length;
  const approved=products.filter(p=>String(p.status||"pending").toLowerCase()==="approved").length;
  return{products,productCount:products.length,visibleProductCount:visibleProducts.length,avgProductPopularity:avgAll,popularity,pendingCount:pending,approvedCount:approved};
}
async function sellerStats(db,sellerId){
  const snap=await db.collection("products").where("sellerId","==",String(sellerId)).get();
  return buildSellerStats(await withProductMetrics(db,snap.docs));
}
async function commitProductPopularitySnapshot(db,docs,popularity){
  const changed=docs.filter(d=>{
    const x=d.data()||{};
    return String(x.status||"").toLowerCase()!=="deleted"&&Number(x.sellerPopularity||0)!==Number(popularity||0);
  });
  for(let i=0;i<changed.length;i+=430){
    const batch=db.batch();
    changed.slice(i,i+430).forEach(d=>batch.set(d.ref,{sellerPopularity:popularity,sellerPopularityUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}));
    await batch.commit();
  }
}
async function syncSellerPopularity(db,sellerId,{syncProducts=true}={}){
  const id=safeId(sellerId);
  if(!id)return{products:[],productCount:0,visibleProductCount:0,avgProductPopularity:0,popularity:0,pendingCount:0,approvedCount:0};
  const productSnap=await db.collection("products").where("sellerId","==",id).get();
  const stats=buildSellerStats(await withProductMetrics(db,productSnap.docs));
  const sellerRef=db.doc(`sellers/${id}`),sellerSnap=await sellerRef.get();
  if(sellerSnap.exists){
    const current=sellerSnap.data()||{};
    const needsSellerUpdate=Number(current.popularity||0)!==Number(stats.popularity||0)||current.popularityAuto!==true||String(current.popularityFormula||"")!=="approved_active_products_average"||Number(current.popularityProductCount||0)!==Number(stats.visibleProductCount||0);
    if(needsSellerUpdate){
      await sellerRef.set({
        popularity:stats.popularity,
        popularityAuto:true,
        popularityFormula:"approved_active_products_average",
        popularityProductCount:stats.visibleProductCount,
        popularityUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:admin.firestore.FieldValue.serverTimestamp()
      },{merge:true});
    }
  }
  if(syncProducts)await commitProductPopularitySnapshot(db,productSnap.docs,stats.popularity);
  return stats;
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
module.exports={admin,initAdmin,json,bearer,safeText,safeId,normLogin,loginKey,randomId,sellerUid,num,metricNum,metricMax,storePopularityNum,productPopularity,mergeProductMetrics,withProductMetrics,hashPassword,verifyPassword,verifyToken,isAdmin,publicSeller,isVisibleSellerProduct,averageProductPopularity,buildSellerStats,sellerStats,syncSellerPopularity,getSellerByDecoded};
