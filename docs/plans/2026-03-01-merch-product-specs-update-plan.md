# Merch Product Specs Update - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update Milestone 1 backend to support variant-per-row pricing, image normalization, free shipping, Printful catalog resolution, and return status flows.

**Architecture:** Static SKU config drives product creation. Each size/color combo = one merch_product row mapped 1:1 to a Printful variant. Image normalization via Sharp produces print-ready PNGs per product type. Printful variant IDs resolved at runtime from catalog API and cached in-memory.

**Tech Stack:** NestJS, TypeORM, Sharp, Printful API v2, BullMQ

---

### Task 1: Install Sharp dependency

**Files:**
- Modify: `package.json`

**Step 1: Install sharp**

```bash
npm install sharp
npm install -D @types/sharp
```

**Step 2: Verify**

```bash
npx nest build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add package.json package-lock.json yarn.lock
git commit -m "Add sharp for image normalization"
```

---

### Task 2: Update constants and enums

**Files:**
- Modify: `src/modules/merch/constants/index.ts`

**Step 1: Add return statuses to MerchOrderStatus and remove HAT from ProductType**

Replace the full file content with:

```typescript
export enum MerchDropStatus {
  CREATING = 'CREATING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum ProductType {
  TSHIRT = 'TSHIRT',
  HOODIE = 'HOODIE',
  TANK = 'TANK',
  POSTER = 'POSTER',
}

export enum MerchOrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PRODUCTION = 'PRODUCTION',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURN_APPROVED = 'RETURN_APPROVED',
  RETURN_DENIED = 'RETURN_DENIED',
}

export enum LedgerStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  PAID_OUT = 'PAID_OUT',
  REVERSED = 'REVERSED',
}

export enum PayoutBatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
```

**Step 2: Verify build**

```bash
npx nest build
```

Expected: Build succeeds (HAT removal may cause build error in processor - that's fine, we'll fix it in Task 6)

**Step 3: Commit**

```bash
git add src/modules/merch/constants/index.ts
git commit -m "Add return status enums and remove HAT product type"
```

---

### Task 3: Create static SKU product catalog config

**Files:**
- Create: `src/modules/merch/constants/product-catalog.ts`

**Step 1: Create the catalog config file**

```typescript
import { ProductType } from './index';

export interface SkuColorConfig {
  name: string;
  hex: string;
}

export interface SkuPriceTier {
  sizes: string[];
  price: number;
}

export interface SkuConfig {
  productType: ProductType;
  name: string;
  blankName: string;
  printfulCatalogProductId: number;
  priceTiers: SkuPriceTier[];
  colors: SkuColorConfig[];
  printCanvasWidth: number;
  printCanvasHeight: number;
}

export const PRODUCT_CATALOG: SkuConfig[] = [
  {
    productType: ProductType.HOODIE,
    name: 'Tour Autograph Hoodie',
    blankName: 'Cotton Heritage M2580',
    printfulCatalogProductId: 380,
    priceTiers: [
      { sizes: ['S', 'M', 'L', 'XL'], price: 80 },
      { sizes: ['2XL', '3XL'], price: 85 },
    ],
    colors: [
      { name: 'Black', hex: '#080808' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Carbon Grey', hex: '#c7c3be' },
    ],
    printCanvasWidth: 3600,
    printCanvasHeight: 2400,
  },
  {
    productType: ProductType.TSHIRT,
    name: 'Tour Autograph Tee',
    blankName: 'Bella+Canvas 3001',
    printfulCatalogProductId: 71,
    priceTiers: [
      { sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'], price: 40 },
      { sizes: ['3XL', '4XL', '5XL'], price: 45 },
    ],
    colors: [
      { name: 'Black', hex: '#0b0b0b' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Athletic Heather', hex: '#cececc' },
    ],
    printCanvasWidth: 3600,
    printCanvasHeight: 2400,
  },
  {
    productType: ProductType.TANK,
    name: 'Tour Autograph Tank',
    blankName: 'Bella+Canvas 3480',
    printfulCatalogProductId: 248,
    priceTiers: [
      { sizes: ['S', 'M', 'L'], price: 35 },
      { sizes: ['XL', '2XL'], price: 40 },
    ],
    colors: [
      { name: 'Black', hex: '#131212' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Athletic Heather', hex: '#AAA1A2' },
    ],
    printCanvasWidth: 3000,
    printCanvasHeight: 2000,
  },
  {
    productType: ProductType.POSTER,
    name: 'Tour Autograph Poster',
    blankName: 'Enhanced Matte Paper Poster (in)',
    printfulCatalogProductId: 1,
    priceTiers: [
      { sizes: ['18x24'], price: 35 },
    ],
    colors: [],
    printCanvasWidth: 5400,
    printCanvasHeight: 7200,
  },
];

export function getRetailPrice(sku: SkuConfig, size: string): number {
  for (const tier of sku.priceTiers) {
    if (tier.sizes.includes(size)) return tier.price;
  }
  return sku.priceTiers[0].price;
}

export function getAllVariants(sku: SkuConfig): Array<{ size: string; color: string | null; colorCode: string | null; price: number }> {
  const variants: Array<{ size: string; color: string | null; colorCode: string | null; price: number }> = [];
  const allSizes = sku.priceTiers.flatMap((t) => t.sizes);

  if (sku.colors.length === 0) {
    for (const size of allSizes) {
      variants.push({ size, color: null, colorCode: null, price: getRetailPrice(sku, size) });
    }
  } else {
    for (const size of allSizes) {
      for (const color of sku.colors) {
        variants.push({ size, color: color.name, colorCode: color.hex, price: getRetailPrice(sku, size) });
      }
    }
  }
  return variants;
}
```

