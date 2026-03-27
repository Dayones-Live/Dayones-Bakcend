import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    let totalFans = 0;
    let totalInvited = 0;
    let totalRevenue = 0;
    const events = [];

    for (const post of posts) {
      const acceptedCount = await this.artistPostUserRepo.count({
        where: { artist_post_id: post.id, status: Invite_Status.ACCEPTED },
      });

      const invitedCount = await this.artistPostUserRepo.count({
        where: [
          { artist_post_id: post.id, status: Invite_Status.PENDING },
          { artist_post_id: post.id, status: Invite_Status.ACCEPTED },
          { artist_post_id: post.id, status: Invite_Status.REJECTED },
        ],
      });

      let eventRevenue = 0;
      let orderCount = 0;

      const drop = await this.merchDropRepo.findOne({
        where: { artist_post_id: post.id },
      });

      if (drop) {
        const orders = await this.merchOrderRepo.find({
          where: { merch_drop_id: drop.id },
        });

        for (const order of orders) {
          const ledger = await this.orderLedgerRepo.findOne({
            where: { merch_order_id: order.id },
            order: { created_at: 'DESC' },
          });

          if (ledger && Number(ledger.artist_share) > 0) {
            eventRevenue += Number(ledger.artist_share);
          }
        }

        orderCount = orders.filter(
          (o) => !['CANCELLED', 'REFUNDED'].includes(o.status),
        ).length;
      }

      const conversionRate =
        invitedCount > 0
          ? Math.round((acceptedCount / invitedCount) * 1000) / 10
          : 0;

      totalFans += acceptedCount;
      totalInvited += invitedCount;
      totalRevenue += eventRevenue;

      events.push({
        postId: post.id,
        imageUrl: post.image_url,
        message: post.message,
        locale: post.locale,
        date: post.created_at,
        fansCaptured: acceptedCount,
        fansInvited: invitedCount,
        conversionRate,
        revenue: Math.round(eventRevenue * 100) / 100,
        orderCount,
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
