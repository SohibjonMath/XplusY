const C=require('./_sellerCommon');
const F=()=>C.admin.firestore.FieldValue;
const T=()=>C.admin.firestore.Timestamp;
const arr=v=>Array.isArray(v)?v:[];
const num=v=>Math.max(0,Math.round(Number(v)||0));
const ts=v=>{try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();return Number(v?.seconds??v?._seconds??0)*1000||Number(new Date(v))||0}catch(_){return 0}};
const statusNorm=v=>({pending:'new',processing:'packing',shipped:'shipping',completed:'delivered',canceled:'cancelled'}[String(v||'').toLowerCase()]||String(v||'new').toLowerCase());
const SLA_DEFAULTS={acceptMinutes:120,readyMinutes:480,handoverMinutes:240};
function sellerItems(order={},sellerId=''){return arr(order.items).filter(it=>C.safeId(it?.sellerId||'orzumall')===C.safeId(sellerId))}
function progress(order={},sellerId=''){return order?.sellerProgress?.[sellerId]||{}}
function stageStartMs(order={},sellerId='',stage='new'){
 const p=progress(order,sellerId),created=ts(order.createdAt)||Date.now(),updated=ts(p.updatedAt)||ts(order.statusUpdatedAt)||created;
 if(stage==='new')return created;
 if(stage==='packing')return updated;
 if(stage==='ready')return updated;
 return updated;
}
function slaConfig(seller={}){const s=seller.slaConfig||{};return{acceptMinutes:Math.max(15,num(s.acceptMinutes||SLA_DEFAULTS.acceptMinutes)),readyMinutes:Math.max(30,num(s.readyMinutes||SLA_DEFAULTS.readyMinutes)),handoverMinutes:Math.max(30,num(s.handoverMinutes||SLA_DEFAULTS.handoverMinutes))}}
function assessOrder(order={},sellerId='',seller={}){
 const global=statusNorm(order.status),local=statusNorm(progress(order,sellerId)?.status||'new'),cfg=slaConfig(seller),now=Date.now();
 if(['cancelled','returned','return_rejected','delivered'].includes(global)||['handed_over','shipping','delivered','cancelled','returned'].includes(local))return{overdue:false,stage:local,dueAtMs:0,lateMinutes:0,label:''};
 const stage=['new','paid'].includes(local)?'new':local==='packing'?'packing':local==='ready'?'ready':'new';
 const limit=stage==='new'?cfg.acceptMinutes:(stage==='packing'?cfg.readyMinutes:cfg.handoverMinutes),start=stageStartMs(order,sellerId,stage),due=start+limit*60000,late=Math.max(0,Math.floor((now-due)/60000));
 const label=stage==='new'?'Yig‘ishga olish kechikdi':stage==='packing'?'Tayyorlash kechikdi':'Logistikaga topshirish kechikdi';
 return{overdue:late>0,stage,dueAtMs:due,lateMinutes:late,label,limitMinutes:limit};
}
function calculateSellerSla(orders=[],sellerId='',seller={}){
 const rows=arr(orders).filter(o=>sellerItems(o,sellerId).length),open=[],final=[];let overdueOpen=0,delivered=0,cancelled=0,returned=0,onTimeHandover=0,handed=0,lateClosed=0;
 rows.forEach(o=>{const global=statusNorm(o.status),local=statusNorm(progress(o,sellerId)?.status||'new'),a=assessOrder(o,sellerId,seller);if(a.overdue){overdueOpen++;open.push({orderId:String(o.orderId||o.id||''),sellerId,createdAt:o.createdAt||null,status:local,...a})}if(global==='delivered')delivered++;if(global==='cancelled')cancelled++;if(global==='returned')returned++;if(['handed_over','shipping','delivered'].includes(local)||global==='delivered'){handed++;const h=progress(o,sellerId)?.updatedAt||o.statusUpdatedAt;if(h&&ts(h)<=((ts(o.createdAt)||0)+slaConfig(seller).acceptMinutes*60000+slaConfig(seller).readyMinutes*60000+slaConfig(seller).handoverMinutes*60000))onTimeHandover++;else lateClosed++}if(['delivered','cancelled','returned'].includes(global))final.push(o)});
 const total=rows.length,finalCount=Math.max(1,final.length),overdueRate=total?overdueOpen/total:0,cancelRate=cancelled/finalCount,returnRate=returned/finalCount,onTimeRate=handed?onTimeHandover/handed:1;
 const score=Math.max(0,Math.min(100,Math.round(100-overdueRate*42-cancelRate*26-returnRate*20-(1-onTimeRate)*18)));
 const rating=Math.max(1,Math.min(5,Math.round((1+score/25)*10)/10));
 const badge=score>=92?'Ajoyib':score>=80?'Tezkor':score>=65?'Barqaror':score>=45?'Nazorat kerak':'Xavfli';
 return{sellerId,totalOrders:total,openOrders:rows.length-final.length,deliveredOrders:delivered,cancelledOrders:cancelled,returnedOrders:returned,overdueOpen,onTimeHandover,lateClosed,onTimeRate:Math.round(onTimeRate*100),score,rating,badge,alerts:open.sort((a,b)=>b.lateMinutes-a.lateMinutes)};
}
function onboarding(seller={},products=[]){
 const checks=[
  ['profile','Do‘kon nomi',!!seller.storeName],['logo','Do‘kon logosi',!!seller.logoUrl],['banner','Do‘kon banneri',!!seller.bannerUrl],['description','Do‘kon tavsifi',String(seller.description||'').length>=20],['phone','Telefon raqami',String(seller.phone||'').length>=7],['workingHours','Ish vaqti',!!seller.workingHours],['location','Do‘kon koordinatasi',!!(Number(seller.lat)&&Number(seller.lng))],['firstProduct','Birinchi mahsulot',arr(products).length>0],['approvedProduct','Tasdiqlangan mahsulot',arr(products).some(p=>String(p.status||'').toLowerCase()==='approved')]
 ].map(([id,label,done])=>({id,label,done:!!done}));
 const done=checks.filter(x=>x.done).length,total=checks.length,percent=Math.round(done*100/Math.max(1,total));
 return{done,total,percent,completed:done===total,tasks:checks};
}
async function rawOrders(db,sellerId){let snap;try{snap=await db.collection('orders').where('sellerIds','array-contains',sellerId).limit(800).get()}catch(_){snap=await db.collection('orders').limit(1000).get()}return snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>sellerItems(o,sellerId).length)}
async function refreshSellerSla(db,sellerId,{seller=null,orders=null}={}){const id=C.safeId(sellerId);if(!id)return null;const sellerSnap=seller?null:await db.doc(`sellers/${id}`).get(),s=seller||{id,...(sellerSnap?.data?.()||{})},os=orders||await rawOrders(db,id),metrics=calculateSellerSla(os,id,s),patch={sellerRating:metrics.rating,sellerRatingScore:metrics.score,sellerRatingBadge:metrics.badge,slaOverdueOpen:metrics.overdueOpen,slaOnTimeRate:metrics.onTimeRate,slaUpdatedAt:F().serverTimestamp(),updatedAt:F().serverTimestamp()};await db.doc(`sellers/${id}`).set(patch,{merge:true});await db.doc(`sellerSlaMetrics/${id}`).set({...metrics,updatedAt:F().serverTimestamp()},{merge:true});return metrics}
function publicRating(seller={}){return{sellerRating:Number(seller.sellerRating||0)||0,sellerRatingScore:num(seller.sellerRatingScore),sellerRatingBadge:C.safeText(seller.sellerRatingBadge||'',60),slaOverdueOpen:num(seller.slaOverdueOpen),slaOnTimeRate:num(seller.slaOnTimeRate)}}
function maskPayment(v=''){const s=String(v||'').replace(/\s+/g,' ').trim();if(!s)return'';const digits=s.replace(/\D/g,'');if(digits.length>=8)return`${digits.slice(0,4)} •••• •••• ${digits.slice(-4)}`;return s.slice(0,4)+'••••'}
function lineGross(it={}){return num(it.sellerGrossUZS??it.lineTotalUZS??((Number(it.unitPriceUZS||it.priceUZS||it.price)||0)*(Number(it.qty||1)||1)))}
function accounting(orders=[],sellerId='',payouts=[],requests=[]){let deliveredNet=0,pendingNet=0,totalSales=0,commission=0;arr(orders).forEach(o=>{const items=sellerItems(o,sellerId),a=o?.sellerAccounting?.[sellerId]||{},gross=num(a.grossUZS||items.reduce((s,x)=>s+lineGross(x),0)),net=num(a.netUZS||(gross-num(a.commissionUZS))),st=statusNorm(o.status),local=statusNorm(progress(o,sellerId)?.status||'new');if(st==='delivered'){totalSales+=gross;deliveredNet+=net;commission+=Math.max(0,gross-net)}else if(!['cancelled','returned','return_rejected'].includes(st)&&!['cancelled','returned'].includes(local))pendingNet+=net});const paid=arr(payouts).filter(x=>String(x.status||'').toLowerCase()==='paid').reduce((s,x)=>s+num(x.amountUZS||x.amount),0),pendingPayout=arr(requests).filter(x=>['pending','approved'].includes(String(x.status||'').toLowerCase())).reduce((s,x)=>s+num(x.amountUZS),0);return{availableBalanceUZS:Math.max(0,deliveredNet-paid-pendingPayout),pendingBalanceUZS:pendingNet,totalSalesUZS:totalSales,totalNetUZS:deliveredNet,paidOutUZS:paid,pendingPayoutUZS:pendingPayout,commissionUZS:commission}}
module.exports={F,T,arr,num,ts,statusNorm,sellerItems,progress,slaConfig,assessOrder,calculateSellerSla,onboarding,rawOrders,refreshSellerSla,publicRating,maskPayment,accounting};
