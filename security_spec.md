# Firestore Security Specification (`orders`)

## 1. Data Invariants
- All collections default-deny unless explicitly matched.
- Every document ID `{orderId}` must satisfy `^[a-zA-Z0-9_-]+$` and length `<= 128`.
- New documents in `/orders/{orderId}` MUST have exact allowed keys (`hasAll` + `hasOnly`), `status == 'Kutilmoqda'`, `driver == 'Biriktirilmagan'`, `createdAt == request.time`, and `updatedAt == request.time`.
- Strings enforce strict `maxLength` bounds matching `firebase-blueprint.json`.
- Coordinates, `narxi` (`>= 0 && <= 50000000`), and `masofasi` (`>= 0 && <= 5000`) are bounded finite numbers.
- `allow list: if false;` prevents bulk scraping of passenger orders and phone numbers.
- Terminal states (`'Yakunlandi'`, `'Bekor qilindi'`) cannot be mutated further.

## 2. Dirty Dozen Adversarial Payloads
1. Create order with `status: 'Qabul qilindi'` instead of `'Kutilmoqda'` -> DENIED.
2. Create order with `driver: 'Some Bot'` instead of `'Biriktirilmagan'` -> DENIED.
3. Create order with extra shadow field `isAdmin: true` -> DENIED (`hasOnly`).
4. Create order with missing required field `mijozTelefoni` -> DENIED (`hasAll`).
5. Create order with client-forged `createdAt` instead of `request.time` -> DENIED.
6. Create order with 10KB `qayerdan` string (`> 300`) -> DENIED.
7. Create order with negative `narxi: -5000` -> DENIED.
8. Create order with invalid `orderId` (`../etc/passwd`) -> DENIED (`isValidId`).
9. List `/orders` collection (`list` query) -> DENIED (`allow list: if false`).
10. Update an order already in `'Bekor qilindi'` or `'Yakunlandi'` state -> DENIED.
11. Update `narxi` or `createdAt` after order creation -> DENIED (`affectedKeys().hasOnly(['status', 'updatedAt'])`).
12. Delete any `/orders/{orderId}` document -> DENIED (`allow delete: if false`).