**Step 2: Verify build**

```bash
npx nest build
```

**Step 3: Commit**

```bash
git add src/modules/merch/constants/product-catalog.ts
git commit -m "Add static SKU product catalog config with 4 SKUs"
```

---

### Task 4: Update merch_product entity with new columns

**Files:**
- Modify: `src/modules/merch/entities/merch-product.entity.ts`

**Step 1: Add size, color, color_code, and printful_catalog_product_id columns**

Replace the full file with:

```typescript
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MerchDrop } from './merch-drop.entity';
import { ProductType } from '../constants';

@Entity('merch_products')
export class MerchProduct extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  merch_drop_id: string;

  @ManyToOne(() => MerchDrop, (drop) => drop.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merch_drop_id' })
  merchDrop: MerchDrop;

  @Column({ type: 'bigint', nullable: true })
  printful_product_id: number;

  @Column({ type: 'bigint', nullable: true })
  printful_variant_id: number;

  @Column({ type: 'int', nullable: true })
  printful_catalog_product_id: number;

  @Column({ type: 'enum', enum: ProductType })
  product_type: ProductType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  retail_price: number;

  @Column({ nullable: true })
  size: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  color_code: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ nullable: true })
  mockup_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Step 2: Verify build**

```bash
npx nest build
```

**Step 3: Commit**

```bash
git add src/modules/merch/entities/merch-product.entity.ts
git commit -m "Add size, color, color_code, printful_catalog_product_id to merch_product entity"
```

---

### Task 5: Create Printful catalog service for variant resolution

**Files:**
- Create: `src/modules/printful/printful-catalog.service.ts`
- Modify: `src/modules/printful/printful.service.ts` (add getCatalogVariants method)
- Modify: `src/modules/printful/printful.module.ts` (register new service)

**Step 1: Add getCatalogVariants to PrintfulService**

In `src/modules/printful/printful.service.ts`, add this method before the closing brace of the class (after getMockupResult):

```typescript
  async getCatalogVariants(catalogProductId: number): Promise<any> {
    try {
      const response = await this.client.get(`/v2/catalog-products/${catalogProductId}/catalog-variants`);
      return response.data;
    } catch (error) {
      this.logger.error(`Get catalog variants failed for product ${catalogProductId}: ${error.message}`);
      throw new HttpException('Printful catalog lookup failed', HttpStatus.BAD_GATEWAY);
    }
  }
```

**Step 2: Create PrintfulCatalogService**

Create `src/modules/printful/printful-catalog.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrintfulService } from './printful.service';

interface CatalogVariant {
  id: number;
  size: string;
  color: string;
  colorCode: string;
}

