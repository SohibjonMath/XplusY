
    // Firebase konfiguratsiyasi
    const DEFAULT_ADMIN_EMAILS = ["sohibjonmath@gmail.com"];
    let FIREBASE_CONFIG = null;
    window.FIREBASE_CONFIG = null;

    // Konfiguratsiyani olish
    try {
      // Agar global config bo'lsa
      if (typeof window !== "undefined" && window.firebaseConfig) {
        FIREBASE_CONFIG = window.firebaseConfig;
      }
    } catch (e) {}

    // Agar config topilmasa, foydalanuvchi to'ldirishi kerak bo'lgan placeholder
    if (!FIREBASE_CONFIG) {
      FIREBASE_CONFIG = {
        apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  databaseURL: "https://xplusy-760fa-default-rtdb.firebaseio.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
      };
      
      // Agar config bo'sh bo'lsa, foydalanuvchiga xabar berish
      if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.length < 10) {
        console.warn("Firebase konfiguratsiyasi to'liq emas. Iltimos, o'z Firebase ma'lumotlaringizni kiriting.");
      }
    }

    // Firebase kutubxonalari
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
    import {
      getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
      writeBatch, query, where, orderBy, serverTimestamp, onSnapshot, limit, runTransaction
    } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
    import { GoogleAuthProvider, browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
    import {
      getStorage, ref as sRef, uploadBytes, getDownloadURL
    } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

    // Asosiy dastur logikasi
    function hasValidConfig(cfg){
      return cfg && typeof cfg === "object"
        && cfg.apiKey && cfg.projectId && cfg.authDomain;
    }

    if(!hasValidConfig(FIREBASE_CONFIG)){
      console.error("Firebase config is missing/invalid. Please provide firebaseConfig.");
    }

    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
    try{ localStorage.setItem('FIREBASE_CONFIG', JSON.stringify(FIREBASE_CONFIG)); }catch(e){}
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(()=>{});
    const provider = new GoogleAuthProvider();
    const storage = getStorage(app);

    const $ = (id)=>document.getElementById(id);

    const state = {
      products: [],
      productViewMode: "cards",
      ordersViewMode: "cards",
      editingId: null,
      user: null,
      role: "guest", // admin | vendor
      adminEmails: [...DEFAULT_ADMIN_EMAILS],
      vendorEmails: [],
      vendorUids: [],
      vendorUids: [],
    };
    // ---- Storage upload helper (no functions needed) ----
    async function uploadImageFile(file, folder="uploads"){
      if(!file) throw new Error("Fayl topilmadi");
      const u = auth.currentUser;
      // Professional paths:
      // - temp uploads: products/temp/{uid}/...
      // - product images: products/items/{productId}/...
      let finalFolder = String(folder||"uploads").replace(/\/+/g,'/').replace(/\/$/,'');
      if(finalFolder === "products/temp" || finalFolder.startsWith("products/temp/")){
        if(!u) throw new Error("Rasm yuklash uchun avval kirish qiling");
        // ensure exactly: products/temp/{uid}
        finalFolder = `products/temp/${u.uid}`;
      } else if(finalFolder.startsWith("products/") && !finalFolder.startsWith("products/items/") && !finalFolder.startsWith("products/temp/")){
        // old format -> move under items
        const rest = finalFolder.slice("products/".length);
        if(rest) finalFolder = `products/items/${rest}`;
      }

      const safeName = (file.name||"image").replace(/[^a-zA-Z0-9._-]+/g,"_");
      const path = `${finalFolder}/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
      const r = sRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
      const url = await getDownloadURL(r);
      return url;
    }

    function normEmail(e){ return String(e||"").toLowerCase().trim(); }
    function uniqEmails(arr){
      const out = [];
      const seen = new Set();
      (arr||[]).forEach(x=>{
        const v = normEmail(x);
        if(v && !seen.has(v)){ seen.add(v); out.push(v); }
      });
      return out;
    }

    function uniqIds(arr){
      const out=[];
      const seen=new Set();
      (arr||[]).forEach(x=>{
        const v=(String(x||"").trim());
        if(!v) return;
        // Firebase UID usually 28 chars but allow 10+ safe chars
        if(!/^[A-Za-z0-9_-]{10,}$/.test(v)) return;
        if(!seen.has(v)){ seen.add(v); out.push(v); }
      });
      return out;
    }
    function isAdmin(user){
      const em = normEmail(user?.email);
      return !!em && state.adminEmails.includes(em);
    }
    function isVendor(user){
      const em = normEmail(user?.email);
      const uid = user?.uid || "";
      return ((!!em && state.vendorEmails.includes(em)) || (!!uid && (state.vendorUids||[]).includes(uid)));
    }
    
    async function loadAccessLists(){
      // admins: configs/admins { emails: [] }
      // vendors: configs/vendors { emails: [], uids: [] }
      try{
        const aSnap = await getDoc(doc(db,"configs","admins"));
        const a = aSnap.exists() ? (aSnap.data().emails||[]) : [];
        const localA = (()=>{ try{ return JSON.parse(localStorage.getItem("ADMIN_EMAILS")||"[]"); }catch(e){ return []; } })();
        state.adminEmails = uniqEmails([...(DEFAULT_ADMIN_EMAILS||[]), ...a, ...localA]);
      }catch(e){
        state.adminEmails = uniqEmails([...(DEFAULT_ADMIN_EMAILS||[])]);
      }
      try{
        const vSnap = await getDoc(doc(db,"configs","vendors"));
        const vData = vSnap.exists() ? (vSnap.data()||{}) : {};
        const v = (vData.emails||[]);
        const u = (vData.uids||[]);
        state.vendorEmails = uniqEmails(v);
        state.vendorUids = uniqIds(u);
      }catch(e){
        state.vendorEmails = [];
      }

      // Fill inputs if exists
      try{
        const aIn = document.getElementById("adminEmailsInput");
        if(aIn) aIn.value = state.adminEmails.join(", ");
        const vIn = document.getElementById("vendorEmailsInput");
        if(vIn) vIn.value = state.vendorEmails.join(", ");
        const uIn = document.getElementById("vendorUidsInput");
        if(uIn) uIn.value = (state.vendorUids||[]).join(", ");
        const cUid = document.getElementById("currentUidBox");
        if(cUid) cUid.textContent = (auth.currentUser?.uid || "-");
      }catch(e){}
    }

    async function saveAccessLists(){
      // Only admin can save
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin saqlay oladi","error");

      const aRaw = (document.getElementById("adminEmailsInput")?.value || "");
      const vRaw = (document.getElementById("vendorEmailsInput")?.value || "");
      const uRaw = (document.getElementById("vendorUidsInput")?.value || "");
      const admins = uniqEmails(aRaw.split(",").map(s=>s.trim()).filter(Boolean));
      const vendors = uniqEmails(vRaw.split(",").map(s=>s.trim()).filter(Boolean));
      const vendorUids = uniqIds(uRaw.split(",").map(s=>s.trim()).filter(Boolean));

      try{
        await setDoc(doc(db,"configs","admins"), { emails: admins, updatedAt: serverTimestamp() }, { merge:true });
        await setDoc(doc(db,"configs","vendors"), { emails: vendors, uids: vendorUids, updatedAt: serverTimestamp() }, { merge:true });
        try{ localStorage.setItem("ADMIN_EMAILS", JSON.stringify(admins)); }catch(e){}
        state.adminEmails = admins;
        state.vendorEmails = vendors;
        state.vendorUids = vendorUids;
        toast("Sozlamalar saqlandi");
      }catch(e){
        console.error(e);
        toast("Saqlashda xatolik: "+(e.message||e), "error");
      }
    }


    const DELIVERY_SETTINGS_DEFAULT = {
      version: 1,
      courier: {
        enabled: true,
        maxKm: 30,
        zones: [
          { id:"z1", fromKm:0, maxKm:3, feeUZS:10000, freeFromUZS:99000, etaText:"Bugun / 1 kun" },
          { id:"z2", fromKm:3, maxKm:7, feeUZS:15000, freeFromUZS:199000, etaText:"Bugun / 1 kun" },
          { id:"z3", fromKm:7, maxKm:12, feeUZS:25000, freeFromUZS:299000, etaText:"Bugun / 1 kun" },
          { id:"z4", fromKm:12, maxKm:20, feeUZS:35000, freeFromUZS:499000, etaText:"1–2 kun" },
          { id:"z5", fromKm:20, maxKm:30, baseFeeUZS:35000, perKmUZS:3000, freeFromUZS:899000, etaText:"1–2 kun" }
        ]
      },
      uzpost: {
        enabled: true,
        firstKgFeeUZS: 15000,
        extraKgFeeUZS: 3000,
        etaText: "2–5 kun",
        freeRules: [
          { maxKg:1, freeFromUZS:249000 },
          { maxKg:3, freeFromUZS:399000 },
          { maxKg:5, freeFromUZS:599000 },
          { maxKg:10, freeFromUZS:999000 }
        ]
      }
    };
    let deliverySettingsLoaded = false;
    function cleanNum(raw, fallback=0){
      const v = Number((raw ?? '').toString().replace(/[^0-9.-]/g,''));
      return Number.isFinite(v) ? v : fallback;
    }
    function numVal(id, fallback=0){ return cleanNum(document.getElementById(id)?.value, fallback); }
    function numFrom(el, fallback=0){ return cleanNum(el?.value, fallback); }
    function setVal(id, value){ const el = document.getElementById(id); if(el) el.value = value ?? ''; }
    function deliveryDefaultClone(){ try{ return (typeof structuredClone === "function") ? structuredClone(DELIVERY_SETTINGS_DEFAULT) : JSON.parse(JSON.stringify(DELIVERY_SETTINGS_DEFAULT)); }catch(e){ return JSON.parse(JSON.stringify(DELIVERY_SETTINGS_DEFAULT)); } }

    function sanitizeCourierZones(zones){
      const defaults = DELIVERY_SETTINGS_DEFAULT.courier.zones;
      const src = Array.isArray(zones) && zones.length ? zones : defaults;
      return src.map((z, i)=>{
        const fallback = defaults[Math.min(i, defaults.length-1)] || defaults[defaults.length-1];
        const fromKm = Math.max(0, cleanNum(z?.fromKm, fallback.fromKm || 0));
        const maxKm = Math.max(fromKm + 0.1, cleanNum(z?.maxKm, fallback.maxKm || fromKm + 3));
        return {
          id: String(z?.id || `z${i+1}`),
          fromKm,
          maxKm,
          feeUZS: Math.max(0, Math.round(cleanNum(z?.feeUZS ?? z?.baseFeeUZS, fallback.feeUZS ?? fallback.baseFeeUZS ?? 0))),
          baseFeeUZS: Math.max(0, Math.round(cleanNum(z?.baseFeeUZS ?? z?.feeUZS, fallback.baseFeeUZS ?? fallback.feeUZS ?? 0))),
          perKmUZS: Math.max(0, Math.round(cleanNum(z?.perKmUZS, fallback.perKmUZS || 0))),
          freeFromUZS: Math.max(0, Math.round(cleanNum(z?.freeFromUZS, fallback.freeFromUZS || 0))),
          etaText: String(z?.etaText || fallback.etaText || '1–2 kun')
        };
      }).sort((a,b)=>a.fromKm-b.fromKm || a.maxKm-b.maxKm).slice(0, 20);
    }

    function renderCourierZones(zones){
      const body = document.getElementById('deliveryCourierZonesBody');
      if(!body) return;
      const list = sanitizeCourierZones(zones);
      body.innerHTML = list.map((z, i)=>`
        <tr class="courierZoneRow" data-index="${i}">
          <td class="zoneIndex">${i+1}</td>
          <td><input type="number" min="0" step="0.1" class="form-control zoneFromKm" value="${z.fromKm}"></td>
          <td><input type="number" min="0.1" step="0.1" class="form-control zoneMaxKm" value="${z.maxKm}"></td>
          <td><input type="number" min="0" step="100" class="form-control zoneFee" value="${z.baseFeeUZS || z.feeUZS || 0}"></td>
          <td><input type="number" min="0" step="100" class="form-control zonePerKm" value="${z.perKmUZS || 0}" placeholder="0"></td>
          <td><input type="number" min="0" step="1000" class="form-control zoneFree" value="${z.freeFromUZS || 0}"></td>
          <td><input class="form-control zoneEta" value="${String(z.etaText || '1–2 kun').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"></td>
          <td><button type="button" class="btn btn-light btn-sm zoneDeleteBtn" title="Zonani o‘chirish"><i class="fas fa-trash"></i></button></td>
        </tr>
      `).join('');
      body.querySelectorAll('.zoneDeleteBtn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const rows = [...body.querySelectorAll('.courierZoneRow')];
          if(rows.length <= 1){ toast('Kamida bitta zona qolishi kerak', 'error'); return; }
          btn.closest('tr')?.remove();
          normalizeCourierZonesUI(false);
        });
      });
    }

    function readCourierZonesFromUI(){
      const rows = [...document.querySelectorAll('#deliveryCourierZonesBody .courierZoneRow')];
      const zones = rows.map((row, i)=>{
        const fromKm = Math.max(0, numFrom(row.querySelector('.zoneFromKm'), i ? 0 : 0));
        const maxKm = Math.max(fromKm + 0.1, numFrom(row.querySelector('.zoneMaxKm'), fromKm + 3));
        const fee = Math.max(0, Math.round(numFrom(row.querySelector('.zoneFee'), 0)));
        const perKm = Math.max(0, Math.round(numFrom(row.querySelector('.zonePerKm'), 0)));
        return {
          id: `z${i+1}`,
          fromKm,
          maxKm,
          feeUZS: fee,
          baseFeeUZS: fee,
          perKmUZS: perKm,
          freeFromUZS: Math.max(0, Math.round(numFrom(row.querySelector('.zoneFree'), 0))),
          etaText: (row.querySelector('.zoneEta')?.value || '1–2 kun').trim()
        };
      }).filter(z=>z.maxKm > z.fromKm);
      return sanitizeCourierZones(zones.length ? zones : DELIVERY_SETTINGS_DEFAULT.courier.zones);
    }

    function normalizeCourierZonesUI(showToast=true){
      const zones = readCourierZonesFromUI().sort((a,b)=>a.maxKm-b.maxKm);
      let prev = 0;
      const normalized = zones.map((z, i)=>{
        const maxKm = Math.max(prev + 0.1, Number(z.maxKm || prev + 3));
        const next = { ...z, id:`z${i+1}`, fromKm: Number(prev.toFixed(1)), maxKm: Number(maxKm.toFixed(1)) };
        prev = maxKm;
        return next;
      });
      renderCourierZones(normalized);
      const lastMax = normalized[normalized.length-1]?.maxKm || 30;
      setVal('deliveryCourierMaxKm', lastMax);
      if(showToast) toast('Zonalar ketma-ket tartiblandi');
    }

    function addCourierZoneFromUI(){
      const zones = readCourierZonesFromUI();
      const last = zones[zones.length-1] || DELIVERY_SETTINGS_DEFAULT.courier.zones[DELIVERY_SETTINGS_DEFAULT.courier.zones.length-1];
      const fromKm = Math.max(0, Number(last.maxKm || 0));
      const maxKm = fromKm + 5;
      zones.push({
        id:`z${zones.length+1}`,
        fromKm,
        maxKm,
        feeUZS: Math.max(0, Number(last.baseFeeUZS || last.feeUZS || 35000)),
        baseFeeUZS: Math.max(0, Number(last.baseFeeUZS || last.feeUZS || 35000)),
        perKmUZS: Math.max(0, Number(last.perKmUZS || 3000)),
        freeFromUZS: Math.max(0, Number(last.freeFromUZS || 0)),
        etaText: last.etaText || '1–2 kun'
      });
      renderCourierZones(zones);
      setVal('deliveryCourierMaxKm', maxKm);
    }

    function fillDeliverySettingsForm(cfg){
      const d = cfg || deliveryDefaultClone();
      const z = sanitizeCourierZones(d.courier?.zones || DELIVERY_SETTINGS_DEFAULT.courier.zones);
      setVal('deliveryCourierMaxKm', d.courier?.maxKm ?? z[z.length-1]?.maxKm ?? 30);
      setVal('deliveryCourierPerKm', z[z.length-1]?.perKmUZS ?? 3000);
      renderCourierZones(z);
      setVal('uzpostFirstKgFee', d.uzpost?.firstKgFeeUZS ?? 15000);
      setVal('uzpostExtraKgFee', d.uzpost?.extraKgFeeUZS ?? 3000);
      setVal('uzpostEtaText', d.uzpost?.etaText ?? '2–5 kun');
      const r = d.uzpost?.freeRules || DELIVERY_SETTINGS_DEFAULT.uzpost.freeRules;
      setVal('uzpostFree1', r[0]?.freeFromUZS ?? 249000);
      setVal('uzpostFree3', r[1]?.freeFromUZS ?? 399000);
      setVal('uzpostFree5', r[2]?.freeFromUZS ?? 599000);
      setVal('uzpostFree10', r[3]?.freeFromUZS ?? 999000);
    }
    function readDeliverySettingsForm(){
      let zones = readCourierZonesFromUI();
      const globalPerKm = numVal('deliveryCourierPerKm', NaN);
      if(Number.isFinite(globalPerKm) && globalPerKm >= 0){
        zones = zones.map((z, i)=> i === zones.length - 1 && Number(z.perKmUZS || 0) > 0 ? { ...z, perKmUZS: globalPerKm } : z);
      }
      const lastMax = zones[zones.length-1]?.maxKm || 30;
      const maxKm = Math.max(1, lastMax, numVal('deliveryCourierMaxKm', lastMax));
      return {
        version: 2,
        courier: {
          enabled: true,
          maxKm,
          zones
        },
        uzpost: {
          enabled: true,
          firstKgFeeUZS: numVal('uzpostFirstKgFee',15000),
          extraKgFeeUZS: numVal('uzpostExtraKgFee',3000),
          etaText: (document.getElementById('uzpostEtaText')?.value || '2–5 kun').trim(),
          freeRules: [
            { maxKg:1, freeFromUZS:numVal('uzpostFree1',249000) },
            { maxKg:3, freeFromUZS:numVal('uzpostFree3',399000) },
            { maxKg:5, freeFromUZS:numVal('uzpostFree5',599000) },
            { maxKg:10, freeFromUZS:numVal('uzpostFree10',999000) }
          ]
        },
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || auth.currentUser?.uid || ''
      };
    }
    async function loadDeliverySettingsAdmin(){
      if(deliverySettingsLoaded) return;
      deliverySettingsLoaded = true;
      try{
        const snap = await getDoc(doc(db, 'configs', 'delivery'));
        fillDeliverySettingsForm(snap.exists() ? snap.data() : deliveryDefaultClone());
        const st = document.getElementById('deliverySettingsStatus');
        if(st) st.innerHTML = snap.exists() ? 'Tariflar yuklandi: <code>configs/delivery</code>' : 'Standart tariflar ko‘rsatildi. Saqlasangiz Firestore’ga yoziladi.';
      }catch(e){
        fillDeliverySettingsForm(deliveryDefaultClone());
        const st = document.getElementById('deliverySettingsStatus');
        if(st) st.textContent = 'Tariflarni yuklashda xatolik. Standart qiymatlar ko‘rsatildi.';
      }
    }
    async function saveDeliverySettingsAdmin(){
      if(!isAdmin(auth.currentUser)) return toast('Faqat admin yetkazish tariflarini saqlay oladi','error');
      try{ normalizeCourierZonesUI(false); }catch(_e){}
      const cfg = readDeliverySettingsForm();
      try{
        await setDoc(doc(db, 'configs', 'delivery'), cfg, { merge:true });
        try{ localStorage.setItem('orzumall_delivery_settings_v1', JSON.stringify({...cfg, updatedAt: Date.now()})); }catch(e){}
        toast('Yetkazish tariflari saqlandi');
        const st = document.getElementById('deliverySettingsStatus');
        if(st) st.innerHTML = 'Saqlandi: <code>configs/delivery</code>';
      }catch(e){
        console.error(e);
        toast('Yetkazish tariflarini saqlashda xatolik: '+(e.message||e), 'error');
      }
    }

function nowISO(){ return new Date().toISOString().split("T")[0]; }
    function formatPrice(n){
      const v = Number(n||0);
      return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g," ") + " so‘m";
    }
    function toast(msg, type="success"){
      const el = $("toast");
      $("toastMessage").textContent = msg;
      el.className = "toast show " + (type==="success"?"toast-success":"toast-error");
      el.querySelector("i").className = type==="success"?"fas fa-check-circle":"fas fa-exclamation-circle";
      setTimeout(()=>el.classList.remove("show"), 3000);
    }
    function esc(s){
      return (s??"").toString()
        .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
        .replaceAll('"',"&quot;").replaceAll("'","&#039;");
    }
    function openModal(id){ $(id).style.display="flex"; }
    function closeModal(id){ $(id).style.display="none"; }
    function showQuickModal(title, innerHtml){
      // lightweight, self-contained modal (no dependencies)
      const wrap = document.createElement("div");
      wrap.style.position="fixed";
      wrap.style.inset="0";
      wrap.style.background="rgba(0,0,0,.45)";
      wrap.style.display="flex";
      wrap.style.alignItems="center";
      wrap.style.justifyContent="center";
      wrap.style.zIndex="9999";
      wrap.innerHTML = `
        <div style="width:min(900px,92vw);max-height:88vh;background:#fff;border-radius:16px;box-shadow:0 20px 80px rgba(0,0,0,.25);overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.08)">
            <div style="font-weight:900">${escapeHtml(title||"")}</div>
            <button class="btn btn-light btn-sm" data-x><i class="fas fa-times"></i></button>
          </div>
          <div style="padding:14px;overflow:auto;max-height:78vh">${innerHtml||""}</div>
        </div>
      `;
      function close(){ wrap.remove(); document.removeEventListener("keydown", onKey); }
      function onKey(e){ if(e.key==="Escape") close(); }
      wrap.addEventListener("click",(e)=>{ if(e.target===wrap) close(); });
      wrap.querySelector("[data-x]")?.addEventListener("click", close);
      document.addEventListener("keydown", onKey);
      document.body.appendChild(wrap);
    }

    function normalize(p){
      const o = { ...p };
      o.id = o.id || p.id;
      o.price = Number(o.price||0);
      o.oldPrice = Number(o.oldPrice||0);
      o.popularScore = Number(o.popularScore||0);
      o.currency = o.currency || "UZS";
      o.tags = Array.isArray(o.tags)?o.tags:[];
      o.colors = Array.isArray(o.colors)?o.colors:[];
      o.sizes = Array.isArray(o.sizes)?o.sizes:[];
      o.images = Array.isArray(o.images)?o.images:[];
      o.variants = Array.isArray(o.variants)?o.variants:[];
      o.createdAt = o.createdAt || nowISO();
      if(o.imagesByColor && typeof o.imagesByColor !== "object") delete o.imagesByColor;
      return o;
    }

    async function fetchProducts(){
      const btn = document.getElementById("refreshBtn");
      try{
        if(btn){ btn.disabled=true; btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Yangilash'; }
        let snap;
        // Vendor: faqat o'z mahsulotlarini ko'rsin
        if(state.role === "vendor" && auth.currentUser){
          snap = await getDocs(query(collection(db,"products"), where("ownerUid","==", auth.currentUser.uid)));
        }else{
          snap = await getDocs(collection(db,"products"));
        }
        const items = snap.docs.map(d=> normalize({ id:d.id, ...d.data() }));
        // deterministic order: newest first if possible
        items.sort((a,b)=>{
          const ad = a.updatedAt?.seconds ? a.updatedAt.seconds : (a.updatedAt?.toDate? (a.updatedAt.toDate().getTime()/1000): 0);
          const bd = b.updatedAt?.seconds ? b.updatedAt.seconds : (b.updatedAt?.toDate? (b.updatedAt.toDate().getTime()/1000): 0);
          if(bd!==ad) return bd-ad;
          return String(a.id||"").localeCompare(String(b.id||""));
        });
        state.products = items;
        renderTable();
        renderStats();
        try{ renderStatsPanels(); }catch(e){}
        try{ renderCategoryAdmin(); }catch(e){}
        return items;
      }catch(e){
        console.error(e);
        toast("Mahsulotlarni yuklashda xatolik: "+(e.message||e), "error");
        return [];
      }finally{
        if(btn){ btn.disabled=false; btn.innerHTML = '<i class="fas fa-rotate"></i> Yangilash'; }
      }
    }

    // Fulfillment pill (Mahsulot turi: stock / cargo)
    function renderProductTypePill(p){
      const t = String(p?.productType||"").toLowerCase();
      if(!t) return ``;
      if(t==="original") return `<span class="tag" style="background:rgba(34,197,94,.10);color:var(--success)" title="Asl mahsulot"><i class="fas fa-circle-check"></i> Asl mahsulot</span>`;
      if(t==="oem") return `<span class="tag" style="background:rgba(59,130,246,.10);color:var(--primary)" title="OEM"><i class="fas fa-industry"></i> OEM</span>`;
      if(t==="replica" || t==="copy" || t==="nusxa") return `<span class="tag" style="background:rgba(239,68,68,.10);color:var(--danger)" title="Nusxa"><i class="fas fa-clone"></i> Nusxa</span>`;
      return `<span class="tag" title="Mahsulot turi">${esc(t)}</span>`;
    }

    function renderFulfillmentPill(p){
      try{
        const t = String(p?.pType || p?.fulfillment || p?.fulfillmentType || p?.deliveryType || "stock").toLowerCase();
        if(t === "cargo" || t === "keltirib" || t === "keltirib_beramiz" || t === "bring"){
          const dmin = p?.deliveryMinDays;
          const dmax = p?.deliveryMaxDays;
          const hint = (dmin||dmax) ? ` (${dmin||""}${(dmin&&dmax)?"-":""}${dmax||""} kun)` : "";
          return `<span class="pill cargo"><i class="fas fa-truck"></i> Keltirib beramiz${hint}</span>`;
        }
        return `<span class="pill stock"><i class="fas fa-box"></i> O‘zimizda</span>`;
      }catch(e){
        return `<span class="pill stock"><i class="fas fa-box"></i> O‘zimizda</span>`;
      }
    }

    // ======= Turnover (Hisob aylanmasi) =======
    let unsubTurnoverOrders = null;
    let unsubTurnoverTopups = null;
    state.turnoverOrders = [];
    state.turnoverTopups = [];
    state.turnoverAll = [];

    function toDateOnly(ts){
      try{
        if(!ts) return null;
        const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds*1000) : new Date(ts));
        if(isNaN(d.getTime())) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }catch(e){ return null; }
    }

    function subscribeTurnover(){
      try{
        // unsubscribe previous
        try{ unsubTurnoverOrders && unsubTurnoverOrders(); }catch(_e){}
        try{ unsubTurnoverTopups && unsubTurnoverTopups(); }catch(_e){}
        unsubTurnoverOrders = null;
        unsubTurnoverTopups = null;

        if(!db){ toast("DB yo‘q","error"); return; }
        $("turnoverState").textContent = "Yuklanmoqda…";

        // 1) Checkout/Sales orders
        const qOrders = query(collection(db,"orders"), orderBy("createdAt","desc"), limit(500));
        unsubTurnoverOrders = onSnapshot(qOrders, (snap)=>{
          state.turnoverOrders = snap.docs.map(d=>({ id:d.id, ...d.data(), __src:"orders" }));
          mergeTurnoverSources();
        }, (err)=>{
          console.error(err);
          $("turnoverState").textContent = "Xato (orders)";
          toast("Orders o‘qishda xato: "+(err?.message||err),"error");
        });

        // 2) Manual topups (topup_requests)
        const qTopups = query(collection(db,"topup_requests"), orderBy("createdAt","desc"), limit(500));
        unsubTurnoverTopups = onSnapshot(qTopups, (snap)=>{
          state.turnoverTopups = snap.docs.map(d=>({ id:d.id, ...d.data(), __src:"topup_requests" }));
          mergeTurnoverSources();
        }, (err)=>{
          console.error(err);
          // Don't block UI if topup rules/index missing
          $("turnoverState").textContent = "Xato (topup_requests)";
          toast("Topup so‘rovlari o‘qishda xato: "+(err?.message||err),"error");
        });

      }catch(e){
        console.error(e);
        toast("Turnover xato: "+(e?.message||e),"error");
      }
    }

    function mergeTurnoverSources(){
      // normalize orders + topup_requests into one list for rendering
      const orders = (state.turnoverOrders||[]).map(o=>{
        const createdAt = o.createdAt || o.created_at || o.time || null;
        return {
          ...o,
          orderId: o.orderId || o.id,
          uid: o.uid || o.userUid || o.user_id || null,
          numericId: o.numericId || o.userNumericId || o.numeric_id || null,
          userName: o.userName || o.name || null,
          userPhone: o.userPhone || o.phone || null,
          provider: o.provider || (o.orderType==="topup" ? "manual" : "checkout"),
          orderType: (o.orderType || "checkout"),
          status: (o.status || "pending_payment"),
          totalUZS: Number(o.totalUZS || o.amountUZS || o.amount || 0),
          createdAt
        };
      });

      const topups = (state.turnoverTopups||[]).map(r=>{
        const st0 = String(r.status || "pending").toLowerCase();
        // map manual topup statuses to common ledger statuses
        let st = st0;
        if(st0==="approved" || st0==="success") st = "paid";
        else if(st0==="rejected" || st0==="canceled" || st0==="cancelled" || st0==="canceled_by_admin") st = "cancelled";
        else if(st0==="pending" || st0==="waiting") st = "pending";
        const createdAt = r.createdAt || r.created_at || r.time || null;
        return {
          id: r.id,
          orderId: r.id,
          uid: r.uid || r.userUid || null,
          numericId: r.numericId || null,
          userName: r.userName || null,
          userPhone: r.userPhone || null,
          provider: "manual",
          orderType: "topup",
          status: st,
          totalUZS: Number(r.amountUZS || r.totalUZS || 0),
          createdAt
        };
      });

      const merged = [...topups, ...orders].sort((a,b)=>{
        const da = (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds*1000 : (a.createdAt ? new Date(a.createdAt).getTime():0))) || 0;
        const dbt = (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds*1000 : (b.createdAt ? new Date(b.createdAt).getTime():0))) || 0;
        return dbt - da;
      });

      (async()=>{
        state.turnoverAll = await enrichTurnoverWithUsers(merged);
        const loaded = (state.turnoverAll||[]).length;
        $("turnoverState").textContent = `${loaded} ta yuklandi`;
        renderTurnover();
      })();
    }

    function renderTurnover(){
      const tbody = $("turnoverTbody");
      const cards = $("turnoverCards");
      const empty = $("turnoverEmpty");
      if(tbody) tbody.innerHTML = "";
      if(cards) cards.innerHTML = "";
      if(!tbody && !cards) return;

      const q = String($("turnoverSearch")?.value||"").trim().toLowerCase();
      const type = String($("turnoverType")?.value||"all");
      const status = String($("turnoverStatus")?.value||"all");
      const from = $("turnoverFrom")?.value ? new Date($("turnoverFrom").value+"T00:00:00") : null;
      const to   = $("turnoverTo")?.value   ? new Date($("turnoverTo").value+"T23:59:59") : null;

      const filtered = (state.turnoverAll||[]).filter(o=>{
        const ot = String(o.orderType||"checkout").toLowerCase();
        const st = String(o.status||"").toLowerCase();
        if(type!=="all"){
          if(type==="topup" && ot!=="topup") return false;
          if(type==="checkout" && ot==="topup") return false;
        }
        if(status!=="all" && st!==status) return false;

        if(from || to){
          const d = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000) : (o.createdAt ? new Date(o.createdAt) : null));
          if(d){
            if(from && d < from) return false;
            if(to && d > to) return false;
          }
        }

        if(q){
          const hay = [
            o.id, o.orderId,
            o.userPublicId, o.numericId, o.uid,
            o.userName, o.userPhone,
            o.provider, o.orderType, o.status
          ].map(x=>String(x||"").toLowerCase()).join(" ");
          if(!hay.includes(q)) return false;
        }
        return true;
      });

      // stats
      const uids = new Set();
      let topupPaid = 0;
      let salesPaid = 0;
      for(const o of filtered){
        if(o.uid) uids.add(o.uid);
        const amt = Number(o.totalUZS||0);
        const st = String(o.status||"").toLowerCase();
        const ot = String(o.orderType||"checkout").toLowerCase();
        if(st==="paid"){
          if(ot==="topup") topupPaid += amt;
          else salesPaid += amt;
        }
      }
      $("turnoverTopup").textContent = topupPaid.toLocaleString();
      $("turnoverSales").textContent = salesPaid.toLocaleString();
      $("turnoverCount").textContent = String(filtered.length);
      $("turnoverUsers").textContent = String(uids.size);

      if(empty) empty.style.display = filtered.length ? "none" : "block";

      // cards + table
      if(!filtered.length){
        if(tbody){
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--gray)">Hech narsa topilmadi</td></tr>`;
        }
        return;
      }

      for(const o of filtered){
        const ot = String(o.orderType||"checkout").toLowerCase();
        const st = String(o.status||"").toLowerCase();
        const stLabel = statusUZ(st) || st;
        const pill = `<span class="status-pill status-${statusClass3(st)}">${escapeHtml(stLabel)}</span>`;
        const when = escapeHtml(formatTS(o.createdAt));
        const sum = Number(o.totalUZS||0).toLocaleString();
        const userId = escapeHtml(String(o.userPublicId || o.numericId || o.uid || "—"));
        const phone = escapeHtml(String(o.userPhone || "—"));
        const prov = providerUZ(String(o.provider||"")) || String(o.provider||"");

        const canAct = (o.__src==="topup_requests") && (st==="pending");
        const actions = canAct ? `
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-sm btn-success" data-topup-act="approve" data-topup-id="${escapeHtml(String(o.id||o.orderId||''))}" title="Tasdiqlash"><i class="fas fa-check"></i></button>
            <button class="btn btn-sm btn-danger" data-topup-act="cancel" data-topup-id="${escapeHtml(String(o.id||o.orderId||''))}" title="Bekor qilish"><i class="fas fa-xmark"></i></button>
          </div>` : '—';

        // Cards UI
        if(cards){
          const div = document.createElement("div");
          div.className = "order-card turnover-card card-status-"+statusClass3(o.status);
          div.innerHTML = `
            <div class="order-card-top">
              <div class="order-id">
                <div class="k">${ot==="topup"?"Top-up":"Buyurtma"}</div>
                <div class="v"><code>${escapeHtml(String(o.orderId||o.id||''))}</code></div>
              </div>
              <div class="order-status-wrap">
                <div class="k">Holat</div>
                <div class="v">${pill}</div>
              </div>
            </div>

            <div class="order-card-mid">
              <div class="order-chip"><span class="k">Foydalanuvchi ID</span><span class="v"><span class="mono truncate" title="${userId}">${userId}</span></span></div>
              <div class="order-chip"><span class="k">Telefon</span><span class="v">${phone}</span></div>
              <div class="order-chip"><span class="k">To‘lov</span><span class="v">${escapeHtml(String(prov||"—"))}</span></div>
              <div class="order-chip"><span class="k">Vaqt</span><span class="v">${when}</span></div>
            </div>

            <div class="order-card-bottom" style="align-items:center">
              <div class="order-total">
                <div class="k">Summa</div>
                <div class="v">${escapeHtml(sum)} <span class="muted">so‘m</span></div>
              </div>
              <div>${actions}</div>
            </div>
          `;
          cards.appendChild(div);
        }

        // Table row
        if(tbody){
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><code>${escapeHtml(String(o.orderId||o.id||''))}</code></td>
            <td>${userId}<div class="muted" style="font-size:12px">${phone}</div></td>
            <td>${escapeHtml(ot==="topup"?"Top-up":"Buyurtma")}</td>
            <td>${pill}</td>
            <td>${escapeHtml(String(prov||"—"))}</td>
            <td><b>${escapeHtml(sum)}</b> so‘m</td>
            <td>${when}</td>
            <td>${actions}</td>
          `;
          tbody.appendChild(tr);
        }
      }
    }

    

    /* ===== Professional editable category system: admin-managed, independent from tags ===== */
    const OM_ADMIN_CATEGORY_STORAGE_KEY = "orzumall_admin_categories_v13";
    const OM_ADMIN_CATEGORY_CONFIG_DOC = ["configs", "categories"];
    const OM_ADMIN_CATEGORY_ICONS = [
      "fa-sparkles","fa-face-smile","fa-scissors","fa-spa","fa-wand-magic-sparkles","fa-spray-can-sparkles","fa-brush",
      "fa-mobile-screen","fa-mobile-screen-button","fa-plug","fa-headphones","fa-clock","fa-camera","fa-gamepad",
      "fa-house","fa-kitchen-set","fa-broom","fa-box-archive","fa-couch","fa-shirt","fa-person-dress","fa-user-tie",
      "fa-bag-shopping","fa-gem","fa-heart-pulse","fa-hands-bubbles","fa-leaf","fa-child","fa-baby","fa-puzzle-piece",
      "fa-box-open","fa-layer-group","fa-tags","fa-star","fa-fire","fa-gift","fa-truck-fast"
    ];
    const OM_ADMIN_CATEGORY_CATALOG_DEFAULT = [
      {id:"beauty", name:"Go‘zallik va parvarish", icon:"fa-sparkles", keywords:["kosmetik","beauty","go‘zallik","go'zallik","parvarish","bioaqua"], children:[
        {id:"skincare", name:"Yuz parvarishi", icon:"fa-face-smile", keywords:["yuz","face","krem","niqob","mask","aloe","rice","guruch","serum","sovun","soap"]},
        {id:"haircare", name:"Soch parvarishi", icon:"fa-scissors", keywords:["soch","hair","shampun","balzam","conditioner","taroq","raw pulp"]},
        {id:"bodycare", name:"Tana parvarishi", icon:"fa-spa", keywords:["tana","body","massaj","cho‘tka","cho'tka","brush","scrub","sponge","gubka"]},
        {id:"depilation", name:"Depilyatsiya", icon:"fa-wand-magic-sparkles", keywords:["depilyatsiya","wax","vоск","воск","hot wax","mum","granula","spatula","shugaring"]},
        {id:"perfume", name:"Atirlar", icon:"fa-spray-can-sparkles", keywords:["atir","parfum","perfume","duhi","dukh","aroma","fragrance","creed","aventus"]},
        {id:"beauty-tools", name:"Kosmetik aksessuarlar", icon:"fa-brush", keywords:["aksessuar","accessory","cho'p","cho‘p","spatula","applikator","brush","щетка","silikon","plastik"]}
      ]},
      {id:"electronics", name:"Elektronika", icon:"fa-mobile-screen", keywords:["telefon","phone","elektron","gadget"], children:[
        {id:"phones", name:"Telefonlar", icon:"fa-mobile-screen-button", keywords:["telefon","smartfon","iphone","samsung","xiaomi","redmi"]},
        {id:"phone-accessories", name:"Telefon aksessuarlari", icon:"fa-plug", keywords:["charger","zaryad","quvvatlagich","adapter","case","chexol","kabel","powerbank","usb"]},
        {id:"audio", name:"Audio", icon:"fa-headphones", keywords:["naushnik","tws","bluetooth","earphone","speaker","kolonka","audio"]},
        {id:"smart-devices", name:"Smart qurilmalar", icon:"fa-clock", keywords:["smart watch","soat","watch","kamera","camera"]}
      ]},
      {id:"home", name:"Uy-ro‘zg‘or", icon:"fa-house", keywords:["uy","home","oshxona","kitchen"], children:[
        {id:"kitchen", name:"Oshxona", icon:"fa-kitchen-set", keywords:["oshxona","kitchen","pichoq","idish","termos","blender","choynak"]},
        {id:"cleaning", name:"Tozalash", icon:"fa-broom", keywords:["tozalash","clean","mop","supurgi","salfetka"]},
        {id:"storage", name:"Saqlash va tartib", icon:"fa-box-archive", keywords:["organizer","saqlash","box","quti","polka"]},
        {id:"home-decor", name:"Dekor", icon:"fa-couch", keywords:["dekor","lamp","chiroq","gilam","parda"]}
      ]},
      {id:"fashion", name:"Kiyim va aksessuarlar", icon:"fa-shirt", keywords:["kiyim","fashion","clothes"], children:[
        {id:"women-fashion", name:"Ayollar uchun", icon:"fa-person-dress", keywords:["ayol","women","dress","ko‘ylak","sumka","bijuteriya"]},
        {id:"men-fashion", name:"Erkaklar uchun", icon:"fa-user-tie", keywords:["erkak","men","futbolka","shim","remen","soat"]},
        {id:"bags", name:"Sumka va hamyonlar", icon:"fa-bag-shopping", keywords:["sumka","bag","hamyon","wallet","ryukzak"]},
        {id:"jewelry", name:"Bijuteriya", icon:"fa-gem", keywords:["uzuk","zirak","taqinchoq","jewelry","bijuteriya"]}
      ]},
      {id:"health", name:"Sog‘liq va gigiyena", icon:"fa-heart-pulse", keywords:["sog‘liq","sogliq","health","gigiyena"], children:[
        {id:"hygiene", name:"Gigiyena", icon:"fa-hands-bubbles", keywords:["gigiyena","hygiene","sovun","soap","antiseptik","tish","tooth"]},
        {id:"wellness", name:"Wellness", icon:"fa-leaf", keywords:["wellness","massaj","relax","vitamin"]}
      ]},
      {id:"kids", name:"Bolalar tovarlari", icon:"fa-child", keywords:["bola","baby","kids"], children:[
        {id:"kids-care", name:"Bolalar parvarishi", icon:"fa-baby", keywords:["baby","chaqaloq","pampers","bolalar"]},
        {id:"toys", name:"O‘yinchoqlar", icon:"fa-puzzle-piece", keywords:["toy","o‘yinchoq","oyinchoq","puzzle","lego"]}
      ]},
      {id:"other", name:"Boshqa mahsulotlar", icon:"fa-box-open", keywords:[], children:[
        {id:"other-products", name:"Turli mahsulotlar", icon:"fa-layer-group", keywords:[]}
      ]}
    ];
    let OM_ADMIN_CATEGORY_CATALOG = adminCloneCategories(OM_ADMIN_CATEGORY_CATALOG_DEFAULT);
    let categorySettingsLoaded = false;
    let editingCategoryId = null;
    // v15 hotfix: module scripts run in strict mode; v14 assigned this later without declaring it.
    let setProductCategorySelects = function(path){ try{ setCategoryFormValue(path); }catch(e){} };

    function adminCloneCategories(tree){ return JSON.parse(JSON.stringify(Array.isArray(tree)?tree:[])); }
    function adminCatSlug(v){return String(v||"").trim().toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,"-").replace(/[^a-z0-9а-яёўғқҳ'\-]+/gi,"-").replace(/^-+|-+$/g,"") || "category";}
    function adminUniqId(base, excludeId=""){
      const ids=new Set();
      const walk=(arr)=>{(arr||[]).forEach(c=>{ if(c?.id && c.id!==excludeId) ids.add(c.id); walk(c.children||[]); });};
      walk(OM_ADMIN_CATEGORY_CATALOG);
      let id=adminCatSlug(base||"category"), n=2, out=id;
      while(ids.has(out)) out=`${id}-${n++}`;
      return out;
    }
    function adminSanitizeCategoryTree(tree){
      const clean=(arr,parentId=null)=>{
        if(!Array.isArray(arr)) return [];
        const used=new Set();
        return arr.map((raw,idx)=>{
          const name=String(raw?.name||raw?.ru||`Kategoriya ${idx+1}`).trim();
          let id=adminCatSlug(raw?.id||name);
          let n=2, base=id;
          while(used.has(id)) id=`${base}-${n++}`;
          used.add(id);
          const item={
            id,
            name,
            ru:String(raw?.ru||"").trim(),
            icon:String(raw?.icon||"fa-layer-group").replace(/^fa-solid\s+/,"").trim() || "fa-layer-group",
            keywords:Array.isArray(raw?.keywords) ? raw.keywords.map(x=>String(x).trim()).filter(Boolean) : String(raw?.keywords||"").split(",").map(x=>x.trim()).filter(Boolean),
            children: clean(raw?.children||[], id)
          };
          return item;
        }).filter(x=>x.name);
      };
      const out=clean(tree);
      if(!out.length) return adminCloneCategories(OM_ADMIN_CATEGORY_CATALOG_DEFAULT);
      return out;
    }
    function adminInvalidateCategoryCache(){
      try{ delete window.__omAdminCategoryFlat; }catch(e){ window.__omAdminCategoryFlat=null; }
      ["productCategoryFilter","productCategory"].forEach(id=>{ const el=$(id); if(el) delete el.dataset.ready; });
    }
    function adminSetCategoryCatalog(tree, opts={}){
      OM_ADMIN_CATEGORY_CATALOG = adminSanitizeCategoryTree(tree);
      adminInvalidateCategoryCache();
      try{ localStorage.setItem(OM_ADMIN_CATEGORY_STORAGE_KEY, JSON.stringify(OM_ADMIN_CATEGORY_CATALOG)); }catch(e){}
      if(!opts.silent){
        populateCategoryFilters(true);
        try{ syncSubcategorySelect($("productSubcategory")?.value||""); }catch(e){}
        try{ renderCategoryAdmin(); }catch(e){}
        try{ renderTable(); }catch(e){}
        try{ renderStatsPanels(); }catch(e){}
      }
    }
    async function loadCategorySettingsAdmin(force=false){
      if(categorySettingsLoaded && !force) return OM_ADMIN_CATEGORY_CATALOG;
      categorySettingsLoaded = true;
      let loaded = null;
      try{
        const snap = await getDoc(doc(db, OM_ADMIN_CATEGORY_CONFIG_DOC[0], OM_ADMIN_CATEGORY_CONFIG_DOC[1]));
        if(snap.exists()){
          const d=snap.data()||{};
          loaded = Array.isArray(d.tree) ? d.tree : (Array.isArray(d.categories) ? d.categories : null);
        }
      }catch(e){ console.warn("categories config read failed", e); }
      if(!loaded){
        try{ loaded = JSON.parse(localStorage.getItem(OM_ADMIN_CATEGORY_STORAGE_KEY)||"null"); }catch(e){}
      }
      adminSetCategoryCatalog(loaded || OM_ADMIN_CATEGORY_CATALOG_DEFAULT, {silent:true});
      return OM_ADMIN_CATEGORY_CATALOG;
    }
    async function saveCategorySettingsAdmin(){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin kategoriyalarni saqlay oladi","error");
      try{
        const payload = {
          tree: adminCloneCategories(OM_ADMIN_CATEGORY_CATALOG),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || auth.currentUser?.uid || "",
          version: 13
        };
        await setDoc(doc(db, OM_ADMIN_CATEGORY_CONFIG_DOC[0], OM_ADMIN_CATEGORY_CONFIG_DOC[1]), payload, {merge:true});
        try{ localStorage.setItem(OM_ADMIN_CATEGORY_STORAGE_KEY, JSON.stringify(OM_ADMIN_CATEGORY_CATALOG)); }catch(e){}
        toast("Kategoriyalar saqlandi");
      }catch(e){
        console.error(e);
        toast("Kategoriyalarni saqlashda xatolik: "+(e.message||e), "error");
      }
    }
    function adminCategoryFlat(){
      if(window.__omAdminCategoryFlat) return window.__omAdminCategoryFlat;
      const flat=new Map(), byName=new Map();
      const walk=(arr,parent=null,path=[])=>{(arr||[]).forEach(def=>{const item={...def,parentId:parent?.id||null,pathIds:[...path,def.id]}; flat.set(def.id,item); [def.id,def.name,def.ru].filter(Boolean).forEach(x=>byName.set(adminCatSlug(x),item)); walk(def.children||[],item,item.pathIds);});};
      walk(OM_ADMIN_CATEGORY_CATALOG);
      window.__omAdminCategoryFlat={flat,byName}; return window.__omAdminCategoryFlat;
    }
    function adminGetCategoryDef(idOrName){const {flat,byName}=adminCategoryFlat(); const k=String(idOrName||"").trim(); return flat.get(k)||byName.get(adminCatSlug(k))||null;}
    function adminFindCategoryParent(id){
      let found=null;
      const walk=(arr,parent=null)=>{ for(const c of arr||[]){ if(c.id===id){ found=parent; return true; } if(walk(c.children||[], c)) return true; } return false; };
      walk(OM_ADMIN_CATEGORY_CATALOG);
      return found;
    }
    function adminFindCategoryRaw(id, arr=OM_ADMIN_CATEGORY_CATALOG){
      for(const c of arr||[]){ if(c.id===id) return c; const f=adminFindCategoryRaw(id,c.children||[]); if(f) return f; }
      return null;
    }
    function adminRemoveCategoryRaw(id, arr=OM_ADMIN_CATEGORY_CATALOG){
      const idx=(arr||[]).findIndex(c=>c.id===id);
      if(idx>=0) return arr.splice(idx,1)[0];
      for(const c of arr||[]){ const r=adminRemoveCategoryRaw(id,c.children||[]); if(r) return r; }
      return null;
    }
    function adminExplicitCategoryPath(p){
      const arr=p?.categoryPathIds||p?.categoryIds;
      if(Array.isArray(arr)&&arr.length){const ids=arr.map(x=>adminGetCategoryDef(x)?.id).filter(Boolean); if(ids.length) return ids;}
      const cat=adminGetCategoryDef(p?.categoryId||p?.mainCategoryId||p?.categorySlug||p?.category);
      const sub=adminGetCategoryDef(p?.subcategoryId||p?.subCategoryId||p?.subcategorySlug||p?.subcategory);
      if(cat&&sub){ if(sub.parentId===cat.id) return [cat.id,sub.id]; return cat.parentId?cat.pathIds:[cat.id]; }
      if(sub) return sub.pathIds;
      if(cat) return cat.pathIds;
      const names=p?.categoryPath||p?.categories;
      if(Array.isArray(names)&&names.length){const ids=names.map(x=>adminGetCategoryDef(x)?.id).filter(Boolean); if(ids.length) return ids;}
      return [];
    }
    function adminInferCategoryPath(p){
      const explicit=adminExplicitCategoryPath(p); if(explicit.length) return explicit;
      const hay=[p?.name,p?.name_ru,p?.name_en,p?.description,p?.description_ru,p?.productType,p?.fulfillmentType,...(Array.isArray(p?.tags)?p.tags:[])].filter(Boolean).join(" ").toLowerCase();
      let best=null; const score=(def)=>{let s=0; for(const kw of (def.keywords||[])){const k=String(kw).toLowerCase(); if(k&&hay.includes(k)) s+=k.length>6?3:2;} return s;};
      for(const parent of OM_ADMIN_CATEGORY_CATALOG){const ps=score(parent); if(ps&&(!best||ps>best.score)) best={score:ps,path:[parent.id]}; for(const child of (parent.children||[])){const sc=ps+score(child); if(sc&&(!best||sc>best.score)) best={score:sc,path:[parent.id,child.id]};}}
      return best?.path || ["other","other-products"];
    }
    function adminProductCategoryPathIds(p){return adminInferCategoryPath(p);}
    function adminProductCategoryLabel(p){return adminProductCategoryPathIds(p).map(id=>adminGetCategoryDef(id)?.name).filter(Boolean).join(" / ") || "Boshqa mahsulotlar";}
    function adminProductInCategory(p,catId){ if(!catId||catId==="all") return true; const path=adminProductCategoryPathIds(p); return path.includes(catId); }
    function adminCategoryPayloadFromPath(path){
      const ids=(Array.isArray(path)?path:[]).map(x=>adminGetCategoryDef(x)?.id).filter(Boolean);
      const cat=adminGetCategoryDef(ids[0]) || adminGetCategoryDef("other") || (OM_ADMIN_CATEGORY_CATALOG[0]||null);
      let sub=adminGetCategoryDef(ids[1]);
      if(!sub || sub.parentId !== cat?.id){
        sub = (cat?.children||[])[0] ? adminGetCategoryDef((cat.children||[])[0].id) : null;
      }
      return {
        categoryId: cat?.id || "",
        categoryName: cat?.name || "",
        subcategoryId: sub?.id || "",
        subcategoryName: sub?.name || "",
        categoryPathIds: [cat?.id, sub?.id].filter(Boolean),
        categoryPath: [cat?.name, sub?.name].filter(Boolean),
        categorySearchText: [cat?.name,sub?.name,cat?.id,sub?.id,cat?.ru,sub?.ru].filter(Boolean).join(" ").toLowerCase()
      };
    }
    function selectedCategoryPayload(){
      const catId=$("productCategory")?.value || "";
      const subId=$("productSubcategory")?.value || "";
      if(catId || subId) return adminCategoryPayloadFromPath([catId,subId].filter(Boolean));
      const draft={name:$("name")?.value,description:$("description")?.value,tags:($("tagsInput")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),productType:$("productType")?.value};
      return adminCategoryPayloadFromPath(adminInferCategoryPath(draft));
    }
    function populateCategoryFilters(force=false){
      const filter=$("productCategoryFilter");
      if(filter && (force || filter.dataset.ready!=="1")){
        const cur=filter.value || "all";
        filter.innerHTML='<option value="all">Barcha kategoriyalar</option>'+OM_ADMIN_CATEGORY_CATALOG.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option><optgroup label="${esc(c.name)}">${(c.children||[]).map(ch=>`<option value="${esc(ch.id)}">— ${esc(ch.name)}</option>`).join("")}</optgroup>`).join("");
        if([...filter.options].some(o=>o.value===cur)) filter.value=cur;
        filter.dataset.ready="1";
      }
      const main=$("productCategory");
      if(main && (force || main.dataset.ready!=="1")){
        const cur=main.value || "";
        main.innerHTML='<option value="">Kategoriya tanlang</option>'+OM_ADMIN_CATEGORY_CATALOG.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
        if([...main.options].some(o=>o.value===cur)) main.value=cur;
        main.dataset.ready="1";
      }
    }
    function syncSubcategorySelect(selected=""){
      const main=$("productCategory"), sub=$("productSubcategory"), preview=$("categoryPathPreview");
      if(!main||!sub) return;
      const def=adminGetCategoryDef(main.value);
      const children=def?.children||[];
      const cur=selected || sub.value || "";
      sub.innerHTML='<option value="">Ichki kategoriya tanlang</option>'+children.map(ch=>`<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join("");
      if(cur && children.some(ch=>ch.id===cur)) sub.value=cur;
      else if(children.length && !sub.value) sub.value=children[0].id;
      if(preview){
        const payload=selectedCategoryPayload();
        preview.innerHTML=`<i class="fas fa-sitemap"></i> ${esc(payload.categoryPath.join(" / ") || "Kategoriya tanlanmagan")}`;
      }
    }
    function setCategoryFormValue(path){
      populateCategoryFilters(true);
      const ids=(Array.isArray(path)?path:[]);
      const main=$("productCategory"), sub=$("productSubcategory");
      if(main){main.value=ids[0]||"";}
      syncSubcategorySelect(ids[1]||"");
      if(sub && ids[1]) sub.value=ids[1];
    }
    function categoryCounts(){
      const counts=new Map();
      for(const p of state.products||[]){ const path=adminProductCategoryPathIds(p); path.forEach(id=>counts.set(id,(counts.get(id)||0)+1)); }
      return counts;
    }
    function adminCountForCategory(id){
      const counts=categoryCounts();
      let total=counts.get(id)||0;
      const def=adminGetCategoryDef(id);
      for(const ch of (def?.children||[])) total += 0; // parent count already includes products in children via path
      return total;
    }
    function renderCategoryParentSelect(selectedParent=""){
      const sel=$("categoryParentSelect"); if(!sel) return;
      sel.innerHTML='<option value="">Asosiy kategoriya sifatida</option>'+OM_ADMIN_CATEGORY_CATALOG.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
      if(selectedParent && [...sel.options].some(o=>o.value===selectedParent)) sel.value=selectedParent;
    }
    function renderIconPicker(selected="fa-layer-group"){
      const wrap=$("categoryIconPicker"); if(!wrap) return;
      const val=String(selected||"fa-layer-group").replace(/^fa-solid\s+/,"");
      wrap.innerHTML=OM_ADMIN_CATEGORY_ICONS.map(ic=>`<button type="button" class="cat-icon-choice ${ic===val?'active':''}" data-icon="${esc(ic)}"><i class="fas ${esc(ic)}"></i></button>`).join("");
      wrap.querySelectorAll("[data-icon]").forEach(btn=>btn.addEventListener("click",()=>{
        const icon=btn.dataset.icon; $("categoryIcon").value=icon; renderIconPicker(icon);
      }));
    }
    function openCategoryEditor(id="", parentId=""){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin kategoriyani tahrirlay oladi","error");
      const cat=id ? adminGetCategoryDef(id) : null;
      editingCategoryId = cat?.id || "";
      $("categoryEditorTitle").innerHTML = cat ? '<i class="fas fa-pen"></i> Kategoriyani tahrirlash' : '<i class="fas fa-plus"></i> Yangi kategoriya';
      $("categoryOriginalId").value = cat?.id || "";
      $("categoryName").value = cat?.name || "";
      $("categoryRu").value = cat?.ru || "";
      $("categoryIcon").value = cat?.icon || "fa-layer-group";
      $("categoryKeywords").value = Array.isArray(cat?.keywords) ? cat.keywords.join(", ") : "";
      const p = parentId || cat?.parentId || "";
      renderCategoryParentSelect(p);
      if(cat && !cat.parentId) $("categoryParentSelect").value="";
      renderIconPicker(cat?.icon || "fa-layer-group");
      openModal("categoryEditorModal");
      setTimeout(()=>$("categoryName")?.focus(), 100);
    }
    function closeCategoryEditor(){ closeModal("categoryEditorModal"); editingCategoryId=null; }
    async function saveCategoryEditor(){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin kategoriyani saqlay oladi","error");
      const originalId=$("categoryOriginalId")?.value||"";
      const name=String($("categoryName")?.value||"").trim();
      if(!name) return toast("Kategoriya nomini kiriting","error");
      const ru=String($("categoryRu")?.value||"").trim();
      const icon=String($("categoryIcon")?.value||"fa-layer-group").replace(/^fa-solid\s+/,"").trim() || "fa-layer-group";
      const keywords=String($("categoryKeywords")?.value||"").split(",").map(x=>x.trim()).filter(Boolean);
      const parentId=$("categoryParentSelect")?.value || "";
      let item;
      if(originalId){
        item=adminFindCategoryRaw(originalId);
        if(!item) return toast("Kategoriya topilmadi","error");
        item.name=name; item.ru=ru; item.icon=icon; item.keywords=keywords; item.children=Array.isArray(item.children)?item.children:[];
        const currentParent=adminFindCategoryParent(originalId)?.id || "";
        if(parentId!==currentParent){
          if(parentId===originalId) return toast("Kategoriya o‘z ichiga ko‘chirilmaydi","error");
          const moving=adminRemoveCategoryRaw(originalId);
          if(!moving) return toast("Ko‘chirishda xatolik","error");
          if(parentId){
            const parent=adminFindCategoryRaw(parentId);
            if(!parent) return toast("Ota kategoriya topilmadi","error");
            parent.children=Array.isArray(parent.children)?parent.children:[];
            parent.children.push(moving);
          }else{
            OM_ADMIN_CATEGORY_CATALOG.push(moving);
          }
        }
      }else{
        const id=adminUniqId(name);
        item={id,name,ru,icon,keywords,children:[]};
        if(parentId){
          const parent=adminFindCategoryRaw(parentId);
          if(!parent) return toast("Ota kategoriya topilmadi","error");
          parent.children=Array.isArray(parent.children)?parent.children:[];
          parent.children.push(item);
        }else{
          OM_ADMIN_CATEGORY_CATALOG.push(item);
        }
      }
      adminSetCategoryCatalog(OM_ADMIN_CATEGORY_CATALOG);
      await saveCategorySettingsAdmin();
      closeCategoryEditor();
    }
    async function deleteCategory(id){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin o‘chira oladi","error");
      const cat=adminGetCategoryDef(id);
      if(!cat) return toast("Kategoriya topilmadi","error");
      if(id==="other" || id==="other-products") return toast("Boshqa mahsulotlar kategoriyasi tizim uchun kerak","error");
      const count=adminCountForCategory(id);
      const msg=count>0
        ? `"${cat.name}" ichida ${count} ta mahsulot bor. O‘chirsangiz ular avtomatik "Boshqa mahsulotlar"ga tushadi. Davom etasizmi?`
        : `"${cat.name}" kategoriyasini o‘chirasizmi?`;
      if(!confirm(msg)) return;
      adminRemoveCategoryRaw(id);
      adminSetCategoryCatalog(OM_ADMIN_CATEGORY_CATALOG);
      await saveCategorySettingsAdmin();
      toast("Kategoriya o‘chirildi");
    }
    function exportCategories(){
      const blob=new Blob([JSON.stringify(OM_ADMIN_CATEGORY_CATALOG,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download="orzumall-categories.json"; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    }
    async function resetCategoriesToDefault(){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin reset qila oladi","error");
      if(!confirm("Kategoriyalar standart holatga qaytarilsinmi?")) return;
      adminSetCategoryCatalog(OM_ADMIN_CATEGORY_CATALOG_DEFAULT);
      await saveCategorySettingsAdmin();
      toast("Standart kategoriyalar tiklandi");
    }
    function renderCategoryAdmin(){
      populateCategoryFilters(true);
      const grid=$("categoryAdminGrid"); if(!grid) return;
      const counts=categoryCounts();
      const total=(state.products||[]).length;
      const assigned=(state.products||[]).filter(p=>adminExplicitCategoryPath(p).length>0).length;
      const childCount=OM_ADMIN_CATEGORY_CATALOG.reduce((s,c)=>s+(c.children||[]).length,0);
      if($("categoryTotalCount")) $("categoryTotalCount").textContent=String(OM_ADMIN_CATEGORY_CATALOG.length);
      if($("categoryAssignedCount")) $("categoryAssignedCount").textContent=String(assigned);
      if($("categoryAutoCount")) $("categoryAutoCount").textContent=String(Math.max(0,total-assigned));
      if($("categoryChildCount")) $("categoryChildCount").textContent=String(childCount);
      if($("categoryConfigStatus")) $("categoryConfigStatus").innerHTML='Manba: <code>configs/categories</code> · '+OM_ADMIN_CATEGORY_CATALOG.length+' asosiy kategoriya';
      grid.innerHTML=OM_ADMIN_CATEGORY_CATALOG.map(parent=>{
        const pc=counts.get(parent.id)||0;
        const children=(parent.children||[]).map(ch=>`<div class="cat-admin-chip-row">
          <button type="button" class="cat-admin-chip" data-cat-filter="${esc(ch.id)}"><i class="fas ${esc(ch.icon||'fa-layer-group')}"></i><span>${esc(ch.name)}</span><b>${counts.get(ch.id)||0}</b></button>
          <button type="button" class="cat-mini-btn" data-cat-edit="${esc(ch.id)}" title="Tahrirlash"><i class="fas fa-pen"></i></button>
          <button type="button" class="cat-mini-btn danger" data-cat-delete="${esc(ch.id)}" title="O‘chirish"><i class="fas fa-trash"></i></button>
        </div>`).join("");
        return `<article class="cat-admin-card" data-cat-filter="${esc(parent.id)}">
          <div class="cat-admin-actions">
            <button type="button" class="cat-mini-btn" data-cat-edit="${esc(parent.id)}" title="Tahrirlash"><i class="fas fa-pen"></i></button>
            <button type="button" class="cat-mini-btn" data-cat-add-child="${esc(parent.id)}" title="Ichki kategoriya qo‘shish"><i class="fas fa-plus"></i></button>
            <button type="button" class="cat-mini-btn danger" data-cat-delete="${esc(parent.id)}" title="O‘chirish"><i class="fas fa-trash"></i></button>
          </div>
          <div class="cat-admin-top"><div class="cat-admin-icon"><i class="fas ${esc(parent.icon||'fa-folder')}"></i></div><div><h3>${esc(parent.name)}</h3><p>${pc} ta mahsulot · ${(parent.children||[]).length} ichki kategoriya</p></div></div>
          <div class="cat-admin-subgrid">${children || '<div class="cat-empty-mini">Ichki kategoriya yo‘q</div>'}</div>
        </article>`;
      }).join("");
      grid.querySelectorAll("[data-cat-filter]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); const id=el.getAttribute("data-cat-filter"); setView("products"); if($("productCategoryFilter")) $("productCategoryFilter").value=id; renderTable();}));
      grid.querySelectorAll("[data-cat-edit]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); openCategoryEditor(el.dataset.catEdit);}));
      grid.querySelectorAll("[data-cat-add-child]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); openCategoryEditor("", el.dataset.catAddChild);}));
      grid.querySelectorAll("[data-cat-delete]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); deleteCategory(el.dataset.catDelete);}));
    }




    /* ===== v14 deep editable categories + PNG/SVG icons ===== */
    const OM_ADMIN_CATEGORY_MAX_DEPTH = 4;
    const OM_ADMIN_CATEGORY_STORAGE_KEY_V14 = "orzumall_admin_categories_v14";

    function adminCatCleanIconImage(v){
      const s=String(v||"").trim();
      if(!s) return "";
      if(/^data:image\/(png|svg\+xml|webp);base64,/i.test(s) || /^data:image\/svg\+xml[,;]/i.test(s)) return s;
      if(/^https?:\/\//i.test(s) || s.startsWith("/") || s.startsWith("./")) return s;
      return s;
    }
    function adminCatIconHtml(def, cls=""){
      const img=adminCatCleanIconImage(def?.iconImage || def?.iconUrl || def?.image || def?.svg || "");
      if(img) return `<img class="${esc(cls)}" src="${esc(img)}" alt="" loading="lazy">`;
      return `<i class="fas ${esc(def?.icon||'fa-layer-group')}"></i>`;
    }
    function adminCategoryDepth(id){ const d=adminGetCategoryDef(id); return d?.pathIds?.length || 0; }
    function adminCategoryDescendantIds(id){
      const out=[]; const raw=adminFindCategoryRaw(id);
      const walk=(arr)=>{(arr||[]).forEach(c=>{out.push(c.id); walk(c.children||[]);});};
      walk(raw?.children||[]); return out;
    }
    function adminCategoryAllOptions({excludeId="", maxDepth=OM_ADMIN_CATEGORY_MAX_DEPTH-1}={}){
      const exclude=new Set([excludeId, ...adminCategoryDescendantIds(excludeId)]);
      const rows=[];
      const walk=(arr,level=1,path=[])=>{(arr||[]).forEach(c=>{
        if(!exclude.has(c.id) && level<=maxDepth) rows.push({id:c.id,name:c.name,level,path:[...path,c.name]});
        walk(c.children||[], level+1, [...path,c.name]);
      });};
      walk(OM_ADMIN_CATEGORY_CATALOG,1,[]);
      return rows;
    }
    function adminVisibleCategoryCount(tree=OM_ADMIN_CATEGORY_CATALOG){
      let n=0; (tree||[]).forEach(c=>{n++; n+=adminVisibleCategoryCount(c.children||[]);}); return n;
    }
    function adminLeafOrChildCount(tree=OM_ADMIN_CATEGORY_CATALOG){
      let n=0; (tree||[]).forEach(c=>{n+=(c.children||[]).length; n+=adminLeafOrChildCount(c.children||[]);}); return n;
    }
    adminSanitizeCategoryTree = function(tree){
      const globalUsed=new Set();
      const clean=(arr,parentId=null,level=1)=>{
        if(!Array.isArray(arr) || level>OM_ADMIN_CATEGORY_MAX_DEPTH) return [];
        return arr.map((raw,idx)=>{
          const name=String(raw?.name||raw?.ru||`Kategoriya ${idx+1}`).trim();
          let base=adminCatSlug(raw?.id||name)||`category-${idx+1}`, id=base, n=2;
          while(globalUsed.has(id)) id=`${base}-${n++}`;
          globalUsed.add(id);
          const item={
            id,
            name,
            ru:String(raw?.ru||"").trim(),
            icon:String(raw?.icon||"fa-layer-group").replace(/^fa-solid\s+/,"").trim() || "fa-layer-group",
            iconImage:adminCatCleanIconImage(raw?.iconImage || raw?.iconUrl || raw?.image || raw?.svg || ""),
            keywords:Array.isArray(raw?.keywords) ? raw.keywords.map(x=>String(x).trim()).filter(Boolean) : String(raw?.keywords||"").split(",").map(x=>x.trim()).filter(Boolean),
            children: clean(raw?.children||[], id, level+1)
          };
          return item;
        }).filter(x=>x.name);
      };
      const out=clean(tree,null,1);
      return out.length ? out : adminCloneCategories(OM_ADMIN_CATEGORY_CATALOG_DEFAULT);
    }
    adminSetCategoryCatalog = function(tree, opts={}){
      OM_ADMIN_CATEGORY_CATALOG = adminSanitizeCategoryTree(tree);
      adminInvalidateCategoryCache();
      try{ localStorage.setItem(OM_ADMIN_CATEGORY_STORAGE_KEY, JSON.stringify(OM_ADMIN_CATEGORY_CATALOG)); }catch(e){}
      try{ localStorage.setItem(OM_ADMIN_CATEGORY_STORAGE_KEY_V14, JSON.stringify(OM_ADMIN_CATEGORY_CATALOG)); }catch(e){}
      if(!opts.silent){
        populateCategoryFilters(true);
        try{ syncSubcategorySelect(); }catch(e){}
        try{ renderCategoryAdmin(); }catch(e){}
        try{ renderTable(); }catch(e){}
        try{ renderStatsPanels(); }catch(e){}
      }
    }
    loadCategorySettingsAdmin = async function(force=false){
      if(categorySettingsLoaded && !force) return OM_ADMIN_CATEGORY_CATALOG;
      categorySettingsLoaded = true;
      let loaded = null;
      try{
        const snap = await getDoc(doc(db, OM_ADMIN_CATEGORY_CONFIG_DOC[0], OM_ADMIN_CATEGORY_CONFIG_DOC[1]));
        if(snap.exists()){
          const d=snap.data()||{};
          loaded = Array.isArray(d.tree) ? d.tree : (Array.isArray(d.categories) ? d.categories : null);
        }
      }catch(e){ console.warn("categories config read failed", e); }
      if(!loaded){ try{ loaded = JSON.parse(localStorage.getItem(OM_ADMIN_CATEGORY_STORAGE_KEY_V14)||"null"); }catch(e){} }
      if(!loaded){ try{ loaded = JSON.parse(localStorage.getItem(OM_ADMIN_CATEGORY_STORAGE_KEY)||"null"); }catch(e){} }
      adminSetCategoryCatalog(loaded || OM_ADMIN_CATEGORY_CATALOG_DEFAULT, {silent:true});
      return OM_ADMIN_CATEGORY_CATALOG;
    }
    saveCategorySettingsAdmin = async function(){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin kategoriyalarni saqlay oladi","error");
      try{
        const payload = { tree: adminCloneCategories(OM_ADMIN_CATEGORY_CATALOG), updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || auth.currentUser?.uid || "", version: 14, maxDepth: OM_ADMIN_CATEGORY_MAX_DEPTH };
        await setDoc(doc(db, OM_ADMIN_CATEGORY_CONFIG_DOC[0], OM_ADMIN_CATEGORY_CONFIG_DOC[1]), payload, {merge:true});
        try{ localStorage.setItem(OM_ADMIN_CATEGORY_STORAGE_KEY_V14, JSON.stringify(OM_ADMIN_CATEGORY_CATALOG)); }catch(e){}
        try{ localStorage.setItem(OM_ADMIN_CATEGORY_STORAGE_KEY, JSON.stringify(OM_ADMIN_CATEGORY_CATALOG)); }catch(e){}
        toast("Kategoriyalar saqlandi");
      }catch(e){ console.error(e); toast("Kategoriyalarni saqlashda xatolik: "+(e.message||e), "error"); }
    }
    adminInferCategoryPath = function(p){
      const explicit=adminExplicitCategoryPath(p); if(explicit.length) return explicit;
      const hay=[p?.name,p?.name_ru,p?.name_en,p?.description,p?.description_ru,p?.productType,p?.fulfillmentType,...(Array.isArray(p?.tags)?p.tags:[])].filter(Boolean).join(" ").toLowerCase();
      let best=null;
      const score=(def)=>{let s=0; for(const kw of (def.keywords||[])){const k=String(kw).toLowerCase(); if(k&&hay.includes(k)) s+=k.length>6?3:2;} return s;};
      const walk=(arr,path=[],carry=0)=>{(arr||[]).forEach(def=>{ const next=[...path,def.id]; const sc=carry+score(def); if(sc && (!best || sc>best.score || (sc===best.score && next.length>best.path.length))) best={score:sc,path:next}; walk(def.children||[], next, sc); });};
      walk(OM_ADMIN_CATEGORY_CATALOG,[],0);
      return best?.path || [adminGetCategoryDef("other")?.id, adminGetCategoryDef("other-products")?.id].filter(Boolean);
    }
    adminCategoryPayloadFromPath = function(path){
      let ids=(Array.isArray(path)?path:[]).map(x=>adminGetCategoryDef(x)?.id).filter(Boolean);
      if(!ids.length){ ids=adminInferCategoryPath({}); }
      const defs=ids.map(id=>adminGetCategoryDef(id)).filter(Boolean);
      const root=defs[0] || adminGetCategoryDef("other") || (OM_ADMIN_CATEGORY_CATALOG[0]||null);
      const leaf=defs[defs.length-1] || root;
      return {
        categoryId: root?.id || "",
        categoryName: root?.name || "",
        subcategoryId: defs[1]?.id || leaf?.id || "",
        subcategoryName: defs[1]?.name || leaf?.name || "",
        leafCategoryId: leaf?.id || "",
        leafCategoryName: leaf?.name || "",
        categoryPathIds: defs.map(d=>d.id),
        categoryPath: defs.map(d=>d.name),
        categoryDepth: defs.length,
        categorySearchText: defs.flatMap(d=>[d.name,d.ru,d.id]).filter(Boolean).join(" ").toLowerCase()
      };
    }
    function selectedProductCategoryPath(){
      const ids=[];
      const first=$("productCategory")?.value || ""; if(first) ids.push(first);
      const second=$("productSubcategory")?.value || ""; if(second) ids.push(second);
      document.querySelectorAll("#productCategoryDeepLevels select[data-cat-level]").forEach(sel=>{ if(sel.value) ids.push(sel.value); });
      return ids;
    }
    selectedCategoryPayload = function(){
      const ids=selectedProductCategoryPath();
      if(ids.length) return adminCategoryPayloadFromPath(ids);
      const draft={name:$("name")?.value,description:$("description")?.value,tags:($("tagsInput")?.value||"").split(",").map(s=>s.trim()).filter(Boolean),productType:$("productType")?.value};
      return adminCategoryPayloadFromPath(adminInferCategoryPath(draft));
    }
    function categoryOptionHtmlForTree(arr, level=0){
      let html="";
      (arr||[]).forEach(c=>{ html += `<option value="${esc(c.id)}">${"— ".repeat(level)}${esc(c.name)}</option>`; html += categoryOptionHtmlForTree(c.children||[], level+1); });
      return html;
    }
    populateCategoryFilters = function(force=false){
      const filter=$("productCategoryFilter");
      if(filter && (force || filter.dataset.ready!=="1")){
        const cur=filter.value || "all";
        filter.innerHTML='<option value="all">Barcha kategoriyalar</option>'+categoryOptionHtmlForTree(OM_ADMIN_CATEGORY_CATALOG,0);
        if([...filter.options].some(o=>o.value===cur)) filter.value=cur;
        filter.dataset.ready="1";
      }
      const main=$("productCategory");
      if(main && (force || main.dataset.ready!=="1")){
        const cur=main.value || "";
        main.innerHTML='<option value="">Kategoriya tanlang</option>'+OM_ADMIN_CATEGORY_CATALOG.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
        if([...main.options].some(o=>o.value===cur)) main.value=cur;
        main.dataset.ready="1";
      }
    }
    function renderCategoryLevelSelect(level, parentId, selected=""){
      const parent=adminGetCategoryDef(parentId);
      const children=(parent?.children||[]);
      if(!children.length || level>OM_ADMIN_CATEGORY_MAX_DEPTH) return "";
      return `<div class="form-group category-level-group" data-level-wrap="${level}"><label>${level}-daraja kategoriya</label><select class="form-control" data-cat-level="${level}"><option value="">Tanlanmagan</option>${children.map(ch=>`<option value="${esc(ch.id)}" ${ch.id===selected?'selected':''}>${esc(ch.name)}</option>`).join("")}</select><small class="hint">${esc(parent?.name||"")} ichidan tanlang.</small></div>`;
    }
    syncSubcategorySelect = function(selected=""){
      const main=$("productCategory"), sub=$("productSubcategory"), deep=$("productCategoryDeepLevels"), preview=$("categoryPathPreview");
      if(!main || !sub) return;
      const root=adminGetCategoryDef(main.value);
      const oldPath=selectedProductCategoryPath();
      const secondSelected=selected || sub.value || oldPath[1] || "";
      const children=(root?.children||[]);
      sub.innerHTML='<option value="">Ichki kategoriya tanlang</option>'+children.map(ch=>`<option value="${esc(ch.id)}">${esc(ch.name)}</option>`).join("");
      if(secondSelected && children.some(ch=>ch.id===secondSelected)) sub.value=secondSelected;
      let path=[]; if(main.value) path.push(main.value); if(sub.value) path.push(sub.value);
      if(deep){
        let html=""; let parentId=sub.value || main.value; let level=3; let guard=0;
        while(parentId && level<=OM_ADMIN_CATEGORY_MAX_DEPTH && guard++<5){
          const desired=oldPath[level-1] || "";
          const parent=adminGetCategoryDef(parentId);
          const kids=(parent?.children||[]);
          if(!kids.length) break;
          const selectedChild = kids.some(k=>k.id===desired) ? desired : "";
          html += renderCategoryLevelSelect(level, parentId, selectedChild);
          if(selectedChild){ path.push(selectedChild); parentId=selectedChild; level++; } else break;
        }
        deep.innerHTML=html;
        deep.querySelectorAll("select[data-cat-level]").forEach(sel=>sel.addEventListener("change",()=>syncSubcategorySelect()));
      }
      document.querySelectorAll("#productCategoryDeepLevels select[data-cat-level]").forEach(sel=>{ if(sel.value && !path.includes(sel.value)) path.push(sel.value); });
      const payload=adminCategoryPayloadFromPath(path);
      if(preview) preview.innerHTML=`<i class="fas fa-sitemap"></i> ${esc((payload.categoryPath||[]).join(" / ") || "Kategoriya tanlanmagan")}`;
    }
    setProductCategorySelects = function(path){
      populateCategoryFilters(true);
      const ids=(Array.isArray(path)?path:[]).map(x=>adminGetCategoryDef(x)?.id).filter(Boolean);
      const main=$("productCategory"), sub=$("productSubcategory");
      if(main) main.value=ids[0]||"";
      syncSubcategorySelect(ids[1]||"");
      if(sub) sub.value=ids[1]||"";
      syncSubcategorySelect();
      document.querySelectorAll("#productCategoryDeepLevels select[data-cat-level]").forEach(sel=>{
        const level=Number(sel.dataset.catLevel||0);
        if(ids[level-1]) sel.value=ids[level-1];
      });
      syncSubcategorySelect();
    }
    renderCategoryParentSelect = function(selectedParent="", excludeId=""){
      const sel=$("categoryParentSelect"); if(!sel) return;
      const opts=adminCategoryAllOptions({excludeId, maxDepth:OM_ADMIN_CATEGORY_MAX_DEPTH-1});
      sel.innerHTML='<option value="">Asosiy kategoriya sifatida</option>'+opts.map(o=>`<option value="${esc(o.id)}">${"— ".repeat(o.level-1)}${esc(o.name)} · ${o.level}-daraja</option>`).join("");
      if(selectedParent && [...sel.options].some(o=>o.value===selectedParent)) sel.value=selectedParent;
    }
    function updateCategoryIconPreview(){
      const prev=$("categoryIconPreview"); if(!prev) return;
      const img=adminCatCleanIconImage($("categoryIconImage")?.value||"");
      if(img){ prev.classList.add("has-img"); prev.innerHTML=`<img src="${esc(img)}" alt="">`; }
      else{ prev.classList.remove("has-img"); prev.innerHTML=`<i class="fas ${esc(String($("categoryIcon")?.value||"fa-layer-group").replace(/^fa-solid\s+/,""))}"></i>`; }
    }
    function handleCategoryIconFile(file){
      if(!file) return;
      const ok=["image/png","image/svg+xml","image/webp"].includes(file.type) || /\.(png|svg|webp)$/i.test(file.name||"");
      if(!ok) return toast("Faqat PNG, SVG yoki WEBP icon yuklang", "error");
      if(file.size > 180*1024) toast("Icon hajmi katta. Firestore uchun kichik SVG/PNG tavsiya qilinadi.", "error");
      const reader=new FileReader();
      reader.onload=()=>{ $("categoryIconImage").value=String(reader.result||""); updateCategoryIconPreview(); };
      reader.readAsDataURL(file);
    }
    renderIconPicker = function(selected="fa-layer-group"){
      const wrap=$("categoryIconPicker"); if(!wrap) return;
      const val=String(selected||"fa-layer-group").replace(/^fa-solid\s+/,"");
      wrap.innerHTML=OM_ADMIN_CATEGORY_ICONS.map(ic=>`<button type="button" class="cat-icon-choice ${ic===val?'active':''}" data-icon="${esc(ic)}"><i class="fas ${esc(ic)}"></i></button>`).join("");
      wrap.querySelectorAll("[data-icon]").forEach(btn=>btn.addEventListener("click",()=>{ const icon=btn.dataset.icon; $("categoryIcon").value=icon; renderIconPicker(icon); updateCategoryIconPreview(); }));
    }
    openCategoryEditor = function(id="", parentId=""){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin kategoriyani tahrirlay oladi","error");
      const cat=id ? adminGetCategoryDef(id) : null;
      editingCategoryId = cat?.id || "";
      $("categoryEditorTitle").innerHTML = cat ? '<i class="fas fa-pen"></i> Kategoriyani tahrirlash' : '<i class="fas fa-plus"></i> Yangi kategoriya';
      $("categoryOriginalId").value = cat?.id || "";
      $("categoryName").value = cat?.name || "";
      $("categoryRu").value = cat?.ru || "";
      $("categoryIcon").value = cat?.icon || "fa-layer-group";
      if($("categoryIconImage")) $("categoryIconImage").value = adminCatCleanIconImage(cat?.iconImage || "");
      $("categoryKeywords").value = Array.isArray(cat?.keywords) ? cat.keywords.join(", ") : "";
      const p = parentId || cat?.parentId || "";
      renderCategoryParentSelect(p, cat?.id || "");
      if(cat && !cat.parentId) $("categoryParentSelect").value="";
      renderIconPicker(cat?.icon || "fa-layer-group");
      updateCategoryIconPreview();
      openModal("categoryEditorModal");
      setTimeout(()=>$("categoryName")?.focus(), 100);
    }
    saveCategoryEditor = async function(){
      if(!isAdmin(auth.currentUser)) return toast("Faqat admin kategoriyani saqlay oladi","error");
      const originalId=$("categoryOriginalId")?.value||"";
      const name=String($("categoryName")?.value||"").trim();
      if(!name) return toast("Kategoriya nomini kiriting","error");
      const ru=String($("categoryRu")?.value||"").trim();
      const icon=String($("categoryIcon")?.value||"fa-layer-group").replace(/^fa-solid\s+/,"").trim() || "fa-layer-group";
      const iconImage=adminCatCleanIconImage($("categoryIconImage")?.value||"");
      const keywords=String($("categoryKeywords")?.value||"").split(",").map(x=>x.trim()).filter(Boolean);
      const parentId=$("categoryParentSelect")?.value || "";
      const parentDepth=parentId ? adminCategoryDepth(parentId) : 0;
      if(parentDepth >= OM_ADMIN_CATEGORY_MAX_DEPTH) return toast("4-darajadan chuqur kategoriya qo‘shib bo‘lmaydi", "error");
      let item;
      if(originalId){
        item=adminFindCategoryRaw(originalId);
        if(!item) return toast("Kategoriya topilmadi","error");
        if(parentId===originalId || adminCategoryDescendantIds(originalId).includes(parentId)) return toast("Kategoriya o‘z ichiga yoki bolasiga ko‘chirilmaydi","error");
        item.name=name; item.ru=ru; item.icon=icon; item.iconImage=iconImage; item.keywords=keywords; item.children=Array.isArray(item.children)?item.children:[];
        const currentParent=adminFindCategoryParent(originalId)?.id || "";
        if(parentId!==currentParent){
          const moving=adminRemoveCategoryRaw(originalId);
          if(!moving) return toast("Ko‘chirishda xatolik","error");
          if(parentId){
            const parent=adminFindCategoryRaw(parentId); if(!parent) return toast("Ota kategoriya topilmadi","error");
            parent.children=Array.isArray(parent.children)?parent.children:[]; parent.children.push(moving);
          }else OM_ADMIN_CATEGORY_CATALOG.push(moving);
        }
      }else{
        const id=adminUniqId(name);
        item={id,name,ru,icon,iconImage,keywords,children:[]};
        if(parentId){
          const parent=adminFindCategoryRaw(parentId); if(!parent) return toast("Ota kategoriya topilmadi","error");
          parent.children=Array.isArray(parent.children)?parent.children:[]; parent.children.push(item);
        }else OM_ADMIN_CATEGORY_CATALOG.push(item);
      }
      adminSetCategoryCatalog(OM_ADMIN_CATEGORY_CATALOG);
      await saveCategorySettingsAdmin();
      closeCategoryEditor();
    }
    renderCategoryAdmin = function(){
      populateCategoryFilters(true);
      const grid=$("categoryAdminGrid"); if(!grid) return;
      const counts=categoryCounts();
      const total=(state.products||[]).length;
      const assigned=(state.products||[]).filter(p=>adminExplicitCategoryPath(p).length>0).length;
      const childCount=adminLeafOrChildCount(OM_ADMIN_CATEGORY_CATALOG);
      if($("categoryTotalCount")) $("categoryTotalCount").textContent=String(OM_ADMIN_CATEGORY_CATALOG.length);
      if($("categoryAssignedCount")) $("categoryAssignedCount").textContent=String(assigned);
      if($("categoryAutoCount")) $("categoryAutoCount").textContent=String(Math.max(0,total-assigned));
      if($("categoryChildCount")) $("categoryChildCount").textContent=String(childCount);
      if($("categoryConfigStatus")) $("categoryConfigStatus").innerHTML='Manba: <code>configs/categories</code> · '+adminVisibleCategoryCount(OM_ADMIN_CATEGORY_CATALOG)+' kategoriya · 4 darajagacha';
      const renderNode=(cat,level=1)=>{
        const cnt=counts.get(cat.id)||0;
        const canAdd=level<OM_ADMIN_CATEGORY_MAX_DEPTH;
        const children=(cat.children||[]).map(ch=>renderNode(ch,level+1)).join("");
        return `<div class="cat-tree-node level-${Math.min(level,4)}" data-cat-filter="${esc(cat.id)}">
          <div class="cat-tree-row">
            <div class="cat-tree-main"><div class="cat-admin-icon">${adminCatIconHtml(cat)}</div><div class="cat-tree-title"><h4>${esc(cat.name)}</h4><p><span class="cat-level-badge">${level}-daraja</span> · ${cnt} ta mahsulot · ${(cat.children||[]).length} ichki kategoriya</p></div></div>
            <div class="cat-tree-actions">
              <button type="button" class="cat-mini-btn" data-cat-edit="${esc(cat.id)}" title="Tahrirlash"><i class="fas fa-pen"></i></button>
              ${canAdd?`<button type="button" class="cat-mini-btn" data-cat-add-child="${esc(cat.id)}" title="Ichki kategoriya qo‘shish"><i class="fas fa-plus"></i></button>`:""}
              <button type="button" class="cat-mini-btn danger" data-cat-delete="${esc(cat.id)}" title="O‘chirish"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          ${children?`<div class="cat-tree-children">${children}</div>`:""}
        </div>`;
      };
      grid.innerHTML=`<div class="cat-tree-list">${OM_ADMIN_CATEGORY_CATALOG.map(c=>renderNode(c,1)).join("")}</div>`;
      grid.querySelectorAll("[data-cat-filter]").forEach(el=>el.addEventListener("click",(e)=>{ if(e.target.closest("button")) return; e.stopPropagation(); const id=el.getAttribute("data-cat-filter"); setView("products"); if($("productCategoryFilter")) $("productCategoryFilter").value=id; renderTable(); }));
      grid.querySelectorAll("[data-cat-edit]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); openCategoryEditor(el.dataset.catEdit);}));
      grid.querySelectorAll("[data-cat-add-child]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); openCategoryEditor("", el.dataset.catAddChild);}));
      grid.querySelectorAll("[data-cat-delete]").forEach(el=>el.addEventListener("click",(e)=>{e.stopPropagation(); deleteCategory(el.dataset.catDelete);}));
    }

        function productStatusPill(p){
      const s = String(p?.status||"approved").toLowerCase();
      if(s==="pending" || s==="kutilmoqda") return `<span class="pill pending"><i class="fas fa-clock"></i> Kutilmoqda</span>`;
      if(s==="rejected" || s==="rad" || s==="cancelled" || s==="canceled") return `<span class="pill cancelled"><i class="fas fa-ban"></i> Rad etilgan</span>`;
      return `<span class="pill paid"><i class="fas fa-circle-check"></i> Tasdiqlandi</span>`;
    }

    function getProductStatusKey(p){
      const s = String(p?.status||"approved").toLowerCase();
      if(s==="pending" || s==="kutilmoqda") return "pending";
      if(s==="rejected" || s==="rad" || s==="cancelled" || s==="canceled") return "rejected";
      return "approved";
    }

    function getProductFulfillmentKey(p){
      const t = String(p?.pType || p?.fulfillment || p?.fulfillmentType || "stock").toLowerCase();
      if(t.includes("cargo") || t.includes("order") || t.includes("buyurt")) return "cargo";
      return "stock";
    }

    function productMatchesQuery(p, q){
      if(!q) return true;
      const hay = [
        p?.id, p?.name, p?.subtitle, p?.description, p?.currency, p?.ownerEmail,
        p?.productType, p?.pType, p?.fulfillment, adminProductCategoryLabel(p), p?.categorySearchText, p?.categoryName, p?.subcategoryName,
        ...(Array.isArray(p?.tags)?p.tags:[]),
        ...(Array.isArray(p?.sizes)?p.sizes:[])
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    }

    function getProductFilteredSortedList(base=null){
      const q = (($("productSectionSearch")?.value || $("searchInput")?.value || "").toLowerCase().trim());
      const status = $("productStatusFilter")?.value || "all";
      const fulfillment = $("productFulfillmentFilter")?.value || "all";
      const category = $("productCategoryFilter")?.value || "all";
      const sort = $("productSort")?.value || "default";
      let data = [...(base || state.products)];
      data = data.filter(p=>{
        if(!productMatchesQuery(p,q)) return false;
        if(status!=="all" && getProductStatusKey(p)!==status) return false;
        if(fulfillment!=="all" && getProductFulfillmentKey(p)!==fulfillment) return false;
        if(category!=="all" && !adminProductInCategory(p, category)) return false;
        return true;
      });
      const byNumber = (k)=>(a,b)=>Number(b?.[k]||0)-Number(a?.[k]||0);
      if(sort==="price-desc") data.sort(byNumber("price"));
      else if(sort==="price-asc") data.sort((a,b)=>Number(a?.price||0)-Number(b?.price||0));
      else if(sort==="score-desc") data.sort(byNumber("popularScore"));
      else if(sort==="sold-desc") data.sort(byNumber("soldCount"));
      else if(sort==="name-asc") data.sort((a,b)=>String(a?.name||a?.id||"").localeCompare(String(b?.name||b?.id||""),"uz"));
      return data;
    }

    function updateProductPremiumCounters(data){
      const all = state.products || [];
      const approved = all.filter(p=>getProductStatusKey(p)==="approved").length;
      const pending = all.filter(p=>getProductStatusKey(p)==="pending").length;
      const avgScore = all.length ? Math.round(all.reduce((s,p)=>s+Number(p.popularScore||0),0)/all.length) : 0;
      const catalogValue = all.reduce((s,p)=>s+Number(p.price||0),0);
      if($("productActiveCount")) $("productActiveCount").textContent = data.length;
      if($("productPendingCount")) $("productPendingCount").textContent = pending;
      if($("productApprovedCount")) $("productApprovedCount").textContent = approved;
      if($("productAvgScoreInline")) $("productAvgScoreInline").textContent = avgScore;
      if($("productCatalogValue")) $("productCatalogValue").textContent = formatPrice(catalogValue).replace(" so‘m","");
      const hint = $("productViewHint");
      if(hint){
        const q = ($("productSectionSearch")?.value || $("searchInput")?.value || "").trim();
        hint.textContent = q ? `${data.length} ta natija: “${q}”` : `${data.length} ta mahsulot ko‘rsatilmoqda`;
        const cf = $("productCategoryFilter")?.value || "all";
        if(cf!=="all") hint.textContent += ` · ${adminGetCategoryDef(cf)?.name || cf}`;
      }
    }

    function getProductImageHtml(p, cls="om-thumb"){
      const img = (typeof getItemImageUrl==="function" ? getItemImageUrl(p) : "") || "";
      const letter = esc(String(p?.name||p?.id||"O").trim().slice(0,1).toUpperCase() || "O");
      if(img) return `<img class="${cls}" src="${esc(img)}" alt="${esc(p?.name||"Mahsulot")}" loading="lazy" onerror="this.outerHTML='<div class=&quot;${cls} om-thumb-fallback&quot;>${letter}</div>'">`;
      return `<div class="${cls} om-thumb-fallback">${letter}</div>`;
    }

    function renderProductCards(data){
      const grid = $("productsCardsGrid");
      if(!grid) return;
      if(!data.length){
        grid.innerHTML = `<div class="product-empty-premium" style="grid-column:1/-1"><i class="fas fa-box-open"></i><b>Mahsulot topilmadi</b><br><span>Qidiruv yoki filterlarni tozalab qayta urinib ko‘ring.</span></div>`;
        return;
      }
      grid.innerHTML = data.map(p=>{
        const popular = Math.max(0, Math.min(100, Number(p.popularScore||0)));
        const weight = Number(p.weightKg ?? p.weight ?? 0);
        const weightText = weight ? `${weight.toFixed(2).replace(/\.00$/,'')} kg` : '— kg';
        const colors = (p.colors||[]).slice(0,5).map(c=>{
          const hex = (typeof c==="string") ? c : (c.hex || c.value || c.color || c.code || c.bg || "");
          const bg = /^#|rgb|hsl/i.test(String(hex)) ? hex : "#eef1f7";
          return `<span class="color-preview" style="background:${esc(bg)}"></span>`;
        }).join("");
        return `<article class="product-card-premium" data-pid="${esc(p.id||"")}">
          <div class="product-card-cover">
            ${getProductImageHtml(p, "")}
            <div class="product-card-status">${productStatusPill(p)}</div>
          </div>
          <div class="product-card-body">
            <div class="product-card-title" title="${esc(p.name||"")}">${esc(p.name||"Nomsiz mahsulot")}</div>
            <div class="product-card-meta">
              <div><span>ID</span><b>${esc(p.id||"—")}</b></div>
              <div><span>Narx</span><b>${formatPrice(p.price)}</b></div>
              <div><span>Vazn</span><b>${weightText}</b></div>
              <div><span>Sotilgan</span><b>${Number(p.soldCount||0)} ta</b></div>
            </div>
            <div class="om-subline" style="margin-bottom:12px">${renderFulfillmentPill(p)} ${renderProductTypePill(p)} <span class="category-pill"><i class="fas fa-sitemap"></i> ${esc(adminProductCategoryLabel(p))}</span> ${colors || `<span class="muted">Rang yo‘q</span>`}</div>
            <div class="product-card-bottom">
              <div style="display:flex;align-items:center;gap:9px;min-width:120px"><div class="om-score"><span style="width:${popular}%"></span></div><b>${popular}</b></div>
              <div class="actions">
                ${(state.role==="admin" && String(p.status||"approved").toLowerCase()!=="approved")?`<button class="btn action-btn approve-btn" data-id="${esc(p.id)}" title="Tasdiqlash"><i class="fas fa-check"></i><span>OK</span></button><button class="btn action-btn reject-btn" data-id="${esc(p.id)}" title="Rad etish"><i class="fas fa-xmark"></i><span>Rad</span></button>`:""}
                <button class="btn action-btn edit-btn" data-id="${esc(p.id)}" title="Tahrirlash" aria-label="Tahrirlash"><i class="fas fa-pen-to-square"></i></button>
                ${(state.role==="admin" || state.role==="vendor")?`<button class="btn action-btn del-btn" data-id="${esc(p.id)}" title="O‘chirish" aria-label="O‘chirish"><i class="fas fa-trash-can"></i></button>`:""}
              </div>
            </div>
          </div>
        </article>`;
      }).join("");
    }

    function setProductViewMode(mode){
      state.productViewMode = mode;
      const isCards = mode === "cards";
      $("productsTableShell")?.classList.toggle("hidden", isCards);
      $("productsCardsGrid")?.classList.toggle("hidden", !isCards);
      $("productTableMode")?.classList.toggle("active", !isCards);
      $("productCardMode")?.classList.toggle("active", isCards);
    }

    function bindProductRowActions(){
      document.querySelectorAll(".edit-btn").forEach(b=>b.addEventListener("click",(e)=>{e.stopPropagation(); openEdit(b.dataset.id);}));
      document.querySelectorAll(".del-btn").forEach(b=>b.addEventListener("click",(e)=>{e.stopPropagation(); removeProduct(b.dataset.id);}));
      document.querySelectorAll(".approve-btn").forEach(b=>b.addEventListener("click",(e)=>{e.stopPropagation(); updateProductStatus(b.dataset.id,"approved");}));
      document.querySelectorAll(".reject-btn").forEach(b=>b.addEventListener("click",(e)=>{e.stopPropagation(); updateProductStatus(b.dataset.id,"rejected");}));
    }

    function renderTable(list=null){
      const data = Array.isArray(list) ? getProductFilteredSortedList(list) : getProductFilteredSortedList();
      updateProductPremiumCounters(data);
      renderProductCards(data);
      setProductViewMode(state.productViewMode || "cards");
      const body = $("productsTableBody");
      body.innerHTML="";
      if(!data.length){
        body.innerHTML = `<tr><td colspan="10" class="product-empty-premium"><i class="fas fa-box-open"></i><b>Mahsulot topilmadi</b><br><span>Qidiruv yoki filterlarni tozalab qayta urinib ko‘ring.</span></td></tr>`;
        return;
      }
      data.forEach(p=>{
        const tr = document.createElement("tr");
        tr.className = "om-product-row";
        tr.style.cursor="pointer";
        tr.dataset.pid = p.id || "";

        const old = p.oldPrice>0?`<span class="old-price">${formatPrice(p.oldPrice)}</span>`:"";
        const categoryPill = `<span class="category-pill" title="${esc(adminProductCategoryLabel(p))}"><i class="fas fa-sitemap"></i> ${esc(adminProductCategoryLabel(p))}</span>`;
        const colors = (p.colors||[]).slice(0,4).map(c=>{
          const hex = (typeof c==="string") ? c : (c.hex || c.value || c.color || c.code || c.bg || "");
          const name = (typeof c==="string") ? c : (c.name || c.label || hex || "");
          const bg = /^#|rgb|hsl/i.test(String(hex)) ? hex : "#eef1f7";
          return `<span class="color-preview" style="background:${esc(bg)}" title="${esc(name)}"></span>`;
        }).join("") || `<span style="color:var(--muted)">—</span>`;
        const sizes = (p.sizes||[]).slice(0,3).map(s=>`<span class="tag" style="background:#EEF6FF;color:#2563EB;border-color:#BFDBFE">${esc(s)}</span>`).join(" ") || `<span style="color:var(--muted)">—</span>`;
        const popular = Math.max(0, Math.min(100, Number(p.popularScore||0)));
        const weight = Number(p.weightKg ?? p.weight ?? 0);
        const weightText = weight ? `${weight.toFixed(2).replace(/\.00$/,'')} kg` : '— kg';

        tr.innerHTML = `
          <td>
            <div class="om-product-cell">
              ${getProductImageHtml(p)}
              <div class="om-product-meta">
                <div class="product-name" title="${esc(p.name||"")}">${esc(p.name||"Nomsiz mahsulot")}</div>
                ${p.subtitle?`<div style="font-size:12.5px;color:var(--muted);margin-top:3px">${esc(p.subtitle)}</div>`:""}
                <div class="om-subline">
                  ${productStatusPill(p)}
                  ${renderProductTypePill(p)}
                  <span class="tag" title="Sotilgan"><i class="fas fa-bag-shopping"></i> ${Number(p.soldCount||0)} ta</span>
                  ${(state.role==="admin" && p.ownerEmail)?`<span class="tag" style="background:#F3EFFF;color:var(--primary);border-color:#DDD3FF"><i class="fas fa-user"></i> ${esc(p.ownerEmail)}</span>`:""}
                </div>
              </div>
            </div>
          </td>
          <td><span class="product-id">${esc(p.id)}</span></td>
          <td class="price-cell">${formatPrice(p.price)} ${old}<div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(p.currency||"UZS")}</div></td>
          <td><span class="tag" title="Mahsulot vazni"><i class="fas fa-weight-hanging"></i> ${weightText}</span></td>
          <td>${renderFulfillmentPill(p)}</td>
          <td>${categoryPill}</td>
          <td>${colors}</td>
          <td>${sizes}</td>
          <td>
            <div style="display:flex;align-items:center;gap:9px">
              <div class="om-score"><span style="width:${popular}%"></span></div>
              <b style="min-width:24px">${popular}</b>
            </div>
          </td>
          <td>
            <div class="actions">
              ${(state.role==="admin" && String(p.status||"approved").toLowerCase()!=="approved")?`<button class="btn action-btn approve-btn" data-id="${esc(p.id)}" title="Tasdiqlash"><i class="fas fa-check"></i><span>OK</span></button><button class="btn action-btn reject-btn" data-id="${esc(p.id)}" title="Rad etish"><i class="fas fa-xmark"></i><span>Rad</span></button>`:""}
              <button class="btn action-btn edit-btn" data-id="${esc(p.id)}" title="Tahrirlash" aria-label="Tahrirlash"><i class="fas fa-pen-to-square"></i></button>
              ${(state.role==="admin" || state.role==="vendor")?`<button class="btn action-btn del-btn" data-id="${esc(p.id)}" title="O‘chirish" aria-label="O‘chirish"><i class="fas fa-trash-can"></i></button>`:""}
            </div>
          </td>
        `;
        body.appendChild(tr);
      });
      bindProductRowActions();
    }

    function renderStats(){
      $("totalProducts").textContent = state.products.length;
      const avgPrice = state.products.length ? Math.round(state.products.reduce((s,p)=>s+Number(p.price||0),0)/state.products.length) : 0;
      $("avgPrice").textContent = formatPrice(avgPrice).replace(" so‘m","");
      const avgPopular = state.products.length ? Math.round(state.products.reduce((s,p)=>s+Number(p.popularScore||0),0)/state.products.length) : 0;
      $("avgPopular").textContent = avgPopular;
      const totalCategorized = state.products.filter(p=>adminProductCategoryPathIds(p).length).length;
      $("totalTags").textContent = totalCategorized;
    }

    function setView(view){
      const views = ["products","categories","stats","settings","orders","topups","turnover"];
      views.forEach(v=>{
        const el = document.getElementById(v+"View");
        if(el) el.classList.toggle("hidden", view!==v);
      });
      document.querySelectorAll(".nav-link[data-view]").forEach(a=>{
        a.classList.toggle("active", a.dataset.view===view);
      });
      if(view==="stats"){ try{ renderStatsPanels(); }catch(e){} }
      if(view==="categories"){ try{ renderCategoryAdmin(); }catch(e){} }
      if(view==="orders"){ try{ subscribeOrdersAdmin(); }catch(e){} }
      if(view==="topups"){ try{ subscribeTopupReq(); }catch(e){} }
      if(view==="turnover"){ try{ subscribeTurnover(); }catch(e){} }
      if(view==="settings"){ try{ loadAccessLists(); }catch(e){} try{ loadDeliverySettingsAdmin(); }catch(e){} }
    }

    function renderStatsPanels(){
      const top = [...state.products].sort((a,b)=>Number(b.popularScore||0)-Number(a.popularScore||0)).slice(0,10);
      $("topPopularList").innerHTML = top.map(p=>`<div class="mini-row"><div class="k">${esc(p.id)} · ${esc((p.name||"").slice(0,34))}</div><div class="v">${Number(p.popularScore||0)}</div></div>`).join("");
      const map = new Map();
      state.products.forEach(p=>{ const label=adminProductCategoryLabel(p); map.set(label,(map.get(label)||0)+1); });
      const topTags=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
      $("topTagsList").innerHTML = topTags.map(([t,c])=>`<div class="mini-row"><div class="k">${esc(t)}</div><div class="v">${c}</div></div>`).join("");
    }

    /* ----- form helpers ----- */
    function resetForm(){
      state.editingId=null;
      $("modalTitle").textContent="Yangi mahsulot";
      $("productForm").reset();
      $("createdAt").value = nowISO();
      $("currency").value = "UZS";
      $("tagsPreview").innerHTML="";
      $("colorsContainer").innerHTML="";
      $("sizesContainer").innerHTML="";
      $("imagesContainer").innerHTML="";
      $("variantsContainer").innerHTML='<p class="form-text">Variant narx qo\'yilsa ishlaydi.</p>';
      addColor(); addSize(); addImage();
      $("imagesByColorInput").value="";
      if(document.getElementById("colorImagesContainer")) document.getElementById("colorImagesContainer").innerHTML="";
      if(document.getElementById("productType")) document.getElementById("productType").value="";
      if(document.getElementById("weightKg")) document.getElementById("weightKg").value="";
      ["name_ru","name_en","description_ru","description_en"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
      if(document.getElementById("pType")) document.getElementById("pType").value="stock";
      try{ setCategoryFormValue([]); }catch(e){}
      if(document.getElementById("pMinDays")) document.getElementById("pMinDays").value="";
      if(document.getElementById("pMaxDays")) document.getElementById("pMaxDays").value="";
    }
    function updateTagsPreview(){
      const tags = ($("tagsInput").value||"").split(",").map(s=>s.trim()).filter(Boolean);
      $("tagsPreview").innerHTML = tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("");
    }
    function addColor(name="", hex="#D4AF37"){
      const c=$("colorsContainer");
      const div=document.createElement("div");
      div.className="list-item";
      div.innerHTML=`<input class="form-control colorNameInput" placeholder="Rang nomi" value="${esc(name)}" style="flex:2">
        <input type="color" class="color-input" value="${esc(hex)}">
        <input class="form-control colorHexInput" placeholder="#HEX" value="${esc(hex)}" style="flex:1">
        <button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
      c.appendChild(div);
      const nameInp=div.querySelector('.colorNameInput');
      const color=div.querySelector('input[type="color"]');
      const hexInp=div.querySelectorAll("input")[2];
      color.addEventListener("input",()=>hexInp.value=color.value);
      hexInp.addEventListener("input",()=>{ if(/^#[0-9A-F]{6}$/i.test(hexInp.value)) color.value=hexInp.value; });
      nameInp.addEventListener("input",()=>{ try{ refreshColorImageSelects(); }catch(e){} });
      div.querySelector(".rm").addEventListener("click",()=>{ if(c.querySelectorAll(".list-item").length>1){ div.remove(); try{ refreshColorImageSelects(); }catch(e){} } });
    }
    function addSize(val=""){
      const c=$("sizesContainer");
      const div=document.createElement("div");
      div.className="list-item";
      div.innerHTML=`<input class="form-control" placeholder="Masalan: M" value="${esc(val)}"><button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
      c.appendChild(div);
      div.querySelector(".rm").addEventListener("click",()=>{ if(c.querySelectorAll(".list-item").length>1) div.remove(); });
    }
    function addImage(val=""){
      const c=$("imagesContainer");
      const div=document.createElement("div");
      div.className="list-item";
      div.style.gap="10px";
      div.innerHTML=`
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          <input class="form-control imgUrl" placeholder="https://..." value="${esc(val)}" style="flex:1;min-width:0">
          <input type="file" class="imgFile" accept="image/*" style="display:none">
          <button type="button" class="btn btn-light btn-sm up" title="Upload">
            <i class="fas fa-upload"></i>
          </button>
          <img class="imgPrev" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;display:${val? "block":"none"};border:1px solid #e9ecef">
        </div>
        <button type="button" class="btn btn-light btn-sm rm" title="Remove"><i class="fas fa-times"></i></button>
      `;
      c.appendChild(div);

      const urlEl = div.querySelector(".imgUrl");
      const fileEl = div.querySelector(".imgFile");
      const prevEl = div.querySelector(".imgPrev");
      const upBtn = div.querySelector(".up");

      function setPreview(url){
        if(url){
          prevEl.src=url;
          prevEl.style.display="block";
        }else{
          prevEl.removeAttribute("src");
          prevEl.style.display="none";
        }
      }
      setPreview(urlEl.value.trim());

      urlEl.addEventListener("input", ()=> setPreview(urlEl.value.trim()));
      upBtn.addEventListener("click", ()=> fileEl.click());
      fileEl.addEventListener("change", async ()=>{
        const file = fileEl.files?.[0];
        if(!file) return;
        upBtn.disabled = true;
        upBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try{
          const pid = ($("productId")?.value||"temp").trim() || "temp";
          const url = await uploadImageFile(file, `products/${pid}`);
          urlEl.value = url;
          setPreview(url);
          toast("Rasm yuklandi");
        }catch(e){
          console.warn(e);
          toast("Upload xato: "+(e.message||e),"error");
        }finally{
          upBtn.disabled = false;
          upBtn.innerHTML = '<i class="fas fa-upload"></i>';
          fileEl.value = "";
        }
      });

      div.querySelector(".rm").addEventListener("click",()=>{ if(c.querySelectorAll(".list-item").length>1) div.remove(); });
    }
    function addVariant(v=null){
      const c=$("variantsContainer");
      const div=document.createElement("div");
      div.className="list-item";
      div.style.alignItems="flex-start";
      const o=v||{};
      div.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px;flex:1">
          <div style="display:flex;gap:10px">
            <input class="form-control" placeholder="Color" value="${esc(o.color||"")}" style="flex:1">
            <input class="form-control" placeholder="Size" value="${esc(o.size||"")}" style="flex:1">
          </div>
          <div style="display:flex;gap:10px">
            <input type="number" class="form-control" placeholder="Price" value="${o.price??""}" style="flex:1">
            <input type="number" class="form-control" placeholder="Old" value="${o.oldPrice??0}" style="flex:1">
          </div>
</div>
        <button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
      c.appendChild(div);
      div.querySelector(".rm").addEventListener("click",()=>div.remove());
    }

    function parseImagesByColor(raw){
      if(!raw.trim()) return undefined;
      const obj={};
      raw.split(";").map(s=>s.trim()).filter(Boolean).forEach(pair=>{
        const [k,v]=pair.split("=").map(x=>(x||"").trim());
        if(!k||!v) return;
        obj[k]=v.split("|").map(x=>x.trim()).filter(Boolean);
      });
      return Object.keys(obj).length?obj:undefined;
    }


    function normalizeColorImageUrls(raw){
      return String(raw||"")
        .split(/\n|\|/)
        .map(x=>x.trim())
        .filter(Boolean)
        .filter((x,i,a)=>a.indexOf(x)===i);
    }
    function stringifyImagesByColor(obj){
      if(!obj || typeof obj!=="object") return "";
      return Object.entries(obj)
        .filter(([k,arr])=>k && Array.isArray(arr) && arr.length)
        .map(([k,arr])=>`${k}=${arr.join("|")}`)
        .join("; ");
    }
    function getCurrentColorNames(){
      const names=[...document.querySelectorAll("#colorsContainer .list-item")]
        .map(li=>li.querySelector(".colorNameInput, input")?.value?.trim()||"")
        .filter(Boolean);
      return [...new Set(names)];
    }
    function refreshColorImageSelects(){
      const names=getCurrentColorNames();
      document.querySelectorAll("#colorImagesContainer .ciColor").forEach(sel=>{
        const selected=sel.value;
        const opts=[...names];
        if(selected && !opts.includes(selected)) opts.unshift(selected);
        sel.innerHTML=(opts.length?opts:[""]).map(n=>`<option value="${esc(n)}">${esc(n||"Rang tanlanmagan")}</option>`).join("");
        sel.value = selected && opts.includes(selected) ? selected : (opts[0]||"");
      });
    }
    function renderColorImagePreview(row){
      const wrap=row.querySelector(".color-image-preview");
      const urls=normalizeColorImageUrls(row.querySelector(".ciUrls")?.value||"");
      if(!wrap) return;
      wrap.innerHTML = urls.length
        ? urls.map(u=>`<img class="ci-thumb" src="${esc(u)}" alt="">`).join("")
        : `<span class="form-text">Bu rang uchun rasm yo‘q</span>`;
    }
    function addColorImageRow(colorName="", urls=[]){
      const c=document.getElementById("colorImagesContainer");
      if(!c) return;
      const names=getCurrentColorNames();
      const opts=[...names];
      if(colorName && !opts.includes(colorName)) opts.unshift(colorName);
      const div=document.createElement("div");
      div.className="color-image-row";
      div.innerHTML=`
        <div class="color-image-head">
          <select class="form-control ciColor">
            ${(opts.length?opts:[colorName||""]).map(n=>`<option value="${esc(n)}" ${n===colorName?'selected':''}>${esc(n||"Rang tanlanmagan")}</option>`).join("")}
          </select>
          <div class="color-image-actions">
            <input type="file" class="ciFile" accept="image/*" multiple style="display:none">
            <button type="button" class="btn btn-light btn-sm ciUpload"><i class="fas fa-upload"></i> Rasm yuklash</button>
            <button type="button" class="btn btn-light btn-sm ciUseMain"><i class="fas fa-images"></i> Asosiy rasmdan</button>
            <button type="button" class="btn btn-light btn-sm ciRemove"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <textarea class="form-control ciUrls" placeholder="Bu rang rasmlari URL: har qatorga bitta yoki | bilan ajrating">${esc((Array.isArray(urls)?urls:[]).join("\n"))}</textarea>
        <div class="color-image-preview"></div>
      `;
      c.appendChild(div);
      const ta=div.querySelector(".ciUrls");
      const fileEl=div.querySelector(".ciFile");
      const uploadBtn=div.querySelector(".ciUpload");
      const useMainBtn=div.querySelector(".ciUseMain");
      const removeBtn=div.querySelector(".ciRemove");
      ta.addEventListener("input",()=>renderColorImagePreview(div));
      div.querySelector(".ciColor").addEventListener("change",()=>setImagesByColorInputFromRows());
      uploadBtn.addEventListener("click",()=>fileEl.click());
      useMainBtn.addEventListener("click",()=>{
        const imgs=[...document.querySelectorAll("#imagesContainer .imgUrl")].map(i=>i.value.trim()).filter(Boolean);
        if(!imgs.length) return toast("Avval asosiy rasmlarga rasm qo‘shing", "error");
        const current=normalizeColorImageUrls(ta.value);
        const missing=imgs.filter(u=>!current.includes(u));
        ta.value=[...current, ...missing].join("\n");
        renderColorImagePreview(div);
        setImagesByColorInputFromRows();
        toast("Asosiy rasmlar rangga biriktirildi");
      });
      fileEl.addEventListener("change", async ()=>{
        const files=[...(fileEl.files||[])];
        if(!files.length) return;
        const oldHtml=uploadBtn.innerHTML;
        uploadBtn.disabled=true;
        uploadBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Yuklanmoqda...';
        try{
          const pid=($("productId")?.value||"temp").trim() || "temp";
          const color=(div.querySelector(".ciColor")?.value||"rang").replace(/[^a-zA-Z0-9_-]+/g,"_") || "rang";
          const uploaded=[];
          for(const file of files){
            uploaded.push(await uploadImageFile(file, `products/${pid}/colors/${color}`));
          }
          const current=normalizeColorImageUrls(ta.value);
          ta.value=[...current, ...uploaded].filter((x,i,a)=>a.indexOf(x)===i).join("\n");
          renderColorImagePreview(div);
          setImagesByColorInputFromRows();
          toast("Rang rasmi yuklandi");
        }catch(e){
          console.warn(e);
          toast("Rang rasmi upload xato: "+(e.message||e), "error");
        }finally{
          uploadBtn.disabled=false;
          uploadBtn.innerHTML=oldHtml;
          fileEl.value="";
        }
      });
      removeBtn.addEventListener("click",()=>{ div.remove(); setImagesByColorInputFromRows(); });
      renderColorImagePreview(div);
      setImagesByColorInputFromRows();
    }
    function getImagesByColorFromRows(){
      const obj={};
      document.querySelectorAll("#colorImagesContainer .color-image-row").forEach(row=>{
        const color=(row.querySelector(".ciColor")?.value||"").trim();
        const urls=normalizeColorImageUrls(row.querySelector(".ciUrls")?.value||"");
        if(color && urls.length) obj[color]=urls;
      });
      return Object.keys(obj).length?obj:undefined;
    }
    function setImagesByColorInputFromRows(){
      const input=document.getElementById("imagesByColorInput");
      if(!input) return;
      input.value=stringifyImagesByColor(getImagesByColorFromRows());
    }
    function syncColorImageRows(opts={}){
      const keep = opts.keepExisting !== false;
      const existing = keep ? (getImagesByColorFromRows() || parseImagesByColor(document.getElementById("imagesByColorInput")?.value||"") || {}) : {};
      const names=getCurrentColorNames();
      const c=document.getElementById("colorImagesContainer");
      if(!c) return;
      c.innerHTML="";
      if(names.length){
        names.forEach(n=>addColorImageRow(n, existing[n]||[]));
      }else{
        Object.entries(existing).forEach(([k,arr])=>addColorImageRow(k, arr||[]));
      }
      setImagesByColorInputFromRows();
      if(!opts.quiet) toast("Rang rasm qatorlari tayyor");
    }
    function renderColorImagesFromObject(obj){
      const c=document.getElementById("colorImagesContainer");
      if(!c) return;
      c.innerHTML="";
      const data=(obj && typeof obj==="object") ? obj : {};
      const names=getCurrentColorNames();
      const used=new Set();
      names.forEach(n=>{ used.add(n); addColorImageRow(n, Array.isArray(data[n])?data[n]:[]); });
      Object.entries(data).forEach(([k,arr])=>{ if(!used.has(k)) addColorImageRow(k, Array.isArray(arr)?arr:[]); });
      setImagesByColorInputFromRows();
    }

    
    function parseSeqForPrefix(prefix){
      const rx = new RegExp("^" + prefix + "(\d+)$","i");
      const nums = state.products
        .map(p=>String(p.id||"").trim())
        .map(id=>{
          const m = id.match(rx);
          return m ? parseInt(m[1],10) : NaN;
        })
        .filter(n=>Number.isFinite(n));
      return nums.length ? Math.max(...nums) : 0;
    }

    async function genSeqId(prefix){
      // PRO: global counter via Firestore transaction (no overwrite, concurrency-safe)
      const counterRef = doc(db, "meta", "counters");
      const pfx = String(prefix||"").toLowerCase();

      return await runTransaction(db, async (tx) => {
        const cs = await tx.get(counterRef);
        const data = cs.exists() ? (cs.data()||{}) : {};
        let cur = Number(data[pfx] || 0);
        let next = cur;

        // ensure unique even if old docs exist
        for(let guard=0; guard<50; guard++){
          next = next + 1;
          const cand = (pfx + String(next).padStart(3,"0")).toLowerCase();
          const candRef = doc(db, "products", cand);
          const ps = await tx.get(candRef);
          if(!ps.exists()){
            tx.set(counterRef, { [pfx]: next }, { merge:true });
            return cand;
          }
        }
        throw new Error("ID generator: urinishlar tugadi (50).");
      });
    }

    async function genAdminId(){
      // Admin mahsulotlari: aa001, aa002, ...
      return await genSeqId("aa");
    }


    // Vendor prefix: aa, ab, ... az, ba, ... zz, aaa, aab...
    function excelLetters(num){
      const letters = "abcdefghijklmnopqrstuvwxyz";
      let n = Math.max(1, Math.floor(Number(num)||1));
      let s = "";
      while(n>0){
        const rem = (n-1) % 26;
        s = letters[rem] + s;
        n = Math.floor((n-1)/26);
      }
      return s;
    }
    function vendorPrefixForEmail(email){
      const em = normEmail(email);
      const idx = state.vendorEmails.map(normEmail).indexOf(em);
      // start from 28 => "ab" ("aa" reserved for admin)
      return excelLetters((idx>=0?idx:0) + 28);
    }
    async function genVendorId(email){
      // Vendor mahsulotlari: ab001, ab002, ... (vendorlar ro'yxati tartibi bo'yicha)
      const prefix = vendorPrefixForEmail(email);
      return await genSeqId(prefix);
    }


    async function translateUzTextsForAdmin(texts, target){
      // DeepSeek API faqat haqiqiy admin uchun ishlaydi.
      // Asosiy sahifa va oddiy foydalanuvchi bu endpointdan foydalana olmaydi.
      const user = auth.currentUser;
      if(!user || !isAdmin(user)) throw new Error("DeepSeek tarjima faqat admin uchun ruxsat etilgan");

      const clean = (texts||[]).map(v=>String(v||"").trim());
      const nonEmpty = clean.map((text, index)=>({text,index})).filter(x=>x.text);
      const out = clean.map(()=>"");
      if(!nonEmpty.length) return out;

      const idToken = await user.getIdToken(true);
      const res = await fetch("/.netlify/functions/deepseek-translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        },
        body: JSON.stringify({ target, texts: nonEmpty.map(x=>x.text) })
      });
      const raw = await res.text();
      let data = {};
      try{ data = JSON.parse(raw); }catch(_e){}
      if(!res.ok){
        const msg = String(data?.details || data?.error || raw || ("HTTP " + res.status));
        if(res.status === 401 || res.status === 403) throw new Error("DeepSeek API admin login bilan himoyalangan. Qayta kiring yoki admin ruxsatini tekshiring.");
        if(res.status === 402) throw new Error("DeepSeek hisobida balans/to‘lov muammosi bor: 402 Payment Required");
        if(res.status === 500 && msg.includes("DEEPSEEK_API_KEY")) throw new Error("Netlify’da DEEPSEEK_API_KEY sozlanmagan");
        if(res.status === 500 && msg.includes("FIREBASE_SERVICE_ACCOUNT_B64")) throw new Error("Netlify’da FIREBASE_SERVICE_ACCOUNT_B64 sozlanmagan — admin token tekshiruv ishlamaydi");
        throw new Error(msg.slice(0, 240));
      }
      const tr = Array.isArray(data.translations) ? data.translations : [];
      nonEmpty.forEach((x,i)=>{ out[x.index] = String(tr[i] || x.text).trim(); });
      return out;
    }

    async function autoTranslateProductFields(){
      const btn = document.getElementById("autoTranslateBtn");
      if(!auth.currentUser || !isAdmin(auth.currentUser)) return toast("Avto tarjima faqat admin uchun. Foydalanuvchi va vendor DeepSeek API ishlata olmaydi.", "error");
      const uzName = ($("name")?.value || "").trim();
      const uzDesc = ($("description")?.value || "").trim();
      if(!uzName && !uzDesc) return toast("Avval o‘zbekcha nom yoki tavsif yozing", "error");
      const oldHtml = btn ? btn.innerHTML : "";
      try{
        if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tarjima qilinmoqda...'; }
        const [ru, en] = await Promise.all([
          translateUzTextsForAdmin([uzName, uzDesc], "ru"),
          translateUzTextsForAdmin([uzName, uzDesc], "en")
        ]);
        if(document.getElementById("name_ru") && ru[0]) document.getElementById("name_ru").value = ru[0];
        if(document.getElementById("description_ru") && ru[1]) document.getElementById("description_ru").value = ru[1];
        if(document.getElementById("name_en") && en[0]) document.getElementById("name_en").value = en[0];
        if(document.getElementById("description_en") && en[1]) document.getElementById("description_en").value = en[1];
        toast("RU va EN tarjimalar tayyor");
      }catch(e){
        console.error(e);
        toast("Tarjima xatosi: " + (e.message || e), "error");
      }finally{
        if(btn){ btn.disabled = false; btn.innerHTML = oldHtml || '<i class="fas fa-wand-magic-sparkles"></i> UZ dan RU/EN yaratish'; }
      }
    }

    async function saveProduct(){
      const user=auth.currentUser;
      const isA = isAdmin(user);
      const isV = isVendor(user);
      if(!isA && !isV) return toast("Ruxsat yo‘q","error");
      const name=($("name").value||"").trim();
      const price=$("price").value;
      if(!name||!price) return toast("Nomi va narx shart","error");

      // ID policy:
      // - Admin: om###
      // - Vendor: aa..., ab..., ... based on vendor list order
      let id = state.editingId;
      if(!id){
        id = isA ? await genAdminId() : await genVendorId(user?.email||"");
      }
      // keep form in sync (read-only display)
      if($("productId")) $("productId").value = id;
const tags=($("tagsInput").value||"").split(",").map(s=>s.trim()).filter(Boolean);
      const categoryPayload = selectedCategoryPayload();

      const colors=[...document.querySelectorAll("#colorsContainer .list-item")].map(li=>{
        const ins=li.querySelectorAll("input");
        return { name: ins[0].value.trim(), hex: ins[2].value.trim() };
      }).filter(c=>c.name&&c.hex);

      const sizes=[...document.querySelectorAll("#sizesContainer .list-item input")].map(i=>i.value.trim()).filter(Boolean);
      const images=[...document.querySelectorAll("#imagesContainer .list-item input")].map(i=>i.value.trim()).filter(Boolean);

      const variants=[...document.querySelectorAll("#variantsContainer .list-item")].map(li=>{
        const ins=li.querySelectorAll("input");
        if(ins.length<5) return null;
        const price=ins[2].value.trim();
        if(!price) return null;
        return {
          color: ins[0].value.trim()||null,
          size: ins[1].value.trim()||null,
          price: Number(price),
          oldPrice: Number(ins[3].value||0)
        };
      }).filter(Boolean);

      const data={
        name,
        name_ru: ($("name_ru")?.value || "").trim(),
        name_en: ($("name_en")?.value || "").trim(),

        description:$("description").value||"",
        description_ru: ($("description_ru")?.value || "").trim(),
        description_en: ($("description_en")?.value || "").trim(),
        youtubeUrl:$("youtubeUrl").value||"",
        price:Number(price),
        oldPrice:Number($("oldPrice").value||0),
        weightKg:Number(document.getElementById("weightKg")?.value || 0),
        popularScore:Number($("popularScore").value||0),
        currency:$("currency").value||"UZS",
        productType: (document.getElementById("productType")?.value || ""),

        createdAt:$("createdAt").value||nowISO(),
        ...categoryPayload,
        tags, colors, sizes, images, variants,
        imagesByColor: getImagesByColorFromRows() || parseImagesByColor($("imagesByColorInput").value||""),
        updatedAt: serverTimestamp(),
      
      fulfillmentType: (document.getElementById('pType')?.value || 'stock'),
      deliveryMinDays: Number(document.getElementById('pMinDays')?.value || (document.getElementById('pType')?.value==='cargo'?15:1)),
      deliveryMaxDays: Number(document.getElementById('pMaxDays')?.value || (document.getElementById('pType')?.value==='cargo'?30:7)),
      prepayRequired: (document.getElementById('pType')?.value==='cargo'),
};

      // Marketplace fields
      if(isV){
        data.ownerUid = user.uid;
        data.ownerEmail = normEmail(user.email);
        // vendor create => pending; vendor edit => keep old status
        if(!state.editingId){
          data.status = "pending";
        }
      }else if(isA){
        // admin create => approved by default
        if(!state.editingId && !data.status) data.status = "approved";
      }

      // clean empty
      Object.keys(data).forEach(k=>{
        const v=data[k];
        if(v==="" || (Array.isArray(v)&&v.length===0) || v===undefined) delete data[k];
      });

      try{
        // Vendor edit protection (UI-level): only own product
        if(isV && state.editingId){
          const p0 = state.products.find(x=>x.id===state.editingId);
          if(p0 && p0.ownerUid && p0.ownerUid !== user.uid){
            return toast("Faqat o‘zingiz qo‘shgan mahsulotni tahrirlaysiz","error");
          }
        }
        await setDoc(doc(db,"products",id), data, { merge:true });
        toast(state.editingId?"Yangilandi":"Yangi mahsulot qo'shildi");
        closeModal("productModal");
        resetForm();
        await fetchProducts();
      }catch(e){ toast("Xatolik: "+e.message,"error"); }
    }

    function openEdit(id){
      const p=state.products.find(x=>x.id===id);
      if(!p) return;
      state.editingId=id;
      $("modalTitle").textContent="Tahrirlash";
      $("productId").value=p.id;
      $("name").value=p.name||"";
      (document.getElementById("subtitle")||{value:""}).value=p.subtitle||"";
      $("price").value=Number(p.price||0);
      $("oldPrice").value=Number(p.oldPrice||0);
      if(document.getElementById("weightKg")) document.getElementById("weightKg").value = Number(p.weightKg ?? p.weight ?? p.massKg ?? 0) || "";
      $("popularScore").value=Number(p.popularScore||0);
      $("createdAt").value=p.createdAt||nowISO();
      $("description").value=p.description||"";
      if(document.getElementById("name_ru")) document.getElementById("name_ru").value = p.name_ru || p.nameRu || p.ru?.name || p.locales?.ru?.name || "";
      if(document.getElementById("name_en")) document.getElementById("name_en").value = p.name_en || p.nameEn || p.en?.name || p.locales?.en?.name || "";
      if(document.getElementById("description_ru")) document.getElementById("description_ru").value = p.description_ru || p.descriptionRu || p.desc_ru || p.ru?.description || p.locales?.ru?.description || "";
      if(document.getElementById("description_en")) document.getElementById("description_en").value = p.description_en || p.descriptionEn || p.desc_en || p.en?.description || p.locales?.en?.description || "";
      $("youtubeUrl").value=p.youtubeUrl||p.videoUrl||"";
$("currency").value=p.currency||"UZS";
      if(document.getElementById("productType")) document.getElementById("productType").value = (p.productType||"");
      try{ setProductCategorySelects(adminProductCategoryPathIds(p)); }catch(e){ try{ setCategoryFormValue(adminProductCategoryPathIds(p)); }catch(_){} }
      $("tagsInput").value=(p.tags||[]).join(", ");
      updateTagsPreview();

      $("colorsContainer").innerHTML="";
      (p.colors?.length?p.colors:[{name:"",hex:"#D4AF37"}]).forEach(c=>addColor(c.name,c.hex));
      $("sizesContainer").innerHTML="";
      (p.sizes?.length?p.sizes:[""]).forEach(s=>addSize(s));
      $("imagesContainer").innerHTML="";
      (p.images?.length?p.images:[""]).forEach(u=>addImage(u));

      if(p.imagesByColor && typeof p.imagesByColor==="object"){
        $("imagesByColorInput").value = stringifyImagesByColor(p.imagesByColor);
        renderColorImagesFromObject(p.imagesByColor);
      }else{
        $("imagesByColorInput").value="";
        renderColorImagesFromObject({});
      }

      $("variantsContainer").innerHTML='<p class="form-text">Variant narx qo\'yilsa ishlaydi.</p>';
      (p.variants||[]).forEach(v=>addVariant(v));

            if(document.getElementById("pType")) document.getElementById("pType").value = (p.fulfillmentType||"stock");
      if(document.getElementById("pMinDays")) document.getElementById("pMinDays").value = (p.deliveryMinDays ?? ( (p.fulfillmentType==="cargo")?15:"" ));
      if(document.getElementById("pMaxDays")) document.getElementById("pMaxDays").value = (p.deliveryMaxDays ?? ( (p.fulfillmentType==="cargo")?30:"" ));

      openModal("productModal");
    }


    async function updateProductStatus(id, status){
      if(state.role!=="admin") return toast("Faqat admin holatni o'zgartira oladi","error");
      try{
        await updateDoc(doc(db,"products",id), { status: status, updatedAt: serverTimestamp() });
        toast(status==="approved" ? "Tasdiqlandi" : "Rad etildi");
        await fetchProducts();
      }catch(e){
        console.error(e);
        toast("Xatolik: "+(e.message||e), "error");
      }
    }

    async function removeProduct(id){
      const user=auth.currentUser;
      if(!isAdmin(user)) return toast("Admin emas: o'chirib bo'lmaydi","error");
      if(!confirm(`"${id}" mahsulot o'chirilsinmi?`)) return;
      try{
        await deleteDoc(doc(db,"products",id));
        toast("O'chirildi");
        await fetchProducts();
      }catch(e){ toast("Xatolik: "+e.message,"error"); }
    }

    /* ---- JSON ---- */
    function highlight(json){
      json=json.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (m)=>{
          let cls="json-number";
          if(/^"/.test(m)) cls=/:$/.test(m)?"json-key":"json-string";
          else if(/true|false/.test(m)) cls="json-boolean";
          else if(/null/.test(m)) cls="json-null";
          return `<span class="${cls}">${m}</span>`;
        });
    }
    function viewJson(){
      const data={ schemaVersion:7, items: state.products.map(p=>{const o={...p}; delete o.updatedAt; return o;}) };
      $("jsonViewer").innerHTML = highlight(JSON.stringify(data,null,2));
      openModal("jsonModal");
    }
    async function copyJson(){
      const data={ schemaVersion:7, items: state.products.map(p=>{const o={...p}; delete o.updatedAt; return o;}) };
      try{ await navigator.clipboard.writeText(JSON.stringify(data,null,2)); toast("Nusxalandi"); }
      catch(e){ toast("Clipboard xatolik: "+e.message,"error"); }
    }
    function downloadJson(){
      const data={ schemaVersion:7, items: state.products.map(p=>{const o={...p}; delete o.updatedAt; return o;}) };
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download="products.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast("Yuklab olindi");
    }

    /* ---- Import ---- */
    function parseJsonText(text){
      const obj=JSON.parse(text);
      if(Array.isArray(obj)) return { schemaVersion:7, items: obj };
      if(obj && Array.isArray(obj.items)) return obj;
      throw new Error("items[] topilmadi");
    }
    async function importJson(){
      const user=auth.currentUser;
      if(!isAdmin(user)) return toast("Admin emas: import mumkin emas","error");

      let text=($("importPaste").value||"").trim();
      const file=$("importFile").files?.[0];
      if(!text && file) text=await file.text();
      if(!text) return toast("JSON kiriting yoki fayl tanlang","error");

      let obj;
      try{ obj=parseJsonText(text); }catch(e){ return toast("JSON xato: "+e.message,"error"); }
      const items=(obj.items||[]).map(normalize);
      if(!items.length) return toast("items[] bo'sh","error");

      const mode=$("importMode").value;
      try{
        if(mode==="replaceAll"){
          const snap=await getDocs(collection(db,"products"));
          const ids=snap.docs.map(d=>d.id);
          for(let i=0;i<ids.length;i+=450){
            const batch=writeBatch(db);
            ids.slice(i,i+450).forEach(id=>batch.delete(doc(db,"products",id)));
            await batch.commit();
          }
        }
        for(let i=0;i<items.length;i+=350){
          const batch=writeBatch(db);
          items.slice(i,i+350).forEach(p=>{
            const id=p.id || genAdminId();
            const data={...p, updatedAt: serverTimestamp()};
            delete data.id;
            batch.set(doc(db,"products",id), data, { merge:true });
          });
          await batch.commit();
        }
        closeModal("importModal");
        toast("Import yakunlandi");
        await fetchProducts();
      }catch(e){ toast("Importda xatolik: "+e.message,"error"); }
    }

    /* ---- Auth ---- */
    function renderUser(user){
      if(!user){
        $("adminName").textContent="Mehmon";
        $("adminEmail").textContent="—";
        $("adminAvatar").textContent="A";
        $("loginBtn").style.display="";
        $("logoutBtn").style.display="none";
        return;
      }
      $("adminName").textContent=user.displayName||"Admin";
      $("adminEmail").textContent=user.email||"—";
      $("adminAvatar").textContent=(user.displayName||user.email||"A").trim()[0].toUpperCase();
      $("loginBtn").style.display="none";
      $("logoutBtn").style.display="";
      if(!isAdmin(user)) toast("Faqat ko‘rish: admin emassiz","error");
      else toast("Admin ");
    }


    function applyRoleUI(){
      const isA = state.role === "admin";
      // Sidebar nav items
      const hideForVendor = ["orders","topups","turnover","settings"]; // vendorga kerak bo'lmaganlar
      document.querySelectorAll(".nav-link[data-view]").forEach(a=>{
        const v = a.dataset.view;
        if(!isA && hideForVendor.includes(v)){
          a.style.display = "none";
        }else{
          a.style.display = "";
        }
      });

      // Header title and buttons
      try{
        const roleChip = document.getElementById("roleChip");
        if(roleChip){
          roleChip.textContent = isA ? "Admin" : "Sotuvchi";
          roleChip.className = "pill " + (isA ? "paid" : "pending");
        }
      }catch(e){}

      // Products title
      try{
        const pt = document.getElementById("productsTitle");
        if(pt) pt.textContent = isA ? "Barcha mahsulotlar" : "Mening mahsulotlarim";
      }catch(e){}

      // Vendor bo'lsa: import/json export va DeepSeek tarjima kabi admin-only tugmalarni yashiramiz
      try{
        const importBtn = document.getElementById("importBtn");
        if(importBtn) importBtn.style.display = isA ? "" : "none";
        const exportBtn = document.getElementById("exportJsonBtn");
        if(exportBtn) exportBtn.style.display = isA ? "" : "none";
        const autoTranslateBtn = document.getElementById("autoTranslateBtn");
        if(autoTranslateBtn) autoTranslateBtn.style.display = isA ? "" : "none";
      }catch(e){}
    }


    async function login(){
      try{ await signInWithPopup(auth, provider); }
      catch(e){ toast("Kirishda xatolik: "+e.message,"error"); }
    }
    async function logout(){
      try{ await signOut(auth); toast("Chiqildi"); }
      catch(e){ toast("Chiqishda xatolik: "+e.message,"error"); }
    }

    /* ---- Events ---- */
    function bind(){
      document.querySelectorAll(".nav-link[data-view]").forEach(a=>a.addEventListener("click",(e)=>{e.preventDefault(); setView(a.dataset.view);}));  
      $("addProductBtn").addEventListener("click",()=>{ resetForm(); openModal("productModal"); });
      $("saveProductBtn").addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); saveProduct(); });
      $("autoTranslateBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); autoTranslateProductFields(); });
      $("closeModalBtn").addEventListener("click",()=>{ closeModal("productModal"); resetForm(); });
      $("productModalCancelBtn")?.addEventListener("click",()=>{ closeModal("productModal"); resetForm(); });
$("viewJsonBtn").addEventListener("click",viewJson);
      $("closeJsonModalBtn").addEventListener("click",()=>closeModal("jsonModal"));
      $("copyJsonBtn").addEventListener("click",copyJson);
      $("downloadJsonBtn").addEventListener("click",downloadJson);
      $("refreshBtn").addEventListener("click",fetchProducts);
      $("exportJsonNav").addEventListener("click",(e)=>{e.preventDefault(); downloadJson();});

      try{ populateCategoryFilters(); syncSubcategorySelect(); }catch(e){}
      $("productCategory")?.addEventListener("change",()=>syncSubcategorySelect());
      $("productSubcategory")?.addEventListener("change",()=>syncSubcategorySelect($("productSubcategory")?.value||""));
      $("tagsInput").addEventListener("input",updateTagsPreview);
      $("addColorBtn").addEventListener("click",()=>{ addColor(); refreshColorImageSelects(); });
      $("addSizeBtn").addEventListener("click",()=>addSize());
      $("addImageBtn").addEventListener("click",()=>addImage());
      $("addVariantBtn").addEventListener("click",()=>addVariant());
      $("syncColorImagesBtn")?.addEventListener("click",()=>syncColorImageRows({keepExisting:true}));

      $("addMainCategoryBtn")?.addEventListener("click",()=>openCategoryEditor(""));
      $("exportCategoriesBtn")?.addEventListener("click",exportCategories);
      $("resetCategoriesBtn")?.addEventListener("click",resetCategoriesToDefault);
      $("closeCategoryEditorBtn")?.addEventListener("click",closeCategoryEditor);
      $("categoryEditorCancelBtn")?.addEventListener("click",closeCategoryEditor);
      $("saveCategoryBtn")?.addEventListener("click",saveCategoryEditor);
      $("categoryIcon")?.addEventListener("input",(e)=>{ renderIconPicker(e.target.value); try{ updateCategoryIconPreview(); }catch(err){} });
      $("categoryIconImage")?.addEventListener("input",()=>{ try{ updateCategoryIconPreview(); }catch(err){} });
      $("categoryIconFile")?.addEventListener("change",(e)=>{ try{ handleCategoryIconFile(e.target.files?.[0]); e.target.value=""; }catch(err){ toast("Icon yuklashda xatolik", "error"); } });
      $("clearCategoryIconImageBtn")?.addEventListener("click",()=>{ if($("categoryIconImage")) $("categoryIconImage").value=""; try{ updateCategoryIconPreview(); }catch(err){} });
      $("addColorImageBtn")?.addEventListener("click",()=>addColorImageRow("", []));

      const applyProductFilters = ()=> renderTable();
      $("searchInput").addEventListener("input",()=>{
        const ps = $("productSectionSearch");
        if(ps && document.activeElement !== ps) ps.value = $("searchInput").value || "";
        applyProductFilters();
      });
      $("productSectionSearch")?.addEventListener("input",()=>{
        const globalSearch = $("searchInput");
        if(globalSearch && document.activeElement !== globalSearch) globalSearch.value = $("productSectionSearch").value || "";
        applyProductFilters();
      });
      ["productStatusFilter","productFulfillmentFilter","productCategoryFilter","productSort"].forEach(id=>{
        const el = $(id);
        if(el){ el.addEventListener("input", applyProductFilters); el.addEventListener("change", applyProductFilters); }
      });
      $("productFiltersClear")?.addEventListener("click",()=>{
        if($("productSectionSearch")) $("productSectionSearch").value="";
        if($("searchInput")) $("searchInput").value="";
        if($("productStatusFilter")) $("productStatusFilter").value="all";
        if($("productFulfillmentFilter")) $("productFulfillmentFilter").value="all";
        if($("productCategoryFilter")) $("productCategoryFilter").value="all";
        if($("productSort")) $("productSort").value="default";
        renderTable();
      });
      $("productTableMode")?.addEventListener("click",()=>setProductViewMode("table"));
      $("productCardMode")?.addEventListener("click",()=>setProductViewMode("cards"));
      $("productAddHeroBtn")?.addEventListener("click",()=>$("addProductBtn")?.click());
      $("productImportHeroBtn")?.addEventListener("click",()=>$("importJsonBtn")?.click());
      $("productExportHeroBtn")?.addEventListener("click",()=>downloadJson());

      $("loginBtn").addEventListener("click",login);
      $("logoutBtn").addEventListener("click",logout);

      $("importJsonBtn").addEventListener("click",()=>openModal("importModal"));
      $("closeImportModalBtn").addEventListener("click",()=>closeModal("importModal"));
      $("importCancelBtn").addEventListener("click",()=>closeModal("importModal"));
      $("runImportBtn").addEventListener("click",importJson);

      ;
      $("recalcStatsBtn").addEventListener("click",()=>{ renderStats(); renderStatsPanels(); toast("Hisoblandi"); });

      if($("turnoverRefresh")) $("turnoverRefresh").addEventListener("click",()=>subscribeTurnover());
      ["turnoverSearch","turnoverType","turnoverStatus","turnoverFrom","turnoverTo"].forEach(id=>{ const el=$(id); if(el){ el.addEventListener("input",renderTurnover); el.addEventListener("change",renderTurnover);} });

      // Turnover action buttons (only for topup rows)
      if(!window.__turnoverActionsBound && $("turnoverTbody")){
        window.__turnoverActionsBound = true;
        $("turnoverTbody").addEventListener("click", async (e)=>{
          const btn = e.target.closest("button[data-act][data-id]");
          if(!btn) return;
          const act = btn.getAttribute("data-act");
          const id = btn.getAttribute("data-id");
          try{
            btn.disabled = true;
            if(act==="approve") await approveTopup(id);
            else if(act==="cancel") await cancelTopup(id);
            toast("Bajarildi", "success");
          }catch(err){
            console.error(err);
            toast("Xato: "+(err?.message||err), "error");
          }finally{
            btn.disabled = false;
          }
        });
      }


      window.addEventListener("click",(e)=>{
if(e.target===$("jsonModal")) closeModal("jsonModal");
        if(e.target===$("importModal")) closeModal("importModal");
      });
    }

    let __bound = false;

    document.getElementById("saveDeliverySettingsBtn")?.addEventListener("click", saveDeliverySettingsAdmin);
    document.getElementById("addCourierZoneBtn")?.addEventListener("click", addCourierZoneFromUI);
    document.getElementById("normalizeCourierZonesBtn")?.addEventListener("click", ()=>normalizeCourierZonesUI(true));
    document.getElementById("resetDeliverySettingsBtn")?.addEventListener("click", ()=>{ fillDeliverySettingsForm(deliveryDefaultClone()); toast('Standart tariflar qo‘yildi. Saqlashni unutmang.'); });

    onAuthStateChanged(auth, async (user)=>{
  // GUARD (admin yoki sotuvchi)
  if(!user){
    document.body.innerHTML = "";
    location.replace("./login.html");
    return;
  }

  state.user = user;
  try{
    const cUid = document.getElementById("currentUidBox");
    if(cUid) cUid.textContent = (user?.uid || "-");
  }catch(e){}

  // access lists
  await loadAccessLists();

  if(isAdmin(user)){
    state.role = "admin";
  }else if(isVendor(user)){
    state.role = "vendor";
  }else{
    try{ await signOut(auth); }catch(e){}
    document.body.innerHTML = "";
    alert("Ruxsat yo‘q! Siz admin ham, sotuvchi (vendor) ham emassiz.");
    location.replace("./login.html");
    return;
  }

  renderUser(user);

  // Vendor bo‘lsa: admin-only bo‘limlarni yashiramiz
  applyRoleUI();

  await loadCategorySettingsAdmin();

  document.body.style.display = "block";

  if(!__bound){
    __bound = true;
    bind();
    resetForm();
    setView("products");
  }

  await fetchProducts();
  try{ await fetchTopups?.(); }catch(e){}
  try{ await fetchTurnover?.(); }catch(e){}
  try{ await renderStatsPanels?.(); }catch(e){}
});

    // (Fix) DOMContentLoaded event name was misspelled before.
    // We keep this as a safe fallback; real init happens after admin verification above.
    document.addEventListener("DOMContentLoaded", ()=>{
      // no-op: binding happens after auth guard
    });
  
    function escapeHtml(s){return String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}

/** Order items: safe image resolver (backward compatible) */
function getItemImageUrl(item){
  try{
    if(!item) return "";
    // Direct fields
    const direct = item.image || item.imageUrl || item.img || item.photo;
    if(direct && typeof direct === "string") return direct;

    // images array
    if(Array.isArray(item.images) && item.images.length) return String(item.images[0]||"");

    // imagesByColor object { color: [url,...] }
    if(item.imagesByColor && typeof item.imagesByColor === "object"){
      const keys = Object.keys(item.imagesByColor);
      if(keys.length){
        const v = item.imagesByColor[keys[0]];
        if(Array.isArray(v) && v.length) return String(v[0]||"");
        if(typeof v === "string") return v;
      }
    }
  }catch(e){}
  return "";
}

function statusClass3(s){
  const st = String(s||"").toLowerCase();
  if(st==="approved" || st==="paid" || st==="delivered" || st==="success") return "approved";
  if(st==="cancelled" || st==="canceled" || st==="rejected" || st==="failed") return "cancelled";
  // pending/payment/waiting/cash
  return "pending";
}

function statusUZ(s){
  const st = String(s||"").toLowerCase();
  const map = {
    pending: "Kutilmoqda",
    pending_payment: "To‘lov kutilmoqda",
    pending_cash: "Naqd kutilmoqda",
    approved: "Tasdiqlandi",
    rejected: "Rad etildi",
    paid: "To‘langan",
    delivered: "Yetkazildi",
    cancelled: "Bekor qilindi",
    canceled: "Bekor qilindi",
    canceled_by_admin: "Admin bekor qildi",
    success: "Muvaffaqiyatli",
    failed: "Xatolik"
  };
  return map[st] || s;
}

    // === Telegram helpers (Admin + User) ===
    function tgEscape(s){ return String(s??"").replace(/[<>&]/g, c=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }
    function tgSend(token, chatId, htmlText){
      try{
        const t = String(token||"").trim();
        const c = String(chatId||"").trim();
        if(t.length < 10 || c.length < 2) return;
        const base = `https://api.telegram.org/bot${t}/sendMessage`;
        const url = base
          + `?chat_id=${encodeURIComponent(c)}`
          + `&text=${encodeURIComponent(htmlText)}`
          + `&parse_mode=HTML`
          + `&disable_web_page_preview=true`;
        const img = new Image();
        img.src = url;
      }catch(e){}
    }
    function tgAdminEnabled(){
      return window.TG_ADMIN && window.TG_ADMIN.botToken && window.TG_ADMIN.chatId
        && String(window.TG_ADMIN.botToken).trim().length > 10
        && String(window.TG_ADMIN.chatId).trim().length > 2;
    }
    function tgUserToken(){
      if(window.TG_USER && String(window.TG_USER.botToken||"").trim().length > 10) return String(window.TG_USER.botToken).trim();
      if(tgAdminEnabled()) return String(window.TG_ADMIN.botToken).trim();
      return "";
    }
    function tgAdminHTML(htmlText){
      if(!tgAdminEnabled()) return;
      tgSend(window.TG_ADMIN.botToken, window.TG_ADMIN.chatId, htmlText);
    }
    function tgUserHTML(chatId, htmlText){
      const token = tgUserToken();
      if(!token) return;
      if(!chatId) return;
      tgSend(token, chatId, htmlText);
    }
    function tgOrderStatusHTML(o){
      const st = tgEscape(o.status||"");
      const sum = Number(o.totalUZS||0).toLocaleString();
        const canAct = (o.__src==="topup_requests") && (st==="pending");
        const actions = canAct ? `
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-sm btn-success" data-act="approve" data-id="${escapeHtml(o.orderId||o.id||"")}"><i class="fas fa-check"></i></button>
            <button class="btn btn-sm btn-danger" data-act="cancel" data-id="${escapeHtml(o.orderId||o.id||"")}"><i class="fas fa-times"></i></button>
          </div>
        ` : `<span class="muted">—</span>`;
      return [
        `<b>📦 Buyurtma statusi yangilandi</b>`,
        `Buyurtma ID: <code>${tgEscape(o.orderId||o.id||"")}</code>`,
        o.numericId ? `Foydalanuvchi ID: <b>${tgEscape(o.numericId)}</b>` : "",
        o.userName ? `Ism: <b>${tgEscape(o.userName)}</b>` : "",
        o.userPhone ? `Tel: <b>${tgEscape(o.userPhone)}</b>` : "",
        `Yangi holat: <b>${st}</b>`,
        o.provider ? `To‘lov: <b>${tgEscape(o.provider)}</b>` : "",
        `Summa: <b>${sum}</b> so‘m`
      ].filter(Boolean).join("\n");
    }

    // ===== Orders (Admin) =====
    let ordersUnsub = null;
    let userInfoCache = new Map(); // uid -> {publicId, phone, name}
    let userInfoPending = new Map(); // uid -> Promise

    function pickUserPublicId(u, fallbackUid){
      if(!u) return fallbackUid || "—";
      return String(u.numericId || u.omId || u.OMId || u.userId || u.publicId || u.id || fallbackUid || "—");
    }
    function pickUserPhone(u){
      if(!u) return "";
      return String(u.phone || u.phoneNumber || u.tel || u.telefon || u.mobile || "");
    }
    function pickUserName(u){
      if(!u) return "";
      return String(u.name || u.displayName || u.fullName || "");
    }

    async function getUserInfoByUid(uid){
      const id = String(uid||"").trim();
      if(!id) return null;
      if(userInfoCache.has(id)) return userInfoCache.get(id);
      if(userInfoPending.has(id)) return await userInfoPending.get(id);
      const prom = (async()=>{
        try{
          const ref = doc(db, "users", id);
          const snap = await getDoc(ref);
          if(!snap.exists()){
            const info = { publicId:id, phone:"", name:"" };
            userInfoCache.set(id, info);
            return info;
          }
          const u = snap.data()||{};
          const info = { publicId: pickUserPublicId(u, id), phone: pickUserPhone(u), name: pickUserName(u) };
          userInfoCache.set(id, info);
          return info;
        }catch(e){
          console.warn("getUserInfoByUid error", e);
          const info = { publicId:id, phone:"", name:"" };
          userInfoCache.set(id, info);
          return info;
        }finally{
          try{ userInfoPending.delete(id);}catch(_e){}
        }
      })();
      userInfoPending.set(id, prom);
      return await prom;
    }

    async function enrichOrdersWithUsers(list){
      if(!db) return list;
      const arr = Array.isArray(list) ? list : [];
      const uids = [...new Set(arr.map(o=>String(o.uid||"").trim()).filter(Boolean))];
      // fetch missing uids with a small concurrency limit
      const missing = uids.filter(uid=>!userInfoCache.has(uid));
      const limitN = 10;
      for(let i=0;i<missing.length;i+=limitN){
        const batch = missing.slice(i, i+limitN);
        await Promise.all(batch.map(uid=>getUserInfoByUid(uid)));
      }
      return arr.map(o=>{
        const uid = String(o.uid||"").trim();
        const info = uid ? userInfoCache.get(uid) : null;
        return {
          ...o,
          userPublicId: info?.publicId || (o.numericId || o.userId || uid || ""),
          userPhone: o.userPhone || o.phone || info?.phone || "",
          userName: o.userName || info?.name || ""
        };
      });
    }

    async function enrichTopupReqWithUsers(list){
      const arr = Array.isArray(list) ? list : [];
      const uids = [...new Set(arr.map(r=>String(r.uid||"").trim()).filter(Boolean))];
      const missing = uids.filter(uid=>!userInfoCache.has(uid));
      const limitN = 10;
      for(let i=0;i<missing.length;i+=limitN){
        const batch = missing.slice(i, i+limitN);
        await Promise.all(batch.map(uid=>getUserInfoByUid(uid)));
      }
      return arr.map(r=>{
        const uid = String(r.uid||"").trim();
        const info = uid ? userInfoCache.get(uid) : null;
        return {
          ...r,
          userPublicId: r.userPublicId || info?.publicId || (r.numericId || uid || ""),
          userPhone: r.userPhone || r.phone || info?.phone || "",
          userName: r.userName || info?.name || ""
        };
      });
    }
    async function enrichTurnoverWithUsers(list){
      const arr = Array.isArray(list) ? list : [];
      const uids = [...new Set(arr.map(o=>String(o.uid||"").trim()).filter(Boolean))];
      const missing = uids.filter(uid=>!userInfoCache.has(uid));
      const limitN = 10;
      for(let i=0;i<missing.length;i+=limitN){
        const batch = missing.slice(i, i+limitN);
        await Promise.all(batch.map(uid=>getUserInfoByUid(uid)));
      }
      return arr.map(o=>{
        const uid = String(o.uid||"").trim();
        const info = uid ? userInfoCache.get(uid) : null;
        const publicId = o.userPublicId || o.numericId || (info?.publicId || uid || "");
        const phone = o.userPhone || o.phone || (info?.phone || "");
        const name = o.userName || (info?.name || "");
        return { ...o, userPublicId: publicId, numericId: o.numericId || publicId, userPhone: phone, userName: name };
      });
    }



    let ordersCache = [];

    let ordersById = new Map();
    let orderModalMap = null;
    let orderModalMarker = null;

    function toDate(ts){
      try{
        if(!ts) return null;
        if(ts.toDate) return ts.toDate();
        if(ts.seconds) return new Date(ts.seconds*1000);
        const d = new Date(ts);
        return isNaN(+d) ? null : d;
      }catch(e){ return null; }
    }

    function setIfExists(id, val){
      const el = $(id);
      if(el) el.value = val ?? "";
    }

    function formatProvider(o){
      const p = (o.paymentType||o.provider||"").toLowerCase();
      if(p.includes("cash") || p.includes("naqd")) return "cash";
      if(p.includes("balance")) return "balance";
      return p || "—";
    }

    function providerUZ(p){
      const v = String(p||"").toLowerCase();
      if(v==="cash") return "Naqd";
      if(v==="balance") return "Balans";
      if(v.includes("payme")) return "Payme";
      if(v.includes("click")) return "Click";
      if(v.includes("card")) return "Karta";
      return (p && p!=="—") ? (p.charAt(0).toUpperCase()+p.slice(1)) : "—";
    }


    function moneyUZS(n){
      const x = Number(n || 0);
      return (isFinite(x) ? x : 0).toLocaleString();
    }

    function orderTotal(o){
      const candidates = [o.totalUZS, o.total, o.grandTotal, o.amount, o.sum, o.payableUZS];
      for(const v of candidates){
        const n = Number(v);
        if(isFinite(n) && n > 0) return n;
      }
      if(Array.isArray(o.items)){
        return o.items.reduce((s,it)=>{
          const qty = Number(it.qty ?? it.quantity ?? it.count ?? 1) || 1;
          const price = Number(it.priceUZS ?? it.price ?? it.unitPrice ?? 0) || 0;
          return s + qty * price;
        },0);
      }
      return 0;
    }

    function orderItemsCount(o){
      return Array.isArray(o.items) ? o.items.reduce((s,it)=>s+(Number(it.qty ?? it.quantity ?? it.count ?? 1)||1),0) : 0;
    }

    function orderSubtotal(o){
      if(Array.isArray(o.items)){
        return o.items.reduce((s,it)=>{
          const qty = Number(it.qty ?? it.quantity ?? it.count ?? 1) || 1;
          const price = Number(it.priceUZS ?? it.price ?? it.unitPrice ?? 0) || 0;
          return s + qty * price;
        },0);
      }
      return Number(o.subtotalUZS || o.subtotal || 0) || 0;
    }

    function orderDeliveryFee(o){
      const ship = o.shipping || {};
      const candidates = [ship.price, ship.cost, ship.fee, ship.deliveryPrice, ship.deliveryFee, o.deliveryPrice, o.deliveryFee, o.shippingFee, o.shippingPrice];
      for(const v of candidates){
        const n = Number(v);
        if(isFinite(n) && n > 0) return n;
      }
      return Math.max(0, orderTotal(o) - orderSubtotal(o));
    }

    function orderDiscount(o){
      const candidates = [o.discountUZS, o.discount, o.couponDiscount, o.saleDiscount];
      for(const v of candidates){
        const n = Number(v);
        if(isFinite(n) && n > 0) return n;
      }
      return 0;
    }

    function orderDeliveryMode(o){
      const ship = o.shipping || {};
      const raw = String(ship.provider || ship.type || ship.method || ship.service || o.deliveryProvider || o.deliveryType || o.shippingMethod || "").toLowerCase();
      if(raw.includes("uzpost") || raw.includes("uz post")) return "UzPost";
      if(raw.includes("courier") || raw.includes("kuryer") || raw.includes("kurier")) return "Kuryer";
      if(raw.includes("post") || raw.includes("pochta")) return "Pochta";
      if(raw.includes("pickup") || raw.includes("olib")) return "Olib ketish";
      return raw ? raw.charAt(0).toUpperCase()+raw.slice(1) : "—";
    }

    function orderDistanceText(o){
      const ship = o.shipping || {};
      const km = ship.distanceKm ?? ship.km ?? o.distanceKm ?? o.deliveryKm;
      const n = Number(km);
      return isFinite(n) && n > 0 ? `${n.toFixed(n >= 10 ? 0 : 1)} km` : "";
    }

    function orderAddressText(o){
      const ship = o.shipping || {};
      return String(ship.addressText || o.addressText || o.address || ship.address || "");
    }

    function orderPhoneText(o){
      const ship = o.shipping || {};
      return String(ship.phone || o.phone || o.userPhone || "");
    }

    function orderCustomerName(o){
      return String(o.userName || o.customerName || o.name || "Mijoz");
    }

    function orderInitials(o){
      const source = orderCustomerName(o) || o.userPublicId || o.numericId || o.uid || "OM";
      const parts = String(source).trim().split(/\s+/).filter(Boolean);
      const s = parts.length > 1 ? (parts[0][0]+parts[1][0]) : String(source).slice(0,2);
      return s.toUpperCase();
    }

    function orderShortId(id){
      const s = String(id || "");
      return s.length > 14 ? s.slice(0,7)+"…"+s.slice(-5) : s;
    }

    function orderTimeMs(o){
      const d = toDate(o.createdAt);
      return d ? d.getTime() : 0;
    }

    function renderOrdersMetrics(filtered, all){
      const arr = Array.isArray(filtered) ? filtered : [];
      const full = Array.isArray(all) ? all : [];
      const pending = arr.filter(o=>["pending","pending_payment","pending_cash"].includes(String(o.status||"pending").toLowerCase())).length;
      const paid = arr.filter(o=>["paid","approved","success"].includes(String(o.status||"").toLowerCase())).length;
      const delivered = arr.filter(o=>String(o.status||"").toLowerCase()==="delivered").length;
      const cancelled = arr.filter(o=>["cancelled","canceled","rejected","failed"].includes(String(o.status||"").toLowerCase())).length;
      const revenue = arr.filter(o=>!["cancelled","canceled","rejected","failed"].includes(String(o.status||"").toLowerCase())).reduce((s,o)=>s+orderTotal(o),0);
      const items = arr.reduce((s,o)=>s+orderItemsCount(o),0);
      const avg = arr.length ? Math.round(revenue / arr.length) : 0;
      const set = (id,val)=>{ const el=$(id); if(el) el.textContent=val; };
      set("ordersTotalCount", arr.length.toLocaleString());
      set("ordersAllCount", full.length.toLocaleString());
      set("ordersPendingCount", pending.toLocaleString());
      set("ordersPaidCount", paid.toLocaleString());
      set("ordersDeliveredCount", delivered.toLocaleString());
      set("ordersCancelledCount", cancelled.toLocaleString());
      set("ordersRevenue", moneyUZS(revenue));
      set("ordersItemsCount", items.toLocaleString());
      set("ordersAvgOrder", moneyUZS(avg));
    }

    function getOrderSearchBlob(o){
      const ship = o.shipping || {};
      const addr = ship.addressText || o.addressText || o.address || "";
      const phone = o.phone || ship.phone || o.userPhone || "";
      const pub = o.userPublicId || o.numericId || o.userId || "";
      return [
        o.id, pub, o.uid, o.status, o.provider, o.paymentType, formatProvider(o),
        addr, phone,
        Array.isArray(o.items)? o.items.map(it=>it.name||it.title||it.id).join(" ") : ""
      ].join(" ").toLowerCase();
    }

    function applyOrdersFilters(){
      const q = ($("ordersSearch")?.value || "").trim().toLowerCase();
      const st = ($("ordersStatus")?.value || "").trim();
      const prov = ($("ordersProvider")?.value || "").trim().toLowerCase();
      const fromV = $("ordersFrom")?.value;
      const toV = $("ordersTo")?.value;
      const sort = ($("ordersSort")?.value || "recent").trim();

      const fromD = fromV ? new Date(fromV+"T00:00:00") : null;
      const toD = toV ? new Date(toV+"T23:59:59") : null;

      const out = (ordersCache||[]).filter(o=>{
        if(st && String(o.status||"pending") !== st) return false;
        if(prov){
          const p = formatProvider(o);
          if(p !== prov && !String(p||"").toLowerCase().includes(prov)) return false;
        }
        if(q){
          const blob = getOrderSearchBlob(o);
          if(!blob.includes(q)) return false;
        }
        if(fromD || toD){
          const d = toDate(o.createdAt);
          if(!d) return false;
          if(fromD && d < fromD) return false;
          if(toD && d > toD) return false;
        }
        return true;
      });

      out.sort((a,b)=>{
        if(sort === "oldest") return orderTimeMs(a) - orderTimeMs(b);
        if(sort === "total-desc") return orderTotal(b) - orderTotal(a);
        if(sort === "total-asc") return orderTotal(a) - orderTotal(b);
        if(sort === "items-desc") return orderItemsCount(b) - orderItemsCount(a);
        return orderTimeMs(b) - orderTimeMs(a);
      });

      renderOrdersAdmin(out);
    }

    function kvRow(k,v){
      return `<div class="mini-row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`;
    }
    function statusPill(status){
      const s = String(status||"pending");
      const cls = statusClass3(s);
      return `<span class="status-pill status-${escapeHtml(cls)}">${escapeHtml(statusUZ(s)||s)}</span>`;
    }

    async function openOrderModal(order){
      if(!order) return;
      openModal("orderModal");
      window.__OM_CURRENT_ORDER = order;

      const ship = order.shipping || {};
      const addr = ship.addressText || order.addressText || order.address || "—";
      const phone = ship.phone || order.phone || order.userPhone || "—";
      const lat = ship.lat ?? order.lat ?? ship.latitude ?? null;
      const lng = ship.lng ?? order.lng ?? ship.longitude ?? null;

      $("orderKv").innerHTML = [
        kvRow("ID", order.id||""),
        kvRow("Foydalanuvchi ID", order.userPublicId || order.numericId || order.userId || "—"),
        kvRow("Mijoz", orderCustomerName(order)),
        kvRow("Holat", ""),
        kvRow("To‘lov", providerUZ(formatProvider(order))||"—"),
        kvRow("Mahsulotlar", moneyUZS(orderSubtotal(order))+" so‘m"),
        kvRow("Yetkazish", orderDeliveryFee(order) ? moneyUZS(orderDeliveryFee(order))+" so‘m" : "—"),
        kvRow("Chegirma", orderDiscount(order) ? moneyUZS(orderDiscount(order))+" so‘m" : "—"),
        kvRow("Jami", moneyUZS(orderTotal(order))+" so‘m"),
        kvRow("Vaqt", formatTS(order.createdAt))
      ].join("");
      // inject pill into the Status row (3rd mini-row)
      try{
        const rows = $("orderKv").querySelectorAll(".mini-row");
        if(rows[3]){
          rows[3].querySelector(".v").innerHTML = statusPill(order.status);
        }
      }catch(e){}

      $("shipKv").innerHTML = [
        kvRow("Yetkazish turi", orderDeliveryMode(order)),
        kvRow("Yetkazish narxi", orderDeliveryFee(order) ? moneyUZS(orderDeliveryFee(order))+" so‘m" : "—"),
        kvRow("Masofa", orderDistanceText(order) || "—"),
        kvRow("Manzil", addr),
        kvRow("Telefon", phone),
        kvRow("Koordinata", (lat && lng) ? `${lat}, ${lng}` : "—")
      ].join("");

      // items (cards with image)
      const rawItems = Array.isArray(order.items) ? order.items : [];
      const wrap = $("orderItemsWrap");
      if(!wrap){ return; }

      // Helpers
      const firstInObj = (obj)=>{
        try{
          if(!obj || typeof obj!=="object") return "";
          const k = Object.keys(obj)[0];
          const v = obj[k];
          if(Array.isArray(v)) return String(v[0]||"");
          return String(v||"");
        }catch(_e){ return ""; }
      };
      const getItemImage = (it)=>{ return getItemImageUrl(it) || ""; };
      const getItemTitle = (it)=>{
        return String(it.title || it.name || it.productTitle || it.productName || it.id || it.productId || "");
      };
      const getItemQty = (it)=>{
        return Number(it.qty ?? it.quantity ?? it.count ?? 1) || 1;
      };
      const getItemPrice = (it)=>{
        const p = it.priceUZS ?? it.price ?? it.unitPrice ?? 0;
        const n = Number(p);
        return isFinite(n) ? n : 0;
      };
      const getVariant = (it)=>{
        return [it.color, it.size, it.variant].filter(Boolean).join(" / ") || "—";
      };
      const getPid = (it)=>{
        return String(it.productId || it.pid || it.id || it.product || "");
      };

      // Render skeleton first
      wrap.innerHTML = `<div class="order-items-grid" id="orderItemsGrid"></div>`;
      const grid = $("orderItemsGrid");
      if(!grid){ return; }

      const placeholders = rawItems.map((it, idx)=>{
        const title = escapeHtml(getItemTitle(it) || "Mahsulot");
        const qty = getItemQty(it);
        const price = getItemPrice(it);
        const variant = escapeHtml(getVariant(it));
        const pidRaw = getPid(it) || "—";
        const pid = escapeHtml(pidRaw);

        const img = getItemImage(it);

        return `
          <div class="order-item-card" data-idx="${idx}">
            <img class="order-item-img" src="${img ? escapeHtml(img) : './no-image.png'}" alt="">
            <div class="order-item-info">
              <p class="order-item-title">${title}</p>
              <div class="order-item-meta">
                <span class="order-item-pill order-item-pill-copy" title="ID nusxalash" data-copy="${pid}">ID: <b>${pid}</b></span>
                <span class="order-item-pill">Variant: <b>${variant}</b></span>
                <span class="order-item-pill">Soni: <b>${escapeHtml(String(qty))}</b></span>
                <span class="order-item-pill">Narx: <b>${escapeHtml(price ? price.toLocaleString() : "—")}</b> so‘m</span>
              </div>
            </div>
          </div>
        `;
      }).join("");

      grid.innerHTML = placeholders || `<div class="muted">Mahsulotlar mavjud emas</div>`;
      // Click-to-copy for product ID
      try{
        grid.onclick = (ev)=>{
          const pill = ev.target?.closest?.(".order-item-pill-copy");
          if(!pill) return;
          const v = pill.getAttribute("data-copy") || "";
          if(!v) return;
          navigator.clipboard?.writeText(v).then(()=>{
            pill.classList.add("copied");
            const old = pill.innerHTML;
            pill.innerHTML = `✅ Nusxalandi: <b>${escapeHtml(v)}</b>`;
            setTimeout(()=>{ pill.innerHTML = old; pill.classList.remove("copied"); }, 900);
          }).catch(()=>{});
        };
      }catch(e){}


      // Hydrate missing title/image from products (for old orders)
      try{
        if(db && rawItems.length){
          const tasks = rawItems.map(async (it, idx)=>{
            const needImg = !getItemImage(it);
            const needTitle = !getItemTitle(it);
            if(!needImg && !needTitle) return;

            const pid = getPid(it);
            if(!pid) return;

            const ps = await getDoc(doc(db,"products",pid));
            if(!ps.exists()) return;
            const pd = ps.data() || {};

            const title = needTitle ? String(pd.title || pd.name || "") : "";
            const img = needImg ? String(
              (Array.isArray(pd.images) ? pd.images[0] : "") ||
              (pd.imagesByColor ? firstInObj(pd.imagesByColor) : "") ||
              pd.image || pd.imageUrl || ""
            ) : "";

            const card = grid.querySelector(`.order-item-card[data-idx="${idx}"]`);
            if(!card) return;

            if(title){
              const el = card.querySelector(".order-item-title");
              if(el) el.textContent = title;
            }
            if(img){
              const im = card.querySelector(".order-item-img");
              if(im) im.src = img;
            }
          });

          await Promise.allSettled(tasks);
        }
      }catch(_e){}
// map
      const mapCard = $("mapCard");
      const note = $("mapNote");
      if(lat && lng && window.L){
        note.style.display="none";
        mapCard.style.display="block";
        setTimeout(()=>{
          const center = [Number(lat), Number(lng)];
          if(!orderModalMap){
            orderModalMap = L.map("orderMap",{ zoomControl:true });
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              maxZoom: 19,
              attribution: "&copy; OpenStreetMap"
            }).addTo(orderModalMap);
          }
          orderModalMap.setView(center, 16);
          if(orderModalMarker){ orderModalMarker.remove(); }
          orderModalMarker = L.marker(center).addTo(orderModalMap);
          setTimeout(()=>{ try{ orderModalMap.invalidateSize(); }catch(e){} }, 150);
        }, 50);
      }else{
        // no coords
        if(orderModalMap){
          try{ orderModalMap.invalidateSize(); }catch(e){}
        }
        note.style.display="block";
      }

      // copy
      $("copyOrderBtn").onclick = async ()=>{
        const payload = JSON.stringify(order, null, 2);
        try{ await navigator.clipboard.writeText(payload); toast("Copy qilindi"); }
        catch(e){ toast("Copy bo‘lmadi","error"); }
      };
    }


    function formatTS(ts){
      try{
        if(!ts) return "—";
        const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds*1000) : new Date(ts));
        return d.toLocaleString();
      }catch(e){ return "—"; }
    }

    function renderOrdersAdmin(list){
      ordersById.clear();
      const tbody = $("ordersTbody");
      const cards = $("ordersCards");
      const empty = $("ordersEmpty");
      if(cards) cards.innerHTML = "";
      if(tbody) tbody.innerHTML = "";

      const arr = Array.isArray(list) ? list : [];
      renderOrdersMetrics(arr, ordersCache || []);
      const stateEl = $("ordersState");
      if(stateEl) stateEl.textContent = arr.length ? `${arr.length} ta buyurtma ko‘rsatilmoqda` : "Buyurtma topilmadi";
      if(empty) empty.style.display = arr.length ? "none" : "block";
      setOrdersViewMode(state.ordersViewMode || "cards");

      for(const o of arr){
        const itemsCount = orderItemsCount(o);
        ordersById.set(o.id, o);

        const rawId = o.id || "";
        const oid = escapeHtml(rawId);
        const shortOid = escapeHtml(orderShortId(rawId));
        const uid = escapeHtml(o.uid||"");
        const pubRaw = o.userPublicId || o.numericId || o.userId || o.uid || "";
        const pub = escapeHtml(pubRaw);
        const customer = escapeHtml(orderCustomerName(o));
        const phone = escapeHtml(orderPhoneText(o));
        const addr = escapeHtml(orderAddressText(o));
        const provRaw = formatProvider(o);
        const prov = providerUZ(provRaw);
        const created = escapeHtml(formatTS(o.createdAt));
        const total = orderTotal(o);
        const delivery = orderDeliveryMode(o);
        const distance = orderDistanceText(o);
        const deliveryFee = orderDeliveryFee(o);
        const itemTitles = Array.isArray(o.items) ? o.items.slice(0,3).map(it=>it.title||it.name||it.productTitle||it.productName||it.id||"Mahsulot").join(", ") : "";
        const firstItems = Array.isArray(o.items) ? o.items.slice(0,3) : [];
        const itemDots = firstItems.map((it,idx)=>{
          const img = getItemImageUrl(it);
          if(img) return `<img class="item-dot" src="${escapeHtml(img)}" alt="">`;
          return `<span class="item-dot">${idx+1}</span>`;
        }).join("");
        const moreDot = itemsCount > firstItems.length ? `<span class="item-dot">+${itemsCount-firstItems.length}</span>` : "";
        const statusSelect = `<select class="statusSel order-status-select" data-oid="${oid}" data-uid="${uid}">
          ${["pending","pending_payment","paid","delivered","cancelled"].map(s=>`<option value="${s}" ${String(o.status||"pending")==s?"selected":""}>${statusUZ(s)}</option>`).join("")}
        </select>`;

        if(tbody){
          const tr = document.createElement("tr");
          tr.className = "order-row-premium card-status-"+statusClass3(o.status);
          tr.dataset.oid = rawId;
          tr.innerHTML = `
            <td>
              <div class="order-id-cell">
                <div class="order-id-main"><i class="fas fa-receipt"></i> <span>#${shortOid}</span></div>
                <code title="${oid}">${oid}</code>
              </div>
            </td>
            <td>
              <div class="order-client-cell">
                <div class="client-avatar">${escapeHtml(orderInitials(o))}</div>
                <div class="client-meta">
                  <div class="client-name" title="${customer}">${customer}</div>
                  <div class="client-sub">${pub || "—"}${phone ? " · "+phone : ""}</div>
                </div>
              </div>
            </td>
            <td>${statusSelect}<div class="order-muted-line">${statusPill(o.status)}</div></td>
            <td><div class="order-delivery-pill"><i class="fas fa-wallet"></i> ${escapeHtml(prov||"—")}</div></td>
            <td><div class="order-money">${moneyUZS(total)} so‘m</div><div class="order-muted-line">Yetkazish: ${deliveryFee ? moneyUZS(deliveryFee)+" so‘m" : "—"}</div></td>
            <td><div class="order-delivery-pill" title="${addr}"><i class="fas fa-location-dot"></i> ${escapeHtml(delivery)}</div><div class="order-muted-line">${escapeHtml(distance || (addr ? addr.slice(0,32) : "—"))}</div></td>
            <td><div class="order-items-mini"><div class="item-stack">${itemDots}${moreDot}</div><b>${itemsCount} ta</b></div><div class="order-muted-line" title="${escapeHtml(itemTitles)}">${escapeHtml(itemTitles || "—")}</div></td>
            <td><div class="order-muted-line" style="font-weight:900;color:var(--text)">${created}</div></td>
            <td><button class="btn btn-light btn-sm order-open" type="button"><i class="fas fa-eye"></i></button></td>
          `;
          tbody.appendChild(tr);
        }

        if(cards){
          const card = document.createElement("div");
          card.className = "order-card card-status-"+statusClass3(o.status);
          card.dataset.oid = rawId;
          card.innerHTML = `
            <div class="order-card-top">
              <div class="order-id">
                <div class="k">Buyurtma</div>
                <div class="v"><code title="${oid}">#${shortOid}</code></div>
              </div>
              <div class="order-status-wrap">
                <div class="k">Holat</div>
                ${statusSelect}
              </div>
            </div>

            <div class="order-card-mid">
              <div class="order-chip"><span class="k">Mijoz</span><span class="v" title="${customer}">${customer}</span></div>
              <div class="order-chip"><span class="k">Foydalanuvchi ID</span><span class="v mono truncate" title="${pub}">${pub||"—"}</span></div>
              <div class="order-chip"><span class="k">To‘lov</span><span class="v">${escapeHtml(prov||"—")}</span></div>
              <div class="order-chip"><span class="k">Yetkazish</span><span class="v" title="${addr}">${escapeHtml(delivery)}${distance?" · "+escapeHtml(distance):""}</span></div>
              <div class="order-chip"><span class="k">Tovarlar</span><span class="v">${itemsCount} ta</span></div>
              <div class="order-chip"><span class="k">Vaqt</span><span class="v">${created}</span></div>
            </div>

            <div class="order-card-bottom">
              <div class="order-total">
                <div class="k">Jami summa</div>
                <div class="v">${moneyUZS(total)} <span class="muted">so‘m</span></div>
              </div>
              <div class="order-card-actions">
                <button class="btn btn-light btn-sm order-open" type="button"><i class="fas fa-eye"></i> Batafsil</button>
              </div>
            </div>
          `;
          cards.appendChild(card);
        }
      }
    }


    // Status update (admin)
    $("ordersTbody")?.addEventListener("change", async (e)=>{
      const sel = e.target;
      if(!(sel && sel.classList && sel.classList.contains("statusSel"))) return;
      if(!db){ toast("DB yo‘q"); return; }
      const oid = sel.dataset.oid;
      const uid = sel.dataset.uid;
      const status = sel.value;
      try{
        await updateDoc(doc(db,"orders",oid), { status, updatedAt: serverTimestamp() });
        if(uid){
          await updateDoc(doc(db,"users",uid,"orders",oid), { status, updatedAt: serverTimestamp() });
        }
        toast("Holat yangilandi");
        // Telegram notify (status change) — once per status
        try{
          const orderRef = doc(db,"orders",oid);
          const snap = await getDoc(orderRef);
          const d = snap.exists() ? (snap.data()||{}) : {};
          if(String(d.lastNotifiedStatus||"") !== String(status||"")){
            await updateDoc(orderRef, { lastNotifiedStatus: status, lastNotifiedAt: serverTimestamp() });
            const payload = {
              orderId: oid,
              id: oid,
              uid: d.uid || uid || "",
              numericId: d.numericId || "",
              userName: d.userName || "",
              userPhone: d.userPhone || "",
              userTgChatId: d.userTgChatId || null,
              provider: d.provider || "",
              totalUZS: d.totalUZS || 0,
              status
            };
            const html = tgOrderStatusHTML(payload);
            tgAdminHTML(html);
            if(payload.userTgChatId){
              tgUserHTML(payload.userTgChatId, html);
            }
          }
        }catch(_e){}

      }catch(err){
        console.warn("status update error", err);
        toast("Holat yangilanmadi (rules?)");
      }
    });

    // Status update (cards)
    $("ordersCards")?.addEventListener("change", async (e)=>{
      const sel = e.target;
      if(!(sel && sel.classList && sel.classList.contains("statusSel"))) return;
      if(!db){ toast("DB yo‘q"); return; }
      const oid = sel.dataset.oid;
      const uid = sel.dataset.uid;
      const status = sel.value;
      try{
        await updateDoc(doc(db,"orders",oid), { status, updatedAt: serverTimestamp() });
        if(uid){
          await updateDoc(doc(db,"users",uid,"orders",oid), { status, updatedAt: serverTimestamp() });
        }
        toast("Holat yangilandi");
        // Telegram notify (status change) — once per status
        try{
          const orderRef = doc(db,"orders",oid);
          const snap = await getDoc(orderRef);
          const d = snap.exists() ? (snap.data()||{}) : {};
          if(String(d.lastNotifiedStatus||"") !== String(status||"")){
            await updateDoc(orderRef, { lastNotifiedStatus: status, lastNotifiedAt: serverTimestamp() });
            const payload = {
              orderId: oid,
              id: oid,
              uid: d.uid || uid || "",
              numericId: d.numericId || "",
              userName: d.userName || "",
              userPhone: d.userPhone || "",
              userTgChatId: d.userTgChatId || null,
              provider: d.provider || "",
              totalUZS: d.totalUZS || 0,
              status
            };
            const html = tgOrderStatusHTML(payload);
            tgAdminHTML(html);
            if(payload.userTgChatId){
              tgUserHTML(payload.userTgChatId, html);
            }
          }
        }catch(_e){}
      }catch(err){
        console.warn("status update error", err);
        toast("Holat yangilanmadi (rules?)");
      }
    });


    function subscribeOrdersAdmin(){
      if(!db) return;
      try{ ordersUnsub?.(); }catch(e){}
      $("ordersState").textContent = "Yuklanmoqda...";
      const qy = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200));
      ordersUnsub = onSnapshot(qy, (snap)=>{
        const raw = snap.docs.map(d=>({id:d.id, ...d.data()}));
        (async()=>{
          ordersCache = await enrichOrdersWithUsers(raw);
          applyOrdersFilters();
        })();
      }, (err)=>{
        console.warn("orders admin subscribe error", err);
        $("ordersState").textContent = "Xatolik (index / rules)";
        applyOrdersFilters();
      });
    }

    if($("ordersRefresh")){
      $("ordersRefresh").addEventListener("click", ()=> subscribeOrdersAdmin());
    }

    // Filters
    ["ordersSearch","ordersStatus","ordersProvider","ordersFrom","ordersTo","ordersSort"].forEach(id=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("input", applyOrdersFilters);
      el.addEventListener("change", applyOrdersFilters);
    });
    $("ordersClear")?.addEventListener("click", ()=>{
      setIfExists("ordersSearch","");
      setIfExists("ordersStatus","");
      setIfExists("ordersProvider","");
      setIfExists("ordersFrom","");
      setIfExists("ordersTo","");
      setIfExists("ordersSort","recent");
      applyOrdersFilters();
    });

    function setOrdersViewMode(mode){
      state.ordersViewMode = mode;
      const table = $("ordersTableShell");
      const grid = $("ordersCards");
      const tableBtn = $("ordersTableMode");
      const cardBtn = $("ordersCardMode");
      const isCards = mode === "cards";
      table?.classList.toggle("hidden", isCards);
      grid?.classList.toggle("hidden", !isCards);
      tableBtn?.classList.toggle("active", !isCards);
      cardBtn?.classList.toggle("active", isCards);
    }
    $("ordersTableMode")?.addEventListener("click", ()=>setOrdersViewMode("table"));
    $("ordersCardMode")?.addEventListener("click", ()=>setOrdersViewMode("cards"));

    // Row click => detail modal
    $("ordersTbody")?.addEventListener("click", (e)=>{
      const t = e.target;
      if(t && (t.tagName==="SELECT" || t.closest("select"))) return;
      const tr = t?.closest("tr");
      const oid = tr?.dataset?.oid;
      if(!oid) return;
      const o = ordersById.get(oid);
      openOrderModal(o);
    });

    // Card click => detail modal
    $("ordersCards")?.addEventListener("click", (e)=>{
      const t = e.target;
      if(!t) return;
      if(t && (t.tagName==="SELECT" || t.closest("select"))) return;
      const btn = t.closest(".order-open");
      const card = t.closest(".order-card");
      const oid = card?.dataset?.oid;
      if(!oid) return;
      const o = ordersById.get(oid);
      openOrderModal(o);
    });



