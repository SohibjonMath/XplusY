const C=require("./_sellerCommon");
exports.handler=async(event)=>{
  try{
    C.initAdmin();
    if(event.httpMethod!=="POST")return C.json(405,{ok:false,error:"method_not_allowed"});
    let decoded;try{decoded=await C.verifyToken(event)}catch(_){return C.json(401,{ok:false,error:"bad_token"})}
    const db=C.admin.firestore();
    if(!(await C.isAdmin(decoded,db)))return C.json(403,{ok:false,error:"admin_required"});
    let body={};try{body=JSON.parse(event.body||"{}")}catch(_){return C.json(400,{ok:false,error:"invalid_json"})}
    const action=C.safeText(body.action,80)||"list";
    if(action==="list"){
      const snap=await db.collection("sellers").orderBy("updatedAt","desc").limit(500).get().catch(()=>db.collection("sellers").limit(500).get());
      const rows=[];
      for(const d of snap.docs){
        const seller={id:d.id,...d.data()};
        const stats=await C.syncSellerPopularity(db,d.id,{syncProducts:false});
        rows.push({...C.publicSeller({...seller,popularity:stats.popularity,popularityAuto:true,popularityProductCount:stats.visibleProductCount}),...stats,products:undefined});
      }
      const totals={
        sellerCount:rows.length,
        activeCount:rows.filter(x=>x.active).length,
        totalProducts:rows.reduce((s,x)=>s+Number(x.productCount||0),0),
        avgPopularity:rows.length?Math.round(rows.reduce((s,x)=>s+Number(x.popularity||0),0)/rows.length):0,
        pendingProducts:rows.reduce((s,x)=>s+Number(x.pendingCount||0),0)
      };
      return C.json(200,{ok:true,sellers:rows,totals});
    }
    if(action==="save"){
      const input=body.seller||{};
      const existingId=C.safeId(input.id||"");
      const id=existingId||`s-${C.randomId()}`;
      const ref=db.doc(`sellers/${id}`);
      const oldSnap=await ref.get();
      const old=oldSnap.exists?oldSnap.data()||{}:{};
      const login=C.normLogin(input.login||old.login);
      if(!login||login.length<3)return C.json(400,{ok:false,error:"login_required"});
      const key=C.loginKey(login);
      const regRef=db.doc(`sellerLogins/${key}`);
      const regSnap=await regRef.get();
      if(regSnap.exists&&String(regSnap.data()?.sellerId||"")!==id)return C.json(409,{ok:false,error:"login_exists"});
      const pass=String(input.password||"");
      let passwordPatch={};
      if(!oldSnap.exists||pass){
        const hp=C.hashPassword(pass);
        passwordPatch={passwordSalt:hp.salt,passwordHash:hp.hash,passwordUpdatedAt:C.admin.firestore.FieldValue.serverTimestamp()};
      }
      const autoStats=await C.sellerStats(db,id);
      const seller={
        id,uid:C.sellerUid(id),login,
        storeName:C.safeText(input.storeName||input.name||old.storeName,140),
        logoUrl:C.safeText(input.logoUrl||old.logoUrl,900),
        bannerUrl:C.safeText(input.bannerUrl||old.bannerUrl,900),
        description:C.safeText(input.description||old.description,1400),
        workingHours:C.safeText(input.workingHours||old.workingHours,160),
        phone:C.safeText(input.phone||old.phone,80),
        lat:Number(input.lat??old.lat??0)||0,
        lng:Number(input.lng??old.lng??0)||0,
        popularity:autoStats.popularity,
        popularityAuto:true,
        popularityFormula:"approved_active_products_average",
        popularityProductCount:autoStats.visibleProductCount,
        commissionPercent:C.num(input.commissionPercent??old.commissionPercent??10,0,100),
        followersCount:Math.max(0,Math.round(Number(old.followersCount||0)||0)),
        verified:input.verified===undefined?(old.verified!==false):input.verified!==false,
        active:input.active===undefined?(old.active!==false):input.active!==false,
        updatedAt:C.admin.firestore.FieldValue.serverTimestamp(),
        createdAt:old.createdAt||C.admin.firestore.FieldValue.serverTimestamp(),
        ...passwordPatch
      };
      if(!seller.storeName)return C.json(400,{ok:false,error:"store_name_required"});
      const batch=db.batch();
      if(old.login&&C.normLogin(old.login)!==login)batch.delete(db.doc(`sellerLogins/${C.loginKey(old.login)}`));
      batch.set(regRef,{sellerId:id,login,active:seller.active,updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      batch.set(ref,seller,{merge:true});
      await batch.commit();
      // sync public seller snapshot into products
      const ps=await db.collection("products").where("sellerId","==",id).get();
      const sync=db.batch();
      ps.docs.forEach(d=>sync.set(d.ref,{sellerName:seller.storeName,sellerLogo:seller.logoUrl,sellerBanner:seller.bannerUrl,sellerDescription:seller.description,sellerWorkingHours:seller.workingHours,sellerPhone:seller.phone,sellerPopularity:seller.popularity,sellerVerified:seller.verified,sellerCommissionPercent:seller.commissionPercent,sellerActive:seller.active,updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true}));
      if(ps.size)await sync.commit();
      const refreshed=await C.syncSellerPopularity(db,id,{syncProducts:true});
      return C.json(200,{ok:true,seller:C.publicSeller({...seller,popularity:refreshed.popularity,popularityAuto:true,popularityProductCount:refreshed.visibleProductCount})});
    }
    if(action==="toggle"){
      const id=C.safeId(body.id);if(!id)return C.json(400,{ok:false,error:"seller_id_required"});
      const ref=db.doc(`sellers/${id}`),snap=await ref.get();if(!snap.exists)return C.json(404,{ok:false,error:"seller_not_found"});
      const seller=snap.data()||{},active=body.active!==false;
      const batch=db.batch();
      batch.set(ref,{active,updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      if(seller.login)batch.set(db.doc(`sellerLogins/${C.loginKey(seller.login)}`),{sellerId:id,login:seller.login,active,updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      await batch.commit();
      const ps=await db.collection("products").where("sellerId","==",id).get();
      if(ps.size){const sync=db.batch();ps.docs.forEach(d=>sync.set(d.ref,{sellerActive:active,updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true}));await sync.commit();}
      return C.json(200,{ok:true,active});
    }
    if(action==="delete"){
      const id=C.safeId(body.id);if(!id)return C.json(400,{ok:false,error:"seller_id_required"});
      const ref=db.doc(`sellers/${id}`),snap=await ref.get();if(!snap.exists)return C.json(404,{ok:false,error:"seller_not_found"});
      const seller=snap.data()||{};
      const batch=db.batch();batch.delete(ref);if(seller.login)batch.delete(db.doc(`sellerLogins/${C.loginKey(seller.login)}`));await batch.commit();
      const ps=await db.collection("products").where("sellerId","==",id).get();
      if(ps.size){const sync=db.batch();ps.docs.forEach(d=>sync.set(d.ref,{sellerActive:false,updatedAt:C.admin.firestore.FieldValue.serverTimestamp()},{merge:true}));await sync.commit();}
      return C.json(200,{ok:true});
    }
    return C.json(400,{ok:false,error:"unknown_action"});
  }catch(e){
    console.error("seller-admin",e);
    const m=String(e?.message||e);
    return C.json(["password_min_6"].includes(m)?400:500,{ok:false,error:m});
  }
};