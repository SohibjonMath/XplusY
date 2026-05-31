// OrzuMall v48 — strict chained lifecycle; customer guided cancel reasons; admin can mark returned during shipping
const admin = require("firebase-admin");
const { pushOrderStateChanged } = require('./_adminPush');
const { pushToCustomer } = require('./_customerPush');

function initAdmin(){
  if(admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if(!b64) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_B64");
  const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
function json(statusCode, body){
  return { statusCode, headers:{"content-type":"application/json; charset=utf-8"}, body:JSON.stringify(body) };
}
function bearer(event){
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}
function safeText(v, max=800){ return String(v == null ? "" : v).trim().slice(0,max); }
function safeId(v){ const s=String(v||"").trim(); return s && s.length<=128 && !s.includes("/") ? s : ""; }
function num(v){ const n=Number(v); return Number.isFinite(n) ? n : 0; }
function normalizeStatus(v){
  const s=String(v||"").trim().toLowerCase();
  const map={ pending:"new", pending_cash:"new", pending_payment:"new", shared_telegram:"new", telegram:"new", processing:"packing", shipped:"shipping", completed:"delivered", canceled:"cancelled", rejected:"cancelled", declined:"cancelled" };
  return map[s] || s || "new";
}
async function adminAllowed(decoded, db){
  const email=String(decoded?.email||"").trim().toLowerCase();
  const configured=String(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  const allow=new Set(["sohibjonmath@gmail.com", ...configured]);
  if(email && allow.has(email)) return true;
  try{
    const snap=await db.doc("configs/admins").get();
    const emails=snap.exists && Array.isArray(snap.data()?.emails) ? snap.data().emails.map(x=>String(x||"").trim().toLowerCase()) : [];
    return !!email && emails.includes(email);
  }catch(_e){ return false; }
}
function readBalance(u){
  for(const k of ["balanceUZS","balance","walletUZS","wallet"]){
    const n=Number(u?.[k]);
    if(Number.isFinite(n)) return n;
  }
  return 0;
}
function isBalanceOrder(order){ return String(order?.provider||"").toLowerCase()==="balance"; }
function isRefundStatus(status){ return ["cancelled","returned"].includes(normalizeStatus(status)); }
function adminTransitionAllowed(previous,next){
  const from=normalizeStatus(previous);
  const to=normalizeStatus(next);
  const map={
    new:["packing","cancelled"],
    paid:["packing","cancelled"],
    packing:["shipping","cancelled"],
    shipping:["delivered","returned","cancelled"],
    delivered:["returned","cancelled"],
    return_requested:["returned","return_rejected","cancelled"],
    return_rejected:["cancelled"],
    cancelled:[],
    returned:[]
  };
  return (map[from]||[]).includes(to);
}
function lifecycleEntry({status, actorType, actorUid, actorName, reason, action}){
  return {
    status: normalizeStatus(status),
    action: safeText(action || "status_update", 60),
    actorType: safeText(actorType || "system", 30),
    actorUid: safeText(actorUid || "", 160),
    actorName: safeText(actorName || "", 160),
    reason: safeText(reason || "", 800),
    at: admin.firestore.Timestamp.now()
  };
}
async function notify(db, uid, title, text, type="order"){
  if(!uid) return;
  try{
    await db.collection("notifications").add({
      targetType:"uid", targetUid:uid, type, title:safeText(title,160), body:safeText(text,800), text:safeText(text,800),
      createdAt:admin.firestore.FieldValue.serverTimestamp(), active:true
    });
    await pushToCustomer(db,uid,{title:safeText(title,160),body:safeText(text,500),channelId:type==="order"?"orzumall_orders_voice_v3":"orzumall_general_voice_v3",data:{type,url:"https://orzumall.uz/#profile"}}).catch(()=>{});
  }catch(_e){}
}
async function txUpdateWithOptionalRefund(db, orderId, updater){
  const orderRef=db.doc(`orders/${orderId}`);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(orderRef);
    if(!snap.exists) throw new Error("ORDER_NOT_FOUND");
    const order={id:orderId,...(snap.data()||{})};
    const update=await updater({tx,order,orderRef});
    tx.set(orderRef, update.patch || {}, {merge:true});
    return {order, patch:update.patch||{}, result:update.result||{}};
  });
}
async function maybeRefundBalance({tx, db, order, orderRef, patch, actorType, reason}){
  if(!isBalanceOrder(order)) return {refunded:false, amountUZS:0};
  const existing=order.refund || {};
  if(existing.status==="refunded" || existing.processed===true) return {refunded:false, already:true, amountUZS:num(existing.amountUZS)};
  const uid=String(order.uid||"");
  if(!uid) return {refunded:false, amountUZS:0};
  const amountUZS=Math.max(0, num(order.totalUZS));
  if(!amountUZS) return {refunded:false, amountUZS:0};
  const userRef=db.doc(`users/${uid}`);
  const userSnap=await tx.get(userRef);
  if(!userSnap.exists) return {refunded:false, amountUZS:0};
  const balance=readBalance(userSnap.data()||{});
  const next=balance+amountUZS;
  tx.set(userRef,{balanceUZS:next,balance:next,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  patch.refund={status:"refunded",processed:true,amountUZS,actorType:safeText(actorType,30),reason:safeText(reason,800),refundedAt:admin.firestore.Timestamp.now()};
  return {refunded:true, amountUZS, balanceUZS:next};
}

exports.handler=async(event)=>{
  try{
    initAdmin();
    if(event.httpMethod!=="POST") return json(405,{ok:false,error:"method_not_allowed"});
    const token=bearer(event);
    if(!token) return json(401,{ok:false,error:"unauthorized"});
    let decoded;
    try{ decoded=await admin.auth().verifyIdToken(token); }
    catch(_e){ return json(401,{ok:false,error:"bad_token"}); }
    let body={};
    try{ body=event.body ? JSON.parse(event.body) : {}; }
    catch(_e){ return json(400,{ok:false,error:"invalid_json"}); }
    const action=safeText(body.action,80);
    const orderId=safeId(body.orderId);
    if(!orderId) return json(400,{ok:false,error:"order_id_required"});
    const uid=String(decoded.uid||"");
    const db=admin.firestore();

    if(action==="cancel_order"){
      const reason=safeText(body.reason,800);
      if(reason.length<4) return json(400,{ok:false,error:"cancel_reason_required"});
      const out=await txUpdateWithOptionalRefund(db,orderId,async({tx,order,orderRef})=>{
        if(String(order.uid||"")!==uid) throw new Error("FORBIDDEN");
        const st=normalizeStatus(order.status);
        if(!["new","paid","packing","shipping"].includes(st)) throw new Error("CANCEL_NOT_ALLOWED");
        const entry=lifecycleEntry({status:"cancelled",actorType:"customer",actorUid:uid,actorName:order.userName||"Mijoz",reason,action:"cancelled"});
        const patch={
          status:"cancelled", statusNote:reason, statusActor:"customer", statusUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),
          cancellation:{by:"customer",reason,cancelledAt:admin.firestore.Timestamp.now()},
          statusHistory:admin.firestore.FieldValue.arrayUnion(entry), updatedAt:admin.firestore.FieldValue.serverTimestamp()
        };
        const refund=await maybeRefundBalance({tx,db,order,orderRef,patch,actorType:"customer",reason});
        return {patch,result:{refund}};
      });
      await notify(db,uid,"Buyurtma bekor qilindi",`#${orderId} buyurtma siz tomonidan bekor qilindi. Sabab: ${reason}`);
      return json(200,{ok:true,status:"cancelled",...(out.result||{})});
    }

    if(action==="request_return"){
      // v46: qaytarish faqat OrzuMall operatori tomonidan admin panelda boshqariladi.
      return json(403,{ok:false,error:"customer_return_disabled"});
    }

    if(action==="submit_review"){
      const stars=Math.max(1,Math.min(5,Math.round(num(body.stars))));
      const text=safeText(body.text,1000);
      if(!stars || text.length<2) return json(400,{ok:false,error:"review_required"});
      const orderRef=db.doc(`orders/${orderId}`);
      const snap=await orderRef.get();
      if(!snap.exists) return json(404,{ok:false,error:"order_not_found"});
      const order={id:orderId,...(snap.data()||{})};
      if(String(order.uid||"")!==uid) return json(403,{ok:false,error:"forbidden"});
      const st=normalizeStatus(order.status);
      if(!["delivered","returned"].includes(st)) return json(409,{ok:false,error:"review_not_allowed"});
      const now=admin.firestore.FieldValue.serverTimestamp();
      const authorName=safeText(order.userName||decoded.name||"Mijoz",160);
      const review={uid,orderId,authorName,stars,text,createdAt:now,updatedAt:now,verifiedPurchase:true};
      const batch=db.batch();
      batch.set(orderRef,{orderReview:{uid,authorName,stars,text,verifiedPurchase:true,updatedAt:admin.firestore.Timestamp.now()},reviewedAt:now,updatedAt:now},{merge:true});
      const items=Array.isArray(order.items)?order.items:[];
      const used=new Set();
      for(const it of items){
        const pid=safeId(it.productId||it.id||"");
        if(!pid || used.has(pid)) continue;
        used.add(pid);
        batch.set(db.doc(`products/${pid}/reviews/${uid}`),{...review,productId:pid},{merge:true});
      }
      await batch.commit();
      return json(200,{ok:true,status:"review_saved"});
    }

    if(action==="admin_update_status"){
      if(!(await adminAllowed(decoded, db))) return json(403,{ok:false,error:"admin_required"});
      const next=normalizeStatus(body.status);
      const reason=safeText(body.reason,800);
      const allowed=["new","packing","shipping","delivered","cancelled","return_requested","returned","return_rejected"];
      if(!allowed.includes(next)) return json(400,{ok:false,error:"invalid_status"});
      if(["cancelled","returned","return_rejected"].includes(next) && reason.length<4) return json(400,{ok:false,error:"reason_required"});
      const actorName=safeText(decoded.name||decoded.email||"OrzuMall",160);
      const out=await txUpdateWithOptionalRefund(db,orderId,async({tx,order,orderRef})=>{
        const previous=normalizeStatus(order.status);
        if(!adminTransitionAllowed(previous,next)) throw new Error("CHAIN_TRANSITION_NOT_ALLOWED");
        if(next==="returned" && !["shipping","delivered","return_requested"].includes(previous)) throw new Error("RETURN_NOT_ALLOWED");
        const entry=lifecycleEntry({status:next,actorType:"orzumall",actorUid:uid,actorName,reason,action:"admin_status_update"});
        const patch={status:next,statusNote:reason,statusActor:"orzumall",statusUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),statusHistory:admin.firestore.FieldValue.arrayUnion(entry),updatedAt:admin.firestore.FieldValue.serverTimestamp()};
        if(next==="cancelled") patch.cancellation={by:"orzumall",reason,cancelledAt:admin.firestore.Timestamp.now()};
        if(next==="return_requested") patch.returnRequest={...(order.returnRequest||{}),status:"requested",reason:reason||order.returnRequest?.reason||"",updatedAt:admin.firestore.Timestamp.now()};
        if(next==="returned") patch.returnRequest={...(order.returnRequest||{}),status:"approved",resolutionReason:reason,resolvedBy:"orzumall",resolvedAt:admin.firestore.Timestamp.now()};
        if(next==="return_rejected") patch.returnRequest={...(order.returnRequest||{}),status:"rejected",resolutionReason:reason,resolvedBy:"orzumall",resolvedAt:admin.firestore.Timestamp.now()};
        let refund={refunded:false};
        if(isRefundStatus(next)) refund=await maybeRefundBalance({tx,db,order,orderRef,patch,actorType:"orzumall",reason});
        return {patch,result:{refund,ownerUid:String(order.uid||"")}};
      });
      const ownerUid=out.result?.ownerUid||"";
      const label={new:"Yangi",packing:"Yig‘ilyapti",shipping:"Yetkazib berishda",delivered:"Yetkazib berildi",cancelled:"Bekor qilindi",return_requested:"Qaytarish so‘rovi",returned:"Qaytarildi",return_rejected:"Qaytarish rad etildi"}[next]||next;
      await notify(db,ownerUid,"Buyurtma holati yangilandi",`#${orderId}: ${label}${reason?`. Izoh: ${reason}`:""}`);
      await pushOrderStateChanged(db, orderId, label).catch(err => console.warn('admin status push skipped:', err?.message || err));
      return json(200,{ok:true,status:next,...(out.result||{})});
    }

    return json(400,{ok:false,error:"unknown_action"});
  }catch(e){
    const msg=String(e?.message||e);
    const status=msg==="ORDER_NOT_FOUND"?404:(["FORBIDDEN"].includes(msg)?403:(["CANCEL_NOT_ALLOWED","RETURN_NOT_ALLOWED","CHAIN_TRANSITION_NOT_ALLOWED"].includes(msg)?409:500));
    return json(status,{ok:false,error:msg.toLowerCase()});
  }
};
