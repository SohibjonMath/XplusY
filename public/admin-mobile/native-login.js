import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithPopup, signInWithRedirect } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const cfg={apiKey:"AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",authDomain:"xplusy-760fa.firebaseapp.com",projectId:"xplusy-760fa",storageBucket:"xplusy-760fa.firebasestorage.app",appId:"1:992512966017:web:5e919dbc9b8d8abcb43c80"};
const app=initializeApp(cfg),auth=getAuth(app),provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
setPersistence(auth,browserLocalPersistence).catch(()=>{});
const btn=document.getElementById("loginBtn"),openAppBtn=document.getElementById("openAppBtn"),msg=document.getElementById("msg");
let busy=false,currentCode="";
function show(text,ok=false){msg.hidden=false;msg.textContent=text;msg.className=`msg${ok?" ok":""}`}
function directUrl(code){return `orzumalladmin://auth?code=${encodeURIComponent(code)}`}
function intentUrl(code){return `intent://auth?code=${encodeURIComponent(code)}#Intent;scheme=orzumalladmin;package=uz.orzumall.admin;end`}
function openAdminApp(fromUserGesture=false){
  if(!currentCode)return;
  const target=fromUserGesture?intentUrl(currentCode):directUrl(currentCode);
  try{window.location.href=target}catch(_){location.assign(target)}
  if(fromUserGesture){
    setTimeout(()=>{try{window.location.href=directUrl(currentCode)}catch(_){ }},650);
  }
}
openAppBtn.addEventListener("click",()=>openAdminApp(true));
async function issueCode(user){
  if(busy)return;busy=true;btn.disabled=true;show("Admin huquqi tekshirilmoqda...");
  try{
    const token=await user.getIdToken(true);
    const r=await fetch("/.netlify/functions/admin-app-login-code",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${token}`},body:"{}"});
    const out=await r.json().catch(()=>({}));
    if(!r.ok||!out.ok||!out.code)throw new Error(out.error||"server_error");
    currentCode=out.code;
    openAppBtn.hidden=false;
    openAppBtn.disabled=false;
    show("Tasdiqlandi. Ilovaga avtomatik qaytilmoqda...",true);
    setTimeout(()=>openAdminApp(false),120);
    setTimeout(()=>{
      if(document.visibilityState==="visible")show("Tasdiqlandi. Avtomatik qaytish ishlamasa, yuqoridagi «OrzuMall Admin ilovasiga qaytish» tugmasini bosing.",true);
    },1600);
  }catch(e){busy=false;btn.disabled=false;show(`Kirish amalga oshmadi: ${e?.message||e}`)}
}
btn.addEventListener("click",async()=>{btn.disabled=true;msg.hidden=true;try{await signInWithPopup(auth,provider)}catch(e){console.warn("popup fallback",e);try{await signInWithRedirect(auth,provider)}catch(e2){btn.disabled=false;show(`Google kirish ochilmadi: ${e2?.message||e?.message||e2}`)}}});
getRedirectResult(auth).catch(e=>show(`Kirish yakunlanmadi: ${e?.message||e}`));
onAuthStateChanged(auth,user=>{if(user)issueCode(user)});
