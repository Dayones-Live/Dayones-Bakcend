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