@Injectable()
export class PrintfulCatalogService {
  private readonly logger = new Logger(PrintfulCatalogService.name);
  private readonly variantCache = new Map<number, CatalogVariant[]>();

  constructor(private printfulService: PrintfulService) {}

  async resolveVariantId(catalogProductId: number, size: string, color: string | null): Promise<number | null> {
    const variants = await this.getVariants(catalogProductId);

    const sizeNorm = size.trim().toUpperCase();
    const colorNorm = color?.trim().toLowerCase() || null;

    let match = variants.find(
      (v) => v.size.toUpperCase() === sizeNorm && (colorNorm === null || v.color.toLowerCase() === colorNorm),
    );

    if (!match && colorNorm) {
      match = variants.find(
        (v) => v.size.toUpperCase() === sizeNorm && v.color.toLowerCase().includes(colorNorm),
      );
    }

    if (!match && colorNorm) {
      match = variants.find(
        (v) => v.size.toUpperCase() === sizeNorm && colorNorm.includes(v.color.toLowerCase()),
      );
    }

    if (!match) {
      this.logger.warn(`No variant found for product ${catalogProductId}, size=${size}, color=${color}`);
      return null;
    }

    return match.id;
  }

  private async getVariants(catalogProductId: number): Promise<CatalogVariant[]> {
    if (this.variantCache.has(catalogProductId)) {
      return this.variantCache.get(catalogProductId);
    }

    try {
      const response = await this.printfulService.getCatalogVariants(catalogProductId);
      const variants: CatalogVariant[] = (response?.result || []).map((v: any) => ({
        id: v.id,
        size: v.size || '',
        color: v.color || '',
        colorCode: v.color_code || '',
      }));

      this.variantCache.set(catalogProductId, variants);
      this.logger.log(`Cached ${variants.length} variants for catalog product ${catalogProductId}`);
      return variants;
    } catch (error) {
      this.logger.error(`Failed to fetch variants for product ${catalogProductId}: ${error.message}`);
      return [];
    }
  }
}
```

**Step 3: Update PrintfulModule**

In `src/modules/printful/printful.module.ts`, add the new service:

```typescript
import { Module } from '@nestjs/common';
import { PrintfulService } from './printful.service';
import { PrintfulCatalogService } from './printful-catalog.service';
import { PrintfulWebhookController } from './printful-webhook.controller';
import { PrintfulWebhookService } from './printful-webhook.service';

