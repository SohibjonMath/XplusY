# OrzuMall v168 — 1688 maxsus katalog tizimi

1688 orqali import qilingan mahsulotlar endi oddiy OrzuMall ombor mahsulotlaridan alohida boshqariladi.

## Asosiy o‘zgarishlar

- Firestore mahsulotida mustaqil `china1688Catalog` modeli saqlanadi.
- Variantlar faqat rang va razmerga siqilmaydi: model, komplekt, uzunlik, quvvat va boshqa tanlovlar ham alohida guruh bo‘ladi.
- Har bir variant guruhi asosida SKU kombinatsiyalari yaratiladi.
- Xaridorlar uchun 1688 kartasi, mahsulot oynasi va variant tanlash oynasi alohida dizaynga ega.
- Oddiy admin mahsulotlar oynasida 1688 kartalari tahrirlanmaydi. Buning uchun maxsus `admin/china1688-import.html` ish maydoni ishlatiladi.
- Eski 1688 mahsulotlari uchun `1688 modelini qayta yaratish` tugmasi qo‘shilgan.
- 1688 CDN rasm URLlari original kattalik manziliga tozalanadi va Firebase Storage uchun 1200×1200 px standartga tayyorlanadi. Netlify serverida `sharp` orqali yengil tiniqlashtirish ham ishlaydi.

## Deploydan keyin

1. Netlify’ga v168 ZIP faylini deploy qiling.
2. Chrome importer v2.2 kengaytmasini yangilang.
3. Maxsus 1688 admin sahifasini oching.
4. Eski kartalarda avval `1688 modelini qayta yaratish`, keyin kerak bo‘lsa `Rasmlarni standartlash` tugmasini bosing.
5. Variantlar 1688 sahifasida yashirilgan bo‘lsa, 1688 akkauntiga kirib mahsulotni qayta import qiling yoki konstruktorda qo‘lda kiriting.
