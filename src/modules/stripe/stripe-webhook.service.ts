import { Injectable, Logger } from '@nestjs/common';
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
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
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

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.log(`PaymentIntent succeeded: ${paymentIntent.id}`);
    if (this.merchOrderService && paymentIntent.metadata?.merch_order_id) {
      const chargeId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;
      await this.merchOrderService.handlePaymentSucceeded(
        paymentIntent.id,
        chargeId,
      );
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}`);
    if (this.merchOrderService) {
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      await this.merchOrderService.handleRefund(paymentIntentId);
    }
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.log(`Dispute created: ${dispute.id}`);
    if (this.merchOrderService) {
      const chargeId =
        typeof dispute.charge === 'string'
          ? dispute.charge
          : dispute.charge?.id;
      this.logger.warn(
        `Dispute handling for charge ${chargeId} - needs manual review`,
      );
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
