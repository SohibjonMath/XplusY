# OrzuMall v188 — Admin Single Sign-On

- Barcha desktop admin bo‘limlari bitta `/admin/login.html` sessiyasidan foydalanadi.
- Google popup faqat markaziy login sahifasida ochiladi.
- Foydalanuvchilar, sharhlar, sellerlar, tashqi katalog, promokodlar va professional dashboard sahifalari alohida qayta login talab qilmaydi.
- Login talab qilinsa, foydalanuvchi kirgandan keyin aynan ochmoqchi bo‘lgan admin bo‘limiga qaytariladi.
- Vaqtinchalik server xatosi standalone admin sahifalarida sessiyani avtomatik bekor qilmaydi.
- Mobile admin ichidagi ichki admin havolalari bir xil webview kontekstida ochiladi va saqlangan Firebase sessiyasidan foydalanadi.
