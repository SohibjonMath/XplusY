# OrzuMall v189 — admin login layout fix

## Muammo
Legacy admin sahifalarida `.login { display:grid }`, `.login-screen { display:grid }` yoki `.login-box { display:flex }` kabi qoidalar brauzerning `[hidden]` atributini bosib ketgan. Firebase sessiyasi tiklanganda admin kontenti ochilgan, ammo eski login hero ham yuqorida joy egallab qolgan.

## Tuzatish
- `admin-session-guard.js` barcha admin sahifalariga markaziy `[hidden] { display:none!important }` kontraktini inject qiladi.
- Login wrapperlar Firebase local session tiklanguncha boshlang‘ich holatda yashirin turadi.
- Promokod, professional dashboard, sharhlar, sellerlar, users va tashqi katalog sahifalari qamrab olindi.
