import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithPopup, signInWithRedirect } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const cfg={apiKey:"AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",authDomain:"xplusy-760fa.firebaseapp.com",projectId:"xplusy-760fa",storageBucket:"xplusy-760fa.appspot.com",appId:"1:992512966017:web:5e919dbc9b8d8abcb43c80"};
const app=initializeApp(cfg),auth=getAuth(app),provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
setPersistence(auth,browserLocalPersistence).catch(()=>{});
const btn=document.getElementById("loginBtn"),msg=document.getElementById("msg");
let busy=false;
function show(text,ok=false){msg.hidden=false;msg.textContent=text;msg.className=`msg${ok?" ok":""}`}
async function issueCode(user){
  if(busy)return;busy=true;btn.disabled=true;show("Admin huquqi tekshirilmoqda...");
  try{
    const token=await user.getIdToken(true);
    const r=await fetch("/.netlify/functions/admin-app-login-code",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${token}`},body:"{}"});
    const out=await r.json().catch(()=>({}));
    if(!r.ok||!out.ok||!out.code)throw new Error(out.error||"server_error");
    show("Tasdiqlandi. Ilovaga qaytilmoqda...",true);
    location.replace(`orzumalladmin://auth?code=${encodeURIComponent(out.code)}`);
  }catch(e){busy=false;btn.disabled=false;show(`Kirish amalga oshmadi: ${e?.message||e}`)}
}
btn.addEventListener("click",async()=>{btn.disabled=true;msg.hidden=true;try{await signInWithPopup(auth,provider)}catch(e){console.warn("popup fallback",e);try{await signInWithRedirect(auth,provider)}catch(e2){btn.disabled=false;show(`Google kirish ochilmadi: ${e2?.message||e?.message||e2}`)}}});
getRedirectResult(auth).catch(e=>show(`Kirish yakunlanmadi: ${e?.message||e}`));
onAuthStateChanged(auth,user=>{if(user)issueCode(user)});
