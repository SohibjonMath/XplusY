# OrzuMall v155 — 1688 rasm standartlash tizimi

## Muammo
1688 sotuvchilarining rasmlari bir xil formatda emas: tik, yotiq, kvadrat va atrofi ortiqcha oq bo‘shliqli fayllar aralash keladi. Faqat CSS orqali `contain` qilish rasmlarni bir xil vizual o‘lchamga keltirmaydi.

## Yechim
Faqat 1688 Chrome importer orqali olinadigan mahsulot rasmlari Firebase Storage’ga yozilishidan oldin serverda qayta tayyorlanadi:

1. rasm yuklab olinadi;
2. oq yoki shaffof tashqi bo‘shliqlar ehtiyotkorlik bilan tozalanadi;
3. mahsulot markazga joylanadi;
4. rasm 1200×1200 px oq kvadrat canvasga keltiriladi;
5. bir xil 40 px xavfsiz chekka qo‘shiladi;
6. optimallashtirilgan JPEG Firebase Storage’ga yoziladi.

Standart identifikatori: `square-1200-v1`.

## Eski importlar
Admin sahifasi: `/admin/china1688-import.html`

Har bir oldingi 1688 mahsulot kartasida `Rasmlarni standartlash` tugmasi mavjud. Rasmlar 6 tadan partiyaga ajratilib qayta ishlanadi va karta avtomatik yangilanadi.

## Frontend
`ppShellChina` klassi orqali faqat 1688/cargo mahsulotlari uchun yagona oq viewport va `contain` ko‘rsatish rejimi qo‘llanadi. Oddiy mahalliy mahsulotlar dizayniga tegilmaydi.