@Module({
  controllers: [PrintfulWebhookController],
  providers: [PrintfulService, PrintfulCatalogService, PrintfulWebhookService],
  exports: [PrintfulService, PrintfulCatalogService, PrintfulWebhookService],
})
export class PrintfulModule {}
```

**Step 4: Verify build**

```bash
npx nest build
```

**Step 5: Commit**

```bash
git add src/modules/printful/printful.service.ts src/modules/printful/printful-catalog.service.ts src/modules/printful/printful.module.ts
git commit -m "Add Printful catalog service with variant ID resolution and caching"
```

---

### Task 6: Create image normalization service

**Files:**
- Create: `src/modules/merch/services/image-normalization.service.ts`

**Step 1: Create the service**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ProductType } from '../constants';
import { PRODUCT_CATALOG, SkuConfig } from '../constants/product-catalog';

@Injectable()
export class ImageNormalizationService {
  private readonly logger = new Logger(ImageNormalizationService.name);
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
  }

  async normalizeForProduct(sourceImageUrl: string, productType: ProductType, dropId: string): Promise<string> {
    const sku = PRODUCT_CATALOG.find((s) => s.productType === productType);
    if (!sku) {
      throw new Error(`No SKU config for product type ${productType}`);
    }

    try {
      const imageBuffer = await this.downloadImage(sourceImageUrl);

      let outputBuffer: Buffer;
      if (productType === ProductType.POSTER) {
        outputBuffer = await this.createPosterImage(imageBuffer, sku);
      } else {
        outputBuffer = await this.createGarmentImage(imageBuffer, sku);
      }

      const s3Key = `merch/print-files/${dropId}/${productType.toLowerCase()}.png`;
      await this.uploadToS3(outputBuffer, s3Key);

      const url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
      this.logger.log(`Normalized image for ${productType}: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`Image normalization failed for ${productType}: ${error.message}`);
      throw error;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  private async createGarmentImage(imageBuffer: Buffer, sku: SkuConfig): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const srcWidth = metadata.width || 1;
    const srcHeight = metadata.height || 1;

    const canvasWidth = sku.printCanvasWidth;
    const canvasHeight = sku.printCanvasHeight;

    const scale = Math.min(canvasWidth / srcWidth, canvasHeight / srcHeight);
    const resizedWidth = Math.round(srcWidth * scale);
    const resizedHeight = Math.round(srcHeight * scale);

    const resized = await sharp(imageBuffer)
      .resize(resizedWidth, resizedHeight, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();

    const left = Math.round((canvasWidth - resizedWidth) / 2);
    const top = Math.round((canvasHeight - resizedHeight) / 2);

    return sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left, top }])
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  private async createPosterImage(imageBuffer: Buffer, sku: SkuConfig): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize(sku.printCanvasWidth, sku.printCanvasHeight, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  private async uploadToS3(buffer: Buffer, key: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      }),
    );
  }
}
```

**Step 2: Verify build**

```bash
npx nest build
```

**Step 3: Commit**

```bash
git add src/modules/merch/services/image-normalization.service.ts
git commit -m "Add image normalization service with Sharp for print-ready file generation"
```

---

### Task 7: Rewrite merch-creation processor for variant model

**Files:**
- Modify: `src/modules/merch/processors/merch-creation.processor.ts`

**Step 1: Replace the full processor**

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MerchProduct } from '../entities/merch-product.entity';
import { MerchService } from '../merch.service';
import { PrintfulService } from '../../printful/printful.service';
import { PrintfulCatalogService } from '../../printful/printful-catalog.service';
import { ImageNormalizationService } from '../services/image-normalization.service';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { PRODUCT_CATALOG, getAllVariants } from '../constants/product-catalog';

@Processor('merch-creation', { concurrency: 2 })
export class MerchCreationProcessor extends WorkerHost {
  private readonly logger = new Logger(MerchCreationProcessor.name);

  constructor(
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @InjectRepository(ArtistPost)
    private artistPostRepo: Repository<ArtistPost>,
    private merchService: MerchService,
    private printfulService: PrintfulService,
    private printfulCatalogService: PrintfulCatalogService,
    private imageNormalizationService: ImageNormalizationService,
  ) {
    super();
  }

  async process(job: Job<{ merchDropId: string; artistId: string; artistPostId: string }>): Promise<void> {
    const { merchDropId, artistId, artistPostId } = job.data;
    this.logger.log(`Processing merch creation for drop ${merchDropId}`);

    try {
      const artistPost = await this.artistPostRepo.findOne({ where: { id: artistPostId } });
      const sourceImageUrl = artistPost?.image_url || '';
      let createdCount = 0;

      for (const sku of PRODUCT_CATALOG) {
        try {
          let printFileUrl = sourceImageUrl;
          if (sourceImageUrl) {
            try {
              printFileUrl = await this.imageNormalizationService.normalizeForProduct(
                sourceImageUrl, sku.productType, merchDropId,
              );
            } catch (err) {
              this.logger.warn(`Image normalization failed for ${sku.productType}, using original: ${err.message}`);
            }
          }

          const variants = getAllVariants(sku);

          const printfulVariants: Array<{
            variant_id: number;
            retail_price: string;
            files: Array<{ type: string; url: string }>;
          }> = [];

          for (const variant of variants) {
            const printfulVariantId = await this.printfulCatalogService.resolveVariantId(
              sku.printfulCatalogProductId, variant.size, variant.color,
            );

            const product = new MerchProduct();
            product.merch_drop_id = merchDropId;
            product.product_type = sku.productType;
            product.retail_price = variant.price;
            product.size = variant.size;
            product.color = variant.color;
            product.color_code = variant.colorCode;
            product.printful_catalog_product_id = sku.printfulCatalogProductId;
            product.printful_variant_id = printfulVariantId;
            product.image_url = printFileUrl;

            await this.merchProductRepo.save(product);
            createdCount++;

            if (printfulVariantId) {
              printfulVariants.push({
                variant_id: printfulVariantId,
                retail_price: variant.price.toFixed(2),
                files: [{ type: 'default', url: printFileUrl }],
              });
            }
          }

          if (printfulVariants.length > 0) {
            try {
              const storeId = process.env.PRINTFUL_STORE_ID || '';
              const syncProduct = await this.printfulService.createSyncProduct(storeId, {
                name: `${sku.name} - Drop ${merchDropId.slice(0, 8)}`,
                thumbnail: printFileUrl,
                variants: printfulVariants,
              });

              const printfulProductId = syncProduct?.result?.id;
              if (printfulProductId) {
                await this.merchProductRepo
                  .createQueryBuilder()
                  .update(MerchProduct)
                  .set({ printful_product_id: printfulProductId })
                  .where('merch_drop_id = :merchDropId AND product_type = :productType', {
                    merchDropId,
                    productType: sku.productType,
                  })
                  .execute();
              }
            } catch (err) {
              this.logger.error(`Printful sync product creation failed for ${sku.productType}: ${err.message}`);
            }
          }

          this.logger.log(`Created ${variants.length} ${sku.productType} variants for drop ${merchDropId}`);
        } catch (error) {
          this.logger.error(`Failed to create ${sku.productType} for drop ${merchDropId}: ${error.message}`);
        }
      }

      await this.merchService.activateMerchDrop(merchDropId);
      this.logger.log(`Drop ${merchDropId} activated with ${createdCount} product variants`);
    } catch (error) {
      this.logger.error(`Merch creation job failed: ${error.message}`);
      throw error;
    }
  }
}
```