// ===== Manual Card Top-up Requests (Admin) =====
let topupReqUnsub = null;
let topupReqCache = [];

function topupTsToMs(ts){
  try{ return ts?.toMillis ? ts.toMillis() : 0; }catch(_e){ return 0; }
}
function topupTimeStr(ts){
  const ms = topupTsToMs(ts);
  return ms ? new Date(ms).toLocaleString() : "—";
}
function topupBadge(status){
  const st = String(status||'pending').toLowerCase();
  const label = statusUZ(st);
  const cls = (st==='approved'||st==='cancelled'||st==='pending') ? st : 'other';
  return `<span class="status-pill status-${cls}">${escapeHtml(label)}</span>`;
}

function renderTopupReq(list){
  const tb = $("topupReqTbody");
  const cards = $("topupReqCards");
  const empty = $("topupReqEmpty");
  if(tb) tb.innerHTML = "";
  if(cards) cards.innerHTML = "";

  const arr = Array.isArray(list) ? list : [];
  $("topupReqState").textContent = arr.length ? `${arr.length} ta so‘rov` : "—";
  if(empty) empty.style.display = arr.length ? "none" : "block";

  for(const r of arr.slice(0,300)){
    const id = String(r.id||'');
    const userId = String(r.userPublicId || r.numericId || r.uid || '—');
    const phone = String(r.userPhone || r.phone || '—');
    const amtNum = Number(r.amountUZS||0);
    const finalNum = Number((r.finalAmountUZS ?? r.finalAmount ?? amtNum) || 0);
    const pctDelta = Number((r.percentDelta ?? r.percentAdded ?? r.percent) || 0);
    const amt = amtNum.toLocaleString() + " so‘m";
    const finalAmt = (Number.isFinite(finalNum) && finalNum>0 ? finalNum : amtNum).toLocaleString() + " so‘m";
    const card = String(r.payerCardMasked || (r.payerCardLast4 ? ('**** '+r.payerCardLast4) : '—'));
    const receiptLink = r.receiptUrl ? r.receiptUrl : "";
    const time = topupTimeStr(r.createdAt);
    const badge = topupBadge(r.status);

    const finalLine = (Number.isFinite(finalNum) && finalNum>0 && finalNum!==amtNum)
      ? ('<div class=\"muted\" style=\"font-size:12px;margin-top:2px\">Yakuniy: <b>' + escapeHtml(finalAmt) + '</b>'
          + (pctDelta ? (' <span class=\"muted\">(' + (pctDelta>0?'+':'') + pctDelta + '%)</span>') : '')
          + '</div>')
      : '';

    // Cards UI
    if(cards){
      const div = document.createElement("div");
      div.className = "order-card topup-card card-status-"+statusClass3(r.status);
      div.dataset.topupId = id;
      div.innerHTML = `
        <div class="order-card-top">
          <div class="order-id">
            <div class="k">So‘rov</div>
            <div class="v"><code>${escapeHtml(id)}</code></div>
          </div>
          <div class="order-status-wrap">
            <div class="k">Holat</div>
            <div class="v">${badge}</div>
          </div>
        </div>

        <div class="order-card-mid">
          <div class="order-chip"><span class="k">Foydalanuvchi ID</span><span class="v"><span class="mono truncate" title="${escapeHtml(userId)}">${escapeHtml(userId)}</span></span></div>
          <div class="order-chip"><span class="k">Telefon</span><span class="v">${escapeHtml(phone)}</span></div>
          <div class="order-chip"><span class="k">Karta</span><span class="v">${escapeHtml(card)}</span></div>
          <div class="order-chip"><span class="k">Vaqt</span><span class="v">${escapeHtml(time)}</span></div>
        </div>

        <div class="order-card-bottom" style="align-items:center">
          <div class="order-total">
            <div class="k">Asosiy</div>
            <div class="v">${escapeHtml(amt)}</div>
            ${finalLine}
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${receiptLink ? `<a class="btn btn-light btn-sm" href="${escapeHtml(receiptLink)}" target="_blank" rel="noopener"><i class="fas fa-receipt"></i> Chek</a>` : `<span class="muted">Chek yo‘q</span>`}
            ${String(r.status||'pending')==='pending' ? `
              <button class="btn btn-success btn-sm" data-topup-act="approve" data-topup-id="${escapeHtml(id)}" title="Tasdiqlash"><i class="fas fa-check"></i></button>
              <button class="btn btn-danger btn-sm" data-topup-act="cancel" data-topup-id="${escapeHtml(id)}" title="Bekor qilish"><i class="fas fa-xmark"></i></button>
            ` : ``}
          </div>
        </div>
      `;
      cards.appendChild(div);
    }

    const finalLineTable = (Number.isFinite(finalNum) && finalNum>0 && finalNum!==amtNum)
      ? ('<div class=\"muted\" style=\"font-size:12px\">Yakuniy: <b>' + escapeHtml(finalAmt) + '</b>'
          + (pctDelta ? (' (' + (pctDelta>0?'+':'') + pctDelta + '%)') : '')
          + '</div>')
      : '';

    // Legacy table
    if(tb){
      const tr = document.createElement('tr');
      const receipt = receiptLink ? `<a href="${escapeHtml(receiptLink)}" target="_blank" rel="noopener">Ochish</a>` : '—';
      let act = '—';
      if(String(r.status||'pending')==='pending'){
        act = `
          <button class="btn btn-sm btn-success" data-topup-act="approve" data-topup-id="${escapeHtml(id)}" title="Tasdiqlash"><i class="fas fa-check"></i></button>
          <button class="btn btn-sm btn-danger" data-topup-act="cancel" data-topup-id="${escapeHtml(id)}" title="Bekor qilish"><i class="fas fa-xmark"></i></button>
        `;
      }
      tr.innerHTML = `
        <td><code>${escapeHtml(id)}</code></td>
        <td>${escapeHtml(userId)}<div class="muted" style="font-size:12px">${escapeHtml(phone)}</div></td>
        <td><b>${escapeHtml(amt)}</b>${finalLineTable}</td>
        <td>${escapeHtml(card)}</td>
        <td>${badge}</td>
        <td>${receipt}</td>
        <td>${escapeHtml(time)}</td>
        <td>${act}</td>
      `;
      tb.appendChild(tr);
    }
  }
}

