# OrzuMall v165 — RapidAPI orqali 1688 link import

Admin paneldagi `/admin/china1688-import.html` sahifasiga **API orqali avto olish** tugmasi qo‘shildi.

## Netlify Environment Variables
```text
RAPIDAPI_1688_KEY=RapidAPI kabinetidagi YANGI kalit
RAPIDAPI_1688_HOST=1688-product2.p.rapidapi.com
RAPIDAPI_1688_ITEM_PATH=/1688/v2/item_detail_by_url
FIREBASE_SERVICE_ACCOUNT_B64=...
FIREBASE_STORAGE_BUCKET=xplusy-760fa.firebasestorage.app
```

Skrinshotda ko‘ringan eski RapidAPI kalitini rotate qiling. Kalit HTML yoki frontend JavaScript ichiga yozilmaydi.

API javobidagi `main_imgs`, `sku_props` va `skus` alohida o‘qiladi. Katalogga saqlashdan oldin galereya rasmlari majburiy 1200×1200 px JPEG formatga tayyorlanadi. Standartlash muvaffaqiyatsiz bo‘lsa mahsulot aralash o‘lchamdagi rasm bilan saqlanmaydi.
