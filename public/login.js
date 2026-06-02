import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let allowAutoRedirect = true;

const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  toggleLoginPass: document.getElementById("toggleLoginPass"),
  signupFirstName: document.getElementById("signupFirstName"),
  signupLastName: document.getElementById("signupLastName"),
  signupPhone: document.getElementById("signupPhone"),
  signupPass: document.getElementById("signupPass"),
  toggleSignupPass: document.getElementById("toggleSignupPass"),
  notice: document.getElementById("notice"),
  forgotLink: document.getElementById("forgotLink"),
};

const splashEl = document.getElementById("splash");
const splashTextEl = document.getElementById("splashText");
function showSplash(text="Kuting..."){
  if(!splashEl) return;
  if(splashTextEl) splashTextEl.textContent = text;
  splashEl.style.display = "flex";
  splashEl.setAttribute("aria-hidden","false");
}
function hideSplash(){
  if(!splashEl) return;
  splashEl.style.display = "none";
  splashEl.setAttribute("aria-hidden","true");
}
function setBusy(isBusy){
  try{
    document.querySelectorAll("button, input, select, textarea").forEach(el=>{
      if(el.closest("#splash")) return;
      if(isBusy){
        el.dataset._wasDisabled = el.disabled ? "1" : "0";
        el.disabled = true;
      }else{
        if(el.dataset._wasDisabled === "0") el.disabled = false;
        delete el.dataset._wasDisabled;
      }
    });
  }catch(_e){}
}
function authMessageFromCode(code){
  code = String(code||"");
  if(code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Telefon raqam yoki parol noto‘g‘ri.";
  if(code.includes("too-many-requests")) return "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.";
  if(code.includes("network-request-failed")) return "Internet ulanishingizni tekshiring va qayta urinib ko‘ring.";
  if(code.includes("email-already-in-use")) return "Bu telefon raqam bilan akkaunt allaqachon mavjud. “Kirish”dan foydalaning.";
  if(code.includes("weak-password")) return "Parol juda sodda. Kamida 6 ta belgidan iborat bo‘lsin.";
  if(code.includes("invalid-email")) return "Telefon raqam noto‘g‘ri formatda.";
  return "Xatolik yuz berdi. Qayta urinib ko‘ring.";
}
function showNotice(msg, kind="ok"){
  if(!els.notice) return;
  els.notice.className = "notice " + (kind==="err" ? "err" : "ok");
  els.notice.textContent = msg;
  els.notice.style.display = "block";
  clearTimeout(showNotice._t);
  showNotice._t = setTimeout(()=>{ els.notice.style.display="none"; }, kind === "err" ? 6500 : 3500);
}
function normPhone(raw){
  let digits = String(raw||"").replace(/\D/g,"");
  if(digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  return "+998" + digits;
}
function isValidUzPhone(phone){ return /^\+998\d{9}$/.test(String(phone||"")); }
function attachUzPhoneMask(input){
  if(!input) return;
  if(!input.value) input.value = "+998";
  input.addEventListener("focus", ()=>{
    if(!input.value) input.value = "+998";
    if(!String(input.value).startsWith("+998")) input.value = normPhone(input.value);
  });
  input.addEventListener("input", ()=>{ input.value = normPhone(input.value); });
  input.addEventListener("keydown", (e)=>{
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if((e.key === "Backspace" || e.key === "Delete") && start <= 4 && end <= 4){
      e.preventDefault(); input.setSelectionRange(4,4);
    }
  });
}
function phoneToEmail(phone){ return `p${String(phone||"").replace(/[^0-9]/g,"")}@orzumall.phone`; }
function uidToNumericId(uid){
  const hex = (uid || "").replace(/[^0-9a-f]/gi, "").padEnd(10, "0").slice(0, 10);
  let n = 0;
  try{ n = parseInt(hex, 16); }catch(_e){ n = Date.now(); }
  return (n % 900000) + 100000;
}
async function ensureUserDoc(uid, payload={}){
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef).catch(()=>null);
  const u = snap && snap.exists() ? (snap.data()||{}) : {};
  const numericId = (u.numericId != null && /^\d+$/.test(String(u.numericId))) ? Number(u.numericId) : uidToNumericId(uid);
  const firstName = String(payload.firstName ?? u.firstName ?? "").trim();
  const lastName = String(payload.lastName ?? u.lastName ?? "").trim();
  const phone = String(payload.phone ?? u.phone ?? "").trim();
  const name = String(payload.name || u.name || `${firstName} ${lastName}`.trim() || "Foydalanuvchi").trim();
  const data = {
    numericId, phone, firstName, lastName, name,
    profileCompleted: !!(firstName && lastName && phone),
    updatedAt: serverTimestamp(),
    ...((snap && snap.exists()) ? {} : { createdAt: serverTimestamp(), balanceUZS: 0 }),
  };
  await setDoc(userRef, data, { merge:true });
  return data;
}
function setMode(mode){
  const isLogin = mode === "login";
  els.tabLogin?.classList.toggle("active", isLogin);
  els.tabSignup?.classList.toggle("active", !isLogin);
  if(els.loginForm) els.loginForm.style.display = isLogin ? "" : "none";
  if(els.signupForm) els.signupForm.style.display = isLogin ? "none" : "";
}
els.tabLogin?.addEventListener("click", ()=>setMode("login"));
els.tabSignup?.addEventListener("click", ()=>setMode("signup"));
setMode("login");
attachUzPhoneMask(els.loginPhone);
attachUzPhoneMask(els.signupPhone);
els.toggleLoginPass?.addEventListener("click", ()=>{
  const show = els.loginPass.type === "password";
  els.loginPass.type = show ? "text" : "password";
  const i = els.toggleLoginPass.querySelector("i"); if(i) i.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});
els.toggleSignupPass?.addEventListener("click", ()=>{
  const show = els.signupPass.type === "password";
  els.signupPass.type = show ? "text" : "password";
  const i = els.toggleSignupPass.querySelector("i"); if(i) i.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});
if(els.forgotLink){
  els.forgotLink.addEventListener("click", (e)=>{
    e.preventDefault();
    showNotice("Parolni tiklash uchun @OrzuMallUZ_bot ga yozing", "ok");
    setTimeout(()=> window.open("https://t.me/OrzuMallUZ_bot", "_blank"), 180);
  });
}
onAuthStateChanged(auth, (user)=>{
  if(user && allowAutoRedirect){
    const next = new URLSearchParams(location.search).get("next") || "index.html#profile";
    location.replace(next);
  }
});
els.loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault(); allowAutoRedirect = false;
  const phone = normPhone(els.loginPhone.value);
  const pass = els.loginPass.value || "";
  if(!isValidUzPhone(phone)) return showNotice("Telefon raqam noto‘g‘ri. Masalan: +998901234567", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");
  setBusy(true); showSplash("Kuting...");
  try{
    const cred = await signInWithEmailAndPassword(auth, phoneToEmail(phone), pass);
    await ensureUserDoc(cred.user.uid, { phone });
    location.replace(new URLSearchParams(location.search).get("next") || "index.html#profile");
  }catch(err){ showNotice(authMessageFromCode(err?.code), "err"); }
  finally{ hideSplash(); setBusy(false); }
});
els.signupForm?.addEventListener("submit", async (e)=>{
  e.preventDefault(); allowAutoRedirect = false;
  const firstName = String(els.signupFirstName?.value || "").trim();
  const lastName = String(els.signupLastName?.value || "").trim();
  const phone = normPhone(els.signupPhone?.value || "");
  const pass = els.signupPass?.value || "";
  if(!firstName) return showNotice("Ismni kiriting", "err");
  if(!lastName) return showNotice("Familiyani kiriting", "err");
  if(!isValidUzPhone(phone)) return showNotice("Telefon raqam noto‘g‘ri. Masalan: +998901234567", "err");
  if(pass.length < 6) return showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin", "err");
  setBusy(true); showSplash("Kuting...");
  try{
    const cred = await createUserWithEmailAndPassword(auth, phoneToEmail(phone), pass);
    await ensureUserDoc(cred.user.uid, { phone, firstName, lastName });
    location.replace(new URLSearchParams(location.search).get("next") || "index.html#profile");
  }catch(err){ showNotice(authMessageFromCode(err?.code), "err"); }
  finally{ hideSplash(); setBusy(false); }
});
