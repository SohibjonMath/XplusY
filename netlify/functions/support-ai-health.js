const { json, requireAdmin, loadConfig, admin } = require('./_supportAiCommon');
exports.handler=async function(event){
  if(event.httpMethod==='OPTIONS')return json(204,{});
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'POST only'});
  try{
    const a=await requireAdmin(event);if(!a.ok)return json(a.statusCode,{ok:false,error:a.error});
    const db=admin.firestore(), cfg=await loadConfig(db), key=process.env.DEEPSEEK_API_KEY||process.env.DEEPSEEK_KEY;
    if(!key)return json(200,{ok:false,configured:false,error:'DEEPSEEK_API_KEY topilmadi',model:cfg.model});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
    try{const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','authorization':`Bearer ${key}`},body:JSON.stringify({model:cfg.model,thinking:{type:'disabled'},temperature:0,max_tokens:40,response_format:{type:'json_object'},messages:[{role:'system',content:'Return only JSON: {"ok":true}'},{role:'user',content:'ping'}]})});const raw=await r.text();return json(200,{ok:r.ok,configured:true,model:cfg.model,status:r.status,details:r.ok?'DeepSeek javob berdi':raw.slice(0,260)})}catch(e){return json(200,{ok:false,configured:true,model:cfg.model,error:String(e.message||e)})}finally{clearTimeout(timer)}
  }catch(e){return json(500,{ok:false,error:String(e.message||e)})}
};
