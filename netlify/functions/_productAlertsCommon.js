const admin=require('firebase-admin');
const C=require('./_sellerCommon');
const P=require('./_publicCatalogCommon');
const {pushToCustomer}=require('./_customerPush');
const F=()=>admin.firestore.FieldValue;
const txt=(v,n=500)=>C.safeText(v,n);
function alertDocId(type,productId,value){return C.safeId(`${type}_${productId}_${value}`)||`alert_${Date.now()}`}
function productImage(p={}){return txt(p.images?.[0]||p.image||p.imageUrl,900)}
async function writeNotification(db,uid,{type,title,body,productId,productName,productImageUrl,url,eventKey}){
  const id=alertDocId(type,productId,eventKey||'event');
  const ref=db.doc(`users/${uid}/notifications/${id}`),snap=await ref.get();if(snap.exists)return false;
  await ref.set({type,title,body,productId,productName,productImage:productImageUrl||'',url,read:false,createdAt:F().serverTimestamp()},{merge:false});
  await pushToCustomer(db,uid,{title,body,data:{type,productId:String(productId),url:String(url||'https://orzumall.uz/#home')}}).catch(()=>{});
  return true;
}
async function processUserAlerts(db,uid,{limit=160}={}){
  const snap=await db.collection(`users/${uid}/productAlerts`).limit(Math.max(1,Math.min(300,Number(limit)||160))).get();
  if(!snap.size)return{checked:0,notified:0};
  const refs=snap.docs.map(d=>db.doc(`products/${d.id}`));let productSnaps=[];try{productSnaps=await db.getAll(...refs)}catch(_){productSnaps=[]}
  const byId=new Map(productSnaps.filter(x=>x&&x.exists).map(x=>[x.id,x.data()||{}]));let notified=0;
  for(const doc of snap.docs){const a=doc.data()||{},p=byId.get(doc.id);if(!p||!P.visibleProduct(p))continue;const currentPrice=P.minPrice(p),currentStock=P.stockQty(p),patch={lastCheckedAt:F().serverTimestamp(),priceSnapshot:currentPrice,stockSnapshot:currentStock};
    if(a.priceDrop===true&&currentPrice>0&&Number(a.priceSnapshot||0)>0&&currentPrice<Number(a.priceSnapshot||0)&&Number(a.lastNotifiedPrice||0)!==currentPrice){const ok=await writeNotification(db,uid,{type:'price_drop',title:'Narx tushdi',body:`${txt(p.name||'Mahsulot',160)} narxi arzonlashdi: ${currentPrice.toLocaleString('uz-UZ')} so‘m.`,productId:doc.id,productName:txt(p.name,180),productImageUrl:productImage(p),url:`https://orzumall.uz/#product/${encodeURIComponent(doc.id)}`,eventKey:String(currentPrice)});if(ok)notified++;patch.lastNotifiedPrice=currentPrice;patch.lastPriceDropAt=F().serverTimestamp()}
    if(a.backInStock===true&&Number(a.stockSnapshot||0)<=0&&currentStock>0&&Number(a.lastNotifiedStock||0)!==currentStock){const ok=await writeNotification(db,uid,{type:'back_in_stock',title:'Mahsulot omborga qaytdi',body:`${txt(p.name||'Mahsulot',160)} yana sotuvda.`,productId:doc.id,productName:txt(p.name,180),productImageUrl:productImage(p),url:`https://orzumall.uz/#product/${encodeURIComponent(doc.id)}`,eventKey:String(currentStock)});if(ok)notified++;patch.lastNotifiedStock=currentStock;patch.lastBackInStockAt=F().serverTimestamp()}
    const changed=Number(a.priceSnapshot||0)!==currentPrice||Number(a.stockSnapshot||0)!==currentStock||('lastNotifiedPrice' in patch)||('lastNotifiedStock' in patch);
    if(changed){await doc.ref.set(patch,{merge:true}).catch(()=>{});await db.doc(`productAlerts/${doc.id}/users/${uid}`).set(patch,{merge:true}).catch(()=>{})}
  }
  return{checked:snap.size,notified};
}
async function processAllAlerts(db,{limit=600}={}){const snap=await db.collectionGroup('productAlerts').limit(Math.max(1,Math.min(1200,Number(limit)||600))).get().catch(()=>null);if(!snap?.size)return{users:0,checked:0,notified:0};const uids=[...new Set(snap.docs.map(d=>String(d.ref.parent.parent?.id||'')).filter(Boolean))];let checked=0,notified=0;for(const uid of uids.slice(0,400)){const out=await processUserAlerts(db,uid,{limit:180}).catch(()=>({checked:0,notified:0}));checked+=out.checked;notified+=out.notified}return{users:uids.length,checked,notified}}
module.exports={processUserAlerts,processAllAlerts};