**Step 2: Verify build**

```bash
npx nest build
```

**Step 3: Commit**

```bash
git add src/modules/merch/processors/merch-creation.processor.ts
git commit -m "Rewrite merch-creation processor for variant-per-row model with catalog resolution"
```

---

### Task 8: Update merch-order.service with free shipping

**Files:**
- Modify: `src/modules/merch/merch-order.service.ts`

**Step 1: Update the createOrder method**

Replace the shipping cost calculation block (lines 83-101 in the current file). Find:

```typescript
      let shippingCost = 0;
      try {
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
            return { variant_id: Number(product.printful_variant_id), quantity: item.quantity };
          }),
        );
        shippingCost = parseFloat(shippingRates?.result?.[0]?.rate || '0');
      } catch (error) {
        this.logger.warn(`Shipping estimate failed, using 0: ${error.message}`);
      }
```

Replace with:

```typescript
      const freeShippingThreshold = parseFloat(process.env.MERCH_FREE_SHIPPING_THRESHOLD || '95');
      let shippingCost = 0;

      if (subtotal < freeShippingThreshold) {
        try {
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
              return { variant_id: Number(product.printful_variant_id), quantity: item.quantity };
            }),
          );
          shippingCost = parseFloat(shippingRates?.result?.[0]?.rate || '0');
        } catch (error) {
          this.logger.warn(`Shipping estimate failed, using 0: ${error.message}`);
        }
      }
```

**Step 2: Remove size/color from OrderItemDto (no longer needed at order time)**

In `src/modules/merch/dto/index.ts`, update OrderItemDto to remove size and color fields:

```typescript
export class OrderItemDto {
  @IsNotEmpty()
  @IsUUID()
  merchProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
```

And remove size/color from the order item save loop in merch-order.service.ts createOrder. Find:

```typescript
      for (const item of orderItems) {
        const orderItem = new MerchOrderItem();
        orderItem.merch_order_id = savedOrder.id;
        orderItem.merch_product_id = item.merch_product_id;
        orderItem.quantity = item.quantity;
        orderItem.unit_price = item.unit_price;
        orderItem.size = item.size;
        orderItem.color = item.color;
        await this.merchOrderItemRepo.save(orderItem);
      }
```

Replace with:

```typescript
      for (const item of orderItems) {
        const orderItem = new MerchOrderItem();
        orderItem.merch_order_id = savedOrder.id;
        orderItem.merch_product_id = item.merch_product_id;
        orderItem.quantity = item.quantity;
        orderItem.unit_price = item.unit_price;
        await this.merchOrderItemRepo.save(orderItem);
      }
```

