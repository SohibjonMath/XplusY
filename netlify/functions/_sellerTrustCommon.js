const C=require('./_sellerCommon');
const F=()=>C.admin.firestore.FieldValue;
function ts(v){try{return v?.toMillis?Number(v.toMillis()):Number(v?.seconds??v?._seconds??0)*1000||Number(v)||Number(new Date(v))||0}catch(_){return 0}}
function statusNorm(v){const s=C.safeText(v||'new',40).toLowerCase();return({pending:'new',pending_cash:'new',pending_payment:'new',processing:'packing',shipped:'shipping',completed:'delivered',canceled:'cancelled',cancelled:'cancelled'}[s]||s)}
function arr(v){return Array.isArray(v)?v:[]}
function orderHasSeller(order={},sellerId=''){
  const id=C.safeId(sellerId);if(!id)return false;
  if(arr(order.sellerIds).map(C.safeId).includes(id))return true;
  return arr(order.items).some(x=>C.safeId(x?.sellerId||'orzumall')===id);
}
function publicTrust(data={}){
  const partnerSinceMs=Math.max(0,Math.round(Number(data.partnerSinceMs||ts(data.createdAt)||ts(data.joinedAt)||ts(data.updatedAt))||0));
  return{
    partnerSinceMs,
    completedOrdersCount:Math.max(0,Math.round(Number(data.completedOrdersCount||0)||0)),
    totalSellerOrdersCount:Math.max(0,Math.round(Number(data.totalSellerOrdersCount||0)||0)),
    trustStatsUpdatedAtMs:Math.max(0,Math.round(Number(data.trustStatsUpdatedAtMs||ts(data.trustStatsUpdatedAt))||0))
  }
}
async function sellerOrders(db,sellerId,{includeLegacy=false}={}){
  const id=C.safeId(sellerId);if(!id)return[];const byId=new Map();let snap;
  try{
    snap=await db.collection('orders').where('sellerIds','array-contains',id).select('sellerIds','items','status','createdAt','updatedAt').get();
    snap.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(x=>orderHasSeller(x,id)).forEach(x=>byId.set(x.id,x));
  }catch(_){includeLegacy=true}
  if(includeLegacy){
    snap=await db.collection('orders').select('sellerIds','items','status','createdAt','updatedAt').get();
    snap.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(x=>orderHasSeller(x,id)).forEach(x=>byId.set(x.id,x));
  }
  return [...byId.values()];
}
async function computeSellerTrustStats(db,sellerId,seller={}){
  const orders=await sellerOrders(db,sellerId,{includeLegacy:seller.trustLegacyBackfilled!==true});let completed=0;
  for(const order of orders){if(statusNorm(order.status)==='delivered')completed+=1}
  const partnerSinceMs=Math.max(0,Math.round(Number(ts(seller.createdAt)||ts(seller.joinedAt)||ts(seller.updatedAt))||0));
  return{partnerSinceMs,completedOrdersCount:completed,totalSellerOrdersCount:orders.length,trustLegacyBackfilled:true,trustStatsUpdatedAtMs:Date.now()}
}
async function refreshSellerTrustStats(db,sellerId,{seller=null,force=false,maxAgeMs=10*60*1000}={}){
  const id=C.safeId(sellerId);if(!id)return publicTrust(seller||{});
  const ref=db.doc(`sellers/${id}`);let data=seller;
  if(!data){const snap=await ref.get();if(!snap.exists)return publicTrust({});data=snap.data()||{}}
  const cached=publicTrust(data||{}),age=Date.now()-Number(cached.trustStatsUpdatedAtMs||0);
  if(!force&&cached.trustStatsUpdatedAtMs&&age>=0&&age<maxAgeMs)return cached;
  const stats=await computeSellerTrustStats(db,id,data||{});
  await ref.set({...stats,trustStatsUpdatedAt:F().serverTimestamp(),updatedAt:F().serverTimestamp()},{merge:true});
  return stats;
}
function sellerIdsFromOrder(order={}){
  const ids=new Set(arr(order.sellerIds).map(C.safeId).filter(x=>x&&x!=='orzumall'));
  arr(order.items).forEach(x=>{const id=C.safeId(x?.sellerId||'');if(id&&id!=='orzumall')ids.add(id)});
  return [...ids];
}
module.exports={ts,statusNorm,orderHasSeller,publicTrust,computeSellerTrustStats,refreshSellerTrustStats,sellerIdsFromOrder};
