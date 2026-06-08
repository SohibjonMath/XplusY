# OrzuMall v185 — Xitoy landed-cost avtomatik narxlash

Xitoydan import qilinadigan mahsulotlarda admin faqat manba narxi, Xitoy ichki yetkazish summasi va taxminiy vaznni tekshiradi. Sahiy sahifasidan ichki yetkazish summasi topilsa importer uni avtomatik kiritadi.

## Formula

`Tannarx = manba narxi + Xitoy ichki yetkazish + 7 kg dan oshgan yuk haqi`

`Yakuniy narx = tannarx + max(tannarx × ustama %, minimal foyda)`

7 kg gacha qo‘shimcha xalqaro yuk haqi olinmaydi. 7 kg dan oshgan har boshlangan 1 kg uchun 77 777 so‘m qo‘shiladi. Yakuniy narx 500 so‘mga yuqoriga yaxlitlanadi.

## Ustama pog‘onalari

| Tannarx | Ustama | Minimal foyda |
|---|---:|---:|
| 0–5 000 | 100% | 5 000 |
| 5 001–10 000 | 75% | 5 000 |
| 10 001–20 000 | 55% | 7 000 |
| 20 001–50 000 | 40% | 10 000 |
| 50 001–100 000 | 30% | 15 000 |
| 100 001–250 000 | 22% | 20 000 |
| 250 001–500 000 | 17% | 30 000 |
| 500 001+ | 12% | 50 000 |

## Server himoyasi

Yakuniy narx faqat brauzerga ishonib saqlanmaydi. Netlify funksiyasi formulani qayta hisoblaydi va mahsulotga `chinaPricing` snapshot sifatida yozadi.
