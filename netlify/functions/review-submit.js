// OrzuMall v180 — direct product-page reviews are disabled.
// Reviews can only be created from a delivered order item through order-lifecycle.js.
function json(statusCode, body){ return { statusCode, headers:{"content-type":"application/json; charset=utf-8"}, body:JSON.stringify(body) }; }
exports.handler=async(event)=>{
  if(event.httpMethod!=="POST") return json(405,{ok:false,error:"method_not_allowed"});
  return json(403,{ok:false,error:"review_from_delivered_order_only"});
};
