const C=require("./_sellerCommon");
exports.handler=async(event)=>{
  try{
    C.initAdmin();
    if(event.httpMethod!=="POST")return C.json(405,{ok:false,error:"method_not_allowed"});
    let body={};try{body=JSON.parse(event.body||"{}")}catch(_){return C.json(400,{ok:false,error:"invalid_json"})}
    const login=C.normLogin(body.login),password=String(body.password||"");
    if(!login||!password)return C.json(400,{ok:false,error:"login_password_required"});
    const db=C.admin.firestore();
    const reg=await db.doc(`sellerLogins/${C.loginKey(login)}`).get();
    if(!reg.exists)return C.json(401,{ok:false,error:"invalid_login"});
    const sellerId=C.safeId(reg.data()?.sellerId);
    const snap=await db.doc(`sellers/${sellerId}`).get();
    if(!snap.exists)return C.json(401,{ok:false,error:"invalid_login"});
    const seller={id:snap.id,...snap.data()};
    if(seller.active===false||reg.data()?.active===false)return C.json(403,{ok:false,error:"seller_disabled"});
    if(!C.verifyPassword(password,seller.passwordSalt,seller.passwordHash))return C.json(401,{ok:false,error:"invalid_login"});
    const customToken=await C.admin.auth().createCustomToken(C.sellerUid(sellerId),{sellerPortal:true,sellerId});
    await snap.ref.set({lastLoginAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    return C.json(200,{ok:true,customToken,seller:C.publicSeller(seller)});
  }catch(e){console.error("seller-login",e);return C.json(500,{ok:false,error:"server_error"})}
};