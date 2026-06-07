# OrzuMall v166 — RapidAPI orqali 1688 havoladan avtomatik import

## Muhim xavfsizlik qadami
RapidAPI playground skrinshotida eski kalit ko‘ringan bo‘lsa, uni ishlatmang. RapidAPI Dashboard ichida yangi authorization yarating va eskisini o‘chiring. Kalitni HTML, JavaScript yoki Chrome kengaytmasiga yozmang.

## Netlify Environment Variables
Netlify → Site configuration → Environment variables bo‘limiga quyidagilarni kiriting:

```text
RAPIDAPI_1688_KEY=RapidAPI kabinetidagi YANGI kalit
RAPIDAPI_1688_HOST=1688-product2.p.rapidapi.com
RAPIDAPI_1688_ITEM_PATH=/1688/v2/item_detail_by_url
FIREBASE_SERVICE_ACCOUNT_B64=Firebase service account JSON Base64 qiymati
FIREBASE_STORAGE_BUCKET=xplusy-760fa.firebasestorage.app
```

`RAPIDAPI_1688_ITEM_PATH` RapidAPI listingidagi endpoint yo‘li farq qilsa, listingdagi aniq path bilan almashtiriladi. Kodni qayta yozish shart emas.

## Ishlatish tartibi
1. Yangi sayt ZIP faylini Netlify’ga deploy qiling.
2. Admin panelda `/admin/china1688-import.html` sahifasini oching.
3. 1688 mahsulot havolasini kiriting.
4. `API orqali avto olish` tugmasini bosing.
5. Galereya, rang, o‘lcham/model va SKU sonini tekshiring.
6. `Katalogga saqlash` tugmasini bosing.

Chrome importer zaxira rejim sifatida qolgan. Variantli mahsulotlarda asosiy usul — RapidAPI havoladan import.

## Ma’lumotlar oqimi
```text
1688 havolasi
  ↓
Netlify server function
  ↓
RapidAPI 1688 Product
  ↓
main_imgs + sku_props + skus
  ↓
Rasmlarni oq chetlardan tozalash
  ↓
1200 × 1200 px JPEG
  ↓
Firebase Storage + Firestore katalog
```

## Natija
- RapidAPI kaliti frontendga chiqmaydi.
- Har bir import tugmasi API so‘rovi sarflaydi.
- Mahsulotni mijozlar ko‘rishi API so‘rovi sarflamaydi.
- Import qilingan mahsulot, rasmlar va variantlar Firebase’da saqlanadi.
- API obunasi to‘xtatilsa, avval import qilingan mahsulotlar ishlashda davom etadi. Yangi avto import va avtomatik yangilash ishlamaydi.
- Galereya rasmlaridan bittasi 1200 × 1200 formatga tayyorlanmasa, mahsulotni aralash o‘lchamda saqlash bloklanadi. Muammoli rasm belgisini olib tashlab qayta saqlash mumkin.


## v166 original rasm tuzatishi
1688 CDN miniatyura URL'lari (`.jpg_60x60.jpg`, `.jpg_220x220.jpg`, `.jpg_.webp`) importdan oldin avtomatik tarzda asl katta URL'ga aylantiriladi. Chrome importer uchun `OrzuMall_1688_Importer_v2_1_ORIGINAL_IMAGE_FIX.zip` versiyasidan foydalaning.
