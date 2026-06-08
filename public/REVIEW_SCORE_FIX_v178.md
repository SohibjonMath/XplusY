# OrzuMall v178 — review score fix

- Removed failing browser-side Firestore aggregate requests for product review stats.
- Rating average and review count are calculated from the same approved review rows shown to customers.
- Product page immediately updates the stats cache from the successfully fetched review list.
- Mobile product cards keep the compact rating, views and popularity row.
