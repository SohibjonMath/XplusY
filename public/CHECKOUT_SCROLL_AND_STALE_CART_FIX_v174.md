# OrzuMall v174 — checkout + scroll lock fix

- Unified modal scroll-lock reconciler releases `html/body.modalOpen` only when no modal is visible.
- Navigation, close actions, `pageshow`, and browser history trigger reconciliation.
- Checkout hydrates selected cart products from Firestore before sending the order.
- Deleted/stale cart rows are removed with a clear retry message instead of blocking all checkout.
- Secure server checkout remains the source of truth for product links, prices, and inventory.
