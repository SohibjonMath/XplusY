// OrzuMall v138 — secure balance checkout with atomic inventory reservation
const admin=require('firebase-admin');
const {pushNewOrder}=require('./_adminPush');
const {pushOrderUpdate}=require('./_customerPush');
const {normalizePickupShipping}=require('./_pickupPointsCommon');
const M=require('./_marketplaceOrderCommon');
const PM=require('./_productMetricsCommon');
const INV=require('./_inventoryCommon');
const PROMO=require('./_promoCommon');
const {refreshSellerTrustStats}=require('./_sellerTrustCommon');
function initAdmin(){if(admin.apps.length)return;const b64=process.env.FIREBASE_SERVICE_ACCOUNT_B64;if(!b64)throw new Error('Missing env FIREBASE_SERVICE_ACCOUNT_B64');admin.initializeApp({credential:admin.credential.cert(JSON.parse(Buffer.from(b64,'base64').toString('utf8')))})}
function json(statusCode,body){return{statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)}}
function bearer(e){const m=String(e.headers?.authorization||e.headers?.Authorization||'').match(/^Bearer\s+(.+)$/i);return m?m[1]:''}
function cleanName(v){const s=String(v==null?'':v).trim().replace(/\s+/g,' ');return!s||s.includes('@')?'':s}
function customerName(u={},d={}){return[cleanName(u.firstName),cleanName(u.lastName)].filter(Boolean).join(' ')||cleanName(u.name)||cleanName(u.fullName)||cleanName(d.name)||'Mijoz'}
function balance(u){return M.firstPrice(u?.balanceUZS,u?.balance,u?.walletUZS,u?.wallet,0)}
function shortId(len=6){return String(Math.floor(Math.random()*(10**len-1))+1).padStart(len,'0')}
async function allocate(db){for(let len=6;;len++){for(let i=0;i<60;i++){const id=shortId(len);if(!(await db.doc(`orders/${id}`).get()).exists)return id}}}
function deliveryFee(shipping){return Math.max(0,Math.min(500000,M.parsePrice(shipping?.deliveryFeeUZS??shipping?.feeUZS??0)))}
function errorStatus(message){const m=String(message||'');if(m.startsWith('OUT_OF_STOCK:'))return 409;if(m.startsWith('PRODUCT_INACTIVE:')||m.startsWith('PRODUCT_NOT_APPROVED:'))return 409;if(m.startsWith('PRODUCT_NOT_FOUND:')||m==='USER_NOT_FOUND')return 404;if(m.startsWith('PROMO_'))return 400;return 500}
exports.handler=async(event)=>{try{
  initAdmin();if(event.httpMethod!=='POST')return json(405,{ok:false,error:'method_not_allowed'});const token=bearer(event);if(!token)return json(401,{ok:false,error:'unauthorized'});let decoded;try{decoded=await admin.auth().verifyIdToken(token)}catch(_){return json(401,{ok:false,error:'bad_token'})}let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return json(400,{ok:false,error:'invalid_json'})}
  const db=admin.firestore();let catalog;try{catalog=await M.loadCatalogLines(db,body.items)}catch(e){return json(400,{ok:false,error:String(e.message||e)})}let shipping=body.shipping&&typeof body.shipping==='object'?body.shipping:null;if(String(shipping?.method||shipping?.service||'').toLowerCase()==='pickup_point')shipping=await normalizePickupShipping(db,shipping,catalog.totalWeightKg);const deliveryFeeUZS=deliveryFee(shipping);
  const orderId=await allocate(db),userRef=db.doc(`users/${decoded.uid}`),orderRef=db.doc(`orders/${orderId}`);
  const result=await db.runTransaction(async tx=>{
    const snap=await tx.get(userRef);if(!snap.exists)throw new Error('USER_NOT_FOUND');const u=snap.data()||{},before=balance(u);
    const promo=await PROMO.preparePromo(tx,db,{code:body.promoCode,uid:decoded.uid,subtotalUZS:catalog.subtotalUZS,orderId});
    const totalUZS=Math.max(0,catalog.subtotalUZS+deliveryFeeUZS-Number(promo.discountUZS||0));
    if(before<totalUZS)return{ok:false,balance:before,need:totalUZS-before};
    const inventory=await INV.reserveInventory(tx,db,catalog.lines,orderId);promo.apply();const after=before-totalUZS,now=admin.firestore.FieldValue.serverTimestamp(),shippingFinal=shipping||{method:'pickup',methodLabel:'Do‘kondan olib ketish',addressText:'Do‘kondan olib ketish',deliveryFeeUZS:0};
    tx.set(userRef,{balanceUZS:after,balance:after,updatedAt:now},{merge:true});const orderDoc={id:orderId,orderId,uid:decoded.uid,email:decoded.email||null,numericId:u.numericId!=null?String(u.numericId):null,userName:customerName(u,decoded),userPhone:String(u.phone||u.phoneNumber||u.tel||''),userTgChatId:String(u.telegramChatId||u.tgChatId||'').trim()||null,firstName:String(u.firstName||'')||null,lastName:String(u.lastName||'')||null,status:'new',paymentStatus:'paid',statusActor:'system',statusUpdatedAt:now,statusHistory:[{status:'new',action:'created',actorType:'system',actorName:'OrzuMall',reason:'Buyurtma qabul qilindi va balansdan to‘landi',at:admin.firestore.Timestamp.now()}],items:catalog.lines,totalUZS,productsTotalUZS:catalog.subtotalUZS,deliveryFeeUZS,amountTiyin:null,provider:'balance',currency:'UZS',pricing:{subtotalUZS:catalog.subtotalUZS,deliveryFeeUZS,discountUZS:Number(promo.discountUZS||0),totalUZS,promoCode:promo.code||null},promo:promo.code?{code:promo.code,discountUZS:Number(promo.discountUZS||0),type:promo.type||null,value:Number(promo.value||0)}:null,shipping:shippingFinal,orderType:'checkout',note:M.cleanText(body.note,500),source:'web',createdAt:now,paidAt:now,inventory,inventoryStatus:'reserved',...catalog.sellerSummary};tx.set(orderRef,orderDoc,{merge:false});return{ok:true,balance:after,userName:orderDoc.userName,orderDoc};
  });
  if(!result.ok)return json(402,{ok:false,error:'insufficient_balance',balanceUZS:result.balance,needUZS:result.need});await PM.recordPurchaseMetrics(db,catalog.lines,orderId).catch(()=>{});await Promise.all((catalog.sellerSummary?.sellerIds||[]).filter(id=>id&&id!=='orzumall').map(id=>refreshSellerTrustStats(db,id,{force:true}).catch(()=>{})));await pushNewOrder(db,result.orderDoc).catch(()=>{});await pushOrderUpdate(db,decoded.uid,orderId,'Buyurtmangiz qabul qilindi',`#${orderId} buyurtma balans orqali qabul qilindi. Holati: Yangi.`).catch(()=>{});return json(200,{ok:true,orderId,totalUZS:result.orderDoc.totalUZS,discountUZS:Number(result.orderDoc.pricing?.discountUZS||0),promoCode:result.orderDoc.pricing?.promoCode||null,balanceUZS:result.balance});
}catch(e){const m=String(e?.message||e);console.error('balancePay',e);return json(errorStatus(m),{ok:false,error:m.startsWith('OUT_OF_STOCK:')?'out_of_stock':m.toLowerCase(),detail:m.slice(0,180)})}};
