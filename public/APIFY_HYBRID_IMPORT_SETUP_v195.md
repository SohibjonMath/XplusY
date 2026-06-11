# OrzuMall v195 — Apify API-first hybrid importer

## Netlify Environment Variables

Netlify dashboard → Site configuration → Environment variables ichiga qo‘shing:

```text
APIFY_API_TOKEN=Apify Console ichidagi shaxsiy API token
APIFY_1688_ACTOR_ID=piotrv1001~1688-listings-scraper
APIFY_1688_CACHE_HOURS=24
```

`APIFY_API_TOKEN` majburiy. Qolgan ikkita qiymat ixtiyoriy; kodda xavfsiz default mavjud.

Token HTML, frontend JavaScript yoki Chrome kengaytma ichiga yozilmaydi. Faqat Netlify server funksiyasi Apify API bilan gaplashadi.

## Import oqimi

```text
Sahiy mahsulot sahifasi
→ Chrome helper: asl 1688 Offer ID + Sahiy ichki yetkazish + video
→ Netlify server: Apify run boshlaydi
→ Admin sahifa qisqa polling bilan natijani kutadi
→ Apify: original nom + rasmlar + donalik narx + MOQ + vazn + atributlar
→ OrzuMall: rang × o‘lcham SKU kombinatsiyalarini avtomatik yaratadi
→ Admin tekshiradi va saqlaydi
```

## Nega polling ishlatiladi?

Apify Actor ishlashi bir necha soniya olishi mumkin. Tokenni frontendga bermaslik va Netlify funksiyasini uzoq kutishda ushlab turmaslik uchun:

1. `startApify1688` Actor run boshlaydi;
2. admin sahifa `pollApify1688` orqali holatni tekshiradi;
3. run tugagach datasetdan bitta detail mahsulot olinadi;
4. natija Firestore cache ichiga 24 soatga saqlanadi.

Bir xil mahsulotni qayta ochish cache orqali ishlaydi va Apify xarajatini kamaytiradi.

## Narx tanlash qoidasi

Apify `tierPrices` qaytarsa, OrzuMall donalik savdo uchun `beginAmount <= 1` narxini oladi. Masalan:

```text
1 dona → 30 ¥
1000 dona → 28 ¥
5000 dona → 26 ¥
```

OrzuMall manba narxi sifatida `30 ¥` ni ishlatadi.

## Vazn

Apify `logistics.unitWeight` qaytarsa admin formadagi taxminiy vazn avtomatik to‘ldiriladi. Topilmasa admin qo‘lda yozadi.

## Variantlar

Apify atributlaridagi `颜色` va `尺码` qiymatlari avtomatik ajratiladi. Default qoida:

```text
Barcha ranglarda barcha o‘lchamlar mavjud
```

Shu sababli rang × o‘lcham kombinatsiyalari avtomatik yaratiladi. Kamdan-kam istisnoda admin variant konstruktorida qiymatlarni tahrirlaydi.
