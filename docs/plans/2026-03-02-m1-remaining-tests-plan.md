# M1 Remaining Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two broken features (shipping rates, stripe fee) and verify all untested M1 flows end-to-end on the deployed server.

**Architecture:** Fix-and-verify pipeline. Fix each broken thing, immediately test it, move to the next. All testing against live deployed server at https://api.dayones.app. No unit tests - this is integration/smoke testing against real Stripe and Printful APIs.

**Tech Stack:** NestJS, Stripe API, Printful v2 API, PostgreSQL, BullMQ, curl

---

### Task 1: Fix Printful v2 Shipping Rates

**Problem:** `POST /v2/shipping/rates` returns 404. The v2 endpoint is `/v2/shipping-rates` (hyphenated, no slash). Also, v2 uses `order_items` with `catalog_variant_id` format, not `items` with `variant_id`. And the response is a flat array with `price` field, not `result[0].rate`.

**Files:**
- Modify: `src/modules/printful/printful.service.ts:113-126` (getShippingRates)
- Modify: `src/modules/merch/merch-order.service.ts:86-99` (shipping call + response parsing)

**Step 1: Fix getShippingRates in printful.service.ts**

Change the endpoint from `/v2/shipping/rates` to `/v2/shipping-rates` and update the request body to use `order_items` with `catalog_variant_id` format:

```typescript
async getShippingRates(recipient: {
  address1: string; city: string; state_code: string; country_code: string; zip: string;
}, items: Array<{ catalog_variant_id: number; quantity: number }>): Promise<any> {
  try {
    const response = await this.client.post('/v2/shipping-rates', {
      recipient,
      order_items: items.map((item) => ({
        source: 'catalog',
        catalog_variant_id: item.catalog_variant_id,
        quantity: item.quantity,
      })),
      currency: 'USD',
    });
    return response.data;
  } catch (error) {
    this.logger.error(`Get shipping rates failed: ${error.message}`);
    throw new HttpException('Printful shipping estimate failed', HttpStatus.BAD_GATEWAY);
  }
}
```

**Step 2: Fix the caller in merch-order.service.ts**

Update the shipping rates call to pass `catalog_variant_id` instead of `variant_id`, and fix response parsing from `shippingRates?.result?.[0]?.rate` to the v2 array format `shippingRates?.[0]?.price`:

```typescript
const shippingRates = await this.printfulService.getShippingRates(
  {
    address1: dto.shippingAddress.address1,
    city: dto.shippingAddress.city,
    state_code: dto.shippingAddress.state_code,
    country_code: dto.shippingAddress.country_code,
    zip: dto.shippingAddress.zip,
  },
  dto.items.map((item) => {
    const product = drop.products.find((p) => p.id === item.merchProductId);
    return { catalog_variant_id: Number(product.printful_variant_id), quantity: item.quantity };
  }),
);
shippingCost = parseFloat(shippingRates?.[0]?.price || '0');
```

Note: `shippingRates` is the Printful v2 response which is an array of shipping options. Each has `id`, `name`, `price`, `currency`. We take the first (cheapest/standard) option.

**Step 3: Commit**

```bash
git add src/modules/printful/printful.service.ts src/modules/merch/merch-order.service.ts
git commit -m "Fix Printful v2 shipping rates: correct endpoint, request format, response parsing"
```

**Step 4: Deploy and verify**

```bash
ssh ubuntu@44.202.63.106 "export NVM_DIR=... && cd ~/daysone-backend && git pull && npm run build && pm2 restart all"
```

Create a sub-$95 order (1 poster at $50) and verify `shippingCost > 0` in the response. If Printful returns a rate, shipping is fixed.

---

### Task 2: Fix Stripe Fee in Ledger

**Problem:** When the `payment_intent.succeeded` webhook fires, the charge's `balance_transaction` is null because Stripe hasn't processed it yet. The current code returns 0 for the fee.

**Files:**
- Modify: `src/modules/stripe/stripe.service.ts:103-113` (getBalanceTransaction)

**Step 1: Fix getBalanceTransaction to use expand parameter**

Retrieve the charge with `expand: ['balance_transaction']` to force Stripe to include it inline:

```typescript
async getBalanceTransaction(chargeId: string): Promise<number> {
  const charge = await this.stripe.charges.retrieve(chargeId, {
    expand: ['balance_transaction'],
  });
  if (!charge.balance_transaction) {
    return 0;
  }
  const bt = typeof charge.balance_transaction === 'string'
    ? await this.stripe.balanceTransactions.retrieve(charge.balance_transaction)
    : charge.balance_transaction;
  return bt.fee / 100;
}
```

With `expand`, Stripe returns the full balance_transaction object inline rather than just the ID. If it's still null (edge case), we fall back to 0.

**Step 2: Commit**

```bash
git add src/modules/stripe/stripe.service.ts
git commit -m "Fix stripe fee: expand balance_transaction when retrieving charge"
```

**Step 3: Deploy and verify**

Deploy, create a new order, confirm payment, wait for webhook. Check DB:

```sql
SELECT stripe_fee FROM order_ledger WHERE merch_order_id = '<new_order_id>';
```

Expected: `stripe_fee > 0` (Stripe test mode fee is typically 2.9% + $0.30, so for $80 order: ~$2.62).

---

### Task 3: Test package_shipped Webhook

**Problem:** Never tested. The `package_shipped` event triggers ledger calculation (printful_cost, net_profit, artist/platform splits).

**Files:** No code changes needed. Testing only.

**Step 1: Identify a PRODUCTION-status order with a ledger entry**

Query DB for an order that's in PRODUCTION status with a valid printful_order_id and a ledger entry.

```sql
SELECT o.id, o.printful_order_id, o.status, l.id as ledger_id, l.gross_revenue, l.stripe_fee, l.status as ledger_status
FROM merch_orders o
JOIN order_ledger l ON l.merch_order_id = o.id
WHERE o.status = 'PRODUCTION' AND o.printful_order_id IS NOT NULL
LIMIT 1;
```

**Step 2: Send simulated package_shipped webhook**

```bash
curl -X POST https://api.dayones.app/api/v1/printful/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "package_shipped",
    "data": {
      "order": {
        "id": <PRINTFUL_ORDER_ID>,
        "costs": { "total": "12.50" },
        "shipments": [{
          "tracking_number": "TRACK-SMOKE-001",
          "tracking_url": "https://tracking.example.com/TRACK-SMOKE-001"
        }]
      }
    }
  }'
```

**Step 3: Verify DB state**

```sql
SELECT o.status, o.tracking_number, o.tracking_url,
       l.printful_cost, l.net_profit, l.artist_share, l.platform_share, l.status as ledger_status
FROM merch_orders o
JOIN order_ledger l ON l.merch_order_id = o.id
WHERE o.id = '<ORDER_ID>';
```

Expected:
- Order status = `SHIPPED`
- tracking_number = `TRACK-SMOKE-001`
- Ledger: printful_cost = 12.50, net_profit = gross_revenue - stripe_fee - 12.50
- artist_share = net_profit * 0.70 (rounded to 2 decimals)
- platform_share = net_profit * 0.30
- ledger status = `CALCULATED`

---

### Task 4: Test Refund Flow

**Problem:** Never tested. The `charge.refunded` webhook should mark order REFUNDED and ledger REVERSED.

**Files:** No code changes needed. Testing only.

**Step 1: Find a PAID order to refund (or use one of the earlier test orders)**

Pick an order that's in PAID status. Use the Stripe API to refund it:

```bash
curl -X POST https://api.stripe.com/v1/refunds \
  -u "rk_test_51T55w0...:" \
  -d payment_intent=<PAYMENT_INTENT_ID>
```

**Step 2: Wait for webhook and verify**

Wait ~5 seconds for the `charge.refunded` webhook to fire.

```sql
SELECT o.status, l.status as ledger_status
FROM merch_orders o
LEFT JOIN order_ledger l ON l.merch_order_id = o.id
WHERE o.stripe_payment_intent_id = '<PAYMENT_INTENT_ID>';
```

Expected: order status = `REFUNDED`, ledger status = `REVERSED`.

