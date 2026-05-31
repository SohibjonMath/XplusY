// OrzuMall v96 — secure product-review submission. Public reviews stay pending until admin approval.
const admin = require("firebase-admin");

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
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}
function safeText(v,max=800){ return String(v==null?"":v).trim().slice(0,max); }
function safeId(v){ const s=String(v||"").trim(); return s && s.length<=128 && !s.includes("/") ? s : ""; }
function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function cleanPublicName(v){ const s=String(v==null?"":v).trim().replace(/\s+/g," "); return !s || s.includes("@") ? "" : s; }
function publicCustomerName(record={},fallback="Mijoz"){
  const full=[cleanPublicName(record?.firstName),cleanPublicName(record?.lastName)].filter(Boolean).join(" ").trim();
  return full || cleanPublicName(record?.name) || cleanPublicName(record?.fullName) || cleanPublicName(record?.userName) || cleanPublicName(record?.displayName) || fallback;
}
async function loadIdentity(db,uid,decoded={}){
  let user={};
  try{ const s=await db.doc(`users/${uid}`).get(); user=s.exists?(s.data()||{}):{}; }catch(_e){}
  return {
    firstName:cleanPublicName(user.firstName)||null,
    lastName:cleanPublicName(user.lastName)||null,
    authorName:publicCustomerName(user,cleanPublicName(decoded.name)||"Mijoz")
  };
}
exports.handler=async(event)=>{
  try{
    initAdmin();
    if(event.httpMethod!=="POST") return json(405,{ok:false,error:"method_not_allowed"});
    const token=bearer(event); if(!token) return json(401,{ok:false,error:"unauthorized"});
    let decoded; try{ decoded=await admin.auth().verifyIdToken(token); }catch(_e){ return json(401,{ok:false,error:"bad_token"}); }
    let body={}; try{ body=event.body?JSON.parse(event.body):{}; }catch(_e){ return json(400,{ok:false,error:"invalid_json"}); }
    const action=safeText(body.action||"submit_review",80);
    if(action!=="submit_review") return json(400,{ok:false,error:"unknown_action"});
    const productId=safeId(body.productId);
    const text=safeText(body.text,1000);
    const stars=Math.max(1,Math.min(5,Math.round(num(body.stars))));
    if(!productId) return json(400,{ok:false,error:"product_id_required"});
    if(!stars) return json(400,{ok:false,error:"stars_required"});
    if(text && text.length<2) return json(400,{ok:false,error:"review_too_short"});
    const uid=String(decoded.uid||"").trim();
    const db=admin.firestore();
    const identity=await loadIdentity(db,uid,decoded);
    const ref=db.doc(`products/${productId}/reviews/${uid}`);
    const prevSnap=await ref.get();
    const prev=prevSnap.exists?(prevSnap.data()||{}):{};
    const now=admin.firestore.FieldValue.serverTimestamp();
    const patch={
      uid,
      productId,
      authorName:safeText(identity.authorName||"Mijoz",160),
      firstName:identity.firstName,
      lastName:identity.lastName,
      stars,
      text,
      source:prev.source||"product_page",
      verifiedPurchase:prev.verifiedPurchase===true,
      moderationStatus:"pending",
      isPublic:false,
      moderationReason:"",
      submittedAt:now,
      moderationUpdatedAt:now,
      updatedAt:now,
      createdAt:prev.createdAt||now
    };
    // Keep an existing admin reply if a previously approved review is edited.
    if(prev.adminReply) patch.adminReply=prev.adminReply;
    if(prev.adminReplyText) patch.adminReplyText=prev.adminReplyText;
    await ref.set(patch,{merge:true});
    return json(200,{ok:true,status:"review_pending"});
  }catch(e){
    console.error("review-submit error",e);
    return json(500,{ok:false,error:String(e?.message||e).toLowerCase()});
  }
};
