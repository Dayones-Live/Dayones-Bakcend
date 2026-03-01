# Merch Product Specs Update - Design Document

**Date:** 2026-03-01
**Context:** Client provided exact SKU specs, pricing tiers, color codes, and image placement. Updating Milestone 1 backend to match.

---

## 1. Product Variant Model + SKU Config

### Entity Changes (merch_product)

Add columns:
- `size` (varchar, nullable) - null for poster
- `color` (varchar, nullable) - null for poster
- `color_code` (varchar, nullable) - hex code
- `printful_catalog_product_id` (int, nullable)

Each variant row gets its own `retail_price`. One row per size/color combo.

### Static SKU Config

| Product | Blank | Printful ID | Sizes | Price Tiers | Colors | Variants/Drop |
|---------|-------|-------------|-------|-------------|--------|---------------|
| Hoodie | Cotton Heritage M2580 | 380 | S,M,L,XL,2XL,3XL | S-XL $80, 2XL-3XL $85 | Black #080808, White #ffffff, Carbon Grey #c7c3be | 18 |
| Tee | Bella+Canvas 3001 | 71 | XS,S,M,L,XL,2XL,3XL,4XL,5XL | XS-2XL $40, 3XL-5XL $45 | Black #0b0b0b, White #ffffff, Athletic Heather #cececc | 27 |
| Tank | Bella+Canvas 3480 | 248 | S,M,L,XL,2XL | S-L $35, XL-2XL $40 | Black #131212, White #ffffff, Athletic Heather #AAA1A2 | 15 |
| Poster | Enhanced Matte Paper | 1 | 18x24 | $35 flat | n/a | 1 |

**Total: 61 merch_product rows per drop.**

Printful variant IDs resolved at runtime via catalog API, cached in-memory.

---

## 2. Image Normalization Service

New service: `src/modules/merch/services/image-normalization.service.ts`
Dependency: Sharp

### Print Canvas Specs (300 DPI)

| Product | Placement | Canvas (px) | Dimensions |
|---------|-----------|-------------|------------|
| Hoodie | Upper chest | 3600 x 2400 | 12" x 8" |
| Tee | Upper chest | 3600 x 2400 | 12" x 8" |
| Tank | Upper chest | 3000 x 2000 | 10" x 6.67" |
| Poster | Full bleed | 5400 x 7200 | 18" x 24" |

### Processing Steps

1. Download source image from S3 URL
2. Detect transparent background (preserve for garments)
3. Resize to fit within target canvas (maintain aspect ratio)
4. Garments: center on transparent canvas
5. Poster: resize to fill full canvas (cover mode)
6. Output PNG, upload to S3, return URL

One normalized image per product type (4 per drop, shared across all size/color variants).

---

## 3. Free Shipping + Order Flow

### Free Shipping

- Threshold: $95 (env var: MERCH_FREE_SHIPPING_THRESHOLD)
- If subtotal >= $95: shipping_cost = 0, skip Printful shipping rate call
- If subtotal < $95: call getShippingRates() as before

### Order Item Changes

- Variant-per-row model: merchProductId identifies exact size/color variant
- unit_price set directly from variant's retail_price
- No size/color lookup needed at order time

### Fulfillment Update

- Each order item's merch_product has printful_variant_id set during creation
- Build Printful order items using variant ID directly

---

## 4. Printful Catalog Variant Resolution

### New Service: printful-catalog.service.ts

- In-memory cache of variant mappings (Map keyed by product ID)
- `resolveVariantId(catalogProductId, size, color)` - matches size/color to Printful variant ID
- Color matching: fuzzy match by name, fallback to hex code
- Cache populated on first call, lives for app lifetime

### Integration in merch-creation.processor

1. Iterate SKU config size/color combos
2. Resolve Printful variant ID for each combo
3. Create merch_product row with printful_variant_id set
4. Call createSyncProduct() with normalized image + variant IDs
5. Save printful_product_id from response

Unresolvable variants logged as warnings and skipped. Drop activates with successful variants.

---

## 5. Return/Refund Status Flow

### New Order Statuses

- RETURN_REQUESTED - fan initiates return claim
- RETURN_APPROVED - Printful accepts (damaged/wrong item)
- RETURN_DENIED - Printful denies

### Changes

- Add 3 enum values to MerchOrderStatus
- Add PATCH /merch/orders/:id/return endpoint
- Printful handles actual return logistics via their dashboard
- Existing handleRefund() handles financial reversal when approved

---

## Migration Summary

- ALTER merch_products: add size, color, color_code, printful_catalog_product_id columns
- ALTER merch_order_status_enum: add RETURN_REQUESTED, RETURN_APPROVED, RETURN_DENIED values
- Add MERCH_FREE_SHIPPING_THRESHOLD to .env.example
