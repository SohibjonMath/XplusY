const C=require("./_sellerCommon");
function cleanImages(v){return(Array.isArray(v)?v:[]).map(x=>C.safeText(x,900)).filter(Boolean).slice(0,12)}
function productPublic(d){return{id:String(d.id||""),name:String(d.name||""),description:String(d.description||""),price:Number(d.price||0)||0,oldPrice:Number(d.oldPrice||0)||0,popularScore:C.num(d.popularScore,0,100),status:String(d.status||"pending"),images:cleanImages(d.images),createdAt:d.createdAt||null,updatedAt:d.updatedAt||null}}
exports.handler=async(event)=>{
  try{
    C.initAdmin();
    if(event.httpMethod!=="POST")return C.json(405,{ok:false,error:"method_not_allowed"});
    let decoded;try{decoded=await C.verifyToken(event)}catch(_){return C.json(401,{ok:false,error:"bad_token"})}
    const db=C.admin.firestore();
    let seller;try{seller=await C.getSellerByDecoded(db,decoded)}catch(e){return C.json(403,{ok:false,error:String(e.message||e)})}
    let body={};try{body=JSON.parse(event.body||"{}")}catch(_){return C.json(400,{ok:false,error:"invalid_json"})}
    const action=C.safeText(body.action,80)||"dashboard";
    if(action==="dashboard"){
      const stats=await C.sellerStats(db,seller.id);
      return C.json(200,{ok:true,seller:C.publicSeller(seller),stats:{productCount:stats.productCount,avgProductPopularity:stats.avgProductPopularity,pendingCount:stats.pendingCount,approvedCount:stats.approvedCount},products:stats.products.map(productPublic)});
    }
    if(action==="product_save"){
      const input=body.product||{},id=C.safeId(input.id||"")||`${seller.id}-${Date.now().toString(36)}`;
      const ref=db.doc(`products/${id}`),snap=await ref.get(),old=snap.exists?snap.data()||{}:{};
      if(snap.exists&&String(old.sellerId||"")!==seller.id)return C.json(403,{ok:false,error:"product_owner_required"});
      const name=C.safeText(input.name,180),price=Number(input.price||0);
      if(!name||!Number.isFinite(price)||price<=0)return C.json(400,{ok:false,error:"name_price_required"});
      const changed=snap.exists&&(name!==String(old.name||"")||price!==Number(old.price||0)||C.safeText(input.description,1800)!==String(old.description||""));
      const data={
        name,description:C.safeText(input.description,1800),price,oldPrice:Number(input.oldPrice||0)||0,
        popularScore:C.num(input.popularScore,0,100),images:cleanImages(input.images),
        sellerId:seller.id,sellerName:seller.storeName,sellerLogo:seller.logoUrl,sellerPopularity:C.num(seller.popularity,0,100),
        ownerUid:C.sellerUid(seller.id),ownerType:"seller",createdByRole:"seller",isOrzuMallVerified:false,
        currency:"UZS",status:!snap.exists||changed?"pending":String(old.status||"pending"),
        createdAt:old.createdAt||C.admin.firestore.FieldValue.serverTimestamp(),updatedAt:C.admin.firestore.FieldValue.serverTimestamp()
      };
      await ref.set(data,{merge:true});
      return C.json(200,{ok:true,id,status:data.status});
    }
    if(action==="product_delete"){
      const id=C.safeId(body.id),ref=db.doc(`products/${id}`),snap=await ref.get();if(!snap.exists)return C.json(404,{ok:false,error:"product_not_found"});
      if(String(snap.data()?.sellerId||"")!==seller.id)return C.json(403,{ok:false,error:"product_owner_required"});
      await ref.delete();return C.json(200,{ok:true});
    }
    return C.json(400,{ok:false,error:"unknown_action"});
  }catch(e){console.error("seller-portal",e);return C.json(500,{ok:false,error:"server_error",detail:String(e?.message||e).slice(0,180)})}
};