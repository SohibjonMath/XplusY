(function(){
  "use strict";

  const STORAGE_KEY = "orzumall_lang";
  const CACHE_KEY = "orzumall_ai_translations_v2";
  const SUPPORTED = ["uz", "ru", "en"];
  const LANG_LABELS = { uz:"UZ", ru:"RU", en:"EN" };

  const exact = {
    ru: {
      "Qidiruv":"Поиск",
      "Qidirish":"Искать",
      "Mahsulot va toifalarni qidiring":"Ищите товары и категории",
      "OrzuMall Search":"OrzuMall Поиск",
      "Topa olmadingiz?":"Не нашли?",
      "Rasm yoki qisqa izoh yuboring — bot topib beradi.":"Отправьте фото или краткое описание — бот поможет найти.",
      "Kiyim, elektronika, uy-ro‘zg‘or va boshqa kategoriyalar.":"Одежда, электроника, товары для дома и другие категории.",
      "Botga yuborish":"Отправить боту",
      "Mahsulotlar":"Товары",
      "Kategoriya":"Категория",
      "Ommabop":"Популярное",
      "Narx ↑":"Цена ↑",
      "Narx ↓":"Цена ↓",
      "Yangi":"Новинки",
      "Yana yuklash":"Загрузить ещё",
      "Ko‘proq mahsulotlar uchun “Yana yuklash”ni bosing yoki pastga scroll qiling.":"Чтобы увидеть больше товаров, нажмите «Загрузить ещё» или прокрутите вниз.",
      "Hech narsa topilmadi.":"Ничего не найдено.",
      "Bosh sahifa":"Главная",
      "Sevimlilar":"Избранное",
      "Savat":"Корзина",
      "Profil":"Профиль",
      "Yoqtirgan mahsulotlaringiz bir joyda.":"Понравившиеся товары в одном месте.",
      "Sevimlilar hozircha bo‘sh":"Избранное пока пусто",
      "Yoqgan mahsulotlaringizni yurakcha orqali shu bo‘limga saqlang.":"Сохраняйте понравившиеся товары сюда через сердечко.",
      "Savatingiz hozircha bo‘sh":"Ваша корзина пока пуста",
      "Mahsulotlarni savatga qo‘shsangiz, buyurtma shu yerda shakllanadi.":"Когда добавите товары в корзину, заказ появится здесь.",
      "Buyurtma uchun tanlash":"Выбор для заказа",
      "Kerakli mahsulotlarni belgilang yoki hammasini tanlang.":"Отметьте нужные товары или выберите все.",
      "Hammasini tanlash":"Выбрать все",
      "Buyurtma berish":"Оформить заказ",
      "Telegramga yuborish":"Отправить в Telegram",
      "Tozalash":"Очистить",
      "Variant tanlang":"Выберите вариант",
      "Yopish":"Закрыть",
      "Rang":"Цвет",
      "Iltimos, rangni tanlang":"Пожалуйста, выберите цвет",
      "O‘lcham":"Размер",
      "Iltimos, o‘lchamni tanlang":"Пожалуйста, выберите размер",
      "Miqdor":"Количество",
      "Kamaytirish":"Уменьшить",
      "Ko‘paytirish":"Увеличить",
      "Bekor":"Отмена",
      "Savatchaga qo‘shish":"Добавить в корзину",
      "Savatchaga":"В корзину",
      "Savatga":"В корзину",
      "Savatga qo‘shildi":"Добавлено в корзину",
      "Ko‘rish":"Открыть",
      "Sevimli":"Избранное",
      "Sevimlidan olib tashlash":"Удалить из избранного",
      "O‘chirish":"Удалить",
      "Oldindan to‘lov":"Предоплата",
      "Asl mahsulot":"Оригинальный товар",
      "Mahsulot turi":"Тип товара",
      "Barchasi":"Все",
      "Mahsulotlarni ko‘rish":"Показать товары",
      "Filterni tozalash":"Сбросить фильтр",
      "Kategoriya topilmadi.":"Категория не найдена.",
      "Tavsif":"Описание",
      "Video":"Видео",
      "Sharh":"Отзывы",
      "Ma'lumot":"Информация",
      "Balans":"Баланс",
      "Balans to‘ldirish":"Пополнить баланс",
      "Click orqali balans to‘ldirish":"Пополнение баланса через Click",
      "Ro‘yxatdan o‘tish":"Регистрация",
      "Kirish":"Войти",
      "Telefon":"Телефон",
      "Parol":"Пароль",
      "Parolni qayta kiriting":"Повторите пароль",
      "Qayta parol":"Повторите пароль",
      "Ism":"Имя",
      "Familiya":"Фамилия",
      "Viloyat":"Область",
      "Tuman":"Район",
      "Pochta indeks":"Почтовый индекс",
      "Ko‘rsatish/Yashirish":"Показать/скрыть",
      "Ro‘yxatdan o‘tganda sizga avtomatik ID beriladi.":"При регистрации вам автоматически будет присвоен ID.",
      "Kuting...":"Подождите...",
      "Tekshirilmoqda va yuklanmoqda":"Проверка и загрузка",
      "Tahrirlash":"Редактировать",
      "Saqlash":"Сохранить",
      "Chiqish":"Выйти",
      "Manzil":"Адрес",
      "Yetkazib berish":"Доставка",
      "To‘lov":"Оплата",
      "Umumiy summa":"Итого",
      "Jami":"Итого",
      "Savatcha":"Корзина",
      "Orqaga":"Назад",
      "Tanlangan mahsulotlaringiz shu yerda jamlanadi.":"Выбранные товары будут собраны здесь.",
      "Sevimlilarni tozalash":"Очистить избранное",
      "Savatchani tozalash":"Очистить корзину",
      "Savatchada":"В корзине",
      "tanlangan":"выбрано",
      "Sevimli":"Избранное",
      "Yuborilmoqda...":"Отправляется...",
      "Yuklanmoqda...":"Загрузка...",
      "Hozircha sharh yo‘q.":"Отзывов пока нет.",
      "Bu mahsulot uchun video link qo‘shilmagan.":"Для этого товара видео-ссылка не добавлена.",
      "ta":"шт."
    },
    en: {
      "Qidiruv":"Search",
      "Qidirish":"Search",
      "Mahsulot va toifalarni qidiring":"Search products and categories",
      "OrzuMall Search":"OrzuMall Search",
      "Topa olmadingiz?":"Couldn’t find it?",
      "Rasm yoki qisqa izoh yuboring — bot topib beradi.":"Send a photo or short description — the bot will help find it.",
      "Kiyim, elektronika, uy-ro‘zg‘or va boshqa kategoriyalar.":"Clothing, electronics, home goods and other categories.",
      "Botga yuborish":"Send to bot",
      "Mahsulotlar":"Products",
      "Kategoriya":"Category",
      "Ommabop":"Popular",
      "Narx ↑":"Price ↑",
      "Narx ↓":"Price ↓",
      "Yangi":"New",
      "Yana yuklash":"Load more",
      "Ko‘proq mahsulotlar uchun “Yana yuklash”ni bosing yoki pastga scroll qiling.":"To see more products, tap “Load more” or scroll down.",
      "Hech narsa topilmadi.":"Nothing found.",
      "Bosh sahifa":"Home",
      "Sevimlilar":"Favorites",
      "Savat":"Cart",
      "Profil":"Profile",
      "Yoqtirgan mahsulotlaringiz bir joyda.":"Your favorite products in one place.",
      "Sevimlilar hozircha bo‘sh":"Favorites are empty",
      "Yoqgan mahsulotlaringizni yurakcha orqali shu bo‘limga saqlang.":"Save products you like here using the heart icon.",
      "Savatingiz hozircha bo‘sh":"Your cart is empty",
      "Mahsulotlarni savatga qo‘shsangiz, buyurtma shu yerda shakllanadi.":"When you add products to the cart, your order will appear here.",
      "Buyurtma uchun tanlash":"Select for order",
      "Kerakli mahsulotlarni belgilang yoki hammasini tanlang.":"Choose the needed products or select all.",
      "Hammasini tanlash":"Select all",
      "Buyurtma berish":"Place order",
      "Telegramga yuborish":"Send to Telegram",
      "Tozalash":"Clear",
      "Variant tanlang":"Choose variant",
      "Yopish":"Close",
      "Rang":"Color",
      "Iltimos, rangni tanlang":"Please choose a color",
      "O‘lcham":"Size",
      "Iltimos, o‘lchamni tanlang":"Please choose a size",
      "Miqdor":"Quantity",
      "Kamaytirish":"Decrease",
      "Ko‘paytirish":"Increase",
      "Bekor":"Cancel",
      "Savatchaga qo‘shish":"Add to cart",
      "Savatchaga":"Cart",
      "Savatga":"To cart",
      "Savatga qo‘shildi":"Added to cart",
      "Ko‘rish":"View",
      "Sevimli":"Favorite",
      "Sevimlidan olib tashlash":"Remove from favorites",
      "O‘chirish":"Delete",
      "Oldindan to‘lov":"Prepayment",
      "Asl mahsulot":"Original product",
      "Mahsulot turi":"Product type",
      "Barchasi":"All",
      "Mahsulotlarni ko‘rish":"View products",
      "Filterni tozalash":"Clear filter",
      "Kategoriya topilmadi.":"Category not found.",
      "Tavsif":"Description",
      "Video":"Video",
      "Sharh":"Reviews",
      "Ma'lumot":"Information",
      "Balans":"Balance",
      "Balans to‘ldirish":"Top up balance",
      "Click orqali balans to‘ldirish":"Balance top-up via Click",
      "Ro‘yxatdan o‘tish":"Sign up",
      "Kirish":"Log in",
      "Telefon":"Phone",
      "Parol":"Password",
      "Parolni qayta kiriting":"Repeat password",
      "Qayta parol":"Repeat password",
      "Ism":"First name",
      "Familiya":"Last name",
      "Viloyat":"Region",
      "Tuman":"District",
      "Pochta indeks":"Postal code",
      "Ko‘rsatish/Yashirish":"Show/hide",
      "Ro‘yxatdan o‘tganda sizga avtomatik ID beriladi.":"You will automatically receive an ID when you sign up.",
      "Kuting...":"Please wait...",
      "Tekshirilmoqda va yuklanmoqda":"Checking and loading",
      "Tahrirlash":"Edit",
      "Saqlash":"Save",
      "Chiqish":"Log out",
      "Manzil":"Address",
      "Yetkazib berish":"Delivery",
      "To‘lov":"Payment",
      "Umumiy summa":"Total",
      "Jami":"Total",
      "Savatcha":"Cart",
      "Orqaga":"Back",
      "Tanlangan mahsulotlaringiz shu yerda jamlanadi.":"Your selected products are collected here.",
      "Sevimlilarni tozalash":"Clear favorites",
      "Savatchani tozalash":"Clear cart",
      "Savatchada":"In cart",
      "tanlangan":"selected",
      "Sevimli":"Favorite",
      "Yuborilmoqda...":"Sending...",
      "Yuklanmoqda...":"Loading...",
      "Hozircha sharh yo‘q.":"No reviews yet.",
      "Bu mahsulot uchun video link qo‘shilmagan.":"No video link has been added for this product.",
      "ta":"pcs"
    }
  };

  const dynamicSelectors = [
    ".pname", ".cartTitle", ".favTitle", ".vName", ".catName", ".favTitle",
    "#imgViewerName", "#imgViewerDesc", ".qvTag", ".pbadge.meta",
    ".catCrumbs button", ".ptags", ".miniBody .muted", ".revItemText"
  ];

  let currentLang = normalizeLang(localStorage.getItem(STORAGE_KEY) || document.documentElement.lang || "uz");
  let busy = false;
  let lightObserver = null;
  let applyTimer = null;

  function normalizeLang(lang){
    lang = String(lang || "uz").toLowerCase();
    return SUPPORTED.includes(lang) ? lang : "uz";
  }
  function norm(s){ return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function setText(el, value){
    const v = String(value == null ? "" : value);
    if(el && el.textContent !== v) el.textContent = v;
  }
  function trExact(text, lang){
    if(lang === "uz") return text;
    return exact[lang]?.[norm(text)] || null;
  }
  function isSafeStaticText(text){
    const t = norm(text);
    if(!t) return false;
    if(t.length > 120) return false;
    if(/^[-+]?\d[\d\s.,:+%()/-]*(so['‘’`]?m|сум|sum|uzs)?$/i.test(t)) return false;
    return true;
  }
  function isDynamicText(text){
    const t = norm(text);
    if(t.length < 3 || t.length > 700) return false;
    if(/^[-+]?\d[\d\s.,:%()/-]*(so['‘’`]?m|сум|sum|uzs)?$/i.test(t)) return false;
    if(/^ID[:\s]/i.test(t)) return false;
    if(/^https?:\/\//i.test(t)) return false;
    return /[A-Za-zÀ-ÿЎўҚқҒғҲҳЁёА-Яа-я]/.test(t);
  }
  function root(){ return document.body || document.documentElement; }
  function getCache(){
    try{ return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
    catch(_e){ return {}; }
  }
  function setCache(cache){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch(_e){}
  }
  function cacheKey(lang, text){ return lang + "|" + text; }

  function createSwitcher(){
    if(document.querySelector(".omLangSwitch")) return;
    const wrap = document.createElement("div");
    wrap.className = "omLangSwitch";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Til / Language");
    SUPPORTED.forEach(lang => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "omLangBtn";
      b.dataset.lang = lang;
      b.textContent = LANG_LABELS[lang];
      b.addEventListener("click", () => setLang(lang));
      wrap.appendChild(b);
    });
    const host = document.querySelector(".actionsRight") || document.querySelector(".topbar .actions");
    if(host) host.prepend(wrap);
    else { wrap.classList.add("omLangFloating"); root().appendChild(wrap); }
  }

  function updateButtons(){
    document.querySelectorAll(".omLangBtn").forEach(btn => {
      const on = btn.dataset.lang === currentLang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function collectTextNodes(scope){
    const out = [];
    const walker = document.createTreeWalker(scope || root(), NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        const p = node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;
        if(p.closest("script,style,noscript,textarea,code,pre,.omLangSwitch,[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
        const t = norm(node.nodeValue);
        if(!isSafeStaticText(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  function applyStaticText(scope){
    const nodes = collectTextNodes(scope || root());
    nodes.forEach(node => {
      const p = node.parentElement;
      if(!p) return;
      const original = p.dataset.omI18nTextOrigin || node.nodeValue;
      if(!p.dataset.omI18nTextOrigin) p.dataset.omI18nTextOrigin = original;
      if(currentLang === "uz"){
        node.nodeValue = original;
      }else{
        const translated = trExact(original, currentLang);
        if(translated) node.nodeValue = translated;
      }
    });
  }

  function applyAttrs(scope){
    const attrs = ["placeholder", "title", "aria-label", "alt"];
    const all = (scope || root()).querySelectorAll ? (scope || root()).querySelectorAll("[placeholder],[title],[aria-label],[alt]") : [];
    all.forEach(el => {
      if(el.closest && el.closest(".omLangSwitch,[data-no-i18n]")) return;
      attrs.forEach(attr => {
        if(!el.hasAttribute(attr)) return;
        const key = "omI18n" + attr.replace(/-([a-z])/g, (_,c)=>c.toUpperCase()).replace(/^./, c=>c.toUpperCase());
        const original = el.dataset[key] || el.getAttribute(attr) || "";
        if(!el.dataset[key]) el.dataset[key] = original;
        if(currentLang === "uz") el.setAttribute(attr, original);
        else {
          const translated = trExact(original, currentLang);
          if(translated) el.setAttribute(attr, translated);
        }
      });
    });
  }

  function collectDynamicElements(){
    const set = new Set();
    dynamicSelectors.forEach(sel => document.querySelectorAll(sel).forEach(el => set.add(el)));
    return Array.from(set).filter(el => el && !el.closest(".omLangSwitch,[data-no-i18n]") && isDynamicText(el.textContent));
  }

  async function translateDynamic(){
    if(currentLang === "uz"){
      collectDynamicElements().forEach(el => {
        if(el.dataset.omDynOrigin) setText(el, el.dataset.omDynOrigin);
      });
      return;
    }
    const elements = collectDynamicElements();
    if(!elements.length) return;
    const cache = getCache();
    const toAsk = [];
    const byText = new Map();

    elements.forEach(el => {
      const original = el.dataset.omDynOrigin || norm(el.textContent || "");
      if(!el.dataset.omDynOrigin) el.dataset.omDynOrigin = original;
      const exactTranslation = trExact(original, currentLang);
      if(exactTranslation){ setText(el, exactTranslation); return; }
      const ck = cacheKey(currentLang, original);
      if(cache[ck]){ setText(el, cache[ck]); return; }
      if(!byText.has(original)){
        byText.set(original, []);
        toAsk.push(original);
      }
      byText.get(original).push(el);
    });

    if(!toAsk.length) return;
    // Translate in small chunks so the catalog never freezes.
    for(let i=0; i<toAsk.length; i+=12){
      const texts = toAsk.slice(i, i+12);
      try{
        const res = await fetch("/.netlify/functions/deepseek-translate", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ target: currentLang, texts })
        });
        if(!res.ok) throw new Error("translate failed");
        const data = await res.json();
        const translations = Array.isArray(data.translations) ? data.translations : [];
        texts.forEach((text, idx) => {
          const translated = norm(translations[idx] || text);
          if(translated && translated !== text) cache[cacheKey(currentLang, text)] = translated;
          (byText.get(text) || []).forEach(el => {
            if(currentLang !== "uz") setText(el, translated || text);
          });
        });
        setCache(cache);
      }catch(_e){
        // API sozlanmagan bo'lsa ham sayt ishlashda davom etadi.
        break;
      }
      await new Promise(r => setTimeout(r, 60));
    }
  }

  function scheduleApply(scope){
    if(currentLang === "uz") return;
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      try{
        applyStaticText(scope && scope.querySelectorAll ? scope : root());
        applyAttrs(scope && scope.querySelectorAll ? scope : root());
        translateDynamic();
      }catch(_e){}
    }, 220);
  }

  function startLightObserver(){
    if(lightObserver || !window.MutationObserver) return;
    const targets = [
      "#grid", "#catList", "#catCrumbs", "#panelList", "#favPageList", "#cartPageList",
      "#imgViewer", "#variantModal", "#miniModal", "#cartPanel", "main"
    ].map(sel => document.querySelector(sel)).filter(Boolean);
    if(!targets.length) return;
    lightObserver = new MutationObserver((mutations) => {
      if(currentLang === "uz") return;
      let ok = false;
      for(const m of mutations){
        if(m.type === "childList" && (m.addedNodes && m.addedNodes.length)){ ok = true; break; }
      }
      if(ok) scheduleApply(root());
    });
    targets.forEach(t => { try{ lightObserver.observe(t, { childList:true, subtree:true }); }catch(_e){} });
  }

  function stopLightObserver(){
    if(lightObserver){ try{ lightObserver.disconnect(); }catch(_e){} lightObserver = null; }
    clearTimeout(applyTimer);
  }

  function applyNow(){
    if(busy) return;
    busy = true;
    try{
      document.documentElement.lang = currentLang;
      updateButtons();
      if(currentLang !== "uz"){
        applyStaticText(root());
        applyAttrs(root());
      }else{
        // UZ rejimida sahifani keraksiz qayta yozmaymiz — asosiy sayt tezligi saqlanadi.
        applyStaticText(root());
        applyAttrs(root());
      }
    }finally{
      busy = false;
    }
    translateDynamic();
    if(currentLang !== "uz") startLightObserver(); else stopLightObserver();
  }

  function setLang(lang){
    currentLang = normalizeLang(lang);
    try{ localStorage.setItem(STORAGE_KEY, currentLang); }catch(_e){}
    applyNow();
    // App render qilib bo'lgandan keyin mahsulot nomlari ham tarjima bo'lishi uchun.
    setTimeout(applyNow, 700);
    setTimeout(applyNow, 2000);
    setTimeout(applyNow, 4500);
  }

  function init(){
    createSwitcher();
    updateButtons();
    // Eski og'ir observer yo'q: sayt qotmaydi. Tarjima faqat tanlangan tilda ishlaydi.
    if(currentLang !== "uz"){
      setTimeout(applyNow, 300);
      setTimeout(applyNow, 1600);
      setTimeout(applyNow, 4200);
      startLightObserver();
    }
    document.addEventListener("click", (e)=>{
      if(e.target && e.target.closest && e.target.closest(".omLangBtn")) return;
      if(currentLang !== "uz") setTimeout(translateDynamic, 300);
    }, true);
    window.addEventListener("hashchange", ()=> currentLang !== "uz" && setTimeout(applyNow, 300));
  }

  window.OM_I18N = {
    setLang,
    getLang: () => currentLang,
    apply: applyNow,
    translateVisible: translateDynamic,
    notify: (scope) => scheduleApply(scope || root())
  };

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
