# Merch Automation Design - Milestone 1 (Backend Engine)

## Overview

Automated merchandise pipeline for DayOnes. When an artist creates a post/drop and confirms merch creation, the system auto-generates 4 products (t-shirt, hoodie, tank, poster) using the artist's autograph image via Printful. Fans purchase within a 48-hour FOMO window. DayOnes collects 100%, deducts costs, splits net profit 70/30 (artist/platform), and pays artists bi-weekly via Stripe Connect.

## Architecture Decision

**Monolithic NestJS + BullMQ** -- all new modules added to the existing NestJS backend. BullMQ (backed by Redis on the same EC2) handles async Printful operations. NestJS Schedule handles cron jobs. No new infrastructure beyond Redis.

## Confirmed Requirements

- Trigger: Post/drop creation with confirmation prompt (artist opts in per drop)
- Products: 4 (t-shirt, hoodie, tank, poster), expandable to 5 (hats TBD)
- Store window: 48 hours after drop creation, then closes
- Storefront: In-app only (React Native, Milestone 2)
- Payment: DayOnes collects 100% via standard Stripe charge
- Net profit: retail - Stripe fee - Printful cost
- Split: 70% artist / 30% platform on net profit
- Payouts: bi-weekly batch via Stripe Connect transfers
- Shipping: passed to fan at checkout
- Image: scale to fit at 300 DPI, transparent background, chest area on garments
- Refunds: reverse ledger, cancel Printful order if in production

## Database Schema

### stripe_accounts

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK -> users | unique, one per artist |
| stripe_account_id | string | acct_xxx |
| onboarding_complete | boolean | false until KYC done |
| payouts_enabled | boolean | set by Stripe |
| created_at | timestamp | |
| updated_at | timestamp | |

### merch_drops

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| artist_post_id | UUID FK -> artist_posts | unique |
| artist_id | UUID FK -> users | denormalized |
| status | enum | CREATING, ACTIVE, EXPIRED, CANCELLED |
| expires_at | timestamp | created_at + 48h |
| created_at | timestamp | |
| updated_at | timestamp | |

### merch_products

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| merch_drop_id | UUID FK -> merch_drops | |
| printful_product_id | bigint | Printful sync product ID |
| printful_variant_id | bigint | Printful sync variant ID |
| product_type | enum | TSHIRT, HOODIE, TANK, POSTER |
| retail_price | decimal(10,2) | |
| image_url | string | S3 URL of processed image |
| mockup_url | string | nullable |
| created_at | timestamp | |

### merch_orders

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| order_number | string | unique, DO-YYYYMMDD-XXXX |
| merch_drop_id | UUID FK -> merch_drops | |
| fan_id | UUID FK -> users | |
| artist_id | UUID FK -> users | denormalized |
| stripe_payment_intent_id | string | pi_xxx |
| printful_order_id | bigint | nullable |
| status | enum | PENDING, PAID, PRODUCTION, SHIPPED, DELIVERED, REFUNDED, CANCELLED |
| subtotal | decimal(10,2) | |
| shipping_cost | decimal(10,2) | |
| total | decimal(10,2) | |
| shipping_address | jsonb | |
| tracking_number | string | nullable |
| tracking_url | string | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### merch_order_items

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| merch_order_id | UUID FK -> merch_orders | |
| merch_product_id | UUID FK -> merch_products | |
| quantity | int | |
| unit_price | decimal(10,2) | |
| printful_cost | decimal(10,2) | nullable |
| size | string | nullable |
| color | string | nullable |

### order_ledger

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| merch_order_id | UUID FK -> merch_orders | unique |
| gross_revenue | decimal(10,2) | |
| stripe_fee | decimal(10,2) | |
| printful_cost | decimal(10,2) | |
| net_profit | decimal(10,2) | |
| artist_share | decimal(10,2) | net_profit * 0.70 |
| platform_share | decimal(10,2) | net_profit * 0.30 |
| status | enum | PENDING, CALCULATED, PAID_OUT, REVERSED |
| payout_batch_id | UUID FK -> payout_batches | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### payout_batches

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| artist_id | UUID FK -> users | |
| stripe_transfer_id | string | tr_xxx |
| total_amount | decimal(10,2) | |
| order_count | int | |
| period_start | date | |
| period_end | date | |
| status | enum | PENDING, PROCESSING, COMPLETED, FAILED |
| created_at | timestamp | |

## Module Structure

```
src/modules/
  stripe/
    stripe.module.ts
    stripe.controller.ts
    stripe.service.ts
    stripe-webhook.service.ts

  printful/
    printful.module.ts
    printful.service.ts
    printful-webhook.controller.ts
    printful-webhook.service.ts

  merch/
    merch.module.ts
    merch.controller.ts
    merch.service.ts
    merch-order.service.ts
    merch-payout.service.ts
    processors/
      merch-creation.processor.ts
      order-fulfillment.processor.ts
      payout-batch.processor.ts
```

## API Endpoints

### Stripe Connect
- POST /api/v1/stripe/connect/onboard (Artist) - create Connect account, return onboarding URL
- GET /api/v1/stripe/connect/status (Artist) - check onboarding/payout status
- POST /api/v1/stripe/webhooks (public, signature verified) - Stripe events

