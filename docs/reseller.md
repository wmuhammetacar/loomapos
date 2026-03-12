# Reseller Model

## 1. Entities
- `reseller_accounts`
- `reseller_customers`
- `commissions`
- `payouts`

## 2. Lifecycle
1. Reseller applies (`POST /commerce/reseller/apply`).
2. Account status starts as `pending` (admin approval flow can promote to `approved`).
3. Reseller shares referral code.
4. Customer checkout includes `resellerCode`.
5. Checkout links customer tenant to reseller and creates commission accrual.

## 3. Commission Formula
For each paid invoice:
- `commission_amount = invoice_total * commission_rate`
- stored in `commissions` with status `accrued`.

Example:
- Invoice: 999 TRY
- Rate: 0.10
- Commission: 99.90 TRY

## 4. Dashboard Metrics
- `customerCount`
- `accruedTotal`
- `paidTotal`
- recent commission rows (tenant, amount, status, timestamps)

## 5. Payout Strategy (v1.1/v2)
- Batch accrued commissions by period.
- Create `payouts` rows:
  - `pending` -> `paid`
- On payout completion:
  - mark covered commissions as `paid`,
  - set `paid_at`.

## 6. Controls and RBAC
- Reseller dashboard should expose only reseller-owned data.
- Admin can:
  - approve/reject reseller,
  - override commission rate,
  - trigger payout processing.

## 7. Audit
Recommended audit actions:
- `RESELLER_APPLIED`
- `RESELLER_APPROVED`
- `RESELLER_CUSTOMER_LINKED`
- `COMMISSION_ACCRUED`
- `COMMISSION_PAID`
