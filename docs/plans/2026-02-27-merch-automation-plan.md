# Merch Automation Implementation Plan (Milestone 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the backend engine for automated merchandise creation, ordering, payment processing, and artist payouts using Stripe Connect + Printful.

**Architecture:** Monolithic NestJS + BullMQ. New modules (stripe, printful, merch) added to existing backend. Redis on same EC2 for BullMQ queues. Cron jobs via @nestjs/schedule (already configured). TypeORM entities with PostgreSQL.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Stripe Connect (Express), Printful API v2, BullMQ, Redis, ioredis

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install production dependencies**

Run: `cd /Volumes/external/hevin/freelancing/Fiverr/Clients/ericbush996/Dayones-Bakcend && npm install stripe @nestjs/bullmq bullmq ioredis axios`

Note: @nestjs/schedule is already installed and configured (ScheduleModule.forRoot() in app.config.module.ts). axios may already be installed -- npm will handle it.

**Step 2: Verify installation**

Run: `cd /Volumes/external/hevin/freelancing/Fiverr/Clients/ericbush996/Dayones-Bakcend && npx nest build`
Expected: BUILD SUCCESSFUL

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add stripe, bullmq, and ioredis dependencies for merch automation"
```

---

## Task 2: Add Enums and Constants

**Files:**
- Modify: `src/shared/constants/constants.ts`
- Create: `src/modules/merch/constants/index.ts`
- Create: `src/modules/stripe/constants/index.ts`

**Step 1: Add merch enums**

Create `src/modules/merch/constants/index.ts`:

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
  HAT = 'HAT',
}

export enum MerchOrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PRODUCTION = 'PRODUCTION',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
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

**Step 2: Add stripe constants**

Create `src/modules/stripe/constants/index.ts`:

```typescript
export enum StripeWebhookEvents {
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED = 'payment_intent.payment_failed',
  CHARGE_REFUNDED = 'charge.refunded',
  CHARGE_DISPUTE_CREATED = 'charge.dispute.created',
  ACCOUNT_UPDATED = 'account.updated',
}
```

**Step 3: Add merch error/success messages to constants.ts**

Add to the existing ERROR_MESSAGES and SUCCESS_MESSAGES enums in `src/shared/constants/constants.ts`:

```typescript
// Add to ERROR_MESSAGES enum:
STRIPE_ACCOUNT_NOT_FOUND = 'Stripe account not found',
STRIPE_ONBOARDING_INCOMPLETE = 'Complete Stripe payout setup before creating merch',
MERCH_DROP_NOT_FOUND = 'Merch drop not found',
MERCH_DROP_EXISTS = 'Merch drop already exists for this post',
MERCH_DROP_EXPIRED = 'This merch drop has ended',
MERCH_DROP_NOT_ACTIVE = 'Merch drop is not active',
MERCH_ORDER_NOT_FOUND = 'Merch order not found',
MERCH_PRODUCT_NOT_FOUND = 'Merch product not found',
PRINTFUL_API_ERROR = 'Printful API error',
STRIPE_WEBHOOK_INVALID = 'Invalid Stripe webhook signature',
PRINTFUL_WEBHOOK_INVALID = 'Invalid Printful webhook signature',

// Add to SUCCESS_MESSAGES enum:
STRIPE_ONBOARD_SUCCESS = 'Stripe onboarding link created successfully',
MERCH_DROP_CREATED = 'Merch drop creation started',
MERCH_DROP_CANCELLED = 'Merch drop cancelled successfully',
MERCH_ORDER_CREATED = 'Merch order created successfully',
```

**Step 4: Verify build**

Run: `npx nest build`
Expected: BUILD SUCCESSFUL

**Step 5: Commit**

```bash
git add src/modules/merch/constants/ src/modules/stripe/constants/ src/shared/constants/constants.ts
git commit -m "Add enums and constants for merch automation"
```

---

## Task 3: Create Entities

**Files:**
- Create: `src/modules/stripe/entities/stripe-account.entity.ts`
- Create: `src/modules/merch/entities/merch-drop.entity.ts`
- Create: `src/modules/merch/entities/merch-product.entity.ts`
- Create: `src/modules/merch/entities/merch-order.entity.ts`
- Create: `src/modules/merch/entities/merch-order-item.entity.ts`
- Create: `src/modules/merch/entities/order-ledger.entity.ts`
- Create: `src/modules/merch/entities/payout-batch.entity.ts`

All entities follow existing patterns: extend BaseEntity, use @PrimaryGeneratedColumn('uuid'), timestamps with default CURRENT_TIMESTAMP, @Index on FK columns, onDelete CASCADE.

**Step 1: Create StripeAccount entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, Index, BaseEntity } from 'typeorm';
import { User } from '@user/entities/user.entity';

@Entity('stripe_accounts')
export class StripeAccount extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, unique: true })
  @Index()
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: false })
  stripe_account_id: string;

  @Column({ default: false })
  onboarding_complete: boolean;

  @Column({ default: false })
  payouts_enabled: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

**Step 2: Create MerchDrop entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, BaseEntity } from 'typeorm';
import { User } from '@user/entities/user.entity';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { MerchProduct } from './merch-product.entity';
import { MerchOrder } from './merch-order.entity';
import { MerchDropStatus } from '../constants';

@Entity('merch_drops')
export class MerchDrop extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, unique: true })
  @Index()
  artist_post_id: string;

  @ManyToOne(() => ArtistPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_post_id' })
  artistPost: ArtistPost;

  @Column({ nullable: false })
  @Index()
  artist_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: User;

  @Column({ type: 'enum', enum: MerchDropStatus, default: MerchDropStatus.CREATING })
  status: MerchDropStatus;

  @Column({ type: 'timestamp', nullable: false })
  expires_at: Date;

  @OneToMany(() => MerchProduct, (product) => product.merchDrop)
  products: MerchProduct[];

  @OneToMany(() => MerchOrder, (order) => order.merchDrop)
  orders: MerchOrder[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

**Step 3: Create MerchProduct entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, BaseEntity } from 'typeorm';
import { MerchDrop } from './merch-drop.entity';
import { ProductType } from '../constants';

@Entity('merch_products')
export class MerchProduct extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  merch_drop_id: string;

  @ManyToOne(() => MerchDrop, (drop) => drop.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merch_drop_id' })
  merchDrop: MerchDrop;

  @Column({ type: 'bigint', nullable: true })
  printful_product_id: number;

  @Column({ type: 'bigint', nullable: true })
  printful_variant_id: number;

  @Column({ type: 'enum', enum: ProductType })
  product_type: ProductType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  retail_price: number;

  @Column({ nullable: true })
  image_url: string;

  @Column({ nullable: true })
  mockup_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Step 4: Create MerchOrder entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne, JoinColumn, Index, BaseEntity } from 'typeorm';
import { User } from '@user/entities/user.entity';
import { MerchDrop } from './merch-drop.entity';
import { MerchOrderItem } from './merch-order-item.entity';
import { OrderLedger } from './order-ledger.entity';
import { MerchOrderStatus } from '../constants';

@Entity('merch_orders')
export class MerchOrder extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, unique: true })
  order_number: string;

  @Column({ nullable: false })
  @Index()
  merch_drop_id: string;

  @ManyToOne(() => MerchDrop, (drop) => drop.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merch_drop_id' })
  merchDrop: MerchDrop;

  @Column({ nullable: false })
  @Index()
  fan_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fan_id' })
  fan: User;

  @Column({ nullable: false })
  @Index()
  artist_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: User;

  @Column({ nullable: true })
  stripe_payment_intent_id: string;

  @Column({ type: 'bigint', nullable: true })
  printful_order_id: number;

  @Column({ type: 'enum', enum: MerchOrderStatus, default: MerchOrderStatus.PENDING })
  status: MerchOrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shipping_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'jsonb', nullable: true })
  shipping_address: Record<string, any>;

  @Column({ nullable: true })
  tracking_number: string;

  @Column({ nullable: true })
  tracking_url: string;

  @OneToMany(() => MerchOrderItem, (item) => item.merchOrder)
  items: MerchOrderItem[];

  @OneToOne(() => OrderLedger, (ledger) => ledger.merchOrder)
  ledger: OrderLedger;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

**Step 5: Create MerchOrderItem entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, BaseEntity } from 'typeorm';
import { MerchOrder } from './merch-order.entity';
import { MerchProduct } from './merch-product.entity';

@Entity('merch_order_items')
export class MerchOrderItem extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  merch_order_id: string;

  @ManyToOne(() => MerchOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merch_order_id' })
  merchOrder: MerchOrder;

  @Column({ nullable: false })
  @Index()
  merch_product_id: string;

  @ManyToOne(() => MerchProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merch_product_id' })
  merchProduct: MerchProduct;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  printful_cost: number;

  @Column({ nullable: true })
  size: string;

  @Column({ nullable: true })
  color: string;
}
```

