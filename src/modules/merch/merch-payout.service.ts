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
