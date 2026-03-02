# M1 Smoke Test Design

## Purpose

Validate the complete Milestone 1 merch automation backend by walking through the real user flow end-to-end on the deployed production server (`https://api.dayones.app`).

## Test Users

| Role | Name | Email | User ID | Cognito Sub |
|------|------|-------|---------|-------------|
| Artist | Hakeem | hakeem@mailinator.com | a472356d-... | 84881498-... |
| Fan | Hakeem2 | hakeem2@mailinator.com | 28171edb-... | b4f83428-... |

## Test Flow

### Section 1: Stripe Connect Onboarding

1. `POST /stripe/connect/onboard` (artist token) -> get Stripe onboarding URL
2. Open URL in browser, complete test onboarding with fake data
3. Stripe fires `account.updated` webhook -> backend updates status
4. `GET /stripe/connect/status` -> verify `connected: true`, `onboarding_complete: true`

**Validates:** Stripe account creation, onboarding link, webhook handling, status tracking.

### Section 2: Merch Drop Creation

1. `POST /merch/drops` with `{ "artistPostId": "d021b48f-f7f7-481b-a782-c09eee109808" }` -> get drop ID, status `CREATING`
2. Wait for BullMQ job to process (~5-10s)
3. `GET /merch/drops/:id` -> verify:
   - Status = `ACTIVE`
   - ~40 product variants created (4 SKUs x size/color combos)
   - Correct `retail_price`, `size`, `color`, `color_code`, `printful_catalog_product_id` per variant
4. Query DB: confirm `printful_product_id` set on products (Printful sync created)
5. Verify sync products exist in Printful store via API

**Validates:** BullMQ processing, image normalization, product catalog expansion, Printful API integration, variant pricing tiers.

### Section 3: Order Flow (Fan Purchase)

1. Select product variants from drop (1 hoodie + 1 tee, subtotal > $95 for free shipping)
2. `POST /merch/orders` (fan token) -> verify `clientSecret`, `orderId`, `orderNumber`, correct `total`, `shippingCost: 0`
3. Confirm PaymentIntent via Stripe API with test card `pm_card_visa`
4. Wait for `payment_intent.succeeded` webhook
5. `GET /merch/orders/:id` -> verify status = `PAID`
6. Wait for order-fulfillment job
7. Verify status = `PRODUCTION`, `printful_order_id` set
8. Query `order_ledger` -> verify `gross_revenue`, `stripe_fee` populated

**Validates:** Pricing, free shipping, Stripe PaymentIntent, webhook processing, Printful order submission, financial ledger.

### Section 4: Return Request

1. `PATCH /merch/orders/:id/return` (fan token) -> verify status = `RETURN_REQUESTED`
2. `GET /merch/orders/:id` -> confirm status persisted

**Validates:** Return status flow, fan-only authorization.

## Success Criteria

All 4 sections pass without errors. Every status transition works. Financial data is correctly tracked in the ledger.