### Merch Drops
- POST /api/v1/merch/drops (Artist) - create merch drop for a post
- GET /api/v1/merch/drops/:id (Any) - get drop with products
- GET /api/v1/merch/drops/post/:postId (Any) - get drop by post ID
- DELETE /api/v1/merch/drops/:id (Artist owner) - cancel drop

### Merch Orders
- POST /api/v1/merch/orders (Fan) - create order + PaymentIntent
- GET /api/v1/merch/orders/:id (Fan/Artist) - order details + tracking
- GET /api/v1/merch/orders (Fan/Artist) - list orders

### Printful Webhooks
- POST /api/v1/printful/webhooks (public, secret verified) - Printful events

### Artist Payouts
- GET /api/v1/merch/payouts (Artist) - payout history
- GET /api/v1/merch/payouts/balance (Artist) - current unpaid balance

## Core Flows

### Flow 1: Artist Creates Merch Drop
1. Artist creates post (existing endpoint)
2. App shows confirmation prompt
3. POST /api/v1/merch/drops { artistPostId }
4. Validates: artist owns post, Stripe onboarding complete, no existing drop
5. Creates merch_drop (CREATING), queues BullMQ merch-creation job
6. Worker: for each product type, fetch autograph from S3, process image, upload to Printful, create sync product, save merch_product, request mockup
7. All done: status CREATING -> ACTIVE, push notification to artist

### Flow 2: Fan Purchases Merch
1. Fan browses drop, selects items/sizes/address
2. POST /api/v1/merch/orders
3. Validates drop is ACTIVE and not expired
4. Gets Printful shipping estimate
5. Creates Stripe PaymentIntent (subtotal + shipping)
6. Returns clientSecret to app
7. App completes payment (Milestone 2)
8. Stripe webhook: payment_intent.succeeded
9. Order status PENDING -> PAID, create ledger (PENDING), get Stripe fee
10. Queue order-fulfillment job
11. Worker: create Printful order, status PAID -> PRODUCTION

### Flow 3: Fulfillment & Ledger
1. Printful webhook: order.shipped
2. Save tracking info, get actual Printful costs
3. Calculate: net_profit = gross - stripe_fee - printful_cost
4. artist_share = net_profit * 0.70, platform_share = net_profit * 0.30
5. Ledger status PENDING -> CALCULATED
6. Push notification to fan

### Flow 4: Bi-Weekly Payout
1. Cron: 1st and 15th of month
2. Query CALCULATED ledger entries without payout_batch_id
3. Group by artist, sum artist_share
4. For each artist above threshold: create payout_batch, Stripe Transfer, update ledger entries
5. Push notification to artist

### Flow 5: 48-Hour Expiry
1. Cron: every 15 minutes
2. Query ACTIVE drops past expires_at
3. Update to EXPIRED (existing orders continue, new orders blocked)

### Flow 6: Refund/Chargeback
1. Stripe webhook: charge.refunded or charge.dispute.created
2. Order status -> REFUNDED/CANCELLED
3. Reverse ledger (if PAID_OUT, negative entry for next payout)
4. Cancel Printful order if in production

## Error Handling

- Printful product creation fails: BullMQ retries 3x with backoff, drop stays CREATING, artist notified
- Mockup generation fails: non-blocking, product still purchasable
- Printful order creation fails after payment: retries 5x, flags for manual review, no auto-refund
- Printful wallet empty: alert admin, queue for retry
- Stripe webhook duplicate: deduplicate by event.id
- Printful webhook duplicate: deduplicate by order_id + event_type
- Transfer to artist fails: batch status FAILED, retry next run
- Negative profit (cost > retail): artist_share floors at $0, platform absorbs loss, flag for review
- Dispute after payout: negative ledger entry deducted from next payout, 60-day flag if unresolved

## Infrastructure

### New Dependencies
- @nestjs/bull + bullmq (job queues)
- @nestjs/schedule (cron jobs)
- stripe (Stripe SDK)
- ioredis (Redis for BullMQ)

### BullMQ Queues
- merch-creation (concurrency: 2)
- order-fulfillment (concurrency: 2)
- payout-batch (concurrency: 1)

### Cron Jobs
- Store expiry: every 15 minutes
- Payout batch: 1st and 15th, midnight

### Environment Variables
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_RETURN_URL, STRIPE_CONNECT_REFRESH_URL
- PRINTFUL_API_TOKEN, PRINTFUL_WEBHOOK_SECRET, PRINTFUL_STORE_ID
- REDIS_HOST, REDIS_PORT
- MERCH_DROP_DURATION_HOURS (48), MERCH_ARTIST_SPLIT (0.70), MERCH_PLATFORM_SPLIT (0.30)
- MERCH_PAYOUT_MIN_THRESHOLD (5.00), MERCH_PAYOUT_CRON (0 0 1,15 * *)

### Deployment
- Redis on same EC2 (apt install redis-server)
- Webhook URLs: dayones.live/api/v1/stripe/webhooks, dayones.live/api/v1/printful/webhooks
- Same deploy workflow: git pull, npm run build, pm2 restart
