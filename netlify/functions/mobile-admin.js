// OrzuMall v50 — secure actions for the mobile admin application
const admin = require("firebase-admin");

function initAdmin(){
  if(admin.apps.length) return;
  const b64=process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if(!b64) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_B64");
  const serviceAccount=JSON.parse(Buffer.from(b64,"base64").toString("utf8"));
  admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
}
function json(statusCode,body){return{statusCode,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify(body)}}
function bearer(event){const h=event.headers?.authorization||event.headers?.Authorization||"";const m=h.match(/^Bearer\s+(.+)$/i);return m?m[1]:""}
function safeText(v,max=1000){return String(v==null?"":v).trim().slice(0,max)}
function safeId(v){const s=String(v||"").trim();return s&&s.length<=180&&!s.includes("/")?s:""}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function normEmail(v){return String(v||"").trim().toLowerCase()}
function readBalance(u){for(const k of ["balanceUZS","balance","walletUZS","wallet"]){const n=Number(u?.[k]);if(Number.isFinite(n))return n}return 0}
async function isAdmin(decoded,db){
  const email=normEmail(decoded?.email);
  if(!email)return false;
  const env=String(process.env.ADMIN_EMAILS||"").split(",").map(normEmail).filter(Boolean);
  if(new Set(["sohibjonmath@gmail.com",...env]).has(email))return true;
  try{const snap=await db.doc("configs/admins").get();const arr=snap.exists&&Array.isArray(snap.data()?.emails)?snap.data().emails.map(normEmail):[];return arr.includes(email)}catch(_){return false}
}
async function notify(db,uid,title,body,type="info"){
  if(!uid)return;
  await db.collection("notifications").add({targetType:"uid",targetUid:String(uid),type,title:safeText(title,160),body:safeText(body,800),text:safeText(body,800),active:true,createdAt:admin.firestore.FieldValue.serverTimestamp()});
}
async function resolveTopupUid(db,r){
  if(r?.uid)return String(r.uid);
  const numeric=String(r?.numericId||r?.userPublicId||"").trim();
  if(numeric){
    try{const m=await db.doc(`users_by_numeric/${numeric}`).get();if(m.exists&&m.data()?.uid)return String(m.data().uid)}catch(_){ }
    try{const q=await db.collection("users").where("numericId","==",numeric).limit(1).get();if(!q.empty)return String(q.docs[0].id)}catch(_){ }
  }
  return "";
}