And the orderItems building loop. Find:

```typescript
        orderItems.push({
          merch_product_id: item.merchProductId,
          quantity: item.quantity,
          unit_price: Number(product.retail_price),
          size: item.size,
          color: item.color,
        });
```

Replace with:

```typescript
        orderItems.push({
          merch_product_id: item.merchProductId,
          quantity: item.quantity,
          unit_price: Number(product.retail_price),
        });
```

**Step 3: Verify build**

```bash
npx nest build
```

**Step 4: Commit**

```bash
git add src/modules/merch/merch-order.service.ts src/modules/merch/dto/index.ts
git commit -m "Add free shipping threshold and simplify order items for variant model"
```

---

### Task 9: Add return request endpoint to controller

**Files:**
- Modify: `src/modules/merch/merch.controller.ts`
- Modify: `src/modules/merch/merch-order.service.ts`

**Step 1: Add requestReturn method to MerchOrderService**

Add this method at the end of the class in `merch-order.service.ts` (before the closing brace):

```typescript
  async requestReturn(orderId: string, userId: string): Promise<MerchOrder> {
    const order = await this.merchOrderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new HttpException(ERROR_MESSAGES.MERCH_ORDER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (order.fan_id !== userId) {
      throw new HttpException(ERROR_MESSAGES.NOT_AUTHORIZED_ACTION, HttpStatus.FORBIDDEN);
    }
    if (order.status !== MerchOrderStatus.SHIPPED && order.status !== MerchOrderStatus.DELIVERED) {
      throw new HttpException('Order must be shipped or delivered to request return', HttpStatus.BAD_REQUEST);
    }
    order.status = MerchOrderStatus.RETURN_REQUESTED;
    return this.merchOrderRepo.save(order);
  }
```

**Step 2: Add PATCH endpoint to MerchController**

Add this import at the top of `merch.controller.ts`:

Change the import line from:
```typescript
import { Controller, Post, Get, Delete, Param, Body, Req, Res, HttpStatus, Logger } from '@nestjs/common';
```
to:
```typescript
import { Controller, Post, Get, Delete, Patch, Param, Body, Req, Res, HttpStatus, Logger } from '@nestjs/common';
```

Add this endpoint after the listOrders method and before the listPayouts method:

```typescript
  @Patch('orders/:id/return')
  async requestReturn(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchOrderService.requestReturn(id, userId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }
```

**Step 3: Verify build**

```bash
npx nest build
```

**Step 4: Commit**

```bash
git add src/modules/merch/merch.controller.ts src/modules/merch/merch-order.service.ts
git commit -m "Add return request endpoint for order returns"
```

---

### Task 10: Update merch.module.ts with new providers

**Files:**
- Modify: `src/modules/merch/merch.module.ts`

**Step 1: Add ImageNormalizationService to module**

Replace the full file:

```typescript
import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import { MerchDrop } from './entities/merch-drop.entity';
import { MerchProduct } from './entities/merch-product.entity';
import { MerchOrder } from './entities/merch-order.entity';
import { MerchOrderItem } from './entities/merch-order-item.entity';
import { OrderLedger } from './entities/order-ledger.entity';
import { PayoutBatch } from './entities/payout-batch.entity';
import { MerchController } from './merch.controller';
import { MerchService } from './merch.service';
import { MerchOrderService } from './merch-order.service';
import { MerchPayoutService } from './merch-payout.service';
import { ImageNormalizationService } from './services/image-normalization.service';
import { MerchCreationProcessor } from './processors/merch-creation.processor';
import { OrderFulfillmentProcessor } from './processors/order-fulfillment.processor';
import { PayoutBatchProcessor } from './processors/payout-batch.processor';
import { StripeModule } from '../stripe/stripe.module';
import { PrintfulModule } from '../printful/printful.module';
import { StripeWebhookService } from '../stripe/stripe-webhook.service';
import { PrintfulWebhookService } from '../printful/printful-webhook.service';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MerchDrop,
      MerchProduct,
      MerchOrder,
      MerchOrderItem,
      OrderLedger,
      PayoutBatch,
      ArtistPost,
    ]),
    BullModule.registerQueue(
      { name: 'merch-creation' },
      { name: 'order-fulfillment' },
      { name: 'payout-batch' },
    ),
    forwardRef(() => StripeModule),
    PrintfulModule,
  ],
  controllers: [MerchController],
  providers: [
    MerchService,
    MerchOrderService,
    MerchPayoutService,
    ImageNormalizationService,
    MerchCreationProcessor,
    OrderFulfillmentProcessor,
    PayoutBatchProcessor,
  ],
  exports: [MerchService, MerchOrderService, MerchPayoutService],
})
export class MerchModule implements OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    private merchOrderService: MerchOrderService,
  ) {}

  onModuleInit() {
    try {
      const stripeWebhookService = this.moduleRef.get(StripeWebhookService, { strict: false });
      stripeWebhookService.setMerchOrderService(this.merchOrderService);
    } catch (e) {}

    try {
      const printfulWebhookService = this.moduleRef.get(PrintfulWebhookService, { strict: false });
      printfulWebhookService.setMerchOrderService(this.merchOrderService);
    } catch (e) {}
  }
}
```

**Step 2: Verify build**

```bash
npx nest build
```

**Step 3: Commit**

```bash
git add src/modules/merch/merch.module.ts
git commit -m "Register ImageNormalizationService in merch module"
```

---

### Task 11: Create migration for schema updates

**Files:**
- Create: `src/database/migrations/1772290000000-merch-product-variants.ts`

**Step 1: Create the migration**

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class MerchProductVariants1772290000000 implements MigrationInterface {
    name = 'MerchProductVariants1772290000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "size" character varying`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "color" character varying`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "color_code" character varying`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "printful_catalog_product_id" integer`);

        await queryRunner.query(`ALTER TYPE "public"."merch_orders_status_enum" ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED'`);
        await queryRunner.query(`ALTER TYPE "public"."merch_orders_status_enum" ADD VALUE IF NOT EXISTS 'RETURN_APPROVED'`);
        await queryRunner.query(`ALTER TYPE "public"."merch_orders_status_enum" ADD VALUE IF NOT EXISTS 'RETURN_DENIED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "printful_catalog_product_id"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "color_code"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "color"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "size"`);
    }
}
```

Note: `ALTER TYPE ... ADD VALUE` cannot be reverted in PostgreSQL (enum values cannot be removed). The down migration only handles the columns.

**Step 2: Verify build**

```bash
npx nest build
```

**Step 3: Commit**

```bash
git add src/database/migrations/1772290000000-merch-product-variants.ts
git commit -m "Add migration for merch product variant columns and return status enums"
```

---

### Task 12: Update .env.example with free shipping threshold

**Files:**
- Modify: `.env.example`

**Step 1: Add the new env var**

Add after the existing MERCH_ vars:

```
MERCH_FREE_SHIPPING_THRESHOLD=95
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "Add free shipping threshold to env example"
```

---

### Task 13: Final build verification

**Step 1: Clean build**

```bash
rm -rf dist && npx nest build
```

Expected: Build succeeds with zero errors

**Step 2: Verify all files are committed**

```bash
git status
git log --oneline -15
```

Expected: Clean working tree, all tasks committed

---

## Task Dependency Order

```
Task 1 (sharp) -> Task 6 (image normalization service)
Task 2 (constants) -> Task 3 (catalog config) -> Task 7 (processor rewrite)
Task 4 (entity update) -> Task 7 (processor rewrite)
Task 5 (printful catalog service) -> Task 7 (processor rewrite)
Task 6 -> Task 7
Task 7 -> Task 8 (order service update)
Task 8 -> Task 9 (return endpoint)
Task 9 -> Task 10 (module wiring)
Task 10 -> Task 11 (migration)
Task 11 -> Task 12 (env)
Task 12 -> Task 13 (final verify)
```

Independent tasks that can run in parallel:
- Tasks 1, 2, 3, 4, 5 are all independent of each other
- Task 6 depends only on Task 1
- Task 7 depends on Tasks 2, 3, 4, 5, 6
