(function(){
  "use strict";

  const STORAGE_KEY = "orzumall_lang";
  const CACHE_KEY = "orzumall_ai_translations_v1";
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
      "ta":"pcs"
    }
  };

  const dynamicSelectors = [
    ".pname", ".cartTitle", ".favTitle", ".vName", ".catName",
    "#imgViewerName", "#imgViewerDesc", ".miniBody", ".orderId"
  ];

  const textOrigins = new WeakMap();
  let currentLang = normalizeLang(localStorage.getItem(STORAGE_KEY) || document.documentElement.lang || "uz");
  let applying = false;
  let observer = null;
  let queueTimer = null;
  const pending = new Map();

  function normalizeLang(lang){ return SUPPORTED.includes(String(lang).toLowerCase()) ? String(lang).toLowerCase() : "uz"; }
  function norm(s){ return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function keepSpaces(original, translated){
    const lead = String(original).match(/^\s*/)?.[0] || "";
    const trail = String(original).match(/\s*$/)?.[0] || "";
    return lead + translated + trail;
  }
  function trExact(text, lang){
    if(lang === "uz") return text;
    return exact[lang]?.[norm(text)] || null;
  }
  function shouldSkipNode(node){
    const p = node && node.parentElement;
    if(!p) return true;
    const tag = p.tagName;
    if(["SCRIPT","STYLE","NOSCRIPT","TEXTAREA","CODE","PRE"].includes(tag)) return true;
    if(p.closest("script,style,noscript,textarea,code,pre,.omLangSwitch")) return true;
    return false;
  }
  function applyTextNode(node){
    if(shouldSkipNode(node)) return;
    const original = textOrigins.get(node) || node.nodeValue;
    if(!textOrigins.has(node)) textOrigins.set(node, original);
    const trimmed = norm(original);
    if(!trimmed || /^[\d\s.,:+%₽$€¥-]+$/.test(trimmed)) return;
    const translated = trExact(original, currentLang);
    if(translated) node.nodeValue = keepSpaces(original, translated);
    else if(currentLang === "uz") node.nodeValue = original;
  }
  function applyAttributes(root){
    const attrs = ["placeholder", "title", "aria-label", "alt"];
    const all = root.querySelectorAll ? root.querySelectorAll("[placeholder],[title],[aria-label],[alt]") : [];
    all.forEach(el => {
      if(el.closest && el.closest(".omLangSwitch")) return;
      attrs.forEach(attr => {
        if(!el.hasAttribute(attr)) return;
        const dataKey = "omI18n" + attr.replace(/-([a-z])/g, (_,c)=>c.toUpperCase());
        const original = el.dataset[dataKey] || el.getAttribute(attr) || "";
        if(!el.dataset[dataKey]) el.dataset[dataKey] = original;
        const translated = trExact(original, currentLang);
        if(translated) el.setAttribute(attr, translated);
        else if(currentLang === "uz") el.setAttribute(attr, original);
      });
    });
  }
  function walkText(root){
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        if(!norm(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(applyTextNode);
  }

  function loadCache(){
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
    catch(_e){ return {}; }
  }
  function saveCache(cache){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch(_e){}
  }
  function cacheKey(lang, text){ return lang + "|" + text; }
  function isTranslatableText(text){
    const t = norm(text);
    if(t.length < 3 || t.length > 900) return false;
    if(/^[-+]?\d[\d\s.,:%()/-]*(so['‘’`]?m|сум|sum|uzs)?$/i.test(t)) return false;
    if(/^ID[:\s]/i.test(t)) return false;
    if(/^https?:\/\//i.test(t)) return false;
    return /[A-Za-zÀ-ÿЎўҚқҒғҲҳЁёА-Яа-я]/.test(t);
  }
  function setElementText(el, original, translated){
    if(!el || !document.contains(el)) return;
    if(el.dataset.omI18nDynOrigin !== original) return;
    el.textContent = translated;
  }
  function queueDynamic(el, original){
    if(currentLang === "uz") return;
    if(!isTranslatableText(original)) return;
    const exactTranslation = trExact(original, currentLang);
    if(exactTranslation){ setElementText(el, original, exactTranslation); return; }

    const cache = loadCache();
    const key = cacheKey(currentLang, original);
    if(cache[key]) { setElementText(el, original, cache[key]); return; }

    const entry = pending.get(original) || { text: original, elements: new Set() };
    entry.elements.add(el);
    pending.set(original, entry);
    clearTimeout(queueTimer);
    queueTimer = setTimeout(flushQueue, 180);
  }
  async function flushQueue(){
    if(currentLang === "uz" || !pending.size) return;
    const lang = currentLang;
    const batch = Array.from(pending.values()).slice(0, 20);
    batch.forEach(x => pending.delete(x.text));
    const texts = batch.map(x => x.text);
    try{
      const res = await fetch("/.netlify/functions/deepseek-translate", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ target: lang, texts })
      });
      if(!res.ok) throw new Error("translate failed");
      const data = await res.json();
      const translations = Array.isArray(data.translations) ? data.translations : [];
      const cache = loadCache();
      texts.forEach((text, i) => {
        const translated = norm(translations[i] || text);
        if(translated && translated !== text){ cache[cacheKey(lang, text)] = translated; }
        batch[i].elements.forEach(el => {
          if(currentLang === lang) setElementText(el, text, translated || text);
        });
      });
      saveCache(cache);
    }catch(_e){
      // If API key is not configured, the site still works with the built-in UI dictionary.
    }
    if(pending.size) queueTimer = setTimeout(flushQueue, 250);
  }
  function applyDynamic(root){
    const nodes = [];
    if(root.matches && dynamicSelectors.some(sel => root.matches(sel))) nodes.push(root);
    if(root.querySelectorAll) nodes.push(...root.querySelectorAll(dynamicSelectors.join(",")));
    nodes.forEach(el => {
      if(!el || el.closest(".omLangSwitch")) return;
      const original = el.dataset.omI18nDynOrigin || norm(el.textContent || "");
      if(!el.dataset.omI18nDynOrigin) el.dataset.omI18nDynOrigin = original;
      if(currentLang === "uz") { el.textContent = original; return; }
      queueDynamic(el, original);
    });
  }
  function updateButtons(){
    document.querySelectorAll(".omLangBtn").forEach(btn => {
      const on = btn.dataset.lang === currentLang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function applyAll(root){
    if(applying) return;
    applying = true;
    try{
      document.documentElement.lang = currentLang;
      walkText(root || document.body);
      applyAttributes(root || document.body);
      applyDynamic(root || document.body);
      updateButtons();
    }finally{
      applying = false;
    }
  }
  function setLang(lang){
    currentLang = normalizeLang(lang);
    try{ localStorage.setItem(STORAGE_KEY, currentLang); }catch(_e){}
    applyAll(document.body);
    window.dispatchEvent(new CustomEvent("orzumall:languagechange", { detail:{ lang: currentLang } }));
  }
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
    const host = document.querySelector(".actionsRight") || document.querySelector(".topbar .actions") || null;
    if(host) host.prepend(wrap);
    else { wrap.classList.add("omLangFloating"); document.body.appendChild(wrap); }
  }
  function startObserver(){
    if(observer) observer.disconnect();
    observer = new MutationObserver(mutations => {
      if(applying) return;
      for(const m of mutations){
        m.addedNodes && m.addedNodes.forEach(node => {
          if(node.nodeType === 1) applyAll(node);
          else if(node.nodeType === 3) applyTextNode(node);
        });
        if(m.type === "characterData" && m.target) applyTextNode(m.target);
      }
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  }

  window.OM_I18N = { setLang, getLang: () => currentLang, apply: () => applyAll(document.body) };

  function init(){
    createSwitcher();
    applyAll(document.body);
    startObserver();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
