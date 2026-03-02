# M1 Remaining Tests Design

## Purpose

Fix and verify all untested M1 features to complete the backend engine milestone. Uses a fix-and-verify pipeline: address each issue, immediately test it, move to the next.

## Prerequisites

- Server running at https://api.dayones.app
- Test artist: hakeem@mailinator.com (a472356d), Stripe account acct_1T6OOo6i1EfLGVDc
- Test fan: hakeem2@mailinator.com (28171edb)
- Active drop: 5fd3b910-ede1-424b-8401-7a99d37f1bde (61 variants)
- Successfully processed order: e0a8e0f5 (Printful order 148136345, status PRODUCTION)

## Section 1: Critical Path (Fix + Test)

### Step 1: Fix Printful v2 Shipping Rates

**Problem:** `POST /v2/shipping/rates` returns 404.
**Fix:** Update endpoint to match Printful v2 API spec.
**Verify:** Create a sub-$95 order and confirm shippingCost > 0.

### Step 2: Fix Stripe Fee in Ledger

**Problem:** `balance_transaction` is null at webhook time, stripe_fee always 0.
**Fix:** Retrieve charge with expanded balance_transaction, or add retry with delay.
**Verify:** Confirm ledger entry has non-zero stripe_fee after payment.

### Step 3: Test package_shipped Webhook (Simulated)

**Method:** curl POST to `/api/v1/printful/webhooks` with fake payload.
**Payload:** `{ "type": "package_shipped", "data": { "order": { "id": 148136345, "costs": { "total": "12.50" }, "shipments": [{ "tracking_number": "TEST123", "tracking_url": "https://tracking.test/TEST123" }] } } }`
**Verify:**
- Order status PRODUCTION -> SHIPPED
- tracking_number = "TEST123"
- Ledger: printful_cost = 12.50, net_profit calculated, artist/platform shares set, status = CALCULATED

### Step 4: Test Refund Flow

**Method:** Call Stripe refund API on a paid order's PaymentIntent.
**Verify:**
- charge.refunded webhook fires
- Order status -> REFUNDED
- Ledger status -> REVERSED
- Printful cancel attempted (may fail for test orders, non-blocking)

### Step 5: Test Payout Processor

**Method:** Manually queue a payout-batch job via server script.
**Verify:**
- Creates PayoutBatch record
- Stripe Transfer to acct_1T6OOo6i1EfLGVDc
- Batch status = COMPLETED
- Ledger entries status = PAID_OUT

### Step 6: Test Payout Endpoints

**Method:** GET /merch/payouts and GET /merch/payouts/balance with artist token.
**Verify:** Returns correct payout history and unpaid balance.

## Section 2: Quick Verifications

### Step 7: Test Drop Expiry Cron

**Method:** Set test drop expires_at to past timestamp, wait 60s for cron.
**Verify:** Drop status ACTIVE -> EXPIRED.

### Step 8: Test Drop Cancellation

**Method:** DELETE /merch/drops/:id with artist token.
**Verify:** Drop status -> CANCELLED.

## Success Criteria

All 8 steps pass. Financial pipeline verified end-to-end: payment -> ledger -> shipping -> splits -> payout.
