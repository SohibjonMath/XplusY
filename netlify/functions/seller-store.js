const C=require('./_sellerCommon');
const T=require('./_sellerTrustCommon');
const A=require('./_productAlertsCommon');
const F=()=>C.admin.firestore.FieldValue;
const arr=v=>Array.isArray(v)?v:[];
const money=v=>Math.max(0,Math.round(Number(v)||0));
const txt=(v,n=500)=>C.safeText(v,n);
const safeTimestamp=v=>{try{return v?.toMillis? v.toMillis(): Number(v?.seconds||v?._seconds||0)*1000||Number(v)||0}catch(_){return 0}};
function cleanImages(v){return arr(v).map(x=>txt(x,900)).filter(Boolean).slice(0,18)}
function cleanTextArray(v,max=80,limit=50){return arr(v).map(x=>txt(x,max)).filter(Boolean).slice(0,limit)}
function cleanColors(v){return arr(v).map(x=>typeof x==='string'?x:{name:txt(x?.name,80),hex:txt(x?.hex,30)}).slice(0,30)}
function cleanVariants(v){return arr(v).map(x=>({color:txt(x?.color,80)||null,size:txt(x?.size,80)||null,price:money(x?.price??x?.priceUZS),oldPrice:money(x?.oldPrice),sku:txt(x?.sku,100),stockQty:Math.max(0,Math.round(Number(x?.stockQty)||0))})).slice(0,120)}
function cleanImagesByColor(v){const out={};if(v&&typeof v==='object')Object.entries(v).slice(0,30).forEach(([k,urls])=>{const key=txt(k,80),imgs=cleanImages(urls);if(key&&imgs.length)out[key]=imgs});return out}
function publicProduct(id,d={}){return{
  id:String(d.id||id),name:txt(d.name,240),name_ru:txt(d.name_ru,240),description:txt(d.description,6000),description_ru:txt(d.description_ru,6000),subtitle:txt(d.subtitle,240),price:money(d.price??d.priceUZS),oldPrice:money(d.oldPrice),currency:txt(d.currency||'UZS',20),images:cleanImages(d.images),imagesByColor:cleanImagesByColor(d.imagesByColor),image:txt(d.image,900),colors:cleanColors(d.colors),sizes:cleanTextArray(d.sizes,80,40),variants:cleanVariants(d.variants),tags:cleanTextArray(d.tags,100,50),badges:cleanTextArray(d.badges,100,10),badge:txt(d.badge,100),categoryId:txt(d.categoryId,100),subcategoryId:txt(d.subcategoryId,100),categoryPathIds:cleanTextArray(d.categoryPathIds,100,8),sku:txt(d.sku,120),stockQty:Math.max(0,Math.round(Number(d.stockQty)||0)),weightKg:Number(d.weightKg??d.weight??0)||0,productType:txt(d.productType,40),youtubeUrl:txt(d.youtubeUrl||d.videoUrl,900),fulfillmentType:txt(d.fulfillmentType||d.fulfillment||'stock',50),deliveryMinDays:Number(d.deliveryMinDays||1)||1,deliveryMaxDays:Number(d.deliveryMaxDays||7)||7,prepayRequired:!!d.prepayRequired,popularScore:C.productPopularity(d),metricScore:C.metricMax(d.metricScore,d.engagementScore,d.score),engagementScore:C.metricMax(d.engagementScore,d.metricScore,d.score),views:C.metricMax(d.views,d.viewCount,d.viewsCount,d.productViews,d.popularViews),viewsCount:C.metricMax(d.views,d.viewCount,d.viewsCount,d.productViews,d.popularViews),cartAdds:C.metricMax(d.cartAdds,d.cartAddCount,d.addToCartCount),favoriteAdds:C.metricMax(d.favoriteAdds,d.favorites,d.favoriteCount,d.wishlistAdds),purchases:C.metricMax(d.purchases,d.purchaseCount,d.soldCount,d.salesCount),soldCount:C.metricMax(d.soldCount,d.purchases,d.purchaseCount,d.salesCount),sellerId:txt(d.sellerId,100),sellerName:txt(d.sellerName,180),sellerLogo:txt(d.sellerLogo,900),sellerPopularity:C.storePopularityNum(d.sellerPopularity),sellerVerified:d.sellerVerified!==false,sellerActive:d.sellerActive!==false,isOrzuMallVerified:false,ownerType:'seller',createdByRole:'seller',status:'approved',_created:safeTimestamp(d.createdAt||d.updatedAt),_price:money(d.price??d.priceUZS)
}}
function publicStore(id,d={},productCount=0,popularity=d.popularity,trust={}){const t=T.publicTrust({...d,...trust});return{id,storeName:txt(d.storeName||d.name,180),logoUrl:txt(d.logoUrl,900),bannerUrl:txt(d.bannerUrl,900),description:txt(d.description,1600),workingHours:txt(d.workingHours,180),popularity:C.storePopularityNum(popularity),popularityAuto:true,popularityProductCount:Math.max(0,Math.round(Number(productCount)||0)),followersCount:Math.max(0,Math.round(Number(d.followersCount||0)||0)),verified:d.verified!==false,productCount:Math.max(0,Math.round(Number(productCount)||0)),active:d.active!==false,partnerSinceMs:t.partnerSinceMs,completedOrdersCount:t.completedOrdersCount,totalSellerOrdersCount:t.totalSellerOrdersCount,sellerRating:Number(d.sellerRating||0)||0,sellerRatingScore:Math.max(0,Math.round(Number(d.sellerRatingScore||0)||0)),sellerRatingBadge:txt(d.sellerRatingBadge,60),slaOnTimeRate:Math.max(0,Math.round(Number(d.slaOnTimeRate||0)||0))}}
async function decodedOptional(event){try{const token=C.bearer(event);if(!token)return null;return await C.admin.auth().verifyIdToken(token,true)}catch(_){return null}}
async function decodedRequired(event){const d=await decodedOptional(event);if(!d?.uid)throw new Error('unauthorized');return d}
async function loadStore(db,id){const snap=await db.doc(`sellers/${id}`).get();if(!snap.exists)return null;const data={id:snap.id,...(snap.data()||{})};if(data.active===false)return null;return data}
async function loadProducts(db,sellerId){let snap;try{snap=await db.collection('products').where('sellerId','==',sellerId).limit(600).get()}catch(_){return []}const rows=await C.withProductMetrics(db,snap.docs);return rows.filter(x=>String(x.status||'').toLowerCase()==='approved'&&x.sellerActive!==false&&x.isActive!==false).map(x=>publicProduct(x.id,x)).sort((a,b)=>(b._created||0)-(a._created||0))}
async function followerStatus(db,uid,sellerId){if(!uid)return false;const s=await db.doc(`storeFollowers/${sellerId}/users/${uid}`).get();return s.exists&&(s.data()?.active!==false)}
async function notificationList(db,uid){let snap;try{snap=await db.collection(`users/${uid}/notifications`).orderBy('createdAt','desc').limit(80).get()}catch(_){snap=await db.collection(`users/${uid}/notifications`).limit(80).get()}const rows=snap.docs.map(d=>{const x=d.data()||{};return{id:d.id,type:txt(x.type,80),title:txt(x.title,180),body:txt(x.body,700),sellerId:txt(x.sellerId,100),storeName:txt(x.storeName,180),storeLogo:txt(x.storeLogo,900),productId:txt(x.productId,100),productName:txt(x.productName,240),productImage:txt(x.productImage,900),url:txt(x.url,1000),read:!!x.read,createdAt:safeTimestamp(x.createdAt)}}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));return{notifications:rows,unreadCount:rows.filter(x=>!x.read).length}}
function searchNorm(v){return txt(v,1200).toLowerCase().replace(/[’`ʻʼ]/g,"'").replace(/\s+/g,' ').trim()}
function storeSearchRank(d={},q=''){
  const name=searchNorm(d.storeName||d.name),description=searchNorm(d.description),id=searchNorm(d.id),needle=searchNorm(q);
  let rank=0;if(name===needle)rank+=1000;if(name.startsWith(needle))rank+=500;if(name.includes(needle))rank+=250;if(description.includes(needle))rank+=45;if(id.includes(needle))rank+=10;
  if(!rank)return 0;return rank+Math.min(100,Number(d.popularity||0)||0)+Math.min(100,Number(d.followersCount||0)||0)/10;
}
async function searchStores(db,rawQuery,max=12){
  const q=searchNorm(rawQuery);if(!q)return[];let snap;
  try{snap=await db.collection('sellers').where('active','==',true).limit(500).get()}catch(_){snap=await db.collection('sellers').limit(500).get()}
  const picked=snap.docs.map(doc=>({id:doc.id,...(doc.data()||{})})).filter(d=>d.active!==false).map(d=>({d,rank:storeSearchRank(d,q)})).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||Number(b.d.followersCount||0)-Number(a.d.followersCount||0)||String(a.d.storeName||'').localeCompare(String(b.d.storeName||''))).slice(0,Math.max(1,Math.min(30,Math.round(Number(max)||12))));
  const hydrated=picked.map(({d})=>({...d,...T.publicTrust(d)}));
  return hydrated.map(d=>publicStore(d.id,d,d.popularityProductCount||d.productCount||0,d.popularity,d));
}
exports.handler=async event=>{try{
  C.initAdmin();if(event.httpMethod!=='POST')return C.json(405,{ok:false,error:'method_not_allowed'});
  let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return C.json(400,{ok:false,error:'invalid_json'})}
  const action=txt(body.action,80)||'public_store',db=C.admin.firestore();
  if(action==='search_stores'){const stores=await searchStores(db,body.query,body.limit);return C.json(200,{ok:true,stores,count:stores.length})}
  if(action==='public_store'){
    const sellerId=C.safeId(body.sellerId);if(!sellerId)return C.json(400,{ok:false,error:'seller_id_required'});
    const seller=await loadStore(db,sellerId);if(!seller)return C.json(404,{ok:false,error:'store_not_found'});
    const products=await loadProducts(db,sellerId),decoded=await decodedOptional(event),following=decoded?.uid?await followerStatus(db,decoded.uid,sellerId):false;
    const popularity=C.averageProductPopularity(products);
    products.forEach(p=>{p.sellerPopularity=popularity});
    const trust=T.publicTrust(seller);
    return C.json(200,{ok:true,store:publicStore(sellerId,{...seller,...trust},products.length,popularity,trust),products,following});
  }
  if(action==='toggle_follow'){
    const decoded=await decodedRequired(event),uid=String(decoded.uid),sellerId=C.safeId(body.sellerId);if(!sellerId)return C.json(400,{ok:false,error:'seller_id_required'});
    const seller=await loadStore(db,sellerId);if(!seller)return C.json(404,{ok:false,error:'store_not_found'});const following=body.following!==false;
    const sellerRef=db.doc(`sellers/${sellerId}`),followerRef=db.doc(`storeFollowers/${sellerId}/users/${uid}`),subRef=db.doc(`users/${uid}/storeSubscriptions/${sellerId}`);
    let followersCount=0;
    await db.runTransaction(async tx=>{const [ss,fs]=await Promise.all([tx.get(sellerRef),tx.get(followerRef)]);if(!ss.exists||ss.data()?.active===false)throw new Error('store_not_found');const old=fs.exists&&fs.data()?.active!==false;const cur=Math.max(0,Math.round(Number(ss.data()?.followersCount||0)||0));followersCount=Math.max(0,cur+(following&&!old?1:(!following&&old?-1:0)));tx.set(sellerRef,{followersCount,updatedAt:F().serverTimestamp()},{merge:true});if(following){const snap={uid,sellerId,storeName:txt(seller.storeName,180),storeLogo:txt(seller.logoUrl,900),active:true,updatedAt:F().serverTimestamp(),createdAt:fs.exists?(fs.data()?.createdAt||F().serverTimestamp()):F().serverTimestamp()};tx.set(followerRef,snap,{merge:true});tx.set(subRef,snap,{merge:true})}else{tx.delete(followerRef);tx.delete(subRef)}});
    return C.json(200,{ok:true,following,followersCount});
  }
  if(action==='notifications_list'){
    const decoded=await decodedRequired(event);await A.processUserAlerts(db,String(decoded.uid)).catch(()=>{});return C.json(200,{ok:true,...await notificationList(db,String(decoded.uid))});
  }
  if(action==='notification_read'){
    const decoded=await decodedRequired(event),uid=String(decoded.uid),id=C.safeId(body.id);if(!id)return C.json(400,{ok:false,error:'notification_id_required'});await db.doc(`users/${uid}/notifications/${id}`).set({read:true,readAt:F().serverTimestamp()},{merge:true});return C.json(200,{ok:true});
  }
  if(action==='notifications_read_all'){
    const decoded=await decodedRequired(event);const snap=await db.collection(`users/${decoded.uid}/notifications`).where('read','==',false).limit(300).get().catch(()=>null);if(snap?.size){const batch=db.batch();snap.docs.forEach(d=>batch.set(d.ref,{read:true,readAt:F().serverTimestamp()},{merge:true}));await batch.commit()}return C.json(200,{ok:true});
  }
  return C.json(400,{ok:false,error:'unknown_action'});
}catch(e){console.error('seller-store',e);const m=String(e?.message||e).slice(0,180)||'server_error';return C.json(m==='unauthorized'?401:(m==='store_not_found'?404:500),{ok:false,error:m})}}
