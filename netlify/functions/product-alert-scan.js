const C=require('./_sellerCommon');
const A=require('./_productAlertsCommon');
exports.handler=async()=>{try{C.initAdmin();const out=await A.processAllAlerts(C.admin.firestore(),{limit:900});return{statusCode:200,headers:{'content-type':'application/json'},body:JSON.stringify({ok:true,...out})}}catch(e){console.error('product-alert-scan',e);return{statusCode:500,headers:{'content-type':'application/json'},body:JSON.stringify({ok:false,error:String(e?.message||e).slice(0,180)})}}};
