# OrzuMall v190 — UZ / RU / EN translation completion

Customer-facing UI added in later releases is connected to the shared `OM_I18N` layer.

Covered areas:
- Home origin filters: All / UZB / China
- Home product card metrics and actions
- China and Uzbekistan delivery labels and ETA text
- External catalog product variant selectors
- Product page cargo information and quick-view trust blocks
- Product reviews summary, empty state and approved-review cards
- Verified-purchase review composer and quick feedback chips
- Customer order history, review states, order actions and receipts
- Common profile, wallet, delivery, pickup-point and notification labels

The customer-facing source platform remains hidden: Sahiy / 1688 / Pinduoduo / Uzum names are replaced by localized origin labels where required.

Cache-busting query strings in `public/index.html` were updated so browsers load the new dictionary and app render logic after deployment.
