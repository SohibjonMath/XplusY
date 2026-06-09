# OrzuMall v187 — Xitoy narx siyosatini admin orqali boshqarish

## Yangi imkoniyat
Tashqi marketlar katalogi sahifasiga `Xitoy narx siyosati` paneli qo‘shildi.

Admin quyidagilarni o‘zgartiradi:
- bepul vazn limiti;
- ortiqcha vazn uchun narx;
- hisoblash qadami;
- narxni yaxlitlash qadami;
- har bir tannarx oralig‘i uchun ustama foizi;
- har bir oralig‘dagi minimal foyda.

Sozlamalar Firestore ichidagi `settings/externalCatalogPricing` hujjatida saqlanadi.
Server mahsulotni katalogga saqlashda narxni qayta hisoblaydi.

## Yumshatilgan standart ustamalar
- 0–5 ming: 45%, minimal foyda 1 500 so‘m
- 5–10 ming: 35%, minimal foyda 2 000 so‘m
- 10–20 ming: 28%, minimal foyda 3 000 so‘m
- 20–50 ming: 22%, minimal foyda 5 000 so‘m
- 50–100 ming: 18%, minimal foyda 7 500 so‘m
- 100–250 ming: 15%, minimal foyda 10 000 so‘m
- 250–500 ming: 12%, minimal foyda 15 000 so‘m
- 500 ming+: 10%, minimal foyda 25 000 so‘m

## Qayta hisoblash
`Barcha Xitoy narxlarini qayta hisoblash` tugmasi faol Xitoy mahsulotlarining narxlarini yangi siyosat bo‘yicha yangilaydi.
Vazni yoki manba narxi kiritilmagan eski mahsulotlar o'tkazib yuboriladi.
