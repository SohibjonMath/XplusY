/* OrzuMall v138 — silent production error reporting (no blocking UI) */
(function(){
  try{
    const seen=new Set();let sent=0;
    function trim(v,n){return String(v==null?'':v).slice(0,n)}
    function send(payload){
      if(sent>=10)return;const key=trim(payload.message,220)+'|'+trim(payload.source,180)+'|'+Number(payload.line||0);if(seen.has(key))return;seen.add(key);sent++;
      const body=JSON.stringify({...payload,page:location.href});
      try{if(navigator.sendBeacon){const ok=navigator.sendBeacon('/.netlify/functions/client-error',new Blob([body],{type:'application/json'}));if(ok)return}}catch(_){ }
      try{fetch('/.netlify/functions/client-error',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{})}catch(_){ }
    }
    window.addEventListener('error',e=>send({message:trim(e.message||'window_error',1200),stack:trim(e.error?.stack,3500),source:trim(e.filename,500),line:e.lineno,column:e.colno}));
    window.addEventListener('unhandledrejection',e=>{const r=e.reason;send({message:trim(r?.message||r||'unhandled_rejection',1200),stack:trim(r?.stack,3500),source:'unhandledrejection'})});
  }catch(_){ }
})();