function applyTopupReqFilters(){
  const q = ($('topupReqSearch')?.value || '').trim().toLowerCase();
  const st = ($('topupReqStatus')?.value || '').trim();
  const fromV = $('topupReqFrom')?.value;
  const toV = $('topupReqTo')?.value;
  const from = fromV ? new Date(fromV+'T00:00:00').getTime() : null;
  const to = toV ? new Date(toV+'T23:59:59').getTime() : null;

  const out = (topupReqCache||[]).filter(r=>{
    if(st && String(r.status||'') !== st) return false;
    if(q){
      const hay = `${r.id||''} ${r.userPublicId||''} ${r.numericId||''} ${r.userPhone||''} ${r.phone||''} ${r.payerCardLast4||''}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(from || to){
      const ms = topupTsToMs(r.createdAt);
      if(ms){
        if(from && ms < from) return false;
        if(to && ms > to) return false;
      }
    }
    return true;
  });
  renderTopupReq(out);
}

function subscribeTopupReq(){
  if(!db) return;
  try{ topupReqUnsub?.(); }catch(_e){}
  $('topupReqState').textContent = 'Yuklanmoqda...';
  const qy = query(collection(db,'topup_requests'), orderBy('createdAt','desc'), limit(200));
  topupReqUnsub = onSnapshot(qy, (snap)=>{
    const raw = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    (async()=>{
      topupReqCache = await enrichTopupReqWithUsers(raw);
      applyTopupReqFilters();
    })();
  }, (err)=>{
    console.warn('topup_requests subscribe error', err);
    $('topupReqState').textContent = 'Xatolik (rules/index)';
  });
}

async function approveTopup(id){
  const reqRef = doc(db,'topup_requests', id);

  // Fetch request (queries not allowed inside tx)
  const snap = await getDoc(reqRef);
  if(!snap.exists()) throw new Error('not_found');
  const r0 = snap.data() || {};
  const status0 = String(r0.status || 'pending').toLowerCase();
  if(status0 === 'approved' || status0 === 'rejected' || status0 === 'cancelled') throw new Error('already_done');

  const baseAmt = Number(r0.amountUZS ?? r0.amount ?? 0);
  if(!Number.isFinite(baseAmt) || baseAmt <= 0) throw new Error('bad_amount');

  // --- Admin edit dialog (manual OR +/- percent) ---
  const decision = await new Promise((resolve, reject)=>{
    const baseLabel = (Number(baseAmt)||0).toLocaleString() + " so‘m";
    const currentFinal = Number(r0.finalAmountUZS ?? baseAmt);
    const currentPercent = Number(r0.percentDelta ?? r0.percentAdded ?? 0) || 0;
    const currentNote = String(r0.adminNote || "");

    const html = `
      <div class="grid2">
        <div class="mini-card">
          <div class="mini-title">Asosiy summa</div>
          <div style="font-weight:900;font-size:20px">${escapeHtml(baseLabel)}</div>
          <div class="muted" style="margin-top:6px">Bu summa foydalanuvchi tomonidan kiritilgan. Siz yakuniy summani tasdiqlashdan oldin tahrirlashingiz mumkin.</div>
        </div>

        <div class="mini-card">
          <div class="mini-title">Yakuniy summa (tasdiqlanadi)</div>
          <div style="font-weight:900;font-size:20px" id="topupFinalPreview">${escapeHtml((Number(currentFinal)||0).toLocaleString())} so‘m</div>
          <div class="muted" style="margin-top:6px">Yakuniy summa balansga qo‘shiladi.</div>
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="mini-card">
        <div class="mini-title">Tahrirlash usuli</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">
          <label class="pill" style="background:#eef2ff;color:#1d4ed8;cursor:pointer">
            <input type="radio" name="topupMode" value="percent" style="margin-right:8px" checked>
            Foiz qo‘shish/ayirish
          </label>
          <label class="pill" style="background:#f1f5f9;color:#0f172a;cursor:pointer">
            <input type="radio" name="topupMode" value="manual" style="margin-right:8px">
            Summani qo‘lda kiritish
          </label>
        </div>

        <div class="form-row" style="margin-top:14px">
          <div class="form-group" style="min-width:220px">
            <label>Foiz (− bo‘lishi ham mumkin)</label>
            <input id="topupPercent" class="form-control" type="number" step="0.01" value="${escapeHtml(String(currentPercent))}" placeholder="Masalan: -3 yoki 5">
            <div class="form-text">Misol: <b>-3</b> kiritsangiz 3% kamayadi, <b>5</b> kiritsangiz 5% qo‘shiladi.</div>
          </div>

          <div class="form-group" style="min-width:220px">
            <label>Qo‘lda yakuniy summa</label>
            <input id="topupManualFinal" class="form-control" type="number" step="1" value="" placeholder="Masalan: 105000">
            <div class="form-text">Faqat “Summani qo‘lda kiritish” tanlansa ishlaydi.</div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="min-width:260px">
            <label>Izoh (ixtiyoriy)</label>
            <input id="topupAdminNote" class="form-control" value="${escapeHtml(currentNote)}" placeholder="Masalan: 3% komissiya / bonus">
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px">
          <button class="btn btn-light" id="topupCancelBtn"><i class="fas fa-times"></i> Bekor qilish</button>
          <button class="btn btn-light" id="topupSaveOnlyBtn" title="Tasdiqlamasdan saqlash"><i class="fas fa-floppy-disk"></i> Saqlash</button>
          <button class="btn btn-primary" id="topupApproveBtn"><i class="fas fa-check"></i> Tasdiqlash</button>
        </div>
      </div>
    `;

    // mount modal
    const wrap = document.createElement("div");
    wrap.style.position="fixed";
    wrap.style.inset="0";
    wrap.style.background="rgba(0,0,0,.45)";
    wrap.style.display="flex";
    wrap.style.alignItems="center";
    wrap.style.justifyContent="center";
    wrap.style.zIndex="9999";
    wrap.innerHTML = `
      <div style="width:min(900px,92vw);max-height:88vh;background:#fff;border-radius:16px;box-shadow:0 20px 80px rgba(0,0,0,.25);overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.08)">
          <div style="font-weight:900">Top-up tasdiqlash (tahrirlash bilan)</div>
          <button class="btn btn-light btn-sm" data-x><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:14px;overflow:auto;max-height:78vh">${html}</div>
      </div>
    `;
    function close(){ wrap.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e){ if(e.key==="Escape") { close(); reject(new Error("cancelled")); } }
    wrap.addEventListener("click",(e)=>{ if(e.target===wrap) { close(); reject(new Error("cancelled")); }});
    wrap.querySelector("[data-x]")?.addEventListener("click", ()=>{ close(); reject(new Error("cancelled")); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);

    const $m = (sel)=>wrap.querySelector(sel);

    const preview = $m("#topupFinalPreview");
    const percentEl = $m("#topupPercent");
    const manualEl = $m("#topupManualFinal");

    function getMode(){
      return ($m('input[name="topupMode"]:checked')?.value || "percent");
    }
    function computeFinal(){
      const mode = getMode();
      let percent = Number(percentEl.value || 0);
      if(!Number.isFinite(percent)) percent = 0;

      if(mode === "manual"){
        const mf = Number(manualEl.value || 0);
        if(!Number.isFinite(mf) || mf <= 0) return { ok:false, final:0, percentDelta: null, mode };
        return { ok:true, final: Math.round(mf), percentDelta: null, mode };
      }else{
        // percent mode
        // clamp to avoid crazy values
        if(percent > 200) percent = 200;
        if(percent < -200) percent = -200;
        const final = Math.round(baseAmt + (baseAmt * percent / 100));
        if(!Number.isFinite(final) || final <= 0) return { ok:false, final:0, percentDelta: percent, mode };
        return { ok:true, final, percentDelta: percent, mode };
      }
    }
    function updatePreview(){
      const r = computeFinal();
      preview.textContent = r.ok ? (Number(r.final).toLocaleString() + " so‘m") : "—";
    }
    ["input","change"].forEach(ev=>{
      percentEl.addEventListener(ev, updatePreview);
      manualEl.addEventListener(ev, updatePreview);
      wrap.querySelectorAll('input[name="topupMode"]').forEach(r=>r.addEventListener(ev, updatePreview));
    });
    updatePreview();

    $m("#topupCancelBtn")?.addEventListener("click", ()=>{ close(); reject(new Error("cancelled")); });

    function packDecision(type){
      const mode = getMode();
      const calc = computeFinal();
      if(!calc.ok) { toast("Yakuniy summa noto‘g‘ri", "error"); return; }
      const note = String($m("#topupAdminNote")?.value || "").trim();
      close();
      resolve({ type, mode, baseAmt, finalAmt: calc.final, percentDelta: calc.percentDelta, note });
    }

    $m("#topupSaveOnlyBtn")?.addEventListener("click", ()=> packDecision("save"));
    $m("#topupApproveBtn")?.addEventListener("click", ()=> packDecision("approve"));
  });

  // Resolve uid OUTSIDE transaction (queries not allowed inside tx)
  let uid = r0.uid || null;

  // numericId -> users_by_numeric/{numericId} -> {uid}
  if(!uid && r0.numericId){
    const mapRef = doc(db,'users_by_numeric', String(r0.numericId));
    const mapSnap = await getDoc(mapRef);
    if(mapSnap.exists() && mapSnap.data() && mapSnap.data().uid){
      uid = mapSnap.data().uid;
    }
  }

  // payerFirst as email -> users where email == payerFirst
  if(!uid && r0.payerFirst && String(r0.payerFirst).includes('@')){
    const qy = query(collection(db,'users'), where('email','==', String(r0.payerFirst)), limit(1));
    const qs = await getDocs(qy);
    if(!qs.empty){
      uid = qs.docs[0].id;
    }
  }

  if(!uid) throw new Error('missing_uid');

  // Save-only (no balance change)
  if(decision.type === "save"){
    await setDoc(reqRef, {
      uid: uid, // normalize
      baseAmountUZS: decision.baseAmt,
      finalAmountUZS: decision.finalAmt,
      percentDelta: (decision.mode==="percent" ? (Number(decision.percentDelta)||0) : null),
      adminNote: decision.note || "",
      editedAt: serverTimestamp(),
      editedBy: (auth.currentUser?.email || null),
      updatedAt: serverTimestamp()
    }, { merge:true });
    return;
  }

  // Approve (transaction + balance change)
  await runTransaction(db, async (tx)=>{
    const rs = await tx.get(reqRef);
    if(!rs.exists()) throw new Error('not_found');
    const r = rs.data() || {};
    const status = String(r.status || 'pending').toLowerCase();
    if(status !== 'pending') throw new Error('already_done');

    const uref = doc(db,'users', uid);
    const us = await tx.get(uref);
    if(!us.exists()) throw new Error('user_not_found');

    const u = us.data() || {};
    const bal = Number(u.balanceUZS || 0) || 0;

    const finalAmt = Number(decision.finalAmt||0);
    if(!Number.isFinite(finalAmt) || finalAmt <= 0) throw new Error('bad_final_amount');

    tx.set(uref, { balanceUZS: bal + finalAmt, updatedAt: serverTimestamp() }, { merge:true });

    tx.set(reqRef, {
      status:'approved',
      uid: uid, // normalize for future reads
      baseAmountUZS: decision.baseAmt,
      finalAmountUZS: finalAmt,
      percentDelta: (decision.mode==="percent" ? (Number(decision.percentDelta)||0) : null),
      adminNote: (decision.note||'').trim(),
      approvedAt: serverTimestamp(),
      approvedBy: (auth.currentUser?.email || null),
      updatedAt: serverTimestamp()
    }, { merge:true });
  });
}



async function cancelTopup(id){
  const note = prompt('Rad etish izohi (majburiy emas)') || '';
  const reqRef = doc(db,'topup_requests', id);
  await runTransaction(db, async (tx)=>{
    const rs = await tx.get(reqRef);
    if(!rs.exists()) throw new Error('not_found');
    const r = rs.data() || {};
    const status = String(r.status||'pending').toLowerCase();
    if(status !== 'pending') throw new Error('already_done');
    tx.set(reqRef, {
      status:'rejected',
      adminNote: (note||'').trim(),
      rejectedAt: serverTimestamp(),
      rejectedBy: (auth.currentUser?.email || null),
      updatedAt: serverTimestamp()
    }, { merge:true });
  });
}


// Topup UI hooks
$("topupReqRefresh")?.addEventListener('click', ()=> subscribeTopupReq());
['topupReqSearch','topupReqStatus','topupReqFrom','topupReqTo'].forEach(id=>{
  const el = $(id);
  if(!el) return;
  el.addEventListener('input', applyTopupReqFilters);
  el.addEventListener('change', applyTopupReqFilters);
});
$("topupReqClear")?.addEventListener('click', ()=>{
  setIfExists('topupReqSearch','');
  setIfExists('topupReqStatus','');
  setIfExists('topupReqFrom','');
  setIfExists('topupReqTo','');
  applyTopupReqFilters();
});

document.addEventListener('click', async (e)=>{
  const btn = e.target?.closest?.('button[data-topup-act]');
  if(!btn) return;
  const act = btn.getAttribute('data-topup-act');
  const id = btn.getAttribute('data-topup-id');
  if(!act || !id) return;
  btn.disabled = true;
  try{
    if(act==='approve') await approveTopup(id);
    if(act==='cancel') await cancelTopup(id);
    toast('OK');
  }catch(err){
    console.warn('topup action failed', err);
    toast('Xatolik');
  }finally{
    btn.disabled = false;
  }
});

    // close order modal
    ["closeOrderModalBtn","closeOrderModalBtn2"].forEach(id=>{
      $(id)?.addEventListener("click", ()=> closeModal("orderModal"));
    });



    // === Chek / Stiker (print) ===
    function normMoney(n){
      const x = Number(n||0);
      return x.toLocaleString('uz-UZ') + " so‘m";
    }
    function safe(v){ return (v===undefined||v===null) ? "" : String(v); }

    function buildReceiptHTML(order, mode){
      const isA6 = mode === "a6";
      const ship = order.shipping || {};
      const addr = ship.addressText || order.addressText || order.address || "—";
      const phone = ship.phone || order.phone || order.userPhone || "—";
      const customer = order.customerName || order.fullName || order.name || order.userName || "—";
      const provider = providerUZ(formatProvider(order)) || "—";
      const status = safe(order.status||"pending");
      const created = formatTS(order.createdAt);
      const publicId = order.userPublicId || order.numericId || order.userId || "—";

      const items = Array.isArray(order.items) ? order.items : [];
      const rows = items.map(it=>{
        const title = safe(it.title || it.name || it.productTitle || "Mahsulot");
        const qty = Number(it.qty || it.quantity || 1);
        const price = Number(it.priceUZS || it.price || it.unitPriceUZS || 0);
        const line = qty * price;
        return { title, qty, price, line };
      });

      const subtotal = rows.reduce((a,b)=>a+b.line,0);
      const delivery = Number(order.deliveryUZS || order.shippingUZS || order.deliveryFeeUZS || 0);
      const discount = Number(order.discountUZS || 0);
      const total = Number(order.totalUZS || (subtotal + delivery - discount));

      const orderId = safe(order.id||"");
      const qrData = encodeURIComponent("OrzuMall Order: " + orderId);

      const socials = [
        { label:"Web", value:"xplusy.netlify.app" },
        { label:"Telegram", value:"@OrzuMallUZ_bot" },
        { label:"Instagram", value:"@orzu.mall" }
      ];

      const css = `
        :root{ --ink:#111; --muted:#666; --line:#e5e7eb; --brand:#2E8B57; }
        *{ box-sizing:border-box; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
        body{ margin:0; padding:${isA6? "10mm":"6mm"}; color:var(--ink); }
        .paper{ width:${isA6? "105mm":"80mm"}; margin:0 auto; }
        .top{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .logo{
          font-weight:900; letter-spacing:.5px; font-size:${isA6? "20px":"18px"};
          color:var(--brand);
        }
        .tag{ font-size:12px; color:var(--muted); }
        .hr{ height:1px; background:var(--line); margin:10px 0; }
        .kv{ display:grid; grid-template-columns: 1fr 1fr; gap:6px 10px; font-size:12px; }
        .kv .k{ color:var(--muted); }
        .kv .v{ text-align:right; font-weight:600; }
        .items{ width:100%; border-collapse:collapse; font-size:12px; }
        .items th{ text-align:left; color:var(--muted); font-weight:700; padding:6px 0; border-bottom:1px solid var(--line); }
        .items td{ padding:6px 0; border-bottom:1px dashed var(--line); vertical-align:top; }
        .items td.r{ text-align:right; white-space:nowrap; }
        .sum{ font-size:12px; }
        .sum .row{ display:flex; justify-content:space-between; padding:4px 0; }
        .sum .row.total{ font-size:14px; font-weight:900; }
        .badge{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid var(--line); border-radius:10px; font-size:12px; }
        .footer{ margin-top:10px; display:flex; align-items:flex-end; justify-content:space-between; gap:10px; }
        .social{ font-size:11px; color:var(--muted); line-height:1.35; }
        .qr{ width:${isA6? "120px":"105px"}; height:${isA6? "120px":"105px"}; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
        .qr img{ width:100%; height:100%; object-fit:cover; display:block; }
        .note{ margin-top:8px; font-size:11px; color:var(--muted); }
        @media print{
          body{ padding:0; }
          .paper{ margin:0; }
        }
      `;

      const itemsHtml = rows.map(r=>`
        <tr>
          <td>
            <div style="font-weight:800">${escapeHtml(r.title)}</div>
            <div style="color:#666;font-size:11px">${r.qty} × ${normMoney(r.price)}</div>
          </td>
          <td class="r" style="font-weight:900">${normMoney(r.line)}</td>
        </tr>
      `).join("");

      const socialsHtml = socials.map(s=>`${escapeHtml(s.label)}: <b>${escapeHtml(s.value)}</b>`).join("<br>");

      return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chek ${orderId}</title>
<style>${css}</style>

</head>
<body>
  <div class="paper">
    <div class="top">
      <div>
        <div class="logo">OrzuMall</div>
        <div class="tag">Buyurtma cheki / stiker</div>
      </div>
      <div class="badge"><span style="width:8px;height:8px;border-radius:999px;background:var(--brand);display:inline-block"></span> ${escapeHtml(status)}</div>
    </div>

    <div class="hr"></div>

    <div class="kv">
      <div class="k">Buyurtma ID</div><div class="v">${escapeHtml(orderId)}</div>
      <div class="k">Vaqt</div><div class="v">${escapeHtml(created)}</div>
      <div class="k">To‘lov</div><div class="v">${escapeHtml(provider)}</div>
      <div class="k">Foydalanuvchi</div><div class="v">${escapeHtml(publicId)}</div>
    </div>

    <div class="hr"></div>

    <div class="kv">
      <div class="k">Mijoz</div><div class="v">${escapeHtml(customer)}</div>
      <div class="k">Telefon</div><div class="v">${escapeHtml(phone)}</div>
      <div class="k">Manzil</div><div class="v">${escapeHtml(addr)}</div>
    </div>

    <div class="hr"></div>

    <table class="items">
      <thead><tr><th>Mahsulot</th><th class="r">Jami</th></tr></thead>
      <tbody>${itemsHtml || `<tr><td colspan="2" style="color:#666">Mahsulotlar topilmadi</td></tr>`}</tbody>
    </table>

    <div class="hr"></div>

    <div class="sum">
      <div class="row"><span>Mahsulotlar</span><b>${normMoney(subtotal)}</b></div>
      ${delivery ? `<div class="row"><span>Yetkazib berish</span><b>${normMoney(delivery)}</b></div>` : ``}
      ${discount ? `<div class="row"><span>Chegirma</span><b>- ${normMoney(discount)}</b></div>` : ``}
      <div class="row total"><span>JAMI</span><span>${normMoney(total)}</span></div>
    </div>

    <div class="footer">
      <div class="social">
        <div style="font-weight:800;color:#111;margin-bottom:4px">Biz bilan bog‘laning</div>
        ${socialsHtml}
        <div class="note">Buyurtma bo‘yicha savol bo‘lsa, ID ni ayting.</div>
      </div>
      <div class="qr">
        <img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}">
      </div>
    </div>
  </div>
  <script>
    // Auto-print after render
    setTimeout(()=>{ window.focus(); window.print(); }, 200);
  <\/script>
</body></html>`;
    }

    function printOrder(mode){
      const order = window.__OM_CURRENT_ORDER;
      if(!order){ toast("Buyurtma tanlanmadi"); return; }
      const w = window.open("", "_blank");
      if(!w){ toast("Pop-up bloklangan"); return; }
      w.document.open();
      w.document.write(buildReceiptHTML(order, mode));
      w.document.close();
    }

    document.getElementById("printReceipt80Btn")?.addEventListener("click", ()=> printOrder("80"));
    document.getElementById("printStickerA6Btn")?.addEventListener("click", ()=> printOrder("a6"));



  try{ document.getElementById("copyUidBtn")?.addEventListener("click", async ()=>{
        const uid = auth.currentUser?.uid;
        if(!uid) return toast("UID topilmadi","error");
        try{ await navigator.clipboard.writeText(uid); toast("UID nusxa olindi"); }
        catch(e){ console.warn(e); toast("Nusxa olishni brauzer blokladi","error"); }
      }); }catch(e){}

  try{ document.getElementById("saveSettingsBtn")?.addEventListener("click", saveAccessLists); }catch(e){}


/* === OrzuMall Admin v8: Click balance override + safe action controls === */
(()=>{
  let clickOrdersUnsubV8 = null;
  let manualRawV8 = [];
  let clickRawV8 = [];
  const val = (id)=>($(id)?.value || '').trim();
  const ms = (ts)=>{ try{ if(!ts) return 0; if(ts.toMillis) return ts.toMillis(); if(ts.toDate) return ts.toDate().getTime(); if(ts.seconds) return Number(ts.seconds)*1000; if(typeof ts==='number') return ts>9999999999?ts:ts*1000; const d=new Date(ts); return isNaN(+d)?0:d.getTime(); }catch(e){ return 0; } };
  const time = (ts)=>{ const n=ms(ts); return n?new Date(n).toLocaleString():'—'; };
  const providerKey = (r)=>{ const p=String(r?.provider||r?.paymentProvider||r?.paymentType||r?.gateway||r?.method||r?.paymentMethod||'').toLowerCase(); const hasClick=!!(r?.click_trans_id||r?.clickTransId||r?.click_paydoc_id||r?.clickPaydocId||r?.merchant_trans_id||r?.merchantTransId||r?.service_id||r?.serviceId); if(p.includes('click')||hasClick) return 'click'; if(p.includes('payme')||p.includes('paycom')||r?.paymeId||r?.paycomId) return 'payme'; if(p.includes('card')||p.includes('manual')||p.includes('karta')||p.includes('transfer')) return 'manual'; return r?.__src==='orders'?(p||'click'):'manual'; };
  const providerLabel = (k)=>k==='click'?'Click':(k==='payme'?'Payme':'Qo‘lda');
  const statusKey = (r)=>{ const st=String(r?.status||r?.paymentStatus||r?.state||'pending').toLowerCase(); if(['paid','success','successful','completed','confirmed','done'].includes(st)) return 'paid'; if(['approved','accepted'].includes(st)) return 'approved'; if(['pending_payment','waiting','wait','created','new','processing','pending'].includes(st)) return 'pending'; if(['rejected','reject','declined','failed'].includes(st)) return 'rejected'; if(['cancelled','canceled','cancel'].includes(st)) return 'cancelled'; if(['error','timeout'].includes(st)) return 'error'; return st||'pending'; };
  const statusLabel = (k)=>({paid:'To‘langan',approved:'Tasdiqlangan',pending:'Kutilmoqda',rejected:'Rad etilgan',cancelled:'Bekor qilingan',error:'Xatolik'}[k] || statusUZ(k) || k);
  const amountBase = (r)=>Number(r?.amountUZS ?? r?.amount ?? r?.summa ?? r?.price ?? r?.total ?? r?.totalUZS ?? 0)||0;
  const amountFinal = (r)=>Number(r?.finalAmountUZS ?? r?.finalAmount ?? r?.creditedAmountUZS ?? r?.creditAmountUZS ?? r?.totalUZS ?? r?.amountUZS ?? r?.amount ?? 0)||0;
  const clickRef = (r)=>String(r?.click_paydoc_id||r?.clickPaydocId||r?.click_trans_id||r?.clickTransId||r?.payment_id||r?.paymentId||r?.merchant_trans_id||r?.merchantTransId||r?.orderId||r?.id||'—');
  const merchantRef = (r)=>String(r?.merchant_trans_id||r?.merchantTransId||r?.merchant_prepare_id||r?.merchantPrepareId||r?.merchant_confirm_id||r?.merchantConfirmId||r?.orderId||'—');
  const receipt = (r)=>String(r?.receiptUrl||r?.receipt_url||r?.checkUrl||r?.chequeUrl||r?.payLink||r?.paymentUrl||'');
  const cardMasked = (r)=>String(r?.payerCardMasked||r?.cardMasked||(r?.payerCardLast4?('**** '+r.payerCardLast4):(r?.cardLast4?('**** '+r.cardLast4):'—')));
  const badge = (r)=>{ const k=statusKey(r); return `<span class="status-pill status-${escapeHtml(k)}">${escapeHtml(statusLabel(k))}</span>`; };
  const merged = ()=>{
    const manual=(manualRawV8||[]).map(r=>({...r,__src:'topup_requests'}));
    const click=(clickRawV8||[]).filter(o=>{ const p=providerKey(o); const t=String(o?.orderType||o?.type||'').toLowerCase(); return p==='click'||p==='payme'||t==='topup'||t.includes('balance'); }).map(o=>({...o,__src:'orders',id:o.id||o.orderId,amountUZS:o.amountUZS??o.amount??o.totalUZS,finalAmountUZS:o.finalAmountUZS??o.creditedAmountUZS??o.totalUZS??o.amountUZS??o.amount,provider:o.provider||o.paymentProvider||o.paymentType||'click'}));
    const seen=new Set();
    return [...manual,...click].filter(r=>{ const key=`${providerKey(r)}::${r.__src||''}::${r.id||r.orderId||clickRef(r)}`; if(seen.has(key)) return false; seen.add(key); return true; }).sort((a,b)=>Math.max(ms(b.createdAt),ms(b.paidAt),ms(b.updatedAt))-Math.max(ms(a.createdAt),ms(a.paidAt),ms(a.updatedAt)));
  };
  const updateStats=(arr)=>{ let total=0,click=0,pending=0; (arr||[]).forEach(r=>{ const st=statusKey(r), p=providerKey(r), a=amountFinal(r)||amountBase(r); if(st==='paid'||st==='approved'){ total+=a; if(p==='click') click+=a; } if(st==='pending') pending++; }); if($('topupTotalPaid')) $('topupTotalPaid').textContent=total.toLocaleString(); if($('topupClickAmount')) $('topupClickAmount').textContent=click.toLocaleString(); if($('topupPendingCount')) $('topupPendingCount').textContent=String(pending); if($('topupReqCount')) $('topupReqCount').textContent=String((arr||[]).length); };
  renderTopupReq = function(list){
    const cards=$('topupReqCards'), empty=$('topupReqEmpty'); if(cards) cards.innerHTML=''; const arr=Array.isArray(list)?list:[]; if($('topupReqState')) $('topupReqState').textContent=arr.length?`${arr.length} ta yozuv`:'—'; if(empty) empty.style.display=arr.length?'none':'block'; updateStats(arr);
    for(const r of arr.slice(0,300)){
      const id=String(r.id||r.orderId||clickRef(r)||''), p=providerKey(r), st=statusKey(r), userId=String(r.userPublicId||r.numericId||r.uid||'—'), phone=String(r.userPhone||r.phone||r.userPhoneNumber||'—'), userName=String(r.userName||r.name||'—');
      const base=amountBase(r), final=amountFinal(r)||base, baseText=base.toLocaleString()+" so‘m", finalText=final.toLocaleString()+" so‘m"; const rec=receipt(r), cref=clickRef(r), mref=merchantRef(r), note=String(r.adminNote||r.error_note||r.errorNote||r.message||''); const canAct=(r.__src==='topup_requests')&&st==='pending'&&p!=='click';
      const div=document.createElement('div'); div.className=`topup-card-v8 ${p} ${st}`; div.dataset.topupId=id;
      div.innerHTML=`<div class="topup-card-head"><div class="topup-ref"><div class="k">${p==='click'?'Click tranzaksiya':'Balans so‘rovi'}</div><div class="v" title="${escapeHtml(cref)}">${escapeHtml(cref)}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px"><span class="gateway-pill gateway-${escapeHtml(p)}"><i class="fas ${p==='click'?'fa-bolt':(p==='payme'?'fa-credit-card':'fa-user-check')}"></i> ${escapeHtml(providerLabel(p))}</span>${badge(r)}</div></div><div class="topup-card-body"><div class="topup-mini"><span class="k">Foydalanuvchi</span><span class="v" title="${escapeHtml(userName)}">${escapeHtml(userName)}</span></div><div class="topup-mini"><span class="k">User ID</span><span class="v" title="${escapeHtml(userId)}">${escapeHtml(userId)}</span></div><div class="topup-mini"><span class="k">Telefon</span><span class="v">${escapeHtml(phone)}</span></div><div class="topup-mini"><span class="k">Karta</span><span class="v">${escapeHtml(cardMasked(r))}</span></div><div class="topup-mini"><span class="k">Merchant ID</span><span class="v" title="${escapeHtml(mref)}">${escapeHtml(mref)}</span></div><div class="topup-mini"><span class="k">Vaqt</span><span class="v">${escapeHtml(time(r.paidAt||r.confirmedAt||r.updatedAt||r.createdAt))}</span></div>${note?`<div class="topup-mini" style="grid-column:1/-1"><span class="k">Izoh / xabar</span><span class="v" title="${escapeHtml(note)}">${escapeHtml(note)}</span></div>`:''}</div><div class="topup-card-foot"><div class="topup-total"><div class="k">Summa</div><div class="v">${escapeHtml(baseText)}</div>${final&&base&&final!==base?`<div class="topup-final-note">Balansga: <b>${escapeHtml(finalText)}</b></div>`:''}</div><div class="topup-actions">${rec?`<a class="btn btn-light btn-sm" href="${escapeHtml(rec)}" target="_blank" rel="noopener"><i class="fas fa-receipt"></i> Chek</a>`:''}${canAct?`<button class="btn btn-success btn-sm" data-topup-act="approve" data-topup-id="${escapeHtml(id)}"><i class="fas fa-check"></i> Tasdiqlash</button><button class="btn btn-danger btn-sm" data-topup-act="cancel" data-topup-id="${escapeHtml(id)}"><i class="fas fa-xmark"></i> Rad etish</button>`:''}${!canAct&&!rec?`<span class="muted" style="font-weight:800">Avto nazorat</span>`:''}</div></div>`;
      cards?.appendChild(div);
    }
  };
  applyTopupReqFilters = function(){
    const q=val('topupReqSearch').toLowerCase(), st=val('topupReqStatus'), prov=val('topupReqProvider'), fromV=val('topupReqFrom'), toV=val('topupReqTo'); const from=fromV?new Date(fromV+'T00:00:00').getTime():null, to=toV?new Date(toV+'T23:59:59').getTime():null;
    const out=(topupReqCache||[]).filter(r=>{ if(prov&&providerKey(r)!==prov) return false; if(st&&statusKey(r)!==st) return false; if(q){ const hay=[r.id,r.orderId,r.uid,r.userPublicId,r.numericId,r.userName,r.userPhone,r.phone,r.payerCardLast4,r.cardLast4,r.payerCardMasked,r.cardMasked,clickRef(r),merchantRef(r),r.error_note,r.errorNote,r.adminNote].map(x=>String(x||'').toLowerCase()).join(' '); if(!hay.includes(q)) return false; } if(from||to){ const n=Math.max(ms(r.createdAt),ms(r.paidAt),ms(r.updatedAt)); if(n){ if(from&&n<from) return false; if(to&&n>to) return false; } } return true; }); renderTopupReq(out);
  };
  async function refreshMerged(){ const m=merged(); try{ topupReqCache=await enrichTopupReqWithUsers(m); }catch(e){ topupReqCache=m; } applyTopupReqFilters(); }
  subscribeTopupReq = function(){
    if(!db) return; try{ topupReqUnsub?.(); }catch(e){} try{ clickOrdersUnsubV8?.(); }catch(e){} if($('topupReqState')) $('topupReqState').textContent='Yuklanmoqda...';
    topupReqUnsub=onSnapshot(query(collection(db,'topup_requests'),orderBy('createdAt','desc'),limit(250)),snap=>{ manualRawV8=snap.docs.map(d=>({id:d.id,...d.data(),__src:'topup_requests'})); refreshMerged(); },err=>{ console.warn('topup_requests subscribe error',err); manualRawV8=[]; refreshMerged(); });
    clickOrdersUnsubV8=onSnapshot(query(collection(db,'orders'),orderBy('createdAt','desc'),limit(500)),snap=>{ clickRawV8=snap.docs.map(d=>({id:d.id,...d.data(),__src:'orders'})); refreshMerged(); },err=>{ console.warn('orders click/topup subscribe error',err); clickRawV8=[]; refreshMerged(); });
  };
  setTimeout(()=>{
    $('topupReqRefresh')?.addEventListener('click',()=>subscribeTopupReq()); $('topupReqRefreshInline')?.addEventListener('click',()=>subscribeTopupReq());
    ['topupReqSearch','topupReqProvider','topupReqStatus','topupReqFrom','topupReqTo'].forEach(id=>{ const el=$(id); if(!el) return; el.addEventListener('input',applyTopupReqFilters); el.addEventListener('change',applyTopupReqFilters); });
    $('topupReqClear')?.addEventListener('click',()=>{ setIfExists('topupReqSearch',''); setIfExists('topupReqProvider',''); setIfExists('topupReqStatus',''); setIfExists('topupReqFrom',''); setIfExists('topupReqTo',''); applyTopupReqFilters(); });
  },0);
})();
