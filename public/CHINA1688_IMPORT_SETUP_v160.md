# OrzuMall v160 — qat’iy 1688 variant konstruktori

## Nima o‘zgardi
- Chrome importer 1.7.0 butun sahifadagi tasodifiy matnlarni variant deb olmaydi.
- Variantlar faqat mahsulot yonidagi ko‘rinib turgan `颜色`, `尺码`, `尺寸`, `规格`, `款式`, `型号` bloklaridan olinadi.
- Import oynasida xaridor tanlaydigan rang va o‘lcham/model qiymatlari yuqorida ko‘rinadi.
- Aniqlangan qiymatlar avtomatik SKU kombinatsiyalariga aylantiriladi.
- Rang bo‘lmagan mahsulotlarda faqat `model / spetsifikatsiya` variantlari yaratiladi.
- Serverda zaxira generator bor: SKU qatorlari kelmasa ham tasdiqlangan o‘lcham/model qiymatlaridan variantlar yaratiladi.

## O‘rnatish
1. `OrzuMall_v160_1688_STRICT_VARIANT_BUILDER.zip` faylini Netlify’ga deploy qiling.
2. Chrome’da `chrome://extensions` sahifasiga kiring.
3. Eski OrzuMall importer kengaytmasini `Remove` qiling.
4. `OrzuMall_1688_Importer_v1_7_STRICT_VARIANT_BUILDER.zip` arxivini oching.
5. `Load unpacked` orqali ichidagi `chrome-extension-orzumall-1688` papkasini tanlang.
6. Versiya `1.7.0` ekanini tekshiring.
7. 1688 mahsulot sahifasini `Ctrl + R` bilan yangilang va qayta import qiling.

## Import vaqtida
`Variant konstruktori` blokini tekshiring. Basseyn kabi mahsulotlarda rang bo‘lmasligi mumkin; chap maydonni bo‘sh qoldirib, o‘ng maydonda modellarning ro‘yxati turganini tekshiring. `Katalogga saqlash` bosilganda SKU avtomatik yaratiladi.