exports.handler=async(event)=>{
  try{
    initAdmin();
    if(event.httpMethod!=="POST")return json(405,{ok:false,error:"method_not_allowed"});
    const token=bearer(event);if(!token)return json(401,{ok:false,error:"unauthorized"});
    let decoded;try{decoded=await admin.auth().verifyIdToken(token)}catch(_){return json(401,{ok:false,error:"bad_token"})}
    const db=admin.firestore();
    if(!(await isAdmin(decoded,db)))return json(403,{ok:false,error:"admin_required"});
    let body={};try{body=event.body?JSON.parse(event.body):{}}catch(_){return json(400,{ok:false,error:"invalid_json"})}
    const action=safeText(body.action,80);
    const adminEmail=normEmail(decoded.email)||"orzumall";

    if(action==="topup_approve"){
      const requestId=safeId(body.requestId);if(!requestId)return json(400,{ok:false,error:"request_id_required"});
      const ref=db.doc(`topup_requests/${requestId}`);const pre=await ref.get();if(!pre.exists)return json(404,{ok:false,error:"not_found"});
      const initial=pre.data()||{};const uid=await resolveTopupUid(db,initial);if(!uid)return json(409,{ok:false,error:"missing_uid"});
      const requested=Math.max(0,num(initial.amountUZS||initial.amount||initial.baseAmountUZS));
      const finalAmount=Math.round(Math.max(0,num(body.finalAmountUZS||requested)));if(finalAmount<=0)return json(400,{ok:false,error:"bad_amount"});
      const note=safeText(body.note,500);
      let nextBalance=0;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);if(!snap.exists)throw new Error("NOT_FOUND");const req=snap.data()||{};
        if(String(req.status||"pending").toLowerCase()!=="pending")throw new Error("ALREADY_DONE");
        const uref=db.doc(`users/${uid}`);const us=await tx.get(uref);if(!us.exists)throw new Error("USER_NOT_FOUND");
        nextBalance=readBalance(us.data()||{})+finalAmount;
        tx.set(uref,{balanceUZS:nextBalance,balance:nextBalance,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
        tx.set(ref,{uid,status:"approved",baseAmountUZS:requested,finalAmountUZS:finalAmount,adminNote:note,approvedAt:admin.firestore.FieldValue.serverTimestamp(),approvedBy:adminEmail,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      });
      await notify(db,uid,"Balansingiz to‘ldirildi",`${finalAmount.toLocaleString("uz-UZ")} so‘m balansingizga qo‘shildi.${note?` Izoh: ${note}`:""}`,"balance").catch(()=>{});
      return json(200,{ok:true,balanceUZS:nextBalance,creditedUZS:finalAmount});
    }

    if(action==="topup_reject"){
      const requestId=safeId(body.requestId);if(!requestId)return json(400,{ok:false,error:"request_id_required"});
      const reason=safeText(body.reason,500)||"To‘lov tasdiqlanmadi";const ref=db.doc(`topup_requests/${requestId}`);const pre=await ref.get();if(!pre.exists)return json(404,{ok:false,error:"not_found"});
      const uid=await resolveTopupUid(db,pre.data()||{});
      await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error("NOT_FOUND");if(String(snap.data()?.status||"pending").toLowerCase()!=="pending")throw new Error("ALREADY_DONE");tx.set(ref,{status:"rejected",adminNote:reason,rejectedAt:admin.firestore.FieldValue.serverTimestamp(),rejectedBy:adminEmail,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true})});
      await notify(db,uid,"Balans to‘ldirish tasdiqlanmadi",reason,"balance").catch(()=>{});
      return json(200,{ok:true});
    }

    if(action==="support_reply"){
      const uid=safeId(body.uid);const text=safeText(body.text,1600);if(!uid||text.length<1)return json(400,{ok:false,error:"message_required"});
      await db.collection(`support_threads/${uid}/messages`).add({text,sender:"admin",adminName:"OrzuMall",adminEmail,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      await db.doc(`support_threads/${uid}`).set({status:"open",needsHuman:false,aiState:"operator_answered",lastMessage:text,lastSender:"admin",updatedAt:admin.firestore.FieldValue.serverTimestamp(),userUnreadCount:admin.firestore.FieldValue.increment(1),adminUnreadCount:0},{merge:true});
      await notify(db,uid,"OrzuMall operatori javob berdi",text.slice(0,260),"support").catch(()=>{});
      return json(200,{ok:true});
    }

    if(action==="support_toggle"){
      const uid=safeId(body.uid);const status=body.status==="closed"?"closed":"open";if(!uid)return json(400,{ok:false,error:"uid_required"});
      await db.doc(`support_threads/${uid}`).set({status,needsHuman:false,adminUnreadCount:0,updatedAt:admin.firestore.FieldValue.serverTimestamp(),closedAt:status==="closed"?admin.firestore.FieldValue.serverTimestamp():null,closedBy:status==="closed"?adminEmail:null},{merge:true});
      return json(200,{ok:true,status});
    }

    if(action==="notification_send"){
      const targetType=body.targetType==="uid"?"uid":"all";const targetUid=targetType==="uid"?safeId(body.targetUid):"";
      const title=safeText(body.title,160),text=safeText(body.text||body.body,900),type=safeText(body.type||"info",40);
      if(!title||!text)return json(400,{ok:false,error:"title_and_text_required"});if(targetType==="uid"&&!targetUid)return json(400,{ok:false,error:"target_uid_required"});
      const ref=await db.collection("notifications").add({targetType,targetUid,type,title,body:text,text,active:true,createdAt:admin.firestore.FieldValue.serverTimestamp(),createdBy:adminEmail});
      return json(200,{ok:true,id:ref.id});
    }

    if(action==="notification_toggle"){
      const id=safeId(body.id);if(!id)return json(400,{ok:false,error:"id_required"});await db.doc(`notifications/${id}`).set({active:body.active!==false,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:adminEmail},{merge:true});return json(200,{ok:true});
    }
    if(action==="notification_delete"){
      const id=safeId(body.id);if(!id)return json(400,{ok:false,error:"id_required"});await db.doc(`notifications/${id}`).delete();return json(200,{ok:true});
    }

    if(action==="review_reply"){
      const productId=safeId(body.productId),reviewId=safeId(body.reviewId),text=safeText(body.text,1200);if(!productId||!reviewId||text.length<2)return json(400,{ok:false,error:"review_reply_required"});
      const ref=db.doc(`products/${productId}/reviews/${reviewId}`),snap=await ref.get();if(!snap.exists)return json(404,{ok:false,error:"review_not_found"});
      const review=snap.data()||{};const now=admin.firestore.FieldValue.serverTimestamp();
      await ref.set({adminReply:{authorName:"OrzuMall",text,updatedAt:now,adminEmail},adminReplyText:text,adminRepliedAt:now,updatedAt:now},{merge:true});
      await notify(db,review.uid||reviewId,"OrzuMall sharhingizga javob berdi",text.slice(0,280),"review").catch(()=>{});
      return json(200,{ok:true});
    }

    return json(400,{ok:false,error:"unknown_action"});
  }catch(e){
    const msg=String(e?.message||e);const known={NOT_FOUND:404,USER_NOT_FOUND:404,ALREADY_DONE:409};
    console.error("mobile-admin error",msg);
    return json(known[msg]||500,{ok:false,error:msg.toLowerCase()});
  }
};