**Step 6: Create OrderLedger entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn, Index, BaseEntity } from 'typeorm';
import { MerchOrder } from './merch-order.entity';
import { PayoutBatch } from './payout-batch.entity';
import { LedgerStatus } from '../constants';

@Entity('order_ledger')
export class OrderLedger extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, unique: true })
  @Index()
  merch_order_id: string;

  @OneToOne(() => MerchOrder, (order) => order.ledger, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merch_order_id' })
  merchOrder: MerchOrder;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  gross_revenue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stripe_fee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  printful_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  net_profit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  artist_share: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platform_share: number;

  @Column({ type: 'enum', enum: LedgerStatus, default: LedgerStatus.PENDING })
  status: LedgerStatus;

  @Column({ nullable: true })
  @Index()
  payout_batch_id: string;

  @ManyToOne(() => PayoutBatch, (batch) => batch.ledgerEntries, { nullable: true })
  @JoinColumn({ name: 'payout_batch_id' })
  payoutBatch: PayoutBatch;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

**Step 7: Create PayoutBatch entity**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, BaseEntity } from 'typeorm';
import { User } from '@user/entities/user.entity';
import { OrderLedger } from './order-ledger.entity';
import { PayoutBatchStatus } from '../constants';

@Entity('payout_batches')
export class PayoutBatch extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  artist_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: User;

  @Column({ nullable: true })
  stripe_transfer_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: 'int' })
  order_count: number;

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date' })
  period_end: Date;

  @Column({ type: 'enum', enum: PayoutBatchStatus, default: PayoutBatchStatus.PENDING })
  status: PayoutBatchStatus;

  @OneToMany(() => OrderLedger, (ledger) => ledger.payoutBatch)
  ledgerEntries: OrderLedger[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Step 8: Verify build**

Run: `npx nest build`
Expected: BUILD SUCCESSFUL

**Step 9: Commit**

```bash
git add src/modules/stripe/entities/ src/modules/merch/entities/
git commit -m "Add entities for merch automation (7 new tables)"
```

---

## Task 4: Generate and Run Migration

**Files:**
- Create: `src/database/migrations/[timestamp]-merch-automation.ts` (auto-generated)

**Step 1: Build the project first (migration:generate reads from dist/)**

Run: `npx nest build`

**Step 2: Generate migration**

Run: `NODE_ENV=production npx typeorm migration:generate ./src/database/migrations/merch-automation -d ./dist/config/database/postgres/datasource.js`

This auto-generates the migration SQL from entity diffs. Review the generated file to ensure it creates all 7 tables with correct columns, indexes, and foreign keys.

**Step 3: Verify migration file contents**

Read the generated migration file. It should contain CREATE TABLE statements for:
- stripe_accounts
- merch_drops
- merch_products
- merch_orders
- merch_order_items
- order_ledger
- payout_batches

Plus all foreign key constraints and indexes.

**Step 4: Build again (migration must be compiled to dist/)**

Run: `npx nest build`

**Step 5: Run migration locally (if local DB is configured)**

Run: `cross-env NODE_ENV=dev npx ts-node ./node_modules/typeorm/cli.js migration:run -d ./src/config/database/postgres/datasource.ts`

If no local DB, skip this step. The migration will run on the EC2 server when deployed (migrationsRun: true in orm.config.ts auto-runs pending migrations on app start).

**Step 6: Commit**

```bash
git add src/database/migrations/
git commit -m "Add migration for merch automation tables"
```

---

## Task 5: Create Stripe Module (Connect Onboarding)

**Files:**
- Create: `src/modules/stripe/stripe.module.ts`
- Create: `src/modules/stripe/stripe.service.ts`
- Create: `src/modules/stripe/stripe.controller.ts`
- Create: `src/modules/stripe/dto/index.ts`

**Step 1: Create Stripe service**

`src/modules/stripe/stripe.service.ts`:

```typescript
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { StripeAccount } from './entities/stripe-account.entity';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectRepository(StripeAccount)
    private stripeAccountRepo: Repository<StripeAccount>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  async createConnectAccount(userId: string, email: string): Promise<{ url: string }> {
    try {
      const existing = await this.stripeAccountRepo.findOne({ where: { user_id: userId } });
      if (existing && existing.onboarding_complete) {
        throw new HttpException('Stripe account already set up', HttpStatus.BAD_REQUEST);
      }

      let stripeAccountId = existing?.stripe_account_id;

      if (!stripeAccountId) {
        const account = await this.stripe.accounts.create({
          type: 'express',
          email,
          capabilities: {
            transfers: { requested: true },
          },
        });
        stripeAccountId = account.id;

        const stripeAccount = new StripeAccount();
        stripeAccount.user_id = userId;
        stripeAccount.stripe_account_id = stripeAccountId;
        await this.stripeAccountRepo.save(stripeAccount);
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL,
        return_url: process.env.STRIPE_CONNECT_RETURN_URL,
        type: 'account_onboarding',
      });

      return { url: accountLink.url };
    } catch (error) {
      this.logger.error(`Create Connect account failed: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getConnectStatus(userId: string) {
    try {
      const stripeAccount = await this.stripeAccountRepo.findOne({ where: { user_id: userId } });
      if (!stripeAccount) {
        return { connected: false, onboarding_complete: false, payouts_enabled: false };
      }

      const account = await this.stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      const onboardingComplete = account.details_submitted;
      const payoutsEnabled = account.payouts_enabled;

      if (stripeAccount.onboarding_complete !== onboardingComplete || stripeAccount.payouts_enabled !== payoutsEnabled) {
        stripeAccount.onboarding_complete = onboardingComplete;
        stripeAccount.payouts_enabled = payoutsEnabled;
        await this.stripeAccountRepo.save(stripeAccount);
      }

      return {
        connected: true,
        onboarding_complete: onboardingComplete,
        payouts_enabled: payoutsEnabled,
        stripe_account_id: stripeAccount.stripe_account_id,
      };
    } catch (error) {
      this.logger.error(`Get Connect status failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getStripeAccountByUserId(userId: string): Promise<StripeAccount | null> {
    return this.stripeAccountRepo.findOne({ where: { user_id: userId } });
  }

  async createPaymentIntent(amount: number, metadata: Record<string, string>): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata,
    });
  }

  async getBalanceTransaction(chargeId: string): Promise<number> {
    const charge = await this.stripe.charges.retrieve(chargeId);
    const balanceTransaction = await this.stripe.balanceTransactions.retrieve(
      charge.balance_transaction as string,
    );
    return balanceTransaction.fee / 100;
  }

  async createTransfer(amount: number, stripeAccountId: string, metadata: Record<string, string>): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: stripeAccountId,
      metadata,
    });
  }

  async refundPaymentIntent(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({ payment_intent: paymentIntentId });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  }
}
```

**Step 2: Create DTOs**

`src/modules/stripe/dto/index.ts`:

```typescript
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConnectAccountDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
```

**Step 3: Create Stripe controller (Connect endpoints)**

`src/modules/stripe/stripe.controller.ts`:

```typescript
import { Controller, Post, Get, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Role } from '@auth/decorators/roles.decorator';
import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { StripeService } from './stripe.service';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private stripeService: StripeService) {}

  @Post('connect/onboard')
  @Role(Roles.ARTIST)
  async createConnectAccount(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const email = req?.user?.email || '';
      const result = await this.stripeService.createConnectAccount(userId, email);
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.STRIPE_ONBOARD_SUCCESS,
        data: result,
      });
    } catch (error) {
      this.logger.error(`Onboard error: ${error.message}`);
      throw error;
    }
  }

  @Get('connect/status')
  @Role(Roles.ARTIST)
  async getConnectStatus(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.stripeService.getConnectStatus(userId);
      res.status(HttpStatus.OK).json({
        message: 'Stripe Connect status retrieved',
        data: result,
      });
    } catch (error) {
      this.logger.error(`Status error: ${error.message}`);
      throw error;
    }
  }
}
```

**Step 4: Create Stripe module**

`src/modules/stripe/stripe.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeAccount } from './entities/stripe-account.entity';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StripeAccount])],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
```

**Step 5: Verify build**

Run: `npx nest build`

**Step 6: Commit**

```bash
git add src/modules/stripe/
git commit -m "Add Stripe module with Connect onboarding and payment services"
```

---

## Task 6: Create Stripe Webhook Handling

**Files:**
- Create: `src/modules/stripe/stripe-webhook.controller.ts`
- Create: `src/modules/stripe/stripe-webhook.service.ts`

**Step 1: Create webhook service**

`src/modules/stripe/stripe-webhook.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeWebhookEvents } from './constants';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private processedEvents: Set<string> = new Set();

  async handleEvent(event: Stripe.Event): Promise<void> {
    if (this.processedEvents.has(event.id)) {
      this.logger.warn(`Duplicate event skipped: ${event.id}`);
      return;
    }
    this.processedEvents.add(event.id);

    if (this.processedEvents.size > 10000) {
      const entries = Array.from(this.processedEvents);
      entries.splice(0, 5000).forEach((id) => this.processedEvents.delete(id));
    }

    switch (event.type) {
      case StripeWebhookEvents.PAYMENT_INTENT_SUCCEEDED:
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case StripeWebhookEvents.CHARGE_REFUNDED:
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case StripeWebhookEvents.CHARGE_DISPUTE_CREATED:
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case StripeWebhookEvents.ACCOUNT_UPDATED:
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log(`PaymentIntent succeeded: ${paymentIntent.id}`);
    // Implemented in Task 10 when MerchOrderService is available
    // Will be wired via dependency injection
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}`);
    // Implemented in Task 10
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.log(`Dispute created: ${dispute.id}`);
    // Implemented in Task 10
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    this.logger.log(`Account updated: ${account.id}`);
    // Update onboarding_complete and payouts_enabled in stripe_accounts
    // Implemented when StripeService is injected
  }
}
```

Note: The webhook service methods will be fleshed out in Task 10 when MerchOrderService exists. For now, they log and return.

**Step 2: Create webhook controller**

`src/modules/stripe/stripe-webhook.controller.ts`:

```typescript
import { Controller, Post, Req, Res, HttpStatus, Logger, RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '@auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';

@ApiTags('Stripe Webhooks')
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripeService: StripeService,
    private stripeWebhookService: StripeWebhookService,
  ) {}

  @Post('webhooks')
  @Public()
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
      await this.stripeWebhookService.handleEvent(event);
      res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      res.status(HttpStatus.BAD_REQUEST).json({ error: ERROR_MESSAGES.STRIPE_WEBHOOK_INVALID });
    }
  }
}
```

**Step 3: Update Stripe module to include webhook providers**

Update `src/modules/stripe/stripe.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeAccount } from './entities/stripe-account.entity';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([StripeAccount])],
  controllers: [StripeController, StripeWebhookController],
  providers: [StripeService, StripeWebhookService],
  exports: [StripeService, StripeWebhookService],
})
export class StripeModule {}
```

**Step 4: Enable raw body in main.ts for Stripe webhooks**

In `src/main.ts`, the NestFactory.create call needs rawBody enabled:

```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  rawBody: true,
});
```

**Step 5: Verify build**

Run: `npx nest build`

**Step 6: Commit**

```bash
git add src/modules/stripe/ src/main.ts
git commit -m "Add Stripe webhook handling with signature verification"
```

---

## Task 7: Create Printful API Service

**Files:**
- Create: `src/modules/printful/printful.module.ts`
- Create: `src/modules/printful/printful.service.ts`

**Step 1: Create Printful service**

`src/modules/printful/printful.service.ts`:

```typescript
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class PrintfulService {
  private readonly logger = new Logger(PrintfulService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.printful.com',
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async uploadFile(fileUrl: string, fileName: string): Promise<any> {
    try {
      const response = await this.client.post('/v2/files', {
        url: fileUrl,
        filename: fileName,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      throw new HttpException('Printful file upload failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async createSyncProduct(storeId: string, productData: {
    name: string;
    thumbnail: string;
    variants: Array<{
      variant_id: number;
      retail_price: string;
      files: Array<{ type: string; url: string }>;
    }>;
  }): Promise<any> {
    try {
      const response = await this.client.post(`/v2/stores/${storeId}/sync-products`, {
        sync_product: { name: productData.name, thumbnail: productData.thumbnail },
        sync_variants: productData.variants.map((v) => ({
          variant_id: v.variant_id,
          retail_price: v.retail_price,
          files: v.files,
        })),
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Create sync product failed: ${error.message}`);
      throw new HttpException('Printful product creation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async createOrder(orderData: {
    recipient: { name: string; address1: string; city: string; state_code: string; country_code: string; zip: string };
    items: Array<{ sync_variant_id: number; quantity: number }>;
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/orders', {
        recipient: orderData.recipient,
        items: orderData.items,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Create order failed: ${error.message}`);
      throw new HttpException('Printful order creation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async confirmOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.post(`/v2/orders/${orderId}/confirm`);
      return response.data;
    } catch (error) {
      this.logger.error(`Confirm order failed: ${error.message}`);
      throw new HttpException('Printful order confirmation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async getOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.get(`/v2/orders/${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Get order failed: ${error.message}`);
      throw new HttpException('Printful order retrieval failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async cancelOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.delete(`/v2/orders/${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Cancel order failed: ${error.message}`);
      throw new HttpException('Printful order cancellation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async getShippingRates(recipient: {
    address1: string; city: string; state_code: string; country_code: string; zip: string;
  }, items: Array<{ variant_id: number; quantity: number }>): Promise<any> {
    try {
      const response = await this.client.post('/v2/shipping/rates', {
        recipient,
        items,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Get shipping rates failed: ${error.message}`);
      throw new HttpException('Printful shipping estimate failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async requestMockup(productId: number): Promise<any> {
    try {
      const response = await this.client.post(`/v2/mockup-generator/create-task/${productId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Request mockup failed: ${error.message}`);
      return null;
    }
  }

  async getMockupResult(taskKey: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/mockup-generator/task/${taskKey}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Get mockup result failed: ${error.message}`);
      return null;
    }
  }
}
```

**Step 2: Create Printful module**

`src/modules/printful/printful.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrintfulService } from './printful.service';

@Module({
  providers: [PrintfulService],
  exports: [PrintfulService],
})
export class PrintfulModule {}
```

**Step 3: Verify build**

Run: `npx nest build`

**Step 4: Commit**

```bash
git add src/modules/printful/
git commit -m "Add Printful API service with product, order, and shipping methods"
```

---

## Task 8: Create Printful Webhook Handling

**Files:**
- Create: `src/modules/printful/printful-webhook.controller.ts`
- Create: `src/modules/printful/printful-webhook.service.ts`

**Step 1: Create Printful webhook service**

`src/modules/printful/printful-webhook.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PrintfulWebhookService {
  private readonly logger = new Logger(PrintfulWebhookService.name);

  async handleEvent(eventType: string, data: any): Promise<void> {
    switch (eventType) {
      case 'order_created':
        this.logger.log(`Printful order created: ${data.order?.id}`);
        break;
      case 'order_updated':
        await this.handleOrderUpdated(data);
        break;
      case 'order_shipped':
        await this.handleOrderShipped(data);
        break;
      case 'order_canceled':
        await this.handleOrderCanceled(data);
        break;
      case 'order_failed':
        await this.handleOrderFailed(data);
        break;
      default:
        this.logger.log(`Unhandled Printful event: ${eventType}`);
    }
  }

  private async handleOrderUpdated(data: any): Promise<void> {
    this.logger.log(`Printful order updated: ${data.order?.id}`);
    // Will be wired to MerchOrderService in Task 13
  }

  private async handleOrderShipped(data: any): Promise<void> {
    this.logger.log(`Printful order shipped: ${data.order?.id}`);
    // Will update order status, save tracking, calculate ledger
    // Wired in Task 13
  }

  private async handleOrderCanceled(data: any): Promise<void> {
    this.logger.log(`Printful order canceled: ${data.order?.id}`);
    // Will trigger refund and ledger reversal
    // Wired in Task 13
  }

  private async handleOrderFailed(data: any): Promise<void> {
    this.logger.log(`Printful order failed: ${data.order?.id}`);
    // Will flag for manual review
    // Wired in Task 13
  }
}
```

**Step 2: Create Printful webhook controller**

`src/modules/printful/printful-webhook.controller.ts`:

```typescript
import { Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '@auth/decorators/public.decorator';
import { PrintfulWebhookService } from './printful-webhook.service';

@ApiTags('Printful Webhooks')
@Controller('printful')
export class PrintfulWebhookController {
  private readonly logger = new Logger(PrintfulWebhookController.name);

  constructor(private printfulWebhookService: PrintfulWebhookService) {}

  @Post('webhooks')
  @Public()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      const webhookSecret = req.headers['x-printful-webhook-secret'];
      if (webhookSecret !== process.env.PRINTFUL_WEBHOOK_SECRET) {
        this.logger.warn('Invalid Printful webhook secret');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid webhook secret' });
      }

      const { type, data } = req.body;
      await this.printfulWebhookService.handleEvent(type, data);
      res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`Printful webhook error: ${error.message}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }
}
```

**Step 3: Update Printful module**

`src/modules/printful/printful.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrintfulService } from './printful.service';
import { PrintfulWebhookController } from './printful-webhook.controller';
import { PrintfulWebhookService } from './printful-webhook.service';

@Module({
  controllers: [PrintfulWebhookController],
  providers: [PrintfulService, PrintfulWebhookService],
  exports: [PrintfulService, PrintfulWebhookService],
})
export class PrintfulModule {}
```

**Step 4: Verify build**

Run: `npx nest build`

**Step 5: Commit**

```bash
git add src/modules/printful/
git commit -m "Add Printful webhook handling with secret verification"
```

---

## Task 9: Create Merch Drop Service & Controller

**Files:**
- Create: `src/modules/merch/merch.service.ts`
- Create: `src/modules/merch/merch.controller.ts`
- Create: `src/modules/merch/dto/index.ts`

**Step 1: Create DTOs**

`src/modules/merch/dto/index.ts`:

```typescript
import { IsNotEmpty, IsUUID, IsArray, ValidateNested, IsNumber, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMerchDropDto {
  @IsNotEmpty()
  @IsUUID()
  artistPostId: string;
}

export class OrderItemDto {
  @IsNotEmpty()
  @IsUUID()
  merchProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class ShippingAddressDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  address1: string;

  @IsOptional()
  address2?: string;

  @IsNotEmpty()
  city: string;

  @IsNotEmpty()
  state_code: string;

  @IsNotEmpty()
  country_code: string;

  @IsNotEmpty()
  zip: string;
}

export class CreateMerchOrderDto {
  @IsNotEmpty()
  @IsUUID()
  merchDropId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}
```

**Step 2: Create Merch service**

`src/modules/merch/merch.service.ts`:

```typescript
import { Injectable, Logger, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MerchDrop } from './entities/merch-drop.entity';
import { MerchProduct } from './entities/merch-product.entity';
import { MerchDropStatus } from './constants';
import { StripeService } from '../stripe/stripe.service';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@app/shared/constants/constants';

@Injectable()
export class MerchService {
  private readonly logger = new Logger(MerchService.name);

  constructor(
    @InjectRepository(MerchDrop)
    private merchDropRepo: Repository<MerchDrop>,
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @Inject(forwardRef(() => StripeService))
    private stripeService: StripeService,
    @InjectQueue('merch-creation')
    private merchCreationQueue: Queue,
  ) {}

  async createMerchDrop(artistPostId: string, artistId: string): Promise<MerchDrop> {
    try {
      const existing = await this.merchDropRepo.findOne({ where: { artist_post_id: artistPostId } });
      if (existing) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_EXISTS, HttpStatus.BAD_REQUEST);
      }

      const stripeAccount = await this.stripeService.getStripeAccountByUserId(artistId);
      if (!stripeAccount || !stripeAccount.onboarding_complete) {
        throw new HttpException(ERROR_MESSAGES.STRIPE_ONBOARDING_INCOMPLETE, HttpStatus.BAD_REQUEST);
      }

      const dropDurationHours = parseInt(process.env.MERCH_DROP_DURATION_HOURS || '48');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + dropDurationHours);

      const merchDrop = new MerchDrop();
      merchDrop.artist_post_id = artistPostId;
      merchDrop.artist_id = artistId;
      merchDrop.status = MerchDropStatus.CREATING;
      merchDrop.expires_at = expiresAt;

      const savedDrop = await this.merchDropRepo.save(merchDrop);

      await this.merchCreationQueue.add('create-products', {
        merchDropId: savedDrop.id,
        artistId,
        artistPostId,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      return savedDrop;
    } catch (error) {
      this.logger.error(`Create merch drop failed: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getMerchDrop(id: string): Promise<MerchDrop> {
    try {
      const drop = await this.merchDropRepo.findOne({
        where: { id },
        relations: ['products', 'artistPost'],
      });
      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return drop;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getMerchDropByPostId(postId: string): Promise<MerchDrop> {
    try {
      const drop = await this.merchDropRepo.findOne({
        where: { artist_post_id: postId },
        relations: ['products'],
      });
      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return drop;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async cancelMerchDrop(id: string, artistId: string): Promise<void> {
    try {
      const drop = await this.merchDropRepo.findOne({ where: { id, artist_id: artistId } });
      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      drop.status = MerchDropStatus.CANCELLED;
      await this.merchDropRepo.save(drop);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async activateMerchDrop(merchDropId: string): Promise<void> {
    await this.merchDropRepo.update(merchDropId, { status: MerchDropStatus.ACTIVE });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireDrops(): Promise<void> {
    try {
      const now = new Date();
      const result = await this.merchDropRepo.update(
        { status: MerchDropStatus.ACTIVE, expires_at: LessThan(now) },
        { status: MerchDropStatus.EXPIRED },
      );
      if (result.affected > 0) {
        this.logger.log(`Expired ${result.affected} merch drops`);
      }
    } catch (error) {
      this.logger.error(`Expire drops cron failed: ${error.message}`);
    }
  }
}
```

**Step 3: Create Merch controller**

`src/modules/merch/merch.controller.ts`:

```typescript
import { Controller, Post, Get, Delete, Param, Body, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Role } from '@auth/decorators/roles.decorator';
import { Roles, SUCCESS_MESSAGES, ERROR_MESSAGES } from '@app/shared/constants/constants';
import { MerchService } from './merch.service';
import { MerchOrderService } from './merch-order.service';
import { MerchPayoutService } from './merch-payout.service';
import { CreateMerchDropDto, CreateMerchOrderDto } from './dto';

@ApiTags('Merch')
@Controller('merch')
export class MerchController {
  private readonly logger = new Logger(MerchController.name);

  constructor(
    private merchService: MerchService,
    private merchOrderService: MerchOrderService,
    private merchPayoutService: MerchPayoutService,
  ) {}

  @Post('drops')
  @Role(Roles.ARTIST)
  async createMerchDrop(@Body() dto: CreateMerchDropDto, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchService.createMerchDrop(dto.artistPostId, userId);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.MERCH_DROP_CREATED,
        data: result,
      });
    } catch (error) {
      this.logger.error(`Create drop error: ${error.message}`);
      throw error;
    }
  }

  @Get('drops/:id')
  async getMerchDrop(@Param('id') id: string, @Res() res: Response) {
    try {
      const result = await this.merchService.getMerchDrop(id);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Get('drops/post/:postId')
  async getMerchDropByPost(@Param('postId') postId: string, @Res() res: Response) {
    try {
      const result = await this.merchService.getMerchDropByPostId(postId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Delete('drops/:id')
  @Role(Roles.ARTIST)
  async cancelMerchDrop(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      await this.merchService.cancelMerchDrop(id, userId);
      res.status(HttpStatus.OK).json({ message: SUCCESS_MESSAGES.MERCH_DROP_CANCELLED });
    } catch (error) {
      throw error;
    }
  }

  @Post('orders')
  async createOrder(@Body() dto: CreateMerchOrderDto, @Req() req: Request, @Res() res: Response) {
    try {
      const fanId = req?.user?.id || '';
      const result = await this.merchOrderService.createOrder(dto, fanId);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.MERCH_ORDER_CREATED,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchOrderService.getOrder(id, userId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Get('orders')
  async listOrders(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const userRole = req?.user?.role || [];
      const result = await this.merchOrderService.listOrders(userId, userRole);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Get('payouts')
  @Role(Roles.ARTIST)
  async listPayouts(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchPayoutService.getPayoutHistory(userId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Get('payouts/balance')
  @Role(Roles.ARTIST)
  async getBalance(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchPayoutService.getUnpaidBalance(userId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }
}
```

**Step 4: Verify build**

Run: `npx nest build`

**Step 5: Commit**

```bash
git add src/modules/merch/dto/ src/modules/merch/merch.service.ts src/modules/merch/merch.controller.ts
git commit -m "Add merch drop service and controller with CRUD and expiry cron"
```

---

## Task 10: Create Merch Order Service

**Files:**
- Create: `src/modules/merch/merch-order.service.ts`

**Step 1: Create MerchOrderService**

`src/modules/merch/merch-order.service.ts`:

```typescript
import { Injectable, Logger, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MerchOrder } from './entities/merch-order.entity';
import { MerchOrderItem } from './entities/merch-order-item.entity';
import { MerchDrop } from './entities/merch-drop.entity';
import { MerchProduct } from './entities/merch-product.entity';
import { OrderLedger } from './entities/order-ledger.entity';
import { MerchOrderStatus, MerchDropStatus, LedgerStatus } from './constants';
import { StripeService } from '../stripe/stripe.service';
import { PrintfulService } from '../printful/printful.service';
import { CreateMerchOrderDto } from './dto';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';

@Injectable()
export class MerchOrderService {
  private readonly logger = new Logger(MerchOrderService.name);

  constructor(
    @InjectRepository(MerchOrder)
    private merchOrderRepo: Repository<MerchOrder>,
    @InjectRepository(MerchOrderItem)
    private merchOrderItemRepo: Repository<MerchOrderItem>,
    @InjectRepository(MerchDrop)
    private merchDropRepo: Repository<MerchDrop>,
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @InjectRepository(OrderLedger)
    private orderLedgerRepo: Repository<OrderLedger>,
    @Inject(forwardRef(() => StripeService))
    private stripeService: StripeService,
    @Inject(forwardRef(() => PrintfulService))
    private printfulService: PrintfulService,
    @InjectQueue('order-fulfillment')
    private orderFulfillmentQueue: Queue,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `DO-${dateStr}-${random}`;
  }

  async createOrder(dto: CreateMerchOrderDto, fanId: string) {
    try {
      const drop = await this.merchDropRepo.findOne({
        where: { id: dto.merchDropId },
        relations: ['products'],
      });

      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (drop.status !== MerchDropStatus.ACTIVE) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_ACTIVE, HttpStatus.BAD_REQUEST);
      }
      if (new Date() > drop.expires_at) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_EXPIRED, HttpStatus.BAD_REQUEST);
      }

      let subtotal = 0;
      const orderItems: Partial<MerchOrderItem>[] = [];

      for (const item of dto.items) {
        const product = drop.products.find((p) => p.id === item.merchProductId);
        if (!product) {
          throw new HttpException(ERROR_MESSAGES.MERCH_PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND);
        }
        const lineTotal = Number(product.retail_price) * item.quantity;
        subtotal += lineTotal;
        orderItems.push({
          merch_product_id: item.merchProductId,
          quantity: item.quantity,
          unit_price: Number(product.retail_price),
          size: item.size,
          color: item.color,
        });
      }

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

      const total = subtotal + shippingCost;

      const order = new MerchOrder();
      order.order_number = this.generateOrderNumber();
      order.merch_drop_id = dto.merchDropId;
      order.fan_id = fanId;
      order.artist_id = drop.artist_id;
      order.status = MerchOrderStatus.PENDING;
      order.subtotal = subtotal;
      order.shipping_cost = shippingCost;
      order.total = total;
      order.shipping_address = dto.shippingAddress as any;

      const savedOrder = await this.merchOrderRepo.save(order);

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

      const paymentIntent = await this.stripeService.createPaymentIntent(total, {
        merch_order_id: savedOrder.id,
        artist_id: drop.artist_id,
        order_number: savedOrder.order_number,
      });

      savedOrder.stripe_payment_intent_id = paymentIntent.id;
      await this.merchOrderRepo.save(savedOrder);

      return {
        orderId: savedOrder.id,
        orderNumber: savedOrder.order_number,
        clientSecret: paymentIntent.client_secret,
        total,
        subtotal,
        shippingCost,
      };
    } catch (error) {
      this.logger.error(`Create order failed: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handlePaymentSucceeded(paymentIntentId: string, chargeId: string): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { stripe_payment_intent_id: paymentIntentId },
      });
      if (!order) {
        this.logger.warn(`No order found for PI: ${paymentIntentId}`);
        return;
      }
      if (order.status !== MerchOrderStatus.PENDING) {
        this.logger.warn(`Order ${order.id} already processed (status: ${order.status})`);
        return;
      }

      order.status = MerchOrderStatus.PAID;
      await this.merchOrderRepo.save(order);

      const stripeFee = await this.stripeService.getBalanceTransaction(chargeId);

      const ledger = new OrderLedger();
      ledger.merch_order_id = order.id;
      ledger.gross_revenue = Number(order.total);
      ledger.stripe_fee = stripeFee;
      ledger.status = LedgerStatus.PENDING;
      await this.orderLedgerRepo.save(ledger);

      await this.orderFulfillmentQueue.add('fulfill-order', {
        merchOrderId: order.id,
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
      });
    } catch (error) {
      this.logger.error(`Handle payment succeeded failed: ${error.message}`);
    }
  }

  async handleRefund(paymentIntentId: string): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { stripe_payment_intent_id: paymentIntentId },
      });
      if (!order) return;

      order.status = MerchOrderStatus.REFUNDED;
      await this.merchOrderRepo.save(order);

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
      });
      if (ledger) {
        ledger.status = LedgerStatus.REVERSED;
        await this.orderLedgerRepo.save(ledger);
      }

      if (order.printful_order_id) {
        try {
          await this.printfulService.cancelOrder(order.printful_order_id);
        } catch (e) {
          this.logger.warn(`Could not cancel Printful order ${order.printful_order_id}: ${e.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Handle refund failed: ${error.message}`);
    }
  }

  async getOrder(id: string, userId: string): Promise<MerchOrder> {
    const order = await this.merchOrderRepo.findOne({
      where: { id },
      relations: ['items', 'items.merchProduct', 'ledger'],
    });
    if (!order) {
      throw new HttpException(ERROR_MESSAGES.MERCH_ORDER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (order.fan_id !== userId && order.artist_id !== userId) {
      throw new HttpException(ERROR_MESSAGES.NOT_AUTHORIZED_ACTION, HttpStatus.FORBIDDEN);
    }
    return order;
  }

  async listOrders(userId: string, userRoles: Roles[]): Promise<MerchOrder[]> {
    const isArtist = userRoles.includes(Roles.ARTIST);
    const whereClause = isArtist ? { artist_id: userId } : { fan_id: userId };
    return this.merchOrderRepo.find({
      where: whereClause,
      relations: ['items', 'items.merchProduct'],
      order: { created_at: 'DESC' },
    });
  }

  async updateOrderWithPrintful(orderId: string, printfulOrderId: number): Promise<void> {
    await this.merchOrderRepo.update(orderId, {
      printful_order_id: printfulOrderId,
      status: MerchOrderStatus.PRODUCTION,
    });
  }

  async handleOrderShipped(printfulOrderId: number, trackingNumber: string, trackingUrl: string, printfulCosts: number): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { printful_order_id: printfulOrderId },
      });
      if (!order) {
        this.logger.warn(`No order found for Printful order: ${printfulOrderId}`);
        return;
      }

      order.status = MerchOrderStatus.SHIPPED;
      order.tracking_number = trackingNumber;
      order.tracking_url = trackingUrl;
      await this.merchOrderRepo.save(order);

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
      });
      if (ledger) {
        const artistSplitRate = parseFloat(process.env.MERCH_ARTIST_SPLIT || '0.70');
        const platformSplitRate = parseFloat(process.env.MERCH_PLATFORM_SPLIT || '0.30');

        ledger.printful_cost = printfulCosts;
        ledger.net_profit = Number(ledger.gross_revenue) - Number(ledger.stripe_fee) - printfulCosts;

        if (ledger.net_profit < 0) {
          ledger.artist_share = 0;
          ledger.platform_share = ledger.net_profit;
        } else {
          ledger.artist_share = Math.round(ledger.net_profit * artistSplitRate * 100) / 100;
          ledger.platform_share = Math.round(ledger.net_profit * platformSplitRate * 100) / 100;
        }
        ledger.status = LedgerStatus.CALCULATED;
        await this.orderLedgerRepo.save(ledger);
      }
    } catch (error) {
      this.logger.error(`Handle order shipped failed: ${error.message}`);
    }
  }
}
```

**Step 2: Verify build**

Run: `npx nest build`

**Step 3: Commit**

```bash
git add src/modules/merch/merch-order.service.ts
git commit -m "Add merch order service with payment, ledger, and fulfillment logic"
```

---

## Task 11: Create BullMQ Processors

**Files:**
- Create: `src/modules/merch/processors/merch-creation.processor.ts`
- Create: `src/modules/merch/processors/order-fulfillment.processor.ts`

**Step 1: Create merch-creation processor**

`src/modules/merch/processors/merch-creation.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MerchProduct } from '../entities/merch-product.entity';
import { ProductType } from '../constants';
import { MerchService } from '../merch.service';
import { PrintfulService } from '../../printful/printful.service';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { Signatures } from '@signature/entities/signatures.entity';

@Processor('merch-creation', { concurrency: 2 })
export class MerchCreationProcessor extends WorkerHost {
  private readonly logger = new Logger(MerchCreationProcessor.name);

  private readonly defaultPrices: Record<ProductType, number> = {
    [ProductType.TSHIRT]: 45,
    [ProductType.HOODIE]: 75,
    [ProductType.TANK]: 30,
    [ProductType.POSTER]: 50,
    [ProductType.HAT]: 35,
  };

  private readonly activeProductTypes: ProductType[] = [
    ProductType.TSHIRT,
    ProductType.HOODIE,
    ProductType.TANK,
    ProductType.POSTER,
  ];

  constructor(
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @InjectRepository(ArtistPost)
    private artistPostRepo: Repository<ArtistPost>,
    @InjectRepository(Signatures)
    private signaturesRepo: Repository<Signatures>,
    private merchService: MerchService,
    private printfulService: PrintfulService,
  ) {
    super();
  }

  async process(job: Job<{ merchDropId: string; artistId: string; artistPostId: string }>): Promise<void> {
    const { merchDropId, artistId, artistPostId } = job.data;
    this.logger.log(`Processing merch creation for drop ${merchDropId}`);

    try {
      const artistPost = await this.artistPostRepo.findOne({ where: { id: artistPostId } });
      const imageUrl = artistPost?.image_url || '';

      if (!imageUrl) {
        const signatures = await this.signaturesRepo.find({
          where: { user_id: artistId },
          order: { created_at: 'DESC' },
          take: 1,
        });
        if (signatures.length > 0) {
          // Use latest signature
        }
      }

      for (const productType of this.activeProductTypes) {
        try {
          const product = new MerchProduct();
          product.merch_drop_id = merchDropId;
          product.product_type = productType;
          product.retail_price = this.defaultPrices[productType];
          product.image_url = imageUrl;

          // Printful product creation will be wired when catalog IDs are provided by client
          // For now, save the product record with null printful IDs
          // TODO: Wire up when client provides Printful catalog product/variant IDs

          await this.merchProductRepo.save(product);
          this.logger.log(`Created ${productType} product for drop ${merchDropId}`);
        } catch (error) {
          this.logger.error(`Failed to create ${productType} for drop ${merchDropId}: ${error.message}`);
        }
      }

      await this.merchService.activateMerchDrop(merchDropId);
      this.logger.log(`Merch drop ${merchDropId} activated with ${this.activeProductTypes.length} products`);
    } catch (error) {
      this.logger.error(`Merch creation job failed: ${error.message}`);
      throw error;
    }
  }
}
```

**Step 2: Create order-fulfillment processor**

`src/modules/merch/processors/order-fulfillment.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MerchOrder } from '../entities/merch-order.entity';
import { MerchOrderItem } from '../entities/merch-order-item.entity';
import { MerchOrderService } from '../merch-order.service';
import { PrintfulService } from '../../printful/printful.service';

@Processor('order-fulfillment', { concurrency: 2 })
export class OrderFulfillmentProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderFulfillmentProcessor.name);

  constructor(
    @InjectRepository(MerchOrder)
    private merchOrderRepo: Repository<MerchOrder>,
    @InjectRepository(MerchOrderItem)
    private merchOrderItemRepo: Repository<MerchOrderItem>,
    private merchOrderService: MerchOrderService,
    private printfulService: PrintfulService,
  ) {
    super();
  }

  async process(job: Job<{ merchOrderId: string }>): Promise<void> {
    const { merchOrderId } = job.data;
    this.logger.log(`Processing order fulfillment for ${merchOrderId}`);

    try {
      const order = await this.merchOrderRepo.findOne({
        where: { id: merchOrderId },
        relations: ['items', 'items.merchProduct'],
      });

      if (!order) {
        this.logger.error(`Order ${merchOrderId} not found`);
        return;
      }

      const address = order.shipping_address as any;
      const printfulOrder = await this.printfulService.createOrder({
        recipient: {
          name: address.name,
          address1: address.address1,
          city: address.city,
          state_code: address.state_code,
          country_code: address.country_code,
          zip: address.zip,
        },
        items: order.items
          .filter((item) => item.merchProduct?.printful_variant_id)
          .map((item) => ({
            sync_variant_id: Number(item.merchProduct.printful_variant_id),
            quantity: item.quantity,
          })),
      });

      const printfulOrderId = printfulOrder?.result?.id;
      if (printfulOrderId) {
        await this.printfulService.confirmOrder(printfulOrderId);
        await this.merchOrderService.updateOrderWithPrintful(merchOrderId, printfulOrderId);
        this.logger.log(`Order ${merchOrderId} submitted to Printful as ${printfulOrderId}`);
      }
    } catch (error) {
      this.logger.error(`Order fulfillment failed for ${merchOrderId}: ${error.message}`);
      throw error;
    }
  }
}
```

**Step 3: Verify build**

Run: `npx nest build`

**Step 4: Commit**

```bash
git add src/modules/merch/processors/
git commit -m "Add BullMQ processors for merch creation and order fulfillment"
```

---

## Task 12: Create Payout Service & Processor

**Files:**
- Create: `src/modules/merch/merch-payout.service.ts`
- Create: `src/modules/merch/processors/payout-batch.processor.ts`

**Step 1: Create MerchPayoutService**

`src/modules/merch/merch-payout.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { OrderLedger } from './entities/order-ledger.entity';
import { PayoutBatch } from './entities/payout-batch.entity';
import { LedgerStatus, PayoutBatchStatus } from './constants';

@Injectable()
export class MerchPayoutService {
  private readonly logger = new Logger(MerchPayoutService.name);

  constructor(
    @InjectRepository(OrderLedger)
    private orderLedgerRepo: Repository<OrderLedger>,
    @InjectRepository(PayoutBatch)
    private payoutBatchRepo: Repository<PayoutBatch>,
    @InjectQueue('payout-batch')
    private payoutBatchQueue: Queue,
  ) {}

  @Cron('0 0 1,15 * *')
  async triggerPayoutBatch(): Promise<void> {
    this.logger.log('Triggering bi-weekly payout batch');
    await this.payoutBatchQueue.add('process-payouts', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    });
  }

  async getPayoutHistory(artistId: string): Promise<PayoutBatch[]> {
    return this.payoutBatchRepo.find({
      where: { artist_id: artistId },
      order: { created_at: 'DESC' },
    });
  }

  async getUnpaidBalance(artistId: string): Promise<{ balance: number; orderCount: number }> {
    const result = await this.orderLedgerRepo
      .createQueryBuilder('ledger')
      .innerJoin('ledger.merchOrder', 'order')
      .where('order.artist_id = :artistId', { artistId })
      .andWhere('ledger.status = :status', { status: LedgerStatus.CALCULATED })
      .andWhere('ledger.payout_batch_id IS NULL')
      .select('SUM(ledger.artist_share)', 'total')
      .addSelect('COUNT(ledger.id)', 'count')
      .getRawOne();

    return {
      balance: parseFloat(result?.total || '0'),
      orderCount: parseInt(result?.count || '0'),
    };
  }

  async getCalculatedLedgerEntries(): Promise<{ artistId: string; totalShare: number; orderCount: number; ledgerIds: string[] }[]> {
    const entries = await this.orderLedgerRepo.find({
      where: { status: LedgerStatus.CALCULATED, payout_batch_id: IsNull() },
      relations: ['merchOrder'],
    });

    const grouped = new Map<string, { totalShare: number; orderCount: number; ledgerIds: string[] }>();

    for (const entry of entries) {
      const artistId = entry.merchOrder.artist_id;
      if (!grouped.has(artistId)) {
        grouped.set(artistId, { totalShare: 0, orderCount: 0, ledgerIds: [] });
      }
      const group = grouped.get(artistId);
      group.totalShare += Number(entry.artist_share);
      group.orderCount += 1;
      group.ledgerIds.push(entry.id);
    }

    return Array.from(grouped.entries()).map(([artistId, data]) => ({
      artistId,
      ...data,
    }));
  }

  async markLedgerEntriesPaidOut(ledgerIds: string[], payoutBatchId: string): Promise<void> {
    await this.orderLedgerRepo
      .createQueryBuilder()
      .update()
      .set({ payout_batch_id: payoutBatchId, status: LedgerStatus.PAID_OUT })
      .whereInIds(ledgerIds)
      .execute();
  }
}
```

**Step 2: Create payout-batch processor**

`src/modules/merch/processors/payout-batch.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MerchPayoutService } from '../merch-payout.service';
import { StripeService } from '../../stripe/stripe.service';
import { PayoutBatch } from '../entities/payout-batch.entity';
import { PayoutBatchStatus } from '../constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Processor('payout-batch', { concurrency: 1 })
export class PayoutBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutBatchProcessor.name);

  constructor(
    @InjectRepository(PayoutBatch)
    private payoutBatchRepo: Repository<PayoutBatch>,
    private merchPayoutService: MerchPayoutService,
    private stripeService: StripeService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log('Processing payout batch');

    try {
      const groups = await this.merchPayoutService.getCalculatedLedgerEntries();
      const minThreshold = parseFloat(process.env.MERCH_PAYOUT_MIN_THRESHOLD || '5.00');

      const now = new Date();
      const periodEnd = new Date(now);
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 15);

      for (const group of groups) {
        if (group.totalShare < minThreshold) {
          this.logger.log(`Skipping artist ${group.artistId}: balance $${group.totalShare.toFixed(2)} below threshold`);
          continue;
        }

        const stripeAccount = await this.stripeService.getStripeAccountByUserId(group.artistId);
        if (!stripeAccount || !stripeAccount.payouts_enabled) {
          this.logger.warn(`Artist ${group.artistId} has no valid Stripe account`);
          continue;
        }

        const batch = new PayoutBatch();
        batch.artist_id = group.artistId;
        batch.total_amount = Math.round(group.totalShare * 100) / 100;
        batch.order_count = group.orderCount;
        batch.period_start = periodStart;
        batch.period_end = periodEnd;
        batch.status = PayoutBatchStatus.PROCESSING;
        const savedBatch = await this.payoutBatchRepo.save(batch);

        try {
          const transfer = await this.stripeService.createTransfer(
            group.totalShare,
            stripeAccount.stripe_account_id,
            { payout_batch_id: savedBatch.id, artist_id: group.artistId },
          );

          savedBatch.stripe_transfer_id = transfer.id;
          savedBatch.status = PayoutBatchStatus.COMPLETED;
          await this.payoutBatchRepo.save(savedBatch);

          await this.merchPayoutService.markLedgerEntriesPaidOut(group.ledgerIds, savedBatch.id);
          this.logger.log(`Paid artist ${group.artistId}: $${group.totalShare.toFixed(2)} (${group.orderCount} orders)`);
        } catch (error) {
          savedBatch.status = PayoutBatchStatus.FAILED;
          await this.payoutBatchRepo.save(savedBatch);
          this.logger.error(`Payout failed for artist ${group.artistId}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Payout batch failed: ${error.message}`);
      throw error;
    }
  }
}
```

**Step 3: Verify build**

Run: `npx nest build`

**Step 4: Commit**

```bash
git add src/modules/merch/merch-payout.service.ts src/modules/merch/processors/payout-batch.processor.ts
git commit -m "Add payout service with bi-weekly batch processing and balance tracking"
```

---

## Task 13: Create Merch Module and Wire Everything Together

**Files:**
- Create: `src/modules/merch/merch.module.ts`
- Modify: `src/config/app/app.config.module.ts` (add new modules)
- Modify: `src/modules/stripe/stripe-webhook.service.ts` (wire to MerchOrderService)
- Modify: `src/modules/printful/printful-webhook.service.ts` (wire to MerchOrderService)
- Modify: `src/modules/printful/printful.module.ts` (add MerchOrder dependencies)

**Step 1: Create Merch module**

`src/modules/merch/merch.module.ts`:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
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
import { MerchCreationProcessor } from './processors/merch-creation.processor';
import { OrderFulfillmentProcessor } from './processors/order-fulfillment.processor';
import { PayoutBatchProcessor } from './processors/payout-batch.processor';
import { StripeModule } from '../stripe/stripe.module';
import { PrintfulModule } from '../printful/printful.module';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { Signatures } from '@signature/entities/signatures.entity';

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
      Signatures,
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
    MerchCreationProcessor,
    OrderFulfillmentProcessor,
    PayoutBatchProcessor,
  ],
  exports: [MerchService, MerchOrderService, MerchPayoutService],
})
export class MerchModule {}
```

**Step 2: Update app.config.module.ts to register BullMQ and new modules**

Add to imports in `src/config/app/app.config.module.ts`:

```typescript
import { BullModule } from '@nestjs/bullmq';
import { StripeModule } from '@app/modules/stripe/stripe.module';
import { PrintfulModule } from '@app/modules/printful/printful.module';
import { MerchModule } from '@app/modules/merch/merch.module';

// Add to @Module imports array:
BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
}),
StripeModule,
PrintfulModule,
MerchModule,
```

**Step 3: Wire StripeWebhookService to MerchOrderService**

Update `src/modules/stripe/stripe-webhook.service.ts` to inject and use MerchOrderService:

```typescript
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { StripeWebhookEvents } from './constants';
import { StripeAccount } from './entities/stripe-account.entity';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private processedEvents: Set<string> = new Set();
  private merchOrderService: any = null;

  constructor(
    @InjectRepository(StripeAccount)
    private stripeAccountRepo: Repository<StripeAccount>,
  ) {}

  setMerchOrderService(service: any): void {
    this.merchOrderService = service;
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    if (this.processedEvents.has(event.id)) {
      this.logger.warn(`Duplicate event skipped: ${event.id}`);
      return;
    }
    this.processedEvents.add(event.id);

    if (this.processedEvents.size > 10000) {
      const entries = Array.from(this.processedEvents);
      entries.splice(0, 5000).forEach((id) => this.processedEvents.delete(id));
    }

    switch (event.type) {
      case StripeWebhookEvents.PAYMENT_INTENT_SUCCEEDED:
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case StripeWebhookEvents.CHARGE_REFUNDED:
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case StripeWebhookEvents.CHARGE_DISPUTE_CREATED:
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case StripeWebhookEvents.ACCOUNT_UPDATED:
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log(`PaymentIntent succeeded: ${paymentIntent.id}`);
    if (this.merchOrderService && paymentIntent.metadata?.merch_order_id) {
      const chargeId = typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;
      await this.merchOrderService.handlePaymentSucceeded(paymentIntent.id, chargeId);
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}`);
    if (this.merchOrderService) {
      const paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
      await this.merchOrderService.handleRefund(paymentIntentId);
    }
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.log(`Dispute created: ${dispute.id}`);
    if (this.merchOrderService) {
      const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
      // Disputes reference charges, need to find the payment intent
      // For now, log it. Full implementation would look up the charge -> PI -> order
      this.logger.warn(`Dispute handling for charge ${chargeId} - needs manual review`);
    }
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    this.logger.log(`Account updated: ${account.id}`);
    const stripeAccount = await this.stripeAccountRepo.findOne({
      where: { stripe_account_id: account.id },
    });
    if (stripeAccount) {
      stripeAccount.onboarding_complete = account.details_submitted;
      stripeAccount.payouts_enabled = account.payouts_enabled;
      await this.stripeAccountRepo.save(stripeAccount);
    }
  }
}
```

Update `src/modules/stripe/stripe.module.ts` to add StripeAccount to TypeORM imports (it needs the repo for webhook service):

Already done -- StripeAccount is already in TypeOrmModule.forFeature.

**Step 4: Wire PrintfulWebhookService to MerchOrderService**

Update `src/modules/printful/printful-webhook.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PrintfulWebhookService {
  private readonly logger = new Logger(PrintfulWebhookService.name);
  private merchOrderService: any = null;

  setMerchOrderService(service: any): void {
    this.merchOrderService = service;
  }

  async handleEvent(eventType: string, data: any): Promise<void> {
    switch (eventType) {
      case 'order_created':
        this.logger.log(`Printful order created: ${data.order?.id}`);
        break;
      case 'order_updated':
        await this.handleOrderUpdated(data);
        break;
      case 'order_shipped':
        await this.handleOrderShipped(data);
        break;
      case 'order_canceled':
        await this.handleOrderCanceled(data);
        break;
      case 'order_failed':
        await this.handleOrderFailed(data);
        break;
      default:
        this.logger.log(`Unhandled Printful event: ${eventType}`);
    }
  }

  private async handleOrderUpdated(data: any): Promise<void> {
    this.logger.log(`Printful order updated: ${data.order?.id}`);
  }

  private async handleOrderShipped(data: any): Promise<void> {
    this.logger.log(`Printful order shipped: ${data.order?.id}`);
    if (this.merchOrderService) {
      const order = data.order;
      const shipment = data.shipment || order?.shipments?.[0];
      const totalCosts = order?.costs?.total ? parseFloat(order.costs.total) : 0;
      await this.merchOrderService.handleOrderShipped(
        order.id,
        shipment?.tracking_number || '',
        shipment?.tracking_url || '',
        totalCosts,
      );
    }
  }

  private async handleOrderCanceled(data: any): Promise<void> {
    this.logger.log(`Printful order canceled: ${data.order?.id}`);
    // Cancellation by Printful side -- would need to trigger refund
    // This is an edge case that needs manual review
  }

  private async handleOrderFailed(data: any): Promise<void> {
    this.logger.log(`Printful order failed: ${data.order?.id}`);
    // Flag for manual review
  }
}
```

**Step 5: Wire webhook services to MerchOrderService on module init**

Add to `src/modules/merch/merch.module.ts` an OnModuleInit:

Actually, a cleaner approach: create a wiring service that runs on init.

Add to `src/modules/merch/merch.module.ts`:

```typescript
import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
// ... existing imports ...
import { StripeWebhookService } from '../stripe/stripe-webhook.service';
import { PrintfulWebhookService } from '../printful/printful-webhook.service';

@Module({ /* ... same as step 1 ... */ })
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

**Step 6: Verify build**

Run: `npx nest build`

**Step 7: Commit**

```bash
git add src/modules/merch/ src/modules/stripe/ src/modules/printful/ src/config/app/
git commit -m "Wire up merch module with Stripe and Printful webhook integration"
```

---

## Task 14: Add Environment Variables and Type Declarations

**Files:**
- Create: `src/types/express.d.ts` (extend Express Request with user property if not exists)
- Modify: `.env.example` or `.env` (add new variables)

**Step 1: Check if Express Request type extension exists**

Look for existing `req.user` type declaration. If not found, create `src/types/express.d.ts`:

```typescript
import { User } from '@user/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userSub?: string;
    }
  }
}
```

If this already exists (likely it does since controllers use req.user), skip this step.

**Step 2: Add environment variables**

Create or update `.env.example` with the new variables:

```
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_RETURN_URL=https://dayones.app/stripe/return
STRIPE_CONNECT_REFRESH_URL=https://dayones.app/stripe/refresh

# Printful
PRINTFUL_API_TOKEN=
PRINTFUL_WEBHOOK_SECRET=
PRINTFUL_STORE_ID=

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Merch Configuration
MERCH_DROP_DURATION_HOURS=48
MERCH_ARTIST_SPLIT=0.70
MERCH_PLATFORM_SPLIT=0.30
MERCH_PAYOUT_MIN_THRESHOLD=5.00
```

**Step 3: Add path aliases to tsconfig.json**

Add to paths in `tsconfig.json`:

```json
"@stripe/*": ["src/modules/stripe/*"],
"@printful/*": ["src/modules/printful/*"],
"@merch/*": ["src/modules/merch/*"]
```

**Step 4: Verify build**

Run: `npx nest build`

**Step 5: Commit**

```bash
git add tsconfig.json .env.example src/types/
git commit -m "Add environment variables, path aliases, and type declarations for merch"
```

---

## Task 15: Final Build Verification & Cleanup

**Step 1: Full clean build**

Run: `rm -rf dist && npx nest build`
Expected: BUILD SUCCESSFUL with no errors

**Step 2: Review all new files for consistency**

Check that:
- All entities extend BaseEntity
- All controllers use @ApiTags
- All services use Logger
- All error handling throws HttpException
- All response formats match { message, data } pattern
- All guards are applied correctly (@Role decorators, @Public for webhooks)

**Step 3: Check for circular dependency issues**

Run: `npx nest start --watch`
Watch for circular dependency warnings in console output.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "Final build verification and cleanup for Milestone 1 backend engine"
```

**Step 5: Push to main**

Run: `git push origin main`

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Install dependencies | None |
| 2 | Add enums and constants | None |
| 3 | Create entities (7 tables) | Task 2 |
| 4 | Generate and run migration | Task 3 |
| 5 | Stripe module (Connect onboarding) | Task 3 |
| 6 | Stripe webhook handling | Task 5 |
| 7 | Printful API service | Task 1 |
| 8 | Printful webhook handling | Task 7 |
| 9 | Merch drop service + controller | Tasks 3, 5 |
| 10 | Merch order service | Tasks 3, 5, 7 |
| 11 | BullMQ processors (creation, fulfillment) | Tasks 7, 9, 10 |
| 12 | Payout service + batch processor | Tasks 5, 10 |
| 13 | Wire everything together (module, app config) | Tasks 5-12 |
| 14 | Environment variables and type declarations | Task 13 |
| 15 | Final build verification | Task 14 |

## Blocked Items (waiting on client)

These items are stubbed out and ready to be wired when client provides info:

- **Printful catalog product/variant IDs**: merch-creation.processor.ts creates products with null Printful IDs. When client provides catalog choices, update `defaultPrices` map and add Printful API calls to create sync products.
- **Image placement coordinates**: Currently no placement logic. When client sends examples, add placement config per ProductType.
- **Final retail pricing**: Using deck prices as defaults ($45 tee, $75 hoodie, $30 tank, $50 poster). Update when client finalizes.
