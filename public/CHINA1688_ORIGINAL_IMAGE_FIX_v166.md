# OrzuMall v166 — 1688 original rasm fix

## Muammo
1688 sahifasi va ayrim API javoblari ba'zan asl galereya fayli o‘rniga CDN miniatyurasini qaytaradi:

```text
photo.jpg_60x60.jpg
photo.jpg_220x220q90.jpg
photo.jpg_.webp
```

Server shu URL'ni yuklasa, 1200×1200 formatga kattalashtirilgan bo‘lsa ham sifat past bo‘lib qoladi.

## Tuzatish
- Chrome kengaytma rasm URL'larini importdan oldin asl URL'ga aylantiradi.
- RapidAPI orqali kelgan `main_imgs`, rang va SKU rasmlari serverda ham asli bilan almashtiriladi.
- Firebase Storage nusxalash funksiyasi oxirgi himoya sifatida URL'ni yana tekshiradi.
- Admin preview ham original rasm URL'idan foydalanadi.

Misol:

```text
https://cbu01.alicdn.com/.../photo.jpg_60x60.jpg
↓
https://cbu01.alicdn.com/.../photo.jpg
```

## Ishlatish
1. Sayt ZIP faylini Netlify'ga qayta deploy qiling.
2. Chrome importer ishlatilsa, eski kengaytmani olib tashlab `OrzuMall_1688_Importer_v2_1_ORIGINAL_IMAGE_FIX.zip` ichidagi papkani `Load unpacked` orqali ulang.
3. Oldin mayda rasm bilan import qilingan mahsulotlarni o‘chirib qayta import qiling yoki import sahifasidagi `Rasmlarni standartlash` tugmasidan foydalaning.
