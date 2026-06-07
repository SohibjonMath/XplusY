# OrzuMall v162 — adaptiv 1688 galereya aniqlash

## Tuzatilgan muammo
Ba’zi 1688 sahifalarida mahsulot rasmi ko‘rinib turgan bo‘lsa ham yangi dizayn sabab galereya konteyneri aniqlanmas edi. Importer `Asosiy galereya topilmadi` xabarini berardi.

## Yangi algoritm
- Avval mahsulot galereyasi class va CDN belgilaridan aniqlanadi.
- Topilmasa sahifaning chap qismidagi katta mahsulot rasmi fazoviy usulda aniqlanadi.
- Faqat shu rasmga yaqin miniatyuralar olinadi.
- CSS background-image, picture/source va lazy-load URL formatlari qo‘llab-quvvatlanadi.
- Sharhlar, foydalanuvchi rasmlari, hujjatlar va tavsif ichidagi rasmlar rad etiladi.
- Eng oxirgi xavfsiz zaxira sifatida `og:image` ishlatiladi.

## O‘rnatish
1. Sayt ZIP faylini Netlify’ga deploy qiling.
2. `chrome://extensions` sahifasini oching.
3. Eski OrzuMall importer kengaytmasini Remove qiling.
4. `OrzuMall_1688_Importer_v1_9_ADAPTIVE_GALLERY_FIX.zip` arxivini oching.
5. `Load unpacked` bilan ichidagi `chrome-extension-orzumall-1688` papkasini tanlang.
6. Versiya `1.9.0` ekanini tekshiring.
7. 1688 mahsulot sahifasini yangilab qayta import qiling.
