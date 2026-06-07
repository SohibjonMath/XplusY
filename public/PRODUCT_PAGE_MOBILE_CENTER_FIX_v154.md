# OrzuMall v154 — mobile gallery centered viewport fix

## Muammo
v153 mobile galereyada rasmni fixed viewport ichiga sig‘dirgan, lekin surat `absolute` va `100% × 100%` rejimida qolgan. Ayrim 1688 rasmlarida ko‘rinadigan qism chekkaga siljib qolgan.

## Tuzatish
- Mobile viewport balandligi qat’iy saqlandi.
- Asosiy surat absolute joylashuvdan chiqarildi.
- Surat oddiy flex element sifatida viewport markaziga joylashtirildi.
- `width:auto`, `height:auto`, `max-width:100%`, `max-height:100%` ishlatiladi.
- Rasm nisbati saqlanadi va kesilmaydi.
- Desktop galereya, thumbnail, swipe va fullscreen saqlanib qoldi.

## Deploy
ZIP tarkibini Netlify saytga deploy qiling. Deploydan keyin `Ctrl + F5` bosing.