Check server logs for Printful cancel attempt (may fail for test orders, that's fine).

---

### Task 5: Test Payout Processor

**Problem:** Never tested. The bi-weekly cron does Stripe Transfers to artist connected accounts.

**Prerequisite:** Task 3 must complete first. We need at least one ledger entry with status `CALCULATED` and a non-zero `artist_share`.

**Files:** No code changes expected. May need fixes if transfer fails.

**Step 1: Verify preconditions**

```sql
SELECT l.id, l.artist_share, l.status, o.artist_id
FROM order_ledger l
JOIN merch_orders o ON o.id = l.merch_order_id
WHERE l.status = 'CALCULATED' AND l.payout_batch_id IS NULL;
```

Should have at least one entry with artist_share >= $5.00.

**Step 2: Manually trigger payout processor**

SSH into server and run a script to add a job to the payout-batch queue:

```bash
ssh ubuntu@44.202.63.106 "export NVM_DIR=... && cd ~/daysone-backend && node -e \"
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const conn = new Redis({ host: 'localhost', port: 6379 });
const q = new Queue('payout-batch', { connection: conn });
q.add('process-payouts', {}).then(() => { console.log('Job added'); conn.quit(); });
\""
```

**Step 3: Check logs and verify**

Wait ~10 seconds, then check PM2 logs for payout processing messages.

```sql
SELECT id, artist_id, total_amount, order_count, status, stripe_transfer_id
FROM payout_batches
ORDER BY created_at DESC LIMIT 1;
```

Expected: status = `COMPLETED`, stripe_transfer_id set, total_amount = sum of artist_shares.

Also verify ledger entries updated:

```sql
SELECT status, payout_batch_id FROM order_ledger WHERE status = 'PAID_OUT';
```

---

### Task 6: Test Payout Endpoints

**Problem:** Never tested. Two GET endpoints for artist payout data.

**Files:** No code changes. Testing only.

**Step 1: Get artist auth token**

```bash
TOKEN=$(aws cognito-idp initiate-auth ... --query 'AuthenticationResult.AccessToken' --output text)
```

Use artist hakeem@mailinator.com credentials. Need to compute SECRET_HASH for this user too.

**Step 2: Test GET /merch/payouts**

```bash
curl -s https://api.dayones.app/api/v1/merch/payouts \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: Array of payout batches (should include the one from Task 5).

**Step 3: Test GET /merch/payouts/balance**

```bash
curl -s https://api.dayones.app/api/v1/merch/payouts/balance \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `{ balance: <number>, orderCount: <number> }`. If all calculated entries were paid out in Task 5, balance should be 0.

---

### Task 7: Test Drop Expiry Cron

**Problem:** Never verified. Cron runs every minute, should expire ACTIVE drops past `expires_at`.

**Files:** No code changes. Testing only.

**Step 1: Set drop expires_at to past**

```sql
UPDATE merch_drops SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = '5fd3b910-ede1-424b-8401-7a99d37f1bde';
```

**Step 2: Wait 60-90 seconds for cron**

**Step 3: Verify**

```sql
SELECT id, status, expires_at FROM merch_drops WHERE id = '5fd3b910-ede1-424b-8401-7a99d37f1bde';
```

Expected: status = `EXPIRED`.

Check logs for `Expired 1 merch drops` message.

**Step 4: Create a new drop for remaining tests (if needed)**

If we need an active drop later, create one. Otherwise leave it expired.

---

### Task 8: Test Drop Cancellation

**Problem:** Never tested. DELETE endpoint changes drop status to CANCELLED.

**Files:** No code changes. Testing only.

**Step 1: Create a new drop to cancel (or use a non-active one)**

If the drop from Task 7 is now EXPIRED, we can try to cancel it (or create a fresh one).

```bash
TOKEN=<artist_token>
curl -s -X DELETE https://api.dayones.app/api/v1/merch/drops/<DROP_ID> \
  -H "Authorization: Bearer $TOKEN"
```

**Step 2: Verify**

```sql
SELECT id, status FROM merch_drops WHERE id = '<DROP_ID>';
```

Expected: status = `CANCELLED`.

---

## Execution Order

Tasks 1-2 are code fixes (must deploy before testing). Tasks 3-8 are pure verification.

```
Task 1 (fix shipping) → Task 2 (fix stripe fee) → deploy both →
Task 3 (test shipped webhook) → Task 4 (test refund) →
Task 5 (test payout) → Task 6 (test payout endpoints) →
Task 7 (test drop expiry) → Task 8 (test drop cancel)
```

Tasks 1+2 can be committed together in one deploy cycle. Task 5 depends on Task 3 (needs CALCULATED ledger entries).
