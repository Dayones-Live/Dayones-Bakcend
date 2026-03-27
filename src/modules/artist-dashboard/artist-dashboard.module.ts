import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistDashboardController } from './artist-dashboard.controller';
import { ArtistDashboardService } from './artist-dashboard.service';
import { ArtistPost } from '../posts/modules/artist-post/entities/artist-post.entity';
import { ArtistPostUser } from '../posts/modules/artist-post-user/entities/artist-post-user.entity';
import { MerchDrop } from '../merch/entities/merch-drop.entity';
import { MerchOrder } from '../merch/entities/merch-order.entity';
import { OrderLedger } from '../merch/entities/order-ledger.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArtistPost,
      ArtistPostUser,
      MerchDrop,
      MerchOrder,
      OrderLedger,
    ]),
  ],
  controllers: [ArtistDashboardController],
  providers: [ArtistDashboardService],
})
export class ArtistDashboardModule {}
