# OrzuMall v169 — tashqi marketlar katalogi

## Qo‘llab-quvvatlanadigan manbalar
- Sahiy Market
- Uzum Market
- 1688
- Pinduoduo / Yangkeduo

## Asosiy arxitektura
Tashqi market mahsulotlari oddiy ombor mahsulotlariga aralashtirilmaydi. Har bir import qilingan kartada `externalCatalog`, `externalMarket`, `sourcePlatform`, `sourceLabel`, `sourceUrl` va `sourceItemId` saqlanadi.

`externalCatalog.optionGroups` ixtiyoriy variant guruhlarini saqlaydi: rang, o‘lcham, model, komplekt, quvvat va boshqa tanlovlar. `externalCatalog.skus` esa shu guruhlardan tuzilgan kombinatsiyalarni saqlaydi.

## Buyurtma xavfsizligi
Mijoz buyurtma berganda admin buyurtmaga yuboriladigan asl manba havolasi brauzerdan qabul qilinmaydi. `netlify/functions/_marketplaceOrderCommon.js` mahsulotni Firestore katalogidan qayta o‘qiydi va buyurtma qatoriga serverda saqlangan `sourceUrl`, `sourcePlatform`, `sourceLabel`, `sourceItemId` hamda tanlangan variantlarni yozadi.

## Import usuli
1. `public/admin/external-catalog-import.html` sahifasini oching.
2. `OrzuMall Market Importer v3.1` Chrome kengaytmasini ulang.
3. Kerakli marketdagi mahsulot sahifasini oching.
4. `OrzuMall’ga import` tugmasini bosing.
5. Admin qoralamasida rasmlar, variantlar, narx va muddatni tekshirib saqlang.

1688 uchun mavjud RapidAPI integratsiyasi ixtiyoriy zaxira yo‘li sifatida qoldirilgan. Boshqa marketlarda sahifa o‘zgarsa, admin qoralamasida ma’lumotlarni tuzatish mumkin.


## v170 Sahiy extractor fix
- Sahiy galereyasi fazoviy media blokdan olinadi; to‘lov logolari va yordamchi ikonlar kiritilmaydi.
- Sahiy variant kartalari alohida o‘qiladi va dinamik SKU kombinatsiyalariga aylantiriladi.
- Sahiy URL ichidagi `sku` identifikatori va ichki 1688 havolasi saqlanadi.
