import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
let timer=null,lastPing=0,user=null;
function payload(){return{path:(location.pathname||'/')+(location.hash||''),referrer:document.referrer||'',visibility:document.visibilityState||'visible'}}
async function ping(force=false){if(!user||document.visibilityState==='hidden'&&!force)return;const now=Date.now();if(!force&&now-lastPing<35000)return;lastPing=now;try{const token=await user.getIdToken();await fetch('/.netlify/functions/customer-presence',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify(payload()),keepalive:true})}catch(_){}}
function start(u){user=u;clearInterval(timer);if(!u)return;ping(true);timer=setInterval(()=>ping(false),55000)}
onAuthStateChanged(auth,start);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ping(true);else ping(true)});
window.addEventListener('focus',()=>ping(true));window.addEventListener('hashchange',()=>ping(true));window.addEventListener('pagehide',()=>ping(true));
