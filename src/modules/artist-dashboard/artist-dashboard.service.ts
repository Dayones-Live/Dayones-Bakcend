import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ArtistPost } from '../posts/modules/artist-post/entities/artist-post.entity';
import { ArtistPostUser } from '../posts/modules/artist-post-user/entities/artist-post-user.entity';
import { MerchDrop } from '../merch/entities/merch-drop.entity';
import { MerchOrder } from '../merch/entities/merch-order.entity';
import { OrderLedger } from '../merch/entities/order-ledger.entity';
import { Invite_Status } from '../posts/modules/artist-post-user/constants/constants';

@Injectable()
export class ArtistDashboardService {
  private readonly logger = new Logger(ArtistDashboardService.name);

  constructor(
    @InjectRepository(ArtistPost)
    private artistPostRepo: Repository<ArtistPost>,
    @InjectRepository(ArtistPostUser)
    private artistPostUserRepo: Repository<ArtistPostUser>,
    @InjectRepository(MerchDrop)
    private merchDropRepo: Repository<MerchDrop>,
    @InjectRepository(MerchOrder)
    private merchOrderRepo: Repository<MerchOrder>,
    @InjectRepository(OrderLedger)
    private orderLedgerRepo: Repository<OrderLedger>,
  ) {}

  async getStats(artistId: string) {
    const posts = await this.artistPostRepo.find({
      where: { user_id: artistId },
      order: { created_at: 'ASC' },
    });

    if (posts.length === 0) {
      return { totalRevenue: 0, totalFans: 0, totalEvents: 0, avgConversionRate: 0, events: [] };
    }

    const postIds = posts.map((p) => p.id);

    const fanCounts = await this.artistPostUserRepo
      .createQueryBuilder('apu')
      .select('apu.artist_post_id', 'postId')
      .addSelect('apu.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('apu.artist_post_id IN (:...postIds)', { postIds })
      .andWhere('apu.status IN (:...statuses)', {
        statuses: [Invite_Status.ACCEPTED, Invite_Status.PENDING, Invite_Status.REJECTED],
      })
      .groupBy('apu.artist_post_id')
      .addGroupBy('apu.status')
      .getRawMany();

    const fanMap: Record<string, { accepted: number; total: number }> = {};
    for (const row of fanCounts) {
      if (!fanMap[row.postId]) fanMap[row.postId] = { accepted: 0, total: 0 };
      const count = parseInt(row.count, 10);
      fanMap[row.postId].total += count;
      if (row.status === Invite_Status.ACCEPTED) {
        fanMap[row.postId].accepted = count;
      }
    }

    const drops = await this.merchDropRepo.find({
      where: { artist_post_id: In(postIds) },
    });
    const dropByPostId: Record<string, string> = {};
    const dropIds: string[] = [];
    for (const drop of drops) {
      dropByPostId[drop.artist_post_id] = drop.id;
      dropIds.push(drop.id);
    }

    const revenueByDrop: Record<string, { revenue: number; orderCount: number }> = {};
    if (dropIds.length > 0) {
      const orders = await this.merchOrderRepo.find({
        where: { merch_drop_id: In(dropIds) },
      });

      const ordersByDrop: Record<string, MerchOrder[]> = {};
      const orderIds: string[] = [];
      for (const order of orders) {
        if (!ordersByDrop[order.merch_drop_id]) ordersByDrop[order.merch_drop_id] = [];
        ordersByDrop[order.merch_drop_id].push(order);
        orderIds.push(order.id);
      }

      let ledgerByOrder: Record<string, number> = {};
      if (orderIds.length > 0) {
        const ledgers = await this.orderLedgerRepo.find({
          where: { merch_order_id: In(orderIds) },
        });
        for (const ledger of ledgers) {
          const share = Number(ledger.artist_share || 0);
          if (share > 0) {
            if (!ledgerByOrder[ledger.merch_order_id]) ledgerByOrder[ledger.merch_order_id] = 0;
            ledgerByOrder[ledger.merch_order_id] += share;
          }
        }
      }

      for (const dropId of dropIds) {
        const dropOrders = ordersByDrop[dropId] || [];
        let revenue = 0;
        for (const order of dropOrders) {
          revenue += ledgerByOrder[order.id] || 0;
        }
        const activeOrders = dropOrders.filter(
          (o) => !['CANCELLED', 'REFUNDED'].includes(o.status),
        ).length;
        revenueByDrop[dropId] = { revenue, orderCount: activeOrders };
      }
    }

    let totalFans = 0;
    let totalInvited = 0;
    let totalRevenue = 0;
    const events = [];

    for (const post of posts) {
      const fans = fanMap[post.id] || { accepted: 0, total: 0 };
      const dropId = dropByPostId[post.id];
      const dropData = dropId ? revenueByDrop[dropId] : null;

      const conversionRate =
        fans.total > 0
          ? Math.round((fans.accepted / fans.total) * 1000) / 10
          : 0;

      totalFans += fans.accepted;
      totalInvited += fans.total;
      totalRevenue += dropData?.revenue || 0;

      events.push({
        postId: post.id,
        imageUrl: post.image_url,
        message: post.message,
        locale: post.locale,
        date: post.created_at,
        fansCaptured: fans.accepted,
        fansInvited: fans.total,
        conversionRate,
        revenue: Math.round((dropData?.revenue || 0) * 100) / 100,
        orderCount: dropData?.orderCount || 0,
      });
    }

    const avgConversionRate =
      totalInvited > 0
        ? Math.round((totalFans / totalInvited) * 1000) / 10
        : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalFans,
      totalEvents: posts.length,
      avgConversionRate,
      events,
    };
  }
}
