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
import { MerchCreationProcessor } from './processors/merch-creation.processor';
import { OrderFulfillmentProcessor } from './processors/order-fulfillment.processor';
import { PayoutBatchProcessor } from './processors/payout-batch.processor';
import { StripeModule } from '../stripe/stripe.module';
import { PrintfulModule } from '../printful/printful.module';
import { StripeWebhookService } from '../stripe/stripe-webhook.service';
import { PrintfulWebhookService } from '../printful/printful-webhook.service';
import { ImageNormalizationService } from './services/image-normalization.service';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { SharedModule } from '@app/shared/shared.module';
import { UserModule } from '@app/modules/user/user.module';

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
    SharedModule,
    UserModule,
  ],
  controllers: [MerchController],
  providers: [
    MerchService,
    MerchOrderService,
    MerchPayoutService,
    MerchCreationProcessor,
    OrderFulfillmentProcessor,
    PayoutBatchProcessor,
    ImageNormalizationService,
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
