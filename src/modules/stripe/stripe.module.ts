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
