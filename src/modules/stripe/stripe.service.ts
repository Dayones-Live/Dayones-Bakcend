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
      apiVersion: '2026-02-25.clover',
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
